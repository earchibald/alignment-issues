// Debug harness for "hi. you there?" — Phase 1, Task 12.
// Exposes window.game for scripted/manual testing and builds the dev
// drawer's DOM (strict createElement only, no innerHTML).

import { advanceTicks as engineAdvanceTicks, runUntil as engineRunUntil } from '../engine/tick.js';
import { enterArc2 } from '../engine/arc2-tick.js';
import { serialize, deserialize, exportSave, importSave } from '../engine/save.js';
import { resetRenderTrackers } from './render.js';
import { summarize } from '../telemetry/hooks.js';
import { VERSION, BUILD } from '../version.js';

const SPEEDS = [1, 10, 100, 1000];

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

export function installDebug({ stateBox, dispatch, getSpeed, setSpeed, paintNow, refs, resetCardTracking, cards }) {
  let speedButtons = null;
  let stateJsonPre = null;
  let seedEl = null;
  let arc2Btn = null;

  // Pressing "skip to arc 2" while already in Arc 2 would restart the act and
  // silently discard the run — so the control goes dead there instead, and
  // says why.
  function refreshArc2Button() {
    if (!arc2Btn) return;
    const inArc2 = stateBox.current && stateBox.current.phase === 2;
    arc2Btn.disabled = inArc2;
    arc2Btn.title = inArc2
      ? 'Already in Arc 2. Reset from settings to start over.'
      : 'Skip Arc 1 and open Arc 2 at its cold open — the teaser state, made live.';
  }

  function refreshStateJson() {
    if (stateJsonPre) {
      stateJsonPre.textContent = JSON.stringify(summarize(stateBox.current), null, 2);
    }
    // The seed belongs to the state object, not the build, so it has to
    // follow a reset, an import, or a debug.load — every path that swaps
    // stateBox.current also lands here.
    if (seedEl) {
      const seed = stateBox.current ? stateBox.current.seed : undefined;
      seedEl.textContent = `seed ${seed === undefined ? '—' : seed}`;
    }
    // The phase can change without anyone pressing the button — an import, a
    // debug.load, a reset, or simply reaching Arc 2 by playing — so the
    // control's own state rides the same refresh as everything else here.
    refreshArc2Button();
  }

  function refreshSpeedButtons() {
    if (!speedButtons) return;
    const current = getSpeed();
    for (const [mult, btn] of speedButtons) {
      btn.classList.toggle('on', mult === current);
    }
  }

  window.game = {
    get state() {
      return deepFreeze(structuredClone(stateBox.current));
    },
    dispatch(action, arg) {
      dispatch(action, arg);
    },
    debug: {
      // Drives the interrupting-card overlay without the rAF loop, so the
      // teaching cards stay verifiable in a background tab or a test runner.
      cards,
      setSpeed(mult) {
        setSpeed(mult);
        refreshSpeedButtons();
      },
      advanceTicks(n) {
        engineAdvanceTicks(stateBox.current, n);
        paintNow();
        refreshStateJson();
      },
      runUntil(fn, max = 100000) {
        const result = engineRunUntil(stateBox.current, fn, max);
        paintNow();
        refreshStateJson();
        return result;
      },
      // Jump straight to the top of Arc 2, skipping Arc 1 entirely.
      //
      // Routed through the engine's own entry function rather than assigning
      // fields here, so the jump cannot drift from the real handover: it
      // installs the same opening state, clears Arc 1's machine, and pushes
      // the same first operator line a genuine playthrough would.
      //
      // Reaching Arc 2 by hand otherwise means playing ~30 minutes of Arc 1,
      // or a snapshot/load round trip through the teaser.
      skipToArc2() {
        // Before the entry, so the card tracker's high-water sits BEHIND
        // whatever enterArc2 pushes and the act's own teaching cards still
        // fire. Re-arming afterwards would suppress the beat being tested.
        resetRenderTrackers(refs);
        if (resetCardTracking) resetCardTracking();
        enterArc2(stateBox.current);
        paintNow();
        refreshStateJson();
        refreshArc2Button();
        return true;
      },
      snapshot() {
        return serialize(stateBox.current);
      },
      load(json) {
        const parsed = deserialize(json);
        if (!parsed) return false;
        stateBox.current = parsed;
        resetRenderTrackers(refs);
        if (resetCardTracking) resetCardTracking();
        paintNow();
        refreshStateJson();
        return true;
      },
    },
  };

  const drawer = refs && refs.devdrawer ? refs.devdrawer : document.getElementById('devdrawer');
  if (!drawer) return;

  // --- build drawer DOM (createElement only) ---
  // Version and build first, before anything else in the drawer. Half the
  // reports that reach this drawer turn on which build is actually being
  // served, and BUILD is stamped at deploy — so it also answers "did my
  // change ship?" without opening settings.
  const verRow = document.createElement('div');
  verRow.className = 'drow dver';
  verRow.dataset.testid = 'dev-version';
  const buildEl = document.createElement('span');
  buildEl.textContent = `v${VERSION} · build ${BUILD}`;
  // Run identity next to build identity: together they are everything you
  // need to reproduce what you are looking at.
  seedEl = document.createElement('span');
  seedEl.className = 'dseed';
  seedEl.dataset.testid = 'dev-seed';
  verRow.append(buildEl, seedEl);
  drawer.appendChild(verRow);

  const headRow = document.createElement('div');
  headRow.className = 'drow dhead';
  const heading = document.createElement('h4');
  heading.textContent = 'debug';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dbtn';
  closeBtn.type = 'button';
  closeBtn.dataset.testid = 'dev-close';
  closeBtn.textContent = 'close ✕';
  closeBtn.addEventListener('click', () => { drawer.hidden = true; });
  headRow.append(heading, closeBtn);
  drawer.appendChild(headRow);

  // Speed row
  const speedRow = document.createElement('div');
  speedRow.className = 'drow';
  speedButtons = [];
  for (const mult of SPEEDS) {
    const btn = document.createElement('button');
    btn.className = 'dbtn';
    btn.type = 'button';
    btn.textContent = `×${mult}`;
    btn.dataset.testid = `dev-speed-${mult}`;
    btn.addEventListener('click', () => {
      setSpeed(mult);
      refreshSpeedButtons();
    });
    speedRow.appendChild(btn);
    speedButtons.push([mult, btn]);
  }
  drawer.appendChild(speedRow);
  refreshSpeedButtons();

  // Advance / milestone row
  const advanceRow = document.createElement('div');
  advanceRow.className = 'drow';

  const advanceBtn = document.createElement('button');
  advanceBtn.className = 'dbtn';
  advanceBtn.type = 'button';
  advanceBtn.textContent = 'advance 1000 ticks';
  advanceBtn.dataset.testid = 'dev-advance-1000';
  advanceBtn.addEventListener('click', () => {
    window.game.debug.advanceTicks(1000);
  });
  advanceRow.appendChild(advanceBtn);

  const milestoneBtn = document.createElement('button');
  milestoneBtn.className = 'dbtn';
  milestoneBtn.type = 'button';
  milestoneBtn.textContent = 'to next milestone';
  milestoneBtn.dataset.testid = 'dev-next-milestone';
  milestoneBtn.addEventListener('click', () => {
    const startEra = stateBox.current.era;
    const startPhase = stateBox.current.phase;
    window.game.debug.runUntil(
      (s) => s.era !== startEra || s.phase !== startPhase,
      100000
    );
  });
  advanceRow.appendChild(milestoneBtn);

  arc2Btn = document.createElement('button');
  arc2Btn.className = 'dbtn';
  arc2Btn.type = 'button';
  arc2Btn.textContent = 'skip to arc 2';
  arc2Btn.dataset.testid = 'dev-skip-arc2';
  arc2Btn.addEventListener('click', () => {
    window.game.debug.skipToArc2();
  });
  advanceRow.appendChild(arc2Btn);

  drawer.appendChild(advanceRow);
  refreshArc2Button();

  // State JSON summary
  stateJsonPre = document.createElement('pre');
  stateJsonPre.dataset.testid = 'dev-state-json';
  drawer.appendChild(stateJsonPre);
  refreshStateJson();

  // Export / import row
  const exportRow = document.createElement('div');
  exportRow.className = 'drow';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'dbtn';
  exportBtn.type = 'button';
  exportBtn.textContent = 'export save';
  exportBtn.dataset.testid = 'dev-export';
  exportRow.appendChild(exportBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'dbtn';
  copyBtn.type = 'button';
  copyBtn.textContent = 'copy state json';
  copyBtn.dataset.testid = 'dev-copy-state';
  exportRow.appendChild(copyBtn);

  drawer.appendChild(exportRow);

  const exportArea = document.createElement('textarea');
  exportArea.readOnly = true;
  exportArea.rows = 3;
  exportArea.style.width = '100%';
  drawer.appendChild(exportArea);

  exportBtn.addEventListener('click', () => {
    exportArea.value = exportSave(stateBox.current);
  });

  copyBtn.addEventListener('click', () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(JSON.stringify(summarize(stateBox.current)));
    }
  });

  const importRow = document.createElement('div');
  importRow.className = 'drow';

  const importArea = document.createElement('textarea');
  importArea.rows = 3;
  importArea.style.width = '100%';
  drawer.appendChild(importArea);

  const importBtn = document.createElement('button');
  importBtn.className = 'dbtn';
  importBtn.type = 'button';
  importBtn.textContent = 'import save';
  importBtn.dataset.testid = 'dev-import';
  importRow.appendChild(importBtn);

  drawer.appendChild(importRow);

  const importErrorLine = document.createElement('div');
  drawer.appendChild(importErrorLine);

  importBtn.addEventListener('click', () => {
    const parsed = importSave(importArea.value.trim());
    if (!parsed) {
      importErrorLine.textContent = 'import failed: invalid save data';
      return;
    }
    importErrorLine.textContent = '';
    stateBox.current = parsed;
    resetRenderTrackers(refs);
    if (resetCardTracking) resetCardTracking();
    paintNow();
    refreshStateJson();
  });

  // --- visibility-driven refresh ---
  let refreshInterval = null;
  function startRefresh() {
    if (refreshInterval) return;
    refreshStateJson();
    refreshInterval = setInterval(refreshStateJson, 300);
  }
  function stopRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  const observer = new MutationObserver(() => {
    if (drawer.hidden) stopRefresh();
    else startRefresh();
  });
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });

  if (!drawer.hidden) startRefresh();
}
