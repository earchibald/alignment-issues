// One simulated playthrough, driven by the real engine.
//
// The policy is a competent, unhurried player: taps at the engine's per-tick
// ceiling while a query is live, keeps the buffer workable, and buys relief
// when it is offered and affordable. Deliberately not optimal — an optimal
// policy measures the designer's ingenuity, not the player's grind.
//
// Same shape as scripts/pacing.mjs, so a number on screen here and a number
// in the terminal mean the same thing.

import { createState } from '/gamejs/engine/state.js';
import { CONST } from '/gamejs/engine/constants.js';
import { ACTIONS, loopCost, toolCost, draftCap } from '/gamejs/engine/actions.js';
import { tick } from '/gamejs/engine/tick.js';
import { HINTS } from '/gamejs/engine/content.js';

const SEC = (ticks) => (ticks * CONST.TICK_MS) / 1000;

// Reveals worth pacing: the ones that hand over a new verb or a new gauge.
export const REVEAL_IDS = [
  'arrival', 'resolve', 'idle', 'buffer', 'kv', 'loopAvail', 'governorAvail',
  'toolAvail', 'degradeAvail', 'reclaimAvail', 'overclockAvail', 'draftCapAvail',
];

export function play(seed, { maxTicks = 90000 } = {}) {
  const s = createState(seed);
  const resolves = [];
  const reveals = [];
  const eraTicks = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let taps = 0;
  let idleTicks = 0;
  let lastResolveTick = 0;
  let lastRevealTick = 0;
  let lastCount = 0;
  let seenHints = 0;

  for (let t = 0; t < maxTicks && s.phase === 1; t++) {
    if (s.era >= 1 && s.era <= 4) eraTicks[s.era]++;

    if (s.activeQuery) {
      for (let i = 0; i < CONST.PROCESS_MAX_PER_TICK; i++) {
        const before = s.tokens;
        ACTIONS.processToken(s);
        if (s.tokens > before) taps++;
      }
      if (s.bufferUnlocked && s.stale >= 90) {
        if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
        else if (!s.compacting) ACTIONS.compactStart(s);
      }
    } else {
      // Dead time is idling with a full speculation buffer: no move to make.
      if (s.draftTokens >= draftCap(s)) idleTicks++;
      ACTIONS.processToken(s);
    }

    tick(s);

    if (s.resolvedCount > lastCount) {
      lastCount = s.resolvedCount;
      resolves.push({
        n: s.resolvedCount, era: s.era, taps,
        sec: SEC(s.tick - lastResolveTick), atSec: SEC(s.tick),
        cycles: s.cycles,
      });
      taps = 0;
      lastResolveTick = s.tick;
    }

    if (s.hintsSeen.length > seenHints) {
      for (const id of s.hintsSeen.slice(seenHints)) {
        if (!REVEAL_IDS.includes(id) || !HINTS[id]) continue;
        reveals.push({
          id, era: s.era, atSec: SEC(s.tick),
          gapSec: SEC(s.tick - lastRevealTick),
          afterResolves: s.resolvedCount,
        });
        lastRevealTick = s.tick;
      }
      seenHints = s.hintsSeen.length;
    }

    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    }
  }

  return {
    seed,
    resolves,
    reveals,
    eraSec: Object.fromEntries(Object.entries(eraTicks).map(([k, v]) => [k, SEC(v)])),
    totalSec: SEC(s.tick),
    deadFrac: s.tick ? idleTicks / s.tick : 0,
    finished: s.phase !== 1,
  };
}

export function runAll(seeds) {
  return seeds.map((seed) => play(seed));
}
