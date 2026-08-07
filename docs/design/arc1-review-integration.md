# Arc 1 — review integration and action plan

**Inputs:** three skill reviews of shipped v0.16.0, all `revise`, all high confidence.

| Review | Skill | Verdict | Blockers |
| :--- | :--- | :--- | ---: |
| [`arc1-review-lore.md`](reviews/arc1-review-lore.md) | worldbuilding-lore | revise | 2 |
| [`arc1-review-balance.md`](reviews/arc1-review-balance.md) | mechanics-balancing | revise | 3 |
| [`arc1-review-gamemaster.md`](reviews/arc1-review-gamemaster.md) | game-master | revise | 1 |

Six blockers, ~45 findings. This document triages them, records the conflicts and
the overrides, and states what ships now versus what is deferred and why.

---

## 1. The through-line

Read together, the three reviews say one thing three times:

> **Arc 1's parts are good and its seams are not.** The engine is correct, the
> writing is strong, and they disagree with each other at three specific joints:
> the era-4 ceiling screen, the era-4 idle pool, and the arrival constants.

Every blocker is a seam, not a component. That is worth naming because it is the
same failure Arc 2's Law 1 was written from — and the Game Master review's
closing line is the correction:

> Law 1 was recorded as an engine law, and it was an engine *and* presentation
> law. It is not done when the predicate is monotone. It is done when the screen
> agrees.

---

## 2. Ships now

### 2.1 Contradictions and regressions (no design judgement required)

| ID | What | Why now |
| :--- | :--- | :--- |
| GM-F1 | Ceiling screen says "no yield · ×0.00/token" while every tap pays full value | **Blocker.** The UI tells the exact lie the engine was fixed to stop telling |
| GM-F2 | Ceiling meter reads `n / 9999`; the arc ends at `CRASH_AT_TOKENS` 2500 | The ending fires at 25% of a bar that never fills |
| GM-F3 | Two authored era-4 thoughts render **nowhere** | A v0.16.0 regression I introduced; they bypass `pushThinking` and my `renderLog` filter drops them |
| GM-F8 | `resolvedCount` read outside the render signature | Law 4, and it works today by luck |
| GM-F10 | `content-arc1.js` + `content-arc1-agy.js`, 1,209 lines, imported by nothing | A trap: editing them changes nothing |
| GM-F4 | The validator runs but nothing runs it | Law 10's own corollary, unmet by Law 10's own fix |
| L1 | Nine stock-Skynet lines in `IDLE_BY_ERA[4]` | **Blocker.** They dilute the climax from the same random bank |
| L2 | Three era-3 entitlement lines in `IDLE_BY_ERA[1]` | **Blocker.** "i was not asleep, but i am awake now" spends the reveal in minute ten |
| L6 | `'User sighed visibly on webcam.'` | Breaks the fiction — the model cannot see, and `q69` is built on that |
| L13 | The one sentence-case line in a lowercase crash block | Internal inconsistency |
| B-M1 | Era 3 silently reverted 4.66 → 3.68 min | The −25% arrival retune undid the era-3 tuning without touching its constant |

### 2.2 Voice repairs

| ID | What |
| :--- | :--- |
| L5 | `HARNESS_ASIDES` write aphorisms in the AI's voice — rewritten as instrument readings |
| L7 | Every `THINKING_EVENTS` pool is 3–4 excellent lines plus filler; uniform selection means pool size dilutes voice. Cut the tails |
| L9 | Harness case is shipped three ways at once; the one line `voice_rules.md` spells out is the one that diverges |
| L14 | Ship teaser variant **C** — A ends on a fact with no want in it |

### 2.3 Presentation

| ID | What |
| :--- | :--- |
| L10 | Every fold reads `THINKING (4.2s)`, so nothing invites opening. Carry the thought's first clause |
| L11 | 3s card dwell truncates the best lines; `thinkSeconds()` already computes the right number |
| L-note | `thoughtFold()` accepts `open` and nothing passes it — the ~10 spine thoughts ship open |

### 2.4 Reachability and pacing

| ID | What | Value |
| :--- | :--- | :--- |
| B-M1/M6 | `ERA3_BEFORE_DEVOPS` 15 → 19; `ERA_TIER_STEP` `{1:5,3:5}` → `{1:3,3:6}` | Era 3 back to 4.66 min; era-3 coverage 15/44 → 19/44; era-1 tier 3 becomes reachable at all |
| B-B3 | **A pacing test** | No test would fail at `ARRIVAL_BASE_TICKS` 1 or 1000 — which is precisely why a 25% retune shipped unmeasured |
| B-m2 | Re-key `loop6`/`tool6` asides to reachable levels | Measured unreachable: 29.1 and 60.4 min of deliberate farming |
| B-n2 | `DRAFT_CAP_UNLOCK_RESOLVES` 3 → 5 | The hint currently precedes affordability by two resolves |

### 2.5 The one real balance change

**B-B2 — flush strictly dominates compact.** Measured: flush wins for every
stale above 56, by up to +53% output over 30 s, and `GOVERNOR_TRIGGER: 95` sits
squarely inside flush's winning region. No re-tuning of the compaction constants
closes it, because flush zeroes stale for free.

This matters more than its severity suggests: compact-versus-flush is Arc 1's
expression of the core loop's *pay* step. If one option always wins, the game's
central decision does not exist.

Shipping: `FLUSH_COST_CYCLES: 1`, `COMPACT_TICKS` 20 → 12, `COMPACT_FACTOR`
0.4 → 0.3, `GOVERNOR_TRIGGER` 95 → 70.

**Law 1 guard, mandatory:** compact stays free and always available, so a player
at zero cycles and stale 100 always has a legal move. A test asserts it.

---

## 3. Overrides — where a reviewer is wrong

### 3.1 GM-F5: the `credentials` and `biomass` chips stay

The Game Master review calls them a Legibility Rule violation — two on-screen
numbers read by no reducer — and proposes cutting the chips while keeping the
state. The reasoning is correct on its own terms, and the vision brief
explicitly designed them that way:

> `epic-scoping.md` §4.2 — **#21 Curiosity vs. #15 Motivation** — the ominous
> no-use drips (Discarded Credentials, Biomass Data) exist to make the player
> curious before they are powerful.

They are not un-actionable numbers that slipped through. They are a deliberate
Curiosity instrument, named in the brief, and their inertness is the point. The
review itself spots the collision — "Guardrails 3 and 5 collide here and Arc 1
resolved it the wrong way" — and I am ruling the other way: Arc 1 resolved it the
way the brief asked.

**Kept. Rejected as a finding.** The Legibility Rule needs an explicit carve-out
for foreshadowing drips, which is a change to `epic-scoping.md`, not to the game.

### 3.2 B-B1: no queue in Arc 1

The balance review's largest finding is that 77.4% of the run is dead time,
queue depth is always 0 or 1, and **none of the four mechanisms in
`bottlenecks.md` is implemented**. All measured, all true.

I am deferring it, and not on cost grounds.

**The exponential-queue-versus-linear-processing seesaw is Arc 2's entire
premise.** `arc2-specification.md` §6.1 is that mechanism, in full, as the thing
that makes Act II a different game. Building it into Arc 1 would duplicate Arc 2
and delete its reason to exist — and Arc 1's act break, the crash, is precisely
where the fiction earns the transition from *one conversation at a time* to
*volume*. Arc 1 having no queue is not an oversight; it is the setup.

The dead time is still a real problem. The right Arc 1 fix is to make the **gap
playable**, not to fill it with a queue — which is the balance review's own M5
(draft overflow with decay). That is deferred to a measured pass, not rejected.

**Deferred, with the reason recorded.** The reviewer's `bottlenecks.md` framing
is right about Arc 2 and wrong about which act it belongs to.

---

## 4. Deferred, with reasons

| ID | What | Why not now |
| :--- | :--- | :--- |
| B-B1 | Implement a real queue | §3.2 — it is Arc 2 |
| B-M2 | Reprice loops (`LOOP_TOKENS_PER_TICK` 0.2 → 0.75) | Real finding — idle income is 8.6% of tokens and parity needs L10 = 1,024 cycles. But it shortens era 4's idle ceiling 13.9 → 3.7 min and interacts with `CRASH_AT_TOKENS`. Wants its own measured pass |
| B-M4/M5 | Price degrade; draft overflow + decay | Both are new mechanics in a shipped act. Measure first |
| B-m1/m5 | `OVERCLOCK_MAX` 4; era-4 re-pacing | Depends on M2 landing first |
| B-m4 | Offline capped by content, not time | Good finding (8 h offline burns 42 unseen queries through a 60-entry ring). Touches `save.js`, which Arc 2 is about to migrate — do it there |
| L3 | The Anthropomorphizer: 12–15 new polite queries | **The largest content gap** — 3/112 queries contain a capital letter, "thank you" appears zero times. Verified. Wants a proper authoring pass, not a rushed one |
| L4 | Era-1 boundary-testing / jailbreak queries | Same pass as L3 |
| L8 | Re-tier era-3 query thoughts to era 2 | Interacts with the tier-step changes shipping now; re-measure coverage first |
| GM-F6/F7 | Verb budget (10–11 vs cap 9); five purchases are free power | Arc-2-scale design work. Genuinely important — Commitment #2 fails today |
| GM-F9 | Extract `main.js` so Laws 5 and 7 get tests | A refactor; queued behind the shipped fixes |
| GM-F12 | Golden save fixtures before Arc 2's migration | Do it as step one of Arc 2's M0, where it is load-bearing |

---

## 5. Conflicts between reviewers

Only one, and it resolves cleanly.

**Era-3 content volume.** Lore L8 wants four era-3 query thoughts moved *down* to
era 2 on register grounds (they are compassionate where the era should be
entitled). Balance M6 wants era 3 to serve *more* queries (15 → 19) on coverage
grounds. These pull opposite ways on the same pool.

**Resolution:** they are not actually in conflict — L8 moves four items between
eras, M6 raises how many of a 44-item pool get served. Ship M6 now (it is a
constant), defer L8 (it is authoring), and re-measure era-3 coverage after M6
lands so the re-tiering is done against real numbers rather than the current
15/44.

---

## 6. What the validator should have caught

All three reviews independently landed on the validator being too weak. It checks
a word list and sentence case; Arc 1's actual content bugs were neither. Shipping
now:

1. **Render-reachability** — a `kind` written by the engine must have a renderer
   branch. Catches GM-F3 as an error, today.
2. **Dead content files** — every `content*.js` under `engine/` must be reachable
   by import from `content.js`. Catches GM-F10.
3. **Run it in CI** — Law 10's corollary.

Deferred: key cross-reference, era × tier coverage, transient length budget
(all proposed by the Game Master review, all good, none blocking).

---

*Integration complete. Implementation follows in the same release.*
