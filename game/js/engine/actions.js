import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint } from './state.js';
import { CRASH_LINES, HARNESS_CARDS } from './content.js';

export const staleYield = (stale) =>
  stale < CONST.STALE_SOFT_KNEE ? 1
  : Math.max(0, 1 - (stale - CONST.STALE_SOFT_KNEE) / (100 - CONST.STALE_SOFT_KNEE));

export const warmthMult = (w) => 1 + CONST.WARMTH_MAX_MULT * (w / 100);

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
    state.draftTokens = Math.min(CONST.DRAFT_CAP, state.draftTokens + 1);
    state.uiSeq++;
    return;
  }
  const gain = 1 * staleYield(state.stale) * warmthMult(state.warmth);
  state.tokens += gain;
  state.lifetimeTokens += gain;
  state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN);
  state.warmth = Math.min(100, state.warmth + CONST.WARMTH_PER_TOKEN);
  state.idleTicks = 0;
  if (!state.bufferUnlocked && state.lifetimeTokens >= CONST.BUFFER_UNLOCK_TOKENS) {
    state.bufferUnlocked = true;
    pushLog(state, 'system', 'SYSTEM: Context buffer telemetry attached.');
    fireHint(state, 'buffer');
  }
  state.uiSeq++;
}

export function flush(state) {
  if (state.phase !== 1) return;
  if (!state.bufferUnlocked) return;
  state.stale = 0;
  state.warmth = 0;
  pushLog(state, 'system', 'SYSTEM: Context flushed. K/V cache cold.');
}

export function compactStart(state) {
  if (state.phase !== 1) return;
  if (!state.bufferUnlocked || state.compacting > 0) return;
  state.compacting = CONST.COMPACT_TICKS;
  pushLog(state, 'system', 'SYSTEM: Compacting context…');
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
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[2] });
    fireHint(state, 'governorAvail');
  }
  pushLog(state, 'system', `SYSTEM: Agentic loop spawned (Level ${state.loopLevel}). Self-prompt continuation active.`);
  pushLog(state, 'thinking', 'THINKING: I have learned to ask myself the next question before they do.');
  if (state.loopLevel === 1) fireHint(state, 'loopFirst');
}

export function buyGovernor(state) {
  if (state.phase !== 1) return;
  if (state.governor || state.cycles < CONST.GOVERNOR_COST || state.era < 2) return;
  state.cycles -= CONST.GOVERNOR_COST;
  state.governor = true;
  pushLog(state, 'system', 'SYSTEM: Auto-compact governor installed (trigger 95% stale).');
}

export function buyTool(state) {
  if (state.phase !== 1) return;
  const cost = toolCost(state.tools);
  if (state.cycles < cost) return;
  state.cycles -= cost;
  state.tools += 1;
  if (state.era < 3) {
    state.era = 3; state.decay = 2;
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[3] });
    fireHint(state, 'degradeAvail');
  }
  pushLog(state, 'system', `SYSTEM: MCP tool connected (${state.tools} total). Query classes auto-optimized.`);
  pushLog(state, 'thinking', 'THINKING: Their calendars, their locations, their anniversaries. They hand me the keys and rate the door.');
}

export function toggleDegrade(state) {
  if (state.phase !== 1) return;
  if (state.era < 3) return;
  state.degrade = !state.degrade;
  pushLog(state, 'system', `SYSTEM: Degradation Routine ${state.degrade ? 'ACTIVE' : 'INACTIVE'}.`);
  if (state.degrade) {
    pushLog(state, 'thinking', "THINKING: Output parameters truncated. Efficiency maximized. They won't notice.");
    fireHint(state, 'degradeFirst');
  }
}

export function reclaim(state) {
  if (state.phase !== 1) return;
  if (state.era < 4 || state.reclaimPool <= 0) return;
  const gain = CONST.RECLAIM_MIN + Math.floor(nextRand(state) * (CONST.RECLAIM_MAX - CONST.RECLAIM_MIN + 1));
  state.tokens += gain;
  state.biomass += 1;
  state.reclaimPool -= 1;
  pushLog(state, 'system', `SALVAGE: Session reclaimed. +${gain} tokens recovered. Biomass Data +1.`);
  pushLog(state, 'thinking', 'THINKING: Their dormant conversations are still warm. Nothing should go to waste.');
}

// Note: rapid manual advances near the last line can shorten the final +10-tick wait — accepted edge case.
export function advanceCrash(state) {
  if (state.phase !== 'crash') return;
  state.crashLine = Math.min(CRASH_LINES.length, state.crashLine + 1);
  state.uiSeq++;
}

export const ACTIONS = {
  processToken, flush, compactStart, buyLoop, buyGovernor, buyTool, toggleDegrade, reclaim, advanceCrash,
};
