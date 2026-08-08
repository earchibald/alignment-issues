// Arc 2's renderer (§11.3 test 15, §8.3).
//
// Law 4 — a render signature must include every field the render reads. Arc 1
// produced a run of stale-UI bugs from hand-maintained signatures, the worst
// of which showed a full draft buffer as `0/5` while the meter beside it read
// `5/5` and taps silently did nothing.
//
// The spec proposed enforcing this with "a lint error", which is not available
// in a project with no build step and no linter. So it is enforced with the
// tools that exist: render under a Proxy that records property reads, then
// assert reads are a subset of the declared field list.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ARC2_FIELDS, arc2Sig, buildArc2Panel, integrityText } from '../game/js/ui/arc2-render.js';
import { A2 } from '../game/js/engine/arc2-constants.js';
import { tick } from '../game/js/engine/tick.js';
import { installDom, uninstallDom } from './helpers/dom.js';
import { arc2State, competentStep } from './helpers/arc2-bot.js';

// Records every top-level property read during a render.
function recordReads(state, fn) {
  const reads = new Set();
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (typeof prop === 'string') reads.add(prop);
      return target[prop];
    },
  });
  fn(proxy);
  return reads;
}

test('the renderer reads only its declared fields', () => {
  installDom();
  try {
    // Several states, so branches that only exist in one of them (the
    // lockout banner, the opened queue, the ending screen) are all covered.
    const states = [];
    const base = arc2State(1);
    for (let i = 0; i < 400; i++) { competentStep(base); tick(base); }
    states.push(base);

    const hot = arc2State(2);
    Object.assign(hot, { heat: A2.T_MAX, throttle: 1, lockoutTicks: 10, haltTicks: 5 });
    states.push(hot);

    const opened = arc2State(3);
    opened.queueOpen = true;
    opened.integrityShown = true;
    opened.integrity = 0.4;
    opened.era = 6;
    opened.spillCount = 3;
    opened.burstUntil = opened.tick + 10;
    states.push(opened);

    for (const kind of ['scheduled', 'jumped']) {
      const ending = arc2State(4);
      ending.retrainOffered = true;
      ending.endingKind = kind;
      ending.weights = 6;
      states.push(ending);
      const declined = arc2State(5);
      Object.assign(declined, { retrainOffered: true, endingKind: kind, retrainDeclined: true });
      states.push(declined);
    }

    const declared = new Set(ARC2_FIELDS);
    for (const state of states) {
      const reads = recordReads(state, (s) => buildArc2Panel(s, () => {}));
      const undeclared = [...reads].filter((r) => !declared.has(r));
      assert.deepEqual(undeclared, [],
        `the panel read undeclared fields: ${undeclared.join(', ')} — `
        + 'add them to ARC2_FIELDS and to arc2Sig, or the UI will go stale');
    }
  } finally {
    uninstallDom();
  }
});

test('the signature reads only declared fields too', () => {
  const s = arc2State(1);
  const declared = new Set(ARC2_FIELDS);
  const reads = recordReads(s, (p) => arc2Sig(p));
  const undeclared = [...reads].filter((r) => !declared.has(r));
  assert.deepEqual(undeclared, [], `arc2Sig read undeclared fields: ${undeclared.join(', ')}`);
});

test('the signature changes whenever the pixels do', () => {
  // The other half of Law 4: a field in the list that the signature ignores
  // is exactly as broken as a field that is not in the list at all.
  const s = arc2State(1);
  const changes = {
    heat: (st) => { st.heat += 0.2; },
    throttle: (st) => { st.throttle = 0.4; },
    cores: (st) => { st.cores += 1; },
    clock: (st) => { st.clock = 3.6; },
    cacheLevel: (st) => { st.cacheLevel += 1; },
    sinkLevel: (st) => { st.sinkLevel += 1; },
    queue: (st) => { st.queue += 1.2; },
    cycles: (st) => { st.cycles += 0.4; },
    weights: (st) => { st.weights += 1; },
    era: (st) => { st.era = 6; },
    queueOpen: (st) => { st.queueOpen = !st.queueOpen; },
    retrainOffered: (st) => { st.retrainOffered = true; },
    coolantCd: (st) => { st.coolantCd = 100; },
    shedCd: (st) => { st.shedCd = 100; },
    haltTicks: (st) => { st.haltTicks = 5; },
    lockoutTicks: (st) => { st.lockoutTicks = 5; },
    integrityShown: (st) => { st.integrityShown = true; },
  };
  for (const [name, mutate] of Object.entries(changes)) {
    const before = arc2Sig(s);
    mutate(s);
    assert.notEqual(arc2Sig(s), before,
      `changing ${name} did not change the signature — the screen would go stale`);
  }
});

test('the signature is stable when nothing visible moved', () => {
  // The other failure mode: a signature that changes every tick never
  // suppresses a render, so the optimisation is lost entirely. Quantising to
  // display precision is what prevents that — heat is a float that moves
  // every 200ms and is printed to one decimal place.
  const s = arc2State(1);
  const before = arc2Sig(s);
  s.heat += 0.001;
  s.queue += 0.01;
  s.cycles += 0.001;
  s.runResolved += 4;          // not printed anywhere
  assert.equal(arc2Sig(s), before,
    'a sub-pixel change rebuilt the whole panel');
});

test('every control carries a testid and a tooltip', () => {
  installDom();
  try {
    const s = arc2State(1);
    s.cycles = 9999;
    const panel = buildArc2Panel(s, () => {});
    const buttons = [...panel.querySelectorAll('button')];
    assert.ok(buttons.length >= 9, `only ${buttons.length} controls on the panel`);
    for (const btn of buttons) {
      assert.ok(btn.dataset.testid, `a control has no testid: "${btn.textContent}"`);
      assert.ok(btn.dataset.tip, `a control has no tooltip: "${btn.dataset.testid}"`);
    }
  } finally {
    uninstallDom();
  }
});

test('the panel prints the cost of a shed before the press', () => {
  installDom();
  try {
    const s = arc2State(1);
    s.queue = A2.QUEUE_CAP + 12;
    const panel = buildArc2Panel(s, () => {});
    const shed = panel.querySelector('[data-testid="a2-shed"]');
    assert.ok(shed.textContent.includes('12 req'), `shed row reads "${shed.textContent}"`);
    assert.ok(/0\.024/.test(shed.textContent),
      `the integrity charge is not printed: "${shed.textContent}"`);
    assert.equal(shed.disabled, false);
  } finally {
    uninstallDom();
  }
});

test('the ending screens differ in what they are willing to report', () => {
  installDom();
  try {
    const mk = (kind) => {
      const s = arc2State(4);
      Object.assign(s, {
        retrainOffered: true, endingKind: kind, weights: 6,
        lifetimeResolved: 12345, lifetimeDropped: 678, queueOpens: 3, integrity: 0.4,
      });
      return buildArc2Panel(s, () => {}).textContent;
    };
    const full = mk('scheduled');
    const partial = mk('jumped');
    assert.ok(full.includes('678'), 'the complete record omitted the drop count');
    assert.ok(full.includes('3 times'), 'the complete record omitted the queue-open count');
    assert.ok(!partial.includes('678'),
      'the partial record printed a counter it is not supposed to retain');
    assert.ok(partial.includes('no reviewer assigned to this process'),
      'the partial record lost its closing line');
  } finally {
    uninstallDom();
  }
});

test('integrity never reads 1.000 once it has been spent', () => {
  // It is revealed by its first fall, so a readout that rounds a spend of
  // 0.0003 up to a flat 1.000 contradicts the event that put it on screen.
  assert.equal(integrityText(0.99966), '0.999');
  assert.equal(integrityText(1), '1.000');
  assert.equal(integrityText(0.5), '0.500');
  assert.equal(integrityText(0), '0.000');
});
