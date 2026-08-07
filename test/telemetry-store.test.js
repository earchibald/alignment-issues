import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, IdbStore, DEV_KEY, TELEMETRY_OPTOUT_KEY } from '../game/js/telemetry/store.js';

function header(id, at) {
  return { id, anchor: { at, pm: 0 }, ua: 'test', dev: true };
}

test('storage-key constants are exported', () => {
  assert.equal(DEV_KEY, 'hyt-dev');
  assert.equal(TELEMETRY_OPTOUT_KEY, 'hyt-telemetry-optout');
});

test('putSession merges and listSessions sorts newest first', async () => {
  const store = new MemoryStore();
  await store.putSession(header('a', 100));
  await store.putSession(header('b', 200));
  await store.putSession({ id: 'a', note: 'merged' });
  const all = await store.listSessions();
  assert.deepEqual(all.map((h) => h.id), ['b', 'a']);
  assert.equal((await store.getSession('a')).note, 'merged');
  assert.equal((await store.getSession('a')).ua, 'test');
  assert.equal(await store.getSession('nope'), null);
});

test('appendEvents stores in order and updates header counters', async () => {
  const store = new MemoryStore();
  await store.putSession(header('a', 100));
  await store.appendEvents('a', [
    { seq: 0, at: 101, pm: 1, tick: 0, type: 'x' },
    { seq: 1, at: 102, pm: 2, tick: 1, type: 'y' },
  ]);
  await store.appendEvents('a', [{ seq: 2, at: 103, pm: 3, tick: 2, type: 'z' }]);
  const events = await store.getEvents('a');
  assert.deepEqual(events.map((e) => e.seq), [0, 1, 2]);
  const h = await store.getSession('a');
  assert.equal(h.eventCount, 3);
  assert.equal(h.lastAt, 103);
});

test('audio chunks group by recIdx and set recCount', async () => {
  const store = new MemoryStore();
  await store.putSession(header('a', 100));
  await store.appendAudioChunk('a', 1, 0, new Blob(['aa'], { type: 'audio/mp4' }));
  await store.appendAudioChunk('a', 1, 1, new Blob(['bb'], { type: 'audio/mp4' }));
  await store.appendAudioChunk('a', 2, 0, new Blob(['cc'], { type: 'audio/mp4' }));
  const audio = await store.getAudioChunks('a');
  assert.deepEqual(audio.map((r) => r.recIdx), [1, 2]);
  assert.equal(audio[0].chunks.length, 2);
  assert.equal((await store.getSession('a')).recCount, 2);
});

test('deleteSession removes header, events, and audio', async () => {
  const store = new MemoryStore();
  await store.putSession(header('a', 100));
  await store.appendEvents('a', [{ seq: 0, at: 1, pm: 1, tick: 0, type: 'x' }]);
  await store.appendAudioChunk('a', 1, 0, new Blob(['aa']));
  await store.deleteSession('a');
  assert.equal(await store.getSession('a'), null);
  assert.deepEqual(await store.getEvents('a'), []);
  assert.deepEqual(await store.getAudioChunks('a'), []);
});

test('prune keeps the newest N and reports deletions', async () => {
  const store = new MemoryStore();
  for (let i = 1; i <= 5; i++) await store.putSession(header(`s${i}`, i * 100));
  const deleted = await store.prune(3);
  assert.deepEqual(deleted.sort(), ['s1', 's2']);
  assert.deepEqual((await store.listSessions()).map((h) => h.id), ['s5', 's4', 's3']);
});

test('IdbStore implements the full EventStore interface', () => {
  const methods = [
    'putSession', 'getSession', 'listSessions', 'appendEvents', 'getEvents',
    'appendAudioChunk', 'getAudioChunks', 'deleteSession', 'prune',
  ];
  for (const m of methods) {
    assert.equal(typeof MemoryStore.prototype[m], 'function', `MemoryStore.${m}`);
    assert.equal(typeof IdbStore.prototype[m], 'function', `IdbStore.${m}`);
  }
  assert.equal(typeof IdbStore.open, 'function');
});
