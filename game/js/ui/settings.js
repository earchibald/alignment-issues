// Settings sheet for "hi. you there?" — Phase 1, Task 13.
// installSettings({stateBox, refs, paintNow, onReset}) builds the contents
// of dialog#settings (strict createElement, no innerHTML) and wires #gear
// to open it. Escape open/close is already wired in keys.js — untouched.

import { exportSave, importSave, saveLocal, SAVE_KEY } from '../engine/save.js';
import { createState } from '../engine/state.js';
import { resetRenderTrackers } from './render.js';
import { HINTS, HARNESS_CARDS } from '../engine/content.js';
import { harnessCard } from './components.js';

function row(...children) {
  const el = document.createElement('div');
  el.className = 'settings-row';
  el.append(...children);
  return el;
}

export function installSettings({ stateBox, refs, paintNow, onReset, resetCardTracking }) {
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

  const confirmRow = document.createElement('div');
  confirmRow.className = 'settings-row';
  confirmRow.hidden = true;

  const confirmText = document.createElement('p');
  confirmText.className = 'warn';
  confirmText.textContent = 'This erases everything. Type RESET to confirm.';
  confirmRow.append(confirmText);

  const confirmInput = document.createElement('input');
  confirmInput.type = 'text';
  confirmInput.dataset.testid = 'settings-reset-confirm-input';
  confirmRow.append(confirmInput);

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.dataset.testid = 'settings-reset-confirm';
  confirmBtn.textContent = 'Destroy save';
  confirmBtn.disabled = true;
  confirmRow.append(confirmBtn);

  confirmInput.addEventListener('input', () => {
    confirmBtn.disabled = confirmInput.value !== 'RESET';
  });

  resetBtn.addEventListener('click', () => {
    confirmRow.hidden = false;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmInput.focus();
  });

  confirmBtn.addEventListener('click', () => {
    if (confirmInput.value !== 'RESET') return;
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem(SAVE_KEY);
    }
    stateBox.current = createState(Date.now() >>> 0);
    confirmRow.hidden = true;
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
    if (state.hintsSeen.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'manual-hint manual-empty';
      empty.textContent = 'Nothing attached yet.';
      manualBody.append(empty);
    } else {
      for (const id of state.hintsSeen) {
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

  // --- openSettings function ----------------------------------------
  function openSettings() {
    soundCheckbox.checked = !!stateBox.current.settings.sound;
    const theme = stateBox.current.settings.theme || 'auto';
    themeAuto.radio.checked = theme === 'auto';
    themeLight.radio.checked = theme === 'light';
    themeDark.radio.checked = theme === 'dark';
    confirmRow.hidden = true;
    confirmInput.value = '';
    importError.textContent = '';
    renderManual();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  // --- gear wiring ------------------------------------------------
  if (gear) {
    gear.addEventListener('click', openSettings);
  }

  return openSettings;
}
