// Simulated token stream. Tokens arrive as discrete, lumpy events rather than
// as a smooth ramp, so progress steps the way a real stream does.

export class TokenSource {
  constructor({ rng, rate, expected }) {
    this.rng = rng;
    this.rate = rate;
    this.expected = expected;
    this.received = 0;
    this.running = false;
    this.wait = 0;
    this.scheduleNext();
  }

  scheduleNext() {
    const mean = 1 / Math.max(0.001, this.rate);
    this.wait = mean * (0.4 + 1.2 * this.rng()); // jittered inter-arrival gap
  }

  get progress() {
    return Math.min(1, this.received / Math.max(1, this.expected));
  }

  get done() {
    return this.received >= this.expected;
  }

  setProgress(p) {
    this.received = Math.round(p * this.expected);
  }

  reset() {
    this.received = 0;
    this.scheduleNext();
  }

  step(dt) {
    if (!this.running || this.done) return;
    let budget = dt;
    let guard = 0;
    while (budget >= this.wait && !this.done && guard++ < 500) {
      budget -= this.wait;
      this.received++;
      this.scheduleNext();
    }
    this.wait -= budget;
  }
}
