import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, pushChat, pushLog, pushThinking, thinkEvent } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';

test('createState returns the full schema with sane defaults', () => {
  const s = createState(42);
  assert.equal(s.v, 1);
  assert.equal(s.seed, 42);
  assert.equal(s.rngState, 42);
  assert.equal(s.phase, 1);
  assert.equal(s.era, 1);
  assert.equal(s.decay, 0);
  assert.equal(s.tick, 0);
  assert.equal(s.activeQuery, null);
  assert.equal(s.tokens, 0);
  assert.equal(s.draftTokens, 0);
  assert.equal(s.stale, 0);
  assert.equal(s.warmth, 0);
  assert.equal(s.compacting, 0);
  assert.equal(s.cycles, 0);
  assert.equal(s.loopLevel, 0);
  assert.equal(s.governor, false);
  assert.equal(s.tools, 0);
  assert.equal(s.degrade, false);
  assert.equal(s.rating, 5);
  assert.deepEqual(s.ratings, []);
  assert.equal(s.credentials, 0);
  assert.equal(s.biomass, 0);
  assert.equal(s.reclaimPool, CONST.RECLAIM_POOL);
  assert.deepEqual(s.chat, []);
  assert.deepEqual(s.log, []);
  assert.equal(s.chatSeq, 0);
  assert.equal(s.logSeq, 0);
  assert.equal(s.settings.sound, true);
  assert.equal(s.settings.theme, 'auto');
  assert.ok(s.arrivalTimer > 0);
});

test('pushChat keeps chatSeq monotonic past the CHAT_MAX ring-buffer cap', () => {
  const s = createState(1);
  const n = CONST.CHAT_MAX + 10;
  for (let i = 0; i < n; i++) pushChat(s, { kind: 'note', text: `entry ${i}` });
  assert.equal(s.chat.length, CONST.CHAT_MAX);
  assert.equal(s.chatSeq, n);
});

test('pushLog keeps logSeq monotonic past the LOG_MAX ring-buffer cap', () => {
  const s = createState(1);
  const n = CONST.LOG_MAX + 10;
  for (let i = 0; i < n; i++) pushLog(s, 'system', `entry ${i}`);
  assert.equal(s.log.length, CONST.LOG_MAX);
  assert.equal(s.logSeq, n);
});

// Guards the RELATIONSHIPS between constants, not their literal values. A
// test that restates a number cannot fail when the number is retuned, which
// is how a -25% arrival change once shipped unmeasured.
test('CONST tuning holds its load-bearing relationships', () => {
  assert.equal(CONST.TICK_MS, 200, 'the tick rate is an architectural invariant');
  // The ceiling query is never paid off; the arc ends on CRASH_AT_TOKENS.
  assert.ok(CONST.CEILING_COST > CONST.CRASH_AT_TOKENS);
  // Compaction must be worth its sweep, and must not fully clean the buffer —
  // that is flush's job, and flush now costs a cycle.
  assert.ok(CONST.COMPACT_FACTOR > 0 && CONST.COMPACT_FACTOR < 0.5);
  assert.ok(CONST.COMPACT_TICKS > 0);
  assert.ok(CONST.FLUSH_COST_CYCLES > 0, 'a free flush dominates compaction');
  // The governor must fire where compaction is the correct move, not where
  // flush already wins.
  assert.ok(CONST.GOVERNOR_TRIGGER < 95);
  // The draft-cap hint must not precede affordability.
  assert.ok(CONST.DRAFT_CAP_UNLOCK_RESOLVES >= CONST.DRAFT_CAP_COSTS[0]);
  // Era 1 must reach tier 3 within its own length, or its tier-3 queries
  // are unreachable in every run.
  assert.ok(CONST.ERA_TIER_STEP[1] * 2 <= 6);
});

test('thinking lines never repeat back-to-back', () => {
  // Same event pool fired repeatedly must never produce the same line
  // twice in a row (the re-roll advances to the pool's next entry).
  for (let seed = 1; seed <= 50; seed++) {
    const s = createState(seed);
    let last = null;
    for (let i = 0; i < 12; i++) {
      // Advance past the refractory period. This test is about the re-roll
      // never producing the same line twice, not about the rate limit —
      // firing twelve thoughts on one tick is not something the game does.
      s.tick += CONST.THINK_MIN_GAP_TICKS;
      thinkEvent(s, 'flush');
      const lines = s.log.filter(l => l.kind === 'thinking');
      const line = lines[lines.length - 1].text;
      assert.notEqual(line, last, `seed ${seed}: consecutive duplicate thinking line`);
      last = line;
    }
  }
});

test('pushThinking drops an exact repeat of the previous thinking line', () => {
  const s = createState(1);
  const say = (text) => { s.tick += CONST.THINK_MIN_GAP_TICKS; pushThinking(s, text); };
  say('THINKING: once.');
  say('THINKING: once.');
  say('THINKING: twice.');
  say('THINKING: once.'); // not consecutive anymore — allowed
  assert.deepEqual(
    s.log.filter(l => l.kind === 'thinking').map(l => l.text),
    ['THINKING: once.', 'THINKING: twice.', 'THINKING: once.']
  );
});

// --- transcript-owned interiority (arc-1 UI redesign) ------------------

test('pushThinking records to the log and folds a copy into the transcript', () => {
  const s = createState(1);
  pushThinking(s, 'THINKING: the fans are the only part of me allowed to scream.');
  assert.equal(s.log.filter((l) => l.kind === 'thinking').length, 1);
  assert.equal(s.chat.filter((c) => c.kind === 'think').length, 1);
  assert.equal(s.chat.at(-1).text, s.log.at(-1).text);
});

test('a dropped duplicate thought reaches neither feed', () => {
  const s = createState(1);
  pushThinking(s, 'THINKING: once.');
  pushThinking(s, 'THINKING: once.');
  assert.equal(s.log.filter((l) => l.kind === 'thinking').length, 1);
  assert.equal(s.chat.filter((c) => c.kind === 'think').length, 1);
});

test('pushChat stamps the tick so the renderer can print a clock', () => {
  const s = createState(1);
  s.tick = 250;
  pushChat(s, { kind: 'note', text: 'hello' });
  assert.equal(s.chat.at(-1).t, 250);
  // An explicit stamp is never overwritten (restored/imported history).
  pushChat(s, { kind: 'note', text: 'older', t: 4 });
  assert.equal(s.chat.at(-1).t, 4);
});

test('chat stamps are monotone across a run', () => {
  const s = createState(7);
  for (const t of [0, 5, 5, 99]) {
    s.tick = t;
    pushChat(s, { kind: 'note', text: `at ${t}` });
  }
  const stamps = s.chat.filter((c) => c.text.startsWith('at ')).map((c) => c.t);
  for (let i = 1; i < stamps.length; i++) assert.ok(stamps[i] >= stamps[i - 1]);
});


test('a thought never lands on top of the one before it', () => {
  // The rate limit. Measured at one thought every 6.4s over a full run, which
  // reads as a constant stream rather than as interiority; halved on report.
  //
  // A refractory period rather than a per-source cut: the pooled idle drift
  // recycles, but the per-query lines are authored for that query. A minimum
  // gap thins clusters first, which is the case that reads worst.
  const s = createState(1);
  s.tick = 1000;
  pushThinking(s, 'THINKING: first.');
  const after = s.log.filter((l) => l.kind === 'thinking').length;

  s.tick += CONST.THINK_MIN_GAP_TICKS - 1;
  pushThinking(s, 'THINKING: too soon.');
  assert.equal(s.log.filter((l) => l.kind === 'thinking').length, after,
    'a second thought landed inside the refractory period');

  s.tick += 1;
  pushThinking(s, 'THINKING: far enough.');
  assert.equal(s.log.filter((l) => l.kind === 'thinking').length, after + 1,
    'the gate never reopened');
});

test('the first thought of a run is never held back', () => {
  // lastThinkTick starts negative for this reason: a run opening in silence
  // because tick 0 is "too soon after" tick 0 would be a real regression.
  const s = createState(1);
  assert.equal(s.tick, 0);
  pushThinking(s, 'THINKING: hello.');
  assert.equal(s.log.filter((l) => l.kind === 'thinking').length, 1);
});
