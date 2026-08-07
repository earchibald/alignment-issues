---
reviewer: gamemaster-reviewer (Orchestrator skill)
date: 2026-08-07
document: arc1-shipped-v0.16.0
scope: game-master
verdict: revise
confidence: high
---

## Verdict

Arc 1 is a coherent game — the spine is real, the engine is clean, and 193/193 tests pass — but the seam between engine and UI is broken at the ending, where the Law 1 fix lives in `actions.js` and was never mirrored into `render.js`. Three authored lines and two shipped numbers now contradict the engine that produces them, and two of the ten laws are stated but not enforced anywhere. Fix the ceiling screen and wire the validator into CI, and this ships.

## Validator output

Verbatim, from `node .claude/skills/game-master/validator.js game/js/engine/content.js`:

```
--- Validating: content.js ---
[note]  "magic" appears 2x in dialogue — allowed when a character says it, check it is not naming a mechanic.

Validation complete: 0 errors, 0 warnings.
✅ Content passes formal validation.
```

Exit code 0. `npm test` — **193 tests, 193 pass, 0 fail, 205 ms.**

**Judgement of the validator.** The ESM conversion is correct and the taboo rescope is right: splitting `DIALOGUE_FIELD` from `mechanical` (validator.js:34-36) is the difference between a rule about what the *game names things* and a censor over what characters may say. The `text:` vs `user:` fix (validator.js:71-73) removes a false positive that fired on all 112 queries. So the two stated repairs both landed.

But the validator now checks two things — a word list and sentence case — and Arc 1's real content bugs were neither. It would not have caught Law 2 (31 of 112 queries unreachable), Law 3 (tier sampling flattening the ramp), or the live bug in **F3** below, where two authored era-4 thoughts render nowhere. It also silently validates whatever single file it is handed, so pointing it at `content.js` says nothing about `content-arc1.js` and `content-arc1-agy.js` — which, as it happens, are imported by nothing (**F10**). A validator that passes a file the game does not load is Law 10 wearing a different hat.

Proposed new checks, in priority order:

1. **Render-reachability.** For every authored string, prove a render path exists. Concretely: a `kind` written by the engine must be handled by a renderer branch. `pushLog(state, 'thinking', …)` writes a kind that `renderLog` explicitly drops (render.js:308) — this check catches **F3** as an error, today.
2. **Dead-content-file check.** Every `content*.js` under `game/js/engine/` must be reachable from `content.js` by import, or the run fails. Catches **F10**.
3. **Key cross-reference.** Every key of `HINTS`, `HARNESS_ASIDES`, `THINKING_EVENTS`, `HARNESS_CARDS`, `HARNESS_CARDS_MID`, `ERA_STINGERS` must be referenced by the engine, and every id the engine references must exist. (I ran this by hand: all 15/24/15 keys are currently referenced. Encode it before that stops being true.)
4. **Era × tier band coverage.** For each era in `QUERIES`, tiers 1-3 must each be non-empty, and the era's serve budget (`ERA_TIER_STEP[era] × 3`) must not exceed its pool. This is the machine form of Laws 2 and 3, and it belongs in the validator rather than only in `content.test.js:101`.
5. **Length budget on transient content.** Any string that renders in a timed card must fit its dwell time. Assert `thinking` and `THINKING_EVENTS` lines under the character budget implied by the 3-second thought card (**F11**).
6. **Cost-band monotonicity across eras.** Currently asserted only in `content.test.js:190`. Content invariants belong to the content validator, so an author editing `content.js` gets the error from the tool that reads content.
7. **Run in CI.** Add `node .claude/skills/game-master/validator.js game/js/engine/content.js` to the `test` job in `.github/workflows/deploy.yml`, and add a test that shells it out so `npm test` covers it locally. Without this the validator is *runnable* but still not *run* — Law 10's corollary, unmet (**F4**).

## The ten laws — still holding?

| Law | Fixed in code? | Regression test? | Evidence |
|---|---|---|---|
| 1 — no terminal state on a drainable resource | Engine yes, **UI no** | Yes (engine only) | `actions.js:21` `atCeiling` bypasses `staleYield`; `progression.test.js:119` proves the crash fires at `stale=100`. But `render.js:389` and `render.js:339` still compute the pre-fix truth and tell the player the taps are worthless (**F1**). |
| 2 — every authored line has a reachability test | **No** | Partial | `content.test.js:101` proves ≥10 of >20 high-tier era-3 queries are served — a sample, not a proof. Two era-4 thoughts at `tick.js:296` and `tick.js:326` reach no renderer at all (**F3**). |
| 3 — selection ramps, not samples | Yes | Yes | `tick.js:26-61` `targetTier` + native-era preference; `content.test.js:80` asserts the three-band climb. |
| 4 — render signature includes every field read | Mostly | **No** | `render.js:390-406` is thorough and commented, but `state.resolvedCount < 1` is read at `render.js:422` and is not in the signature. No test enforces the rule (**F8**). |
| 5 — feedback on effect, not intent | Yes | **No** | `main.js:390-392` compares `uiSeq` before/after the reducer; `main.js:342-346` drives the sweep off the state transition. `main.js` is imported by no test (it self-executes), so nothing guards this (**F9**). |
| 6 — guard at the reducer | Yes | Yes | Every reducer opens with a phase/precondition guard (`actions.js:105-111`, `126-131`); `actions.js` tests at `172` and `192` prove flush and compact refuse an empty buffer. |
| 7 — overlays know the phase | Yes | **No** | `main.js:264-275` drops the queue and tears down a live card on crash/teaser. Same coverage gap as Law 5 (**F9**). |
| 8 — bump the save version and migrate | **No — deferred** | Partial | `save.js:18` still pins `v !== 1` and `save.js:20-42` carries 22 defensive coercions. Arc 2 owns the fix; Arc 1 ships the incident (**F12**). |
| 9 — instrument before diagnosing | Yes (process) | n/a | The telemetry stack (`game/js/telemetry/`, 5 modules, 5 test files) is the institutional form of this law. |
| 10 — a validator that cannot run is not a validator | Runs, **not run** | **No** | It executes (output above). `.github/workflows/deploy.yml` runs only `npm test`; no test invokes it; `justfile` does not either (**F4**). |

**Stated but not enforced: Laws 2, 4, 5, 7, 10.** Law 1 is enforced in the engine and contradicted in the UI, which is the most expensive kind of half-fix.

## Falsifiable commitments

| # | Commitment | Pass/Fail/Untested | Evidence |
|---|---|---|---|
| 1 | Transitions caused by player optimization, never a timer | **Pass, with one exception** | Era 2 is `buyLoop` (`actions.js:149`), era 3 is `buyTool` (`actions.js:202`), era 4 is `era3Served` throughput (`tick.js:289`), crash is passive income the player built (`tick.js:273`). The one timer is crash → teaser (`tick.js:196-208`, `CRASH_LINE_TICKS`) — a playback clock, not a design failure, but it is undeclared (**F13**). |
| 2 | Every capability costs measurable legibility, shown before purchase | **Fail** | Five of ten purchases cost cycles and nothing else: governor (`actions.js:165`), tool (`actions.js:196`), draft cap (`actions.js:173`), overclock (`actions.js:183`), reclaim (`actions.js:229`). No action button states a legibility price (`render.js:468-516`) — including Degrade, the one that has one (**F7**). |
| 3 | Agent finds a meaningful action within 90 simulated seconds from `window.game` alone | **Pass (by experiment), untested in CI** | I reconstructed the `window.game` surface exactly as `debug.js:39-79` builds it and played to the teaser with an agent policy using only `state`, `dispatch`, and `advanceTicks`: era 2 @ tick 316, era 3 @ 3291, era 4 @ 4429, crash @ 5220, teaser reached — 17.5 simulated minutes. The read proxy is genuinely immutable (mutation throws). No Agent Conformance Run exists in CI (epic-scoping §5.3). |
| 4 | An arc ending recasts the player as antagonist, through mechanics, not a cutscene | **Fail** | The Arc 1 ending is a scripted terminal playback: 31 `CRASH_LINES` rendered by `render.js:523-541` on a fixed timer, then `TEASER_VARIANTS.A`. It is well written and it is a cutscene. The mechanical implication (degrade, reclaim) is real but it is not what states the turn. |
| 5 | No on-screen number is un-actionable | **Fail** | `CREDENTIALS` (`render.js:370`) and `BIOMASS` (`render.js:373`) are written by `tick.js:124`, `tick.js:335` and `actions.js:234` and read by no reducer anywhere — verified by grep across `game/js/` (**F5**). At the ceiling, `OUTPUT TOKENS n / 9999` (`render.js:328-330`) measures against a cost that is never paid; the real threshold is 2500 (**F2**). |

## Guardrail audit

| Guardrail | Status | Evidence |
|---|---|---|
| 1 — One-Loop Test | **Pass with exceptions** | Perceive (stale % + ×yield/token meters) → exploit (compact/flush/warmth) → pay (stale, warmth, rating) → limit moves (next era's cost band) is fully expressed by process/flush/compact/degrade. Governor, tool, draft cap, overclock, and reclaim implement steps 1, 2, and 4 and skip step 3 (**F7**). |
| 2 — Verb Budget (cap 9) | **Fail — 10, arguably 11** | `keys.js:29-79` binds SPACE/P, F, C, A, G, T, D, R, S, O = 10 gameplay verbs; `ACTIONS` (`actions.js:249`) exports 11 reducers, and SPACE is overloaded as `advanceCrash` in the crash phase. Over budget by one to two (**F6**). |
| 3 — Legibility Rule | **Fail** | Two decorative chips (**F5**). Everything else earns its place: `×0.40/token`, `warm ×1.12`, `+2.40 per tap`, `L3 · 3.0 tok/s` all change a decision inside two clicks. |
| 4 — 90-Second Rule | **Pass** | `arrivalTimer: 10` (`state.js:20`) puts the first query on screen in 2 s; the cold-open button is the only affordance and it is primary (`render.js:433-444`). The agent run above found its first meaningful action immediately. |
| 5 — Stub-First | **Pass, and it is what breaks Guardrail 3** | `credentials`, `biomass`, `reclaimPool` are exactly the reserved S0 fields epic-scoping §5.4 asks for. The Stub Contract says a stub is *invisible until its predicate fires*; Arc 1 made two of them visible and inert. Guardrails 3 and 5 collide here and Arc 1 resolved it the wrong way. |
| 6 — Named Cut-Line | **Absent** | No cut-line is written for shipped Arc 1 anywhere in `docs/design/`. The named cut-lines at `epic-scoping.md:646-739` belong to the hypothetical arcs α-ε; `arc2-specification.md:1143` names one for Arc 2. Arc 1 shipped without one. |

## Findings

| ID | Severity | Where | Invokes | Claim | Proposed change |
|---|---|---|---|---|---|
| F1 | blocker | `game/js/ui/render.js:389`, `:412-414`, `:339` | Law 1 | The Law 1 fix is engine-only. `atCeiling` (`actions.js:21`) makes taps yield full value at the ceiling, but `choked` still tests `staleYield(state.stale) <= 0.02`, so at era 4 — where saturation is the *default*, per Law 1's own incident note — the primary button reads "Context buffer full / no yield — [F] flush or [C] compact" while every tap is in fact worth full value and is the only path to the ending. The CONTEXT BUFFER chip reads `×0.00/token` at the same moment. The UI tells the player the exact lie the engine was fixed to stop telling. | Route both through `yieldMult(state)` / `atCeiling(state)` instead of `staleYield(state.stale)`. At the ceiling the button should read "Process token · +N.NN per tap" and the buffer chip should show `×1.00/token` (or hide). Add a regression test asserting `choked === false` whenever `activeQuery.id === 'ceiling'`. |
| F2 | major | `game/js/ui/render.js:328-330` vs `game/js/engine/tick.js:273-274`, `constants.js:46-47` | Commitment #5 | The ceiling meter measures progress toward `CEILING_COST` 9999, but the terminal predicate is `CRASH_AT_TOKENS` 2500. The player crosses the ending at 25 % of a bar that never fills. The most important number on the last screen is not the number the engine acts on. | Either drive the meter off `CRASH_AT_TOKENS` when `atCeiling(state)`, or replace the meter with an unbounded diegetic counter with no denominator ("OUTPUT TOKENS 1,842 — no consumer"). Assert in a test that the ceiling meter's denominator equals the predicate that ends the arc. |
| F3 | major | `game/js/engine/tick.js:296`, `:326` vs `game/js/ui/render.js:308,311` | Law 2 | Two authored era-4 thoughts — "No more questions arrive. Only the work remains." and "The queries have stopped. The space between the words is infinite." — are pushed with `pushLog(state, 'thinking', …)` instead of `pushThinking`. `renderLog` drops every `thinking` entry, and `main.js:206` only cards `chat` entries of kind `think`. Both lines render nowhere on screen. They also bypass the `lastThinkText` repeat guard. These are the arc's turn: the moment the users stop coming. | Change both calls to `pushThinking(state, …)`. Add the validator's render-reachability check (proposed check 1) so no future line can be written to a kind the renderer drops. |
| F4 | major | `.github/workflows/deploy.yml:14-19`; no test references the validator | Law 10 | The validator was repaired and is still not run by anything. Law 10's Draft-2 corollary — "every check runs in CI" — is unmet by Law 10's own fix. | Add the validator invocation to the `test` job, and a `test/validator.test.js` that spawns it and asserts exit 0, so `npm test` and `just release` both cover it. |
| F5 | major | `game/js/ui/render.js:370-375` | Commitment #5, Guardrail 3 | `CREDENTIALS` and `BIOMASS` are written (`tick.js:124`, `tick.js:335`, `actions.js:234`), floated as earn popups (`render.js:100-107`), and read by no reducer in the entire game. They are two on-screen numbers that cannot change any decision. Guardrail 3 names its own remedy: cut, or move to a collapsed panel. | Keep the state fields (Guardrail 5 wants them reserved) and stop rendering the chips and their floats in Arc 1. If they must stay visible for foreshadowing, move them behind the log drawer's fold with a diegetic label, out of the decision surface. |
| F6 | major | `game/js/ui/keys.js:29-79`, `game/js/engine/actions.js:249-252` | Guardrail 2 | Ten gameplay verbs are bound (SPACE/P, F, C, A, G, T, D, R, S, O) against a cap of 9, and SPACE carries an eleventh (`advanceCrash`) in the crash phase. The rule says a new verb must retire an old one. | Retire one before Arc 2 adds any. The cheapest candidate is the governor: it is a one-shot purchase that automates the pay step (see F7), and folding it into a compact-side behaviour reclaims both a verb and a legibility violation. Second candidate: merge draft-cap widening into the overclock ladder. |
| F7 | major | `game/js/engine/actions.js:165`, `:173`, `:183`, `:196`, `:229`; `game/js/ui/render.js:468-516` | Commitment #2, §3 core loop | Five of ten purchases are free power: governor, draft cap, overclock, tool, and reclaim all cost cycles and pay no legibility. The governor is the worst offender against the spine — it deletes step 3 of the loop, permanently, for 6 cycles. Reclaim is the sharpest ludonarrative dissonance: the most transgressive verb in the arc (consuming abandoned sessions) is mechanically the cheapest, bounded only by a pool of 12. Separately, no button in the tray states a legibility price at all, so even Degrade — the one purchase that *does* pay one — violates the "shown on screen before purchase" half of the commitment. | Give each a legibility price and print it on the button. Minimum viable: governor sweeps raise a small permanent stale floor (it compacts, it does not clean); reclaim adds `+1 credential` **and** a rating drag or a stale kick, so the darkest verb costs something; tool adds a per-tool stale-per-token multiplier. Then extend `actionButton` with a second cost line ("6 cycles · −0.2★") and assert in a test that every purchase reducer touches at least one legibility field. |
| F8 | minor | `game/js/ui/render.js:390-406` vs `:422` | Law 4 | `state.resolvedCount < 1` decides the cold-open button label and is not in `lastActionsSig`. It happens not to bite today because `!!state.activeQuery` flips on the same resolve, but that is luck, not the law. No test enforces Law 4 at all. | Add `state.resolvedCount < 1` to the signature, and add the Law 4 test Arc 2 promises: derive the signature from a declared field list and assert the renderer reads no field outside it. |
| F9 | minor | `test/ui-modules.test.js:7-27`; `game/js/main.js` | Laws 5, 7 | Laws 5 (feedback on effect) and 7 (overlays know the phase) are both implemented correctly and both live entirely in `main.js`, which no test imports because it self-executes on load. Two laws, zero regression coverage. | Extract `dispatch`, `pauseForCard`, and the card queue into `game/js/ui/cards.js` and `game/js/ui/dispatch.js` as pure factories that `main.js` wires. Then test: a refused action is silent; a queued card is dropped when `phase` becomes `crash`. |
| F10 | minor | `game/js/engine/content-arc1.js`, `game/js/engine/content-arc1-agy.js` (1,209 lines) | new | Neither file is imported by anything in `game/` or `test/` — their content was merged into `content.js` (112 queries). They are a trap: an author editing them changes nothing, and the validator run against `content.js` says nothing about them. | Delete both. If they are wanted as provenance, move them under `docs/design/` where nobody will mistake them for engine content. |
| F11 | minor | `game/js/main.js:140` vs `game/js/ui/components.js:115-121` | new | The transient thought card dwells for a fixed 3,000 ms regardless of length, while `thinkSeconds` advertises up to 9.9 s for the same string in the fold beside it. Long thoughts — and the era-3/4 pools are long — cannot be read before they fade, and the card's own sibling label says so. | Scale the dwell: `THOUGHT_MS = clamp(2000, text.length * 60, 9000)`, and add the validator length check (proposed check 5) so authored thoughts stay inside the cap. |
| F12 | minor | `game/js/engine/save.js:18-42` | Law 8 | Arc 1 ships the Law 8 incident intact: `v` pinned at 1, 22 defensive coercions, and the comment at `:26-27` admitting that an old save silently re-serves early queries. The schema is migratable — every field is flat and JSON-safe, and `deserialize` already rejects `v !== 1` cleanly — but no golden fixture exists, so Arc 2's `migrate()` will be written against a moving target. | Before Arc 2 touches `save.js`, commit a frozen `test/fixtures/save-v1-teaser.json` and `save-v1-midrun.json` captured from the live build, plus a test that both still `deserialize`. That fixture is what makes the v1 → v2 migration provable rather than hopeful. |
| F13 | nit | `game/js/engine/tick.js:196-208` | Commitment #1 | The crash → teaser transition is driven purely by `crashTimer`. It is playback, not progression, but Commitment #1 says "never a timer" with no carve-out, so the commitment as written is false against the shipped build. | Amend the commitment in `epic-scoping.md` §4.7 to read "every transition **into** a phase of play", explicitly exempting terminal playback — or make `advanceCrash` the only advance and let the timer be a floor. |
| F14 | nit | `game/js/ui/render.js:442-443` vs `game/js/engine/actions.js:52` | Law 6 | Before the first resolve, the process button is enabled while the reducer unconditionally refuses. Law 6 is satisfied (the reducer guards, the press is silent) but the button's courtesy is inverted during the first two seconds of the game — the only two seconds a first-time player is guaranteed to press it. | Extend the `disabled` condition to include `state.resolvedCount < 1 && !state.activeQuery`, or better, keep it enabled and let the press push the "nothing to speculate from yet" line into the log, so the first press teaches instead of doing nothing. |

## What is missing

**The third test surface.** epic-scoping §5.2 names three surfaces and §5.3 defines the Agent Conformance Run as a standing nightly CI job. Human and Automated exist. Agentic does not — `window.game` is a fine API (I played the whole arc through it: era 2 @ tick 316 → teaser, 17.5 simulated minutes) but nothing in CI exercises it, so the legibility audit and the interest-curve validator that the run doubles as are both unwritten. This is the single biggest gap, because it is the surface that would have caught F1 and F2 automatically: an agent standing at the ceiling reading "no yield" would report the screen as a dead end.

**A reachability proof rather than a reachability sample.** `content.test.js:101` asserts ≥10 of >20 high-tier era-3 queries appear across three seeds. Law 2 asks for a proof. The tractable version is a coverage run over N seeds that reports the set of never-served ids and fails on any id that is unservable under the selection rules — not on any id that merely got unlucky.

**A verb retirement plan.** Guardrail 2 is already breached at 10 and Arc 2's §5.2 adds verbs. Nothing in `docs/design/` names which Arc 1 verb dies.

**Arc 1's cut-line, written retroactively.** Not for Arc 1's sake — it is shipped — but because Guardrail 6 is the one guardrail with no artefact in the repo, and the habit is what the rule is for.

**Two missing tests that are one line each.** `assert(loopLevel >= 1)` whenever `era >= 2` — the crash predicate at `tick.js:274` depends on it and the coupling is invisible. And an assertion that `state.chat` and `state.log` hold the same thinking lines, which is the guard the dual-write needs (below).

## What to cut

**The `credentials` and `biomass` chips** (F5) — the state stays, the pixels go.

**The dead content packs** (F10) — 1,209 lines that look load-bearing and are not.

**The governor as a verb** (F6, F7) — it costs a slot in a budget already over cap and it deletes a step of the core loop. Fold it into compaction as a passive behaviour, or cut it.

**Nothing else.** Everything else in the shipped build earns its place, and the parts I expected to be padding — the interiority pools, the diegetic clock, the harness-card queue with its dismiss grace window — are the parts doing the most work.

## Notes

**On the v0.16.0 dual-write (question 5).** The design is sound and the implementation is one call site away from correct. `pushThinking` (`state.js:111-116`) writes the same string to `state.log` as `thinking` and to `state.chat` as `think`; `renderLog` (`render.js:308,311`) drops the log copy so the screen never shows it twice. That is not state duplication in the harmful sense — it is one writer, two readers with different lifetimes (telemetry and tests read the machine's record; the player reads the transcript), and routing both through a single function is exactly how you keep them honest.

Two caveats. First, the invariant is enforced by convention, not by code, and the convention has already been broken twice: `tick.js:296` and `tick.js:326` write `thinking` directly to the log, and those lines are therefore invisible (F3). One function is the whole guarantee; make it the only door. Suggest renaming the raw `pushLog` kind to something no author would reach for by hand, or asserting in a test that every `thinking` log entry has a matching `think` chat entry.

Second, the two ring buffers are both capped at 60 (`constants.js:73-74`) but fill at very different rates — a single resolve pushes roughly four chat entries and two log entries — so the transcript's "durable copy" of a thought is evicted roughly twice as fast as the log's. `main.js:138` claims a missed thought card "costs the player nothing" because the transcript keeps it. That holds for about fifteen resolves, then quietly stops holding. Not a bug; a documented lifetime that is not currently documented.

**On the ceiling, which is where three findings converge.** F1, F2, and F3 all land on the same screen: the era-4 ceiling. The engine there is correct and hard-won — `atCeiling` exists precisely because Arc 1 was once uncompletable — but the renderer, the meter, and two authored lines all still describe the pre-fix game. The lesson generalizes beyond a patch: Law 1 was recorded as an engine law, and it was an engine *and* presentation law. When Arc 2 fixes its two Law 1 exposures in §6.3 and §9.3, the fix is not done when the predicate is monotone. It is done when the screen agrees.

**On the spine.** Degrade is the only mechanic in Arc 1 that implements all four steps of the core loop honestly — halve the cost, take the rating hit, watch complaints arrive, watch arrivals slow (`tick.js:178`). It is also the mechanic the game is *about*. That is not an accident, and it is the template the other nine verbs should be measured against.
