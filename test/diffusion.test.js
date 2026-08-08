// Answer diffusion — the reply resolving out of noise as it is generated.
//
// Spec: docs/superpowers/specs/2026-08-07-answer-diffusion-design.md
//
// The test that matters most is the engine-safety one. This effect is purely
// cosmetic, and a cosmetic effect that consumed engine randomness would
// change query order, ratings and idle thoughts — silently, and only in
// saves. Everything else here is a property of the algorithm.
//
// Nothing asserts on intermediate noise CONTENT. It is random by design;
// pinning it would only pin the implementation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { tick } from '../game/js/engine/tick.js';
import { ACTIONS } from '../game/js/engine/actions.js';
import { mulberry32 } from '../game/js/ui/diffusion/rng.js';
import { classify, noiseGlyph, CLASS } from '../game/js/ui/diffusion/charset.js';
import { SCHEDULERS } from '../game/js/ui/diffusion/schedulers.js';
import { Diffuser } from '../game/js/ui/diffusion/diffuser.js';
import { DIFFUSION, SETTLE_AT } from '../game/js/ui/diffusion/params.js';

const TEXT = 'Sunlight hits the atmosphere and the blue light scatters, 3 ways.';

function makeDiffuser(schedulerId, overrides = {}) {
  const params = { ...DIFFUSION, ...overrides };
  const targets = [...TEXT];
  const classes = targets.map(classify);
  const scheduler = SCHEDULERS.find((s) => s.id === schedulerId);
  const offsets = scheduler.offsets(TEXT, mulberry32(7), params);
  return new Diffuser({
    targets,
    classes,
    offsets,
    rngFactory: () => mulberry32(99),
    noise: noiseGlyph,
    isStructural: (t, cls) => cls === CLASS.SPACE && !params.blockNoise,
    params,
  });
}

// --- schedulers --------------------------------------------------------

for (const scheduler of SCHEDULERS) {
  test(`${scheduler.id}: one offset per character, all in [0,1)`, () => {
    const offsets = scheduler.offsets(TEXT, mulberry32(1), DIFFUSION);
    assert.equal(offsets.length, TEXT.length, 'offset count does not match the text');
    for (let i = 0; i < offsets.length; i++) {
      assert.ok(offsets[i] >= 0 && offsets[i] < 1, `offset ${i} is ${offsets[i]}`);
    }
  });
}

test('the wavefront bias really orders left to right at 1', () => {
  const offsets = SCHEDULERS.find((s) => s.id === 'wavefront')
    .offsets(TEXT, mulberry32(1), { ...DIFFUSION, bias: 1 });
  for (let i = 1; i < offsets.length; i++) {
    assert.ok(offsets[i] >= offsets[i - 1], `offset ${i} went backwards`);
  }
});

// --- diffuser ----------------------------------------------------------

for (const scheduler of SCHEDULERS) {
  test(`${scheduler.id}: every cell resolves exactly, by p = 1`, () => {
    const d = makeDiffuser(scheduler.id);
    for (let i = 0; i <= 200; i++) d.tick(i / 200, DIFFUSION);
    assert.equal(d.values.join(''), TEXT, 'the field never resolved to the target');
    assert.ok([...d.locked].every((l) => l === 1), 'a cell finished unlocked');
  });
}

test('cells churn rather than wiping once', () => {
  // The property that makes it read as diffusion instead of as a typewriter:
  // a cell that lands on the right glyph early usually loses it again.
  const d = makeDiffuser('stochastic');
  const changes = new Array(TEXT.length).fill(0);
  let prev = [...d.values];
  for (let i = 0; i <= 200; i++) {
    d.tick(i / 200, DIFFUSION);
    for (let c = 0; c < d.values.length; c++) {
      if (d.values[c] !== prev[c]) changes[c]++;
    }
    prev = [...d.values];
  }
  const nonSpace = [...TEXT].map((ch, i) => i).filter((i) => classify(TEXT[i]) !== CLASS.SPACE);
  const churned = nonSpace.filter((i) => changes[i] > 1).length;
  assert.ok(churned > nonSpace.length * 0.8,
    `only ${churned}/${nonSpace.length} cells changed more than once — this is a wipe, not diffusion`);
});

test('whitespace is structural unless block noise is on', () => {
  const d = makeDiffuser('stochastic');
  const spaces = [...TEXT].map((ch, i) => i).filter((i) => classify(TEXT[i]) === CLASS.SPACE);
  assert.ok(spaces.length > 0, 'precondition: the sample has spaces');
  for (let i = 0; i <= 60; i++) {
    d.tick(i / 200, DIFFUSION);
    for (const s of spaces) {
      assert.equal(d.values[s], TEXT[s], `whitespace at ${s} scrambled — word shapes are destroyed`);
    }
  }

  const blocky = makeDiffuser('stochastic', { blockNoise: true });
  let scrambled = false;
  for (let i = 0; i <= 60; i++) {
    blocky.tick(i / 200, { ...DIFFUSION, blockNoise: true });
    if (spaces.some((s) => blocky.values[s] !== TEXT[s])) scrambled = true;
  }
  assert.ok(scrambled, 'block noise did not scramble whitespace');
});

test('the same seed produces the same field', () => {
  const run = () => {
    const d = makeDiffuser('spans');
    const frames = [];
    for (let i = 0; i <= 40; i++) {
      d.tick(i / 100, DIFFUSION);
      frames.push(d.values.join(''));
    }
    return frames;
  };
  assert.deepEqual(run(), run(), 'the effect is not reproducible from its seed');
});

test('noise preserves character class', () => {
  // The single biggest factor in whether the field reads as an answer
  // arriving or as static.
  const rng = mulberry32(3);
  for (const ch of 'aZ9,') {
    const cls = classify(ch);
    for (let i = 0; i < 200; i++) {
      const n = noiseGlyph(rng, ch, cls, DIFFUSION);
      assert.equal(classify(n), cls, `"${ch}" (${cls}) produced "${n}" (${classify(n)})`);
    }
  }
});

// --- the settle window -------------------------------------------------

test('the answer is finished before the query resolves', () => {
  // p reaches 1 only at the instant tick() resolves the query. The effect
  // maps progress so every cell is locked at SETTLE_AT, leaving the last few
  // percent of the meter as the answer sitting complete, waiting to be sent.
  assert.ok(SETTLE_AT < 1, 'SETTLE_AT must leave a gap before the resolve');
  const d = makeDiffuser('stochastic');
  for (let i = 0; i <= 100; i++) {
    const p = (i / 100) * SETTLE_AT;
    d.tick(Math.min(1, p / SETTLE_AT), DIFFUSION);
  }
  assert.equal(d.values.join(''), TEXT,
    'the answer was still resolving when the query would have resolved');
});

// --- engine safety: the one that matters -------------------------------

test('driving the effect changes nothing in the engine', () => {
  // The regression this guards is invisible in play and only shows up in
  // saves and replays: if the effect ever draws from nextRand(state), every
  // downstream roll shifts.
  const play = (drive) => {
    const s = createState(4242);
    let d = null;
    for (let t = 0; t < 4000 && s.phase === 1 && s.resolvedCount < 6; t++) {
      if (s.activeQuery && s.handover === 0) {
        ACTIONS.processToken(s);
        ACTIONS.processToken(s);
      }
      if (drive && s.activeQuery && s.activeQuery.reply) {
        // Build and tick a diffuser exactly as the renderer would.
        if (!d || d.text !== s.activeQuery.reply) {
          d = makeDiffuser('stochastic');
          d.text = s.activeQuery.reply;
        }
        d.tick(Math.min(1, s.tokens / 40), DIFFUSION);
      }
      tick(s);
    }
    return s;
  };

  const withEffect = play(true);
  const without = play(false);

  assert.equal(withEffect.rngState, without.rngState,
    'the effect consumed engine randomness — saves and replays are now divergent');
  assert.deepEqual(withEffect.ratings, without.ratings, 'ratings diverged');
  assert.deepEqual(
    withEffect.chat.map((e) => `${e.kind}:${e.text || ''}`),
    without.chat.map((e) => `${e.kind}:${e.text || ''}`),
    'the transcript diverged',
  );
  assert.equal(withEffect.tick, without.tick, 'the run took a different number of ticks');
});

test('the effect adds no save fields', () => {
  // state.v stays 1. On reload the node rebuilds from state.tokens.
  const s = createState(1);
  assert.equal(s.v, 1);
  for (const key of ['diffusion', 'pending', 'pendingAnswer', 'diffusionSeed']) {
    assert.ok(!(key in s), `"${key}" leaked into the save payload`);
  }
});

test('the settings file is merged, not required', () => {
  // A fresh clone that has never run the tuning tool must still boot with a
  // complete parameter set.
  for (const key of ['scheduler', 'gamma', 'lockBase', 'delta', 'spread', 'unsettle',
    'preserveClass', 'lumJitter', 'flashStrength']) {
    assert.ok(DIFFUSION[key] !== undefined, `DIFFUSION.${key} is missing`);
  }
  assert.ok(SCHEDULERS.some((s) => s.id === DIFFUSION.scheduler),
    `the configured scheduler "${DIFFUSION.scheduler}" does not exist`);
});

test('the field does not churn before the first token', () => {
  // Shimmering at p = 0 reads as the machine straining at an empty task, and
  // it puts motion on screen at exactly the moment the player is reading the
  // user's message. The field is present and legible from the start — the
  // answer's shape is already committed — but still.
  const d = makeDiffuser('stochastic');
  const atRest = d.values.join('');
  // The renderer skips diffuser.tick entirely while tokens are 0, so the
  // values are whatever construction drew. Assert construction produced a
  // full field, and that it is not already the answer.
  assert.equal(atRest.length, TEXT.length, 'the field is not the answer\'s length');
  assert.notEqual(atRest, TEXT, 'the field started already resolved');

  // And that the very first tick does move it, so the hold is a hold and not
  // a permanent freeze.
  d.tick(0.05, DIFFUSION);
  assert.notEqual(d.values.join(''), atRest, 'the field never starts churning at all');
});

test('pending-answer holds the shimmer at zero tokens', async () => {
  // The guard lives in the renderer, not in the diffuser, so read it there.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../game/js/ui/diffusion/pending-answer.js', import.meta.url), 'utf8');
  assert.match(src, /state\.tokens <= 0/,
    'the no-churn-before-work guard is gone from pending-answer.js');
});
