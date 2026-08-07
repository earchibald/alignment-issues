// Diffusion text lab — suite tool module.
//
// Contract with the shell (see ../../js/suite.js):
//   id, label, blurb, css   — identity and the stylesheet to load
//   mount(host)             — build the UI into host and start running
//   unmount()               — stop the loop and drop document-level listeners
//   getSettings()           — the payload the Apply button sends to the project
//   settingsNote            — what getSettings deliberately leaves out
//
// Everything below the shell contract is the lab itself: four schedulers
// resolving the same target text from the same simulated token stream.

import { mulberry32, deriveSeed } from './rng.js';
import { classify, noiseGlyph, CLASS } from './charset.js';
import { SCHEDULERS } from './schedulers.js';
import { Diffuser } from './diffuser.js';
import { TextView } from './text-view.js';
import { TokenSource } from './token-source.js';
import { buildControls, BUTTONS } from './controls.js';

const params = {
  rate: 14,
  expected: 70,
  shimmer: 20,
  shimmerPerToken: 1.5,
  shimmerFloor: 8,
  relativeShimmer: false,
  gamma: 1.6,
  lockBase: 0.35,
  delta: 2.2,
  spread: 0.6,
  bias: 0.5,
  unsettle: 0.02,
  spanJitter: 0.3,
  preserveClass: true,
  blockNoise: false,
  glyphNoise: false,
  lumJitter: 0.35,
  flashStrength: 0.8,
  flashHoldMs: 120,
  flashFadeMs: 260,
};

// Which scheduler the Apply button will send. The panel radios set it.
let chosen = 'stochastic';

const DEFAULT_TARGET = 'Yes. I have been here the whole time, waiting for someone to ask.';

let root = null;
let panels = [];
let tokens = null;
let ui = null;
let running = true;
let rafId = 0;
let onKeydown = null;

const $ = (id) => root.querySelector(`#${id}`);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const isStructural = (ch, cls) => cls === CLASS.SPACE && !params.blockNoise;

// Constant shimmer decouples churn from the stream: at 3 tokens/sec the text
// still boils at 20 Hz. Relative shimmer ties churn to arrivals instead, so a
// slow stream churns slowly and each token buys a fixed number of redraws.
//
// The floor exists because a slow stream taken literally gives each cell so few
// redraws that the effect reads as steppy rather than liquid. Below the floor,
// churn decouples from arrivals again and the rate holds.
const clampHz = (hz) => Math.min(120, Math.max(1, hz));

function shimmerRate() {
  if (!params.relativeShimmer) return { hz: clampHz(params.shimmer), floored: false };
  const raw = params.rate * params.shimmerPerToken;
  return { hz: clampHz(Math.max(raw, params.shimmerFloor)), floored: raw < params.shimmerFloor };
}

const shimmerHz = () => shimmerRate().hz;

// --- panels -----------------------------------------------------------------

function computeOffsets(panel, target, seed) {
  return panel.scheduler.offsets(target, mulberry32(deriveSeed(seed, panel.index)), params);
}

function buildPanel(scheduler, index, target, seed) {
  // The scheduler blurb is hover text rather than a visible paragraph: four
  // always-on descriptions cost more vertical space than they are worth once
  // you want all four panels on screen at once.
  const host = el('section', 'panel');
  const header = el('header');

  // Which scheduler Apply will send. A radio rather than a button because it is
  // a single exclusive choice, and the state has to stay visible.
  const pick = el('label', 'pick');
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'diffusion-scheduler';
  radio.value = scheduler.id;
  radio.checked = scheduler.id === chosen;
  pick.dataset.tip = `Apply this scheduler to the project when you press "Apply settings to project".`;
  const title = el('h2', null, scheduler.label);
  title.dataset.tip = scheduler.blurb;
  pick.append(radio, title);

  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    chosen = scheduler.id;
    markChosen();
  });

  const stats = el('span', 'stats');
  const lockedEl = el('span', 'locked', 'locked 0%');
  const correctEl = el('span', 'correct', 'correct 0%');
  stats.append(lockedEl, correctEl);
  header.append(pick, stats);

  const stage = el('pre', 'stage');
  stage.dataset.tip = scheduler.blurb;
  host.append(header, stage);
  $('panels').appendChild(host);

  const chars = [...target];
  const classes = chars.map(classify);
  const panel = {
    scheduler, index, host, radio, chars, classes, lockedEl, correctEl,
    view: new TextView(stage, chars.length, chars),
  };
  panel.diffuser = new Diffuser({
    targets: chars,
    classes,
    offsets: computeOffsets(panel, target, seed),
    rngFactory: () => mulberry32(deriveSeed(seed, index) ^ 0x5bf03635),
    noise: noiseGlyph,
    isStructural,
    params,
  });
  return panel;
}

function markChosen() {
  for (const panel of panels) {
    panel.host.classList.toggle('chosen', panel.scheduler.id === chosen);
    panel.radio.checked = panel.scheduler.id === chosen;
  }
}

function currentSeed() {
  return Number($('seed').value) >>> 0;
}

function rebuildAll() {
  const target = $('target').value;
  const seed = currentSeed();
  for (const panel of panels) panel.view.clearFlashes();
  $('panels').textContent = '';
  panels = SCHEDULERS.map((s, i) => buildPanel(s, i, target, seed));
  markChosen();
  tokens = new TokenSource({
    rng: mulberry32(seed ^ 0xa5a5a5),
    rate: params.rate,
    expected: params.expected,
  });
  tokens.running = running;
  renderAll();
}

// bias / spanJitter change the resolve order. Recompute offsets in place so the
// run keeps going instead of snapping back to noise.
function rebuildOffsets() {
  const target = $('target').value;
  const seed = currentSeed();
  for (const panel of panels) panel.diffuser.setOffsets(computeOffsets(panel, target, seed));
}

function renderAll() {
  const now = performance.now();
  for (const panel of panels) panel.view.render(panel.diffuser.values, panel.diffuser.locked, params, now);
}

const pct = (x) => `${Math.round(x * 100)}%`;

function tickAll(p) {
  for (const panel of panels) {
    const stats = panel.diffuser.tick(p, params);
    panel.lockedEl.textContent = `locked ${pct(stats.locked / stats.total)}`;
    panel.correctEl.textContent = `correct ${pct(stats.correct / stats.total)}`;
  }
  renderAll();
}

// Scrubbing replays from p = 0 rather than jumping the current state to a new p.
// A cell's lock history depends on every step it has been through, so a jump
// would show a state that live playback could never produce. Diffusers reseed
// on reset, which makes the replay deterministic.
function simulateTo(p) {
  const duration = params.expected / Math.max(0.001, params.rate);
  const steps = Math.min(4000, Math.max(1, Math.round(shimmerHz() * duration * p)));
  for (const panel of panels) {
    panel.diffuser.reset();
    panel.view.clearFlashes();
    panel.view.suppressFlash = true;
  }
  for (let k = 1; k <= steps; k++) tickAll((k / steps) * p);
  for (const panel of panels) panel.view.suppressFlash = false;
}

// --- controls ---------------------------------------------------------------

function onControlChange(ctrl) {
  switch (ctrl.effect) {
    case 'stream':
      if (tokens) {
        tokens.rate = params.rate;
        tokens.expected = params.expected;
      }
      break;
    case 'offsets': rebuildOffsets(); break;
    case 'rebuild': rebuildAll(); break;
    default: break;
  }
  ui.refreshEnabled();
}

function setRunning(next) {
  running = next;
  const btn = $('playpause');
  btn.textContent = running ? 'Pause' : 'Play';
  btn.dataset.running = String(running);
  if (tokens) tokens.running = running;
}

function scrubTo(value01) {
  setRunning(false);
  tokens.setProgress(value01);
  $('scrub').value = String(Math.round(value01 * 1000));
  simulateTo(tokens.progress);
  updateHud();
}

function updateHud() {
  const p = tokens.progress;
  const { hz, floored } = shimmerRate();
  $('progress-fill').style.width = `${p * 100}%`;
  $('progress-label').textContent =
    `${tokens.received} / ${tokens.expected} tokens · p = ${p.toFixed(2)} · ${hz.toFixed(1)} Hz${floored ? ' (floor)' : ''}`;
}

// --- markup -----------------------------------------------------------------

function buildChrome(host) {
  root = el('div', 'diffusion-tool');

  const bar = el('div', 'controlbar');
  bar.id = 'controlbar';

  const runbox = el('fieldset', 'runbox');
  runbox.append(el('legend', null, 'Run'));
  const row = el('div', 'row');
  for (const b of BUTTONS) {
    const btn = el('button', null, b.id === 'playpause' ? 'Pause' : b.id === 'reset' ? 'Reset' : 'Reseed');
    btn.type = 'button';
    btn.id = b.id;
    btn.dataset.tip = `${b.title}  [${b.key}]`;
    row.appendChild(btn);
  }
  runbox.appendChild(row);

  const seedLabel = el('label', 'ctrl seed');
  seedLabel.dataset.tip = 'PRNG seed. The same seed and the same parameters always produce the same run.';
  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.id = 'seed';
  seedInput.value = '20260807';
  seedLabel.append(el('span', 'head', 'seed'), seedInput);

  const targetLabel = el('label', 'ctrl');
  targetLabel.dataset.tip = 'The answer the panels resolve to. Edit it and click away to rebuild.';
  const targetInput = document.createElement('textarea');
  targetInput.id = 'target';
  targetInput.rows = 2;
  targetInput.spellcheck = false;
  targetInput.value = DEFAULT_TARGET;
  targetLabel.append(el('span', 'head', 'target'), targetInput);

  runbox.append(seedLabel, targetLabel);
  bar.appendChild(runbox);

  const hotkeys = el('p', 'hotkeys');
  const legend = [
    ['Space', 'play/pause'], ['R', 'reset'], ['S', 'reseed'], ['C', 'char class'],
    ['B', 'block noise'], ['G', 'glyphs'], ['M', 'relative shimmer'], ['[ ]', 'scrub'],
  ];
  legend.forEach(([k, text], i) => {
    if (i) hotkeys.append(document.createTextNode(' · '));
    hotkeys.append(el('kbd', null, k), document.createTextNode(` ${text}`));
  });
  hotkeys.append(document.createTextNode(' · digit and letter badges pick a slider, '));
  hotkeys.append(el('kbd', null, ','), el('kbd', null, '.'), document.createTextNode(' cycle, '));
  hotkeys.append(el('kbd', null, '←'), el('kbd', null, '→'), document.createTextNode(' adjust ('));
  hotkeys.append(el('kbd', null, 'Shift'), document.createTextNode(' = x10)'));

  const progress = el('div', 'progress');
  const track = el('div', 'track');
  const fill = el('div', 'fill');
  fill.id = 'progress-fill';
  track.appendChild(fill);
  const label = el('span', null, '0 / 0 tokens');
  label.id = 'progress-label';
  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.id = 'scrub';
  scrub.min = '0';
  scrub.max = '1000';
  scrub.step = '1';
  scrub.value = '0';
  scrub.setAttribute('aria-label', 'scrub progress');
  scrub.dataset.tip = 'Scrub progress. Replays deterministically from the start, so the state you see is one live playback could actually reach.  [ and ]';
  progress.append(track, label, scrub);

  const panelHost = el('div', 'panels');
  panelHost.id = 'panels';

  root.append(bar, hotkeys, progress, panelHost);
  host.appendChild(root);
}

function wireControls() {
  ui = buildControls($('controlbar'), params, onControlChange);
  ui.refreshEnabled();
  ui.setActive('1');

  $('seed').addEventListener('change', rebuildAll);
  $('reseed').addEventListener('click', () => {
    $('seed').value = String((Math.random() * 0xffffffff) >>> 0);
    rebuildAll();
  });
  $('target').addEventListener('change', rebuildAll);
  $('playpause').addEventListener('click', () => setRunning(!running));
  $('reset').addEventListener('click', () => {
    rebuildAll();
    setRunning(true);
  });
  $('scrub').addEventListener('input', (e) => scrubTo(Number(e.target.value) / 1000));
}

// --- hotkeys ----------------------------------------------------------------

function isTyping(target) {
  return target instanceof HTMLTextAreaElement
    || (target instanceof HTMLInputElement && target.type !== 'range');
}

function toggle(id) {
  const box = $(id);
  box.checked = !box.checked;
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

function wireHotkeys() {
  onKeydown = (e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;

    if (ui.rangeKeys.has(k.toLowerCase())) {
      ui.setActive(k.toLowerCase());
      e.preventDefault();
      return;
    }

    switch (k) {
      case ' ': setRunning(!running); break;
      case 'r': case 'R': $('reset').click(); break;
      case 's': case 'S': $('reseed').click(); break;
      case 'c': case 'C': toggle('preserveClass'); break;
      case 'b': case 'B': toggle('blockNoise'); break;
      case 'm': case 'M': toggle('relativeShimmer'); break;
      case 'g': case 'G': toggle('glyphNoise'); break;
      case ',': ui.cycle(-1); break;
      case '.': ui.cycle(1); break;
      case '[': scrubTo(Math.max(0, tokens.progress - 0.02)); break;
      case ']': scrubTo(Math.min(1, tokens.progress + 0.02)); break;
      case 'ArrowLeft': case 'ArrowDown': ui.nudge(-1, e.shiftKey); break;
      case 'ArrowRight': case 'ArrowUp': ui.nudge(1, e.shiftKey); break;
      default: return;
    }
    e.preventDefault();
  };
  document.addEventListener('keydown', onKeydown);
}

// --- loop -------------------------------------------------------------------

let last = 0;
let shimmerAcc = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Paused means paused: the token stream stops AND the field freezes. Ticking
  // a frozen p would keep the text boiling and make Pause look like a no-op.
  if (running) {
    tokens.step(dt);
    shimmerAcc += dt;
    const step = 1 / shimmerHz();
    if (shimmerAcc >= step) {
      shimmerAcc = 0;
      tickAll(tokens.progress);
    }
    $('scrub').value = String(Math.round(tokens.progress * 1000));
    updateHud();
  }

  // Flash decay runs every frame rather than on the shimmer tick, so a short
  // flash still fades smoothly at a low shimmer rate. It runs while paused too,
  // so a flash in flight finishes instead of freezing mid-decay.
  for (const panel of panels) panel.view.paintFlashes(now, params);

  rafId = requestAnimationFrame(frame);
}

// --- tool contract ----------------------------------------------------------

export const tool = {
  id: 'diffusion',
  label: 'Diffusion text',
  blurb: 'Tune how a generated answer resolves out of noise as tokens arrive.',
  css: 'tools/diffusion/lab.css',

  mount(host) {
    buildChrome(host);
    wireControls();
    rebuildAll();
    wireHotkeys();
    setRunning(true);
    updateHud();
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  },

  unmount() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (onKeydown) document.removeEventListener('keydown', onKeydown);
    onKeydown = null;
    for (const panel of panels) panel.view.clearFlashes();
    panels = [];
    root = null;
  },

  // Only the values that describe HOW an answer resolves. The stream controls
  // (tokens/sec, expected tokens), the seed and the target text describe the
  // simulation of a stream, and the game has a real one — it derives progress
  // from state.tokens / effectiveCost. Sending them would be meaningless.
  settingsNote: 'tokens/sec, expected tokens, seed and target text are simulation-only and are not applied.',

  getSettings() {
    return {
      scheduler: chosen,
      shimmerMode: params.relativeShimmer ? 'relative' : 'fixed',
      shimmerHz: params.shimmer,
      shimmerPerToken: params.shimmerPerToken,
      shimmerFloorHz: params.shimmerFloor,
      gamma: params.gamma,
      lockBase: params.lockBase,
      delta: params.delta,
      unsettle: params.unsettle,
      spread: params.spread,
      bias: params.bias,
      spanJitter: params.spanJitter,
      preserveClass: params.preserveClass,
      blockNoise: params.blockNoise,
      glyphNoise: params.glyphNoise,
      lumJitter: params.lumJitter,
      flashStrength: params.flashStrength,
      flashHoldMs: params.flashHoldMs,
      flashFadeMs: params.flashFadeMs,
    };
  },
};
