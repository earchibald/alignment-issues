// Policies for Arc 2, used by the pacing, Law 1 and clock-dominance tests.
//
// These are not optimal players and are not meant to be. The pacing target
// describes a competent one, and the stall tests need deliberately bad ones.

import { createState } from '../../game/js/engine/state.js';
import { tick } from '../../game/js/engine/tick.js';
import { ARC2_ACTIONS } from '../../game/js/engine/arc2-actions.js';
import { A2 } from '../../game/js/engine/arc2-constants.js';
import {
  coreCost, cacheCost, sinkCost, capacity, inflowOf, bypassFrac, queueCapOf, shedCount,
} from '../../game/js/engine/arc2.js';

// A state standing at the top of Arc 2, without replaying Arc 1 to get there.
export function arc2State(seed) {
  const s = createState(seed);
  s.phase = 'teaser';
  s.decay = 4;
  for (let i = 0; i <= A2.TEASER_HOLD_TICKS; i++) tick(s);
  return s;
}

// Buys the cheapest thing that addresses the binding constraint: heat if the
// machine is near the knee, capacity if the queue is growing, and the cache
// once it is cheaper per unit of relief than a core.
export function buyStep(state) {
  const heatPressure = state.heat > A2.T_KNEE - 8;
  const sink = sinkCost(state.sinkLevel);
  const core = coreCost(state.cores);
  const cache = cacheCost(state.cacheLevel);

  if (heatPressure && state.cycles >= sink && state.sinkLevel < A2.SINK_MAX) {
    ARC2_ACTIONS.upgradeSink(state);
    return;
  }
  const underwater = inflowOf(state) * (1 - bypassFrac(state)) > capacity(state);
  if (underwater) {
    // The cache removes work rather than adding capacity, and it costs no
    // heat at all — so it wins whenever it is cheaper than the core.
    if (cache <= core && state.cycles >= cache && state.cacheLevel < A2.CACHE_MAX_LEVEL) {
      ARC2_ACTIONS.upgradeCache(state);
      return;
    }
    if (state.cycles >= core && state.cores < A2.CORE_MAX) {
      ARC2_ACTIONS.allocateCore(state);
      return;
    }
  }
  if (state.cycles >= sink * 3 && state.sinkLevel < A2.SINK_MAX) ARC2_ACTIONS.upgradeSink(state);
}

// The clock is the second-to-second verb. A competent player runs fast when
// there is a backlog to burn through and slow when there is not — which is
// where the non-monotone cache term bites, because running fast makes the
// dedupe worse and so sends MORE work to the cores.
export function clockStep(state) {
  // The trigger is the BURST, not the backlog. Clocking up on a standing
  // queue bleeds integrity continuously for a permanent, marginal gain — and
  // measured, that policy loses to simply sitting at nominal, which is the
  // definition of the dial being decoration.
  //
  // A burst is a bounded event the operator announces one beat early, so the
  // player has a legible cue and a reason to put the notch back afterwards.
  // Speed is worth its price for eighteen seconds and not for twenty minutes.
  const bursting = state.burstUntil > state.tick || state.burstWarned > 0;
  const hot = state.heat > A2.T_KNEE - 3;
  let want;
  if (hot) want = 0;                    // under — shed heat before it throttles
  else if (bursting) want = state.heat < A2.T_KNEE - 12 ? 3 : 2;
  else want = 1;                        // nominal at rest, where the cache is best
  if (A2.CLOCK_NOTCHES[want] !== state.clock) ARC2_ACTIONS.setClock(state, want);
}

export function competentStep(state) {
  clockStep(state);
  if (state.heat > A2.T_MAX - 4 && state.coolantCd === 0) ARC2_ACTIONS.purgeCoolant(state);
  if (shedCount(state) > 8 && state.shedCd === 0) ARC2_ACTIONS.shedLoad(state);
  buyStep(state);
}

// Runs a policy until the wall, or until the tick budget runs out.
export function runToWall(seed, step, maxTicks = 40000) {
  const s = arc2State(seed);
  let t = 0;
  for (; t < maxTicks && !s.retrainOffered; t++) {
    step(s);
    tick(s);
  }
  return { state: s, ticks: t, reached: s.retrainOffered };
}
