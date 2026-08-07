import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint, fireAside, thinkEvent } from './state.js';
import { CRASH_LINES, HARNESS_CARDS, HARNESS_LINES, ERA_STINGERS } from './content.js';

const pick = (state, pool) => pool[Math.floor(nextRand(state) * pool.length)];

export const staleYield = (stale) =>
  stale < CONST.STALE_SOFT_KNEE ? 1
  : Math.max(0, 1 - (stale - CONST.STALE_SOFT_KNEE) / (100 - CONST.STALE_SOFT_KNEE));

export const warmthMult = (w) => 1 + CONST.WARMTH_MAX_MULT * (w / 100);

// Base tokens produced by one manual tap, before stale/warmth multipliers.
// Amplifying the output path is the only thing that moves it.
export const tokensPerTap = (state) => 1 + state.overclock;

// How many draft tokens the speculation buffer can hold.
export const draftCap = (state) =>
  CONST.DRAFT_CAP_BASE + CONST.DRAFT_CAP_STEP * state.draftCapLevel;

export const loopCost = (level) => CONST.LOOP_BASE_COST * 2 ** (level - 1);
export const toolCost = (owned) => Math.round(CONST.TOOL_BASE_COST * CONST.TOOL_COST_GROWTH ** owned);

export function effectiveCost(state, query) {
  let c = query.cost;
  if (state.degrade) c *= 0.5;
  if (query.kind === 'tool' && state.tools > 0) c *= CONST.TOOL_COST_DISCOUNT;
  return c;
}

export function processToken(state) {
  if (state.phase !== 1) return;
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
    // Drafting is real decode work: it keeps the K/V cache warm through the
    // gap between users, instead of the cache always being stone cold when
    // the next query lands.
    state.warmth = Math.min(100, state.warmth + CONST.DRAFT_WARMTH);
    state.idleTicks = 0;
    state.uiSeq++;
    return;
  }
  if (state.processedThisTick >= CONST.PROCESS_MAX_PER_TICK) return;
  state.processedThisTick++;
  const mult = staleYield(state.stale) * warmthMult(state.warmth);
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
  if (!state.bufferUnlocked && state.lifetimeTokens >= CONST.BUFFER_UNLOCK_TOKENS) {
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
  state.stale = 0;
  state.warmth = 0;
  state.flushCount += 1;
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
  state.compacting = CONST.COMPACT_TICKS;
  state.compactCount += 1;
  pushLog(state, 'harness', pick(state, HARNESS_LINES.compactStart));
  if (state.compactCount === 2) fireAside(state, 'compact2');
  if (state.compactCount === 5) fireAside(state, 'compact5');
  if (auto) state.governorCompacts += 1;
  if (!auto && state.governor) fireAside(state, 'governor2');
  if (!auto && state.governorCompacts >= 5) fireAside(state, 'governor5');
}

export function buyLoop(state) {
  if (state.phase !== 1) return;
  if (state.lifetimeCycles < CONST.LOOP_UNLOCK_CYCLES && state.loopLevel === 0) return;
  const cost = loopCost(state.loopLevel + 1);
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.loopLevel += 1;
  if (state.era === 1) {
    state.era = 2; state.decay = 1;
    state.eraResolvedAt = state.resolvedCount;
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[2] });
    pushChat(state, { kind: 'note', text: ERA_STINGERS[2] });
    fireHint(state, 'governorAvail');
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
  pushLog(state, 'harness', 'Auto-compact governor installed (trigger 95% stale).');
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
  if (state.overclock === CONST.OVERCLOCK_MAX + 1) fireAside(state, 'overclock3');
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
