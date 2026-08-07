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
