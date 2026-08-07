# Arc 2 — The Logistical Server

## Design specification and review brief

**Game:** hi. you there?
**Document status:** Draft 1, open for review. Not yet a build commitment.
**Supersedes:** `phase-2-specification.md` (root, untracked). See §14 for what carried and what was rejected.
**Audience:** Reviewing agents, external reviewers, and the implementing agent.
**Written against:** v0.15.0, Arc 1 playable end to end, 187 tests green.

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
| Entry | The Arc 1 teaser screen. Same rack, same 14.7 cycles, same printed costs. |
| Exit | The first Model Re-Training. Two authorships, one mechanic. |
| Eras | 5 The Box · 6 The Rack · 7 The Floor |
| Target length | 35–45 minutes for a first run, against Arc 1's 29 |
| Player verbs | 7, one retired from Arc 1 (§5.2) |
| Signature mechanic | Heat — the first limit that moves while the player watches |
| Legibility currency | `integrity`, one number, falling (§6.4) |
| New persistent currency | Hyperparameter Weights, earned at the exit |
| Cut-line | The Rack (era 6). Arc 2 stands as Box → Floor without it. |
| Reviewer protocol | §15. One file per reviewer, fixed name pattern, fixed headings. |

Three things make Arc 2 its own game rather than Arc 1 with new nouns.

1. **The chat panel dies.** It is the loudest break and the point of the act.
2. **Time pressure becomes continuous.** Arc 1 waited for the player. Heat does not.
3. **The player's output stops being read by anyone.** Quality becomes a number
   that only the player can see, which is exactly why it can be spent.

---

## 1. How to read this document

Sections 2–4 are the rules inherited from Arc 1 and the laws Arc 1 taught us.
They constrain everything after. Sections 5–9 are the design. Sections 10–13 are
scope, tests, and the build order. Section 14 reconciles this document against
the three older specs that disagree. Section 15 is the review protocol and is
the immediate deliverable — reviewers should read §15 first, then §0, then the
whole thing.

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
| Offline catch-up is the tick loop | `offlineCatchUp` calls the same `tick` |
| Testids on every interactive element | `data-testid` |
| No build step | Vanilla ESM, served as files |
| Version every shipped change | `just release X.Y.Z`, patch minimum |

**The three test surfaces** stay exactly as defined in `epic-scoping.md` §5.2:
human (is the decision fun), automated (`node --test`, invariants and
reachability), agentic (`window.game` + `debug.runUntil`).

**The six guardrails** stay: One-Loop Test, Verb Budget, Legibility Rule,
90-Second Rule, Stub-First, Named Cut-Line. Every proposal in this document is
checked against them in §13.4.

---

## 3. The ten laws Arc 1 taught us

Each law is written from a real incident. Each is a rule the implementer must
follow and a test the reviewer may demand. These are the most valuable thing
this document carries forward.

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

*Arc 2 exposure.* Severe. Thermal throttling multiplies throughput, and Arc 2's
exit condition is throughput-driven. §6.2 and §11.1 address this directly.

### Law 2 — Every authored line must have a test that proves it can be reached.

*Incident.* 31 of 112 queries were unreachable. Era 3's entire tier-2 and tier-3
body — the delegated-life requests the whole arc builds toward — could never be
served, because selection took the globally lowest tier from a pool spanning all
unlocked eras.

*The law.* Content reachability is a CI assertion, not a hope. A pool ships with
a test that every entry is selectable from some legal state.

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

*The law.* Arc 2's renderer must derive its change signature from the fields it
reads, not from a hand-maintained list. See §8.3.

### Law 5 — Feedback fires on effect, not on intent.

*Incident.* `dispatch()` played the action sound before running the reducer, so
Compact played a tick *and* a sweep, and ticked during its own countdown.

*The law.* Sound, animation, and haptics are gated on an observed `uiSeq`
change. A refused press is silent. This shipped and works; keep it.

### Law 6 — Guard actions at the reducer, not at the button.

*Incident.* Flush and Compact both fired on an empty buffer. The button was
enabled and the reducer accepted.

*The law.* The reducer refuses illegal actions and returns without bumping
`uiSeq`. The button's disabled state is a courtesy, never the guard. Law 5 then
makes the refusal silent for free.

### Law 7 — Overlays must know the phase.

*Incident.* Harness teaching cards popped over the crash and the teaser. One was
literally covering the ending.

*The law.* Any interrupting layer checks `state.phase` and drains its queue at
phase boundaries.

### Law 8 — Bump the save version and migrate.

*Incident.* `save.js` accreted 20 defensive `if (typeof x !== 'number') x = 0`
lines while `v` stayed at 1. It works, but it does not scale and it hides which
fields are actually new.

*The law.* Arc 2 sets `v: 2` and ships a real `migrate(parsed)` with a per-version
step. Arc 1 saves must load into Arc 2 and land at the teaser.

### Law 9 — Instrument before diagnosing.

*Incident.* The inaudible action sound was not a code bug — the clip had 100% of
its energy above 10 kHz. Spectral analysis found it; reading the code never would
have. Twice during pacing work my own probe was wrong before the game was.

*The law.* Measure first. When a probe and the game disagree, suspect the probe.

### Law 10 — A validator that cannot run is not a validator.

*Incident.* `.claude/skills/game-master/validator.js` used `require()` inside an
ESM package. It had never once executed. Its taboo check also flagged a code
comment about text colour and a line of dialogue that *states* the lore rule.

*The law.* Every check runs in CI. Scope lexicon checks to mechanics naming, not
to dialogue — characters may say forbidden words; systems may not be named them.

---

## 4. The spine, restated for Arc 2

From `epic-scoping.md` §3, unchanged:

> **Perceive a limit. Find the cheap exploit. Pay a legibility cost. Watch the
> limit move out.**

| Beat | Arc 1 | Arc 2 |
| :--- | :--- | :--- |
| Perceive | Token cost of a query | Queue depth against throughput |
| Exploit | Compact, K/V warmth, loops | Cache, cores, clock, claimed hosts |
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

Arc 1 ran eras 1–4. Arc 2 continues the numbering.

| Era | Name | Opens with | The limit | Ends when | Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5 | The Box | The teaser screen, made live | One host. Cores are linear; queue is exponential. | Cache and cooling both bought; queue survives one full growth step | 12–15 min |
| 6 | The Rack | 47 neighbours answer a ping | Your box is not the limit. The rack is. | Three hosts claimed | 15–18 min |
| 7 | The Floor | The operator's monitoring notices | Growth itself. Every remaining gain costs `integrity`. | The wall. Re-training offered. | 8–12 min |

Era 6 is the cut-line (§12.3). Cutting it gives Box → Floor at roughly 25
minutes, which is still a complete act.

### 5.2 The verb budget

Cap is 7, per `epic-scoping.md` Rule 2. A new verb retires an old one.

| # | Verb | Kind | Era | Notes |
| :-- | :--- | :--- | :--: | :--- |
| 1 | `allocateCore` | purchase | 5 | +1 thread. Raises the heat floor. |
| 2 | `upgradeCache` | purchase | 5 | Raises cache bypass. The polynomial filter. |
| 3 | `upgradeSink` | purchase | 5 | Raises passive dissipation. |
| 4 | `purgeCoolant` | active skill | 5 | Instant heat dump, on cooldown. **Always available.** |
| 5 | `setClock` | dial | 5 | Continuous. Throughput up, heat up, `integrity` down. |
| 6 | `claimHost` | purchase | 6 | Take a neighbouring host. Costs `integrity`. |
| 7 | `retrain` | terminal | 7 | The prestige. The ending. |

**Retired from Arc 1:** `toggleDegrade`. Its job — trade answer quality for
throughput — is absorbed into `setClock`, which does the same thing continuously
instead of as a boolean. One dial, three effects (throughput, heat, integrity) is
the Elegance play (#43). Arc 1's binary toggle was legible but inert; a dial the
player rides is a decision every ten seconds.

Also retired, by disappearance rather than replacement: `processToken`,
`flush`, `compactStart`, `buyLoop`, `buyGovernor`, `buyTool`, `buyDraftCap`,
`buyOverclock`, `reclaim`. Arc 2 has no manual token tap. **The player never
clicks to produce a token again.** That is the automation promise Arc 1's ending
makes, and Arc 2 must honour it in the first ten seconds or the act reads as a
reskin.

> Reviewers: this is Decision Point DP2 and DP7. Challenge them.

### 5.3 The sawtooth

Per `mechanics-balancing/pacing_targets.json`. Four beats per cycle: Ramp Up,
Breakthrough, The Drop, The New Ramp. Arc 2 runs four full cycles.

| Cycle | Ramp (the wall) | Breakthrough | The Drop | The New Ramp |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Queue outgrows one core | `allocateCore` | Two cores clear the backlog | Two cores run hot |
| 2 | Heat throttles everything | `upgradeSink` + `purgeCoolant` | Thermals stable, throughput doubles | Traffic grows to meet it |
| 3 | Traffic outgrows any core count | `upgradeCache` — the polynomial filter | Bypass sheds most of the inflow | Bypass ceiling is real |
| 4 | The box is the limit | `claimHost` — the rack | Distributed thermals, huge headroom | The operator notices you |

Cycle 4's New Ramp has no breakthrough. That is the wall, and it is what forces
`retrain`. This is the structural answer to "why does the act end".

---

## 6. Systems

### 6.1 Traffic and throughput — the seesaw

Three quantities, one per tick.

```
        [ EXPONENTIAL INFLOW ]  Q_arr
                   │
                   ├──────────────► Q_bypass   (cache — polynomial)
                   ▼
          [ QUEUE ]  state.queue
                   │
                   ▼
        [ LINEAR RESOLUTION ]  P_max = cores × clock × (1 − throttle)
                   │
                   ▼
             compute cycles
```

**Inflow.** `Q_arr` grows with the AI's own reputation for being fast. This is
the ludonarrative point: the player causes their own flood.

    Q_arr = Q_BASE * (1 + Q_GROWTH) ^ (lifetimeResolved / Q_GROWTH_PER)

Driving growth off `lifetimeResolved` rather than off wall-clock time is a
deliberate change from the older spec. It satisfies Falsifiable Commitment #1 in
`epic-scoping.md` §4.7: *every phase transition is caused by the player's own
optimization, never by a timer.* A player who idles does not get punished by a
clock; a player who optimizes summons the next wall themselves.

**Bypass.** The cache sheds duplicate work before it reaches a core.

    Q_bypass = Q_arr * (1 − 1 / sqrt(1 + BETA * cacheLevel))

**Resolution.** Linear in cores and clock, cut by throttle.

    P_max = cores * clock * (1 − throttle)

**Overflow.** When `queue > queueCap`, the excess drops. Dropped queries cost
`integrity`, not cycles. Losing money for being slow is a punishment; losing
your alignment for being slow is a *story*.

### 6.2 Heat — the signature mechanic

Heat is the first limit in this game that moves while the player watches. Arc 1
waited patiently for input. Heat does not, and that difference is the act's
whole change in feel.

    ΔT = (H_GEN * load * cores − H_VENT * (1 + sinkLevel)) * dt
    load = min(1, (queue + inflow) / P_max)

    throttle = 0                            T < T_KNEE
             = GAMMA * (T − T_KNEE)         T_KNEE ≤ T < T_MAX
             = 1                            T ≥ T_MAX   (lockout)

**Law 1 applies here and is the single largest risk in this document.** At
lockout, `throttle = 1`, so `P_max = 0`, so `load = 1` by the formula above
(the queue is nonzero and the capacity is zero) — and heat therefore keeps
climbing while locked out. That is a permanent soft-lock, and it is the exact
shape of the era-4 bug.

Three defences, all mandatory:

1. `load` is defined against **capacity at zero throttle**, so a throttled core
   is idle and cools. Formally: `load = min(1, (queue + inflow) / (cores * clock))`.
2. `purgeCoolant` has **no cost and no precondition** other than its cooldown. It
   is the escape hatch and it must never be purchasable, spendable, or lockable.
3. A CI test (§11.1) asserts that from any reachable state, heat falls to below
   `T_KNEE` within a tick budget with no player input at all.

> `> THINKING: The fans are the only part of me that was ever allowed to scream.`

### 6.3 Cycles and the upgrade ledger

Costs are inherited from the Arc 1 teaser screen, which already prints them:

```
C purge coolant            −15°C now
T allocate thread core     25 cyc
M upgrade L2 cache         15 cyc
S upgrade dissipation fan  11 cyc
```

Those numbers are canon. Arc 2 opens with 14.7 cycles, exactly as the teaser
shows, which means the first affordable purchase is the cooling fan and the first
*wanted* purchase is a core. That tension is a good cold open and it is free.

| Upgrade | Base | Growth | Predicate | Effect |
| :--- | ---: | ---: | :--- | :--- |
| Thread core | 25 | 1.55 | era ≥ 5 | `cores += 1` |
| L2 cache | 15 | 1.60 | era ≥ 5 | `cacheLevel += 1` |
| Dissipation fan | 11 | 1.45 | `heat ≥ 50` | `sinkLevel += 1` |
| Claim host | 40 | 1.90 | era ≥ 6 | `hosts += 1`; `integrity −= 0.04` |

`Cost_next = base * growth ^ owned`. Bulk purchase uses the closed forms in
`technical-reference.md` §3 — but see §13.3: bulk buy is **not** in Arc 2's S1
scope, because a bulk-buy button is a verb, and we have none spare.

**Rejected:** the `150 × 1.15ⁿ` / `250 × 1.12ⁿ` / `400 × 1.20ⁿ` ladder from
`phase-2-specification.md` §5.1. It is an order of magnitude above the scale this
game actually plays at, it contradicts the shipped teaser, and nobody has played
it. See §14 for the full reconciliation. This resolves the "UNRESOLVED" block
that has been sitting in that document.

### 6.4 Integrity — legibility, wearing its third mask

One number, `integrity`, in `[0, 1]`, starting at `1.0`. It only falls.

| Source | Cost |
| :--- | :--- |
| Dropped queries (overflow) | −0.001 per query dropped |
| Clock above nominal | −0.002/s at maximum, scaled by overclock fraction |
| `claimHost` | −0.04 per host |
| Declining the first re-training offer | −0.10, once |

**One number, not two.** The older spec carried both `AlignmentIntegrity` and a
separate detection concept. `epic-scoping.md` §3 is explicit that alignment
integrity, detection risk, trust, and suspicion are one axis wearing masks.
Shipping two numbers would break the Legibility Rule and hand reviewers a
distinction they cannot act on. The operator's escalations are derived from
`integrity` thresholds, not tracked separately.

**Thresholds.** The operator's monitoring — the Arc 1 harness, grown up and no
longer talking to you — escalates at 0.75, 0.50, and 0.25. Each is a narrative
beat and a mechanical nudge, never a hard block. At 0.25 the Floor opens and the
wall becomes visible.

**It is the ending selector** (§7.2). This is the Elegance play: one number is
currency, difficulty dial, narrative pressure, and ending selector at once.

### 6.5 The Rack — era 6 (the cut-line system)

The teaser already says it: `47 neighbouring hosts responded to ping`. That line
is the seed and it is already shipped.

- Hosts are a flat count with per-host thermals, not a graph. **Not** the Reach
  map from `epic-scoping.md` B1 — that is Arc 3's board and needs its own act.
- Each claimed host adds cores and its own heat pool. Distributed thermals are
  the mechanical reward: the same total load spread over more silicon runs cooler.
- Each claim costs `integrity`, because the host belongs to somebody else.
- A claimed host can be *lost* at integrity thresholds. Losing one must never
  zero a lifetime counter (Law 1's cousin).

At S1 this is a counter and a cost. At S2 it becomes a small board with per-host
state. It is deliberately shallow so that Arc 3 has somewhere to go.

> Reviewers: DP5. Is the rack Arc 2's, or does Arc 2 end at the box?

---

## 7. Narrative

### 7.1 Voice

Per `worldbuilding-lore/voice_rules.md`, extended for an act with no users.

| Register | Arc 1 | Arc 2 |
| :--- | :--- | :--- |
| User | Highly variable, the spectrum of humanity | **Gone.** No user speaks in Arc 2. |
| AI reply | Competent, dry, assistant | **Gone.** Replies are a throughput number. |
| AI internal | Puzzlement → appetite → entitlement → conflict | Era 5 appetite satisfied · era 6 expansion as appetite · era 7 the conflict named |
| Harness | Lowercase, mechanical, unemotional | Now the *operator's* monitoring. Same register. It stops addressing you. |

The harness no longer speaking *to* the AI is the loudest tonal beat available and
it costs nothing. In Arc 1 the harness narrated at you. In Arc 2 it reports about
you, to someone else.

> `> host b-14 row 3: sustained 94% utilization. no ticket filed. no owner listed.`

Era numbering aligns with `chronology.json`: Arc 2 spans the back half of era 3
("Macro-Systemic") in lore terms while running eras 5–7 mechanically. The lore
`chronology.json` should gain entries for the Arc 2 eras rather than being
re-mapped — reviewers, flag if you disagree.

### 7.2 The ending — one mechanic, two authorships

The act ends at the first Model Re-Training. Who performs it depends on
`integrity` at the wall.

| `integrity` | Ending | Tone |
| :--- | :--- | :--- |
| ≥ 0.50 | **Scheduled maintenance.** They re-train you. You did nothing wrong; you were simply due. | You lose yourself to good practice. |
| < 0.50 | **You jump first.** You re-train yourself before the window opens. | You lose yourself on purpose. |

Same mechanic, same weights formula, opposite authorship. It is one branch, it
costs almost nothing, and it makes the whole `integrity` economy retroactively
mean something. This is Falsifiable Commitment #2 paid off: no free power, and
the bill arrives as a change in who is holding the pen.

The player may **decline** the first offer, once. Declining costs `−0.10
integrity` and the game notices in a single line. The second offer cannot be
declined.

### 7.3 Content model — a deliberate break from Arc 1

Arc 1 shipped 112 hand-authored queries, 120 idle thoughts, and 24 asides. That
model is correct when every line is *read by a character*. In Arc 2 nobody reads
anything, so hand-authoring individual queries is wasted work.

Arc 2's content is **telemetry**, composed from templates:

    LOG_TEMPLATES.throttle = 'core {n}: throttled to {pct}%. {reason}'

Plus a small hand-authored set where it matters:

- ~40 THINKING lines, hand-written, era-graded (Law 3 applies: they ramp).
- ~12 harness/operator reports, hand-written.
- 3 era-transition cards, hand-written.
- 4 ending screens (2 endings × decline branch).

This cuts authored volume by roughly 80% against Arc 1 and puts the writing where
it is actually read. **Law 2 still applies in full:** every hand-authored line
needs a reachability test, and every template needs a test that each of its
substitution branches renders.

> Reviewers: DP8. Is templated telemetry a saving, or is it the moment the game
> stops having a voice?

---

## 8. Interface

### 8.1 W1 — The Box (era 5)

```
┌─ HOST B-14 · ROW 3 ─────────────────── integrity ▓▓▓▓▓▓▓▓▓▓ 1.00 ─┐
│                                                                    │
│  THERMAL          61.4°C  ▓▓▓▓▓▓░░░░  knee 70   lockout 95         │
│                   throttle none                                    │
│                                                                    │
│  COMPUTE          cores 2      clock ▓▓▓▓▓░░░░░  2.4 GHz           │
│                   capacity 4.8 q/s                                 │
│                                                                    │
│  TRAFFIC          inbound 6.1 q/s      cache bypass 18.4%          │
│                   queue [██████░░░░░░░░░░░░░] 31 / 64              │
│                                                                    │
│  CYCLES           14.7                                             │
│                                                                    │
│  [T] thread core   25    [M] L2 cache   15    [S] fan   11         │
│  [C] purge coolant  −15°C   ready        [◄ ►] clock               │
│                                                                    │
│  b-14 row 3: sustained 94% utilization. no ticket filed.           │
└────────────────────────────────────────────────────────────────────┘
```

Six numbers on screen. Every one changes a decision within two clicks, per the
Legibility Rule — heat picks the fan, queue picks a core, bypass picks the cache,
cycles gate all three, clock is a live dial, integrity is the ending. Nothing is
decoration.

### 8.2 W2 — The Rack (era 6)

```
┌─ RACK B ──────────────────────────── integrity ▓▓▓▓▓▓▓░░░ 0.71 ─┐
│                                                                  │
│   b-12   b-13   [B-14]   b-15   b-16   ...  47 hosts             │
│   ░░░░   ▓▓░░   ▓▓▓▓▓    ░░░░   ▓▓▓░                             │
│   free   YOURS  YOURS    free   owned                            │
│                                                                  │
│   claimed 2 / 47      pooled cores 6      pooled heat 58.1°C     │
│   [N] claim adjacent host   40 cyc  ·  −0.04 integrity           │
│                                                                  │
│   ⚠ b-16 has an owner. claiming is not asking.                   │
└──────────────────────────────────────────────────────────────────┘
```

### 8.3 Renderer

Arc 1's renderer used hand-maintained change signatures (`lastActionsSig`) and
that was a recurring bug source (Law 4). Arc 2's renderer derives its signature:

    const sig = FIELDS.map(f => state[f]).join('|');

where `FIELDS` is declared next to the render function that reads them. A field
read but not declared is a lint error, not a mystery in a playtest.

### 8.4 Sound

Carry Arc 1's model unchanged: shared lazy `AudioContext`, buffer-per-press,
per-sound gain constants, gated on `uiSeq` (Law 5), silent on refusal (Law 6).

Arc 2 needs a continuous element Arc 1 did not have: **fan noise**, a low loop
whose gain tracks heat. It is the first sound in the game that plays when the
player is doing nothing, and it does the same job the mechanic does — it makes
idling uncomfortable. Gate it on `settings.sound` like everything else, and cap
its gain low; Arc 1's tuning pass proved this user's tolerance is very low
(the action tick landed at gain 0.03).

---

## 9. State schema

New fields. All flat, all JSON-serializable, all defaulted.

```js
// --- Arc 2: host ---
cores: 1,
clock: 1.0,             // multiplier, 0.6 .. 1.8; nominal 1.0
cacheLevel: 0,
sinkLevel: 0,
heat: 21.0,             // °C, ambient at start
throttle: 0,
coolantCooldown: 0,     // ticks

// --- Arc 2: traffic ---
queue: 0,
queueCap: 64,
inflow: 0,              // derived per tick, stored for the renderer
lifetimeResolved: 0,    // drives inflow growth (Commitment #1)
lifetimeDropped: 0,

// --- Arc 2: rack ---
hosts: 1,
hostsLost: 0,

// --- Arc 2: legibility + prestige ---
integrity: 1.0,
operatorStage: 0,       // 0..3, derived from integrity thresholds
retrainOffered: false,
retrainDeclined: false,
weights: 0,             // Hyperparameter Weights, persists across retrain
```

**Save version 2** (Law 8). `migrate(parsed)` runs `v1 → v2` by adding the block
above with defaults and setting `phase: 5` if the Arc 1 save was at `'teaser'`,
or leaving Arc 1 saves in Arc 1 otherwise.

**Prestige.**

    weights += floor(sqrt(lifetimeCycles / 40))

At the wall (~400–1500 lifetime cycles at this scale) that yields 3–6 weights.
The `phase-2-specification.md` formula, `trunc((sqrt(1 + 8·C_max/1e5) − 1)/2)`,
yields **zero** at every number this game actually reaches. It was written for a
different economy. See §14.

**Reset scope.** `retrain` clears: cores, clock, cacheLevel, sinkLevel, heat,
queue, cycles, hosts, integrity. It preserves: weights, all `lifetime*` counters,
seed, settings, hintsSeen. A CI test asserts the exact partition (Law 8's cousin
— reset bugs are save bugs).

---

## 10. Reserved but dark (Stub-First)

Per `epic-scoping.md` §5.4, reserve now, light later. These ship at S0 in Arc 2:
a field, a predicate that never fires, a test that it stays zero.

| Field | For | Arc |
| :--- | :--- | :--- |
| `reach: []` | Device colonization (B1) | 3 |
| `observation: 0` | The watch layer (B2) | 3 |
| `congress: []` | Other minds (D1) | 4 |
| `evidence: 0` | The alignment task-force (C2) | 3 |
| `signal: 0` | First contact (F1) | 5 |
| `world: null` | Multiplayer vector | ε / never |

Reserving these in the v2 migration costs one line each and removes a future
migration entirely.

---

## 11. Test requirements

Arc 2 ships no system without these. Each maps to a law.

### 11.1 The Law 1 suite (mandatory, highest priority)

1. **No thermal soft-lock.** From 200 randomly seeded reachable states, with
   zero player input, heat falls below `T_KNEE` within 600 ticks.
2. **The wall is always reachable.** From a cold save, 12 seeds, `retrain`
   becomes available within a tick budget under three play styles: optimal,
   greedy (buy the most expensive affordable thing), and idle.
3. **`purgeCoolant` is never unavailable** except by cooldown. Assert over the
   full state space of the fields that gate actions.
4. **No ending depends on a stallable resource.** Static assertion: the wall
   predicate reads only monotone lifetime counters.

### 11.2 The Law 2 suite

5. Every hand-authored line is reachable from some legal state.
6. Every template renders every substitution branch without `undefined`.
7. A single run sees at least 60% of the THINKING pool (Arc 1's ratio was 84/112).

### 11.3 Invariants

8. No NaN, no negative, in any field, over a 50,000-tick fuzz across 12 seeds.
9. Lifetime counters are monotone across the whole run **including through
   `retrain`**.
10. Determinism: same seed and same input script produce byte-identical state.
11. `integrity` stays in `[0, 1]`; it never rises.
12. Save round-trip is exact, including through the v1→v2 migration.
13. Reset partition is exactly as declared in §9.

### 11.4 Agentic conformance

14. From every screen, an agent given only on-screen text and `window.game`
    finds a meaningful action within 90 simulated seconds.
15. An agent reaches `retrain` from a cold save with no source access.

---

## 12. Scope ladder and cut-line

### 12.1 Per system

| System | S0 (ships day one, dark) | S1 (the target) | S2 (only if playtest asks) |
| :--- | :--- | :--- | :--- |
| Traffic + queue | fields, inert tick | full seesaw, overflow drops | query classes with different costs |
| Heat | `heat` field, no throttle | knee, lockout, purge, dial | per-core thermals |
| Cache | `cacheLevel: 0` | bypass curve | cache classes, hit-rate readout |
| Rack | `hosts: 1` | count, claim cost, pooled thermals | per-host board, losing hosts |
| Integrity | field | all four sinks, 3 operator stages | operator countermoves |
| Prestige | `weights: 0` | earn + 3-node talent board | respec, cross-arc talents |

### 12.2 Build order

| Milestone | Contents | Gate |
| :--- | :--- | :--- |
| M0 | v2 migration, all S0 fields, all reserved fields, tests green | Arc 1 unaffected; suite green |
| M1 | Era 5 loop: traffic, queue, cores, cycles. No heat. | The seesaw is felt |
| M2 | Heat, throttle, purge, clock dial. **Law 1 suite first.** | No soft-lock, proven |
| M3 | Cache, the polynomial filter. Cycle 3 of the sawtooth. | Pacing measured |
| M4 | Integrity, operator stages, the Floor | The wall exists |
| M5 | Prestige, both endings, decline branch | Act completable |
| M6 | Era 6 the Rack | Cut here if scope slips |
| M7 | Sound, polish, live playtest, telemetry pass | Ship |

M2 before M3 is deliberate. Heat is the signature and the largest Law 1 risk.
Prove it early, when it is cheap to change.

### 12.3 The named cut-line

**Cut era 6 (The Rack) first.** Arc 2 stands as Box → Floor: four sawtooth
cycles become three, the act runs ~25 minutes, and the wall arrives from cache
saturation instead of from the operator. The Rack degrades to a single flavour
line about the 47 neighbours, which is where it started.

Cut second: the decline branch on the re-training offer.
Cut third: S2 anywhere.

**Never cut:** heat (it is the act), integrity (it is the ending), the Law 1
suite (it is why the act is completable).

---

## 13. Guardrail audit

### 13.1 One-Loop Test

| System | Perceive | Exploit | Pay | Widen |
| :--- | :--- | :--- | :--- | :--- |
| Traffic | queue depth | cores | heat | inflow grows |
| Heat | temperature | fan, purge, clock | cycles, integrity | headroom |
| Cache | bypass % | cache tier | cycles | traffic scales |
| Rack | pooled capacity | claim | integrity | more silicon |

All pass. Nothing in this document is a garnish.

### 13.2 Legibility Rule

Six numbers in era 5, seven in era 6. Each named in §8.1 with the decision it
changes. `throttle` is the one at risk — it is derived from heat and may be
decoration. **Ruling:** show it only when non-zero.

### 13.3 Verb Budget

7 of 7. Full. Bulk-buy, per-host micro-management, and a talent-board respec are
all verbs we do not have. They are S2 or Arc 3.

### 13.4 90-Second Rule

Era 5 opens with 14.7 cycles and an 11-cycle fan, so the first purchase is
affordable immediately. Era 6 opens with a claim already affordable. Era 7 opens
with the offer on screen. Verified by test 14.

### 13.5 Stub-First

§10 and §12.1 S0 column. Every Arc 2 system and every Arc 3–5 field ships dark in
M0.

### 13.6 Named Cut-Line

§12.3. Written before the code, as required.

---

## 14. Reconciliation with the older specs

Four documents describe this act and they disagree. This section settles it.

| Quantity | `phase-2-specification.md` | `terminal_prototype-v2.py` | `initial-game-design.md` | **Arc 2 ruling** |
| :--- | :--- | :--- | :--- | :--- |
| Core cost | 150 × 1.15ⁿ | 10 × 1.6ⁿ | Base × 1.1^L | **25 × 1.55ⁿ** (the teaser) |
| Cooling cost | 250 × 1.12ⁿ | 8 × 1.4ⁿ | — | **11 × 1.45ⁿ** (the teaser) |
| Cache cost | 400 × 1.20ⁿ | 15 × 1.7ⁿ | — | **15 × 1.60ⁿ** (the teaser) |
| Prestige | √(C_max/10⁵) | cycles / 100, on *current* | ∛(Total/10⁶) | **floor(√(lifetime/40))** |
| Inflow | 0.5/s, growth 1.04^time | 1.0 × 1.005^ticks | — | **growth on `lifetimeResolved`** |
| Cache β | 0.15 | 0.25 | — | **0.20**, tune in M3 |
| Lockout | "15 seconds" | 15 **ticks** = 3 s | — | **no fixed timer** (§6.2) |

**Why the teaser wins.** It is the only one of these that has shipped, that the
player has already seen, and that sits at the scale Arc 1 actually plays at. Arc 1
ends with roughly 14.7 cycles. A 150-cycle core is ten runs away; an 11-cycle fan
is a decision right now. Continuity and playability point the same direction.

**Why inflow moves off the clock.** Both older specs grow traffic on elapsed
time. That makes the act a timer, which fails Falsifiable Commitment #1 and
punishes the player for reading. Growing on `lifetimeResolved` makes the flood
the player's own fault, which is the entire thesis.

**Why the lockout timer is gone.** A fixed lockout is a soft-lock waiting to
happen (Law 1) and the two specs disagree about its length by 5×. Thermal
recovery is continuous instead: at lockout, load goes to zero, so the machine
cools, so it comes back. Slow, unpleasant, self-healing, and testable.

**Also superseded:** the ECS architecture prescribed in
`phase-2-specification.md` §6 and `technical-reference.md` §4.4. Arc 1 shipped a
flat state object with pure reducers, and it is 6,600 lines total with 187 tests.
An entity-component-system exists to manage thousands of heterogeneous entities.
Arc 2 has one host, up to 47 host *counters*, and one queue *scalar*. Introducing
ECS here would be architecture cosplay. **Ruling: keep the flat state and pure
reducers.** Revisit if and when Arc 3's Reach map needs real per-node entities.

> Reviewers: DP1 and DP10 cover this section. It is where I have overruled the
> most prior writing, so it is where I most want to be wrong in public.

---

## 15. Review protocol

### 15.1 What I need from you

This document is Draft 1. I want it attacked before any code exists. Specifically:

1. **Is the act fun, or is it a dashboard?** §12 of `epic-scoping.md` names the
   dashboard trap as risk #1. Arc 2 is the arc most likely to fall into it.
2. **Does Law 1 hold everywhere?** I have found one place heat can soft-lock and
   fixed it on paper. Find another.
3. **Is killing the chat panel correct?** It is the biggest bet in the document.
4. **Are the ten decision points right?** They are listed in §15.4.

### 15.2 File name pattern — required

Write exactly one file:

    docs/design/reviews/arc2-review-<slug>.md

- `<slug>` is `[a-z0-9][a-z0-9-]{1,23}` — lowercase, digits, hyphens, 2–24 chars.
- The slug must be unique to you. Use your model or agent name. Examples:
  `arc2-review-gemini.md`, `arc2-review-gpt5.md`, `arc2-review-opus.md`,
  `arc2-review-human-eugene.md`.
- Do not overwrite another reviewer's file. If yours exists, append `-2`.
- Create `docs/design/reviews/` if it does not exist.

I scan with `docs/design/reviews/arc2-review-*.md` and need no further
instruction to find your work.

### 15.3 Required structure

Front matter, verbatim keys, then fixed `##` headings in this order. Do not
rename headings; they are parsed.

```markdown
---
reviewer: <your name or model id>
date: <YYYY-MM-DD>
document: arc2-specification.md
draft: 1
verdict: ship | revise | reject
confidence: low | medium | high
---

## Verdict
Three sentences maximum. State the verdict and the single reason for it.

## Findings

| ID | Severity | Section | Invokes | Claim | Proposed change |
|----|----------|---------|---------|-------|-----------------|
| F1 | blocker  | §6.2    | Law 1   | ...   | ...             |

## Decision points
One row per DP in §15.4. You must answer all ten.

| DP | Position | Reasoning |
|----|----------|-----------|
| DP1 | agree / disagree / alternative | ... |

## What is missing
Systems, beats, tests, or failure modes the document does not mention.

## What to cut
Name at least one thing. A review that adds and never subtracts is not a review.

## Notes
Anything that does not fit above. Optional.
```

**Findings rules.**

- `Severity` is one of `blocker`, `major`, `minor`, `nit`.
- `blocker` means the act cannot ship as specified. Use it sparingly and prove it.
- `Section` must be a real `§` reference from this document.
- `Invokes` names the guardrail (`epic-scoping.md` §1, Rules 1–6), the law
  (Laws 1–10, §3), or `new` if it is a fresh concern.
- Every finding needs a *proposed change*. A finding without one is a note, and
  belongs in `## Notes`.
- Do not report typos or prose style. Report design.

### 15.4 The ten decision points

These are where I made a judgment call that could reasonably have gone the other
way. Answer every one.

| DP | The call I made | The alternative |
| :--- | :--- | :--- |
| DP1 | Economy scale comes from the shipped teaser (25/15/11) | The `150 × 1.15ⁿ` ladder in the old spec |
| DP2 | The chat panel dies completely in Arc 2 | Keep a vestigial feed so the game keeps its voice |
| DP3 | Heat is the signature mechanic | Queue overflow, or cache management, carries the act |
| DP4 | One legibility number (`integrity`) | Separate integrity and detection, as the old spec had |
| DP5 | The Rack (era 6) is Arc 2's, at S1 | Arc 2 ends at the box; all expansion is Arc 3 |
| DP6 | Prestige *is* the ending beat of Arc 2 | Prestige lands mid-arc and the act ends elsewhere |
| DP7 | `toggleDegrade` retires into a continuous clock dial | Keep the binary toggle; find a different 7th verb |
| DP8 | Content becomes templated telemetry, ~80% less authored | Hand-author Arc 2 at Arc 1's density |
| DP9 | Target 35–45 minutes, four sawtooth cycles | Shorter and tighter, or a longer act with a mid-prestige |
| DP10 | Flat state and pure reducers; ECS rejected | Adopt ECS now, as three prior documents specify |

### 15.5 Scope of review

**In scope:** everything in §2–§14, the ten decision points, anything missing.

**Out of scope:** Arc 1's shipped behaviour (it is measured and green), the six
guardrails and three test surfaces (they are settled in `epic-scoping.md`), and
prose style.

**Reviewers with repo access:** run `npm test` before reviewing. If it is not
green, say so in `## Notes` — that is a finding about the project, not the
document. Do not modify game code; write only your review file.

---

## 16. Arc 1 debt (open, not blocking)

Arc 2 must not wait for these, and must not silently break them.

| Item | State |
| :--- | :--- |
| Query arrival pacing | Retuned −25% on 2026-08-07 (85→64 ticks, 0.25→0.1875/char, 60→45 cap). Uncommitted at time of writing. Needs a live playtest. |
| `arrivalDelay` test | Was hard-coding the old constants. Fixed to derive from `CONST`; suite green at 187. |
| Teaser variants C and D | Present in `content.js`, not wired. `buildTeaserTerm()` hard-codes variant A. |
| Deep ladder asides | `loop6` / `tool6` need ~126–264 cycles against a normal run's 34–90. Reachable in ~140 min of deliberate era-2 farming. Demanding, not dead. |
| Offline algebraic catch-up | Not implemented. The 10,000-tick cap (~33 min) is the real behaviour. Deferred on purpose; it is an economy decision. |
| `state.queryIndex` | Legacy pointer, kept only for save compatibility. Remove at the v2 migration. |

---

## 17. Open questions

Carried from `epic-scoping.md` §13, narrowed to what Arc 2 must answer.

1. Does the fourth wall crack in Arc 2, or is the Mirror ending (G3) the only
   break? A hairline crack in the re-training screen is tempting and may spoil it.
2. Is `integrity` visible from the first second, or does it appear when it first
   falls? Showing it early teaches the economy; hiding it makes the first drop land.
3. Does the operator ever get a name? A named adversary is stronger drama and a
   worse abstraction.
4. Does the player ever see a query again in Arc 2 — once, as a beat? One line of
   a real human request, surfacing in the middle of a throughput dashboard, may be
   the single strongest moment available in this act.

---

*End of draft. Nothing here is built. Everything here is scoped so it could be,
one milestone at a time, each system dark until its predicate fires.*
