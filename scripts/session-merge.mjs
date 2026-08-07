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
  const lines = text.split('\n');

  let header;
  let headerPhysicalLineNum = 0;
  const events = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    // First non-blank line is the header
    if (headerPhysicalLineNum === 0) {
      headerPhysicalLineNum = i + 1; // Physical line number (1-based)
      try {
        header = JSON.parse(line);
      } catch {
        throw new Error(`line ${headerPhysicalLineNum} is not valid JSON`);
      }
      if (!header || typeof header.id !== 'string' || !header.anchor
          || typeof header.anchor.at !== 'number' || typeof header.anchor.pm !== 'number') {
        throw new Error(`line ${headerPhysicalLineNum} is not a session header (id/anchor missing)`);
      }
    } else {
      // Subsequent non-blank lines are events
      const physicalLineNum = i + 1;
      try {
        events.push(JSON.parse(line));
      } catch {
        throw new Error(`line ${physicalLineNum} is not valid JSON`);
      }
    }
  }

  if (headerPhysicalLineNum === 0) throw new Error('empty events file');

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
