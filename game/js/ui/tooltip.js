// Tooltips for the action tray.
//
// Every button in this game spends something — tokens, cycles, or the
// player's trust that the number on screen means what it says. Two of them
// ("Connect MCP tool", "Spawn agentic loop") were reported as flatly opaque:
// the label names a noun, the cost line names a price, and nothing anywhere
// says what you get. The harness log used to carry that explanation, but a
// log line scrolls away and a button does not.
//
// So the explanation moves onto the control itself, and stays there.
//
// Two input models, one surface:
//   - a pointer that hovers (mouse, trackpad) opens on hover, after a pause
//     long enough that sweeping across the tray does not strobe;
//   - a pointer that cannot hover (touch) opens on a long press.
//
// The long press MUST swallow the click that follows it. Holding "Spawn
// agentic loop" to read what it does, and having it spend the cycles, would
// be a worse bug than the opacity this file exists to fix.

const HOVER_OPEN_MS = 320;
// Long enough not to fire on a normal tap, short enough that a player who is
// deliberately holding does not conclude the gesture is unsupported.
const PRESS_OPEN_MS = 420;
// A press that travels is a scroll, not a question.
const PRESS_SLOP_PX = 10;
const EDGE_PAD = 8;

let tipEl = null;
let hostEl = null;
let openTimer = 0;
let pressOrigin = null;
// Set when a long press opened the tip: the click that ends that press is
// the gesture's tail, not a separate intent, and must not reach the button.
let swallowNextClick = false;

function ensureEl() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'tip';
  tipEl.id = 'tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  // Inside #app, not on the body. The whole palette is declared on #app and
  // is re-declared per data-decay, so a tip parented to the body renders
  // with every colour variable unresolved — which is exactly how it first
  // shipped: transparent, unreadable, and painted under the tray. Living
  // here also means the tooltip decays along with the rest of the chrome.
  //
  // It stays position:fixed, and #app has no transform, so it still escapes
  // the tray's overflow rather than being clipped by it.
  (document.getElementById('app') || document.body).append(tipEl);
  return tipEl;
}

function place(el, target) {
  const r = target.getBoundingClientRect();
  // Measure first: the width is content-driven and capped in CSS, so the
  // clamp below needs the real box, not the pre-layout one.
  el.style.left = '0px';
  el.style.top = '0px';
  const t = el.getBoundingClientRect();

  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(EDGE_PAD, Math.min(left, window.innerWidth - t.width - EDGE_PAD));

  // Prefer above the button — the tray sits at the bottom of the screen, and
  // on touch the finger is covering everything below the press point.
  let top = r.top - t.height - 6;
  let below = false;
  if (top < EDGE_PAD) {
    top = r.bottom + 6;
    below = true;
  }
  el.classList.toggle('below', below);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function hideTip() {
  clearTimeout(openTimer);
  openTimer = 0;
  pressOrigin = null;
  if (!tipEl || tipEl.hidden) return;
  tipEl.hidden = true;
  if (hostEl) hostEl.removeAttribute('aria-describedby');
  hostEl = null;
}

export function showTip(target) {
  const text = target && target.dataset && target.dataset.tip;
  if (!text) return;
  const el = ensureEl();
  el.textContent = text;
  el.hidden = false;
  hostEl = target;
  // Described-by rather than labelled-by: the label is the button's own text,
  // and a screen reader should read the name first and the detail second.
  target.setAttribute('aria-describedby', el.id);
  place(el, target);
}

const tipTarget = (e) => (e.target.closest ? e.target.closest('[data-tip]') : null);

// The action tray rebuilds itself whenever its signature changes, which on a
// live query is most ticks. A tip opened by a long press would be left
// anchored to a detached button — and, worse, showing the yield breakdown
// from a tick ago. Re-attach to the replacement instead of tearing it down.
export function retargetTip(container) {
  if (!hostEl || !tipEl || tipEl.hidden) return;
  if (hostEl.isConnected) return;
  const id = hostEl.dataset.testid;
  const next = id && container ? container.querySelector(`[data-testid="${id}"]`) : null;
  if (next && next.dataset.tip) showTip(next);
  else hideTip();
}

function openAfter(ms, target) {
  clearTimeout(openTimer);
  openTimer = setTimeout(() => showTip(target), ms);
}

export function installTooltips(root = document) {
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const target = tipTarget(e);
    if (!target || target === hostEl) return;
    hideTip();
    openAfter(HOVER_OPEN_MS, target);
  });

  root.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!tipTarget(e)) return;
    hideTip();
  });

  root.addEventListener('pointerdown', (e) => {
    // Any press dismisses an open tip, including the press that is about to
    // open a different one.
    const target = tipTarget(e);
    hideTip();
    // A long press that ends off the button produces no click, which would
    // leave the swallow armed and eat the player's NEXT tap. Disarm on every
    // fresh press: by then the press it belonged to is over either way.
    swallowNextClick = false;
    if (e.pointerType === 'mouse' || !target) return;
    pressOrigin = { x: e.clientX, y: e.clientY };
    openAfter(PRESS_OPEN_MS, target);
  });

  root.addEventListener('pointermove', (e) => {
    if (!pressOrigin || !openTimer) return;
    if (Math.abs(e.clientX - pressOrigin.x) < PRESS_SLOP_PX
      && Math.abs(e.clientY - pressOrigin.y) < PRESS_SLOP_PX) return;
    clearTimeout(openTimer);
    openTimer = 0;
    pressOrigin = null;
  }, { passive: true });

  const endPress = () => {
    clearTimeout(openTimer);
    openTimer = 0;
    pressOrigin = null;
    // The tip is open because the press was long. Leave it up to be read,
    // and eat the click this press is about to produce.
    if (tipEl && !tipEl.hidden) swallowNextClick = true;
  };
  root.addEventListener('pointerup', endPress);
  root.addEventListener('pointercancel', endPress);

  // Capture, so the button's own handler never runs.
  root.addEventListener('click', (e) => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Keyboard reaches the same text: tab to a button, read what it costs.
  root.addEventListener('focusin', (e) => {
    const target = tipTarget(e);
    if (target) showTip(target);
    else hideTip();
  });
  root.addEventListener('focusout', hideTip);
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });

  // The tray re-renders constantly and the page scrolls: a tip anchored to a
  // button that has moved (or been replaced) is worse than no tip.
  window.addEventListener('scroll', hideTip, { passive: true, capture: true });
  window.addEventListener('resize', hideTip, { passive: true });
  window.addEventListener('blur', hideTip);
}
