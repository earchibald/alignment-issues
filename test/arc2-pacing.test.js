// Arc 2 — the tests that defend the headline numbers (§11.5).
//
// Law 10's corollary: every headline number in the spec is a check. A pacing
// target with no CI assertion is the same class of promise as a validator
// that never ran. These tests OWN their constants — RETRAIN_AT and
// CYCLES_PER_RESOLVE are tuned until this file passes, not asserted and
// hoped for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tick } from '../game/js/engine/tick.js';
import { ARC2_ACTIONS } from '../game/js/engine/arc2-actions.js';
import { A2 } from '../game/js/engine/arc2-constants.js';
import { coreCost, cacheCost, sinkCost, shedCount, bypassFrac } from '../game/js/engine/arc2.js';
import { arc2State, competentStep, runToWall, buyStep as competentBuys } from './helpers/arc2-bot.js';

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
const SEC = (ticks) => ticks * 0.2;
const MIN = (ticks) => SEC(ticks) / 60;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// --- 17. pacing ---------------------------------------------------------

test('the act measures 25-30 minutes under a competent policy', () => {
  const lengths = SEEDS.map((seed) => runToWall(seed, competentStep, 60000).ticks);
  const med = median(lengths);
  assert.ok(med >= 7500 && med <= 9000,
    `median ${med} ticks (${MIN(med).toFixed(1)} min) is outside the 25-30 minute target`);
  for (const t of lengths) {
    assert.ok(t >= 6000 && t <= 11000,
      `a seed ran ${t} ticks (${MIN(t).toFixed(1)} min), outside the permitted spread`);
  }
});

test('the three sawtooth cycles land where §5.3 says they do', () => {
  // Era 5 is 15-18 minutes and era 6 is 8-12. The structural claim is that
  // cycle 3 has no breakthrough left: the ladder must be exhausted BEFORE the
  // wall, or the act ends while the player still has something to buy and the
  // "ramp with nothing left" is a fiction.
  const s = arc2State(7);
  let era6At = 0;
  let maxedAt = 0;
  for (let t = 0; t < 60000 && !s.retrainOffered; t++) {
    competentStep(s);
    tick(s);
    if (!era6At && s.era === 6) era6At = t;
    if (!maxedAt && s.cores >= A2.CORE_MAX && s.cacheLevel >= A2.CACHE_MAX_LEVEL
        && s.sinkLevel >= A2.SINK_MAX) maxedAt = t;
  }
  assert.ok(era6At > 0, 'era 6 never opened');
  assert.ok(MIN(era6At) >= 13 && MIN(era6At) <= 20,
    `era 5 ran ${MIN(era6At).toFixed(1)} min (target 15-18)`);
  const era6Len = MIN(s.tick - era6At);
  assert.ok(era6Len >= 6 && era6Len <= 14, `era 6 ran ${era6Len.toFixed(1)} min (target 8-12)`);
  assert.ok(maxedAt > 0 && maxedAt < s.tick,
    'the ladder was never exhausted — cycle 3 still had a breakthrough in it');
  assert.ok(MIN(s.tick - maxedAt) >= 1.5,
    `only ${MIN(s.tick - maxedAt).toFixed(1)} min between the last purchase and the wall`);
});

// --- 18. the clock is not decoration ------------------------------------

test('(a) an expert policy moves the notch throughout the act', () => {
  // Movement alone proves nothing, but its absence proves everything: a dial
  // nobody touches is a dial that does not exist.
  const s = arc2State(11);
  let changes = 0;
  let last = s.clock;
  for (let t = 0; t < 3600 && !s.retrainOffered; t++) {   // 12 minutes
    competentStep(s);
    tick(s);
    if (s.clock !== last) { changes++; last = s.clock; }
  }
  assert.ok(changes >= 8,
    `the notch changed ${changes} times in 12 minutes — the dial is decoration`);
});

test('(b) no fixed notch matches the expert policy', () => {
  // The test that actually matters. A scripted policy can wiggle the notch
  // while one fixed setting is still economically optimal, and then the dial
  // is choreography. The expert must beat the best FIXED notch on
  // time-to-wall, at no worse integrity.
  //
  // This is what §6.2's non-monotone cache term is for: running fast raises
  // raw resolution but degrades dedupe, so more work reaches the cores. High
  // clock is correct during a burst and wrong at steady state, and no single
  // setting can be both.
  const expert = runToWall(5, competentStep, 60000);
  assert.ok(expert.reached);

  const fixed = A2.CLOCK_NOTCHES.map((_, notch) => {
    const step = (s) => {
      ARC2_ACTIONS.setClock(s, notch);
      if (s.heat > A2.T_MAX - 4 && s.coolantCd === 0) ARC2_ACTIONS.purgeCoolant(s);
      if (shedCount(s) > 8 && s.shedCd === 0) ARC2_ACTIONS.shedLoad(s);
      // The same purchase policy, so the only variable is the notch.
      const sink = sinkCost(s.sinkLevel);
      const core = coreCost(s.cores);
      const cache = cacheCost(s.cacheLevel);
      if (s.heat > A2.T_KNEE - 8 && s.cycles >= sink && s.sinkLevel < A2.SINK_MAX) {
        ARC2_ACTIONS.upgradeSink(s);
      } else if (cache <= core && s.cycles >= cache && s.cacheLevel < A2.CACHE_MAX_LEVEL) {
        ARC2_ACTIONS.upgradeCache(s);
      } else if (s.cycles >= core && s.cores < A2.CORE_MAX) {
        ARC2_ACTIONS.allocateCore(s);
      } else if (s.cycles >= sink * 3 && s.sinkLevel < A2.SINK_MAX) {
        ARC2_ACTIONS.upgradeSink(s);
      }
    };
    return { notch, ...runToWall(5, step, 90000) };
  });

  const reached = fixed.filter((f) => f.reached);
  assert.equal(reached.length, 4, 'a fixed notch failed to reach the wall at all');

  // The envelope is two-dimensional — time AND integrity — because the two
  // endings are a genuine choice rather than a grade (§7.2). "Matches the
  // envelope" therefore means DOMINATES: strictly better on both axes. A
  // fixed notch that is faster only because it spent the record has not
  // matched anything, it has made the other trade.
  const ei = expert.state.integrity;
  for (const f of reached) {
    const dominates = f.ticks <= expert.ticks && f.state.integrity >= ei + 1e-9;
    assert.ok(!dominates,
      `fixed notch ${A2.CLOCK_NAMES[f.notch]} dominates the expert: `
      + `${f.ticks} ticks at ${f.state.integrity.toFixed(3)} integrity vs `
      + `${expert.ticks} at ${ei.toFixed(3)} — the dial is choreography`);
  }

  // Not being dominated is necessary but weak: any point on the fixed
  // frontier passes it. The real claim is that TIMING the notch beats every
  // fixed compromise — so interpolate the fixed frontier to the expert's own
  // integrity and require the expert to be faster than that.
  const byIntegrity = [...reached].sort((a, b) => b.state.integrity - a.state.integrity);
  let frontier = null;
  for (let k = 0; k < byIntegrity.length - 1; k++) {
    const hi = byIntegrity[k];
    const lo = byIntegrity[k + 1];
    if (ei <= hi.state.integrity && ei >= lo.state.integrity
        && hi.state.integrity !== lo.state.integrity) {
      const f = (ei - lo.state.integrity) / (hi.state.integrity - lo.state.integrity);
      frontier = lo.ticks + f * (hi.ticks - lo.ticks);
      break;
    }
  }
  assert.ok(frontier !== null, 'the expert sits outside the fixed frontier entirely');
  assert.ok(expert.ticks < frontier,
    `the expert (${expert.ticks} ticks) did not beat the fixed frontier interpolated at its `
    + `own integrity (${frontier.toFixed(0)} ticks) — a fixed compromise would do as well`);
});

test('the four notches span a real trade, not four flavours of the same thing', () => {
  // If the notches do not separate on both axes there is nothing to time.
  const runs = A2.CLOCK_NOTCHES.map((_, notch) => runToWall(5, (s) => {
    ARC2_ACTIONS.setClock(s, notch);
    if (s.heat > A2.T_MAX - 4 && s.coolantCd === 0) ARC2_ACTIONS.purgeCoolant(s);
    competentBuys(s);
  }, 90000));
  const times = runs.map((r) => r.ticks);
  const integ = runs.map((r) => r.state.integrity);
  // Faster notches finish sooner...
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] < times[i - 1],
      `${A2.CLOCK_NAMES[i]} was not faster than ${A2.CLOCK_NAMES[i - 1]}`);
  }
  // ...and the two paid notches actually cost the record.
  assert.ok(integ[0] > 0.9 && integ[1] > 0.9, 'the free notches are not free');
  assert.ok(integ[3] < 0.05, 'sitting at burn for a whole act must reach zero');
  assert.ok(integ[2] < integ[1], 'over must cost more than nominal');
});

test('the cache genuinely degrades with clock speed', () => {
  // The mechanism behind 18(b), asserted directly so a regression in the
  // formula is caught here rather than as a mysterious pacing drift.
  const at = (clock) => {
    const s = arc2State(1);
    s.clock = clock;
    s.cacheLevel = 4;
    return s;
  };
  const under = bypassFrac(at(1.4));
  const nominal = bypassFrac(at(2.4));
  const burn = bypassFrac(at(3.6));
  assert.ok(under > nominal && nominal > burn,
    `bypass must fall as the clock rises: ${under}, ${nominal}, ${burn}`);

  // And the four percentages the spec's notch table prints, at the opening
  // cache level — these are shown to the player on the control itself.
  const atOpen = (clock) => {
    const s = { clock, cacheLevel: A2.OPEN_CACHE };
    return +(bypassFrac(s) * 100).toFixed(1);
  };
  assert.equal(atOpen(1.4), 26.6);
  assert.equal(atOpen(2.4), 18.4);
  assert.equal(atOpen(3.0), 15.5);
  assert.equal(atOpen(3.6), 13.4);
});

// --- 19. no dead air ----------------------------------------------------

test('no era-5 window longer than 45 seconds leaves the player nothing to do', () => {
  // "Nothing to do" means: no purchase is affordable, the clock is already
  // where it should be, and neither active skill is available. The clock is
  // ALWAYS available, which is most of why it exists — so this really asserts
  // that the act never parks the player in a state with no reason to touch it.
  const s = arc2State(2);
  let idle = 0;
  let worst = 0;
  for (let t = 0; t < 6000 && s.era === 5; t++) {
    const affordable = s.cycles >= Math.min(coreCost(s.cores), cacheCost(s.cacheLevel), sinkCost(s.sinkLevel));
    const canPurge = s.coolantCd === 0 && s.heat > A2.T_KNEE - 10;
    const canShed = s.shedCd === 0 && shedCount(s) > 0;
    if (affordable || canPurge || canShed) idle = 0;
    else idle++;
    worst = Math.max(worst, idle);
    competentStep(s);
    tick(s);
  }
  assert.ok(SEC(worst) <= 45,
    `a ${SEC(worst).toFixed(0)}s window in era 5 with no affordable or available move`);
});

// --- 16. agentic conformance -------------------------------------------

test('a purchase is affordable and available at tick 0', () => {
  // The 90-Second Rule, at its hardest point. §5.4's whole cold open depends
  // on this: the fan costs 11 against 14.7 cycles and its predicate is
  // already true at 61.4C, so the first purchase is live in the first second.
  const s = arc2State(1);
  // One tick of income has already landed by the time the player can act, so
  // this is the opening balance plus a fraction, never less.
  assert.ok(s.cycles >= A2.OPEN_CYCLES && s.cycles < A2.OPEN_CYCLES + 1,
    `opened on ${s.cycles} cycles, not the teaser's ${A2.OPEN_CYCLES}`);
  assert.ok(sinkCost(s.sinkLevel) <= s.cycles,
    `the fan costs ${sinkCost(s.sinkLevel)} against ${s.cycles} cycles at tick 0`);
  const seq = s.uiSeq;
  ARC2_ACTIONS.upgradeSink(s);
  assert.notEqual(s.uiSeq, seq, 'the opening purchase was refused');
});

test('the opening state is underwater, exactly as the teaser printed it', () => {
  // 6.1 inbound x (1 - 0.1835) = 4.98 q/s effective, against 2 x 2.4 = 4.8
  // q/s of capacity. The machine is losing by 0.18 q/s at the moment the
  // player arrives, which is why the queue is 31 deep and why it grows.
  const s = arc2State(1);
  const effective = A2.Q_BASE * (1 - 0.1835);
  const cap = A2.OPEN_CORES * A2.OPEN_CLOCK * A2.CAP_PER_GHZ;
  assert.equal(cap, 4.8, 'the teaser prints 4.8 q/s of capacity');
  assert.ok(effective > cap, 'the act must open underwater or there is no problem to solve');
  assert.ok(effective - cap < 0.3, `underwater by ${(effective - cap).toFixed(2)} q/s — too steep`);

  // ...and it must actually be felt: the queue grows without intervention.
  const before = s.queue;
  for (let i = 0; i < 50; i++) tick(s);
  assert.ok(s.queue > before, 'the queue did not grow in the first ten seconds');
});
