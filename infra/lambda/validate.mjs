// Pure grant validation for the submission broker. No AWS, no I/O — this
// module is unit-tested by the repo suite (test/broker-validate.test.js)
// and imported by broker.mjs inside the Lambda zip.
//
// The server, never the client, constructs the object key
// (spec: broker contract).

import { createHash, timingSafeEqual } from 'node:crypto';

export const JSONL_MAX_BYTES = 25 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 200 * 1024 * 1024;

const SESSION_ID_RE = /^\d{13}-[a-z0-9]{4}$/;
const JSONL_TYPES = ['text/plain', 'application/x-ndjson'];
const AUDIO_TYPES = { m4a: 'audio/mp4', webm: 'audio/webm' };

function refuse(status, reason) {
  return { ok: false, status, reason };
}

function tokenMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || b.length === 0) return false;
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function validateGrant(body, { expectedToken, date = new Date() }) {
  if (expectedToken === undefined || expectedToken === null) return refuse(503, 'submissions disabled');
  if (!body || typeof body !== 'object') return refuse(400, 'bad request');
  const { token, sessionId, filename, size, contentType } = body;
  if (!tokenMatches(token, expectedToken)) return refuse(403, 'bad token');
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
    return refuse(400, 'bad session id');
  }
  // sessionId is regex-clean ([0-9a-z-] only), safe to interpolate.
  const filenameRe = new RegExp(`^hyt-session-${sessionId}(\\.jsonl|-r\\d+\\.(m4a|webm))$`);
  if (typeof filename !== 'string' || !filenameRe.test(filename)) {
    return refuse(400, 'bad filename');
  }
  const isJsonl = filename.endsWith('.jsonl');
  const maxBytes = isJsonl ? JSONL_MAX_BYTES : AUDIO_MAX_BYTES;
  if (isJsonl) {
    if (!JSONL_TYPES.includes(contentType)) return refuse(415, 'bad content type');
  } else {
    const ext = filename.slice(filename.lastIndexOf('.') + 1);
    if (contentType !== AUDIO_TYPES[ext]) return refuse(415, 'bad content type');
  }
  if (!Number.isInteger(size) || size < 1 || size > maxBytes) {
    return refuse(413, 'bad size');
  }
  const day = date.toISOString().slice(0, 10);
  return {
    ok: true,
    key: `submissions/${day}/${sessionId}/${filename}`,
    maxBytes,
    contentType,
  };
}
