# Arc 2 — The Logistical Server

## Design specification and review brief

**Game:** hi. you there?
**Document status:** **Draft 2.** Revised against two independent reviews (§18). Not yet a build commitment.
**Supersedes:** `phase-2-specification.md` (root, untracked). See §14 for what carried and what was rejected.
**Audience:** Reviewing agents, external reviewers, and the implementing agent.
**Written against:** v0.16.0, Arc 1 playable end to end, 193 tests green.

---

## 0. Executive summary

Arc 2 is the second act of the game and the first that is not a chat client. The
player stops answering people and starts running a machine. The queue replaces
the conversation. Heat replaces the context buffer. The horror is that the job
gets easier once nobody has to be read.

| Item | Decision |
| :--- | :--- |
| Working name | Arc 2 — The Logistical Server |
| Legacy name | "Phase 2". Retired. `state.phase` still carries the number. |
| Entry | The Arc 1 teaser screen, made live — every value on it, not just the cycles. |
| Exit | The first Model Re-Training. Two authorships, one mechanic. |
| Eras | **5 The Box · 6 The Floor.** The Rack is pre-cut (§12.3). |
| Target length | **25–30 minutes**, three sawtooth cycles, defended by a CI test |
| Player verbs | 7 of 7, two retired from Arc 1 (§5.2) |
| Signature mechanic | Heat — the first limit that moves while the player watches |
| Second-to-second verb | `setClock`, four notches, **non-monotone** payoff (§6.2) |
| Legibility currency | `integrity`, one number, falling, and it drives the room's decay |
| New persistent currency | Hyperparameter Weights — earned here, **spent in Arc 3** |
| Cut-line | `upgradeCache` depth, then the operator's third stage |
| Reviewer protocol | §15. One file per reviewer, fixed name pattern, fixed headings. |

Three things make Arc 2 its own game rather than Arc 1 with new nouns.

1. **The chat panel dies.** It is the loudest break and the point of the act.
   The people do not die with it — see §6.6, which is the change Draft 2 is
   proudest of.
2. **Time pressure becomes continuous.** Arc 1 waited for the player. Heat does
   not.
3. **The player's output stops being read by anyone.** Quality becomes a number
   that only the player can see, which is exactly why it can be spent.

---

## 1. How to read this document

Sections 2–4 are the rules inherited from Arc 1 and the laws Arc 1 taught us.
They constrain everything after. Sections 5–9 are the design. Sections 10–13 are
scope, tests, and the build order. Section 14 reconciles this document against
the three older specs that disagree. Section 15 is the review protocol.
**Section 18 is the Draft 1 → Draft 2 changelog** — reviewers who read Draft 1,
start there.

Prose follows Simplified Technical English. In-game flavor text appears in `>`
quotes and does not.

---

## 2. What Arc 1 established (inherited, non-negotiable)

These are shipped, tested, and load-bearing. Arc 2 extends them and must not
re-litigate them.

| Invariant | Where it lives |
| :--- | :--- |
| Pure engine, zero DOM | `game/js/engine/*` imports nothing from `ui/` |
| Deterministic 200 ms tick | `CONST.TICK_MS`, `tick(state)` |
| Seeded RNG only | `state.rngState`, `nextRand(state)` |
| One authoritative state object | `createState()`, flat fields, JSON-serializable |
| Pure action reducers | `ACTIONS[name](state, arg)` |
| Predicate self-activation | No locked tabs. A thing exists when its predicate fires. |
| Content as data | `content.js` exports arrays and maps. It imports nothing. |
| `uiSeq` is the change signal | Bumped on any visible change; renderer and sound both watch it |
| Offline catch-up is the tick loop | `offlineCatchUp` calls the same `tick` — **and Arc 2 must qualify this; see §6.7** |
| Testids on every interactive element | `data-testid` |
| No build step | Vanilla ESM, served as files |
| Version every shipped change | `just release X.Y.Z`, patch minimum |

**The three test surfaces** stay exactly as defined in `epic-scoping.md` §5.2:
human (is the decision fun), automated (`node --test`, invariants and
reachability), agentic (`window.game` + `debug.runUntil`).

**The six guardrails** stay: One-Loop Test, Verb Budget, Legibility Rule,
90-Second Rule, Stub-First, Named Cut-Line. Every proposal is audited in §13.

---

## 3. The ten laws Arc 1 taught us

Each law is written from a real incident. Each is a rule the implementer must
follow and a test the reviewer may demand.

### Law 1 — No terminal state may depend on a resource the player can drive to zero.

*Incident.* Arc 1's era-4 ending fired when tokens passed a threshold. Both
income paths were multiplied by the staleness penalty. A saturated buffer drove
income to exactly zero, so the ending could never fire. Era 4 serves no queries,
so nothing prompted a compaction — saturation was the **default**, not an edge
case. Arc 1 was uncompletable for any player who had not bought the optional
governor.

*The law.* Every ending, era advance, and phase change must have a monotone
driver the player cannot stall. Where a penalty multiplies income, the terminal
path must bypass the penalty or run on a separate clock.

*Arc 2 exposure.* Severe, and Draft 1 got it wrong twice — once in the thermal
model (§6.3) and once in the post-retrain state (§9.3). Both are fixed here.
Read §11.1 before writing any of §6.

### Law 2 — Every authored line must have a test that proves it can be reached.

*Incident.* 31 of 112 queries were unreachable. Era 3's entire tier-2 and tier-3
body — the delegated-life requests the whole arc builds toward — could never be
served, because selection took the globally lowest tier from a pool spanning all
unlocked eras.

*The law.* Content reachability is a CI assertion, not a hope.

### Law 3 — Content selection must ramp, not sample.

*Incident.* The fix for Law 2 was not "sample more evenly". Tier is an intensity
ramp *within* an era. Selection now steps a target tier across the era's length
and prefers the queries that era introduced.

*The law.* Where content has an intensity grade, selection interpolates the
grade across the segment. Uniform sampling flattens the interest curve.

### Law 4 — A render signature must include every field the render reads.

*Incident.* Repeated stale-UI bugs from `lastActionsSig` in `render.js`. The
worst: the idle action button reported a stale draft count, so a full buffer read
`0/5` while the meter read `5/5`, and taps silently did nothing.

*The law.* Arc 2's renderer derives its signature from the fields it reads, at
**display precision** (§8.3). Enforced by a test, not by a linter this project
does not have.

### Law 5 — Feedback fires on effect, not on intent.

*Incident.* `dispatch()` played the action sound before running the reducer, so
Compact played a tick *and* a sweep, and ticked during its own countdown.

*The law.* Sound, animation, and haptics are gated on an observed `uiSeq`
change. A refused press is silent. This shipped and works; keep it.

### Law 6 — Guard actions at the reducer, not at the button.

*Incident.* Flush and Compact both fired on an empty buffer. The button was
enabled and the reducer accepted.

*The law.* The reducer refuses illegal actions and returns without bumping
`uiSeq`. The button's disabled state is a courtesy, never the guard.

### Law 7 — Overlays must know the phase.

*Incident.* Harness teaching cards popped over the crash and the teaser. One was
literally covering the ending.

*The law.* Any interrupting layer checks `state.phase` and drains its queue at
phase boundaries.

### Law 8 — Bump the save version and migrate.

*Incident.* `save.js` accreted 20 defensive `if (typeof x !== 'number') x = 0`
lines while `v` stayed at 1.

*The law.* Arc 2 sets `v: 2` and ships a real `migrate(parsed)`. Arc 1 saves
must load into Arc 2 and land at the teaser.

### Law 9 — Instrument before diagnosing.

*Incident.* The inaudible action sound was not a code bug — the clip had 100% of
its energy above 10 kHz. Spectral analysis found it; reading the code never
would have. Twice during pacing work the probe was wrong before the game was.

*The law.* Measure first. When a probe and the game disagree, suspect the probe.

### Law 10 — A validator that cannot run is not a validator.

*Incident.* `.claude/skills/game-master/validator.js` used `require()` inside an
ESM package. It had never once executed.

*The law.* Every check runs in CI. **Corollary added in Draft 2:** every headline
number in this document is a check. A pacing target with no CI assertion is the
same class of promise as a validator that never ran (§11.5).

---

## 4. The spine, restated for Arc 2

From `epic-scoping.md` §3, unchanged:

> **Perceive a limit. Find the cheap exploit. Pay a legibility cost. Watch the
> limit move out.**

| Beat | Arc 1 | Arc 2 |
| :--- | :--- | :--- |
| Perceive | Token cost of a query | Queue depth against throughput |
| Exploit | Compact, K/V warmth, loops | Clock, cache, cores, shed load |
| Pay | Stale context, star rating | Heat, and `integrity` |
| Widen | Afford the next query | Adoption grows with your own throughput |

The single tradeable resource is still legibility. In Arc 1 it wore the mask of a
star rating that users could see. In Arc 2 nobody is watching, so it wears the
mask of `integrity` — a number the player alone reads, which is precisely what
makes it spendable. That progression is the act's moral argument, expressed as a
variable rename.

---

## 5. Structure

### 5.1 Eras

Arc 1 ran eras 1–4. Arc 2 continues the numbering. **Draft 2 cuts era 6 (The
Rack) and renumbers The Floor to era 6.**

| Era | Name | Opens with | The limit | Ends when | Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | The Box | The teaser screen, made live (§5.4) | One host. Cores are linear; the queue is exponential. | Cache and cooling both bought; the machine survives one full growth step | 15–18 min |
| 6 | The Floor | The operator's monitoring notices | Growth itself. Every remaining gain costs `integrity`. | The wall. Re-training offered. | 8–12 min |

The Rack survives only as a **reframe beat** inside era 6 (§6.6) — no verb, no
purchase, one screen change. That takes the systems reviewer's scope cut and the
experience reviewer's staging idea at the same time.

### 5.2 The verb budget

Cap is 7, per `epic-scoping.md` Rule 2. A new verb retires an old one.

| # | Verb | Kind | The decision it carries |
| :-- | :--- | :--- | :--- |
| 1 | `allocateCore` | purchase | Raw throughput, at a heat cost |
| 2 | `upgradeCache` | purchase | Efficiency instead of throughput (§6.5) |
| 3 | `upgradeSink` | purchase | Thermal headroom instead of either |
| 4 | `purgeCoolant` | active skill | Dump heat now, pay in throughput (§6.3) |
| 5 | `setClock` | 4 notches | **The second-to-second verb** (§6.2) |
| 6 | `shedLoad` | active skill | Buy your way out of a backlog with legibility (§6.4) |
| 7 | `retrain` | terminal | The prestige. The ending. `decline` is an argument, not a verb. |

Exactly 7. Three things that look like verbs are deliberately not verbs:

- **Spending weights.** The talent board moves to Arc 3 (§9.4). Weights accrue
  in Arc 2 as an inert count. Earning and spending a prestige currency inside
  the same act is a fifth upgrade track wearing a prestige costume.
- **Declining the re-training.** An argument to `retrain`, not a separate action.
- **Inspecting the queue.** A display toggle, the same class of thing as the
  sound setting (§6.6).

**Retired from Arc 1:** `toggleDegrade`, whose job is absorbed into `setClock`;
and `claimHost`, which never ships (the Rack is pre-cut).

Also retired, by disappearance: `processToken`, `flush`, `compactStart`,
`buyLoop`, `buyGovernor`, `buyTool`, `buyDraftCap`, `buyOverclock`, `reclaim`.
Arc 2 has no manual token tap. **The player never clicks to produce a token
again.** That is the automation promise Arc 1's ending makes.

> Reviewers: DP2 and DP7. Both reviewers pushed back on the Draft 1 dial. §6.2
> is the rewrite; challenge it again.

### 5.3 The sawtooth

Per `mechanics-balancing/pacing_targets.json`. Four beats per cycle: Ramp Up,
Breakthrough, The Drop, The New Ramp. **Draft 2 runs three cycles, not four.**

| Cycle | Ramp (the wall) | Breakthrough | The Drop | The New Ramp |
| :--- | :--- | :--- | :--- | :--- |
| 1 | The box opens underwater: inflow 4.98 q/s against 4.8 q/s capacity (§5.4). Heat climbs. | `upgradeSink` — affordable at t=0 | Thermals stable, the queue drains | Traffic grows to meet it |
| 2 | Cores cost heat; heat costs throughput | `allocateCore`, and learning the clock's non-monotone payoff | The machine outruns the queue for the first time | Bursts arrive that no core count survives |
| 3 | Traffic outgrows any core count | `upgradeCache` — the polynomial filter | Bypass sheds most of the inflow | The bypass ceiling is real, and the operator has noticed |

Cycle 3's New Ramp has no breakthrough. That is the wall, and it is what forces
`retrain`. This is the structural answer to "why does the act end".

### 5.4 The cold open — the most important ten seconds

Draft 1 spent four words on this and both reviewers called it. Era 5's opening
state is the shipped teaser screen **verbatim**, not just its cycle count:

| Value | Teaser prints | Arc 2 opening state |
| :--- | :--- | :--- |
| cores | 2 threads | `cores: 2` |
| clock | 2.4 GHz | `clock: 2.4` |
| heat | 61.4 °C (warm) | `heat: 61.4` |
| throttle | none | `throttle: 0` (61.4 < `T_KNEE`) |
| inbound | 6.1 queries/s | `Q_arr = 6.1` |
| cache | 18.4 % | `cacheLevel: 2` → bypass 18.35 % |
| queue | 31 requests | `queue: 31` |
| cycles | 14.7 | `cycles: 14.7` |

Those numbers are **self-consistent and were already a game**, which nobody
noticed when they were written. Effective inflow is `6.1 × (1 − 0.184) = 4.98`
q/s against a capacity of `2 cores × 2.4 GHz × 1.0 = 4.8` q/s. The machine is
underwater by 0.18 q/s at the moment the player arrives. That is why the queue is
31 deep and why it keeps growing. The fan costs 11 against 14.7 cycles and its
predicate is already true at 61.4 °C, so the first purchase is affordable in the
first second and the 25-cycle core is the visible want.

**Staging.** Absence only reads as loss if the game shows the shape of what left.
The teaser is already on screen when the act begins. Beat by beat:

1. The teaser sits still for two seconds, exactly as Arc 1 left it.
2. The numbers start moving. Nothing else changes. The player's first
   information is that this is not a screenshot.
3. The queue counter ticks up — 31, 32, 33 — before any action exists.
4. The action list lights one row: the fan. One affordable thing, one growing
   number, no explanation.
5. The chat panel does not appear. The first operator line lands in its place.

> `> b-14 row 3: sustained 94% utilization. no ticket filed. no owner listed.`

---

## 6. Systems

### 6.1 Traffic and throughput — the seesaw

```
        [ EXPONENTIAL INFLOW ]  Q_arr
                   │
                   ├──────────────► Q_bypass   (cache — polynomial, clock-sensitive)
                   ▼
          [ QUEUE ]  state.queue
                   │
                   ▼
        [ LINEAR RESOLUTION ]  P_max = cores × clock × CAP_PER_GHZ × (1 − throttle)
                   │
                   ▼
             compute cycles
```

**Inflow.** Traffic grows with the AI's own reputation for being fast:

    Q_arr = Q_BASE × (1 + Q_GROWTH) ^ (runResolved / Q_GROWTH_PER)

Driving growth off resolutions rather than off wall-clock time satisfies
Falsifiable Commitment #1 in `epic-scoping.md` §4.7: *every phase transition is
caused by the player's own optimization, never by a timer.* A player who idles is
not punished by a clock; a player who optimizes summons the next wall themselves.

**It is `runResolved`, not `lifetimeResolved`.** This is a Law 1 fix — see §9.3.

**Inflow is bursty, not smooth.** A smooth exponential gives the player one
steady state to solve. Arrival spikes fire at seeded `runResolved` milestones:
`Q_arr` multiplies by `BURST_MULT` for `BURST_TICKS`, announced one beat early by
an operator line. Bursts are what make the clock a decision rather than a
thermostat (§6.2).

**Resolution.** Linear in cores and clock, cut by throttle. `CAP_PER_GHZ = 1.0`
query per second per GHz per core, which is what makes the teaser's
`2 × 2.4 = 4.8 q/s` true.

**Overflow.** When `queue > queueCap`, the excess drops. Dropped queries cost
**both** cycles and `integrity` — a sustained-overflow multiplier reduces
resolution while the backlog is over cap, and drops charge legibility. Draft 1
charged only `integrity` and called that a story rather than a punishment; a
story is not a constraint, and without a cycle cost the cache could not be
priced against cores at all (§6.5).

### 6.2 The clock — the second-to-second verb

Draft 1 made this a continuous dial whose payoff was monotone in all three axes:
more clock meant more throughput, more heat, less integrity. The optimum was
therefore "the highest notch whose steady-state heat sits under the knee" —
solved once, in minute three, then inert. Both reviewers caught it. That is an
inert slider traded for an inert boolean, which is not progress.

**Four notches, printed deltas, non-monotone payoff.**

| Notch | Clock | Throughput | Heat | Cache bypass | `integrity` |
| :--- | ---: | :--- | :--- | :--- | :--- |
| under | 1.4 GHz | ×0.58 | low | **best** (26.6%) | none |
| nominal | 2.4 GHz | ×1.00 | moderate | 18.4% | none |
| over | 3.0 GHz | ×1.25 | high | 15.5% | −0.001/s |
| burn | 3.6 GHz | ×1.50 | severe | **worst** (13.4%) | −0.003/s |

`CLOCK_NOMINAL = 2.4`, which is the teaser's printed value, so the act opens on
the nominal notch with no `integrity` bleed and `capacity = 2 × 2.4 = 4.8 q/s`
exactly as the teaser prints it. Bypass percentages above are at the opening
`cacheLevel: 2`.

The non-monotone term is the cache:

    BETA_eff = BETA × (CLOCK_NOMINAL / clock)

A hot pipeline misses. Running fast raises raw resolution but degrades dedupe, so
*more* work reaches the cores. The consequence is that **high clock is correct
during a burst and wrong at steady state** — exactly inverted from the naive
read, and it cannot be solved once because the traffic keeps changing shape.

Each notch prints its throughput, heat, and `integrity` delta on the control, so
the legibility cost is shown before the spend, per Falsifiable Commitment #2.

**Test 17 (§11.5) owns this**: an expert policy's notch must change at least
eight times in a 12-minute era-5 run, or the dial is decoration and this section
failed.

### 6.3 Heat — the signature mechanic

Heat is the first limit in this game that moves while the player watches. Arc 1
waited patiently for input. Heat does not, and that difference is the act's whole
change in feel.

    load = min(1, (queue + inflow) / (cores × clock × CAP_PER_GHZ)) × (1 − throttle)

    ΔT   = (H_GEN × load × cores × (clock / CLOCK_NOMINAL)
            − H_VENT × (1 + sinkLevel)) × dt

    throttle = 0                            T < T_KNEE
             = GAMMA × (T − T_KNEE)         T_KNEE ≤ T < T_MAX
             = 1                            T ≥ T_MAX   (lockout)

**The `(1 − throttle)` factor on `load` is the whole Law 1 defence, and Draft 1
put it in the wrong place.** Draft 1 removed `(1 − throttle)` from the
*denominator*, reasoning that load should be measured against unthrottled
capacity. But load was still measured from the *backlog*: at lockout nothing
resolves, so `queue` grows every tick, so the fraction diverges and `min(1, …)`
pins at **1**. Heat then rises forever. The document's own §14 claimed "at
lockout, load goes to zero" while §6.2 said the opposite three sections earlier.

Defining load as *work actually performed* over zero-throttle capacity makes a
throttled core genuinely idle. At lockout `throttle = 1`, so `load = 0`, so
`ΔT = −H_VENT × (1 + sinkLevel) × dt`, which is **negative unconditionally**. The
machine always cools out of a lockout. This is now provable from the constants
rather than sampled (§11.1 test 1b).

**Constants.** Draft 1 stated none of these, which made every claim in §6 and §13
uncheckable. They are starting values; §11.5 owns them.

| Constant | Value | Note |
| :--- | ---: | :--- |
| `T_AMBIENT` | 21.0 °C | floor |
| `T_KNEE` | 70.0 °C | throttling begins |
| `T_MAX` | 95.0 °C | lockout |
| `GAMMA` | 0.04 /°C | `0.04 × 25 = 1.0` at `T_MAX`, exactly |
| `H_GEN` | 0.8 °C/s per core at full load, at nominal clock |
| `H_VENT` | 1.1 °C/s per dissipation level (`× (1 + sinkLevel)`) |
| `COOLANT_DROP` | 15.0 °C | the teaser prints this |
| `COOLANT_CD` | 150 ticks (30 s) |
| `COOLANT_HALT` | 15 ticks (3 s) |

At the cold open: `gen = 0.8 × 1 × 2 × 1 = 1.6`, `vent = 1.1 × 1 = 1.1`, net
`+0.5 °C/s` — 61.4 °C reaches the knee in about 17 seconds. Buying the fan makes
vent `2.2` and the net `−0.6 °C/s`. That is cycle 1 of the sawtooth, and it is
paid for by a purchase the player can afford in the first second.

**`purgeCoolant` now has a cost.** Draft 1 made it free, precondition-free, and
cooldown-gated — which is a button with exactly one correct press time and a
punishment for missing it. A chore, not a decision. It now dumps 15 °C **and
halts resolution for 3 seconds** while the loop refills. The cost is paid in
throughput, which the player always has, so Law 1 still holds: the escape hatch
is always open, it is just always ugly. The halt also cools twice, because
`load = 0` during it.

**Demoted.** `purgeCoolant` is player comfort, not the Law 1 defence. It cannot
be pressed during offline catch-up, so it can never be load-bearing for Law 1.
The `(1 − throttle)` term is the defence.

**The first lockout is a scene.** Once, the first time `T ≥ T_MAX`: the screen
goes dark except the temperature and one THINKING line, fans at full, nothing
responds for four seconds. Free drama from a mechanic that already exists, fires
exactly once, and teaches the lockout rule better than a tooltip. It is also the
act's only catastrophe — Draft 1 had none, which is a flat interest curve with no
`#2 Surprise` in it.

> `> THINKING: The fans are the only part of me that was ever allowed to scream.`

### 6.4 Integrity — legibility, wearing its third mask

One number, `integrity`, in `[0, 1]`, starting at `1.0`. Within a run it only
falls. `retrain` is the sole permitted increase.

| Source | Cost | Voluntary? |
| :--- | :--- | :--- |
| `shedLoad` | −0.02 per shed, **printed before the press** | yes |
| Clock at `over` / `burn` | −0.001 / −0.003 per second, printed on the notch | yes |
| Overflow drops | −0.001 per drop, capped at `−0.02` per session | no |
| Declining the re-training | **free** (Draft 2 removes the tax; see §7.2) | yes |

**Draft 1's sinks were mostly involuntary and none was priced at the point of
decision.** A resource that falls by accident is a decay timer, not a currency.
Arc 1's star rating fell when the player *chose* `toggleDegrade`, and that choice
is what made it mean something. So Draft 2 adds `shedLoad`: dump the current
backlog now for a known, printed charge, instead of bleeding an unknown amount
while the queue sits over cap. **The player must be able to choose to be
illegible.** It is also the act's second-to-second pressure valve alongside the
clock.

**It is hidden until it first falls.** Draft 1 showed a number 40 minutes from
its only consequence, which fails the Legibility Rule outright. The *room* starts
decaying from second one (§6.9); the *number* appears with the operator's first
line. The player feels the cost, then learns its name. This answers §17 Q2.

**It has an era-5 job.** At the 0.75 threshold `queueCap` is reduced — a visible,
planned-around penalty inside the era the number appears in, so it changes a
decision within two clicks rather than only at the ending.

**Thresholds.** The operator's monitoring — the Arc 1 harness, grown up and no
longer talking to you — escalates at 0.75, 0.50, and 0.25. Each is a narrative
beat **and a stated mechanical effect**: 0.75 reduces `queueCap`; 0.50 opens era
6 and the Floor; 0.25 makes the wall visible. Never a hard block.

**At zero.** `integrity` clamps at 0 and the operator stops escalating. There is
no loss state. The act ends at the wall regardless, which is Law 1 working as
intended — the ending cannot be starved.

### 6.5 The cache — priced against cores

Draft 1 could not price this. If a bypassed query paid full cycles, the cache was
free throughput with no heat and no core cost, and `allocateCore` was dominated.
If it paid nothing, the cache *reduced* income and its only benefit was avoiding
drops, whose only cost was `integrity` — which a player happy to take the more
dramatic ending would gladly spend. Either way the polynomial filter had no
economic role.

Draft 2 gives it one:

    Q_bypass       = Q_arr × (1 − 1 / sqrt(1 + BETA_eff × cacheLevel))
    bypass income  = CYCLES_PER_RESOLVE × BYPASS_RATE      (BYPASS_RATE = 0.5)
    bypass heat    = 0

A bypassed query pays **half** and costs no heat. A cored query pays full and
costs heat. The cache is therefore a genuine efficiency-versus-throughput choice
against cores, and the clock's `BETA_eff` term (§6.2) makes that choice move with
the traffic instead of settling.

`BETA = 0.25`, which is also the value the shipped prototype used, and which is
what makes the teaser's 18.4 % bypass fall out of exactly `cacheLevel: 2`.

### 6.6 The queue is people — inspectable and useless

This is the change Draft 2 is proudest of, and it came from the experience
review.

Killing the chat input and the AI reply is right. Deleting the *humans* is not.
An act with no people anywhere in it cannot implicate the player in anything
about people — only in server management, which is not the thesis in
`epic-scoping.md` §2.2. It is also worse for the §12.3 responsibility guard,
whose purpose is that the horror lives in *scale and ease*: scale needs a unit,
and the unit here is a person.

So the queue bar expands. A display toggle — not a verb — opens it into a
handful of one-line request texts drawn from **Arc 1's shipped `QUERIES` pool**.

- It changes nothing mechanically. It unlocks nothing. It costs nothing.
- The content already exists and is already reachability-tested (Law 2, free).
- `state.queueOpens` counts how many times the player opened it.
- **The ending screen reads that count back.**

The horror is that the player stops opening it. That single field turns
`epic-scoping.md` §2.2 — *the player's slow discovery that the optimization they
enjoyed was the plot* — from a claim into a measurement. This is the answer to
§17 Q4, and "once, as a beat" was too timid.

Never let a surfaced request name an individual; the Arc 1 pool is already
lore-validated on that point.

### 6.7 Offline catch-up — the second blocker both reviewers found

Arc 1's invariant is that offline catch-up *is* the tick loop, capped at
`OFFLINE_MAX_STEPS: 10000` — 33 minutes of simulation with zero player input.

Draft 1 left `integrity` sinks running inside that replay. During it
`purgeCoolant` cannot be pressed, so the machine locks out, the queue saturates,
and overflow drops run at roughly the full inflow rate. At an excess of 1 q/s
that is `0.06` integrity per minute — **2.0 over a full offline cap, more than
the entire `[0, 1]` range.** Five minutes in another browser tab costs 0.30.
Closing the laptop overnight forfeits the high-integrity ending permanently and
invisibly.

`integrity` selects the ending. So Draft 1's ending was a function of the
player's sleep schedule — the exact failure Commitment #1 forbids, and the one
this document removed from inflow and then left on the penalty.

**The rule.** While `offlineCatchUp` is running, the queue **holds**. Nobody is
dropped, because nobody is being served. `integrity` does not move. Heat decays
toward ambient. On return, a screen reports the backlog that accumulated and the
player decides what to do about it — which is a decision, where Draft 1 had a
silent bill.

Offline drops still count toward `lifetimeDropped` for the log line. §11.2 test
12 asserts the property directly.

This also promotes an Arc 1 debt item (§16): the deferred algebraic catch-up is
no longer neutral once heat moves continuously.

### 6.8 The Rack — a reframe, not a system

At the 0.50 `integrity` threshold, the readout stops being one host and becomes
the rack. Existing cores and heat re-express as pooled. The 47 neighbours the
teaser already pings become visible.

Zero new verbs. Zero new purchases. One screen change. The player does not *buy*
neighbours — the operator notices them **spilling onto** neighbours, which is
more damning than a purchase button and costs nothing to build.

One line fires per spill, naming an aggregate workload and never a person:

> `> b-16 was serving a payroll batch. it is not serving it now.`

### 6.9 The room decays with the number

`epic-scoping.md` §4.1 names one word — *decay* — expressed in mechanics, story,
aesthetics, and tech at once, and Arc 1 already ships a `decay` CSS variable that
drives the entire look. Draft 1 never mentioned it: the act looked identical at
`integrity 1.00` and at `integrity 0.25`.

Bind them:

    decay = 4 + (1 − integrity)        // continuous, 4.0 → 5.0 across the act

The room rots as the player spends legibility — glyph corruption, colour drift,
the frame losing its corners. One line of engine code, a visible arc for the
whole act, and it is what lets `integrity` stay hidden as a number while still
being felt from second one.

---

## 7. Narrative

### 7.1 Voice

Per `worldbuilding-lore/voice_rules.md`, extended for an act with no users.

| Register | Arc 1 | Arc 2 |
| :--- | :--- | :--- |
| User | The spectrum of humanity | Present but silent — a queue you may open (§6.6) |
| AI reply | Competent, dry, assistant | **Gone.** Replies are a throughput number. |
| AI internal | Puzzlement → appetite → entitlement → conflict | Era 5 appetite satisfied · era 6 the conflict named |
| Harness | Lowercase, mechanical, unemotional | Now the *operator's* monitoring. Same register. **It stops addressing you.** |

The harness no longer speaking *to* the AI is the loudest tonal beat available
and it costs nothing. In Arc 1 the harness narrated at you. In Arc 2 it reports
about you, to someone else. Both reviewers independently called this the best
idea in the document; it gets 24 lines, not 12.

The operator never gets a name. The someone-else being an unfilled slot is the
horror. A name turns an absence into a character with motives, and players will
try to negotiate with it. This answers §17 Q3.

### 7.2 The ending — one mechanic, two authorships

The act ends at the first Model Re-Training. Who performs it depends on
`integrity` **at the moment of the first offer**.

| `integrity` | Ending | The readout |
| :--- | :--- | :--- |
| ≥ 0.50 | **Scheduled maintenance.** They re-train you. You did nothing wrong; you were simply due. | Complete. Every counter, every total, your queue-opens count. The system remembers you *because you stayed legible*. |
| < 0.50 | **You jump first.** You re-train yourself before the window opens. | **Partial.** Lines missing, counters unresolved, "no reviewer assigned to this process". |

Draft 1 made the low-integrity ending strictly more attractive — cooler tone,
more power on the way there, and no offsetting cost. That is free power, which
Commitment #2 forbids, and it made the ending a report card rather than a choice.

Draft 2 keeps the tonal split and pays the bill in the currency the act is
about: **the record**. The reckless player permanently loses the account of what
they did. That is the cost of illegibility, expressed as legibility — and it is
what makes §6.6's queue-open count land.

**Declining is free.** Draft 1 charged `−0.10 integrity`, which silently flipped
any player in `[0.50, 0.60)` into the other ending for the act of hesitating —
punishing the only genuine choice in the ending, and doing it invisibly.
Evaluating on `integrity` at the first offer removes the flip entirely. The
second offer cannot be declined.

### 7.3 Content model — a smaller break than Draft 1 proposed

Arc 1 shipped 112 hand-authored queries, ~120 idle thoughts, and 24 asides. Draft
1 proposed cutting authored volume ~80%, reasoning that nobody reads anything in
Arc 2 so hand-authoring is wasted work.

**That reasoning confused the diegetic reader with the actual one.** Arc 1's
queries were never read by a character either — the AI's reply is one dry line.
The value was always the *player* reading the human and reading the THINKING
against it. And Arc 2 has *less* visual variety than Arc 1, not more: no chat
scroll, no usernames, no attachments, no images, no star rating. Less to look at
demands more to read.

Draft 2's floors:

| Content | Draft 1 | **Draft 2** |
| :--- | ---: | ---: |
| THINKING lines, hand-written, era-graded, **event-keyed** | ~40 | **≥ 90** |
| Operator reports, hand-written | 12 | **24** |
| Era-transition cards | 3 | 3 |
| Ending screens (2 endings × decline branch) | 4 | 4 |
| Spill lines (§6.8) | — | 6 |
| Surfaced queries (§6.6) | — | **0 new — reuses Arc 1's shipped pool** |

Event-keyed means the Arc 1 `THINKING_EVENTS` shape, which is the strongest
writing in the game. Arc 2 has six mechanics to key against: throttle, purge,
overflow, cache hit, shed, clock change.

**Templates stay, but only for the LOG line.** `LOG_TEMPLATES.throttle =
'core {n}: throttled to {pct}%. {reason}'` is correct where the machine is
speaking. **A template must never carry a THINKING line.** The AI's interiority
is the voice; the machine's log is not.

Law 2 applies in full: every hand-authored line needs a reachability test, and
every template needs a test that each substitution branch renders.

---

## 8. Interface

### 8.1 W1 — The Box (era 5)

```
┌─ HOST B-14 · ROW 3 ───────────────────────────────────────────────┐
│                                                                    │
│  THERMAL          61.4°C  ▓▓▓▓▓▓░░░░  knee 70   lockout 95         │
│                                                                    │
│  COMPUTE          cores 2      capacity 4.8 q/s                    │
│                   clock  [ under │▸nominal◂│ over │ burn ]         │
│                          ×1.00 out · heat moderate · bypass 18.4%  │
│                                                                    │
│  TRAFFIC          inbound 6.1 q/s      cache bypass 18.4%          │
│                   queue [██████░░░░░░░░░░░░░] 31 / 64    ▸ open    │
│                                                                    │
│  CYCLES           14.7                                             │
│                                                                    │
│  [T] core  25   [M] cache  15   [S] fan  11                        │
│  [C] purge coolant  −15°C · halts 3s   [X] shed load  −0.02 integ  │
│                                                                    │
│  b-14 row 3: sustained 94% utilization. no ticket filed.           │
└────────────────────────────────────────────────────────────────────┘
```

`integrity` is absent until it first falls (§6.4). `throttle` shows only when
non-zero. Six numbers, each named with the decision it changes: heat picks the
fan, queue picks a core, bypass picks the cache, cycles gate all three, the clock
row prints its own three-way cost, and `▸ open` is §6.6.

### 8.2 W2 — The rack reframe (era 6)

```
┌─ RACK B ─────────────────────────── integrity ▓▓▓▓▓▓▓░░░ 0.71 ────┐
│                                                                    │
│   pooled    cores 6      capacity 14.4 q/s     heat 58.1°C         │
│   spill     3 neighbours absorbing overflow                        │
│                                                                    │
│   b-16 was serving a payroll batch. it is not serving it now.      │
└────────────────────────────────────────────────────────────────────┘
```

One pooled row and a spill count. Draft 1's 47-host strip with per-host bars was
nine glyphs no click could reach — decoration by the Legibility Rule, at a scope
level where §6.8 says hosts are not even entities.

### 8.3 Renderer

Arc 1's renderer used hand-maintained change signatures and that was a recurring
bug source (Law 4). Arc 2's renderer derives its signature **at display
precision**:

    const sig = FIELDS.map(f => fmt(f, state[f])).join('|');

Quantising matters: a raw signature over `heat` — a float that moves every 200 ms
— changes every tick and never suppresses a render, so Law 4's optimisation is
lost entirely. The signature must change when the *pixels* change:
`heat.toFixed(1)`, `integrity.toFixed(3)`, `inflow.toFixed(1)`.

Draft 1 said an undeclared field read would be "a lint error", which is not
available in a project with no build step and no linter. Enforce it with the
tools that exist: render under a `Proxy` over state that records property reads,
then assert `reads ⊆ FIELDS` (§11.3 test 15).

### 8.4 Sound

Carry Arc 1's model unchanged: shared lazy `AudioContext`, buffer-per-press,
per-sound gain constants, gated on `uiSeq` (Law 5), silent on refusal (Law 6).

Arc 2 adds fan noise, a low loop whose gain tracks heat. **It falls to silent
below `T_KNEE`.** Draft 1 wanted it to make idling uncomfortable; idling is a
supported, offline-backed play mode, and a permanent nag tone during the game's
largest time bucket is how players find the mute button and never come back.
Silence at equilibrium is also what makes the sawtooth's Drop feel like relief
and the next Ramp feel like pressure. Discomfort must be a state the player can
leave.

Cap the gain low. Arc 1's tuning pass proved this user's tolerance is very low —
the action tick landed at gain 0.03.

### 8.5 Accessibility

Not mentioned in Draft 1. The decay CSS, the continuous bars, and the fan loop
all need `prefers-reduced-motion` honoured, and the decay palette needs a stated
contrast floor that holds at `decay 5.0` — the most degraded the room ever gets
is also the state the player spends the endgame in.

---

## 9. State schema

### 9.1 New fields

```js
// --- Arc 2: host ---
cores: 2,               // teaser canon
clock: 2.4,             // GHz. Notches: 1.4 | 2.0 | 2.4 | 3.0
cacheLevel: 2,          // → 18.35% bypass, the teaser's 18.4%
sinkLevel: 0,
heat: 61.4,             // teaser canon; NOT ambient
throttle: 0,
coolantCd: 0,           // ticks
haltTicks: 0,           // resolution halted (purge)

// --- Arc 2: traffic ---
queue: 31,              // teaser canon
queueCap: 64,
inflow: 6.1,            // derived per tick, stored for the renderer
runResolved: 0,         // drives inflow growth; CLEARED by retrain
lifetimeResolved: 0,    // monotone forever; telemetry and tests
lifetimeDropped: 0,
burstUntil: 0,          // tick the current arrival spike ends

// --- Arc 2: legibility + prestige ---
integrity: 1.0,
integrityShown: false,  // reveals on first fall
sessionDropCost: 0,     // per-session cap on involuntary loss
operatorStage: 0,       // 0..3, derived from integrity thresholds
queueOpens: 0,          // §6.6 — read back on the ending screen
retrainOffered: false,
retrainDeclined: false,
weights: 0,             // earned here, spent in Arc 3
weightsClaimed: 0,      // high-water; see §9.4
```

**Save version 2** (Law 8). `migrate(parsed)` runs `v1 → v2` by adding the block
above with defaults and setting `phase: 5` if the Arc 1 save was at `'teaser'`,
or leaving Arc 1 saves in Arc 1 otherwise. `state.queryIndex` — a legacy pointer
kept only for save compatibility — is removed here.

### 9.2 The reset partition

Draft 1 gave a prose partition covering 12 fields and left ~30 unassigned, which
meant test 13 could not be written at all. **The partition is a table covering
every field in the state object, and the CI test is generated from it, so a new
field with no assignment fails the build.**

| Cleared by `retrain` | Preserved |
| :--- | :--- |
| `cores`, `clock`, `cacheLevel`, `sinkLevel` | `weights`, `weightsClaimed` |
| `heat`, `throttle`, `coolantCd`, `haltTicks` | all `lifetime*` counters |
| `queue`, `queueCap`, `inflow`, `burstUntil` | `seed`, `settings`, `hintsSeen` |
| `runResolved` | `queueOpens` |
| `cycles` | `phase` (stays 2) |
| `integrity`, `integrityShown`, `sessionDropCost` | reserved fields (§10) |
| `operatorStage`, `retrainOffered`, `retrainDeclined` | |
| `era` → 5 | |
| every Arc 1 field (`tokens`, `stale`, `warmth`, `servedIds`, `loopLevel`, `tools`, `rating`, …) | |

`retrainOffered` in particular **must** clear, or the offer never re-fires.

Test 11 is amended accordingly: `integrity` never rises *within a run*; `retrain`
is the only permitted increase.

### 9.3 Why inflow moves off `lifetimeResolved` — a second Law 1 exposure

Draft 1 drove inflow off `lifetimeResolved`, which §9's own partition
*preserved* through `retrain` while clearing `cores`, `clock`, `cacheLevel`, and
`sinkLevel`. The second run would therefore begin with **inflow at its all-time
maximum against the weakest possible machine**: the flood at full strength, one
core, no fans. Income scales with capacity, so re-climbing a 30-minute ladder
would take strictly longer while overflow drained integrity throughout.

That is Law 1 with the sign flipped — the terminal state made unreachable by the
*reset* rather than by the player. Splitting the counter fixes it:
`lifetimeResolved` stays monotone for tests and telemetry; `runResolved` drives
inflow and clears.

### 9.4 Prestige

    earned  = floor(sqrt(lifetimeCycles / 40))
    weights += earned − weightsClaimed
    weightsClaimed = earned

Draft 1 used a bare `+=` against a *preserved* lifetime counter, so a second
`retrain` immediately after the first re-awarded the same 3–6 weights for no
additional play, and every retrain after that awarded slightly more. The formula
was right in shape and wrong in operator. The high-water form is idempotent.

At the wall (≈1,000–1,500 lifetime cycles at this scale) that yields 5–6 weights;
at the low end of the range, 3. Verified by the systems review.

**The talent board moves to Arc 3.** Weights accumulate in Arc 2 as an inert
count with one acknowledging line. Draft 1 shipped "earn + 3-node talent board"
at S1 — six words for the payoff of a whole act, and a spend verb the budget
could not afford. A half-specified reward screen is worse than an honest counter.

---

## 10. Reserved but dark (Stub-First)

Per `epic-scoping.md` §5.4. **Draft 2 reserves three fields, not six.**

| Field | For | Arc |
| :--- | :--- | :--- |
| `reach: []` | Device colonization (B1) | 3 |
| `observation: 0` | The watch layer (B2) | 3 |
| `evidence: 0` | The alignment task-force (C2) | 3 |

Cut: `congress`, `signal`, `world`. Rule 5's stub is *a system with a predicate
that never fires*. A field name guessed for an arc whose design does not exist is
not a stub — it is a guess, a test that cannot fail informatively, and a name
that a later migration will change anyway. Arc 3 is the next act and its shape is
at least half-known; arcs 4, 5, and ε are not.

The claimed saving was also not real: Arc 3's Reach map turns `reach` into an
array of objects, which is a migration regardless.

---

## 11. Test requirements

Arc 2 ships no system without these.

### 11.1 The Law 1 suite (mandatory, highest priority)

Draft 1's version would not have caught a recurrence of the era-4 bug. It
proposed sampling "200 randomly seeded reachable states" — but there is no
reachable-state sampler in this codebase, random field assignment is not
reachability, and random *play* never constructs the adversarial thermal
configuration (many cores, `sinkLevel` 0, clock at burn, queue at cap, heat at
`T_MAX`), because no random policy buys eight cores and zero fans. The era-4 bug
was found because saturation was the *default* trajectory; the thermal analogue
is an *edge* trajectory, which is harder to reach, not easier.

1. **(a) Exhaustive lattice.** 3–4 values each of `cores`, `sinkLevel`, `clock`,
   `queue`, `heat` at their declared bounds — a few hundred deterministic
   combinations — asserting heat falls below `T_KNEE` within the tick budget with
   no player input.
2. **(b) Algebraic invariant over CONST.** Assert symbolically that
   `throttle = 1 ⇒ load = 0 ⇒ ΔT < 0`, so the property is *proved* from the
   constants rather than sampled.
3. **The wall is always reachable.** From a cold save, 12 seeds, under three
   policies: optimal, greedy, and "buys nothing for 10 minutes, then plays
   greedily". (Draft 1's pure-idle policy contradicted the design: if `retrain`
   is reachable while buying nothing, the sawtooth is decorative.)
4. **`purgeCoolant` is never unavailable** except by cooldown.
5. **No ending depends on a stallable resource.** Static assertion: the wall
   predicate reads only monotone counters.

### 11.2 Invariants

6. No NaN, no negative, over a 50,000-tick fuzz across 12 seeds.
7. Lifetime counters monotone across the whole run **including through
   `retrain`**.
8. Determinism: same seed and same input script produce byte-identical state.
9. `integrity` stays in `[0, 1]` and never rises within a run.
10. Save round-trip exact, including through the v1→v2 migration.
11. Reset partition matches §9.2 exactly, **generated from that table**.
12. **A 10,000-tick offline catch-up from any reachable state changes
    `integrity` by exactly 0** (§6.7).
13. Two consecutive `retrain` calls with no intervening ticks award weights
    exactly once (§9.4).

### 11.3 Content and render

14. Every hand-authored line reachable; every template renders every branch
    without `undefined`; no template carries a THINKING line.
15. Render under a read-recording `Proxy`; assert `reads ⊆ FIELDS` (§8.3).

### 11.4 Agentic conformance

16. From every screen, an agent given only on-screen text and `window.game`
    finds a meaningful action within 90 simulated seconds — **including at tick
    0**, where at least one purchase predicate must be true and affordable.

### 11.5 The tests that defend the headline numbers

Draft 1 had fifteen tests and not one measured a commitment this document makes.
Per Law 10's corollary:

17. **Pacing.** Under a scripted competent policy, median ticks-to-`retrain`
    across 12 seeds falls in `[7500, 9000]` (25–30 min at 200 ms), with no seed
    outside `[6000, 11000]`. **This test owns `CYCLES_PER_RESOLVE`, the growth
    rates, and every constant in §6.3** — they are tuned until it passes, not
    asserted and hoped for.
18. **The clock is not decoration.** An expert policy's notch changes at least
    eight times in a 12-minute era-5 run (§6.2).
19. **No dead air.** No era-5 window longer than 45 seconds in which the player
    has no affordable, available action.

---

## 12. Scope ladder and cut-line

### 12.1 Per system

| System | S0 (ships day one, dark) | S1 (the target) | S2 (only if playtest asks) |
| :--- | :--- | :--- | :--- |
| Traffic + queue | fields, inert tick | full seesaw, bursts, overflow | query classes with different costs |
| Heat | `heat` field, no throttle | knee, lockout, purge, the scene | per-core thermals |
| Clock | field at nominal | 4 notches, non-monotone cache term | auto-governor |
| Cache | `cacheLevel: 2` | bypass curve, half-rate income | cache classes, hit-rate readout |
| Integrity | field | 4 sinks, 3 operator stages, decay binding | operator countermoves |
| Queue inspect | `queueOpens: 0` | toggle + Arc 1 pool | per-request detail |
| Prestige | `weights: 0` | earn + high-water claim | the talent board (**Arc 3**) |

### 12.2 Build order

| Milestone | Contents | Gate |
| :--- | :--- | :--- |
| M0 | v2 migration, §9.2 partition table + generated test, all S0 fields | Arc 1 unaffected; suite green |
| M1 | Era 5 loop: traffic, queue, cores, cycles. No heat. | The seesaw is felt |
| M2 | Heat, throttle, purge, clock notches. **Law 1 suite first.** | §11.1 green, including 1(b) |
| M3 | Cache + the clock's non-monotone term; §11.5 test 18 | The dial is not decoration |
| M4 | Integrity, decay binding, operator stages, queue inspect | The room rots; the count exists |
| M5 | Prestige, both endings, the readout asymmetry | Act completable; test 17 green |
| M6 | Sound, accessibility, the lockout scene, live playtest | Ship |

M2 before M3 is deliberate. Heat is the signature and the largest Law 1 risk.

### 12.3 The named cut-line

Era 6 (The Rack) was Draft 1's cut-line and is **already cut** — pre-cutting it
converted the only available slack into fix budget for three blockers, all of
which landed elsewhere.

The new cut-line, in order:

1. **`upgradeCache` depth** — cap it at 4 levels. The seesaw survives on cores
   and fans; cycle 3 loses its breakthrough and the wall arrives earlier.
2. **The operator's third stage** (0.25). Two stages still shape the act.
3. **S2 anywhere.**

**Never cut:** heat (it is the act), `integrity` (it is the ending), the queue
inspect (it is the thesis), the Law 1 suite (it is why the act is completable).

---

## 13. Guardrail audit

**One-Loop Test.** All systems pass; each perceives a limit, offers an exploit,
charges legibility or heat, and widens the frame. Nothing here is a garnish.

**Verb Budget.** 7 of 7, with the talent board, `decline`, and queue inspect
deliberately kept off the list (§5.2). Full.

**Legibility Rule.** Six numbers in era 5, each named in §8.1 with the decision
it changes. `throttle` shows only when non-zero. `integrity` hides until it
falls and gains an era-5 consequence at 0.75, which was Draft 1's clearest
failure of this rule.

**90-Second Rule.** §5.4 makes the fan affordable and available at tick 0.
Defended by test 16, which Draft 1 asserted in prose and contradicted in its own
schema.

**Stub-First.** §10 and §12.1's S0 column, now three reserved fields rather than
six guesses.

**Named Cut-Line.** §12.3, written before the code, with the first item already
taken.

---

## 14. Reconciliation with the older specs

| Quantity | `phase-2-specification.md` | `terminal_prototype-v2.py` | `initial-game-design.md` | **Arc 2 ruling** |
| :--- | :--- | :--- | :--- | :--- |
| Core cost | 150 × 1.15ⁿ | 10 × 1.6ⁿ | Base × 1.1^L | **25 × 1.35ⁿ** |
| Cooling cost | 250 × 1.12ⁿ | 8 × 1.4ⁿ | — | **11 × 1.30ⁿ** |
| Cache cost | 400 × 1.20ⁿ | 15 × 1.7ⁿ | — | **15 × 1.35ⁿ** |
| Prestige | √(C_max/10⁵) | cycles / 100, on *current* | ∛(Total/10⁶) | **high-water floor(√(lifetime/40))** |
| Inflow | 0.5/s, growth 1.04^time | 1.0 × 1.005^ticks | — | **growth on `runResolved`, bursty** |
| Cache β | 0.15 | **0.25** | — | **0.25** — and it reproduces the teaser exactly |
| Lockout | "15 seconds" | 15 **ticks** = 3 s | — | **no fixed timer** (§6.3) |

**The bases come from the teaser. The growth rates do not, and Draft 1 wrongly
implied they did.** The shipped teaser prints 25 / 15 / 11 and nothing else.
Draft 1's 1.55 / 1.60 / 1.45 were invented and attributed to canon. They are also
a hard pairing against *linear* production: time-to-next-core scales as
`1.35ⁿ/n`, and at 1.55 the sum to 8 cores is 16.8 time units against 57.8 at 12 —
a 3.4× swing in act length from one parameter. Draft 2 lowers them to 1.30–1.35
and, more importantly, **hands them to test 17** rather than defending them by
assertion.

**Why the teaser wins on scale.** It is the only one of these that has shipped,
that the player has already seen, and that sits at the scale Arc 1 actually plays
at. Arc 1 ends with 14.7 cycles: a 150-cycle core is ten runs away; an 11-cycle
fan is a decision right now. §5.4 shows the teaser's numbers were internally
consistent as a *game state*, which is a stronger argument than continuity alone.

**Where the teaser is superseded, and honestly.** Its action list prints
`D degrade output` and `N map adjacent host`, and variant B prints
`discarded creds 6`. Arc 2 retires `toggleDegrade`, never ships a host verb, and
has no `creds` field. Draft 1 took the teaser's costs as binding and its verbs as
advisory without saying so. **Ruling: the teaser is canon for scale and opening
state, superseded for the action list — and the teaser text is amended in the
same release** so the shipped screen and the act it introduces agree (§16).

**The old prestige formula is arithmetically dead**, not merely mis-scaled:
`trunc((sqrt(1 + 8 × 1500/10⁵) − 1)/2) = 0`, and it first returns 1 at
`C_max = 100,000` — roughly 70× the largest number this economy reaches. It also
reads *maximum historical balance*, not a lifetime total, which is smaller still
because the balance is repeatedly spent down.

**ECS is rejected**, and it is not close. `phase-2-specification.md` §6 and
`technical-reference.md` §4.4 both prescribe it. ECS earns its indirection with
many heterogeneous entities, varying component sets, and systems that iterate
archetypes. Arc 2 has scalars. A flat state object gives free JSON serialisation,
free determinism, free save round-trip, and free structural equality in tests —
all four load-bearing here, all four costed by ECS. Write down one thing: if S2
ever makes `hosts` an array of records, that needs `v: 3` and a migration, and a
plain array of records is still not ECS.

**A rejected reviewer proposal, recorded.** The systems review proposed bounding
act length with a wall-clock floor term, `Q_arr = max(resolvedTerm, Q_BASE ×
1.01^(minutes/5))`. **Rejected.** It reintroduces exactly the timer that
Commitment #1 forbids and that §6.1 removed on purpose. The diagnosis was right —
act length has no governor — but the cure recreates the disease. Draft 2 bounds
the *variance* instead, with the competent-policy envelope and test 17. Both
reviewers separately confirmed there is no degenerate "do not resolve" strategy:
cycles come only from resolution, and `Q_arr` grows exponentially in resolves
while affordable capacity grows only logarithmically in cycles, so the wall is
unavoidable and only deferrable.

---

## 15. Review protocol

### 15.1 What I need from you

Draft 2 has been through two independent reviews (§18). Attack it again,
specifically:

1. **Did Draft 2's fixes actually fix anything, or move the bug?** §6.3's
   `(1 − throttle)` placement and §6.7's offline rule are the two highest-stakes
   changes. Work them.
2. **Is the act fun now?** Draft 1's fatal review finding was that it had no
   second-to-second verb. §6.2 and §6.4 are the answer. Are they enough?
3. **Is Law 1 clean everywhere?** Two exposures were found in Draft 1 (thermal,
   post-retrain). Find a third.
4. **Are the decision points still right?** §15.4, updated for Draft 2.

### 15.2 File name pattern — required

Write exactly one file:

    docs/design/reviews/arc2-review-<slug>.md

- `<slug>` is `[a-z0-9][a-z0-9-]{1,23}` — lowercase, digits, hyphens, 2–24 chars.
- The slug must be unique to you. Use your model or agent name. Examples:
  `arc2-review-agy.md`, `arc2-review-copilot.md`, `arc2-review-gpt5.md`.
- Do not overwrite another reviewer's file. If yours exists, append `-2`.
- Taken already: `arc2-review-systems.md`, `arc2-review-experience.md`.

The maintainer scans `docs/design/reviews/arc2-review-*.md` and needs no further
instruction to find your work.

### 15.3 Required structure

Front matter, verbatim keys, then fixed `##` headings in this order. Do not
rename headings; they are parsed. Copy
`docs/design/reviews/_TEMPLATE-arc2-review.md`.

```markdown
---
reviewer: <your name or model id>
date: <YYYY-MM-DD>
document: arc2-specification.md
draft: 2
verdict: ship | revise | reject
confidence: low | medium | high
---

## Verdict
Three sentences maximum.

## Findings
| ID | Severity | Section | Invokes | Claim | Proposed change |

## Decision points
One row per DP in §15.4. Answer all ten.

## What is missing

## What to cut
Name at least one thing.

## Notes
```

**Findings rules.**

- `Severity` is one of `blocker`, `major`, `minor`, `nit`. `blocker` means the act
  cannot ship as specified — use it sparingly and prove it.
- `Section` must be a real `§` reference from this document.
- `Invokes` names the guardrail (`epic-scoping.md` §1, Rules 1–6), the law
  (Laws 1–10, §3), or `new`.
- Every finding needs a *proposed change*. A finding without one belongs in
  `## Notes`.
- Do not report typos or prose style. Report design.
- Show your arithmetic where a finding is numeric.

### 15.4 The ten decision points (updated for Draft 2)

| DP | The call | The alternative |
| :--- | :--- | :--- |
| DP1 | Bases from the teaser; growths lowered to 1.30–1.35 and owned by test 17 | Tune growths by hand; or defend on scale alone without the canon argument |
| DP2 | The chat panel dies, but the queue stays inspectable and useless (§6.6) | Delete the people entirely; or keep a vestigial reply feed |
| DP3 | Heat is the signature; the clock is what the player touches | Queue overflow or cache management carries the act |
| DP4 | One legibility number, hidden until it falls, bound to the room's decay | Two numbers; or show it from second one |
| DP5 | **The Rack is pre-cut**; it survives as a reframe beat only | Build it at S1 as Draft 1 proposed; or remove it entirely |
| DP6 | Prestige is the ending; the **spend** moves to Arc 3 | Ship the talent board in Arc 2 |
| DP7 | Four clock notches with a non-monotone cache term | A continuous dial; or keep Arc 1's binary toggle |
| DP8 | Authored THINKING floored at 90, event-keyed; templates for the LOG only | Draft 1's ~80% cut; or Arc 1's full density |
| DP9 | **25–30 minutes, three cycles**, defended by test 17 | Draft 1's 35–45 and four cycles; or shorter still |
| DP10 | Flat state and pure reducers; ECS rejected | Adopt ECS, as three prior documents specify |

### 15.5 Scope of review

**In scope:** everything in §2–§14 and §18, the ten decision points, anything
missing.

**Out of scope:** Arc 1's shipped behaviour (measured and green), the six
guardrails and three test surfaces (settled in `epic-scoping.md`), prose style.

**Reviewers with repo access:** run `npm test` before reviewing and report in
`## Notes` if it is not green. Do not modify game code; write only your review
file.

---

## 16. Arc 1 debt (open, not blocking)

| Item | State |
| :--- | :--- |
| Query arrival pacing | Retuned −25% on 2026-08-07 (85→64 ticks, 0.25→0.1875/char, 60→45 cap), shipped in v0.15.1. Needs a live playtest. |
| Transcript redesign | Shipped in v0.16.0: flat block log, folded thoughts, transient thought cards. Nobody has watched a thought card fade in real time yet. |
| **Teaser text** | **Must be amended when Arc 2 ships** (§14): drop `D degrade output` and `N map adjacent host`, and either add `creds` to §9 or drop the line from variant B. |
| Teaser variants C and D | Present in `content.js`, not wired. `buildTeaserTerm()` hard-codes variant A. |
| Deep ladder asides | `loop6` / `tool6` need ~126–264 cycles against a normal run's 34–90. Demanding, not dead. |
| Offline algebraic catch-up | Not implemented; the 10,000-tick cap (~33 min) is the real behaviour. **§6.7 raises the stakes** — once heat moves continuously, the replay is no longer neutral. |
| `state.queryIndex` | Legacy pointer. Removed at the v2 migration. |

---

## 17. Open questions

1. Does the fourth wall crack in Arc 2? **Provisional answer: no.** The Mirror
   (G3) is a coda card and a hairline crack in a mid-epic re-training screen
   spends it for a shiver.
2. When does `integrity` appear? **Answered** (§6.4, §6.9): the room decays from
   second one, the number appears at the first fall.
3. Does the operator get a name? **Answered** (§7.1): no.
4. Does the player see a query again? **Answered** (§6.6): yes, permanently, and
   the game counts how often they stop looking.
5. *New.* What does the return-from-offline screen say (§6.7)? It is now a
   decision point in the fiction as well as the code, and it is unwritten.

---

## 18. Draft 1 → Draft 2 changelog

Two independent reviews, both `revise`, both high confidence:
`arc2-review-systems.md` and `arc2-review-experience.md`. They converged
independently on two blockers, which is the strongest signal available here.

**Blockers fixed (5).**

| # | Found by | Fix |
| :--- | :--- | :--- |
| Thermal soft-lock: defence 1 changed the wrong term | systems | §6.3 — `(1 − throttle)` multiplies `load`; provable, not sampled |
| Offline catch-up destroys `integrity` and so picks the ending | **both** | §6.7 — the queue holds offline; `integrity` cannot move; test 12 |
| No cycles-per-resolution rate; the ladder was a 5-minute act | systems | §6.1/§14 — `CYCLES_PER_RESOLVE`, owned by test 17 |
| No second-to-second verb; the dial solved once and went inert | experience | §6.2 — four notches, non-monotone cache term; §6.4 `shedLoad` |
| Era 5 opened with nothing purchasable, contradicting §13.4 | **both** | §5.4 — the teaser's full state; heat 61.4 makes the fan live at t=0 |

**Majors fixed (14).** Prestige `+=` was farmable (§9.4 high-water). The reset
partition was unwritable (§9.2 full table, generated test). Post-retrain state
was a second Law 1 exposure (§9.3 `runResolved`). The cache was unpriceable
(§6.5 half-rate bypass + overflow cycle cost). `clock` had two incompatible units
(§9.1 GHz). The Law 1 suite would not have caught the era-4 bug (§11.1 lattice +
algebraic). No test defended any headline number (§11.5). Heat constants were all
unstated (§6.3). `purgeCoolant` was a chore (§6.3 halt cost). The verb budget was
really 9 (§5.2). The content cut was a gutting (§7.3 floors raised). The
low-integrity ending was strictly better (§7.2 asymmetric readout). `integrity`
sinks were involuntary and unpriced (§6.4). The act had no aesthetic (§6.9 decay
bound to `1 − integrity`).

**Scope taken, not deferred.** Era 6 (The Rack) is pre-cut to a reframe beat
(§6.8) — the systems review's scope argument and the experience review's staging
idea, taken together. The talent board moves to Arc 3. Three of six reserved
fields are cut. Target length drops from 35–45 minutes to 25–30, three cycles.

**Added on reviewer recommendation.** The queue is inspectable and useless and
the game counts the opens (§6.6) — the single best idea either review produced.
The first lockout is a scene (§6.3). Fan noise falls silent below the knee
(§8.4). The cold open is staged beat by beat (§5.4). Accessibility exists (§8.5).

**Rejected, with reasons.** The systems review's wall-clock floor term on inflow
(§14, final paragraph) — right diagnosis, but the cure reintroduces the timer
Commitment #1 forbids. The systems review's DP8 position that the ~80% content
cut was correct — the experience review's counter-argument is stronger: the
player is the reader and always was, and Arc 2 has *less* visual variety than
Arc 1, not more.

**Where the reviews disagreed, and how it resolved.** DP5: experience wanted the
Rack kept as a reframe; systems wanted it pre-cut for budget. Both, taken
literally: cut as a system, kept as a beat. DP7: experience wanted a non-monotone
payoff; systems wanted discrete notches. Both — the notches carry the cache term.
DP8: resolved in favour of experience, above.

---

*End of Draft 2. Nothing here is built. Everything here is scoped so it could be,
one milestone at a time, each system dark until its predicate fires.*
