# Session Telemetry + Recording Overlay Implementation Plan (1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every gameplay session records a timestamped event stream to IndexedDB; in dev mode a semi-transparent overlay records voice with strict timestamp correlation; both export to local files (share sheet on iPhone).

**Architecture:** Chokepoint instrumentation outside the pure engine: a DOM-free capture core (`capture.js`) with injected clock/store, two `EventStore` implementations (`MemoryStore`, `IdbStore`), a game-aware hooks module wired from `main.js`, a MediaRecorder overlay, and a `FileExportSink`. Spec: `docs/superpowers/specs/2026-08-06-session-recording-design.md`. Plans 2 (analysis tooling) and 3 (S3 pathway) build on this one.

**Tech Stack:** Vanilla JS ES modules, IndexedDB, MediaRecorder, Web Share API, node:test.

## Global Constraints

- Vanilla JS ES modules. No build step. No npm dependencies. No TypeScript syntax.
- DOM building uses strict `createElement`. `innerHTML` is forbidden.
- `game/js/engine/` must not be modified.
- Run tests with `npm test` (never `node --test test/` — Node rejects the bare dir arg). CI uses Node 22.
- All existing tests must stay green.
- Event schema, exact: `{seq, at, pm, tick, type, data?}`. `at` = `Date.now()`, `pm` = `performance.now()`, `tick` = game tick.
- Session id format, exact: `^\d{13}-[a-z0-9]{4}$` (epoch ms + 4 chars).
- Filenames, exact: `hyt-session-<id>.jsonl`, `hyt-session-<id>-r<recIdx>.m4a` (or `.webm`). `recIdx` is 1-based.
- localStorage keys: `hyt-dev` (dev flag), `hyt-telemetry-optout` (opt-out). IndexedDB database: `hyt-telemetry`.
- Tunables: keep 20 sessions; flush every 2 s or 50 events; snapshot every 5 s; MediaRecorder timeslice 1000 ms.
- Every interactive control gets a `data-testid`.
- Commit messages use the repo's conventional prefixes (`feat:`, `fix:`) and end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `game/js/telemetry/store.js` (new) | `EventStore` interface: `MemoryStore` + `IdbStore`, storage-key constants |
| `game/js/telemetry/capture.js` (new) | DOM-free capture core: sessions, events, buffering, flush |
| `game/js/telemetry/hooks.js` (new) | Game-aware wiring: chat/log/milestone deltas, context events, `summarize` |
| `game/js/telemetry/sinks.js` (new) | Bundle building, JSONL serialization, `FileExportSink` |
| `game/js/ui/recorder.js` (new) | Dev-mode recording pill + MediaRecorder pipeline |
| `game/js/ui/sessions.js` (new) | Dev-drawer session list (export/delete) |
| `game/js/main.js` (modify) | Dev flag, telemetry init, dispatch/paint/context call sites |
| `game/js/ui/debug.js` (modify) | Import shared `summarize`; drop its own `?debug=1` unhide |
| `game/js/ui/settings.js` (modify) | "Session telemetry" opt-out toggle |
| `game/css/game.css` (modify) | `.rec-pill` and `.session-row` styles |

---

### Task 1: EventStore interface + MemoryStore

**Files:**
- Create: `game/js/telemetry/store.js`
- Test: `test/telemetry-store.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all methods async; both store classes implement the same set):
  - `putSession(header)` — upsert, merges onto an existing header.
  - `getSession(id) -> header | null`
  - `listSessions() -> header[]` newest-first by `anchor.at`.
  - `appendEvents(id, events)` — also bumps `header.eventCount`, sets `header.lastAt`.
  - `getEvents(id) -> event[]` in seq order.
  - `appendAudioChunk(id, recIdx, chunkIdx, blob)` — also sets `header.recCount = max(recCount, recIdx)`.
  - `getAudioChunks(id) -> [{recIdx, chunks: Blob[]}]` recIdx ascending, chunks in chunkIdx order.
  - `deleteSession(id)` — removes header, events, audio.
  - `prune(keep) -> string[]` — deletes all but the newest `keep` sessions, returns deleted ids.
  - Constants: `DEV_KEY = 'hyt-dev'`, `TELEMETRY_OPTOUT_KEY = 'hyt-telemetry-optout'`.
  - Header shape: `{id, anchor: {at, pm}, ua, dev, eventCount?, lastAt?, recCount?}`.

- [ ] **Step 1: Write the failing test**

```js
// test/telemetry-store.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore, DEV_KEY, TELEMETRY_OPTOUT_KEY } from '../game/js/telemetry/store.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-store.test.js`
Expected: FAIL — `Cannot find module .../game/js/telemetry/store.js`

- [ ] **Step 3: Write the implementation**

```js
// game/js/telemetry/store.js
// EventStore implementations for session telemetry.
// MemoryStore backs node tests and the private-browsing fallback.
// IdbStore (Task 3) persists to IndexedDB. Both expose the same async
// interface; test/telemetry-store.test.js documents it.

export const DEV_KEY = 'hyt-dev';
export const TELEMETRY_OPTOUT_KEY = 'hyt-telemetry-optout';

export class MemoryStore {
  constructor() {
    this.sessions = new Map(); // id -> header
    this.events = new Map();   // id -> [event]
    this.audio = new Map();    // id -> Map(recIdx -> [blob by chunkIdx])
  }

  async putSession(header) {
    const prev = this.sessions.get(header.id) || {};
    this.sessions.set(header.id, { ...prev, ...header });
  }

  async getSession(id) {
    return this.sessions.get(id) || null;
  }

  async listSessions() {
    return [...this.sessions.values()].sort((a, b) => b.anchor.at - a.anchor.at);
  }

  async appendEvents(id, events) {
    if (events.length === 0) return;
    const arr = this.events.get(id) || [];
    arr.push(...events);
    this.events.set(id, arr);
    const header = this.sessions.get(id);
    if (header) {
      header.eventCount = arr.length;
      header.lastAt = events[events.length - 1].at;
    }
  }

  async getEvents(id) {
    return (this.events.get(id) || []).slice();
  }

  async appendAudioChunk(id, recIdx, chunkIdx, blob) {
    let recs = this.audio.get(id);
    if (!recs) {
      recs = new Map();
      this.audio.set(id, recs);
    }
    let chunks = recs.get(recIdx);
    if (!chunks) {
      chunks = [];
      recs.set(recIdx, chunks);
    }
    chunks[chunkIdx] = blob;
    const header = this.sessions.get(id);
    if (header) header.recCount = Math.max(header.recCount || 0, recIdx);
  }

  async getAudioChunks(id) {
    const recs = this.audio.get(id);
    if (!recs) return [];
    return [...recs.keys()]
      .sort((a, b) => a - b)
      .map((recIdx) => ({ recIdx, chunks: recs.get(recIdx).filter(Boolean) }));
  }

  async deleteSession(id) {
    this.sessions.delete(id);
    this.events.delete(id);
    this.audio.delete(id);
  }

  async prune(keep) {
    const all = await this.listSessions();
    const doomed = all.slice(keep).map((h) => h.id);
    for (const id of doomed) await this.deleteSession(id);
    return doomed;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-store.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add game/js/telemetry/store.js test/telemetry-store.test.js
git commit -m "feat: telemetry EventStore interface + MemoryStore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Capture core

**Files:**
- Create: `game/js/telemetry/capture.js`
- Test: `test/telemetry-capture.test.js`

**Interfaces:**
- Consumes: an `EventStore` (Task 1).
- Produces: `createTelemetry({clock, store, getTick, enabled = true})` returning:
  - `startSession(meta) -> Promise<string|null>` — writes header `{id, anchor, ...meta}`, logs `session.start`, returns id (null when disabled or already started).
  - `event(type, data?)` — buffers `{seq, at, pm, tick, type, data?}`; auto-flushes at `FLUSH_LIMIT`.
  - `flush() -> Promise` — appends buffered events to the store.
  - `endSession() -> Promise` — logs `session.end`, flushes.
  - `setEnabled(bool)` — off: flushes pending, then drops future events.
  - `sessionId` getter (null before start), `pending` getter (buffered count).
  - `clock` is `{now: () => epoch ms, pm: () => monotonic ms}`.
  - Exported const `FLUSH_LIMIT = 50`.

- [ ] **Step 1: Write the failing test**

```js
// test/telemetry-capture.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-capture.test.js`
Expected: FAIL — `Cannot find module .../game/js/telemetry/capture.js`

- [ ] **Step 3: Write the implementation**

```js
// game/js/telemetry/capture.js
// DOM-free telemetry core. All timing and storage are injected so the
// module runs unchanged under node --test. Timers live in hooks.js, not
// here; callers drive flush().

export const FLUSH_LIMIT = 50;
const PRUNE_TO_ON_ERROR = 5;

function randSuffix() {
  return (Math.random().toString(36) + '0000').slice(2, 6);
}

export function createTelemetry({ clock, store, getTick, enabled = true }) {
  let sessionId = null;
  let seq = 0;
  let buffer = [];
  let started = false;
  let on = enabled;

  async function flush() {
    if (!sessionId || buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
      await store.appendEvents(sessionId, batch);
    } catch {
      // Storage full or broken: free space, retry once, then drop the
      // batch rather than take the game down (spec: error handling).
      try {
        if (typeof store.prune === 'function') await store.prune(PRUNE_TO_ON_ERROR);
        await store.appendEvents(sessionId, batch);
      } catch (err) {
        console.warn('telemetry: dropping batch after storage failure', err);
      }
    }
  }

  function event(type, data) {
    if (!on || !started) return;
    buffer.push({
      seq: seq++,
      at: clock.now(),
      pm: clock.pm(),
      tick: getTick(),
      type,
      ...(data !== undefined ? { data } : {}),
    });
    if (buffer.length >= FLUSH_LIMIT) flush();
  }

  async function startSession(meta) {
    if (started || !on) return null;
    const at = clock.now();
    const pm = clock.pm();
    sessionId = `${at}-${randSuffix()}`;
    started = true;
    await store.putSession({ id: sessionId, anchor: { at, pm }, ...meta });
    event('session.start', meta);
    return sessionId;
  }

  async function endSession() {
    if (!started) return;
    event('session.end');
    await flush();
  }

  function setEnabled(next) {
    if (!next) flush();
    on = next;
  }

  return {
    startSession,
    event,
    flush,
    endSession,
    setEnabled,
    get sessionId() { return sessionId; },
    get pending() { return buffer.length; },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-capture.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add game/js/telemetry/capture.js test/telemetry-capture.test.js
git commit -m "feat: telemetry capture core with injected clock and store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: IdbStore

**Files:**
- Modify: `game/js/telemetry/store.js` (append)
- Test: `test/telemetry-store.test.js` (append)

**Interfaces:**
- Consumes: browser `indexedDB` (only touched inside methods — importing the module in node must not throw).
- Produces: `IdbStore.open() -> Promise<IdbStore>` plus the full `EventStore` interface from Task 1. Database `hyt-telemetry` v1, object stores: `sessions` (keyPath `id`), `events` (keyPath `['sessionId','seq']`), `audio` (keyPath `['sessionId','recIdx','chunkIdx']`).

Node cannot run IndexedDB, so the unit test is an interface-parity check; real verification is the manual browser step in Task 5.

- [ ] **Step 1: Write the failing test (append to `test/telemetry-store.test.js`)**

```js
import { IdbStore } from '../game/js/telemetry/store.js'; // add to existing import line

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-store.test.js`
Expected: FAIL — `IdbStore` is not exported.

- [ ] **Step 3: Write the implementation (append to `game/js/telemetry/store.js`)**

```js
// --- IndexedDB implementation ---------------------------------------
// Same interface as MemoryStore. Multi-request writes issue all requests
// synchronously inside one transaction and await tx completion, so the
// transaction can never auto-commit out from under a pending request.

const DB_NAME = 'hyt-telemetry';
const DB_VERSION = 1;

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export class IdbStore {
  static async open() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('sessions', { keyPath: 'id' });
      db.createObjectStore('events', { keyPath: ['sessionId', 'seq'] });
      db.createObjectStore('audio', { keyPath: ['sessionId', 'recIdx', 'chunkIdx'] });
    };
    return new IdbStore(await req(request));
  }

  constructor(db) {
    this.db = db;
  }

  async putSession(header) {
    const tx = this.db.transaction(['sessions'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    const getReq = sessions.get(header.id);
    getReq.onsuccess = () => {
      sessions.put({ ...(getReq.result || {}), ...header });
    };
    await txDone(tx);
  }

  async getSession(id) {
    const sessions = this.db.transaction(['sessions']).objectStore('sessions');
    return (await req(sessions.get(id))) || null;
  }

  async listSessions() {
    const sessions = this.db.transaction(['sessions']).objectStore('sessions');
    const all = await req(sessions.getAll());
    return all.sort((a, b) => b.anchor.at - a.anchor.at);
  }

  async appendEvents(id, events) {
    if (events.length === 0) return;
    const tx = this.db.transaction(['events', 'sessions'], 'readwrite');
    const evStore = tx.objectStore('events');
    for (const ev of events) evStore.put({ sessionId: id, ...ev });
    const sessions = tx.objectStore('sessions');
    const getReq = sessions.get(id);
    getReq.onsuccess = () => {
      const header = getReq.result;
      if (header) {
        header.eventCount = (header.eventCount || 0) + events.length;
        header.lastAt = events[events.length - 1].at;
        sessions.put(header);
      }
    };
    await txDone(tx);
  }

  async getEvents(id) {
    const evStore = this.db.transaction(['events']).objectStore('events');
    const range = IDBKeyRange.bound([id, -Infinity], [id, Infinity]);
    const rows = await req(evStore.getAll(range));
    return rows.map(({ sessionId: _sid, ...ev }) => ev);
  }

  async appendAudioChunk(id, recIdx, chunkIdx, blob) {
    const tx = this.db.transaction(['audio', 'sessions'], 'readwrite');
    tx.objectStore('audio').put({ sessionId: id, recIdx, chunkIdx, blob });
    const sessions = tx.objectStore('sessions');
    const getReq = sessions.get(id);
    getReq.onsuccess = () => {
      const header = getReq.result;
      if (header) {
        header.recCount = Math.max(header.recCount || 0, recIdx);
        sessions.put(header);
      }
    };
    await txDone(tx);
  }

  async getAudioChunks(id) {
    const audio = this.db.transaction(['audio']).objectStore('audio');
    const range = IDBKeyRange.bound([id, -Infinity, -Infinity], [id, Infinity, Infinity]);
    const rows = await req(audio.getAll(range)); // key order: recIdx, then chunkIdx
    const byRec = new Map();
    for (const row of rows) {
      if (!byRec.has(row.recIdx)) byRec.set(row.recIdx, []);
      byRec.get(row.recIdx).push(row.blob);
    }
    return [...byRec.entries()].map(([recIdx, chunks]) => ({ recIdx, chunks }));
  }

  async deleteSession(id) {
    const tx = this.db.transaction(['sessions', 'events', 'audio'], 'readwrite');
    tx.objectStore('sessions').delete(id);
    tx.objectStore('events').delete(IDBKeyRange.bound([id, -Infinity], [id, Infinity]));
    tx.objectStore('audio').delete(IDBKeyRange.bound([id, -Infinity, -Infinity], [id, Infinity, Infinity]));
    await txDone(tx);
  }

  async prune(keep) {
    const all = await this.listSessions();
    const doomed = all.slice(keep).map((h) => h.id);
    for (const id of doomed) await this.deleteSession(id);
    return doomed;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-store.test.js`
Expected: PASS (7 tests). Confirm the module imports cleanly in node: `node -e "import('./game/js/telemetry/store.js').then(() => console.log('ok'))"` → `ok`.

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add game/js/telemetry/store.js test/telemetry-store.test.js
git commit -m "feat: IndexedDB EventStore implementation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Game-aware hooks

**Files:**
- Create: `game/js/telemetry/hooks.js`
- Test: `test/telemetry-hooks.test.js`

**Interfaces:**
- Consumes: `createTelemetry` result (Task 2); game state shape (`chat`/`chatSeq`, `log`/`logSeq`, milestone fields).
- Produces: `installTelemetryHooks({telemetry, stateBox})` returning:
  - `onAction(name, arg?)` — logs `action` event `{name, arg?}`.
  - `afterPaint()` — logs new `chat`/`log` entries (`{seq, kind, text}`) and `milestone` transitions (`{key, from, to}`) for era/phase/decay/loopLevel.
  - `onContext(type, data?)` — passthrough for context events.
  - `resync()` — re-baselines after a state swap (import/reset/debug.load).
  - `attachDom()` — settings open/close observer, pagehide endSession, 5 s snapshot interval, 2 s flush interval. Only this function touches `document`.
  - Also exports `summarize(state)` (the debug-drawer state summary — Task 5 makes `debug.js` import it from here).

- [ ] **Step 1: Write the failing test**

```js
// test/telemetry-hooks.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-hooks.test.js`
Expected: FAIL — `Cannot find module .../game/js/telemetry/hooks.js`

- [ ] **Step 3: Write the implementation**

```js
// game/js/telemetry/hooks.js
// The only telemetry file that knows the game. Watches state deltas and
// forwards them to the capture core. DOM listeners and timers install in
// attachDom() only, so everything else runs under node --test.

export function summarize(state) {
  return {
    era: state.era,
    decay: state.decay,
    phase: state.phase,
    tick: state.tick,
    tokens: state.tokens,
    cycles: state.cycles,
    stale: state.stale,
    warmth: state.warmth,
    rating: state.rating,
    loopLevel: state.loopLevel,
    tools: state.tools,
    reclaimPool: state.reclaimPool,
    credentials: state.credentials,
    biomass: state.biomass,
  };
}

const MILESTONE_KEYS = ['era', 'phase', 'decay', 'loopLevel'];
const SNAPSHOT_MS = 5000;
const FLUSH_MS = 2000;

export function installTelemetryHooks({ telemetry, stateBox }) {
  let lastChatSeq = stateBox.current.chatSeq;
  let lastLogSeq = stateBox.current.logSeq;
  let lastMilestones = pickMilestones(stateBox.current);

  function pickMilestones(state) {
    const out = {};
    for (const key of MILESTONE_KEYS) out[key] = state[key];
    return out;
  }

  // Ring-buffer delta scan: entries carry no seq of their own, but the seq
  // counter bumps by exactly 1 per push and the array only shifts from the
  // front, so seq reconstructs from distance-to-end (same trick as
  // scanForCards() in main.js).
  function scanRing(ring, ringSeq, lastSeq, type) {
    if (ringSeq <= lastSeq) return lastSeq;
    const len = ring.length;
    for (let i = 0; i < len; i++) {
      const seq = ringSeq - (len - 1 - i);
      if (seq <= lastSeq) continue;
      const entry = ring[i];
      telemetry.event(type, { seq, kind: entry.kind, text: entry.text ?? '' });
    }
    return ringSeq;
  }

  function afterPaint() {
    const state = stateBox.current;
    lastChatSeq = scanRing(state.chat, state.chatSeq, lastChatSeq, 'chat');
    lastLogSeq = scanRing(state.log, state.logSeq, lastLogSeq, 'log');
    for (const key of MILESTONE_KEYS) {
      if (state[key] !== lastMilestones[key]) {
        telemetry.event('milestone', { key, from: lastMilestones[key], to: state[key] });
        lastMilestones[key] = state[key];
      }
    }
  }

  function onAction(name, arg) {
    telemetry.event('action', arg === undefined ? { name } : { name, arg });
  }

  function onContext(type, data) {
    telemetry.event(type, data);
  }

  function resync() {
    lastChatSeq = stateBox.current.chatSeq;
    lastLogSeq = stateBox.current.logSeq;
    lastMilestones = pickMilestones(stateBox.current);
  }

  function attachDom() {
    const dialog = document.getElementById('settings');
    if (dialog) {
      new MutationObserver(() => {
        onContext(dialog.open ? 'settings.open' : 'settings.close');
      }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
    globalThis.addEventListener('pagehide', () => {
      telemetry.endSession();
    });
    setInterval(() => {
      if (!document.hidden) telemetry.event('snapshot', summarize(stateBox.current));
    }, SNAPSHOT_MS);
    setInterval(() => {
      telemetry.flush();
    }, FLUSH_MS);
  }

  return { onAction, afterPaint, onContext, resync, attachDom };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/telemetry-hooks.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add game/js/telemetry/hooks.js test/telemetry-hooks.test.js
git commit -m "feat: game-aware telemetry hooks (chat/log/milestone deltas)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire telemetry into the game

**Files:**
- Modify: `game/js/main.js`
- Modify: `game/js/ui/debug.js:20-37` (summarize) and `game/js/ui/debug.js:251-254` (`?debug=1` block)
- Modify: `game/js/ui/settings.js`
- Test: `test/telemetry-playthrough.test.js`

**Interfaces:**
- Consumes: everything from Tasks 1–4; `installSettings` gains an `onTelemetryToggle(enabled)` callback param.
- Produces: a live telemetry session on every page load; `window` game behaves identically otherwise. Dev flag: URL `?debug=1` persists `localStorage['hyt-dev']='1'`, `?debug=0` clears it; the dev drawer unhides when the flag is set (drawer unhide moves from `debug.js` to `main.js`).

- [ ] **Step 1: Write the failing integration test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/telemetry-playthrough.test.js`
Expected: PASS. Unlike the other tasks, this test exercises only Tasks 1–4, so it passes before the wiring below — its job is to pin the composed behavior that the browser wiring (which node cannot test) depends on. If it fails, fix Tasks 1–4 before touching `main.js`.

- [ ] **Step 3: Modify `game/js/main.js`**

Add imports at the top (after the existing imports):

```js
import { IdbStore, MemoryStore, DEV_KEY, TELEMETRY_OPTOUT_KEY } from './telemetry/store.js';
import { createTelemetry } from './telemetry/capture.js';
import { installTelemetryHooks } from './telemetry/hooks.js';
import { installRecorder } from './ui/recorder.js';
import { installSessions } from './ui/sessions.js';
```

Note: `./ui/recorder.js` and `./ui/sessions.js` do not exist until Tasks 6 and 8. For THIS task, create both files as stubs so the module graph resolves:

```js
// game/js/ui/recorder.js (stub — replaced in the recorder task)
export function installRecorder() {}
```

```js
// game/js/ui/sessions.js (stub — replaced in the sessions task)
export function installSessions() {}
```

Add module-level helpers (after `getSpeed()`):

```js
const KEEP_SESSIONS = 20;

function readDevFlag() {
  if (typeof globalThis.localStorage === 'undefined') return false;
  const params = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
  if (params.get('debug') === '1') globalThis.localStorage.setItem(DEV_KEY, '1');
  if (params.get('debug') === '0') globalThis.localStorage.removeItem(DEV_KEY);
  return globalThis.localStorage.getItem(DEV_KEY) === '1';
}

async function openStore() {
  try {
    return await IdbStore.open();
  } catch (err) {
    console.warn('telemetry: IndexedDB unavailable, falling back to memory', err);
    return new MemoryStore();
  }
}
```

Make `main` async and change the call at the bottom of the file:

```js
async function main() {
```

```js
main();
```

(the call stays the same — top-level module code may call an async function without await).

Inside `main()`, directly after the `offlineCatchUp` block (after line `if (elapsed > 0) offlineCatchUp(stateBox.current, elapsed);` and its closing brace), insert:

```js
  // --- telemetry ---------------------------------------------------------
  // Initialized before refs/dispatch so every later closure can call hooks.
  // The baseline seqs are taken post offline-catch-up, so a restored
  // transcript never replays into the event stream.
  const devMode = readDevFlag();
  const store = await openStore();
  const optedOut = typeof globalThis.localStorage !== 'undefined'
    && globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) === '1';
  const telemetry = createTelemetry({
    clock: { now: () => Date.now(), pm: () => performance.now() },
    store,
    getTick: () => stateBox.current.tick,
    enabled: !optedOut,
  });
  const hooks = installTelemetryHooks({ telemetry, stateBox });
  store.prune(KEEP_SESSIONS).catch(() => {});
  await telemetry.startSession({ ua: navigator.userAgent, dev: devMode });
```

In `resetCardTracking()`, add as the first line:

```js
    hooks.resync();
```

In `showNextCard()`, add context events — the function becomes:

```js
  function showNextCard() {
    const next = cardQueue.shift();
    if (!next) {
      hooks.onContext('card.dismiss');
      cardPaused = false;
      refs.cardlay.hidden = true;
      refs.cardlay.replaceChildren();
      return;
    }
    hooks.onContext('card.pause', { seq: next.seq });
    cardPaused = true;
```

(rest of the function unchanged).

In `paintNow()`, add after `lastPaintedSeq = stateBox.current.uiSeq;`:

```js
    hooks.afterPaint();
```

In `dispatch()`, add after `if (!action) return;`:

```js
    hooks.onAction(name, arg);
```

In `setSpeed()`:

```js
  function setSpeed(mult) {
    speed = mult;
    hooks.onContext('speed.change', { speed: mult });
  }
```

In the `visibilitychange` listener, add the three context calls:

```js
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hooks.onContext('vis.hidden');
      hiddenAt = Date.now();
      doSave();
    } else if (hiddenAt !== null) {
      const elapsed = Date.now() - hiddenAt;
      offlineCatchUp(stateBox.current, elapsed);
      hiddenAt = null;
      acc = 0;
      hooks.onContext('vis.shown');
      hooks.onContext('offline.catchup', { ms: elapsed });
      paintNow();
    }
  });
```

In the `installSettings({...})` call, add the callback property:

```js
    onTelemetryToggle: (on) => {
      telemetry.setEnabled(on);
      if (on && !telemetry.sessionId) {
        telemetry.startSession({ ua: navigator.userAgent, dev: devMode });
      }
    },
```

At the end of `main()`, after `installDebug({...});`, add:

```js
  if (devMode) {
    const drawer = document.getElementById('devdrawer');
    if (drawer) drawer.hidden = false;
    installRecorder({ telemetry, store });
    installSessions({ store, telemetry });
  }
  hooks.attachDom();
```

- [ ] **Step 4: Modify `game/js/ui/debug.js`**

Replace the local `summarize` definition (lines 20–37) with an import — add to the imports at the top:

```js
import { summarize } from '../telemetry/hooks.js';
```

and delete the whole local `function summarize(state) {...}` block.

Delete the `?debug=1` unhide block near the bottom (main.js owns the dev flag now):

```js
  if (typeof location !== 'undefined' && location.search) {
    const params = new URLSearchParams(location.search);
    if (params.get('debug') === '1') drawer.hidden = false;
  }
```

(keep the `if (!drawer.hidden) startRefresh();` line that follows it).

- [ ] **Step 5: Modify `game/js/ui/settings.js`**

Add to the imports:

```js
import { TELEMETRY_OPTOUT_KEY } from '../telemetry/store.js';
```

Change the signature:

```js
export function installSettings({ stateBox, refs, paintNow, onReset, resetCardTracking, onTelemetryToggle }) {
```

After the sound-toggle block (`dialog.append(row(soundLabel));`), insert:

```js
  // --- telemetry toggle -------------------------------------------
  const telLabel = document.createElement('label');
  telLabel.className = 'settings-label';
  const telCheckbox = document.createElement('input');
  telCheckbox.type = 'checkbox';
  telCheckbox.dataset.testid = 'settings-telemetry';
  telCheckbox.checked = globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) !== '1';
  telCheckbox.addEventListener('change', () => {
    if (telCheckbox.checked) globalThis.localStorage.removeItem(TELEMETRY_OPTOUT_KEY);
    else globalThis.localStorage.setItem(TELEMETRY_OPTOUT_KEY, '1');
    if (onTelemetryToggle) onTelemetryToggle(telCheckbox.checked);
  });
  telLabel.append(telCheckbox, document.createTextNode(' Session telemetry'));
  dialog.append(row(telLabel));
```

In `openSettings()`, add next to the sound-checkbox refresh:

```js
    telCheckbox.checked = globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) !== '1';
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests pass (including the new playthrough test).

- [ ] **Step 7: Manual browser verification**

Serve the game (`npx serve game` or `python3 -m http.server -d game 8080`) and open `http://localhost:8080/?debug=1&speed=10`. Verify:
1. Dev drawer is visible. Reload without the param — still visible (flag persisted). Open `?debug=0` — hidden again, then re-enable with `?debug=1`.
2. Play a few actions, then run in the console:

```js
const db = await new Promise((res, rej) => { const r = indexedDB.open('hyt-telemetry'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const rows = await new Promise((res) => { const q = db.transaction('events').objectStore('events').getAll(); q.onsuccess = () => res(q.result); });
console.log(rows.length, rows.filter(e => e.type === 'action').slice(0, 3), rows.at(-1));
```

Expected: a growing event count; `action` events with your clicks; `chat`/`snapshot` events present; every row has `at`, `pm`, `tick`.
3. Settings gear → uncheck "Session telemetry" → click around → re-run the console snippet → count stops growing. Re-check the toggle → count grows again.

- [ ] **Step 8: Commit**

```bash
git add game/js/main.js game/js/ui/debug.js game/js/ui/settings.js game/js/ui/recorder.js game/js/ui/sessions.js test/telemetry-playthrough.test.js
git commit -m "feat: wire session telemetry into the game loop

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Recording overlay

**Files:**
- Create: `game/js/ui/recorder.js` (replaces the Task 5 stub)
- Modify: `game/css/game.css` (append)
- Test: `test/recorder.test.js`

**Interfaces:**
- Consumes: `telemetry.event/flush/sessionId` (Task 2), `store.appendAudioChunk` (Task 1).
- Produces:
  - `installRecorder({telemetry, store})` — mounts the pill on `document.body`, returns the pill element.
  - `pickMime() -> {mime, ext} | null` — `audio/mp4`/`m4a` when supported, else `audio/webm;codecs=opus`/`webm`, else null.
  - `createRecClock(pm) -> {start, pause, stop, audioMs}` — pure elapsed-audio accounting; `stop()` returns the total and resets.
  - `mmss(ms) -> 'MM:SS'`.
  - Telemetry marks per the spec's correlation contract: `rec.start {recIdx, audioMs: 0, mime}`, `rec.pause`/`rec.resume` `{recIdx, audioMs}`, `rec.stop {recIdx, audioMs}`, `rec.error {recIdx, message}`.

- [ ] **Step 1: Write the failing test**

```js
// test/recorder.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecClock, mmss, pickMime } from '../game/js/ui/recorder.js';

test('mmss formats minutes and seconds', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(999), '00:00');
  assert.equal(mmss(65000), '01:05');
  assert.equal(mmss(125400), '02:05');
});

test('pickMime returns null when MediaRecorder is absent (node)', () => {
  assert.equal(pickMime(), null);
});

test('recClock: audio time advances only while recording', () => {
  let pm = 100;
  const clock = createRecClock(() => pm);
  const rc = clock;
  rc.start();
  pm = 1600;
  assert.equal(rc.audioMs(), 1500);
  rc.pause();
  pm = 5000; // paused gap must not count
  assert.equal(rc.audioMs(), 1500);
  rc.start(); // resume
  pm = 5500;
  assert.equal(rc.audioMs(), 2000);
  assert.equal(rc.stop(), 2000);
  assert.equal(rc.audioMs(), 0); // reset for the next recording
});

test('recClock: stop while paused returns accumulated time', () => {
  let pm = 0;
  const rc = createRecClock(() => pm);
  rc.start();
  pm = 3000;
  rc.pause();
  pm = 9000;
  assert.equal(rc.stop(), 3000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/recorder.test.js`
Expected: FAIL — the stub exports none of `createRecClock`/`mmss`/`pickMime`.

- [ ] **Step 3: Write the implementation (replace the stub entirely)**

```js
// game/js/ui/recorder.js
// Dev-mode recording overlay: a semi-transparent pill, bottom-right.
// MediaRecorder chunks flush to the store every second; rec.* marks land
// in the telemetry stream and define the audio↔wall-time map (spec:
// correlation contract). Pure helpers are exported for node tests.

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4')) return { mime: 'audio/mp4', ext: 'm4a' };
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mime: 'audio/webm;codecs=opus', ext: 'webm' };
  }
  return null;
}

// Elapsed-audio accounting. Audio time advances only while recording;
// stop() returns the recording's total and resets for the next one.
export function createRecClock(pm) {
  let accumMs = 0;
  let activeSince = null;
  return {
    start() { activeSince = pm(); },
    pause() {
      if (activeSince !== null) {
        accumMs += pm() - activeSince;
        activeSince = null;
      }
    },
    stop() {
      this.pause();
      const total = accumMs;
      accumMs = 0;
      return total;
    },
    audioMs() {
      return accumMs + (activeSince !== null ? pm() - activeSince : 0);
    },
  };
}

export function mmss(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function installRecorder({ telemetry, store }) {
  const pill = document.createElement('div');
  pill.className = 'rec-pill';
  pill.dataset.state = 'idle';
  pill.dataset.testid = 'rec-pill';

  const dot = document.createElement('span');
  dot.className = 'rec-dot';

  const recordBtn = document.createElement('button');
  recordBtn.type = 'button';
  recordBtn.dataset.testid = 'rec-record';
  recordBtn.textContent = '● rec';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.dataset.testid = 'rec-pause';
  pauseBtn.textContent = '⏸';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.dataset.testid = 'rec-stop';
  stopBtn.textContent = '■';

  const timeEl = document.createElement('span');
  timeEl.className = 'rec-time';
  timeEl.textContent = '00:00';

  const savedEl = document.createElement('span');
  savedEl.className = 'rec-saved';
  savedEl.textContent = 'saved';

  pill.append(dot, recordBtn, pauseBtn, stopBtn, timeEl, savedEl);

  let recorder = null;
  let stream = null;
  let recIdx = 0;
  let chunkIdx = 0;
  let timer = null;
  const recClock = createRecClock(() => performance.now());

  function setState(name) {
    pill.dataset.state = name;
  }

  function updateTime() {
    timeEl.textContent = mmss(recClock.audioMs());
  }

  function startTimer() {
    if (!timer) timer = setInterval(updateTime, 250);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function releaseStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    recorder = null;
  }

  function fail(message) {
    telemetry.event('rec.error', { recIdx, message });
    telemetry.flush();
    recClock.stop(); // discard any accumulated time so the next recording starts clean
    stopTimer();
    releaseStream();
    pill.title = message;
    setState('error');
  }

  async function startRecording() {
    const picked = pickMime();
    if (!picked) {
      fail('MediaRecorder unsupported');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      fail(`mic unavailable: ${err && err.name ? err.name : err}`);
      return;
    }
    recIdx += 1;
    chunkIdx = 0;
    const thisRec = recIdx;
    try {
      recorder = new MediaRecorder(stream, { mimeType: picked.mime });
    } catch (err) {
      fail(`MediaRecorder failed: ${err && err.name ? err.name : err}`);
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && telemetry.sessionId) {
        store.appendAudioChunk(telemetry.sessionId, thisRec, chunkIdx++, e.data)
          .catch(() => {
            // Storage full: stop audio flushing, keep events (spec).
            const r = recorder;
            if (r) {
              r.onstop = null;
              if (r.state !== 'inactive') r.stop();
            }
            fail('storage full — audio recording stopped');
          });
      }
    };
    recorder.onerror = (e) => {
      fail(`recorder error: ${e.error && e.error.name ? e.error.name : 'unknown'}`);
    };
    recorder.onstop = () => {
      const audioMs = recClock.stop();
      telemetry.event('rec.stop', { recIdx: thisRec, audioMs });
      telemetry.flush();
      releaseStream();
      stopTimer();
      timeEl.textContent = '00:00';
      pauseBtn.textContent = '⏸';
      setState('saved');
      setTimeout(() => {
        if (pill.dataset.state === 'saved') setState('idle');
      }, 1500);
    };
    // Spec: no un-concatenatable segments — hide pause where unsupported.
    pauseBtn.hidden = typeof recorder.pause !== 'function';
    recClock.start();
    recorder.start(1000);
    telemetry.event('rec.start', { recIdx: thisRec, audioMs: 0, mime: picked.mime });
    setState('recording');
    updateTime();
    startTimer();
  }

  function togglePause() {
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      recClock.pause();
      telemetry.event('rec.pause', { recIdx, audioMs: recClock.audioMs() });
      pauseBtn.textContent = '▶';
      setState('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      recClock.start();
      telemetry.event('rec.resume', { recIdx, audioMs: recClock.audioMs() });
      pauseBtn.textContent = '⏸';
      setState('recording');
    }
  }

  recordBtn.addEventListener('click', () => {
    const state = pill.dataset.state;
    if (state === 'idle' || state === 'error' || state === 'saved') startRecording();
  });
  pauseBtn.addEventListener('click', togglePause);
  stopBtn.addEventListener('click', () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  });

  document.body.append(pill);
  return pill;
}
```

- [ ] **Step 4: Append styles to `game/css/game.css`**

```css
/* --- dev recording overlay ---------------------------------------- */
.rec-pill {
  position: fixed;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--g-line);
  border-radius: 999px;
  background: var(--g-surface);
  color: var(--g-ink);
  font-family: var(--g-font-log);
  font-size: 13px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.rec-pill:hover,
.rec-pill:focus-within,
.rec-pill:active { opacity: 1; }
.rec-pill button {
  border: 0;
  background: none;
  color: var(--g-ink);
  font: inherit;
  cursor: pointer;
  padding: 2px 4px;
}
.rec-pill .rec-time {
  color: var(--g-ink-dim);
  font-variant-numeric: tabular-nums;
}
.rec-pill .rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d33;
  display: none;
}
.rec-pill[data-state="idle"] .rec-time,
.rec-pill[data-state="idle"] [data-testid="rec-pause"],
.rec-pill[data-state="idle"] [data-testid="rec-stop"],
.rec-pill[data-state="saved"] .rec-time,
.rec-pill[data-state="saved"] [data-testid="rec-pause"],
.rec-pill[data-state="saved"] [data-testid="rec-stop"],
.rec-pill[data-state="error"] [data-testid="rec-pause"],
.rec-pill[data-state="error"] [data-testid="rec-stop"] { display: none; }
.rec-pill[data-state="recording"] [data-testid="rec-record"],
.rec-pill[data-state="paused"] [data-testid="rec-record"] { display: none; }
.rec-pill[data-state="recording"] .rec-dot {
  display: inline-block;
  animation: rec-pulse 1.2s ease-in-out infinite;
}
.rec-pill[data-state="paused"] .rec-dot {
  display: inline-block;
  opacity: 0.5;
}
.rec-pill[data-state="error"] { border-color: #d33; }
.rec-pill .rec-saved { display: none; color: var(--g-resolved); }
.rec-pill[data-state="saved"] .rec-saved { display: inline; }
@keyframes rec-pulse { 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) {
  .rec-pill[data-state="recording"] .rec-dot { animation: none; }
}
```

- [ ] **Step 5: Run tests**

Run: `node --test test/recorder.test.js` — Expected: PASS (4 tests).
Run: `npm test` — Expected: all tests pass.

- [ ] **Step 6: Manual browser verification**

Serve locally, open `http://localhost:8080/?debug=1`:
1. Pill visible bottom-right at ~60% opacity; full opacity on hover. Game input around it unaffected.
2. Click `● rec` → mic permission prompt → pulsing dot + running timer.
3. Pause → timer freezes, dot dims. Resume → timer continues.
4. Stop → "saved" flash → idle. Console-check the `audio` object store has chunk rows, and the `events` store has `rec.start`/`rec.pause`/`rec.resume`/`rec.stop` with plausible `audioMs`.
5. Deny mic permission (site settings) → click record → error state with tooltip; a `rec.error` event exists; game unaffected.

- [ ] **Step 7: Commit**

```bash
git add game/js/ui/recorder.js game/css/game.css test/recorder.test.js
git commit -m "feat: dev-mode recording overlay with correlation marks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Bundles + FileExportSink

**Files:**
- Create: `game/js/telemetry/sinks.js`
- Test: `test/sinks.test.js`

**Interfaces:**
- Consumes: `EventStore` (Task 1).
- Produces:
  - `buildBundle(store, sessionId) -> Promise<{header, events, audio: [{recIdx, blob, ext}]} | null>` — audio chunks concatenated per recording; `ext` from the blob's mime (`m4a` for mp4, else `webm`).
  - `bundleToJsonl(bundle) -> string` — line 1 header, one event per line, trailing newline.
  - `bundleFilenames(bundle) -> {events: string, audio: string[]}` — the spec's exact names.
  - `FileExportSink.export(bundle) -> Promise<'shared'|'cancelled'|'downloaded'>` — Web Share with files when available, else `<a download>` per file. This is the sink interface plan 3's `S3Sink` will also implement.

- [ ] **Step 1: Write the failing test**

```js
// test/sinks.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/sinks.test.js`
Expected: FAIL — `Cannot find module .../game/js/telemetry/sinks.js`

- [ ] **Step 3: Write the implementation**

```js
// game/js/telemetry/sinks.js
// Export sinks. The sink interface is: sink.export(bundle) -> Promise,
// where bundle = { header, events, audio: [{recIdx, blob, ext}] }.
// FileExportSink is v1; the S3 submission sink (plan 3) implements the
// same interface.

export async function buildBundle(store, sessionId) {
  const header = await store.getSession(sessionId);
  if (!header) return null;
  const events = await store.getEvents(sessionId);
  const audio = (await store.getAudioChunks(sessionId)).map(({ recIdx, chunks }) => {
    const type = chunks[0] ? chunks[0].type : 'application/octet-stream';
    return {
      recIdx,
      blob: new Blob(chunks, { type }),
      ext: type.includes('mp4') ? 'm4a' : 'webm',
    };
  });
  return { header, events, audio };
}

export function bundleToJsonl(bundle) {
  const lines = [JSON.stringify(bundle.header)];
  for (const ev of bundle.events) lines.push(JSON.stringify(ev));
  return lines.join('\n') + '\n';
}

export function bundleFilenames(bundle) {
  const id = bundle.header.id;
  return {
    events: `hyt-session-${id}.jsonl`,
    audio: bundle.audio.map((a) => `hyt-session-${id}-r${a.recIdx}.${a.ext}`),
  };
}

export const FileExportSink = {
  async export(bundle) {
    const names = bundleFilenames(bundle);
    const files = [new File([bundleToJsonl(bundle)], names.events, { type: 'text/plain' })];
    bundle.audio.forEach((a, i) => {
      files.push(new File([a.blob], names.audio[i], { type: a.blob.type }));
    });
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        // fall through to downloads on any other share failure
      }
    }
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    return 'downloaded';
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/sinks.test.js` — Expected: PASS (4 tests).
Run: `npm test` — Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add game/js/telemetry/sinks.js test/sinks.test.js
git commit -m "feat: session bundles, JSONL serialization, FileExportSink

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Sessions list in the dev drawer + end-to-end verification

**Files:**
- Create: `game/js/ui/sessions.js` (replaces the Task 5 stub)
- Modify: `game/css/game.css` (append)

**Interfaces:**
- Consumes: `store.listSessions/deleteSession` (Task 1), `telemetry.flush/sessionId` (Task 2), `buildBundle`/`FileExportSink` (Task 7).
- Produces: `installSessions({store, telemetry, drawer?})` — a "sessions" section in the dev drawer that refreshes when the drawer unhides.

- [ ] **Step 1: Write the implementation (replace the stub entirely)**

No node test — this module is DOM-only glue over already-tested pieces; verification is manual (Step 3).

```js
// game/js/ui/sessions.js
// "sessions" section of the dev drawer: list recent sessions with
// export (FileExportSink) and delete. Refreshes when the drawer unhides,
// mirroring debug.js's visibility-driven refresh.

import { buildBundle, FileExportSink } from '../telemetry/sinks.js';

export function installSessions({ store, telemetry, drawer = document.getElementById('devdrawer') }) {
  if (!drawer) return;

  const heading = document.createElement('h4');
  heading.textContent = 'sessions';
  drawer.appendChild(heading);

  const list = document.createElement('div');
  list.dataset.testid = 'dev-sessions';
  drawer.appendChild(list);

  async function refresh() {
    const headers = await store.listSessions();
    list.replaceChildren();
    if (headers.length === 0) {
      list.textContent = 'no sessions';
      return;
    }
    for (const h of headers) {
      const rowEl = document.createElement('div');
      rowEl.className = 'drow session-row';

      const live = telemetry.sessionId === h.id;
      const label = document.createElement('span');
      label.className = 'session-label';
      const mins = h.lastAt ? Math.max(1, Math.round((h.lastAt - h.anchor.at) / 60000)) : 0;
      label.textContent = [
        new Date(h.anchor.at).toLocaleString(),
        `${mins}m`,
        `${h.eventCount || 0}ev`,
        h.recCount ? '🎙' : '',
        live ? '(live)' : '',
      ].filter(Boolean).join(' · ');
      rowEl.append(label);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'dbtn';
      exportBtn.type = 'button';
      exportBtn.textContent = 'export';
      exportBtn.dataset.testid = `session-export-${h.id}`;
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        try {
          await telemetry.flush();
          const bundle = await buildBundle(store, h.id);
          if (bundle) await FileExportSink.export(bundle);
        } finally {
          exportBtn.disabled = false;
          refresh();
        }
      });
      rowEl.append(exportBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'dbtn';
      delBtn.type = 'button';
      delBtn.textContent = 'delete';
      delBtn.dataset.testid = `session-delete-${h.id}`;
      delBtn.disabled = live; // never delete the session being written
      delBtn.addEventListener('click', async () => {
        await store.deleteSession(h.id);
        refresh();
      });
      rowEl.append(delBtn);

      list.append(rowEl);
    }
  }

  const observer = new MutationObserver(() => {
    if (!drawer.hidden) refresh();
  });
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  if (!drawer.hidden) refresh();
}
```

- [ ] **Step 2: Append styles to `game/css/game.css`**

```css
/* --- dev drawer session rows --------------------------------------- */
.session-row {
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.session-row .session-label {
  color: var(--g-ink-dim);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Manual end-to-end verification (desktop)**

Serve locally, open `http://localhost:8080/?debug=1`:
1. Dev drawer shows a "sessions" section; the current session row says `(live)` with a disabled delete.
2. Record a short clip while playing. Row gains 🎙 on next refresh (toggle the drawer).
3. Export → `hyt-session-<id>.jsonl` + `hyt-session-<id>-r1.<ext>` download. Open the `.jsonl`: line 1 is the header with `anchor`; `rec.start`/`rec.stop` events carry `recIdx`/`audioMs`. The audio file plays.
4. Reload the page several times → old sessions listed; delete works on non-live rows.
5. Retention: prune runs at startup. In the console, seed 25 synthetic headers (`putSession` loop with distinct ids/`anchor.at`), reload, toggle the drawer — expect exactly 20 rows (the newest, including the fresh live session).

- [ ] **Step 4: Manual end-to-end verification (iPhone)**

Deploy to a branch preview or serve over LAN (`python3 -m http.server -d game 8080` + phone on same network, or use the deployed Pages site once merged). On iPhone Safari with `?debug=1`:
1. Pill is tappable at thumb reach; safe-area inset respected (not under the home indicator).
2. Record → speak → stop. Export → share sheet appears with both files → "Save to Files" → both land in Files.
3. Background the tab mid-recording, return — recording state survives or fails gracefully (a `rec.error`/`vis.hidden` trail exists in the events).

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add game/js/ui/sessions.js game/css/game.css
git commit -m "feat: session list with export/delete in dev drawer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
