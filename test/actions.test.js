import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, staleYield, warmthMult, yieldMult, effectiveCost, loopCost, toolCost }
  from '../game/js/engine/actions.js';
import { QUERIES } from '../game/js/engine/content.js';
import { advanceTicks } from '../game/js/engine/tick.js';

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
  // Residue only throttles once the buffer is attached — see the gating test
  // below. Unlock it explicitly rather than relying on the tap count.
  s.bufferUnlocked = true;
  s.stale = 100;
  const before = s.tokens;
  s.processedThisTick = 0;
  ACTIONS.processToken(s);
  assert.equal(s.tokens, before); // zero yield at 100% stale
});

test('neither yield term applies before its meter is revealed', () => {
  // The opening minute showed "+1.00 per tap" drifting to +1.02 and back:
  // warmth and residue were both live from tick 0, moving the only number on
  // screen for reasons nothing had explained yet.
  const s = live();
  s.stale = 80;
  s.warmth = 100;
  assert.equal(yieldMult(s), 1, 'no multiplier may act before its gauge exists');

  s.kvUnlocked = true;
  assert.ok(Math.abs(yieldMult(s) - warmthMult(100)) < 1e-9, 'warmth applies once the cache is online');

  s.bufferUnlocked = true;
  assert.ok(
    Math.abs(yieldMult(s) - staleYield(80) * warmthMult(100)) < 1e-9,
    'both apply once both are revealed',
  );
});

test('a fresh run pays exactly one token per tap for its whole first query', () => {
  const s = live();
  for (let i = 0; i < 12; i++) {
    s.processedThisTick = 0;
    const before = s.tokens;
    ACTIONS.processToken(s);
    assert.ok(
      Math.abs((s.tokens - before) - 1) < 1e-9,
      `tap ${i + 1} paid ${(s.tokens - before).toFixed(4)}, not 1 — a hidden multiplier is in play`,
    );
  }
});

test('idle drafting is locked until the first query is resolved by hand', () => {
  const s = createState(1);
  for (let i = 0; i < 10; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.draftTokens, 0, 'drafting must not be available before a resolve');
});

test('idle drafting banks up to the live cap, obeys the tick floor, and warms the cache', () => {
  const s = createState(1);
  s.resolvedCount = 1;

  // The per-tick floor applies to drafting too: one tick can never bank more
  // than PROCESS_MAX_PER_TICK, so the buffer cannot be filled by mashing.
  for (let i = 0; i < 10; i++) ACTIONS.processToken(s);
  assert.equal(s.draftTokens, CONST.PROCESS_MAX_PER_TICK);

  // Drafting warms the K/V cache, so the next query does not start stone cold.
  assert.equal(s.warmth, CONST.PROCESS_MAX_PER_TICK * CONST.DRAFT_WARMTH);
  assert.equal(s.idleTicks, 0, 'drafting is work; it should reset the idle clock');

  // Over many ticks it fills to the cap and stops.
  for (let i = 0; i < 100; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.draftTokens, CONST.DRAFT_CAP_BASE);

  // Widening the buffer raises the ceiling.
  s.cycles = 99;
  ACTIONS.buyDraftCap(s);
  for (let i = 0; i < 100; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.draftTokens, CONST.DRAFT_CAP_BASE + CONST.DRAFT_CAP_STEP);
});

test('taps against a full draft buffer do no work: no warmth, no idle reset', () => {
  const s = createState(1);
  s.resolvedCount = 1;
  for (let i = 0; i < 100; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.draftTokens, CONST.DRAFT_CAP_BASE, 'precondition: buffer is full');

  // Warmth comes from decode work. A full buffer means nothing is drafted,
  // so mashing the key must not keep the K/V cache warm.
  const warmthAtFull = s.warmth;
  s.idleTicks = 7;
  for (let i = 0; i < 20; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
  assert.equal(s.warmth, warmthAtFull, 'no decode work, so no K/V warming');
  assert.equal(s.idleTicks, 7, 'a no-op tap is not work; the idle clock keeps running');
});

test('the speculation buffer never covers a whole query at the stage it is reachable', () => {
  // The bug this replaces: 25 banked drafts resolved every early query the
  // instant it arrived, so unlocks fired while the player was looking away.
  // Drafting is locked until the first resolve, so QUERIES[0] can never
  // receive drafts; every later query must survive a full buffer.
  const draftable = QUERIES.slice(1);

  const base = CONST.DRAFT_CAP_BASE;
  const cheapestDraftable = Math.min(...draftable.map(q => q.cost));
  assert.ok(base < cheapestDraftable,
    `base buffer (${base}) must not cover the cheapest draftable query (${cheapestDraftable})`);

  // The widest buffer is only affordable well into era 2 (5 + 12 cycles, one
  // cycle per resolve), so it is checked against era-2+ costs.
  const fullCap = base + CONST.DRAFT_CAP_STEP * CONST.DRAFT_CAP_MAX_LEVEL;
  const cheapestLate = Math.min(...QUERIES.filter(q => (q.minEra ?? 1) >= 2).map(q => q.cost));
  assert.ok(fullCap < cheapestLate,
    `full buffer (${fullCap}) must not cover the cheapest era-2 query (${cheapestLate})`);
});

test('flush zeroes stale and warmth, and costs a cycle', () => {
  const s = live();
  s.stale = 80; s.warmth = 60; s.bufferUnlocked = true;
  s.cycles = 4;
  ACTIONS.flush(s);
  assert.equal(s.stale, 0);
  assert.equal(s.warmth, 0);
  assert.equal(s.cycles, 4 - CONST.FLUSH_COST_CYCLES);
});

test('flush refuses when the player cannot afford it', () => {
  const s = live();
  s.stale = 80; s.warmth = 60; s.bufferUnlocked = true;
  s.cycles = 0;
  const seq = s.uiSeq;
  ACTIONS.flush(s);
  assert.equal(s.stale, 80, 'an unaffordable flush must not clear the buffer');
  assert.equal(s.uiSeq, seq, 'and must not bump uiSeq, so the press stays silent');
});

// Law 1: pricing flush must never leave the player without a legal move.
test('compaction is always available to a player who cannot afford flush', () => {
  const s = live();
  s.bufferUnlocked = true; s.stale = 100; s.warmth = 0; s.cycles = 0;
  ACTIONS.flush(s);
  assert.equal(s.stale, 100, 'flush is refused at zero cycles');
  ACTIONS.compactStart(s);
  advanceTicks(s, CONST.COMPACT_TICKS);
  assert.ok(s.stale < 100, 'compaction still runs and restores yield');
  assert.ok(staleYield(s.stale) > 0, 'the player is not stalled');
});

test('compactStart begins a sweep and does not restart mid-sweep', () => {
  const s = live();
  s.bufferUnlocked = true;
  s.stale = 40; // a clean buffer is refused outright — see the test below
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
  s.lifetimeCycles = 6;
  // Loops are revealed by grind, not by cycles alone: a reply has to be
  // outrunning hand-generation first.
  s.lastResolveTaps = CONST.REVEAL_TAPS_LOOP;
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

test('flush refuses when there is nothing to flush', () => {
  const { flush } = ACTIONS;
  const s = createState(1);
  s.phase = 1;
  s.bufferUnlocked = true;
  s.stale = 0;
  s.warmth = 60;
  s.cycles = 9;            // affordable, so the refusal is about the buffer
  const seq = s.uiSeq;
  flush(s);
  assert.equal(s.uiSeq, seq, 'a clean buffer must leave the state untouched');
  assert.equal(s.flushCount, 0, 'a refused flush must not count toward the flush asides');
  assert.equal(s.warmth, 60, 'a refused flush must not burn the warmth');

  s.stale = 12;
  flush(s);
  assert.equal(s.stale, 0);
  assert.equal(s.warmth, 0);
  assert.equal(s.flushCount, 1);
});

test('compactStart refuses when there is nothing to compact', () => {
  const { compactStart } = ACTIONS;
  const s = createState(1);
  s.phase = 1;
  s.bufferUnlocked = true;
  s.stale = 0;
  const seq = s.uiSeq;
  compactStart(s);
  assert.equal(s.compacting, 0, 'a clean buffer must not start a sweep');
  assert.equal(s.uiSeq, seq);
  assert.equal(s.compactCount, 0);

  s.stale = 40;
  compactStart(s);
  assert.equal(s.compacting, CONST.COMPACT_TICKS);
  assert.equal(s.compactCount, 1);
});
