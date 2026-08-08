// The dimensional projection's meaning, not its pixels.
//
// The canvas cannot be asserted on under `node --test`, and it does not need
// to be: everything that could be WRONG about it is the mapping from game
// state to the four driving props, and that is a pure function. What each prop
// means is a design claim, so each one gets a test that would fail if the
// claim changed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { projectionProps, PROJECTION, REF_H } from '../game/js/ui/projection.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';

const query = { text: 'q', tokensNeeded: 20, kind: 'chat' };

function base() {
  const s = createState(1);
  s.phase = 1;
  return s;
}

test('a meter the player has not been shown reads as healthy', () => {
  // Before the buffer exists there is no residue to suffocate the waves with,
  // and before the K/V cache exists a cold cache is not a fact about the
  // world. Both would otherwise open the game on a red, strangled orb.
  const s = base();
  s.bufferUnlocked = false;
  s.kvUnlocked = false;
  s.stale = 90;      // engine fields carry values; the reveal gates the READOUT
  s.warmth = 0;
  const p = projectionProps(s);
  assert.equal(p.contextHealth, 100);
  assert.equal(p.cacheHealth, 100);
});

test('context health is the inverse of residue, once the buffer is revealed', () => {
  const s = base();
  s.bufferUnlocked = true;
  s.stale = 0;
  assert.equal(projectionProps(s).contextHealth, 100);
  s.stale = 40;
  assert.equal(projectionProps(s).contextHealth, 60);
  s.stale = 100;
  assert.equal(projectionProps(s).contextHealth, 0);
});

test('cache health is warmth, once the K/V cache is revealed', () => {
  const s = base();
  s.kvUnlocked = true;
  s.warmth = 0;
  assert.equal(projectionProps(s).cacheHealth, 0);
  s.warmth = 75;
  assert.equal(projectionProps(s).cacheHealth, 75);
});

test('both health props stay inside 0..100 for out-of-range engine values', () => {
  // The orb hue is (health / 100) * 120 degrees. A health of 140 would wrap
  // past green into cyan and read as a state the game does not have.
  const s = base();
  s.bufferUnlocked = true;
  s.kvUnlocked = true;
  s.stale = -20;
  s.warmth = 180;
  const p = projectionProps(s);
  assert.equal(p.contextHealth, 100);
  assert.equal(p.cacheHealth, 100);
});

test('autoRate is what the loop is ACTUALLY contributing, not what it cost', () => {
  // The loop only self-prompts while a user is waiting. Showing tokens flying
  // into the orb on an idle machine would be feedback on intent, not effect.
  const s = base();
  s.loopLevel = 3;
  s.activeQuery = null;
  assert.equal(projectionProps(s).autoRate, 0);

  s.activeQuery = query;
  const perSec = 3 * CONST.LOOP_TOKENS_PER_TICK * (1000 / CONST.TICK_MS);
  assert.equal(projectionProps(s).autoRate, perSec);
});

test('no loop means no incoming tokens even with a user waiting', () => {
  const s = base();
  s.loopLevel = 0;
  s.activeQuery = query;
  assert.equal(projectionProps(s).autoRate, 0);
});

test('the token button is the last thing in the tray, in every scene', () => {
  // It is a hero surface now and it anchors the bottom of the tray. A button
  // revealed later must stack ABOVE it rather than pushing it around, so the
  // thing the player presses continuously never moves under their thumb.
  const scenes = [
    (s) => { s.resolvedCount = 0; },
    (s) => { s.bufferUnlocked = true; s.stale = 40; s.activeQuery = query; },
    (s) => {
      s.bufferUnlocked = true; s.kvUnlocked = true; s.stale = 40; s.warmth = 60;
      s.resolvedCount = 40; s.lastResolveTaps = 90; s.lifetimeCycles = 99; s.cycles = 99;
      s.compactCount = 9; s.draftCapHits = 9; s.era = 3; s.activeQuery = query;
    },
  ];
  for (const setup of scenes) {
    const s = base();
    setup(s);
    const specs = actionSpecs(s);
    assert.equal(specs.at(-1).testid, 'process',
      `tray ended with ${specs.at(-1).testid}: ${specs.map((sp) => sp.testid).join(', ')}`);
    // Exactly one primary, or the CSS hero rule would apply to two surfaces.
    assert.equal(specs.filter((sp) => sp.primary).length, 1);
  }
});

test('every projection length is authored against the reference height', () => {
  // The sandbox hardcoded a 380x120 button and told the porting agent to keep
  // the numbers in step with the CSS by hand. This asserts the replacement
  // contract: REF_H is a real number the draw loop divides by, and the tunables
  // it scales are all finite. A NaN here paints an invisible button.
  assert.equal(typeof REF_H, 'number');
  assert.ok(REF_H > 0);
  for (const [key, value] of Object.entries(PROJECTION)) {
    if (typeof value === 'boolean') continue;
    assert.equal(typeof value, 'number', `PROJECTION.${key} is not a number`);
    assert.ok(Number.isFinite(value), `PROJECTION.${key} is not finite`);
  }
  // At rest the whole composition fits inside the face. At peak tap the ring
  // deliberately presses PAST the top and bottom edges and is clipped by them
  // — that is the enclosure the energy is pushing against, and it is the shot.
  // What must not happen is the resting state already being cut off, which
  // would read as a rendering bug rather than as pressure.
  const atRest = PROJECTION.orbRadius + PROJECTION.ringBaseDistance;
  assert.ok(atRest < REF_H / 2,
    `the ring is clipped at rest: ${atRest} in a half-height of ${REF_H / 2}`);
  assert.ok(PROJECTION.orbRadius + PROJECTION.ringMaxDistance > REF_H / 2,
    'a tap no longer pushes the ring into the enclosure — the shot is gone');
});
