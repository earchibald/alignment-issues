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
import { botStep } from './helpers/bot.js';

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

// --- reveal cadence ---------------------------------------------------
// The design target is a sawtooth: effort per reply climbs until it is just
// short of annoying, then a mechanic lands and cuts it back. scripts/pacing.mjs
// measures it. These are the tripwires that keep the measurement honest, and
// they are written against the CURRENT baseline — which is bad — so that it
// can only ever improve.

const REVEALS = [
  'arrival', 'resolve', 'idle', 'buffer', 'kv', 'loopAvail', 'governorAvail',
  'toolAvail', 'degradeAvail', 'reclaimAvail', 'overclockAvail', 'draftCapAvail',
];

function revealTimes(seed) {
  const s = createState(seed);
  const seen = new Map();
  let n = 0;
  for (let t = 0; t < 90000 && s.phase === 1; t++) {
    if (s.activeQuery) {
      ACTIONS.processToken(s);
      ACTIONS.processToken(s);
      if (s.bufferUnlocked && s.stale >= 90) {
        if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
        else if (!s.compacting) ACTIONS.compactStart(s);
      }
    } else {
      ACTIONS.processToken(s);
    }
    tick(s);
    if (s.hintsSeen.length > n) {
      for (const id of s.hintsSeen.slice(n)) {
        if (REVEALS.includes(id) && !seen.has(id)) seen.set(id, SEC(s.tick));
      }
      n = s.hintsSeen.length;
    }
    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    }
  }
  return seen;
}

test('the opening does not get more front-loaded than it already is', () => {
  // Measured baseline: 9 of 12 reveals inside the first 66 seconds, while a
  // reply still costs 4-6 taps. Reported as "everything feels like it's
  // coming very quickly and that's just too much". This locks the ratchet:
  // the count may fall, never rise.
  const BASELINE = 9;
  for (const seed of SEEDS) {
    const early = [...revealTimes(seed).values()].filter((sec) => sec <= 90).length;
    assert.ok(
      early <= BASELINE,
      `seed ${seed}: ${early} reveals in the first 90s (baseline ${BASELINE}) — the opening got busier`,
    );
  }
});

test('effort per reply climbs across the run', () => {
  // The sawtooth's teeth must exist even if their spacing is still wrong: a
  // reply late in the arc has to cost meaningfully more manual work than one
  // at the start, or no reveal is relieving anything.
  //
  // The first version of this compared the first FIVE resolves against the
  // last five of a bot that bought nothing, never left era 1, and ran for a
  // thousand resolves. Two things were wrong with that. Residue oscillates,
  // so a five-resolve tail samples wherever the sawtooth happens to be — the
  // same code measured 23.2 and 32.4 taps depending only on phase. And a run
  // that never buys never advances an era, so it was measuring a flat
  // steady state, not the arc. Widening the window showed the "climb" it
  // asserted was 1.0x: the test passed on noise.
  //
  // Now: the real bot, which buys and reaches era 4, quartile windows wide
  // enough to average over the sawtooth, and every seed.
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  for (const seed of [1000, 1274, 1548, 1822]) {
    const s = createState(seed);
    const cost = [];
    let n = 0;
    let guard = 0;
    while (s.phase === 1 && guard++ < 400000) {
      botStep(s);
      tick(s);
      // lastResolveTaps is the engine's own count of landed manual presses,
      // which is also what the reveal predicates gate on. Counting them here
      // instead would be a second implementation of the same idea.
      if (s.resolvedCount > n) { n = s.resolvedCount; cost.push(s.lastResolveTaps); }
    }
    assert.ok(cost.length > 40, `seed ${seed}: only ${cost.length} resolves`);
    const q = Math.floor(cost.length / 4);
    const head = avg(cost.slice(0, q));
    const tail = avg(cost.slice(-q));
    assert.ok(tail > head * 1.6,
      `seed ${seed}: effort per reply barely moved: ${head.toFixed(1)} → ${tail.toFixed(1)} taps`);
  }
});
