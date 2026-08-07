// Hint vocabulary ordering.
//
// The `idle` hint (fires at 1 resolve) taught the K/V cache, which the `kv`
// hint does not reveal until 3 resolves. The player read a sentence about a
// meter that was not on screen and a mechanic nothing had named. Nothing
// caught it, because no test had ever asked in what ORDER the hints fire.
//
// This plays a real run, records the firing order, and asserts that no hint
// uses a gated term before the hint that introduces it has fired.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, loopCost, toolCost } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { HINTS } from '../game/js/engine/content.js';

// term -> the hint id that is allowed to say it first.
const GATED = {
  'k/v': 'kv',
  'cache': 'kv',
  'agentic loop': 'loopAvail',
  'governor': 'governorAvail',
  'mcp': 'toolAvail',
};

// Same competent policy as pacing.test.js: tap at the ceiling, buy the
// cheapest useful thing, keep the buffer workable.
function hintOrder(seed, maxTicks = 60000) {
  const s = createState(seed);
  for (let t = 0; t < maxTicks && s.phase === 1; t++) {
    ACTIONS.processToken(s);
    ACTIONS.processToken(s);
    if (s.bufferUnlocked && s.stale >= 90) {
      if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
      else if (!s.compacting) ACTIONS.compactStart(s);
    }
    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    }
    tick(s);
  }
  // hintsSeen also carries asides and mid-era markers; keep the real hints.
  return s.hintsSeen.filter((id) => HINTS[id]);
}

test('no hint names a mechanic before the hint that reveals it', () => {
  for (const seed of [1000, 1274, 1548, 1822]) {
    const order = hintOrder(seed);
    assert.ok(order.length > 4, `seed ${seed}: only ${order.length} hints fired`);
    order.forEach((id, i) => {
      const text = HINTS[id].toLowerCase();
      for (const [term, owner] of Object.entries(GATED)) {
        if (id === owner || !text.includes(term)) continue;
        const ownerAt = order.indexOf(owner);
        assert.ok(
          ownerAt !== -1 && ownerAt < i,
          `seed ${seed}: hint "${id}" says "${term}" but "${owner}" fires ` +
          `${ownerAt === -1 ? 'never' : `later (position ${ownerAt} vs ${i})`}`,
        );
      }
    });
  }
});

test('the kv hint really is the one that introduces the cache', () => {
  // Guards the table above: if the reveal moves, this fails rather than
  // letting GATED point at a hint that no longer teaches the term.
  assert.match(HINTS.kv.toLowerCase(), /k\/v cache/);
});
