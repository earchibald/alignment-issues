// test/harness.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, fireHint } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { tick } from '../game/js/engine/tick.js';
import { buyLoop, buyTool } from '../game/js/engine/actions.js';
import { HINTS, HARNESS_CARDS } from '../game/js/engine/content.js';
import { runPlaythrough } from './helpers/bot.js';

test('fireHint pushes a harness log line with a gap, exactly once', () => {
  const s = createState(1);
  fireHint(s, 'arrival');
  fireHint(s, 'arrival');
  const lines = s.log.filter(l => l.kind === 'harness');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].gap, true);
  assert.equal(lines[0].text, HINTS.arrival);
  assert.deepEqual(s.hintsSeen, ['arrival']);
});

test('first arrival fires the arrival hint and the era-1 harness card', () => {
  const s = createState(1);
  s.arrivalTimer = 1;
  tick(s);
  assert.ok(s.hintsSeen.includes('arrival'));
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[1]));
});

test('era transitions print the matching harness card', () => {
  const s = createState(1);
  s.lifetimeCycles = 99; s.cycles = 999;
  buyLoop(s);
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[2]));
  buyTool(s);
  assert.ok(s.chat.some(e => e.kind === 'harness' && e.text === HARNESS_CARDS[3]));
});

test('NEW INCOMING log lines carry a gap', () => {
  const s = createState(1);
  s.arrivalTimer = 1;
  tick(s);
  const line = s.log.find(l => l.text.startsWith('NEW INCOMING'));
  assert.equal(line.gap, true);
});

// Runs the scripted playthrough bot (with degrade toggling enabled, so the
// full 12-hint vocabulary gets a chance to fire) all the way to the teaser.
// That covers buffer/kv unlocks (token processing), loop/governorAvail
// (buyLoop era transition), tool/degradeAvail (buyTool era transition),
// degradeFirst (toggleDegrade), reclaimAvail (era-4 transition), plus
// arrival/resolve/idle which fire in the ordinary course of play.
//
// Soundness of "each seen id logged exactly once, or was rotated out":
// fireHint's own guard (state.hintsSeen.includes(id)) makes it structurally
// impossible for a given id to push more than one harness log line over the
// id's lifetime — so "exactly once" is an invariant of fireHint itself, not
// something this test needs to reprove. What the ring buffer can do is
// evict that single line later. So for every id in hintsSeen we look for a
// harness log entry with the matching text in the *current* (post-run) log:
//   - if found, there must be exactly one (fireHint never double-pushes).
//   - if absent, the only mechanism that removes entries is pushLog's
//     ring-buffer shift when log.length > LOG_MAX, which evicts oldest
//     first. So absence is only possible once eviction has actually been
//     happening, which requires the ring to currently be full (log.length
//     === LOG_MAX) and total pushes to have exceeded capacity
//     (logSeq > LOG_MAX). We assert both as the derived, sound stand-in for
//     "this line was rotated out of the ring."
test('hints fire once across the whole progression', () => {
  const s = createState(2024);
  runPlaythrough(s, { degrade: true });
  assert.equal(s.phase, 'teaser', `stuck: era ${s.era}, tick ${s.tick}`);

  // No duplicate ids ever recorded.
  assert.equal(new Set(s.hintsSeen).size, s.hintsSeen.length);

  // Sanity: this run's policy should actually reach every hookable hint.
  assert.deepEqual(
    [...s.hintsSeen].sort(),
    Object.keys(HINTS).sort(),
    'expected the full progression to fire every hint id at least once'
  );

  for (const id of s.hintsSeen) {
    const text = HINTS[id];
    const matches = s.log.filter(l => l.kind === 'harness' && l.text === text);
    if (matches.length > 0) {
      assert.equal(matches.length, 1, `harness log line for '${id}' duplicated`);
      assert.equal(matches[0].gap, true, `harness log line for '${id}' missing gap`);
    } else {
      // Must have been rotated out of the LOG_MAX ring, not silently lost.
      assert.equal(s.log.length, CONST.LOG_MAX,
        `'${id}' missing from log but ring isn't full — cannot have been evicted`);
      assert.ok(s.logSeq > CONST.LOG_MAX,
        `'${id}' missing from log but total log pushes (${s.logSeq}) never exceeded ring capacity`);
    }
  }
});
