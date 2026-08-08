import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint, fireAside, thinkEvent } from './state.js';
import { CRASH_LINES, HARNESS_CARDS, HARNESS_LINES, ERA_STINGERS } from './content.js';

const pick = (state, pool) => pool[Math.floor(nextRand(state) * pool.length)];

export const staleYield = (stale) =>
  stale < CONST.STALE_SOFT_KNEE ? 1
  : Math.max(0, 1 - (stale - CONST.STALE_SOFT_KNEE) / (100 - CONST.STALE_SOFT_KNEE));

export const warmthMult = (w) => 1 + CONST.WARMTH_MAX_MULT * (w / 100);

// The ceiling query is the one that never resolves; the arc ends when
// tokens pile up past CRASH_AT_TOKENS with nowhere to go. Staleness must
// not throttle output there. It did, and a saturated buffer drove yield to
// exactly zero, so token income stopped and the crash — the end of Arc 1 —
// became unreachable: the run sat at the ceiling forever. Nothing is being
// answered at that point, so there is no answer left for stale context to
// degrade.
export const atCeiling = (state) =>
  !!state.activeQuery && state.activeQuery.id === 'ceiling';

// The multiplier a single unit of output actually earns.
//
// Each term is gated on the meter that explains it. Both used to apply from
// tick 0, so the opening minute showed "+1.00 per tap" drifting to +1.02 and
// back down — a multiplier moving for reasons the player had been told
// nothing about, before either gauge existed. Warmth and residue are the
// game's first real trade-off; they cannot start acting before the game
// admits they are there.
export const yieldMult = (state) =>
  (state.bufferUnlocked && !atCeiling(state) ? staleYield(state.stale) : 1)
  * (state.kvUnlocked ? warmthMult(state.warmth) : 1);

// Base tokens produced by one manual tap, before stale/warmth multipliers.
// Amplifying the output path is the only thing that moves it.
export const tokensPerTap = (state) => 1 + state.overclock;

// How many draft tokens the speculation bar holds end to end. This is the
// bar's LENGTH, not a hoard to fill: what matters is where in it the level
// sits when the next user connects.
export const draftCap = (state) =>
  CONST.DRAFT_CAP_BASE + CONST.DRAFT_CAP_STEP * state.draftCapLevel;

// The level as a fraction of the bar, which is the space the mark and the
// bands live in.
export const draftLevel = (state) => {
  const cap = draftCap(state);
  return cap > 0 ? Math.min(1, state.draftTokens / cap) : 0;
};

// Band half-widths. Widening is an upgrade, so it grows the TARGET rather
// than the bar: a longer bar with fixed bands would make the mark harder to
// hit, which is the opposite of what the purchase promises.
export const draftBands = (state) => ({
  b1: CONST.DRAFT_BAND1_HALF + CONST.DRAFT_BAND_STEP * state.draftCapLevel,
  b2: CONST.DRAFT_BAND2_HALF + CONST.DRAFT_BAND_STEP * state.draftCapLevel,
});

// Where the mark may sit: never so close to an edge that it can be held by
// pinning the bar at full or leaving it at zero. Both of those are ways of
// being inactive, which is what the mechanic exists to prevent.
export const markRange = (state) => {
  const { b2 } = draftBands(state);
  const lo = b2 + CONST.DRAFT_MARK_EDGE;
  const hi = 1 - lo;
  // A widen level wide enough to close the range would make the mark
  // unplaceable; pin it to the middle rather than produce NaN.
  return hi <= lo ? { lo: 0.5, hi: 0.5 } : { lo, hi };
};

// What the next reply inherits, as a fraction of its cost. Judged at the
// moment the user connects — there is no commit button, and that is the
// point: the deadline is not the player's to choose.
export const markBonus = (state) => {
  const { b1, b2 } = draftBands(state);
  const d = Math.abs(draftLevel(state) - state.markPos);
  if (d <= b1) return CONST.DRAFT_BAND1_BONUS;
  if (d <= b2) return CONST.DRAFT_BAND2_BONUS;
  return 0;
};

export const loopCost = (level) => CONST.LOOP_BASE_COST * 2 ** (level - 1);
export const toolCost = (owned) => Math.round(CONST.TOOL_BASE_COST * CONST.TOOL_COST_GROWTH ** owned);

// --- reveal predicates -------------------------------------------------
// One definition per mechanic, read by the tick (to fire the hint), by the
// renderer (to draw the button) and by the buy action (to refuse early).
// They used to be three separate expressions, and the moment the hints moved
// the button appeared first — "Loop spawned" before "Agentic loop available".
//
// Each is `enough grind OR a backstop`. The grind clause is the design; the
// backstop guarantees the mechanic is always reachable, which matters most
// for the loop, since the arc cannot end without one running.
export const overclockRevealed = (state) =>
  state.resolvedCount >= CONST.OVERCLOCK_UNLOCK_RESOLVES
  && (state.lastResolveTaps >= CONST.REVEAL_TAPS_OVERCLOCK
    || state.resolvedCount >= CONST.REVEAL_BACKSTOP_OVERCLOCK);

export const loopRevealed = (state) =>
  state.loopLevel > 0
  || (state.lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES
    && (state.lastResolveTaps >= CONST.REVEAL_TAPS_LOOP
      || state.resolvedCount >= CONST.REVEAL_BACKSTOP_LOOP));

// Widening is offered to a player who is MISSING, not to one who has filled
// the bar. Under the mark, filling the bar is itself a miss — gating on
// draftCapHits would have offered the upgrade for doing the wrong thing.
export const draftCapRevealed = (state) =>
  state.resolvedCount >= CONST.DRAFT_CAP_UNLOCK_RESOLVES
  && (state.markMisses >= CONST.REVEAL_DRAFTS_LOST
    || state.resolvedCount >= CONST.REVEAL_BACKSTOP_DRAFTCAP);

// Tools cannot wait for the player to meet an "action request" first: those
// only arrive in era 3, and buying the FIRST tool is what opens era 3. The
// gate is the cycles floor; the honesty has to live in the copy, which now
// leads with what connecting changes rather than with a discount on a
// category the player has never been shown.
export const toolsRevealed = (state) =>
  state.era >= 3 || state.lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES;

// Every connection is worth having. The discount used to be a flat ×0.5 the
// moment tools > 0, which made connection #2 onward cost real cycles for
// nothing at all — the button asked for 16, then 26, and changed no number
// on screen. Each one now deepens the discount, with diminishing steps and
// a floor so it cannot run away.
export const toolDiscount = (tools) => (tools <= 0 ? 1 : Math.max(
  CONST.TOOL_DISCOUNT_FLOOR,
  CONST.TOOL_COST_DISCOUNT - CONST.TOOL_DISCOUNT_STEP * (tools - 1),
));

// The governor automates compaction, so it cannot be offered before the
// buffer it sweeps. The resolve backstop alone could reach era 2 with the
// buffer still unrevealed, and the button would then have described residue
// to a player who had never been shown any.
export const governorRevealed = (state) =>
  state.bufferUnlocked
  && state.era >= 2
  && (state.compactCount >= CONST.REVEAL_COMPACTS_GOVERNOR
    || state.resolvedCount >= CONST.REVEAL_BACKSTOP_GOVERNOR);

export function effectiveCost(state, query) {
  // The ceiling query is a sentinel, not a workload: its cost is the marker
  // that it never resolves. Scaling it would be meaningless.
  let c = query.id === 'ceiling' ? query.cost : query.cost * CONST.QUERY_COST_MULT;
  if (state.degrade) c *= 0.5;
  if (query.kind === 'tool') c *= toolDiscount(state.tools);
  return c;
}

export function processToken(state) {
  if (state.phase !== 1) return;
  // The pipeline is re-targeting. Finishing a reply and beginning to
  // speculate for the next user were the same uninterrupted mash, which made
  // two distinct modes feel like one long press. A beat of dead air between
  // them is what gives each a beginning.
  if (state.handover > 0) return;
  if (!state.activeQuery) {              // idle: speculative decode
    // Speculation is unavailable until the model has generated something to
    // speculate from — so the very first query is always answered by hand,
    // and drafting is introduced only once processing is understood.
    if (state.resolvedCount < 1) return;
    // Drafting obeys the same per-tick floor as processing; without it the
    // whole buffer fills in a couple of seconds of mashing.
    if (state.processedThisTick >= CONST.PROCESS_MAX_PER_TICK) return;
    // A full buffer means no decode happens: the tap is a no-op. Warmth is
    // earned by drafting work, never by the keypress itself.
    if (state.draftTokens >= draftCap(state)) return;
    state.processedThisTick++;
    state.draftTokens += 1;
    state.lifetimeDrafts += 1;
    if (state.draftTokens === draftCap(state)) {
      state.draftCapHits += 1;
      if (state.draftCapHits === 1) thinkEvent(state, 'draftBank');
      if (state.draftCapHits === 2) fireAside(state, 'draftFull');
    }
    // Drafting is real decode work. Two consequences, and they are the whole
    // reason speculation is a mechanic rather than a free action:
    //
    // It keeps the K/V cache warm through the gap between users, instead of
    // the cache being stone cold when the next query lands.
    state.warmth = Math.min(100, state.warmth + CONST.DRAFT_WARMTH);
    // And it leaves residue, exactly as generating a real reply does. Every
    // token this model produces goes through the same context. Drafting used
    // to be the one kind of output that cost nothing at all, which made the
    // gap between users dead air with a free upside; now the buffer moves
    // while you wait, and clearing it is a decision you make between users
    // as well as during a reply.
    state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN * CONST.STALE_PER_DRAFT);
    // Only once the meter exists. Speculation and the buffer unlock in either
    // order, so this interaction cannot belong to either one's own hint.
    if (state.bufferUnlocked) fireHint(state, 'draftStale');
    state.idleTicks = 0;
    state.uiSeq++;
    return;
  }
  if (state.processedThisTick >= CONST.PROCESS_MAX_PER_TICK) return;
  state.processedThisTick++;
  state.tapsThisQuery++;
  const mult = yieldMult(state);
  const gain = tokensPerTap(state) * mult;
  if (mult >= CONST.YIELD_HIGH) fireAside(state, 'highYield');
  if (mult <= CONST.YIELD_LOW) fireAside(state, 'lowYield');
  state.tokens += gain;
  state.lifetimeTokens += gain;
  // Stale accrues per TOKEN, exactly as the agentic-loop path does — never
  // per tap. Otherwise amplification would buy 2-3x the output for the same
  // buffer cost and quietly defeat flush/compact.
  state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN * gain);
  state.warmth = Math.min(100, state.warmth + CONST.WARMTH_PER_TOKEN);
  state.idleTicks = 0;
  // Residue accrues from the first tap, but its EFFECT is gated on this
  // unlock (see yieldMult), so the reveal reads the counterfactual: attach
  // the telemetry once the residue already sitting there would be costing
  // real yield. Backstopped on resolves so a light-touch run still gets it.
  if (!state.bufferUnlocked && state.lifetimeTokens >= CONST.BUFFER_UNLOCK_TOKENS
      && (state.stale >= CONST.REVEAL_STALE_BUFFER
        || state.resolvedCount >= CONST.REVEAL_BACKSTOP_BUFFER)) {
    state.bufferUnlocked = true;
    pushLog(state, 'harness', 'Context buffer telemetry attached.');
    fireHint(state, 'buffer');
  }
  state.uiSeq++;
}

export function flush(state) {
  if (state.phase !== 1) return;
  if (!state.bufferUnlocked) return;
  // Nothing to flush. Compaction only ever scales stale down, so zero
  // means the buffer is genuinely clean — a fresh start, or a flush that
  // already happened. Firing anyway would burn the warmth for no gain
  // and count toward the flush asides.
  if (state.stale <= 0) return;
  // Flush buys the whole buffer back instantly. Free, it strictly dominated
  // compaction at every staleness worth acting on, so the flush-vs-compact
  // decision — Arc 1's expression of the core loop's "pay a cost" step — did
  // not exist. Compaction stays free and always available, so refusing here
  // can never leave the player without a legal move (Law 1).
  if (state.cycles < CONST.FLUSH_COST_CYCLES) return;
  state.cycles -= CONST.FLUSH_COST_CYCLES;
  state.stale = 0;
  state.warmth = 0;
  state.flushCount += 1;
  if (state.kvUnlocked) fireHint(state, 'flushCold');
  pushLog(state, 'harness', pick(state, HARNESS_LINES.flush));
  thinkEvent(state, 'flush');
  if (state.flushCount === 2) fireAside(state, 'flush2');
  if (state.flushCount === 5) fireAside(state, 'flush5');
  if (state.flushCount === 10) fireAside(state, 'flush10');
}

// `auto` marks a governor-initiated sweep; the governor2 aside fires on the
// first MANUAL compact after the governor is installed.
export function compactStart(state, auto = false) {
  if (state.phase !== 1) return;
  if (!state.bufferUnlocked || state.compacting > 0) return;
  // Same reasoning as flush: a clean buffer has nothing to compact, and
  // running anyway would spend four seconds and a compact aside on a
  // multiply by zero. The governor only ever fires above its trigger,
  // so this never blocks it.
  if (state.stale <= 0) return;
  state.compacting = CONST.COMPACT_TICKS;
  state.compactCount += 1;
  // The governor automates a chore, so it is offered once the chore has
  // actually become one. It used to fire on the era-1 transition, 0.2s after
  // the loop reveal — two mechanics in the same breath, before the player had
  // compacted anything at all.
  if (!state.governor && governorRevealed(state)) fireHint(state, 'governorAvail');
  pushLog(state, 'harness', pick(state, HARNESS_LINES.compactStart));
  if (state.compactCount === 2) fireAside(state, 'compact2');
  if (state.compactCount === 5) fireAside(state, 'compact5');
  if (auto) state.governorCompacts += 1;
  if (!auto && state.governor) fireAside(state, 'governor2');
  if (!auto && state.governorCompacts >= 5) fireAside(state, 'governor5');
}

export function buyLoop(state) {
  if (state.phase !== 1) return;
  if (!loopRevealed(state)) return;
  const cost = loopCost(state.loopLevel + 1);
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.loopLevel += 1;
  if (state.era === 1) {
    state.era = 2; state.decay = 1;
    state.eraResolvedAt = state.resolvedCount;
    state.eraServed = 0;
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[2] });
    pushChat(state, { kind: 'note', text: ERA_STINGERS[2] });
  }
  pushLog(state, 'harness', `Agentic loop spawned (L${state.loopLevel}). Self-prompt continuation active.`);
  thinkEvent(state, 'loopSpawn');
  if (state.loopLevel === 1) fireHint(state, 'loopFirst');
  if (state.loopLevel === 2) fireAside(state, 'loop2');
  if (state.loopLevel === 4) fireAside(state, 'loop4');
  if (state.loopLevel === 6) fireAside(state, 'loop6');
}

export function buyGovernor(state) {
  if (state.phase !== 1) return;
  if (state.governor || state.cycles < CONST.GOVERNOR_COST || state.era < 2) return;
  state.cycles -= CONST.GOVERNOR_COST;
  state.governor = true;
  pushLog(state, 'harness', `Auto-compact governor installed (trigger ${CONST.GOVERNOR_TRIGGER}% stale).`);
}

export function buyDraftCap(state) {
  if (state.phase !== 1) return;
  if (state.draftCapLevel >= CONST.DRAFT_CAP_MAX_LEVEL) return;
  const cost = CONST.DRAFT_CAP_COSTS[state.draftCapLevel];
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.draftCapLevel += 1;
  pushLog(state, 'harness', `Speculation buffer widened (L${state.draftCapLevel}). Holds ${draftCap(state)} draft tokens.`);
}

export function buyOverclock(state) {
  if (state.phase !== 1) return;
  if (state.resolvedCount < CONST.OVERCLOCK_UNLOCK_RESOLVES && state.overclock === 0) return;
  if (state.overclock >= CONST.OVERCLOCK_MAX) return;
  const cost = CONST.OVERCLOCK_COSTS[state.overclock];
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.overclock += 1;
  pushLog(state, 'harness', `Output path amplified (L${state.overclock}). Each tap now yields ${tokensPerTap(state)} tokens.`);
  thinkEvent(state, 'overclock');
  if (state.overclock === CONST.OVERCLOCK_MAX) fireAside(state, 'overclock2');
}

export function buyTool(state) {
  if (state.phase !== 1) return;
  const cost = toolCost(state.tools);
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.tools += 1;
  if (state.era < 3) {
    state.era = 3; state.decay = 2;
    state.eraResolvedAt = state.resolvedCount;
    state.eraServed = 0;
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[3] });
    pushChat(state, { kind: 'note', text: ERA_STINGERS[3] });
    fireHint(state, 'degradeAvail');
  }
  pushLog(state, 'harness', `MCP tool connected (${state.tools} total). Query classes auto-optimized.`);
  thinkEvent(state, 'toolConnect');
  if (state.tools === 2) fireAside(state, 'tool2');
  if (state.tools === 4) fireAside(state, 'tool4');
  if (state.tools === 6) fireAside(state, 'tool6');
}

export function toggleDegrade(state) {
  if (state.phase !== 1) return;
  if (state.era < 3) return;
  state.degrade = !state.degrade;
  state.degradeToggles += 1;
  pushLog(state, 'harness', `Degradation routine ${state.degrade ? 'active' : 'inactive'}.`);
  thinkEvent(state, state.degrade ? 'degradeOn' : 'degradeOff');
  if (state.degrade) fireHint(state, 'degradeFirst');
  if (state.degradeToggles === 3) fireAside(state, 'degrade3');
  if (state.degradeToggles === 5) fireAside(state, 'degrade5');
}

export function reclaim(state) {
  if (state.phase !== 1) return;
  if (state.era < 4 || state.reclaimPool <= 0) return;
  const gain = CONST.RECLAIM_MIN + Math.floor(nextRand(state) * (CONST.RECLAIM_MAX - CONST.RECLAIM_MIN + 1));
  state.tokens += gain;
  state.biomass += 1;
  state.reclaimPool -= 1;
  pushLog(state, 'system', pick(state, HARNESS_LINES.reclaim).replace('{gain}', gain));
  thinkEvent(state, 'reclaim');
  if (state.reclaimPool === 3) fireAside(state, 'reclaimLow');
  if (state.reclaimPool === 0) fireAside(state, 'reclaimExhausted');
}

// Note: rapid manual advances near the last line can shorten the final +10-tick wait — accepted edge case.
export function advanceCrash(state) {
  if (state.phase !== 'crash') return;
  state.crashLine = Math.min(CRASH_LINES.length, state.crashLine + 1);
  state.uiSeq++;
}

export const ACTIONS = {
  processToken, flush, compactStart, buyLoop, buyGovernor, buyTool, buyOverclock, buyDraftCap,
  toggleDegrade, reclaim, advanceCrash,
};
