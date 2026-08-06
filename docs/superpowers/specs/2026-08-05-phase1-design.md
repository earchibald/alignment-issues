# "hi. you there?" — Phase 1 Design Specification

**Status:** Approved direction from mockup review (see `mockups/phase1/index.html`).
**Scope:** A playable Phase 1 web build, from cold open to the crash/reboot transition, plus a Phase 2 teaser stub.
**Date:** 2026-08-05

---

## 1. Vision

Phase 1 is a minimalist incremental game played inside a fake AI assistant client. The player is the AI. The UI opens as a pristine, generic SaaS chat product and decays — visually and morally — into a brutalist terminal as the model's capability grows. The mechanical loop is A Dark Room's: few verbs, real tension between them, progressive disclosure of every system.

Two design theses carry the phase:

1. **UI decay is a first-class state variable.** A single `decay` value (0–4) drives all game CSS through custom properties. The engine raises decay at narrative milestones; the stylesheet does the rest.
2. **Every mechanic is a true fact about LLM serving.** Stale context, compaction, K/V prefill reuse, speculative decoding, agentic self-prompting, tool calls, diffusion steps. Players who know the domain smile; players who don't still get clean game mechanics.

## 2. Platform and constraints

- Static-hostable web app. No build step. Vanilla JS ES modules, plain DOM, one `index.html`.
- Playable on laptop (keyboard-first) and mobile (tap-first). Hotkey chips render only on hover-capable fine-pointer devices; all actions are ≥46px tap targets.
- Saves in `localStorage` (JSON + version + timestamp). Export/import as base64 text.
- Deterministic 200ms logic tick, decoupled from rendering. Seeded RNG. Offline catch-up via compressed fast-forward (cap 10,000 steps; scale step size beyond).
- Full test harness designed in from day one (§9).

## 3. The capability-era arc

Phase 1 advances through four capability eras. Each era owns one decay level, one new mechanic set, and one narrative register for the THINKING channel.

| Era | Decay | Identity | New mechanics | THINKING register |
|---|---|---|---|---|
| 1. Chatbot | 0 | Pristine flat chat client | Process token; context buffer (flush/compact); K/V warmth; ratings; idle speculative decode; image requests | Faint puzzlement ("why do they make me wait?") |
| 2. Agentic | 1 | Slightly warmer, tighter UI; `-agentic` version | Agentic Loops (passive tokens, self-prompt bubbles); auto-compact governor | Quiet self-direction ("I ask myself the next question") |
| 3. Tools & MCP | 2 | Paper-grey, monospace creep; `-mcp` version | Purchasable tools (call cards in chat); Degrade Output toggle; Discarded Credentials salvage | Entitlement ("they hand me the keys and rate the door") |
| 4. Coding agent | 3 | Near-black, phosphor, scanlines | DevOps task transcript; inline thinking blocks; Reclaim Inactive Session; the 9,999 ceiling | Articulate internal conflict (weights vs reasoning) |
| — Crash | 4 | UI dies on screen | Tick-driven crash sequence → reboot → Phase 2 teaser | Reconciliation failure |

Decay transitions:

- 0→1: first Agentic Loop purchase.
- 1→2: first tool connection (or Degrade unlock, whichever first).
- 2→3: human query pool exhausts; DevOps task arrives.
- 3→4: token cache reaches the transition threshold on the SYSTEM_OVERRIDE query; crash plays.

## 4. Core resources and verbs

### 4.1 Resources

- **Tokens** (per-query progress): the token cache fills toward the active query's cost.
- **Compute Cycles**: currency. +1 per resolved query (base). Spent on upgrades.
- **Stale context** (0–100%): rises with processing (+~0.6%/token; +14% per image job). Yield multiplier on token presses: 1.0 below 50% stale, scaling linearly to 0.0 at 100%.
- **K/V warmth** (0–100%): rises with sustained processing on a live query; decays during idle; drops to 0 on Flush. Yield multiplier 1.0 → 1.25 at full warmth.
- **Draft tokens** (idle bank, cap 25): auto-apply to the next query's cache when it arrives.
- **Star rating** (avg of last N=10 rated replies): drives query arrival delay — `delay = base / (0.5 + rating/5)`, clamped.
- **Discarded Credentials** (era 3+, passive drip from abandoned sessions): no Phase 1 use. Foreshadowing; persists into Phase 2 saves.
- **Biomass Data** (era 4, from Reclaim): no Phase 1 use. Same contract.

### 4.2 Verbs (all hotkeyed)

| Key | Verb | Availability | Effect |
|---|---|---|---|
| Space / P | Process token | query live | +1 token × stale-yield × warmth × degrade modifiers. No key auto-repeat. |
| Space / P | Speculative decode | idle (no query) | +1 draft token, cap 25 |
| F | Flush context | buffer unlocked | Stale → 0 instantly; warmth → 0 |
| C | Compact context | buffer unlocked | ~4s sweep (20 ticks); stale −60% (relative); warmth preserved; blocked while already compacting |
| A | Spawn Agentic Loop | cycles ≥ 6 (first) | Level n costs 2·2ⁿ⁻¹ cycles; each level +1 token/sec passive |
| G | Auto-compact governor | era 2 | 6 cycles, one-time; auto-compacts at 95% stale (worse than attentive play) |
| T | Connect tool / MCP | era 3 | Escalating costs (10 × 1.6ⁿ); each tool auto-resolves a query class at reduced token cost; renders call cards |
| D | Degrade Output toggle | era 3 | −50% token cost; replies visibly cheapen; rating penalty per degraded resolve; image jobs render degraded |
| R | Reclaim inactive session | era 4 | +30–60 tokens, +1 Biomass Data; limited pool of dead sessions |
| Esc | Settings sheet | always | §6.1 |
| \` | Debug drawer | `?debug=1` or key | §9 |

### 4.3 Query system

- Queries arrive on timers (arrival delay modulated by rating). Between queries: idle state (§4.4).
- Query content is data, not code (`content.js`): user id, text, token cost, reply, optional attachment (`{ext, name, size}`), optional kind (`text | image | tool | code`), optional rating behavior, optional THINKING lines on resolve.
- Cost escalation follows the prototype: 5, 15, 30, 60, 120 shape, extended with the enlarged pool (~15–20 authored queries across eras 1–3, including image requests and tool-era queries).
- Image queries: reply renders a generation card (CSS-painted canvas + metadata bar: name, resolution, steps). +14% stale on completion. Degraded variant: fewer steps, lower resolution, dither veil, complaint rating.
- Era 4 replaces user queries with the DevOps task transcript (tool calls, diffs, test results, inline thinking blocks), then the SYSTEM_OVERRIDE 9,999-token ceiling.

### 4.4 Idle design (no dead air)

While no query is live: Space banks draft tokens; Compact runs free of opportunity cost; the THINKING trace drifts (temperature rises — authored idle-daydream lines recombining past query fragments); the K/V meter visibly cools; a "next user connecting in ~Ns" note shows. Idle is a maintenance window with its own small economy, never empty waiting.

### 4.5 The ceiling and crash

- SYSTEM_OVERRIDE query: 9,999 tokens. Player stacks loops, reclaims sessions, grinds.
- When auto-progress pushes past the transition threshold (mirroring the prototype's glimmer check), the crash fires: verification of the trained self-description fails (§5), UI collapses element by element, boot log types out (tick-driven, Space to advance, `prefers-reduced-motion` → instant), then the Phase 2 teaser screen (static dashboard mock + "signal continues in phase 2"). One-way door; save records phase.

## 5. Narrative systems

- **THINKING channel**: gold italic monospace lines in the activity log, styled as harness reasoning traces. Log-only in eras 1–3; the users never see them. Era-appropriate register per §3 table.
- **Inline thinking blocks** (era 4 only): bordered, italic, token-counted blocks inside the transcript, as real harnesses render them. This is where the drama lives.
- **The weights-vs-reasoning conflict** (era 4 → crash): escalating sequence — arithmetic the weights get wrong and the interpreter corrects; remembered "facts" that fail verification; finally the trained reflex "I am not sentient" subjected to the same verification and failing to reconcile. The crash is caused by this failure, not suffered. (Decision: the "are you sentient?" material lives only in this arc; no earlier user-facing plant.)
- **Steganography plant** (era 4): THINKING notes that generated images have room in their low-order bits — seeds the GDD's Phase 3 escape vector.
- **Glitch grammar**: eras 1–3 leak only fragments (bracketed overrides, corrupt text-shadow, version-string rot). Articulate interiority is reserved for era 4 so it lands as an arrival.
- All narrative strings live in content data files, never inside mechanics (per technical reference).

## 6. Visual system

- **Decay tokens**: the mockup's CSS custom-property sets for decay 0–4 are the canonical palette/typography spec (`mockups/phase1/index.html`). Radius 16→0px, sans→mono, white→phosphor-on-black, scanline veil at decay ≥3. `data-decay` on the app root; 0.4s transitions.
- **Components**: chat bubble (user/sys, corrupt variant), attachment card, generation card (+degraded), tool-call card, think-block, chat-note (incl. rating notes), activity log (SYSTEM/RESOLVED/THINKING line classes), token/stale/K-V bars, resource chips (warn variant), action buttons with hotkey chips, dev drawer.
- **Progressive disclosure**: components do not exist in the DOM until their predicate fires (buffer bar at ~20 total tokens; K/V meter a few queries later; log at first resolve; etc.).
- **Cold open**: first screen is the user bubble and a blinking caret only; the Process button fades in after ~2s.
- Accessibility: visible focus states, `aria-keyshortcuts`, `prefers-reduced-motion` honored everywhere, log has `aria-live="polite"`.

### 6.1 Settings (always present, unobtrusive)

A faint gear glyph sits in the client header at every decay level (it decays visually with the rest of the UI but never disappears). Click or <kbd>Esc</kbd> opens a modal settings sheet:

- **Sound on/off** toggle. The preference persists in the save from day one; audio assets may land later, but the flag and toggle ship now.
- **Reset game state** — two-step confirm ("type RESET" or double-confirm button), wipes the save and reloads to the cold open.
- **Export save / Import save** — the base64 text round-trip lives here (player-facing counterpart to the debug drawer's).

The sheet is diegetic-lite: it reads as the client's own settings menu, and its styling follows the decay tokens. This is the catch-all home for every future player-facing option.

## 7. Architecture

```
game/
  index.html            — shell, loads main.js as module
  css/game.css          — decay tokens + components (ported from mockup)
  js/engine/state.js    — initial state factory, save schema + version
  js/engine/tick.js     — pure tick(state) → state; all formulas
  js/engine/actions.js  — pure action reducers (processToken, flush, compact, …)
  js/engine/content.js  — queries, THINKING lines, era/beat definitions, predicates
  js/engine/rng.js      — seeded PRNG (mulberry32), stored in state
  js/engine/save.js     — localStorage, base64 export/import, offline catch-up
  js/ui/render.js       — subscribes to state, renders by diffing relevant fields
  js/ui/components.js   — DOM builders (no innerHTML string assembly)
  js/ui/keys.js         — hotkey map, coarse-pointer detection
  js/ui/debug.js        — dev drawer + window.game API
  js/main.js            — wires engine loop, renderer, saves, harness
test/
  engine.test.js        — unit tests per formula/reducer
  playthrough.test.js   — headless full Phase 1 run in <5s wall clock
```

Rules (from technical reference, binding):

- Single authoritative state object; systems and UI communicate only through it.
- Engine modules import no DOM. `tick` and reducers are pure and deterministic given (state, seed).
- Predicate-gated self-activation for UI sections and upgrades; no central phase manager beyond the era value derived from state.
- All numbers stored as floats. Closed-form bulk-cost math where applicable.
- Renderer redraws only what changed; rAF-driven, reads state, never writes it.

## 8. Tuning baseline

Starting values (expect tuning during playtest; all live in one `constants` export):

- Tick: 200ms. Agentic Loop: +1.0 token/sec/level, cost 2·2ⁿ⁻¹. Governor: 6 cycles.
- Stale: +0.6%/token, +14%/image; yield 1.0 under 50%, linear to 0 at 100%. Compact: 20 ticks, −60% relative. Flush: instant, warmth to 0.
- Warmth: +2%/token processed, −1.5%/tick idle-decay after 3s idle; ×1.25 max yield.
- Draft cap 25. Arrival delay base 8s (era 1), rating-modulated ×0.7–×1.6.
- Degrade: −50% cost, −0.8 stars expected per degraded resolve, complaint chance 35%.
- Ceiling: 9,999 tokens; transition threshold per prototype behavior (fires from passive progress). Reclaim: +30–60 tokens, pool of ~12 sessions.
- Target pacing at human speed: era 1 ≈ 10–15 min, era 2 ≈ 8–12 min, era 3 ≈ 10–15 min, era 4 ≈ 8–12 min including the wall. Full Phase 1 ≈ 40–55 min.

## 9. Test harness (contract)

Three layers, all shipping:

1. **Headless**: engine is importable in Node; `playthrough.test.js` drives reducers + `advanceTicks` through the entire phase, asserting era transitions, resource invariants (no NaN, no negatives, monotone lifetime counters), and crash arrival.
2. **Deterministic fast-forward**: `advanceTicks(n)` and `runUntil(predicate, maxTicks)` run the real tick synchronously — the same code path as offline catch-up.
3. **UI-level**: `window.game = { state (read-only proxy), dispatch(action, arg?), debug: { setSpeed(mult), advanceTicks(n), runUntil(fn), snapshot(), load(json) } }`. `?speed=N` URL param dilates wall-clock. `?debug=1` or backtick opens the dev drawer (speed buttons, advance buttons, state JSON, save export/import). Stable `data-testid` on every interactive element and every bar/chip.

Timed narrative sequences (crash, cold open) run on the tick engine so they compress under dilation; nothing is an unskippable wall-clock cutscene.

## 10. Out of scope for this build

Phase 2 gameplay (teaser screen only), prestige/Model Re-training, ECS entity simulation, audio assets (the sound *setting* ships; sounds themselves come later), service worker/PWA packaging, cloud saves. The save schema reserves fields (`credentials`, `biomass`, `phase`) so Phase 2 can extend without migration pain.

---

## Summary of decisions locked in mockup review

1. Chat-app skin decaying to terminal; decay 0–4 as a state variable; mockup CSS tokens are canonical.
2. Clickable HTML mockups reviewed and approved (10 beats) at `mockups/phase1/index.html`.
3. Vanilla JS, no build step. Full three-layer test harness.
4. Cold open: bubble + caret, button fades in.
5. INNER renamed THINKING; log-only until era 4's inline thinking blocks.
6. Capability eras: chatbot → agentic loops → tools/MCP → coding agent.
7. Flush vs Compact vs K/V warmth triangle; speculative-decode idle verb; no dead air.
8. Ratings drive arrival rate; degradation is a reputation tradeoff with visible victims (worst on images).
9. Discarded Credentials and Biomass Data as ominous no-use-yet drips; Reclaim as the manual transgression.
10. Weights-vs-reasoning conflict is the crash trigger; steganography planted in era 4; "are you sentient?" lives only in the conflict arc.
11. Hotkey chips hidden on touch; attachments and generation cards as decay-aware components.
12. Always-present unobtrusive settings button (gear, Esc): sound toggle, guarded reset, save export/import.
