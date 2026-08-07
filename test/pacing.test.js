// Pacing tests — the ones whose absence let a 25% arrival retune ship
// unmeasured, and silently revert era 3 from 4.66 min to 3.68 min.
//
// The old arrivalDelay test re-derived its expectation from CONST, so it
// passed tautologically for ANY value: nothing would have failed at
// ARRIVAL_BASE_TICKS 1 or 1000. These assert game-time outcomes instead, so a
// constant change that moves the shape of the act has to be argued for.
//
// Bounds are deliberately wide. They are a tripwire on the act's shape, not a
// lock on its tuning.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, loopCost, toolCost } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';

const SEEDS = [1000, 1137, 1274, 1411, 1548, 1685, 1822, 1959];
const SEC = (ticks) => (ticks * CONST.TICK_MS) / 1000;

// A competent player: taps at the engine's ceiling while a query is live, and
// buys the cheapest useful thing whenever it is affordable. Deliberately not
// optimal — an optimal policy is not what the pacing target describes.
function playRun(seed, { maxTicks = 60000 } = {}) {
  const s = createState(seed);
  const eraTicks = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let idleTicks = 0;
  let t = 0;

  for (; t < maxTicks && s.phase === 1; t++) {
    if (s.era >= 1 && s.era <= 4) eraTicks[s.era]++;

    if (s.activeQuery) {
      ACTIONS.processToken(s);
      ACTIONS.processToken(s);
      // Keep the buffer workable. Compact is free; flush is not.
      if (s.bufferUnlocked && s.stale >= 90) {
        if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
        else if (!s.compacting) ACTIONS.compactStart(s);
      }
    } else {
      // Dead time: idle, and the draft buffer has nothing left to take.
      const cap = CONST.DRAFT_CAP_BASE + s.draftCapLevel * CONST.DRAFT_CAP_STEP;
      if (s.draftTokens >= cap) idleTicks++;
      ACTIONS.processToken(s);
    }

    // Buy order matters: loops gate era 2 and tools gate era 3, so a policy
    // that only buys raw throughput never leaves era 2.
    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    } else if (s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    }
    tick(s);
  }
  return { state: s, ticks: t, eraTicks, idleTicks };
}

test('the arc completes from a cold save under a competent policy', () => {
  for (const seed of SEEDS) {
    const { state, ticks } = playRun(seed);
    assert.notEqual(state.phase, 1, `seed ${seed}: never left phase 1 in ${ticks} ticks`);
  }
});

test('total run length stays inside the pacing envelope', () => {
  const lengths = SEEDS.map((seed) => SEC(playRun(seed).ticks));
  const median = [...lengths].sort((a, b) => a - b)[Math.floor(lengths.length / 2)];
  // ~14-30 minutes to the crash. Wide on purpose; this catches an order-of-
  // magnitude retune, not a deliberate 10% trim.
  assert.ok(median > 800, `median run ${median.toFixed(0)}s is too short`);
  assert.ok(median < 1900, `median run ${median.toFixed(0)}s is too long`);
});

test('era 3 keeps the length it was deliberately given', () => {
  // Era 3 is the climax and was raised from 3.0 to ~4.7 min on purpose. The
  // -25% arrival retune reverted it to 3.68 without touching its own
  // constant, and nothing caught that. This is the tripwire.
  const era3 = SEEDS.map((seed) => SEC(playRun(seed).eraTicks[3]));
  const median = [...era3].sort((a, b) => a - b)[Math.floor(era3.length / 2)];
  assert.ok(median > 200, `era 3 median ${median.toFixed(0)}s — the climax is being rushed`);
});

test('no era is skipped', () => {
  for (const seed of SEEDS) {
    const { eraTicks } = playRun(seed);
    for (const era of [1, 2, 3, 4]) {
      assert.ok(eraTicks[era] > 0, `seed ${seed}: era ${era} got no time at all`);
    }
  }
});

test('dead time is measured and bounded', () => {
  // Idle with a full draft buffer is time in which the player has no move.
  // Arc 1 measures ~77% and that is a known, recorded problem (see
  // docs/design/arc1-review-integration.md §3.2 — the fix belongs to a
  // measured pass, not to a constant nudge). This asserts it does not get
  // WORSE, so the number has to be argued about before it moves.
  const fracs = SEEDS.map((seed) => {
    const r = playRun(seed);
    return r.idleTicks / r.ticks;
  });
  const worst = Math.max(...fracs);
  assert.ok(worst < 0.85, `dead time ${(worst * 100).toFixed(1)}% exceeds the recorded baseline`);
});
