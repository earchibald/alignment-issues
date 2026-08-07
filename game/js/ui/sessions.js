// game/js/ui/sessions.js
// "sessions" section of the dev drawer: list recent sessions with
// export (FileExportSink) and delete. Refreshes when the drawer unhides,
// mirroring debug.js's visibility-driven refresh.

import { buildBundle, FileExportSink, S3Sink } from '../telemetry/sinks.js';
import { SUBMIT_ENV } from '../telemetry/submit-env.js';

// Sessions submitted during this page's lifetime, id -> summary. A refresh
// rebuilds every row from scratch, so without this the "submitted ✓" state
// vanished the next time the drawer opened. Deliberately not persisted: it
// records what this page did, not what the bucket holds.
const submitted = new Map();

const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB`
  : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

export function installSessions({ store, telemetry, drawer = document.getElementById('devdrawer') }) {
  if (!drawer) return;

  const heading = document.createElement('h4');
  heading.textContent = 'sessions';
  drawer.appendChild(heading);

  const list = document.createElement('div');
  list.dataset.testid = 'dev-sessions';
  drawer.appendChild(list);

  async function refresh() {
    const headers = await store.listSessions();
    list.replaceChildren();
    if (headers.length === 0) {
      list.textContent = 'no sessions';
      return;
    }
    for (const h of headers) {
      const rowEl = document.createElement('div');
      rowEl.className = 'drow session-row';

      const live = telemetry.sessionId === h.id;
      const label = document.createElement('span');
      label.className = 'session-label';
      const mins = h.lastAt ? Math.max(1, Math.round((h.lastAt - h.anchor.at) / 60000)) : 0;
      label.textContent = [
        new Date(h.anchor.at).toLocaleString(),
        `${mins}m`,
        `${h.eventCount || 0}ev`,
        h.recCount ? '🎙' : '',
        live ? '(live)' : '',
      ].filter(Boolean).join(' · ');
      rowEl.append(label);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'dbtn';
      exportBtn.type = 'button';
      exportBtn.textContent = 'export';
      exportBtn.dataset.testid = `session-export-${h.id}`;
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        try {
          await telemetry.flush();
          const bundle = await buildBundle(store, h.id);
          if (bundle) await FileExportSink.export(bundle);
        } finally {
          exportBtn.disabled = false;
          refresh();
        }
      });
      rowEl.append(exportBtn);

      if (SUBMIT_ENV.enabled) {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'dbtn';
        submitBtn.type = 'button';
        submitBtn.dataset.testid = `session-submit-${h.id}`;
        // Outcome, not just an error. The old row said nothing at all while a
        // multi-megabyte recording uploaded, and nothing afterwards either
        // beyond the button's own label — reported as "clicking submit has no
        // apparent effect", on a submission that had in fact succeeded.
        const statusEl = document.createElement('span');
        statusEl.className = 'session-status';
        statusEl.dataset.testid = `session-status-${h.id}`;

        const alreadySent = submitted.has(h.id);
        submitBtn.textContent = alreadySent ? 'submitted ✓' : 'submit';
        submitBtn.disabled = alreadySent;
        if (alreadySent) {
          statusEl.className = 'session-status ok';
          statusEl.textContent = submitted.get(h.id);
        }

        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = 'submitting…';
          statusEl.className = 'session-status';
          statusEl.textContent = 'preparing…';
          try {
            await telemetry.flush();
            const bundle = await buildBundle(store, h.id);
            if (!bundle) throw new Error('nothing recorded for this session');
            await S3Sink.export(bundle, ({ done, total, name, bytes, phase }) => {
              statusEl.textContent = phase === 'start'
                ? `${done + 1}/${total} ${name} (${fmtSize(bytes)})…`
                : `${done}/${total} sent`;
            });
            const note = `${bundle.audio.length + 1} file${bundle.audio.length ? 's' : ''} sent`;
            submitted.set(h.id, note);
            submitBtn.textContent = 'submitted ✓';
            statusEl.className = 'session-status ok';
            statusEl.textContent = note;
          } catch (err) {
            // The session stays local and the upload is safe to retry.
            statusEl.className = 'session-status err';
            statusEl.textContent = `failed: ${String(err && err.message ? err.message : err)}`;
            submitBtn.textContent = 'retry submit';
            submitBtn.disabled = false;
          }
        });
        rowEl.append(submitBtn, statusEl);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'dbtn';
      delBtn.type = 'button';
      delBtn.textContent = 'delete';
      delBtn.dataset.testid = `session-delete-${h.id}`;
      delBtn.disabled = live; // never delete the session being written
      delBtn.addEventListener('click', async () => {
        await store.deleteSession(h.id);
        refresh();
      });
      rowEl.append(delBtn);

      list.append(rowEl);
    }
  }

  const observer = new MutationObserver(() => {
    if (!drawer.hidden) refresh();
  });
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  if (!drawer.hidden) refresh();
}
