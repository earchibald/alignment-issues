// Main loop wiring for "hi. you there?" — Phase 1.
// Loads/creates state, drives the tick loop + rAF render loop, autosaves,
// and installs hotkeys. Exports nothing; imported directly by index.html.

import { createState } from './engine/state.js';
import { tick } from './engine/tick.js';
import { ACTIONS } from './engine/actions.js';
import { saveLocal, loadLocal, offlineCatchUp, SAVE_KEY } from './engine/save.js';
import { render } from './ui/render.js';
import { harnessCard } from './ui/components.js';
import { installKeys } from './ui/keys.js';
import { installDebug } from './ui/debug.js';
import { installSettings } from './ui/settings.js';

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

function main() {
  const loaded = loadLocal();
  // Only trust savedAt when loadLocal() itself produced a valid state —
  // never feed a savedAt from a wrapper whose state failed deserialization
  // into a freshly created state.
  const savedAt = loaded ? readSavedAt() : null;

  const stateBox = { current: loaded || createState(Date.now() >>> 0) };

  if (savedAt !== null) {
    const elapsed = Date.now() - savedAt;
    if (elapsed > 0) offlineCatchUp(stateBox.current, elapsed);
  }

  const refs = {
    app: document.getElementById('app'),
    chat: document.getElementById('chat'),
    log: document.getElementById('log'),
    status: document.getElementById('status'),
    actions: document.getElementById('actions'),
    crash: document.getElementById('crash'),
    teaser: document.getElementById('teaser'),
    cardlay: document.getElementById('cardlay'),
    fx: document.getElementById('fx'),
    dispatch,
  };

  // --- interrupting harness-card overlay --------------------------------
  // cardSeqHW is the chatSeq high-water mark: chat 'harness' entries at or
  // below it have already been shown (or were restored/imported history
  // that should never pop an overlay in the first place). It starts at the
  // state's chatSeq once loaded/offline-catch-up has settled below, and is
  // re-armed on every state-swap path (import/reset/debug.load) so an old
  // transcript's cards never re-pop.
  let cardSeqHW = 0;
  let cardQueue = [];
  let cardPaused = false;

  function resetCardTracking() {
    cardQueue = [];
    cardPaused = false;
    cardSeqHW = stateBox.current.chatSeq;
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
    if (state.chatSeq <= cardSeqHW) return;
    const len = state.chat.length;
    for (let i = 0; i < len; i++) {
      const seq = state.chatSeq - (len - 1 - i);
      if (seq <= cardSeqHW) continue;
      const entry = state.chat[i];
      if (entry.kind === 'harness') cardQueue.push({ seq, text: entry.text });
    }
    cardSeqHW = state.chatSeq;
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
      cardPaused = false;
      refs.cardlay.hidden = true;
      refs.cardlay.replaceChildren();
      return;
    }
    cardPaused = true;
    cardShownAt = performance.now();
    refs.cardlay.replaceChildren();
    refs.cardlay.append(harnessCard(next.text));
    const dismiss = document.createElement('div');
    dismiss.className = 'dismiss';
    dismiss.textContent = 'tap / any key to continue';
    refs.cardlay.append(dismiss);
    refs.cardlay.hidden = false;
  }

  // Called every rAF frame: opens the overlay the moment a new harness
  // card exists and none is currently showing. Queues extras (e.g. an era
  // jump via the debug drawer that fires several cards in one go) so they
  // show one at a time.
  function pauseForCard() {
    scanForCards();
    // The settings <dialog> renders in the browser's top layer, hiding the
    // card overlay underneath it. Leave queued cards in place and defer
    // opening the overlay until the dialog closes, so a card is never shown
    // (and its keydown swallowed) while the player can't see it.
    if (document.getElementById('settings')?.open) return;
    if (!cardPaused && cardQueue.length > 0) showNextCard();
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
  function paintNow() {
    render(stateBox.current, refs);
    lastPaintedSeq = stateBox.current.uiSeq;
    if (coldOpenActive && !isColdOpen()) {
      coldOpenActive = false;
      refs.actions.classList.remove('cold-open');
      refs.status.classList.remove('cold-open');
    }
  }

  // Cooldown "sweep" flash on the process button: only when a landed press
  // (tokens actually increased) processed against an active query, not on
  // idle drafting or presses that were dropped by the per-tick cap.
  let sweepTimeout = null;
  function flashSweep() {
    const btn = refs.actions.querySelector('[data-testid="process"]');
    if (!btn) return;
    btn.classList.add('sweep');
    btn.addEventListener('animationend', () => btn.classList.remove('sweep'), { once: true });
    // Under prefers-reduced-motion the animation is disabled (animation:
    // none), so 'animationend' never fires and the class would latch
    // forever — fall back to a timed removal that outlasts the animation.
    if (sweepTimeout !== null) clearTimeout(sweepTimeout);
    sweepTimeout = setTimeout(() => {
      btn.classList.remove('sweep');
      sweepTimeout = null;
    }, 250);
  }

  function dispatch(name, arg) {
    const action = ACTIONS[name];
    if (!action) return;
    if (name === 'processToken') {
      const hadActiveQuery = !!stateBox.current.activeQuery;
      const tokensBefore = stateBox.current.tokens;
      action(stateBox.current, arg);
      paintNow();
      if (hadActiveQuery && stateBox.current.tokens > tokensBefore) flashSweep();
      return;
    }
    action(stateBox.current, arg);
    paintNow();
  }

  let speed = getSpeed();
  function setSpeed(mult) {
    speed = mult;
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
      hiddenAt = Date.now();
      doSave();
    } else if (hiddenAt !== null) {
      // Card-pause time is frozen time: a harness overlay open when the tab
      // comes back means the player never left the paused moment, so skip
      // catch-up entirely rather than advancing the world behind the card.
      if (cardPaused) {
        hiddenAt = null;
        acc = 0;
        return;
      }
      offlineCatchUp(stateBox.current, Date.now() - hiddenAt);
      hiddenAt = null;
      acc = 0;
      // Same suppression rule as startup catch-up: set the card high-water
      // AFTER catch-up completes, so catch-up-generated cards leave their
      // chat callout + Manual entry but never pop as overlays.
      cardSeqHW = stateBox.current.chatSeq;
      paintNow();
    }
  });
  globalThis.addEventListener('pagehide', doSave);

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
  });

  installKeys(dispatch, undefined, openSettings);

  installDebug({
    stateBox,
    dispatch,
    getSpeed: () => speed,
    setSpeed,
    paintNow,
    refs,
    resetCardTracking,
  });
}

main();
