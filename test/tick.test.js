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
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  s.rating = 5;
  assert.equal(
    arrivalDelay(s),
    Math.round(CONST.ARRIVAL_BASE_TICKS * clamp(1 / (0.5 + s.rating / 5), CONST.ARRIVAL_FACTOR_MIN, CONST.ARRIVAL_FACTOR_MAX))
  );
  s.rating = 0;
  assert.equal(
    arrivalDelay(s),
    Math.round(CONST.ARRIVAL_BASE_TICKS * clamp(1 / (0.5 + s.rating / 5), CONST.ARRIVAL_FACTOR_MIN, CONST.ARRIVAL_FACTOR_MAX))
  );
});

test('runUntil returns false when predicate never fires', () => {
  const s = createState(1);
  assert.equal(runUntil(s, () => false, 50), false);
  assert.equal(s.tick, 50);
});
