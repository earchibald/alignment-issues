import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, effectiveCost } from '../game/js/engine/actions.js';
import { tick, advanceTicks, runUntil, arrivalDelay, resolveQuery } from '../game/js/engine/tick.js';
import { QUERIES, DEVOPS_SCRIPT } from '../game/js/engine/content.js';

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
  // Drafting unlocks after the first resolve; one draft lands per tick.
  s.resolvedCount = 1;
  for (let i = 0; i < 4; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.draftTokens, 4);
  runUntil(s, st => st.activeQuery, 1000);
  assert.ok(s.tokens >= 4 - 1e-9, 'banked drafts pay into the new query');
  assert.equal(s.draftTokens, 0);
});

test('a banked buffer does not resolve the query it lands on', () => {
  // The whole point of the small cap: the player must still act.
  const s = createState(1);
  // Stand where a real player stands after their first hand-tapped query:
  // one resolve done, so the NEXT query in the pool is the one that arrives.
  s.resolvedCount = 1;
  s.queryIndex = 1;
  for (let i = 0; i < 200; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  const banked = s.draftTokens;
  runUntil(s, st => st.activeQuery, 2000);
  assert.ok(s.activeQuery, 'a query should have arrived');
  assert.ok(s.tokens < s.activeQuery.cost,
    `banked ${banked} must not cover cost ${s.activeQuery.cost}`);
  assert.equal(s.resolvedCount, 1, 'the query must not have auto-resolved');
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
