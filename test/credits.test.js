// Every shipped sound is used, and every shipped sound is credited.
//
// Most of the audio in this game is freesound CC-BY. Attribution is not a
// courtesy there, it is the licence term — shipping a clip whose credit
// line was never added is a breach, and it is exactly the kind of thing
// that gets forgotten between downloading a wav and wiring it up.
//
// The reverse matters too, in a smaller way: an asset no code references is
// dead weight in every player's download.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const soundSrc = readFileSync(new URL('../game/js/ui/sound.js', import.meta.url), 'utf8');
const settingsSrc = readFileSync(new URL('../game/js/ui/settings.js', import.meta.url), 'utf8');
const assets = readdirSync(new URL('../game/assets/', import.meta.url)).filter((f) => f.endsWith('.wav'));

test('there are assets to check', () => {
  assert.ok(assets.length > 5, `only ${assets.length} audio assets found — is the path right?`);
});

test('every audio asset is actually played by something', () => {
  const unused = assets.filter((f) => !soundSrc.includes(`assets/${f}`));
  assert.deepEqual(unused, [], `audio shipped to every player but never played: ${unused.join(', ')}`);
});

test('every asset sound.js references exists on disk', () => {
  // The other direction: a renamed file leaves a URL that 404s at the worst
  // moment, and playBuffer swallows the failure silently.
  const referenced = [...soundSrc.matchAll(/assets\/([\w.-]+\.wav)/g)].map((m) => m[1]);
  assert.ok(referenced.length > 0, 'sound.js references no assets at all');
  const missing = referenced.filter((f) => !assets.includes(f));
  assert.deepEqual(missing, [], `sound.js points at files that are not there: ${missing.join(', ')}`);
});

test('every freesound clip in the credits names its licence', () => {
  const entries = [...settingsSrc.matchAll(/ackEntry\('([^']*)',\s*'(https:\/\/freesound\.org\/s\/\d+\/)'\s*,\s*'([^']*)'/g)];
  assert.ok(entries.length >= assets.length,
    `${assets.length} audio assets ship but only ${entries.length} are credited`);
  for (const [, who, url, licence] of entries) {
    assert.ok(who.trim().length > 3, `a credit for ${url} names no author`);
    assert.match(licence, /License: (Creative Commons 0|Attribution [34]\.0)/,
      `the credit for ${url} does not state a licence: "${licence}"`);
  }
});

test('the credits are reachable from the settings sheet', () => {
  // A credit block that is never rendered discharges nothing.
  assert.match(settingsSrc, /settings-acknowledgements/,
    'the acknowledgements section has lost its test id');
  assert.match(settingsSrc, /ackBody\.append\(/,
    'the credit entries are no longer appended to anything');
});
