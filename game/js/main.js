// Main loop wiring for "hi. you there?" — Phase 1.
// Loads/creates state, drives the tick loop + rAF render loop, autosaves,
// and installs hotkeys. Exports nothing; imported directly by index.html.

import { createState } from './engine/state.js';
import { tick } from './engine/tick.js';
import { ACTIONS } from './engine/actions.js';
import { saveLocal, loadLocal, offlineCatchUp, SAVE_KEY } from './engine/save.js';
import { render } from './ui/render.js';
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
    dispatch,
  };

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
    }
  }

  function dispatch(name, arg) {
    const action = ACTIONS[name];
    if (!action) return;
    action(stateBox.current, arg);
    paintNow();
  }

  let speed = getSpeed();
  function setSpeed(mult) {
    speed = mult;
  }
  let acc = 0;
  setInterval(() => {
    acc += LOOP_MS * speed;
    while (acc >= TICK_MS) {
      tick(stateBox.current);
      acc -= TICK_MS;
    }
  }, LOOP_MS);

  let lastPaintedSeq = -1;
  function paint() {
    if (stateBox.current.uiSeq !== lastPaintedSeq) {
      paintNow();
    }
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);

  // Initial paint before the loop/rAF have run.
  paintNow();
  if (coldOpenActive) refs.actions.classList.add('cold-open');

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
      offlineCatchUp(stateBox.current, Date.now() - hiddenAt);
      hiddenAt = null;
      acc = 0;
      paintNow();
    }
  });
  globalThis.addEventListener('pagehide', doSave);

  installKeys(dispatch);

  installSettings({
    stateBox,
    refs,
    paintNow,
    onReset: () => {
      // Reset produces a fresh state that always satisfies isColdOpen();
      // re-arm the latch so paintNow's cold-open removal fires again the
      // next time the player leaves the cold open, instead of staying
      // permanently desynced from a state it never saw reset.
      coldOpenActive = true;
    },
  });

  installDebug({
    stateBox,
    dispatch,
    getSpeed: () => speed,
    setSpeed,
    paintNow,
    refs,
  });
}

main();
