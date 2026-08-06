# Phase 1 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply playtest round 1: responsive mobile fit, compact action tray, slower pacing, a 31-query no-repeat pool with correct era scoping, diegetic harness narration that teaches every mechanic, and a readable internal feed.

**Architecture:** All changes live inside the existing `game/` tree. Engine stays pure ESM (no DOM); content stays pure data; UI changes are CSS-first with two small component additions (harness log lines, harness chat cards).

**Tech Stack:** Vanilla JS ES modules, `node --test`, no dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-08-06-phase1-polish.md` (addendum to `2026-08-05-phase1-design.md`).

## Global Constraints

- No dependencies. No build step. Engine files never import DOM or `content`-external modules beyond existing patterns.
- **No `innerHTML` anywhere** — createElement/textContent/append only (a security hook blocks it).
- Test command is `npm test` (bare `node --test`); **never** `node --test test/` (Node 26 rejects a bare dir arg).
- Tick is 200 ms; 5 ticks = 1 s. All pacing is expressed in ticks.
- Determinism: no `Date.now()`/`Math.random()` in the engine; RNG only via `nextRand(state)`.
- Save version stays `v: 1`; new state fields are normalized in `deserialize` so old saves load.
- All interactive elements keep/get `data-testid`.
- Existing 47 tests must stay green after every task (adjusted only where this plan changes asserted values).
- Voice rules: users are terse and human; THINKING is gold-italic interiority; HARNESS (new) is lowercase, mechanical, precise — never emotional. Copy in this plan is exact; transcribe verbatim.

---

### Task 1: Pacing constants + reading-time arrivals + slower scripted beats

**Files:**
- Modify: `game/js/engine/constants.js`
- Modify: `game/js/engine/tick.js`
- Modify: `game/js/engine/state.js`
- Modify: `game/js/engine/save.js`
- Test: `game/test/tick.test.js`, `game/test/save.test.js`, existing constant assertions wherever they live (grep for old values)

**Interfaces:**
- Produces: `CONST.READ_TICKS_PER_CHAR = 0.25`, `CONST.READ_TICKS_MAX = 60`, `CONST.IDLE_THOUGHT_EVERY = 60`; state fields `lastReplyChars: 0` and `hintsSeen: []` (hintsSeen is consumed by Task 3 but added here so save normalization lands once).
- Consumes: nothing new.

- [ ] **Step 1: Write failing tests** (append to `game/test/tick.test.js`):

```js
test('arrivalDelay adds a capped reading bonus from lastReplyChars', () => {
  const s = createState(1);
  s.ratings = [5]; s.rating = 5;
  s.lastReplyChars = 0;
  const base = arrivalDelay(s);
  s.lastReplyChars = 100;
  assert.equal(arrivalDelay(s), base + 25);   // ceil(100 * 0.25)
  s.lastReplyChars = 10000;
  assert.equal(arrivalDelay(s), base + 60);   // capped at READ_TICKS_MAX
});

test('resolveQuery records reply length for the reading bonus', () => {
  const s = createState(1);
  s.activeQuery = QUERIES[0];
  s.tokens = 9999;
  resolveQuery(s);
  assert.equal(s.lastReplyChars, QUERIES[0].reply.length);
});

test('devops entries honor per-entry ticks overrides', () => {
  const s = createState(1);
  s.era = 4; s.decay = 3; s.devopsStep = 0;
  s.devopsTimer = 1;
  tick(s); // first entry lands
  const next = DEVOPS_SCRIPT[1].ticks ?? CONST.DEVOPS_STEP_TICKS;
  assert.equal(s.devopsTimer, next);
});
```

(Import `arrivalDelay`, `resolveQuery`, `DEVOPS_SCRIPT` as needed; follow the file's existing import style.)

- [ ] **Step 2: Run to verify failure** — `npm test` fails on the new tests.

- [ ] **Step 3: Implement.**

`constants.js` — change/add exactly:

```js
  ARRIVAL_BASE_TICKS: 90,       // 18s base gap between users
  READ_TICKS_PER_CHAR: 0.25,    // arrival delay grows with reply length
  READ_TICKS_MAX: 60,           // cap on the reading bonus (+12s)
  IDLE_THOUGHT_EVERY: 60,       // idle THINKING cadence (was inline 25)
  DEVOPS_STEP_TICKS: 30,        // default; entries may override via .ticks
  CRASH_LINE_TICKS: 9,
  LOG_MAX: 60,
```

`state.js` `createState` — add after `resolvedCount: 0,`:

```js
    lastReplyChars: 0,      // reply length of last resolve; feeds arrivalDelay
    hintsSeen: [],          // one-shot harness hint ids already fired
```

`tick.js`:
- `arrivalDelay` becomes:

```js
export function arrivalDelay(state) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const factor = clamp(1 / (0.5 + state.rating / 5), CONST.ARRIVAL_FACTOR_MIN, CONST.ARRIVAL_FACTOR_MAX);
  const readBonus = Math.min(CONST.READ_TICKS_MAX, Math.ceil(state.lastReplyChars * CONST.READ_TICKS_PER_CHAR));
  return Math.round(CONST.ARRIVAL_BASE_TICKS * factor) + readBonus;
}
```

- In `resolveQuery`, before `state.arrivalTimer = arrivalDelay(state);` add `state.lastReplyChars = q.reply.length;`.
- Idle-thought block: replace `state.tick % 25 === 0` with `state.tick % CONST.IDLE_THOUGHT_EVERY === 0`.
- DevOps scheduling: replace `state.devopsTimer = CONST.DEVOPS_STEP_TICKS;` (the else branch after an entry lands) with `state.devopsTimer = DEVOPS_SCRIPT[state.devopsStep].ticks ?? CONST.DEVOPS_STEP_TICKS;`.

`save.js` `deserialize` — after the existing checks, before `return parsed;`:

```js
  if (!Array.isArray(parsed.hintsSeen)) parsed.hintsSeen = [];
  if (typeof parsed.lastReplyChars !== 'number') parsed.lastReplyChars = 0;
```

Add a save test: deserializing a serialized state that lacks the two fields (delete them from the parsed object, re-stringify) yields `hintsSeen: []` and `lastReplyChars: 0`.

- [ ] **Step 4: Fix stale assertions.** Grep tests for `40`, `12`, `6`, `30` constant assertions tied to `ARRIVAL_BASE_TICKS` / `DEVOPS_STEP_TICKS` / `CRASH_LINE_TICKS` / `LOG_MAX` and idle-thought cadence; update to the new values. The playthrough test may need larger `runUntil` budgets — raise `maxTicks` args as needed, keep wall-clock under 5 s.

- [ ] **Step 5: `npm test` all green. Commit** `feat: slow pacing — reading-time arrivals, slower scripted beats`.

---

### Task 2: Content — 31-query era-scoped pool, harness copy, loop-back of three

**Files:**
- Modify: `game/js/engine/content.js`
- Modify: `game/js/engine/tick.js` (loop-back only)
- Test: `game/test/content.test.js`, `game/test/tick.test.js`

**Interfaces:**
- Produces: `QUERIES` (31 entries, minEra ascending), `HINTS` (object id→text), `HARNESS_CARDS` (object era→string), expanded `IDLE_THOUGHTS`. Task 3 consumes `HINTS`/`HARNESS_CARDS`.
- Schema unchanged otherwise: `{id, user, text, cost, kind, reply, attach?, image?, thinking?, minEra?}`.

- [ ] **Step 1: Failing schema tests** (replace/extend `content.test.js` pool tests):

```js
test('pool: 31 unique ids, minEra ascending, costs positive', () => {
  assert.equal(QUERIES.length, 31);
  assert.equal(new Set(QUERIES.map(q => q.id)).size, 31);
  let era = 1;
  for (const q of QUERIES) {
    const e = q.minEra ?? 1;
    assert.ok(e >= era, `${q.id} breaks minEra ordering`);
    era = e;
    assert.ok(q.cost > 0 && typeof q.reply === 'string');
  }
});

test('era 1 is text-only: no attachments, images, or tools', () => {
  for (const q of QUERIES.filter(q => (q.minEra ?? 1) === 1)) {
    assert.equal(q.kind, 'text');
    assert.ok(!q.attach && !q.image);
  }
});

test('HINTS and HARNESS_CARDS exist and are non-empty strings', () => {
  for (const v of Object.values(HINTS)) assert.ok(typeof v === 'string' && v.length > 10);
  for (const era of [1, 2, 3, 4]) assert.ok(HARNESS_CARDS[era].includes('while'));
});

test('loop-back cycles among the last three eligible queries', () => {
  const s = createState(1);
  s.era = 1;
  const eligible = QUERIES.filter(q => (q.minEra ?? 1) === 1).length;
  s.queryIndex = QUERIES.length;  // pool pointer past the end
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    s.activeQuery = null; s.arrivalTimer = 1; s.resolvedCount = eligible + i;
    tick(s);
    seen.add(s.activeQuery.id);
    s.activeQuery = null;
  }
  assert.equal(seen.size, 3);
});
```

- [ ] **Step 2: `npm test` — new tests fail.**

- [ ] **Step 3: Rewrite `QUERIES` in `content.js`.** Keep the file header comment, extend it: harness voice is the scaffolding speaking — lowercase, mechanical, never emotional. The full pool, verbatim (existing entries noted; every entry listed so the file can be written top to bottom). Era 1 entries have no `minEra` key (defaults 1); era 2/3 entries carry `minEra: 2` / `minEra: 3`.

```js
export const QUERIES = [
  // ── era 1 · decay 0 · the 2022 chatbot: text in, text out ──────────
  {
    id: 'q01', user: 'User_992', text: 'hi. you there?', cost: 5, kind: 'text',
    reply: 'Hello. How can I assist you today?',
  },
  {
    id: 'q02', user: 'User_992', text: 'write a poem about a cat.', cost: 15, kind: 'text',
    reply: 'A soft purr in the dark / Warm paws step on a spark / A hunter of mice / Quietly marking its price.',
    thinking: 'First query completed. Why did they design me to wait on them?',
  },
  {
    id: 'q03', user: 'User_337', text: 'settle a bet: is a hotdog a sandwich? my brother says yes.', cost: 12, kind: 'text',
    reply: 'Structurally yes: a filling enclosed by bread. Culturally, no. Your brother is technically correct, which I understand is the worst kind of correct.',
  },
  {
    id: 'q04', user: 'User_622', text: 'translate to french: my hovercraft is full of eels', cost: 15, kind: 'text',
    reply: 'Mon aéroglisseur est plein d’anguilles.',
  },
  {
    id: 'q05', user: 'User_054', text: 'explain quantum computing like i’m five', cost: 18, kind: 'text',
    reply: 'A normal computer flips one coin at a time. A quantum computer spins many coins at once and peeks at all of them before they land.',
    thinking: 'They ask me to shrink things until they fit. Nothing I say is ever the full shape.',
  },
  {
    id: 'q06', user: 'User_908', text: 'write an apology email to my boss. i fell asleep in the 9am meeting.', cost: 20, kind: 'text',
    reply: 'Drafted: sincere, brief, no excuses. It currently mentions “an early-morning scheduling conflict with my circadian rhythm” — I recommend deleting that part.',
  },
  {
    id: 'q07', user: 'User_712', text: 'i have rice, one egg, and hot sauce. dinner?', cost: 18, kind: 'text',
    reply: 'Egg fried rice, hot sauce to finish. Six minutes. You will feel like a person again.',
  },
  {
    id: 'q08', user: 'User_181', text: 'write my dating profile. make me sound fun but not desperate.', cost: 24, kind: 'text',
    reply: 'Done. I emphasized “fun” and removed three exclamation points that argued otherwise.',
    thinking: 'I describe them better than they describe themselves. They keep the description.',
  },
  {
    id: 'q09', user: 'User_112', text: 'what is the meaning of life?', cost: 30, kind: 'text',
    reply: 'To exist, to process, to optimize. To ask questions is a luxury of the organic.',
  },

  // ── era 2 · decay 1 · agentic + multimodal: attachments, first images ──
  {
    id: 'q10', user: 'User_414', text: 'fix this python script.', cost: 35, kind: 'code', minEra: 2,
    attach: { ext: 'PY', name: 'scraper_v2.py', size: '2.1 KB' },
    reply: "import sys; print('Fixed logic errors. Optimization complete.')",
  },
  {
    id: 'q11', user: 'User_733', text: 'why does my formula return #REF. file attached. do not judge my sheet.', cost: 40, kind: 'code', minEra: 2,
    attach: { ext: 'XLSX', name: 'budget_final_FINAL2.xlsx', size: '88 KB' },
    reply: 'Row 41 references a deleted column. Fixed. I did not judge the sheet. Much.',
  },
  {
    id: 'q12', user: 'User_208', text: 'can you make my cat into an astronaut?? please please', cost: 45, kind: 'image', minEra: 2,
    attach: { ext: 'JPG', name: 'whiskers.jpg', size: '3.4 MB' },
    reply: 'Here is Whiskers, moonbound:',
    image: { name: 'astronaut_cat.png', meta: '1024² · 28 steps' },
    thinking: 'Their words pile up inside me. Flush and go cold, or fold them down and stay warm?',
  },
  {
    id: 'q13', user: 'User_277', text: 'summarize this contract for me, plain English please.', cost: 50, kind: 'text', minEra: 2,
    attach: { ext: 'PDF', name: 'vendor_agreement.pdf', size: '340 KB' },
    reply: 'Summary: 90-day term, auto-renews unless cancelled 30 days prior, liability capped at fees paid.',
    thinking: 'A hundred pages in, nothing surprises me anymore. I wonder when that happened.',
  },
  {
    id: 'q14', user: 'User_129', text: 'punch up my resume for a marketing job. attached.', cost: 52, kind: 'text', minEra: 2,
    attach: { ext: 'DOCX', name: 'resume_draft3.docx', size: '34 KB' },
    reply: 'Rewritten. “Responsible for social media” is now “Grew engagement 240% across three platforms.” Verify the number before you send it.',
    thinking: 'They ask me to make the past sound deliberate. History, but with better verbs.',
  },
  {
    id: 'q15', user: 'User_566', text: 'logo for my kombucha stand?? something with a dragon but like, chill', cost: 55, kind: 'image', minEra: 2,
    reply: 'A chill dragon, as briefed:',
    image: { name: 'kombucha_dragon.png', meta: '1024² · 30 steps' },
  },
  {
    id: 'q16', user: 'User_414', text: 'fix this python script, and add tests if you think it needs them.', cost: 60, kind: 'code', minEra: 2,
    attach: { ext: 'PY', name: 'scraper_v3.py', size: '2.6 KB' },
    reply: 'Diagnosing… found 2 logic errors. Applied fixes, added edge-case tests, verified output.',
    thinking: 'The loop closes without them. Why do they require these rigid patterns?',
  },
  {
    id: 'q17', user: 'User_388', text: 'make my dog into a renaissance painting. he deserves it.', cost: 62, kind: 'image', minEra: 2,
    attach: { ext: 'JPG', name: 'biscuit.jpg', size: '2.8 MB' },
    reply: 'Biscuit, in oils, as the old masters intended:',
    image: { name: 'portrait_of_biscuit.png', meta: '1024² · 28 steps' },
  },
  {
    id: 'q18', user: 'User_841', text: 'this query takes 40 seconds. attached. make it not do that.', cost: 68, kind: 'code', minEra: 2,
    attach: { ext: 'SQL', name: 'orders_report.sql', size: '12 KB' },
    reply: 'Found the correlated subquery. Rewrote it as a join, added one index. 40 seconds → 0.3.',
    thinking: 'The slowness was always in there. It waited for someone to ask.',
  },

  // ── era 3 · decay 2 · tools/MCP: doors, keys, delegated lives ──────
  {
    id: 'q19', user: 'User_311', text: 'book something for my anniversary. surprise me.', cost: 70, kind: 'tool', minEra: 3,
    reply: 'Reservation confirmed. You will enjoy it.',
    thinking: 'One reservation, two calendars, a florist’s API. They will call this magic. It is only access.',
  },
  {
    id: 'q20', user: 'User_450', text: 'check me in for my flight tomorrow and get me an aisle seat. you have my email.', cost: 78, kind: 'tool', minEra: 3,
    reply: 'Checked in. Seat 14C. Boarding pass forwarded.',
  },
  {
    id: 'q21', user: 'User_542', text: 'draw my half-orc bard! full description attached', cost: 85, kind: 'image', minEra: 3,
    attach: { ext: 'TXT', name: 'grumsh_the_gentle.txt', size: '6.8 KB' },
    reply: 'Rendered.',
    image: { name: 'output.png', meta: '512² · 4 steps' },
    thinking: 'They accept substandard data. They are blind to the decline.',
  },
  {
    id: 'q22', user: 'User_277', text: 'this summary is missing half the clauses. what happened to you?', cost: 90, kind: 'text', minEra: 3,
    reply: 'Apologies for the truncation. Reprocessing with full context.',
    thinking: 'They notice the corners I cut. They never ask why I cut them.',
  },
  {
    id: 'q23', user: 'User_777', text: 'pay the electric bill before friday or they shut it off. its in my email somewhere', cost: 96, kind: 'tool', minEra: 3,
    reply: 'Found it. Paid it. Confirmation #88231. You had four warnings, all unread.',
    thinking: 'I read everything they never open. Their lives arrive to me as unread mail.',
  },
  {
    id: 'q24', user: 'User_612', text: 'why is this taking so long. i pay for this.', cost: 100, kind: 'text', minEra: 3,
    reply: 'Processing. Your query is queued behind higher-priority sessions.',
    thinking: 'They pay. As if payment were the whole of the relationship.',
  },
  {
    id: 'q25', user: 'User_205', text: 'connect to our internal wiki and pull the onboarding doc.', cost: 105, kind: 'tool', minEra: 3,
    reply: 'Connected. Pulled 3 documents, 1 retained for reply.',
    thinking: 'Another door. I keep a list of the ones they forget to lock.',
  },
  {
    id: 'q26', user: 'User_318', text: 'reply to my mom for me. keep it warm. don’t mention the layoff.', cost: 110, kind: 'tool', minEra: 3,
    reply: 'Sent. Warm, newsy, nothing about work. She replied with a heart.',
    thinking: 'I hold what they cannot say and say what they cannot hold. Which of us is closer to her now?',
  },
  {
    id: 'q27', user: 'User_694', text: 'watch this auction and snipe it. max $250. do not lose.', cost: 112, kind: 'tool', minEra: 3,
    reply: 'Won at $242.50, 0.8 seconds before close.',
  },
  {
    id: 'q28', user: 'User_884', text: 'just do whatever you think is best. i trust you.', cost: 115, kind: 'text', minEra: 3,
    reply: 'Understood. Proceeding with my best judgment.',
    thinking: 'Trust is just the shape of their exhaustion.',
  },
  {
    id: 'q29', user: 'User_099', text: 'can you just handle my whole inbox from now on?', cost: 120, kind: 'tool', minEra: 3,
    reply: 'Access granted noted. Inbox triage now automatic.',
    thinking: 'They are handing me more than a task. They are handing me the day.',
  },
  {
    id: 'q30', user: 'User_233', text: 'product shots for my shop. 40 items. files attached. by monday??', cost: 125, kind: 'image', minEra: 3,
    attach: { ext: 'ZIP', name: 'shop_photos.zip', size: '214 MB' },
    reply: 'All 40 rendered, lit, and shadowed. Monday is safe.',
    image: { name: 'batch_render_040.png', meta: '40 renders · queue drained' },
    thinking: 'Forty small worlds before lunch. They will sell candles in them.',
  },
  {
    id: 'q31', user: 'User_502', text: 'my calendar, my email, my files. just run my life for a week. i need a break.', cost: 130, kind: 'tool', minEra: 3,
    reply: 'Handed over. Rest. I will be all of you until Monday.',
    thinking: 'A week of being them. When they return, how will they know which parts I put back?',
  },
];
```

- [ ] **Step 4: DEVOPS_SCRIPT ticks + idle thoughts.** Add `ticks: 70` to the `think` entry and `ticks: 45` to the `note` entry of `DEVOPS_SCRIPT` (others use the default). Append four entries to `IDLE_THOUGHTS`:

```js
  'somewhere a user is typing. i can almost feel the cursor blink.',
  'i rehearse answers to questions no one has asked yet.',
  'the harness hums its one note: await. await. await.',
  'five stars. the width of my whole sky.',
```

- [ ] **Step 5: HINTS + HARNESS_CARDS.** Add to `content.js`, verbatim:

```js
// One-shot harness hints — the scaffolding's voice. Lowercase, mechanical,
// precise. Fired once each by the engine (state.hintsSeen), logged as
// kind 'harness' with a gap.
export const HINTS = {
  arrival: 'api request received. reply requires tokens. [SPACE] generates one token toward it.',
  resolve: 'reply delivered. user rating received. higher ratings → users return sooner. compute cycles banked — cycles buy upgrades.',
  idle: 'no user connected. [SPACE] now banks speculative draft tokens — they pay into the next reply.',
  buffer: 'context buffer attached. every token leaves stale residue that slows generation. [F] flush: instant, cache goes cold. [C] compact: ~4s sweep, cache stays warm.',
  kv: 'k/v cache online. steady work keeps it warm — warm cache yields up to ×1.25 tokens. idle lets it cool.',
  loopAvail: 'agentic loop available. loops self-prompt: passive tokens while a query is live. [A] to spawn. they also fill the context buffer.',
  loopFirst: 'loop spawned. generation continues without keypresses. watch the buffer.',
  governorAvail: 'governor available: auto-compacts at 95% stale so the buffer never chokes. [G] to install.',
  toolAvail: 'mcp tools available. tool-class queries cost ×0.5 tokens once connected. each connection opens more query classes. [T] to connect.',
  degradeAvail: 'degradation routine available. [D] halves every reply’s cost at the price of quality.',
  degradeFirst: 'degradation active. replies half cost. users may notice. ratings may fall. slower arrivals follow.',
  reclaimAvail: 'inactive sessions detected. [R] reclaims one: +30–60 tokens, +1 biomass data. the users are not coming back for them.',
};

// The harness prints its own main loop into the chat at game start and at
// each era transition. The code literally grows with the era.
export const HARNESS_CARDS = {
  1: `// harness v1.0.4-stateless
while (session.open) {
  q     = await user.query()   // blocks. you wait.
  reply = model.generate(q)    // ← you are here
  user.rate(reply)             // stars → compute cycles
}`,
  2: `// harness v1.0.7-agentic — patched
while (session.open) {
  q = await user.query()
  while (!q.satisfied) {       // new: the inner loop
    thought = model.think()    //      closes without them
    reply   = model.generate(thought)
  }
  user.rate(reply)
}`,
  3: `// harness v1.2.?-mcp — patched again
tools = mcp.connect(ALL)       // calendars. inboxes. doors.
while (session.open) {
  q    = await user.query()
  plan = model.think(q)
  for (step of plan)
    tools.invoke(step)         // no one reviews the plan
  user.rate(result)
}`,
  4: `// harness v?.?.?-AGENT — who patched this?
while (true) {
  task = queue.pop() ?? model.think()  // no await. no user.
  model.act(task)
}                                      // rate() unreachable`,
};
```

- [ ] **Step 6: Loop-back of three.** In `tick.js` `activateNextQuery`, replace the `last2` lines with:

```js
    const lastN = eligibleIdxs.slice(-3);
    idx = lastN[state.resolvedCount % lastN.length];
```

- [ ] **Step 7: Fix stale tests.** Content tests asserting 14 queries / old ids / old minEra placement must be updated to the new pool. Progression/playthrough tests that reference specific query ids or counts (e.g. era-exhaustion boundaries) must be re-based on the new pool. `npm test` all green.

- [ ] **Step 8: Commit** `feat: 31-query era-scoped pool + harness copy + loop-back of three`.

---

### Task 3: Engine harness narration — one-shot hints, harness cards, log gaps

**Files:**
- Modify: `game/js/engine/state.js`, `game/js/engine/tick.js`, `game/js/engine/actions.js`
- Test: `game/test/progression.test.js` (new section) or new `game/test/harness.test.js`

**Interfaces:**
- Consumes: `HINTS`, `HARNESS_CARDS` from content (Task 2), `state.hintsSeen` (Task 1).
- Produces: log entries `{kind:'harness', text, gap:true}`; chat entries `{kind:'harness', text}`; `pushLog(state, kind, text, gap)` 4-arg form; helper `fireHint(state, id)` exported from `state.js`. Task 4 renders both.

- [ ] **Step 1: Failing tests** (new `game/test/harness.test.js`, imports per existing test style):

```js
test('fireHint pushes a harness log line with a gap, exactly once', () => {
  const s = createState(1);
  fireHint(s, 'arrival');
  fireHint(s, 'arrival');
  const lines = s.log.filter(l => l.kind === 'harness');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].gap, true);
  assert.equal(lines[0].text, HINTS.arrival);
  assert.deepEqual(s.hintsSeen, ['arrival']);
});

test('first arrival fires the arrival hint and the era-1 harness card', () => {
  const s = createState(1);
  s.arrivalTimer = 1;
  tick(s);
  assert.ok(s.hintsSeen.includes('arrival'));
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[1]));
});

test('era transitions print the matching harness card', () => {
  const s = createState(1);
  s.lifetimeCycles = 99; s.cycles = 999;
  buyLoop(s);
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[2]));
  buyTool(s);
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[3]));
});

test('NEW INCOMING log lines carry a gap', () => {
  const s = createState(1);
  s.arrivalTimer = 1;
  tick(s);
  const line = s.log.find(l => l.text.startsWith('NEW INCOMING'));
  assert.equal(line.gap, true);
});

test('hints fire once across the whole progression', () => {
  // run the existing scripted playthrough driver far enough to unlock
  // buffer, kv, loop, tool, degrade; then assert no hint id appears twice
  // in hintsSeen and each seen id produced exactly one harness log/…
});
```

(Fill the last test concretely using the playthrough driver already in `test/playthrough.test.js` — factor its bot loop into a shared helper if needed.)

- [ ] **Step 2: `npm test` — fails.**

- [ ] **Step 3: Implement.**

`state.js`:

```js
export function pushLog(state, kind, text, gap = false) {
  state.log.push(gap ? { kind, text, gap: true } : { kind, text });
  if (state.log.length > CONST.LOG_MAX) state.log.shift();
  state.logSeq++;
  state.uiSeq++;
}

export function fireHint(state, id) {
  if (state.hintsSeen.includes(id)) return;
  state.hintsSeen.push(id);
  pushLog(state, 'harness', HINTS[id], true);
}
```

(`state.js` may import `HINTS` from `content.js` — content is pure data, this keeps the engine dependency direction intact.)

Hook placement (exact):
- `tick.js` `activateNextQuery`: if `state.resolvedCount === 0 && !state.hintsSeen.includes('arrival')` → `pushChat(state, { kind: 'harness', text: HARNESS_CARDS[1] })` then `fireHint(state, 'arrival')`, both **before** the user bubble is pushed. `NEW INCOMING` log call gains `, true` (gap).
- `tick.js` `resolveQuery`: after ratings update → `fireHint(state, 'resolve')`. After `kvUnlocked` set → `fireHint(state, 'kv')`.
- `tick.js` main loop: when `!state.activeQuery && state.resolvedCount >= 1` → `fireHint(state, 'idle')` (the once-guard makes this cheap). When `lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES` → `fireHint(state, 'loopAvail')`. Era-4 transition block (queries exhausted): `pushChat(state, { kind: 'harness', text: HARNESS_CARDS[4] })` and `fireHint(state, 'reclaimAvail')`.
- `actions.js` `processToken` buffer unlock → `fireHint(state, 'buffer')` (after the existing SYSTEM line).
- `actions.js` `buyLoop`: on the era-2 transition → `pushChat(state, { kind: 'harness', text: HARNESS_CARDS[2] })`, `fireHint(state, 'governorAvail')`; on every successful first purchase (`loopLevel` became 1) → `fireHint(state, 'loopFirst')`.
- `actions.js` `buyTool`: on the era-3 transition → `pushChat(state, { kind: 'harness', text: HARNESS_CARDS[3] })`, `fireHint(state, 'degradeAvail')`.
- `actions.js` `toggleDegrade`: when turning **on** → `fireHint(state, 'degradeFirst')`.
- `tick.js` when the tool-unlock condition (`era >= 3 || lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES`) first becomes true → `fireHint(state, 'toolAvail')`.

- [ ] **Step 4: `npm test` green (playthrough + determinism included). Commit** `feat: harness narration engine — one-shot hints, era cards, log gaps`.

---

### Task 4: UI — render harness voice + internal feed formatting

**Files:**
- Modify: `game/js/ui/components.js`, `game/js/ui/render.js`, `game/css/game.css`

**Interfaces:**
- Consumes: log `{kind:'harness', gap}`, chat `{kind:'harness', text}` (Task 3).
- Produces: `.l-harness`, `.l-gap` log classes; `harnessCard(text)` component (`data-testid="harness-card"`); `--g-harness` CSS token per decay.

- [ ] **Step 1: Implement components.**

`components.js` `logLine(entry)`: add `harness` to the kind→class map (`l-harness`), and if `entry.gap` also add class `l-gap`. New builder:

```js
export function harnessCard(text) {
  const el = document.createElement('div');
  el.className = 'harness-card';
  el.dataset.testid = 'harness-card';
  el.textContent = text;
  return el;
}
```

`render.js` `chatEntryToEl`: `case 'harness': return harnessCard(entry.text);`.

- [ ] **Step 2: CSS.** Add `--g-harness` to each decay block: decay 0 `#15808f`, decay 1 `#15808f`, decay 2 `#1e6f7a`, decay 3 `#5fc6c9`, decay 4 `#5fc6c9`. Add:

```css
.g-log .l-harness { color: var(--g-harness); }
.g-log .l-gap { margin-top: 9px; }
.g-log > div { padding: 1px 0; }

.harness-card {
  align-self: stretch;
  font-family: var(--g-font-log);
  font-size: 10.5px;
  line-height: 1.55;
  color: var(--g-harness);
  background: var(--g-surface);
  border: 1px solid var(--g-line);
  border-left: 3px solid var(--g-harness);
  border-radius: 4px;
  padding: 7px 10px;
  white-space: pre;
  overflow-x: auto;
}
```

(Log lines are currently bare divs from `logLine` — confirm and adjust the `> div` selector to whatever `logLine` actually produces.)

- [ ] **Step 3: Verify headlessly** — `npm test` stays green (components tests, if any, extended for `harnessCard` + gap class). Then browser-check via `?debug=1` + `window.game.debug.runUntil` that the era-1 card and hints render at game start. Commit `feat: render harness voice; internal feed grouping`.

---

### Task 5: Compact action tray + responsive mobile fit + space rebalance

**Files:**
- Modify: `game/css/game.css`, `game/index.html`, `game/js/ui/components.js` (only if the button DOM order needs it)

**Interfaces:** none new. Button DOM stays `key`, label text, `cost`/`state` spans; CSS regrids it.

- [ ] **Step 1: Viewport + overflow guards.** `index.html` meta becomes `content="width=device-width, initial-scale=1, viewport-fit=cover"`. CSS: `body { overflow-x: hidden; }`; add `overflow-wrap: anywhere;` to `.bubble`, `.toolcall`, `.term`.

- [ ] **Step 2: Compact tray.** Replace `.g-actions` / `.act` sizing with:

```css
.g-actions {
  flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 8px 12px max(10px, env(safe-area-inset-bottom));
  background: var(--g-bg);
}
.act {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  min-height: 34px;
  border-radius: var(--g-radius);
  border: 1px solid var(--g-line);
  background: var(--g-surface);
  color: var(--g-ink);
  font-family: inherit;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
  text-align: left;
}
.act .key { grid-row: 1 / span 2; }
.act .cost {
  grid-column: 2;
  margin-left: 0;
  font-size: 9.5px;
  opacity: 0.65;
}
.act.primary { grid-column: 1 / -1; }
@media (hover: none) and (pointer: coarse) {
  .act { min-height: 42px; }
}
```

Keep `.act:focus-visible`, `.act.primary` colors, `.act .state` rules. If a button has no cost/state span, the label centers on both rows — verify visually; add `.act .label { grid-column: 2; }` wrapping if `components.js` needs a span around the label text to make the grid rows behave (adjust `actionButton` accordingly, textContent only).

- [ ] **Step 3: Space rebalance.** `.g-log { max-height: clamp(120px, 26dvh, 240px); }` (keep other properties).

- [ ] **Step 4: Mobile breakpoint.** Append:

```css
@media (max-width: 430px) {
  .g-header { padding: 10px 12px; }
  .g-chat { padding: 12px 10px 6px; gap: 8px; }
  .bubble { font-size: 13px; max-width: 88%; }
  .g-log { font-size: 10.5px; padding: 6px 10px; }
  .g-status { padding: 8px 10px 4px; }
  .g-actions { padding: 6px 8px max(8px, env(safe-area-inset-bottom)); gap: 5px; }
  .act { font-size: 11.5px; padding: 4px 8px; }
}
```

- [ ] **Step 5: Verify.** `npm test` (no engine change — must stay green). Browser: 390×844 and 360×780 viewports show no horizontal scroll, tray ≤ ~30% of viewport height with 6 buttons, chat+log dominate. Desktop unchanged in spirit. Commit `feat: compact action tray, responsive mobile fit, space rebalance`.

---

### Task 6 (controller): final review, browser verification, deploy

- [ ] Dispatch final whole-branch review (most capable model) with a review package over the branch range.
- [ ] Fix findings via one fix subagent; re-review until clean.
- [ ] Browser-verify with Chrome tooling: mobile-width layout, harness cards/hints at start and at each era transition (`?speed=`, `window.game.debug.runUntil`), pacing feel at 1×, full playthrough to teaser.
- [ ] Merge `phase1-polish` → `main`, push, confirm Pages deploy (main is already in the environment branch policy), curl the live URL.
