// The dimensional projection: the face of the token-generation button.
//
// Ported from matrix-visuals/src/Visualizations.jsx (`DimensionalProjection`)
// per docs/design/dimensional-projection.md. That component is React; this
// codebase has no React, no bundler and no dependencies, so the physics were
// carried over and the plumbing rewritten. Three deliberate departures from
// the source, each one load-bearing:
//
//   1. GEOMETRY SCALES. The original hardcodes a 380x120 button and an orb of
//      radius 50. The guide's own note 3 says those numbers must be kept in
//      step with the CSS by hand. They are not: every length here is authored
//      against REF_H and multiplied by the live height, so the composition
//      survives a tray that is 320px wide on a phone and 520px on a desktop.
//   2. ONE PERSISTENT CANVAS. renderActions() rebuilds the tray with
//      replaceChildren() whenever its signature moves, which would destroy the
//      canvas — and with it the trails, the in-flight waves and the rAF loop —
//      several times a second. The node is owned by this module and re-parented
//      into each new button instead. See projectionNode().
//   3. THE LOOP IS NOT ALWAYS RUNNING. The source animates forever. This one
//      stands down when the tray is hidden, when the document is in the
//      background, and — completely — under prefers-reduced-motion, where it
//      paints a still frame on change instead.
//
// Nothing here reads or writes game state. Live values arrive through
// setProjectionInput(), taps through projectionTap(); the pure mapping from a
// game state to the four driving props is projectionProps(), which is where
// the meaning lives and what test/projection.test.js checks.

import { CONST } from '../engine/constants.js';
import { DIMENSIONAL_SETTINGS } from '../config/dimensional-settings.js';

// The height the composition was authored at. Every length below is in
// "reference pixels" and gets multiplied by (height / REF_H) at draw time.
export const REF_H = 120;

// Aesthetic configuration — section 3 of the integration guide.
//
// The defaults are the documented baseline and stay readable as such; the dev
// suite's tuner writes config/dimensional-settings.js, which is merged over
// them at the bottom of this block. Same arrangement engine/constants.js and
// arc2-constants.js use.
//
// PROJECTION is deliberately mutable rather than frozen: the tuner's live
// preview drives it in place between applies.
const DEFAULTS = {
  // Shape and container.
  bezelThickness: 0,        // the CSS border on .act.primary IS the bezel
  trailLength: 0.7,         // motion blur: higher holds the previous frame longer
  visualScale: 1.0,         // extra multiplier on top of the height scale

  // Orb and ring.
  orbRadius: 50,
  ringBaseDistance: 5,
  ringMaxDistance: 20,
  ringGlow: 30,
  duotoneRing: false,

  // Emitters and overflows.
  waveOpacity: 0.5,
  waveOverflowDistance: 0,  // .act has overflow:hidden, so bleed is not free
  minPushDistance: 15,
  waveSpeed: 7.0,
  // Free-expansion headroom at full context health, as a multiple of the
  // face's half-diagonal. The sandbox used a flat 350px against a 380x120
  // button; scaled by height alone that range mostly falls off-canvas on a
  // tray button, and the constriction — the whole point of the context meter —
  // becomes invisible. Measured against the face instead, so >1 always means
  // "runs clear off the corners" whatever the button's shape.
  waveReach: 1.15,
  tokenSize: 3,
  tokenFlowDistance: 20,

  // Sparkles and glints.
  circleSparkle: 0.5,
  ringSparkle: 0.5,
  circleSparkleSize: 1.5,
  ringSparkleSize: 1.5,
  sparkleDuration: 1.0,
  alwaysSparkle: false,

  // Colour overrides. Empty means "let the theme drive it", which is the
  // normal case: the tray repaints across five decay palettes, so a hex
  // pinned here wins everywhere and strands the button in one era. The
  // tuner's colour pickers land in these; clearing them hands control back.
  faceColor: '',
  waveColor: '',
  tokenColor: '',
};

// The documented baseline, before any tuning. Exported so a test can tell an
// applied override from a knob that exists — PROJECTION is built FROM the
// overrides, so checking a key against it would always pass.
export const PROJECTION_DEFAULTS = Object.freeze({ ...DEFAULTS });

export const PROJECTION = { ...DEFAULTS, ...DIMENSIONAL_SETTINGS };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// How far a tap's wave gets before it hits the wall — the context meter's
// entire readout, and the only piece of the draw loop worth extracting.
//
// The penalty is QUADRATIC in health, per the guide: residue is forgiving at
// first and then closes in fast, which is the shape of the mechanic it is
// reporting on. Two things it must do at the extremes:
//
//   at 100 — clear the corners of the face, so a clean buffer never looks
//            like a constrained one just because the button is wide;
//   at 0   — collapse onto the ring, so every tap visibly slams into a wall.
//
// The headroom is measured against the FACE (its half-diagonal), not against
// the reference composition. The sandbox used a flat 350px authored for a
// 380x120 button; on a tray button most of that range is off-canvas and the
// constriction never becomes visible at all.
export function waveBoundaryAt(contextHealth, ringRadius, w, h, s = 1) {
  const penalty = (1 - clamp(contextHealth, 0, 100) / 100) ** 2;
  const reach = (Math.hypot(w, h) / 2) * PROJECTION.waveReach;
  return ringRadius + PROJECTION.minPushDistance * s + (1 - penalty) * reach;
}

// --- the four driving props ------------------------------------------------
//
// Section 2 of the guide names them; what they mean in THIS game is decided
// here. Two rules held throughout:
//
//   - A meter the player has not been shown yet reads as healthy, not as
//     broken. Before the buffer exists there is no residue to suffocate the
//     waves with, and before the K/V cache exists a cold cache is not a fact
//     about the world. Both sit at 100 until their mechanic is revealed —
//     the same premature-vocabulary rule the tooltips follow, applied to
//     colour instead of words.
//   - autoRate is the loop's ACTUAL contribution, not its purchased rate. The
//     loop only self-prompts while a user is waiting, so an idle machine shows
//     no incoming tokens. Feedback on effect, not on intent (Law 5).
export function projectionProps(state) {
  const perSec = (state.loopLevel || 0) * CONST.LOOP_TOKENS_PER_TICK * (1000 / CONST.TICK_MS);
  return {
    autoRate: state.activeQuery ? perSec : 0,
    contextHealth: state.bufferUnlocked ? clamp(100 - state.stale, 0, 100) : 100,
    cacheHealth: state.kvUnlocked ? clamp(state.warmth, 0, 100) : 100,
  };
}

// --- module-owned canvas and physics state ---------------------------------

let node = null;
let ctx = null;
let raf = 0;
let reduced = false;
let W = 0;
let H = 0;
let dpr = 1;

let live = { autoRate: 0, contextHealth: 100, cacheHealth: 100 };
let taps = 0;
let lastTapCount = 0;

let particlesIn = [];
let sparkles = [];
let waves = [];
let orbWobble = 0;
let tapMultiplier = 0;
let ringRadius = 0;      // seeded from the geometry on the first sized frame
let ringThickness = 2;
let sparkleEnergy = 0;
let sized = false;

// Colours are theme-driven: the tray repaints itself across five decay
// palettes and a hardcoded slate face would strand the button in era 0. Read
// from CSS custom properties, but not every frame — getComputedStyle forces
// style resolution, so it is sampled about twice a second and on resize.
let theme = { face: '#141a22', wave: '#a855f7', token: '#38bdf8', radius: 16 };
let themeAge = 1e9;

function readTheme() {
  const cs = getComputedStyle(node);
  const pick = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  // A tuned colour wins; an empty one leaves the decay palette in charge.
  theme = {
    face: PROJECTION.faceColor || pick('--proj-face', '#141a22'),
    wave: PROJECTION.waveColor || pick('--proj-wave', '#a855f7'),
    token: PROJECTION.tokenColor || pick('--proj-token', '#38bdf8'),
    radius: parseFloat(pick('--proj-radius', '16')) || 0,
  };
  themeAge = 0;
}

// The face is filled at partial alpha every frame so the previous frame shows
// through — that composite IS the motion blur. It therefore has to be an rgba
// string, and the theme value may be any CSS colour, so it is resolved once
// through a scratch context rather than parsed by hand.
let faceRGB = '20, 26, 34';
let faceSrc = null;
function faceChannels(color) {
  if (color === faceSrc) return faceRGB;
  faceSrc = color;
  const probe = document.createElement('canvas').getContext('2d');
  probe.fillStyle = '#000';
  probe.fillStyle = color;
  const resolved = probe.fillStyle;           // normalised to #rrggbb or rgb()
  if (resolved.startsWith('#')) {
    const n = parseInt(resolved.slice(1), 16);
    faceRGB = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  } else {
    const nums = resolved.match(/[\d.]+/g);
    faceRGB = nums ? nums.slice(0, 3).join(', ') : '20, 26, 34';
  }
  return faceRGB;
}

// The face's size in CSS pixels, kept by the ResizeObserver rather than read
// per frame. getBoundingClientRect() forces a synchronous layout, and doing
// that inside every animation frame is a self-inflicted layout thrash for a
// number that changes when the tray is rebuilt and at no other time.
//
// The observer is the only writer; sizeDirty tells the next frame to resize
// the backing store. devicePixelRatio is checked per frame instead, because
// dragging a window to a different monitor changes it with no resize at all —
// and unlike a rect, reading it costs nothing.
let sizeDirty = true;

function applySize() {
  if (W <= 0 || H <= 0) return false;
  const nextDpr = Math.min(2, window.devicePixelRatio || 1);
  if (!sizeDirty && nextDpr === dpr) return true;
  const w = Math.round(W * nextDpr);
  const h = Math.round(H * nextDpr);
  if (node.width !== w || node.height !== h) {
    node.width = w;
    node.height = h;
    themeAge = 1e9;      // a resize is the cheapest excuse to re-read the theme
  }
  dpr = nextDpr;
  sizeDirty = false;
  return true;
}

// The ported physics are per-FRAME, not per-second, and they were authored at
// 60fps — `sparkleEnergy -= 1 / (60 * sparkleDuration)` says so in the source.
// Left uncapped on a 120Hz display every wave, every sparkle and every ring
// settle ran at double speed, and incoming tokens spawned twice as often as
// autoRate asked for. Capping the draw is the fix that keeps the tuned
// constants meaning what they say, and it halves the work on high-refresh
// screens as a side effect.
//
// Normalising by delta-time instead would be the other way, but it would
// re-time every constant in the file against numbers that were tuned by eye.
export const FRAME_MS = 1000 / 60;
let lastDrawAt = -1e9;

// Whether this animation frame is due to be drawn. Pulled out so the pacing
// rule is a thing a test can hold: the 1ms slack matters, because rAF fires a
// hair early against a 60Hz display often enough that a strict comparison
// drops every other frame and halves the rate again.
export function dueForFrame(now, lastAt) {
  return now - lastAt >= FRAME_MS - 1;
}

function draw(ts) {
  raf = 0;
  if (!node) return;
  // Idle, but NOT dead. Three ways to get here:
  //
  //   - the node is not in the document yet. projectionNode() creates it and
  //     schedules the loop; render.js prepends it into a button that is itself
  //     attached later. If this frame wins that race, the canvas is real and
  //     unparented for a tick;
  //   - offsetParent is null, so the tray is hidden — Arc 2, the crash, the
  //     teaser;
  //   - the tab is in the background.
  //
  // All three are temporary, so all three reschedule. Returning without one
  // killed the loop for the rest of the session and left a blank button; it
  // reproduced on roughly one cold load in three, because it is a race.
  if (!node.isConnected || node.offsetParent === null || document.hidden) {
    schedule();
    return;
  }
  // Hold to 60fps. Under reduced motion there is no loop to pace — paintOnce()
  // asked for this frame because something changed, so it always draws.
  const now = typeof ts === 'number' ? ts : performance.now();
  if (!reduced && !dueForFrame(now, lastDrawAt)) { schedule(); return; }
  lastDrawAt = now;

  if (!applySize()) { schedule(); return; }

  if (themeAge > 30) readTheme();
  themeAge += 1;

  const P = PROJECTION;
  const { autoRate, contextHealth, cacheHealth } = live;

  // Everything below is in CSS pixels; the transform carries the device ratio.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx = W / 2;
  const cy = H / 2;
  // Departure 1: the button IS the canvas, and the composition scales with it.
  const s = (H / REF_H) * P.visualScale;
  const radius = Math.min(theme.radius, H / 2);

  const clearAlpha = Math.max(0.05, 1 - P.trailLength);

  // Face, painted at trail alpha so the previous frame bleeds through. The
  // source cleared the surround separately with an evenodd fill; here the
  // canvas is exactly the button, so there is no surround to clear.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${faceChannels(theme.face)}, ${reduced ? 1 : clearAlpha})`;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, radius);
  ctx.fill();

  if (!sized) {
    ringRadius = (P.orbRadius + P.ringBaseDistance) * s;
    ringThickness = 2 * s;
    sized = true;
  }

  // Taps: each one kicks the ring outward, wobbles the orb, relights the
  // sparkle emitters and launches a hazy wave from the ring's midpoint.
  if (taps > lastTapCount) {
    const diff = taps - lastTapCount;
    tapMultiplier += 2 * diff;
    orbWobble = 10;
    sparkleEnergy = 1.0;
    if (!reduced) {
      for (let i = 0; i < diff; i += 1) {
        waves.push({ r: ringRadius + ringThickness / 2, life: 1.0, v: P.waveSpeed * s });
      }
    }
    lastTapCount = taps;
  }

  sparkleEnergy = P.alwaysSparkle ? 1.0
    : Math.max(0, sparkleEnergy - 1 / (60 * P.sparkleDuration));

  tapMultiplier *= 0.95;
  if (tapMultiplier < 0.01) tapMultiplier = 0;

  const pushDistance = tapMultiplier * 12;
  const actualPush = Math.min(pushDistance, P.ringMaxDistance - P.ringBaseDistance);
  const targetRadius = (P.orbRadius + P.ringBaseDistance + actualPush) * s;
  const targetThickness = (2 + tapMultiplier * 4) * s;
  ringRadius += (targetRadius - ringRadius) * 0.15;
  ringThickness += (targetThickness - ringThickness) * 0.15;

  // Incoming automated tokens materialise on an ellipse outside the face and
  // fly straight at the orb. They spend their first frames off-canvas, so they
  // arrive from beyond the bezel rather than popping into existence on it.
  if (!reduced && Math.random() < autoRate * 0.1) {
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle) * (W / 2 + P.tokenFlowDistance * s);
    const dy = Math.sin(angle) * (H / 2 + P.tokenFlowDistance * s);
    const dist = Math.hypot(dx, dy) || 1;
    particlesIn.push({ x: cx + dx, y: cy + dy, vx: -dx / dist, vy: -dy / dist });
  }

  // Wobble is the TAP's kick and nothing else. The sandbox also scaled it by
  // cache health, so a cold cache jittered the orb permanently — the hue
  // already says that, and saying it twice cost a surface that was never still
  // and a press whose own response had to compete with the ambient shake.
  const wobbleAmount = orbWobble * s;
  const wx = reduced ? 0 : (Math.random() - 0.5) * wobbleAmount;
  const wy = reduced ? 0 : (Math.random() - 0.5) * wobbleAmount;
  if (orbWobble > 0) orbWobble *= 0.9;

  // Hue is the cache meter: green when warm, red when cold.
  const hue = (cacheHealth / 100) * 120;
  const baseColor = `hsl(${hue}, 80%, 60%)`;
  let ringColor = baseColor;
  let ringGlowColor = `hsl(${hue}, 100%, 75%)`;
  if (P.duotoneRing) {
    const ringHue = (hue + 35) % 360;
    ringColor = `hsl(${ringHue}, 70%, 45%)`;
    ringGlowColor = `hsl(${ringHue}, 90%, 60%)`;
  }

  if (!reduced && sparkleEnergy > 0) {
    if (P.circleSparkle > 0) spawnSparkles(P.circleSparkle * sparkleEnergy, 'circle', s);
    if (P.ringSparkle > 0) spawnSparkles(P.ringSparkle * sparkleEnergy, 'ring', s);
  }

  // --- 1. hazy waves ---
  // Context health is mapped QUADRATICALLY, per the guide: residue is
  // forgiving at first and then closes in fast. At full health the waves have
  // room to run off the face; as the buffer fills, the boundary walks in until
  // every tap slams into a wall a few pixels past the ring.
  if (waves.length) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      -P.waveOverflowDistance * s, -P.waveOverflowDistance * s,
      W + P.waveOverflowDistance * s * 2, H + P.waveOverflowDistance * s * 2,
      radius,
    );
    ctx.clip();
    const waveBoundary = waveBoundaryAt(contextHealth, ringRadius, W, H, s);
    for (const w of waves) {
      if (w.r > waveBoundary) {
        w.v *= 0.75;
        w.life -= 0.04;
      } else {
        w.life -= 0.012;
      }
      w.r += w.v;
      if (w.life > 0) {
        ctx.strokeStyle = theme.wave;
        ctx.globalAlpha = P.waveOpacity * w.life;
        ctx.lineWidth = (10 + (1 - w.life) * 40) * s;
        ctx.shadowBlur = 30 * s;
        ctx.shadowColor = theme.wave;
        ctx.beginPath();
        ctx.arc(cx + wx, cy + wy, w.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    waves = waves.filter((w) => w.life > 0);
    ctx.restore();
  }

  // --- 2. ring, orb and glints, clipped to the face ---
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, radius);
  ctx.clip();

  ctx.strokeStyle = ringColor;
  ctx.lineWidth = ringThickness;
  ctx.shadowBlur = (P.ringGlow + tapMultiplier * 1.5) * s;
  ctx.shadowColor = ringGlowColor;
  ctx.beginPath();
  ctx.arc(cx + wx, cy + wy, ringRadius + ringThickness / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = baseColor;
  ctx.shadowBlur = 40 * s;
  ctx.shadowColor = baseColor;
  ctx.beginPath();
  ctx.arc(cx + wx, cy + wy, P.orbRadius * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  for (const sp of sparkles) {
    let px;
    let py;
    let baseSize;
    if (sp.type === 'circle') {
      px = cx + wx + Math.cos(sp.angle) * sp.rOffset;
      py = cy + wy + Math.sin(sp.angle) * sp.rOffset;
      baseSize = P.circleSparkleSize * s;
    } else {
      const r = ringRadius + ringThickness / 2 + sp.normR * ringThickness + sp.rOffset;
      px = cx + wx + Math.cos(sp.angle) * r;
      py = cy + wy + Math.sin(sp.angle) * r;
      baseSize = P.ringSparkleSize * s;
    }
    sp.angle += sp.vx;
    sp.rOffset += sp.vy;
    sp.life += sp.speed;
    const pulse = Math.sin(sp.life * Math.PI);
    if (pulse > 0) {
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = (5 + pulse * 10) * s;
      const size = baseSize * pulse * (0.75 + Math.random() * 0.5);
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px, py, size * 4, size / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px, py, size / 3, size * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  sparkles = sparkles.filter((sp) => sp.life < 1.0);

  // --- 3. incoming tokens, inside the same clip ---
  if (particlesIn.length) {
    ctx.fillStyle = theme.token;
    ctx.shadowBlur = 10 * s;
    ctx.shadowColor = theme.token;
    const speed = (2 + autoRate * 2) * s;
    for (const p of particlesIn) {
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      ctx.beginPath();
      ctx.arc(p.x, p.y, P.tokenSize * s, 0, Math.PI * 2);
      ctx.fill();
      if (Math.hypot(p.x - cx, p.y - cy) < P.orbRadius * s) p.dead = true;
    }
    ctx.shadowBlur = 0;
    particlesIn = particlesIn.filter((p) => !p.dead);
  }
  ctx.restore();

  if (P.bezelThickness > 0) {
    ctx.strokeStyle = theme.wave;
    ctx.lineWidth = P.bezelThickness;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, radius);
    ctx.stroke();
  }

  if (!reduced) schedule();
}

function spawnSparkles(amount, type, s) {
  const n = Math.floor(amount * 3);
  for (let i = 0; i < n; i += 1) {
    if (Math.random() >= 0.6) continue;
    sparkles.push({
      type,
      life: 0,
      angle: Math.random() * Math.PI * 2,
      // Ring glints sit across the stroke's thickness; face glints are spread
      // over the orb's AREA — the sqrt is what stops them clumping at centre.
      normR: type === 'ring' ? Math.random() - 0.5 : 0,
      rOffset: type === 'circle' ? Math.sqrt(Math.random()) * (PROJECTION.orbRadius - 2) * s : 0,
      speed: 0.01 + Math.random() * 0.02,
      vx: (Math.random() - 0.5) * 0.01,
      vy: (Math.random() - 0.5) * 0.3 * s,
    });
  }
}

function schedule() {
  if (raf || !node) return;
  raf = requestAnimationFrame(draw);
}

// Under prefers-reduced-motion nothing loops. A frame is painted when
// something actually changed — a tap, a meter moving, the tray resizing — and
// the surface is otherwise completely still.
function paintOnce() {
  if (raf || !node) return;
  raf = requestAnimationFrame(draw);
}

// --- public surface --------------------------------------------------------

// True when this browser can draw the projection at all. roundRect is the only
// modern primitive it needs and the only one worth feature-testing; without it
// the caller keeps the plain button, which still says everything it needs to.
export function projectionSupported() {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('canvas').getContext('2d');
  return !!probe && typeof probe.roundRect === 'function';
}

// The canvas, created once and re-parented on every tray rebuild. Departure 2:
// returning a fresh element here would reset the physics several times a
// second, because renderActions() replaces the whole tray whenever its
// signature moves.
export function projectionNode() {
  if (node) {
    // Every tray rebuild passes through here, so this doubles as the loop's
    // heartbeat: schedule() is a no-op while a frame is already pending, and
    // restarts it if anything ever did stop it.
    if (reduced) paintOnce(); else schedule();
    return node;
  }
  node = document.createElement('canvas');
  node.className = 'proj';
  node.dataset.testid = 'projection';
  // Decoration over a button that already carries its own label and tooltip.
  node.setAttribute('aria-hidden', 'true');
  ctx = node.getContext('2d');
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced = mq.matches;
  mq.addEventListener('change', (e) => {
    reduced = e.matches;
    if (reduced) paintOnce(); else schedule();
  });
  // A tray rebuild changes the button's width without a window resize, so the
  // element is observed rather than the viewport. This is also the ONLY reader
  // of the face's size: the draw loop used to call getBoundingClientRect()
  // every frame, forcing a layout 120 times a second for a number that changes
  // when the tray rebuilds and never otherwise.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver((entries) => {
      const box = entries[entries.length - 1].contentRect;
      if (box.width === W && box.height === H) return;
      W = box.width;
      H = box.height;
      sizeDirty = true;
      if (reduced) paintOnce();
    }).observe(node);
  } else {
    // No observer: fall back to measuring, but only on a window resize rather
    // than per frame. A tray rebuild does not change the button's width.
    const measure = () => {
      const r = node.getBoundingClientRect();
      W = r.width; H = r.height; sizeDirty = true;
      if (reduced) paintOnce();
    };
    window.addEventListener('resize', measure);
    queueMicrotask(measure);
  }
  if (reduced) paintOnce(); else schedule();
  return node;
}

// One press of the token button. Counted rather than acted on directly, so a
// burst that lands between two frames still emits one wave per press.
export function projectionTap(n = 1) {
  taps += n;
  if (reduced) paintOnce();
}

export function setProjectionInput(state) {
  const next = projectionProps(state);
  if (reduced
    && (next.autoRate !== live.autoRate
      || next.contextHealth !== live.contextHealth
      || next.cacheHealth !== live.cacheHealth)) {
    live = next;
    paintOnce();
    return;
  }
  live = next;
}

// Stop the loop and forget the canvas. The game never calls this — its node is
// always re-parented into the next tray — but the dev suite detaches the
// preview for good when you switch tabs, and the idle branch in draw() would
// otherwise reschedule forever against a node nobody will ever re-attach.
// projectionNode() builds a fresh one on the next call.
export function stopProjection() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  node = null;
  ctx = null;
  sized = false;
  // The next node measures itself from scratch; carrying a dead one's size
  // over would draw one frame at the wrong scale.
  W = 0;
  H = 0;
  sizeDirty = true;
  lastDrawAt = -1e9;
}

// Used by the reset paths (a new run, an import, a debug load): the physics
// carry no game state, but leaving a screenful of waves mid-flight across a
// reset reads as the old run bleeding into the new one.
export function resetProjection() {
  particlesIn = [];
  sparkles = [];
  waves = [];
  orbWobble = 0;
  tapMultiplier = 0;
  sparkleEnergy = 0;
  sized = false;
  taps = 0;
  lastTapCount = 0;
  if (reduced) paintOnce();
}
