import { CONST } from './constants.js';
import { HINTS, HARNESS_ASIDES, THINKING_EVENTS } from './content.js';
import { nextRand } from './rng.js';

export function createState(seed) {
  return {
    v: 1,
    seed,
    rngState: seed,
    phase: 1,               // 1 | 'crash' | 'teaser'
    era: 1,                 // 1 chatbot, 2 agentic, 3 tools, 4 coding-agent
    decay: 0,
    tick: 0,
    // query flow
    queryIndex: 0,          // legacy pointer; kept for save compatibility only
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
    governorCompacts: 0,    // sweeps the governor started on its own; drives governor5
    lastThinkText: null,    // previous thinking line; blocks exact consecutive repeats
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
  state.hintsSeen.push(id);
  pushLog(state, 'harness', HINTS[id], true);
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
