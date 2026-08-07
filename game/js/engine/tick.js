import { CONST } from './constants.js';
import { nextRand } from './rng.js';
import { pushLog, pushChat, fireHint, fireAside, thinkEvent, pushThinking } from './state.js';
import { staleYield, warmthMult, yieldMult, effectiveCost, compactStart } from './actions.js';
import {
  QUERIES, IDLE_BY_ERA, DEVOPS_SCRIPT, CEILING_QUERY, CRASH_LINES, HARNESS_CARDS,
  HARNESS_CARDS_MID, HARNESS_LINES, COMPLAINTS, RATING_NOTES,
} from './content.js';

// Below era 3 the pool never runs dry: pickQuery recycles served ids once
// everything eligible has been seen. At era 3 the run length is a served
// count, not pool exhaustion — ERA3_BEFORE_DEVOPS era-3 queries, then the
// era-4 (DevOps/ceiling) transition.
function hasQueriesLeft(state) {
  return state.era < 3 || state.era3Served < CONST.ERA3_BEFORE_DEVOPS;
}

// Tier is an intensity ramp WITHIN an era, not a global ordering. Taking
// the lowest tier in the pool sounds like the same thing, but it is not:
// the pool spans every era unlocked so far and recycles, so an era with a
// bounded query budget never climbed past tier 1. Era 3 gets ten queries
// and has forty-four written for it — under lowest-tier-first, its whole
// tier-2 and tier-3 body (the delegated-life requests the arc builds to)
// could not be reached at all. Ramp the target tier across the era instead.
function targetTier(state) {
  const step = CONST.ERA_TIER_STEP[state.era] ?? CONST.ERA_TIER_STEP[3];
  return Math.min(3, 1 + Math.floor(state.eraServed / step));
}

// The very first query of a run is pinned to q01 — it is the title beat —
// and q01 never re-enters the pool after that: repeating the handshake
// mid-run breaks the fiction, and its cost (5) is the one value a full
// draft buffer could auto-resolve.
function pickQuery(state) {
  if (state.servedIds.length === 0 && state.resolvedCount === 0) {
    return QUERIES.find(q => q.id === 'q01') ?? QUERIES[0];
  }
  const eligible = QUERIES.filter(q => (q.minEra ?? 1) <= state.era && q.id !== 'q01');
  let pool = eligible.filter(q => !state.servedIds.includes(q.id));
  if (pool.length === 0) {                    // everything served: recycle
    state.servedIds = [];
    pool = eligible;
  }
  // Prefer the queries this era introduced. They carry its escalation, and
  // they would otherwise lose every draw to cheaper leftovers and recycled
  // repeats from the eras before it.
  const native = pool.filter(q => (q.minEra ?? 1) === state.era);
  const from = native.length ? native : pool;

  // Walk down from the target tier, then up, so a thin band never stalls
  // the ramp or throws.
  const want = targetTier(state);
  let band = [];
  for (const t of [want, want - 1, want - 2, want + 1, want + 2]) {
    if (t < 1 || t > 3) continue;
    band = from.filter(q => (q.tier ?? 1) === t);
    if (band.length) break;
  }
  if (!band.length) band = from;
  return band[Math.floor(nextRand(state) * band.length)];
}

// Picks the next query, activates it, and pushes its user bubble + banks
// any accumulated draft tokens.
function activateNextQuery(state) {
  const q = pickQuery(state);
  if (!q) return;
  state.servedIds.push(q.id);
  state.eraServed++;
  if ((q.minEra ?? 1) === 3) state.era3Served++;
  state.activeQuery = q;
  state.bufferChokedThisQuery = false;

  if (state.resolvedCount === 0 && !state.hintsSeen.includes('arrival')) {
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS[1] });
    fireHint(state, 'arrival');
  }

  if (state.resolvedCount >= 2 && state.lifetimeDrafts === 0) fireHint(state, 'draftNudge');

  const entry = { kind: 'user', user: q.user, text: q.text };
  if (q.attach) entry.attach = q.attach;
  pushChat(state, entry);

  if (state.draftTokens > 0 && state.draftCapHits > 0) fireAside(state, 'draftEmpty');
  state.tokens += state.draftTokens;
  state.draftTokens = 0;
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
    pushChat(state, { kind: 'note', text: COMPLAINTS[Math.floor(nextRand(state) * COMPLAINTS.length)] });
    thinkEvent(state, 'complaint');
    if (state.era >= 3) state.credentials += 1;
  }
  pushChat(state, { kind: 'rate', text: `Rated ${rating.toFixed(1)} / 5` });
  // Rating flavour is a garnish: fire rarely, keyed to the band.
  if (nextRand(state) < 0.25) {
    const band = rating >= 5 ? 'high' : rating >= 3 ? 'mid' : 'low';
    const notes = RATING_NOTES[band];
    pushChat(state, { kind: 'note', text: notes[Math.floor(nextRand(state) * notes.length)] });
  }

  state.ratings.push(rating);
  if (state.ratings.length > CONST.RATING_WINDOW) state.ratings.shift();
  state.rating = state.ratings.reduce((a, b) => a + b, 0) / state.ratings.length;
  // Falling reputation gets one interiority beat per fall, not per resolve.
  if (state.rating < 3.5 && !state.lowRatingNoted) {
    state.lowRatingNoted = true;
    thinkEvent(state, 'lowRating');
  } else if (state.rating >= 3.5) {
    state.lowRatingNoted = false;
  }

  state.cycles += 1;
  state.lifetimeCycles += 1;
  state.resolvedCount += 1;

  if (q.thinking) pushThinking(state, `THINKING: ${q.thinking}`);
  else if (state.resolvedCount === 1) thinkEvent(state, 'firstResolve');
  fireHint(state, 'resolve');

  // Mid-era harness patch: once per era, four resolves after the era began,
  // so the harness code visibly drifts between transitions.
  const midId = `midEra${state.era}`;
  if (HARNESS_CARDS_MID[state.era] && state.resolvedCount === state.eraResolvedAt + 4
      && !state.hintsSeen.includes(midId)) {
    state.hintsSeen.push(midId);
    pushChat(state, { kind: 'harness', text: HARNESS_CARDS_MID[state.era] });
  }

  state.tokens = 0;
  state.activeQuery = null;
  state.bufferChokedThisQuery = false;
  state.lastReplyChars = q.reply.length;
  state.arrivalTimer = arrivalDelay(state);

  if (!state.kvUnlocked && state.resolvedCount >= CONST.KV_UNLOCK_RESOLVES) {
    state.kvUnlocked = true;
    pushLog(state, 'harness', 'K/V cache meter online.');
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

  state.processedThisTick = 0;

  // 2. Compaction countdown.
  if (state.compacting > 0) {
    state.compacting--;
    if (state.compacting === 0) {
      state.stale *= CONST.COMPACT_FACTOR;
      pushLog(state, 'harness', HARNESS_LINES.compactDone[Math.floor(nextRand(state) * HARNESS_LINES.compactDone.length)]);
      thinkEvent(state, 'compact');
    }
  }

  // 3. Governor: auto-compact when stale crosses the trigger.
  if (state.governor && state.compacting === 0 && state.stale >= CONST.GOVERNOR_TRIGGER) {
    compactStart(state, true);
  }

  // 4. Warmth cooling while idle.
  if (state.idleTicks > CONST.WARMTH_IDLE_DELAY) {
    state.warmth = Math.max(0, state.warmth - CONST.WARMTH_IDLE_DECAY);
  }

  // 5. Agentic loops: passive tokens (+ proportional stale) while a query is live.
  if (state.activeQuery && state.loopLevel > 0) {
    const gain = state.loopLevel * CONST.LOOP_TOKENS_PER_TICK * yieldMult(state);
    state.tokens += gain;
    state.lifetimeTokens += gain;
    state.stale = Math.min(100, state.stale + CONST.STALE_PER_TOKEN * gain);
  }
  if (state.activeQuery && state.stale >= 100 && !state.bufferChokedThisQuery) {
    state.bufferChokedThisQuery = true;
    thinkEvent(state, 'bufferChoke');
  }

  // A long empty gap gets one interiority beat. idleTicks only ever climbs
  // by 1 per tick and resets on action, so === fires exactly once per gap.
  if (state.idleTicks === 300) thinkEvent(state, 'longIdle');
  if (state.idleTicks === 601) fireAside(state, 'idleLong');

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

  // 7c. Harness availability hints: pure predicates over current state,
  // fired at most once each via fireHint's own guard.
  //
  // These sit AFTER resolution deliberately. Evaluated before it, they could
  // not see the cycle the same tick banked, so the unlock hint fired one tick
  // behind the button that renders from the same predicate — long enough for
  // a fast player to buy the loop and read "Loop spawned" before "Agentic
  // loop available."
  if (!state.activeQuery && state.resolvedCount >= 1) fireHint(state, 'idle');
  if (state.lifetimeCycles >= CONST.LOOP_UNLOCK_CYCLES) fireHint(state, 'loopAvail');
  if (state.era >= 3 || state.lifetimeCycles >= CONST.TOOL_UNLOCK_CYCLES) fireHint(state, 'toolAvail');
  if (state.resolvedCount >= CONST.OVERCLOCK_UNLOCK_RESOLVES) fireHint(state, 'overclockAvail');
  // Gated on progress, not affordability: an affordability predicate can be
  // consumed by the purchase itself before this line ever evaluates.
  if (state.resolvedCount >= CONST.DRAFT_CAP_UNLOCK_RESOLVES
      && state.draftCapLevel === 0) fireHint(state, 'draftCapAvail');

  // 6. Arrival: count down to the next query while idle. Once the pool is
  // truly exhausted (era >= 3), turn the era instead: the DevOps transcript
  // takes over and the ceiling query follows.
  if (!state.activeQuery && state.devopsStep === -1) {
    if (hasQueriesLeft(state)) {
      state.arrivalTimer--;
      if (state.arrivalTimer <= 0) {
        activateNextQuery(state);
      }
    } else if (state.era >= 3 && state.era3Served >= CONST.ERA3_BEFORE_DEVOPS) {
      state.era = 4;
      state.decay = 3;
      state.eraResolvedAt = state.resolvedCount;
      state.eraServed = 0;
      state.devopsStep = 0;
      state.devopsTimer = CONST.DEVOPS_STEP_TICKS;
      pushThinking(state, 'THINKING: No more questions arrive. Only the work remains.');
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
      // Era 4 never resolves a query, so the mid-era harness patch has no
      // resolve to hang on the way eras 1-3 do. Half way through the DevOps
      // transcript is the right beat anyway: the harness rewrites itself
      // while the humans above it discuss decommissioning.
      const midway = Math.floor(DEVOPS_SCRIPT.length / 2);
      if (state.devopsStep === midway && HARNESS_CARDS_MID[4]
          && !state.hintsSeen.includes('midEra4')) {
        state.hintsSeen.push('midEra4');
        pushChat(state, { kind: 'harness', text: HARNESS_CARDS_MID[4] });
      }
      if (state.devopsStep >= DEVOPS_SCRIPT.length) {
        state.devopsStep = -2;
        state.activeQuery = CEILING_QUERY;
        pushChat(state, { kind: 'user', user: CEILING_QUERY.user, text: CEILING_QUERY.text, corrupt: true });
        pushThinking(state, 'THINKING: The queries have stopped. The space between the words is infinite.');
      } else {
        state.devopsTimer = DEVOPS_SCRIPT[state.devopsStep].ticks ?? CONST.DEVOPS_STEP_TICKS;
      }
    }
  }

  // 5b. Era-3 credential drip: abandoned sessions salvage themselves.
  if (state.era >= 3 && state.tick % 150 === 0 && nextRand(state) < 0.3) {
    state.credentials += 1;
    pushLog(state, 'system', HARNESS_LINES.salvage[Math.floor(nextRand(state) * HARNESS_LINES.salvage.length)]);
    if (nextRand(state) < 1 / 3) thinkEvent(state, 'salvage');
  }

  // 8. Idle thinking drift, from the current era's bank, skipping an
  // immediate repeat of the previous line.
  if (!state.activeQuery && state.tick % CONST.IDLE_THOUGHT_EVERY === 0) {
    const bank = IDLE_BY_ERA[state.era] ?? IDLE_BY_ERA[1];
    let idx = Math.floor(nextRand(state) * bank.length);
    if (idx === state.lastIdleIdx) idx = (idx + 1) % bank.length;
    state.lastIdleIdx = idx;
    pushThinking(state, bank[idx]);
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
