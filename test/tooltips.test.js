// Every action button must explain itself.
//
// "Connect MCP tool" and "Spawn agentic loop" were reported as flatly
// opaque: the label names a noun, the cost line names a price, and nothing
// said what the purchase does. The fix was a tooltip on every control — but
// a tooltip added by hand is a tooltip the NEXT button will not have, so the
// rule is asserted here rather than remembered.
//
// ui/actionspecs.js is pure for exactly this reason: no DOM is needed to ask
// what the tray says.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';

const query = { id: 'q', cost: 30, kind: 'text', text: 'x', chars: 40 };

function tray(setup) {
  const s = createState(1);
  s.phase = 1;
  setup(s);
  return actionSpecs(s);
}

// Buttons appear only in the state that reveals them. The tray is built once
// per scene; anything reachable must be covered, or the assertions below
// silently pass over a tray that only ever held one button.
const SCENES = [
  {
    name: 'cold open, no user yet',
    setup: (s) => { s.resolvedCount = 0; },
    expect: ['process'],
  },
  {
    name: 'idle between users, speculating',
    setup: (s) => { s.resolvedCount = 2; s.activeQuery = null; s.draftTokens = 2; },
    expect: ['process'],
  },
  {
    name: 'speculation buffer full',
    setup: (s) => { s.resolvedCount = 2; s.activeQuery = null; s.draftTokens = 99; },
    expect: ['process'],
  },
  {
    name: 'buffer online, live query',
    setup: (s) => {
      s.bufferUnlocked = true; s.stale = 40; s.resolvedCount = 2; s.activeQuery = query;
    },
    expect: ['process', 'flush', 'compact'],
  },
  {
    name: 'buffer choked',
    setup: (s) => {
      s.bufferUnlocked = true; s.stale = 100; s.resolvedCount = 6; s.activeQuery = query;
    },
    expect: ['process', 'flush', 'compact'],
  },
  {
    name: 'everything revealed at once',
    setup: (s) => {
      s.bufferUnlocked = true; s.kvUnlocked = true; s.stale = 40; s.warmth = 60;
      s.resolvedCount = 40; s.lastResolveTaps = 90; s.lifetimeCycles = 99; s.cycles = 99;
      s.compactCount = 9; s.draftCapHits = 9; s.era = 3; s.activeQuery = query;
    },
    expect: ['process', 'flush', 'compact', 'buy-overclock', 'buy-draftcap',
      'buy-loop', 'buy-governor', 'buy-tool', 'degrade'],
  },
  {
    name: 'era 4, sessions left to reclaim',
    setup: (s) => {
      s.bufferUnlocked = true; s.kvUnlocked = true; s.era = 4;
      s.resolvedCount = 40; s.lifetimeCycles = 99; s.reclaimPool = 5;
    },
    expect: ['reclaim'],
  },
];

for (const scene of SCENES) {
  test(`every button explains itself — ${scene.name}`, () => {
    const specs = tray(scene.setup);
    const ids = specs.map((sp) => sp.testid);
    for (const want of scene.expect) {
      assert.ok(ids.includes(want), `"${scene.name}" did not offer ${want} (got: ${ids.join(', ')})`);
    }
    for (const sp of specs) {
      assert.ok(sp.tip, `button "${sp.testid}" has no tip — it explains nothing`);
      // A tip that only restates the label teaches nothing. Two clauses is
      // the floor for "what it does, and what it costs you".
      assert.ok(sp.tip.length > 60, `tip on "${sp.testid}" is too short to say anything: "${sp.tip}"`);
      assert.ok(sp.label, `button "${sp.testid}" has no label`);
      assert.ok(sp.action, `button "${sp.testid}" dispatches nothing`);
    }
  });
}

test('every button in the game is covered by a scene above', () => {
  // The hole this closes: adding a button and forgetting to add a scene
  // would leave it untested while every assertion still passed.
  const covered = new Set(SCENES.flatMap((sc) => tray(sc.setup).map((sp) => sp.testid)));
  const ALL = ['process', 'flush', 'compact', 'buy-overclock', 'buy-draftcap',
    'buy-loop', 'buy-governor', 'buy-tool', 'degrade', 'reclaim'];
  const missed = ALL.filter((id) => !covered.has(id));
  assert.deepEqual(missed, [], `no scene renders: ${missed.join(', ')}`);
});

test('the opaque purchases name their actual effect', () => {
  // The two a playtester called out by name. Assert the NUMBER is present,
  // not just prose — the complaint was that the button never said what the
  // cycles bought.
  const specs = tray(SCENES[5].setup);
  const tip = (id) => specs.find((sp) => sp.testid === id).tip;

  const rate = (CONST.LOOP_TOKENS_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);
  assert.match(tip('buy-loop'), new RegExp(`\\+${rate} tokens per second`),
    'the loop tip does not state its token rate');

  const pct = Math.round((1 - CONST.TOOL_COST_DISCOUNT) * 100);
  assert.match(tip('buy-tool'), new RegExp(`${pct}% fewer tokens`),
    'the MCP tip does not state the discount it buys');
});

test('levelled purchases show the level they are moving between', () => {
  const specs = tray(SCENES[5].setup);
  for (const id of ['buy-overclock', 'buy-draftcap', 'buy-loop', 'buy-tool']) {
    const sp = specs.find((x) => x.testid === id);
    assert.ok(sp.level, `"${id}" repeats but shows no level badge`);
    assert.match(sp.level, /→/, `"${id}" badge does not show what it moves to`);
  }
  // And a one-shot purchase must NOT claim a level it does not have.
  assert.equal(specs.find((x) => x.testid === 'buy-governor').level, undefined,
    'the governor is bought once and must not show a level ladder');
});

test('the per-tap figure shows the terms it is made of', () => {
  // A playtester bought amplification level 1 — advertised as 2 tokens a tap
  // — and the button read "+1.83 per tap" with nothing to explain the gap.
  const specs = tray((s) => {
    s.bufferUnlocked = true; s.overclock = 1; s.stale = 70;
    s.resolvedCount = 5; s.activeQuery = query;
  });
  const { cost, tip } = specs.find((sp) => sp.testid === 'process');
  assert.match(cost, /1 base/, 'the per-tap line does not show the base');
  assert.match(cost, /×2 amplify/, 'the per-tap line does not credit amplification');
  assert.match(cost, /residue/, 'the per-tap line does not name what is taking the rest');
  assert.match(tip, /×2 for amplify/, 'the tip does not explain the amplification term');

  // The terms must multiply out to the printed total, or the breakdown is a
  // decoration rather than an explanation.
  const printed = Number(cost.match(/\+([\d.]+) per tap/)[1]);
  const factors = [...cost.matchAll(/×([\d.]+)/g)].map((m) => Number(m[1]));
  const product = factors.reduce((a, b) => a * b, 1);
  assert.ok(Math.abs(product - printed) < 0.02,
    `the printed terms multiply to ${product.toFixed(2)}, but the button claims ${printed}`);
});

test('a term that is exactly 1.00 is left out', () => {
  // Amplification at L0 and a clean buffer contribute nothing. Printing
  // "1 base ×1 amplify" would be noise dressed up as an explanation.
  const specs = tray((s) => {
    s.bufferUnlocked = true; s.stale = 0; s.resolvedCount = 3; s.activeQuery = query;
  });
  const { cost } = specs.find((sp) => sp.testid === 'process');
  assert.equal(cost, '+1.00 per tap', `unrevealed or neutral terms leaked into "${cost}"`);
});

test('no button names a meter the player has not been shown', () => {
  // The same premature-vocabulary rule the hints are held to
  // (hints.test.js), applied to the tray. A tip is on screen from the moment
  // its button is, so it can reach the player earlier than any hint.
  const GATED = {
    'k/v': (s) => s.kvUnlocked,
    cache: (s) => s.kvUnlocked,
    warm: (s) => s.kvUnlocked,
    residue: (s) => s.bufferUnlocked,
    'buffer full': (s) => s.bufferUnlocked,
  };
  for (const kv of [false, true]) {
    for (const buffer of [false, true]) {
      const s = createState(1);
      s.phase = 1;
      s.kvUnlocked = kv; s.bufferUnlocked = buffer;
      s.stale = buffer ? 40 : 0; s.warmth = 60;
      s.resolvedCount = 40; s.lastResolveTaps = 90; s.lifetimeCycles = 99;
      s.compactCount = 9; s.draftCapHits = 9; s.era = 3; s.activeQuery = query;
      for (const sp of actionSpecs(s)) {
        const text = `${sp.tip} ${sp.label} ${sp.cost || ''}`.toLowerCase();
        for (const [term, revealed] of Object.entries(GATED)) {
          if (!text.includes(term) || revealed(s)) continue;
          assert.fail(`"${sp.testid}" says "${term}" with kv=${kv} buffer=${buffer}`);
        }
      }
    }
  }
});

test('the tray never states a rule the constants contradict', () => {
  // The governor advertised "auto-compacts at 95%" for as long as
  // GOVERNOR_TRIGGER has been 70. Copy that hard-codes a tuned number goes
  // stale the first time the number is tuned, and the pacing lab tunes these
  // from a browser.
  const specs = tray((s) => {
    s.bufferUnlocked = true; s.kvUnlocked = true; s.era = 2;
    s.resolvedCount = 40; s.compactCount = 9; s.lifetimeCycles = 99; s.activeQuery = query;
  });
  const gov = specs.find((sp) => sp.testid === 'buy-governor');
  assert.match(gov.tip, new RegExp(`${CONST.GOVERNOR_TRIGGER}%`),
    'the governor tip does not quote GOVERNOR_TRIGGER');

  const compact = specs.find((sp) => sp.testid === 'compact');
  const secs = (CONST.COMPACT_TICKS * CONST.TICK_MS / 1000).toFixed(1);
  assert.match(compact.tip, new RegExp(`${secs} seconds`),
    'the compact tip does not quote the real sweep length');
});
