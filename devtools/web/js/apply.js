// The Apply flow: one confirmation, then POST to the local server, which is the
// only thing that touches the project tree.
//
// One confirm is deliberate. Everything the server writes is inside git, so the
// undo is `git diff` and `git checkout` — a second "are you really sure" would
// be ceremony over a reversible action.

const CONFIRM_TITLE = 'Apply settings to project?';

function buildDialog() {
  const dlg = document.createElement('dialog');
  dlg.className = 'confirm';

  const h = document.createElement('h2');
  h.textContent = CONFIRM_TITLE;

  const body = document.createElement('p');
  body.className = 'confirm-body';

  const pre = document.createElement('pre');
  pre.className = 'confirm-payload';

  const note = document.createElement('p');
  note.className = 'confirm-note';

  const row = document.createElement('div');
  row.className = 'confirm-row';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'danger';
  ok.textContent = 'Write it';
  row.append(cancel, ok);

  dlg.append(h, body, pre, note, row);
  document.body.appendChild(dlg);
  return { dlg, body, pre, note, cancel, ok };
}

let parts = null;

/**
 * Show the confirmation. Resolves true only on an explicit confirm — Escape,
 * the backdrop and Cancel all resolve false.
 */
function confirmApply({ toolLabel, target, settings, note }) {
  if (!parts) parts = buildDialog();
  const { dlg, body, pre, note: noteEl, cancel, ok } = parts;

  body.textContent = `This writes the ${toolLabel} settings into the project at ${target}. `
    + 'The change is a normal working-tree edit, so `git diff` shows it and `git checkout` undoes it.';
  pre.textContent = JSON.stringify(settings, null, 2);
  noteEl.textContent = note || '';

  return new Promise((resolve) => {
    const done = (value) => {
      cancel.removeEventListener('click', onCancel);
      ok.removeEventListener('click', onOk);
      dlg.removeEventListener('close', onClose);
      if (dlg.open) dlg.close();
      resolve(value);
    };
    const onCancel = () => done(false);
    const onOk = () => done(true);
    const onClose = () => done(false); // covers Escape

    cancel.addEventListener('click', onCancel);
    ok.addEventListener('click', onOk);
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

/**
 * Wire the Apply button. `getActive` returns the mounted tool module, or null.
 */
export function initApply(button, statusEl, getActive) {
  const say = (text, kind) => {
    statusEl.textContent = text;
    statusEl.className = `apply-status ${kind || ''}`;
  };

  button.addEventListener('click', async () => {
    const active = getActive();
    if (!active || typeof active.getSettings !== 'function') {
      say('This tool has no settings to apply.', 'warn');
      return;
    }

    const settings = active.getSettings();
    let target = 'the project';
    try {
      const info = await fetch(`/api/target/${encodeURIComponent(active.id)}`).then((r) => r.json());
      target = info.path || target;
    } catch {
      say('Cannot reach the devtools server. Start it with `just devtools`.', 'error');
      return;
    }

    const go = await confirmApply({
      toolLabel: active.label, target, settings, note: active.settingsNote,
    });
    if (!go) {
      say('Cancelled. Nothing was written.', '');
      return;
    }

    say('Writing…', '');
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tool: active.id, settings }),
      });
      const out = await res.json();
      if (!res.ok) {
        say(out.error || `Server refused the write (${res.status}).`, 'error');
        return;
      }
      say(`Wrote ${out.path} — ${out.changed ? 'changed' : 'no change, already identical'}.`, 'ok');
    } catch (err) {
      say(`Write failed: ${err.message}`, 'error');
    }
  });
}
