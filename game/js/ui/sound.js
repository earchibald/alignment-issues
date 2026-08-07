// Sound effects for "hi. you there?" — Phase 1.
// Two clips: the card-up chime (harness/hint card interrupts) and the
// microtick on action presses. Attribution lives in the Settings →
// Acknowledgements section. Playback respects settings.sound. Browsers
// reject audio before the first user gesture (autoplay policy) — those
// failures are swallowed, the UI just stays silent.

const CARD_SOUND_URL = new URL('../../assets/ui-sound-8.wav', import.meta.url);

const cardAudio = typeof Audio === 'function' ? new Audio(CARD_SOUND_URL.href) : null;

export function playCardSound(state) {
  if (!cardAudio) return;
  if (!state.settings.sound) return;
  cardAudio.currentTime = 0;
  const played = cardAudio.play();
  if (played && typeof played.catch === 'function') played.catch(() => {});
}

// Action presses fire up to 10/s, which an <audio> element cannot restart
// cleanly — decode the tick once into a Web Audio buffer and spawn a
// throwaway source per press. Everything is lazy so the module still
// imports cleanly without a DOM/AudioContext (node tests).
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

let actionCtx = null;
let actionBufPromise = null;

export function playActionSound(state) {
  if (!state.settings.sound) return;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  if (!actionCtx) actionCtx = new AC();
  if (actionCtx.state === 'suspended') actionCtx.resume().catch(() => {});
  if (!actionBufPromise) {
    actionBufPromise = fetch(ACTION_SOUND_URL)
      .then((r) => r.arrayBuffer())
      .then((b) => actionCtx.decodeAudioData(b))
      .catch(() => null);
  }
  actionBufPromise.then((buf) => {
    if (!buf) return;
    const src = actionCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ACTION_RATE;
    const gain = actionCtx.createGain();
    gain.gain.value = ACTION_GAIN;
    src.connect(gain);
    gain.connect(actionCtx.destination);
    src.start();
  });
}
