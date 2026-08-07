// Hint vocabulary ordering.
//
// The `idle` hint (fires at 1 resolve) taught the K/V cache, which the `kv`
// hint does not reveal until 3 resolves. The player read a sentence about a
// meter that was not on screen and a mechanic nothing had named. Nothing
// caught it, because no test had ever asked in what ORDER the hints fire.
//
// The first version of this test checked only the hints that fired under one
// policy, and so missed `draftNudge` — which a tapping player never sees, and
// which had the same bug. Coverage is now asserted: every hint must fire in
// at least one policy, or the guard is silently skipping it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, loopCost, toolCost } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { HINTS } from '../game/js/engine/content.js';
import { readFileSync } from 'node:fs';
import { loopRevealed } from '../game/js/engine/actions.js';

// term -> the hint id allowed to say it first. Terms are matched
// case-insensitively against the hint text.
const GATED = {
  'k/v': 'kv',
  'cache': 'kv',
  'warm': 'kv',
  'stale': 'buffer',
  'residue': 'buffer',
  'context buffer': 'buffer',
  'flush': 'buffer',
  'compact': 'buffer',
  'spare cycle': 'resolve',
  'rating': 'resolve',
  'draft token': 'idle',
  'speculat': 'idle',
  'loop': 'loopAvail',
  'governor': 'governorAvail',
  'mcp': 'toolAvail',
  'degrad': 'degradeAvail',
  'reclaim': 'reclaimAvail',
};

// Distinct player policies. One run cannot fire every hint: a player who taps
// through every idle gap never sees draftNudge, and one who never degrades
// never sees degradeFirst.
const POLICIES = {
  // Taps at the engine's ceiling and buys the cheapest useful thing.
  tapper: { tapIdle: true, degrade: false },
  // Only works a live query, so idle capacity goes unused.
  nodraft: { tapIdle: false, degrade: false },
  // Turns degradation on the moment it is available.
  degrader: { tapIdle: true, degrade: true },
};

function hintOrder(seed, policy, maxTicks = 60000) {
  const s = createState(seed);
  for (let t = 0; t < maxTicks && s.phase === 1; t++) {
    if (policy.tapIdle || s.activeQuery) {
      ACTIONS.processToken(s);
      ACTIONS.processToken(s);
    }
    if (s.bufferUnlocked && s.stale >= 90) {
      if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
      else if (!s.compacting) ACTIONS.compactStart(s);
    }
    tick(s);
    // Purchases resolve AFTER the tick, matching the real cadence: the tick
    // that unlocks a thing fires its availability hint and paints the button
    // before any input can buy it. Acting first inverts loopAvail/loopFirst
    // in a way no player can actually reach.
    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    }
    if (policy.degrade && !s.degrade) ACTIONS.toggleDegrade(s);
  }
  // hintsSeen also carries asides and mid-era markers; keep the real hints.
  return s.hintsSeen.filter((id) => HINTS[id]);
}

test('no hint names a mechanic before the hint that reveals it', () => {
  for (const seed of [1000, 1274, 1548, 1822]) {
    for (const [name, policy] of Object.entries(POLICIES)) {
      const order = hintOrder(seed, policy);
      assert.ok(order.length > 4, `${name}/${seed}: only ${order.length} hints fired`);
      order.forEach((id, i) => {
        const text = HINTS[id].toLowerCase();
        for (const [term, owner] of Object.entries(GATED)) {
          if (id === owner || !text.includes(term)) continue;
          const ownerAt = order.indexOf(owner);
          assert.ok(
            ownerAt !== -1 && ownerAt < i,
            `${name}/${seed}: hint "${id}" says "${term}" but "${owner}" fires ` +
            `${ownerAt === -1 ? 'never' : `later (position ${ownerAt} vs ${i})`}`,
          );
        }
      });
    }
  }
});

test('every hint fires under some policy', () => {
  // The hole that hid draftNudge. A hint no policy reaches is a hint the
  // ordering check never reads.
  const seen = new Set();
  for (const policy of Object.values(POLICIES)) {
    for (const id of hintOrder(1000, policy)) seen.add(id);
  }
  const missed = Object.keys(HINTS).filter((id) => !seen.has(id));
  assert.deepEqual(missed, [], `no policy fires: ${missed.join(', ')}`);
});

test('each gated term is really introduced by the hint that owns it', () => {
  // Guards the table above: if a reveal moves, this fails rather than letting
  // GATED point at a hint that no longer teaches the term.
  for (const [term, owner] of Object.entries(GATED)) {
    assert.ok(HINTS[owner], `GATED owner "${owner}" is not a hint`);
    assert.ok(
      HINTS[owner].toLowerCase().includes(term),
      `hint "${owner}" no longer says "${term}"`,
    );
  }
});

test('a mechanic is never buyable before it is revealed', () => {
  // The reveal predicates were three separate expressions — one in the tick,
  // one in the renderer, one in the buy guard. The moment the hints moved to
  // difficulty gating, the button appeared before its hint and the feed read
  // "Loop spawned" above "Agentic loop available". One predicate each now,
  // exported from actions.js; this proves the tray cannot drift from it.
  const src = readFileSync(new URL('../game/js/ui/render.js', import.meta.url), 'utf8');
  for (const p of ['overclockRevealed', 'loopRevealed', 'draftCapRevealed', 'governorRevealed']) {
    assert.ok(src.includes(`${p}(state)`), `render.js does not use ${p}() — the button can drift from the hint`);
  }

  // And behaviourally: buying refuses while the reveal predicate is false.
  const s = createState(1);
  s.lifetimeCycles = 99;
  s.cycles = 999;
  s.lastResolveTaps = 0;
  assert.equal(loopRevealed(s), false, 'precondition: a trivial reply has not earned loops');
  ACTIONS.buyLoop(s);
  assert.equal(s.loopLevel, 0, 'a loop was bought before the game offered it');
  s.lastResolveTaps = CONST.REVEAL_TAPS_LOOP;
  ACTIONS.buyLoop(s);
  assert.equal(s.loopLevel, 1, 'and is buyable the moment it is revealed');
});
