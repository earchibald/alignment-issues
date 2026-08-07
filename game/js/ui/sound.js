// Sound effects for "hi. you there?" — Phase 1.
// One clip so far: the card-up chime, played when a harness/hint card
// interrupts. Attribution lives in the Settings → Acknowledgements section.
// Playback respects settings.sound. Browsers reject play() before the
// first user gesture (autoplay policy) — those rejections are swallowed,
// the card just appears silently.

const CARD_SOUND_URL = new URL('../../assets/ui-sound-8.wav', import.meta.url);

const cardAudio = typeof Audio === 'function' ? new Audio(CARD_SOUND_URL.href) : null;

export function playCardSound(state) {
  if (!cardAudio) return;
  if (!state.settings.sound) return;
  cardAudio.currentTime = 0;
  const played = cardAudio.play();
  if (played && typeof played.catch === 'function') played.catch(() => {});
}
