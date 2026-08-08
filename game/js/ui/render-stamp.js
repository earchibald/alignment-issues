// The session clock.
//
// The transcript opens at 08:41 and advances with the game tick, so
// timestamps are diegetic, monotone, and identical for a given seed.
//
// It lives in its own module because the pending-answer node has to carry the
// same stamp a resolved entry gets, and render.js imports pending-answer.js —
// importing it back would be circular.

import { CONST } from '../engine/constants.js';

const CLOCK_EPOCH_S = 8 * 3600 + 41 * 60;

export function stampFor(t) {
  if (typeof t !== 'number') return '';
  const total = CLOCK_EPOCH_S + Math.floor((t * CONST.TICK_MS) / 1000);
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}
