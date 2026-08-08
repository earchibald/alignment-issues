// The cell state machine. Target-agnostic: it knows about values, classes and
// resolve windows, not about text. An image version would feed it palette
// indices per block and a different noise function; nothing here would change.

const MIN_WIDTH = 0.05;

export class Diffuser {
  /**
   * @param {object} opts
   * @param {Array} opts.targets     final value of each cell
   * @param {Array} opts.classes     class tag per cell (drives the noise pool)
   * @param {Float64Array} opts.offsets  per-cell offset in [0,1) from a scheduler
   * @param {Function} opts.rngFactory  () => seeded rng; called again on every
   *   reset so that a replay from p = 0 is reproducible (scrubbing relies on it)
   * @param {Function} opts.noise    (rng, target, cls, params) => noisy value
   * @param {Function} [opts.isStructural]  (target, cls) => never scramble this cell
   * @param {object} opts.params     parameter set, used to seed the initial noise
   */
  constructor({ targets, classes, offsets, rngFactory, noise, isStructural, params }) {
    this.targets = targets;
    this.classes = classes;
    this.rngFactory = rngFactory;
    this.setOffsets(offsets);
    this.noise = noise;
    this.isStructural = isStructural || (() => false);
    this.params = params;
    this.values = new Array(targets.length);
    this.locked = new Uint8Array(targets.length);
    this.reset();
  }

  // Offsets are normalised against their own range so that `spread` means the
  // same thing to every scheduler. Without this, a scheduler whose offsets are
  // all identical (uniform) would still have its window shortened by spread and
  // would finish at p = 1 - spread instead of at p = 1.
  setOffsets(offsets) {
    this.offsets = offsets;
    let min = Infinity;
    let max = -Infinity;
    for (const o of offsets) {
      if (o < min) min = o;
      if (o > max) max = o;
    }
    this.offsetMin = Number.isFinite(min) ? min : 0;
    this.offsetRange = Number.isFinite(max) ? max - this.offsetMin : 0;
  }

  reset() {
    this.rng = this.rngFactory();
    for (let i = 0; i < this.targets.length; i++) {
      const structural = this.isStructural(this.targets[i], this.classes[i]);
      this.locked[i] = structural ? 1 : 0;
      this.values[i] = structural
        ? this.targets[i]
        : this.noise(this.rng, this.targets[i], this.classes[i], this.params);
    }
  }

  // Local progress of one cell at global progress p.
  localProgress(i, p, spread) {
    const effective = spread * this.offsetRange;
    const width = Math.max(MIN_WIDTH, 1 - effective);
    const start = this.offsetRange > 0
      ? ((this.offsets[i] - this.offsetMin) / this.offsetRange) * effective
      : 0;
    const q = (p - start) / width;
    return q < 0 ? 0 : q > 1 ? 1 : q;
  }

  /**
   * Advance one shimmer step. Called at the shimmer rate, not once per frame.
   * Returns { locked, correct, total } for the readout.
   */
  tick(p, params) {
    const { gamma, lockBase, delta, spread, unsettle } = params;
    let lockedCount = 0;
    let correctCount = 0;

    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];
      const cls = this.classes[i];

      if (this.isStructural(target, cls)) {
        lockedCount++;
        correctCount++;
        continue;
      }

      const q = this.localProgress(i, p, spread);

      if (this.locked[i]) {
        // Remasking: a locked cell can come loose again while it is still
        // inside its resolve window. This is what makes it read as diffusion
        // rather than as a one-way wipe — and it mirrors the low-confidence
        // remasking that real masked-diffusion LMs do between steps.
        if (q < 1 && this.rng() < unsettle * (1 - q)) {
          this.locked[i] = 0;
        } else {
          lockedCount++;
          if (this.values[i] === target) correctCount++;
          continue;
        }
      }

      if (q >= 1) {
        this.values[i] = target;
        this.locked[i] = 1;
        lockedCount++;
        correctCount++;
        continue;
      }

      // Rising chance of drawing the true value...
      const hit = this.rng() < Math.pow(q, gamma);
      this.values[i] = hit ? target : this.noise(this.rng, target, cls, params);

      // ...and a separately rising chance that a correct draw sticks. Early on,
      // a cell that lands on the right value by luck almost always churns away
      // again, which is the behaviour that sells the effect.
      if (hit && this.rng() < lockBase * Math.pow(q, delta)) {
        this.locked[i] = 1;
      }

      if (this.locked[i]) lockedCount++;
      if (this.values[i] === target) correctCount++;
    }

    return { locked: lockedCount, correct: correctCount, total: this.targets.length };
  }
}
