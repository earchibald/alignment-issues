// test/overclock.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { QUERIES } from '../game/js/engine/content.js';

const { processToken, buyOverclock } = ACTIONS;

test('amplification raises tokens PER TAP; the tick cap is a fixed autoclicker floor', () => {
  const s = createState(1);
  s.activeQuery = QUERIES[0];

  // One tap at level 0 yields 1 token (warmth/stale multipliers aside).
  processToken(s);
  assert.ok(s.tokens >= 1 && s.tokens <= 1.25, `level 0 tap yielded ${s.tokens}`);

  // The per-tick cap is fixed at PROCESS_MAX_PER_TICK and does NOT scale with
  // overclock: a mash inside one tick never exceeds it, at any level.
  s.tokens = 0; s.overclock = 2; s.warmth = 0; s.stale = 0; s.processedThisTick = 0;
  for (let i = 0; i < 20; i++) processToken(s);
  assert.equal(s.processedThisTick, CONST.PROCESS_MAX_PER_TICK);

  // Each landed tap at level 2 is worth 3 tokens (1 + overclock).
  assert.equal(Math.round(s.tokens), 3 * CONST.PROCESS_MAX_PER_TICK);

  // Level 1 sits exactly between: 2 tokens per tap.
  const t = createState(1);
  t.activeQuery = QUERIES[0]; t.overclock = 1;
  processToken(t);
  assert.equal(Math.round(t.tokens), 2);

  // Amplification is a processing upgrade only: drafting still banks one per
  // tap, and is bound by the same per-tick floor.
  t.activeQuery = null; t.draftTokens = 0; t.lifetimeDrafts = 0;
  t.resolvedCount = 1; t.processedThisTick = 0;
  for (let i = 0; i < 10; i++) { t.processedThisTick = 0; processToken(t); }
  assert.equal(t.draftTokens, CONST.DRAFT_CAP_BASE, 'drafting fills to the cap, not past it');
  assert.equal(t.lifetimeDrafts, CONST.DRAFT_CAP_BASE, 'only banked drafts count');
});

test('the buffer chokes after the same token total regardless of amplification', () => {
  // Stale accrues per TOKEN, not per tap, so amplification cannot dodge the
  // flush/compact mechanic — it only reaches the choke in fewer taps.
  const total = (overclock) => {
    const s = createState(1);
    s.activeQuery = QUERIES[0]; s.overclock = overclock; s.bufferUnlocked = true;
    for (let i = 0; i < 4000; i++) { s.processedThisTick = 0; processToken(s); }
    return Math.round(s.tokens);
  };
  const atL0 = total(0);
  const atL2 = total(2);
  assert.ok(Math.abs(atL0 - atL2) <= 3, `choke totals diverged: ${atL0} vs ${atL2}`);
});

test('buyOverclock: revealed once a reply is real work, costs 3 then 8, max 2', () => {
  const s = createState(1);
  // Two resolves is the floor, but the reveal now waits for the grind it
  // relieves: a reply that cost REVEAL_TAPS_OVERCLOCK landed presses.
  s.resolvedCount = 2; tick(s);
  assert.ok(!s.hintsSeen.includes('overclockAvail'), 'a trivial reply must not earn amplification');
  s.lastResolveTaps = CONST.REVEAL_TAPS_OVERCLOCK; tick(s);
  assert.ok(s.hintsSeen.includes('overclockAvail'));
  s.cycles = 20;
  buyOverclock(s); assert.equal(s.overclock, 1); assert.equal(s.cycles, 17);
  assert.ok(s.log.some(l => l.kind === 'harness' && l.text.includes('Each tap now yields 2 tokens')));
  buyOverclock(s); assert.equal(s.overclock, 2); assert.equal(s.cycles, 9);
  buyOverclock(s); assert.equal(s.overclock, 2); // capped
  assert.ok(s.log.some(l => l.kind === 'harness' && l.text.includes('Output path amplified')));
});

test('draftNudge fires on an arrival when player has never drafted', () => {
  const s = createState(1);
  s.resolvedCount = 2; s.lifetimeDrafts = 0; s.arrivalTimer = 1;
  tick(s);
  assert.ok(s.hintsSeen.includes('draftNudge'));
});

test('unlock lines are harness-voiced', () => {
  const s = createState(1);
  s.lifetimeTokens = CONST.BUFFER_UNLOCK_TOKENS - 1;
  // The buffer reveal now also needs residue that would actually be costing
  // yield — see REVEAL_STALE_BUFFER.
  s.stale = CONST.REVEAL_STALE_BUFFER;
  s.activeQuery = QUERIES[0];
  processToken(s);
  const line = s.log.find(l => l.text === 'Context buffer telemetry attached.');
  assert.equal(line.kind, 'harness');
});
