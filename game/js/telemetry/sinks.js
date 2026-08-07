// Export sinks. The sink interface is: sink.export(bundle) -> Promise,
// where bundle = { header, events, audio: [{recIdx, blob, ext}] }.
// FileExportSink is v1; the S3 submission sink (plan 3) implements the
// same interface.

import { SUBMIT_ENV } from './submit-env.js';
import { zipFiles } from './zip.js';

export async function buildBundle(store, sessionId) {
  const header = await store.getSession(sessionId);
  if (!header) return null;
  const events = await store.getEvents(sessionId);
  const audio = (await store.getAudioChunks(sessionId)).map(({ recIdx, chunks }) => {
    const type = chunks[0] ? chunks[0].type : 'application/octet-stream';
    return {
      recIdx,
      blob: new Blob(chunks, { type }),
      ext: type.includes('mp4') ? 'm4a' : 'webm',
    };
  });
  return { header, events, audio };
}

export function bundleToJsonl(bundle) {
  const lines = [JSON.stringify(bundle.header)];
  for (const ev of bundle.events) lines.push(JSON.stringify(ev));
  return lines.join('\n') + '\n';
}

export function bundleFilenames(bundle) {
  const id = bundle.header.id;
  return {
    events: `hyt-session-${id}.jsonl`,
    audio: bundle.audio.map((a) => `hyt-session-${id}-r${a.recIdx}.${a.ext}`),
  };
}

export const FileExportSink = {
  async export(bundle) {
    const names = bundleFilenames(bundle);
    const original = [new File([bundleToJsonl(bundle)], names.events, { type: 'text/plain' })];
    bundle.audio.forEach((a, i) => {
      original.push(new File([a.blob], names.audio[i], { type: a.blob.type }));
    });
    let files = original;
    // The share sheet is the right surface only on touch devices, where it
    // reaches Files/AirDrop and there is no downloads UX worth using. On a
    // desktop browser the user expects a file-save dialog, not a sheet.
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (coarse && navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        // fall through to file saves on any other share failure
      }
    }
    // Desktop: real save dialogs where the browser has them (Chrome/Edge).
    // A multi-file bundle must go through ONE dialog: a click's transient
    // activation does not survive a second sequential picker, which is how
    // an export could save the audio but silently lose the jsonl. Pick a
    // directory once and write every file into it.
    if (files.length > 1 && typeof globalThis.showDirectoryPicker === 'function') {
      try {
        const dir = await globalThis.showDirectoryPicker({ mode: 'readwrite' });
        for (const file of files) {
          const handle = await dir.getFileHandle(file.name, { create: true });
          const writable = await handle.createWritable();
          await writable.write(file);
          await writable.close();
        }
        return 'saved';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        // fall through to anchor downloads on any other failure
      }
    }
    // No directory picker (Safari, Firefox): everything left goes out
    // through one save dialog or one anchor click, and BOTH of those can
    // only deliver a single file. A second anchor download is gated by
    // the browser's "allow multiple downloads" permission, which the user
    // may never be shown and which, once denied for the origin, silently
    // drops every file — including the first. Spacing the clicks does not
    // help; the block is a permission decision, not a rate limit. So pack
    // the bundle into one archive and hand over exactly one file.
    if (files.length > 1) {
      files = [await zipFiles(original, `hyt-session-${bundle.header.id}.zip`)];
    }
    if (typeof globalThis.showSaveFilePicker === 'function') {
      try {
        for (const file of files) {
          const ext = '.' + file.name.split('.').pop();
          const handle = await globalThis.showSaveFilePicker({
            suggestedName: file.name,
            types: [{
              description: 'hyt session export',
              accept: { [file.type || 'application/octet-stream']: [ext] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(file);
          await writable.close();
        }
        return 'saved';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        // fall through to anchor downloads on any other failure
      }
    }
    // Last resort: a plain anchor download. Exactly one file reaches here
    // — anything larger was zipped above — so this never asks the browser
    // for the multiple-downloads permission. Revocation is deferred: doing
    // it immediately races the download and truncates the file.
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    return 'downloaded';
  },
};

// --- S3 submission sink ----------------------------------------------
// Same sink interface. The browser never holds AWS keys: per file it asks
// the broker for a one-shot presigned POST, then uploads. Inactive until
// the deploy workflow injects a real submit-env. No retry loop — a failed
// submit leaves the session local (spec: error handling).

function baseType(type) {
  return (type || '').split(';')[0].trim();
}

export function createS3Sink(env) {
  return {
    // onProgress({done, total, name, bytes, phase}) is optional and purely
    // for the UI: a submission is one small events file plus a recording
    // that routinely runs to several megabytes, so a silent multi-second
    // wait reads as a dead button.
    async export(bundle, onProgress) {
      if (!env.enabled || !env.brokerUrl) throw new Error('submissions disabled');
      const names = bundleFilenames(bundle);
      const files = [new File([bundleToJsonl(bundle)], names.events, { type: 'text/plain' })];
      bundle.audio.forEach((a, i) => {
        files.push(new File([a.blob], names.audio[i], { type: a.blob.type }));
      });
      const total = files.length;
      const totalBytes = files.reduce((n, f) => n + f.size, 0);
      let done = 0;
      const report = (phase, file) => {
        if (typeof onProgress !== 'function') return;
        onProgress({ done, total, totalBytes, name: file.name, bytes: file.size, phase });
      };
      for (const file of files) {
        report('start', file);
        const contentType = baseType(file.type);
        const grantRes = await fetch(env.brokerUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token: env.token,
            sessionId: bundle.header.id,
            filename: file.name,
            size: file.size,
            contentType,
          }),
        });
        if (!grantRes.ok) {
          let reason = `grant failed (${grantRes.status})`;
          try {
            const body = await grantRes.json();
            if (body && body.reason) reason = `grant refused: ${body.reason}`;
          } catch {
            // keep the status-based reason
          }
          throw new Error(reason);
        }
        const { url, fields } = await grantRes.json();
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value);
        form.append('file', file);
        const upload = await fetch(url, { method: 'POST', body: form });
        if (!upload.ok) throw new Error(`upload failed (${upload.status})`);
        done++;
        report('done', file);
      }
      return 'submitted';
    },
  };
}

export const S3Sink = createS3Sink(SUBMIT_ENV);
