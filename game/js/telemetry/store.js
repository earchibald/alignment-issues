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
