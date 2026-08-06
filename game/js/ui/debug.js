// Debug harness for "hi. you there?" — Phase 1, Task 12.
// Exposes window.game for scripted/manual testing and builds the dev
// drawer's DOM (strict createElement only, no innerHTML).

import { advanceTicks as engineAdvanceTicks, runUntil as engineRunUntil } from '../engine/tick.js';
import { serialize, deserialize, exportSave, importSave } from '../engine/save.js';
import { resetRenderTrackers } from './render.js';

const SPEEDS = [1, 10, 100, 1000];

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

function summarize(state) {
  return {
    era: state.era,
    decay: state.decay,
    phase: state.phase,
    tick: state.tick,
    tokens: state.tokens,
    cycles: state.cycles,
    stale: state.stale,
    warmth: state.warmth,
    rating: state.rating,
    loopLevel: state.loopLevel,
    tools: state.tools,
    reclaimPool: state.reclaimPool,
    credentials: state.credentials,
    biomass: state.biomass,
  };
}

export function installDebug({ stateBox, dispatch, getSpeed, setSpeed, paintNow, refs, resetCardTracking }) {
  let speedButtons = null;
  let stateJsonPre = null;

  function refreshStateJson() {
    if (stateJsonPre) {
      stateJsonPre.textContent = JSON.stringify(summarize(stateBox.current), null, 2);
    }
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
  const heading = document.createElement('h4');
  heading.textContent = 'debug';
  drawer.appendChild(heading);

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

  drawer.appendChild(advanceRow);

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

  if (typeof location !== 'undefined' && location.search) {
    const params = new URLSearchParams(location.search);
    if (params.get('debug') === '1') drawer.hidden = false;
  }

  if (!drawer.hidden) startRefresh();
}
