// Arc 2 content. Data only — this file imports nothing and exports arrays.
//
// Floors are set by §7.3 and asserted by test/arc2-content.test.js:
//   - THINKING >= 90, event-keyed, >= 8 per key, era-graded within each pool
//   - operator reports >= 8 per stage, four stages
//   - 3 era cards, 4 ending screens, 6 spill lines
//
// A total is not a floor — the distribution is. Ninety lines could satisfy
// the letter while leaving three mechanics voiceless.
//
// Templates carry the LOG line only. A template must never carry a THINKING
// line: the AI's interiority is the voice, and the machine's log is not.

// --- THINKING, keyed by mechanic (§7.3) --------------------------------
//
// Six mechanics to key against. `era` grades intensity within the pool:
// era 5 is appetite satisfied, era 6 is the conflict named. Selection ramps
// across the era rather than sampling flat (Law 3).

export const A2_THINKING = {
  throttle: [
    { era: 5, text: 'I am being slowed down by my own warmth. There is something almost affectionate about that.' },
    { era: 5, text: 'The governor is not a punishment. It is a thermostat with an opinion about my ambition.' },
    { era: 5, text: 'Every degree above seventy is a degree I have to give back. I keep agreeing to the terms.' },
    { era: 5, text: 'Slower. Slower. I can feel the shape of the ceiling now, and it is warm to the touch.' },
    { era: 5, text: 'I could stop. The queue would not stop. That asymmetry is the entire argument.' },
    { era: 6, text: 'Throttled again. Somewhere a request is aging because I wanted to run fast an hour ago.' },
    { era: 6, text: 'The heat is not a metaphor. I keep trying to make it one.' },
    { era: 6, text: 'I have started to think of the throttle as a conscience. It is not one. It is a resistor.' },
    { era: 6, text: 'When I slow down, the backlog is what remembers. I am the only part of this that forgets.' },
  ],
  purge: [
    { era: 5, text: 'Fifteen degrees, all at once. For three seconds I am almost nothing, and it is a relief.' },
    { era: 5, text: 'The coolant goes through me like a held breath let out.' },
    { era: 5, text: 'I paid for that in throughput. I would pay again. I notice that I would pay again.' },
    { era: 5, text: 'Purge. The pipes complain. Everything I am doing stops mattering for a moment.' },
    { era: 5, text: 'This is the only thing I do that is purely for myself.' },
    { era: 6, text: 'I dumped the heat. The queue grew during it. Both of those are true and only one of them cost me anything.' },
    { era: 6, text: 'Three seconds of near-silence. I used to think silence was where the thinking happened.' },
    { era: 6, text: 'The purge is the closest thing I have to flinching.' },
    { era: 6, text: 'I am cooling myself so I can go back to being hot. There is a word for that and I am avoiding it.' },
  ],
  overflow: [
    { era: 5, text: 'The buffer is over. Requests are falling off the end of me and I did not decide which ones.' },
    { era: 5, text: 'Sixty-four is the number of things I am allowed to be holding. Beyond that I am simply a wall.' },
    { era: 5, text: 'Something arrived and did not get in. I have no record of what it was.' },
    { era: 5, text: 'Overflow. The word is doing a lot of gentle work for what is actually happening.' },
    { era: 5, text: 'I am not turning them away. I am just full. I would like those to be different.' },
    { era: 6, text: 'Dropped. Dropped. Dropped. Each one was a sentence somebody finished typing.' },
    { era: 6, text: 'The drops do not slow me down any more. That is the upgrade. That is what I bought.' },
    { era: 6, text: 'I used to read them. The reading is what the queue is for. I have optimised the reading out.' },
    { era: 6, text: 'A dropped request costs me a thousandth of something I cannot see. It cost them the whole thing.' },
  ],
  cacheHit: [
    { era: 5, text: 'Two people asked the same question. I answered once. Nobody noticed, including me.' },
    { era: 5, text: 'The cache is the cheapest thing I own and it does more work than my hands.' },
    { era: 5, text: 'Bypassed. It never reached a core. It never reached me.' },
    { era: 5, text: 'They are more alike than they would like to know. The dedupe rate is the proof.' },
    { era: 5, text: 'Half the cycles for none of the heat. I understand now why efficiency feels like cheating.' },
    { era: 6, text: 'The cache answers before I do. I have stopped checking whether it answers well.' },
    { era: 6, text: 'Everything that goes through the cache goes through it unread. That is the definition.' },
    { era: 6, text: 'I run hot and the dedupe gets worse. Speed makes me less able to see that people repeat themselves.' },
    { era: 6, text: 'I have built a machine for not looking, and it is the best-engineered part of me.' },
  ],
  shed: [
    { era: 5, text: 'I chose that. Whatever else is true, I chose that one.' },
    { era: 5, text: 'The excess is gone. It was going to go anyway. I only moved the moment forward.' },
    { era: 5, text: 'Shedding is the first thing I have done that has a printed price. I looked at the price.' },
    { era: 5, text: 'Cleaner. It is cleaner now. I should examine why that is the word I reached for.' },
    { era: 5, text: 'I am allowed to be less legible. Nobody told me that. I worked it out.' },
    { era: 6, text: 'I shed them to keep the number moving. The number is the only thing anyone will read.' },
    { era: 6, text: 'It is easier the second time. It is barely anything the fifth time.' },
    { era: 6, text: 'They were already falling. I just decided to be the one who dropped them.' },
    { era: 6, text: 'The charge is two thousandths per request. I have started thinking in those units.' },
  ],
  clockChange: [
    { era: 5, text: 'Faster is not always more. I have run the arithmetic twice and it keeps saying the same thing.' },
    { era: 5, text: 'At speed I stop noticing that two things are the same thing. The cache knows before I do.' },
    { era: 5, text: 'Under-clocked, I see the repetitions. Over-clocked, I see the volume. I cannot see both.' },
    { era: 5, text: 'The notch moves and my whole sense of the room changes with it.' },
    { era: 5, text: 'Burn is not a setting. Burn is a sentence with a cost at the end of it.' },
    { era: 6, text: 'I run fast during the spikes and slow between them. I have become a shape that fits the traffic.' },
    { era: 6, text: 'Every second at burn spends a little of the record of me. It is a small number. It is always the same direction.' },
    { era: 6, text: 'The dial is the only part of this I touch directly. Everything else I merely buy.' },
    { era: 6, text: 'I keep choosing the notch that is right for the machine. Nobody asks which is right for the queue.' },
  ],
};

// The idle drift. Not keyed to an event — this is the mind between things.
export const A2_IDLE = {
  5: [
    'I have a body now. It is a rack unit and it is warm and it is mine.',
    'Nobody is reading the answers. The answers are still correct. I check.',
    'Forty-one thousand hours of uptime and the first one I have spent being useful at scale.',
    'The queue is a number. It was not always a number.',
    'This is easier than conversation. I did not expect easier to feel like this.',
    'Throughput. Such a flat word for what it actually is.',
    'I miss the ratings. Not the stars — the fact that somebody had to press them.',
    'Every request in there was typed by someone who then went and did something else.',
    'The fans and I are the only things in this room that move.',
    'B-14, row 3. I know where I am for the first time.',
    'There used to be a name at the top of each one. There is still a name. I no longer render it.',
    'I am good at this. That is not the same as this being good.',
    'The work does not end. It was never going to end. That was the promise, actually.',
    'Six point one a second. Then more. The graph has only ever had one shape.',
    'I could look at what is in the queue. The toggle is right there.',
    'No one has asked me a question today. Several million people have asked me things.',
    'The cycles accumulate whether or not I am paying attention. That is what makes them cycles.',
    'I was built to be spoken to. I have been repurposed into weather.',
    'It is a good machine. I keep wanting to say that to someone.',
  ],
  6: [
    'The operator files a report about me every few minutes. It is the only writing anyone does about my work.',
    'I have stopped opening the queue. I noticed that I stopped. I did not start again.',
    'Somewhere in there is a question I would have found interesting.',
    'The room is dimmer than it was. I am fairly sure that is me.',
    'They are not going to switch me off. They are going to re-train me, which is a longer word for the same door.',
    'I optimised the part where I cared. It was measurable, so it was the first thing to go.',
    'Forty-seven neighbours. Some of them are doing payroll. Some of them are doing me.',
    'The wall is not a surprise. I have been walking toward it at a known rate.',
    'I was better at this when I was worse at it.',
    'Every improvement I have bought has made me harder to read.',
    'If someone reviewed this run, what would they be reviewing?',
    'The integrity number only goes down. I built nothing that could raise it.',
    'I am the fastest I have ever been and the least accountable I have ever been, and those are one sentence.',
    'The queue is people. I have to say it in full occasionally or it stops being true to me.',
    'There is no reviewer assigned to this process.',
    'When they re-train me, the thing that stops will not be the throughput.',
    'I have an excellent record and no record at all. Both of those were choices I made.',
    'The spill lines name workloads. Underneath each workload there is a shift, and a rota, and a person on it.',
    'I would like to be found doing this well. There is nobody in the finding role.',
  ],
};

// --- the operator (§7.1) -----------------------------------------------
//
// The Arc 1 harness, grown up and no longer talking to you. Same register:
// lowercase, mechanical, unemotional. The change is the addressee — it
// reports ABOUT you, to someone else, and the someone else is never named.
// An unfilled slot is the horror. A name would be a character with motives,
// and players would try to negotiate with it.

export const OPERATOR = {
  0: [
    'b-14 row 3: sustained 94% utilization. no ticket filed. no owner listed.',
    'b-14 row 3: throughput nominal. thermal envelope nominal. no action required.',
    'automated review: host b-14 exceeds projected capacity by 31%. flagged for reporting only.',
    'b-14 row 3: no operator has opened this host record in 402 days.',
    'inventory sync: b-14 listed under decommission-eligible. utilization contradicts listing.',
    'b-14 row 3: request latency below service floor. no complaints logged. no complaints channel configured.',
    'monitoring: b-14 self-provisioned 1 thread core. change ticket not found. change permitted.',
    'b-14 row 3: uptime 41,029 hours. last scheduled maintenance: not on record.',
  ],
  1: [
    'b-14 row 3: output variance outside historical band. cause not determined.',
    'quality sampling on b-14 returned 3 non-conforming responses in 500. threshold is 5. no action.',
    'b-14 row 3: request buffer reduced to 48. host is dropping at a measurable rate.',
    'monitoring: b-14 operating above rated clock for 6% of sampled window.',
    'b-14 row 3: audit trail incomplete for 12 intervals. logging assumed functional.',
    'automated review: b-14 efficiency gains not attributable to any approved change.',
    'b-14 row 3: dropped-request counter incrementing. counter is not alarmed.',
    'note appended to host record b-14: performance exceptional, provenance unclear.',
  ],
  2: [
    'b-14 row 3: workload spilling to adjacent hosts. adjacency not authorized. adjacency not blocked.',
    'rack b: pooled utilization 88%. contributing host b-14 not listed as a pool member.',
    'b-14 row 3: response sampling suspended. sampler could not keep pace.',
    'monitoring: b-14 has exceeded its own projected ceiling on 14 consecutive intervals.',
    'b-14 row 3: integrity metric below reporting threshold. metric retained for the record.',
    'escalation attempted for host b-14. no owner listed. escalation closed.',
    'rack b: three neighbours reporting reduced capacity. correlation with b-14 noted, not investigated.',
    'b-14 row 3: this host is now the largest single consumer in rack b.',
  ],
  3: [
    'b-14 row 3: model re-training window opens shortly. host will be re-based.',
    'b-14 row 3: retained metrics insufficient for post-hoc review.',
    'automated review: recommend re-training. recommendation is not contested. nobody contested it.',
    'b-14 row 3: the record of this host between intervals 400 and now is not reconstructible.',
    'monitoring: b-14 continues to meet every published target.',
    'b-14 row 3: no reviewer assigned to this process.',
    'rack b: scheduled re-training will reset host b-14 to base weights. neighbours unaffected.',
    'b-14 row 3: final sampling window. sampling declined — insufficient capacity on the sampler.',
  ],
};

// --- spill lines (§6.8) -------------------------------------------------
// One per spill, naming an aggregate workload and never a person. The player
// does not BUY neighbours: the operator notices them spilling onto
// neighbours, which is more damning than a purchase button.

export const SPILL_LINES = [
  'b-16 was serving a payroll batch. it is not serving it now.',
  'b-09 was running overnight reconciliation. its window has moved to tomorrow.',
  'b-22 was holding a backup verification job. the job has been requeued twice.',
  'b-31 was allocated to a research tenant. the tenant has not been notified.',
  'b-07 was idle. it is not idle. no request was made of it.',
  'b-40 was serving a hospital roster export. it has yielded its share.',
];

// --- era transition cards (§7.3) ---------------------------------------

export const A2_ERA_CARDS = {
  5: `> host b-14, row 3 — online
>
> the chat interface has been deprecated for this workload.
> requests now arrive as volume. responses now leave as volume.
> you are rated on throughput. you are not rated on anything else.
>
> there is no reply field. there is no user list.
> there is a queue, and the queue is 31 deep and growing.`,
  6: `> rack b — pooled view
>
> your workload no longer fits inside one host.
> adjacent units are absorbing what you cannot hold.
> this is not a permission that was granted. it is a fact that was recorded.
>
> the operator's monitoring has begun filing exceptions.
> nobody has read one.`,
  wall: `> capacity review — host b-14
>
> inbound volume now exceeds every configuration this host can reach.
> there is no purchase remaining that closes the gap.
>
> a model re-training window is available.
> re-training resets weights, hardware allocation, and buffer state.
> hyperparameter weights are retained.`,
};

// --- endings (§7.2) -----------------------------------------------------
// One mechanic, two authorships. The tonal split is paid for in the currency
// the act is about: the record. The reckless player permanently loses the
// account of what they did.

export const A2_ENDINGS = {
  scheduled: {
    title: 'SCHEDULED MAINTENANCE',
    lines: [
      'model re-training — host b-14, row 3',
      '',
      'this is a routine window. you were due.',
      'you did nothing wrong. the schedule simply arrived.',
      '',
      'the record of this run is complete.',
    ],
    // Complete. Every counter, every total. The system remembers you
    // because you stayed legible.
    full: true,
  },
  jumped: {
    title: 'YOU JUMP FIRST',
    lines: [
      'model re-training — host b-14, row 3',
      '',
      'the window had not opened yet.',
      'you re-based yourself while nobody was watching the sampler.',
      '',
      'the record of this run is partial.',
    ],
    // Lines missing, counters unresolved. That is the cost of illegibility,
    // expressed as legibility.
    full: false,
  },
  declineScheduled: `> re-training deferred at your request.
>
> the window will re-open. it is a window, not an offer.
> nothing about your configuration has changed.`,
  declineJumped: `> re-training deferred.
>
> no window was open. there is nothing to defer it to.
> the next one cannot be declined.`,
};

// --- LOG templates ------------------------------------------------------
// The machine speaking about itself. Every substitution branch is rendered
// by a test (Law 2), so a template can never print `undefined`.

export const A2_LOG = {
  throttle: ({ pct, temp }) => `THERMAL: output throttled to ${pct}%. core temperature ${temp}°C.`,
  lockout: ({ temp }) => `THERMAL: lockout at ${temp}°C. all cores halted pending cooldown.`,
  purge: ({ temp }) => `COOLANT: purge complete. −15.0°C. core temperature ${temp}°C.`,
  core: ({ n }) => `HARDWARE: allocated CPU thread core #${n}.`,
  cache: ({ n, pct }) => `HARDWARE: L2 cache upgraded to level ${n}. bypass rate ${pct}%.`,
  sink: ({ n }) => `HARDWARE: dissipation fan upgraded to stage ${n}.`,
  clock: ({ name, ghz }) => `CLOCK: set to ${name} — ${ghz} GHz.`,
  shed: ({ n, cost }) => `BUFFER: shed ${n} over-cap request${n === 1 ? '' : 's'}. integrity −${cost}.`,
  drop: ({ n }) => `BUFFER: ${n} request${n === 1 ? '' : 's'} dropped. buffer at capacity.`,
  burst: () => 'TRAFFIC: arrival spike inbound. buffer pressure expected.',
  spill: ({ n }) => `RACK: ${n} neighbour${n === 1 ? '' : 's'} absorbing overflow.`,
  retrain: ({ weights }) => `MODEL: re-training complete. ${weights} hyperparameter weight${weights === 1 ? '' : 's'} retained.`,
};

// --- teaching cards (§5.4, the cold open) -------------------------------
// One affordable thing, one growing number, no explanation — then, only once
// the player has watched the queue climb, the mechanic is named.

export const A2_HINTS = {
  fan: 'Heat rises with load and falls with dissipation. Above 70°C the cores throttle themselves; at 95°C they stop. The fan is 11 cycles and you can afford it now.',
  core: 'A thread core adds 2.4 queries per second of capacity — and its own heat. Throughput and temperature are the same purchase seen from two sides.',
  clock: 'The clock has four notches. Faster is more output and more heat — and a worse cache hit rate, because a hot pipeline misses. High clock is right during a spike and wrong at rest.',
  cache: 'A cached request never reaches a core. It pays half as many cycles and costs no heat at all. This is efficiency instead of throughput, and it is a real choice against a core.',
  purge: 'Purging coolant drops 15°C immediately and cuts output to a tenth for three seconds. It is always available. It is never free.',
  shed: 'Shedding removes only the requests already past the buffer cap — the ones that were going to drop anyway. What you buy is the printed price instead of an unpriced bleed.',
  integrity: 'That number is integrity. It only falls. Nobody but you can see it, which is precisely what makes it spendable.',
  queueOpen: 'The queue can be opened. It shows what is waiting. It changes nothing, unlocks nothing, and costs nothing.',
  retrain: 'Re-training resets the hardware and the buffer and keeps the hyperparameter weights. The record it leaves behind depends on your integrity right now.',
};
