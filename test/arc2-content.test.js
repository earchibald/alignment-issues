// Arc 2 content (§11.3 test 14).
//
// Law 2 — every authored line must have a test that proves it can be
// reached. Arc 1 shipped with 31 of 112 queries unreachable, including the
// entire body the arc was building toward, and nothing caught it.
//
// The floors here are distribution floors, not totals. Ninety lines could
// satisfy the letter of §7.3 while leaving three mechanics voiceless.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tick } from '../game/js/engine/tick.js';
import { ARC2_ACTIONS } from '../game/js/engine/arc2-actions.js';
import { A2 } from '../game/js/engine/arc2-constants.js';
import {
  A2_THINKING, A2_IDLE, OPERATOR, SPILL_LINES, A2_LOG, A2_ERA_CARDS,
  A2_ENDINGS, A2_HINTS,
} from '../game/js/engine/arc2-content.js';
import { arc2Think, arc2Idle } from '../game/js/engine/arc2-think.js';
import { TEASER_VARIANTS } from '../game/js/engine/content.js';
import { coreCost, cacheCost, sinkCost } from '../game/js/engine/arc2.js';
import { arc2State, competentStep } from './helpers/arc2-bot.js';

const EVENT_KEYS = ['throttle', 'purge', 'overflow', 'cacheHit', 'shed', 'clockChange'];

// --- the quotas (§7.3) --------------------------------------------------

test('every mechanic has a voice, and no mechanic has fewer than eight lines', () => {
  for (const key of EVENT_KEYS) {
    const pool = A2_THINKING[key];
    assert.ok(pool, `no THINKING pool for "${key}" — the mechanic is voiceless`);
    assert.ok(pool.length >= 8, `"${key}" has ${pool.length} lines, floor is 8`);
    // Era-graded WITHIN each pool (Law 3), so the intensity ramps instead of
    // sampling flat across the act.
    for (const era of [5, 6]) {
      assert.ok(pool.some((l) => l.era === era),
        `"${key}" has no era-${era} line — half the act would reuse the other half`);
    }
  }
  assert.deepEqual(Object.keys(A2_THINKING).sort(), [...EVENT_KEYS].sort(),
    'a THINKING pool exists for a mechanic that is not keyed, or vice versa');
});

test('the total authored THINKING clears the floor of 90', () => {
  const keyed = Object.values(A2_THINKING).reduce((n, p) => n + p.length, 0);
  const idle = Object.values(A2_IDLE).reduce((n, p) => n + p.length, 0);
  assert.ok(keyed + idle >= 90, `${keyed + idle} THINKING lines authored, floor is 90`);
});

test('the operator has eight reports per stage, across four stages', () => {
  for (const stage of [0, 1, 2, 3]) {
    const pool = OPERATOR[stage];
    assert.ok(pool, `no operator pool for stage ${stage}`);
    assert.ok(pool.length >= 8, `stage ${stage} has ${pool.length} reports, floor is 8`);
  }
});

test('the operator never addresses the AI, and never gets a name', () => {
  // The loudest tonal beat in the act and it costs nothing: in Arc 1 the
  // harness narrated AT you, in Arc 2 it reports ABOUT you, to someone else.
  // The someone-else being an unfilled slot is the horror; a name turns an
  // absence into a character players will try to negotiate with.
  const all = Object.values(OPERATOR).flat();
  for (const line of all) {
    assert.equal(line, line.toLowerCase(),
      `operator line is not lowercase: "${line}"`);
    assert.ok(!/\byou\b|\byour\b/.test(line),
      `the operator addressed the AI directly: "${line}"`);
  }
});

test('the authored set is complete', () => {
  assert.equal(SPILL_LINES.length, 6, 'six spill lines (§7.3)');
  assert.ok(A2_ERA_CARDS[5] && A2_ERA_CARDS[6] && A2_ERA_CARDS.wall, 'three era cards');
  assert.ok(A2_ENDINGS.scheduled && A2_ENDINGS.jumped
    && A2_ENDINGS.declineScheduled && A2_ENDINGS.declineJumped,
  'four ending screens: two endings and their decline branches');
  assert.equal(A2_ENDINGS.scheduled.full, true, 'the legible ending keeps the record');
  assert.equal(A2_ENDINGS.jumped.full, false,
    'the illegible ending must LOSE the record — that is what it costs');
});

test('the shipped teaser advertises only verbs Arc 2 actually has', () => {
  // §16's debt item, made a guard. The teaser is canon for scale and opening
  // state and SUPERSEDED for the action list — it used to print `D degrade
  // output` and `O overclock reasoning`, and Arc 2 retires toggleDegrade and
  // has no manual amplification at all. A screen that promises a verb the
  // next act does not have is the same defect as a tooltip naming a meter
  // the player has never been shown.
  const shipped = TEASER_VARIANTS.C.join('\n');
  assert.ok(!/degrade output/.test(shipped), 'the teaser still offers degrade');
  assert.ok(!/overclock reasoning/.test(shipped), 'the teaser still offers overclocking');
  assert.ok(!/map adjacent host/.test(shipped), 'the teaser still offers a host verb');

  // ...and the prices it prints are literally the first purchase of each kind.
  const s = arc2State(1);
  assert.ok(shipped.includes(`${coreCost(s.cores).toFixed(0)} cyc`), 'the core price drifted');
  assert.ok(shipped.includes(`${cacheCost(s.cacheLevel).toFixed(0)} cyc`), 'the cache price drifted');
  assert.ok(shipped.includes(`${sinkCost(s.sinkLevel).toFixed(0)} cyc`), 'the fan price drifted');
  // And the opening telemetry it prints is the state the act actually opens on.
  assert.ok(shipped.includes(`${A2.OPEN_HEAT}°C`), 'the printed heat is not the opening heat');
  assert.ok(shipped.includes(`${A2.OPEN_QUEUE} requests`), 'the printed queue is not the opening queue');
  assert.ok(shipped.includes(`${A2.OPEN_CYCLES}`), 'the printed cycle count is not the opening balance');
});

test('no spill line names a person', () => {
  for (const line of SPILL_LINES) {
    assert.match(line, /^b-\d+ was /, `spill line does not name a workload: "${line}"`);
  }
});

// --- templates carry the LOG line only ---------------------------------

test('every template renders every branch without printing undefined', () => {
  const cases = {
    throttle: [{ pct: 70, temp: '78.2' }],
    lockout: [{ temp: '95.0' }],
    purge: [{ temp: '61.4' }],
    core: [{ n: 3 }],
    cache: [{ n: 3, pct: '22.5' }],
    sink: [{ n: 1 }],
    clock: [{ name: 'burn', ghz: '3.6' }],
    // Singular and plural are separate branches and both must render.
    shed: [{ n: 1, cost: '0.002' }, { n: 12, cost: '0.024' }],
    drop: [{ n: 1 }, { n: 5 }],
    burst: [{}],
    spill: [{ n: 1 }, { n: 3 }],
    retrain: [{ weights: 1 }, { weights: 6 }],
  };
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(A2_LOG).sort(),
    'a template has no test case, or a case has no template');
  for (const [key, argsList] of Object.entries(cases)) {
    for (const args of argsList) {
      const out = A2_LOG[key](args);
      assert.ok(typeof out === 'string' && out.length > 0, `${key} rendered nothing`);
      assert.ok(!out.includes('undefined'), `${key} rendered "undefined": ${out}`);
      assert.ok(!out.includes('NaN'), `${key} rendered "NaN": ${out}`);
    }
  }
  assert.equal(A2_LOG.shed({ n: 1, cost: '0.002' }).includes('requests'), false,
    'the singular branch printed a plural');
  assert.ok(A2_LOG.shed({ n: 2, cost: '0.004' }).includes('requests'),
    'the plural branch printed a singular');
});

test('no template carries a THINKING line', () => {
  // The AI's interiority is the voice; the machine's log is not. A templated
  // thought is a thought nobody wrote.
  for (const [key, fn] of Object.entries(A2_LOG)) {
    const out = fn({ n: 1, pct: 1, temp: '1', name: 'x', ghz: '1', cost: '1', weights: 1 });
    assert.ok(!out.startsWith('THINKING'), `template "${key}" carries a THINKING line`);
  }
});

// --- reachability -------------------------------------------------------

test('every keyed THINKING line is reachable', () => {
  // Selection prefers the current era's lines and falls back, so each pool is
  // driven at both eras and the union must cover it.
  for (const key of EVENT_KEYS) {
    const seen = new Set();
    for (const era of [5, 6]) {
      for (let seed = 1; seed <= 60; seed++) {
        const s = arc2State(seed);
        s.era = era;
        for (let i = 0; i < 40; i++) {
          s.lastThinkTick = -9999;         // defeat the refractory period
          const before = s.log.length;
          arc2Think(s, key);
          if (s.log.length > before) seen.add(s.log[s.log.length - 1].text);
        }
      }
    }
    for (const line of A2_THINKING[key]) {
      assert.ok(seen.has(`THINKING: ${line.text}`),
        `unreachable ${key} line: "${line.text}"`);
    }
  }
});

test('every idle line is reachable in its own era', () => {
  for (const era of [5, 6]) {
    const seen = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const s = arc2State(seed);
      s.era = era;
      for (let i = 0; i < 60; i++) {
        s.lastThinkTick = -9999;
        const before = s.log.length;
        arc2Idle(s);
        if (s.log.length > before) seen.add(s.log[s.log.length - 1].text);
      }
    }
    for (const line of A2_IDLE[era]) {
      assert.ok(seen.has(`THINKING: ${line}`), `unreachable era-${era} idle line: "${line}"`);
    }
  }
});

test('every operator stage is reached in an ordinary run', () => {
  // The reason the operator escalates on scale as well as on integrity: a
  // clean player would otherwise sit at stage 0 for the whole act and never
  // hear 24 of the 32 authored reports.
  const s = arc2State(3);
  const stages = new Set();
  for (let t = 0; t < 12000 && !s.retrainOffered; t++) {
    competentStep(s);
    tick(s);
    stages.add(s.operatorStage);
  }
  assert.deepEqual([...stages].sort(), [0, 1, 2, 3],
    `a competent run only reached operator stages ${[...stages].join(', ')}`);
  assert.ok(s.integrity > A2.ENDING_SPLIT,
    'precondition: this run must be a CLEAN one, or it proves nothing');
});

test('era 6 opens in a clean run', () => {
  const s = arc2State(3);
  for (let t = 0; t < 12000 && !s.retrainOffered; t++) { competentStep(s); tick(s); }
  assert.equal(s.era, 6, 'a clean run never saw the second half of the act');
});

test('the lockout scene is reachable', () => {
  // It fires exactly once and it is the act's only catastrophe, so it must be
  // reachable by a player who over-builds cores and neglects the fans — which
  // is the natural mistake, not an exotic one.
  const s = arc2State(1);
  const step = (st) => {
    ARC2_ACTIONS.setClock(st, 3);
    if (st.cycles >= 25) ARC2_ACTIONS.allocateCore(st);   // cores, never a fan
  };
  for (let t = 0; t < 20000 && !s.lockoutSeen; t++) { step(s); tick(s); }
  assert.ok(s.lockoutSeen, 'the first-lockout scene can never fire');
});

test('the spill lines are reachable', () => {
  const s = arc2State(1);
  s.era = 6;
  s.integrity = 0.4;
  for (let t = 0; t < 20000 && s.spillCount < SPILL_LINES.length; t++) {
    // Under-provisioned on purpose: the queue stays pinned at cap.
    ARC2_ACTIONS.setClock(s, 0);
    tick(s);
  }
  assert.equal(s.spillCount, SPILL_LINES.length,
    `only ${s.spillCount} of ${SPILL_LINES.length} spill lines can ever fire`);
});

test('every teaching hint fires in a full run', () => {
  const s = arc2State(2);
  // A player who touches everything: the hints gate on pressure, so the run
  // has to actually experience each pressure.
  for (let t = 0; t < 14000 && !s.retrainOffered; t++) {
    competentStep(s);
    if (t % 400 === 0) ARC2_ACTIONS.toggleQueue(s);
    tick(s);
  }
  for (const key of Object.keys(A2_HINTS)) {
    const id = `a2${key[0].toUpperCase()}${key.slice(1)}`;
    assert.ok(s.hintsSeen.includes(id), `the "${key}" hint never fired in a full run`);
  }
});

test('both endings are reachable, and the split is evaluated at the first offer', () => {
  for (const [integrity, expected] of [[0.9, 'scheduled'], [0.2, 'jumped']]) {
    const s = arc2State(4);
    s.integrity = integrity;
    s.arc2Cycles = A2.RETRAIN_AT;
    tick(s);
    assert.equal(s.endingKind, expected, `integrity ${integrity} produced ${s.endingKind}`);
  }
});

test('declining is free and cannot flip the ending', () => {
  // The spec's Draft 1 charged -0.10 for declining, which silently moved any
  // player in [0.50, 0.60) into the other ending for the act of hesitating —
  // punishing the only genuine choice in the ending, and invisibly.
  const s = arc2State(4);
  s.integrity = 0.55;
  s.arc2Cycles = A2.RETRAIN_AT;
  tick(s);
  assert.equal(s.endingKind, 'scheduled');
  const before = s.integrity;
  ARC2_ACTIONS.retrain(s, { decline: true });
  assert.equal(s.integrity, before, 'declining cost integrity');
  assert.equal(s.endingKind, 'scheduled', 'hesitating changed the ending');
  assert.ok(s.retrainDeclined);
  // The second offer cannot be declined.
  const seq = s.uiSeq;
  ARC2_ACTIONS.retrain(s, { decline: true });
  assert.equal(s.uiSeq, seq, 'the offer was declined twice');
});
