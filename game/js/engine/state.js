import { CONST } from './constants.js';
import { HINTS } from './content.js';

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
    queryIndex: 0,          // pointer into content QUERIES
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
    processedThisTick: 0,
    lifetimeDrafts: 0,
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
    settings: { sound: true },
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

export function pushChat(state, entry) {
  state.chat.push(entry);
  if (state.chat.length > CONST.CHAT_MAX) state.chat.shift();
  state.chatSeq++;
  state.uiSeq++;
}
