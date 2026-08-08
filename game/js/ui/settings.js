// Settings sheet for "hi. you there?" — Phase 1, Task 13.
// installSettings({stateBox, refs, paintNow, onReset}) builds the contents
// of dialog#settings (strict createElement, no innerHTML) and wires #gear
// to open it. Escape open/close is already wired in keys.js — untouched.

import { exportSave, importSave, saveLocal, SAVE_KEY } from '../engine/save.js';
import { createState } from '../engine/state.js';
import { resetRenderTrackers } from './render.js';
import { HINTS, HARNESS_CARDS } from '../engine/content.js';
import { VERSION, BUILD } from '../version.js';
import { harnessCard } from './components.js';
import { TELEMETRY_OPTOUT_KEY } from '../telemetry/store.js';
import { DIFFUSION_OFF_KEY } from './diffusion/pending-answer.js';

function row(...children) {
  const el = document.createElement('div');
  el.className = 'settings-row';
  el.append(...children);
  return el;
}

export function installSettings({ stateBox, refs, paintNow, onReset, resetCardTracking, onTelemetryToggle }) {
  const gear = document.getElementById('gear');
  const dialog = document.getElementById('settings');
  if (!dialog) return;

  dialog.replaceChildren();

  const heading = document.createElement('h3');
  heading.className = 'settings-title';
  heading.textContent = 'Settings';
  dialog.append(heading);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'settings-close';
  closeBtn.dataset.testid = 'settings-close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.append(closeBtn);

  // --- sound toggle -----------------------------------------------
  const soundLabel = document.createElement('label');
  soundLabel.className = 'settings-label';
  const soundCheckbox = document.createElement('input');
  soundCheckbox.type = 'checkbox';
  soundCheckbox.dataset.testid = 'settings-sound';
  soundCheckbox.checked = !!stateBox.current.settings.sound;
  soundCheckbox.addEventListener('change', () => {
    stateBox.current.settings.sound = soundCheckbox.checked;
    saveLocal(stateBox.current);
  });
  soundLabel.append(soundCheckbox, document.createTextNode(' Sound'));
  dialog.append(row(soundLabel));

  // --- answer diffusion toggle ------------------------------------
  // Default on. Off means no pending node at all and the transcript behaves
  // exactly as it did before the effect existed. Stored in localStorage
  // rather than in state.settings, because it is a view preference and
  // state.v must not change.
  const diffLabel = document.createElement('label');
  diffLabel.className = 'settings-label';
  const diffCheckbox = document.createElement('input');
  diffCheckbox.type = 'checkbox';
  diffCheckbox.dataset.testid = 'settings-diffusion';
  diffCheckbox.checked = globalThis.localStorage.getItem(DIFFUSION_OFF_KEY) !== '1';
  diffCheckbox.addEventListener('change', () => {
    if (diffCheckbox.checked) globalThis.localStorage.removeItem(DIFFUSION_OFF_KEY);
    else globalThis.localStorage.setItem(DIFFUSION_OFF_KEY, '1');
    // Take effect immediately: the pending node is dropped or built on the
    // next render, without a reload.
    if (paintNow) paintNow();
  });
  diffLabel.append(diffCheckbox, document.createTextNode(' Show answers being generated'));
  dialog.append(row(diffLabel));

  // --- telemetry toggle -------------------------------------------
  const telLabel = document.createElement('label');
  telLabel.className = 'settings-label';
  const telCheckbox = document.createElement('input');
  telCheckbox.type = 'checkbox';
  telCheckbox.dataset.testid = 'settings-telemetry';
  telCheckbox.checked = globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) !== '1';
  telCheckbox.addEventListener('change', () => {
    if (telCheckbox.checked) globalThis.localStorage.removeItem(TELEMETRY_OPTOUT_KEY);
    else globalThis.localStorage.setItem(TELEMETRY_OPTOUT_KEY, '1');
    if (onTelemetryToggle) onTelemetryToggle(telCheckbox.checked);
  });
  telLabel.append(telCheckbox, document.createTextNode(' Session telemetry'));
  dialog.append(row(telLabel));

  // --- theme selector -------------------------------------------------
  const themeHeading = document.createElement('h4');
  themeHeading.textContent = 'Theme';
  dialog.append(themeHeading);

  function themeRadio(value, labelText) {
    const label = document.createElement('label');
    label.className = 'settings-label';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'theme';
    radio.value = value;
    radio.dataset.testid = `theme-${value}`;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      stateBox.current.settings.theme = value;
      saveLocal(stateBox.current);
    });
    label.append(radio, document.createTextNode(` ${labelText}`));
    return { label, radio };
  }

  const themeAuto = themeRadio('auto', 'Auto');
  const themeLight = themeRadio('light', 'Light');
  const themeDark = themeRadio('dark', 'Dark');
  dialog.append(row(themeAuto.label, themeLight.label, themeDark.label));

  // --- export -------------------------------------------------------
  const exportHeading = document.createElement('h4');
  exportHeading.textContent = 'Export save';
  dialog.append(exportHeading);

  const exportArea = document.createElement('textarea');
  exportArea.readOnly = true;
  exportArea.rows = 3;
  exportArea.dataset.testid = 'settings-export-text';
  dialog.append(exportArea);

  const exportRow = document.createElement('div');
  exportRow.className = 'settings-row';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.dataset.testid = 'settings-export';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', () => {
    exportArea.value = exportSave(stateBox.current);
  });
  exportRow.append(exportBtn);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.dataset.testid = 'settings-export-copy';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(exportArea.value);
    }
  });
  exportRow.append(copyBtn);

  dialog.append(exportRow);

  // --- import -------------------------------------------------------
  const importHeading = document.createElement('h4');
  importHeading.textContent = 'Import save';
  dialog.append(importHeading);

  const importArea = document.createElement('textarea');
  importArea.rows = 3;
  importArea.dataset.testid = 'settings-import-text';
  dialog.append(importArea);

  const importError = document.createElement('div');
  importError.className = 'warn';
  dialog.append(importError);

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.dataset.testid = 'settings-import';
  importBtn.textContent = 'Import';
  importBtn.addEventListener('click', () => {
    const parsed = importSave(importArea.value.trim());
    if (!parsed) {
      importError.textContent = 'Import failed: invalid save data.';
      return;
    }
    importError.textContent = '';
    stateBox.current = parsed;
    saveLocal(stateBox.current);
    dialog.close();
    resetRenderTrackers(refs);
    if (resetCardTracking) resetCardTracking();
    if (paintNow) paintNow();
  });
  dialog.append(importBtn);

  // --- reset ----------------------------------------------------------
  const resetHeading = document.createElement('h4');
  resetHeading.textContent = 'Reset';
  dialog.append(resetHeading);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.dataset.testid = 'settings-reset';
  resetBtn.textContent = 'Reset game';
  dialog.append(resetBtn);

  // Two deliberate confirmations rather than a typed keyword: each step
  // states a different consequence, and Cancel is always the wider target.
  // Step 0 = idle, 1 = "are you sure", 2 = "last chance".
  const confirmRow = document.createElement('div');
  confirmRow.className = 'settings-row settings-danger';
  confirmRow.hidden = true;

  const confirmText = document.createElement('p');
  confirmText.className = 'warn';
  confirmRow.append(confirmText);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.dataset.testid = 'settings-reset-confirm';
  confirmRow.append(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.dataset.testid = 'settings-reset-cancel';
  cancelBtn.textContent = 'Cancel';
  confirmRow.append(cancelBtn);

  const CONFIRM_STEPS = [
    null,
    { text: 'Erase this run and start over? Your progress, upgrades and transcript all go.', button: 'Yes, erase it' },
    { text: 'Last chance — this cannot be undone, and there is no backup unless you exported one.', button: 'Erase everything' },
  ];
  let confirmStep = 0;

  function showConfirmStep(step) {
    confirmStep = step;
    if (step === 0) {
      confirmRow.hidden = true;
      return;
    }
    confirmText.textContent = CONFIRM_STEPS[step].text;
    confirmBtn.textContent = CONFIRM_STEPS[step].button;
    confirmBtn.classList.toggle('danger', step === CONFIRM_STEPS.length - 1);
    confirmRow.hidden = false;
  }

  resetBtn.addEventListener('click', () => showConfirmStep(1));
  cancelBtn.addEventListener('click', () => showConfirmStep(0));

  confirmBtn.addEventListener('click', () => {
    if (confirmStep < CONFIRM_STEPS.length - 1) {
      showConfirmStep(confirmStep + 1);
      return;
    }
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(SAVE_KEY);
    }
    stateBox.current = createState(Date.now() >>> 0);
    showConfirmStep(0);
    dialog.close();
    resetRenderTrackers(refs);
    if (resetCardTracking) resetCardTracking();
    if (onReset) onReset();
    if (paintNow) paintNow();
  });

  dialog.append(confirmRow);

  // --- manual ---------------------------------------------------------
  // Rebuilt fresh on every openSettings() call so it always reflects the
  // live state.hintsSeen / state.era, including changes made mid-session
  // (import, reset, or ordinary play) since the dialog was last opened.
  const manualHeading = document.createElement('h4');
  manualHeading.textContent = 'Manual';
  dialog.append(manualHeading);

  const manualBody = document.createElement('div');
  manualBody.dataset.testid = 'settings-manual';
  dialog.append(manualBody);

  function renderManual() {
    manualBody.replaceChildren();
    const state = stateBox.current;
    // hintsSeen also tracks one-shot asides and mid-era card markers, which
    // have no HINTS entry — only teaching hints belong in the manual.
    const taught = state.hintsSeen.filter((id) => HINTS[id]);
    if (taught.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'manual-hint manual-empty';
      empty.textContent = 'Nothing attached yet.';
      manualBody.append(empty);
    } else {
      for (const id of taught) {
        const hintEl = document.createElement('div');
        hintEl.className = 'manual-hint';
        hintEl.textContent = HINTS[id];
        manualBody.append(hintEl);
      }
    }
    const maxEra = Math.min(state.era, 4);
    for (let e = 1; e <= maxEra; e++) {
      manualBody.append(harnessCard(HARNESS_CARDS[e]));
    }
  }

  // --- about ----------------------------------------------------------
  // Version plus the build actually being served. BUILD is stamped by the
  // deploy workflow, so "dev" here means you are on a local working tree,
  // and a mismatch with the expected commit means a stale cache or a stale
  // deploy — both of which have bitten this project before.
  const aboutHeading = document.createElement('h4');
  aboutHeading.textContent = 'About';
  dialog.append(aboutHeading);

  const about = document.createElement('div');
  about.className = 'settings-about';
  about.dataset.testid = 'settings-version';
  about.textContent = `hi. you there? — v${VERSION} · build ${BUILD}`;
  dialog.append(about);

  // --- acknowledgements -----------------------------------------------
  // Third-party asset credits, collapsed behind a button so the dialog
  // stays short. The freesound license (CC Attribution 4.0) requires the
  // credit line to be available to the player.
  const ackBtn = document.createElement('button');
  ackBtn.type = 'button';
  ackBtn.dataset.testid = 'settings-acknowledgements';
  ackBtn.textContent = 'Acknowledgements';
  dialog.append(row(ackBtn));

  const ackBody = document.createElement('div');
  ackBody.className = 'settings-about';
  ackBody.dataset.testid = 'settings-acknowledgements-body';
  ackBody.hidden = true;
  function ackEntry(before, url, after) {
    const line = document.createElement('p');
    line.append(document.createTextNode(before));
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = url;
    line.append(link, document.createTextNode(after));
    return line;
  }
  ackBody.append(
    ackEntry('ui sound 8.wav by nezuai -- ', 'https://freesound.org/s/582609/', ' -- License: Attribution 4.0'),
    ackEntry('microtick.wav by Saltbearer -- ', 'https://freesound.org/s/481984/', ' -- License: Creative Commons 0'),
    ackEntry('Sweeping by georgesavic -- ', 'https://freesound.org/s/593466/', ' -- License: Creative Commons 0'),
    ackEntry('foley_cable_whoosh_air_001.wav by soundscalpel.com -- ', 'https://freesound.org/s/110615/', ' -- License: Attribution 3.0'),
    ackEntry('Short Sub Bass Drop G 49hz by Geoff-Bremner-Audio -- ', 'https://freesound.org/s/752399/', ' -- License: Attribution 4.0'),
    ackEntry('FX - Whir Tinkle Hit.wav by JohanDeecke -- ', 'https://freesound.org/s/367768/', ' -- License: Attribution 3.0'),
    ackEntry('FX - Wheel mechanism by bolkmar -- ', 'https://freesound.org/s/459613/', ' -- License: Creative Commons 0'),
    ackEntry('Bubble Pop by Jayvardhan -- ', 'https://freesound.org/s/848515/', ' -- License: Attribution 4.0'),
    ackEntry('000101_0580S3 056-064 074-075.wav by Gerent -- ', 'https://freesound.org/s/669150/', ' -- License: Creative Commons 0'),
  );
  dialog.append(ackBody);

  ackBtn.addEventListener('click', () => {
    ackBody.hidden = !ackBody.hidden;
  });

  // --- openSettings function ----------------------------------------
  function openSettings() {
    soundCheckbox.checked = !!stateBox.current.settings.sound;
    telCheckbox.checked = globalThis.localStorage.getItem(TELEMETRY_OPTOUT_KEY) !== '1';
    const theme = stateBox.current.settings.theme || 'auto';
    themeAuto.radio.checked = theme === 'auto';
    themeLight.radio.checked = theme === 'light';
    themeDark.radio.checked = theme === 'dark';
    showConfirmStep(0);
    importError.textContent = '';
    ackBody.hidden = true;
    renderManual();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  // --- gear wiring ------------------------------------------------
  if (gear) {
    gear.addEventListener('click', openSettings);
  }

  return openSettings;
}
