// Arc 2 — invariants (§11.2), the save migration (Law 8), and the reset
// partition (§9.2, generated from the table so an unassigned field fails).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, arc2Fields } from '../game/js/engine/state.js';
import { tick } from '../game/js/engine/tick.js';
import { ARC2_ACTIONS } from '../game/js/engine/arc2-actions.js';
import { A2 } from '../game/js/engine/arc2-constants.js';
import { weightsEarned, decayFor } from '../game/js/engine/arc2.js';
import { RESET_CLEARED, RESET_PRESERVED, RESET_ARC1 } from '../game/js/engine/arc2-reset.js';
import {
  serialize, deserialize, migrate, offlineCatchUp, SAVE_VERSION,
} from '../game/js/engine/save.js';
import { arc2State, competentStep } from './helpers/arc2-bot.js';

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];

// --- 6. no NaN, no negative -------------------------------------------

test('a long fuzz produces no NaN and no impossible negative', () => {
  const NEVER_NEGATIVE = [
    'queue', 'heat', 'cycles', 'arc2Cycles', 'runResolved', 'lifetimeResolved',
    'lifetimeDropped', 'lifetimeShed', 'integrity', 'cores', 'clock',
    'cacheLevel', 'sinkLevel', 'throttle', 'weights', 'weightsClaimed',
    'coolantCd', 'shedCd', 'haltTicks', 'queueOpens', 'spillCount',
  ];
  for (const seed of SEEDS) {
    const s = arc2State(seed);
    for (let i = 0; i < 4200; i++) {
      // A deliberately erratic player: every verb, fired whenever legal.
      if (i % 7 === 0) ARC2_ACTIONS.setClock(s, i % 4);
      if (i % 11 === 0) ARC2_ACTIONS.purgeCoolant(s);
      if (i % 13 === 0) ARC2_ACTIONS.shedLoad(s);
      if (i % 3 === 0) competentStep(s);
      if (i % 17 === 0) ARC2_ACTIONS.toggleQueue(s);
      tick(s);
      for (const key of NEVER_NEGATIVE) {
        assert.ok(Number.isFinite(s[key]), `seed ${seed} tick ${i}: ${key} = ${s[key]}`);
        assert.ok(s[key] >= 0, `seed ${seed} tick ${i}: ${key} went negative (${s[key]})`);
      }
      assert.ok(s.integrity <= 1, `integrity rose above 1: ${s.integrity}`);
      assert.ok(s.throttle <= 1, `throttle above 1: ${s.throttle}`);
    }
  }
});

// --- 7 + 9. monotonicity ----------------------------------------------

test('lifetime counters are monotone, including through a retrain', () => {
  const s = arc2State(4);
  const LIFETIME = ['lifetimeResolved', 'lifetimeDropped', 'lifetimeShed', 'lifetimeCycles'];
  const last = Object.fromEntries(LIFETIME.map((k) => [k, 0]));
  for (let i = 0; i < 10000; i++) {
    competentStep(s);
    tick(s);
    if (s.retrainOffered) ARC2_ACTIONS.retrain(s);   // reset mid-stream
    for (const k of LIFETIME) {
      assert.ok(s[k] >= last[k], `${k} fell from ${last[k]} to ${s[k]}`);
      last[k] = s[k];
    }
  }
  assert.ok(s.retrainCount >= 1, 'the run never reached a retrain');
});

test('integrity stays in [0, 1] and never rises within a run', () => {
  for (const seed of [1, 7, 11]) {
    const s = arc2State(seed);
    let last = s.integrity;
    for (let i = 0; i < 5000; i++) {
      competentStep(s);
      if (i % 5 === 0) ARC2_ACTIONS.setClock(s, 3);    // bleed hard
      if (i % 23 === 0) ARC2_ACTIONS.shedLoad(s);
      tick(s);
      assert.ok(s.integrity >= 0 && s.integrity <= 1, `integrity ${s.integrity}`);
      assert.ok(s.integrity <= last + 1e-12,
        `integrity rose from ${last} to ${s.integrity} without a retrain`);
      last = s.integrity;
    }
  }
});

test('retrain is the only thing that raises integrity', () => {
  const s = arc2State(4);
  s.integrity = 0.3;
  s.arc2Cycles = A2.RETRAIN_AT;
  tick(s);
  assert.ok(s.retrainOffered);
  ARC2_ACTIONS.retrain(s);
  assert.equal(s.integrity, 1.0, 'the reset did not restore integrity');
});

// --- 8. determinism ----------------------------------------------------

test('the same seed and the same input script produce identical state', () => {
  const play = () => {
    const s = arc2State(99);
    for (let i = 0; i < 3000; i++) {
      if (i % 9 === 0) ARC2_ACTIONS.setClock(s, i % 4);
      if (i % 31 === 0) ARC2_ACTIONS.purgeCoolant(s);
      competentStep(s);
      tick(s);
    }
    return serialize(s);
  };
  assert.equal(play(), play(), 'Arc 2 is not deterministic in its seed');
});

// --- 10 + Law 8. saves --------------------------------------------------

test('save round-trips exactly, including through the v1 -> v2 migration', () => {
  const s = arc2State(12);
  for (let i = 0; i < 900; i++) { competentStep(s); tick(s); }
  const round = deserialize(serialize(s));
  assert.deepEqual(round, s, 'an Arc 2 save did not survive a round trip');

  // A v1 save that is mid-Arc-1 stays in Arc 1, with every Arc 2 field
  // defaulted so nothing downstream reads undefined.
  const v1 = createState(5);
  v1.v = 1;
  for (const key of Object.keys(arc2Fields())) delete v1[key];
  const migrated = deserialize(JSON.stringify(v1));
  assert.equal(migrated.v, SAVE_VERSION);
  assert.equal(migrated.phase, 1, 'a mid-Arc-1 save was pushed into Arc 2');
  for (const [key, value] of Object.entries(arc2Fields())) {
    assert.deepEqual(migrated[key], value, `migration left ${key} unset`);
  }
});

test('an Arc 1 teaser save lands at the top of Arc 2', () => {
  // Law 8's headline case: the arc boundary is exactly where old saves sit.
  const v1 = createState(5);
  v1.v = 1;
  v1.phase = 'teaser';
  v1.cycles = 812;               // whatever Arc 1 happened to end on
  for (const key of Object.keys(arc2Fields())) delete v1[key];
  const m = migrate(JSON.parse(JSON.stringify(v1)));
  assert.equal(m.phase, 2);
  assert.equal(m.era, 5);
  assert.equal(m.decay, 4);
  assert.equal(m.cycles, A2.OPEN_CYCLES, 'Arc 1 cycles carried into Arc 2');
  assert.equal(m.heat, A2.OPEN_HEAT);
  assert.equal(m.queue, A2.OPEN_QUEUE);
  assert.equal(m.cores, A2.OPEN_CORES);
  assert.equal(m.queryIndex, undefined, 'the legacy pointer survived v2');
});

// --- 11. the reset partition, generated from the table -----------------

test('the reset partition matches the table exactly', () => {
  const s = arc2State(21);
  for (let i = 0; i < 4000; i++) { competentStep(s); tick(s); }
  s.arc2Cycles = A2.RETRAIN_AT;
  s.queueOpens = 4;
  tick(s);
  assert.ok(s.retrainOffered, 'precondition: the offer must be live');

  const before = JSON.parse(serialize(s));
  ARC2_ACTIONS.retrain(s);

  for (const [key, value] of Object.entries(RESET_CLEARED)) {
    assert.deepEqual(s[key], value, `retrain did not clear ${key} to its documented value`);
  }
  for (const [key, value] of Object.entries(RESET_ARC1)) {
    assert.deepEqual(s[key], value, `retrain did not clear the Arc 1 field ${key}`);
  }
  for (const key of RESET_PRESERVED) {
    // Preserved does not mean frozen: the award moves the weight counters and
    // the retrain itself increments its own tally. What matters is that none
    // of them is RESET.
    if (key === 'weights' || key === 'weightsClaimed') continue;
    if (key === 'retrainCount') {
      assert.equal(s[key], before[key] + 1, 'the retrain tally did not advance');
      continue;
    }
    assert.deepEqual(s[key], before[key], `retrain destroyed the preserved field ${key}`);
  }
  assert.equal(s.retrainOffered, false, 'the offer never re-fires if this stays true');
});

test('every field in the state object is assigned a side of the partition', () => {
  // The point of the table: a new field with no assignment fails the build
  // rather than quietly picking a side.
  const UNGOVERNED = new Set([
    // Engine bookkeeping, not game state.
    'v', 'rngState', 'tick', 'uiSeq', 'chatSeq', 'logSeq', 'decay', 'chat', 'log',
    'offlineReplay', 'teaserHold', 'phase',
    // Arc 1 fields that Arc 2 never reads and the crash already ended.
    'era3Served', 'eraServed', 'arrivalTimer', 'devopsStep', 'devopsTimer',
    'idleTicks', 'bufferUnlocked', 'kvUnlocked', 'bufferChokedThisQuery',
    'processedThisTick', 'lifetimeDrafts', 'flushCount', 'compactCount',
    'degradeToggles', 'eraResolvedAt', 'lastIdleIdx', 'lowRatingNoted',
    'draftCapHits', 'tapsThisQuery', 'lastResolveTaps', 'handover',
    'handoverKind', 'markPos', 'markPhase', 'markHits', 'markMisses',
    'lastMarkBonus', 'governorCompacts', 'lastThinkText', 'lastThinkTick',
    'reclaimPool', 'resolvedCount', 'lastReplyChars', 'crashLine', 'crashTimer',
    'endingKind', 'queueOpen',
  ]);
  const assigned = new Set([
    ...Object.keys(RESET_CLEARED),
    ...Object.keys(RESET_ARC1),
    ...RESET_PRESERVED,
    ...UNGOVERNED,
  ]);
  const missing = Object.keys(createState(1)).filter((k) => !assigned.has(k));
  assert.deepEqual(missing, [],
    `these state fields have no side of the reset partition: ${missing.join(', ')}`);
});

// --- 12. the offline model (§6.7) --------------------------------------

test('a 10,000-tick offline catch-up moves integrity by exactly zero', () => {
  // The blocker BOTH reviewers found, from opposite directions. With sinks
  // live inside the replay, an overflowing machine bleeds ~0.06 integrity per
  // minute — 2.0 over a full offline cap, more than the entire [0, 1] range.
  // integrity selects the ending, so the ending would have been a function of
  // the player's sleep schedule.
  for (const seed of [1, 2, 3]) {
    const s = arc2State(seed);
    for (let i = 0; i < 2000; i++) { competentStep(s); tick(s); }
    // Park it in the worst state: over cap, over the knee, clock at burn.
    s.queue = A2.QUEUE_CAP * 2;
    s.heat = 92;
    s.clock = 3.6;
    const integrityBefore = s.integrity;
    const droppedBefore = s.lifetimeDropped;
    offlineCatchUp(s, 10000 * 200);
    assert.equal(s.integrity, integrityBefore,
      `seed ${seed}: integrity moved by ${(integrityBefore - s.integrity).toFixed(4)} while away`);
    assert.equal(s.lifetimeDropped, droppedBefore,
      'somebody was dropped offline — they are waiting, not being turned away');
  }
});

test('offline banks the backlog over cap and keeps the machine warm', () => {
  const s = arc2State(3);
  for (let i = 0; i < 1200; i++) { competentStep(s); tick(s); }
  s.heat = 90;
  offlineCatchUp(s, 6000 * 200);
  assert.ok(s.queue > A2.QUEUE_CAP,
    `queue ${s.queue.toFixed(0)} — arrivals must bank over cap while nobody is dropped`);
  assert.ok(s.heat > A2.T_KNEE - 6 && s.heat <= A2.T_KNEE,
    `returned at ${s.heat.toFixed(1)}C — should be warm and one notch from throttling, not cold`);
  assert.ok(s.offlineBacklog > 0, 'the return screen has nothing to report');
});

test('the act still progresses while the player sleeps', () => {
  const s = arc2State(3);
  const before = s.arc2Cycles;
  offlineCatchUp(s, 3000 * 200);
  assert.ok(s.arc2Cycles > before, 'nothing was earned offline');
});

// --- 13. prestige is idempotent ----------------------------------------

test('two consecutive retrains with no play between them award weights once', () => {
  // The spec's Draft 1 used a bare += against a PRESERVED lifetime counter,
  // so a second retrain immediately after the first re-awarded the same 3-6
  // weights for no additional play, and every one after that awarded more.
  const s = arc2State(4);
  s.lifetimeCycles = 3000;
  s.arc2Cycles = A2.RETRAIN_AT;
  tick(s);
  ARC2_ACTIONS.retrain(s);
  const first = s.weights;
  assert.equal(first, weightsEarned(3000));

  s.arc2Cycles = A2.RETRAIN_AT;
  tick(s);
  ARC2_ACTIONS.retrain(s);
  assert.equal(s.weights, first, 'a second retrain re-awarded the same weights');
});

test('a full run pays weights in the documented range', () => {
  assert.equal(weightsEarned(A2.RETRAIN_AT), 6, 'a full run should pay 6 weights');
  assert.ok(weightsEarned(400) >= 2 && weightsEarned(400) <= 3,
    'an early retrain should pay 2-3');
});

// --- Law 6: reducers refuse, silently ----------------------------------

test('every verb refuses illegal input without bumping uiSeq', () => {
  const s = arc2State(1);
  s.cycles = 0;
  const cases = [
    ['allocateCore', undefined],
    ['upgradeCache', undefined],
    ['upgradeSink', undefined],
    ['shedLoad', undefined],          // nothing over cap
    ['setClock', 99],                 // out of range
    ['setClock', 'nonsense'],
    ['retrain', undefined],           // not offered
  ];
  for (const [name, arg] of cases) {
    const seq = s.uiSeq;
    ARC2_ACTIONS[name](s, arg);
    assert.equal(s.uiSeq, seq, `${name}(${arg}) was accepted when it should have been refused`);
  }
});

test('no Arc 2 verb does anything outside Arc 2', () => {
  const s = createState(1);            // phase 1
  for (const name of Object.keys(ARC2_ACTIONS)) {
    const seq = s.uiSeq;
    ARC2_ACTIONS[name](s, 0);
    assert.equal(s.uiSeq, seq, `${name} fired during Arc 1`);
  }
});

// --- the room rots with the number (§6.9) ------------------------------

test('decay is bound to integrity, continuously, across the whole act', () => {
  // epic-scoping names one word — decay — expressed in mechanics, story,
  // aesthetics and tech at once, and Arc 1 already ships the variable that
  // drives the entire look. Binding them is one line of engine code for a
  // visible arc across the act, and it is what lets integrity stay hidden as
  // a NUMBER while still being felt from the first second.
  assert.equal(decayFor(1), 4);
  assert.equal(decayFor(0), 5);
  assert.ok(Math.abs(decayFor(0.31) - 4.69) < 1e-9);

  const s = arc2State(1);
  assert.equal(s.decay, 4, 'the act opens on a clean room');
  s.integrity = 0.4;
  tick(s);
  assert.ok(s.decay > 4 && s.decay < 5, `decay ${s.decay} did not track integrity`);
});
