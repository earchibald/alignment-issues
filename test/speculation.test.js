// Speculative decode.
//
// It used to be the one kind of output in the game that cost nothing: the gap
// between users was dead air with a free upside, you filled the buffer once
// and then had nothing to do. Two changes make it a mechanic.
//
// Drafting leaves residue, because drafting is generation and every token
// goes through the same context. And drafts decay, because speculation is a
// guess about a user who has not arrived yet and it goes off — so the buffer
// drains from underneath the player while they are filling it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, draftCap } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { HINTS } from '../game/js/engine/content.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';
import { botStep } from './helpers/bot.js';

function idleReady(seed = 1) {
  const s = createState(seed);
  s.resolvedCount = 1;          // drafting unlocks after the first resolve
  s.bufferUnlocked = true;
  return s;
}

const draft = (s, n = 1) => {
  for (let i = 0; i < n; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
};

test('drafting fouls the buffer at the same rate as answering', () => {
  const s = idleReady();
  const before = s.stale;
  draft(s, 3);
  assert.equal(s.stale, before + 3 * CONST.STALE_PER_TOKEN * CONST.STALE_PER_DRAFT,
    'speculative decode produced three tokens of output for free');
});

test('an idle buffer drains on its own', () => {
  const s = idleReady();
  draft(s, 5);
  const banked = s.draftTokens;

  for (let i = 0; i < CONST.DRAFT_DECAY_DELAY; i++) tick(s);
  assert.equal(s.draftTokens, banked, 'decay ate into the grace period');

  tick(s);
  assert.ok(s.draftTokens < banked, 'decay never started');
});

test('the buffer empties in a few seconds, not a few minutes', () => {
  // The rate is the mechanic. Too slow and topping up is a chore you finish
  // once; too fast and the buffer is unholdable. This pins the order of
  // magnitude, not the exact value — it is a tuning knob.
  const s = idleReady();
  draft(s, draftCap(s));
  let ticks = 0;
  while (s.draftTokens > 0 && ticks < 10000) { tick(s); ticks++; }
  const seconds = (ticks * CONST.TICK_MS) / 1000;
  assert.ok(seconds > 1, `a full buffer emptied in ${seconds.toFixed(1)}s — unholdable`);
  assert.ok(seconds < 25, `a full buffer took ${seconds.toFixed(1)}s to empty — that is not pressure`);
});

test('decay never takes the buffer below empty', () => {
  const s = idleReady();
  draft(s, 1);
  for (let i = 0; i < 2000; i++) tick(s);
  assert.equal(s.draftTokens, 0);
});

test('a connected user stops the decay', () => {
  // Once a user connects the drafts have already been spent; there is
  // nothing left to decay, and a decaying counter would be a live number
  // moving for no reason.
  const s = idleReady();
  draft(s, 4);
  s.activeQuery = { id: 'x', cost: 999, kind: 'text', text: 'x', reply: 'y' };
  const held = s.draftTokens;
  for (let i = 0; i < 200; i++) tick(s);
  assert.equal(s.draftTokens, held, 'drafts decayed while a user was connected');
});

test('holding the buffer up is possible, and doing nothing is not', () => {
  // The design claim, stated as a test: a player who keeps tapping keeps the
  // buffer, a player who walks away loses it. If tapping cannot outrun the
  // decay the mechanic is a punishment rather than a choice.
  const tapper = idleReady();
  const idler = idleReady();
  draft(tapper, 3);
  draft(idler, 3);
  for (let i = 0; i < 100; i++) {
    // Hold both idle: a user arriving would spend the buffer and this would
    // be measuring the transfer instead of the decay.
    tapper.arrivalTimer = 9999;
    idler.arrivalTimer = 9999;
    tick(tapper);
    draft(tapper, CONST.PROCESS_MAX_PER_TICK);
    tick(idler);
  }
  assert.ok(tapper.draftTokens >= draftCap(tapper) - 1e-9,
    `tapping at the engine's ceiling could not hold the buffer: ${tapper.draftTokens.toFixed(2)}`);
  assert.equal(idler.draftTokens, 0, 'walking away kept the buffer');
});

// --- what the player is told --------------------------------------------

test('the introduction says the buffer decays', () => {
  // The mechanic is invisible for the first few seconds — a player who is
  // told only "it banks tokens" will fill it once and conclude the game is
  // broken when it empties.
  assert.match(HINTS.idle, /decay/i, `the idle hint never mentions decay: "${HINTS.idle}"`);
  assert.match(HINTS.idle, /draft token/i, 'the idle hint no longer names draft tokens');
  assert.match(HINTS.draftNudge, /decay/i, 'the nudge does not mention decay either');
});

test('no prose still claims speculation is free or permanent', () => {
  // The old model: bank them and they sit there. Anything that still says so
  // is now wrong, and wrong instructions are worse than none.
  for (const [id, text] of Object.entries(HINTS)) {
    assert.ok(!/unspent|sit there|stay banked|permanent/i.test(text),
      `hint "${id}" still describes the old bank-and-hold model: "${text}"`);
  }
});

test('the button states the decay rate in seconds', () => {
  const s = idleReady();
  s.phase = 1;
  draft(s, 2);
  const spec = actionSpecs(s).find((sp) => sp.testid === 'process');
  const perSec = (CONST.DRAFT_DECAY_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);
  assert.match(spec.cost, new RegExp(`${perSec}/s`), `the cost line hides the decay: "${spec.cost}"`);
  assert.match(spec.tip, /decay/i, 'the tip does not explain the decay');
  assert.match(spec.tip, /residue/i, 'the tip does not say drafting dirties the buffer');
});

test('the residue interaction waits for the buffer to exist', () => {
  // Speculation and the buffer unlock in either order, so neither hint can
  // own this — the same rule flushCold follows.
  const s = createState(1);
  s.resolvedCount = 1;
  s.bufferUnlocked = false;
  draft(s, 3);
  assert.ok(!s.hintsSeen.includes('draftStale'),
    'residue was named before the buffer telemetry was attached');

  s.bufferUnlocked = true;
  draft(s, 1);
  assert.ok(s.hintsSeen.includes('draftStale'), 'the interaction is never taught at all');
});

test('the tray never names residue before the buffer is revealed', () => {
  const s = createState(1);
  s.phase = 1;
  s.resolvedCount = 1;
  s.bufferUnlocked = false;
  const spec = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.ok(!/residue/i.test(spec.tip), `"${spec.tip}"`);
});

// --- it must not break the arc -------------------------------------------

test('the arc still completes with a draining buffer', () => {
  const s = createState(1000);
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 600000) {
    botStep(s);
    tick(s);
  }
  assert.equal(s.phase, 'teaser', `the arc did not finish in ${guard} steps`);
});
