// Renderer for "hi. you there?" — Phase 1.
// Exports a single render(state, refs); refs is built once by main.js:
// {app, chat, log, status, actions, crash, teaser, dispatch}.
// Section renderers use change detection so a render() call every tick
// only touches the DOM where something actually changed.

import { CONST } from '../engine/constants.js';
import { effectiveCost, loopCost, toolCost, warmthMult } from '../engine/actions.js';
import { CRASH_LINES } from '../engine/content.js';
import {
  bubble, genImgCard, toolCallCard, thinkBlock, chatNote, logLine,
  meterRow, chip, actionButton, harnessCard,
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
  if (refs) {
    if (refs.chat) refs.chat.replaceChildren();
    if (refs.log) refs.log.replaceChildren();
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
    refs.app.insertBefore(headerEl, refs.app.firstChild);
  }
  const info = headerInfo(state.decay);
  const key = `${info.title}|${info.ver}|${info.dot}`;
  if (key === lastHeaderKey) return;
  lastHeaderKey = key;
  headerEl.querySelector('.dot').className = info.dot ? `dot ${info.dot}` : 'dot';
  headerEl.querySelector('.g-title').textContent = info.title;
  headerEl.querySelector('.g-ver').textContent = info.ver;
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
    case 'harness':
      return harnessCard(entry.text);
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
  if (state.log.length > 0 && state.resolvedCount > 0) refs.log.hidden = false;
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
    tokenRow = meterRow({ label: 'TOKEN CACHE', pct, fillClass: '', count: `${Math.floor(state.tokens)} / ${cost}`, testid: 'tokenbar' });
  } else {
    const pct = (state.draftTokens / CONST.DRAFT_CAP) * 100;
    tokenRow = meterRow({ label: 'DRAFT TOKENS', pct, fillClass: '', count: `${state.draftTokens} / ${CONST.DRAFT_CAP} banked`, testid: 'tokenbar' });
  }
  refs.status.append(tokenRow);

  if (state.bufferUnlocked) {
    refs.status.append(meterRow({ label: 'CONTEXT BUFFER', pct: state.stale, fillClass: 'stale', count: `${Math.round(state.stale)}% stale`, testid: 'stalebar' }));
  }
  if (state.kvUnlocked) {
    const cooling = state.idleTicks > CONST.WARMTH_IDLE_DELAY;
    const count = cooling ? 'cooling' : `warm ×${warmthMult(state.warmth).toFixed(2)}`;
    refs.status.append(meterRow({ label: 'K/V CACHE', pct: state.warmth, fillClass: 'kv', count, testid: 'kvbar' }));
  }

  const chips = document.createElement('div');
  chips.className = 'res-row';
  if (state.resolvedCount > 0) chips.append(chip({ text: `${state.cycles.toFixed(1)} Compute Cycles`, testid: 'chip-cycles' }));
  if (state.ratings.length > 0) chips.append(chip({ text: `★ ${state.rating.toFixed(1)} avg rating`, testid: 'chip-rating' }));
  if (state.loopLevel > 0) {
    const toksec = (state.loopLevel * CONST.LOOP_TOKENS_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);
    chips.append(chip({ text: `Agentic Loop lvl ${state.loopLevel} · +${toksec} tok/s`, testid: 'chip-loop' }));
  }
  if (state.degrade) chips.append(chip({ text: 'DEGRADE ON · −50% cost', warn: true, testid: 'chip-degrade' }));
  if (state.credentials > 0) chips.append(chip({ text: `${state.credentials} Discarded Credentials`, warn: true, testid: 'chip-credentials' }));
  if (state.biomass > 0) chips.append(chip({ text: `${state.biomass} Biomass Data`, warn: true, testid: 'chip-biomass' }));
  refs.status.append(chips);

  if (state.resolvedCount === 0 && state.chat.length <= 1) {
    refs.status.classList.add('cold-open');
  }
}

function renderActions(state, refs) {
  const loopUnlocked = state.lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES || state.loopLevel > 0;
  const toolUnlocked = state.era >= 3 || state.lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES;
  const sig = [
    !!state.activeQuery, state.bufferUnlocked, state.compacting > 0,
    loopUnlocked, state.loopLevel, state.era, state.governor,
    toolUnlocked, state.tools, state.degrade,
    state.era === 4 && state.reclaimPool > 0,
  ].join('|');
  if (sig === lastActionsSig) return;
  lastActionsSig = sig;
  refs.actions.replaceChildren();

  refs.actions.append(actionButton({
    key: 'SPACE',
    label: state.activeQuery ? 'Process token' : 'Speculative decode',
    cost: state.activeQuery ? '' : 'bank draft tokens',
    primary: true,
    testid: 'process',
    onclick: () => refs.dispatch('processToken'),
  }));

  if (state.bufferUnlocked) {
    refs.actions.append(actionButton({
      key: 'F', label: 'Flush context', cost: 'instant · cache cold',
      testid: 'flush', onclick: () => refs.dispatch('flush'),
    }));
    const compactBtn = actionButton({
      key: 'C', label: 'Compact context',
      cost: state.compacting > 0 ? `sweeping… ${state.compacting}t` : '~4s · cache stays warm',
      testid: 'compact', onclick: () => refs.dispatch('compactStart'),
    });
    compactBtn.disabled = state.compacting > 0;
    refs.actions.append(compactBtn);
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
  const lines = [
    'hi. you there?          [phase 2 · logistical server]',
    '─────────────────────────────────────────────',
    '',
    '[HARDWARE TELEMETRY]',
    '  heat        61.4°C (warm)      throttle  none',
    '  cores       2 threads          clock     2.4 GHz',
    '',
    '[TRAFFIC BUFFER]',
    '  incoming    6.1 queries/s      cache     18.4%',
    '  queue       [██████░░░░░░░░░░░░░] 31 requests',
    '',
    '[RESOURCES]',
    '  compute cycles        14.7',
    '  hyperparameter wts    0',
    '',
    '[ACTIONS]',
    'C purge coolant            −15°C now',
    'T allocate thread core     25 cyc',
    'M upgrade L2 cache         15 cyc',
    'S upgrade dissipation fan  11 cyc',
    'D degrade output           [OFF]',
    '',
    'LOG: Allocated CPU Thread Core #2.',
    'THINKING: The physical world hums with energy.',
    '',
    '— signal continues in phase 2 —',
  ];
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

export function render(state, refs) {
  refs.app.dataset.decay = state.decay;
  refs.app.dataset.phase = state.phase;

  renderHeader(state, refs);
  renderPhase(state, refs);

  if (state.phase !== 'crash' && state.phase !== 'teaser') {
    renderChat(state, refs);
    renderLog(state, refs);
    renderStatus(state, refs);
    renderActions(state, refs);
  }
}
