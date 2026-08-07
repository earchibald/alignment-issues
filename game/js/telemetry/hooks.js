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
