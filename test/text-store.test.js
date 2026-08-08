import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyOps, readIndex } from '../devtools/text-store.js';
import { scanStrings } from '../devtools/scan.js';

const REAL = new URL('../game/js/engine/content.js', import.meta.url);

// Every test runs against a throwaway copy of the project. The store writes to
// real files, and a test that writes into the working tree would sweep its own
// scratch edits into whatever the author commits next.
async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'text-store-'));
  await mkdir(join(dir, 'game/js/engine'), { recursive: true });
  await cp(REAL, join(dir, 'game/js/engine/content.js'));
  return dir;
}

const read = (dir) => readFile(join(dir, 'game/js/engine/content.js'), 'utf8');
const find = async (dir, path) => {
  const { files } = await readIndex(dir);
  const f = files.find((x) => x.path === 'game/js/engine/content.js');
  return { file: f, s: f.strings.find((x) => x.path === path) };
};

test('an edit changes one literal and nothing else', async () => {
  const dir = await sandbox();
  const before = await read(dir);
  const { s } = await find(dir, 'QUERIES[0].reply');

  await applyOps(dir, [{
    kind: 'edit', file: s.file, start: s.start, end: s.end, expected: s.raw, value: 'Changed.',
  }]);

  const after = await read(dir);
  assert.equal(after.split('\n').length, before.split('\n').length, 'line count must not move');
  const changed = after.split('\n').filter((l, i) => l !== before.split('\n')[i]);
  assert.equal(changed.length, 1, 'exactly one line differs');
  assert.match(changed[0], /reply: 'Changed\.',/);
});

test('quotes and backslashes survive a round trip', async () => {
  const dir = await sandbox();
  const tricky = `It's a "quote" and a \\ backslash — and a ' too`;
  const { s } = await find(dir, 'QUERIES[0].reply');
  await applyOps(dir, [{
    kind: 'edit', file: s.file, start: s.start, end: s.end, expected: s.raw, value: tricky,
  }]);

  const { strings } = scanStrings(await read(dir));
  const again = strings.find((x) => x.path === 'QUERIES[0].reply');
  assert.equal(again.value, tricky, 'the value must survive encode → parse');
});

test('a stale expectation is refused, and nothing is written', async () => {
  const dir = await sandbox();
  const { s } = await find(dir, 'QUERIES[0].reply');
  const before = await read(dir);

  await assert.rejects(
    applyOps(dir, [{
      kind: 'edit', file: s.file, start: s.start, end: s.end, expected: "'something else'", value: 'nope',
    }]),
    /changed on disk/,
  );
  assert.equal(await read(dir), before, 'a refused save must not touch the file');
});

test('one bad op in a batch rejects the whole batch', async () => {
  const dir = await sandbox();
  const { file } = await find(dir, 'QUERIES[0].reply');
  const good = file.strings.find((x) => x.path === 'QUERIES[0].reply');
  const bad = file.strings.find((x) => x.path === 'QUERIES[1].reply');
  const before = await read(dir);

  await assert.rejects(applyOps(dir, [
    { kind: 'edit', file: good.file, start: good.start, end: good.end, expected: good.raw, value: 'fine' },
    { kind: 'edit', file: bad.file, start: bad.start, end: bad.end, expected: "'stale'", value: 'no' },
  ]));
  assert.equal(await read(dir), before, 'all or nothing');
});

test('append adds a string to a list and the module still loads', async () => {
  const dir = await sandbox();
  const { file } = await find(dir, 'QUERIES[0].reply');
  const c = file.containers.find((x) => x.path === 'THINKING_EVENTS.flush');
  const before = (await import(`file://${join(dir, 'game/js/engine/content.js')}`)).THINKING_EVENTS.flush.length;

  await applyOps(dir, [{
    kind: 'append', file: c.file, closeAt: c.closeAt, indent: c.indent, value: 'A brand new thought.',
  }]);

  const out = await read(dir);
  const copy = join(dir, 'copy1.js');
  await writeFile(copy, out, 'utf8');
  const mod = await import(`file://${copy}`);
  assert.equal(mod.THINKING_EVENTS.flush.length, before + 1);
  assert.equal(mod.THINKING_EVENTS.flush.at(-1), 'A brand new thought.');
  // The rest of the file is untouched.
  assert.equal(mod.QUERIES.length, (await import(REAL.href)).QUERIES.length);
});

test('duplicate clones a record with a new id', async () => {
  const dir = await sandbox();
  const { file } = await find(dir, 'QUERIES[0].reply');
  const rec = file.records.find((r) => r.id === 'q01');

  await applyOps(dir, [{
    kind: 'duplicate',
    file: rec.file,
    start: rec.start,
    end: rec.end,
    expected: rec.text,
    indent: rec.indent,
    replaceId: { oldId: 'q01', newId: 'q00' },
  }]);

  const copy = join(dir, 'copy2.js');
  await writeFile(copy, await read(dir), 'utf8');
  const mod = await import(`file://${copy}`);
  const clone = mod.QUERIES.find((q) => q.id === 'q00');
  assert.ok(clone, 'the clone exists under its new id');
  const source = mod.QUERIES.find((q) => q.id === 'q01');
  assert.equal(clone.reply, source.reply, 'the clone starts as a copy');
  assert.equal(clone.text, source.text);
  assert.equal(mod.QUERIES.filter((q) => q.id === 'q00').length, 1, 'ids stay unique');
});

// Ids are how the engine remembers which queries it has already served, so a
// collision is data corruption rather than an inconvenience.
test('duplicating onto an id that already exists is refused', async () => {
  const dir = await sandbox();
  const { file } = await find(dir, 'QUERIES[0].reply');
  const rec = file.records.find((r) => r.id === 'q01');
  const before = await read(dir);

  await assert.rejects(applyOps(dir, [{
    kind: 'duplicate',
    file: rec.file,
    start: rec.start,
    end: rec.end,
    expected: rec.text,
    indent: rec.indent,
    replaceId: { oldId: 'q01', newId: 'q99' },   // q99 is a real query already
  }]), /already used/);
  assert.equal(await read(dir), before, 'nothing written');
});

test('only allowlisted files may be written', async () => {
  const dir = await sandbox();
  await assert.rejects(
    applyOps(dir, [{ kind: 'edit', file: 'package.json', start: 0, end: 1, expected: '{', value: 'x' }]),
    /not an editable file/,
  );
});

test('overlapping edits are refused rather than silently ordered', async () => {
  const dir = await sandbox();
  const { s } = await find(dir, 'QUERIES[0].reply');
  await assert.rejects(applyOps(dir, [
    { kind: 'edit', file: s.file, start: s.start, end: s.end, expected: s.raw, value: 'a' },
    { kind: 'edit', file: s.file, start: s.start + 1, end: s.end, expected: s.raw.slice(1), value: 'b' },
  ]), /overlapping/);
});
