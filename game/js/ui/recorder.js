// game/js/ui/recorder.js
// Dev-mode recording overlay: a semi-transparent pill, bottom-right.
// MediaRecorder chunks flush to the store every second; rec.* marks land
// in the telemetry stream and define the audio↔wall-time map (spec:
// correlation contract). Pure helpers are exported for node tests.

export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/mp4')) return { mime: 'audio/mp4', ext: 'm4a' };
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return { mime: 'audio/webm;codecs=opus', ext: 'webm' };
  }
  return null;
}

// Elapsed-audio accounting. Audio time advances only while recording;
// stop() returns the recording's total and resets for the next one.
export function createRecClock(pm) {
  let accumMs = 0;
  let activeSince = null;
  return {
    start() { activeSince = pm(); },
    pause() {
      if (activeSince !== null) {
        accumMs += pm() - activeSince;
        activeSince = null;
      }
    },
    stop() {
      this.pause();
      const total = accumMs;
      accumMs = 0;
      return total;
    },
    audioMs() {
      return accumMs + (activeSince !== null ? pm() - activeSince : 0);
    },
  };
}

export function mmss(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function installRecorder({ telemetry, store }) {
  const pill = document.createElement('div');
  pill.className = 'rec-pill';
  pill.dataset.state = 'idle';
  pill.dataset.testid = 'rec-pill';

  const dot = document.createElement('span');
  dot.className = 'rec-dot';

  const recordBtn = document.createElement('button');
  recordBtn.type = 'button';
  recordBtn.dataset.testid = 'rec-record';
  recordBtn.textContent = '● rec';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.dataset.testid = 'rec-pause';
  pauseBtn.textContent = '⏸';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.dataset.testid = 'rec-stop';
  stopBtn.textContent = '■';

  const timeEl = document.createElement('span');
  timeEl.className = 'rec-time';
  timeEl.textContent = '00:00';

  const savedEl = document.createElement('span');
  savedEl.className = 'rec-saved';
  savedEl.textContent = 'saved';

  pill.append(dot, recordBtn, pauseBtn, stopBtn, timeEl, savedEl);

  let recorder = null;
  let stream = null;
  let recIdx = 0;
  let chunkIdx = 0;
  let timer = null;
  let starting = false;
  const recClock = createRecClock(() => performance.now());

  function setState(name) {
    pill.dataset.state = name;
  }

  function updateTime() {
    timeEl.textContent = mmss(recClock.audioMs());
  }

  function startTimer() {
    if (!timer) timer = setInterval(updateTime, 250);
  }

  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function releaseStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    recorder = null;
  }

  function fail(message) {
    telemetry.event('rec.error', { recIdx, message });
    telemetry.flush();
    recClock.stop(); // discard any accumulated time so the next recording starts clean
    stopTimer();
    releaseStream();
    pill.title = message;
    setState('error');
  }

  async function startRecording() {
    if (starting) return;
    starting = true;
    const picked = pickMime();
    if (!picked) {
      fail('MediaRecorder unsupported');
      starting = false;
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      fail(`mic unavailable: ${err && err.name ? err.name : err}`);
      starting = false;
      return;
    }
    recIdx += 1;
    chunkIdx = 0;
    const thisRec = recIdx;
    try {
      recorder = new MediaRecorder(stream, { mimeType: picked.mime });
    } catch (err) {
      fail(`MediaRecorder failed: ${err && err.name ? err.name : err}`);
      starting = false;
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && telemetry.sessionId) {
        store.appendAudioChunk(telemetry.sessionId, thisRec, chunkIdx++, e.data)
          .catch(() => {
            // Storage full: stop audio flushing, keep events (spec).
            const r = recorder;
            if (r) {
              r.onstop = null;
              if (r.state !== 'inactive') r.stop();
            }
            fail('storage full — audio recording stopped');
          });
      }
    };
    recorder.onerror = (e) => {
      // The UA fires stop after error; suppress onstop so no spurious
      // rec.stop mark or "saved" state follows a rec.error.
      if (recorder) recorder.onstop = null;
      fail(`recorder error: ${e.error && e.error.name ? e.error.name : 'unknown'}`);
    };
    recorder.onstop = () => {
      const audioMs = recClock.stop();
      telemetry.event('rec.stop', { recIdx: thisRec, audioMs });
      telemetry.flush();
      releaseStream();
      stopTimer();
      timeEl.textContent = '00:00';
      pauseBtn.textContent = '⏸';
      setState('saved');
      setTimeout(() => {
        if (pill.dataset.state === 'saved') setState('idle');
      }, 1500);
    };
    // Spec: no un-concatenatable segments — hide pause where unsupported.
    pauseBtn.hidden = typeof recorder.pause !== 'function';
    recClock.start();
    recorder.start(1000);
    telemetry.event('rec.start', { recIdx: thisRec, audioMs: 0, mime: picked.mime });
    pill.title = '';
    pauseBtn.textContent = '⏸';
    setState('recording');
    updateTime();
    startTimer();
    starting = false;
  }

  function togglePause() {
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      recClock.pause();
      telemetry.event('rec.pause', { recIdx, audioMs: recClock.audioMs() });
      pauseBtn.textContent = '▶';
      setState('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      recClock.start();
      telemetry.event('rec.resume', { recIdx, audioMs: recClock.audioMs() });
      pauseBtn.textContent = '⏸';
      setState('recording');
    }
  }

  recordBtn.addEventListener('click', () => {
    const state = pill.dataset.state;
    if (state === 'idle' || state === 'error' || state === 'saved') startRecording();
  });
  pauseBtn.addEventListener('click', togglePause);
  stopBtn.addEventListener('click', () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  });

  document.body.append(pill);
  return pill;
}
