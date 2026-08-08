// The answer resolving out of noise while it is being generated.
//
// An answer used to appear whole, the instant resolveQuery ran: the player
// tapped, a meter filled, and then a finished paragraph existed. The work was
// invisible. This makes it visible — the answer is on screen at full length
// from the moment the user connects, unresolved, and settles as tokens
// accumulate. By the time the query resolves it is readable and still, so the
// handoff to the real transcript entry changes only the header.
//
// Spec: docs/superpowers/specs/2026-08-07-answer-diffusion-design.md
//
// Three rules this file exists to keep:
//
//   1. It is VIEW-ONLY. No engine state, no save field, and never a call to
//      nextRand(state) — see rng.js. Progress is derived from state.tokens,
//      which is the same number the OUTPUT TOKENS meter already shows.
//   2. The node survives re-renders. Thinking lines and asides land while a
//      query is live; rebuilding on each would reset every cell to noise and
//      read as a glitch. It is moved, never recreated.
//   3. It settles BEFORE the query resolves, so the real entry replaces
//      identical text and nothing moves.

import { entryBlock } from '../components.js';
import { stampFor } from '../render-stamp.js';
import { effectiveCost, tokensPerTap, yieldMult } from '../../engine/actions.js';
import { CONST } from '../../engine/constants.js';
import { mulberry32 } from './rng.js';
import { classify, noiseGlyph, CLASS } from './charset.js';
import { SCHEDULERS } from './schedulers.js';
import { Diffuser } from './diffuser.js';
import { TextView } from './text-view.js';
import { DIFFUSION, SETTLE_AT, SETTLE_LOOKAHEAD_TICKS, MIN_SETTLE_P } from './params.js';

export const DIFFUSION_OFF_KEY = 'hyt.diffusion.off';

// Seed offset, so the field for a given query is stable across a reload but
// unrelated to any engine stream.
const SEED_SALT = 0x5eed1f;

let node = null;         // the ephemeral transcript entry, or null
let view = null;
let diffuser = null;
let queryId = null;      // the query the current node belongs to
let lastShimmer = 0;
let settled = false;

const reduceMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Read live, not once at load: the player may turn it off mid-run, and the
// reduced-motion query may change under them.
export function diffusionEnabled() {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(DIFFUSION_OFF_KEY) !== '1';
}

// Whitespace is structural unless block noise is on: scrambling it destroys
// the word and line layout the effect depends on, and the field stops reading
// as an answer.
const structural = (target, cls) => cls === CLASS.SPACE && !DIFFUSION.blockNoise;

function build(state, q, stamp) {
  const text = q.reply || '';
  const targets = [...text];
  const classes = targets.map(classify);

  const scheduler = SCHEDULERS.find((s) => s.id === DIFFUSION.scheduler) || SCHEDULERS[1];
  // The offsets draw from their own stream so that changing a downstream
  // parameter does not reshuffle the resolve order.
  const offsets = scheduler.offsets(text, mulberry32((state.seed ^ SEED_SALT) >>> 0), DIFFUSION);

  // Seeded from the run and the query index, so a reload during the same
  // query rebuilds the same field rather than a new one.
  const seed = (state.seed ^ SEED_SALT ^ Math.imul(state.resolvedCount + 1, 0x9e3779b9)) >>> 0;

  diffuser = new Diffuser({
    targets,
    classes,
    offsets,
    rngFactory: () => mulberry32(seed),
    noise: noiseGlyph,
    isStructural: structural,
    params: DIFFUSION,
  });

  // Built with entryBlock so the markup matches a resolved entry exactly —
  // the handoff must not change a single box.
  // Same who/side/timestamp shape a resolved sys entry gets, so the handoff
  // replaces like with like. The stamp is the tick the query arrived.
  node = entryBlock({ who: 'assistant', ts: stamp, text: '', side: 'sys' });
  node.classList.add('pending');
  const body = node.querySelector('.e-body');
  body.textContent = '';
  // A screen reader must never read churning noise. The answer is announced
  // once, by the real entry, when it lands.
  body.setAttribute('aria-hidden', 'true');

  view = new TextView(body, targets.length, targets);
  // Paint the initial noise once, here. The answer must be PRESENT at full
  // length from the moment the user connects — that is the whole premise,
  // the shape of the reply is already committed — even though it does not
  // start churning until the first token is generated. Without this the
  // cells are empty spans and the entry renders blank.
  view.render(diffuser.values, diffuser.locked, DIFFUSION, 0);
  queryId = q.id;
  settled = false;
  lastShimmer = 0;
}

// Why there is no layout-pinning machinery here.
//
// The obvious worry is that a churning cell changes width every redraw, so
// the paragraph crawls while it resolves and jumps when the real entry
// replaces it. It does not, because the reply is already monospace —
// `.entry.sys .e-body` sets it deliberately, "the reply is the machine
// speaking" — and every glyph the noise pool can produce is a monospace
// width in that face: the class pools are ASCII, and the optional glyph pool
// is chosen to be monospace-safe.
//
// An earlier version pinned each cell to its target's measured width and
// grouped words in inline-block wrappers. That held the width, and cost a
// line: inline-block children make taller line boxes than text does, so the
// field measured 25px a line against the finished paragraph's 19px. It
// traded a problem that does not exist for one that does.
//
// What WOULD break it: giving the pending answer a different font from the
// resolved entry, or a proportional one. Both are caught by the handoff
// check in test/diffusion.test.js and by measuring the two boxes in a
// browser — do that before changing either.

function teardown() {
  if (view) view.clearFlashes();
  if (node && node.parentNode) node.remove();
  node = null;
  view = null;
  diffuser = null;
  queryId = null;
  settled = false;
  rateAt = 0;
  rateTokens = 0;
  tokensPerSec = 0;
}

// Effective churn rate. In relative mode the rate follows the token stream so
// each token buys a fixed number of redraws; below the floor it decouples
// again, because a slow stream otherwise gives each cell so few redraws that
// the effect reads as steppy rather than liquid.
//
// The rate is MEASURED from the tokens actually arriving, not predicted from
// the loop level — taps are the bulk of the stream and nothing can predict
// those.
let rateTokens = 0;
let rateAt = 0;
let tokensPerSec = 0;

function observeRate(state, now) {
  if (rateAt === 0) { rateAt = now; rateTokens = state.tokens; return; }
  const dt = now - rateAt;
  if (dt < 500) return;
  const gained = Math.max(0, state.tokens - rateTokens);
  // Exponential smoothing: a raw half-second window jitters enough to make
  // the churn rate visibly pulse.
  tokensPerSec = tokensPerSec * 0.6 + (gained / (dt / 1000)) * 0.4;
  rateAt = now;
  rateTokens = state.tokens;
}

function shimmerHz() {
  if (DIFFUSION.shimmerMode !== 'relative') return DIFFUSION.shimmerHz;
  return Math.max(DIFFUSION.shimmerFloorHz, tokensPerSec * DIFFUSION.shimmerPerToken);
}

/**
 * Called once per render pass, after renderChat has appended anything new.
 *
 * @param {object} state  the live game state (read-only here)
 * @param {HTMLElement} chatEl  the transcript scroller
 * @param {number} now  performance.now(), passed in so the caller owns the clock
 * @returns {boolean} true on the render that created the node, so the caller
 *   can re-scroll — it is a full paragraph tall and lands after the
 *   transcript has already scrolled.
 */
export function updatePendingAnswer(state, chatEl, now) {
  const q = state.activeQuery;

  // The ceiling query has no reply and never resolves; it is the arc ending,
  // not an answer being written.
  const wanted = state.phase === 1 && q && q.id !== 'ceiling' && q.reply
    && diffusionEnabled();

  if (!wanted) {
    if (node) teardown();
    return false;
  }

  // Two queries back to back: never let one answer's cells leak into the next.
  if (node && queryId !== q.id) teardown();
  let created = false;
  if (!node) {
    build(state, q, stampFor(state.tick));
    created = true;
  }

  // Always at the tail. Entries arrive while a query is live — thinking
  // lines, asides, hints — and the pending answer belongs after all of them.
  if (node.parentNode !== chatEl || node.nextSibling) chatEl.append(node);

  const cost = effectiveCost(state, q);
  const p = cost > 0 ? Math.min(1, state.tokens / cost) : 1;

  // A fixed progress threshold is not enough on its own.
  //
  // SETTLE_AT leaves the last 8% of the meter as the answer sitting finished,
  // waiting to be sent. But `p` does not advance smoothly: two taps per tick
  // at amplification L2 with a warm cache is over 6 tokens, and on a cheap
  // query that is more than 8% of the whole cost. The run then steps straight
  // from 0.909 to resolved — measured — and the window is never observed at
  // all. The player would see noise replaced by finished text with no beat
  // between, which is the one thing this effect exists to avoid.
  //
  // So the real trigger is how much work is LEFT: settle once the remaining
  // tokens are inside what the next couple of ticks could possibly produce.
  const perTick = tokensPerTap(state) * yieldMult(state) * CONST.PROCESS_MAX_PER_TICK
    + state.loopLevel * CONST.LOOP_TOKENS_PER_TICK;
  // Capped, or the guarantee eats the effect: a fast stream on a cheap query
  // would otherwise settle the answer around halfway through.
  const headroom = Math.min(perTick * SETTLE_LOOKAHEAD_TICKS, cost * (SETTLE_AT - MIN_SETTLE_P));
  const nearlyDone = state.tokens >= cost - headroom;

  const effective = nearlyDone ? 1 : Math.min(1, p / SETTLE_AT);

  // Reduced motion: the answer still appears as it is generated, but it does
  // not churn. Re-checked every pass rather than read once at load.
  if (reduceMotion()) {
    if (!settled) {
      forceSettle();
      settled = true;
    }
    return created;
  }

  if (effective >= 1) {
    // Force-resolve once, then stop touching it. The text is now byte-
    // identical to q.reply and must stay perfectly still until it is sent.
    if (!settled) {
      forceSettle();
      settled = true;
    }
    view.paintFlashes(now, DIFFUSION);
    return created;
  }

  settled = false;

  // Nothing has been generated yet. The field is present at full length —
  // the answer's shape is already committed — but it does not churn: there
  // is no work happening to churn about. Shimmering before the first token
  // reads as the machine straining at an empty task, and it puts motion on
  // screen at exactly the moment the player is reading the user's message.
  //
  // The initial noise is drawn once in build(), so the field is present and
  // legible from the first frame — it simply does not move.
  if (state.tokens <= 0) {
    view.paintFlashes(now, DIFFUSION);
    return created;
  }

  observeRate(state, now);
  const interval = 1000 / Math.max(1, shimmerHz());
  if (now - lastShimmer >= interval) {
    lastShimmer = now;
    diffuser.tick(effective, DIFFUSION);
    view.render(diffuser.values, diffuser.locked, DIFFUSION, now);
  }
  // Flash decay runs every frame, so a short flash still fades smoothly at a
  // low shimmer rate.
  view.paintFlashes(now, DIFFUSION);
  return created;
}

function forceSettle() {
  for (let i = 0; i < diffuser.targets.length; i++) {
    diffuser.values[i] = diffuser.targets[i];
    diffuser.locked[i] = 1;
  }
  view.render(diffuser.values, diffuser.locked, DIFFUSION, 0);
}

// Test seam and state-swap hook: drop the node without waiting for a render.
export function resetPendingAnswer() {
  teardown();
}

// Exposed for the test that proves the handoff is silent.
export function pendingText() {
  return node ? node.querySelector('.e-body').textContent : null;
}
