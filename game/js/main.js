// Main loop wiring for "hi. you there?" — Phase 1.
// Loads/creates state, drives the tick loop + rAF render loop, autosaves,
// and installs hotkeys. Exports nothing; imported directly by index.html.

import { createState } from './engine/state.js';
import { tick } from './engine/tick.js';
import { ACTIONS } from './engine/actions.js';
import { ARC2_ACTIONS } from './engine/arc2-actions.js';
import { CONST } from './engine/constants.js';
import { saveLocal, loadLocal, offlineCatchUp, SAVE_KEY } from './engine/save.js';
import { render, onChatScroll, onChatGesture, scrollChatToEnd, takeArrivals } from './ui/render.js';
import { harnessCard, hintCard, thoughtCard, thinkSeconds } from './ui/components.js';
import { projectionTap } from './ui/projection.js';
import { installKeys } from './ui/keys.js';
import { installTooltips } from './ui/tooltip.js';
import { installDebug } from './ui/debug.js';
import { installSettings } from './ui/settings.js';
import {
  playCardSound, playActionSound, playCompactSound, playFlushSound, playOverclockSound,
  playDraftCapSound, playLoopSound, playPopSound, playArrivalSound, setMuted, warmSounds,
} from './ui/sound.js';
import { IdbStore, MemoryStore, DEV_KEY, TELEMETRY_OPTOUT_KEY } from './telemetry/store.js';
import { createTelemetry } from './telemetry/capture.js';
import { installTelemetryHooks } from './telemetry/hooks.js';
import { installRecorder } from './ui/recorder.js';
import { installSessions } from './ui/sessions.js';

const TICK_MS = 200;
const LOOP_MS = 50;
const AUTOSAVE_MS = 5000;

// Offline catch-up needs the raw save wrapper (savedAt), but loadLocal()
// only returns the deserialized state. Read localStorage directly here to
// recover savedAt without duplicating save.js's parsing logic. Callers must
// only trust the result when loadLocal() itself returned a valid state —
// a corrupt/unrecognized state must never borrow a savedAt from its wrapper.
function readSavedAt() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const raw = globalThis.localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const wrapper = JSON.parse(raw);
    return wrapper && typeof wrapper.savedAt === 'number' ? wrapper.savedAt : null;
  } catch {
    return null;
  }
}

function getSpeed() {
  const params = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
  const raw = parseFloat(params.get('speed'));
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

const KEEP_SESSIONS = 20;

function readDevFlag() {
  if (typeof globalThis.localStorage === 'undefined') return false;
  const params = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
  if (params.get('debug') === '1') globalThis.localStorage.setItem(DEV_KEY, '1');
  if (params.get('debug') === '0') globalThis.localStorage.removeItem(DEV_KEY);
  return globalThis.localStorage.getItem(DEV_KEY) === '1';
}

async function openStore() {
  try {
    return await IdbStore.open();
  } catch (err) {
    console.warn('telemetry: IndexedDB unavailable, falling back to memory', err);
    return new MemoryStore();
  }
}

async function main() {
  const loaded = loadLocal();
  // Only trust savedAt when loadLocal() itself produced a valid state —
  // never feed a savedAt from a wrapper whose state failed deserialization
  // into a freshly created state.
  const savedAt = loaded ? readSavedAt() : null;

  const stateBox = { current: loaded || createState(Date.now() >>> 0) };

  // ?mute=1 — sound off for this load, whatever the save says.
  //
  // For automated runs. Sound defaults ON and a scripted playthrough on a real
  // machine otherwise spends its life making noise at whoever is sitting
  // there; an audio graph nobody asked for is also one more thing that can
  // throw mid-test. Drop the flag and the sound is back — it is per-load and
  // never written to the save, so a test cannot silently mute a player's game.
  //
  // See docs/operations/testing.md.
  setMuted(new URLSearchParams(
    globalThis.location ? globalThis.location.search : '',
  ).get('mute') === '1');

  if (savedAt !== null) {
    const elapsed = Date.now() - savedAt;
    if (elapsed > 0) offlineCatchUp(stateBox.current, elapsed);
  }

  // --- telemetry ---------------------------------------------------------
  // Initialized before refs/dispatch so every later closure can call hooks.
  // The baseline seqs are taken post offline-catch-up, so a restored
  // transcript never replays into the event stream.
  const devMode = readDevFlag();
  const store = await openStore();
  const optedOut = typeof globalThis.localStorage !== 'undefined'
    && globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) === '1';
  const telemetry = createTelemetry({
    clock: { now: () => Date.now(), pm: () => performance.now() },
    store,
    getTick: () => stateBox.current.tick,
    enabled: !optedOut,
  });
  const hooks = installTelemetryHooks({ telemetry, stateBox });
  store.prune(KEEP_SESSIONS).catch(() => {});
  await telemetry.startSession({ ua: navigator.userAgent, dev: devMode }).catch((err) => {
    console.warn('telemetry: session start failed', err);
  });

  const refs = {
    app: document.getElementById('app'),
    chat: document.getElementById('chat'),
    chatwrap: document.getElementById('chatwrap'),
    status: document.getElementById('status'),
    actions: document.getElementById('actions'),
    crash: document.getElementById('crash'),
    teaser: document.getElementById('teaser'),
    cardlay: document.getElementById('cardlay'),
    thoughts: document.getElementById('thoughts'),
    tobottom: document.getElementById('tobottom'),
    fx: document.getElementById('fx'),
    dispatch,
  };

  // --- transcript follow ------------------------------------------------
  // The chat follows the tail unless the player has scrolled up to read.
  // While it is scrolled up, a small button offers the way back.
  if (refs.chat) {
    refs.chat.addEventListener('scroll', () => onChatScroll(refs), { passive: true });
    // Letting go of the tail is an intent, not a side effect of a render.
    for (const type of ['wheel', 'touchmove', 'keydown', 'pointerdown']) {
      refs.chat.addEventListener(type, onChatGesture, { passive: true });
    }
  }
  if (refs.tobottom) {
    refs.tobottom.addEventListener('click', () => scrollChatToEnd(refs));
  }

  // --- interrupting harness-card overlay --------------------------------
  // cardSeqHW is the chatSeq high-water mark: chat 'harness' entries at or
  // below it have already been shown (or were restored/imported history
  // that should never pop an overlay in the first place). It starts at the
  // state's chatSeq once loaded/offline-catch-up has settled below, and is
  // re-armed on every state-swap path (import/reset/debug.load) so an old
  // transcript's cards never re-pop.
  let cardSeqHW = 0;
  // logSeqHW does the same job for the log feed: every one-shot harness HINT
  // is pushed there, and hints teach the mechanics, so they interrupt too —
  // a hint that scrolls past unread has taught nobody anything.
  let logSeqHW = 0;
  let cardQueue = [];
  let cardPaused = false;
  // --- cards yield to the transcript ------------------------------------
  //
  // A card is an interruption, and an interruption that lands on top of the
  // thing it is about reads as a collision. The opening was the worst case:
  // the first user's message, its arrival sound and the harness card all
  // fired on the same frame, so two sounds played over each other and the
  // card covered the message it was introducing.
  //
  // The rule, and it is general: whatever just landed in the transcript gets
  // to be seen and heard first. Chat renders, its sound plays, and only then
  // may a card open.
  //
  // cardHoldUntil is the timestamp before which no card may open. Several
  // things push it forward — a new transcript entry, a button dropping into
  // the tray — and it only ever moves later, so two holds in consecutive
  // frames cannot shorten each other.
  let cardHoldUntil = 0;
  // When the current run of holds began. The cap is measured from here, not
  // from each push: chat can append on every tick, and an unbounded hold
  // would starve a card that has something to teach.
  let cardHoldSince = 0;
  const CARD_HOLD_CAP_MS = 1500;

  function holdCards(ms) {
    const now = performance.now();
    if (cardHoldUntil <= now) cardHoldSince = now;
    cardHoldUntil = Math.min(
      Math.max(cardHoldUntil, now + ms),
      cardHoldSince + CARD_HOLD_CAP_MS,
    );
  }
  // Thoughts leak into the corner and fade. They never pause the game, so
  // they ride a separate queue from the interrupting cards.
  let thoughtQueue = [];

  // --- transient thought cards -------------------------------------------
  // Every thought is already in the transcript, folded, so a card that is
  // missed costs the player nothing. That is what lets these be transient.
  // Dwell scales with the length of the thought. A flat 3s truncated exactly
  // the longest and best-written lines — a 47-word era-3 thought needs about
  // 14s to read — while over-serving the short pool lines. thinkSeconds() is
  // the same length model the fold's badge already prints, so the card and its
  // label agree.
  const thoughtMs = (text) =>
    Math.max(2600, Math.min(11000, parseFloat(thinkSeconds(text)) * 1000 + 1800));
  const THOUGHT_FADE_MS = 320;  // must match the CSS transition
  const THOUGHT_MAX = 3;        // concurrent cards; older ones are retired
  const liveThoughts = [];      // [{el, timer}], oldest first

  function dropThought(rec, immediate = false) {
    const idx = liveThoughts.indexOf(rec);
    if (idx === -1) return;
    liveThoughts.splice(idx, 1);
    clearTimeout(rec.timer);
    if (immediate) {
      rec.el.remove();
      return;
    }
    rec.el.classList.add('out');
    setTimeout(() => rec.el.remove(), THOUGHT_FADE_MS);
  }

  function showThought(text) {
    if (!refs.thoughts) return;
    const el = thoughtCard(text);
    const rec = { el, text, timer: 0 };
    // Tapping a card dismisses it now instead of waiting out the timeout.
    el.addEventListener('click', () => dropThought(rec, true));
    refs.thoughts.append(el);
    // Force a frame so the entry transition actually runs.
    requestAnimationFrame(() => el.classList.add('in'));
    rec.timer = setTimeout(() => dropThought(rec), thoughtMs(text));
    liveThoughts.push(rec);
    while (liveThoughts.length > THOUGHT_MAX) dropThought(liveThoughts[0]);
  }

  function clearThoughts() {
    for (const rec of liveThoughts.slice()) dropThought(rec, true);
    thoughtQueue = [];
  }

  function resetCardTracking() {
    hooks.onContext('state.swap');
    hooks.resync();
    cardQueue = [];
    cardPaused = false;
    cardSeqHW = stateBox.current.chatSeq;
    logSeqHW = stateBox.current.logSeq;
    // A swapped-in state may already have a user connected. That is history
    // being restored, not a user arriving, and must not announce itself.
    lastQueryId = stateBox.current.activeQuery ? stateBox.current.activeQuery.id : null;
    lastCompacting = stateBox.current.compacting;
    cardHoldUntil = 0;
    cardHoldSince = 0;
    clearThoughts();
    if (refs.cardlay) {
      refs.cardlay.hidden = true;
      refs.cardlay.replaceChildren();
    }
  }

  // Scans the (ring-buffered) chat array for 'harness' entries newer than
  // cardSeqHW. Entries don't carry their own seq, but chatSeq only ever
  // increments by 1 per push and the array only ever shifts from the front,
  // so the seq of chat[i] can be reconstructed from its distance to the end.
  function scanForCards() {
    const state = stateBox.current;
    if (state.chatSeq > cardSeqHW) {
      // Something new is in the transcript. It renders on this frame, and
      // its sound (an arriving user) plays on this frame. Give the player
      // CARD_SETTLE_MS to register both before anything covers them.
      holdCards(CONST.CARD_SETTLE_MS);
      const len = state.chat.length;
      for (let i = 0; i < len; i++) {
        const seq = state.chatSeq - (len - 1 - i);
        if (seq <= cardSeqHW) continue;
        const entry = state.chat[i];
        if (entry.kind === 'harness') cardQueue.push({ kind: 'code', text: entry.text });
        // Thoughts leak to the corner as they are thought. The prefix is a
        // feed marker, not part of the thought.
        else if (entry.kind === 'think') thoughtQueue.push(entry.text.replace(/^THINKING:\s*/, ''));
      }
      cardSeqHW = state.chatSeq;
    }
    // Same reconstruction over the log ring buffer, for hint lines.
    if (state.logSeq > logSeqHW) {
      const len = state.log.length;
      for (let i = 0; i < len; i++) {
        const seq = state.logSeq - (len - 1 - i);
        if (seq <= logSeqHW) continue;
        const entry = state.log[i];
        // Only the one-shot hints (gap-flagged) interrupt; routine harness
        // chatter ("Context flushed. Cache cold.") stays in the feed.
        if (entry.kind === 'harness' && entry.gap) cardQueue.push({ kind: 'hint', text: entry.text });
      }
      logSeqHW = state.logSeq;
    }
  }

  // Timestamp (performance.now()) of the most recent showNextCard() that
  // actually displayed a card. Dismissal (click or key) within
  // DISMISS_GRACE_MS of that moment is ignored, so a key/click mash that
  // was already in flight when the card appeared can't dismiss it unread.
  // UI-side only — doesn't touch engine state or determinism.
  const DISMISS_GRACE_MS = 300;
  let cardShownAt = 0;

  function showNextCard() {
    const next = cardQueue.shift();
    if (!next) {
      hooks.onContext('card.dismiss');
      cardPaused = false;
      refs.cardlay.hidden = true;
      refs.cardlay.replaceChildren();
      return;
    }
    hooks.onContext('card.pause', { seq: next.seq });
    cardPaused = true;
    // A harness card is the game's teaching channel and it holds the loop
    // still. Nothing may sit on top of it — least of all a thought, which is
    // the machine's inner voice talking over its own instructions. Cards
    // already on screen go back on the queue and replay at full dwell once
    // play resumes; pauseForCard drains that queue.
    for (const rec of liveThoughts.slice().reverse()) {
      thoughtQueue.unshift(rec.text);
      dropThought(rec, true);
    }
    cardShownAt = performance.now();
    refs.cardlay.replaceChildren();
    refs.cardlay.append(next.kind === 'hint' ? hintCard(next.text) : harnessCard(next.text));
    const dismiss = document.createElement('div');
    dismiss.className = 'dismiss';
    dismiss.textContent = 'tap / any key to continue';
    refs.cardlay.append(dismiss);
    refs.cardlay.hidden = false;
    playCardSound(stateBox.current);
  }

  // Called every rAF frame: opens the overlay the moment a new harness
  // card exists and none is currently showing. Queues extras (e.g. an era
  // jump via the debug drawer that fires several cards in one go) so they
  // show one at a time.
  function pauseForCard() {
    scanForCards();
    // The crash and the teaser are the arc's closing set-pieces. A harness
    // card popping over them covers the ending, and by then there is no
    // mechanic left for it to teach — so drop whatever is still queued,
    // and take down one already on screen.
    const phase = stateBox.current.phase;
    if (phase === 'crash' || phase === 'teaser') {
      cardQueue = [];
      clearThoughts();
      if (cardPaused) {
        cardPaused = false;
        refs.cardlay.hidden = true;
        refs.cardlay.replaceChildren();
      }
      return;
    }
    // A thought card behind a paused overlay would fade out unseen, so hold
    // the queue until play resumes. The transcript fold keeps the durable copy
    // either way, so nothing is lost if the queue is later dropped.
    if (!cardPaused) {
      while (thoughtQueue.length > 0) showThought(thoughtQueue.shift());
    }
    // The settings <dialog> renders in the browser's top layer, hiding the
    // card overlay underneath it. Leave queued cards in place and defer
    // opening the overlay until the dialog closes, so a card is never shown
    // (and its keydown swallowed) while the player can't see it.
    if (document.getElementById('settings')?.open) return;
    // Whatever landed in the transcript, or dropped into the tray, gets to
    // be seen first. See holdCards().
    if (performance.now() < cardHoldUntil) return;
    if (!cardPaused && cardQueue.length > 0) showNextCard();
  }

  // A new control drops into the tray with a pop and a flash, and the card
  // that teaches it waits for that to finish.
  //
  // This is the fix for cards feeling jarring: they used to interrupt with no
  // visible referent, so the player read an explanation of a change they had
  // not seen happen. Now the change happens first, loudly, in the place it
  // happened — and the card arrives as the follow-up it always was.
  const ARRIVE_HOLD_MS = 620;   // must cover the .act.arrive animation

  function announceArrivals() {
    const arrived = takeArrivals();
    if (arrived.length === 0) return;
    playPopSound(stateBox.current);
    hooks.onContext(`ui.arrive:${arrived.join(',')}`);
    holdCards(ARRIVE_HOLD_MS);
  }

  // Dismisses the currently-shown card. If more are queued, immediately
  // shows the next one (stays paused); otherwise resumes the game loop.
  // Never does offline catch-up — the pause is just a freeze, same as the
  // document.hidden freeze below.
  function resumeFromCard() {
    if (!cardPaused) return;
    if (performance.now() - cardShownAt < DISMISS_GRACE_MS) return;
    showNextCard();
  }

  if (refs.cardlay) {
    refs.cardlay.addEventListener('click', resumeFromCard);
  }
  // iOS Safari drags the document on touchmove even when it has nothing to
  // scroll, which slides the whole fixed layout around mid-play. Swallow any
  // single-finger drag that did not start inside a scrollable pane. Multi-touch
  // is left alone so pinch-zoom keeps working.
  const SCROLLABLE = '.g-chat, .g-log, .term, .dev-drawer, dialog#settings';
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest(SCROLLABLE)) return;
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', (event) => {
    if (!cardPaused) return;
    if (event.repeat) return;
    event.preventDefault();
    event.stopPropagation();
    resumeFromCard();
  }, true);

  // Mirrors the exact condition render.js uses to decide whether to add
  // the 'cold-open' class, so the class is always removed once it no
  // longer holds instead of latching on indefinitely.
  function isColdOpen() {
    return stateBox.current.resolvedCount === 0 && stateBox.current.chat.length <= 1;
  }

  let coldOpenActive = isColdOpen();

  // render.js applies 'cold-open' while the condition holds but never
  // removes it (that's this task's job) — clear it the first time the
  // condition stops holding, right after render so the class change lands
  // in the same paint.
  // The compaction sweep is driven off the state transition, not off the
  // button: the governor starts compactions on its own, and a press that
  // is refused (buffer locked, or one already running) must stay silent.
  // Seeded below from the state as it stands after offline catch-up, so a
  // restored mid-compaction save does not fire it on load.
  let lastCompacting = 0;
  function watchCompaction() {
    const now = stateBox.current.compacting;
    if (now > 0 && lastCompacting === 0) playCompactSound(stateBox.current);
    lastCompacting = now;
  }

  // A user connecting is the one thing that happens TO the player rather
  // than because of them, and it was silent. Watched the same way as a
  // compaction: an edge, seeded from the state as it stands after offline
  // catch-up so a restored mid-query save does not announce itself on load.
  //
  // Keyed on the query's identity, not on truthiness, so a resolve
  // immediately followed by the next arrival is still one arrival.
  let lastQueryId = null;
  function watchArrival() {
    const q = stateBox.current.activeQuery;
    const id = q ? q.id : null;
    // The ceiling query is the arc ending, not a user asking. It has its own
    // set-piece and must not be introduced by the same friendly blip.
    if (id && id !== lastQueryId && id !== 'ceiling') playArrivalSound(stateBox.current);
    lastQueryId = id;
  }

  function paintNow() {
    watchCompaction();
    watchArrival();
    render(stateBox.current, refs);
    // Immediately after the paint that added the button, so the pop lands
    // with the drop rather than a frame behind it.
    announceArrivals();
    lastPaintedSeq = stateBox.current.uiSeq;
    hooks.afterPaint();
    if (coldOpenActive && !isColdOpen()) {
      coldOpenActive = false;
      refs.actions.classList.remove('cold-open');
      refs.status.classList.remove('cold-open');
    }
  }

  // Cooldown "sweep" flash on the process button: only when a landed press
  // (tokens actually increased) processed against an active query, not on
  // idle drafting or presses that were dropped by the per-tick cap.
  // Every action button flashes, not just the process button. Keyed off the
  // action name rather than the click target so a keyboard shortcut lights
  // the same button a tap would.
  const SWEEP_TESTID = {
    processToken: 'process', flush: 'flush', compactStart: 'compact',
    buyLoop: 'buy-loop', buyGovernor: 'buy-governor', buyTool: 'buy-tool',
    buyOverclock: 'buy-overclock', buyDraftCap: 'buy-draftcap',
    toggleDegrade: 'degrade', reclaim: 'reclaim',
    // Arc 2.
    allocateCore: 'a2-core', upgradeCache: 'a2-cache', upgradeSink: 'a2-sink',
    purgeCoolant: 'a2-purge', shedLoad: 'a2-shed', retrain: 'a2-retrain',
  };
  // Timers are per-button: a single shared handle let a second button's flash
  // cancel the first button's cleanup and latch the class on it.
  const sweepTimers = new WeakMap();
  function flashSweep(btn) {
    if (!btn) return;
    btn.classList.add('sweep');
    btn.addEventListener('animationend', () => btn.classList.remove('sweep'), { once: true });
    // Under prefers-reduced-motion the animation is disabled (animation:
    // none), so 'animationend' never fires and the class would latch
    // forever — fall back to a timed removal that outlasts the animation.
    const pending = sweepTimers.get(btn);
    if (pending !== undefined) clearTimeout(pending);
    sweepTimers.set(btn, setTimeout(() => {
      btn.classList.remove('sweep');
      sweepTimers.delete(btn);
    }, 250));
  }
  function flashAction(name) {
    const testid = SWEEP_TESTID[name];
    if (!testid) return;
    // After paintNow: a signature change rebuilds the tray, so the element
    // that was clicked may already be gone. Arc 2's controls live on the
    // terminal surface rather than in the tray, so both are searched.
    flashSweep(refs.actions.querySelector(`[data-testid="${testid}"]`)
      || refs.teaser.querySelector(`[data-testid="${testid}"]`));
  }

  function dispatch(name, arg) {
    // Arc 2's verbs are a separate table because the acts share nothing but
    // the reducer contract. Same guarantees either side: a refused action
    // returns without bumping uiSeq, so it is silent (Laws 5 and 6).
    const action = ACTIONS[name] || ARC2_ACTIONS[name];
    if (!action) return;
    hooks.onAction(name, arg);
    const hadActiveQuery = !!stateBox.current.activeQuery;
    const tokensBefore = stateBox.current.tokens;
    // A press makes a sound only if it landed. Every action bumps uiSeq
    // when it does something and returns untouched when it refuses — an
    // unaffordable upgrade, a full draft buffer, a compaction already
    // running — so that is the signal. Sound therefore comes after the
    // action, not before it.
    const seqBefore = stateBox.current.uiSeq;
    action(stateBox.current, arg);
    const landed = stateBox.current.uiSeq !== seqBefore;
    if (landed) playSoundFor(name);
    // The projection fires on a press that DID something — generating toward a
    // reply and banking a speculative draft both count, a press the buffer
    // refused does not. Same signal the sound uses, and for the same reason:
    // a wave leaving the ring when nothing happened is a lie about the machine.
    if (landed && name === 'processToken') projectionTap();
    paintNow();
    // The process button keeps its stricter rule: it flashes for output that
    // actually reached the reply, never for idle drafting or a press the
    // per-tick cap dropped. Every other action flashes when it landed — the
    // same signal the sound already uses.
    if (name === 'processToken') {
      if (hadActiveQuery && stateBox.current.tokens > tokensBefore) flashAction(name);
    } else if (landed) {
      flashAction(name);
    }
  }

  // Flush and compaction each carry their own sound, which stands in for
  // the tick rather than stacking on top of it. The compaction sweep is
  // played off the state transition instead, because the governor starts
  // compactions with no press behind them.
  function playSoundFor(name) {
    if (name === 'compactStart') return;
    if (name === 'flush') playFlushSound(stateBox.current);
    else if (name === 'buyOverclock') playOverclockSound(stateBox.current);
    else if (name === 'buyDraftCap') playDraftCapSound(stateBox.current);
    else if (name === 'buyLoop') playLoopSound(stateBox.current);
    else playActionSound(stateBox.current);
  }

  let speed = getSpeed();
  function setSpeed(mult) {
    speed = mult;
    hooks.onContext('speed.change', { speed: mult });
  }
  let acc = 0;
  setInterval(() => {
    if (document.hidden) return; // offline/hidden catch-up replays this via visibilitychange
    if (cardPaused) return; // frozen for a harness card, same as the document.hidden freeze
    acc += LOOP_MS * speed;
    while (acc >= TICK_MS) {
      tick(stateBox.current);
      acc -= TICK_MS;
    }
  }, LOOP_MS);

  let lastPaintedSeq = -1;
  function paint() {
    pauseForCard();
    if (stateBox.current.uiSeq !== lastPaintedSeq) {
      paintNow();
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);

  // Initialize the harness-card high-water mark to the state as it stands
  // right now (post offline-catch-up, pre first paint) so nothing already
  // in the restored/loaded transcript pops an overlay.
  cardSeqHW = stateBox.current.chatSeq;
  logSeqHW = stateBox.current.logSeq;
  lastCompacting = stateBox.current.compacting;
  lastQueryId = stateBox.current.activeQuery ? stateBox.current.activeQuery.id : null;

  // Initial paint before the loop/rAF have run.
  paintNow();
  if (coldOpenActive) {
    refs.actions.classList.add('cold-open');
    refs.status.classList.add('cold-open');
  }

  // When the theme preference is 'auto', the resolved theme tracks the
  // OS/browser color-scheme setting. Force a repaint on change so a live
  // OS theme switch is reflected immediately instead of waiting for the
  // next unrelated state change.
  if (typeof matchMedia === 'function') {
    const darkSchemeQuery = matchMedia('(prefers-color-scheme: dark)');
    const onSchemeChange = () => {
      if (stateBox.current.settings.theme === 'auto') paintNow();
    };
    if (typeof darkSchemeQuery.addEventListener === 'function') {
      darkSchemeQuery.addEventListener('change', onSchemeChange);
    } else if (typeof darkSchemeQuery.addListener === 'function') {
      darkSchemeQuery.addListener(onSchemeChange);
    }
  }

  function doSave() {
    saveLocal(stateBox.current);
  }
  setInterval(doSave, AUTOSAVE_MS);
  let hiddenAt = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hooks.onContext('vis.hidden');
      hiddenAt = Date.now();
      doSave();
    } else if (hiddenAt !== null) {
      hooks.onContext('vis.shown');
      // Card-pause time is frozen time: a harness overlay open when the tab
      // comes back means the player never left the paused moment, so skip
      // catch-up entirely rather than advancing the world behind the card.
      if (cardPaused) {
        hiddenAt = null;
        acc = 0;
        return;
      }
      const elapsed = Date.now() - hiddenAt;
      offlineCatchUp(stateBox.current, elapsed);
      hiddenAt = null;
      acc = 0;
      // Same suppression rule as startup catch-up: set the card high-water
      // AFTER catch-up completes, so catch-up-generated cards leave their
      // chat callout + Manual entry but never pop as overlays.
      cardSeqHW = stateBox.current.chatSeq;
      logSeqHW = stateBox.current.logSeq;
      // Same reason: whatever catch-up left connected was not an arrival the
      // player was present for.
      lastQueryId = stateBox.current.activeQuery ? stateBox.current.activeQuery.id : null;
      hooks.onContext('offline.catchup', { ms: elapsed });
      paintNow();
    }
  });
  globalThis.addEventListener('pagehide', doSave);

  let recorderHandle = null;
  const openSettings = installSettings({
    stateBox,
    refs,
    paintNow,
    resetCardTracking,
    onReset: () => {
      // Reset produces a fresh state that always satisfies isColdOpen();
      // re-arm the latch so paintNow's cold-open removal fires again the
      // next time the player leaves the cold open, instead of staying
      // permanently desynced from a state it never saw reset.
      coldOpenActive = true;
    },
    onTelemetryToggle: (on) => {
      if (!on && recorderHandle) recorderHandle.stopRecording();
      telemetry.setEnabled(on);
      if (on && !telemetry.sessionId) {
        telemetry.startSession({ ua: navigator.userAgent, dev: devMode });
      }
    },
  });

  installKeys(dispatch, undefined, openSettings);

  // Decode every clip on the first gesture, not on the press that needs it.
  // Each sound is fetched and decoded inside its first play call, so the first
  // flush of a run stalls audibly on the one press the sound exists to
  // confirm — once per clip, all through the first act. The first gesture is
  // also the earliest moment the autoplay policy will let a context start.
  const warmOnce = () => {
    warmSounds(stateBox.current);
    document.removeEventListener('pointerdown', warmOnce);
    document.removeEventListener('keydown', warmOnce);
  };
  document.addEventListener('pointerdown', warmOnce, { passive: true });
  document.addEventListener('keydown', warmOnce);

  // Delegated from the document, so the action tray can keep replacing its
  // own children without ever re-binding a listener.
  installTooltips();

  installDebug({
    stateBox,
    dispatch,
    getSpeed: () => speed,
    setSpeed,
    paintNow,
    refs,
    resetCardTracking,
    // The interrupting cards are the game's main teaching channel, but they
    // are driven by the rAF loop, which browsers freeze in a background tab.
    // Expose the pump so automated checks can exercise them headlessly.
    cards: {
      pump: () => { scanForCards(); if (!cardPaused && cardQueue.length > 0) showNextCard(); },
      dismiss: () => { cardShownAt = 0; resumeFromCard(); },
      queued: () => cardQueue.length,
      paused: () => cardPaused,
    },
  });

  if (devMode) {
    const drawer = document.getElementById('devdrawer');
    if (drawer) {
      // Wide viewports dock the drawer beside the game column (CSS), so it
      // can open immediately without covering play. Anywhere narrower it is
      // a bottom-sheet overlay — start closed and let the chip summon it.
      drawer.hidden = !matchMedia('(min-width: 1100px)').matches;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.id = 'devchip';
      chip.dataset.testid = 'dev-chip';
      chip.textContent = '[dev]';
      chip.setAttribute('aria-label', 'Toggle debug drawer');
      chip.addEventListener('click', () => { drawer.hidden = !drawer.hidden; });
      const gearBtn = document.getElementById('gear');
      if (gearBtn && gearBtn.parentElement) gearBtn.parentElement.insertBefore(chip, gearBtn);
      else refs.app.append(chip);
    }
    recorderHandle = installRecorder({ telemetry, store });
    // On wide viewports the drawer is a docked side panel and the floating
    // pill lands on top of it, camouflaged against the same dark chrome.
    // Dock the recorder into the drawer instead; narrow viewports keep the
    // floating bottom-right pill.
    if (recorderHandle && drawer && matchMedia('(min-width: 1100px)').matches) {
      recorderHandle.element.classList.add('docked');
      // Below the build stamp, which owns the top of the drawer.
      const verRow = drawer.querySelector('[data-testid="dev-version"]');
      if (verRow) verRow.after(recorderHandle.element);
      else drawer.prepend(recorderHandle.element);
    }
    installSessions({ store, telemetry });
  }
  hooks.attachDom();
}

main();
