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

// The height the composition was authored at. Every length below is in
// "reference pixels" and gets multiplied by (height / REF_H) at draw time.
export const REF_H = 120;

// Aesthetic configuration — section 3 of the integration guide. Exported as a
// single mutable object so the dev suite can drive it live without this module
// growing a props system.
export const PROJECTION = {
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
  waveReach: 350,           // free-expansion headroom at full context health
  tokenSize: 3,
  tokenFlowDistance: 20,

  // Sparkles and glints.
  circleSparkle: 0.5,
  ringSparkle: 0.5,
  circleSparkleSize: 1.5,
  ringSparkleSize: 1.5,
  sparkleDuration: 1.0,
  alwaysSparkle: false,
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

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
  theme = {
    face: pick('--proj-face', '#141a22'),
    wave: pick('--proj-wave', '#a855f7'),
    token: pick('--proj-token', '#38bdf8'),
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

function resize() {
  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const nextDpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(rect.width * nextDpr);
  const h = Math.round(rect.height * nextDpr);
  if (node.width !== w || node.height !== h) {
    node.width = w;
    node.height = h;
    themeAge = 1e9;      // a resize is the cheapest excuse to re-read the theme
  }
  W = rect.width;
  H = rect.height;
  dpr = nextDpr;
  return true;
}

function draw() {
  raf = 0;
  if (!node || !node.isConnected) return;
  // offsetParent goes null when the tray is hidden — Arc 2, the crash screen,
  // the teaser. No point animating a surface nobody can see.
  if (node.offsetParent === null || document.hidden) {
    schedule();
    return;
  }
  if (!resize()) { schedule(); return; }

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

  const wobbleAmount = ((1 - cacheHealth / 100) * 10 + orbWobble) * s;
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
    const healthPenalty = (1 - contextHealth / 100) ** 2;
    const waveBoundary = ringRadius + (P.minPushDistance + (1 - healthPenalty) * P.waveReach) * s;
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
    if (reduced) paintOnce();
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
  // element is observed rather than the viewport.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => { if (reduced) paintOnce(); }).observe(node);
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
