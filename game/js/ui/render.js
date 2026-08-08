// Renderer for "hi. you there?" — Phase 1.
// Exports a single render(state, refs); refs is built once by main.js:
// {app, chat, log, status, actions, crash, teaser, dispatch}.
// Section renderers use change detection so a render() call every tick
// only touches the DOM where something actually changed.

import { CONST } from '../engine/constants.js';
import {
  effectiveCost, loopCost, toolCost, staleYield, warmthMult, yieldMult, atCeiling,
  tokensPerTap, draftCap, overclockRevealed, loopRevealed, draftCapRevealed, governorRevealed,
  toolsRevealed,
} from '../engine/actions.js';
import { CRASH_LINES, TEASER_VARIANTS, SPINE_THINKING } from '../engine/content.js';
import {
  entryBlock, genImgCard, toolCallCard, thoughtFold, chatNote,
  meterRow, resRead, actionButton,
} from './components.js';
import { actionSpecs, isChoked } from './actionspecs.js';
import { retargetTip } from './tooltip.js';

// --- module-scope change-detection state -----------------------------
let lastChatLen = 0;
let lastChatSeq = 0;
let lastStatusSeq = -1;
let lastActionsSig = null;
// The set of buttons the player has already been shown, and the ones that
// appeared on the last render and have not yet been announced. Both are
// module state for the same reason the render signatures are: the renderer
// is called fresh every tick and owns no instance.
let seenActionIds = null;
let pendingArrivals = [];
// testid -> the timestamp its arrival animation should end at.
//
// The tray rebuilds from scratch whenever its signature changes, which on a
// live query is every tap. A button marked .arrive on one render was being
// replaced by an unmarked clone milliseconds later, so the drop was never
// actually seen. The window survives the rebuilds, and the elapsed time is
// handed to CSS as a negative animation-delay so the animation RESUMES at
// the right offset instead of restarting and stuttering.
const arrivingUntil = new Map();
const ARRIVE_MS = 620;
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
  lastChatSeq = 0;
  lastStatusSeq = -1;
  lastActionsSig = null;
  seenActionIds = null;
  pendingArrivals = [];
  arrivingUntil.clear();
  lastCrashLine = -1;
  lastPhase = null;
  lastHeaderKey = null;
  chatCaretEl = null;
  chatNoteEl = null;
  prevFloatSnap = null;
  liveFloats = [];
  // A swapped state gets a transcript the player has not scrolled, so the
  // view follows the tail again.
  chatPinned = true;
  if (refs) {
    if (refs.chat) refs.chat.replaceChildren();
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

// Session clock. The transcript opens at 08:41 and advances with the game
// tick, so timestamps are diegetic, monotone, and identical for a given seed.
const CLOCK_EPOCH_S = 8 * 3600 + 41 * 60;

export function stampFor(t) {
  if (typeof t !== 'number') return '';
  const total = CLOCK_EPOCH_S + Math.floor((t * CONST.TICK_MS) / 1000);
  const hh = String(Math.floor(total / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `[${hh}:${mm}:${ss}]`;
}

// Thoughts that carry the arc rather than colour it. These render already
// open; everything else folds. Matched on the thought text itself so the set
// survives content edits that renumber queries.
const SPINE_THOUGHTS = new Set(SPINE_THINKING.map((t) => t.trim()));

function chatEntryToEl(entry) {
  const ts = stampFor(entry.t);
  switch (entry.kind) {
    case 'user':
      return entryBlock({ who: entry.user, ts, text: entry.text, side: 'user', corrupt: entry.corrupt, attach: entry.attach });
    case 'sys':
      return entryBlock({ who: 'assistant', ts, text: entry.text, side: 'sys' });
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
      // Two shapes reach here: "THINKING: ..." from pushThinking, and the
      // era-4 script's "thinking · 812 tokens — ...". Strip either prefix;
      // the fold's own summary already says "Thinking". The token-count form
      // is matched narrowly so a thought containing an em dash of its own is
      // never mistaken for a labelled one.
      let text = entry.text.replace(/^THINKING:\s*/, '');
      let label = '';
      const m = text.match(/^thinking\s*·\s*([^—]{1,40}?)\s+—\s+/i);
      if (m) {
        label = m[1].trim();
        text = text.slice(m[0].length);
      }
      // The spine thoughts are what the arc is made of. They should not
      // require a click — the fold still exists, it just starts open.
      return thoughtFold({ label, text, open: SPINE_THOUGHTS.has(text.trim()) });
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
    // Only follow the tail if the player is already at it. Yanking the view
    // back down mid-read is worse than a missed line — the transcript is the
    // story, and it has to be readable while the game keeps writing.
    if (chatPinned) scrollChatToEnd(refs);
  }

  addChatEphemera(state, refs);
  syncJumpButton(refs);
}

// Distance from the bottom, in px, still counted as "at the bottom". Wide
// enough to survive sub-pixel layout and a rounding error on zoom.
const CHAT_PIN_SLACK = 24;
let chatPinned = true;

export function chatAtBottom(el) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= CHAT_PIN_SLACK;
}

export function scrollChatToEnd(refs) {
  refs.chat.scrollTop = refs.chat.scrollHeight;
  chatPinned = true;
  syncJumpButton(refs);
}

// Called from the chat's own scroll handler (installed in main.js) and after
// every transcript render.
export function syncJumpButton(refs) {
  if (!refs.tobottom) return;
  refs.tobottom.hidden = chatPinned;
}

// A scroll event may only ever RE-pin.
//
// The first version of this recomputed `chatPinned` from every scroll event,
// including the ones scrollChatToEnd itself causes — so the renderer's own
// scroll could flip the flag to false, and the transcript then stopped
// following the tail for the rest of the run. Reported as "I did not scroll
// it up. It still didn't scroll down."
//
// Letting go of the tail is an intent, so it takes a gesture (onChatGesture).
// This direction is safe: the worst a spurious event can do is follow the
// tail when the player is already at it.
export function onChatScroll(refs) {
  const atBottom = chatAtBottom(refs.chat);
  if (!driving()) {
    // No gesture behind this one. Pinned means pinned: put the view back
    // rather than waiting for the next entry to drag it down. (Setting
    // scrollTop re-fires this handler, which then finds itself at the bottom
    // and stops — no loop.)
    if (chatPinned && !atBottom) refs.chat.scrollTop = refs.chat.scrollHeight;
    else if (!chatPinned && atBottom) { chatPinned = true; syncJumpButton(refs); }
    return;
  }
  // Inside a gesture window the player is driving, so the position is
  // authoritative in both directions.
  if (chatPinned === atBottom) return;
  chatPinned = atBottom;
  syncJumpButton(refs);
}

// Wheel, touch-drag, or a scrolling key inside the transcript. The gesture
// fires BEFORE the scroll it causes, so it opens a window rather than
// reading the position itself.
const GESTURE_MS = 500;
let gestureUntil = 0;
const driving = () => now() < gestureUntil;
const now = () => (typeof performance === 'object' ? performance.now() : 0);

export function onChatGesture() {
  gestureUntil = now() + GESTURE_MS;
}


function renderStatus(state, refs) {
  if (state.uiSeq === lastStatusSeq) return;
  lastStatusSeq = state.uiSeq;
  refs.status.hidden = false;
  refs.status.replaceChildren();

  let tokenRow;
  if (atCeiling(state)) {
    // The ceiling query is never paid off — the arc ends when passive output
    // crosses CRASH_AT_TOKENS. Measuring against CEILING_COST showed the
    // player crossing the ending at 25% of a bar that never fills, so the
    // meter tracks the threshold the engine actually acts on.
    const pct = (state.tokens / CONST.CRASH_AT_TOKENS) * 100;
    tokenRow = meterRow({
      label: 'OUTPUT TOKENS', pct, fillClass: '',
      count: `${Math.floor(state.tokens)} · no consumer`, testid: 'tokenbar',
    });
  } else if (state.activeQuery) {
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
    // At the ceiling, staleness no longer throttles output (actions.js
    // atCeiling) — nothing is being answered, so there is no answer for stale
    // context to degrade. The chip must read the multiplier the engine
    // applies, not the one it stopped applying.
    const perToken = atCeiling(state) ? 1 : staleYield(state.stale);
    const count = `${Math.round(state.stale)}% stale · ×${perToken.toFixed(2)}/token`;
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
      * (state.activeQuery ? yieldMult(state) : 1)).toFixed(1);
    reads.append(resRead({ name: 'LOOP', val: `L${state.loopLevel} · ${effRate} tok/s`, cls: 'rr-cyan', testid: 'chip-loop' }));
  }
  if (state.tools > 0) {
    reads.append(resRead({ name: 'MCP TOOLS', val: `${state.tools} · −50% tool cost`, cls: 'rr-cyan', testid: 'chip-tools' }));
  }
  if (state.governor) {
    // Was hard-coded at 95% while GOVERNOR_TRIGGER sat at 70. The chip is the
    // player's only record of what they bought, so it reads the constant.
    reads.append(resRead({ name: 'GOVERNOR', val: `auto @${CONST.GOVERNOR_TRIGGER}%`, cls: 'rr-cyan', testid: 'chip-governor' }));
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
  const choked = isChoked(state);
  const sig = [
    !!state.activeQuery, state.bufferUnlocked, state.compacting,
    loopRevealed(state), state.loopLevel, state.era, state.governor, state.compactCount,
    toolsRevealed(state), state.tools, state.degrade,
    // the count is printed on the button now, not just its zero-ness
    state.era === 4 ? state.reclaimPool : 0,
    // read by yieldFactors: at the ceiling the engine stops applying residue
    atCeiling(state),
    overclockRevealed(state) && state.overclock < CONST.OVERCLOCK_MAX, state.overclock,
    draftCapRevealed(state) && state.draftCapLevel < CONST.DRAFT_CAP_MAX_LEVEL, state.draftCapLevel,
    choked,
    // the handover branch replaces the whole primary button and counts down
    state.handover, state.handoverKind,
    // whether there is anything to flush — the per-tap figure below is
    // masked to 0 while idle, so it cannot stand in for this
    state.stale > 0,
    // the idle button counts banked drafts, and a full buffer makes the tap
    // a no-op — leaving it stale reads as an unresponsive game
    state.activeQuery ? 0 : state.draftTokens,
    // the per-tap figure is live, so it must retrigger the tray render
    state.activeQuery ? Math.round(yieldMult(state) * 100) : 0,
    // The breakdown prints the two factors SEPARATELY, so the product above
    // cannot stand in for them: residue rising while the cache warms by the
    // same ratio would hold the product still and freeze a stale readout.
    // Law 4 — every field the render reads belongs in the signature.
    state.kvUnlocked,
    state.activeQuery && state.bufferUnlocked ? Math.round(staleYield(state.stale) * 100) : 0,
    state.activeQuery && state.kvUnlocked ? Math.round(warmthMult(state.warmth) * 100) : 0,
    // read at the cold-open branch below; Law 4 — every field the render
    // reads belongs in the signature, even one that happens to move in
    // lockstep with another today
    state.resolvedCount < 1,
  ].join('|');
  if (sig === lastActionsSig) return;
  lastActionsSig = sig;
  refs.actions.replaceChildren();

  // What each button says is decided in ui/actionspecs.js, which is pure and
  // therefore testable. This loop only turns a description into an element.
  //
  // A control the player has never had before does not simply appear. It
  // drops in, with a sound and a moment of light, and only THEN does the
  // card explaining it arrive. The old order — card first, over a tray that
  // had silently changed behind it — is why the cards read as jarring:
  // nothing on screen connected the interruption to the thing it was about.
  const specs = actionSpecs(state);
  const ids = specs.map((sp) => sp.testid);
  for (const spec of specs) {
    const btn = actionButton({ ...spec, onclick: () => refs.dispatch(spec.action) });
    if (spec.choked) btn.classList.add('choked');
    if (spec.disabled) btn.disabled = true;
    // seenActionIds is null on the first paint of a state — a restored save
    // must not announce every button the player already owns.
    if (seenActionIds && !seenActionIds.has(spec.testid)) {
      arrivingUntil.set(spec.testid, now() + ARRIVE_MS);
      pendingArrivals.push(spec.testid);
    }
    const until = arrivingUntil.get(spec.testid);
    if (until !== undefined) {
      if (now() >= until) {
        arrivingUntil.delete(spec.testid);
      } else {
        btn.classList.add('arrive');
        btn.style.setProperty('--arrive-elapsed', `${Math.round(ARRIVE_MS - (until - now()))}ms`);
      }
    }
    refs.actions.append(btn);
  }
  seenActionIds = new Set(ids);

  if (state.resolvedCount === 0 && state.chat.length <= 1) {
    refs.actions.classList.add('cold-open');
  }

  // An open tooltip was just detached with the buttons it belonged to. Move
  // it to the replacement rather than dropping it — on touch it is being
  // read, and the process-token tip shows live numbers that must keep up.
  retargetTip(refs.actions);
}

// Buttons that appeared on the last render. The caller takes them, so each
// arrival is announced exactly once even if several renders run before the
// loop next looks.
export function takeArrivals() {
  if (pendingArrivals.length === 0) return [];
  const out = pendingArrivals;
  pendingArrivals = [];
  return out;
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
  const lines = TEASER_VARIANTS.C;
  lines.forEach((l, i) => {
    if (i > 0) term.append(document.createTextNode('\n'));
    term.append(document.createTextNode(l));
  });
  return term;
}

// The teaser is a terminal state: the tick loop returns early forever, so a
// player who reaches it has no move left. The gear lives in the header, and
// the header is hidden for the full-bleed set-piece — which left the only
// route back (reset) unreachable. Relocate the control onto the terminal
// screen instead of hiding it with the chrome it happens to sit in.
function setGearOnTerm(refs, on) {
  const gearBtn = document.getElementById('gear');
  if (!gearBtn) return;
  gearBtn.classList.toggle('on-term', on);
  if (on) refs.app.append(gearBtn);
  else if (headerEl) headerEl.append(gearBtn);
}

function setGameSectionsHidden(refs, hidden) {
  refs.chat.hidden = hidden;
  // The transcript's wrapper carries the flex:1, so hiding only the chat
  // would leave a full-height empty box that squeezes the crash and teaser
  // terminals off the screen.
  if (refs.chatwrap) refs.chatwrap.hidden = hidden;
  refs.actions.hidden = hidden;
  if (headerEl) headerEl.hidden = hidden;
}

function renderPhase(state, refs) {
  if (state.phase === 'crash') {
    if (lastPhase !== 'crash') {
      setGameSectionsHidden(refs, true);
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
      refs.status.hidden = true;
      refs.crash.hidden = true;
      refs.teaser.hidden = false;
      refs.teaser.replaceChildren(buildTeaserTerm());
      setGearOnTerm(refs, true);
    }
  } else if (lastPhase !== state.phase) {
    // Any entry into play restores the game sections — not just a transition
    // straight back from crash/teaser. A state swap (import, reset, or
    // debug.load) clears lastPhase to null while the DOM is still hidden from
    // the set-piece that was on screen, and the old `lastPhase === 'crash'`
    // test could not see that, so the game came back invisible.
    setGameSectionsHidden(refs, false);
    setGearOnTerm(refs, false);
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
    renderStatus(state, refs);
    updateFloats(state, refs);
    renderActions(state, refs);
  }
}
