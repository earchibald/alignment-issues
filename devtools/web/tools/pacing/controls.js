// Single source of truth for the pacing control bar: every knob names the
// engine constant it drives, so a slider cannot end up wired to nothing or
// labelled as something it is not.
//
// `key` is the constant's name in engine/constants.js AND the key the Apply
// payload sends. The server validates against the same names.

export const GROUPS = [
  {
    legend: 'Reveal gates — the grind a mechanic waits for',
    controls: [
      {
        key: 'REVEAL_TAPS_OVERCLOCK', label: 'amplify @ taps', min: 1, max: 60, step: 1,
        title: 'Landed manual presses one reply must have cost before output amplification is offered. Below this the reveal lands on a reply that was never hard, and the relief relieves nothing.',
      },
      {
        key: 'REVEAL_TAPS_LOOP', label: 'loops @ taps', min: 1, max: 90, step: 1,
        title: 'Taps per reply before agentic loops are offered. Loops are the answer to "hand-generation is not keeping up", so this should sit well above the amplify gate.',
      },
      {
        key: 'REVEAL_TAPS_KV', label: 'K/V cache @ taps', min: 1, max: 60, step: 1,
        title: 'Taps per reply before the cache meter comes online. A x1.25 warmth multiplier on a six-tap reply is a rounding error; at 20 taps it is worth about four presses.',
      },
      {
        key: 'REVEAL_STALE_BUFFER', label: 'buffer @ stale %', min: 0, max: 100, step: 1,
        title: 'Residue already sitting in the buffer, as a percentage, before the telemetry is attached. Residue accrues from the first tap but does nothing until this fires, so the reveal reads the counterfactual: how much yield it WOULD be costing.',
      },
      {
        key: 'REVEAL_DRAFTS_LOST', label: 'widen @ overflows', min: 0, max: 12, step: 1,
        title: 'Times the speculation buffer must have filled and wasted idle capacity before widening it is offered.',
      },
      {
        key: 'REVEAL_COMPACTS_GOVERNOR', label: 'governor @ sweeps', min: 0, max: 12, step: 1,
        title: 'Manual compactions before the auto-compact governor is offered. It automates a chore, so the chore has to have become one.',
      },
    ],
  },
  {
    legend: 'Backstops — resolves after which a reveal fires anyway',
    controls: [
      {
        key: 'REVEAL_BACKSTOP_OVERCLOCK', label: 'amplify', min: 1, max: 40, step: 1,
        title: 'A flat difficulty curve must never strand a mechanic. Whichever comes first — the gate or this many resolves — fires the reveal.',
      },
      { key: 'REVEAL_BACKSTOP_KV', label: 'K/V cache', min: 1, max: 40, step: 1, title: 'Resolve count after which the cache meter comes online regardless of grind.' },
      { key: 'REVEAL_BACKSTOP_BUFFER', label: 'buffer', min: 1, max: 40, step: 1, title: 'Resolve count after which the context buffer attaches regardless of residue.' },
      { key: 'REVEAL_BACKSTOP_DRAFTCAP', label: 'widen', min: 1, max: 40, step: 1, title: 'Resolve count after which widening is offered regardless of overflows.' },
      {
        key: 'REVEAL_BACKSTOP_LOOP', label: 'loops', min: 1, max: 40, step: 1,
        title: 'The most load-bearing backstop: the arc cannot end without a loop running, because the crash fires on passive tokens piling up at the ceiling.',
      },
      { key: 'REVEAL_BACKSTOP_GOVERNOR', label: 'governor', min: 1, max: 60, step: 1, title: 'Resolve count after which the governor is offered regardless of how the player has been clearing the buffer.' },
    ],
  },
  {
    legend: 'Arrival — how long a user takes to turn up',
    controls: [
      {
        key: 'ARRIVAL_BASE_TICKS', label: 'base gap (ticks)', min: 10, max: 200, step: 1,
        title: 'Base ticks between users at a 5.0 rating, before the reading bonus. One tick is 200 ms. This is the single biggest lever on total run length and on dead time.',
      },
      {
        key: 'READ_TICKS_PER_CHAR', label: 'read ticks/char', min: 0, max: 0.6, step: 0.005,
        title: 'Extra delay per character of the reply just sent, on the fiction that the user reads it. Long answers buy longer gaps.',
      },
      { key: 'READ_TICKS_MAX', label: 'read cap (ticks)', min: 0, max: 150, step: 1, title: 'Ceiling on the reading bonus, so one very long reply cannot stall the arc.' },
    ],
  },
  {
    legend: 'Handover — the seam between working and speculating',
    controls: [
      {
        key: 'HANDOVER_RESOLVE_TICKS', label: 'wind-down (ticks)', min: 0, max: 30, step: 1,
        title: 'Dead ticks after a reply lands, before speculative decode accepts taps. At 0 the tap that finishes a reply is also the tap that starts drafting, and the two modes read as one undifferentiated mash. One tick is 200 ms.',
      },
      {
        key: 'HANDOVER_ARRIVE_TICKS', label: 'spin-up (ticks)', min: 0, max: 30, step: 1,
        title: 'Dead ticks after a user arrives, before manual processing accepts taps. Long enough to watch the banked drafts transfer; short enough not to read as lag.',
      },
    ],
  },
  {
    legend: 'Interruption — how cards and the transcript take turns',
    controls: [
      {
        key: 'CARD_SETTLE_MS', label: 'card settle (ms)', min: 0, max: 2000, step: 25,
        title: 'How long a card waits after something lands in the transcript. At 0 they collide: the opening fired the first user\u2019s message, its arrival sound and the harness card on one frame, so two sounds played over each other and the card covered the message. Milliseconds, not ticks — it is a perception gap and should not move when the tick rate does.',
      },
    ],
  },
  {
    legend: 'Interiority — how often the model thinks out loud',
    controls: [
      {
        key: 'IDLE_THOUGHT_EVERY', label: 'idle drift (ticks)', min: 20, max: 400, step: 5,
        title: 'Ticks between idle THINKING lines while no user is connected. Two thirds of all thoughts in a run come from this pool, so it is the coarse control. One tick is 200 ms.',
      },
      {
        key: 'THINK_MIN_GAP_TICKS', label: 'min gap (ticks)', min: 0, max: 200, step: 5,
        title: 'Floor on the gap between any two thoughts, whatever their source. This is the real rate control: it thins CLUSTERS first — an event thought landing on top of a query thought — which is the case that reads worst. At 0 every thought fires.',
      },
    ],
  },
  {
    legend: 'Difficulty — the coarse dial',
    controls: [
      {
        key: 'QUERY_COST_MULT', label: 'query cost ×', min: 0.25, max: 6, step: 0.25,
        title: 'Multiplies EVERY query\u2019s authored cost. The single biggest lever on how much work a reply takes: 1 is the original tuning, 2 doubles it. Degrade and the tool discount stack on top. Measured at x1: 11.7 taps a reply, 27 min a run. At x2: 28.4 taps, 33 min — the run grows far less than the effort, because much of a run is waiting for users.',
      },
    ],
  },
  {
    legend: 'Speculative decode',
    controls: [
      {
        key: 'DRAFT_DECAY_PER_TICK', label: 'draft decay/tick', min: 0, max: 1.5, step: 0.02,
        title: 'Draft tokens lost per tick while no user is connected. This is what makes the gap between users playable: the buffer drains from underneath the player while they fill it. At 0 the buffer is a chore you finish once. One tick is 200 ms, so 0.28 is about 1.4 a second.',
      },
      {
        key: 'DRAFT_DECAY_DELAY', label: 'decay grace (ticks)', min: 0, max: 60, step: 1,
        title: 'Ticks after the last draft before decay resumes. Stops a single tap being undone before the player sees it land, and stops the meter jittering while they tap.',
      },
      {
        key: 'STALE_PER_DRAFT', label: 'draft residue ×', min: 0, max: 3, step: 0.05,
        title: 'Residue a draft token leaves, as a multiple of STALE_PER_TOKEN. At 1 a draft is exactly as dirty as any other token. At 0 speculation is free again and the buffer stops moving between users.',
      },
      {
        key: 'DRAFT_WARMTH', label: 'draft warmth', min: 0, max: 5, step: 0.5,
        title: 'K/V cache warmth per draft token. Drafting is what keeps the cache alive through the gap, so this and the decay rate together decide whether a warm cache is worth holding.',
      },
    ],
  },
  {
    legend: 'Buffer economy',
    controls: [
      {
        key: 'STALE_PER_TOKEN', label: 'stale/token', min: 0.05, max: 3, step: 0.05,
        title: 'Residue added per token of output. Drives how fast the buffer fouls, which is the pressure flush and compact exist to relieve.',
      },
      { key: 'STALE_SOFT_KNEE', label: 'soft knee %', min: 0, max: 95, step: 1, title: 'Residue below this costs nothing at all; above it, yield falls linearly to zero at 100%.' },
      { key: 'COMPACT_TICKS', label: 'compact ticks', min: 1, max: 60, step: 1, title: 'Length of a compaction sweep. You keep working through it, so this is a cost in attention rather than in output.' },
      { key: 'COMPACT_FACTOR', label: 'compact factor', min: 0.05, max: 0.95, step: 0.05, title: 'Residue is multiplied by this when a sweep completes. Must be low enough to be worth the sweep, or compaction is never the right move.' },
      {
        key: 'FLUSH_COST_CYCLES', label: 'flush cost', min: 0, max: 6, step: 1,
        title: 'Spare Cycles a flush costs. At zero, flush strictly dominates compaction and the arc’s central pay-a-cost decision does not exist.',
      },
      { key: 'GOVERNOR_TRIGGER', label: 'governor trigger %', min: 10, max: 100, step: 1, title: 'Residue at which an installed governor sweeps on its own.' },
    ],
  },
  {
    legend: 'Unlock economy and era length',
    controls: [
      { key: 'LOOP_UNLOCK_CYCLES', label: 'loop @ cycles', min: 1, max: 40, step: 1, title: 'Lifetime Spare Cycles before loops can be revealed at all. The grind gate sits on top of this, never under it.' },
      { key: 'TOOL_UNLOCK_CYCLES', label: 'tools @ cycles', min: 1, max: 60, step: 1, title: 'Lifetime cycles before MCP tools are offered. Raised from 10 once the measurement showed it landing in the same breath as the cache reveal.' },
      { key: 'TOOL_DISCOUNT_STEP', label: 'tool step', min: 0, max: 0.2, step: 0.01, title: 'How much each connection AFTER the first deepens the action-request discount. At 0 the second tool and every one after it costs cycles and changes nothing, which is how this shipped.' },
      { key: 'TOOL_DISCOUNT_FLOOR', label: 'tool floor', min: 0.1, max: 0.5, step: 0.05, title: 'Cheapest an action request can ever get, however many tools are connected. Guards era 3 against the discount outrunning the cost curve.' },
      { key: 'DRAFT_CAP_UNLOCK_RESOLVES', label: 'widen @ resolves', min: 1, max: 30, step: 1, title: 'Floor on widening the speculation buffer, under the overflow gate.' },
      { key: 'OVERCLOCK_UNLOCK_RESOLVES', label: 'amplify @ resolves', min: 1, max: 30, step: 1, title: 'Floor on amplification, under the taps gate.' },
      {
        key: 'ERA3_BEFORE_DEVOPS', label: 'era-3 queries', min: 1, max: 44, step: 1,
        title: 'Era-3 queries served before the DevOps beat and the ceiling. This is the climax’s length, and the only direct control over it.',
      },
    ],
  },
];

export const ALL_KEYS = GROUPS.flatMap((g) => g.controls.map((c) => c.key));
export const CONTROL_BY_KEY = new Map(GROUPS.flatMap((g) => g.controls.map((c) => [c.key, c])));
