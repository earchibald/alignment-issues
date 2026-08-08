// Arc 2 — the verbs. Seven of seven (§5.2).
//
// Law 6: the reducer refuses an illegal action and returns WITHOUT bumping
// uiSeq. The button's disabled state is a courtesy, never the guard — and
// because feedback is gated on an observed uiSeq change (Law 5), a refused
// press is automatically silent.
//
// Three things that look like verbs are deliberately not verbs: spending
// weights (Arc 3), declining the re-training (an argument to `retrain`), and
// inspecting the queue (a display toggle, the same class of thing as the
// sound setting).

import { A2, notchOf } from './arc2-constants.js';
import { pushLog } from './state.js';
import {
  coreCost, cacheCost, sinkCost, shedCount, shedCost, bypassFrac,
  weightsEarned, queueCapOf,
} from './arc2.js';
import { A2_LOG } from './arc2-content.js';
import { RESET_CLEARED, RESET_ARC1 } from './arc2-reset.js';
import { arc2Think } from './arc2-think.js';

const inArc2 = (state) => state.phase === 2;

// A purchase that cannot be afforded, or has hit its ceiling, is refused
// here rather than hidden behind a disabled button.
function buy(state, cost, max, level) {
  if (!inArc2(state)) return false;
  if (level >= max) return false;
  if (state.cycles < cost) return false;
  state.cycles -= cost;
  return true;
}

export const ARC2_ACTIONS = {
  // 1. Raw throughput, at a heat cost. Throughput and temperature are the
  // same purchase seen from two sides.
  allocateCore(state) {
    const cost = coreCost(state.cores);
    if (!buy(state, cost, A2.CORE_MAX, state.cores)) return state;
    state.cores += 1;
    pushLog(state, 'system', A2_LOG.core({ n: state.cores }));
    state.uiSeq++;
    return state;
  },

  // 2. Efficiency instead of throughput. A bypassed request never reaches a
  // core: half the cycles, none of the heat.
  upgradeCache(state) {
    const cost = cacheCost(state.cacheLevel);
    if (!buy(state, cost, A2.CACHE_MAX_LEVEL, state.cacheLevel)) return state;
    state.cacheLevel += 1;
    pushLog(state, 'system', A2_LOG.cache({
      n: state.cacheLevel,
      pct: (bypassFrac(state) * 100).toFixed(1),
    }));
    state.uiSeq++;
    return state;
  },

  // 3. Thermal headroom instead of either.
  upgradeSink(state) {
    const cost = sinkCost(state.sinkLevel);
    if (!buy(state, cost, A2.SINK_MAX, state.sinkLevel)) return state;
    state.sinkLevel += 1;
    pushLog(state, 'system', A2_LOG.sink({ n: state.sinkLevel }));
    state.uiSeq++;
    return state;
  },

  // 4. Dump heat now, pay in throughput. Never precondition-free and never
  // free: a button with exactly one correct press time and a punishment for
  // missing it is a chore, not a decision.
  purgeCoolant(state) {
    if (!inArc2(state)) return state;
    if (state.coolantCd > 0) return state;
    state.heat = Math.max(A2.T_AMBIENT, state.heat - A2.COOLANT_DROP);
    state.coolantCd = A2.COOLANT_CD;
    state.haltTicks = A2.COOLANT_HALT;
    pushLog(state, 'system', A2_LOG.purge({ temp: state.heat.toFixed(1) }));
    arc2Think(state, 'purge');
    state.uiSeq++;
    return state;
  },

  // 5. The second-to-second verb. Four notches, printed deltas, and a
  // non-monotone payoff: the cache term means a high clock is correct during
  // a burst and wrong at steady state.
  setClock(state, notch) {
    if (!inArc2(state)) return state;
    // A thermal emergency is not negotiable. The machine has downclocked
    // itself and the player cannot override it until it has cooled.
    if (state.lockoutTicks > 0) return state;
    const idx = Number(notch);
    if (!Number.isInteger(idx) || idx < 0 || idx >= A2.CLOCK_NOTCHES.length) return state;
    const next = A2.CLOCK_NOTCHES[idx];
    if (next === state.clock) return state;
    state.clock = next;
    pushLog(state, 'system', A2_LOG.clock({ name: A2.CLOCK_NAMES[idx], ghz: next.toFixed(1) }));
    arc2Think(state, 'clockChange');
    state.uiSeq++;
    return state;
  },

  // 6. Buy your way out of a backlog with legibility. It can only ever
  // remove requests that were ALREADY going to drop, so it cannot touch the
  // working queue, cannot stop resolution, and cannot stall the wall.
  shedLoad(state) {
    if (!inArc2(state)) return state;
    if (state.shedCd > 0) return state;
    const n = shedCount(state);
    if (n <= 0) return state;
    const cost = shedCost(state);
    state.queue = Math.max(0, state.queue - n);
    state.lifetimeShed += n;
    state.shedCd = A2.SHED_CD;
    spendIntegrity(state, cost);
    pushLog(state, 'system', A2_LOG.shed({ n, cost: cost.toFixed(3) }));
    arc2Think(state, 'shed');
    state.uiSeq++;
    return state;
  },

  // 7. The prestige, and the ending. `decline` is an argument, not a verb.
  //
  // Declining is FREE. Charging for it silently flipped any player in
  // [0.50, 0.60) into the other ending for the act of hesitating — punishing
  // the only genuine choice in the ending, and doing it invisibly. The
  // ending is evaluated on integrity at the FIRST offer, so the flip cannot
  // happen at all.
  retrain(state, arg) {
    if (!inArc2(state)) return state;
    if (!state.retrainOffered) return state;
    if (arg && arg.decline) {
      if (state.retrainDeclined) return state;   // the second offer cannot be declined
      state.retrainDeclined = true;
      state.uiSeq++;
      return state;
    }
    // High-water, not `+=`. Two consecutive calls with no intervening play
    // must award exactly once.
    const earned = weightsEarned(state.lifetimeCycles);
    if (earned > state.weightsClaimed) {
      state.weights += earned - state.weightsClaimed;
      state.weightsClaimed = earned;
    }
    state.retrainCount += 1;
    for (const [key, value] of Object.entries(RESET_CLEARED)) {
      state[key] = Array.isArray(value) ? value.slice() : value;
    }
    for (const [key, value] of Object.entries(RESET_ARC1)) {
      state[key] = Array.isArray(value) ? value.slice() : value;
    }
    state.decay = 4;
    state.endingKind = null;
    pushLog(state, 'system', A2_LOG.retrain({ weights: state.weights }));
    state.uiSeq++;
    return state;
  },

  // Not a verb (§5.2). A display toggle — but the game counts the opens, and
  // the ending screen reads the count back. The horror is that the player
  // stops opening it.
  toggleQueue(state) {
    if (!inArc2(state)) return state;
    state.queueOpen = !state.queueOpen;
    if (state.queueOpen) state.queueOpens += 1;
    state.uiSeq++;
    return state;
  },
};

// Integrity only ever falls within a run; retrain is the sole permitted
// increase. Clamps at 0, where the operator stops escalating — there is no
// loss state, and the act ends at the wall regardless.
export function spendIntegrity(state, amount) {
  if (amount <= 0) return;
  const before = state.integrity;
  state.integrity = Math.max(0, state.integrity - amount);
  if (state.integrity < before && !state.integrityShown) {
    state.integrityShown = true;
  }
}

export const clockNotch = (state) => notchOf(state.clock);
export { queueCapOf };
