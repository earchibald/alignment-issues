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
