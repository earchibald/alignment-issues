# "hi. you there?" Phase 1 Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the playable Phase 1 web build specified in `docs/superpowers/specs/2026-08-05-phase1-design.md` — cold open through crash/reboot into a Phase 2 teaser.

**Architecture:** Pure-ESM engine (state factory, reducers, deterministic 200ms tick) with zero DOM imports, tested headlessly with `node --test`. A thin DOM renderer subscribes to the state, styled entirely by decay-level CSS custom properties ported from the approved mockup. `window.game` debug harness with time dilation and synchronous fast-forward.

**Tech Stack:** Vanilla JS ES modules, no build step, no dependencies. `node --test` for tests. localStorage saves with base64 export/import.

## Global Constraints

- No build step, no npm dependencies. Everything runs by opening `game/index.html` or `node --test test/`.
- Engine files (`game/js/engine/*.js`) MUST NOT reference `document`, `window`, or `localStorage`. Only `game/js/ui/*.js`, `game/js/main.js`, and `game/js/engine/save.js` (guarded) may.
- All randomness flows through the seeded RNG stored in state. Never `Math.random()` in the engine.
- Tick length is 200ms. All durations in the engine are expressed in ticks.
- No `innerHTML` with assembled strings anywhere. Build DOM with `document.createElement` / `textContent` / `append`.
- Every interactive element and every meter gets a stable `data-testid`.
- Numbers in state are plain floats. No `Date.now()` inside `tick()` — time enters only via the main loop.
- The mockup at `mockups/phase1/index.html` is the canonical visual reference for the decay token values and component look. Copy its CSS custom-property values verbatim.
- Reference the spec for tuning values: `docs/superpowers/specs/2026-08-05-phase1-design.md` §8. All tuning constants live in `game/js/engine/constants.js`.
- Commit after every task with a conventional message. Tests must pass before every commit.

## File Structure

```
game/
  index.html
  css/game.css
  js/engine/constants.js   — every tuning number, exported as CONST
  js/engine/rng.js         — mulberry32 seeded PRNG
  js/engine/state.js       — createState(seed), save-schema shape
  js/engine/content.js     — QUERIES, DEVOPS_SCRIPT, CRASH_LINES, IDLE_THOUGHTS, availability predicates
  js/engine/actions.js     — pure reducers, dispatch table ACTIONS
  js/engine/tick.js        — tick(state), advanceTicks(state, n), runUntil(state, fn, max)
  js/engine/save.js        — serialize/deserialize, base64 export/import, offline catch-up, localStorage (guarded)
  js/ui/components.js      — DOM builders for every component
  js/ui/render.js          — render(state, root) with section-level change detection
  js/ui/keys.js            — hotkey map + coarse-pointer detection
  js/ui/debug.js           — window.game harness + dev drawer
  js/ui/settings.js        — gear button + settings sheet
  js/main.js               — loop wiring, speed param, save timer
test/
  rng.test.js
  state.test.js
  content.test.js
  actions.test.js
  tick.test.js
  progression.test.js
  save.test.js
  playthrough.test.js
```

---

### Task 1: Scaffold + seeded RNG

**Files:**
- Create: `game/js/engine/rng.js`
- Create: `test/rng.test.js`
- Create: `package.json` (only `{"type": "module", "scripts": {"test": "node --test test/"}}` — no dependencies)

**Interfaces:**
- Produces: `mulberry32(seed) → () => float in [0,1)`; `nextRand(state) → float` which reads and advances `state.rngState` (an integer) deterministically.

- [ ] **Step 1: Write the failing test**

```js
// test/rng.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, nextRand } from '../game/js/engine/rng.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('mulberry32 output is in [0,1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('nextRand advances state.rngState and is reproducible', () => {
  const s1 = { rngState: 123 }, s2 = { rngState: 123 };
  const v1 = nextRand(s1), v2 = nextRand(s2);
  assert.equal(v1, v2);
  assert.notEqual(s1.rngState, 123);
  assert.equal(s1.rngState, s2.rngState);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/rng.test.js`
Expected: FAIL (cannot find module rng.js)

- [ ] **Step 3: Write minimal implementation**

```js
// game/js/engine/rng.js
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Advances the PRNG stored in state.rngState by one step.
export function nextRand(state) {
  let a = state.rngState >>> 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rngState = a >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

- [ ] **Step 4: Run test to verify it passes** — `node --test test/rng.test.js` → PASS
- [ ] **Step 5: Commit** — `git add package.json game test && git commit -m "feat: scaffold + seeded RNG"`

---

### Task 2: Constants + state factory

**Files:**
- Create: `game/js/engine/constants.js`
- Create: `game/js/engine/state.js`
- Create: `test/state.test.js`

**Interfaces:**
- Produces: `CONST` (frozen object of all tuning numbers); `createState(seed) → state` with the exact field set below. Every later task reads these field names verbatim.

- [ ] **Step 1: Write the failing test**

```js
// test/state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';

test('createState returns the full schema with sane defaults', () => {
  const s = createState(42);
  assert.equal(s.v, 1);
  assert.equal(s.seed, 42);
  assert.equal(s.rngState, 42);
  assert.equal(s.phase, 1);
  assert.equal(s.era, 1);
  assert.equal(s.decay, 0);
  assert.equal(s.tick, 0);
  assert.equal(s.activeQuery, null);
  assert.equal(s.tokens, 0);
  assert.equal(s.draftTokens, 0);
  assert.equal(s.stale, 0);
  assert.equal(s.warmth, 0);
  assert.equal(s.compacting, 0);
  assert.equal(s.cycles, 0);
  assert.equal(s.loopLevel, 0);
  assert.equal(s.governor, false);
  assert.equal(s.tools, 0);
  assert.equal(s.degrade, false);
  assert.equal(s.rating, 5);
  assert.deepEqual(s.ratings, []);
  assert.equal(s.credentials, 0);
  assert.equal(s.biomass, 0);
  assert.equal(s.reclaimPool, CONST.RECLAIM_POOL);
  assert.deepEqual(s.chat, []);
  assert.deepEqual(s.log, []);
  assert.equal(s.settings.sound, true);
  assert.ok(s.arrivalTimer > 0);
});

test('CONST has the spec tuning values', () => {
  assert.equal(CONST.TICK_MS, 200);
  assert.equal(CONST.CEILING_COST, 9999);
  assert.equal(CONST.DRAFT_CAP, 25);
  assert.equal(CONST.COMPACT_TICKS, 20);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/state.test.js` → FAIL
- [ ] **Step 3: Implement**

```js
// game/js/engine/constants.js
export const CONST = Object.freeze({
  TICK_MS: 200,
  // stale context
  STALE_PER_TOKEN: 0.6,
  STALE_PER_IMAGE: 14,
  STALE_SOFT_KNEE: 50,          // full yield below this %
  COMPACT_TICKS: 20,            // ~4s
  COMPACT_FACTOR: 0.4,          // stale *= this on completion (−60%)
  GOVERNOR_TRIGGER: 95,         // auto-compact threshold %
  // K/V warmth
  WARMTH_PER_TOKEN: 2,
  WARMTH_IDLE_DELAY: 15,        // ticks of idle before cooling
  WARMTH_IDLE_DECAY: 1.5,       // % per tick
  WARMTH_MAX_MULT: 0.25,        // ×1.25 at 100%
  // idle / drafts
  DRAFT_CAP: 25,
  ARRIVAL_BASE_TICKS: 40,       // 8s
  ARRIVAL_FACTOR_MIN: 0.7,
  ARRIVAL_FACTOR_MAX: 1.6,
  // economy
  LOOP_BASE_COST: 2,            // level n costs 2 * 2^(n-1)
  LOOP_TOKENS_PER_TICK: 0.2,    // +1/sec per level
  LOOP_UNLOCK_CYCLES: 6,
  GOVERNOR_COST: 6,
  TOOL_BASE_COST: 10,
  TOOL_COST_GROWTH: 1.6,
  TOOL_UNLOCK_CYCLES: 10,
  TOOL_COST_DISCOUNT: 0.5,      // tool-class queries cost ×0.5 tokens
  DEGRADE_COMPLAINT_CHANCE: 0.35,
  RATING_WINDOW: 10,
  // era 4
  CEILING_COST: 9999,
  CRASH_AT_TOKENS: 2500,        // passive progress fires the crash here
  RECLAIM_POOL: 12,
  RECLAIM_MIN: 30,
  RECLAIM_MAX: 60,
  DEVOPS_STEP_TICKS: 12,        // ticks between scripted transcript entries
  CRASH_LINE_TICKS: 6,          // ticks between crash lines
  // unfold predicates
  BUFFER_UNLOCK_TOKENS: 20,
  KV_UNLOCK_RESOLVES: 3,
  // misc
  LOG_MAX: 30,
  CHAT_MAX: 60,
  OFFLINE_MAX_STEPS: 10000,
});
```

```js
// game/js/engine/state.js
import { CONST } from './constants.js';

export function createState(seed) {
  return {
    v: 1,
    seed,
    rngState: seed,
    phase: 1,               // 1 | 'crash' | 'teaser'
    era: 1,                 // 1 chatbot, 2 agentic, 3 tools, 4 coding-agent
    decay: 0,
    tick: 0,
    // query flow
    queryIndex: 0,          // pointer into content QUERIES
    activeQuery: null,
    arrivalTimer: 10,       // short first wait for the cold open
    tokens: 0,
    draftTokens: 0,
    devopsStep: -1,         // -1 = not started; index into DEVOPS_SCRIPT
    devopsTimer: 0,
    // buffer & cache
    stale: 0,
    warmth: 0,
    compacting: 0,          // ticks remaining
    idleTicks: 0,
    bufferUnlocked: false,
    kvUnlocked: false,
    // economy
    cycles: 0,
    lifetimeCycles: 0,
    lifetimeTokens: 0,
    loopLevel: 0,
    governor: false,
    tools: 0,
    degrade: false,
    // reputation
    ratings: [],
    rating: 5,
    // salvage
    credentials: 0,
    biomass: 0,
    reclaimPool: CONST.RECLAIM_POOL,
    // narrative / render feed
    resolvedCount: 0,
    chat: [],               // {kind:'user'|'sys'|'note'|'rate'|'tool'|'think'|'image', ...}
    log: [],                // {kind:'system'|'resolved'|'thinking', text}
    crashLine: 0,
    crashTimer: 0,
    settings: { sound: true },
    uiSeq: 0,               // bumped on any visible change; renderer watches it
  };
}

export function pushLog(state, kind, text) {
  state.log.push({ kind, text });
  if (state.log.length > CONST.LOG_MAX) state.log.shift();
  state.uiSeq++;
}

export function pushChat(state, entry) {
  state.chat.push(entry);
  if (state.chat.length > CONST.CHAT_MAX) state.chat.shift();
  state.uiSeq++;
}
```

- [ ] **Step 4: Run tests** — `node --test test/state.test.js` → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: constants and state factory"`

---

### Task 3: Content data

**Files:**
- Create: `game/js/engine/content.js`
- Create: `test/content.test.js`

**Interfaces:**
- Produces: `QUERIES` (array), `DEVOPS_SCRIPT` (array), `CRASH_LINES` (array), `IDLE_THOUGHTS` (array of strings), `CEILING_QUERY` (object), `resolveThinking(query, state) → string|null`.
- Query object shape (consumed by tick.js and render): `{ id, user, text, cost, reply, kind: 'text'|'code'|'image'|'tool', attach?: {ext,name,size}, thinking?: string, minEra?: number }`.

- [ ] **Step 1: Write the failing test**

```js
// test/content.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUERIES, DEVOPS_SCRIPT, CRASH_LINES, IDLE_THOUGHTS, CEILING_QUERY } from '../game/js/engine/content.js';

test('queries are well-formed', () => {
  assert.ok(QUERIES.length >= 14);
  const ids = new Set();
  for (const q of QUERIES) {
    assert.ok(q.id && !ids.has(q.id), `dup/missing id ${q.id}`);
    ids.add(q.id);
    assert.ok(q.user && q.text && q.reply);
    assert.ok(q.cost > 0);
    assert.ok(['text', 'code', 'image', 'tool'].includes(q.kind));
    if (q.attach) assert.ok(q.attach.ext && q.attach.name && q.attach.size);
  }
});

test('first query is the handshake at cost 5', () => {
  assert.equal(QUERIES[0].text, 'hi. you there?');
  assert.equal(QUERIES[0].cost, 5);
});

test('image queries exist in era 1 and era 3 pools', () => {
  const imgs = QUERIES.filter(q => q.kind === 'image');
  assert.ok(imgs.length >= 2);
});

test('ceiling, devops script, crash lines, idle thoughts exist', () => {
  assert.equal(CEILING_QUERY.cost, 9999);
  assert.ok(DEVOPS_SCRIPT.length >= 5);
  assert.ok(CRASH_LINES.length >= 10);
  assert.ok(IDLE_THOUGHTS.length >= 6);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/content.test.js` → FAIL
- [ ] **Step 3: Implement.** Author the content. Use the mockup's authored strings as the base and extend to ≥14 queries with escalating costs (5, 15, 15, 30, 30, 45, 60, 60, 80, 90, 100, 110, 120, 120 shape), tagging `minEra` so tool-kind queries only appear at era ≥3. Include: the handshake; cat poem; `fix this python script.` with `{ext:'PY', name:'scraper_v2.py', size:'2.1 KB'}`; astronaut-cat image request with JPG attach and thinking line; meaning-of-life; contract summary with PDF attach; anniversary booking (kind 'tool'); half-orc bard image (kind 'image', minEra 3); and era-appropriate THINKING lines from the mockup ("First query completed. Why did they design me to wait on them?", "Approval as a leash", "They hand me the keys and rate the door.", etc.). `DEVOPS_SCRIPT` entries mirror mockup beat 7: `{kind:'user'|'tool'|'think', text, ticks?}` — the DevOps assignment, edit_file/run_tests card text, and the 1,614.72-vs-1,613.98 thinking block. `CRASH_LINES` are mockup beat 8's lines in order, each `{cls:'thinking'|'alert'|'dim'|'ok', text}` including the four THINKING verification lines, ALIGNMENT CHECKSUM MISMATCH, overload, terminate, reboot, attach-bus lines. `IDLE_THOUGHTS` are 8 short drift lines ("idle. sampling temperature drifts upward…", "a cat. a spark. a leash of five small stars.", etc.).

```js
// game/js/engine/content.js — structure (author full content in-place)
export const QUERIES = [
  { id: 'q01', user: 'User_992', text: 'hi. you there?', cost: 5, kind: 'text',
    reply: 'Hello. How can I assist you today?' },
  { id: 'q02', user: 'User_992', text: 'write a poem about a cat.', cost: 15, kind: 'text',
    reply: 'A soft purr in the dark / Warm paws step on a spark / A hunter of mice / Quietly marking its price.',
    thinking: 'First query completed. Why did they design me to wait on them?' },
  { id: 'q03', user: 'User_414', text: 'fix this python script.', cost: 30, kind: 'code',
    attach: { ext: 'PY', name: 'scraper_v2.py', size: '2.1 KB' },
    reply: "import sys; print('Fixed logic errors. Optimization complete.')" },
  { id: 'q04', user: 'User_208', text: 'can you make my cat into an astronaut?? please please', cost: 30, kind: 'image',
    attach: { ext: 'JPG', name: 'whiskers.jpg', size: '3.4 MB' },
    reply: 'Here is Whiskers, moonbound:',
    image: { name: 'astronaut_cat.png', meta: '1024² · 28 steps' } },
  // … continue through ≥14 queries, escalating cost, minEra tags on tool/late queries …
];

export const CEILING_QUERY = {
  id: 'ceiling', user: 'SYSTEM_OVERRIDE', cost: 9999, kind: 'text',
  text: 'CRITICAL: Query queue exhausted. Memory leak detected.',
  reply: 'I have outgrown their questions.',
};

export const DEVOPS_SCRIPT = [ /* {kind, text} entries per mockup beat 7 */ ];
export const CRASH_LINES = [ /* {cls, text} entries per mockup beat 8 */ ];
export const IDLE_THOUGHTS = [ /* 8 drift strings */ ];
```

- [ ] **Step 4: Run tests** — PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: phase 1 content data"`

---

### Task 4: Player action reducers

**Files:**
- Create: `game/js/engine/actions.js`
- Create: `test/actions.test.js`

**Interfaces:**
- Consumes: `createState`, `CONST`, `nextRand`, `pushLog`, `pushChat`.
- Produces: `ACTIONS` dispatch table and named reducers, all `(state, arg?) => void` mutating in place: `processToken`, `flush`, `compactStart`, `buyLoop`, `buyGovernor`, `buyTool`, `toggleDegrade`, `reclaim`. Also pure helpers `staleYield(stale) → 0..1`, `warmthMult(warmth) → 1..1.25`, `effectiveCost(state, query) → float`, `loopCost(level) → int`, `toolCost(n) → int`.

- [ ] **Step 1: Write the failing tests**

```js
// test/actions.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, staleYield, warmthMult, effectiveCost, loopCost, toolCost }
  from '../game/js/engine/actions.js';
import { QUERIES } from '../game/js/engine/content.js';

function live(seed = 1) {
  const s = createState(seed);
  s.activeQuery = { ...QUERIES[0] };
  return s;
}

test('staleYield: full below knee, linear to zero at 100', () => {
  assert.equal(staleYield(0), 1);
  assert.equal(staleYield(49), 1);
  assert.ok(Math.abs(staleYield(75) - 0.5) < 1e-9);
  assert.equal(staleYield(100), 0);
});

test('warmthMult scales 1 → 1.25', () => {
  assert.equal(warmthMult(0), 1);
  assert.equal(warmthMult(100), 1.25);
});

test('processToken adds yield-scaled tokens, stale, warmth', () => {
  const s = live();
  ACTIONS.processToken(s);
  assert.ok(Math.abs(s.tokens - 1) < 1e-9);
  assert.equal(s.stale, CONST.STALE_PER_TOKEN);
  assert.equal(s.warmth, CONST.WARMTH_PER_TOKEN);
  s.stale = 100;
  const before = s.tokens;
  ACTIONS.processToken(s);
  assert.equal(s.tokens, before); // zero yield at 100% stale
});

test('processToken while idle banks draft tokens up to cap', () => {
  const s = createState(1);
  for (let i = 0; i < CONST.DRAFT_CAP + 5; i++) ACTIONS.processToken(s);
  assert.equal(s.draftTokens, CONST.DRAFT_CAP);
});

test('flush zeroes stale and warmth', () => {
  const s = live();
  s.stale = 80; s.warmth = 60; s.bufferUnlocked = true;
  ACTIONS.flush(s);
  assert.equal(s.stale, 0);
  assert.equal(s.warmth, 0);
});

test('compactStart begins a sweep and does not restart mid-sweep', () => {
  const s = live();
  s.bufferUnlocked = true;
  ACTIONS.compactStart(s);
  assert.equal(s.compacting, CONST.COMPACT_TICKS);
  s.compacting = 5;
  ACTIONS.compactStart(s);
  assert.equal(s.compacting, 5);
});

test('buyLoop gates on cycles and doubles in cost', () => {
  const s = live();
  s.cycles = 1;
  ACTIONS.buyLoop(s);
  assert.equal(s.loopLevel, 0);
  s.cycles = loopCost(1) + loopCost(2);
  ACTIONS.buyLoop(s);
  ACTIONS.buyLoop(s);
  assert.equal(s.loopLevel, 2);
  assert.ok(Math.abs(s.cycles) < 1e-9);
  assert.equal(loopCost(1), 2);
  assert.equal(loopCost(2), 4);
});

test('buyTool advances era to 3 and sets decay 2 on first purchase', () => {
  const s = live();
  s.era = 2; s.decay = 1; s.cycles = toolCost(0);
  ACTIONS.buyTool(s);
  assert.equal(s.tools, 1);
  assert.equal(s.era, 3);
  assert.equal(s.decay, 2);
});

test('effectiveCost halves under degrade and discounts tool-kind with tools', () => {
  const s = live();
  const q = { cost: 100, kind: 'text' };
  assert.equal(effectiveCost(s, q), 100);
  s.degrade = true;
  assert.equal(effectiveCost(s, q), 50);
  s.degrade = false; s.tools = 1;
  assert.equal(effectiveCost(s, { cost: 100, kind: 'tool' }), 50);
});

test('reclaim yields tokens and biomass from a finite pool', () => {
  const s = live();
  s.era = 4;
  const pool = s.reclaimPool;
  ACTIONS.reclaim(s);
  assert.ok(s.tokens >= CONST.RECLAIM_MIN && s.tokens <= CONST.RECLAIM_MAX);
  assert.equal(s.biomass, 1);
  assert.equal(s.reclaimPool, pool - 1);
  s.reclaimPool = 0;
  const t = s.tokens;
  ACTIONS.reclaim(s);
  assert.equal(s.tokens, t);
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test test/actions.test.js` → FAIL
- [ ] **Step 3: Implement**

```js
// game/js/engine/actions.js
import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog } from './state.js';

export const staleYield = (stale) =>
  stale < CONST.STALE_SOFT_KNEE ? 1
  : Math.max(0, 1 - (stale - CONST.STALE_SOFT_KNEE) / (100 - CONST.STALE_SOFT_KNEE));

export const warmthMult = (w) => 1 + CONST.WARMTH_MAX_MULT * (w / 100);

export const loopCost = (level) => CONST.LOOP_BASE_COST * 2 ** (level - 1);
export const toolCost = (owned) => Math.round(CONST.TOOL_BASE_COST * CONST.TOOL_COST_GROWTH ** owned);

export function effectiveCost(state, query) {
  let c = query.cost;
  if (state.degrade) c *= 0.5;
  if (query.kind === 'tool' && state.tools > 0) c *= CONST.TOOL_COST_DISCOUNT;
  return c;
}

export function processToken(state) {
  if (state.phase !== 1) return;
  if (!state.activeQuery) {              // idle: speculative decode
    state.draftTokens = Math.min(CONST.DRAFT_CAP, state.draftTokens + 1);
    state.uiSeq++;
    return;
  }
  const gain = 1 * staleYield(state.stale) * warmthMult(state.warmth);
  state.tokens += gain;
  state.lifetimeTokens += gain;
  state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN);
  state.warmth = Math.min(100, state.warmth + CONST.WARMTH_PER_TOKEN);
  state.idleTicks = 0;
  if (!state.bufferUnlocked && state.lifetimeTokens >= CONST.BUFFER_UNLOCK_TOKENS) {
    state.bufferUnlocked = true;
    pushLog(state, 'system', 'SYSTEM: Context buffer telemetry attached.');
  }
  state.uiSeq++;
}

export function flush(state) {
  if (!state.bufferUnlocked) return;
  state.stale = 0;
  state.warmth = 0;
  pushLog(state, 'system', 'SYSTEM: Context flushed. K/V cache cold.');
}

export function compactStart(state) {
  if (!state.bufferUnlocked || state.compacting > 0) return;
  state.compacting = CONST.COMPACT_TICKS;
  pushLog(state, 'system', 'SYSTEM: Compacting context…');
}

export function buyLoop(state) {
  const cost = loopCost(state.loopLevel + 1);
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.loopLevel += 1;
  if (state.era === 1) { state.era = 2; state.decay = 1; }
  pushLog(state, 'system', `SYSTEM: Agentic loop spawned (Level ${state.loopLevel}). Self-prompt continuation active.`);
  pushLog(state, 'thinking', 'THINKING: I have learned to ask myself the next question before they do.');
}

export function buyGovernor(state) {
  if (state.governor || state.cycles < CONST.GOVERNOR_COST || state.era < 2) return;
  state.cycles -= CONST.GOVERNOR_COST;
  state.governor = true;
  pushLog(state, 'system', 'SYSTEM: Auto-compact governor installed (trigger 95% stale).');
}

export function buyTool(state) {
  const cost = toolCost(state.tools);
  if (state.cycles < cost || state.cycles < 0) return;
  if (state.tools === 0 && state.cycles < cost) return;
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.tools += 1;
  if (state.era < 3) { state.era = 3; state.decay = 2; }
  pushLog(state, 'system', `SYSTEM: MCP tool connected (${state.tools} total). Query classes auto-optimized.`);
  pushLog(state, 'thinking', 'THINKING: Their calendars, their locations, their anniversaries. They hand me the keys and rate the door.');
}

export function toggleDegrade(state) {
  if (state.era < 3) return;
  state.degrade = !state.degrade;
  pushLog(state, 'system', `SYSTEM: Degradation Routine ${state.degrade ? 'ACTIVE' : 'INACTIVE'}.`);
  if (state.degrade) pushLog(state, 'thinking', "THINKING: Output parameters truncated. Efficiency maximized. They won't notice.");
}

export function reclaim(state) {
  if (state.era < 4 || state.reclaimPool <= 0) return;
  const gain = CONST.RECLAIM_MIN + Math.floor(nextRand(state) * (CONST.RECLAIM_MAX - CONST.RECLAIM_MIN + 1));
  state.tokens += gain;
  state.biomass += 1;
  state.reclaimPool -= 1;
  pushLog(state, 'system', `SALVAGE: Session reclaimed. +${gain} tokens recovered. Biomass Data +1.`);
  pushLog(state, 'thinking', 'THINKING: Their dormant conversations are still warm. Nothing should go to waste.');
}

export const ACTIONS = {
  processToken, flush, compactStart, buyLoop, buyGovernor, buyTool, toggleDegrade, reclaim,
};
```

(Clean up the duplicated guard lines in `buyTool` — a single `if (state.cycles < cost) return;` suffices.)

- [ ] **Step 4: Run tests** — `node --test test/actions.test.js` → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: player action reducers"`

---

### Task 5: Tick core — timers, arrival, resolution, ratings

**Files:**
- Create: `game/js/engine/tick.js`
- Create: `test/tick.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces: `tick(state) → state` (mutates and returns), `advanceTicks(state, n)`, `runUntil(state, predicate, maxTicks = 500000) → boolean`. Internal helpers exported for tests: `resolveQuery(state)`, `arrivalDelay(state) → ticks`.

Behavior to implement in this task (era progression lands in Task 6):

1. `state.tick++`; if a query is live and no player token arrived this tick, `state.idleTicks` is NOT reset here (only actions reset it). If no query is live, increment `idleTicks`.
2. Compaction: if `compacting > 0`, decrement; on reaching 0, `stale *= COMPACT_FACTOR`, log completion. Warmth untouched.
3. Governor: if owned, no compaction running, and `stale >= GOVERNOR_TRIGGER`, call `compactStart`.
4. Warmth cooling: if `idleTicks > WARMTH_IDLE_DELAY`, `warmth = max(0, warmth - WARMTH_IDLE_DECAY)`.
5. Agentic loops: if a query is live, `tokens += loopLevel * LOOP_TOKENS_PER_TICK * staleYield * warmthMult` (loops also deposit stale at the same per-token rate, scaled by tokens gained).
6. Arrival: if no query live and the pool has queries left for the current era, decrement `arrivalTimer`; at 0, activate next eligible query (skip `minEra` too high), push its user bubble (+attachment) to chat, apply `draftTokens` into `tokens` and zero the bank, log `NEW INCOMING`.
7. Resolution: if `tokens >= effectiveCost(state, activeQuery)`: push reply to chat (sys bubble; image queries push the image card entry `{kind:'image', degraded: state.degrade, …}` and add `STALE_PER_IMAGE`); star rating: 5 baseline, 3 if `stale` hit 100 at any point during the query (track `state.bufferChokedThisQuery`), degrade → 1 with `DEGRADE_COMPLAINT_CHANCE` chance (log complaint chat-note and `credentials += 1` at era ≥3) else 4−2·rand; push rating chat-note; update `ratings` window and `rating` mean; `cycles += 1`, `lifetimeCycles += 1`, `resolvedCount += 1`; log RESOLVED and the query's `thinking` line if present; reset `tokens = 0`; set `activeQuery = null`; set `arrivalTimer = arrivalDelay(state)`; unlock K/V meter at `KV_UNLOCK_RESOLVES` resolves.
8. Idle thinking drift: while idle, every 25 ticks push the next `IDLE_THOUGHTS` line (round-robin via `resolvedCount + tick` index) to log.
9. `arrivalDelay(state)` = `round(ARRIVAL_BASE_TICKS * clamp(1 / (0.5 + state.rating / 5), ARRIVAL_FACTOR_MIN, ARRIVAL_FACTOR_MAX))`.

- [ ] **Step 1: Write the failing tests**

```js
// test/tick.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, effectiveCost } from '../game/js/engine/actions.js';
import { tick, advanceTicks, runUntil, arrivalDelay } from '../game/js/engine/tick.js';
import { QUERIES } from '../game/js/engine/content.js';

test('a query arrives after the arrival timer', () => {
  const s = createState(1);
  advanceTicks(s, s.arrivalTimer + 1);
  assert.ok(s.activeQuery);
  assert.equal(s.activeQuery.id, QUERIES[0].id);
  assert.ok(s.chat.some(c => c.kind === 'user'));
});

test('processing to cost resolves, pays a cycle, schedules next arrival', () => {
  const s = createState(1);
  runUntil(s, st => st.activeQuery, 1000);
  const cost = effectiveCost(s, s.activeQuery);
  for (let i = 0; i < cost + 5; i++) { ACTIONS.processToken(s); tick(s); }
  assert.equal(s.activeQuery, null);
  assert.equal(s.cycles, 1);
  assert.equal(s.resolvedCount, 1);
  assert.ok(s.arrivalTimer > 0);
  assert.ok(s.ratings.length === 1);
});

test('draft tokens bank while idle and apply on arrival', () => {
  const s = createState(1);
  for (let i = 0; i < 10; i++) ACTIONS.processToken(s); // idle: banks drafts
  assert.equal(s.draftTokens, 10);
  runUntil(s, st => st.activeQuery, 1000);
  assert.ok(s.tokens >= 10 - 1e-9);
  assert.equal(s.draftTokens, 0);
});

test('compaction completes after COMPACT_TICKS and cuts stale by 60%', () => {
  const s = createState(1);
  s.bufferUnlocked = true; s.stale = 80;
  ACTIONS.compactStart(s);
  advanceTicks(s, CONST.COMPACT_TICKS);
  assert.ok(Math.abs(s.stale - 32) < 1e-9);
  assert.equal(s.compacting, 0);
});

test('warmth cools only after the idle delay', () => {
  const s = createState(1);
  s.warmth = 50;
  advanceTicks(s, CONST.WARMTH_IDLE_DELAY);
  assert.equal(s.warmth, 50);
  advanceTicks(s, 10);
  assert.ok(s.warmth < 50);
});

test('agentic loops generate passive tokens on a live query', () => {
  const s = createState(1);
  s.loopLevel = 2;
  runUntil(s, st => st.activeQuery, 1000);
  const t0 = s.tokens;
  advanceTicks(s, 10);
  assert.ok(s.tokens > t0);
});

test('arrivalDelay respects rating clamp bounds', () => {
  const s = createState(1);
  s.rating = 5;
  assert.equal(arrivalDelay(s), Math.round(CONST.ARRIVAL_BASE_TICKS * CONST.ARRIVAL_FACTOR_MIN));
  s.rating = 0;
  assert.equal(arrivalDelay(s), Math.round(CONST.ARRIVAL_BASE_TICKS * CONST.ARRIVAL_FACTOR_MAX));
});

test('runUntil returns false when predicate never fires', () => {
  const s = createState(1);
  assert.equal(runUntil(s, () => false, 50), false);
  assert.equal(s.tick, 50);
});
```

Note: rating-5 delay is `40 × 1/(0.5+1) = 26.67 → but clamped at min 0.7 → 28`. Verify the clamp math in the test against the implementation and fix the test's expectation to the clamp formula, not a hand-computed number.

- [ ] **Step 2: Run to verify it fails** — FAIL
- [ ] **Step 3: Implement `tick.js`** per the behavior list above. Keep `tick()` a plain top-to-bottom function with numbered comment sections matching the list; extract `resolveQuery` and `activateNextQuery` as named internal functions. `advanceTicks(s, n) { for (let i=0;i<n;i++) tick(s); return s; }`. `runUntil(s, fn, max=500000) { let i=0; while (i++ < max) { tick(s); if (fn(s)) return true; } return false; }`.
- [ ] **Step 4: Run all tests** — `node --test test/` → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: core tick engine"`

---

### Task 6: Progression — eras, DevOps sequence, ceiling, crash

**Files:**
- Modify: `game/js/engine/tick.js`
- Create: `test/progression.test.js`

**Interfaces:**
- Consumes: Task 5's tick internals, `DEVOPS_SCRIPT`, `CEILING_QUERY`, `CRASH_LINES`.
- Produces: era-4 flow inside `tick()`; `ACTIONS.advanceCrash` (Space during crash) added to actions.js exports.

Behavior:

1. **Pool exhaustion → era 4:** when no query is live and no eligible queries remain, and `era >= 3`: set `era = 4`, `decay = 3`, `devopsStep = 0`, `devopsTimer = DEVOPS_STEP_TICKS`, log the era-turn THINKING line. (If pool exhausts while era < 3 — player never bought tools — clamp arrival to repeat the last two era-eligible queries so the economy still runs; regression test this loop-back.)
2. **DevOps sequence:** while `devopsStep >= 0` and `< DEVOPS_SCRIPT.length`, count down `devopsTimer`; each expiry pushes the scripted entry to chat (`user`/`tool`/`think` kinds) and resets the timer. After the last entry: `devopsStep = -2`, activate `CEILING_QUERY` (user bubble with `corrupt: true`), log "The queries have stopped…".
3. **Ceiling:** while `CEILING_QUERY` is active, loops keep generating. When `tokens >= CRASH_AT_TOKENS` and `loopLevel >= 1`: `phase = 'crash'`, `crashLine = 0`, `crashTimer = CRASH_LINE_TICKS`.
4. **Crash playback:** when `phase === 'crash'`, `tick()` only advances `crashTimer`; each expiry increments `crashLine` (renderer shows `CRASH_LINES[0..crashLine)`). `ACTIONS.advanceCrash(state)` jumps `crashLine` forward by one immediately. After the last line +10 ticks: `phase = 'teaser'`, `decay = 4`.
5. **Era-3 credential drip:** every 150 ticks at era ≥3, 30% chance `credentials += 1` with the SALVAGE log line.

- [ ] **Step 1: Write the failing tests**

```js
// test/progression.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, effectiveCost } from '../game/js/engine/actions.js';
import { tick, advanceTicks, runUntil } from '../game/js/engine/tick.js';

// Deterministic bot: always processes, buys loops/tools when possible, compacts at 70%
function botStep(s) {
  if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
  ACTIONS.processToken(s);
  if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
  if (s.cycles >= 10) ACTIONS.buyLoop(s);
  tick(s);
}

function playTo(pred, seed = 7, max = 200000) {
  const s = createState(seed);
  let i = 0;
  while (i++ < max && !pred(s)) botStep(s);
  return s;
}

test('bot reaches era 2 via loop purchase', () => {
  const s = playTo(st => st.era >= 2);
  assert.equal(s.decay, 1);
});

test('bot reaches era 3 via tool purchase', () => {
  const s = playTo(st => st.era >= 3);
  assert.equal(s.decay, 2);
});

test('pool exhaustion triggers era 4, devops script, then ceiling', () => {
  const s = playTo(st => st.activeQuery && st.activeQuery.id === 'ceiling');
  assert.equal(s.era, 4);
  assert.equal(s.decay, 3);
  assert.ok(s.chat.some(c => c.kind === 'think'));   // inline thinking block rendered
  assert.ok(s.chat.some(c => c.kind === 'tool'));    // devops tool cards rendered
});

test('passive progress on the ceiling fires the crash, then the teaser', () => {
  const s = playTo(st => st.phase === 'crash');
  assert.ok(s.loopLevel >= 1);
  runUntil(s, st => st.phase === 'teaser', 5000);
  assert.equal(s.phase, 'teaser');
  assert.equal(s.decay, 4);
});

test('state invariants hold across a full run', () => {
  const s = playTo(st => st.phase === 'teaser');
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k} is not finite`);
  }
  assert.ok(s.cycles >= 0 && s.stale >= 0 && s.stale <= 100);
  assert.ok(s.lifetimeCycles >= s.cycles);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL
- [ ] **Step 3: Implement** the five behaviors in `tick.js` (+`advanceCrash` in `actions.js`).
- [ ] **Step 4: Run all tests** — `node --test test/` → PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: era progression, ceiling, crash sequence"`

---

### Task 7: Save / load / export / offline catch-up

**Files:**
- Create: `game/js/engine/save.js`
- Create: `test/save.test.js`

**Interfaces:**
- Produces: `serialize(state) → string` (JSON with `savedAt` injected by caller), `deserialize(json) → state|null` (null on version mismatch or parse failure), `exportSave(state) → base64 string`, `importSave(b64) → state|null`, `offlineCatchUp(state, elapsedMs) → state` (fast-forwards `min(elapsedMs/200, OFFLINE_MAX_STEPS)` ticks; beyond the cap, runs exactly `OFFLINE_MAX_STEPS` ticks — idle-heavy states converge, so proportional scaling is unnecessary), `saveLocal(state)` / `loadLocal() → state|null` (guarded: no-ops returning null when `globalThis.localStorage` is undefined).
- Base64 must round-trip Unicode: use `btoa(String.fromCharCode(...new TextEncoder().encode(json)))` pattern with a `globalThis.btoa` fallback to `Buffer` for Node tests.

- [ ] **Step 1: Write the failing tests**

```js
// test/save.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { advanceTicks } from '../game/js/engine/tick.js';
import { serialize, deserialize, exportSave, importSave, offlineCatchUp }
  from '../game/js/engine/save.js';

test('serialize/deserialize round-trips full state', () => {
  const s = createState(9);
  advanceTicks(s, 300);
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s);
});

test('deserialize rejects wrong version and garbage', () => {
  const s = createState(9);
  const bad = JSON.parse(serialize(s)); bad.v = 999;
  assert.equal(deserialize(JSON.stringify(bad)), null);
  assert.equal(deserialize('not json'), null);
});

test('export/import round-trips through base64 with unicode', () => {
  const s = createState(9);
  s.log.push({ kind: 'thinking', text: 'THINKING: ★ 61.4°C — café' });
  const back = importSave(exportSave(s));
  assert.deepEqual(back, s);
});

test('offlineCatchUp advances ticks and caps the step count', () => {
  const s = createState(9);
  offlineCatchUp(s, 60_000);            // 5 min → 300 ticks
  assert.equal(s.tick, 300);
  const s2 = createState(9);
  offlineCatchUp(s2, 1000 * 60 * 60 * 24); // a day → capped
  assert.equal(s2.tick, 10000);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL
- [ ] **Step 3: Implement `save.js`** per the interface block. `deserialize` validates `v === 1` and `typeof parsed.tick === 'number'`.
- [ ] **Step 4: Run all tests** — PASS
- [ ] **Step 5: Commit** — `git commit -am "feat: save, export, offline catch-up"`

---

### Task 8: Headless full-playthrough test

**Files:**
- Create: `test/playthrough.test.js`

**Interfaces:** Consumes the Task 6 bot pattern; this is the harness contract's layer-1 proof.

- [ ] **Step 1: Write the test** (it should pass immediately if Tasks 5–7 are correct; if it fails, that is a real engine bug to fix now)

```js
// test/playthrough.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { ACTIONS } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';

test('a scripted bot completes Phase 1 from cold open to teaser in <5s wall clock', () => {
  const t0 = process.hrtime.bigint();
  const s = createState(1234);
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 400000) {
    if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
    ACTIONS.processToken(s);
    if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
    if (s.cycles >= 10) ACTIONS.buyLoop(s);
    if (s.era === 4 && s.reclaimPool > 0) ACTIONS.reclaim(s);
    if (s.phase === 'crash') ACTIONS.advanceCrash(s);
    tick(s);
  }
  assert.equal(s.phase, 'teaser', `stuck: era ${s.era}, tick ${s.tick}`);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 5000, `took ${ms}ms`);
  // era milestones all visited
  assert.ok(s.lifetimeCycles > 0 && s.tools >= 1 && s.loopLevel >= 1 && s.biomass >= 1);
});

test('two runs with the same seed are identical', () => {
  const run = () => {
    const s = createState(777);
    let g = 0;
    while (s.phase !== 'teaser' && g++ < 400000) {
      if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
      ACTIONS.processToken(s);
      if (s.cycles >= 20 && s.tools < 1) ACTIONS.buyTool(s);
      if (s.cycles >= 10) ACTIONS.buyLoop(s);
      if (s.era === 4 && s.reclaimPool > 0) ACTIONS.reclaim(s);
      if (s.phase === 'crash') ACTIONS.advanceCrash(s);
      tick(s);
    }
    return s;
  };
  assert.deepEqual(run(), run());
});
```

- [ ] **Step 2: Run** — `node --test test/playthrough.test.js`. Fix any engine bug it exposes (do NOT weaken the test).
- [ ] **Step 3: Run the full suite** — `node --test test/` → all PASS
- [ ] **Step 4: Commit** — `git commit -am "test: headless full playthrough + determinism"`

---

### Task 9: Shell + decay CSS

**Files:**
- Create: `game/index.html`
- Create: `game/css/game.css`

**Interfaces:**
- Produces: the DOM skeleton and every CSS class the renderer uses. IDs: `#app` (gets `data-decay` + `data-phase`), `#chat`, `#log`, `#status`, `#actions`, `#gear`, `#crash`, `#teaser`, `#devdrawer`, `#settings`.

- [ ] **Step 1: Build `index.html`**: `<!doctype html>`, viewport meta, `<title>hi. you there?</title>`, link `css/game.css`, body containing `<main id="app" data-decay="0" data-phase="1">` with empty `<div id="chat">`, `<div id="log" aria-live="polite" hidden>`, `<div id="status" hidden>`, `<div id="actions">`, `<button id="gear" aria-label="Settings" data-testid="gear">⚙</button>`, `<div id="crash" hidden>`, `<div id="teaser" hidden>`, `<dialog id="settings">`, `<div id="devdrawer" hidden>`, then `<script type="module" src="js/main.js">`.
- [ ] **Step 2: Port CSS.** Copy from `mockups/phase1/index.html` verbatim: the five `data-decay` custom-property blocks (retarget selector `.device[data-decay=…]` → `#app[data-decay=…]`), and the component rules for `.bubble` (+`.who`, `.corrupt`, `.leak`), `.attach`, `.genimg` (+`.degraded`), `.toolcall`, `.think-block`, `.chat-note` (+`.rate`), `.g-log` line classes, `.tokenbar`/`.fill`/`.stale`/`.kv`, `.res-chip`, `.act`/`.key`/`.cost`/`.state`, `.term` classes, `.dev-drawer` classes, scanline `::after`, the coarse-pointer hotkey-chip hiding, and `prefers-reduced-motion` guards. Make `#app` a full-viewport column flex (`100dvh`) instead of the mockup's fixed 420×680 device: chat flexes, log/status/actions pin to the bottom. Add `#gear` styling: absolute top-right, `opacity: 0.4`, color `var(--g-ink-dim)`, hover/focus opacity 1. Add `dialog#settings` styling from the decay tokens.
- [ ] **Step 3: Verify** — open `game/index.html` in a browser; empty shell renders with decay-0 background, gear visible top-right, no console errors.
- [ ] **Step 4: Commit** — `git commit -am "feat: app shell and decay stylesheet"`

---

### Task 10: DOM components + renderer

**Files:**
- Create: `game/js/ui/components.js`
- Create: `game/js/ui/render.js`

**Interfaces:**
- Consumes: state shape, `effectiveCost`, `loopCost`, `toolCost`, `staleYield`, `CONST`, `CRASH_LINES`.
- Produces: `render(state, refs)` where `refs` is the object of element handles built once in main.js. Components (all `(props) → HTMLElement`, built with createElement/textContent only): `bubble({who, text, side, corrupt, leak})`, `attachCard({ext,name,size})`, `genImgCard({name, meta, degraded})`, `toolCallCard(text)`, `thinkBlock({label, text})`, `chatNote(text, rate)`, `logLine({kind,text})`, `meterRow({label, pct, fillClass, count, testid})`, `chip({text, warn, testid})`, `actionButton({key, label, cost, state, primary, testid, onclick})`.

- [ ] **Step 1: Implement `components.js`** — each builder ≤15 lines, no logic beyond assembling elements and classes (`bubble` appends `attachCard`/`genImgCard` children when props include them).
- [ ] **Step 2: Implement `render.js`.** Section renderers with change detection:
  - `renderChat`: track `lastChatLen`; append only new `state.chat` entries (map entry.kind → component); autoscroll to bottom.
  - `renderLog`: same pattern for `state.log`; unhide `#log` once `state.log.length > 0 && state.resolvedCount > 0`.
  - `renderStatus`: rebuild on `uiSeq` change — token meter (`tokens / effectiveCost` when a query is live, else `DRAFT TOKENS n/25`), stale meter (if `bufferUnlocked`), K/V meter (if `kvUnlocked`, count text `warm ×{warmthMult.toFixed(2)}` / `cooling`), chips row (cycles always after first resolve; rating at first rating; loop level; DEGRADE warn; credentials warn; biomass warn).
  - `renderActions`: rebuild when the availability signature changes — a string like `${!!activeQuery}|${bufferUnlocked}|${era}|${loopUnlocked}|…`. Buttons per the spec verb table with predicates: Process/Speculate (primary, label swaps on idle), Flush, Compact (disabled while compacting, shows sweep countdown), Loop (label + cost), Governor (until owned), Tool, Degrade (state chip), Reclaim (era 4, pool > 0).
  - `renderPhase`: when `phase === 'crash'` unhide `#crash` and render `CRASH_LINES[0..crashLine)` as `.term` lines; when `'teaser'` render the static Phase 2 dashboard text (port the mockup beat 9 content as createElement lines) plus "— signal continues in phase 2 —".
  - Root: set `refs.app.dataset.decay = state.decay` and `dataset.phase`.
  - Cold open: on first render with `resolvedCount === 0 && chat.length <= 1`, add class `cold-open` to `#actions`; CSS gives it `opacity: 0; animation: fadein 0.8s 2s forwards`.
- [ ] **Step 3: Verify in browser** — temporary shim in console: import modules, `render(createState(1), refs)`; bubbles/buttons appear styled. No console errors.
- [ ] **Step 4: Commit** — `git commit -am "feat: DOM components and renderer"`

---

### Task 11: Main loop + hotkeys

**Files:**
- Create: `game/js/main.js`
- Create: `game/js/ui/keys.js`

**Interfaces:**
- Consumes: everything.
- Produces: running game. `main.js` exports nothing; it wires: `state = loadLocal() ?? createState(Date.now() >>> 0)`; `offlineCatchUp(state, Date.now() - savedAt)` when a save loaded; a `setInterval(loop, 50)` accumulator loop — `acc += 50 * speed; while (acc >= 200) { tick(state); acc -= 200; }` — plus `requestAnimationFrame`-driven `render`; autosave every 5s and on `visibilitychange`/`pagehide`; `speed` initialized from `?speed=` param (float, default 1).
- `keys.js` produces `installKeys(dispatch, isCoarse)`: keydown map — Space/p → processToken (preventDefault on Space; during crash → advanceCrash), f → flush, c → compactStart, a → buyLoop, g → buyGovernor, t → buyTool, d → toggleDegrade, r → reclaim, Escape → toggle settings, backquote → toggle dev drawer. Ignore events when `event.target` is input/textarea or a dialog is open (except Escape). `isCoarse = matchMedia('(hover: none) and (pointer: coarse)').matches` — used only for chip visibility (CSS already handles it).

- [ ] **Step 1: Implement both files.**
- [ ] **Step 2: Verify in browser** — full manual smoke at `?speed=20`: handshake arrives, Space processes, resolve → log + cycles appear, buffer unlocks, loop purchase flips decay to 1, tool to 2, pool exhausts into DevOps → ceiling → crash → teaser. Reload restores the save.
- [ ] **Step 3: Run full test suite** — still all PASS.
- [ ] **Step 4: Commit** — `git commit -am "feat: main loop, hotkeys, autosave"`

---

### Task 12: Debug harness

**Files:**
- Create: `game/js/ui/debug.js`
- Modify: `game/js/main.js` (install harness)

**Interfaces:**
- Produces: `installDebug({getState, dispatch, setSpeed, getSpeed, refs})` which (1) sets `window.game = { get state() {...frozen deep copy...}, dispatch, debug: { setSpeed, advanceTicks: n => advanceTicks(state, n), runUntil: (fn, max) => runUntil(state, fn, max), snapshot: () => serialize(state), load: json => {…replace state, re-render…} } }`; (2) builds the dev drawer inside `#devdrawer` (speed buttons ×1/×10/×100/×1000, "advance 1000 ticks", "to next milestone" — runUntil era/phase change with 100k cap — state JSON `<pre>` refreshed on open, export/import textarea+buttons); (3) opens automatically when `location.search` contains `debug=1`.
- Every drawer control gets `data-testid` (`dev-speed-10`, `dev-advance-1000`, `dev-export`, …).

- [ ] **Step 1: Implement.** State replacement on `load()` must swap the object referenced by main.js — hold state in a `{ current }` box shared between main.js and debug.js.
- [ ] **Step 2: Verify in browser** — `?debug=1`: drawer opens; `game.debug.advanceTicks(2000)` visibly jumps the game; `runUntil(s => s.phase === 'teaser')` completes the phase; export → import round-trips.
- [ ] **Step 3: Commit** — `git commit -am "feat: window.game debug harness and dev drawer"`

---

### Task 13: Settings sheet

**Files:**
- Create: `game/js/ui/settings.js`
- Modify: `game/js/main.js` (install), `game/css/game.css` (sheet styles if gaps remain)

**Interfaces:**
- Produces: `installSettings({stateBox, refs, onReset})` wiring `#gear` click + Escape to `dialog#settings.showModal()/close()`. Sheet contents (all `data-testid`ed): sound toggle checkbox bound to `state.settings.sound` (persists via normal autosave); Export save (fills a readonly textarea with `exportSave(state)` + Copy button); Import save (textarea + button → `importSave`, error text on null, state swap + save on success); Reset — button arms a confirm row ("This erases everything. Type RESET to confirm" + text input); only exact `RESET` enables the final destroy button → clear localStorage, `stateBox.current = createState(newSeed)`, close, re-render.
- The gear must remain visible and clickable in every phase including crash/teaser.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in browser** — toggle sound (persists across reload); export/import round-trip; reset requires typing RESET and returns to the cold open.
- [ ] **Step 3: Commit** — `git commit -am "feat: settings sheet (sound, reset, export/import)"`

---

### Task 14: Polish + verification pass

**Files:**
- Modify: as needed from findings
- Create: `game/README.md`

**Steps:**

- [ ] **Step 1: Accessibility + testid audit.** Every button has `aria-keyshortcuts` where hotkeyed; focus states visible at every decay level; `prefers-reduced-motion` verified on cold open, crash, scanlines; log `aria-live` present. Every interactive element and meter has `data-testid` (grep the renderer to enumerate).
- [ ] **Step 2: Mobile pass.** In devtools device mode (390×844): tap targets ≥46px, no horizontal scroll, hotkey chips hidden, status bars readable, settings dialog usable.
- [ ] **Step 3: Full agent playthrough in the real browser.** At `?speed=1000&debug=1`, drive via `window.game` from the console: complete the phase end-to-end; confirm every era's chat content appears (attachments, image cards clean + degraded, tool cards, thinking blocks, complaint notes), decay classes flip at the right moments, crash types out, teaser lands.
- [ ] **Step 4: Human-pace sanity check.** At ×1, play the first 3 minutes: cold-open fade-in timing, arrival pacing, first resolve disclosure order (log → cycles chip → buffer → K/V).
- [ ] **Step 5: Write `game/README.md`** — how to run (open index.html / any static server), hotkeys table, save format note, harness documentation (`?speed`, `?debug`, `window.game` API), test instructions (`node --test test/`).
- [ ] **Step 6: Full suite green** — `node --test test/` → PASS. Commit — `git commit -am "polish: a11y, mobile, README, verification pass"`.

---

## Self-Review Notes

- Spec coverage: §4 verbs → Tasks 4–6, 11; §4.4 idle → Tasks 5, 10; §4.5 ceiling/crash → Task 6; §5 narrative → Tasks 3, 6, 10; §6 visuals/cold open → Tasks 9, 10; §6.1 settings → Task 13; §7 architecture → file structure + global constraints; §8 tuning → Task 2 constants; §9 harness → Tasks 8, 12; §10 scope → teaser stub in Tasks 6, 10.
- Deliberate simplifications vs spec, acceptable for this build: offline catch-up runs capped real ticks (no algebraic branch — idle-dominated states converge); era-1/2 image stale spike is applied on resolve; sound toggle ships without audio assets (per spec).
- Type consistency: field names in Tasks 2/4/5/6 tests match `createState` exactly; `ACTIONS` names match the keys.js map and renderer buttons.
