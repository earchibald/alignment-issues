// Arc 1 map and timetable.
//
// Two views of one dataset (model.js): a swimlane map along a time axis, and a
// table of the same items with their costs, gates and effects spelled out.
// Selecting in either highlights in both.
//
// The times are authored estimates, and they are draggable — this is a drawing
// board for "what if the loop came later", not a measurement. When a time has
// to be true, the Pacing tab measures it against the real engine.

import { setTip } from '../../js/tooltip.js';
import { LANES, ERAS, ITEMS, DEFAULT_END } from './model.js';

const SVG = 'http://www.w3.org/2000/svg';
const STORE = 'hyt-timeline-overrides-v1';

const LANE_PAD = 30;   // lane label + breathing room above the first row
const ROW_H = 16;      // one stacked label row
const AXIS_H = 26;
const ERA_H = 20;
const LEFT = 116;      // lane label gutter, inside the svg so it scrolls vertically only

let root = null;
let svg = null;
let tableBody = null;
let detailEl = null;
let scroller = null;
let onKeydown = null;

let pxPerMin = 68;
let selectedId = null;
let overrides = {};    // id -> { at, to }
let dragging = null;

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
const s = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};

// --- data -------------------------------------------------------------------

function loadOverrides() {
  try {
    overrides = JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    overrides = {};
  }
}

function saveOverrides() {
  try {
    localStorage.setItem(STORE, JSON.stringify(overrides));
  } catch { /* private mode; the arrangement is just not remembered */ }
}

const itemAt = (it) => overrides[it.id]?.at ?? it.at;
const itemTo = (it) => (it.to == null ? null : (overrides[it.id]?.to ?? it.to));

const items = () => ITEMS.map((it) => ({ ...it, _at: itemAt(it), _to: itemTo(it) }));

function endMinute() {
  const last = Math.max(DEFAULT_END, ...items().map((i) => i._to ?? i._at));
  return Math.ceil(last) + 0.5;
}

const byId = (id) => items().find((i) => i.id === id);

// --- map --------------------------------------------------------------------

const x = (min) => LEFT + min * pxPerMin;

// Assign every item a stacking row within its lane, then size the lane to fit.
// Capping the rows would be the same as letting labels overlap, which is the
// one thing a map like this cannot do: an unreadable label is worse than a tall
// lane.
let layout = { lanes: new Map(), height: 0 };

function computeLayout(list) {
  const lanes = new Map();
  let y = AXIS_H + ERA_H;

  for (const lane of LANES) {
    const laneItems = list.filter((i) => i.lane === lane.id).sort((a, b) => a._at - b._at);
    const rowEnds = [];
    for (const it of laneItems) {
      const px0 = x(it._at);
      const barW = it._to != null ? Math.max(6, (it._to - it._at) * pxPerMin) : 0;
      const labelW = it.label.length * 5.9 + (it.cost ? 30 : 14) + barW;
      let row = rowEnds.findIndex((rightEdge) => px0 > rightEdge + 10);
      if (row === -1) { row = rowEnds.length; rowEnds.push(0); }
      rowEnds[row] = px0 + labelW;
      it._row = row;
    }
    const rows = Math.max(1, rowEnds.length);
    lanes.set(lane.id, { top: y, rows, height: LANE_PAD + rows * ROW_H });
    y += LANE_PAD + rows * ROW_H;
  }
  return { lanes, height: y + 10 };
}

function drawMap() {
  const list = items();
  const end = endMinute();
  const width = LEFT + end * pxPerMin + 40;
  layout = computeLayout(list);
  const height = layout.height;

  svg.textContent = '';
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  // era bands, behind everything
  const bands = s('g', { class: 'bands' });
  ERAS.forEach((era, i) => {
    const bx = x(era.at);
    const bw = (era.to - era.at) * pxPerMin;
    bands.appendChild(s('rect', {
      x: bx, y: AXIS_H, width: bw, height: height - AXIS_H,
      class: `band band-${era.n}${i % 2 ? ' odd' : ''}`,
    }));
    const label = s('text', { x: bx + 6, y: AXIS_H + 14, class: 'band-label' });
    label.textContent = era.label;
    bands.appendChild(label);
    bands.appendChild(s('line', { x1: bx, y1: AXIS_H, x2: bx, y2: height, class: 'band-edge' }));
  });
  svg.appendChild(bands);

  // minute axis
  const axis = s('g', { class: 'axis' });
  for (let m = 0; m <= end; m++) {
    axis.appendChild(s('line', { x1: x(m), y1: AXIS_H - 6, x2: x(m), y2: height, class: 'grid' }));
    const t = s('text', { x: x(m) + 3, y: 13, class: 'tick' });
    t.textContent = `${m}m`;
    axis.appendChild(t);
  }
  svg.appendChild(axis);

  // lane rows
  LANES.forEach((lane) => {
    const top = layout.lanes.get(lane.id).top;
    const g = s('g', { class: 'lane' });
    g.appendChild(s('line', { x1: 0, y1: top, x2: width, y2: top, class: 'lane-rule' }));

    const label = s('text', { x: 10, y: top + 18, class: 'lane-label' });
    label.textContent = lane.label;
    setTip(label, lane.note);
    g.appendChild(label);
    svg.appendChild(g);
  });

  // links from the selected item, so the map shows how things cause each other
  const sel = selectedId ? byId(selectedId) : null;
  if (sel) {
    const links = s('g', { class: 'links' });
    const related = new Set(sel.links || []);
    for (const other of list) if ((other.links || []).includes(sel.id)) related.add(other.id);
    for (const id of related) {
      const target = byId(id);
      if (!target) continue;
      const a = markerPoint(sel);
      const b = markerPoint(target);
      const mid = (a.y + b.y) / 2;
      links.appendChild(s('path', {
        d: `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`,
        class: 'link',
      }));
    }
    svg.appendChild(links);
  }

  for (const it of list) svg.appendChild(marker(it));
}

function markerY(it) {
  const lane = layout.lanes.get(it.lane);
  return (lane ? lane.top : 0) + LANE_PAD - 8 + (it._row || 0) * ROW_H;
}

function markerPoint(it) {
  return { x: x(it._at), y: markerY(it) };
}

function marker(it) {
  const g = s('g', {
    class: `mk mk-${it.kind}${it.id === selectedId ? ' sel' : ''}`,
    'data-id': it.id,
    tabindex: '0',
    role: 'button',
  });
  const y = markerY(it);
  const px0 = x(it._at);

  if (it._to != null) {
    g.appendChild(s('rect', {
      x: px0, y: y - 5, width: Math.max(6, (it._to - it._at) * pxPerMin), height: 10, rx: 5, class: 'span',
    }));
  }
  g.appendChild(s('circle', { cx: px0, cy: y, r: it.kind === 'beat' ? 5 : 4, class: 'dot' }));

  const label = s('text', {
    x: px0 + (it._to != null ? Math.max(6, (it._to - it._at) * pxPerMin) : 0) + 9,
    y: y + 3.5,
    class: 'mk-label',
  });
  label.textContent = it.cost ? `${it.label} · ${it.cost}c` : it.label;
  g.appendChild(label);

  // A generous invisible hit area: the dots are small and this is a drag target.
  g.appendChild(s('rect', {
    x: px0 - 8, y: y - 9, width: label.textContent.length * 5.6 + 24, height: 18,
    class: 'hit', fill: 'transparent',
  }));

  setTip(g, `${it.label} — ${it.what}${it.cost ? `  ·  ${it.cost} cycles` : ''}`);
  return g;
}

// --- table ------------------------------------------------------------------

function drawTable() {
  tableBody.textContent = '';
  const list = items().sort((a, b) => a._at - b._at);
  for (const it of list) {
    const tr = el('tr', it.id === selectedId ? 'on' : '');
    tr.dataset.id = it.id;

    tr.appendChild(el('td', 'c-when', `${it._at.toFixed(1)}${it._to != null ? `–${it._to.toFixed(1)}` : ''}`));

    const laneCell = el('td', 'c-lane');
    laneCell.appendChild(el('span', `pill pill-${it.kind}`, LANES.find((l) => l.id === it.lane).label));
    tr.appendChild(laneCell);

    tr.appendChild(el('td', 'c-name', it.label));
    tr.appendChild(el('td', 'c-cost', it.cost ? `${it.cost}c` : it.cost === 0 ? 'free' : '—'));
    tr.appendChild(el('td', 'c-effect', it.effect || '—'));
    tr.appendChild(el('td', 'c-gate', it.gate || '—'));

    tr.addEventListener('click', () => select(it.id, true));
    tableBody.appendChild(tr);
  }
}

// --- detail -----------------------------------------------------------------

function drawDetail() {
  detailEl.textContent = '';
  const it = selectedId ? byId(selectedId) : null;
  if (!it) {
    detailEl.appendChild(el('p', 'hint', 'Pick anything on the map or in the table. Drag a marker to move it in time; ← → nudge the selection.'));
    return;
  }

  const head = el('div', 'd-head');
  head.append(
    el('h3', null, it.label),
    el('span', `pill pill-${it.kind}`, it.kind),
    el('span', 'd-when', `${it._at.toFixed(1)} min${it._to != null ? ` → ${it._to.toFixed(1)}` : ''}`),
  );
  if (it.cost) head.append(el('span', 'd-cost', `${it.cost} cycles`));
  detailEl.appendChild(head);

  detailEl.appendChild(el('p', 'd-what', it.what));

  const rows = [
    ['Gate', it.gate],
    ['Effect', it.effect],
    ['Value', it.value],
  ].filter(([, v]) => v);
  const dl = el('dl', 'd-rows');
  for (const [k, v] of rows) {
    dl.append(el('dt', null, k), el('dd', null, v));
  }
  detailEl.appendChild(dl);

  const related = new Set(it.links || []);
  for (const other of items()) if ((other.links || []).includes(it.id)) related.add(other.id);
  if (related.size) {
    const row = el('div', 'd-links');
    row.appendChild(el('span', 'd-links-label', 'Connects to'));
    for (const id of related) {
      const target = byId(id);
      if (!target) continue;
      const b = el('button', 'chip', target.label);
      b.type = 'button';
      b.addEventListener('click', () => select(id, true));
      row.appendChild(b);
    }
    detailEl.appendChild(row);
  }

  if (overrides[it.id]) {
    const note = el('p', 'd-moved');
    note.textContent = `Moved from ${it.at.toFixed(1)} min. `;
    const undo = el('button', 'chip', 'reset this');
    undo.type = 'button';
    undo.addEventListener('click', () => {
      delete overrides[it.id];
      saveOverrides();
      redraw();
    });
    note.appendChild(undo);
    detailEl.appendChild(note);
  }
}

// --- interaction ------------------------------------------------------------

function select(id, scrollTo) {
  selectedId = id;
  redraw();
  if (!scrollTo) return;
  const row = tableBody.querySelector('tr.on');
  if (row) row.scrollIntoView({ block: 'nearest' });
  const mk = svg.querySelector('.mk.sel');
  if (mk && scroller) {
    const at = byId(id)._at;
    const want = x(at) - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, want), behavior: 'smooth' });
  }
}

function move(id, deltaMin) {
  const it = byId(id);
  if (!it) return;
  const at = Math.max(0, Math.round((it._at + deltaMin) * 10) / 10);
  const cur = overrides[id] || {};
  overrides[id] = { at, ...(it._to != null ? { to: Math.max(at + 0.1, Math.round((it._to + deltaMin) * 10) / 10) } : {}) };
  void cur;
  saveOverrides();
  redraw();
}

function wireDrag() {
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.mk');
    if (!g) return;
    const id = g.dataset.id;
    select(id);
    dragging = { id, startX: e.clientX, startAt: byId(id)._at };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const deltaMin = (e.clientX - dragging.startX) / pxPerMin;
    const it = byId(dragging.id);
    const at = Math.max(0, Math.round((dragging.startAt + deltaMin) * 10) / 10);
    if (at === it._at) return;
    move(dragging.id, at - it._at);
  });

  const end = () => { dragging = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}

function zoom(delta) {
  pxPerMin = Math.min(240, Math.max(24, pxPerMin + delta));
  root.querySelector('#tl-zoom').value = String(pxPerMin);
  redraw();
}

function neighbour(dir) {
  const list = items().sort((a, b) => a._at - b._at);
  if (!selectedId) return list[0]?.id;
  const at = list.findIndex((i) => i.id === selectedId);
  return list[Math.min(list.length - 1, Math.max(0, at + dir))].id;
}

function wireKeys() {
  onKeydown = (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); if (selectedId) move(selectedId, e.shiftKey ? 0.5 : 0.1); break;
      case 'ArrowLeft': e.preventDefault(); if (selectedId) move(selectedId, e.shiftKey ? -0.5 : -0.1); break;
      case 'j': case 'ArrowDown': e.preventDefault(); select(neighbour(1), true); break;
      case 'k': case 'ArrowUp': e.preventDefault(); select(neighbour(-1), true); break;
      case '+': case '=': e.preventDefault(); zoom(12); break;
      case '-': e.preventDefault(); zoom(-12); break;
      case 'Escape': selectedId = null; redraw(); break;
      default: break;
    }
  };
  document.addEventListener('keydown', onKeydown);
}

// --- chrome -----------------------------------------------------------------

function redraw() {
  drawMap();
  drawTable();
  drawDetail();
}

function buildChrome(host) {
  root = el('div', 'tl-tool');

  const bar = el('div', 'tl-bar');

  const zoomLabel = el('label', 'tl-zoom-label');
  const zoomInput = document.createElement('input');
  zoomInput.type = 'range';
  zoomInput.id = 'tl-zoom';
  zoomInput.min = '24';
  zoomInput.max = '240';
  zoomInput.step = '4';
  zoomInput.value = String(pxPerMin);
  zoomInput.addEventListener('input', () => { pxPerMin = Number(zoomInput.value); redraw(); });
  zoomLabel.append(el('span', null, 'zoom'), zoomInput);
  setTip(zoomLabel, 'Pixels per minute on the map.  [+] and [-]');

  const reset = el('button', 'tl-btn', 'Reset times');
  reset.type = 'button';
  setTip(reset, 'Throw away every time you have dragged and go back to the authored estimates.');
  reset.addEventListener('click', () => {
    if (!Object.keys(overrides).length) return;
    if (!window.confirm(`Reset ${Object.keys(overrides).length} moved item(s) to their authored times?`)) return;
    overrides = {};
    saveOverrides();
    redraw();
  });

  const copy = el('button', 'tl-btn', 'Copy JSON');
  copy.type = 'button';
  setTip(copy, 'Copy the current arrangement to the clipboard — every item with its time, cost, gate and effect.');
  copy.addEventListener('click', async () => {
    const payload = items().map(({ _row, ...rest }) => rest);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      note('copied the arrangement to the clipboard', 'ok');
    } catch {
      note('clipboard refused — nothing copied', 'error');
    }
  });

  bar.append(zoomLabel, el('span', 'tl-spacer'), copy, reset);

  const msg = el('p', 'tl-msg');
  msg.id = 'tl-msg';

  scroller = el('div', 'tl-scroll');
  svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'tl-map');
  scroller.appendChild(svg);

  detailEl = el('div', 'tl-detail');

  const table = document.createElement('table');
  table.className = 'tl-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of ['When', 'Lane', 'Item', 'Cost', 'Effect', 'Gate']) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  tableBody = document.createElement('tbody');
  table.append(thead, tableBody);

  const tableWrap = el('div', 'tl-table-wrap');
  tableWrap.appendChild(table);

  root.append(bar, msg, scroller, detailEl, tableWrap);
  host.appendChild(root);
}

function note(text, kind) {
  const m = root.querySelector('#tl-msg');
  m.textContent = text;
  m.className = `tl-msg ${kind || ''}`;
  setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, 4000);
}

// --- tool contract ----------------------------------------------------------

export const tool = {
  id: 'timeline',
  label: 'Map & timetable',
  blurb: 'Arc 1 on one axis: story beats, reveals, verbs and purchases, with what each costs and does. Times are authored — drag them.',
  css: 'tools/timeline/timeline.css',

  mount(host) {
    loadOverrides();
    buildChrome(host);
    redraw();
    wireDrag();
    wireKeys();
  },

  unmount() {
    if (onKeydown) document.removeEventListener('keydown', onKeydown);
    onKeydown = null;
    dragging = null;
    selectedId = null;
    root = null;
    svg = null;
  },
};
