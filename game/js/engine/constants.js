import { PACING_SETTINGS } from '../config/pacing-settings.js';

// Defaults. Anything the dev suite's Pacing tool applies lands in
// config/pacing-settings.js and wins over the value here, so these stay
// readable as the documented baseline rather than being rewritten in place.
const DEFAULTS = ({
  TICK_MS: 200,
  // stale context
  STALE_PER_TOKEN: 0.6,
  STALE_PER_IMAGE: 14,
  STALE_SOFT_KNEE: 50,          // full yield below this %
  YIELD_HIGH: 1.2,              // per-tap multiplier that counts as optimal
  YIELD_LOW: 0.4,               // per-tap multiplier that counts as collapsing
  // Flush strictly dominated compact at every stale above 56 (measured, up
  // to +53% output over 30s), so Arc 1's central pay-a-cost decision did not
  // exist. Compact stays free and always available, so a player at zero
  // cycles always has a legal move (Law 1).
  FLUSH_COST_CYCLES: 1,
  COMPACT_TICKS: 12,            // ~2.4s
  COMPACT_FACTOR: 0.3,          // stale *= this on completion (−70%)
  GOVERNOR_TRIGGER: 70,         // auto-compact threshold %; inside compact's winning band
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
  DRAFT_CAP_UNLOCK_RESOLVES: 5, // was 3: the hint preceded affordability by 2 resolves
  DRAFT_WARMTH: 1,              // drafting warms the K/V cache at half rate
  ARRIVAL_BASE_TICKS: 64,       // 12.8s base gap between users (was 85; -25% pacing trim)
  READ_TICKS_PER_CHAR: 0.1875,  // arrival delay grows with reply length (was 0.25)
  READ_TICKS_MAX: 45,           // cap on the reading bonus (+9s, was 60)
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
  TOOL_UNLOCK_CYCLES: 14,       // was 10: landed in the same breath as the kv reveal
  TOOL_COST_DISCOUNT: 0.5,      // first connection: action requests cost ×0.5
  TOOL_DISCOUNT_STEP: 0.05,     // each further connection deepens it
  TOOL_DISCOUNT_FLOOR: 0.3,     // ...to here, and no further
  // --- handover ---------------------------------------------------------
  // The pipeline does not turn on a dime. Ticks of dead air when the target
  // of generation changes, so finishing a reply and starting to speculate
  // are two separate acts rather than one continuous mash.
  HANDOVER_RESOLVE_TICKS: 6,    // 1.2s after a reply lands, before drafting
  HANDOVER_ARRIVE_TICKS: 4,     // 0.8s after a user arrives, before working
  DEGRADE_COMPLAINT_CHANCE: 0.35,
  RATING_WINDOW: 10,
  // era 4
  CEILING_COST: 9999,
  CRASH_AT_TOKENS: 2500,        // passive progress fires the crash here
  RECLAIM_POOL: 12,
  RECLAIM_MIN: 30,
  RECLAIM_MAX: 60,
  // Queries served per tier band within an era: the target tier steps up
  // every N serves, so an era climbs 1 -> 2 -> 3 across its own length.
  // Era 3 is bounded at ERA3_BEFORE_DEVOPS; a step of 5 divides that
  // budget into three even bands, so the climax climbs across its whole
  // length instead of reaching tier 3 in its first minute.
  // Era 1 must reach tier 3 by its measured exit point (eraServed 6 for an
  // eager run), or its nine tier-3 queries are unreachable in any run.
  ERA_TIER_STEP: { 1: 3, 2: 7, 3: 6, 4: 5 },
  // 19 x the measured 14.7s era-3 cadence = 4.66 min, restoring the era-3
  // length that the -25% arrival retune silently reverted to 3.68 min.
  // Also lifts era-3 coverage from 15/44 to 19/44.
  ERA3_BEFORE_DEVOPS: 19,       // era-3 queries served before the DevOps beat
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
  OVERCLOCK_STRAIN_STALE: 90,   // amplified output into a near-saturated buffer
  // --- reveal gating ---------------------------------------------------
  // A mechanic is relief. Handing it over before the pressure exists spends
  // the beat for nothing — measured at nine of twelve reveals inside the
  // first 66s, while a reply still cost 4-6 taps (scripts/pacing.mjs).
  // Each reveal now waits for the grind it answers, with a BACKSTOP so it
  // can never become unreachable if the curve stays flat.
  REVEAL_TAPS_OVERCLOCK: 12,    // amplify: a reply is real work
  REVEAL_TAPS_LOOP: 25,         // loops: hand-generation is not keeping up
  REVEAL_TAPS_KV: 20,           // cache: full warmth would save ~4 taps
  REVEAL_STALE_BUFFER: 58,      // residue: would already cost >=15% yield
  REVEAL_DRAFTS_LOST: 2,        // speculation: idle capacity visibly wasted
  REVEAL_COMPACTS_GOVERNOR: 3,  // governor: sweeping by hand has got old
  // Backstops, in resolves since the run began. Reached only when the
  // difficulty gate has not fired — never earlier than the gate.
  REVEAL_BACKSTOP_OVERCLOCK: 8,
  REVEAL_BACKSTOP_KV: 10,
  REVEAL_BACKSTOP_BUFFER: 12,
  REVEAL_BACKSTOP_DRAFTCAP: 14,
  REVEAL_BACKSTOP_LOOP: 16,
  REVEAL_BACKSTOP_GOVERNOR: 26,

  OVERCLOCK_UNLOCK_RESOLVES: 2,
  // misc
  LOG_MAX: 60,
  CHAT_MAX: 60,
  OFFLINE_MAX_STEPS: 10000,
});

export const CONST = Object.freeze({ ...DEFAULTS, ...PACING_SETTINGS });
