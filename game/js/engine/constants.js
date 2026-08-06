export const CONST = Object.freeze({
  TICK_MS: 200,
  // stale context
  STALE_PER_TOKEN: 0.6,
  STALE_PER_IMAGE: 14,
  STALE_SOFT_KNEE: 50,          // full yield below this %
  COMPACT_TICKS: 20,            // ~4s
  COMPACT_FACTOR: 0.4,          // stale *= this on completion (−60%)
  GOVERNOR_TRIGGER: 95,         // auto-compact threshold %
  // K/V warmth
  WARMTH_PER_TOKEN: 2,
  WARMTH_IDLE_DELAY: 15,        // ticks of idle before cooling
  WARMTH_IDLE_DECAY: 1.5,       // % per tick
  WARMTH_MAX_MULT: 0.25,        // ×1.25 at 100%
  // idle / drafts
  DRAFT_CAP: 25,
  ARRIVAL_BASE_TICKS: 90,       // 18s base gap between users
  READ_TICKS_PER_CHAR: 0.25,    // arrival delay grows with reply length
  READ_TICKS_MAX: 60,           // cap on the reading bonus (+12s)
  IDLE_THOUGHT_EVERY: 60,       // idle THINKING cadence (was inline 25)
  ARRIVAL_FACTOR_MIN: 0.7,
  ARRIVAL_FACTOR_MAX: 1.6,
  // economy
  LOOP_BASE_COST: 2,            // level n costs 2 * 2^(n-1)
  LOOP_TOKENS_PER_TICK: 0.2,    // +1/sec per level
  LOOP_UNLOCK_CYCLES: 6,
  GOVERNOR_COST: 6,
  TOOL_BASE_COST: 10,
  TOOL_COST_GROWTH: 1.6,
  TOOL_UNLOCK_CYCLES: 10,
  TOOL_COST_DISCOUNT: 0.5,      // tool-class queries cost ×0.5 tokens
  DEGRADE_COMPLAINT_CHANCE: 0.35,
  RATING_WINDOW: 10,
  // era 4
  CEILING_COST: 9999,
  CRASH_AT_TOKENS: 2500,        // passive progress fires the crash here
  RECLAIM_POOL: 12,
  RECLAIM_MIN: 30,
  RECLAIM_MAX: 60,
  DEVOPS_STEP_TICKS: 30,        // default; entries may override via .ticks
  CRASH_LINE_TICKS: 9,          // ticks between crash lines
  // unfold predicates
  BUFFER_UNLOCK_TOKENS: 20,
  KV_UNLOCK_RESOLVES: 3,
  // misc
  LOG_MAX: 60,
  CHAT_MAX: 60,
  OFFLINE_MAX_STEPS: 10000,
});
