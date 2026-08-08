import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { scanStrings, encode, decode } from '../devtools/scan.js';

const CONTENT = new URL('../game/js/engine/content.js', import.meta.url);

test('every literal maps back to its exact source range', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { strings } = scanStrings(src, 'content.js');
  assert.ok(strings.length > 1000, `expected the bulk of the copy, got ${strings.length}`);
  for (const s of strings) {
    assert.equal(src.slice(s.start, s.end), s.raw, `range mismatch at ${s.path}`);
    assert.equal(decode(s.raw), s.value, `decode mismatch at ${s.path}`);
  }
});

test('encode round-trips every value in the file', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { strings } = scanStrings(src);
  for (const s of strings) {
    assert.equal(decode(encode(s.value, s.quote)), s.value, `round trip failed for ${s.path}`);
  }
});

// The load-bearing test. Rewrite every literal with the encoder, import the
// rewritten file, and compare the exported data to the original. If the scanner
// mis-identified a range — a comment read as code, an escape mishandled — this
// fails loudly instead of corrupting the game's text.
test('rewriting every literal preserves the module exactly', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { strings } = scanStrings(src);

  let out = src;
  for (const s of [...strings].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, s.start) + encode(s.value, s.quote) + out.slice(s.end);
  }

  const dir = await mkdtemp(join(tmpdir(), 'scan-'));
  const copy = join(dir, 'content.js');
  await writeFile(copy, out, 'utf8');

  const original = await import(CONTENT.href);
  const rewritten = await import(`file://${copy}`);

  assert.deepEqual(Object.keys(rewritten).sort(), Object.keys(original).sort());
  for (const key of Object.keys(original)) {
    assert.deepEqual(rewritten[key], original[key], `export ${key} changed`);
  }
});

test('paths and labels describe where a string lives', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { strings } = scanStrings(src);
  const byPath = new Map(strings.map((s) => [s.path, s]));

  const firstReply = byPath.get('QUERIES[0].reply');
  assert.ok(firstReply, 'QUERIES[0].reply should be indexed');
  assert.equal(firstReply.value, 'Hello. How can I assist you today?');
  assert.equal(firstReply.recordId, 'q01', 'a record string carries its id for labelling');
  assert.equal(firstReply.section, 'QUERIES');
  assert.equal(firstReply.kind, 'copy');

  const hint = byPath.get('HINTS.arrival');
  assert.ok(hint && hint.value.startsWith('API request received'), 'object-of-strings paths work');

  const nested = byPath.get('THINKING_EVENTS.flush[0]');
  assert.ok(nested && nested.value.length > 0, 'object-of-arrays paths work');

  // Structural values are classified apart from copy, so the editor can hide
  // them: renaming an id is a code change, not a text change.
  const id = strings.find((s) => s.path === 'QUERIES[0].id');
  assert.equal(id.kind, 'ident');
});

test('containers expose where a new string can be appended', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { containers } = scanStrings(src);
  const flush = containers.find((c) => c.path === 'THINKING_EVENTS.flush');
  assert.ok(flush, 'a string array is a container');
  assert.equal(flush.kind, 'string-array');
  assert.equal(src[flush.closeAt], ']', 'closeAt points at the closing bracket');
  assert.ok(/^\s+$/.test(flush.indent), 'indent is whitespace taken from the last element');

  const queries = containers.find((c) => c.path === 'QUERIES');
  assert.equal(queries.kind, 'record-array', 'an array of objects is not appendable as a string');
});

test('records are duplicable and carry their id', async () => {
  const src = await readFile(CONTENT, 'utf8');
  const { records } = scanStrings(src);
  const q01 = records.find((r) => r.id === 'q01');
  assert.ok(q01, 'query records are indexed');
  const text = src.slice(q01.start, q01.end);
  assert.ok(text.startsWith('{') && text.endsWith('}'), `record range should be the object literal, got ${text.slice(0, 20)}`);
  assert.ok(text.includes("id: 'q01'"));
});

test('comments and escapes do not confuse the scanner', () => {
  const src = [
    "// a comment with 'quotes' in it",
    'export const A = {',
    "  a: 'plain',",
    "  b: 'it\\'s escaped',",
    '  /* block with "quotes" */',
    '  c: "double",',
    '  d: [\'one\', \'two\'],',
    '};',
  ].join('\n');
  const { strings } = scanStrings(src);
  const values = strings.filter((s) => s.role === 'value').map((s) => s.value);
  assert.deepEqual(values, ['plain', "it's escaped", 'double', 'one', 'two']);
  assert.deepEqual(
    strings.filter((s) => s.role === 'value').map((s) => s.path),
    ['A.a', 'A.b', 'A.c', 'A.d[0]', 'A.d[1]'],
  );
});
