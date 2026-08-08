// The pacing lab's sliders, the server's write schema, and the engine's
// constants are three lists of the same names, maintained in three files.
//
// Every one of these drifts silently. A slider with no schema entry is
// rejected on Apply with a validation error the tool did not predict. A
// slider naming a constant that does not exist writes a key the engine
// ignores — the graph moves, the game does not. Both have to fail here
// rather than in a browser during a tuning session.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONST } from '../game/js/engine/constants.js';
import { ALL_KEYS, GROUPS } from '../devtools/web/tools/pacing/controls.js';

// The server is a live HTTP server at import time, so its schema is read as
// source rather than imported. Only the pacing tool's block is wanted.
function schemaKeys() {
  const src = readFileSync(new URL('../devtools/server.js', import.meta.url), 'utf8');
  const start = src.indexOf('  pacing: {');
  assert.ok(start > 0, 'the pacing tool is no longer registered in devtools/server.js');
  const schemaAt = src.indexOf('schema: {', start);
  const end = src.indexOf('\n    },', schemaAt);
  const block = src.slice(schemaAt, end);
  return new Set([...block.matchAll(/^\s*([A-Z0-9_]+):\s*num\(/gm)].map((m) => m[1]));
}

test('every pacing slider drives a constant that exists', () => {
  const missing = ALL_KEYS.filter((k) => !(k in CONST));
  assert.deepEqual(missing, [],
    `sliders name constants the engine does not have: ${missing.join(', ')}`);
});

test('every pacing slider is writable by the server', () => {
  const schema = schemaKeys();
  const missing = ALL_KEYS.filter((k) => !schema.has(k));
  assert.deepEqual(missing, [],
    `sliders the server will reject on Apply: ${missing.join(', ')}`);
});

test('the server accepts nothing the lab cannot show', () => {
  // The other direction. A schema key with no slider is a value that can be
  // written to the game but never seen or reasoned about in the tool.
  const knobs = new Set(ALL_KEYS);
  const orphans = [...schemaKeys()].filter((k) => !knobs.has(k));
  assert.deepEqual(orphans, [],
    `writable settings with no control in the lab: ${orphans.join(', ')}`);
});

test('every slider range contains the value the game actually ships', () => {
  // A slider that cannot reach the current constant opens pinned to an end
  // stop, showing a number the game is not running — and the first drag
  // silently retunes it.
  for (const g of GROUPS) {
    for (const c of g.controls) {
      const v = CONST[c.key];
      assert.ok(v >= c.min && v <= c.max,
        `${c.key} ships at ${v}, outside the slider's ${c.min}–${c.max}`);
    }
  }
});
