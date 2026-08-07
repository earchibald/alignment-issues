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
    try {
      await store.putSession({ id: sessionId, anchor: { at, pm }, ...meta });
    } catch (err) {
      // Events without a header would be invisible to retention forever.
      sessionId = null;
      started = false;
      console.warn('telemetry: session header write failed, capture off', err);
      return null;
    }
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
