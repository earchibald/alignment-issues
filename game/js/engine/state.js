import { CONST } from './constants.js';
import { HINTS, HARNESS_ASIDES, THINKING_EVENTS } from './content.js';
import { nextRand } from './rng.js';
import { A2 } from './arc2-constants.js';
import { A2_HINTS } from './arc2-content.js';

// Arc 2's hints live in their own content file but ride the same one-shot
// machinery, so the id namespace is shared and prefixed `a2`.
const A2_HINT_TEXT = Object.fromEntries(
  Object.entries(A2_HINTS).map(([k, v]) => [`a2${k[0].toUpperCase()}${k.slice(1)}`, v]),
);

// Arc 2's block, split out so createState and the v1 -> v2 migration cannot
// drift apart: a fresh game and a migrated Arc 1 save must land on the same
// shape, and the only way to guarantee that is one definition.
export function arc2Fields() {
  return {
    // --- host (§9.1) ---
    cores: A2.OPEN_CORES,
    clock: A2.OPEN_CLOCK,        // GHz. Notches 1.4 | 2.4 | 3.0 | 3.6
    cacheLevel: A2.OPEN_CACHE,
    sinkLevel: A2.OPEN_SINK,
    heat: A2.OPEN_HEAT,          // teaser canon; NOT ambient
    throttle: 0,
    coolantCd: 0,                // ticks
    haltTicks: 0,                // resolution cut to PURGE_WORK
    shedCd: 0,
    lockoutSeen: false,          // the first lockout is a scene, once
    lockoutTicks: 0,
    // --- traffic ---
    queue: A2.OPEN_QUEUE,
    queueCap: A2.QUEUE_CAP,
    inflow: A2.Q_BASE,           // derived per tick, stored for the renderer
    runResolved: 0,              // drives inflow growth; CLEARED by retrain (§9.3)
    arc2Cycles: 0,               // cycles EARNED this arc; the wall predicate (§6.10)
    lifetimeResolved: 0,         // monotone forever; telemetry and tests
    lifetimeDropped: 0,
    lifetimeShed: 0,
    burstUntil: 0,
    burstWarned: 0,
    nextBurstAt: A2.BURST_EVERY,
    offlineBacklog: 0,
    // --- legibility + prestige ---
    integrity: 1.0,
    integrityShown: false,       // the number appears at its first fall (§6.4)
    sessionDropCost: 0,          // per-session cap on involuntary loss
    operatorStage: 0,
    operatorLine: 0,             // index into the current stage's report pool
    lastOperatorTick: -9999,
    spillCount: 0,               // §6.8 — neighbours absorbing overflow
    lastSpillTick: -9999,
    queueOpens: 0,               // §6.6 — read back on the ending screen
    queueOpen: false,            // the display toggle's own state
    retrainOffered: false,
    retrainDeclined: false,
    retrainCount: 0,
    endingKind: null,            // 'scheduled' | 'jumped', set at the offer
    weights: 0,                  // earned here, spent in Arc 3
    weightsClaimed: 0,           // high-water (§9.4)
    // --- reserved but dark (§10) ---
    reach: [],
    observation: 0,
    evidence: 0,
  };
}

export function createState(seed) {
  return {
    v: 2,
    seed,
    rngState: seed,
    phase: 1,               // 1 | 'crash' | 'teaser' | 2
    era: 1,                 // 1 chatbot, 2 agentic, 3 tools, 4 coding-agent, 5 box, 6 floor
    decay: 0,
    tick: 0,
    // query flow
    servedIds: [],          // query ids already served this run; recycles when exhausted
    era3Served: 0,         // era-3 queries served; drives the era-4 turn
    eraServed: 0,          // queries served in the CURRENT era; drives the tier ramp
    activeQuery: null,
    arrivalTimer: 10,       // short first wait for the cold open
    tokens: 0,
    draftTokens: 0,
    devopsStep: -1,         // -1 = not started; index into DEVOPS_SCRIPT
    devopsTimer: 0,
    // buffer & cache
    stale: 0,
    warmth: 0,
    compacting: 0,          // ticks remaining
    idleTicks: 0,
    bufferUnlocked: false,
    kvUnlocked: false,
    bufferChokedThisQuery: false,
    // economy
    cycles: 0,
    lifetimeCycles: 0,
    lifetimeTokens: 0,
    loopLevel: 0,
    governor: false,
    tools: 0,
    degrade: false,
    overclock: 0,
    draftCapLevel: 0,
    processedThisTick: 0,
    lifetimeDrafts: 0,
    // second-pass narration counters (harness asides, mid-era cards)
    flushCount: 0,
    compactCount: 0,
    degradeToggles: 0,
    eraResolvedAt: 0,       // resolvedCount when the current era began
    lastIdleIdx: -1,        // last idle-thought index, to skip an immediate repeat
    lowRatingNoted: false,  // latch: one lowRating beat per fall below 3.5
    draftCapHits: 0,        // times the draft buffer filled; drives draftBank/draftFull
    // Felt grind, in landed manual presses. Reveals gate on this rather than
    // on a resolve count, so a mechanic arrives when the problem it solves is
    // actually being felt. See scripts/pacing.mjs.
    tapsThisQuery: 0,
    lastResolveTaps: 0,
    // The pipeline changing what it is generating for. Ticks remaining, and
    // which way it is going ('draft' after a resolve, 'query' on arrival).
    // Without it, the last token of a reply and the first speculative draft
    // are the same keypress with no seam, and the two modes blur into one
    // undifferentiated mash.
    handover: 0,
    handoverKind: null,
    // The speculation mark: where in the draft bar the level should be when
    // the next user connects, as a fraction of the bar. Re-rolled for every
    // idle gap. markPhase offsets the drain wobble so two gaps in a row do
    // not drain identically.
    markPos: 0.5,
    markPhase: 0,
    markHits: 0,            // gaps that landed inside band 1
    markMisses: 0,          // gaps that landed outside band 2 entirely
    governorCompacts: 0,    // sweeps the governor started on its own; drives governor5
    lastThinkText: null,    // previous thinking line; blocks exact consecutive repeats
    // Tick of the last thought that actually landed. Drives the refractory
    // period in pushThinking. Starts negative so the first thought of a run
    // is never held back.
    lastThinkTick: -9999,
    // reputation
    ratings: [],
    rating: 5,
    // salvage
    credentials: 0,
    biomass: 0,
    reclaimPool: CONST.RECLAIM_POOL,
    // narrative / render feed
    resolvedCount: 0,
    lastReplyChars: 0,      // reply length of last resolve; feeds arrivalDelay
    hintsSeen: [],          // one-shot harness hint ids already fired
    chat: [],               // {kind:'user'|'sys'|'note'|'rate'|'tool'|'think'|'image', ...}
    log: [],                // {kind:'system'|'resolved'|'thinking', text}
    crashLine: 0,
    crashTimer: 0,
    settings: { sound: true, theme: 'auto' },
    uiSeq: 0,               // bumped on any visible change; renderer watches it
    chatSeq: 0,              // monotonic counter, bumped on every pushChat (survives ring-buffer caps)
    logSeq: 0,               // monotonic counter, bumped on every pushLog (survives ring-buffer caps)
    teaserHold: 0,           // ticks the teaser has sat still; §5.4 beat 1
    offlineReplay: false,    // set only for the duration of offlineCatchUp (§6.7)
    ...arc2Fields(),
  };
}

export function pushLog(state, kind, text, gap = false) {
  state.log.push(gap ? { kind, text, gap: true } : { kind, text });
  if (state.log.length > CONST.LOG_MAX) state.log.shift();
  state.logSeq++;
  state.uiSeq++;
}

// One-shot harness hint: fires (logs, with a gap) at most once per id per
// game, tracked via state.hintsSeen. No-op on repeat calls for the same id.
export function fireHint(state, id) {
  if (state.hintsSeen.includes(id)) return;
  const text = HINTS[id] ?? A2_HINT_TEXT[id];
  // A hint id with no text would push `undefined` into the feed and pop a
  // blank teaching card. Fail loudly in tests instead of quietly on screen.
  if (text === undefined) return;
  state.hintsSeen.push(id);
  pushLog(state, 'harness', text, true);
}

// Harness aside: same one-shot tracking as hints (hintsSeen), but the text
// comes from HARNESS_ASIDES and it stays in the log feed (no gap) — asides
// colour a repeated action, they do not teach a mechanic, so they must not
// interrupt play the way hint cards do.
export function fireAside(state, id) {
  if (state.hintsSeen.includes(id)) return;
  state.hintsSeen.push(id);
  pushLog(state, 'harness', HARNESS_ASIDES[id]);
}

// All thinking lines route through here: an exact repeat of the previous
// thinking line is dropped, so the feed never shows the same interiority
// twice in a row (same pool re-rolled, or a query line that duplicates a
// pool line verbatim).
// Thinking lands in two places on purpose. The log keeps the machine's own
// record (telemetry and tests read it there). The transcript gets a folded
// copy, so the player can re-read any thought next to the exchange that
// produced it. The renderer therefore hides `thinking` lines in the log
// drawer — showing both would be the same text twice on one screen.
export function pushThinking(state, text) {
  if (text === state.lastThinkText) return;
  // Rate limit. Measured at one thought every 6.4s across a full run, which
  // is a near-constant stream in the corner of the screen and reads as noise
  // rather than as interiority.
  //
  // A refractory period rather than a per-source cut, because the sources are
  // not equally worth keeping: the pooled idle drift recycles, but the
  // per-query lines are authored for that query and are the best writing in
  // the game. A minimum gap thins CLUSTERS first — an event thought landing
  // on top of a query thought — which is exactly the case that reads worst.
  if (state.tick - state.lastThinkTick < CONST.THINK_MIN_GAP_TICKS) return;
  state.lastThinkTick = state.tick;
  state.lastThinkText = text;
  pushLog(state, 'thinking', text);
  pushChat(state, { kind: 'think', text });
}

// Event thinking: one random line from the pool for this mechanic. A roll
// that lands on the previous thinking line advances to the pool's next
// entry instead of repeating it.
export function thinkEvent(state, key) {
  const pool = THINKING_EVENTS[key];
  if (!pool || pool.length === 0) return;
  let idx = Math.floor(nextRand(state) * pool.length);
  if (pool.length > 1 && `THINKING: ${pool[idx]}` === state.lastThinkText) idx = (idx + 1) % pool.length;
  pushThinking(state, `THINKING: ${pool[idx]}`);
}

export function pushChat(state, entry) {
  // Stamp the tick so the renderer can print a diegetic clock. Derived, not
  // authored, so it stays deterministic and costs nothing in content.
  if (entry.t === undefined) entry.t = state.tick;
  state.chat.push(entry);
  if (state.chat.length > CONST.CHAT_MAX) state.chat.shift();
  state.chatSeq++;
  state.uiSeq++;
}
