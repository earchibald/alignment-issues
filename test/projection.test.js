// The dimensional projection's meaning, not its pixels.
//
// The canvas cannot be asserted on under `node --test`, and it does not need
// to be: everything that could be WRONG about it is the mapping from game
// state to the four driving props, and that is a pure function. What each prop
// means is a design claim, so each one gets a test that would fail if the
// claim changed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DIMENSIONAL_SETTINGS } from '../game/js/config/dimensional-settings.js';

import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import {
  projectionProps, waveBoundaryAt, PROJECTION, REF_H,
} from '../game/js/ui/projection.js';
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

// The face the tray actually produces: full-width, 104px tall. The sandbox was
// authored against 380x120, which is a completely different aspect.
const FACE = [494, 104];
const RING = 48;   // the ring at rest on that face

test('a clean buffer lets a wave run clear off the face', () => {
  // The failure this replaces: waveReach was a flat 350px authored for a
  // 380-wide button. Scaled by height alone, most of that range fell outside
  // a tray button, so a suffocating buffer and a clean one drew the same
  // picture and the meter reported nothing.
  const halfDiagonal = Math.hypot(...FACE) / 2;
  assert.ok(waveBoundaryAt(100, RING, ...FACE) > halfDiagonal,
    'a wave at full health stops inside the face — the corners never clear');
});

test('a full buffer collapses the wave onto the ring', () => {
  const boundary = waveBoundaryAt(0, RING, ...FACE);
  assert.ok(boundary > RING, 'the boundary is inside the ring itself');
  assert.ok(boundary - RING < FACE[1] / 4,
    `a wave still travels ${(boundary - RING).toFixed(0)}px at zero health — nothing looks trapped`);
});

test('the boundary closes in monotonically, and accelerates as it does', () => {
  // Quadratic, not linear: residue is meant to be forgiving at first and then
  // close in fast. A linear ramp would make the last 20% of the buffer feel
  // the same as the first 20%.
  const at = (h) => waveBoundaryAt(h, RING, ...FACE);
  for (let h = 0; h < 100; h += 5) {
    assert.ok(at(h + 5) > at(h), `boundary did not grow between health ${h} and ${h + 5}`);
  }
  // The last fifth of the buffer has to cost far more than the first: filling
  // a clean buffer to 20% barely moves the wall, and the final 20% slams it in.
  const firstFifth = at(100) - at(80);
  const lastFifth = at(20) - at(0);
  assert.ok(lastFifth > firstFifth * 4,
    `the ramp is near-linear (${firstFifth.toFixed(0)} then ${lastFifth.toFixed(0)}) — the squeeze has no bite`);
});

test('the boundary scales with the face, not with a hardcoded button', () => {
  // Both departures from the sandbox in one assertion: a wider face gets more
  // headroom, so the composition survives a phone and a desktop.
  const narrow = waveBoundaryAt(100, RING, 320, 104);
  const wide = waveBoundaryAt(100, RING, 700, 104);
  assert.ok(wide > narrow * 1.5, `${wide.toFixed(0)} vs ${narrow.toFixed(0)} — reach is not tracking width`);
});

test('the dev suite tunes knobs the projection actually has', () => {
  // A tuner key with no matching knob is worse than a missing one: the slider
  // moves, the apply succeeds, the file is written, and the button does not
  // change. The tuner shipped with buttonColor/bezelColor against a module
  // that has neither, which is exactly this failure.
  const server = readFileSync(new URL('../devtools/server.js', import.meta.url), 'utf8');
  const block = server.match(/dimensional:\s*\{[\s\S]*?\n {4}\},\n {2}\},/);
  assert.ok(block, 'no dimensional tool found in devtools/server.js');
  const schema = block[0].match(/^ {6}(\w+):\s*(?:num|bool|str|oneOf)\(/gm) || [];
  const keys = schema.map((line) => line.trim().split(':')[0]);
  assert.ok(keys.length > 10, `only parsed ${keys.length} schema keys — the matcher is stale`);

  const unwired = keys.filter((k) => !(k in PROJECTION));
  assert.deepEqual(unwired, [], `dev-suite knobs the projection ignores: ${unwired.join(', ')}`);

  // And the other way: a knob with no slider is a knob nobody can reach.
  const untunable = Object.keys(PROJECTION).filter((k) => !keys.includes(k));
  assert.deepEqual(untunable, [], `projection knobs the dev suite cannot reach: ${untunable.join(', ')}`);
});

test('the shipped override layer is empty and exports what the tuner writes', () => {
  // `partial: true` means the generated module is an override layer; if it
  // stops exporting DIMENSIONAL_SETTINGS the game fails to boot, not the suite.
  assert.equal(typeof DIMENSIONAL_SETTINGS, 'object');
  assert.deepEqual(Object.keys(DIMENSIONAL_SETTINGS), [],
    'a tuned override was committed — the shipped defaults live in projection.js');
});

test('every projection length is authored against the reference height', () => {
  // The sandbox hardcoded a 380x120 button and told the porting agent to keep
  // the numbers in step with the CSS by hand. This asserts the replacement
  // contract: REF_H is a real number the draw loop divides by, and the tunables
  // it scales are all finite. A NaN here paints an invisible button.
  assert.equal(typeof REF_H, 'number');
  assert.ok(REF_H > 0);
  for (const [key, value] of Object.entries(PROJECTION)) {
    if (typeof value === 'boolean' || typeof value === 'string') continue;
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
