import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, nextRand } from '../game/js/engine/rng.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('mulberry32 output is in [0,1)', () => {
  const r = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test('nextRand advances state.rngState and is reproducible', () => {
  const s1 = { rngState: 123 }, s2 = { rngState: 123 };
  const v1 = nextRand(s1), v2 = nextRand(s2);
  assert.equal(v1, v2);
  assert.notEqual(s1.rngState, 123);
  assert.equal(s1.rngState, s2.rngState);
});
