import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseArgs, groupKeysBySession, keyBasename, resolveBucket, listSessions,
} from '../scripts/sessions.mjs';

test('parseArgs: list / pull / rm shapes', () => {
  assert.deepEqual(parseArgs(['list']), { cmd: 'list' });
  assert.deepEqual(parseArgs(['pull', '123', '--dest', '/tmp/x']),
    { cmd: 'pull', sessionId: '123', latest: false, dest: '/tmp/x' });
  assert.deepEqual(parseArgs(['pull', '--latest']),
    { cmd: 'pull', sessionId: null, latest: true, dest: '.' });
  assert.deepEqual(parseArgs(['rm', '123']),
    { cmd: 'rm', sessionId: '123', latest: false, dest: '.' });
});

test('parseArgs: refusals', () => {
  assert.throws(() => parseArgs(['pull']), /pull needs/);
  assert.throws(() => parseArgs(['rm', '--latest']), /rm needs an explicit/);
  assert.throws(() => parseArgs(['rm']), /rm needs an explicit/);
  assert.throws(() => parseArgs(['pull', '123', '--dest']), /--dest needs/);
  assert.throws(() => parseArgs(['pull', 'a', 'b']), /unexpected argument/);
  assert.throws(() => parseArgs(['frobnicate']), /usage/);
  assert.throws(() => parseArgs([]), /usage/);
});

test('groupKeysBySession: groups, sorts newest first, skips malformed', () => {
  const sessions = groupKeysBySession([
    'submissions/2026-08-05/1786000000000-aaaa/hyt-session-1786000000000-aaaa.jsonl',
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl',
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j-r1.m4a',
    'submissions/oops',
    'other/2026-08-06/x/y.jsonl',
  ]);
  assert.deepEqual(sessions.map((s) => s.sessionId),
    ['1786061130678-nx1j', '1786000000000-aaaa']);
  assert.equal(sessions[0].keys.length, 2);
  assert.equal(sessions[0].date, '2026-08-06');
});

test('keyBasename strips the prefix', () => {
  assert.equal(
    keyBasename('submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl'),
    'hyt-session-1786061130678-nx1j.jsonl',
  );
});

test('resolveBucket: env override wins; outputs file read; clear error when absent', () => {
  assert.equal(resolveBucket({ env: { HYT_BUCKET: 'from-env' } }), 'from-env');
  const dir = mkdtempSync(join(tmpdir(), 'hyt-outputs-'));
  const outputsPath = join(dir, 'outputs.json');
  writeFileSync(outputsPath, JSON.stringify({ bucket: 'from-file' }));
  assert.equal(resolveBucket({ env: {}, outputsPath }), 'from-file');
  assert.throws(() => resolveBucket({ env: {}, outputsPath: join(dir, 'missing.json') }),
    /no bucket configured/);
});

test('listSessions shells the aws CLI with the analyst profile', () => {
  const invocations = [];
  const runner = (cmd, args) => {
    invocations.push({ cmd, args });
    return JSON.stringify({
      Contents: [
        { Key: 'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl' },
      ],
    });
  };
  const sessions = listSessions('my-bucket', { runner });
  assert.equal(sessions.length, 1);
  assert.equal(invocations[0].cmd, 'aws');
  assert.deepEqual(invocations[0].args, [
    's3api', 'list-objects-v2',
    '--bucket', 'my-bucket',
    '--prefix', 'submissions/',
    '--output', 'json',
    '--profile', 'hyt-analyst',
  ]);
});

test('listSessions tolerates an empty bucket', () => {
  const runner = () => JSON.stringify({});
  assert.deepEqual(listSessions('b', { runner }), []);
});
