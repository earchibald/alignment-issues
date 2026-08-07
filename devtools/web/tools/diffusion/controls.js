// Single source of truth for the control bar: label, tooltip, hotkey, range and
// what changing it has to rebuild. The DOM is generated from this, so a control
// cannot end up with a stale tooltip or a hotkey that no longer matches.
//
// effect: 'live'     — the loop picks it up on the next step
//         'stream'   — push the value into the running TokenSource
//         'offsets'  — recompute scheduler offsets in place, keep the run going
//         'rebuild'  — full rebuild from noise

export const GROUPS = [
  {
    legend: 'Stream',
    controls: [
      {
        kind: 'range', id: 'rate', param: 'rate', key: '1', effect: 'stream',
        label: 'tokens/sec', min: 1, max: 60, step: 1,
        title: 'How fast simulated tokens arrive. Progress is p = tokens received / tokens expected, and p is what drives every panel.',
      },
      {
        kind: 'range', id: 'expected', param: 'expected', key: '2', effect: 'stream',
        label: 'expected', min: 10, max: 300, step: 5,
        title: 'How many tokens the answer is expected to take. p reaches 1 here and every remaining cell force-resolves.',
      },
      {
        kind: 'check', id: 'relativeShimmer', param: 'relativeShimmer', key: 'M', effect: 'live',
        label: 'relative shimmer',
        title: 'Off: cells churn at a constant Hz regardless of the stream. On: churn is tied to the token rate, so a slow stream churns slowly and each token buys a fixed number of redraws.',
      },
      {
        kind: 'range', id: 'shimmer', param: 'shimmer', key: '3', effect: 'live',
        label: 'shimmer Hz', min: 4, max: 60, step: 1, enabledWhen: (p) => !p.relativeShimmer,
        title: 'Constant churn rate: how many times per second an unlocked cell redraws. Used when relative shimmer is off. High values boil, low values feel deliberate.',
      },
      {
        kind: 'range', id: 'shimmerPerToken', param: 'shimmerPerToken', key: '4', effect: 'live',
        label: 'per token', min: 0.2, max: 8, step: 0.1, enabledWhen: (p) => p.relativeShimmer,
        title: 'Churn steps per token, used when relative shimmer is on. 1.0 means roughly one redraw per token that arrives. Effective Hz = tokens/sec x this.',
      },
      {
        kind: 'range', id: 'shimmerFloor', param: 'shimmerFloor', key: '=', effect: 'live',
        label: 'floor Hz', min: 1, max: 40, step: 1, enabledWhen: (p) => p.relativeShimmer,
        title: 'Lower bound on the effective churn rate when relative shimmer is on. A slow stream would otherwise give each cell so few redraws that the effect reads as steppy instead of liquid. The readout marks when this floor is what is actually driving the rate.',
      },
    ],
  },
  {
    legend: 'Resolve curve',
    controls: [
      {
        kind: 'range', id: 'gamma', param: 'gamma', key: '5', effect: 'live',
        label: 'gamma', min: 0.2, max: 6, step: 0.1,
        title: 'Correctness ramp. P(correct) = q^gamma, where q is the cell’s local progress. Higher means the true glyph appears later and more suddenly.',
      },
      {
        kind: 'range', id: 'lockBase', param: 'lockBase', key: '6', effect: 'live',
        label: 'lockBase', min: 0, max: 1, step: 0.01,
        title: 'Ceiling on the per-step chance that a correct glyph locks in. At 0 nothing ever sticks early and the whole answer snaps in at the end.',
      },
      {
        kind: 'range', id: 'delta', param: 'delta', key: '7', effect: 'live',
        label: 'delta', min: 0.5, max: 6, step: 0.1,
        title: 'Lock ramp. P(lock | correct) = lockBase x q^delta. Higher means correct-by-luck glyphs early on almost never stick, so cells keep churning.',
      },
      {
        kind: 'range', id: 'unsettle', param: 'unsettle', key: '8', effect: 'live',
        label: 'unsettle', min: 0, max: 0.2, step: 0.005,
        title: 'Chance per step that an already-locked cell comes loose again. This is remasking: at 0 the effect is a one-way wipe, above 0 cells visibly reconsider.',
      },
    ],
  },
  {
    legend: 'Schedule shape',
    controls: [
      {
        kind: 'range', id: 'spread', param: 'spread', key: '9', effect: 'live',
        label: 'spread', min: 0, max: 0.95, step: 0.01,
        title: 'How scattered the per-cell resolve windows are. At 0 every cell resolves on the same schedule as the whole field; higher values stagger them.',
      },
      {
        kind: 'range', id: 'bias', param: 'bias', key: '0', effect: 'offsets',
        label: 'bias (wave)', min: 0, max: 1, step: 0.01,
        title: 'Wavefront panel only. 0 = fully stochastic order, 1 = strict left-to-right wipe. The middle is the interesting part: a cursor with text still churning ahead of it.',
      },
      {
        kind: 'range', id: 'spanJitter', param: 'spanJitter', key: '-', effect: 'offsets',
        label: 'spanJitter', min: 0, max: 1, step: 0.02,
        title: 'Coarse-to-fine panel only. Randomness added to the span confidence ordering. At 0 spans resolve strictly shortest-and-punctuation-first.',
      },
      {
        kind: 'check', id: 'preserveClass', param: 'preserveClass', key: 'C', effect: 'live',
        label: 'preserve char class',
        title: 'Keep each cell’s character class stable: letters stay letters, digits stay digits, punctuation stays punctuation. Turn it off to see the effect read as static instead of as an answer arriving.',
      },
      {
        kind: 'check', id: 'blockNoise', param: 'blockNoise', key: 'B', effect: 'rebuild',
        label: 'block noise',
        title: 'Scramble whitespace too, so the answer starts as a solid block of noise the same length as the text. Spaces and line breaks then have to resolve like any other cell, and the layout reflows as they do.',
      },
    ],
  },
  {
    legend: 'Render',
    controls: [
      {
        kind: 'check', id: 'glyphNoise', param: 'glyphNoise', key: 'G', effect: 'live',
        label: 'glyphs in noise',
        title: 'Mix box-drawing, block, arrow, maths and Greek glyphs into the noise pool, so the unresolved field reads as "not language yet" rather than as scrambled words. About a third of noise draws come from the glyph pool.',
      },
      {
        kind: 'range', id: 'lumJitter', param: 'lumJitter', key: 'Q', effect: 'live',
        label: 'lum jitter', min: 0, max: 1, step: 0.02,
        title: 'Brightness variation on unsolved cells — unlocked AND still showing the wrong glyph. A cell that has landed on its true glyph holds steady even before it locks, so the field reads in three states. Purely visual: it never touches the simulation.',
      },
      {
        kind: 'range', id: 'flashStrength', param: 'flashStrength', key: 'W', effect: 'live',
        label: 'lock flash', min: 0, max: 2, step: 0.05,
        title: 'How much brighter a cell flashes at the moment it locks. 0 disables the flash. Lock is the moment worth marking: it is the cell committing to its answer.',
      },
      {
        kind: 'range', id: 'flashHoldMs', param: 'flashHoldMs', key: 'E', effect: 'live',
        label: 'hold ms', min: 0, max: 1200, step: 20,
        title: 'How long a lock flash stays at full strength before it starts to fade.',
      },
      {
        kind: 'range', id: 'flashFadeMs', param: 'flashFadeMs', key: 'T', effect: 'live',
        label: 'fade ms', min: 0, max: 1500, step: 20,
        title: 'How long the flash takes to fade out after the hold. At 0 the flash cuts out hard at the end of the hold instead of decaying.',
      },
    ],
  },
];

export const BUTTONS = [
  { id: 'playpause', key: 'Space', title: 'Start or pause the token stream. Cells keep churning while paused only if you scrub.' },
  { id: 'reset', key: 'R', title: 'Rebuild every panel from fresh noise and start the stream again.' },
  { id: 'reseed', key: 'S', title: 'Draw a new random seed and rebuild. Same seed always gives the same run.' },
];

const RANGE_KEYS = new Map();

function badge(key) {
  const kbd = document.createElement('kbd');
  kbd.textContent = key;
  return kbd;
}

// The label has to be an element, not a bare text node: a text node cannot be
// given text-overflow, so a long label overflows its column and pushes the value
// readout out of the row.
function name(text) {
  const span = document.createElement('span');
  span.className = 'name';
  span.textContent = text;
  return span;
}

function buildRange(ctrl, params, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'ctrl range';
  wrap.dataset.tip = `${ctrl.title}  [${ctrl.key}]`;
  wrap.dataset.id = ctrl.id;

  const head = document.createElement('span');
  head.className = 'head';
  head.append(badge(ctrl.key), name(ctrl.label));

  const out = document.createElement('output');
  out.textContent = params[ctrl.param];

  const input = document.createElement('input');
  input.type = 'range';
  input.id = ctrl.id;
  input.min = ctrl.min;
  input.max = ctrl.max;
  input.step = ctrl.step;
  input.value = params[ctrl.param];

  input.addEventListener('input', () => {
    params[ctrl.param] = Number(input.value);
    out.textContent = input.value;
    onChange(ctrl);
  });

  head.appendChild(out);
  wrap.append(head, input);
  RANGE_KEYS.set(ctrl.key.toLowerCase(), { ctrl, input, wrap });
  return wrap;
}

function buildCheck(ctrl, params, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'ctrl check';
  wrap.dataset.tip = `${ctrl.title}  [${ctrl.key}]`;
  wrap.dataset.id = ctrl.id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = ctrl.id;
  input.checked = Boolean(params[ctrl.param]);
  input.addEventListener('change', () => {
    params[ctrl.param] = input.checked;
    onChange(ctrl);
  });

  wrap.append(input, badge(ctrl.key), name(ctrl.label));
  return wrap;
}

/**
 * Build the control bar. Returns helpers the app needs afterwards.
 */
export function buildControls(host, params, onChange) {
  RANGE_KEYS.clear();
  for (const group of GROUPS) {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = group.legend;
    fs.appendChild(legend);
    for (const ctrl of group.controls) {
      fs.appendChild(
        ctrl.kind === 'range' ? buildRange(ctrl, params, onChange) : buildCheck(ctrl, params, onChange),
      );
    }
    host.appendChild(fs);
  }

  // Grey out whichever shimmer slider is not currently in play.
  function refreshEnabled() {
    for (const { ctrl, input, wrap } of RANGE_KEYS.values()) {
      if (!ctrl.enabledWhen) continue;
      const on = ctrl.enabledWhen(params);
      input.disabled = !on;
      wrap.classList.toggle('disabled', !on);
    }
  }

  let activeKey = null;
  function setActive(key) {
    activeKey = key;
    for (const [k, { wrap }] of RANGE_KEYS) wrap.classList.toggle('active', k === key);
  }

  function nudge(dir, big) {
    const entry = RANGE_KEYS.get(activeKey);
    if (!entry || entry.input.disabled) return;
    const step = Number(entry.input.step) * (big ? 10 : 1);
    const next = Number(entry.input.value) + dir * step;
    entry.input.value = String(Math.min(Number(entry.input.max), Math.max(Number(entry.input.min), next)));
    entry.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const order = [...RANGE_KEYS.keys()];
  function cycle(dir) {
    if (order.length === 0) return;
    const at = order.indexOf(activeKey);
    setActive(order[(at + dir + order.length) % order.length]);
  }

  return { refreshEnabled, setActive, nudge, cycle, hasActive: () => activeKey !== null, rangeKeys: RANGE_KEYS };
}
