// test/s3-sink.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createS3Sink } from '../game/js/telemetry/sinks.js';

const ID = '1786061130678-nx1j';
const ENV = { enabled: true, brokerUrl: 'https://broker.example/', token: 'sekrit' };

function bundle({ audio = [] } = {}) {
  return {
    header: { id: ID, anchor: { at: 1786061130678, pm: 0 }, ua: 'node', dev: true },
    events: [{ seq: 0, at: 1786061130678, pm: 0, tick: 0, type: 'session.start' }],
    audio,
  };
}

function grantResponse() {
  return new Response(
    JSON.stringify({ url: 'https://bucket.example/', fields: { key: 'k', 'Content-Type': 'text/plain' } }),
    { status: 200 },
  );
}

// Replaces global fetch with a scripted queue; returns the recorded calls.
function mockFetch(t, responses) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error('mockFetch: no scripted response left');
    return next;
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

test('disabled env refuses before any network call', async (t) => {
  const calls = mockFetch(t, []);
  const sink = createS3Sink({ enabled: false, brokerUrl: '', token: '' });
  await assert.rejects(() => sink.export(bundle()), /submissions disabled/);
  assert.equal(calls.length, 0);
});

test('events-only bundle: grant then upload, correct bodies', async (t) => {
  const calls = mockFetch(t, [grantResponse(), new Response(null, { status: 204 })]);
  const sink = createS3Sink(ENV);
  assert.equal(await sink.export(bundle()), 'submitted');
  assert.equal(calls.length, 2);

  assert.equal(calls[0].url, ENV.brokerUrl);
  const grantBody = JSON.parse(calls[0].init.body);
  assert.deepEqual(grantBody, {
    token: 'sekrit',
    sessionId: ID,
    filename: `hyt-session-${ID}.jsonl`,
    size: grantBody.size, // asserted below
    contentType: 'text/plain',
  });
  assert.ok(Number.isInteger(grantBody.size) && grantBody.size > 0);

  assert.equal(calls[1].url, 'https://bucket.example/');
  const form = calls[1].init.body;
  assert.equal(form.get('key'), 'k');
  assert.equal(form.get('Content-Type'), 'text/plain');
  const file = form.get('file');
  assert.equal(file.name, `hyt-session-${ID}.jsonl`);
});

test('audio files get grants with normalized content type', async (t) => {
  const calls = mockFetch(t, [
    grantResponse(), new Response(null, { status: 204 }),
    grantResponse(), new Response(null, { status: 204 }),
  ]);
  const sink = createS3Sink(ENV);
  const b = bundle({
    audio: [{ recIdx: 1, blob: new Blob(['aa'], { type: 'audio/webm;codecs=opus' }), ext: 'webm' }],
  });
  assert.equal(await sink.export(b), 'submitted');
  assert.equal(calls.length, 4);
  const audioGrant = JSON.parse(calls[2].init.body);
  assert.equal(audioGrant.filename, `hyt-session-${ID}-r1.webm`);
  assert.equal(audioGrant.contentType, 'audio/webm'); // ;codecs stripped
  assert.equal(audioGrant.size, 2);
});

test('grant refusal surfaces the broker reason', async (t) => {
  mockFetch(t, [new Response(JSON.stringify({ reason: 'bad token' }), { status: 403 })]);
  const sink = createS3Sink(ENV);
  await assert.rejects(() => sink.export(bundle()), /grant refused: bad token/);
});

test('non-JSON grant failure falls back to a status message', async (t) => {
  mockFetch(t, [new Response('boom', { status: 500 })]);
  const sink = createS3Sink(ENV);
  await assert.rejects(() => sink.export(bundle()), /grant failed \(500\)/);
});

test('upload failure surfaces the status', async (t) => {
  mockFetch(t, [grantResponse(), new Response('', { status: 403 })]);
  const sink = createS3Sink(ENV);
  await assert.rejects(() => sink.export(bundle()), /upload failed \(403\)/);
});

test('progress is reported per file, and never claims a file that failed', async (t) => {
  // "Clicking submit has no apparent effect" was reported against a
  // submission that had in fact SUCCEEDED — the sink was silent for the whole
  // multi-megabyte upload. These are the events the row now renders.
  const audio = [{ recIdx: 1, blob: new Blob(['xxxxxxxxxx'], { type: 'audio/mp4' }), ext: 'm4a' }];
  mockFetch(t, [
    grantResponse(), new Response(null, { status: 204 }),
    grantResponse(), new Response(null, { status: 204 }),
  ]);
  const seen = [];
  const sink = createS3Sink(ENV);
  await sink.export(bundle({ audio }), (p) => seen.push(`${p.phase} ${p.done}/${p.total} ${p.name}`));
  assert.deepEqual(seen, [
    `start 0/2 hyt-session-${ID}.jsonl`,
    `done 1/2 hyt-session-${ID}.jsonl`,
    `start 1/2 hyt-session-${ID}-r1.m4a`,
    `done 2/2 hyt-session-${ID}-r1.m4a`,
  ]);

  // A failed upload must not report 'done' for that file.
  mockFetch(t, [grantResponse(), new Response(null, { status: 403 })]);
  const failed = [];
  await assert.rejects(
    () => createS3Sink(ENV).export(bundle(), (p) => failed.push(p.phase)),
    /upload failed \(403\)/,
  );
  assert.deepEqual(failed, ['start']);
});

test('export still works with no progress callback', async (t) => {
  mockFetch(t, [grantResponse(), new Response(null, { status: 204 })]);
  assert.equal(await createS3Sink(ENV).export(bundle()), 'submitted');
});
