// Class-preserving glyph noise.
//
// The single biggest factor in whether the effect reads as "an answer resolving"
// or as "static": keep the character CLASS of every cell stable from frame one.
// Word shapes, line breaks, and punctuation are legible immediately; only the
// identity of each glyph is unknown. Turn preserveClass off in the UI to see
// how much worse the unstructured version looks.

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT = '0123456789';
const PUNCT = '.,;:!?\'"-–—()[]{}/\\&%*+=<>@#$~^|`_';
const MIXED = LOWER + UPPER + DIGIT + PUNCT;

// Non-alphabetic glyphs for the noise field: box drawing, blocks, arrows, maths,
// Greek. They read as "not language yet", which makes the early field look less
// like scrambled words and more like something that has not resolved into
// language. Monospace-safe in the usual code faces.
const GLYPHS = '░▒▓█▄▀▌▐■□▪▫◆◇○●◐◑△▽◤◥┌┐└┘├┤┬┴┼─│╱╲╳←↑→↓↔↕⇄∴∵∷≈≠≡±∓×÷√∞∫∂∇⊕⊗⊥∠αβγδεζηθλμξπρστφχψωΓΔΘΛΞΠΣΦΨΩ';

// Share of noise draws that come from the glyph pool when glyph noise is on.
// Above about half the field stops reading as text-shaped at all.
const GLYPH_MIX = 0.35;

export const CLASS = {
  SPACE: 'space',
  LOWER: 'lower',
  UPPER: 'upper',
  DIGIT: 'digit',
  PUNCT: 'punct',
  OTHER: 'other',
};

export function classify(ch) {
  if (/\s/.test(ch)) return CLASS.SPACE;
  if (ch >= 'a' && ch <= 'z') return CLASS.LOWER;
  if (ch >= 'A' && ch <= 'Z') return CLASS.UPPER;
  if (ch >= '0' && ch <= '9') return CLASS.DIGIT;
  if (PUNCT.includes(ch)) return CLASS.PUNCT;
  return CLASS.OTHER;
}

const POOLS = {
  [CLASS.LOWER]: LOWER,
  [CLASS.UPPER]: UPPER,
  [CLASS.DIGIT]: DIGIT,
  [CLASS.PUNCT]: PUNCT,
};

// Whitespace is structural by default: it never scrambles, because scrambling it
// destroys the word and line layout the effect depends on. With blockNoise on,
// whitespace becomes an ordinary cell — the field starts as a solid block of the
// same length as the answer, and the spaces have to resolve like everything else.
export function noiseGlyph(rng, ch, cls, params) {
  const { preserveClass, blockNoise, glyphNoise } = params;

  if (cls === CLASS.SPACE && !blockNoise) return ch;

  // Glyph noise overrides the class pool for a share of draws. It applies to
  // scrambled whitespace too, so a block-noise field is not purely alphabetic.
  if (glyphNoise && rng() < GLYPH_MIX) {
    return GLYPHS[Math.floor(rng() * GLYPHS.length)];
  }

  // Letters only for scrambled whitespace, so the block reads as a slab of text
  // rather than as debris.
  const pool = cls === CLASS.SPACE
    ? (preserveClass ? LOWER : MIXED)
    : (preserveClass ? POOLS[cls] || MIXED : MIXED);
  return pool[Math.floor(rng() * pool.length)];
}
