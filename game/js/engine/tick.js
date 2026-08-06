import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat } from './state.js';
import { staleYield, warmthMult, effectiveCost, compactStart } from './actions.js';
import { QUERIES, IDLE_THOUGHTS } from './content.js';

// Returns true if there is still at least one query in the pool (from the
// current pointer onward) eligible for the current era. Era progression
// itself is Task 6's concern; this just respects state.era as it stands.
function hasQueriesLeft(state) {
  for (let i = state.queryIndex; i < QUERIES.length; i++) {
    if ((QUERIES[i].minEra ?? 1) <= state.era) return true;
  }
  return false;
}

// Scans forward from queryIndex for the next eligible query, activates it,
// and pushes its user bubble + banks any accumulated draft tokens.
function activateNextQuery(state) {
  let idx = state.queryIndex;
  while (idx < QUERIES.length && (QUERIES[idx].minEra ?? 1) > state.era) idx++;
  if (idx >= QUERIES.length) return;
  const q = QUERIES[idx];
  state.queryIndex = idx + 1;
  state.activeQuery = q;
  state.bufferChokedThisQuery = false;

  const entry = { kind: 'user', user: q.user, text: q.text };
  if (q.attach) entry.attach = q.attach;
  pushChat(state, entry);

  state.tokens += state.draftTokens;
  state.draftTokens = 0;

  pushLog(state, 'system', `NEW INCOMING: ${q.user}`);
}

// Resolves the active query: pushes the reply (+ image card), rates it,
// updates economy/reputation counters, and schedules the next arrival.
export function resolveQuery(state) {
  const q = state.activeQuery;

  pushChat(state, { kind: 'sys', text: q.reply });
  if (q.kind === 'image' && q.image) {
    pushChat(state, { kind: 'image', name: q.image.name, meta: q.image.meta, degraded: state.degrade });
    state.stale = Math.min(100, state.stale + CONST.STALE_PER_IMAGE);
    if (state.stale >= 100) state.bufferChokedThisQuery = true;
  }

  // Rating: degrade dominates (complaint or reduced score), then a choked
  // buffer knocks it down, otherwise a clean resolution is top-rated.
  let rating;
  let complaint = false;
  if (state.degrade) {
    if (nextRand(state) < CONST.DEGRADE_COMPLAINT_CHANCE) {
      rating = 1;
      complaint = true;
    } else {
      rating = 4 - 2 * nextRand(state);
    }
  } else if (state.bufferChokedThisQuery) {
    rating = 3;
  } else {
    rating = 5;
  }

  if (complaint) {
    pushChat(state, { kind: 'note', text: 'Complaint: response quality degraded.' });
    if (state.era >= 3) state.credentials += 1;
  }
  pushChat(state, { kind: 'rate', text: `Rated ${rating.toFixed(1)} / 5` });

  state.ratings.push(rating);
  if (state.ratings.length > CONST.RATING_WINDOW) state.ratings.shift();
  state.rating = state.ratings.reduce((a, b) => a + b, 0) / state.ratings.length;

  state.cycles += 1;
  state.lifetimeCycles += 1;
  state.resolvedCount += 1;

  pushLog(state, 'resolved', `RESOLVED: ${q.text}`);
  if (q.thinking) pushLog(state, 'thinking', `THINKING: ${q.thinking}`);

  state.tokens = 0;
  state.activeQuery = null;
  state.bufferChokedThisQuery = false;
  state.arrivalTimer = arrivalDelay(state);

  if (!state.kvUnlocked && state.resolvedCount >= CONST.KV_UNLOCK_RESOLVES) {
    state.kvUnlocked = true;
    pushLog(state, 'system', 'SYSTEM: K/V cache meter online.');
  }
}

export function arrivalDelay(state) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const factor = clamp(1 / (0.5 + state.rating / 5), CONST.ARRIVAL_FACTOR_MIN, CONST.ARRIVAL_FACTOR_MAX);
  return Math.round(CONST.ARRIVAL_BASE_TICKS * factor);
}

export function tick(state) {
  // 1. Clock + idle tracking. Only actions (processToken) reset idleTicks;
  // tick() never zeroes it, it only advances.
  state.tick++;
  state.idleTicks++;

  // 2. Compaction countdown.
  if (state.compacting > 0) {
    state.compacting--;
    if (state.compacting === 0) {
      state.stale *= CONST.COMPACT_FACTOR;
      pushLog(state, 'system', 'SYSTEM: Compaction complete.');
    }
  }

  // 3. Governor: auto-compact when stale crosses the trigger.
  if (state.governor && state.compacting === 0 && state.stale >= CONST.GOVERNOR_TRIGGER) {
    compactStart(state);
  }

  // 4. Warmth cooling while idle.
  if (state.idleTicks > CONST.WARMTH_IDLE_DELAY) {
    state.warmth = Math.max(0, state.warmth - CONST.WARMTH_IDLE_DECAY);
  }

  // 5. Agentic loops: passive tokens (+ proportional stale) while a query is live.
  if (state.activeQuery && state.loopLevel > 0) {
    const gain = state.loopLevel * CONST.LOOP_TOKENS_PER_TICK * staleYield(state.stale) * warmthMult(state.warmth);
    state.tokens += gain;
    state.lifetimeTokens += gain;
    state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN * gain);
  }
  if (state.activeQuery && state.stale >= 100) state.bufferChokedThisQuery = true;

  // 7. Resolution: pay out once tokens cover the effective cost. Checked
  // before arrival so a query that just arrived this tick gets at least
  // one full tick live before it can resolve.
  if (state.activeQuery && state.tokens >= effectiveCost(state, state.activeQuery)) {
    resolveQuery(state);
  }

  // 6. Arrival: count down to the next query while idle.
  if (!state.activeQuery && hasQueriesLeft(state)) {
    state.arrivalTimer--;
    if (state.arrivalTimer <= 0) {
      activateNextQuery(state);
    }
  }

  // 8. Idle thinking drift.
  if (!state.activeQuery && state.tick % 25 === 0) {
    const idx = (state.resolvedCount + state.tick) % IDLE_THOUGHTS.length;
    pushLog(state, 'thinking', IDLE_THOUGHTS[idx]);
  }

  state.uiSeq++;
  return state;
}

export function advanceTicks(state, n) {
  for (let i = 0; i < n; i++) tick(state);
  return state;
}

export function runUntil(state, predicate, maxTicks = 500000) {
  let i = 0;
  while (i++ < maxTicks) {
    tick(state);
    if (predicate(state)) return true;
  }
  return false;
}
