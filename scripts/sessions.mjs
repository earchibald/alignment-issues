#!/usr/bin/env node
// scripts/sessions.mjs — work with the S3 submissions bucket through the
// aws CLI (profile hyt-analyst). Zero dependencies.
//
// usage:
//   node scripts/sessions.mjs list
//   node scripts/sessions.mjs pull <sessionId> [--dest <dir>]
//   node scripts/sessions.mjs pull --latest [--dest <dir>]
//   node scripts/sessions.mjs rm <sessionId>
//
// The bucket comes from infra/outputs.json (written by ./infra/run.sh) or
// the HYT_BUCKET env var. Setup: docs/operations/s3-submissions-setup.md

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const PROFILE = 'hyt-analyst';
const PREFIX = 'submissions/';
const USAGE = 'usage: sessions.mjs list | pull <sessionId>|--latest [--dest <dir>] | rm <sessionId>';

export function resolveBucket({ env = process.env, outputsPath } = {}) {
  if (env.HYT_BUCKET) return env.HYT_BUCKET;
  const path = outputsPath ?? fileURLToPath(new URL('../infra/outputs.json', import.meta.url));
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error('no bucket configured: set HYT_BUCKET or run ./infra/run.sh outputs');
  }
  const outputs = JSON.parse(raw);
  if (!outputs.bucket) throw new Error('infra/outputs.json has no "bucket"');
  return outputs.bucket;
}

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'list' && rest.length === 0) return { cmd: 'list' };
  if (cmd === 'pull' || cmd === 'rm') {
    const out = { cmd, sessionId: null, latest: false, dest: '.' };
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === '--latest') out.latest = true;
      else if (arg === '--dest') {
        out.dest = rest[++i];
        if (!out.dest) throw new Error('--dest needs a directory');
      } else if (!out.sessionId) out.sessionId = arg;
      else throw new Error(`unexpected argument: ${arg}`);
    }
    if (cmd === 'rm' && (out.latest || !out.sessionId)) {
      throw new Error(`rm needs an explicit <sessionId> — ${USAGE}`);
    }
    if (cmd === 'pull' && !out.latest && !out.sessionId) {
      throw new Error(`pull needs <sessionId> or --latest — ${USAGE}`);
    }
    return out;
  }
  throw new Error(USAGE);
}

// Keys look like submissions/<yyyy-mm-dd>/<sessionId>/<filename>.
export function groupKeysBySession(keys) {
  const sessions = new Map();
  for (const key of keys) {
    const parts = key.split('/');
    if (parts.length !== 4 || parts[0] !== 'submissions') continue;
    const [, date, sessionId] = parts;
    if (!sessions.has(sessionId)) sessions.set(sessionId, { sessionId, date, keys: [] });
    sessions.get(sessionId).keys.push(key);
  }
  // Session ids start with epoch ms, so a lexicographic sort is newest-first.
  return [...sessions.values()].sort((a, b) => (a.sessionId < b.sessionId ? 1 : -1));
}

export function keyBasename(key) {
  return key.slice(key.lastIndexOf('/') + 1);
}

function awsCli(args, { runner = execFileSync } = {}) {
  return runner('aws', [...args, '--profile', PROFILE], { encoding: 'utf8' });
}

export function listSessions(bucket, { runner } = {}) {
  const out = awsCli(
    ['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', PREFIX, '--output', 'json'],
    { runner },
  );
  const parsed = JSON.parse(out || '{}');
  const keys = (parsed.Contents || []).map((c) => c.Key);
  return groupKeysBySession(keys);
}

function requireSession(sessions, sessionId, latest) {
  if (latest) {
    if (sessions.length === 0) throw new Error('no submissions found');
    return sessions[0];
  }
  const hit = sessions.find((s) => s.sessionId === sessionId);
  if (!hit) throw new Error(`session not found: ${sessionId}`);
  return hit;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const bucket = resolveBucket();
  const sessions = listSessions(bucket);
  if (opts.cmd === 'list') {
    if (sessions.length === 0) {
      console.log('no submissions');
      return;
    }
    for (const s of sessions) {
      const files = s.keys.map(keyBasename);
      const mic = files.some((f) => /-r\d+\.(m4a|webm)$/.test(f)) ? ' 🎙' : '';
      console.log(`${s.sessionId}  ${s.date}  ${files.length} file(s)${mic}`);
    }
    return;
  }
  const session = requireSession(sessions, opts.sessionId, opts.latest);
  if (opts.cmd === 'pull') {
    mkdirSync(opts.dest, { recursive: true });
    for (const key of session.keys) {
      const target = `${opts.dest}/${keyBasename(key)}`;
      awsCli(['s3', 'cp', `s3://${bucket}/${key}`, target]);
      console.log(`pulled ${target}`);
    }
    return;
  }
  // rm
  for (const key of session.keys) {
    awsCli(['s3', 'rm', `s3://${bucket}/${key}`]);
    console.log(`removed s3://${bucket}/${key}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  }
}
