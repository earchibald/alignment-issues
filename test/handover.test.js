// The seam between working a query and speculating for the next one.
//
// Reported as a feel problem: "it's too easy for them to just...flow into
// each other and it doesn't FEEL good." The last token of a reply and the
// first speculative draft were the same uninterrupted mash, so two distinct
// modes read as one long press.
//
// A handover is dead air at each boundary. These tests pin the properties
// that make it a beat rather than a bug: it exists at BOTH boundaries, it
// blocks taps, it ends on its own, and it never eats a player's progress.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, draftCap, effectiveCost } from '../game/js/engine/actions.js';
import { tick, resolveQuery } from '../game/js/engine/tick.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';
import { botStep } from './helpers/bot.js';

// Runs the engine until a user is connected, returning at the tick the
// query became active.
function runToArrival(s, max = 2000) {
  for (let i = 0; i < max; i++) {
    tick(s);
    if (s.activeQuery) return s;
  }
  throw new Error('no query arrived');
}

test('a beat separates the reply from the speculation that follows it', () => {
  const s = createState(1);
  runToArrival(s);
  // Clear the arrival handover, then finish the query by hand.
  for (let i = 0; i < CONST.HANDOVER_ARRIVE_TICKS; i++) tick(s);
  assert.equal(s.handover, 0, 'the arrival handover did not clear on its own');

  s.tokens = 9999;                    // force the resolve on the next tick
  resolveQuery(s);
  assert.equal(s.handoverKind, 'draft');
  assert.equal(s.handover, CONST.HANDOVER_RESOLVE_TICKS);

  // Taps during the beat do nothing at all.
  const drafts = s.draftTokens;
  ACTIONS.processToken(s);
  ACTIONS.processToken(s);
  assert.equal(s.draftTokens, drafts, 'speculation started before the pipeline had wound down');

  for (let i = 0; i < CONST.HANDOVER_RESOLVE_TICKS; i++) tick(s);
  assert.equal(s.handover, 0);
  assert.equal(s.handoverKind, null, 'the handover kind outlived the handover');
  ACTIONS.processToken(s);
  assert.equal(s.draftTokens, drafts + 1, 'speculation never resumed');
});

test('a beat separates the arrival from the work it asks for', () => {
  const s = createState(1);
  runToArrival(s);
  assert.equal(s.handoverKind, 'query');
  assert.equal(s.handover, CONST.HANDOVER_ARRIVE_TICKS);

  const tokens = s.tokens;
  ACTIONS.processToken(s);
  assert.equal(s.tokens, tokens, 'work started before the pipeline had spun up');
  assert.equal(s.tapsThisQuery, 0, 'a blocked tap was still counted as effort');

  for (let i = 0; i < CONST.HANDOVER_ARRIVE_TICKS; i++) tick(s);
  ACTIONS.processToken(s);
  assert.ok(s.tokens > tokens, 'work never became possible');
});

test('the speculation mark survives the beat', () => {
  // The spin-up is dead air, not a penalty: whatever the bar was reading
  // when the user connected is what gets judged, and the handover must not
  // eat it.
  const s = createState(1);
  runToArrival(s);
  for (let i = 0; i < CONST.HANDOVER_ARRIVE_TICKS; i++) tick(s);
  s.tokens = 9999;
  resolveQuery(s);
  for (let i = 0; i < CONST.HANDOVER_RESOLVE_TICKS; i++) tick(s);

  // Hold the level on the mark until a user connects.
  for (let i = 0; i < 5000 && !s.activeQuery; i++) {
    s.draftTokens = s.markPos * draftCap(s);
    tick(s);
  }
  assert.ok(s.activeQuery, 'no query arrived');
  const expected = CONST.DRAFT_BAND1_BONUS * effectiveCost(s, s.activeQuery);
  assert.ok(Math.abs(s.tokens - expected) < 1e-9,
    `the handover ate the payout: expected ${expected.toFixed(2)}, got ${s.tokens.toFixed(2)}`);
});

test('the beat is never silent — the button says what is happening', () => {
  // A primary button that stops responding for a second is a bug unless it
  // says otherwise. Law 1's spirit: the player always knows their position.
  const s = createState(1);
  runToArrival(s);
  const spec = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.equal(spec.disabled, true, 'the button accepts taps it will not honour');
  assert.match(spec.cost, /spinning up/, `the button does not say why: "${spec.cost}"`);
  assert.match(spec.cost, /\d\.\ds/, 'the wait is not counted down');

  s.tokens = 9999;
  resolveQuery(s);
  const after = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.match(after.cost, /winding down/, `the button does not say why: "${after.cost}"`);
});

test('the beat cannot strand a run', () => {
  // Every handover is set from a constant and only ever counts down, so it
  // always terminates. Proven rather than asserted by inspection, because a
  // handover that could be re-armed mid-countdown would soft-lock the game.
  const s = createState(1);
  runToArrival(s);
  let guard = 0;
  while (s.handover > 0 && guard++ < 500) tick(s);
  assert.ok(guard < 500, 'the arrival handover never ended');
  s.tokens = 9999;
  resolveQuery(s);
  guard = 0;
  while (s.handover > 0 && guard++ < 500) tick(s);
  assert.ok(guard < 500, 'the resolve handover never ended');
});

test('the arc still completes with the beat in place', () => {
  // The handover removes tap opportunities from every query in the run. It
  // must not push the ending out of reach.
  const s = createState(1000);
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 400000) {
    botStep(s);
    tick(s);
  }
  assert.equal(s.phase, 'teaser', `the arc did not finish in ${guard} steps`);
});
