// test/overclock.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { QUERIES } from '../game/js/engine/content.js';

const { processToken, buyOverclock } = ACTIONS;

test('manual processing caps at 1+overclock per tick; drafting is uncapped', () => {
  const s = createState(1);
  s.activeQuery = QUERIES[0];
  for (let i = 0; i < 5; i++) processToken(s);
  assert.ok(s.tokens <= 1.3);                 // one press' yield (warmth mult ≤1.25)
  tick(s);                                     // resets processedThisTick
  s.overclock = 2;
  const before = s.tokens;
  for (let i = 0; i < 5; i++) processToken(s);
  assert.ok(s.tokens - before > 2.5);          // 3 presses landed
  s.activeQuery = null; s.tokens = 0;
  for (let i = 0; i < 10; i++) processToken(s);
  assert.equal(s.draftTokens, 10);             // idle drafting uncapped
  assert.equal(s.lifetimeDrafts, 10);
});

test('buyOverclock: unlock hint after 2nd resolve, costs 3 then 8, max 2', () => {
  const s = createState(1);
  s.resolvedCount = 2; tick(s);
  assert.ok(s.hintsSeen.includes('overclockAvail'));
  s.cycles = 20;
  buyOverclock(s); assert.equal(s.overclock, 1); assert.equal(s.cycles, 17);
  buyOverclock(s); assert.equal(s.overclock, 2); assert.equal(s.cycles, 9);
  buyOverclock(s); assert.equal(s.overclock, 2); // capped
  assert.ok(s.log.some(l => l.kind === 'harness' && l.text.includes('overclocked')));
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
  s.activeQuery = QUERIES[0];
  processToken(s);
  const line = s.log.find(l => l.text === 'Context buffer telemetry attached.');
  assert.equal(line.kind, 'harness');
});
