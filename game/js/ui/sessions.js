// game/js/ui/sessions.js
// "sessions" section of the dev drawer: list recent sessions with
// export (FileExportSink) and delete. Refreshes when the drawer unhides,
// mirroring debug.js's visibility-driven refresh.

import { buildBundle, FileExportSink, S3Sink } from '../telemetry/sinks.js';
import { SUBMIT_ENV } from '../telemetry/submit-env.js';

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
        submitBtn.textContent = 'submit';
        submitBtn.dataset.testid = `session-submit-${h.id}`;
        const errEl = document.createElement('span');
        errEl.className = 'session-error';
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true;
          errEl.textContent = '';
          try {
            await telemetry.flush();
            const bundle = await buildBundle(store, h.id);
            if (bundle) await S3Sink.export(bundle);
            submitBtn.textContent = 'submitted'; // stays disabled on success
          } catch (err) {
            errEl.textContent = String(err && err.message ? err.message : err);
            submitBtn.disabled = false; // session stays local; retry allowed
          }
        });
        rowEl.append(submitBtn, errEl);
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
