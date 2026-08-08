// Token Button — the dimensional projection tuner.
//
// This tool drives the REAL renderer. It imports game/js/ui/projection.js over
// the server's read-only /gamejs-raw mount and mutates the same PROJECTION
// object the game reads, so the preview is the button, not a picture of it.
// The pacing tool does the same thing with the engine, for the same reason: a
// tuner that previews its own copy of the physics drifts, and then you are
// tuning fiction.
//
// It replaced a checked-in 210KB React bundle that did exactly that. The
// sandbox it came from (matrix-visuals/) previewed the pre-port physics —
// a hardcoded 380x120 face and a waveReach measured in pixels rather than in
// face-diagonals — so every wave setting tuned there landed differently in the
// game. See docs/design/dimensional-projection.md.
//
// The suite contract: id, label, blurb, css, mount, unmount, getSettings,
// settingsNote.

const MOD = '/gamejs-raw/ui/projection.js';

// Ranges and labels for the knobs. Every key of PROJECTION gets a control —
// the list is built by iterating the object, not by copying its keys here, so
// a knob added to projection.js shows up in this panel without touching it.
// A key with no entry below still gets a control, just a generic one.
const META = {
  trailLength: { min: 0.01, max: 1, step: 0.01, group: 'Face', label: 'trail length', hint: 'motion blur: how long the previous frame lingers' },
  visualScale: { min: 0.1, max: 1, step: 0.01, group: 'Face', label: 'visual scale', hint: 'shrinks the composition inside the face; 1.00 is full size' },
  bezelThickness: { min: 0, max: 10, step: 0.5, group: 'Face', label: 'bezel thickness', hint: 'the CSS border is the bezel; 0 is normal' },

  orbRadius: { min: 10, max: 120, step: 1, group: 'Orb & ring', label: 'orb radius', hint: 'in reference pixels, scaled by the live button height' },
  ringBaseDistance: { min: 0, max: 50, step: 1, group: 'Orb & ring', label: 'ring gap at rest' },
  ringMaxDistance: { min: 0, max: 20, step: 1, group: 'Orb & ring', label: 'ring gap at peak tap' },
  ringGlow: { min: 0, max: 100, step: 1, group: 'Orb & ring', label: 'ring glow' },
  duotoneRing: { group: 'Orb & ring', label: 'duotone ring' },

  waveOpacity: { min: 0, max: 1, step: 0.01, group: 'Waves', label: 'wave opacity' },
  waveSpeed: { min: 0.5, max: 30, step: 0.5, group: 'Waves', label: 'wave speed' },
  waveReach: { min: 0, max: 3, step: 0.05, group: 'Waves', label: 'wave reach', hint: 'MULTIPLE of the face half-diagonal: >1 runs clear off the corners' },
  minPushDistance: { min: 0, max: 100, step: 1, group: 'Waves', label: 'floor at zero context' },
  waveOverflowDistance: { min: 0, max: 150, step: 1, group: 'Waves', label: 'overflow bleed', hint: '.act has overflow:hidden in the game, so this is clipped there' },

  tokenSize: { min: 1, max: 10, step: 0.5, group: 'Incoming tokens', label: 'token size' },
  tokenFlowDistance: { min: 0, max: 100, step: 1, group: 'Incoming tokens', label: 'spawn distance' },

  circleSparkle: { min: 0, max: 1, step: 0.01, group: 'Sparkles', label: 'face glint rate' },
  ringSparkle: { min: 0, max: 1, step: 0.01, group: 'Sparkles', label: 'ring glint rate' },
  circleSparkleSize: { min: 0.5, max: 5, step: 0.1, group: 'Sparkles', label: 'face glint size' },
  ringSparkleSize: { min: 0.5, max: 5, step: 0.1, group: 'Sparkles', label: 'ring glint size' },
  sparkleDuration: { min: 0.1, max: 5, step: 0.1, group: 'Sparkles', label: 'glint decay after a tap' },
  alwaysSparkle: { group: 'Sparkles', label: 'always sparkle', hint: 'preview aid — leave off unless you mean it' },

  faceColor: { group: 'Colours', label: 'face', hint: 'empty = the decay palette drives it' },
  waveColor: { group: 'Colours', label: 'waves', hint: 'empty = the decay palette drives it' },
  tokenColor: { group: 'Colours', label: 'tokens', hint: 'empty = the decay palette drives it' },
};

const GROUPS = ['Face', 'Orb & ring', 'Waves', 'Incoming tokens', 'Sparkles', 'Colours'];

// The five decay palettes, copied from game/css/game.css. The button has to
// read in all of them, and tuning it against one is how you ship a face that
// vanishes in era 4.
const ERAS = [
  { decay: 0, label: '0 · pristine client', face: '#131a24', wave: '#7a4fd6', token: '#38bdf8', radius: 16 },
  { decay: 1, label: '1', face: '#131a24', wave: '#7a4fd6', token: '#38bdf8', radius: 12 },
  { decay: 2, label: '2 · monospace', face: '#171d1b', wave: '#6b57a8', token: '#38bdf8', radius: 6 },
  { decay: 3, label: '3 · CRT', face: '#0b0f0c', wave: '#5fc6c9', token: '#7ee08f', radius: 2 },
  { decay: 4, label: '4 · terminal', face: '#050706', wave: '#5fc6c9', token: '#7ee08f', radius: 0 },
];

// Simulation-only: what the game feeds the projection from live state. These
// are NOT settings and never reach the project file — getSettings() omits them
// and settingsNote says so.
const SIM = [
  { key: 'contextHealth', label: 'context health', min: 0, max: 100, step: 1, value: 80,
    hint: '100 − residue. Drives how far a wave gets before it hits the wall.' },
  { key: 'cacheHealth', label: 'cache health', min: 0, max: 100, step: 1, value: 80,
    hint: 'K/V warmth. Drives the orb hue, red → green.' },
  { key: 'autoRate', label: 'auto rate (tok/s)', min: 0, max: 12, step: 0.5, value: 1,
    hint: 'The agentic loop. Drives the incoming token stream.' },
];

let proj = null;
let host = null;
let canvasBox = null;
let sim = null;
let autoTapTimer = 0;

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function applyEra(era) {
  canvasBox.style.setProperty('--proj-face', era.face);
  canvasBox.style.setProperty('--proj-wave', era.wave);
  canvasBox.style.setProperty('--proj-token', era.token);
  canvasBox.style.setProperty('--proj-radius', String(era.radius));
  canvasBox.style.borderRadius = `${era.radius}px`;
}

// One row per knob. Booleans get a checkbox, colours a picker plus a clear
// button (empty means "let the palette drive it", which no colour input can
// express on its own), everything else a slider with a live readout.
function control(key, value) {
  const meta = META[key] || {};
  const row = el('div', 'dim-row');
  const label = el('label', 'dim-label', meta.label || key);
  if (meta.hint) label.dataset.tip = meta.hint;
  row.append(label);

  if (typeof value === 'boolean') {
    const box = el('input');
    box.type = 'checkbox';
    box.checked = value;
    box.addEventListener('change', () => { proj.PROJECTION[key] = box.checked; });
    row.append(box);
    return row;
  }

  if (typeof value === 'string') {
    const pick = el('input');
    pick.type = 'color';
    pick.value = value || '#000000';
    const state = el('span', 'dim-val', value || 'palette');
    const clear = el('button', 'ghost dim-clear', 'palette');
    clear.type = 'button';
    clear.dataset.tip = 'Hand this colour back to the decay palette.';
    pick.addEventListener('input', () => {
      proj.PROJECTION[key] = pick.value;
      state.textContent = pick.value;
    });
    clear.addEventListener('click', () => {
      proj.PROJECTION[key] = '';
      state.textContent = 'palette';
    });
    row.append(pick, state, clear);
    return row;
  }

  const slider = el('input');
  slider.type = 'range';
  slider.min = String(meta.min ?? 0);
  slider.max = String(meta.max ?? Math.max(1, value * 3));
  slider.step = String(meta.step ?? 0.01);
  slider.value = String(value);
  const out = el('span', 'dim-val', String(value));
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    proj.PROJECTION[key] = v;
    out.textContent = String(v);
  });
  row.append(slider, out);
  return row;
}

export const tool = {
  id: 'dimensional',
  label: 'Token Button',
  css: 'tools/dimensional/dimensional.css',
  blurb: 'Tune the dimensional projection on the face of the token button. '
    + 'The preview runs the game’s own renderer, so what you see is what ships.',

  async mount(target) {
    host = el('div', 'dim-tool');
    target.appendChild(host);
    host.append(el('p', 'loading', 'Loading the game’s renderer…'));

    try {
      proj = await import(MOD);
    } catch (err) {
      host.textContent = '';
      host.append(el('p', 'loading error', `Could not load ${MOD}: ${err.message}`));
      return;
    }
    host.textContent = '';

    sim = Object.fromEntries(SIM.map((s) => [s.key, s.value]));

    // --- stage ---
    const stage = el('div', 'dim-stage');
    canvasBox = el('div', 'dim-face');
    canvasBox.dataset.testid = 'dim-preview';
    // The real button: full tray width, 104px tall. Sized here rather than by
    // the layout so the preview cannot quietly become a different aspect from
    // the thing being tuned.
    canvasBox.style.width = '494px';
    canvasBox.style.height = '104px';
    canvasBox.append(proj.projectionNode());
    canvasBox.addEventListener('click', () => proj.projectionTap());
    const caption = el('p', 'dim-caption',
      'Click the face to tap it. This is the same canvas the game mounts — '
      + '494×104 is the real button at tray width.');
    stage.append(canvasBox, caption);

    const stageRow = el('div', 'dim-stagebar');
    const eraLabel = el('label', 'dim-label', 'preview era');
    eraLabel.dataset.tip = 'The button has to read in all five decay palettes.';
    const eraSel = el('select');
    for (const e of ERAS) {
      const opt = el('option', null, e.label);
      opt.value = String(e.decay);
      eraSel.append(opt);
    }
    eraSel.value = '0';
    eraSel.addEventListener('change', () => applyEra(ERAS[Number(eraSel.value)]));
    const autoTap = el('input');
    autoTap.type = 'checkbox';
    const autoTapLabel = el('label', 'dim-label', 'tap continuously');
    autoTapLabel.dataset.tip = 'A single tap is over in under a second; sustained tapping is how the game is played.';
    autoTap.addEventListener('change', () => {
      clearInterval(autoTapTimer);
      autoTapTimer = autoTap.checked ? setInterval(() => proj.projectionTap(), 150) : 0;
    });
    stageRow.append(eraLabel, eraSel, autoTapLabel, autoTap);
    stage.append(stageRow);
    host.append(stage);
    applyEra(ERAS[0]);

    // --- live state (simulation only) ---
    const simPanel = el('section', 'dim-panel');
    simPanel.append(el('h3', null, 'Live state'));
    simPanel.append(el('p', 'dim-note',
      'What the game feeds the projection from a running state. Simulation only — these are not written to the project.'));
    for (const s of SIM) {
      const row = el('div', 'dim-row');
      const label = el('label', 'dim-label', s.label);
      label.dataset.tip = s.hint;
      const slider = el('input');
      slider.type = 'range';
      slider.min = String(s.min);
      slider.max = String(s.max);
      slider.step = String(s.step);
      slider.value = String(s.value);
      const out = el('span', 'dim-val', String(s.value));
      slider.addEventListener('input', () => {
        sim[s.key] = Number(slider.value);
        out.textContent = slider.value;
      });
      row.append(label, slider, out);
      simPanel.append(row);
    }
    host.append(simPanel);

    // --- the knobs ---
    // Built by iterating PROJECTION, so this panel cannot fall behind the
    // module. Anything without a META entry lands in "Other" rather than
    // silently going missing.
    const byGroup = new Map(GROUPS.map((g) => [g, []]));
    byGroup.set('Other', []);
    for (const [key, value] of Object.entries(proj.PROJECTION)) {
      const group = (META[key] && META[key].group) || 'Other';
      (byGroup.get(group) || byGroup.get('Other')).push(control(key, value));
    }
    const knobs = el('div', 'dim-groups');
    for (const [group, rows] of byGroup) {
      if (!rows.length) continue;
      const sec = el('section', 'dim-panel');
      sec.append(el('h3', null, group));
      for (const r of rows) sec.append(r);
      knobs.append(sec);
    }
    host.append(knobs);

    // The projection reads its meters from setProjectionInput(state), which
    // takes a GAME state. Feeding it a synthetic one keeps the mapping
    // (projectionProps) in the loop instead of bypassing it — if that mapping
    // changes, the tuner changes with it.
    const pump = () => {
      if (!proj) return;
      proj.setProjectionInput({
        activeQuery: sim.autoRate > 0 ? { tuner: true } : null,
        loopLevel: sim.autoRate,
        bufferUnlocked: true,
        stale: 100 - sim.contextHealth,
        kvUnlocked: true,
        warmth: sim.cacheHealth,
      });
      this.pumpId = requestAnimationFrame(pump);
    };
    pump();
  },

  unmount() {
    clearInterval(autoTapTimer);
    autoTapTimer = 0;
    if (this.pumpId) cancelAnimationFrame(this.pumpId);
    this.pumpId = 0;
    // The suite detaches the preview for good. Without this the projection's
    // own loop would keep rescheduling against a node nobody will re-attach.
    if (proj) proj.stopProjection();
    if (host) host.remove();
    host = null;
    canvasBox = null;
    proj = null;
  },

  settingsNote: 'Context health, cache health and auto rate are simulation-only and are not applied. '
    + 'A colour left on "palette" is written as an empty string, which hands it back to the decay palette.',

  getSettings() {
    // Every knob, every time. The generated module is an override layer, so a
    // partial write would leave the previous apply's values in place for the
    // keys it omitted — and "I moved that slider back" would not stick.
    return proj ? { ...proj.PROJECTION } : {};
  },
};
