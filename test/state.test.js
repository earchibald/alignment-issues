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
