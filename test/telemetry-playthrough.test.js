// test/telemetry-playthrough.test.js
// Headless end-to-end: a real bot playthrough must produce chat, log,
// milestone, and lifecycle events through the hooks, with monotonic pm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { tick } from '../game/js/engine/tick.js';
import { botStep } from './helpers/bot.js';
import { MemoryStore } from '../game/js/telemetry/store.js';
import { createTelemetry } from '../game/js/telemetry/capture.js';
import { installTelemetryHooks } from '../game/js/telemetry/hooks.js';

test('bot playthrough emits chat, log, milestone, lifecycle events', async () => {
  const s = createState(123);
  const stateBox = { current: s };
  let pm = 0;
  const store = new MemoryStore();
  const telemetry = createTelemetry({
    clock: { now: () => 1754500000000 + pm, pm: () => pm },
    store,
    getTick: () => stateBox.current.tick,
  });
  const hooks = installTelemetryHooks({ telemetry, stateBox });
  const id = await telemetry.startSession({ ua: 'node-test', dev: true });

  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 400000) {
    botStep(s);
    tick(s);
    pm += 200;
    if (guard % 10 === 0) hooks.afterPaint();
  }
  hooks.afterPaint();
  assert.equal(s.phase, 'teaser');
  await telemetry.endSession();

  const events = await store.getEvents(id);
  const types = new Set(events.map((e) => e.type));
  assert.ok(types.has('session.start'));
  assert.ok(types.has('session.end'));
  assert.ok(types.has('chat'));
  assert.ok(types.has('log'));
  assert.ok(types.has('milestone'));

  const eras = events
    .filter((e) => e.type === 'milestone' && e.data.key === 'era')
    .map((e) => e.data.to);
  assert.deepEqual(eras, [2, 3, 4]);

  const chats = events.filter((e) => e.type === 'chat');
  assert.ok(chats.length > 10);
  assert.ok(chats.every((e) => typeof e.data.kind === 'string' && typeof e.data.text === 'string'));

  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].pm >= events[i - 1].pm, `pm not monotonic at ${i}`);
    assert.equal(events[i].seq, events[i - 1].seq + 1);
  }
});
