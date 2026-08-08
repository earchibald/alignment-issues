// Defaults for the answer-diffusion effect, and the merge with whatever the
// dev suite last applied.
//
// The values are the lab's own defaults, carried over so a fresh clone that
// has never run the tuning tool still boots and still looks right. The spec
// is explicit that the generated file may be missing; nothing here may depend
// on it having content.

import { DIFFUSION_SETTINGS } from '../../config/diffusion-settings.js';

const DEFAULTS = {
  // Which resolve order. See schedulers.js: uniform | stochastic | wavefront |
  // spans. Stochastic is the classic scattered look and is the lab default.
  scheduler: 'stochastic',

  // Churn rate. 'fixed' holds shimmerHz regardless of the token stream;
  // 'relative' ties churn to arrivals so a slow stream churns slowly, with
  // shimmerFloorHz as the lower bound below which it decouples again.
  shimmerMode: 'fixed',
  shimmerHz: 20,
  shimmerPerToken: 1.5,
  shimmerFloorHz: 8,

  // Correctness ramp: P(correct) = q^gamma. Higher means the true glyph
  // appears later and more suddenly.
  gamma: 1.6,
  // Ceiling on the per-step chance a correct glyph locks, and its ramp:
  // P(lock | correct) = lockBase * q^delta.
  lockBase: 0.35,
  delta: 2.2,
  // Chance per step that a locked cell comes loose again inside its window.
  // This is remasking, and it is what makes the effect read as diffusion
  // rather than as a one-way wipe.
  unsettle: 0.02,
  // How scattered the per-cell resolve windows are. 0 = every cell on the
  // same schedule.
  spread: 0.6,
  // Wavefront only: 0 = stochastic, 1 = strict left-to-right wipe.
  bias: 0.5,
  // Spans only: randomness added to the confidence ordering.
  spanJitter: 0.3,

  // Lowercase stays lowercase, digits stay digits. Keep this on — it is the
  // single biggest factor in whether the field reads as an answer arriving or
  // as static.
  preserveClass: true,
  // Scramble whitespace too, so the answer starts as a solid slab and the
  // layout reflows as words separate out. More dramatic, less readable.
  blockNoise: false,
  // Mix box-drawing, block, arrow, maths and Greek glyphs into the noise pool.
  glyphNoise: false,

  // View-only. These never feed back into the simulation.
  lumJitter: 0.35,
  flashStrength: 0.8,
  flashHoldMs: 120,
  flashFadeMs: 260,
};

export const DIFFUSION = Object.freeze({ ...DEFAULTS, ...(DIFFUSION_SETTINGS || {}) });

// Progress at which every cell is forced to its final value.
//
// `p` reaches 1 only at the instant the query resolves, so a naive mapping
// would still be mid-resolve at the handoff. The last 8% of the meter is the
// answer sitting finished, waiting to be sent — and that gap is the point:
// the player sees the answer complete, then sees it go out.
export const SETTLE_AT = 0.92;

// ...and a small guarantee under it, in ticks of maximum possible output.
//
// SETTLE_AT alone assumes progress arrives smoothly. It does not: two taps a
// tick at amplification L2 with a warm cache is over 6 tokens, which on a
// cheap query can exceed the whole 8% window — measured stepping straight
// from p = 0.909 to resolved, so the field was never seen fully settled.
//
// The fix is one tick of headroom, HARD CAPPED at MIN_SETTLE_P. Three ticks
// of headroom, uncapped, was measured settling a 202-character answer at
// p = 0.55 — over-correcting into throwing half the effect away. The cap is
// what keeps a guarantee from eating the thing it is guarding.
export const SETTLE_LOOKAHEAD_TICKS = 1;

// The settle can never be pulled earlier than this, whatever the token rate.
export const MIN_SETTLE_P = 0.8;
