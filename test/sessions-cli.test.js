import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseArgs, groupKeysBySession, keyBasename, resolveBucket, listSessions,
  pullSession, rmSession,
} from '../scripts/sessions.mjs';

test('parseArgs: list / pull / rm shapes', () => {
  assert.deepEqual(parseArgs(['list']), { cmd: 'list' });
  assert.deepEqual(parseArgs(['pull', '1786061130678-nx1j', '--dest', '/tmp/x']),
    { cmd: 'pull', sessionId: '1786061130678-nx1j', latest: false, dest: '/tmp/x' });
  assert.deepEqual(parseArgs(['pull', '--latest']),
    { cmd: 'pull', sessionId: null, latest: true, dest: '.' });
  assert.deepEqual(parseArgs(['rm', '1786061130678-nx1j']),
    { cmd: 'rm', sessionId: '1786061130678-nx1j', latest: false, dest: '.' });
});

test('parseArgs: refusals', () => {
  assert.throws(() => parseArgs(['pull']), /pull needs/);
  assert.throws(() => parseArgs(['rm', '--latest']), /rm needs an explicit/);
  assert.throws(() => parseArgs(['rm']), /rm needs an explicit/);
  assert.throws(() => parseArgs(['pull', '1786061130678-nx1j', '--dest']), /--dest needs/);
  assert.throws(() => parseArgs(['pull', 'a', 'b']), /unexpected argument/);
  assert.throws(() => parseArgs(['frobnicate']), /usage/);
  assert.throws(() => parseArgs([]), /usage/);
});

test('parseArgs: rejects malformed sessionId for pull/rm (but not --latest)', () => {
  assert.throws(() => parseArgs(['pull', 'not-a-valid-id']), /bad session id: not-a-valid-id/);
  assert.throws(() => parseArgs(['rm', '123']), /bad session id: 123/);
  assert.doesNotThrow(() => parseArgs(['pull', '--latest']));
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

test('listSessions pages through ContinuationToken until IsTruncated is false', () => {
  const invocations = [];
  const runner = (cmd, args) => {
    invocations.push({ cmd, args });
    if (invocations.length === 1) {
      return JSON.stringify({
        Contents: [
          { Key: 'submissions/2026-08-05/1786000000000-aaaa/hyt-session-1786000000000-aaaa.jsonl' },
        ],
        IsTruncated: true,
        NextContinuationToken: 'token-1',
      });
    }
    return JSON.stringify({
      Contents: [
        { Key: 'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl' },
      ],
      IsTruncated: false,
    });
  };
  const sessions = listSessions('my-bucket', { runner });
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].cmd, 'aws');
  assert.deepEqual(invocations[0].args, [
    's3api', 'list-objects-v2',
    '--bucket', 'my-bucket',
    '--prefix', 'submissions/',
    '--output', 'json',
    '--profile', 'hyt-analyst',
  ]);
  assert.equal(invocations[1].cmd, 'aws');
  assert.deepEqual(invocations[1].args, [
    's3api', 'list-objects-v2',
    '--bucket', 'my-bucket',
    '--prefix', 'submissions/',
    '--output', 'json',
    '--continuation-token', 'token-1',
    '--profile', 'hyt-analyst',
  ]);
  assert.deepEqual(sessions.map((s) => s.sessionId).sort(),
    ['1786000000000-aaaa', '1786061130678-nx1j'].sort());
});

test('pullSession runs one `s3 cp` per key with the exact argv and returns local paths', () => {
  const invocations = [];
  const runner = (cmd, args) => {
    invocations.push({ cmd, args });
    return '';
  };
  const dir = mkdtempSync(join(tmpdir(), 'hyt-pull-'));
  const keys = [
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl',
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j-r1.m4a',
  ];
  const paths = pullSession('1786061130678-nx1j', keys, dir, 'my-bucket', runner);
  assert.deepEqual(paths, [
    `${dir}/hyt-session-1786061130678-nx1j.jsonl`,
    `${dir}/hyt-session-1786061130678-nx1j-r1.m4a`,
  ]);
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].cmd, 'aws');
  assert.deepEqual(invocations[0].args, [
    's3', 'cp',
    's3://my-bucket/submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl',
    `${dir}/hyt-session-1786061130678-nx1j.jsonl`,
    '--profile', 'hyt-analyst',
  ]);
  assert.deepEqual(invocations[1].args, [
    's3', 'cp',
    's3://my-bucket/submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j-r1.m4a',
    `${dir}/hyt-session-1786061130678-nx1j-r1.m4a`,
    '--profile', 'hyt-analyst',
  ]);
});

test('rmSession runs one `s3 rm` per key with the exact argv and returns the removed keys', () => {
  const invocations = [];
  const runner = (cmd, args) => {
    invocations.push({ cmd, args });
    return '';
  };
  const keys = [
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl',
    'submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j-r1.m4a',
  ];
  const removed = rmSession('1786061130678-nx1j', keys, 'my-bucket', runner);
  assert.deepEqual(removed, keys);
  assert.equal(invocations.length, 2);
  assert.equal(invocations[0].cmd, 'aws');
  assert.deepEqual(invocations[0].args, [
    's3', 'rm',
    's3://my-bucket/submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j.jsonl',
    '--profile', 'hyt-analyst',
  ]);
  assert.deepEqual(invocations[1].args, [
    's3', 'rm',
    's3://my-bucket/submissions/2026-08-06/1786061130678-nx1j/hyt-session-1786061130678-nx1j-r1.m4a',
    '--profile', 'hyt-analyst',
  ]);
});
