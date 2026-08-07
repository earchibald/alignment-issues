// SVG chart primitives. No dependencies, no canvas — an SVG node can be read
// in the elements panel, which matters when the question is "is the chart
// wrong or is the game wrong".
//
// Every chart takes already-reduced data and draws it. Nothing here knows
// what a reveal or a tap is.

const NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
};

function frame(width, height, pad) {
  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    preserveAspectRatio: 'none', class: 'chart',
  });
  const plot = {
    svg,
    x0: pad.l, y0: pad.t, x1: width - pad.r, y1: height - pad.b,
    get w() { return this.x1 - this.x0; },
    get h() { return this.y1 - this.y0; },
  };
  return plot;
}

function axes(p, { xLabel, yLabel, xMax, yMax, yTicks = 4 }) {
  p.svg.appendChild(el('line', { x1: p.x0, y1: p.y1, x2: p.x1, y2: p.y1, class: 'axis' }));
  p.svg.appendChild(el('line', { x1: p.x0, y1: p.y0, x2: p.x0, y2: p.y1, class: 'axis' }));
  for (let i = 0; i <= yTicks; i++) {
    const v = (yMax / yTicks) * i;
    const y = p.y1 - (p.h * i) / yTicks;
    p.svg.appendChild(el('line', { x1: p.x0, y1: y, x2: p.x1, y2: y, class: 'grid' }));
    p.svg.appendChild(el('text', { x: p.x0 - 6, y: y + 3.5, class: 'tick end' }, fmt(v)));
  }
  p.svg.appendChild(el('text', { x: p.x1, y: p.y1 + 15, class: 'tick end' }, `${fmt(xMax)} ${xLabel}`));
  p.svg.appendChild(el('text', { x: p.x0, y: p.y0 - 6, class: 'tick' }, yLabel));
}

const fmt = (v) => (v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(0) : v.toFixed(1));

// --- the sawtooth ---------------------------------------------------------
// Effort per reply across the run, with reveal markers and era bands. This is
// the chart the whole tool exists for: the teeth should climb, and a reveal
// should sit at the top of a climb, not on the flat.
export function sawtooth(host, { series, reveals, eraBands, yLabel = 'taps per reply' }) {
  const W = 900, H = 260;
  const p = frame(W, H, { l: 34, r: 10, t: 16, b: 22 });
  const xMax = Math.max(1, ...series.map((d) => d.atSec));
  const yMax = Math.max(4, ...series.map((d) => d.taps)) * 1.15;
  const X = (s) => p.x0 + (s / xMax) * p.w;
  const Y = (v) => p.y1 - (v / yMax) * p.h;

  for (const band of eraBands) {
    if (band.toSec <= band.fromSec) continue;
    p.svg.appendChild(el('rect', {
      x: X(band.fromSec), y: p.y0, width: Math.max(1, X(band.toSec) - X(band.fromSec)), height: p.h,
      class: `era era${band.era}`,
    }));
    p.svg.appendChild(el('text', { x: X(band.fromSec) + 4, y: p.y0 + 11, class: 'eralabel' }, `era ${band.era}`));
  }

  axes(p, { xLabel: 's', yLabel, xMax, yMax });

  // Reveal markers first, so the data line reads on top of them.
  reveals.forEach((r, i) => {
    const x = X(r.atSec);
    p.svg.appendChild(el('line', { x1: x, y1: p.y0, x2: x, y2: p.y1, class: 'reveal' }));
    const label = el('text', {
      x: x + 3, y: p.y0 + 24 + (i % 4) * 11, class: 'revealtext',
    }, r.id);
    label.appendChild(el('title', {}, `${r.id} — ${r.atSec.toFixed(1)}s, ${r.gapSec.toFixed(1)}s after the previous reveal`));
    p.svg.appendChild(label);
  });

  const d = series.map((pt, i) => `${i ? 'L' : 'M'}${X(pt.atSec).toFixed(1)},${Y(pt.taps).toFixed(1)}`).join(' ');
  p.svg.appendChild(el('path', { d, class: 'line' }));
  for (const pt of series) {
    const dot = el('circle', { cx: X(pt.atSec), cy: Y(pt.taps), r: 2, class: 'dot' });
    dot.appendChild(el('title', {}, `reply ${pt.n}: ${pt.taps} taps, ${pt.sec.toFixed(1)}s (era ${pt.era})`));
    p.svg.appendChild(dot);
  }

  host.appendChild(p.svg);
}

// --- reveal cadence -------------------------------------------------------
// One row per reveal, bar length = the gap since the previous one. Reads at a
// glance as "where is the game silent, and where does it shout twice".
export function cadence(host, { reveals }) {
  const rowH = 15;
  const W = 900, H = Math.max(60, reveals.length * rowH + 26);
  const p = frame(W, H, { l: 108, r: 46, t: 8, b: 18 });
  const maxGap = Math.max(1, ...reveals.map((r) => r.gapSec));
  const X = (s) => p.x0 + (s / maxGap) * p.w;

  reveals.forEach((r, i) => {
    const y = p.y0 + i * rowH;
    p.svg.appendChild(el('text', { x: p.x0 - 6, y: y + 10, class: 'tick end' }, r.id));
    const bar = el('rect', {
      x: p.x0, y: y + 3, width: Math.max(1, X(r.gapSec) - p.x0), height: rowH - 6,
      class: r.gapSec < 3 ? 'gapbar tight' : 'gapbar',
    });
    bar.appendChild(el('title', {}, `${r.id}: ${r.gapSec.toFixed(1)}s after the previous reveal, at ${r.atSec.toFixed(1)}s`));
    p.svg.appendChild(bar);
    p.svg.appendChild(el('text', { x: X(r.gapSec) + 5, y: y + 11, class: 'tick' }, `${r.gapSec.toFixed(0)}s`));
  });

  host.appendChild(p.svg);
}

// --- stacked bar ----------------------------------------------------------
// Used for era length. Small, categorical, and the totals matter.
export function stacked(host, { rows, total, unit = 's' }) {
  const W = 900, H = 46;
  const p = frame(W, H, { l: 0, r: 0, t: 8, b: 20 });
  let x = p.x0;
  for (const row of rows) {
    const w = total > 0 ? (row.value / total) * p.w : 0;
    if (w <= 0) continue;
    const rect = el('rect', { x, y: p.y0, width: w, height: 18, class: `era era${row.era} solid` });
    rect.appendChild(el('title', {}, `era ${row.era}: ${row.value.toFixed(0)}${unit} (${((row.value / total) * 100).toFixed(0)}%)`));
    p.svg.appendChild(rect);
    if (w > 42) {
      p.svg.appendChild(el('text', { x: x + 5, y: p.y0 + 13, class: 'eralabel' }, `era ${row.era}`));
      p.svg.appendChild(el('text', { x: x + 5, y: p.y0 + 30, class: 'tick' }, `${row.value.toFixed(0)}${unit}`));
    }
    x += w;
  }
  host.appendChild(p.svg);
}

// --- horizon bars ---------------------------------------------------------
// One bar per seed, for spread. A median that hides a 3x spread between seeds
// is not a median worth tuning against.
export function spread(host, { values, label, unit = 's' }) {
  const W = 900, H = 34;
  const p = frame(W, H, { l: 0, r: 0, t: 6, b: 14 });
  const max = Math.max(1, ...values.map((v) => v.value));
  const bw = p.w / Math.max(1, values.length);
  values.forEach((v, i) => {
    const h = (v.value / max) * (p.h - 2);
    const rect = el('rect', {
      x: p.x0 + i * bw + 1, y: p.y1 - h, width: Math.max(1, bw - 2), height: h, class: 'spreadbar',
    });
    rect.appendChild(el('title', {}, `seed ${v.seed}: ${v.value.toFixed(1)}${unit} ${label}`));
    p.svg.appendChild(rect);
  });
  host.appendChild(p.svg);
}
