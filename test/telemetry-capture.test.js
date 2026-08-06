import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry, FLUSH_LIMIT } from '../game/js/telemetry/capture.js';
import { MemoryStore } from '../game/js/telemetry/store.js';

function rig({ enabled } = {}) {
  const store = new MemoryStore();
  const clockState = { at: 1754500000000, pm: 1000 };
  const telemetry = createTelemetry({
    clock: { now: () => clockState.at, pm: () => clockState.pm },
    store,
    getTick: () => 42,
    ...(enabled === undefined ? {} : { enabled }),
  });
  return { store, telemetry, clockState };
}

test('startSession writes an anchored header and a matching id', async () => {
  const { store, telemetry } = rig();
  const id = await telemetry.startSession({ ua: 'node', dev: true });
  assert.match(id, /^\d{13}-[a-z0-9]{4}$/);
  assert.equal(telemetry.sessionId, id);
  const header = await store.getSession(id);
  assert.deepEqual(header.anchor, { at: 1754500000000, pm: 1000 });
  assert.equal(header.ua, 'node');
  assert.equal(header.dev, true);
  assert.equal(await telemetry.startSession({}), null); // second start is a no-op
});

test('event carries seq/at/pm/tick and buffers until flush', async () => {
  const { store, telemetry, clockState } = rig();
  const id = await telemetry.startSession({});
  clockState.at += 500;
  clockState.pm += 500;
  telemetry.event('action', { name: 'processToken' });
  telemetry.event('milestone', { key: 'era', from: 1, to: 2 });
  assert.equal(telemetry.pending, 3); // session.start + 2
  assert.deepEqual(await store.getEvents(id), []);
  await telemetry.flush();
  assert.equal(telemetry.pending, 0);
  const events = await store.getEvents(id);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.seq), [0, 1, 2]);
  assert.equal(events[1].at, 1754500000500);
  assert.equal(events[1].pm, 1500);
  assert.equal(events[1].tick, 42);
  assert.deepEqual(events[1].data, { name: 'processToken' });
  assert.equal(events[0].type, 'session.start');
});

test('auto-flush kicks in at FLUSH_LIMIT', async () => {
  const { store, telemetry } = rig();
  const id = await telemetry.startSession({});
  for (let i = telemetry.pending; i < FLUSH_LIMIT; i++) telemetry.event('x');
  await Promise.resolve(); // let the async flush settle
  assert.equal(telemetry.pending, 0);
  assert.equal((await store.getEvents(id)).length, FLUSH_LIMIT);
});

test('endSession logs session.end and flushes', async () => {
  const { store, telemetry } = rig();
  const id = await telemetry.startSession({});
  await telemetry.endSession();
  const events = await store.getEvents(id);
  assert.equal(events[events.length - 1].type, 'session.end');
});

test('setEnabled(false) flushes pending then drops new events', async () => {
  const { store, telemetry } = rig();
  const id = await telemetry.startSession({});
  telemetry.event('kept');
  telemetry.setEnabled(false);
  await Promise.resolve();
  telemetry.event('dropped');
  await telemetry.flush();
  const types = (await store.getEvents(id)).map((e) => e.type);
  assert.ok(types.includes('kept'));
  assert.ok(!types.includes('dropped'));
});

test('telemetry created disabled never starts a session', async () => {
  const { telemetry } = rig({ enabled: false });
  assert.equal(await telemetry.startSession({}), null);
  assert.equal(telemetry.sessionId, null);
  telemetry.event('x'); // must not throw
  assert.equal(telemetry.pending, 0);
});

test('flush prunes and retries once on storage failure, then drops', async () => {
  const store = new MemoryStore();
  let failures = 1;
  let pruned = false;
  const flaky = {
    putSession: (h) => store.putSession(h),
    appendEvents: (id, evs) => {
      if (failures > 0) {
        failures--;
        return Promise.reject(new Error('QuotaExceededError'));
      }
      return store.appendEvents(id, evs);
    },
    prune: (keep) => {
      pruned = true;
      return store.prune(keep);
    },
  };
  const telemetry = createTelemetry({
    clock: { now: () => 1754500000000, pm: () => 0 },
    store: flaky,
    getTick: () => 0,
  });
  const id = await telemetry.startSession({});
  telemetry.event('x');
  await telemetry.flush();
  assert.ok(pruned, 'prune ran before the retry');
  assert.equal((await store.getEvents(id)).length, 2); // session.start + x

  failures = 99; // permanent failure: batch drops, nothing throws
  telemetry.event('y');
  await telemetry.flush();
  assert.equal(telemetry.pending, 0);
});
