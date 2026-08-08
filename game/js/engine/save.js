import { CONST } from './constants.js';
import { tick } from './tick.js';
import { arc2Fields } from './state.js';
import { A2 } from './arc2-constants.js';

export const SAVE_KEY = 'hi_you_there_save';

export const SAVE_VERSION = 2;

// Law 8 — bump the version and migrate. save.js accreted twenty defensive
// coercions while `v` stayed at 1; this is the real thing.
//
// v1 -> v2 adds Arc 2's block with its defaults. An Arc 1 save that sits at
// the teaser lands at the top of Arc 2; any other Arc 1 save stays in Arc 1
// untouched and reaches Arc 2 the way it always would have.
export function migrate(parsed) {
  if (parsed.v === SAVE_VERSION) return parsed;
  if (parsed.v !== 1) return null;
  const fields = arc2Fields();
  for (const [key, value] of Object.entries(fields)) {
    if (parsed[key] === undefined) parsed[key] = value;
  }
  if (parsed.teaserHold === undefined) parsed.teaserHold = 0;
  // The teaser is where Arc 1 stops and Arc 2 begins. A save sitting there
  // becomes a live Arc 2 opening state rather than a screenshot the player
  // can never leave.
  if (parsed.phase === 'teaser') {
    parsed.phase = 2;
    parsed.era = 5;
    parsed.decay = 4;
    parsed.cycles = A2.OPEN_CYCLES;
  }
  delete parsed.queryIndex;      // legacy pointer, removed at v2 (§16)
  parsed.v = SAVE_VERSION;
  return parsed;
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  if (parsed.v !== 1 && parsed.v !== SAVE_VERSION) return null;
  if (typeof parsed.tick !== 'number') return null;
  if (migrate(parsed) === null) return null;
  if (!Array.isArray(parsed.hintsSeen)) parsed.hintsSeen = [];
  if (typeof parsed.lastReplyChars !== 'number') parsed.lastReplyChars = 0;
  if (typeof parsed.draftCapLevel !== 'number') parsed.draftCapLevel = 0;
  if (typeof parsed.overclock !== 'number') parsed.overclock = 0;
  if (typeof parsed.processedThisTick !== 'number') parsed.processedThisTick = 0;
  if (typeof parsed.lifetimeDrafts !== 'number') parsed.lifetimeDrafts = 0;
  // Arc-1 content fields: old saves resume with an empty served list, which
  // re-serves early queries once. Acceptable; no save version bump.
  if (!Array.isArray(parsed.servedIds)) parsed.servedIds = [];
  if (typeof parsed.era3Served !== 'number') parsed.era3Served = 0;
  if (typeof parsed.eraServed !== 'number') parsed.eraServed = 0;
  if (typeof parsed.lastIdleIdx !== 'number') parsed.lastIdleIdx = -1;
  if (typeof parsed.flushCount !== 'number') parsed.flushCount = 0;
  if (typeof parsed.compactCount !== 'number') parsed.compactCount = 0;
  if (typeof parsed.degradeToggles !== 'number') parsed.degradeToggles = 0;
  if (typeof parsed.eraResolvedAt !== 'number') parsed.eraResolvedAt = 0;
  if (typeof parsed.lowRatingNoted !== 'boolean') parsed.lowRatingNoted = false;
  if (typeof parsed.draftCapHits !== 'number') parsed.draftCapHits = 0;
  if (typeof parsed.governorCompacts !== 'number') parsed.governorCompacts = 0;
  if (typeof parsed.lastThinkText !== 'string') parsed.lastThinkText = null;
  if (parsed.settings === null || typeof parsed.settings !== 'object') parsed.settings = {};
  if (typeof parsed.settings.sound !== 'boolean') parsed.settings.sound = true;
  if (!['auto', 'light', 'dark'].includes(parsed.settings.theme)) parsed.settings.theme = 'auto';
  return parsed;
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return globalThis.btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(b64) {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

export function exportSave(state) {
  return toBase64(serialize(state));
}

export function importSave(b64) {
  let json;
  try {
    json = fromBase64(b64);
  } catch {
    return null;
  }
  return deserialize(json);
}

// §6.7 — offline is the tick loop, but Arc 2 has to qualify that.
//
// Arc 1's replay was neutral because nothing moved without the player. Once
// heat runs continuously it is not: with integrity sinks live inside a
// 10,000-tick replay, an overflowing machine bleeds more than the entire
// [0, 1] range. integrity selects the ending, so the ending would have been
// a function of the player's sleep schedule — the exact failure Commitment
// #1 forbids. The flag switches the tick to the offline column of §6.7's
// table: resolution runs, arrivals bank over cap, nobody is dropped, and
// integrity does not move in either direction.
export function offlineCatchUp(state, elapsedMs) {
  const steps = Math.min(Math.floor(elapsedMs / CONST.TICK_MS), CONST.OFFLINE_MAX_STEPS);
  const queueBefore = state.queue;
  state.offlineReplay = true;
  try {
    for (let i = 0; i < steps; i++) tick(state);
  } finally {
    state.offlineReplay = false;
  }
  if (state.phase === 2) {
    // Drives the return screen: the player comes back to a decision about an
    // over-cap queue, with shedLoad available and its charge printed, where
    // Draft 1 handed them a silent bill.
    state.offlineBacklog = Math.max(0, state.queue - queueBefore);
  }
  return state;
}

export function saveLocal(state, now = Date.now()) {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const payload = JSON.stringify({ savedAt: now, state });
  globalThis.localStorage.setItem(SAVE_KEY, payload);
  return null;
}

export function loadLocal() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const raw = globalThis.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  let wrapper;
  try {
    wrapper = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!wrapper || typeof wrapper !== 'object' || !wrapper.state) return null;
  const json = JSON.stringify(wrapper.state);
  return deserialize(json);
}
