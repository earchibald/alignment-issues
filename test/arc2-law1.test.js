// Arc 2 — the Law 1 suite (§11.1). The highest-priority tests in the act.
//
// Law 1: no terminal state may depend on a resource the player can drive to
// zero. Arc 1 shipped uncompletable because both income paths were multiplied
// by a penalty the player could saturate; Arc 2's analogue is thermal, and the
// spec found and fixed three separate exposures before any code existed.
//
// The spec's own first draft of this suite would not have caught the original
// bug: it proposed sampling "200 randomly seeded reachable states", but random
// PLAY never constructs the adversarial thermal configuration — no random
// policy buys eight cores and zero fans. The era-4 bug was found because
// saturation was the DEFAULT trajectory; the thermal analogue is an EDGE
// trajectory, which is harder to reach, not easier. So: an exhaustive lattice,
// and an algebraic proof over the constants.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tick } from '../game/js/engine/tick.js';
import { ARC2_ACTIONS } from '../game/js/engine/arc2-actions.js';
import { A2 } from '../game/js/engine/arc2-constants.js';
import { throttleAt, loadOf, heatDelta, capacity, rawCapacity, leakOf } from '../game/js/engine/arc2.js';
import { arc2State, competentStep, runToWall } from './helpers/arc2-bot.js';

// --- 1(b) the algebraic invariant, proved from CONST -------------------

test('lockout implies zero load implies falling temperature — from the constants', () => {
  // throttle = 1 => capacity = 0 => served = 0 => load = 0 => dT = -vent.
  // This is the whole Law 1 defence and the spec's Draft 1 put it in the
  // wrong place: it removed (1 - throttle) from the DENOMINATOR while load
  // was still measured from the backlog, so at lockout nothing resolved, the
  // queue grew every tick, the fraction diverged, and min(1, ...) pinned load
  // at 1. Heat then rose forever.
  assert.equal(throttleAt(A2.T_MAX), 1, 'lockout must be total');
  assert.equal(A2.GAMMA * (A2.T_MAX - A2.T_KNEE), 1,
    'the throttle ramp must meet the lockout exactly, with no discontinuity');

  // Every reachable hardware configuration, at lockout. The property proved
  // here is the load one: a throttled core is genuinely IDLE, not
  // busy-but-slow, so it generates nothing.
  //
  // dT < 0 is asserted separately, in the emergency-downclock test below,
  // because leakage means it no longer holds at every notch — only at the
  // notch the machine forces itself to. Splitting them keeps each proof
  // about one thing.
  for (let cores = 1; cores <= A2.CORE_MAX; cores++) {
    for (let sinkLevel = 0; sinkLevel <= A2.SINK_MAX; sinkLevel++) {
      for (const clock of A2.CLOCK_NOTCHES) {
        const s = { cores, sinkLevel, clock, throttle: 1, haltTicks: 0, queue: 1e6, integrity: 1 };
        assert.equal(capacity(s), 0, 'a locked-out machine must serve nothing');
        const load = loadOf(0, s, 0.2);
        assert.equal(load, 0, `load ${load} at lockout — heat would rise forever`);
        // Generation, as distinct from leakage, must vanish.
        const gen = A2.H_GEN * load * cores * (clock / A2.CLOCK_NOMINAL);
        assert.equal(gen, 0, 'a throttled core still generated heat from work');
      }
    }
  }
});

test('load can never exceed the un-throttled fraction', () => {
  // The property the definition buys: load is work PERFORMED over zero-
  // throttle capacity, so it is bounded by (1 - throttle) by construction
  // rather than by a min() that can be defeated.
  for (const heat of [21, 60, 70, 75, 85, 94.9, 95, 120]) {
    const throttle = throttleAt(heat);
    const s = { cores: 6, sinkLevel: 0, clock: 3.6, throttle, haltTicks: 0, queue: 1e6, integrity: 1 };
    const served = capacity(s) * 0.2;
    const load = loadOf(served, s, 0.2);
    assert.ok(load <= 1 - throttle + 1e-12,
      `at ${heat}C load ${load} exceeded 1 - throttle (${1 - throttle})`);
  }
});

// --- 1(a) the exhaustive lattice ---------------------------------------

test('heat has a finite equilibrium in every configuration — it never runs away', () => {
  // A few hundred deterministic combinations at their declared bounds, with
  // NO player input at all: the configuration a random policy would never
  // construct — many cores, no fans, clock at burn, queue at cap, heat at max.
  //
  // The property asserted is NOT "always cools below the knee". A fanless
  // machine at burn clock with work to do genuinely sits hot, and that is the
  // design. What Law 1 forbids is an unbounded climb, because that is a state
  // the player cannot leave. The equilibrium must be finite and at or below
  // lockout, so throttling down always recovers.
  const CORES = [1, 4, 8, A2.CORE_MAX];
  const SINKS = [0, 1, 4, A2.SINK_MAX];
  const QUEUES = [0, A2.QUEUE_CAP / 2, A2.QUEUE_CAP, A2.QUEUE_CAP * 4];
  const HEATS = [A2.T_KNEE, 85, A2.T_MAX, A2.T_MAX + 20];

  let checked = 0;
  for (const cores of CORES) {
    for (const sinkLevel of SINKS) {
      for (const clock of A2.CLOCK_NOTCHES) {
        for (const queue of QUEUES) {
          for (const heat of HEATS) {
            const s = arc2State(1);
            Object.assign(s, { cores, sinkLevel, clock, queue, heat });
            s.throttle = throttleAt(heat);
            for (let i = 0; i < 3000; i++) tick(s);
            checked++;
            assert.ok(Number.isFinite(s.heat),
              `${cores}c/${sinkLevel}s/${clock}GHz became ${s.heat}`);
            assert.ok(s.heat <= A2.T_MAX + 0.5,
              `${cores}c/${sinkLevel}s/${clock}GHz q=${queue} T=${heat} settled at `
              + `${s.heat.toFixed(1)}C — above lockout forever`);
          }
        }
      }
    }
  }
  assert.ok(checked >= 256, `only ${checked} lattice points`);
});

test('a locked-out machine cools no matter what the player was doing', () => {
  // Once leakage exists, "zero load cools" is no longer true at every notch —
  // a fanless twelve-core at burn leaks 2.1 C/s against 1.1 of dissipation
  // and would pin at T_MAX forever, freezing arc2Cycles and stalling the act.
  //
  // The guarantee is the emergency downclock. At lockout the machine forces
  // itself to the lowest notch, where leakage is zero by construction, so
  // generation and leakage are both zero against a strictly positive vent.
  // The player cannot hold it hot by refusing to act.
  assert.equal(leakOf({ cores: A2.CORE_MAX, clock: A2.CLOCK_NOTCHES[0] }), 0,
    'the lowest notch must leak nothing, or a lockout can be held forever');
  assert.equal(leakOf({ cores: A2.CORE_MAX, clock: A2.CLOCK_NOMINAL }), 0,
    'leakage at nominal would change the documented cold-open heat rate');

  for (let cores = 1; cores <= A2.CORE_MAX; cores++) {
    for (const sinkLevel of [0, A2.SINK_MAX]) {
      const s = { cores, clock: A2.CLOCK_NOTCHES[0], sinkLevel };
      assert.ok(heatDelta(0, s, 0.2) < 0,
        `${cores}c/${sinkLevel}s does not cool at the emergency notch`);
    }
  }
});

test('the cold open still heats at exactly the documented rate', () => {
  // §5.4 and §6.3 both print +0.5 C/s at the opening state, reaching the knee
  // in about 17 seconds. Leakage was shaped to keep this exact.
  const s = { cores: A2.OPEN_CORES, clock: A2.OPEN_CLOCK, sinkLevel: A2.OPEN_SINK };
  const perSecond = heatDelta(1, s, 1);
  assert.ok(Math.abs(perSecond - 0.5) < 1e-9,
    `the cold open heats at ${perSecond.toFixed(3)} C/s, not the documented 0.5`);
  // ...and buying the fan flips it negative, which is cycle 1 of the sawtooth.
  const fanned = { ...s, sinkLevel: 1 };
  assert.ok(Math.abs(heatDelta(1, fanned, 1) + 0.6) < 1e-9,
    'the first fan should take the cold open to -0.6 C/s');
});

test('the emergency downclock cannot be overridden while it holds', () => {
  const s = arc2State(1);
  s.heat = A2.T_MAX + 1;
  s.clock = 3.6;
  tick(s);
  assert.ok(s.lockoutTicks > 0, 'the lockout did not engage');
  assert.equal(s.clock, A2.CLOCK_NOTCHES[0], 'the machine did not downclock itself');
  const seq = s.uiSeq;
  ARC2_ACTIONS.setClock(s, 3);
  assert.equal(s.uiSeq, seq, 'the player clocked back up during a thermal emergency');
  assert.equal(s.clock, A2.CLOCK_NOTCHES[0]);
});

test('a machine that cooks itself always recovers unaided', () => {
  // The worst configuration a player can actually build, left completely
  // alone: it must lock out, cool, and resume earning.
  const s = arc2State(1);
  Object.assign(s, { cores: A2.CORE_MAX, sinkLevel: 0, clock: 3.6, heat: 90, queue: A2.QUEUE_CAP });
  for (let i = 0; i < 600; i++) tick(s);
  assert.ok(s.lockoutSeen, 'precondition: this configuration should lock out');
  const earnedBefore = s.arc2Cycles;
  for (let i = 0; i < 3000; i++) tick(s);
  assert.ok(s.heat < A2.T_MAX, `still pinned at ${s.heat.toFixed(1)}C after ten minutes`);
  assert.ok(s.arc2Cycles > earnedBefore, 'the act stopped progressing after a lockout');
});

test('capacity that outruns the traffic cools the machine on its own', () => {
  // The playable form of the same property: a machine bought far ahead of its
  // workload settles cold, which is what makes the sawtooth's Drop feel like
  // relief rather than a smaller pressure.
  const s = arc2State(1);
  Object.assign(s, { cores: A2.CORE_MAX, clock: 2.4, sinkLevel: A2.SINK_MAX, heat: A2.T_MAX, queue: 0 });
  s.throttle = throttleAt(s.heat);
  for (let i = 0; i < 3000; i++) tick(s);
  assert.ok(s.heat < A2.T_KNEE,
    `an over-provisioned machine settled at ${s.heat.toFixed(1)}C`);
});

// --- 3. the wall is always reachable -----------------------------------

test('the wall is reached under every policy, including bad ones', () => {
  // The spec's pure-idle policy contradicted its own design: if the wall is
  // reachable while buying nothing, the sawtooth is decorative. These are
  // three policies that all PLAY, at very different levels of competence.
  const policies = {
    competent: competentStep,
    greedy: (s) => {
      // Buys the cheapest available thing, always, with no regard for what is
      // actually binding.
      if (s.cycles >= 11) ARC2_ACTIONS.upgradeSink(s);
      if (s.cycles >= 25) ARC2_ACTIONS.allocateCore(s);
    },
    lateStarter: (s) => {
      // Buys nothing for ten minutes, then plays competently.
      if (s.tick < 3000) return;
      competentStep(s);
    },
  };
  for (const [name, step] of Object.entries(policies)) {
    for (const seed of [1, 5, 9, 13]) {
      const r = runToWall(seed, step, 90000);
      assert.ok(r.reached, `${name} @ seed ${seed}: never reached the wall in ${r.ticks} ticks`);
    }
  }
});

// --- 6. no policy can stall the act ------------------------------------

test('the three tabulated stall routes are all closed', () => {
  // §6.10 tabulates three ways a player might try to hold the act open and
  // claims each fails. Each is played here adversarially, then all of them at
  // once — which is the combination the tabulation does not cover.
  const stalls = {
    // Sit in thermal lockout. The (1 - throttle) term makes lockout self-heal
    // unconditionally, so it is not a state that can be held.
    lockout: (s) => {
      ARC2_ACTIONS.setClock(s, 3);
      if (s.cycles >= 25) ARC2_ACTIONS.allocateCore(s);   // more cores, never a fan
    },
    // Shed every arrival. shedLoad only ever removes the over-cap excess, so
    // it can never empty the working queue or stop resolution.
    shedEverything: (s) => {
      if (s.shedCd === 0) ARC2_ACTIONS.shedLoad(s);
    },
    // Clock to `under` and wait. Throughput drops to x0.58; it does not reach
    // zero. The wall arrives later, never not at all.
    underclock: (s) => { ARC2_ACTIONS.setClock(s, 0); },
    // All three at once.
    allThree: (s) => {
      ARC2_ACTIONS.setClock(s, 0);
      if (s.shedCd === 0) ARC2_ACTIONS.shedLoad(s);
      if (s.cycles >= 25) ARC2_ACTIONS.allocateCore(s);
    },
    // A fourth the spec did not tabulate: never touch anything at all.
    inert: () => {},
    // A fifth: purge on cooldown forever, so the machine spends as much of
    // its life as possible at a tenth throughput.
    purgeLoop: (s) => {
      ARC2_ACTIONS.setClock(s, 0);
      if (s.coolantCd === 0) ARC2_ACTIONS.purgeCoolant(s);
    },
  };
  for (const [name, step] of Object.entries(stalls)) {
    const r = runToWall(3, step, 300000);
    assert.ok(r.reached,
      `stall route "${name}" held the act open for ${r.ticks} ticks `
      + `(${(r.ticks * 0.2 / 60).toFixed(1)} min)`);
  }
});

// --- 4. purgeCoolant is never unavailable except by cooldown -----------

test('the escape hatch is only ever closed by its own cooldown', () => {
  const s = arc2State(2);
  for (const heat of [21, 70, 95, 130]) {
    for (const queue of [0, A2.QUEUE_CAP * 10]) {
      s.heat = heat;
      s.queue = queue;
      s.coolantCd = 0;
      s.cycles = 0;              // no money: the hatch must not have a price
      const seq = s.uiSeq;
      ARC2_ACTIONS.purgeCoolant(s);
      assert.notEqual(s.uiSeq, seq, `purge refused at ${heat}C, queue ${queue}, zero cycles`);
      assert.ok(s.coolantCd > 0, 'purge did not start its cooldown');
    }
  }
});

test('the purge costs throughput but never all of it', () => {
  // A hard stop was the spec's Draft 2 and it was reverted for good reason: a
  // full freeze lands hardest exactly when the purge is most needed. Law 1
  // also needs the cost paid in a resource the player always has.
  assert.ok(A2.PURGE_WORK > 0, 'a purge that stops the machine dead can stall the act');
  const s = arc2State(2);
  s.queue = 500;
  ARC2_ACTIONS.purgeCoolant(s);
  assert.ok(capacity(s) > 0, 'the machine served nothing during a purge');
  assert.ok(capacity(s) < rawCapacity(s), 'the purge was free');
});

// --- 5. the wall predicate is exactly §6.10 ----------------------------

test('the wall predicate reads arc2Cycles and nothing else', () => {
  // A static assertion on the source. An edit that makes the ending depend on
  // integrity, on queue state, or on the SPENDABLE cycle balance — which is
  // Law 1 all over again, because the balance falls every time the player buys
  // something — fails the build here rather than in a playtest.
  const src = readFileSync(new URL('../game/js/engine/arc2.js', import.meta.url), 'utf8');
  const fn = src.match(/export function wallReached\(state\) \{([\s\S]*?)\n\}/);
  assert.ok(fn, 'wallReached is gone or was renamed');
  const reads = [...fn[1].matchAll(/state\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(reads)], ['arc2Cycles'],
    `the wall now reads ${reads.join(', ')} — the ending must not depend on anything stallable`);

  // And behaviourally: the balance spent to zero must not move the wall.
  const s = arc2State(4);
  s.arc2Cycles = A2.RETRAIN_AT;
  s.cycles = 0;
  s.integrity = 0;
  s.queue = 0;
  tick(s);
  assert.ok(s.retrainOffered, 'the wall did not fire with a zeroed balance and zero integrity');
});

test('arc2Cycles is monotone across a whole run', () => {
  const s = arc2State(6);
  let last = 0;
  for (let i = 0; i < 8000; i++) {
    competentStep(s);
    tick(s);
    assert.ok(s.arc2Cycles >= last, `arc2Cycles fell from ${last} to ${s.arc2Cycles}`);
    last = s.arc2Cycles;
  }
});
