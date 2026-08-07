// Renders one diffuser's cells as a span grid, and owns the purely visual
// treatments: luminance jitter on unlocked cells, and a flash when a cell locks.
//
// Nothing here feeds back into the simulation. It uses Math.random rather than
// the seeded stream on purpose — visual sparkle must not consume rng draws, or
// turning a slider up would change which glyphs the diffuser picks and a
// re-scrub would no longer reproduce.

export class TextView {
  constructor(root, length, targets) {
    this.root = root;
    // Needed to tell an unlocked cell that is still wrong from one that has
    // landed on the right glyph but has not committed to it yet.
    this.targets = targets || [];
    this.root.textContent = '';
    this.spans = new Array(length);
    this.lastValue = new Array(length);
    this.lastLocked = new Uint8Array(length);
    this.flashStart = new Float64Array(length);
    this.flashing = new Set();
    this.primed = false; // suppress flashes on the very first render
    // A scrub replays hundreds of ticks inside one JS turn, so every lock lands
    // at the same wall-clock instant and the whole answer would flash at once.
    // The replay sets this while it runs.
    this.suppressFlash = false;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < length; i++) {
      const span = document.createElement('span');
      span.className = 'cell';
      this.spans[i] = span;
      this.lastValue[i] = null;
      frag.appendChild(span);
    }
    this.root.appendChild(frag);
  }

  render(values, locked, params, now) {
    const jitter = params.lumJitter;
    for (let i = 0; i < this.spans.length; i++) {
      const span = this.spans[i];

      if (this.lastValue[i] !== values[i]) {
        span.textContent = values[i];
        this.lastValue[i] = values[i];
      }

      if (this.lastLocked[i] !== locked[i]) {
        span.classList.toggle('locked', locked[i] === 1);
        // Lock is the moment worth marking: it is the cell committing.
        if (locked[i] === 1 && this.primed && !this.suppressFlash) {
          this.flashStart[i] = now;
          this.flashing.add(i);
        }
        this.lastLocked[i] = locked[i];
      }

      // Unsolved cells shimmer in brightness as well as in glyph. Re-rolled on
      // every redraw, so the jitter rate follows the shimmer rate.
      //
      // "Unsolved" means unlocked AND still showing the wrong glyph. A cell that
      // has landed on its true glyph but not committed to it holds steady, so
      // the field reads in three states rather than two: churning noise, a
      // correct-but-provisional glyph, and a locked one.
      const unsolved = locked[i] === 0 && values[i] !== this.targets[i];
      if (unsolved && jitter > 0) {
        span.style.opacity = String(1 - Math.random() * jitter * 0.85);
      } else if (span.style.opacity) {
        span.style.opacity = '';
      }
    }
    this.primed = true;
  }

  /**
   * Advance flash decay. Called every animation frame rather than on the shimmer
   * tick, so a short flash still fades smoothly at a low shimmer rate.
   *
   * hold = time at full strength, fade = linear decay after it. fade of 0 gives
   * a hard cut at the end of the hold.
   */
  paintFlashes(now, params) {
    if (this.flashing.size === 0) return;
    const { flashStrength, flashHoldMs, flashFadeMs } = params;

    for (const i of this.flashing) {
      const span = this.spans[i];
      const age = now - this.flashStart[i];

      let amount;
      if (flashStrength <= 0 || age >= flashHoldMs + flashFadeMs) {
        amount = 0;
      } else if (age <= flashHoldMs) {
        amount = flashStrength;
      } else {
        amount = flashStrength * (1 - (age - flashHoldMs) / flashFadeMs);
      }

      if (amount <= 0) {
        span.style.removeProperty('--flash');
        span.classList.remove('flash');
        this.flashing.delete(i);
      } else {
        span.style.setProperty('--flash', amount.toFixed(3));
        span.classList.add('flash');
      }
    }
  }

  // A rebuild throws the spans away; clear pending flashes with them.
  clearFlashes() {
    for (const i of this.flashing) {
      this.spans[i].classList.remove('flash');
      this.spans[i].style.removeProperty('--flash');
    }
    this.flashing.clear();
  }
}
