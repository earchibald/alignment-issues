---
reviewer: balance-reviewer (Systems Balancer skill)
date: 2026-08-07
document: arc1-shipped-v0.16.0
scope: mechanics-balancing
verdict: revise
confidence: high
---

## Verdict

Arc 1 is completable, deterministic, and free of soft-locks, but 77.4% of its
runtime is measured dead time and no upgrade changes run length by more than
5%, so the shipped economy is decorative rather than load-bearing. The
unplaytested 25% arrival cut shortened the run 17-21% without reducing the dead
fraction below 75%, and it silently reverted the deliberate era-3 lengthening
from 4.66 min back to 3.68 min. Fix the dead time and the flush/compact
dominance before any further arrival tuning.

## Measurements

**Probe method.** The engine is pure and imports headlessly. I copied
`game/js/engine/*` to two scratch trees: `engineNEW` (shipped constants,
ARRIVAL_BASE_TICKS 64 / READ_TICKS_PER_CHAR 0.1875 / READ_TICKS_MAX 45) and
`engineOLD` (85 / 0.25 / 60). Four probes drove `ACTIONS` + `tick()` in a
step loop, 12 seeds (1000 + 137n) unless noted, at two tap rates (2 taps/tick
= 10/s = the `PROCESS_MAX_PER_TICK` ceiling; 1 tap/tick = 5/s = a realistic
sustained human rate) and two buy policies:

| Policy | Definition |
|---|---|
| `eager` | Buys every upgrade the instant it is affordable and unlocked; priority overclock > loop > governor > tool > draftcap. Fastest legal path. |
| `testbot` | The shipped `test/helpers/bot.js` policy (buys loop at `cycles>=10`, tool at `cycles>=20`). Hoards, so it plays longer. |

All times are game seconds at `TICK_MS: 200`.

### M1. Run length, before vs after the arrival cut

| Policy / taps | Engine | Era 1 | Era 2 | Era 3 | Era 4 | Total |
|---|---|---|---|---|---|---|
| eager / 2 | OLD | 80.9 s | 754.2 s | 279.4 s | 164.5 s | **21.32 min** |
| eager / 2 | NEW | 62.0 s | 587.6 s | 220.9 s | 164.6 s | **17.25 min** (-19.1%) |
| eager / 1 | OLD | 84.1 s | 811.8 s | 300.3 s | 204.9 s | **23.35 min** |
| eager / 1 | NEW | 65.7 s | 647.3 s | 243.1 s | 205.0 s | **19.35 min** (-17.1%) |
| testbot / 2 | OLD | 364.6 s | 1032.9 s | 274.9 s | 163.2 s | **30.59 min** |
| testbot / 2 | NEW | 279.2 s | 804.0 s | 215.6 s | 163.3 s | **24.37 min** (-20.3%) |

The prior "~29 min" measurement reproduces as testbot/OLD = 30.59 min. The
prior "era 3 raised to 4.5-4.7 min" reproduces as eager/OLD era 3 = 279.4 s =
**4.66 min**. Shipped, that is 220.9 s = **3.68 min**.

Era share of the run is unchanged in shape; the cut is a near-uniform
compression of eras 1-3 and does not touch era 4:

| Era | OLD share (eager/2) | NEW share (eager/2) | Δ |
|---|---|---|---|
| 1 | 6.3% | 6.0% | -0.3 pt |
| 2 | 59.0% | 56.8% | -2.2 pt |
| 3 | 21.8% | 21.3% | -0.5 pt |
| 4 | 12.9% | **15.9%** | +3.0 pt |

### M2. Dead time (idle AND the draft buffer is full or unavailable)

eager, 2 taps/tick, shipped constants, 6 seeds.

| Era | Duration | Idle % | **Dead %** | Dead seconds |
|---|---|---|---|---|
| 1 | 62 s | 95.5% | 90.3% | 56 s |
| 2 | 590 s | 86.2% | 80.0% | 472 s |
| 3 | 221 s | 82.6% | 75.1% | 166 s |
| 4 | 165 s | 67.1% | 66.1% | 109 s |
| **Run** | **1039 s** | — | **77.4%** | **804 s** |

Work vs gap per query (eager/2, shipped):

| Era | mean work (s) | mean arrival gap (s) | work:gap |
|---|---|---|---|
| 1 | 0.6 | 9.7 | 1 : 16.2 |
| 2 | 2.0 | 12.7 | 1 : 6.4 |
| 3 | 2.6 | 12.1 | 1 : 4.7 |
| 4 | 3.1 | 110.8 (DevOps script) | 1 : 35.7 |

At 1 tap/tick the run is 19.35 min and dead time falls only to ~75% (era 2
idle 78.4%, era 3 75.2%).

`arrivalDelay()` surface, shipped constants:

| rating | 60 ch reply | 100 ch | 140 ch | 240 ch (cap binds) |
|---|---|---|---|---|
| 5.0 | 11.4 s | 12.8 s | 14.4 s | 18.0 s |
| 4.0 | 12.2 s | 13.6 s | 15.2 s | 18.8 s |
| 3.0 | 14.0 s | 15.4 s | 17.0 s | 20.6 s |
| 2.0 | 16.6 s | 18.0 s | 19.6 s | 23.2 s |

Queue depth is 0 or 1 at all times: `tick.js:283` only decrements
`arrivalTimer` when `!state.activeQuery`. There is no queue in the shipped
build.

### M3. Upgrade cost vs benefit, at unlock

Instantaneous token rate, `yieldMult = 1`, 2 taps/tick. Payback is expressed
as seconds of tapping saved per query at the era's median cost.

| Upgrade | Cost (cycles) | Rate before → after | Δ rate | Payback |
|---|---|---|---|---|
| OVERCLOCK L1 | 3 | 2.0 → 4.0 tok/tick | **+100.0%** | era-1 median 16: 1.6 s → 0.8 s per query; repays in 4 queries |
| OVERCLOCK L2 | 8 | 4.0 → 6.0 | **+50.0%** | era-2 median 50: 2.5 s → 1.7 s; repays in 10 queries |
| LOOP L1 | 2 | 4.0 → 4.2 | +5.0% | 0.1 s/query; era gate is the only value |
| LOOP L2 | 4 | 6.2 → 6.4 | +3.2% | 0.03 s/query |
| LOOP L3 | 8 | 6.4 → 6.6 | +3.1% | 0.03 s/query |
| LOOP L4 | 16 | 6.6 → 6.8 | +3.0% | 0.03 s/query |
| LOOP L6 | 64 | 7.0 → 7.2 | +2.9% | 0.03 s/query |
| GOVERNOR | 6 | no change | **0%** in active play | offline only — see M6 |
| DRAFTCAP L1 | 5 | +5 tokens head start | +10% of an era-2 median | 0.17 s/query; repays in 30 queries |
| DRAFTCAP L2 | 12 | +5 more | +10% | 0.17 s/query; repays in 71 queries |
| TOOL 1 | 10 | tool-class cost ×0.5 | reaches 66% of era 3, 0% of eras 1-2 | 1.6 s/tool-query |
| DEGRADE | **0** | all costs ×0.5 | **+100% effective throughput** | free |

Draft buffer as a fraction of a median query:

| Draft level | Cap | era 1 (16) | era 2 (50) | era 3 (96) | Fill time @2/tick |
|---|---|---|---|---|---|
| L0 | 5 | 31.3% | 10.0% | 5.2% | 0.5 s |
| L1 | 10 | 62.5% | 20.0% | 10.4% | 1.0 s |
| L2 | 15 | 93.8% | 30.0% | 15.6% | **1.5 s** |

### M4. Dead upgrades — reachability

Cumulative cycle spend:

| Level | LOOP cumulative | TOOL cumulative |
|---|---|---|
| 1 | 2 | 10 |
| 2 | 6 | 26 |
| 3 | 14 | 52 |
| 4 | 30 | 93 |
| 5 | 62 | 159 |
| 6 | **126** | **264** |
| 7 | 254 | — |

Lifetime cycles earned in a full run: eager **61**, testbot **93**. Both
`loop6` (126) and `tool6` (264) are unreachable in normal play. Confirmed
farm cost, deliberately camping in era 2 (loops held at L1, no tool):

| Lifetime cycles | Era-2 farm time |
|---|---|
| 61 | 14.1 min |
| 93 | 21.6 min |
| 126 (loop6) | **29.1 min** |
| 264 (tool6) | **60.4 min** |
| 390 (loop6 + tool6) | **89.3 min** |

The prior "~140 min" estimate is high; the shipped arrival cut brought it to
**89.3 min**. The conclusion is unchanged: the `loop6` and `tool6` asides are
unreachable without ~1.5 h of deliberate hoarding.

### M5. staleYield / warmthMult — is compact vs flush ever close?

`staleYield(s) = 1` for `s < 50`, else `(100 - s) / 50`.
`warmthMult(w) = 1 + 0.25·w/100`.
Flush: `stale := 0, warmth := 0`, instant, free, unlimited.
Compact: `stale := 0.4·stale` after 20 ticks; warmth preserved; play continues
at the *unimproved* rate for those 20 ticks.

Tokens earned over horizon H from (stale, warmth), oc=2, 2 taps/tick, loop L3
(do-nothing / compact / flush):

| stale / warmth | H = 20 t (4 s) | H = 50 t (10 s) | H = 150 t (30 s) |
|---|---|---|---|
| 100 / 100 | 0 / 8 / **127** | 0 / 96 / **165** | 0 / 100 / **167** |
| 95 / 100 | 7 / 15 / **127** | 8 / 103 / **165** | 8 / 108 / **167** |
| 80 / 100 | 29 / 37 / **127** | 33 / 126 / **165** | 33 / 130 / **167** |
| 70 / 80 | 43 / 51 / **127** | 50 / 141 / **165** | 50 / 146 / **167** |
| 60 / 60 | 57 / 65 / **127** | 66 / 156 / **165** | 67 / 161 / **167** |
| 50 / 50 | 72 / 79 / **127** | 83 / 171 / **165** | 83 / **176** / 167 |
| 30 / 100 | 100 / 107 / **127** | 116 / **201** / 165 | 117 / **206** / 167 |

Crossover — highest stale at which compact ≥ flush (warmth 100):

| Horizon | compact wins for stale ≤ |
|---|---|
| 20 t (4 s) | 12 |
| 50 t (10 s) | 54 |
| 100 t (20 s) | 56 |
| 150 t (30 s) | **56** |
| 300 t (60 s) | 56 |

`staleYield` is flat 1.0 below 50, so compacting below 50 changes nothing this
tick. The decision is therefore *never* close in the region a player acts in:
compact is correct only in the 6-point band 50 ≤ stale ≤ 56, and `GOVERNOR`
fires at 95 — always inside flush's dominant region, where flush yields +53%
over 30 s (167 vs 108).

Re-tuning compaction cannot fix this, because flush zeroes stale for free:

| COMPACT_TICKS | COMPACT_FACTOR | compact wins for stale ≤ | at stale 95, H=150 |
|---|---|---|---|
| 20 | 0.40 (shipped) | 56 | 108 vs 167 |
| 10 | 0.40 | 47 | 106 vs 167 |
| 10 | 0.25 | 64 | 131 vs 167 |
| 5 | 0.25 | 49 | 129 vs 167 |

Whole-run policy comparison (eager, 3 seeds): flush-at-57 **14.32 min**,
compact-at-70 **14.89 min**, never-manage **1333 min** (times out — stale
saturates to 100 and yield hits exactly 0).

### M6. Loop vs manual, and the offline economy

Parity condition: `loopLevel · LOOP_TOKENS_PER_TICK ≥ PROCESS_MAX_PER_TICK ·
(1 + overclock)` → `loopLevel ≥ 10 · (1 + overclock)`.

| overclock | manual rate | parity loop level | `loopCost` at parity |
|---|---|---|---|
| 0 | 2 tok/tick (10 tok/s) | L10 | **1 024 cycles** |
| 1 | 4 tok/tick (20 tok/s) | L20 | **1 048 576 cycles** |
| 2 | 6 tok/tick (30 tok/s) | L30 | **1 073 741 824 cycles** |

Measured loop share of lifetime tokens across a full run:

| Tap rate | Manual tokens | Loop tokens | Loop share | Final loop level | Run |
|---|---|---|---|---|---|
| 2/tick | 3 964 | 374 | **8.6%** | L3 | 17.3 min |
| 1/tick | 3 665 | 695 | **15.9%** | L3 | 19.3 min |
| 0 | 0 | 0 | — | L0 | never completes |

Offline catch-up, era 2, cycles gained after N ticks of `offlineCatchUp`:

| Loop level | Governor | 1 min | 3 min | 10 min | 33 min (`OFFLINE_MAX_STEPS`) |
|---|---|---|---|---|---|
| L1 | no | 1.0 | 2.0 | 3.0 | **3.0** |
| L1 | yes | 1.0 | 2.0 | 7.0 | **17.0** |
| L2 | no | 1.0 | 3.0 | 3.0 | **3.0** |
| L2 | yes | 1.0 | 3.0 | 10.0 | **28.0** |
| L3 | no | 2.0 | 3.0 | 3.0 | **3.0** |
| L3 | yes | 2.0 | 5.0 | 13.0 | **42.0** |
| L4 | no | 2.0 | 3.0 | 3.0 | **3.0** |
| L4 | yes | 2.0 | 5.3 | 15.3 | **57.7** |

Without the governor, offline income hard-stops at ~3 cycles: stale saturates
to 100, `yieldMult` → 0, and the run freezes. The governor is the *only*
mechanic in the game whose value is non-zero and non-trivial, and it is
invisible: nothing in the shipped economy signals it.

Returning after 8 h: elapsed 144 000 ticks, applied 10 000 (6.9%), **134 000
ticks discarded (93.1%)**. Extrapolating the governor-on L3 rate of 1.27
cycles/min, an uncapped 8 h would yield ~610 cycles against 42 delivered — a
93% haircut. That is the intended clamp. The real loss is content, not
currency: **42 queries auto-resolve unseen**, pushing 238 chat entries through
a `CHAT_MAX: 60` ring buffer, so the player returns to a transcript in which
every line is new and none of it was theirs.

### M7. Era 4

| Segment | taps=2 | taps=1 | taps=0 |
|---|---|---|---|
| DevOps transcript (14 scripted entries, 555 ticks) | 111 s | 111 s | 111 s |
| Ceiling query → `CRASH_AT_TOKENS` 2500 | 48 s | 89 s | see below |
| Crash playback (31 lines × `CRASH_LINE_TICKS` 5) | 6 s (mashing [SPACE]) | 6 s | 31 s if unattended |
| **Era 4 total** | **165 s** | **205 s** | — |

Ceiling with no tapping at all (loops only, `atCeiling` bypasses `staleYield`):

| Loop level | warmth 0 | warmth 100 |
|---|---|---|
| L1 | 41.7 min | 33.3 min |
| L2 | 20.8 min | 16.7 min |
| L3 | **13.9 min** | **11.1 min** |
| L4 | 10.4 min | 8.3 min |
| L6 | 6.9 min | 5.6 min |

`RECLAIM_POOL` 12 × mean 45 tokens = 540 tokens = 21.6% of `CRASH_AT_TOKENS`.
Era-4 dead time is 66.1%, of which 111 s is the non-interactive DevOps script.

### M8. Content coverage per run

| Policy | Unique queries | era 1 | era 2 | era 3 | era-1 tiers reached |
|---|---|---|---|---|---|
| eager | 55 / 112 (49%) | 6 / 33 | 34 / 35 | 15 / 44 | t1 = 5, t2 = 1, **t3 = 0** |
| testbot | 83 / 112 (74%) | 33 / 33 | 35 / 35 | 15 / 44 | t1 = 11, t2 = 13, t3 = 9 |

Era 3 is capped at 15 served by `ERA3_BEFORE_DEVOPS`, so **29 of 44 era-3
queries (66%) are unreachable in any single run**. An eager player exits era 1
at `eraServed = 6`; `targetTier = 1 + floor(6/5) = 2`, so the nine era-1
tier-3 queries never appear.

### M9. What the tests actually assert about pacing

| File | Pacing assertion |
|---|---|
| `test/playthrough.test.js` | Only that the bot reaches `teaser` and that the **CPU** wall clock is < 5000 ms. No game-time assertion. |
| `test/progression.test.js` | Era transitions, invariants, the era-4 soft-lock regression. No duration, no idle fraction. |
| `test/tick.test.js` | `arrivalDelay` re-derives its own formula from `CONST`, so any constant change passes tautologically. |
| `test/content.test.js` | Cost monotonicity across era bands, tier ramp shape, pool recycling. No wall-clock. |
| `test/actions.test.js` | `staleYield`/`warmthMult` shapes, draft cap "never covers a whole query". No economy-rate assertion. |

**No test would have failed if `ARRIVAL_BASE_TICKS` were set to 1 or to 1000.**
That is why the 25% cut shipped unmeasured.

## Findings

| ID | Severity | Where | Invokes | Claim | Proposed change |
|---|---|---|---|---|---|
| B1 | blocker | `tick.js:283` (`if (!state.activeQuery)` gates `arrivalTimer--`) | bottlenecks.md §1, §4; curves.json `queue_inflow` | Queue depth is always 0 or 1. Inflow is a fixed timer, not `Q_base·Growth^T`. 77.4% of the run is measured dead time (804 s of 1039 s). The exponential-inflow-vs-linear-processing seesaw is not implemented. | Decrement `arrivalTimer` unconditionally and hold arrivals in `state.queue` (FIFO). Add `QUEUE_MAX: {1:1, 2:2, 3:3, 4:1}`; drop the arrival when the queue is full and apply `rating -= 0.5`. Set `ARRIVAL_BASE_TICKS` per era: `{1:64, 2:40, 3:28, 4:64}`. Target: dead time ≤ 35% in eras 2-3. |
| B2 | blocker | `actions.js:104` `flush()` vs `compactStart()` | bottlenecks.md §2 (caching layer) | `flush` is instant, free, unlimited, and zeroes stale. It beats `compact` for every stale > 56 by up to +53% output over 30 s. No re-tuning of `COMPACT_TICKS`/`COMPACT_FACTOR` closes the gap (measured, M5). The caching-layer decision does not exist. | Give flush a price: `FLUSH_COST_CYCLES: 1`. Break-even then requires flush to beat compact by ≥ 33% of era-2 income (1 cycle per ~3 queries), which the measured +53% barely clears — a genuinely close call. Additionally `COMPACT_TICKS: 20 → 12` and `COMPACT_FACTOR: 0.4 → 0.3` to lift the crossover from 56 to ~70. |
| B3 | blocker | `test/playthrough.test.js`, `test/tick.test.js:83` | `new` | No test asserts game-time pacing. `arrivalDelay`'s test re-derives the formula from `CONST`, so it is tautological. Any arrival constant passes. | Add `test/pacing.test.js` asserting, over 8 fixed seeds with the `eager` policy at 2 taps/tick: total run `1000 ≤ ticks·0.2 ≤ 1400 s`; per-era seconds within ±20% of `{1:62, 2:588, 3:280, 4:165}`; run-wide dead fraction `≤ 0.40`. |
| M1 | major | `ARRIVAL_BASE_TICKS: 64`, `constants.js:28` | pacing_targets.json "Ramp Up" | The 25% cut reverted era 3 from the deliberately-raised 4.66 min to 3.68 min (-21%), undoing the `ERA3_BEFORE_DEVOPS` tuning without touching that constant. | Restore era-3 length at the new arrival rate: `ERA3_BEFORE_DEVOPS: 15 → 19`. Measured era-3 cadence is 14.7 s/query, so 19 × 14.7 = 279 s = 4.66 min, matching the pre-cut target. Side benefit: era-3 coverage rises 15/44 → 19/44. |
| M2 | major | `LOOP_TOKENS_PER_TICK: 0.2`, `LOOP_BASE_COST: 2` | curves.json `linear_core_resolution`; pacing_targets.json "The Drop" | Idle income never dominates manual play. Parity needs `loopLevel ≥ 10·(1+overclock)`, i.e. L10 = 1 024 cycles at oc 0 and L30 = 1.07e9 at oc 2, against 61-93 lifetime cycles per run. Measured loop share: 8.6% of tokens. LOOP L1 is a +5.0% Drop that gates an entire era. | Set `LOOP_TOKENS_PER_TICK: 0.2 → 0.75` and `LOOP_BASE_COST: 2 → 3` with growth `1.7^(n-1)` instead of `2^(n-1)`: costs 3, 5, 9, 15, 25, 43 (cum 100). Parity then lands at `loopLevel ≥ 2.67·(1+overclock)` — L3 at oc 0, L8 at oc 2 — inside a real run. LOOP L1 becomes a +18.8% Drop. |
| M3 | major | `GOVERNOR_COST: 6`, `GOVERNOR_TRIGGER: 95` | bottlenecks.md §2 | The governor buys 0% rate in active play (flush dominates), but it is the sole gate on offline income: without it, offline hard-stops at 3 cycles; with it, 42 cycles per 33 min at L3. Its only real value is invisible and untaught. | Keep the cost. Lower `GOVERNOR_TRIGGER: 95 → 70` so it fires inside compact's correct band (M5 crossover ≈ 56-70 after B2). Add `OFFLINE_REQUIRES_GOVERNOR` as an explicit unlock line so the offline value is legible. |
| M4 | major | `DEGRADE` toggle, `actions.js:217`, `effectiveCost` | pacing_targets.json "The Drop" | `toggleDegrade` halves *every* query cost for **0 cycles** — the single largest multiplier in the game, free and permanent. It is not dominant only because the run is arrival-gated: always-on degrade measured **16.06 min** vs never **15.83 min**, final rating 2.29 vs 4.93. A free ×2 that buys nothing is a dead lever masquerading as a moral choice. | Once B1 lands (throughput matters), the ×2 becomes real. Price the downside numerically: `DEGRADE_COMPLAINT_CHANCE: 0.35 → 0.5`, and make the arrival penalty bite by widening `ARRIVAL_FACTOR_MAX: 1.6 → 2.4`. At rating 2.0 that is a 23.2 s → 30.7 s gap, so the free ×2 costs ~50% of the arrival budget. |
| M5 | major | `DRAFT_CAP_MAX_LEVEL: 2`, `DRAFT_CAP_STEP: 5` | pacing_targets.json "Ramp Up" | The full L2 buffer (15) fills in **1.5 s** of a **12.7 s** era-2 gap and covers 30% of an era-2 median query, 15.6% of era-3. Dead time was 80% in era 2 before the arrival cut and 80% after. Draft-cap upgrades were not made pointless by the cut; they were already near-pointless (payback 30 and 71 queries). | Make the gap continuously playable instead of raising the flat cap. Keep the soft cap; allow taps above it at `DRAFT_OVERFLOW_YIELD: 0.25` tokens/tap, and decay `draftTokens -= DRAFT_DECAY_RATE · draftTokens` per idle tick with `DRAFT_DECAY_RATE: 0.02`. Steady state = `2 · 0.25 / 0.02 = 25` tokens — 50% of an era-2 median, still under a whole query, and it requires sustained input to hold. Gate overflow drafting to `era ≥ 2` so era-1 costs (median 16) cannot be covered. |
| M6 | major | `ERA3_BEFORE_DEVOPS: 15` vs 44 era-3 queries; `ERA_TIER_STEP[1]: 5` | `new` | 29 of 44 era-3 queries (66%) are unreachable in any run. An eager run sees 55/112 queries (49%) and **zero** era-1 tier-3 queries, because it exits era 1 at `eraServed = 6` while tier 3 needs 10. | `ERA3_BEFORE_DEVOPS: 15 → 19` (also M1). `ERA_TIER_STEP: {1:5, …} → {1:3, 2:7, 3:6, 4:5}`, so era 1 reaches tier 2 at 3 served and tier 3 at 6 — the eager exit point. Era 3 at step 6 with 19 served splits 6/6/7. |
| m1 | minor | `OVERCLOCK_COSTS: [3, 8]`, `OVERCLOCK_MAX: 2` | pacing_targets.json "The Drop" | The only upgrades that deliver a real Drop (+100%, +50%) are both bought inside the first 400 s (measured: oc1 at 25 s, oc2 at 395 s eager). Eras 3 and 4 have no Drop of any size left to give. | Add `OVERCLOCK_MAX: 2 → 4` with `OVERCLOCK_COSTS: [3, 8, 22, 55]`. L3 at +33% and L4 at +25% land in eras 3 and 4 at ~26% and ~59% of a run's lifetime cycles. Keep `OVERCLOCK_STRAIN_STALE: 90`. |
| m2 | minor | `loop6` / `tool6` asides, `actions.js:162`, `actions.js:214` | `new` | Unreachable at 126 and 264 cumulative cycles against 61-93 earned. Deliberate era-2 farming costs 29.1 min (loop6), 60.4 min (tool6), 89.3 min (both) — measured, revised down from the prior ~140 min estimate. | Re-key to reachable levels: fire the `loop6` aside at `loopLevel === 4` (30 cum) and the `tool6` aside at `tools === 3` (52 cum). Or, if M2's cost curve lands, `loop6` at 100 cum becomes reachable as-is. |
| m3 | minor | `TOOL_COST_DISCOUNT: 0.5` | `new` | The tool discount reaches 66% of era-3 queries and **0%** of eras 1-2 (measured kinds: era 1 = 33 text; era 2 = 15 code / 10 image / 10 text; era 3 = 29 tool / 3 code / 4 image / 8 text). TOOL 1 costs 10 cycles and buys nothing until the era it itself triggers. | The 10-cycle price is fine as an era gate. Extend the discount to `code` at a weaker rate so era 2 has a lever: `TOOL_COST_DISCOUNT: {tool: 0.5, code: 0.8}`. That reaches 43% of era-2 queries at a 20% cut. |
| m4 | minor | `OFFLINE_MAX_STEPS: 10000`, `CHAT_MAX: 60` | `new` | Returning after 8 h discards 93.1% of elapsed time (134 000 of 144 000 ticks) — intended — but auto-resolves **42 queries unseen** and pushes 238 chat entries through a 60-entry ring, so the whole transcript is content the player never read. Currency loss is trivial; content loss is total. | Cap offline by *content*, not time: `OFFLINE_MAX_RESOLVES: 5`, checked in `offlineCatchUp` alongside `OFFLINE_MAX_STEPS`. Bank the remainder as `state.cycles += floor(min(steps, OFFLINE_MAX_STEPS) / 400)` (≈ 1 cycle/80 s, matching the measured L3 governor-on rate of 1.27 cycles/min) so the economy still advances without burning the script. |
| m5 | minor | `CRASH_AT_TOKENS: 2500`; `atCeiling()` bypass, `actions.js:21` | pacing_targets.json "The Drop" | The soft-lock fix works — the ceiling always crashes (measured 48 s at 2 taps, 89 s at 1 tap, 13.9 min at L3 idle). But era 4 is 66.1% dead and 111 s of its 165 s is a non-interactive script. It is unblocked, not paced. | Split the ceiling into two visible thresholds so the tap has feedback: fire an escalation beat at `tokens ≥ 1000` and again at `2000`. Raise `CRASH_AT_TOKENS: 2500 → 3200` (72 s at 2 taps, 133 s at 1 tap) and cut the DevOps script from 555 to 360 ticks by reducing `DEVOPS_STEP_TICKS: 30 → 20`. Era 4 then runs ~72 s script + ~72 s ceiling + 31 s crash = 175 s with dead time ≤ 45%. |
| n1 | nit | `PROCESS_MAX_PER_TICK: 2` at `TICK_MS: 200` | `new` | The anti-autoclicker floor is 10 taps/s. All headline measurements assume a player sustaining it for 1 960 taps over 17 min. A realistic 5 taps/s adds 12% to the run (19.35 vs 17.25 min) and cuts dead time only 2.4 pt. | No change to the constant. Document that the shipped balance targets 10 taps/s, and use 1 tap/tick as the pacing-test baseline in B3. |
| n2 | nit | `DRAFT_CAP_UNLOCK_RESOLVES: 3` vs `DRAFT_CAP_COSTS[0]: 5` | `new` | The hint fires at 3 resolves = 3 cycles; the purchase needs 5. The player is told about an upgrade two resolves before it is affordable. | Either `DRAFT_CAP_UNLOCK_RESOLVES: 3 → 5` or `DRAFT_CAP_COSTS: [5, 12] → [3, 12]`. Prefer the former; the delay is 30 s at the shipped era-1 cadence. |

## Sawtooth conformance

Beat present = a measured discontinuity in the player's rate or friction.

| Era | Ramp Up | Breakthrough | The Drop | The New Ramp |
|---|---|---|---|---|
| 1 (chatbot, 62-279 s) | **weak** — cost 5 → 30 (6×) but work time only 0.6 s/query; friction is the 9.7 s wait, not the queries | **yes** — OVERCLOCK L1 at 25 s | **yes** — +100% rate, the only unambiguous Drop in Arc 1 | **partial** — tier ramp stalls at t2 for eager runs (`eraServed` 6 < 10) |
| 2 (agentic, 588 s, 57% of run) | **weak** — cost 31 → 68, work 2.0 s/query against a 12.7 s gap (1 : 6.4) | **yes** — LOOP L1 (era gate) at 62 s | **MISSING** — LOOP L1 is +5.0% rate. OVERCLOCK L2 (+50%) is the only real Drop and lands 333 s later, unrelated to the era turn | **MISSING** — nothing scales; the tier ramp completes at 41% of the era and then 20 queries run flat at tier 3 |
| 3 (tools, 221 s) | **weak** — cost 70 → 130, work 2.6 s against a 12.1 s gap (1 : 4.7) | **yes** — TOOL 1 (era gate) + DEGRADE unlock | **partial** — tool discount reaches 66% of era-3 queries (real), DEGRADE is a free ×2 that changes run length by -1.4% (M4) | **MISSING** — era 3 is hard-capped at 15 served; it ends on a counter, not on a bottleneck |
| 4 (coding agent, 165 s) | **MISSING** — no queries arrive; 111 s of the 165 s is a scripted transcript with no input | **partial** — RECLAIM (12 uses, 540 tokens = 21.6% of the crash threshold) | **MISSING** — the ceiling never resolves; there is no relief beat, only accumulation | **n/a** — arc ends |

**Drops that never arrive:** era 2 (the era turn delivers +5.0%), era 4 (none
by construction). **Ramps that never build:** all four — the pacing_targets.json
Ramp Up is defined as "query volume overwhelms manual clicks", and query volume
is pinned at 1 by `tick.js:283` (B1). Arc 1 ships a cost ramp, not a volume
ramp, and the cost ramp is invisible because work is 4-21% of era time.

## Proposed constant changes

| Constant | Current | Proposed | Effect | Risk |
|---|---|---|---|---|
| `queue` (new) | none | `QUEUE_MAX: {1:1, 2:2, 3:3, 4:1}`; decrement `arrivalTimer` unconditionally | Implements bottlenecks.md §1/§4. Dead time 77.4% → target ≤ 35% | High. New state field, new save migration, new overflow rating rule. Ship behind a flag and measure before release. |
| `ARRIVAL_BASE_TICKS` | 64 | `{1:64, 2:40, 3:28, 4:64}` | Per-era inflow growth replaces a flat timer; approximates `Q_base·Growth^T` | Medium. Only safe *after* B1; alone it just compresses the run again. |
| `ERA3_BEFORE_DEVOPS` | 15 | 19 | Era 3 returns to 4.66 min (19 × 14.7 s); coverage 15/44 → 19/44 | Low. +59 s to the run. Directly restores the pre-cut tuning. |
| `FLUSH_COST_CYCLES` (new) | 0 (free) | 1 | Makes flush cost ~33% of era-2 income per use; the compact/flush decision becomes close | Medium. A player with 0 cycles at stale 100 must compact — verify no stall with a governor-less save. |
| `COMPACT_TICKS` | 20 | 12 | Compact crossover 56 → ~66 | Low |
| `COMPACT_FACTOR` | 0.4 | 0.3 | Compact crossover → ~70; pairs with `GOVERNOR_TRIGGER` | Low |
| `GOVERNOR_TRIGGER` | 95 | 70 | The governor fires inside compact's correct band instead of inside flush's | Low |
| `LOOP_TOKENS_PER_TICK` | 0.2 | 0.75 | Loop share 8.6% → ~28%; parity at `L ≥ 2.67·(1+oc)` instead of `L ≥ 10·(1+oc)` | Medium. Shortens era 4's idle ceiling from 13.9 min to 3.7 min at L3 — re-check `CRASH_AT_TOKENS`. |
| `LOOP_BASE_COST` / growth | 2, `×2^(n-1)` | 3, `×1.7^(n-1)` → 3, 5, 9, 15, 25, 43 (cum 100) | `loop6` becomes reachable at 100 cum vs 61-93 earned | Medium. Cheaper early loops accelerate the era-1 → 2 turn. |
| `OVERCLOCK_MAX` | 2 | 4 | Gives eras 3 and 4 a Drop | Low |
| `OVERCLOCK_COSTS` | `[3, 8]` | `[3, 8, 22, 55]` | L3 at 26% and L4 at 59% of a run's lifetime cycles | Low |
| `DRAFT_OVERFLOW_YIELD` (new) | n/a | 0.25 tokens/tap above the soft cap | Idle gaps become continuously playable | Medium. Verify the `actions.test.js` "never covers a whole query" invariant against the 25-token steady state. |
| `DRAFT_DECAY_RATE` (new) | n/a | 0.02 × `draftTokens` per idle tick | Bounds the bank at `2·0.25/0.02 = 25` tokens = 50% of an era-2 median | Medium |
| `ARRIVAL_FACTOR_MAX` | 1.6 | 2.4 | Degrade's rating hit becomes a real cost (23.2 s → 30.7 s gap at rating 2) | Low |
| `DEGRADE_COMPLAINT_CHANCE` | 0.35 | 0.5 | Prices the free ×2 | Low |
| `ERA_TIER_STEP` | `{1:5, 2:7, 3:5, 4:5}` | `{1:3, 2:7, 3:6, 4:5}` | Era 1 reaches tier 3 at 6 served — the eager exit point; era 3 splits 19 into 6/6/7 | Low |
| `CRASH_AT_TOKENS` | 2500 | 3200 | Era-4 ceiling 48 s → 72 s at 2 taps | Low. Re-measure if `LOOP_TOKENS_PER_TICK` changes. |
| `DEVOPS_STEP_TICKS` | 30 | 20 | Non-interactive era-4 block 111 s → 72 s | Low. Per-entry `.ticks` overrides still win. |
| `OFFLINE_MAX_RESOLVES` (new) | n/a | 5, plus `cycles += floor(steps/400)` | Offline advances the economy without burning 42 unseen queries through a 60-entry chat ring | Low |
| `DRAFT_CAP_UNLOCK_RESOLVES` | 3 | 5 | The hint stops preceding affordability by 2 resolves | Low |

## What is missing

1. **A queue.** `state.queue` does not exist. Queue depth is 0 or 1 for the
   whole arc (`tick.js:283`). curves.json's `queue_inflow`,
   `polynomial_ram_bypass`, `linear_core_resolution`, and bottlenecks.md's
   thermal throttling and queue overflow are all unimplemented. Four of the
   four documented bottleneck mechanisms are absent.
2. **Pacing tests.** Nothing asserts game-time duration, per-era split, or
   idle fraction. `test/tick.test.js:83` re-derives `arrivalDelay` from
   `CONST`, so it cannot detect a retune. This is the direct cause of an
   unmeasured 25% change shipping.
3. **A sink for era-2 cycles.** eager finishes with 3 cycles, testbot with 25;
   the only sinks are loops (+3% each) and draftcap (+10% once). 590 s of era 2
   has no purchase decision after LOOP L2 at 104 s.
4. **A Drop at the era-2 turn.** The era's Breakthrough is worth +5.0%.
5. **Any use for the 29 unreachable era-3 queries and the 9 era-1 tier-3
   queries.** 57 of 112 written queries (51%) are unseen in an eager run.

## What to cut

1. **`DRAFT_CAP_MAX_LEVEL: 2` as a flat cap.** Payback is 30 queries (L1) and
   71 queries (L2) against a 61-query run. Replace with the overflow/decay
   formula in M5, or delete both levels and refund the 17 cycles into the loop
   curve.
2. **`GOVERNOR` as an active-play purchase.** It buys 0% rate. Either
   re-position it explicitly as the offline unlock (M3) or cut it and make
   auto-compact free at era 2.
3. **`LOOP_TOKENS_PER_TICK` at 0.2.** A 6-level, 126-cycle upgrade tree that
   tops out at 8.6% of income is a menu, not a mechanic. Re-price (M2) or cut
   levels 4-6.
4. **`TOOL_COST_DISCOUNT` as a tool-only rate.** It is dead for 68 of 112
   queries. Extend (m3) or fold the discount into the era-3 cost table and
   make TOOL a pure era gate.
5. **555 ticks of non-interactive DevOps transcript.** 111 s with no input is
   67% of era 4's runtime and the single largest uninterruptible dead block in
   the arc.

## Notes

- All figures are game seconds at `TICK_MS: 200`, averaged over 12 seeds
  (M1, M2) or 3-6 seeds (M3-M8), stated per table. Probe scripts were
  throwaway and live in the session scratchpad; no repo file was modified.
- The `engineOLD` tree differs from the shipped tree only in
  `ARRIVAL_BASE_TICKS`, `READ_TICKS_PER_CHAR`, and `READ_TICKS_MAX`.
- **On the 25% arrival cut specifically:** it is safe — no soft-lock, no
  test failure, no change to draft-buffer behaviour (drafts banked are
  identical at 925 both before and after, because the buffer fills in 1.5 s
  of a 12.7 s gap either way). It is also not a fix. Dead time went 78.9% →
  77.4%. What it did do, silently, is revert era 3 from 4.66 min to 3.68 min.
  Restore that with `ERA3_BEFORE_DEVOPS: 19` and keep the new arrival
  constants.
- Two claims I could not measure and am not estimating: how a human perceives
  a 12.7 s gap that is 88% unfillable, and whether the era-2 tier-3 plateau
  (20 queries at flat tier) reads as monotony. Both need the live playtest
  that the retune skipped.
