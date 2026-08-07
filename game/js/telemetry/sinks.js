// Export sinks. The sink interface is: sink.export(bundle) -> Promise,
// where bundle = { header, events, audio: [{recIdx, blob, ext}] }.
// FileExportSink is v1; the S3 submission sink (plan 3) implements the
// same interface.

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
    // Desktop: a real save dialog where the browser has one (Chrome/Edge).
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
