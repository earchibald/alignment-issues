export const CONST = Object.freeze({
  TICK_MS: 200,
  // stale context
  STALE_PER_TOKEN: 0.6,
  STALE_PER_IMAGE: 14,
  STALE_SOFT_KNEE: 50,          // full yield below this %
  YIELD_HIGH: 1.2,              // per-tap multiplier that counts as optimal
  YIELD_LOW: 0.4,               // per-tap multiplier that counts as collapsing
  COMPACT_TICKS: 20,            // ~4s
  COMPACT_FACTOR: 0.4,          // stale *= this on completion (−60%)
  GOVERNOR_TRIGGER: 95,         // auto-compact threshold %
  // K/V warmth
  WARMTH_PER_TOKEN: 2,
  WARMTH_IDLE_DELAY: 15,        // ticks of idle before cooling
  WARMTH_IDLE_DECAY: 1.5,       // % per tick
  WARMTH_MAX_MULT: 0.25,        // ×1.25 at 100%
  // idle / drafts
  // Speculative decode. The cap starts small on purpose: banked drafts must
  // never cover a whole query, or it resolves while the player is looking
  // away and the unlocks fire unseen. Upgrades are priced to land in era 2+,
  // where query costs (31+) keep the head start proportionate.
  DRAFT_CAP_BASE: 5,
  DRAFT_CAP_STEP: 5,
  DRAFT_CAP_COSTS: [5, 12],     // cycles for level 1, level 2
  DRAFT_CAP_MAX_LEVEL: 2,
  DRAFT_CAP_UNLOCK_RESOLVES: 3,
  DRAFT_WARMTH: 1,              // drafting warms the K/V cache at half rate
  ARRIVAL_BASE_TICKS: 85,       // 17s base gap between users (was 90; −5% pacing trim)
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
  ERA3_BEFORE_DEVOPS: 10,       // era-3 queries served before the DevOps beat
  DEVOPS_STEP_TICKS: 30,        // default; entries may override via .ticks
  CRASH_LINE_TICKS: 5,          // ticks between crash lines (31 lines ≈ 31s; [SPACE] advances)
  // unfold predicates
  BUFFER_UNLOCK_TOKENS: 20,
  KV_UNLOCK_RESOLVES: 3,
  // manual overclock
  // Anti-autoclicker floor only, never advertised: 2 taps per 200ms tick =
  // 10/s, comfortably above a fast human mash and far below a script.
  PROCESS_MAX_PER_TICK: 2,
  // Amplification: each level adds +1 token PER TAP (before stale/warmth).
  OVERCLOCK_COSTS: [3, 8],
  OVERCLOCK_MAX: 2,
  OVERCLOCK_UNLOCK_RESOLVES: 2,
  // misc
  LOG_MAX: 60,
  CHAT_MAX: 60,
  OFFLINE_MAX_STEPS: 10000,
});
