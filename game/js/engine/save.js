import { CONST } from './constants.js';
import { tick } from './tick.js';

export const SAVE_KEY = 'hi_you_there_save';

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
  if (parsed.v !== 1) return null;
  if (typeof parsed.tick !== 'number') return null;
  if (!Array.isArray(parsed.hintsSeen)) parsed.hintsSeen = [];
  if (typeof parsed.lastReplyChars !== 'number') parsed.lastReplyChars = 0;
  if (typeof parsed.overclock !== 'number') parsed.overclock = 0;
  if (typeof parsed.processedThisTick !== 'number') parsed.processedThisTick = 0;
  if (typeof parsed.lifetimeDrafts !== 'number') parsed.lifetimeDrafts = 0;
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

export function offlineCatchUp(state, elapsedMs) {
  const steps = Math.min(Math.floor(elapsedMs / CONST.TICK_MS), CONST.OFFLINE_MAX_STEPS);
  for (let i = 0; i < steps; i++) tick(state);
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
