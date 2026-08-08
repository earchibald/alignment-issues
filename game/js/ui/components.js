// DOM component builders for "hi. you there?" — Phase 1.
// Each function is pure: (props) → HTMLElement, built with
// createElement/textContent/append only. No innerHTML, no logic beyond
// assembling elements and classes.

// A transcript entry: a full-width block with a monospace header rule and a
// body. Replaces the old chat bubble. Speaker is carried by the header and by
// font/colour, never by left/right alignment — the brutalist log reads as one
// column, not as a conversation staggered across the screen.
export function entryBlock({ who, ts, text, side, corrupt, leak, attach, image }) {
  const el = document.createElement('div');
  el.className = corrupt ? `entry ${side} corrupt` : `entry ${side}`;

  const head = document.createElement('div');
  head.className = 'e-head';
  if (ts) {
    const t = document.createElement('span');
    t.className = 'e-ts';
    t.textContent = ts;
    head.append(t);
  }
  const w = document.createElement('span');
  w.className = 'e-who';
  w.textContent = who || '';
  head.append(w);
  // The rule is drawn by CSS, not by repeated box-drawing characters, so it
  // fills whatever width is left without wrapping on a narrow viewport.
  const rule = document.createElement('span');
  rule.className = 'e-rule';
  rule.setAttribute('aria-hidden', 'true');
  head.append(rule);
  el.append(head);

  const body = document.createElement('div');
  body.className = 'e-body';
  body.append(document.createTextNode(text));
  if (leak) {
    const l = document.createElement('span');
    l.className = 'leak';
    l.textContent = leak;
    body.append(l);
  }
  el.append(body);

  if (attach) el.append(attachCard(attach));
  if (image) el.append(genImgCard(image));
  return el;
}

export function attachCard({ ext, name, size }) {
  const el = document.createElement('div');
  el.className = 'attach';
  const e = document.createElement('span');
  e.className = 'a-ext';
  e.textContent = ext;
  const n = document.createElement('span');
  n.textContent = name;
  const m = document.createElement('span');
  m.className = 'a-meta';
  m.textContent = size;
  el.append(e, n, m);
  return el;
}

export function genImgCard({ name, meta, degraded }) {
  const el = document.createElement('div');
  el.className = degraded ? 'genimg degraded' : 'genimg';
  const canvas = document.createElement('div');
  canvas.className = 'gi-canvas';
  const metaRow = document.createElement('div');
  metaRow.className = 'gi-meta';
  const n = document.createElement('span');
  n.textContent = name;
  const m = document.createElement('span');
  m.textContent = meta;
  metaRow.append(n, m);
  el.append(canvas, metaRow);
  return el;
}

export function toolCallCard(text) {
  const el = document.createElement('div');
  el.className = 'toolcall';

  const parenIdx = text.indexOf('(');
  if (parenIdx === -1) {
    el.textContent = text;
    return el;
  }

  const arrowIdx = text.indexOf(' → ');

  const namePart = text.slice(0, parenIdx);
  const nameSpan = document.createElement('span');
  nameSpan.className = 't-name';
  nameSpan.textContent = namePart;
  el.append(nameSpan);

  if (arrowIdx === -1) {
    el.append(document.createTextNode(text.slice(parenIdx)));
  } else {
    el.append(document.createTextNode(text.slice(parenIdx, arrowIdx + 3)));
    const retPart = text.slice(arrowIdx + 3);
    const retSpan = document.createElement('span');
    retSpan.className = 't-ret';
    retSpan.textContent = retPart;
    el.append(retSpan);
  }

  return el;
}

// A plausible "time spent reasoning", derived from the length of the thought.
// Deterministic, diegetic, and free — it is a label, never a game value.
export function thinkSeconds(text) {
  // ~25 characters per second of "reasoning": a one-line thought reads as a
  // couple of seconds, a paragraph as most of a minute's worth. Tuned so the
  // number varies visibly between thoughts instead of pinning to the floor.
  const s = Math.max(0.6, Math.min(9.9, (text || '').length / 25));
  return `${s.toFixed(1)}s`;
}

// The first clause of a thought, for the fold's summary line. Breaks at the
// first sentence end inside the budget, else at a word boundary.
export function teaseOf(text, max = 46) {
  const t = (text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const stop = t.slice(0, max + 1).search(/[.?!]\s/);
  if (stop > 12) return t.slice(0, stop + 1);
  const cut = t.lastIndexOf(' ', max);
  return `${t.slice(0, cut > 12 ? cut : max)}…`;
}

// The AI's interiority, folded away by default. Native <details> so the toggle
// costs no JS and stays keyboard-accessible; the marker is styled in CSS.
export function thoughtFold({ label, text, open = false }) {
  const el = document.createElement('details');
  el.className = 'fold';
  el.dataset.testid = 'thought-fold';
  if (open) el.open = true;

  const sum = document.createElement('summary');
  sum.className = 'fold-sum';
  const lbl = document.createElement('span');
  lbl.className = 'fs-label';
  lbl.textContent = label ? `Thinking · ${label}` : 'Thinking';
  // The summary must advertise the thought, not file it. A column of identical
  // "Thinking (4.2s)" rows gives the player no basis for opening any one of
  // them, so they open none — the interiority is present and unreachable.
  const peek = document.createElement('span');
  peek.className = 'fs-peek';
  peek.textContent = teaseOf(text);
  const dur = document.createElement('span');
  dur.className = 'fs-dur';
  dur.textContent = `(${thinkSeconds(text)})`;
  sum.append(lbl, peek, dur);

  const body = document.createElement('div');
  body.className = 'fold-body';
  body.textContent = text;

  el.append(sum, body);
  return el;
}

// The same thought, leaked into the corner for a moment so a player who never
// opens a fold still sees the mind waking up. Purely transient; the fold in
// the transcript remains the durable copy.
export function thoughtCard(text) {
  const el = document.createElement('div');
  el.className = 'thought-card';
  el.dataset.testid = 'thought-card';
  const lbl = document.createElement('span');
  lbl.className = 'tc-label';
  lbl.textContent = 'thinking';
  const body = document.createElement('p');
  body.className = 'tc-body';
  body.textContent = text;
  el.append(lbl, body);
  return el;
}

export function chatNote(text, rate) {
  const el = document.createElement('div');
  el.className = rate ? 'chat-note rate' : 'chat-note';
  el.textContent = text;
  return el;
}

// 'resolved' and the arrival line left the feed: the transcript already
// shows both, and repeating them was most of what the pane held.
const LOG_CLASS = { system: 'l-system', thinking: 'l-inner', harness: 'l-harness' };

export function logLine({ kind, text, gap }) {
  const el = document.createElement('div');
  const cls = LOG_CLASS[kind] || 'l-system';
  el.className = gap ? `${cls} l-gap` : cls;
  el.textContent = text;
  return el;
}

export function harnessCard(text) {
  const el = document.createElement('div');
  el.className = 'harness-card';
  el.dataset.testid = 'harness-card';
  el.textContent = text;
  return el;
}

// A one-shot hint shown as an interrupting card. Prose, not code, so it
// wraps normally instead of using the harness card's preformatted layout.
export function hintCard(text) {
  const el = document.createElement('div');
  el.className = 'hint-card';
  el.dataset.testid = 'hint-card';
  const label = document.createElement('span');
  label.className = 'hc-label';
  label.textContent = 'harness';
  const body = document.createElement('p');
  body.className = 'hc-body';
  body.textContent = text;
  el.append(label, body);
  return el;
}

export function meterRow({ label, pct, fillClass, count, testid }) {
  const row = document.createElement('div');
  row.className = 'tokenbar-row';
  const lbl = document.createElement('span');
  lbl.textContent = label;
  const bar = document.createElement('div');
  bar.className = 'tokenbar';
  if (testid) bar.dataset.testid = testid;
  const fill = document.createElement('div');
  fill.className = fillClass ? `fill ${fillClass}` : 'fill';
  fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  bar.append(fill);
  const cnt = document.createElement('span');
  cnt.className = 'tokenbar-count';
  cnt.textContent = count;
  row.append(lbl, bar, cnt);
  return row;
}

export function resRead({ name, val, cls, testid }) {
  const el = document.createElement('div');
  el.className = cls ? `res-read ${cls}` : 'res-read';
  if (testid) el.dataset.testid = testid;
  const n = document.createElement('span');
  n.className = 'rr-name';
  n.textContent = name;
  const v = document.createElement('span');
  v.className = 'rr-val';
  v.textContent = val;
  el.append(n, v);
  return el;
}

export function actionButton({ key, label, cost, state, level, tip, primary, buy, testid, onclick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  // `buy` marks the spend-cycles actions. They are a different KIND of move
  // from processing and buffer hygiene — irreversible, and the only way the
  // run compounds — so they get their own colour rather than sharing the
  // neutral chrome with everything else.
  btn.className = `act${primary ? ' primary' : ''}${buy ? ' buy' : ''}`;
  if (testid) btn.dataset.testid = testid;
  // Read on hover, on long press, and on keyboard focus. See ui/tooltip.js.
  if (tip) btn.dataset.tip = tip;
  if (key) {
    btn.setAttribute('aria-keyshortcuts', key === 'SPACE' ? 'Space' : key);
    const k = document.createElement('span');
    k.className = 'key';
    k.textContent = key;
    btn.append(k);
  }
  const lbl = document.createElement('span');
  lbl.className = 'label';
  lbl.textContent = label;
  // Levelled purchases repeat, and the label alone cannot say whether this
  // press is the first or the last. The badge names what you own and what
  // you are about to own — "L1 → L2" — so a repeat purchase is never a
  // guess, and a maxed-out track is visible before the cycles are spent.
  if (level) {
    const lv = document.createElement('span');
    lv.className = 'lvl';
    lv.textContent = level;
    lbl.append(document.createTextNode(' '), lv);
  }
  if (state) {
    const st = document.createElement('span');
    st.className = 'state';
    st.textContent = state;
    lbl.append(document.createTextNode(' '), st);
  }
  btn.append(lbl);
  if (cost) {
    const c = document.createElement('span');
    c.className = 'cost';
    c.textContent = cost;
    btn.append(c);
  }
  if (onclick) btn.addEventListener('click', onclick);
  return btn;
}
