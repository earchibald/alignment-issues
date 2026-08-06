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
