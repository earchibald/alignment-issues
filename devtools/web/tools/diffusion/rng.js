// Seeded PRNG. Self-contained on purpose: this demo imports nothing from game/.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive a distinct stream per panel so the four schedulers do not move in lockstep.
export function deriveSeed(seed, index) {
  return (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
}

export function pick(rng, str) {
  return str[Math.floor(rng() * str.length)];
}
