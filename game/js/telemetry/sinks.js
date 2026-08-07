// Export sinks. The sink interface is: sink.export(bundle) -> Promise,
// where bundle = { header, events, audio: [{recIdx, blob, ext}] }.
// FileExportSink is v1; the S3 submission sink (plan 3) implements the
// same interface.

import { SUBMIT_ENV } from './submit-env.js';

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
    const files = [new File([bundleToJsonl(bundle)], names.events, { type: 'text/plain' })];
    bundle.audio.forEach((a, i) => {
      files.push(new File([a.blob], names.audio[i], { type: a.blob.type }));
    });
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        // fall through to downloads on any other share failure
      }
    }
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
    async export(bundle) {
      if (!env.enabled || !env.brokerUrl) throw new Error('submissions disabled');
      const names = bundleFilenames(bundle);
      const files = [new File([bundleToJsonl(bundle)], names.events, { type: 'text/plain' })];
      bundle.audio.forEach((a, i) => {
        files.push(new File([a.blob], names.audio[i], { type: a.blob.type }));
      });
      for (const file of files) {
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
      }
      return 'submitted';
    },
  };
}

export const S3Sink = createS3Sink(SUBMIT_ENV);
