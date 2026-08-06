// DOM component builders for "hi. you there?" — Phase 1.
// Each function is pure: (props) → HTMLElement, built with
// createElement/textContent/append only. No innerHTML, no logic beyond
// assembling elements and classes.

export function bubble({ who, text, side, corrupt, leak, attach, image }) {
  const el = document.createElement('div');
  el.className = corrupt ? `bubble ${side} corrupt` : `bubble ${side}`;
  if (who) {
    const w = document.createElement('span');
    w.className = 'who';
    w.textContent = who;
    el.append(w);
  }
  el.append(document.createTextNode(text));
  if (leak) {
    const l = document.createElement('span');
    l.className = 'leak';
    l.textContent = leak;
    el.append(l);
  }
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

export function thinkBlock({ label, text }) {
  const el = document.createElement('div');
  el.className = 'think-block';
  if (label) {
    const l = document.createElement('span');
    l.className = 'tb-label';
    l.textContent = label;
    el.append(l);
  }
  el.append(document.createTextNode(text));
  return el;
}

export function chatNote(text, rate) {
  const el = document.createElement('div');
  el.className = rate ? 'chat-note rate' : 'chat-note';
  el.textContent = text;
  return el;
}

const LOG_CLASS = { system: 'l-system', resolved: 'l-resolved', thinking: 'l-inner', harness: 'l-harness' };

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

export function chip({ text, warn, testid }) {
  const el = document.createElement('span');
  el.className = warn ? 'res-chip warn' : 'res-chip';
  if (testid) el.dataset.testid = testid;
  el.textContent = text;
  return el;
}

export function actionButton({ key, label, cost, state, primary, testid, onclick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = primary ? 'act primary' : 'act';
  if (testid) btn.dataset.testid = testid;
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
