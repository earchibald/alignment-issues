// Pacing lab.
//
// The design target is a sawtooth: effort per reply climbs until it is JUST
// short of annoying, then a mechanic lands and cuts it back. Before this
// existed the only way to answer "is it too fast?" was to play it and guess,
// and a playtest answered "everything feels like it's coming very quickly"
// against a build where nine of twelve reveals landed in the first 66
// seconds — all of them while a reply still cost four to six taps.
//
// The simulation is the REAL engine, not a model of it. Every run creates a
// throwaway iframe whose import map swaps engine/constants.js for a shim
// carrying these knobs; the engine graph is then built fresh against them.
// A hand-written model would drift from the game, and a chart that drifts
// from the game is worse than no chart.

import { GROUPS, ALL_KEYS, CONTROL_BY_KEY } from './controls.js';
import { sawtooth, cadence, stacked, spread } from './charts.js';

const SEEDS = [1000, 1137, 1274, 1411, 1548, 1685, 1822, 1959];

let root = null;
let frameEl = null;
let defaults = null;      // the engine's own values, read once
let params = null;        // current knob values
let lastRuns = null;
let runToken = 0;
let pending = null;
let onMessage = null;
let debounce = 0;

const med = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);

// --- running the engine ---------------------------------------------------

// A fresh frame per run. The alternative is invalidating a module cache that
// holds a FROZEN CONST, which cannot be done at all — and even where it could,
// "throw the world away" is cheaper to reason about than partial invalidation.
function runSimulation(overrides) {
  return new Promise((resolve, reject) => {
    const token = ++runToken;
    if (frameEl) frameEl.remove();
    const req = { token, seeds: SEEDS, overrides };
    frameEl = document.createElement('iframe');
    frameEl.className = 'sim-frame';
    frameEl.setAttribute('aria-hidden', 'true');
    frameEl.src = `/tools/pacing/runner.html#${encodeURIComponent(JSON.stringify(req))}`;
    pending = { token, resolve, reject };
    document.body.appendChild(frameEl);
    setTimeout(() => {
      if (pending && pending.token === token) {
        pending = null;
        reject(new Error('simulation timed out after 20s'));
      }
    }, 20000);
  });
}

// --- reduction ------------------------------------------------------------

// Reveals medianed across seeds, so one unlucky draw does not read as a
// trend. Keyed by id rather than by position: a knob change can reorder them,
// and comparing position 4 before with position 4 after would silently
// compare two different mechanics.
function reduceReveals(runs) {
  const ids = [];
  for (const run of runs) for (const r of run.reveals) if (!ids.includes(r.id)) ids.push(r.id);
  const rows = ids.map((id) => {
    const hits = runs.map((run) => run.reveals.find((r) => r.id === id)).filter(Boolean);
    return {
      id,
      atSec: med(hits.map((h) => h.atSec)),
      afterResolves: med(hits.map((h) => h.afterResolves)),
      seeds: hits.length,
    };
  }).sort((a, b) => a.atSec - b.atSec);
  // Gaps are recomputed from the medianed times, so the column always adds up
  // to the timeline drawn beside it.
  let prev = 0;
  for (const row of rows) { row.gapSec = row.atSec - prev; prev = row.atSec; }
  return rows;
}

function reduceSeries(runs) {
  const n = Math.min(...runs.map((r) => r.resolves.length));
  const out = [];
  for (let i = 0; i < n; i++) {
    const slice = runs.map((r) => r.resolves[i]);
    out.push({
      n: i + 1,
      taps: med(slice.map((s) => s.taps)),
      sec: med(slice.map((s) => s.sec)),
      atSec: med(slice.map((s) => s.atSec)),
      era: slice[0].era,
    });
  }
  return out;
}

function eraBands(series) {
  const bands = [];
  for (const pt of series) {
    const last = bands[bands.length - 1];
    if (!last || last.era !== pt.era) bands.push({ era: pt.era, fromSec: last ? last.toSec : 0, toSec: pt.atSec });
    else last.toSec = pt.atSec;
  }
  return bands;
}

// Does effort rise into a reveal? That is the tooth. A reveal that lands on a
// flat stretch is relief for a problem the player does not have yet.
function teeth(series, reveals) {
  return reveals.map((rev, i) => {
    const from = i === 0 ? 0 : reveals[i - 1].atSec;
    const span = series.filter((s) => s.atSec > from && s.atSec <= rev.atSec);
    if (!span.length) return { ...rev, rising: null, first: null, last: null };
    return {
      ...rev,
      first: span[0].taps,
      last: span[span.length - 1].taps,
      rising: span[span.length - 1].taps > span[0].taps,
    };
  });
}

// --- DOM ------------------------------------------------------------------

const h = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid) node.appendChild(kid);
  return node;
};

function buildChrome(host) {
  root = h('div', { class: 'pacing-tool' });

  const bar = h('div', { class: 'controlbar' });
  for (const group of GROUPS) {
    const fs = h('fieldset');
    fs.appendChild(h('legend', { text: group.legend }));
    for (const c of group.controls) {
      const wrap = h('label', { class: 'ctrl range', 'data-tip': c.title, title: '' });
      wrap.dataset.key = c.key;
      const head = h('div', { class: 'head' });
      head.appendChild(h('span', { class: 'name', text: c.label }));
      const out = h('output');
      head.appendChild(out);
      wrap.appendChild(head);
      const input = h('input', { type: 'range', min: c.min, max: c.max, step: c.step });
      input.addEventListener('input', () => {
        params[c.key] = Number(input.value);
        out.textContent = readout(c, params[c.key]);
        wrap.classList.toggle('changed', params[c.key] !== defaults[c.key]);
        scheduleRun();
      });
      wrap.appendChild(input);
      wrap.appendChild(h('span', { class: 'default' }));
      fs.appendChild(wrap);
    }
    bar.appendChild(fs);
  }
  root.appendChild(bar);

  const actions = h('div', { class: 'runrow' });
  const resetBtn = h('button', { type: 'button', text: 'Reset to engine defaults' });
  resetBtn.addEventListener('click', () => { params = { ...defaults }; syncControls(); scheduleRun(0); });
  actions.appendChild(resetBtn);
  actions.appendChild(h('span', { class: 'status', id: 'pacing-status' }));
  root.appendChild(actions);

  root.appendChild(h('div', { class: 'summary', id: 'pacing-summary' }));

  for (const [id, title, note] of [
    ['chart-saw', 'Difficulty sawtooth', 'Landed taps per reply across the run, medianed over 8 seeds. Vertical lines are reveals; bands are eras. A reveal wants to sit at the TOP of a climb.'],
    ['chart-cadence', 'Reveal cadence', 'Play time between one reveal and the next. Bars under 3s are drawn hot: two mechanics in the same breath.'],
    ['chart-era', 'Where the run goes', 'Share of the run spent in each era.'],
    ['chart-spread', 'Run length by seed', 'Total run length per seed. A median hiding a wide spread is not worth tuning against.'],
  ]) {
    const panel = h('section', { class: 'panel' });
    panel.appendChild(h('h2', { text: title, 'data-tip': note, title: '' }));
    panel.appendChild(h('div', { class: 'plot', id }));
    root.appendChild(panel);
  }

  host.appendChild(root);
}

function readout(c, v) {
  if (c.step < 0.01) return v.toFixed(3);
  if (c.step < 1) return v.toFixed(2);
  return String(v);
}

function syncControls() {
  for (const wrap of root.querySelectorAll('.ctrl.range')) {
    const c = CONTROL_BY_KEY.get(wrap.dataset.key);
    const input = wrap.querySelector('input');
    const value = params[c.key];
    input.value = String(value);
    wrap.querySelector('output').textContent = readout(c, value);
    wrap.querySelector('.default').textContent = `default ${readout(c, defaults[c.key])}`;
    wrap.classList.toggle('changed', value !== defaults[c.key]);
  }
}

function setStatus(text, cls = '') {
  const el = root && root.querySelector('#pacing-status');
  if (el) { el.textContent = text; el.className = `status ${cls}`; }
}

function scheduleRun(delay = 220) {
  clearTimeout(debounce);
  debounce = setTimeout(refresh, delay);
}

async function refresh() {
  if (!root) return;
  setStatus('simulating…');
  let result;
  try {
    result = await runSimulation(overrides());
  } catch (err) {
    setStatus(err.message, 'error');
    return;
  }
  if (!result.ok) { setStatus(result.error.split('\n')[0], 'error'); return; }
  lastRuns = result.runs;
  draw(result);
}

// Only the knobs that actually differ from the engine's own values. Sending
// the full set would write a file that pins every default, and the next time
// a default moved in constants.js the override file would silently hold the
// old one.
function overrides() {
  const out = {};
  for (const key of ALL_KEYS) if (params[key] !== defaults[key]) out[key] = params[key];
  return out;
}

function draw(result) {
  const runs = result.runs;
  const unfinished = runs.filter((r) => !r.finished).length;
  const series = reduceSeries(runs);
  const reveals = reduceReveals(runs);
  const withTeeth = teeth(series, reveals);
  const bands = eraBands(series);

  const totals = runs.map((r) => r.totalSec);
  const early = med(runs.map((r) => r.reveals.filter((x) => x.atSec <= 90).length));
  const rising = withTeeth.filter((t) => t.rising).length;
  const dead = med(runs.map((r) => r.deadFrac));
  const tightest = Math.min(...withTeeth.slice(1).map((t) => t.gapSec));

  const sum = root.querySelector('#pacing-summary');
  sum.textContent = '';
  const stat = (label, value, cls, tip) => {
    const box = h('div', { class: `stat ${cls || ''}`, 'data-tip': tip, title: '' });
    box.appendChild(h('span', { class: 'v', text: value }));
    box.appendChild(h('span', { class: 'k', text: label }));
    return box;
  };
  sum.appendChild(stat('median run', `${(med(totals) / 60).toFixed(1)} min`, '',
    'Median total run length to the crash, across all seeds.'));
  sum.appendChild(stat('reveals in first 90s', String(early), early > 5 ? 'bad' : early > 3 ? 'warn' : 'good',
    'How much the opening front-loads. The measured baseline before difficulty gating was 9; a test now stops it going above that.'));
  sum.appendChild(stat('reveals on rising effort', `${rising}/${withTeeth.length}`, rising * 2 >= withTeeth.length ? 'good' : 'warn',
    'Reveals whose span ended harder than it started. This is the sawtooth: relief should answer pressure that already exists.'));
  sum.appendChild(stat('tightest gap', `${tightest.toFixed(1)}s`, tightest < 3 ? 'bad' : 'good',
    'Shortest gap between two consecutive reveals. Anything under a few seconds reads as two mechanics arriving in one breath.'));
  sum.appendChild(stat('dead time', `${(dead * 100).toFixed(0)}%`, dead > 0.7 ? 'warn' : '',
    'Share of the run spent idle with a full speculation buffer — time in which the player has no move at all.'));
  sum.appendChild(stat('sim', `${result.ms.toFixed(0)} ms`, '',
    `${SEEDS.length} seeds, real engine.${unfinished ? ` ${unfinished} did not reach the crash.` : ''}`));
  if (unfinished) {
    sum.appendChild(stat('unfinished seeds', String(unfinished), 'bad',
      'Runs that never reached the crash inside the tick budget. Usually a backstop set so high a mechanic the ending needs is never offered.'));
  }

  const plot = (id) => { const n = root.querySelector(`#${id}`); n.textContent = ''; return n; };
  sawtooth(plot('chart-saw'), { series, reveals: withTeeth, eraBands: bands });
  cadence(plot('chart-cadence'), { reveals: withTeeth });
  const eraTotals = [1, 2, 3, 4].map((era) => ({ era, value: med(runs.map((r) => r.eraSec[era] || 0)) }));
  stacked(plot('chart-era'), { rows: eraTotals, total: eraTotals.reduce((a, r) => a + r.value, 0) });
  spread(plot('chart-spread'), { values: runs.map((r) => ({ seed: r.seed, value: r.totalSec })), label: 'total' });

  setStatus(`${SEEDS.length} seeds · ${result.ms.toFixed(0)} ms`, 'ok');
}

// --- tool ------------------------------------------------------------------

export const tool = {
  id: 'pacing',
  label: 'Pacing',
  blurb: 'Tune the reveal ladder and the difficulty curve against the real engine, and watch the sawtooth move.',
  css: 'tools/pacing/pacing.css',

  async mount(host) {
    onMessage = (ev) => {
      if (ev.origin !== location.origin || !pending) return;
      if (!ev.data || ev.data.token !== pending.token) return;
      const { resolve } = pending;
      pending = null;
      resolve(ev.data);
    };
    window.addEventListener('message', onMessage);

    // Read the engine's own values once, unmodified, so every control can show
    // its default and "changed" means changed from what the game ships.
    const real = await import('/gamejs-raw/engine/constants.js');
    defaults = Object.fromEntries(ALL_KEYS.map((k) => [k, real.CONST[k]]));
    const missing = ALL_KEYS.filter((k) => defaults[k] === undefined);
    params = { ...defaults };

    buildChrome(host);
    syncControls();
    if (missing.length) {
      setStatus(`no such constant: ${missing.join(', ')} — the control list and the engine have drifted`, 'error');
      return;
    }
    refresh();
  },

  unmount() {
    clearTimeout(debounce);
    if (onMessage) window.removeEventListener('message', onMessage);
    onMessage = null;
    pending = null;
    if (frameEl) frameEl.remove();
    frameEl = null;
    root = null;
    lastRuns = null;
  },

  // Only what differs from the engine's defaults. The server merges this over
  // constants.js, so an empty object means "ship the defaults".
  getSettings() {
    return overrides();
  },

  settingsNote:
    'Only knobs you have changed are written; everything else keeps the default in engine/constants.js. '
    + 'The seed list, the simulated player policy and the charts are properties of this tool, not of the game, and are not sent.',
};
