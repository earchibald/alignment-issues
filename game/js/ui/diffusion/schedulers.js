// Schedulers decide WHEN each cell resolves, not WHAT it resolves to.
//
// Each one returns a per-cell offset in [0,1). The diffuser turns that offset
// plus the `spread` parameter into a resolve window:
//
//   width = 1 - spread          (clamped to a minimum)
//   start = offset * spread
//   q     = clamp01((p - start) / width)
//
// So spread = 0 means every cell shares the global progress p, and larger
// spread means cells resolve over increasingly scattered windows.
//
// These are pure functions of (target, rng, params). No DOM, no state.

import { classify, CLASS } from './charset.js';

function uniformOffsets(target) {
  return new Float64Array(target.length); // all zero: every cell shares p
}

function stochasticOffsets(target, rng) {
  const out = new Float64Array(target.length);
  for (let i = 0; i < out.length; i++) out[i] = rng();
  return out;
}

// bias 0 -> pure stochastic; bias 1 -> strict left-to-right wipe.
// The interesting territory is the middle: a streaming cursor with the text
// still churning ahead of it.
function wavefrontOffsets(target, rng, params) {
  const n = target.length;
  const out = new Float64Array(n);
  const bias = params.bias;
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    out[i] = bias * (i / denom) + (1 - bias) * rng();
  }
  return out;
}

// Split into spans of non-whitespace (words / punctuation runs), keeping the
// whitespace attached to the preceding span.
function spansOf(target) {
  const spans = [];
  let start = 0;
  let inWord = false;
  for (let i = 0; i < target.length; i++) {
    const isSpace = classify(target[i]) === CLASS.SPACE;
    if (!isSpace && !inWord) {
      start = i;
      inWord = true;
    } else if (isSpace && inWord) {
      spans.push({ start, end: i, text: target.slice(start, i) });
      inWord = false;
    }
  }
  if (inWord) spans.push({ start, end: target.length, text: target.slice(start) });
  return spans;
}

// Coarse-to-fine, in the spirit of masked diffusion LMs: resolve whole spans in
// a confidence-like order rather than resolving characters independently.
// Confidence heuristic — short spans and pure punctuation first, plus jitter so
// the order is not deterministic.
function spanOffsets(target, rng, params) {
  const n = target.length;
  const out = new Float64Array(n);
  const spans = spansOf(target);
  if (spans.length === 0) return out;

  for (const span of spans) {
    const allPunct = [...span.text].every((c) => classify(c) === CLASS.PUNCT);
    const confidence = 1 / (1 + span.text.length) + (allPunct ? 0.5 : 0);
    span.score = confidence + rng() * params.spanJitter;
  }
  spans.sort((a, b) => b.score - a.score); // most confident first

  const denom = Math.max(1, spans.length - 1);
  spans.forEach((span, rank) => {
    const base = rank / denom;
    for (let i = span.start; i < span.end; i++) {
      // A little intra-span jitter so a span does not snap as one rigid block.
      out[i] = Math.min(0.999, base + rng() * 0.04);
    }
  });

  // Whitespace inherits the neighbouring offset; it is never scrambled anyway.
  for (let i = 0; i < n; i++) {
    if (classify(target[i]) === CLASS.SPACE && i > 0) out[i] = out[i - 1];
  }
  return out;
}

export const SCHEDULERS = [
  {
    id: 'uniform',
    label: 'Uniform',
    blurb: 'Every cell shares the global progress. Whole-field shimmer, all settling at once.',
    offsets: uniformOffsets,
  },
  {
    id: 'stochastic',
    label: 'Stochastic settle',
    blurb: 'Random per-cell resolve windows. The scattered, classic diffusion look.',
    offsets: stochasticOffsets,
  },
  {
    id: 'wavefront',
    label: 'Wavefront (biased)',
    blurb: 'Blends left-to-right order with randomness. Streaming, but fuzzy ahead of the front.',
    offsets: wavefrontOffsets,
  },
  {
    id: 'spans',
    label: 'Coarse-to-fine spans',
    blurb: 'Resolves word-sized spans in a confidence-like order. Closest to real masked-diffusion LMs.',
    offsets: spanOffsets,
  },
];
