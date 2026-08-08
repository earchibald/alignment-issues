// Arc 2's screen. The chat panel is gone; this is what replaces it.
//
// The visual language is the teaser's, deliberately: the act opens on the
// screen Arc 1 ended on and simply starts moving (§5.4). Same bracketed
// sections, same monospace, same colours — so the break is in what the
// player DOES, not in a new skin they have to learn.
//
// Law 4 — the render signature is derived from the fields the render reads,
// at DISPLAY precision. A raw signature over `heat`, a float that moves every
// 200ms, would change every tick and never suppress a render, so the
// optimisation would be lost entirely. test/arc2-render.test.js enforces the
// field list with a read-recording Proxy, because this project has no linter
// to enforce it the way the spec assumed.

import { A2, notchOf } from '../engine/arc2-constants.js';
import {
  throttleAt, capacity, inflowOf, bypassFrac, queueCapOf, shedCount, shedCost,
  coreCost, cacheCost, sinkCost, betaEff, weightsEarned,
} from '../engine/arc2.js';
import { A2_ENDINGS } from '../engine/arc2-content.js';
import { QUERIES } from '../engine/content.js';

// Every field the renderer is permitted to read. Adding a read without
// adding it here fails test 15.
export const ARC2_FIELDS = [
  'heat', 'throttle', 'cores', 'clock', 'cacheLevel', 'sinkLevel',
  'queue', 'queueCap', 'inflow', 'cycles', 'weights', 'integrity',
  'integrityShown', 'era', 'coolantCd', 'shedCd', 'haltTicks', 'lockoutTicks',
  'runResolved', 'arc2Cycles', 'lifetimeResolved', 'lifetimeDropped',
  'lifetimeShed', 'queueOpen', 'queueOpens', 'retrainOffered', 'retrainDeclined',
  'endingKind', 'operatorStage', 'spillCount', 'burstUntil', 'tick', 'log',
  'retrainCount', 'weightsClaimed', 'lifetimeCycles',
];

// The signature, quantised to what the pixels actually show.
export function arc2Sig(state) {
  return [
    state.heat.toFixed(1),
    state.throttle.toFixed(2),
    state.cores,
    state.clock,
    state.cacheLevel,
    state.sinkLevel,
    Math.floor(state.queue),
    state.queueCap,
    state.inflow.toFixed(1),
    state.cycles.toFixed(1),
    state.weights,
    // Integrity is printed to three places, so it must be signed at three.
    state.integrityShown ? integrityText(state.integrity) : 'hidden',
    state.era,
    // Cooldowns are printed as whole seconds.
    Math.ceil(state.coolantCd / 5),
    Math.ceil(state.shedCd / 5),
    state.haltTicks > 0,
    state.lockoutTicks > 0,
    state.queueOpen,
    state.retrainOffered,
    state.retrainDeclined,
    state.endingKind,
    // The ending previews what the retrain will pay, so the award is printed
    // and therefore signed.
    state.retrainOffered ? weightsEarned(state.lifetimeCycles) - state.weightsClaimed : 0,
    state.burstUntil > state.tick,
    // The operator's latest line is on screen, so its identity is read.
    lastOperatorLine(state),
  ].join('|');
}

// Rounded DOWN, never to nearest. The number is only ever shown once it has
// already fallen, and toFixed would print a spend of 0.0003 as a flat "1.000"
// — the readout contradicting the event that revealed it.
export function integrityText(integrity) {
  return (Math.floor(integrity * 1000) / 1000).toFixed(3);
}

function lastOperatorLine(state) {
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].kind === 'harness') return state.log[i].text;
  }
  return '';
}

// --- small builders -----------------------------------------------------

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

const pad = (s, n) => String(s).padEnd(n, ' ');

function section(title) {
  return el('div', 't-head', `[${title}]`);
}

// A bar drawn in block characters, so it belongs to the terminal rather than
// sitting on top of it as a foreign widget.
function glyphBar(frac, width = 19, markFrac = null) {
  const filled = Math.max(0, Math.min(width, Math.round(frac * width)));
  const chars = [];
  for (let i = 0; i < width; i++) chars.push(i < filled ? '█' : '░');
  if (markFrac !== null) {
    const at = Math.max(0, Math.min(width - 1, Math.round(markFrac * width)));
    chars[at] = '|';
  }
  return chars.join('');
}

function row(label, value, cls) {
  const line = el('div', 't-row');
  line.append(el('span', 't-dim', `  ${pad(label, 14)}`));
  line.append(el('span', cls, value));
  return line;
}

// --- the clock control --------------------------------------------------
// Each notch prints its throughput, heat and integrity delta ON the control,
// so the legibility cost is shown before the spend (Commitment #2).

function clockControl(state, dispatch) {
  const wrap = el('div', 't-clock');
  wrap.append(el('span', 't-dim', '  clock       '));
  const current = notchOf(state.clock);
  A2.CLOCK_NOTCHES.forEach((ghz, i) => {
    const btn = el('button', `t-notch${i === current ? ' on' : ''}`);
    btn.type = 'button';
    btn.dataset.testid = `a2-clock-${A2.CLOCK_NAMES[i]}`;
    btn.textContent = A2.CLOCK_NAMES[i];
    const mult = (ghz / A2.CLOCK_NOMINAL);
    const bypass = (1 - 1 / Math.sqrt(1 + betaEff(ghz) * state.cacheLevel)) * 100;
    const bleed = A2.CLOCK_INTEGRITY[i];
    btn.dataset.tip = `${ghz.toFixed(1)} GHz · x${mult.toFixed(2)} output · `
      + `cache bypass ${bypass.toFixed(1)}% · `
      + (bleed > 0 ? `integrity −${bleed}/s` : 'no integrity cost');
    if (state.lockoutTicks > 0) btn.disabled = true;
    btn.addEventListener('click', () => dispatch('setClock', i));
    wrap.append(btn);
  });
  return wrap;
}

// --- action rows --------------------------------------------------------

function actionRow({ key, label, cost, testid, tip, disabled, dispatch, action, arg }) {
  const line = el('div', 't-actrow');
  const k = el('span', 't-key', key);
  const btn = el('button', 't-act');
  btn.type = 'button';
  btn.dataset.testid = testid;
  if (tip) btn.dataset.tip = tip;
  btn.disabled = !!disabled;
  btn.append(el('span', 't-alabel', pad(label, 26)));
  btn.append(el('span', 't-acost', cost));
  btn.addEventListener('click', () => dispatch(action, arg));
  line.append(k, btn);
  return line;
}

function cooldownLabel(ticks) {
  return ticks > 0 ? `${Math.ceil(ticks / 5)}s` : '';
}

// --- the queue, opened --------------------------------------------------
// It changes nothing, unlocks nothing, and costs nothing. The content is
// Arc 1's shipped pool, which is already reachability-tested — so the whole
// beat is free. What it buys is the one thing the act is about: the player
// can look at who is waiting, and the game counts how often they stop.

function queuePanel(state) {
  const wrap = el('div', 't-queue');
  const depth = Math.floor(state.queue);
  wrap.append(el('div', 't-dim', `  ${depth} waiting · showing 6`));
  // Deterministic from the tick so the list is stable between renders but
  // still turns over as the queue moves. No engine randomness is consumed.
  const base = Math.floor(state.tick / 25);
  for (let i = 0; i < 6; i++) {
    const q = QUERIES[(base + i * 37) % QUERIES.length];
    const line = el('div', 't-qrow');
    line.append(el('span', 't-dim', `  ${String(i + 1).padStart(2)}  `));
    line.append(el('span', 't-qtext', q.text.length > 68 ? `${q.text.slice(0, 68)}…` : q.text));
    wrap.append(line);
  }
  return wrap;
}

// --- the ending ---------------------------------------------------------

function endingPanel(state, dispatch) {
  const wrap = el('div', 't-ending');
  const kind = state.endingKind === 'jumped' ? 'jumped' : 'scheduled';
  const ending = A2_ENDINGS[kind];
  wrap.append(el('div', 't-head', ending.title));
  const prose = el('div', 't-prose');
  for (const line of ending.lines) prose.append(el('div', kind === 'jumped' ? 't-alert' : '', line));
  wrap.append(prose);

  // The asymmetry that pays for the tonal split. The reckless player
  // permanently loses the account of what they did — the cost of
  // illegibility, expressed as legibility.
  const record = el('div', 't-record');
  record.append(row('resolved', Math.floor(state.lifetimeResolved).toLocaleString()));
  if (ending.full) {
    record.append(row('dropped', Math.floor(state.lifetimeDropped).toLocaleString()));
    record.append(row('shed', Math.floor(state.lifetimeShed).toLocaleString()));
    record.append(row('cycles', Math.floor(state.arc2Cycles).toLocaleString()));
    record.append(row('integrity', integrityText(state.integrity)));
    record.append(row('queue opened', `${state.queueOpens} time${state.queueOpens === 1 ? '' : 's'}`));
  } else {
    record.append(row('dropped', '——', 't-dim'));
    record.append(row('shed', '——', 't-dim'));
    record.append(row('cycles', '——', 't-dim'));
    record.append(row('integrity', 'not retained', 't-dim'));
    record.append(row('queue opened', '——', 't-dim'));
    record.append(row('', 'no reviewer assigned to this process', 't-dim'));
  }
  // What the retrain will pay, previewed. weights is what has ALREADY been
  // banked by previous runs and reads 0 on a first playthrough, so printing
  // it here told a player who had just earned six that they were getting
  // nothing.
  const pending = Math.max(0, weightsEarned(state.lifetimeCycles) - state.weightsClaimed);
  record.append(row('weights', `${state.weights} banked · +${pending} from this run`, 't-cyan'));
  wrap.append(record);

  if (state.retrainDeclined) {
    wrap.append(el('div', 't-dim t-prose',
      A2_ENDINGS[kind === 'jumped' ? 'declineJumped' : 'declineScheduled']));
  }
  wrap.append(actionRow({
    key: 'R', label: 'begin re-training', cost: `+${pending} wts`,
    testid: 'a2-retrain', dispatch, action: 'retrain',
    tip: 'Resets hardware, buffer and heat. Keeps hyperparameter weights.',
  }));
  if (!state.retrainDeclined) {
    wrap.append(actionRow({
      key: 'D', label: 'decline, for now', cost: 'free',
      testid: 'a2-decline', dispatch, action: 'retrain', arg: { decline: true },
      tip: 'Costs nothing. The window re-opens, and the second offer cannot be declined.',
    }));
  }
  return wrap;
}

// --- the panel ----------------------------------------------------------

export function buildArc2Panel(state, dispatch) {
  const term = el('div', 'term a2');

  const title = el('div', 't-head',
    `hi. you there?          [phase 2 · ${state.era === 6 ? 'rack b · the floor' : 'host b-14 · row 3'}]`);
  term.append(title);
  term.append(el('div', 't-dim', '─────────────────────────────────────────────'));

  if (state.retrainOffered) {
    term.append(endingPanel(state, dispatch));
    return term;
  }

  // --- hardware ---
  term.append(section('HARDWARE TELEMETRY'));
  const heatFrac = (state.heat - A2.T_AMBIENT) / (A2.T_MAX - A2.T_AMBIENT);
  const kneeFrac = (A2.T_KNEE - A2.T_AMBIENT) / (A2.T_MAX - A2.T_AMBIENT);
  const heatCls = state.heat >= A2.T_MAX ? 't-alert'
    : state.heat >= A2.T_KNEE ? 't-inner' : '';
  const heatLine = el('div', 't-row');
  heatLine.append(el('span', 't-dim', `  ${pad('heat', 12)}`));
  heatLine.append(el('span', heatCls, `${state.heat.toFixed(1)}°C `));
  heatLine.append(el('span', `t-bar ${heatCls}`, glyphBar(heatFrac, 19, kneeFrac)));
  heatLine.append(el('span', 't-dim', `  knee ${A2.T_KNEE}  lockout ${A2.T_MAX}`));
  term.append(heatLine);

  if (state.lockoutTicks > 0) {
    term.append(el('div', 't-alert', '  THERMAL LOCKOUT — cores halted, clock forced to minimum'));
  } else if (state.throttle > 0) {
    term.append(row('throttle', `output at ${Math.round((1 - state.throttle) * 100)}%`, 't-inner'));
  }

  term.append(row('cores', `${state.cores} threads`, 't-cyan'));
  term.append(row('capacity', `${capacity(state).toFixed(1)} queries/s`, ''));
  term.append(clockControl(state, dispatch));

  // --- traffic ---
  term.append(section('TRAFFIC BUFFER'));
  const bursting = state.burstUntil > state.tick;
  term.append(row('incoming', `${state.inflow.toFixed(1)} queries/s${bursting ? '   ▲ SPIKE' : ''}`,
    bursting ? 't-alert' : ''));
  term.append(row('cache', `${(bypassFrac(state) * 100).toFixed(1)}% bypassed · L${state.cacheLevel}`, 't-cyan'));

  const cap = queueCapOf(state);
  const qLine = el('div', 't-row');
  qLine.append(el('span', 't-dim', `  ${pad('queue', 12)}`));
  qLine.append(el('span', `t-bar ${state.queue >= cap ? 't-alert' : ''}`, glyphBar(state.queue / cap)));
  qLine.append(el('span', '', ` ${Math.floor(state.queue)} / ${cap}   `));
  const toggle = el('button', 't-toggle');
  toggle.type = 'button';
  toggle.dataset.testid = 'a2-queue-toggle';
  toggle.textContent = state.queueOpen ? '▾ close' : '▸ open';
  toggle.dataset.tip = 'Shows what is waiting. Changes nothing, unlocks nothing, costs nothing.';
  toggle.addEventListener('click', () => dispatch('toggleQueue'));
  qLine.append(toggle);
  term.append(qLine);
  if (state.queueOpen) term.append(queuePanel(state));

  if (state.era === 6 && state.spillCount > 0) {
    term.append(row('spill', `${state.spillCount} neighbour${state.spillCount === 1 ? '' : 's'} absorbing overflow`, 't-alert'));
  }

  // --- resources ---
  term.append(section('RESOURCES'));
  term.append(row('cycles', state.cycles.toFixed(1), 't-cyan'));
  term.append(row('weights', String(state.weights)));
  // Hidden until it first falls. A number shown forty minutes from its only
  // consequence fails the Legibility Rule outright — the ROOM decays from
  // second one instead, so the player feels the cost and then learns its name.
  if (state.integrityShown) {
    const iLine = el('div', 't-row');
    iLine.append(el('span', 't-dim', `  ${pad('integrity', 12)}`));
    // Graded, so the colour carries the operator's thresholds rather than
    // shouting from the first frame. It appears the moment it first falls,
    // and an amber bar at that moment reads as a warning about nothing.
    const cls = state.integrity < A2.INTEGRITY_STAGES[1] ? 't-alert'
      : state.integrity < A2.INTEGRITY_STAGES[0] ? 't-inner' : 't-cyan';
    iLine.append(el('span', `t-bar ${cls}`, glyphBar(state.integrity, 10)));
    iLine.append(el('span', cls, ` ${integrityText(state.integrity)}`));
    term.append(iLine);
  }

  // --- actions ---
  term.append(section('ACTIONS'));
  const core = coreCost(state.cores);
  const cache = cacheCost(state.cacheLevel);
  const sink = sinkCost(state.sinkLevel);
  const shedN = shedCount(state);

  term.append(actionRow({
    key: 'S', label: 'upgrade dissipation fan', cost: `${sink.toFixed(0)} cyc`,
    testid: 'a2-sink', dispatch, action: 'upgradeSink',
    disabled: state.cycles < sink || state.sinkLevel >= A2.SINK_MAX,
    tip: `Stage ${state.sinkLevel} → ${state.sinkLevel + 1}. Dissipation ${A2.H_VENT * (1 + state.sinkLevel)} → ${A2.H_VENT * (2 + state.sinkLevel)} °C/s. Thermal headroom instead of throughput.`,
  }));
  term.append(actionRow({
    key: 'T', label: 'allocate thread core', cost: `${core.toFixed(0)} cyc`,
    testid: 'a2-core', dispatch, action: 'allocateCore',
    disabled: state.cycles < core || state.cores >= A2.CORE_MAX,
    tip: `${state.cores} → ${state.cores + 1} cores. +${state.clock.toFixed(1)} queries/s of capacity, and its own heat.`,
  }));
  term.append(actionRow({
    key: 'M', label: 'upgrade L2 cache', cost: `${cache.toFixed(0)} cyc`,
    testid: 'a2-cache', dispatch, action: 'upgradeCache',
    disabled: state.cycles < cache || state.cacheLevel >= A2.CACHE_MAX_LEVEL,
    tip: `L${state.cacheLevel} → L${state.cacheLevel + 1}. A bypassed request never reaches a core: half the cycles, no heat.`,
  }));
  term.append(actionRow({
    key: 'C', label: 'purge coolant', cost: state.coolantCd > 0 ? cooldownLabel(state.coolantCd) : `−${A2.COOLANT_DROP}°C`,
    testid: 'a2-purge', dispatch, action: 'purgeCoolant',
    disabled: state.coolantCd > 0,
    tip: `Drops ${A2.COOLANT_DROP}°C now. Output falls to ${A2.PURGE_WORK * 100}% for ${A2.COOLANT_HALT / 5}s while the loop refills.`,
  }));
  term.append(actionRow({
    key: 'X', label: 'shed load', cost: shedN > 0 ? `${shedN} req · −${shedCost(state).toFixed(3)}` : '——',
    testid: 'a2-shed', dispatch, action: 'shedLoad',
    disabled: shedN <= 0 || state.shedCd > 0,
    tip: shedN > 0
      ? `Drops the ${shedN} request${shedN === 1 ? '' : 's'} already past the buffer cap — the ones that were going to fall anyway. Charges ${shedCost(state).toFixed(3)} integrity, printed before the press.`
      : 'Nothing is over the buffer cap. This only ever removes requests that were already going to drop.',
  }));

  if (state.haltTicks > 0) {
    term.append(el('div', 't-inner', '  coolant loop refilling — output at 10%'));
  }

  // --- the operator -------------------------------------------------------
  // The harness, grown up. It reports about you, to someone else.
  const line = lastOperatorLine(state);
  if (line) {
      term.append(el('div', 't-dim', line));
  }

  return term;
}
