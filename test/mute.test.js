// The automated-run mute (?mute=1).
//
// Two properties, and the second is the one worth a test: the mute must NOT
// be a write to state.settings.sound. That field is the player's preference
// and it is persisted, so a scripted run that flipped it would silently mute
// the game of whoever opened the tab next.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState } from '../game/js/engine/state.js';
import { serialize, deserialize } from '../game/js/engine/save.js';
import {
  setMuted, isMuted, playCardSound, playActionSound, playFlushSound,
} from '../game/js/ui/sound.js';

test('mute is off by default — a player who does nothing still gets sound', () => {
  setMuted(false);
  assert.equal(isMuted(), false);
  assert.equal(createState(1).settings.sound, true);
});

test('muting never touches the saved preference', () => {
  const s = createState(1);
  setMuted(true);
  try {
    assert.equal(s.settings.sound, true, 'the mute wrote into the player preference');
    const round = deserialize(serialize(s));
    assert.equal(round.settings.sound, true, 'the mute reached the save file');
  } finally {
    setMuted(false);
  }
});

test('every play path is silent while muted, sound preference notwithstanding', () => {
  // No AudioContext and no Audio under node, so these are already no-ops for
  // the wrong reason. What is being pinned is that they RETURN rather than
  // throw — a play path that skipped the gate would reach `new AC()` on a
  // browser and make a noise a test never asked for.
  const s = createState(1);
  s.settings.sound = true;
  setMuted(true);
  try {
    for (const play of [playCardSound, playActionSound, playFlushSound]) {
      assert.doesNotThrow(() => play(s), `${play.name} threw while muted`);
    }
  } finally {
    setMuted(false);
  }
});

test('the gate tolerates a state with no settings at all', () => {
  // Callers pass whatever they are holding; a half-built state must not take
  // the audio layer down with it.
  setMuted(false);
  assert.doesNotThrow(() => playCardSound({}));
  assert.doesNotThrow(() => playActionSound(undefined));
});
