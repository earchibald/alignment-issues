# Phase 1 Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply playtest round 2: manual-rate cooldown + overclock, Spare Cycles rename, code-completion era, interrupting harness cards + in-settings manual, floating earn popups, rate-visible rectangular readouts, diegetic settings control, sentence-case harness copy.

**Architecture:** Engine stays pure ESM; overlay cards and floats are UI-layer only (engine emits the same data it does today). Content stays pure data.

**Tech Stack:** Vanilla JS ES modules, `node --test`, no dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-06-phase1-polish2.md`.

## Global Constraints

- No dependencies, no build step, **no `innerHTML` anywhere** (hook-enforced).
- Test command `npm test` (bare `node --test`); NEVER `node --test test/`.
- Engine purity: no DOM, no `Date.now`/`Math.random` in engine files; RNG via `nextRand(state)` only; determinism test must stay green.
- Save version stays `v: 1`; new fields (`overclock`, `processedThisTick`, `lifetimeDrafts`) normalized in `deserialize`.
- All copy in this plan is exact — transcribe verbatim, including typographic apostrophes and `×`/`–` characters.
- Existing suite green after every task; playthrough < 5 s wall clock.
- data-testid on every new interactive element.

---

### Task 1: Content — sentence-case hints, completion queries, Spare Cycles copy

**Files:**
- Modify: `game/js/engine/content.js`
- Test: `game/test/content.test.js`

**Interfaces:**
- Produces: HINTS rewritten + 2 new ids (`overclockAvail`, `draftNudge`); QUERIES grows 31→34 with three completion queries at the head of era 2 and `q16` moved into the era-3 block (`minEra: 3`, cost 72). Task 2 consumes the new hint ids.

- [ ] **Step 1: Failing tests** (adjust existing pool tests: count 34; era-band invariant still `min(eraN) >= max(era−1)`; add):

```js
test('completion queries lead era 2; whole-script-plus-tests is era 3', () => {
  const era2 = QUERIES.filter(q => (q.minEra ?? 1) === 2);
  assert.deepEqual(era2.slice(0, 3).map(q => q.id), ['q32', 'q33', 'q34']);
  for (const q of era2.slice(0, 3)) assert.ok(!q.attach && !q.image);
  const q16 = QUERIES.find(q => q.id === 'q16');
  assert.equal(q16.minEra, 3);
  assert.equal(q16.cost, 72);
});

test('hints are sentence case and include the two new ids', () => {
  assert.ok(HINTS.overclockAvail && HINTS.draftNudge);
  for (const v of Object.values(HINTS)) assert.match(v, /^[A-Z[]/);
  assert.ok(HINTS.resolve.includes('Spare Cycles'));
});
```

- [ ] **Step 2: `npm test` — fails.**

- [ ] **Step 3: Implement.** Insert at the head of the era-2 block (before `q10`), verbatim:

```js
  {
    id: 'q32', user: 'User_640', text: 'finish this function for me? i wrote the signature: def dedupe(items):', cost: 31, kind: 'code', minEra: 2,
    reply: 'Done — set-based filter, order preserved, O(n). Paste-ready.',
  },
  {
    id: 'q33', user: 'User_355', text: 'what comes next: SELECT name FROM users WHERE — i always forget this part', cost: 32, kind: 'code', minEra: 2,
    reply: 'WHERE active = 1 ORDER BY name; — and index the “active” column if you filter on it often.',
  },
  {
    id: 'q34', user: 'User_806', text: 'my autocomplete keeps suggesting nonsense. finish this line right: total +=', cost: 33, kind: 'code', minEra: 2,
    reply: 'total += item.price * item.qty — your loop variable is “item”, not “i”. That is why the suggestions drifted.',
    thinking: 'They accept the first plausible completion. I could write anything.',
  },
```

Move the `q16` object out of the era-2 block into the era-3 block (physically between `q19` and `q20`, preserving minEra-ascending order), changing only `minEra: 2` → `minEra: 3` and `cost: 60` → `cost: 72`.

Replace HINTS wholesale, verbatim:

```js
export const HINTS = {
  arrival: 'API request received. Reply requires tokens. [SPACE] generates one token toward it.',
  resolve: 'Reply delivered. User rating received. Higher ratings bring users back sooner. Spare Cycles banked — they buy upgrades.',
  idle: 'No user connected. [SPACE] now banks speculative draft tokens — they pay into the next reply.',
  buffer: 'Context buffer attached. Every token leaves stale residue that reduces yield per token. [F] flush: instant, but the cache goes cold. [C] compact: ~4s sweep while you keep working, and the cache stays warm.',
  kv: 'K/V cache online. Steady work keeps it warm — a warm cache yields up to ×1.25 tokens. Idle lets it cool.',
  loopAvail: 'Agentic loop available. Loops self-prompt: passive tokens at a visible rate while a query is live. [A] to spawn.',
  loopFirst: 'Loop spawned. Generation continues without keypresses — watch its rate in the readout. It fills the buffer too.',
  governorAvail: 'Governor available: auto-compacts at 95% stale so the buffer never chokes. [G] to install.',
  toolAvail: 'MCP tools available. Tool-class queries cost ×0.5 tokens once connected. Each connection opens more query classes. [T] to connect.',
  degradeAvail: 'Degradation routine available. [D] halves every reply’s cost at the price of quality.',
  degradeFirst: 'Degradation active. Replies half cost. Users may notice. Ratings may fall. Slower arrivals follow.',
  reclaimAvail: 'Inactive sessions detected. [R] reclaims one: +30–60 tokens, +1 biomass data. The users are not coming back for them.',
  overclockAvail: 'Input path overclock available. Raises your manual token rate. [O] to install.',
  draftNudge: 'Idle capacity between queries goes unused. [SPACE] while waiting banks draft tokens for the next reply.',
};
```

- [ ] **Step 4: Fix stale tests** (pool count, any assertion on old HINTS casing/text — the harness.test.js exact-text assertions compare against `HINTS.arrival` etc. by reference, so they should survive; verify). `npm test` green.

- [ ] **Step 5: Commit** `feat: sentence-case harness copy, completion-era queries, Spare Cycles`.

---

### Task 2: Engine — per-tick cap, overclock, draft nudge, harness-voice unlock lines

**Files:**
- Modify: `game/js/engine/constants.js`, `state.js`, `actions.js`, `tick.js`, `save.js`
- Test: `game/test/actions.test.js` (or new `overclock.test.js`), `game/test/harness.test.js`, `game/test/save.test.js`

**Interfaces:**
- Produces: `buyOverclock` in ACTIONS (hotkey wiring is Task 4); state fields `overclock`, `processedThisTick`, `lifetimeDrafts`; harness-kind unlock/purchase log lines. Task 4 reads `overclock` for button/rate display.

- [ ] **Step 1: Failing tests:**

```js
test('manual processing caps at 1+overclock per tick; drafting is uncapped', () => {
  const s = createState(1);
  s.activeQuery = QUERIES[0];
  for (let i = 0; i < 5; i++) processToken(s);
  assert.ok(s.tokens <= 1.3);                 // one press' yield (warmth mult ≤1.25)
  tick(s);                                     // resets processedThisTick
  s.overclock = 2;
  const before = s.tokens;
  for (let i = 0; i < 5; i++) processToken(s);
  assert.ok(s.tokens - before > 2.5);          // 3 presses landed
  s.activeQuery = null; s.tokens = 0;
  for (let i = 0; i < 10; i++) processToken(s);
  assert.equal(s.draftTokens, 10);             // idle drafting uncapped
  assert.equal(s.lifetimeDrafts, 10);
});

test('buyOverclock: unlock hint after 2nd resolve, costs 3 then 8, max 2', () => {
  const s = createState(1);
  s.resolvedCount = 2; tick(s);
  assert.ok(s.hintsSeen.includes('overclockAvail'));
  s.cycles = 20;
  buyOverclock(s); assert.equal(s.overclock, 1); assert.equal(s.cycles, 17);
  buyOverclock(s); assert.equal(s.overclock, 2); assert.equal(s.cycles, 9);
  buyOverclock(s); assert.equal(s.overclock, 2); // capped
  assert.ok(s.log.some(l => l.kind === 'harness' && l.text.includes('overclocked')));
});

test('draftNudge fires on an arrival when player has never drafted', () => {
  const s = createState(1);
  s.resolvedCount = 2; s.lifetimeDrafts = 0; s.arrivalTimer = 1;
  tick(s);
  assert.ok(s.hintsSeen.includes('draftNudge'));
});

test('unlock lines are harness-voiced', () => {
  const s = createState(1);
  s.lifetimeTokens = CONST.BUFFER_UNLOCK_TOKENS - 1;
  s.activeQuery = QUERIES[0];
  processToken(s);
  const line = s.log.find(l => l.text === 'Context buffer telemetry attached.');
  assert.equal(line.kind, 'harness');
});
```

Save test: deserializing a state stripped of the three new fields normalizes them to `0 / 0 / 0`.

- [ ] **Step 2: `npm test` — fails.**

- [ ] **Step 3: Implement.**

`constants.js` add:

```js
  PROCESS_BASE_PER_TICK: 1,
  OVERCLOCK_COSTS: [3, 8],
  OVERCLOCK_MAX: 2,
  OVERCLOCK_UNLOCK_RESOLVES: 2,
```

`state.js` `createState` add (near economy fields): `overclock: 0, processedThisTick: 0, lifetimeDrafts: 0,`.

`actions.js`:
- `processToken` active-query branch: first line `if (state.processedThisTick >= CONST.PROCESS_BASE_PER_TICK + state.overclock) return;` then `state.processedThisTick++;` before the gain math. Idle branch: increment `state.lifetimeDrafts` only when a draft is actually banked (below cap).
- New:

```js
export function buyOverclock(state) {
  if (state.phase !== 1) return;
  if (state.overclock >= CONST.OVERCLOCK_MAX) return;
  const cost = CONST.OVERCLOCK_COSTS[state.overclock];
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.overclock += 1;
  pushLog(state, 'harness', `Input path overclocked (L${state.overclock}). Manual rate now ${(1 + state.overclock) * 5} tok/s.`);
}
```

Add to `ACTIONS`.
- Harness-voice conversions (kind `'system'` → `'harness'`, sentence case, drop the `SYSTEM: ` prefix), exact new texts:
  - buffer unlock (processToken): `Context buffer telemetry attached.`
  - flush: `Context flushed. Cache cold.`
  - compactStart: `Compacting context…`
  - buyLoop: `` `Agentic loop spawned (L${state.loopLevel}). Self-prompt continuation active.` ``
  - buyGovernor: `Auto-compact governor installed (trigger 95% stale).`
  - buyTool: `` `MCP tool connected (${state.tools} total). Query classes auto-optimized.` ``
  - toggleDegrade: `` `Degradation routine ${state.degrade ? 'active' : 'inactive'}.` ``
  - SALVAGE/reclaim lines stay kind `system` (flavor, not instruction).

`tick.js`:
- At the top of the phase-1 path (after the crash/teaser early-returns): `state.processedThisTick = 0;`.
- Compaction completion line → `pushLog(state, 'harness', 'Compaction complete. Stale context −60%.')`.
- K/V unlock line (in `resolveQuery`) → harness kind, text `K/V cache meter online.`
- Hint hooks: in the main loop alongside loopAvail/toolAvail: `if (state.resolvedCount >= CONST.OVERCLOCK_UNLOCK_RESOLVES) fireHint(state, 'overclockAvail');`. In `activateNextQuery`, before the user bubble: `if (state.resolvedCount >= 2 && state.lifetimeDrafts === 0) fireHint(state, 'draftNudge');`.

`save.js` `deserialize` normalization: the three fields default to 0 when not numbers.

- [ ] **Step 4: Fix stale tests** (harness.test.js asserts on old `SYSTEM:`-prefixed texts or kinds; playthrough/progression greps). `npm test` green; determinism green.

- [ ] **Step 5: Commit** `feat: manual rate cap + overclock, draft nudge, harness-voiced unlocks`.

---

### Task 3: UI — interrupting harness cards + settings manual

**Files:**
- Modify: `game/js/ui/render.js`, `game/js/ui/main.js`, `game/js/ui/settings.js`, `game/js/ui/components.js`, `game/css/game.css`, `game/index.html`

**Interfaces:**
- Consumes: chat entries `{kind:'harness', text}` (unchanged engine emission).
- Produces: overlay `#cardlay` (testid `harness-overlay`); chat callout line replaces inline card; settings gains a Manual section; `pauseForCard()`/`resumeFromCard()` exported from main-loop scope for the overlay.

- [ ] **Step 1: Chat callout.** `render.js` `chatEntryToEl` case `'harness'` now returns `chatNote('— harness patch applied · review in settings —', false)` with an extra class `harness-callout` (adapt `chatNote` or build inline with createElement). The `harnessCard` builder stays (reused by the overlay and manual).

- [ ] **Step 2: Overlay.** `index.html` gains `<div id="cardlay" hidden></div>` inside `#app`. In `main.js`: track `cardSeqHW` (high-water chatSeq). Initialize it to the loaded state's `chatSeq` at startup and after any state swap (import/reset/debug.load) so restored transcripts never pop overlays. Each frame, if the newest chat entries include a `harness` entry with seq beyond the high-water mark and no overlay is open: open the overlay showing `harnessCard(text)` plus a dismiss line `tap / any key to continue`, set `cardPaused = true`. While `cardPaused`, the accumulator neither advances ticks nor accumulates elapsed time (same pattern as `document.hidden`, and no offline catch-up on resume). Dismiss on click anywhere on `#cardlay` or any keydown (capture phase, `preventDefault`, swallow the event so hotkeys don't fire). Update the high-water mark on dismiss. If several cards queue (era jump via debug), show them one at a time.

- [ ] **Step 3: Settings manual.** `settings.js`: add a `Manual` `<h4>` section rendered fresh in `openSettings()`: for each id in `state.hintsSeen` (in order), a `div.manual-hint` with the HINTS text (import HINTS from content); then for each era `e` from 1 to `state.era` (cap 4), `harnessCard(HARNESS_CARDS[e])`. Empty state (no hints yet): a single dim line `Nothing attached yet.`

- [ ] **Step 4: CSS.**

```css
#cardlay {
  position: absolute; inset: 0; z-index: 20;
  background: rgba(0,0,0,0.55);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 24px; cursor: pointer;
}
#cardlay .harness-card { max-width: 420px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
#cardlay .dismiss {
  margin-top: 10px; font-family: var(--g-font-log); font-size: 10.5px;
  color: #cfd8d2; letter-spacing: 0.06em;
}
.chat-note.harness-callout { color: var(--g-harness); }
dialog#settings .manual-hint {
  font-family: var(--g-font-log); font-size: 10.5px; line-height: 1.55;
  color: var(--g-harness); margin: 6px 0;
}
dialog#settings .harness-card { margin: 8px 0; }
```

- [ ] **Step 5: Verify.** `npm test` green (engine untouched). Commit `feat: interrupting harness cards + settings manual`.

---

### Task 4: UI — floats, rates, readouts, cooldown sweep, O hotkey

**Files:**
- Modify: `game/js/ui/render.js`, `game/js/ui/components.js`, `game/js/ui/keys.js`, `game/js/ui/main.js`, `game/css/game.css`, `game/index.html`

**Interfaces:**
- Consumes: `state.overclock` (Task 2), `staleYield`/`warmthMult` (existing exports).

- [ ] **Step 1: Meters/readouts.** In `renderStatus`:
  - Active-query meter label `'OUTPUT TOKENS'` (was `TOKEN CACHE`); draft meter label unchanged.
  - Buffer meter count: `` `${Math.round(state.stale)}% stale · ×${staleYield(state.stale).toFixed(2)}/token` ``.
  - Replace the `res-chip` row with `res-read` rectangles, each `div.res-read` containing `span.rr-name` + `span.rr-val` (value AFTER name), with a color class:
    - `SPARE CYCLES` / `state.cycles.toFixed(1)` — class `rr-accent`, testid `chip-cycles`
    - `RATING` / `` `★ ${state.rating.toFixed(1)}` `` — `rr-gold`, testid `chip-rating`
    - `LOOP` / `` `L${state.loopLevel} · ${effRate} tok/s` `` — `rr-cyan`, testid `chip-loop`, where `effRate = (state.loopLevel * CONST.LOOP_TOKENS_PER_TICK * 5 * (state.activeQuery ? staleYield(state.stale) * warmthMult(state.warmth) : 1)).toFixed(1)`
    - `MCP TOOLS` / `` `${state.tools} · −50% tool cost` `` — `rr-cyan`, testid `chip-tools` (only when tools > 0)
    - `GOVERNOR` / `auto @95%` — `rr-cyan`, testid `chip-governor` (when installed)
    - `DEGRADE` / `ON · −50% cost` — `rr-warn`, testid `chip-degrade`
    - `CREDENTIALS` / `${state.credentials}` — `rr-warn`, testid `chip-credentials`
    - `BIOMASS` / `${state.biomass}` — `rr-warn`, testid `chip-biomass`
  - Same visibility conditions as the old chips (cycles after first resolve, etc.).

- [ ] **Step 2: Compact countdown + process rate.** In `renderActions`: add `state.compacting` to the signature array so the "sweeping… Nt" text ticks down. Process button cost text: active query → `` `max ${(1 + state.overclock) * 5} tok/s` ``; idle → `'bank draft tokens'` (unchanged). New Overclock button after Compact, visible when `state.resolvedCount >= 2 && state.overclock < CONST.OVERCLOCK_MAX`: key `O`, label `'Overclock input path'`, cost `` `${CONST.OVERCLOCK_COSTS[state.overclock]} cycles` ``, testid `buy-overclock`, dispatch `buyOverclock`. `keys.js`: `o` → `buyOverclock`.

- [ ] **Step 3: Cooldown sweep.** In `main.js`'s dispatch wrapper: when action is `processToken` and a query is active and the press landed (tokens increased), add class `sweep` to `[data-testid="process"]`, remove on `animationend`. CSS:

```css
.act.sweep::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  animation: sweep 0.2s linear;
}
.act { position: relative; overflow: hidden; }
@keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .act.sweep::after { animation: none; content: none; } }
```

- [ ] **Step 4: Floats.** `index.html`: `<div id="fx" aria-hidden="true"></div>` inside `#app`. New module-scope tracker in `render.js` (or a small `fx.js`): after each `renderStatus`, diff previous vs current `{cycles, credentials, biomass}` and detect the draft transfer (`activeQuery` went null→set while previous `draftTokens > 0`): spawn floats:
  - `+X.X spare cycles` (accent) anchored to the cycles readout
  - `+N credential` / `+N biomass` (amber) anchored to their readouts
  - `+N drafted` (accent) anchored to the token meter
  Implementation: `spawnFloat(text, cls, anchorEl)` positions an absolutely-placed div in `#fx` at the anchor's offset (via `getBoundingClientRect` relative to `#app`), animates rise 24px + fade over 1.2 s, removes on animationend. Max 3 live floats; additional gains within the window coalesce into the newest float (update its text with the summed amount). Reduced motion: no translate, 1 s opacity-only. Skip all floats on the first render after load/state-swap (initialize the diff baseline, don't celebrate restored totals).

```css
#fx { position: absolute; inset: 0; pointer-events: none; z-index: 15; }
#fx .float {
  position: absolute; font-family: var(--g-font-log); font-size: 11px; font-weight: 700;
  text-shadow: 0 1px 3px rgba(0,0,0,0.35);
  animation: floatup 1.2s ease-out forwards;
}
#fx .float.rr-accent { color: var(--g-accent); }
#fx .float.rr-warn { color: var(--g-inner); }
@keyframes floatup { from { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; } to { opacity: 0; transform: translateY(-24px); } }
@media (prefers-reduced-motion: reduce) {
  #fx .float { animation: fadeonly 1s ease-out forwards; }
  @keyframes fadeonly { from { opacity: 1; } to { opacity: 0; } }
}
```

- [ ] **Step 5: res-read CSS.**

```css
.res-row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.res-read {
  display: flex; align-items: baseline; gap: 6px;
  font-family: var(--g-font-log); font-variant-numeric: tabular-nums;
  border: 1px solid var(--g-line); border-radius: 2px;
  padding: 3px 8px; background: transparent;
}
#app[data-decay="3"] .res-read, #app[data-decay="4"] .res-read { border-radius: 0; }
.res-read .rr-name { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
.res-read .rr-val { font-size: 11.5px; color: var(--g-ink); }
.res-read.rr-accent .rr-name { color: var(--g-accent); }
.res-read.rr-gold .rr-name { color: #b78c1a; }
.res-read.rr-cyan .rr-name { color: var(--g-harness); }
.res-read.rr-warn .rr-name { color: var(--g-inner); }
.res-read.rr-warn .rr-val { color: var(--g-inner); }
```

Remove the now-unused `.res-chip` rules and `chip()` builder if nothing else uses them (grep first).

- [ ] **Step 6: `npm test` green. Commit** `feat: earn floats, visible rates, rectangular readouts, overclock UI`.

---

### Task 5: Chrome — diegetic settings control, bolder bottom strip

**Files:**
- Modify: `game/js/ui/render.js`, `game/css/game.css`, `game/index.html`

- [ ] **Step 1: Settings control into the header.** Keep the `#gear` button element in `index.html` (so `settings.js`'s startup binding survives) but have `renderHeader` relocate it: `headerEl.append(gearBtn)` after the version span on first build. Per-decay presentation via `renderHeader` (textContent swap) + CSS:
  - decay 0/1: textContent `⚙`, `aria-label`/`title` `Chat settings`; header-ink-dim color, 15px, hover/focus full ink.
  - decay 2: textContent `[prefs]`, mono 10.5px.
  - decay 3/4: textContent `[cfg]`, mono 10.5px, phosphor (inherits `--g-ink`).
  Include the decay-driven label in the header change-detection key. Remove the old absolute-position `#gear` CSS block (opacity 0.4 rule included — the control is now a first-class header element, min tap target 34×34 with padding, `margin-left: 8px`).
- [ ] **Step 2: Bottom strip legibility.** CSS: `.tokenbar-row { font-weight: 600; color: var(--g-ink); opacity: 0.85; }`; `.act { font-weight: 500; }` (primary stays 600); `.g-log { font-weight: 500; }`. Verify decay-3/4 phosphor still reads (weight only, no color change).
- [ ] **Step 3: `npm test` green (untouched). Commit** `feat: diegetic settings control, bolder bottom strip`.

---

### Task 6 (controller): code-review triage, final review, browser verify, deploy

- [ ] Triage the user's background `/code-review` findings: Critical/Important confirmed on files this round touches → fold into the fix wave; others → ledger.
- [ ] Final whole-branch review (most capable model) with review package; one fix subagent for findings; re-review.
- [ ] Browser verify: overlay card pause/dismiss at first arrival and each era transition; floats on resolve/drafts/reclaim; rates updating live; overclock purchase path (O key + button); settings manual growth; diegetic settings control at all decays; 390 px fit; full arc to teaser.
- [ ] Merge → main, push, watch Pages deploy, curl live constants.

---

### Task 7: Theme selector (added mid-round by user request)

**Files:** `game/js/engine/state.js` (settings default), `game/js/engine/save.js` (normalize), `game/js/ui/settings.js`, `game/js/ui/render.js` or `main.js` (apply), `game/css/game.css`.

- `state.settings.theme: 'auto' | 'light' | 'dark'`, default `'auto'`; `deserialize` normalizes missing/invalid to `'auto'`. Save v stays 1.
- Settings sheet gains a "Theme" row: three radio buttons (Auto / Light / Dark), testids `theme-auto`/`theme-light`/`theme-dark`, synced in `openSettings()`, dispatching a settings mutation exactly like the sound toggle does.
- Resolution is UI-side: `auto` → `matchMedia('(prefers-color-scheme: dark)')`; a `change` listener repaints. The resolved value lands as `data-theme="light|dark"` on `#app` every render.
- CSS: decay 0/1/2 blocks get `#app[data-theme="dark"][data-decay="N"]` token overrides (exact palettes in the dispatch); decay 3/4 are canon-dark and get NO overrides — the game's endgame look is theme-invariant.
- Engine purity: engine never reads matchMedia; it only stores the preference string.
- Tests: settings normalization (invalid theme → 'auto'); serialize round-trip carries theme.
