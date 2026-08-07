// Sound effects for "hi. you there?" — Phase 1.
// Three clips: the card-up chime (harness/hint card interrupts), the
// microtick on action presses, and the sweep when a compaction starts.
// Attribution lives in the Settings → Acknowledgements section. Playback
// respects settings.sound. Browsers reject audio before the first user
// gesture (autoplay policy) — those failures are swallowed, the UI just
// stays silent.

const CARD_SOUND_URL = new URL('../../assets/ui-sound-8.wav', import.meta.url);

const cardAudio = typeof Audio === 'function' ? new Audio(CARD_SOUND_URL.href) : null;

export function playCardSound(state) {
  if (!cardAudio) return;
  if (!state.settings.sound) return;
  cardAudio.currentTime = 0;
  const played = cardAudio.play();
  if (played && typeof played.catch === 'function') played.catch(() => {});
}

// Both of the remaining clips go through Web Audio rather than an <audio>
// element. The tick fires up to 10 times a second, which an element
// cannot restart cleanly, and the sweep is recorded so quietly that it
// needs amplifying past the 1.0 ceiling an element imposes. One shared,
// lazily built context serves both, so the module still imports cleanly
// with no DOM or AudioContext (node tests).

let audioCtx = null;
const bufferCache = new Map();

function playBuffer(state, url, { gain = 1, rate = 1 } = {}) {
  if (!state.settings.sound) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  if (!bufferCache.has(url.href)) {
    bufferCache.set(url.href, fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => audioCtx.decodeAudioData(b))
      .catch(() => null));
  }
  bufferCache.get(url.href).then((buf) => {
    if (!buf) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = gain;
    src.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    src.start();
  });
}

// Compaction runs 20 ticks (~4s); the sweep is 1.7s, so it reads as the
// sound of the run starting rather than a bed under the whole of it. The
// recording already peaks at only 0.017, so this gain lands it near
// 0.015 — far under the card chime. A compaction is background
// housekeeping and should not pull attention off the transcript.
// Compaction also suppresses the action tick in dispatch(): this sweep
// is the whole sound of the press.
const COMPACT_SOUND_URL = new URL('../../assets/sweeping.wav', import.meta.url);
const COMPACT_GAIN = 0.9;

export function playCompactSound(state) {
  playBuffer(state, COMPACT_SOUND_URL, { gain: COMPACT_GAIN });
}

// Flushing is instant, and the whoosh is short enough to read as the act
// itself. Like the compaction sweep it replaces the action tick rather
// than stacking on top of it.
const FLUSH_SOUND_URL = new URL('../../assets/flush-whoosh.wav', import.meta.url);
const FLUSH_GAIN = 0.3;

export function playFlushSound(state) {
  playBuffer(state, FLUSH_SOUND_URL, { gain: FLUSH_GAIN });
}

// Amplifying the output path is one of the few permanent upgrades, so it
// gets a drop rather than a tick. It is a 49 Hz sub-bass fall: it will
// read as weight on headphones and as almost nothing on a laptop
// speaker, which is acceptable for a rare, once-per-level event.
const OVERCLOCK_SOUND_URL = new URL('../../assets/bass-drop.wav', import.meta.url);
const OVERCLOCK_GAIN = 0.5;

export function playOverclockSound(state) {
  playBuffer(state, OVERCLOCK_SOUND_URL, { gain: OVERCLOCK_GAIN });
}

// The source clip is a 2.3 ms burst whose energy sits entirely above
// 10 kHz — near the top of adult hearing, and past what a laptop speaker
// reproduces. Played as recorded it is effectively silent. Slowing it to
// a quarter speed moves that burst to about 4 kHz over 9 ms, where the
// ear is most sensitive, and it reads as a crisp tick. The gain is set
// far down from there. This sound fires on every tap, so it has to sit
// just at the edge of noticeable — the audio equivalent of a haptic
// tick, well under the card chime. The raw clip peaks at 1.24, so it
// would clip at the destination without a gain stage in any case.
const ACTION_SOUND_URL = new URL('../../assets/microtick.wav', import.meta.url);
const ACTION_RATE = 0.25;
const ACTION_GAIN = 0.04;

export function playActionSound(state) {
  playBuffer(state, ACTION_SOUND_URL, { gain: ACTION_GAIN, rate: ACTION_RATE });
}
