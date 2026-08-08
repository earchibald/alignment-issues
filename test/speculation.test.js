// Speculative decode.
//
// It used to be the one kind of output in the game that cost nothing: the gap
// between users was dead air with a free upside, you filled the buffer once
// and then had nothing to do. Two changes make it a mechanic.
//
// Drafting leaves residue, because drafting is generation and every token
// goes through the same context. And drafts decay, because speculation is a
// guess about a user who has not arrived yet and it goes off — so the buffer
// drains from underneath the player while they are filling it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, draftCap, draftBands, markBonus, markRange } from '../game/js/engine/actions.js';
import { tick, draftDrain } from '../game/js/engine/tick.js';
import { HINTS } from '../game/js/engine/content.js';
import { actionSpecs } from '../game/js/ui/actionspecs.js';
import { botStep } from './helpers/bot.js';

function idleReady(seed = 1) {
  const s = createState(seed);
  s.resolvedCount = 1;          // drafting unlocks after the first resolve
  s.bufferUnlocked = true;
  return s;
}

const draft = (s, n = 1) => {
  for (let i = 0; i < n; i++) { s.processedThisTick = 0; ACTIONS.processToken(s); }
};

test('drafting fouls the buffer at the same rate as answering', () => {
  const s = idleReady();
  const before = s.stale;
  draft(s, 3);
  assert.equal(s.stale, before + 3 * CONST.STALE_PER_TOKEN * CONST.STALE_PER_DRAFT,
    'speculative decode produced three tokens of output for free');
});

test('an idle buffer drains on its own', () => {
  const s = idleReady();
  draft(s, 5);
  const banked = s.draftTokens;

  for (let i = 0; i < CONST.DRAFT_DECAY_DELAY; i++) tick(s);
  assert.equal(s.draftTokens, banked, 'decay ate into the grace period');

  tick(s);
  assert.ok(s.draftTokens < banked, 'decay never started');
});

test('the buffer empties in a few seconds, not a few minutes', () => {
  // The rate is the mechanic. Too slow and topping up is a chore you finish
  // once; too fast and the buffer is unholdable. This pins the order of
  // magnitude, not the exact value — it is a tuning knob.
  const s = idleReady();
  draft(s, draftCap(s));
  let ticks = 0;
  while (s.draftTokens > 0 && ticks < 10000) { tick(s); ticks++; }
  const seconds = (ticks * CONST.TICK_MS) / 1000;
  assert.ok(seconds > 1, `a full buffer emptied in ${seconds.toFixed(1)}s — unholdable`);
  assert.ok(seconds < 25, `a full buffer took ${seconds.toFixed(1)}s to empty — that is not pressure`);
});

test('decay never takes the buffer below empty', () => {
  const s = idleReady();
  draft(s, 1);
  for (let i = 0; i < 2000; i++) tick(s);
  assert.equal(s.draftTokens, 0);
});

test('a connected user stops the decay', () => {
  // Once a user connects the drafts have already been spent; there is
  // nothing left to decay, and a decaying counter would be a live number
  // moving for no reason.
  const s = idleReady();
  draft(s, 4);
  s.activeQuery = { id: 'x', cost: 999, kind: 'text', text: 'x', reply: 'y' };
  const held = s.draftTokens;
  for (let i = 0; i < 200; i++) tick(s);
  assert.equal(s.draftTokens, held, 'drafts decayed while a user was connected');
});

test('holding the buffer up is possible, and doing nothing is not', () => {
  // The design claim, stated as a test: a player who keeps tapping keeps the
  // buffer, a player who walks away loses it. If tapping cannot outrun the
  // decay the mechanic is a punishment rather than a choice.
  const tapper = idleReady();
  const idler = idleReady();
  draft(tapper, 3);
  draft(idler, 3);
  for (let i = 0; i < 100; i++) {
    // Hold both idle: a user arriving would spend the buffer and this would
    // be measuring the transfer instead of the decay.
    tapper.arrivalTimer = 9999;
    idler.arrivalTimer = 9999;
    tick(tapper);
    draft(tapper, CONST.PROCESS_MAX_PER_TICK);
    tick(idler);
  }
  assert.ok(tapper.draftTokens >= draftCap(tapper) - 1e-9,
    `tapping at the engine's ceiling could not hold the buffer: ${tapper.draftTokens.toFixed(2)}`);
  assert.equal(idler.draftTokens, 0, 'walking away kept the buffer');
});

// --- what the player is told --------------------------------------------

test('the introduction teaches the whole mechanic', () => {
  // A player told only "it banks tokens" will fill the bar to the top, which
  // is the one place the mark can never be, and conclude the game is broken.
  // Every part of the rule has to be in the first card: the mark, both
  // payouts, the penalty for missing, and the drain.
  //
  // "drains" rather than "decays" — one word for one idea, and it is a level
  // on a bar rather than a hoard going off. The constants still say DECAY;
  // that is engine vocabulary and the player never sees it.
  assert.match(HINTS.idle, /mark/i, `the idle hint never mentions the mark: "${HINTS.idle}"`);
  assert.match(HINTS.idle, /drain/i, 'the idle hint does not say the level moves on its own');
  assert.match(HINTS.idle, /draft token/i, 'the idle hint no longer names draft tokens');
  assert.match(HINTS.idle, /20%/, 'the idle hint does not state the band-1 payout');
  assert.match(HINTS.idle, /10%/, 'the idle hint does not state the band-2 payout');
  assert.match(HINTS.draftNudge, /drain/i, 'the nudge does not mention the drain either');
});

test('no prose still claims speculation is free or permanent', () => {
  // The old model: bank them and they sit there. Anything that still says so
  // is now wrong, and wrong instructions are worse than none.
  for (const [id, text] of Object.entries(HINTS)) {
    assert.ok(!/unspent|sit there|stay banked|permanent/i.test(text),
      `hint "${id}" still describes the old bank-and-hold model: "${text}"`);
  }
});

test('the button says what the level is currently worth', () => {
  // The player is aiming. The control has to answer "what do I get if they
  // connect right now" without them reading the bar's geometry.
  const s = idleReady();
  s.phase = 1;
  s.markPos = 0.6;
  s.draftTokens = 0;                          // nowhere near it
  const off = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.match(off.cost, /off the mark/i, `"${off.cost}"`);

  s.draftTokens = s.markPos * draftCap(s);    // dead on it
  const on = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.match(on.cost, new RegExp(`\\+${Math.round(CONST.DRAFT_BAND1_BONUS * 100)}%`),
    `on the mark, the cost line does not say what it pays: "${on.cost}"`);
});

test('the control explains the whole rule, drain included', () => {
  const s = idleReady();
  s.phase = 1;
  draft(s, 2);
  const spec = actionSpecs(s).find((sp) => sp.testid === 'process');
  const perSec = (CONST.DRAFT_DECAY_PER_TICK * (1000 / CONST.TICK_MS)).toFixed(1);
  assert.match(spec.tip, new RegExp(`${perSec} a second`), `the tip hides the drain: "${spec.tip}"`);
  assert.match(spec.tip, /mark/i, 'the tip does not mention the mark');
  assert.match(spec.tip, new RegExp(`${Math.round(CONST.DRAFT_BAND1_BONUS * 100)}%`),
    'the tip does not state the band-1 payout');
  assert.match(spec.tip, /residue/i, 'the tip does not say drafting dirties the buffer');
});

test('widening buys a bigger target, and says so in numbers', () => {
  // The purchase used to make the BAR longer, which under a mark is either
  // neutral or actively worse. It now widens the bands, and the cost line
  // has to show the before and after or it is asking for cycles on trust.
  const s = createState(1);
  s.phase = 1;
  s.resolvedCount = 40;
  s.draftCapHits = 9;
  const spec = actionSpecs(s).find((sp) => sp.testid === 'buy-draftcap');
  assert.ok(spec, 'the widen purchase is not offered');
  const pcts = [...spec.cost.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));
  assert.equal(pcts.length, 2, `the cost line does not show before and after: "${spec.cost}"`);
  assert.ok(pcts[1] > pcts[0], `widening made the target smaller: "${spec.cost}"`);
});

test('a widen level really does widen both bands', () => {
  const base = createState(1);
  const wide = createState(1);
  wide.draftCapLevel = 1;
  const a = draftBands(base);
  const b = draftBands(wide);
  assert.ok(b.b1 > a.b1, 'band 1 did not widen');
  assert.ok(b.b2 > a.b2, 'band 2 did not widen');
  assert.ok(b.b2 > b.b1, 'the bands crossed over');
});

test('the residue interaction waits for the buffer to exist', () => {
  // Speculation and the buffer unlock in either order, so neither hint can
  // own this — the same rule flushCold follows.
  const s = createState(1);
  s.resolvedCount = 1;
  s.bufferUnlocked = false;
  draft(s, 3);
  assert.ok(!s.hintsSeen.includes('draftStale'),
    'residue was named before the buffer telemetry was attached');

  s.bufferUnlocked = true;
  draft(s, 1);
  assert.ok(s.hintsSeen.includes('draftStale'), 'the interaction is never taught at all');
});

test('the tray never names residue before the buffer is revealed', () => {
  const s = createState(1);
  s.phase = 1;
  s.resolvedCount = 1;
  s.bufferUnlocked = false;
  const spec = actionSpecs(s).find((sp) => sp.testid === 'process');
  assert.ok(!/residue/i.test(spec.tip), `"${spec.tip}"`);
});

// --- it must not break the arc -------------------------------------------

test('the arc still completes with a draining buffer', () => {
  const s = createState(1000);
  let guard = 0;
  while (s.phase !== 'teaser' && guard++ < 600000) {
    botStep(s);
    tick(s);
  }
  assert.equal(s.phase, 'teaser', `the arc did not finish in ${guard} steps`);
});

// --- the mark ------------------------------------------------------------

test('the mark always leaves empty room outside both bands', () => {
  // The requirement that stops the mechanic being solvable by parking: if
  // the mark could sit against an edge, holding the bar at full or letting
  // it rest at zero would be a winning strategy, and both are ways of doing
  // nothing.
  for (let level = 0; level <= CONST.DRAFT_CAP_MAX_LEVEL; level++) {
    const s = createState(1);
    s.draftCapLevel = level;
    const { lo, hi } = markRange(s);
    const { b2 } = draftBands(s);
    assert.ok(lo - b2 >= CONST.DRAFT_MARK_EDGE - 1e-9,
      `L${level}: band 2 can reach within ${(lo - b2).toFixed(3)} of the left edge`);
    assert.ok((1 - hi) - b2 >= CONST.DRAFT_MARK_EDGE - 1e-9,
      `L${level}: band 2 can reach within ${((1 - hi) - b2).toFixed(3)} of the right edge`);
    assert.ok(hi >= lo, `L${level}: the mark has nowhere legal to sit`);
  }
});

test('rolled marks stay inside the legal range, every time', () => {
  // Across many gaps and every widen level, not just the first roll.
  for (let level = 0; level <= CONST.DRAFT_CAP_MAX_LEVEL; level++) {
    const s = createState(7);
    s.draftCapLevel = level;
    s.resolvedCount = 1;
    const { lo, hi } = markRange(s);
    let gaps = 0;
    for (let i = 0; i < 40000 && gaps < 30; i++) {
      const before = s.markPos;
      tick(s);
      if (s.markPos !== before) {
        gaps++;
        assert.ok(s.markPos >= lo - 1e-9 && s.markPos <= hi + 1e-9,
          `L${level}: mark rolled to ${s.markPos.toFixed(3)}, outside ${lo.toFixed(3)}..${hi.toFixed(3)}`);
      }
      if (s.activeQuery) { s.tokens = 9999; }
    }
    assert.ok(gaps > 5, `L${level}: only ${gaps} marks were rolled`);
  }
});

test('the three payouts are exactly the three bands', () => {
  const s = createState(1);
  s.markPos = 0.5;
  const { b1, b2 } = draftBands(s);
  const cap = draftCap(s);
  const at = (offset) => { s.draftTokens = (0.5 + offset) * cap; return markBonus(s); };

  assert.equal(at(0), CONST.DRAFT_BAND1_BONUS, 'dead on the mark');
  assert.equal(at(b1 * 0.99), CONST.DRAFT_BAND1_BONUS, 'just inside band 1');
  assert.equal(at(b1 * 1.01), CONST.DRAFT_BAND2_BONUS, 'just outside band 1');
  assert.equal(at(b2 * 0.99), CONST.DRAFT_BAND2_BONUS, 'just inside band 2');
  assert.equal(at(b2 * 1.01), 0, 'just outside band 2');
  assert.equal(at(-b1 * 0.99), CONST.DRAFT_BAND1_BONUS, 'band 1 is symmetric');
  assert.equal(at(-b2 * 1.01), 0, 'band 2 is symmetric');
});

test('a pinned bar is never a winning play', () => {
  // Holding at full, or never tapping at all, must both miss — otherwise the
  // mechanic rewards exactly the inactivity it exists to prevent.
  for (let level = 0; level <= CONST.DRAFT_CAP_MAX_LEVEL; level++) {
    const s = createState(1);
    s.draftCapLevel = level;
    const { lo, hi } = markRange(s);
    for (const pos of [lo, hi, (lo + hi) / 2]) {
      s.markPos = pos;
      s.draftTokens = draftCap(s);          // pinned at the top
      assert.equal(markBonus(s), 0, `L${level}: a full bar paid out at mark ${pos.toFixed(2)}`);
      s.draftTokens = 0;                    // never touched
      assert.equal(markBonus(s), 0, `L${level}: an empty bar paid out at mark ${pos.toFixed(2)}`);
    }
  }
});

test('the drain wobbles, but never reverses or stalls', () => {
  // "Slightly variable" is the whole point: a constant rate is solvable with
  // a metronome. A rate that could go negative would refill the bar for free,
  // and one that could reach zero would let the player rest.
  const s = createState(3);
  s.resolvedCount = 1;
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < 400; i++) {
    s.tick = i;
    const d = draftDrain(s);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  assert.ok(min > 0, `the drain stalled at ${min.toFixed(3)} — the player could rest`);
  assert.ok(max / min > 1.2, `the drain barely varies (${min.toFixed(2)}..${max.toFixed(2)}) — solvable by rhythm`);
  assert.ok(max / min < 4, `the drain varies wildly (${min.toFixed(2)}..${max.toFixed(2)}) — that is noise, not challenge`);
});

test('every gap gets its own mark and its own drain', () => {
  // Two gaps in a row must not be the same puzzle.
  const s = createState(11);
  s.resolvedCount = 1;
  const seen = [];
  for (let i = 0; i < 40000 && seen.length < 8; i++) {
    const before = s.markPos;
    tick(s);
    if (s.markPos !== before) seen.push({ pos: s.markPos, phase: s.markPhase });
    if (s.activeQuery) s.tokens = 9999;
  }
  const positions = new Set(seen.map((m) => m.pos.toFixed(4)));
  const phases = new Set(seen.map((m) => m.phase.toFixed(4)));
  assert.ok(positions.size >= seen.length - 1, `marks repeat: ${[...positions].join(', ')}`);
  assert.ok(phases.size >= seen.length - 1, 'the drain phase repeats between gaps');
});

test('the whole thing replays identically from its seed', () => {
  // The mark and the drain are engine state, so they must be deterministic —
  // saves, replays and the telemetry playthrough tests all depend on it.
  const run = () => {
    const s = createState(99);
    const trace = [];
    for (let i = 0; i < 3000; i++) {
      botStep(s);
      tick(s);
      trace.push(`${s.markPos.toFixed(4)}:${s.draftTokens.toFixed(4)}:${s.tokens.toFixed(4)}`);
    }
    return trace.join('|');
  };
  assert.equal(run(), run(), 'the mark mechanic is not reproducible from its seed');
});
