// The Publish release flow.
//
// Apply writes into the working tree and `git checkout` undoes it. This does
// not: it commits, pushes, tags, and puts a build in front of players. So it
// asks once, plainly, with the exact version and the exact file list — and it
// refuses outright if anything other than a tool's own settings file has been
// modified. A release that quietly swept up someone's half-finished edit
// would be the worst possible bug for a button like this to have.
//
// The server owns every one of those checks; this file only shows them.

const POLL_MS = 1500;

let parts = null;

function buildDialog() {
  const dlg = document.createElement('dialog');
  dlg.className = 'confirm';
  const h = document.createElement('h2');
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
  row.append(cancel, ok);
  dlg.append(h, body, pre, note, row);
  document.body.appendChild(dlg);
  return { dlg, h, body, pre, note, cancel, ok };
}

function confirmRelease(state) {
  if (!parts) parts = buildDialog();
  const { dlg, h, body, pre, note, cancel, ok } = parts;

  h.textContent = `Publish v${state.nextVersion}?`;
  ok.textContent = `Publish v${state.nextVersion}`;
  body.textContent = 'This commits the files below, pushes to main, tags the release, deploys to GitHub '
    + 'Pages and verifies the live site. Unlike Apply, it does not stay on this machine.';
  // A release publishes main, so anything already committed and unreleased
  // rides along. Naming it here is the difference between a button you can
  // trust and one that surprises you.
  const also = state.alsoShipping || [];
  pre.textContent = [
    ...state.fromTools.map((f) => `commit  ${f}`),
    ...also.map((c) => `already on main  ${c}`),
  ].join('\n');
  note.textContent = `Current v${state.version}${state.lastTag ? ` (tag ${state.lastTag})` : ''}. `
    + (also.length ? `${also.length} unreleased commit${also.length === 1 ? '' : 's'} ship with it. ` : '')
    + 'The tests run as part of the release — if a tuning change breaks one, the release stops there '
    + 'and nothing is published.';

  return new Promise((resolve) => {
    const done = (v) => {
      cancel.removeEventListener('click', onCancel);
      ok.removeEventListener('click', onOk);
      dlg.removeEventListener('close', onClose);
      if (dlg.open) dlg.close();
      resolve(v);
    };
    const onCancel = () => done(false);
    const onOk = () => done(true);
    const onClose = () => done(false);
    cancel.addEventListener('click', onCancel);
    ok.addEventListener('click', onOk);
    dlg.addEventListener('close', onClose);
    dlg.showModal();
  });
}

export function initRelease(button, statusEl, logEl) {
  // Show what is live before anyone presses anything: the version and build
  // in the announcement mean more when you already know what they replaced.
  const liveEl = document.getElementById('live-build');
  if (liveEl) {
    fetch('/api/release/live')
      .then((r) => r.json())
      .then((v) => { liveEl.textContent = v.error ? '' : `live v${v.version} · ${v.build}`; })
      .catch(() => { liveEl.textContent = ''; });
  }

  const say = (text, kind) => {
    statusEl.textContent = text;
    statusEl.className = `apply-status ${kind || ''}`;
  };
  const showLog = (lines) => {
    if (!logEl) return;
    logEl.hidden = lines.length === 0;
    logEl.textContent = lines.slice(-14).join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    showLog([]);
    try {
      say('checking the working tree…');
      let state;
      try {
        state = await fetch('/api/release/preflight').then((r) => r.json());
      } catch {
        say('Cannot reach the devtools server. Start it with `just devtools`.', 'error');
        return;
      }
      if (state.blockers.length) {
        // Refusing is the normal outcome, not an exception — say why, in the
        // words the server used, and stop.
        say(state.blockers.join(' · '), 'warn');
        return;
      }

      if (!await confirmRelease(state)) {
        say('Cancelled. Nothing was committed.', '');
        return;
      }

      say(`publishing v${state.nextVersion}…`);
      const res = await fetch('/api/release', { method: 'POST' });
      const started = await res.json();
      if (!res.ok) {
        say(started.error || `Server refused the release (${res.status}).`, 'error');
        return;
      }

      // The deploy takes a minute or two: poll, and show the tail of the log
      // so a long wait reads as progress rather than as a hang.
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        let job;
        try {
          job = await fetch(`/api/release/job?id=${encodeURIComponent(started.id)}`).then((r) => r.json());
        } catch {
          say('Lost contact with the devtools server mid-release. Check `git log` and the Actions run.', 'error');
          return;
        }
        showLog(job.log || []);
        if (job.state === 'running') {
          say(`publishing v${state.nextVersion}… ${(job.log || []).length} steps`);
          continue;
        }
        if (job.state === 'done') {
          say(`Released v${job.version} — build ${job.build} is live.`, 'ok');
        } else {
          say(`ERROR ${job.error}`, 'error');
        }
        return;
      }
    } finally {
      button.disabled = false;
    }
  });
}
