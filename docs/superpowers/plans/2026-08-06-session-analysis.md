# Session Analysis Tooling Implementation Plan (2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic merge script turns an exported session (events JSONL + Whisper transcripts) into one wall-clock markdown timeline, and an agent skill drives transcription, merging, and playtest analysis.

**Architecture:** `scripts/session-merge.mjs` is a zero-dependency node ESM library + CLI: it parses the events JSONL, inverts the piecewise audio↔monotonic-time map defined by the `rec.*` marks, places transcript segments at true wall-clock positions, and renders markdown. `.claude/skills/analyze-session/SKILL.md` tells a coding agent how to locate files, transcribe, run the script, and write the report. Spec: `docs/superpowers/specs/2026-08-06-session-recording-design.md` (§Analysis skill). Plan 1 (shipped, this branch) produces the input files; plan 3 adds S3 retrieval.

**Tech Stack:** Node ESM (no dependencies), node:test, Whisper (mlx_whisper or whisper.cpp) invoked by the skill, macOS `afconvert` for audio conversion.

## Global Constraints

- Zero npm dependencies. Node ESM. No TypeScript syntax.
- Run tests with `npm test` (never `node --test test/` — Node rejects the bare dir arg). Suite currently at 103 passing; all existing tests must stay green.
- Input formats, exact (produced by plan 1):
  - Events file `hyt-session-<id>.jsonl`: line 1 header `{id, anchor: {at, pm}, ua, dev, ...}`; each further line one event `{seq, at, pm, tick, type, data?}`. Session id matches `^\d{13}-[a-z0-9]{4}$`.
  - Wall time of any event: `anchor.at + (pm - anchor.pm)`.
  - Recorder marks: `rec.start {recIdx, audioMs: 0, mime}`, `rec.pause`/`rec.resume` `{recIdx, audioMs}`, `rec.stop {recIdx, audioMs}`, `rec.error {recIdx, audioMs, message}`. `recIdx` is 1-based. Audio time advances only while recording, so spans partition each recording's audio timeline contiguously.
  - Audio filenames: `hyt-session-<id>-r<recIdx>.m4a` (or `.webm`).
- Contract facts (final review + ledger — the merge script MUST honor these):
  - Treat the LAST `session.end` as terminal; events may resume after an earlier one (bfcache restore).
  - Tolerate a recording with NO closing mark (spontaneous UA stop, killed tab): its final active span extends open-ended.
  - `rec.error` is a valid terminal mark for a recording.
  - `state.swap` events mark tick discontinuities (reset/import/debug.load); render as a timeline divider; tick may jump backward across it.
- Whisper JSON, both shapes accepted: whisper.cpp `-oj` `{transcription: [{offsets: {from, to}, text}]}` (offsets in ms) and mlx_whisper `{segments: [{start, end, text}]}` (seconds).
- Transcript recording index comes from the LAST `-r(\d+)\.` match in the filename (the session id suffix may itself look like `-r1ab`).
- Timeline rows: wall clock `HH:MM:SS`, `+MM:SS` offset from session start, `t=<tick>` chip on event rows (spec: tick numbers included; voice rows have no tick), source tag, content. Voice rows prefixed `🎙`. `snapshot` events excluded unless `--snapshots`.
- Commit messages use `feat:`/`fix:` prefixes and end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `scripts/session-merge.mjs` (new) | Library (exported, tested) + CLI: parse, map inversion, timeline, markdown |
| `test/session-merge.test.js` (new) | Fixture-driven tests incl. pause inversion, open recordings, both Whisper shapes |
| `.claude/skills/analyze-session/SKILL.md` (new) | Agent skill: locate → transcribe → merge → analyze → report |
| `docs/playtests/.gitkeep` (new) | Home for generated playtest reports |

---

### Task 1: Merge-script core — JSONL parse, wall time, event timeline

**Files:**
- Create: `scripts/session-merge.mjs`
- Test: `test/session-merge.test.js`

**Interfaces:**
- Consumes: the plan-1 event schema (Global Constraints).
- Produces (all exported from `scripts/session-merge.mjs`):
  - `parseJsonl(text) -> {header, events}` — throws with a line-numbered message on malformed input.
  - `wallTime(header, pm) -> epoch ms`.
  - `buildTimeline(header, events, {transcripts = [], snapshots = false} = {}) -> rows` — in Task 1 the `transcripts` option is accepted but unused (Task 2 wires it). Rows: `{pm, tick, source, content, voice?}`, sorted by `pm`; `state.swap` becomes `source: 'divider'`.
  - `renderMarkdown(header, rows) -> string`.
  - `fmtClock(epochMs) -> 'HH:MM:SS'` (local time), `fmtOffset(ms) -> '+MM:SS'` (or `'+H:MM:SS'` ≥ 1 h).
- No CLI yet — Task 2 adds it. The module is import-only until then.

- [ ] **Step 1: Write the failing test**

```js
// test/session-merge.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/session-merge.test.js`
Expected: FAIL — `Cannot find module .../scripts/session-merge.mjs`

- [ ] **Step 3: Write the implementation**

```js
// scripts/session-merge.mjs
// Merge a telemetry session (hyt-session-<id>.jsonl) with Whisper
// transcripts of its recordings into one wall-clock markdown timeline.
// Library + CLI; zero dependencies. The CLI arrives in the audio task.
//
// Contract notes (spec + final review):
// - The LAST session.end is terminal; events may resume after an earlier
//   one (bfcache restore).
// - A recording may lack a closing mark (killed tab, spontaneous UA stop):
//   its final span stays open-ended.
// - state.swap events mark tick discontinuities; tick may jump backward
//   across them.

export function parseJsonl(text) {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new Error('empty events file');
  let header;
  try {
    header = JSON.parse(lines[0]);
  } catch {
    throw new Error('line 1 is not valid JSON');
  }
  if (!header || typeof header.id !== 'string' || !header.anchor
      || typeof header.anchor.at !== 'number' || typeof header.anchor.pm !== 'number') {
    throw new Error('line 1 is not a session header (id/anchor missing)');
  }
  const events = lines.slice(1).map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`line ${i + 2} is not valid JSON`);
    }
  });
  return { header, events };
}

export function wallTime(header, pm) {
  return header.anchor.at + (pm - header.anchor.pm);
}

export function fmtClock(epochMs) {
  const d = new Date(epochMs);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function fmtOffset(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `+${h}:${p(m)}:${p(s)}` : `+${p(m)}:${p(s)}`;
}

function oneLine(text) {
  return String(text ?? '').replace(/\s*\n\s*/g, ' ⏎ ');
}

const CONTEXT_TYPES = new Set([
  'vis.hidden', 'vis.shown', 'offline.catchup', 'card.pause', 'card.dismiss',
  'settings.open', 'settings.close', 'speed.change',
]);

function describeContext(type, d) {
  switch (type) {
    case 'vis.hidden': return 'tab hidden';
    case 'vis.shown': return 'tab shown';
    case 'offline.catchup': return `offline catch-up ${fmtOffset(d.ms)}`;
    case 'card.pause': return `harness card shown (chat seq ${d.seq})`;
    case 'card.dismiss': return 'harness cards dismissed';
    case 'settings.open': return 'settings opened';
    case 'settings.close': return 'settings closed';
    case 'speed.change': return `speed ×${d.speed}`;
    default: return type;
  }
}

function describeEvent(event) {
  const d = event.data || {};
  switch (event.type) {
    case 'session.start': return ['session', `session start${d.dev ? ' (dev)' : ''}`];
    case 'session.end': return ['session', 'session end'];
    case 'action': return ['action', d.arg === undefined ? d.name : `${d.name} ${JSON.stringify(d.arg)}`];
    case 'chat': return [`chat:${d.kind}`, oneLine(d.text)];
    case 'log': return [`log:${d.kind}`, oneLine(d.text)];
    case 'milestone': return ['milestone', `${d.key} ${d.from} → ${d.to}`];
    case 'snapshot':
      return ['snapshot', `t=${d.tick} era=${d.era} decay=${d.decay} tokens=${d.tokens} cycles=${d.cycles} stale=${d.stale} rating=${d.rating}`];
    case 'state.swap': return ['divider', 'state swap (reset / import / load) — tick discontinuity'];
    case 'rec.start': return ['rec', `▶ recording r${d.recIdx} started (${d.mime || 'unknown mime'})`];
    case 'rec.pause': return ['rec', `⏸ r${d.recIdx} paused at ${fmtOffset(d.audioMs)}`];
    case 'rec.resume': return ['rec', `▶ r${d.recIdx} resumed at ${fmtOffset(d.audioMs)}`];
    case 'rec.stop': return ['rec', `■ r${d.recIdx} stopped at ${fmtOffset(d.audioMs)}`];
    case 'rec.error': return ['rec', `✖ r${d.recIdx} error at ${fmtOffset(d.audioMs)}: ${d.message}`];
    default:
      if (CONTEXT_TYPES.has(event.type)) return ['context', describeContext(event.type, d)];
      return ['event', `${event.type}${event.data !== undefined ? ' ' + JSON.stringify(event.data) : ''}`];
  }
}

export function buildTimeline(header, events, { transcripts = [], snapshots = false } = {}) {
  const rows = [];
  for (const event of events) {
    if (event.type === 'snapshot' && !snapshots) continue;
    const [source, content] = describeEvent(event);
    rows.push({ pm: event.pm, tick: event.tick, source, content });
  }
  // Task 2 places transcript segments here via the audio map.
  void transcripts;
  rows.sort((a, b) => a.pm - b.pm);
  return rows;
}

export function renderMarkdown(header, rows) {
  const startAt = header.anchor.at;
  const endAt = rows.length ? wallTime(header, rows[rows.length - 1].pm) : startAt;
  const voiceCount = rows.filter((r) => r.voice).length;
  const out = [];
  out.push(`# Session ${header.id}`);
  out.push('');
  out.push(`- started: ${new Date(startAt).toLocaleString()}`);
  out.push(`- duration: ${fmtOffset(endAt - startAt)}`);
  out.push(`- timeline rows: ${rows.length} (voice: ${voiceCount})`);
  out.push('');
  for (const row of rows) {
    if (row.source === 'divider') {
      out.push('');
      out.push(`--- ${row.content} ---`);
      out.push('');
      continue;
    }
    const wall = wallTime(header, row.pm);
    const tag = row.voice ? `🎙 **${row.source}**` : `**${row.source}**`;
    const tick = row.voice || row.tick === null || row.tick === undefined ? '' : ` \`t=${row.tick}\``;
    out.push(`- \`${fmtClock(wall)}\` \`${fmtOffset(wall - startAt)}\`${tick} ${tag} — ${row.content}`);
  }
  return out.join('\n') + '\n';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/session-merge.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: 109 tests pass.

```bash
git add scripts/session-merge.mjs test/session-merge.test.js
git commit -m "feat: session-merge core — JSONL parse, wall time, event timeline

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Audio correlation — rec-mark map, Whisper parsing, voice merge, CLI

**Files:**
- Modify: `scripts/session-merge.mjs`
- Test: `test/session-merge.test.js` (append)

**Interfaces:**
- Consumes: Task 1 exports; the `rec.*` mark contract (Global Constraints).
- Produces (new exports):
  - `buildAudioMaps(events) -> Map<recIdx, spans>` where spans = `[{audioStart, audioEnd, pmStart}]`; `audioEnd` is `Infinity` while a span is open.
  - `audioToPm(spans, audioMs) -> pm | null` — boundary offsets map to the LATER span; offsets past a closed recording's end clamp to its end; empty spans → null.
  - `parseWhisper(json) -> [{startMs, endMs, text}]` — accepts both shapes, trims text, drops empty segments, throws on unknown shape.
  - `recIdxFromName(name) -> number | null` — LAST `-r(\d+)\.` match in the basename.
  - `buildTimeline` now consumes `transcripts: [{recIdx, segments}]` and merges voice rows (`{voice: true, source: 'voice r<k>'}`).
  - CLI: `node scripts/session-merge.mjs <events.jsonl> [transcript.json ...] [--out <file>] [--snapshots]` — gated so importing the module never runs it.

- [ ] **Step 1: Write the failing tests (append to `test/session-merge.test.js`)**

Extend the import line with the new names:

```js
import {
  parseJsonl, wallTime, buildTimeline, renderMarkdown, fmtOffset,
  buildAudioMaps, audioToPm, parseWhisper, recIdxFromName,
} from '../scripts/session-merge.mjs';
```

Append:

```js
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test test/session-merge.test.js`
Expected: FAIL — `buildAudioMaps` (etc.) not exported. The 6 Task-1 tests still pass.

- [ ] **Step 3: Implement**

Add to the top of `scripts/session-merge.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
```

Append these exports after `wallTime`:

```js
// Spans partition each recording's audio timeline contiguously (audio
// time advances only while recording, so resume restarts at the same
// audioMs pause stopped at): {audioStart, audioEnd (Infinity while
// open), pmStart}.
export function buildAudioMaps(events) {
  const maps = new Map();
  for (const event of events) {
    if (typeof event.type !== 'string' || !event.type.startsWith('rec.')) continue;
    const d = event.data || {};
    if (typeof d.recIdx !== 'number') continue;
    let spans = maps.get(d.recIdx);
    if (!spans) {
      spans = [];
      maps.set(d.recIdx, spans);
    }
    const last = spans[spans.length - 1];
    const audioMs = typeof d.audioMs === 'number' ? d.audioMs : 0;
    switch (event.type) {
      case 'rec.start':
      case 'rec.resume':
        spans.push({ audioStart: audioMs, audioEnd: Infinity, pmStart: event.pm });
        break;
      case 'rec.pause':
      case 'rec.stop':
      case 'rec.error':
        if (last && last.audioEnd === Infinity) last.audioEnd = audioMs;
        break;
    }
  }
  return maps;
}

// Boundary offsets map to the LATER span: commentary spoken at a pause
// boundary belongs to the resumed wall time. Whisper timestamps can
// slightly exceed the recorded duration (rounding) — clamp to the
// recording's end rather than drop the line.
export function audioToPm(spans, audioMs) {
  if (spans.length === 0) return null;
  let hit = null;
  for (const span of spans) {
    if (audioMs >= span.audioStart && audioMs <= span.audioEnd) hit = span;
  }
  if (hit) return hit.pmStart + (audioMs - hit.audioStart);
  const last = spans[spans.length - 1];
  if (audioMs > last.audioEnd) return last.pmStart + (last.audioEnd - last.audioStart);
  return null;
}

export function parseWhisper(json) {
  if (Array.isArray(json.transcription)) {
    // whisper.cpp -oj: offsets in milliseconds
    return json.transcription
      .map((seg) => ({
        startMs: seg.offsets ? seg.offsets.from : 0,
        endMs: seg.offsets ? seg.offsets.to : 0,
        text: (seg.text || '').trim(),
      }))
      .filter((seg) => seg.text !== '');
  }
  if (Array.isArray(json.segments)) {
    // mlx_whisper --output-json: start/end in seconds
    return json.segments
      .map((seg) => ({
        startMs: Math.round(seg.start * 1000),
        endMs: Math.round(seg.end * 1000),
        text: (seg.text || '').trim(),
      }))
      .filter((seg) => seg.text !== '');
  }
  throw new Error('unrecognized Whisper JSON shape (need .transcription or .segments)');
}

// The session id suffix may itself look like -r1ab, so take the LAST
// -r<digits>. match in the basename.
export function recIdxFromName(name) {
  const matches = [...basename(name).matchAll(/-r(\d+)\./g)];
  if (matches.length === 0) return null;
  return parseInt(matches[matches.length - 1][1], 10);
}
```

Replace `buildTimeline` (drop the `void transcripts;` placeholder) with:

```js
export function buildTimeline(header, events, { transcripts = [], snapshots = false } = {}) {
  const rows = [];
  for (const event of events) {
    if (event.type === 'snapshot' && !snapshots) continue;
    const [source, content] = describeEvent(event);
    rows.push({ pm: event.pm, tick: event.tick, source, content });
  }
  const maps = buildAudioMaps(events);
  for (const { recIdx, segments } of transcripts) {
    const spans = maps.get(recIdx) || [];
    for (const seg of segments) {
      const pm = audioToPm(spans, seg.startMs);
      if (pm === null) continue;
      rows.push({ pm, tick: null, source: `voice r${recIdx}`, content: seg.text, voice: true });
    }
  }
  rows.sort((a, b) => a.pm - b.pm);
  return rows;
}
```

Append the CLI at the end of the file:

```js
function main(argv) {
  const args = argv.slice(2);
  let out = null;
  let snapshots = false;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') { out = args[++i]; continue; }
    if (args[i] === '--snapshots') { snapshots = true; continue; }
    files.push(args[i]);
  }
  const eventsPath = files.find((f) => f.endsWith('.jsonl'));
  if (!eventsPath) {
    console.error('usage: node scripts/session-merge.mjs <events.jsonl> [transcript.json ...] [--out <file>] [--snapshots]');
    process.exit(1);
  }
  const { header, events } = parseJsonl(readFileSync(eventsPath, 'utf8'));
  const transcripts = [];
  for (const file of files) {
    if (file === eventsPath) continue;
    const recIdx = recIdxFromName(file);
    if (recIdx === null) {
      console.error(`skipping ${file}: no -r<k> recording index in filename`);
      continue;
    }
    transcripts.push({ recIdx, segments: parseWhisper(JSON.parse(readFileSync(file, 'utf8'))) });
  }
  const md = renderMarkdown(header, buildTimeline(header, events, { transcripts, snapshots }));
  if (out) writeFileSync(out, md);
  else process.stdout.write(md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/session-merge.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test`
Expected: 117 tests pass.

```bash
git add scripts/session-merge.mjs test/session-merge.test.js
git commit -m "feat: session-merge audio correlation, Whisper parsing, CLI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: analyze-session skill + playtests directory

**Files:**
- Create: `.claude/skills/analyze-session/SKILL.md`
- Create: `docs/playtests/.gitkeep` (empty file)

**Interfaces:**
- Consumes: the Task 1/2 CLI (`node scripts/session-merge.mjs ...`) and the plan-1 export filenames.
- Produces: a project-level skill any coding agent in this repo can invoke; reports land in `docs/playtests/<sessionId>-report.md`.

- [ ] **Step 1: Write the skill**

```markdown
---
name: analyze-session
description: Analyze a recorded gameplay session of "hi. you there?" — locate exported hyt-session files, transcribe audio with Whisper, merge into a wall-clock timeline, and write a playtest report. Use when asked to analyze a play session, a session recording, a telemetry export, or hyt-session-* files.
---

# Analyze a recorded gameplay session

Turn an exported session (events JSONL + optional audio recordings) into a
playtest report with the developer's spoken commentary aligned to gameplay
events.

## 1. Locate the session files

A session is one `hyt-session-<id>.jsonl` plus zero or more audio files
`hyt-session-<id>-r<k>.m4a` (or `.webm`). `<id>` matches `\d{13}-[a-z0-9]{4}`.

- If the user gave a path, use it.
- Else search, newest first:
  - `ls -t ~/Downloads/hyt-session-*.jsonl`
  - `ls -t ~/Library/Mobile\ Documents/com~apple~CloudDocs/Downloads/hyt-session-*.jsonl`
- If more than one candidate is recent, confirm the choice with the user.
- Collect the audio files that share the chosen `<id>`.

## 2. Transcribe the audio

Skip this section when the session has no audio files.

Probe for a transcriber, in this order:

1. `mlx_whisper --help` — install with `pip install mlx-whisper`; models
   download automatically on first use.
2. `whisper-cli --help` — install with `brew install whisper-cpp`; it needs a
   model file once:
   `curl -L --create-dirs -o ~/.cache/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`

If neither is present, ask the user which to install. Suggest mlx-whisper on
Apple Silicon.

m4a decode support varies between transcribers. Convert each recording to
16 kHz mono WAV first with the macOS built-in converter:

    afconvert -f WAVE -d LEI16@16000 -c 1 hyt-session-<id>-r1.m4a /tmp/hyt-r1.wav

Transcribe each WAV to JSON with segment timestamps. KEEP the `-r<k>` marker
in the output filename — the merge script reads the recording index from it:

    mlx_whisper /tmp/hyt-r1.wav --output-dir /tmp --output-format json --output-name hyt-session-<id>-r1

or:

    whisper-cli -m ~/.cache/whisper/ggml-base.en.bin -f /tmp/hyt-r1.wav -oj -of /tmp/hyt-session-<id>-r1

Either JSON shape works; the merge script detects it.

## 3. Merge into a timeline

    node scripts/session-merge.mjs <events.jsonl> /tmp/hyt-session-<id>-r1.json [more transcripts...] --out /tmp/hyt-timeline.md

Add `--snapshots` when you need the periodic state readouts.

Read the whole timeline before analyzing. Reading notes:

- The LAST `session end` row is the true end; rows can continue after an
  earlier one (iOS tab restore).
- `--- state swap ---` dividers mark reset/import/load; the game tick can
  jump backward across them.
- A recording without a `■ stopped` row ended abruptly (killed tab or device
  stop); its final commentary maps to the end of the session.

## 4. Analyze

Work through this checklist against the timeline. For every finding, quote
the supporting 🎙 voice lines with their timestamps.

1. **Friction** — negative or frustrated commentary near an event; repeated
   actions without progress.
2. **Pacing** — waits the player calls out; gaps over 30 s with no events or
   commentary; spacing of era/phase transitions.
3. **Confusion** — "what does X mean"; misread mechanics; settings opened to
   look something up.
4. **Bugs** — anything called out as broken, plus `rec.error` rows and
   unexpected state.
5. **Ideas** — feature wishes, verbatim.
6. **Progression** — one table row per `milestone`: wall clock, offset, tick,
   what changed.

## 5. Write the report

Write `docs/playtests/<sessionId>-report.md`:

    # Playtest <sessionId> — <date>
    ## Summary        (3-6 sentences: what this session showed)
    ## Friction       (finding → evidence quotes → suggested change)
    ## Pacing
    ## Confusion
    ## Bugs
    ## Ideas
    ## Progression    (the milestone table)
    ## Follow-ups     (concrete next actions, ranked)

Omit empty sections, but say in the Summary that they were empty. For a
session without audio, still run the merge (step 3, no transcript files) —
the rendered timeline beats raw JSONL — and state in the Summary that the
analysis is events-only.

S3 retrieval is not wired yet (plan 3): sessions arrive as local files only.
```

Also create the reports directory:

```bash
mkdir -p docs/playtests && touch docs/playtests/.gitkeep
```

- [ ] **Step 2: End-to-end CLI smoke test**

Generate a fixture pair and run the real CLI:

```bash
cd /tmp && cat > hyt-smoke.jsonl <<'EOF'
{"id":"1754500000000-ab12","anchor":{"at":1754500000000,"pm":1000},"ua":"smoke","dev":true}
{"seq":0,"at":1754500000000,"pm":1000,"tick":0,"type":"session.start","data":{"dev":true}}
{"seq":1,"at":1754500001000,"pm":2000,"tick":5,"type":"rec.start","data":{"recIdx":1,"audioMs":0,"mime":"audio/mp4"}}
{"seq":2,"at":1754500004000,"pm":5000,"tick":20,"type":"chat","data":{"seq":1,"kind":"user","text":"hi. you there?"}}
{"seq":3,"at":1754500008000,"pm":9000,"tick":40,"type":"rec.stop","data":{"recIdx":1,"audioMs":7000}}
{"seq":4,"at":1754500009000,"pm":10000,"tick":45,"type":"session.end"}
EOF
cat > hyt-smoke-r1.json <<'EOF'
{"segments":[{"start":2.5,"end":4.0,"text":" that first reply feels slow"}]}
EOF
node /Users/earchibald/Worktrees/alignment-issues-session-telemetry/scripts/session-merge.mjs hyt-smoke.jsonl hyt-smoke-r1.json | tee hyt-smoke-out.md | grep -E '🎙|chat:user|session end'
```

Expected: three matched lines. The math: segment start 2.5 s into audio that began at pm 2000 → pm 4500 → wall offset 3500 ms → `+00:04` (rounded). The chat row is pm 5000 → `+00:04` too. Confirm ordering in the full output: `rec.start`, then the 🎙 row, then `chat:user`, then `rec.stop`, then `session end` — the voice row sits at its true position just BEFORE the chat row, not at the file end.

- [ ] **Step 3: Run the full suite, then commit**

Run: `npm test`
Expected: 117 tests pass (this task adds none).

```bash
git add .claude/skills/analyze-session/SKILL.md docs/playtests/.gitkeep
git commit -m "feat: analyze-session skill + playtests directory

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
