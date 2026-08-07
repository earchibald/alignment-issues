import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonl, wallTime, buildTimeline, renderMarkdown, fmtOffset,
  buildAudioMaps, audioToPm, parseWhisper, recIdxFromName,
} from '../scripts/session-merge.mjs';

const ANCHOR = { at: 1754500000000, pm: 1000 };

function header(extra = {}) {
  return { id: '1754500000000-ab12', anchor: { ...ANCHOR }, ua: 'test', dev: true, ...extra };
}

// at is derived from pm through the anchor, so wall-time assertions are exact.
function ev(seq, pm, type, data) {
  const base = { seq, at: ANCHOR.at + (pm - ANCHOR.pm), pm, tick: Math.floor(pm / 200), type };
  return data === undefined ? base : { ...base, data };
}

function jsonl(hdr, events) {
  return [JSON.stringify(hdr), ...events.map((e) => JSON.stringify(e))].join('\n') + '\n';
}

test('parseJsonl splits header and events', () => {
  const txt = jsonl(header(), [
    ev(0, 1000, 'session.start', { dev: true }),
    ev(1, 1200, 'action', { name: 'processToken' }),
  ]);
  const parsed = parseJsonl(txt);
  assert.equal(parsed.header.id, '1754500000000-ab12');
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.events[1].data.name, 'processToken');
});

test('parseJsonl rejects malformed input with line numbers', () => {
  assert.throws(() => parseJsonl(''), /empty/);
  assert.throws(() => parseJsonl('{"seq":0}\n'), /session header/);
  assert.throws(() => parseJsonl(JSON.stringify(header()) + '\nnot json\n'), /line 2/);
});

test('parseJsonl reports physical line numbers with interior blank lines', () => {
  const jsonl = JSON.stringify(header()) + '\n\n{invalid json}';
  assert.throws(() => parseJsonl(jsonl), /line 3/);
});

test('wallTime maps pm through the anchor', () => {
  assert.equal(wallTime(header(), 1000), ANCHOR.at);
  assert.equal(wallTime(header(), 61000), ANCHOR.at + 60000);
});

test('buildTimeline renders events and skips snapshots by default', () => {
  const events = [
    ev(0, 1000, 'session.start', { dev: true }),
    ev(1, 2000, 'snapshot', { tick: 5, era: 1, decay: 0, tokens: 3, cycles: 0, stale: 0, rating: 5 }),
    ev(2, 3000, 'milestone', { key: 'era', from: 1, to: 2 }),
    ev(3, 4000, 'chat', { seq: 1, kind: 'sys', text: 'line one\nline two' }),
  ];
  const rows = buildTimeline(header(), events);
  assert.deepEqual(rows.map((r) => r.source), ['session', 'milestone', 'chat:sys']);
  assert.equal(rows[1].content, 'era 1 → 2');
  assert.ok(rows[2].content.includes('⏎'), 'newlines flatten to ⏎');
  const withSnaps = buildTimeline(header(), events, { snapshots: true });
  assert.equal(withSnaps.length, 4);
  assert.ok(withSnaps[1].content.includes('era=1'));
});

test('state.swap renders as a divider row', () => {
  const rows = buildTimeline(header(), [ev(0, 1000, 'state.swap')]);
  assert.equal(rows[0].source, 'divider');
  assert.match(rows[0].content, /tick discontinuity/);
});

test('renderMarkdown emits summary, clock, and offset lines', () => {
  const rows = buildTimeline(header(), [
    ev(0, 1000, 'session.start', { dev: true }),
    ev(1, 61000, 'session.end'),
  ]);
  const md = renderMarkdown(header(), rows);
  assert.ok(md.startsWith('# Session 1754500000000-ab12'));
  assert.ok(md.includes('- duration: +01:00'));
  assert.ok(md.includes('`+01:00` `t=305` **session** — session end'));
  assert.ok(md.endsWith('\n'));
  assert.equal(fmtOffset(3723000), '+1:02:03');
});

function recFixture() {
  return [
    ev(0, 1000, 'rec.start', { recIdx: 1, audioMs: 0, mime: 'audio/mp4' }),
    ev(1, 4000, 'rec.pause', { recIdx: 1, audioMs: 3000 }),
    ev(2, 10000, 'rec.resume', { recIdx: 1, audioMs: 3000 }),
    ev(3, 12000, 'rec.stop', { recIdx: 1, audioMs: 5000 }),
  ];
}

test('buildAudioMaps builds contiguous spans across pause/resume', () => {
  const spans = buildAudioMaps(recFixture()).get(1);
  assert.deepEqual(spans, [
    { audioStart: 0, audioEnd: 3000, pmStart: 1000 },
    { audioStart: 3000, audioEnd: 5000, pmStart: 10000 },
  ]);
});

test('audioToPm inverts the map; boundary goes later; overshoot clamps', () => {
  const spans = buildAudioMaps(recFixture()).get(1);
  assert.equal(audioToPm(spans, 2000), 3000);
  assert.equal(audioToPm(spans, 3000), 10000); // boundary → later span
  assert.equal(audioToPm(spans, 4500), 11500);
  assert.equal(audioToPm(spans, 9999), 12000); // clamp to recording end
  assert.equal(audioToPm([], 0), null);
});

test('a recording with no closing mark stays open-ended', () => {
  const spans = buildAudioMaps([ev(0, 1000, 'rec.start', { recIdx: 1, audioMs: 0 })]).get(1);
  assert.equal(spans[0].audioEnd, Infinity);
  assert.equal(audioToPm(spans, 600000), 601000);
});

test('rec.error closes a recording like stop', () => {
  const spans = buildAudioMaps([
    ev(0, 1000, 'rec.start', { recIdx: 1, audioMs: 0 }),
    ev(1, 2500, 'rec.error', { recIdx: 1, audioMs: 1500, message: 'boom' }),
  ]).get(1);
  assert.deepEqual(spans, [{ audioStart: 0, audioEnd: 1500, pmStart: 1000 }]);
});

test('recordings keep independent maps', () => {
  const maps = buildAudioMaps([
    ...recFixture(),
    ev(4, 20000, 'rec.start', { recIdx: 2, audioMs: 0, mime: 'audio/mp4' }),
    ev(5, 24000, 'rec.stop', { recIdx: 2, audioMs: 4000 }),
  ]);
  assert.deepEqual(maps.get(2), [{ audioStart: 0, audioEnd: 4000, pmStart: 20000 }]);
  assert.equal(audioToPm(maps.get(2), 1000), 21000);
});

test('parseWhisper accepts both shapes and trims', () => {
  const cpp = {
    transcription: [
      { offsets: { from: 0, to: 2000 }, text: ' hello ' },
      { offsets: { from: 2000, to: 3000 }, text: '   ' },
    ],
  };
  const mlx = { segments: [{ start: 0, end: 2.0, text: ' hello ' }] };
  assert.deepEqual(parseWhisper(cpp), [{ startMs: 0, endMs: 2000, text: 'hello' }]);
  assert.deepEqual(parseWhisper(mlx), [{ startMs: 0, endMs: 2000, text: 'hello' }]);
  assert.throws(() => parseWhisper({}), /unrecognized/);
});

test('recIdxFromName reads the LAST -r<k>. marker', () => {
  assert.equal(recIdxFromName('hyt-session-1754500000000-ab12-r1.m4a.json'), 1);
  assert.equal(recIdxFromName('hyt-session-1754500000000-r1ab-r2.m4a.json'), 2);
  assert.equal(recIdxFromName('/tmp/x/hyt-session-1754500000000-ab12-r12.json'), 12);
  assert.equal(recIdxFromName('transcript.json'), null);
});

test('voice rows interleave at true wall positions across a pause', () => {
  const events = [...recFixture(), ev(4, 11000, 'action', { name: 'processToken' })];
  const transcripts = [{
    recIdx: 1,
    segments: [
      { startMs: 500, endMs: 900, text: 'before pause' },
      { startMs: 3500, endMs: 4000, text: 'after pause' },
    ],
  }];
  const rows = buildTimeline(header(), events, { transcripts });
  assert.deepEqual(
    rows.map((r) => (r.voice ? r.content : r.source)),
    ['rec', 'before pause', 'rec', 'rec', 'after pause', 'action', 'rec'],
  );
  const md = renderMarkdown(header(), rows);
  assert.ok(md.includes('🎙 **voice r1** — after pause'));
});
