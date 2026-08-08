// MCP connections.
//
// A playtester asked "what on earth is a tool-class query? Why would I buy
// something big like that without knowing what a tool-class query...is?"
// Two separate faults were behind that.
//
// The copy named a category the game had never shown them — fixed in the
// tray text, and guarded in tooltips.test.js.
//
// And the mechanic did not survive inspection either: the discount was a
// flat multiplier applied the moment tools > 0, so connection #2 (16
// cycles), #3 (26) and every one after cost real money and changed no
// number anywhere. These are the guards on the fix.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { effectiveCost, toolDiscount, toolCost } from '../game/js/engine/actions.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';

const toolQuery = { id: 'q', cost: 100, kind: 'tool', text: 'x', reply: 'y' };
const textQuery = { id: 'q', cost: 100, kind: 'text', text: 'x', reply: 'y' };

test('every connection buys something', () => {
  // The exact defect: paying more for the same number.
  const seen = new Set();
  for (let n = 1; n <= 6; n++) {
    const d = toolDiscount(n);
    if (d === CONST.TOOL_DISCOUNT_FLOOR) break;   // at the floor, repeats are expected
    assert.ok(!seen.has(d), `connection ${n} costs ${toolCost(n - 1)} cycles and changes nothing`);
    seen.add(d);
  }
  assert.ok(seen.size >= 3, 'the discount stops moving almost immediately');
});

test('the discount only ever deepens, and stops at the floor', () => {
  let prev = toolDiscount(1);
  for (let n = 2; n <= 40; n++) {
    const d = toolDiscount(n);
    assert.ok(d <= prev, `connection ${n} made action requests MORE expensive`);
    assert.ok(d >= CONST.TOOL_DISCOUNT_FLOOR, `connection ${n} broke through the floor at ${d}`);
    prev = d;
  }
  assert.equal(toolDiscount(40), CONST.TOOL_DISCOUNT_FLOOR, 'the floor is never reached');
});

test('no tools means no discount at all', () => {
  const s = createState(1);
  assert.equal(toolDiscount(0), 1);
  assert.equal(effectiveCost(s, toolQuery), 100 * CONST.QUERY_COST_MULT);
});

test('the discount touches action requests and nothing else', () => {
  const s = createState(1);
  s.tools = 3;
  const base = 100 * CONST.QUERY_COST_MULT;
  assert.ok(effectiveCost(s, toolQuery) < base, 'action requests are not discounted');
  assert.equal(effectiveCost(s, textQuery), base, 'the discount leaked onto ordinary replies');
});

test('the button quotes the discount it will actually apply', () => {
  // The old cost line advertised a flat −50% forever, which stopped being
  // true at the second connection under any scaling at all.
  for (const tools of [0, 1, 2, 5]) {
    const s = createState(1);
    s.phase = 1;
    s.era = 3;
    s.tools = tools;
    s.lifetimeCycles = 99;
    const spec = actionSpecs(s).find((sp) => sp.testid === 'buy-tool');
    assert.ok(spec, `no MCP button at ${tools} tools`);
    const promised = Math.round((1 - toolDiscount(tools + 1)) * 100);
    // The first connection's cost line leads with "opens errands" rather
    // than a percentage — before any errand has arrived, a discount on them
    // is not the reason to buy. The number still has to appear somewhere on
    // the control, and it must be the number buying actually gives.
    const shown = `${spec.cost} ${spec.tip}`;
    assert.match(shown, new RegExp(`${promised}%`),
      `at ${tools} connected the button promises "${spec.cost}", but buying gives −${promised}%`);
    // And no OTHER percentage may be presented as what this press buys.
    const stale = [...spec.cost.matchAll(/−(\d+)%/g)].map((m) => Number(m[1]));
    for (const n of stale) {
      assert.equal(n, promised, `the cost line advertises −${n}% but buying gives −${promised}%`);
    }
  }
});

test('the button explains the category before asking for the cycles', () => {
  // "Tool-class query" was engine vocabulary on a player-facing control.
  const s = createState(1);
  s.phase = 1;
  s.era = 3;
  s.lifetimeCycles = 99;
  const spec = actionSpecs(s).find((sp) => sp.testid === 'buy-tool');
  const text = `${spec.label} ${spec.cost} ${spec.tip}`.toLowerCase();
  assert.ok(!text.includes('tool-class'),
    `the tray still says "tool-class", which names nothing the player has seen: "${spec.tip}"`);
  // It has to say what the user will ASK FOR, in the user's words. The
  // era-3 pool is all errands: booking, paying, ordering, email.
  const concrete = ['book', 'pay', 'order', 'email', 'calendar', 'account'];
  assert.ok(concrete.some((w) => text.includes(w)),
    `the tip never says what kind of request this is about: "${spec.tip}"`);
});
