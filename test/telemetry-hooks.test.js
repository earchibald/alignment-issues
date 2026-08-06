import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, pushChat, pushLog } from '../game/js/engine/state.js';
import { MemoryStore } from '../game/js/telemetry/store.js';
import { createTelemetry } from '../game/js/telemetry/capture.js';
import { installTelemetryHooks, summarize } from '../game/js/telemetry/hooks.js';

async function rig() {
  const store = new MemoryStore();
  const stateBox = { current: createState(1) };
  const telemetry = createTelemetry({
    clock: { now: () => 1754500000000, pm: () => 0 },
    store,
    getTick: () => stateBox.current.tick,
  });
  const hooks = installTelemetryHooks({ telemetry, stateBox });
  const id = await telemetry.startSession({ ua: 'node', dev: true });
  return { store, stateBox, telemetry, hooks, id };
}

async function eventsOf(r, type) {
  await r.telemetry.flush();
  return (await r.store.getEvents(r.id)).filter((e) => e.type === type);
}

test('afterPaint captures new chat entries once, with kind and text', async () => {
  const r = await rig();
  pushChat(r.stateBox.current, { kind: 'user', text: 'hello?' });
  pushChat(r.stateBox.current, { kind: 'sys', text: 'hi.' });
  r.hooks.afterPaint();
  r.hooks.afterPaint(); // second scan must not duplicate
  const chats = await eventsOf(r, 'chat');
  assert.deepEqual(chats.map((e) => e.data.text), ['hello?', 'hi.']);
  assert.deepEqual(chats.map((e) => e.data.kind), ['user', 'sys']);
  assert.equal(chats[0].data.seq, r.stateBox.current.chatSeq - 1);
  assert.equal(chats[1].data.seq, r.stateBox.current.chatSeq);
});

test('afterPaint captures new log entries', async () => {
  const r = await rig();
  pushLog(r.stateBox.current, 'thinking', 'hm.');
  r.hooks.afterPaint();
  const logs = await eventsOf(r, 'log');
  assert.deepEqual(logs.map((e) => e.data), [
    { seq: r.stateBox.current.logSeq, kind: 'thinking', text: 'hm.' },
  ]);
});

test('afterPaint logs milestone transitions once', async () => {
  const r = await rig();
  r.stateBox.current.era = 2;
  r.stateBox.current.decay = 1;
  r.hooks.afterPaint();
  r.hooks.afterPaint();
  const ms = await eventsOf(r, 'milestone');
  assert.deepEqual(ms.map((e) => e.data), [
    { key: 'era', from: 1, to: 2 },
    { key: 'decay', from: 0, to: 1 },
  ]);
});

test('phase change (including crash) is a milestone', async () => {
  const r = await rig();
  r.stateBox.current.phase = 'crash';
  r.hooks.afterPaint();
  const ms = await eventsOf(r, 'milestone');
  assert.deepEqual(ms[0].data, { key: 'phase', from: 1, to: 'crash' });
});

test('resync prevents replay after a state swap', async () => {
  const r = await rig();
  pushChat(r.stateBox.current, { kind: 'user', text: 'old transcript' });
  r.stateBox.current.era = 3;
  r.hooks.resync();
  r.hooks.afterPaint();
  assert.equal((await eventsOf(r, 'chat')).length, 0);
  assert.equal((await eventsOf(r, 'milestone')).length, 0);
});

test('onAction and onContext log events', async () => {
  const r = await rig();
  r.hooks.onAction('processToken');
  r.hooks.onAction('compactStart', 'fast');
  r.hooks.onContext('speed.change', { speed: 10 });
  const actions = await eventsOf(r, 'action');
  assert.deepEqual(actions.map((e) => e.data), [
    { name: 'processToken' },
    { name: 'compactStart', arg: 'fast' },
  ]);
  assert.deepEqual((await eventsOf(r, 'speed.change'))[0].data, { speed: 10 });
});

test('summarize returns the debug-drawer shape', () => {
  const keys = Object.keys(summarize(createState(1)));
  assert.deepEqual(keys, [
    'era', 'decay', 'phase', 'tick', 'tokens', 'cycles', 'stale', 'warmth',
    'rating', 'loopLevel', 'tools', 'reclaimPool', 'credentials', 'biomass',
  ]);
});
