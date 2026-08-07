import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonl, wallTime, buildTimeline, renderMarkdown, fmtOffset,
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
