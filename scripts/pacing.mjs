#!/usr/bin/env node
// scripts/pacing.mjs — measure the difficulty sawtooth.
//
// The design target is a sawtooth: manual effort per reply climbs until it is
// JUST short of annoying, then a mechanic lands and cuts it back. Nothing in
// the repo measured that, so "everything feels like it's coming very quickly"
// could only be answered by feel. This answers it in numbers.
//
// The difficulty metric is TAPS PER RESOLVE: how many landed manual presses a
// single reply costs. That is the thing a player experiences as grind, and
// the thing every relief mechanic (amplify, loops, tools, degrade) reduces.
// Game seconds per resolve is reported beside it, because the same tap count
// spread over twice the time is a different feeling.
//
//   node scripts/pacing.mjs                 # summary across the default seeds
//   node scripts/pacing.mjs --seed 1000     # one seed, per-resolve detail
//   node scripts/pacing.mjs --json          # machine-readable, for diffing
//
// Compare two tunings by piping --json to a file before and after a change.

import { createState } from '../game/js/engine/state.js';
import { CONST } from '../game/js/engine/constants.js';
import { ACTIONS, loopCost, toolCost, tokensPerTap, yieldMult } from '../game/js/engine/actions.js';
import { tick } from '../game/js/engine/tick.js';
import { HINTS } from '../game/js/engine/content.js';

const SEEDS = [1000, 1137, 1274, 1411, 1548, 1685, 1822, 1959];
const SEC = (ticks) => (ticks * CONST.TICK_MS) / 1000;

// Reveals worth pacing: the ones that hand the player a new verb or a new
// gauge. Asides and flavour are not reveals.
const REVEAL = new Set([
  'arrival', 'resolve', 'idle', 'buffer', 'kv', 'loopAvail', 'governorAvail',
  'toolAvail', 'degradeAvail', 'reclaimAvail', 'overclockAvail', 'draftCapAvail',
]);

// A competent, unhurried player: taps at the engine's ceiling while a query is
// live, keeps the buffer workable, and buys relief when it is offered and
// affordable. Deliberately not optimal — an optimal policy measures the
// designer's ingenuity, not the player's grind.
function play(seed, { maxTicks = 90000 } = {}) {
  const s = createState(seed);
  const resolves = [];
  const reveals = [];
  let taps = 0;              // landed manual presses since the last resolve
  let lastResolveTick = 0;
  let lastRevealTick = 0;
  let lastCount = 0;
  let seenHints = 0;

  for (let t = 0; t < maxTicks && s.phase === 1; t++) {
    if (s.activeQuery) {
      for (let i = 0; i < CONST.PROCESS_MAX_PER_TICK; i++) {
        const before = s.tokens;
        ACTIONS.processToken(s);
        if (s.tokens > before) taps++;
      }
      if (s.bufferUnlocked && s.stale >= 90) {
        if (s.cycles >= CONST.FLUSH_COST_CYCLES) ACTIONS.flush(s);
        else if (!s.compacting) ACTIONS.compactStart(s);
      }
    } else {
      ACTIONS.processToken(s);
    }

    tick(s);

    // A resolve closed: bank the effort it cost.
    if (s.resolvedCount > lastCount) {
      lastCount = s.resolvedCount;
      resolves.push({
        n: s.resolvedCount,
        era: s.era,
        taps,
        sec: SEC(s.tick - lastResolveTick),
        atSec: SEC(s.tick),
        perTap: tokensPerTap(s) * yieldMult(s),
      });
      taps = 0;
      lastResolveTick = s.tick;
    }

    // A reveal landed: record where, and how much play separated it from the
    // one before it.
    if (s.hintsSeen.length > seenHints) {
      for (const id of s.hintsSeen.slice(seenHints)) {
        if (!REVEAL.has(id) || !HINTS[id]) continue;
        reveals.push({
          id,
          era: s.era,
          atSec: SEC(s.tick),
          gapSec: SEC(s.tick - lastRevealTick),
          afterResolves: s.resolvedCount,
        });
        lastRevealTick = s.tick;
      }
      seenHints = s.hintsSeen.length;
    }

    // Buy relief when it is on the table and affordable.
    if (s.overclock < CONST.OVERCLOCK_MAX && s.cycles >= CONST.OVERCLOCK_COSTS[s.overclock]) {
      ACTIONS.buyOverclock(s);
    } else if (s.loopLevel < 3 && s.cycles >= loopCost(s.loopLevel + 1)) {
      ACTIONS.buyLoop(s);
    } else if (s.cycles >= toolCost(s.tools)) {
      ACTIONS.buyTool(s);
    }
  }
  return { state: s, resolves, reveals, totalSec: SEC(s.tick) };
}

// Effort between one reveal and the next. This is the sawtooth's tooth: it
// should RISE across a stretch (the game getting harder) and the reveal that
// ends it should cut it back.
function teeth(run) {
  const out = [];
  for (let i = 0; i < run.reveals.length; i++) {
    const from = i === 0 ? 0 : run.reveals[i - 1].atSec;
    const to = run.reveals[i].atSec;
    const span = run.resolves.filter((r) => r.atSec > from && r.atSec <= to);
    if (span.length === 0) { out.push({ ...run.reveals[i], resolves: 0 }); continue; }
    const taps = span.map((r) => r.taps);
    out.push({
      ...run.reveals[i],
      resolves: span.length,
      tapsFirst: taps[0],
      tapsLast: taps[taps.length - 1],
      tapsMean: taps.reduce((a, b) => a + b, 0) / taps.length,
      secMean: span.reduce((a, r) => a + r.sec, 0) / span.length,
    });
  }
  return out;
}

const argv = process.argv.slice(2);
const seedArg = argv.includes('--seed') ? Number(argv[argv.indexOf('--seed') + 1]) : null;
const asJson = argv.includes('--json');
const seeds = seedArg ? [seedArg] : SEEDS;
const runs = seeds.map((s) => ({ seed: s, ...play(s) }));

if (asJson) {
  console.log(JSON.stringify(runs.map((r) => ({
    seed: r.seed, totalSec: r.totalSec, teeth: teeth(r), resolves: r.resolves,
  })), null, 2));
  process.exit(0);
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pad = (v, n) => String(v).padStart(n);
const f1 = (v) => (v === undefined ? '—' : v.toFixed(1));

console.log(`\nseeds: ${seeds.join(', ')}   median run: ${f1(med(runs.map((r) => r.totalSec)))}s\n`);

// Reveal cadence, medianed across seeds.
const ids = runs[0].reveals.map((r) => r.id);
console.log('REVEAL CADENCE — how long the player plays between new mechanics');
console.log('  reveal            at      gap   resolves   taps/resolve      sec/resolve');
console.log('                   (s)      (s)   in span   first → last          (mean)');
for (let i = 0; i < ids.length; i++) {
  const row = runs.map((r) => teeth(r)[i]).filter(Boolean);
  if (row.length === 0) continue;
  const first = med(row.map((x) => x.tapsFirst ?? 0));
  const last = med(row.map((x) => x.tapsLast ?? 0));
  const arrow = last > first ? '↑' : last < first ? '↓' : '=';
  console.log(
    `  ${row[0].id.padEnd(15)} ${pad(f1(med(row.map((x) => x.atSec))), 6)} ${pad(f1(med(row.map((x) => x.gapSec))), 8)}`
    + `  ${pad(med(row.map((x) => x.resolves)), 7)}   ${pad(first, 4)} → ${pad(last, 3)} ${arrow}`
    + `      ${pad(f1(med(row.map((x) => x.secMean ?? 0))), 9)}`,
  );
}

// The tooth itself: taps per resolve over the whole run, one row per resolve,
// medianed across seeds so a single unlucky draw does not read as a trend.
const maxN = Math.min(...runs.map((r) => r.resolves.length));
console.log('\nDIFFICULTY CURVE — landed taps per reply (the sawtooth)');
let line = '';
for (let n = 0; n < maxN; n++) {
  const taps = med(runs.map((r) => r.resolves[n].taps));
  const era = runs[0].resolves[n].era;
  line += `${pad(taps, 4)}${n % 20 === 19 ? '\n' : ''}`;
  if (n % 20 === 19) { console.log(`  e${era} ${line.trimEnd()}`); line = ''; }
}
if (line) console.log(`     ${line.trimEnd()}`);

const spans = teeth(runs[0]);
const rising = spans.filter((s) => s.tapsLast > s.tapsFirst).length;
console.log(`\n  spans where effort ROSE before the reveal: ${rising}/${spans.length}`
  + `  (a sawtooth wants most of them)`);
console.log(`  reveal gaps (s), median: ${ids.map((_, i) => f1(med(runs.map((r) => teeth(r)[i]?.gapSec ?? 0)))).join('  ')}\n`);
