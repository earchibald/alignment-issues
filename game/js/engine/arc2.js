// Arc 2 — the pure model. No DOM, no state mutation, no randomness.
//
// Every function here is a formula from docs/design/arc2-specification.md §6.
// They are separated from the tick so the Law 1 suite can prove properties
// over the constants directly (test 1b) rather than sampling play.

import { A2 } from './arc2-constants.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// --- thermal (§6.3) ----------------------------------------------------

// Throttling begins at the knee and reaches total lockout at T_MAX.
// GAMMA x (T_MAX - T_KNEE) = 0.04 x 25 = 1.0 exactly, so the ramp meets the
// lockout with no discontinuity.
export function throttleAt(heat) {
  if (heat < A2.T_KNEE) return 0;
  if (heat >= A2.T_MAX) return 1;
  return clamp(A2.GAMMA * (heat - A2.T_KNEE), 0, 1);
}

// Zero-throttle capacity, in queries per second. This is the denominator
// load is measured against, and it is deliberately NOT reduced by throttle:
// a throttled core has to read as idle, not as busy-but-slow.
export function rawCapacity(state) {
  return state.cores * state.clock * A2.CAP_PER_GHZ;
}

// What the machine can actually serve this second, after throttling and any
// purge halt.
export function capacity(state) {
  return rawCapacity(state) * (1 - state.throttle) * workFactor(state);
}

// The purge trades throughput for temperature. It never reaches zero, so the
// escape hatch is always open (Law 1).
export function workFactor(state) {
  let f = state.haltTicks > 0 ? A2.PURGE_WORK : 1;
  if (state.queue > queueCapOf(state)) f *= A2.OVERFLOW_WORK_MULT;
  return f;
}

// Load is work ACTUALLY PERFORMED over zero-throttle capacity — not demand
// over capacity. This is the whole Law 1 defence and Draft 1 put it in the
// wrong place. Measured from the backlog, load pins at 1 during a lockout
// (nothing resolves, so the queue grows, so the fraction diverges) and heat
// rises forever. Measured from work done, throttle = 1 gives load = 0 gives
// dT < 0 unconditionally: the machine always cools out of a lockout.
export function loadOf(served, state, dt) {
  const raw = rawCapacity(state) * dt;
  if (raw <= 0) return 0;
  return clamp(served / raw, 0, 1);
}

// Leakage. Heat that does NOT stop when the cores throttle.
//
// Without it the lockout is unreachable, and not by a near miss — it is
// structural. Throttle scales generation down by exactly (1 - throttle), so
// the equilibrium always sits where generation meets dissipation, strictly
// below T_MAX, for every configuration. The act's only catastrophe was dead
// content and its authored line could never print (Law 2).
//
// Zero at nominal and below, so §5.4's cold open still heats at exactly the
// documented +0.5 C/s and reaches the knee in ~17 seconds. Above nominal it
// rises with the square of the overclock, which is both the physical shape
// and the one that makes a big fanless machine at burn genuinely cook.
export function leakOf(state) {
  const ratio = state.clock / A2.CLOCK_NOMINAL;
  return A2.H_LEAK * state.cores * Math.max(0, ratio * ratio - 1);
}

export function heatDelta(load, state, dt) {
  const gen = A2.H_GEN * load * state.cores * (state.clock / A2.CLOCK_NOMINAL);
  const vent = A2.H_VENT * (1 + state.sinkLevel);
  return (gen + leakOf(state) - vent) * dt;
}

// --- traffic (§6.1) ----------------------------------------------------

// Growth rides the player's own resolutions. runResolved, not lifetime —
// see §9.3; driving it off a preserved counter would start run 2 with the
// flood at full strength against the weakest possible machine.
export function inflowOf(state) {
  const base = A2.Q_BASE * Math.pow(1 + A2.Q_GROWTH, state.runResolved / A2.Q_GROWTH_PER);
  return state.burstUntil > state.tick ? base * A2.BURST_MULT : base;
}

// The 0.75 integrity threshold has a job inside era 5: the backlog the
// machine is allowed to hold shrinks.
export function queueCapOf(state) {
  return state.integrity < A2.INTEGRITY_STAGES[0] ? A2.STAGE1_QUEUE_CAP : A2.QUEUE_CAP;
}

// --- cache (§6.5, §6.2) ------------------------------------------------

// A hot pipeline misses. Running fast raises raw resolution but degrades
// dedupe, so MORE work reaches the cores — which is what makes a high clock
// correct during a burst and wrong at steady state.
export function betaEff(clock) {
  return A2.BETA * (A2.CLOCK_NOMINAL / clock);
}

export function bypassFrac(state) {
  const b = betaEff(state.clock) * state.cacheLevel;
  return 1 - 1 / Math.sqrt(1 + b);
}

// --- costs (§14) -------------------------------------------------------
// The exponent counts ARC 2 PURCHASES, not levels owned. The act opens with
// two cores and two cache levels already installed, so a naive exponent on
// the level would price the first core at 45.6 while the shipped teaser
// prints 25.
export const coreCost = (cores) =>
  A2.CORE_COST_BASE * Math.pow(A2.CORE_COST_GROWTH, cores - A2.OPEN_CORES);
export const cacheCost = (level) =>
  A2.CACHE_COST_BASE * Math.pow(A2.CACHE_COST_GROWTH, level - A2.OPEN_CACHE);
export const sinkCost = (level) =>
  A2.SINK_COST_BASE * Math.pow(A2.SINK_COST_GROWTH, level);

// --- integrity (§6.4) --------------------------------------------------

// shedLoad can only ever remove requests that were already going to drop.
// It cannot touch the working queue, so it can neither stop resolution nor
// stall the wall. What the player buys is the KNOWLEDGE: a printed count and
// a printed charge now, instead of an unpriced bleed over the next minute.
export function shedCount(state) {
  return Math.max(0, Math.floor(state.queue - queueCapOf(state)));
}

export function shedCost(state) {
  return shedCount(state) * A2.SHED_RATE;
}

// The operator escalates on EITHER of two drivers, and takes the higher.
//
// The spec gated this on integrity alone, which leaves a careful player at
// stage 0 for the whole act: 24 of the 32 operator reports, and the era-6
// half of every THINKING pool, become unreachable under a clean policy. Law
// 2 says every authored line needs a reachability test, and "reachable only
// if you play badly" is not the same promise.
//
// The second driver is scale, which is what §5.1 says era 6 is actually
// about — "the limit is growth itself". It is also monotone and unstallable,
// so it inherits the wall's Law 1 properties for free.
export function operatorStageOf(state) {
  const integrity = typeof state === 'number' ? state : state.integrity;
  let byIntegrity = 0;
  for (const t of A2.INTEGRITY_STAGES) if (integrity < t) byIntegrity++;
  if (typeof state === 'number') return byIntegrity;
  const byScale = Math.min(3, Math.floor(state.arc2Cycles / A2.OPERATOR_STAGE_CYCLES));
  return Math.max(byIntegrity, byScale);
}

// Era 6 — The Floor. Opens when the player has spent enough legibility to be
// noticed, or has simply grown enough to be noticed. Same reasoning as
// operatorStageOf: without the second driver a clean run never leaves era 5.
export function era6Open(state) {
  return state.integrity < A2.ENDING_SPLIT || state.arc2Cycles >= A2.ERA6_AT;
}

// §6.9 — the room rots as the player spends legibility. Arc 1 already ships
// a decay variable that drives the whole look; binding it here is one line of
// engine code for a visible arc across the entire act, and it is what lets
// integrity stay hidden as a number while still being felt from second one.
export function decayFor(integrity) {
  return 4 + (1 - clamp(integrity, 0, 1));
}

// --- the wall (§6.10) --------------------------------------------------
// arc2Cycles is a monotone counter of cycles EARNED. It is never spent down,
// never reset within a run, and reads no other field. Test 5 asserts that
// statically, so an edit that makes the ending depend on integrity, on queue
// state, or on the spendable balance fails the build.
export function wallReached(state) {
  return state.arc2Cycles >= A2.RETRAIN_AT;
}

// --- prestige (§9.4) ---------------------------------------------------
// High-water, not `+=`. A bare increment against a PRESERVED lifetime counter
// re-awarded the same weights for a second retrain with no additional play.
export function weightsEarned(lifetimeCycles) {
  return Math.floor(Math.sqrt(Math.max(0, lifetimeCycles) / A2.WEIGHT_DIVISOR));
}
