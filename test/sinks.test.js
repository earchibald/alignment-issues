import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../game/js/telemetry/store.js';
import { buildBundle, bundleToJsonl, bundleFilenames } from '../game/js/telemetry/sinks.js';

const ID = '1754500000000-ab12';

async function seededStore() {
  const store = new MemoryStore();
  await store.putSession({ id: ID, anchor: { at: 1754500000000, pm: 0 }, ua: 'node', dev: true });
  await store.appendEvents(ID, [
    { seq: 0, at: 1754500000000, pm: 0, tick: 0, type: 'session.start' },
    { seq: 1, at: 1754500000500, pm: 500, tick: 2, type: 'action', data: { name: 'processToken' } },
  ]);
  await store.appendAudioChunk(ID, 1, 0, new Blob(['aa'], { type: 'audio/mp4' }));
  await store.appendAudioChunk(ID, 1, 1, new Blob(['bb'], { type: 'audio/mp4' }));
  await store.appendAudioChunk(ID, 2, 0, new Blob(['cc'], { type: 'audio/webm;codecs=opus' }));
  return store;
}

test('buildBundle assembles header, events, concatenated audio', async () => {
  const bundle = await buildBundle(await seededStore(), ID);
  assert.equal(bundle.header.id, ID);
  assert.equal(bundle.events.length, 2);
  assert.deepEqual(bundle.audio.map((a) => a.recIdx), [1, 2]);
  assert.equal(bundle.audio[0].blob.size, 4); // 'aa' + 'bb'
  assert.equal(bundle.audio[0].ext, 'm4a');
  assert.equal(bundle.audio[1].ext, 'webm');
});

test('buildBundle returns null for an unknown session', async () => {
  assert.equal(await buildBundle(new MemoryStore(), 'nope'), null);
});

test('bundleToJsonl: header line + one line per event', async () => {
  const jsonl = bundleToJsonl(await buildBundle(await seededStore(), ID));
  const lines = jsonl.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[0]).id, ID);
  assert.deepEqual(JSON.parse(lines[2]).data, { name: 'processToken' });
  assert.ok(jsonl.endsWith('\n'));
});

test('bundleFilenames match the spec exactly', async () => {
  const names = bundleFilenames(await buildBundle(await seededStore(), ID));
  assert.equal(names.events, `hyt-session-${ID}.jsonl`);
  assert.deepEqual(names.audio, [
    `hyt-session-${ID}-r1.m4a`,
    `hyt-session-${ID}-r2.webm`,
  ]);
  const SPEC = /^hyt-session-\d{13}-[a-z0-9]{4}(\.jsonl|-r\d+\.(m4a|webm))$/;
  assert.match(names.events, SPEC);
  for (const n of names.audio) assert.match(n, SPEC);
});
