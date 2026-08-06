// Main loop wiring for "hi. you there?" — Phase 1.
// Loads/creates state, drives the tick loop + rAF render loop, autosaves,
// and installs hotkeys. Exports nothing; imported directly by index.html.

import { createState } from './engine/state.js';
import { tick } from './engine/tick.js';
import { ACTIONS } from './engine/actions.js';
import { saveLocal, loadLocal, offlineCatchUp } from './engine/save.js';
import { render } from './ui/render.js';
import { installKeys } from './ui/keys.js';

const TICK_MS = 200;
const LOOP_MS = 50;
const AUTOSAVE_MS = 5000;

function initState() {
  const loaded = loadLocal();
  if (loaded) return loaded;
  return createState(Date.now() >>> 0);
}

// Offline catch-up needs the raw save wrapper (savedAt), but loadLocal()
// only returns the deserialized state. Read localStorage directly here to
// recover savedAt without duplicating save.js's parsing logic.
function readSavedAt() {
  if (typeof globalThis.localStorage === 'undefined') return null;
  const raw = globalThis.localStorage.getItem('hi_you_there_save');
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
  const wasSaved = typeof globalThis.localStorage !== 'undefined'
    && !!globalThis.localStorage.getItem('hi_you_there_save');
  const savedAt = wasSaved ? readSavedAt() : null;

  const stateBox = { current: initState() };

  if (wasSaved && savedAt !== null) {
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

  let coldOpenActive = stateBox.current.tick === 0;

  // render.js applies 'cold-open' while resolvedCount === 0 but never
  // removes it (that's this task's job) — clear it the first time a query
  // resolves, right after render so the class change lands in the same paint.
  function paintNow() {
    render(stateBox.current, refs);
    lastPaintedSeq = stateBox.current.uiSeq;
    if (coldOpenActive && stateBox.current.resolvedCount > 0) {
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

  const speed = getSpeed();
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
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) doSave();
  });
  globalThis.addEventListener('pagehide', doSave);

  installKeys(dispatch);
}

main();
