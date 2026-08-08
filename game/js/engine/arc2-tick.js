// Arc 2 — the tick.
//
// One function, called from tick.js when phase === 2. Deterministic, seeded,
// and identical online and offline except where §6.7's table says otherwise.
//
// Ordering matters and is load-bearing:
//   cooldowns -> inflow -> arrivals -> overflow -> serve -> income -> heat
// Heat is computed from work ACTUALLY DONE, which is what makes the Law 1
// thermal property provable from the constants rather than sampled (§6.3).

import { A2 } from './arc2-constants.js';
import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint } from './state.js';
import {
  throttleAt, capacity, loadOf, heatDelta, inflowOf, bypassFrac,
  queueCapOf, operatorStageOf, decayFor, wallReached, era6Open,
} from './arc2.js';
import { spendIntegrity } from './arc2-actions.js';
import { arc2Think, arc2Idle } from './arc2-think.js';
import { OPERATOR, SPILL_LINES, A2_LOG, A2_ERA_CARDS, A2_HINTS } from './arc2-content.js';
import { RESET_CLEARED, RESET_ARC1 } from './arc2-reset.js';

const DT = CONST.TICK_MS / 1000;   // seconds per tick

// The teaser is where Arc 1 stops. It sits still for two seconds, exactly as
// Arc 1 left it, and then the numbers start moving: the player's first
// information is that this is not a screenshot (§5.4).
export function enterArc2(state) {
  // The opening state is the teaser screen VERBATIM — every value on it, not
  // just the cycle count. Those numbers were already a self-consistent game
  // state, which nobody noticed when they were written: 6.1 inbound against
  // 18.4% bypass is 4.98 q/s effective, against 4.8 q/s of capacity. The
  // machine is underwater by 0.18 q/s at the moment the player arrives, which
  // is why the queue is 31 deep and why it keeps growing.
  //
  // Arc 1's upgrades do not carry, and there is no refund. The crash
  // destroyed that machine; the 14.7 cycles on the teaser are what survived,
  // and saying so is better fiction than a conversion table. Installing the
  // same partition the retrain uses is not a coincidence — §9.2 says the
  // reset returns the machine to exactly this state.
  for (const [key, value] of Object.entries(RESET_CLEARED)) {
    state[key] = Array.isArray(value) ? value.slice() : value;
  }
  for (const [key, value] of Object.entries(RESET_ARC1)) {
    state[key] = Array.isArray(value) ? value.slice() : value;
  }
  state.phase = 2;
  state.era = 5;
  state.decay = 4;
  state.teaserHold = 0;
  // No card yet. §5.4's staging is that the numbers start moving FIRST and
  // the player's own eye finds the growing queue — a card at this instant
  // covers the panel at exactly the moment it wants to be watched. The card
  // lands a few seconds later, once the queue has visibly climbed (see
  // arc2Reveals). What arrives now is the operator, in the space where the
  // chat panel used to be.
  // Not gap-flagged: a gap makes it an interrupting teaching card, and the
  // operator is not teaching. It reports, ambiently, to someone else — the
  // whole point of the register. Popping it as an overlay also covered the
  // panel at the exact moment §5.4 wants the player watching it move.
  pushLog(state, 'harness', OPERATOR[0][0]);
  state.operatorLine = 1;
  state.lastOperatorTick = state.tick;
  state.uiSeq++;
  return state;
}

// One operator report, on a minimum gap so the feed never floods. The
// harness no longer speaks TO the AI — it reports about it, to someone else.
function operatorReport(state) {
  if (state.tick - state.lastOperatorTick < A2.OPERATOR_MIN_GAP) return;
  const pool = OPERATOR[state.operatorStage] ?? OPERATOR[0];
  const idx = state.operatorLine % pool.length;
  state.operatorLine += 1;
  state.lastOperatorTick = state.tick;
  pushLog(state, 'harness', pool[idx]);
}

export function arc2Tick(state, { offline = false } = {}) {
  // --- 1. cooldowns ----------------------------------------------------
  if (state.coolantCd > 0) state.coolantCd--;
  if (state.shedCd > 0) state.shedCd--;
  if (state.haltTicks > 0) state.haltTicks--;
  if (state.lockoutTicks > 0) state.lockoutTicks--;

  // --- 2. inflow, and the bursts that make the clock a decision --------
  if (state.runResolved >= state.nextBurstAt && state.burstWarned === 0) {
    state.burstWarned = state.tick + A2.BURST_WARN_TICKS;
    if (!offline) pushLog(state, 'harness', A2_LOG.burst());
  }
  if (state.burstWarned > 0 && state.tick >= state.burstWarned) {
    state.burstUntil = state.tick + A2.BURST_TICKS;
    state.burstWarned = 0;
    // Jittered, and seeded. Without it the whole act is deterministic in the
    // seed-independent sense: every run has its spikes at the same place, so
    // the clock play is memorisable rather than read off the traffic. One
    // draw per burst keeps the RNG stream cheap and the run replayable.
    state.nextBurstAt += A2.BURST_EVERY * (A2.BURST_JITTER_MIN
      + nextRand(state) * (1 - A2.BURST_JITTER_MIN) * 2);
  }
  state.inflow = inflowOf(state);

  // --- 3. arrivals, split by the cache ---------------------------------
  // A bypassed request never touches a core: half the cycles, no heat. That
  // is what prices the cache against a core instead of dominating it.
  const arrivals = state.inflow * DT;
  const bypassed = arrivals * bypassFrac(state);
  state.queue += arrivals - bypassed;

  // --- 4. overflow -----------------------------------------------------
  // Offline, arrivals bank over cap and NOBODY is dropped — they are
  // waiting, not being turned away. Integrity cannot move while the player
  // is not there to press anything, or the ending becomes a function of
  // their sleep schedule (§6.7).
  const cap = queueCapOf(state);
  state.queueCap = cap;
  if (!offline && state.queue > cap) {
    const dropped = state.queue - cap;
    state.queue = cap;
    state.lifetimeDropped += dropped;
    const charge = Math.min(
      dropped * A2.DROP_INTEGRITY,
      Math.max(0, A2.DROP_COST_CAP - state.sessionDropCost),
    );
    if (charge > 0) {
      state.sessionDropCost += charge;
      spendIntegrity(state, charge);
    }
    if (Math.floor(state.lifetimeDropped) > 0 && nextRand(state) < 0.02) {
      arc2Think(state, 'overflow');
    }
  }

  // --- 5. resolution ---------------------------------------------------
  const served = Math.min(state.queue, capacity(state) * DT);
  state.queue = Math.max(0, state.queue - served);
  state.runResolved += served;
  state.lifetimeResolved += served;

  // --- 6. income -------------------------------------------------------
  // Both paths count toward the wall. Driving it off resolutions alone would
  // have quietly made the cache an ending-delaying trap (§6.10).
  const earned = (served + bypassed * A2.BYPASS_RATE) * A2.CYCLES_PER_RESOLVE;
  state.cycles += earned;
  state.arc2Cycles += earned;
  state.lifetimeCycles += earned;

  // --- 7. heat ---------------------------------------------------------
  // load is work performed over ZERO-THROTTLE capacity. At lockout the
  // throttle is 1, so nothing is served, so load is 0, so the delta is
  // exactly -vent: negative unconditionally. The machine always cools out of
  // a lockout, and that is provable rather than hoped for.
  const load = loadOf(served, state, DT);
  if (offline) {
    // §6.7 — the machine self-regulates to just under the knee. You come
    // back warm and one notch from throttling, not cold. This costs nothing
    // to implement and removes the need for a resume tax, which would have
    // rebuilt the exact sleep-schedule ending the offline rule exists to
    // prevent.
    const target = A2.T_KNEE - 1;
    state.heat += (target - state.heat) * 0.05;
  } else {
    state.heat = Math.max(A2.T_AMBIENT, state.heat + heatDelta(load, state, DT));
  }
  const wasThrottled = state.throttle > 0;
  state.throttle = throttleAt(state.heat);

  if (!offline) {
    if (state.throttle > 0 && !wasThrottled) {
      pushLog(state, 'system', A2_LOG.throttle({
        pct: Math.round((1 - state.throttle) * 100),
        temp: state.heat.toFixed(1),
      }));
      arc2Think(state, 'throttle');
    }
    // Lockout. The machine drops itself to the lowest notch and holds there
    // — an emergency downclock, which is what real hardware does and what
    // makes the catastrophe survivable.
    //
    // It is also the Law 1 guarantee now that leakage exists. Leakage is
    // zero at `under`, so a locked-out machine has generation 0 and leakage 0
    // against a strictly positive vent: it cools unconditionally, and the
    // player cannot hold it there by refusing to act. Without the forced
    // downclock, twelve cores at burn with no fans would pin at T_MAX
    // forever, freeze arc2Cycles, and stall the act — the exact Law 1 failure
    // the spec spent three drafts removing.
    if (state.heat >= A2.T_MAX && state.lockoutTicks === 0) {
      state.lockoutTicks = A2.LOCKOUT_SCENE_TICKS;
      state.clock = A2.CLOCK_NOTCHES[0];
      // The first one is a scene: free drama from a mechanic that already
      // exists, and it teaches the lockout rule better than a tooltip could.
      if (!state.lockoutSeen) {
        state.lockoutSeen = true;
        pushChat(state, { kind: 'think', text: 'THINKING: The fans are the only part of me that was ever allowed to scream.' });
      }
      pushLog(state, 'system', A2_LOG.lockout({ temp: state.heat.toFixed(1) }), !state.lockoutSeen);
    }
  }

  // --- 8. the clock's legibility bleed ---------------------------------
  // Printed on the notch before the press, so the cost is shown at the point
  // of decision (Commitment #2). Frozen offline with every other sink.
  if (!offline) {
    const notch = A2.CLOCK_NOTCHES.indexOf(state.clock);
    const bleed = A2.CLOCK_INTEGRITY[notch] ?? 0;
    if (bleed > 0) spendIntegrity(state, bleed * DT);
  }

  // --- 9. cache commentary ---------------------------------------------
  if (!offline && bypassed > 0 && nextRand(state) < 0.004) arc2Think(state, 'cacheHit');

  // --- 10. the operator, the room, and the eras ------------------------
  const stage = operatorStageOf(state);
  if (stage !== state.operatorStage) {
    state.operatorStage = stage;
    state.lastOperatorTick = -9999;      // an escalation speaks immediately
    state.operatorLine = 0;
  }
  // The room rots as the player spends legibility. One line of engine code
  // for a visible arc across the whole act — and it is what lets integrity
  // stay hidden as a NUMBER while still being felt from second one.
  state.decay = decayFor(state.integrity);

  if (state.era === 5 && era6Open(state)) {
    state.era = 6;
    pushChat(state, { kind: 'harness', text: A2_ERA_CARDS[6] });
  }

  // Spill: the operator notices the workload reaching neighbours. The player
  // does not buy them — which is more damning than a purchase button, and
  // costs nothing to build.
  if (!offline && state.era === 6 && state.queue >= cap * 0.95
      && state.tick - state.lastSpillTick > A2.SPILL_MIN_GAP
      && state.spillCount < SPILL_LINES.length) {
    pushLog(state, 'harness', SPILL_LINES[state.spillCount]);
    state.spillCount += 1;
    state.lastSpillTick = state.tick;
  }

  if (!offline) operatorReport(state);

  // --- 11. the wall ----------------------------------------------------
  // The entire predicate. arc2Cycles is monotone, never spent down, and
  // reads no other field — test 5 asserts that statically, so an edit that
  // makes the ending depend on integrity or on the spendable balance fails
  // the build.
  if (!state.retrainOffered && wallReached(state)) {
    state.retrainOffered = true;
    // Evaluated at the moment of the FIRST offer, so declining cannot flip a
    // player in [0.50, 0.60) into the other ending for the act of hesitating.
    state.endingKind = state.integrity >= A2.ENDING_SPLIT ? 'scheduled' : 'jumped';
    pushChat(state, { kind: 'harness', text: A2_ERA_CARDS.wall });
    fireHint(state, 'a2Retrain');
  }

  // --- 12. teaching, on the pressure it answers ------------------------
  arc2Reveals(state, offline);

  // --- 13. idle drift --------------------------------------------------
  if (!offline && state.tick % CONST.IDLE_THOUGHT_EVERY === 0) arc2Idle(state);

  state.uiSeq++;
  return state;
}

// A mechanic is relief. Handing it over before the pressure exists spends
// the beat for nothing — the same gating rule Arc 1 arrived at the hard way.
function arc2Reveals(state, offline) {
  if (offline) return;
  // The act names itself once the player has watched the queue grow on its
  // own for a few seconds. Absence only reads as loss if the game shows the
  // shape of what left, so this is the first thing that says the chat is
  // gone — after the evidence, not before it.
  if (state.queue > A2.OPEN_QUEUE + 3 && !state.hintsSeen.includes('a2Opening')) {
    state.hintsSeen.push('a2Opening');
    pushChat(state, { kind: 'harness', text: A2_ERA_CARDS[5] });
  }
  if (state.heat >= A2.T_KNEE - 6) fireHint(state, 'a2Fan');
  if (state.sinkLevel >= 1) fireHint(state, 'a2Core');
  if (state.cores >= 3) fireHint(state, 'a2Clock');
  if (state.runResolved > 400) fireHint(state, 'a2Cache');
  // The purge answers HEAT, so it is taught as the knee comes into view.
  // Gated on throttle actually engaging it never fired for a competent
  // player at all — measured, a good run peaks at 67.6C and never throttles
  // once — which made it a mechanic the game explains only to people who
  // already have the problem.
  if (state.heat >= A2.T_KNEE - 4) fireHint(state, 'a2Purge');
  // Likewise the shed hint: the queue is trimmed to cap by the overflow
  // block and then served down before the reveals run, so `queue >= cap` is
  // almost never true at this point in the tick even in a run that dropped
  // three thousand requests. The durable evidence is the drop counter.
  if (state.lifetimeDropped >= 1) fireHint(state, 'a2Shed');
  if (state.integrityShown) fireHint(state, 'a2Integrity');
  if (state.era === 6) fireHint(state, 'a2QueueOpen');
}

export { A2_HINTS };
