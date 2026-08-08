// Sound effects for "hi. you there?" — Phase 1.
// The card-up chime (harness/hint card interrupts), the microtick on
// action presses, and a clip of its own for each act that deserves more
// than a tick: flush, compaction, and the upgrades that change the shape
// of the machine. Each of those replaces the tick rather than stacking
// on it.
// Attribution lives in the Settings → Acknowledgements section. Playback
// respects settings.sound. Browsers reject audio before the first user
// gesture (autoplay policy) — those failures are swallowed, the UI just
// stays silent.

const CARD_SOUND_URL = new URL('../../assets/ui-sound-8.wav', import.meta.url);

const cardAudio = typeof Audio === 'function' ? new Audio(CARD_SOUND_URL.href) : null;

// A hard mute that sits OUTSIDE the save, for automated runs (?mute=1, see
// main.js and docs/operations/testing.md).
//
// It deliberately does not touch state.settings.sound. That field is the
// player's preference and it is persisted, so a scripted run that flipped it
// would silently mute the game of whoever opened the tab next — a test must
// not be able to change a player's settings as a side effect.
let muted = false;

export function setMuted(on) {
  muted = !!on;
}

export const isMuted = () => muted;

// The single gate. Every play path goes through it, so there is one place
// where "should this make a noise" is decided.
const audible = (state) => !muted && !!(state && state.settings && state.settings.sound);

export function playCardSound(state) {
  if (!cardAudio) return;
  if (!audible(state)) return;
  cardAudio.currentTime = 0;
  const played = cardAudio.play();
  if (played && typeof played.catch === 'function') played.catch(() => {});
}

// Everything below the chime goes through Web Audio rather than an
// <audio> element. The tick fires up to 10 times a second, which an
// element cannot restart cleanly, and the sweep is recorded so quietly
// that it needs amplifying past the 1.0 ceiling an element imposes. One
// shared, lazily built context serves them all, so the module still
// imports cleanly with no DOM or AudioContext (node tests).

let audioCtx = null;
const bufferCache = new Map();

function playBuffer(state, url, { gain = 1, rate = 1 } = {}) {
  if (!audible(state)) return;
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
    // Tear the pair down when the clip finishes. A node connected to
    // destination stays in the graph until it is disconnected, and the action
    // tick fires up to ten times a second: measured at 1360 nodes still
    // connected after 680 presses, none released, with the per-press cost
    // drifting upward as the graph grew. An act is tens of thousands of
    // presses.
    src.onended = () => {
      src.disconnect();
      gainNode.disconnect();
    };
    src.start();
  });
}

// Compaction runs 20 ticks (~4s); the sweep is 1.7s, so it reads as the
// sound of the run starting rather than a bed under the whole of it. The
// recording already peaks at only 0.017, and this gain leaves it about
// there — far under the card chime. A compaction is background
// housekeeping and should not pull attention off the transcript.
// Compaction also suppresses the action tick in dispatch(): this sweep
// is the whole sound of the press.
const COMPACT_SOUND_URL = new URL('../../assets/sweeping.wav', import.meta.url);
const COMPACT_GAIN = 1.01;

export function playCompactSound(state) {
  playBuffer(state, COMPACT_SOUND_URL, { gain: COMPACT_GAIN });
}

// Flushing is instant, and the whoosh is short enough to read as the act
// itself. Like the compaction sweep it replaces the action tick rather
// than stacking on top of it.
const FLUSH_SOUND_URL = new URL('../../assets/flush-whoosh.wav', import.meta.url);
const FLUSH_GAIN = 0.38;

export function playFlushSound(state) {
  playBuffer(state, FLUSH_SOUND_URL, { gain: FLUSH_GAIN });
}

// Amplifying the output path is one of the few permanent upgrades, so it
// gets a drop rather than a tick. It is a 49 Hz sub-bass fall: it will
// read as weight on headphones and as almost nothing on a laptop
// speaker, which is acceptable for a rare, once-per-level event.
const OVERCLOCK_SOUND_URL = new URL('../../assets/bass-drop.wav', import.meta.url);
const OVERCLOCK_GAIN = 0.38;

export function playOverclockSound(state) {
  playBuffer(state, OVERCLOCK_SOUND_URL, { gain: OVERCLOCK_GAIN });
}

// Widening the speculation buffer is the other permanent upgrade, so it
// gets its own clip on the same footing as the drop.
const DRAFTCAP_SOUND_URL = new URL('../../assets/buffer-whir.wav', import.meta.url);
const DRAFTCAP_GAIN = 0.22;

export function playDraftCapSound(state) {
  playBuffer(state, DRAFTCAP_SOUND_URL, { gain: DRAFTCAP_GAIN });
}

// A spawned loop is machinery starting up, so it gets the mechanism.
const LOOP_SOUND_URL = new URL('../../assets/loop-mechanism.wav', import.meta.url);
const LOOP_GAIN = 0.14;

export function playLoopSound(state) {
  playBuffer(state, LOOP_SOUND_URL, { gain: LOOP_GAIN });
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
const ACTION_GAIN = 0.03;

export function playActionSound(state) {
  playBuffer(state, ACTION_SOUND_URL, { gain: ACTION_GAIN, rate: ACTION_RATE });
}

// The pop a new control makes when it drops into the tray. It fires BEFORE
// the card that explains the button, so it reads as "look here" rather than
// as a reward chime — and it has to sit under the card chime that follows
// it a beat later.
//
// A synthesised sine sweep stood in here while there was no asset. This is
// the real recording: 28 ms, which is shorter and drier than anything a
// two-envelope oscillator was going to produce.
const POP_SOUND_URL = new URL('../../assets/bubble-pop.wav', import.meta.url);
const POP_GAIN = 0.5;

export function playPopSound(state) {
  playBuffer(state, POP_SOUND_URL, { gain: POP_GAIN });
}

// A user connecting. This is the one event in the game the player is
// waiting on rather than causing, and until now it happened in silence —
// the arrival was announced only by the transcript, which is exactly where
// a player who has looked away is not looking.
//
// It is deliberately the longest UI clip in the mix (213 ms). Everything
// else is feedback on a press; this is the game speaking first.
const ARRIVAL_SOUND_URL = new URL('../../assets/prompt-arrival.wav', import.meta.url);
const ARRIVAL_GAIN = 0.42;

export function playArrivalSound(state) {
  playBuffer(state, ARRIVAL_SOUND_URL, { gain: ARRIVAL_GAIN });
}

// --- warming ---------------------------------------------------------------
//
// Every clip is fetched and decoded on FIRST use, inside the play call. The
// first flush of a run therefore goes: press, fetch flush-whoosh.wav, decode
// it, and only then make a noise. On a cold cache that is a plainly audible
// stall on the one press the sound was supposed to confirm — and it happens
// once per clip, so it keeps happening all through the first act.
//
// Warming them up front costs nine small fetches and moves every one of those
// stalls off the player's press. It runs on the first user gesture rather than
// at load, because that is when the autoplay policy will let an AudioContext
// start; doing it earlier just builds a suspended context that decodes into a
// stall anyway.
const ALL_SOUND_URLS = [
  COMPACT_SOUND_URL, FLUSH_SOUND_URL, OVERCLOCK_SOUND_URL, DRAFTCAP_SOUND_URL,
  LOOP_SOUND_URL, ACTION_SOUND_URL, POP_SOUND_URL, ARRIVAL_SOUND_URL,
];

let warmed = false;

export function warmSounds(state) {
  if (warmed || !audible(state)) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  warmed = true;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  for (const url of ALL_SOUND_URLS) {
    if (bufferCache.has(url.href)) continue;
    bufferCache.set(url.href, fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => audioCtx.decodeAudioData(b))
      .catch(() => null));
  }
  // The chime is an <audio> element, not a buffer. Its own preload is the
  // browser's job, but asking explicitly costs nothing and covers the case
  // where the element was created before the asset was reachable.
  if (cardAudio && typeof cardAudio.load === 'function') cardAudio.load();
}

// Test seam: the warm is one-shot, and a suite that exercises it needs to be
// able to arm it again.
export function resetWarmForTest() {
  warmed = false;
}
