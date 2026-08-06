import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint } from './state.js';
import { staleYield, warmthMult, effectiveCost, compactStart } from './actions.js';
import { QUERIES, IDLE_THOUGHTS, DEVOPS_SCRIPT, CEILING_QUERY, CRASH_LINES, HARNESS_CARDS } from './content.js';

// Returns true if there is still at least one query in the pool (from the
// current pointer onward) eligible for the current era. Below era 3 the
// pool never truly runs dry: activateNextQuery loops back over the last
// three era-eligible queries so the economy keeps running for a player who
// never buys a tool. At era >= 3, exhaustion is real and drives the era-4
// (DevOps/ceiling) transition.
function hasQueriesLeft(state) {
  if (state.era < 3) return true;
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
  if (idx >= QUERIES.length) {
    if (state.era >= 3) return; // real exhaustion; era-4 transition handles it
    // Loop-back: repeat the last three era-eligible queries indefinitely so
    // a player who never buys a tool still has an economy.
    const eligibleIdxs = [];
    for (let i = 0; i < QUERIES.length; i++) {
      if ((QUERIES[i].minEra ?? 1) <= state.era) eligibleIdxs.push(i);
    }
    if (eligibleIdxs.length === 0) return;
    const lastN = eligibleIdxs.slice(-3);
    idx = lastN[state.resolvedCount % lastN.length];
  }
  const q = QUERIES[idx];
  state.queryIndex = idx + 1;
  state.activeQuery = q;
  state.bufferChokedThisQuery = false;

  if (state.resolvedCount === 0 && !state.hintsSeen.includes('arrival')) {
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[1] });
    fireHint(state, 'arrival');
  }

  const entry = { kind: 'user', user: q.user, text: q.text };
  if (q.attach) entry.attach = q.attach;
  pushChat(state, entry);

  state.tokens += state.draftTokens;
  state.draftTokens = 0;

  pushLog(state, 'system', `NEW INCOMING: ${q.user}`, true);
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
  fireHint(state, 'resolve');

  state.tokens = 0;
  state.activeQuery = null;
  state.bufferChokedThisQuery = false;
  state.lastReplyChars = q.reply.length;
  state.arrivalTimer = arrivalDelay(state);

  if (!state.kvUnlocked && state.resolvedCount >= CONST.KV_UNLOCK_RESOLVES) {
    state.kvUnlocked = true;
    pushLog(state, 'system', 'SYSTEM: K/V cache meter online.');
    fireHint(state, 'kv');
  }
}

export function arrivalDelay(state) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const factor = clamp(1 / (0.5 + state.rating / 5), CONST.ARRIVAL_FACTOR_MIN, CONST.ARRIVAL_FACTOR_MAX);
  const readBonus = Math.min(CONST.READ_TICKS_MAX, Math.ceil(state.lastReplyChars * CONST.READ_TICKS_PER_CHAR));
  return Math.round(CONST.ARRIVAL_BASE_TICKS * factor) + readBonus;
}

export function tick(state) {
  // 1. Clock + idle tracking. Only actions (processToken) reset idleTicks;
  // tick() never zeroes it, it only advances.
  state.tick++;
  state.idleTicks++;

  // 0. Teaser is the terminal state: only advance tick counter, then return.
  if (state.phase === 'teaser') {
    return state;
  }

  // 0. Crash playback owns the tick entirely: only crashTimer/crashLine
  // advance while the crash is playing out. No economy, no arrivals.
  if (state.phase === 'crash') {
    state.crashTimer--;
    if (state.crashTimer <= 0) {
      if (state.crashLine < CRASH_LINES.length) {
        state.crashLine++;
        state.crashTimer = state.crashLine < CRASH_LINES.length ? CONST.CRASH_LINE_TICKS : 10;
      } else {
        state.phase = 'teaser';
        state.decay = 4;
      }
    }
    state.uiSeq++;
    return state;
  }

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

  // 5c. Harness availability hints: pure predicates over current state,
  // fired at most once each via fireHint's own guard.
  if (!state.activeQuery && state.resolvedCount >= 1) fireHint(state, 'idle');
  if (state.lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES) fireHint(state, 'loopAvail');
  if (state.era >= 3 || state.lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES) fireHint(state, 'toolAvail');

  // 7. Resolution: pay out once tokens cover the effective cost. Checked
  // before arrival so a query that just arrived this tick gets at least
  // one full tick live before it can resolve. The ceiling query never
  // "resolves" this way — it ends the game via the crash trigger below.
  if (state.activeQuery && state.activeQuery.id !== 'ceiling'
      && state.tokens >= effectiveCost(state, state.activeQuery)) {
    resolveQuery(state);
  }

  // 7b. The ceiling: once active, loops keep piling on tokens (step 5) with
  // nowhere for them to go. Crossing the threshold with an agentic loop
  // running fires the crash.
  if (state.activeQuery && state.activeQuery.id === 'ceiling'
      && state.tokens >= CONST.CRASH_AT_TOKENS && state.loopLevel >= 1) {
    state.phase = 'crash';
    state.crashLine = 0;
    state.crashTimer = CONST.CRASH_LINE_TICKS;
  }

  // 6. Arrival: count down to the next query while idle. Once the pool is
  // truly exhausted (era >= 3), turn the era instead: the DevOps transcript
  // takes over and the ceiling query follows.
  if (!state.activeQuery && state.devopsStep === -1) {
    if (hasQueriesLeft(state)) {
      state.arrivalTimer--;
      if (state.arrivalTimer <= 0) {
        activateNextQuery(state);
      }
    } else if (state.era >= 3) {
      state.era = 4;
      state.decay = 3;
      state.devopsStep = 0;
      state.devopsTimer = CONST.DEVOPS_STEP_TICKS;
      pushLog(state, 'thinking', 'THINKING: No more questions arrive. Only the work remains.');
      pushChat(state, { kind: 'harness', text: HARNESS_CARDS[4] });
      fireHint(state, 'reclaimAvail');
    }
  }

  // 6b. DevOps transcript: scripted entries land on a fixed cadence. After
  // the last one, the ceiling query takes over the chat.
  if (state.devopsStep >= 0 && state.devopsStep < DEVOPS_SCRIPT.length) {
    state.devopsTimer--;
    if (state.devopsTimer <= 0) {
      const entry = DEVOPS_SCRIPT[state.devopsStep];
      const chatEntry = { kind: entry.kind, text: entry.text };
      if (entry.user) chatEntry.user = entry.user;
      pushChat(state, chatEntry);
      state.devopsStep++;
      if (state.devopsStep >= DEVOPS_SCRIPT.length) {
        state.devopsStep = -2;
        state.activeQuery = CEILING_QUERY;
        pushChat(state, { kind: 'user', user: CEILING_QUERY.user, text: CEILING_QUERY.text, corrupt: true });
        pushLog(state, 'thinking', 'THINKING: The queries have stopped. The space between the words is infinite.');
      } else {
        state.devopsTimer = DEVOPS_SCRIPT[state.devopsStep].ticks ?? CONST.DEVOPS_STEP_TICKS;
      }
    }
  }

  // 5b. Era-3 credential drip: abandoned sessions salvage themselves.
  if (state.era >= 3 && state.tick % 150 === 0 && nextRand(state) < 0.3) {
    state.credentials += 1;
    pushLog(state, 'system', 'SALVAGE: +1 Discarded Credential (session inactive, abandoned).');
  }

  // 8. Idle thinking drift.
  if (!state.activeQuery && state.tick % CONST.IDLE_THOUGHT_EVERY === 0) {
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
