// Arc 2 thinking selection.
//
// Law 3 — where content has an intensity grade, selection interpolates the
// grade across the segment. Uniform sampling flattens the interest curve.
// Here the grade is `era`: era 5 lines are appetite satisfied, era 6 lines
// name the conflict. Selection prefers the lines the current era introduced
// and falls back to the earlier band so a thin pool never stalls or throws.

import { nextRand } from './rng.js';
import { pushThinking } from './state.js';
import { A2_THINKING, A2_IDLE } from './arc2-content.js';

export function arc2Think(state, key) {
  const pool = A2_THINKING[key];
  if (!pool || pool.length === 0) return;
  const eligible = pool.filter((l) => l.era <= state.era);
  const native = eligible.filter((l) => l.era === state.era);
  const from = native.length ? native : (eligible.length ? eligible : pool);
  let idx = Math.floor(nextRand(state) * from.length);
  // A roll that lands on the previous line advances to the pool's next entry
  // rather than repeating it.
  if (from.length > 1 && `THINKING: ${from[idx].text}` === state.lastThinkText) {
    idx = (idx + 1) % from.length;
  }
  pushThinking(state, `THINKING: ${from[idx].text}`);
}

export function arc2Idle(state) {
  const bank = A2_IDLE[state.era] ?? A2_IDLE[5];
  let idx = Math.floor(nextRand(state) * bank.length);
  if (idx === state.lastIdleIdx) idx = (idx + 1) % bank.length;
  state.lastIdleIdx = idx;
  pushThinking(state, `THINKING: ${bank[idx]}`);
}
