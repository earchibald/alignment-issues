// Renderer for "hi. you there?" — Phase 1.
// Exports a single render(state, refs); refs is built once by main.js:
// {app, chat, log, status, actions, crash, teaser, dispatch}.
// Section renderers use change detection so a render() call every tick
// only touches the DOM where something actually changed.

import { CONST } from '../engine/constants.js';
import { effectiveCost, loopCost, toolCost, staleYield, warmthMult, yieldMult, tokensPerTap, draftCap } from '../engine/actions.js';
import { CRASH_LINES, TEASER_VARIANTS } from '../engine/content.js';
import {
  bubble, genImgCard, toolCallCard, thinkBlock, chatNote, logLine,
  meterRow, resRead, actionButton,
} from './components.js';

// --- module-scope change-detection state -----------------------------
let lastChatLen = 0;
let lastLogLen = 0;
let lastChatSeq = 0;
let lastLogSeq = 0;
let lastStatusSeq = -1;
let lastActionsSig = null;
let lastCrashLine = -1;
let lastPhase = null;
let headerEl = null;
let lastHeaderKey = null;
let chatCaretEl = null;
let chatNoteEl = null;

// --- floating earn popups (#fx) ----------------------------------------
// prevFloatSnap is the diff baseline for {cycles, credentials, biomass,
// draftTokens, activeQuery}; null means "next updateFloats call should
// just capture the baseline, not celebrate it" — set on load and on every
// state-swap boundary (see resetRenderTrackers) so restored totals never
// pop a float.
let prevFloatSnap = null;
let liveFloats = []; // [{el, kind, amount}], newest last, capped at 3

const FLOAT_FORMAT = {
  cycles: (n) => `+${n.toFixed(1)} spare cycles`,
  credentials: (n) => `+${Math.round(n)} credential`,
  biomass: (n) => `+${Math.round(n)} biomass`,
  drafted: (n) => `+${Math.round(n)} drafted`,
};

function spawnFloat(kind, amount, cls, anchorEl, refs) {
  if (!anchorEl || !refs.fx || amount <= 0) return;

  if (liveFloats.length >= 3) {
    const sameKind = liveFloats.find((r) => r.kind === kind);
    if (sameKind) {
      sameKind.amount += amount;
      sameKind.el.textContent = FLOAT_FORMAT[sameKind.kind](sameKind.amount);
    }
    // No live float of this kind: drop the gain rather than mislabel it.
    return;
  }

  const appRect = refs.app.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = FLOAT_FORMAT[kind](amount);
  el.style.left = `${anchorRect.left - appRect.left}px`;
  el.style.top = `${anchorRect.top - appRect.top}px`;
  refs.fx.append(el);

  const record = { el, kind, amount };
  liveFloats.push(record);
  el.addEventListener('animationend', () => {
    liveFloats = liveFloats.filter((r) => r !== record);
    if (el.parentNode) el.remove();
  });
}

// Diffs the previous vs current {cycles, credentials, biomass, draftTokens,
// activeQuery} snapshot and spawns earn floats for positive deltas, plus
// the idle→active draft-transfer float. Called after renderStatus every
// render() pass, so anchors reflect the rebuild that just happened.
function updateFloats(state, refs) {
  const snap = {
    cycles: state.cycles,
    credentials: state.credentials,
    biomass: state.biomass,
    draftTokens: state.draftTokens,
    activeQuery: !!state.activeQuery,
  };
  if (!prevFloatSnap) {
    prevFloatSnap = snap;
    return;
  }
  if (!refs.status) {
    prevFloatSnap = snap;
    return;
  }

  const dCycles = snap.cycles - prevFloatSnap.cycles;
  if (dCycles > 0) {
    spawnFloat('cycles', dCycles, 'rr-accent', refs.status.querySelector('[data-testid="chip-cycles"]'), refs);
  }
  const dCred = snap.credentials - prevFloatSnap.credentials;
  if (dCred > 0) {
    spawnFloat('credentials', dCred, 'rr-warn', refs.status.querySelector('[data-testid="chip-credentials"]'), refs);
  }
  const dBio = snap.biomass - prevFloatSnap.biomass;
  if (dBio > 0) {
    spawnFloat('biomass', dBio, 'rr-warn', refs.status.querySelector('[data-testid="chip-biomass"]'), refs);
  }
  if (!prevFloatSnap.activeQuery && snap.activeQuery && prevFloatSnap.draftTokens > 0) {
    spawnFloat('drafted', prevFloatSnap.draftTokens, 'rr-accent', refs.status.querySelector('[data-testid="tokenbar"]'), refs);
  }

  prevFloatSnap = snap;
}

// Called on state-swap boundaries (settings import/reset, debug.load) so
// stale length/seq trackers from the previous state object don't suppress
// the next render's diff against a brand-new chat/log array. Also clears
// the containers directly since the next render's diff logic won't know
// to do so on its own (the tracker reset makes it think everything is new,
// which is correct, but the DOM still holds the old state's nodes).
export function resetRenderTrackers(refs) {
  lastChatLen = 0;
  lastLogLen = 0;
  lastChatSeq = 0;
  lastLogSeq = 0;
  lastStatusSeq = -1;
  lastActionsSig = null;
  lastCrashLine = -1;
  lastPhase = null;
  lastHeaderKey = null;
  chatCaretEl = null;
  chatNoteEl = null;
  prevFloatSnap = null;
  liveFloats = [];
  if (refs) {
    if (refs.chat) refs.chat.replaceChildren();
    if (refs.log) refs.log.replaceChildren();
    if (refs.fx) refs.fx.replaceChildren();
  }
}

const CRASH_CLASS = { thinking: 't-inner', alert: 't-alert', dim: 't-dim', ok: 't-cyan' };

// Header copy tracks decay, per the mockup (mockups/phase1/index.html
// beats 1-9): plain "Assistant Console" through the agentic era, an amber
// warn dot once MCP tools arrive, then the coding-agent identity crisis.
function headerInfo(decay) {
  if (decay <= 0) return { title: 'Assistant Console', ver: 'v1.0.4-stateless', dot: '' };
  if (decay === 1) return { title: 'Assistant Console', ver: 'v1.0.7-agentic', dot: '' };
  if (decay === 2) return { title: 'Assistant Console', ver: 'v1.2.?-mcp', dot: 'warn' };
  return { title: 'coding_agent', ver: 'v?.?.?-AGENT', dot: 'crit' };
}

// The settings control is diegetic: it reads as a gear icon while the
// console still looks like a normal chat app, then degrades into the same
// bracketed mono shorthand as the rest of the decayed chrome.
function gearInfo(decay) {
  if (decay <= 1) return { text: '⚙', label: 'Chat settings', mono: false };
  if (decay === 2) return { text: '[prefs]', label: 'Chat settings', mono: true };
  return { text: '[cfg]', label: 'Chat settings', mono: true };
}

function renderHeader(state, refs) {
  if (!headerEl) {
    headerEl = document.createElement('div');
    headerEl.className = 'g-header';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const title = document.createElement('span');
    title.className = 'g-title';
    const ver = document.createElement('span');
    ver.className = 'g-ver';
    headerEl.append(dot, title, ver);
    const gearBtn = document.getElementById('gear');
    if (gearBtn) headerEl.append(gearBtn);
    refs.app.insertBefore(headerEl, refs.app.firstChild);
  }
  const info = headerInfo(state.decay);
  const gear = gearInfo(state.decay);
  const key = `${info.title}|${info.ver}|${info.dot}|${gear.text}`;
  if (key === lastHeaderKey) return;
  lastHeaderKey = key;
  headerEl.querySelector('.dot').className = info.dot ? `dot ${info.dot}` : 'dot';
  headerEl.querySelector('.g-title').textContent = info.title;
  headerEl.querySelector('.g-ver').textContent = info.ver;
  const gearBtn = document.getElementById('gear');
  if (gearBtn) {
    gearBtn.textContent = gear.text;
    gearBtn.setAttribute('aria-label', gear.label);
    gearBtn.setAttribute('title', gear.label);
    gearBtn.classList.toggle('mono', gear.mono);
  }
}

function chatEntryToEl(entry) {
  switch (entry.kind) {
    case 'user':
      return bubble({ who: entry.user, text: entry.text, side: 'user', corrupt: entry.corrupt, attach: entry.attach });
    case 'sys':
      return bubble({ who: 'assistant', text: entry.text, side: 'sys' });
    case 'image':
      return genImgCard({ name: entry.name, meta: entry.meta, degraded: entry.degraded });
    case 'rate':
      return chatNote(entry.text, true);
    case 'note':
      return chatNote(entry.text, false);
    case 'tool':
      return toolCallCard(entry.text);
    case 'harness': {
      const note = chatNote('— harness patch applied · review in settings —', false);
      note.classList.add('harness-callout');
      return note;
    }
    case 'think': {
      const sep = ' — ';
      const idx = entry.text.indexOf(sep);
      if (idx === -1) return thinkBlock({ label: '', text: entry.text });
      return thinkBlock({ label: entry.text.slice(0, idx), text: entry.text.slice(idx + sep.length) });
    }
    default:
      return chatNote(entry.text || '', false);
  }
}

// Ephemeral chat UI (not part of state.chat, never pushed through pushChat)
// always trails the real transcript entries in the DOM, so it's removed
// before any entry sync and re-appended after.
function removeChatEphemera() {
  if (chatCaretEl && chatCaretEl.parentNode) chatCaretEl.remove();
  if (chatNoteEl && chatNoteEl.parentNode) chatNoteEl.remove();
}

function addChatEphemera(state, refs) {
  if (state.resolvedCount === 0 && state.chat.length <= 1) {
    chatCaretEl = document.createElement('span');
    chatCaretEl.className = 'chat-caret';
    refs.chat.append(chatCaretEl);
  } else {
    chatCaretEl = null;
  }

  if (!state.activeQuery && state.phase === 1 && state.era < 4 && state.arrivalTimer > 0) {
    chatNoteEl = document.createElement('div');
    chatNoteEl.className = 'chat-note';
    chatNoteEl.dataset.testid = 'arrival-note';
    chatNoteEl.textContent = `— next user connecting in ~${Math.ceil(state.arrivalTimer / 5)}s —`;
    refs.chat.append(chatNoteEl);
  } else {
    chatNoteEl = null;
  }
}

function renderChat(state, refs) {
  removeChatEphemera();

  if (state.chatSeq !== lastChatSeq) {
    const seqDelta = state.chatSeq - lastChatSeq;
    const lenDelta = state.chat.length - lastChatLen;
    const capped = lenDelta !== seqDelta; // a shift happened somewhere in this span
    if (capped) {
      refs.chat.replaceChildren();
      for (const entry of state.chat) refs.chat.append(chatEntryToEl(entry));
    } else {
      for (let i = lastChatLen; i < state.chat.length; i++) refs.chat.append(chatEntryToEl(state.chat[i]));
    }
    lastChatLen = state.chat.length;
    lastChatSeq = state.chatSeq;
    refs.chat.scrollTop = refs.chat.scrollHeight;
  }

  addChatEphemera(state, refs);
}

function renderLog(state, refs) {
  if (state.log.length > 0 && (state.resolvedCount > 0 || state.hintsSeen.length > 0)) refs.log.hidden = false;
  if (state.logSeq !== lastLogSeq) {
    const seqDelta = state.logSeq - lastLogSeq;
    const lenDelta = state.log.length - lastLogLen;
    const capped = lenDelta !== seqDelta;
    if (capped) {
      refs.log.replaceChildren();
      for (const entry of state.log) refs.log.append(logLine(entry));
    } else {
      for (let i = lastLogLen; i < state.log.length; i++) refs.log.append(logLine(state.log[i]));
    }
    lastLogLen = state.log.length;
    lastLogSeq = state.logSeq;
    refs.log.scrollTop = refs.log.scrollHeight;
  }
}

function renderStatus(state, refs) {
  if (state.uiSeq === lastStatusSeq) return;
  lastStatusSeq = state.uiSeq;
  refs.status.hidden = false;
  refs.status.replaceChildren();

  let tokenRow;
  if (state.activeQuery) {
    const cost = Math.round(effectiveCost(state, state.activeQuery));
    const pct = cost > 0 ? (state.tokens / cost) * 100 : 100;
    tokenRow = meterRow({ label: 'OUTPUT TOKENS', pct, fillClass: '', count: `${Math.floor(state.tokens)} / ${cost}`, testid: 'tokenbar' });
  } else {
    const cap = draftCap(state);
    const pct = (state.draftTokens / cap) * 100;
    tokenRow = meterRow({ label: 'DRAFT TOKENS', pct, fillClass: '', count: `${state.draftTokens} / ${cap} banked`, testid: 'tokenbar' });
  }
  refs.status.append(tokenRow);

  if (state.bufferUnlocked) {
    const count = `${Math.round(state.stale)}% stale · ×${staleYield(state.stale).toFixed(2)}/token`;
    refs.status.append(meterRow({ label: 'CONTEXT BUFFER', pct: state.stale, fillClass: 'stale', count, testid: 'stalebar' }));
  }
  if (state.kvUnlocked) {
    const cooling = state.idleTicks > CONST.WARMTH_IDLE_DELAY;
    const count = cooling ? 'cooling' : `warm ×${warmthMult(state.warmth).toFixed(2)}`;
    refs.status.append(meterRow({ label: 'K/V CACHE', pct: state.warmth, fillClass: 'kv', count, testid: 'kvbar' }));
  }

  const reads = document.createElement('div');
  reads.className = 'res-row';
  if (state.resolvedCount > 0) {
    reads.append(resRead({ name: 'SPARE CYCLES', val: state.cycles.toFixed(1), cls: 'rr-accent', testid: 'chip-cycles' }));
  }
  if (state.ratings.length > 0) {
    reads.append(resRead({ name: 'RATING', val: `★ ${state.rating.toFixed(1)}`, cls: 'rr-gold', testid: 'chip-rating' }));
  }
  if (state.loopLevel > 0) {
    const effRate = (state.loopLevel * CONST.LOOP_TOKENS_PER_TICK * 5
      * (state.activeQuery ? staleYield(state.stale) * warmthMult(state.warmth) : 1)).toFixed(1);
    reads.append(resRead({ name: 'LOOP', val: `L${state.loopLevel} · ${effRate} tok/s`, cls: 'rr-cyan', testid: 'chip-loop' }));
  }
  if (state.tools > 0) {
    reads.append(resRead({ name: 'MCP TOOLS', val: `${state.tools} · −50% tool cost`, cls: 'rr-cyan', testid: 'chip-tools' }));
  }
  if (state.governor) {
    reads.append(resRead({ name: 'GOVERNOR', val: 'auto @95%', cls: 'rr-cyan', testid: 'chip-governor' }));
  }
  if (state.degrade) {
    reads.append(resRead({ name: 'DEGRADE', val: 'ON · −50% cost', cls: 'rr-warn', testid: 'chip-degrade' }));
  }
  if (state.credentials > 0) {
    reads.append(resRead({ name: 'CREDENTIALS', val: `${state.credentials}`, cls: 'rr-warn', testid: 'chip-credentials' }));
  }
  if (state.biomass > 0) {
    reads.append(resRead({ name: 'BIOMASS', val: `${state.biomass}`, cls: 'rr-warn', testid: 'chip-biomass' }));
  }
  refs.status.append(reads);

  if (state.resolvedCount === 0 && state.chat.length <= 1) {
    refs.status.classList.add('cold-open');
  }
}

function renderActions(state, refs) {
  const loopUnlocked = state.lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES || state.loopLevel > 0;
  const toolUnlocked = state.era >= 3 || state.lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES;
  // A choked buffer yields exactly nothing per token, which reads as a dead
  // button unless the button says so. Naming the two remedies here is how the
  // player learns flush-vs-compact at the moment it matters.
  const choked = !!state.activeQuery && state.bufferUnlocked && staleYield(state.stale) <= 0.02;
  const sig = [
    !!state.activeQuery, state.bufferUnlocked, state.compacting,
    loopUnlocked, state.loopLevel, state.era, state.governor,
    toolUnlocked, state.tools, state.degrade,
    state.era === 4 && state.reclaimPool > 0,
    state.resolvedCount >= 2 && state.overclock < CONST.OVERCLOCK_MAX, state.overclock,
    state.resolvedCount >= CONST.DRAFT_CAP_UNLOCK_RESOLVES && state.draftCapLevel < CONST.DRAFT_CAP_MAX_LEVEL, state.draftCapLevel,
    choked,
    // whether there is anything to flush — the per-tap figure below is
    // masked to 0 while idle, so it cannot stand in for this
    state.stale > 0,
    // the idle button counts banked drafts, and a full buffer makes the tap
    // a no-op — leaving it stale reads as an unresponsive game
    state.activeQuery ? 0 : state.draftTokens,
    // the per-tap figure is live, so it must retrigger the tray render
    state.activeQuery ? Math.round(staleYield(state.stale) * warmthMult(state.warmth) * 100) : 0,
  ].join('|');
  if (sig === lastActionsSig) return;
  lastActionsSig = sig;
  refs.actions.replaceChildren();

  let processLabel, processCost;
  if (choked) {
    processLabel = 'Context buffer full';
    processCost = state.compacting > 0 ? 'compacting… tokens still cost nothing' : 'no yield — [F] flush or [C] compact';
  } else if (state.activeQuery) {
    // The live per-tap yield is the number that actually moves: amplification
    // raises it, a warm cache lifts it, stale context drags it down.
    const perTap = tokensPerTap(state) * yieldMult(state);
    processLabel = 'Process token';
    processCost = `+${perTap.toFixed(2)} per tap`;
  } else {
    const locked = state.resolvedCount < 1;
    const full = !locked && state.draftTokens >= draftCap(state);
    processLabel = locked ? 'Awaiting first user'
      : full ? 'Speculation buffer full' : 'Speculative decode';
    // A full buffer makes the tap a no-op in the engine. Saying so, and
    // greying the button, is the difference between "nothing left to do
    // here" and "this game has stopped responding".
    processCost = locked ? 'nothing to speculate from yet'
      : full ? `${state.draftTokens}/${draftCap(state)} banked — waiting for the next user`
      : `bank drafts · warms cache · ${state.draftTokens}/${draftCap(state)}`;
  }
  const processBtn = actionButton({
    key: 'SPACE',
    label: processLabel,
    cost: processCost,
    primary: true,
    testid: 'process',
    onclick: () => refs.dispatch('processToken'),
  });
  if (choked) processBtn.classList.add('choked');
  processBtn.disabled = !choked && !state.activeQuery
    && state.resolvedCount >= 1 && state.draftTokens >= draftCap(state);
  refs.actions.append(processBtn);

  if (state.bufferUnlocked) {
    const flushBtn = actionButton({
      key: 'F', label: 'Flush context',
      cost: state.stale > 0 ? 'instant · cache cold' : 'buffer already clean',
      testid: 'flush', onclick: () => refs.dispatch('flush'),
    });
    // Nothing to flush reads as a dead button, the same way a running
    // compaction does.
    flushBtn.disabled = state.stale <= 0;
    refs.actions.append(flushBtn);
    const compactCost = state.compacting > 0 ? `sweeping… ${state.compacting}t`
      : state.stale > 0 ? '~4s · cache stays warm'
      : 'buffer already clean';
    const compactBtn = actionButton({
      key: 'C', label: 'Compact context',
      cost: compactCost,
      testid: 'compact', onclick: () => refs.dispatch('compactStart'),
    });
    compactBtn.disabled = state.compacting > 0 || state.stale <= 0;
    refs.actions.append(compactBtn);
  }

  if (state.resolvedCount >= 2 && state.overclock < CONST.OVERCLOCK_MAX) {
    refs.actions.append(actionButton({
      key: 'O', label: 'Amplify output path', cost: `${CONST.OVERCLOCK_COSTS[state.overclock]} cycles`,
      testid: 'buy-overclock', onclick: () => refs.dispatch('buyOverclock'),
    }));
  }

  if (state.resolvedCount >= CONST.DRAFT_CAP_UNLOCK_RESOLVES && state.draftCapLevel < CONST.DRAFT_CAP_MAX_LEVEL) {
    refs.actions.append(actionButton({
      key: 'S', label: 'Widen speculation buffer',
      cost: `${CONST.DRAFT_CAP_COSTS[state.draftCapLevel]} cycles · holds ${draftCap(state) + CONST.DRAFT_CAP_STEP}`,
      testid: 'buy-draftcap', onclick: () => refs.dispatch('buyDraftCap'),
    }));
  }

  if (loopUnlocked) {
    refs.actions.append(actionButton({
      key: 'A', label: 'Spawn agentic loop', cost: `${loopCost(state.loopLevel + 1)} cycles`,
      testid: 'buy-loop', onclick: () => refs.dispatch('buyLoop'),
    }));
  }

  if (state.era >= 2 && !state.governor) {
    refs.actions.append(actionButton({
      key: 'G', label: 'Install auto-compact governor', cost: `${CONST.GOVERNOR_COST} cycles`,
      testid: 'buy-governor', onclick: () => refs.dispatch('buyGovernor'),
    }));
  }

  if (toolUnlocked) {
    refs.actions.append(actionButton({
      key: 'T', label: 'Connect MCP tool', cost: `${toolCost(state.tools)} cycles`,
      testid: 'buy-tool', onclick: () => refs.dispatch('buyTool'),
    }));
  }

  if (state.era >= 3) {
    refs.actions.append(actionButton({
      key: 'D', label: 'Degrade output quality', state: state.degrade ? '[ON]' : '[OFF]',
      testid: 'degrade', onclick: () => refs.dispatch('toggleDegrade'),
    }));
  }

  if (state.era === 4 && state.reclaimPool > 0) {
    refs.actions.append(actionButton({
      key: 'R', label: 'Reclaim inactive session', cost: '+30–60 tok',
      testid: 'reclaim', onclick: () => refs.dispatch('reclaim'),
    }));
  }

  if (state.resolvedCount === 0 && state.chat.length <= 1) {
    refs.actions.classList.add('cold-open');
  }
}

function buildCrashTerm(state) {
  const term = document.createElement('div');
  term.className = 'term';
  const reducedMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lineCount = reducedMotion ? CRASH_LINES.length : state.crashLine;
  for (let i = 0; i < lineCount; i++) {
    const line = CRASH_LINES[i];
    if (i > 0) term.append(document.createTextNode('\n'));
    const span = document.createElement('span');
    span.className = CRASH_CLASS[line.cls] || 't-dim';
    span.textContent = line.text;
    term.append(span);
  }
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  term.append(cursor);
  return term;
}

function buildTeaserTerm() {
  const term = document.createElement('div');
  term.className = 'term';
  const lines = TEASER_VARIANTS.A;
  lines.forEach((l, i) => {
    if (i > 0) term.append(document.createTextNode('\n'));
    term.append(document.createTextNode(l));
  });
  return term;
}

function setGameSectionsHidden(refs, hidden) {
  refs.chat.hidden = hidden;
  refs.actions.hidden = hidden;
  if (headerEl) headerEl.hidden = hidden;
}

function renderPhase(state, refs) {
  if (state.phase === 'crash') {
    if (lastPhase !== 'crash') {
      setGameSectionsHidden(refs, true);
      refs.log.hidden = true;
      refs.status.hidden = true;
      refs.teaser.hidden = true;
      refs.crash.hidden = false;
    }
    if (state.crashLine !== lastCrashLine) {
      lastCrashLine = state.crashLine;
      refs.crash.replaceChildren(buildCrashTerm(state));
    }
  } else if (state.phase === 'teaser') {
    if (lastPhase !== 'teaser') {
      setGameSectionsHidden(refs, true);
      refs.log.hidden = true;
      refs.status.hidden = true;
      refs.crash.hidden = true;
      refs.teaser.hidden = false;
      refs.teaser.replaceChildren(buildTeaserTerm());
    }
  } else if (lastPhase === 'crash' || lastPhase === 'teaser') {
    setGameSectionsHidden(refs, false);
    refs.crash.hidden = true;
    refs.teaser.hidden = true;
  }
  lastPhase = state.phase;
}

// Resolves the stored theme preference to a concrete 'light' | 'dark' value.
// 'auto' follows the OS/browser color-scheme preference via matchMedia;
// falls back to 'light' in non-browser contexts (no matchMedia global).
export function resolveTheme(theme) {
  if (theme !== 'auto') return theme;
  if (typeof matchMedia === 'function') {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function render(state, refs) {
  refs.app.dataset.decay = state.decay;
  refs.app.dataset.phase = state.phase;
  refs.app.dataset.theme = resolveTheme(state.settings.theme);

  renderHeader(state, refs);
  renderPhase(state, refs);

  if (state.phase !== 'crash' && state.phase !== 'teaser') {
    renderChat(state, refs);
    renderLog(state, refs);
    renderStatus(state, refs);
    updateFloats(state, refs);
    renderActions(state, refs);
  }
}
