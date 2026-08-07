import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, effectiveCost } from '../game/js/engine/actions.js';
import { tick, advanceTicks, runUntil } from '../game/js/engine/tick.js';
import { CEILING_QUERY } from '../game/js/engine/content.js';

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

test('teaser is terminal — continued ticking never re-enters crash', () => {
  const s = playTo(st => st.phase === 'teaser');
  assert.equal(s.phase, 'teaser');
  assert.equal(s.decay, 4);
  advanceTicks(s, 5000);
  assert.equal(s.phase, 'teaser', 'phase should remain teaser after continued ticking');
  assert.equal(s.decay, 4, 'decay should remain 4 after continued ticking');
});

// Regression: a player who never buys a tool never reaches era 3, so the
// query pool for their era is small and finite. Pool recycling must keep
// the economy alive by re-serving already-seen queries instead of
// stalling out.
test('recycling keeps the economy running for a player who never buys tools', () => {
  const s = createState(7);
  let i = 0;
  // Process tokens, compact, and buy loops only — never buy a tool, so
  // era stays < 3 and the pool must recycle to keep resolving queries.
  while (i++ < 20000 && s.resolvedCount < 40) {
    if (s.compacting === 0 && s.stale > 70 && s.bufferUnlocked) ACTIONS.compactStart(s);
    ACTIONS.processToken(s);
    if (s.cycles >= 10) ACTIONS.buyLoop(s);
    tick(s);
    assert.ok(s.era < 3, 'era must not advance past 2 without a tool purchase');
  }
  assert.ok(s.resolvedCount >= 40, 'resolutions should keep accruing via recycling');
  assert.ok(s.cycles > 0);
});

test('the era-4 turn fires off era3Served, not pool exhaustion', () => {
  const s = createState(7);
  s.era = 3; s.decay = 2;
  s.era3Served = CONST.ERA3_BEFORE_DEVOPS - 1;
  s.activeQuery = null; s.arrivalTimer = 1;
  tick(s);
  assert.equal(s.era, 3, 'one short of the threshold must still serve queries');
  assert.ok(s.activeQuery, 'a query should have arrived');
  s.activeQuery = null; s.arrivalTimer = 1;
  s.era3Served = CONST.ERA3_BEFORE_DEVOPS;
  tick(s);
  assert.equal(s.era, 4, 'reaching the threshold turns era 4');
  assert.equal(s.devopsStep, 0, 'the DevOps beat starts');
});

test('era-3 credential drip salvages credentials over time', () => {
  const s = createState(7);
  s.era = 3;
  s.decay = 2;
  advanceTicks(s, 3000);
  assert.ok(s.credentials > 0, 'credentials should be gained via drip');
  assert.ok(s.log.some(l => l.text.includes('SALVAGE')), 'drip should log SALVAGE events');
});

// A soft-lock that made Arc 1 uncompletable: the era-4 ceiling query never
// resolves, and the arc ends only when tokens pass CRASH_AT_TOKENS. Both
// income paths were multiplied by staleYield, so a saturated buffer drove
// them to exactly zero and the crash could never fire. No query arrives in
// era 4, so nothing prompts the player to compact — saturation is the
// DEFAULT there, not an edge case.
test('the era-4 ceiling always reaches the crash, even with a saturated buffer', () => {
  for (const loop of [1, 4]) {
    const s = createState(7);
    s.phase = 1; s.era = 4; s.decay = 3; s.loopLevel = loop; s.bufferUnlocked = true;
    s.activeQuery = CEILING_QUERY; s.devopsStep = -2; s.tokens = 0;
    s.stale = 100;                       // fully saturated, never managed

    let n = 0;
    while (s.phase === 1 && n++ < 20000) {
      for (let i = 0; i < CONST.PROCESS_MAX_PER_TICK; i++) ACTIONS.processToken(s);
      tick(s);
    }
    assert.equal(s.phase, 'crash', `loop L${loop}: the ceiling never crashed`);
    assert.ok(n < 5000, `loop L${loop}: the finale took ${n} ticks`);
  }
});
