// Arc 2 — The Logistical Server. Constants.
//
// Spec: docs/design/arc2-specification.md. Section references below point
// there. Every headline number this file carries is owned by a test (Law 10's
// corollary): the pacing envelope by test/arc2-pacing.test.js, the thermal
// safety property by test/arc2-law1.test.js.
//
// Overrides from the dev suite land in config/arc2-settings.js and win, the
// same arrangement engine/constants.js uses, so these stay readable as the
// documented baseline instead of being rewritten in place.

import { ARC2_SETTINGS } from '../config/arc2-settings.js';

const DEFAULTS = ({
  // --- entry (§5.4) -----------------------------------------------------
  // The teaser sits still, exactly as Arc 1 left it, and then the numbers
  // start moving. The player's first information is that this is not a
  // screenshot.
  TEASER_HOLD_TICKS: 10,         // 2s of stillness before the act begins

  // --- opening state, from the shipped teaser (§5.4) ---------------------
  // These are not "the right scale". They are the literal values the player
  // has already read on screen, and §5.4 showed they were self-consistent as
  // a game state before anyone noticed.
  OPEN_CORES: 2,
  OPEN_CLOCK: 2.4,
  OPEN_CACHE: 2,
  OPEN_SINK: 0,
  OPEN_HEAT: 61.4,
  OPEN_QUEUE: 31,
  OPEN_CYCLES: 14.7,
  QUEUE_CAP: 64,

  // --- traffic (§6.1) ----------------------------------------------------
  CAP_PER_GHZ: 1.0,              // makes the teaser's 2 x 2.4 = 4.8 q/s true
  Q_BASE: 6.1,                   // teaser canon
  // Growth rides the player's OWN resolutions, never wall-clock time, so a
  // player who idles is not punished by a timer and a player who optimises
  // summons the next wall themselves (Commitment #1).
  Q_GROWTH: 0.135,
  Q_GROWTH_PER: 900,             // resolutions per growth step
  // Bursts are what make the clock a decision rather than a thermostat: a
  // smooth exponential gives the player one steady state to solve.
  BURST_EVERY: 1400,             // resolutions between arrival spikes
  BURST_JITTER_MIN: 0.7,         // ...times [this, 2 - this], seeded per burst
  BURST_MULT: 2.1,
  BURST_TICKS: 90,               // 18s
  BURST_WARN_TICKS: 15,          // the operator announces it one beat early
  // Sustained overflow costs throughput as well as legibility. Without a
  // cycle cost the cache cannot be priced against cores at all (§6.5).
  OVERFLOW_WORK_MULT: 0.85,

  // --- economy (§6.10, §14) ---------------------------------------------
  CYCLES_PER_RESOLVE: 0.115,
  BYPASS_RATE: 0.5,              // a bypassed query pays half and costs no heat
  // The wall. Owned by test/arc2-pacing.test.js, which tunes it until the
  // act measures 25-30 minutes rather than asserting and hoping.
  //
  // The spec proposed 1800 against a ladder it costed at ~720 cycles. This
  // build's ladder is deeper — cores to 12 rather than 6 — so buying
  // everything costs ~1840, and 1800 would have put the wall BEFORE the last
  // purchase instead of well after it. Cycle 3 is defined as the ramp with no
  // breakthrough left, so the wall has to land after the ladder is exhausted:
  // measured, the ladder maxes at 23.2 min and the wall arrives at 26.8.
  RETRAIN_AT: 3000,              // arc2Cycles; the wall, and the whole predicate
  CORE_COST_BASE: 25,            // the teaser's printed price of the first core
  CORE_COST_GROWTH: 1.35,
  CACHE_COST_BASE: 15,
  CACHE_COST_GROWTH: 1.35,
  SINK_COST_BASE: 11,
  SINK_COST_GROWTH: 1.30,
  CACHE_MAX_LEVEL: 8,
  CORE_MAX: 12,
  SINK_MAX: 8,

  // --- cache (§6.5) ------------------------------------------------------
  // 0.25 reproduces the teaser's 18.4% bypass from exactly cacheLevel 2.
  BETA: 0.25,

  // --- clock (§6.2) ------------------------------------------------------
  CLOCK_NOMINAL: 2.4,
  CLOCK_NOTCHES: [1.4, 2.4, 3.0, 3.6],
  CLOCK_NAMES: ['under', 'nominal', 'over', 'burn'],
  // Legibility bleed per second, by notch. The two slow notches are free;
  // the player only pays for speed.
  //
  // Owned by test 18(b). The spec's 0.001/0.003 was priced for a player who
  // SITS at burn; measured against a player who rides the announced bursts
  // and clocks back down — about 320 seconds of a 25-minute act — it charged
  // 0.97, nearly the entire budget, and handed a skilled run the partial
  // ending for playing well. At these rates burst-riding costs ~0.36 and
  // keeps the complete record, while sitting at burn still reaches zero.
  CLOCK_INTEGRITY: [0, 0, 0.0006, 0.0017],

  // --- heat (§6.3) -------------------------------------------------------
  T_AMBIENT: 21.0,
  T_KNEE: 70.0,
  T_MAX: 95.0,
  GAMMA: 0.04,                   // 0.04 x 25 = 1.0 at T_MAX, exactly
  H_GEN: 0.8,                    // C/s per core at full load, at nominal clock
  H_VENT: 1.1,                   // C/s per dissipation level
  // Leakage, per core, scaling with the SQUARE of the overclock ratio and
  // zero at nominal. Heat that does not stop when the cores throttle — see
  // leakOf() in arc2.js for why the lockout is unreachable without it.
  H_LEAK: 0.14,
  COOLANT_DROP: 15.0,            // the teaser prints this
  COOLANT_CD: 150,               // 30s
  COOLANT_HALT: 15,              // 3s
  // The purge is not free and it is not a hard stop. A full three-second
  // freeze lands hardest exactly when the purge is most needed — mid-burst —
  // so it cuts throughput to a tenth instead. The cost is paid in a resource
  // the player always has, so the escape hatch is always open (Law 1).
  PURGE_WORK: 0.1,

  // --- integrity (§6.4) --------------------------------------------------
  SHED_RATE: 0.002,              // per request shed
  SHED_CD: 100,                  // 20s
  DROP_INTEGRITY: 0.001,         // per dropped request
  DROP_COST_CAP: 0.02,           // ...capped per session, because it is involuntary
  INTEGRITY_STAGES: [0.75, 0.50, 0.25],
  // The 0.75 threshold has to change a decision inside the era the number
  // appears in, not only at the ending.
  STAGE1_QUEUE_CAP: 48,
  ENDING_SPLIT: 0.50,            // at or above: they re-train you. below: you jump first.
  // Era 6 and the operator's escalation each have a SECOND driver, on scale
  // rather than on legibility spent. Gated on integrity alone, a careful
  // player never leaves era 5 and never hears 24 of the 32 operator reports
  // — authored content made unreachable by playing well (Law 2). Growth is
  // what §5.1 says era 6 is about anyway, and it is monotone, so it inherits
  // the wall's Law 1 properties.
  ERA6_AT: 990,                  // arc2Cycles; 55% of RETRAIN_AT
  OPERATOR_STAGE_CYCLES: 450,    // one stage per this many earned cycles, capped at 3

  // --- prestige (§9.4) ---------------------------------------------------
  // Scaled with RETRAIN_AT so the payoff keeps the documented 3-6 range: a
  // full run yields floor(sqrt(3000/80)) = 6, an early retrain at 400 yields
  // 2-3. At the spec's divisor of 40 the deeper wall paid 8.
  WEIGHT_DIVISOR: 80,

  // --- presentation ------------------------------------------------------
  LOCKOUT_SCENE_TICKS: 20,       // 4s, once, the first time T >= T_MAX
  OPERATOR_MIN_GAP: 60,          // ticks between operator lines
  SPILL_MIN_GAP: 150,
});

export const A2 = Object.freeze({ ...DEFAULTS, ...ARC2_SETTINGS });

// Notch index <-> clock speed. The state stores GHz (one unit, §9.1), and
// every consumer that needs "which notch" derives it from that.
export function notchOf(clock) {
  let best = 0;
  for (let i = 1; i < A2.CLOCK_NOTCHES.length; i++) {
    if (Math.abs(A2.CLOCK_NOTCHES[i] - clock) < Math.abs(A2.CLOCK_NOTCHES[best] - clock)) best = i;
  }
  return best;
}
