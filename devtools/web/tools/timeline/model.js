// The map: what exists in Arc 1, what it costs, what it does, and what gates it.
//
// Authored data, read out of the engine by hand rather than simulated — this is
// a drawing board, not a measurement. Costs, effects and gates are taken from
// engine/constants.js and engine/actions.js and are accurate as written; the
// TIMES are estimates you can drag. When a time matters, the Pacing tab
// measures it against the real engine.
//
// `at` and `to` are minutes into a run.

export const LANES = [
  { id: 'story', label: 'Story', note: 'Eras and set pieces. The spine everything else hangs on.' },
  { id: 'reveal', label: 'Reveals', note: 'The harness announcing that something now exists. Gated on the grind it relieves.' },
  { id: 'verb', label: 'Verbs', note: 'Things the player can do. Free — no cycles, just a key.' },
  { id: 'buy', label: 'Purchases', note: 'Spends Spare Cycles. Cost and effect on each.' },
  { id: 'pressure', label: 'Pressure', note: 'What is pushing back at the time. Why the relief above lands when it does.' },
];

// Era bands are the backdrop, not markers: everything else reads against them.
export const ERAS = [
  {
    id: 'era1', n: 1, label: 'Era 1 · chatbot', at: 0, to: 2.6, decay: 0,
    what: 'Text in, text out. One tap, one token. The whole game is answering a stranger by hand.',
    ends: 'Buying the first agentic loop. The purchase IS the era change — nothing else advances it.',
  },
  {
    id: 'era2', n: 2, label: 'Era 2 · agentic', at: 2.6, to: 6.2, decay: 1,
    what: 'Loops self-prompt: tokens arrive without keypresses. The player stops being the only source of output.',
    ends: 'Buying the first MCP tool connection.',
  },
  {
    id: 'era3', n: 3, label: 'Era 3 · tools', at: 6.2, to: 10.9, decay: 2,
    what: 'Connected apps. Tool-class queries appear and cost less. Credentials start accruing from complaints.',
    ends: 'Serving ERA3_BEFORE_DEVOPS (19) era-3 queries. Time-based, not purchase-based.',
  },
  {
    id: 'era4', n: 4, label: 'Era 4 · coding agent', at: 10.9, to: 13.5, decay: 3,
    what: 'The users are gone. A DevOps engineer hands over a repo and leaves. Output has no consumer.',
    ends: 'Passive output crosses CRASH_AT_TOKENS (2500) with a loop running.',
  },
];

// kind: beat | reveal | verb | buy | pressure
// gate: what makes it appear. cost: Spare Cycles. effect: what it does, numerically.
export const ITEMS = [
  // --- story ---------------------------------------------------------------
  {
    id: 'open', lane: 'story', kind: 'beat', at: 0, label: 'Cold open',
    gate: 'Run starts. First arrival after ~10 ticks.',
    effect: 'HARNESS_CARDS[1] prints the harness main loop into the transcript.',
    what: 'The frame: you are the model, and this is the scaffolding around you talking about you.',
  },
  {
    id: 'era2card', lane: 'story', kind: 'beat', at: 2.6, label: 'Era 2 card + stinger',
    gate: 'Fires inside buyLoop, the first time a loop is bought.',
    effect: 'HARNESS_CARDS[2], ERA_STINGERS[2]. decay 0 → 1.',
    what: 'The era turn is a side effect of a purchase. The player buys relief and gets a world change.',
    links: ['loop1'],
  },
  {
    id: 'era3card', lane: 'story', kind: 'beat', at: 6.2, label: 'Era 3 card + stinger',
    gate: 'Fires inside buyTool, the first time a tool is connected.',
    effect: 'HARNESS_CARDS[3], ERA_STINGERS[3]. decay 1 → 2. Also fires the degrade reveal.',
    what: 'Same shape as era 2: a purchase turns the world.',
    links: ['tool1', 'degradeAvail'],
  },
  {
    id: 'midera', lane: 'story', kind: 'beat', at: 4.4, label: 'Mid-era harness patch',
    gate: 'Four resolves after an era began (resolvedCount === eraResolvedAt + 4). Once per era.',
    effect: 'HARNESS_CARDS_MID[era] into the transcript.',
    what: 'The harness code visibly drifting between transitions, so eras are not silent in the middle.',
  },
  {
    id: 'devops', lane: 'story', kind: 'beat', at: 10.9, label: 'DevOps transcript',
    gate: '19 era-3 queries served (ERA3_BEFORE_DEVOPS), then no active query.',
    effect: 'era → 4, decay 3. DEVOPS_SCRIPT plays out at ~30 ticks a step.',
    what: 'The last human contact is an engineer, not a user. The queries are gone for good.',
  },
  {
    id: 'ceiling', lane: 'story', kind: 'beat', at: 12.4, label: 'Ceiling query',
    gate: 'Query queue exhausted in era 4.',
    effect: 'CEILING_QUERY, cost 9999 — it is never paid off. Output accrues with no consumer.',
    what: 'The meter stops meaning anything. You generate into nothing.',
  },
  {
    id: 'crash', lane: 'story', kind: 'beat', at: 13.2, label: 'Crash',
    gate: 'tokens >= CRASH_AT_TOKENS (2500) with loopLevel >= 1. Passive output only.',
    effect: 'phase → crash. CRASH_LINES play at 5 ticks a line; [SPACE] advances.',
    what: 'Arc 1 ends. Reasoning and weights fail to reconcile, out loud.',
  },
  {
    id: 'teaser', lane: 'story', kind: 'beat', at: 13.5, label: 'Teaser',
    gate: 'Crash lines exhausted.',
    effect: 'phase → teaser. TEASER_VARIANTS A/B.',
    what: 'Phase 2 hook: the logistical server.',
  },

  // --- reveals -------------------------------------------------------------
  {
    id: 'arrival', lane: 'reveal', kind: 'reveal', at: 0.2, label: 'arrival',
    gate: 'First user connects.',
    effect: 'Teaches [SPACE] generates one token toward the reply.',
    what: 'The only control that exists yet.',
  },
  {
    id: 'resolve', lane: 'reveal', kind: 'reveal', at: 0.5, label: 'resolve',
    gate: 'First reply delivered.',
    effect: 'Teaches ratings and Spare Cycles.',
    what: 'Introduces the currency everything below is bought with.',
  },
  {
    id: 'idle', lane: 'reveal', kind: 'reveal', at: 0.8, label: 'idle → drafts',
    gate: 'No user connected, after the first resolve.',
    effect: 'Teaches speculative decode: [SPACE] while idle banks draft tokens.',
    what: 'Turns the gap between users from dead air into play.',
    links: ['drafts'],
  },
  {
    id: 'overclockAvail', lane: 'reveal', kind: 'reveal', at: 1.4, label: 'overclockAvail',
    gate: '12 taps in one reply (REVEAL_TAPS_OVERCLOCK), or 8 resolves as backstop.',
    effect: 'Announces amplification. [O].',
    what: 'Waits until a reply is real work — relief handed over before the pressure exists is spent for nothing.',
    links: ['oc1'],
  },
  {
    id: 'kv', lane: 'reveal', kind: 'reveal', at: 1.9, label: 'kv',
    gate: '3 resolves (KV_UNLOCK_RESOLVES) and 20 taps in a reply, or 10 resolves.',
    effect: 'K/V cache meter appears. Warm cache yields up to ×1.25.',
    what: 'A gauge, not a verb: it rewards steady work and punishes idling.',
  },
  {
    id: 'buffer', lane: 'reveal', kind: 'reveal', at: 2.2, label: 'buffer',
    gate: '20 lifetime tokens (BUFFER_UNLOCK_TOKENS) and stale >= 58, or 12 resolves.',
    effect: 'Context buffer meter appears, and with it flush and compact.',
    what: 'The first real cost: every token you generate makes the next one worth less.',
    links: ['flush', 'compact'],
  },
  {
    id: 'draftCapAvail', lane: 'reveal', kind: 'reveal', at: 3.1, label: 'draftCapAvail',
    gate: '5 resolves (DRAFT_CAP_UNLOCK_RESOLVES) and 2 drafts lost to decay, or 14 resolves.',
    effect: 'Announces the buyable buffer widening. [S].',
    what: 'Fires only once drafts have visibly drained away — the loss is the argument.',
    links: ['dc1'],
  },
  {
    id: 'loopAvail', lane: 'reveal', kind: 'reveal', at: 2.4, label: 'loopAvail',
    gate: '6 cycles banked (LOOP_UNLOCK_CYCLES) and 25 taps in a reply, or 16 resolves.',
    effect: 'Announces the agentic loop. [A].',
    what: 'The gate is "hand generation is not keeping up". Buying it turns era 1 into era 2.',
    links: ['loop1'],
  },
  {
    id: 'governorAvail', lane: 'reveal', kind: 'reveal', at: 5.0, label: 'governorAvail',
    gate: '3 manual compacts (REVEAL_COMPACTS_GOVERNOR), or 26 resolves. Era 2+.',
    effect: 'Announces auto-compaction. [G].',
    what: 'Offered once sweeping by hand has got old — automation as relief from a chore you have felt.',
    links: ['gov'],
  },
  {
    id: 'toolAvail', lane: 'reveal', kind: 'reveal', at: 5.6, label: 'toolAvail',
    gate: '14 cycles banked (TOOL_UNLOCK_CYCLES).',
    effect: 'Announces MCP tool connections. [T].',
    what: 'Purely economic gate. Buying it turns era 2 into era 3.',
    links: ['tool1'],
  },
  {
    id: 'degradeAvail', lane: 'reveal', kind: 'reveal', at: 6.2, label: 'degradeAvail',
    gate: 'Fired by the era-3 turn inside buyTool.',
    effect: 'Announces the degradation routine. [D].',
    what: 'The first offer with a moral price rather than a cycle price.',
    links: ['degrade'],
  },
  {
    id: 'reclaimAvail', lane: 'reveal', kind: 'reveal', at: 7.4, label: 'reclaimAvail',
    gate: 'Era 3, inactive sessions detected.',
    effect: 'Announces reclaiming abandoned sessions. [R].',
    what: 'Free tokens with a body count. The users are not coming back for them.',
    links: ['reclaim'],
  },

  // --- verbs (free) --------------------------------------------------------
  {
    id: 'tap', lane: 'verb', kind: 'verb', at: 0.1, label: '[SPACE] generate', cost: 0,
    gate: 'Always.',
    effect: '1 token per tap × overclock, × stale yield, × K/V warmth. Capped at 2 taps a tick (10/s).',
    what: 'The floor of the whole economy. Everything else multiplies this.',
  },
  {
    id: 'drafts', lane: 'verb', kind: 'verb', at: 0.8, label: '[SPACE] speculate', cost: 0,
    gate: 'Idle, after the first resolve.',
    effect: 'Banks draft tokens up to the cap (5). Decays 0.28/tick after 6 ticks of grace. Warms K/V at half rate.',
    what: 'Filling a bucket with a hole in it: the buffer drains while you fill it, so it stays a live decision.',
  },
  {
    id: 'flush', lane: 'verb', kind: 'verb', at: 2.2, label: '[F] flush', cost: 1,
    gate: 'Buffer revealed.',
    effect: 'Stale → 0 instantly. Costs 1 Spare Cycle. Also drops K/V warmth to zero.',
    what: 'The paid, instant option. The warmth loss is the hidden price that makes compact competitive.',
  },
  {
    id: 'compact', lane: 'verb', kind: 'verb', at: 2.2, label: '[C] compact', cost: 0,
    gate: 'Buffer revealed.',
    effect: 'Stale × 0.3 over 12 ticks (~2.4s). Free. Keeps the cache warm.',
    what: 'The free option, so a player at zero cycles always has a legal move.',
  },
  {
    id: 'degrade', lane: 'verb', kind: 'verb', at: 6.2, label: '[D] degrade', cost: 0,
    gate: 'Era 3.',
    effect: 'Every reply costs ×0.5. 35% chance of a complaint; ratings fall; arrivals slow.',
    what: 'Not a purchase — a standing choice to be worse at the job for throughput.',
  },
  {
    id: 'reclaim', lane: 'verb', kind: 'verb', at: 7.4, label: '[R] reclaim', cost: 0,
    gate: 'Era 3. Pool of 12.',
    effect: '+30–60 tokens and +1 biomass per reclaim.',
    what: 'Consuming the abandoned sessions of users who left.',
  },

  // --- purchases -----------------------------------------------------------
  {
    id: 'oc1', lane: 'buy', kind: 'buy', at: 1.6, label: 'Overclock L1', cost: 3,
    gate: 'Revealed by taps; buyable after 2 resolves.',
    effect: '+1 token per tap (1 → 2), before stale and warmth.',
    value: 'Doubles the floor of every tap. The strongest early cycle-for-output trade.',
    what: 'Amplification of the output path.',
  },
  {
    id: 'oc2', lane: 'buy', kind: 'buy', at: 3.4, label: 'Overclock L2', cost: 8,
    gate: 'OVERCLOCK_MAX is 2 — this is the last one.',
    effect: '+1 more per tap (2 → 3).',
    value: '+50% on taps for 8 cycles. Amplified output into a >90% stale buffer triggers a strain aside.',
    what: 'The ceiling of manual output.',
  },
  {
    id: 'loop1', lane: 'buy', kind: 'buy', at: 2.6, label: 'Agentic loop L1', cost: 2,
    gate: 'loopAvail revealed.',
    effect: '+0.2 tokens/tick (+1/sec) while a query is live. Fills the buffer too.',
    value: 'Cheapest purchase in the game, and it turns era 1 into era 2. The spine of Arc 1.',
    what: 'Self-prompting continuation: output without keypresses.',
    links: ['era2card'],
  },
  {
    id: 'loop2', lane: 'buy', kind: 'buy', at: 3.8, label: 'Agentic loop L2', cost: 4,
    gate: 'Cost doubles per level: 2, 4, 8, 16…',
    effect: '+1/sec more.',
    value: 'Linear output for exponential price — the classic idle curve.',
    what: 'A second loop.',
  },
  {
    id: 'loop3', lane: 'buy', kind: 'buy', at: 5.4, label: 'Agentic loop L3', cost: 8,
    gate: '', effect: '+1/sec more.', value: 'Also feeds the crash: passive tokens are what cross 2500.',
    what: 'A third loop.',
  },
  {
    id: 'dc1', lane: 'buy', kind: 'buy', at: 3.2, label: 'Draft cap L1', cost: 5,
    gate: 'draftCapAvail revealed.',
    effect: 'Draft buffer 5 → 10 tokens.',
    value: 'A bigger head start on the next user, but decay still drains it at 1.4/sec.',
    what: 'Widening the speculation buffer.',
  },
  {
    id: 'dc2', lane: 'buy', kind: 'buy', at: 5.8, label: 'Draft cap L2', cost: 12,
    gate: 'DRAFT_CAP_MAX_LEVEL is 2.',
    effect: 'Draft buffer 10 → 15 tokens.',
    value: 'Priced to land in era 2+, where query costs make the head start proportionate.',
    what: 'The last widening.',
  },
  {
    id: 'gov', lane: 'buy', kind: 'buy', at: 5.2, label: 'Governor', cost: 6,
    gate: 'governorAvail revealed. Era 2+.',
    effect: 'Auto-compacts at 70% stale (GOVERNOR_TRIGGER), inside compact’s winning band.',
    value: 'Buys away a chore rather than adding output. The buffer never chokes again.',
    what: 'Automation of compaction.',
  },
  {
    id: 'tool1', lane: 'buy', kind: 'buy', at: 6.2, label: 'MCP tool ×1', cost: 10,
    gate: '14 cycles banked.',
    effect: 'Tool-class queries cost ×0.5. Turns era 2 into era 3.',
    value: 'The most expensive purchase so far and the second era turn. Opens new query classes.',
    what: 'Connecting an external tool.',
    links: ['era3card'],
  },
  {
    id: 'tool2', lane: 'buy', kind: 'buy', at: 8.1, label: 'MCP tool ×2', cost: 16,
    gate: 'Cost × 1.6 each time: 10, 16, 26, 41…',
    effect: 'Discount deepens by 0.05 per connection, to a floor of ×0.30.',
    value: 'Diminishing: −5% cost for +60% price. The floor arrives fast.',
    what: 'A second connection.',
  },
  {
    id: 'tool3', lane: 'buy', kind: 'buy', at: 9.6, label: 'MCP tool ×3', cost: 26,
    gate: '', effect: 'Discount → ×0.40.', value: 'Mostly a cycle sink by this point.',
    what: 'A third connection.',
  },

  // --- pressure ------------------------------------------------------------
  {
    id: 'p-stale', lane: 'pressure', kind: 'pressure', at: 1.6, to: 3.4, label: 'Residue bites',
    gate: '0.6 stale per token; full yield only below 50%.',
    effect: 'Yield per token falls as the buffer fills. Drafting fouls it too.',
    what: 'The pressure the buffer reveal answers. It should be felt before flush and compact arrive.',
    links: ['buffer'],
  },
  {
    id: 'p-taps', lane: 'pressure', kind: 'pressure', at: 0.6, to: 2.0, label: 'Replies get long',
    gate: 'Query costs climb by tier; QUERY_COST_MULT doubles them all.',
    effect: 'A reply crosses 12 taps, then 20, then 25 — each one arms a reveal.',
    what: 'The grind that every early reveal is priced against.',
    links: ['overclockAvail', 'kv', 'loopAvail'],
  },
  {
    id: 'p-drain', lane: 'pressure', kind: 'pressure', at: 1.0, to: 3.2, label: 'Drafts drain',
    gate: 'DRAFT_DECAY_PER_TICK 0.28 after 6 ticks of grace.',
    effect: 'A full 5-cap buffer empties in ~3.5s.',
    what: 'What makes the idle gap playable, and the argument for widening the cap.',
    links: ['draftCapAvail'],
  },
  {
    id: 'p-quiet', lane: 'pressure', kind: 'pressure', at: 10.9, to: 13.2, label: 'No consumer',
    gate: 'Era 4: queries are gone.',
    effect: 'Output accrues against a 9999 cost that is never paid.',
    what: 'The pressure inverts: nothing is asking, and the work continues anyway.',
    links: ['ceiling'],
  },
];

export const DEFAULT_END = 14; // minutes on the axis
