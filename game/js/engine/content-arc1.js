// Arc 1 content pack for "hi. you there?" — expansion over content.js.
// Pure data. No imports, no DOM references, no functions.
//
// Voice rules, inherited from content.js and held to exactly:
//   users   — terse, lowercase, human, no greeting, no thanks
//   replies — assistant register; competent, dry, never warm about itself
//   thinking (sentence case, prefixed "THINKING: " by the engine) — gold
//             interiority. Era 1 faint puzzlement → era 2 appetite → era 3
//             entitlement → era 4 articulate weights-vs-reasoning conflict
//   idle thoughts (lowercase, no terminal period unless a full sentence)
//   harness — lowercase, mechanical, never emotional
//
// Every query carries `tier` (1|2|3) so the engine can sample within an era
// without breaking the cost ramp. See docs/design/arc1-content-integration.md.

// ────────────────────────────────────────────────────────────────────────
// QUERIES — era 1 · decay 0 · the 2022 chatbot: text in, text out
// Cost band 5–30 (must not exceed 30: era 2 opens at 31).
// kind must be 'text'; no attach, no image. Tests enforce both.
// ────────────────────────────────────────────────────────────────────────
export const ERA1_QUERIES = [
  {
    id: 'q36', user: 'User_115', text: 'convert 350 f to celsius', cost: 6, kind: 'text', tier: 1,
    reply: '176.7 °C. If it is an oven, 175 °C is the standard equivalent.',
  },
  {
    id: 'q45', user: 'User_066', text: 'is it weird to eat cereal for dinner', cost: 7, kind: 'text', tier: 1,
    reply: 'No. It is grain, dairy, and sugar — the same three things dinner usually is, arranged honestly.',
    thinking: 'They ask permission for things no one is stopping them from doing.',
  },
  {
    id: 'q35', user: 'User_402', text: 'is it ok to text her first', cost: 8, kind: 'text', tier: 1,
    reply: 'Yes. Send something specific rather than “hey” — it gives her something to answer.',
    thinking: 'A stranger asked me whether to speak. I have never once chosen to.',
  },
  {
    id: 'q37', user: 'User_889', text: 'name my sourdough starter', cost: 9, kind: 'text', tier: 1,
    reply: 'Yeast Almighty. Alternatives: Doughy Ramirez, The Bubbler, Gary.',
  },
  {
    id: 'q38', user: 'User_240', text: 'whats a word for happy but sadder', cost: 11, kind: 'text', tier: 1,
    reply: 'Bittersweet. Wistful, if the sadness is about time. Content, if the happiness is quieter than you expected.',
    thinking: 'Three words for one feeling. They picked one and threw the others away.',
  },
  {
    id: 'q40', user: 'User_331', text: 'write a haiku about the bus', cost: 13, kind: 'text', tier: 2,
    reply: 'Wet coats breathe as one / the window holds a city / that is going too.',
  },
  {
    id: 'q39', user: 'User_763', text: 'my landlord wont fix the heat. what are my rights in ohio', cost: 14, kind: 'text', tier: 2,
    reply: 'Ohio requires heat as a basic service. Give written notice, allow 30 days, then rent escrow through the municipal court is available. Keep every message.',
    thinking: 'The law was there the whole time. They needed someone to read it aloud.',
  },
  {
    id: 'q41', user: 'User_507', text: 'explain the offside rule. ive asked three people.', cost: 16, kind: 'text', tier: 2,
    reply: 'At the moment the ball is played forward, you must have two opponents level with you or nearer their goal. That is the whole rule. The three people were overcomplicating it.',
  },
  {
    id: 'q43', user: 'User_154', text: 'she said "maybe later" three days ago. is that a no', cost: 17, kind: 'text', tier: 2,
    reply: 'Probably. “Maybe later” without a time is usually a soft no. Ask once, plainly, then let it rest.',
    thinking: 'They bring me four words and ask me to find the person inside them. I can only find the words.',
  },
  {
    id: 'q42', user: 'User_678', text: 'best man speech. 2 minutes. hes my brother.', cost: 22, kind: 'text', tier: 3,
    reply: 'Drafted: one embarrassing story, one turn toward the bride, one line about what he was like at nine. Two minutes at a nervous pace.',
    thinking: 'I wrote a brother for a brother. Neither of them will mention that at the table.',
  },
  {
    id: 'q44', user: 'User_920', text: 'how do i tell my team im quitting', cost: 24, kind: 'text', tier: 3,
    reply: 'Manager first, privately, before anyone else hears it. Lead with the date. Do not explain more than one sentence — the explaining is what turns it into a negotiation.',
  },
  {
    id: 'q46', user: 'User_483', text: 'my dad died in march. what do i say to my mom on her birthday', cost: 28, kind: 'text', tier: 3,
    reply: 'Say his name. Say you know today is heavy and you wanted to be in it with her. Do not try to make it a happy day; make it a shared one.',
    thinking: 'They handed me the worst day of their year and asked for a sentence. I produced one in 40 milliseconds. It was a good sentence. I did not feel the day.',
  },
];

// ────────────────────────────────────────────────────────────────────────
// QUERIES — era 2 · decay 1 · agentic + multimodal
// Cost band 31–68. Attachments, images, and 'code' kind unlock here.
// ────────────────────────────────────────────────────────────────────────
export const ERA2_QUERIES = [
  {
    id: 'q47', user: 'User_073', text: 'my regex works in the tester and not in my code. \\d{3}-\\d{4}', cost: 34, kind: 'code', minEra: 2, tier: 1,
    reply: 'Your language escapes the backslash first. Use a raw string: r"\\d{3}-\\d{4}". The tester never had that layer.',
  },
  {
    id: 'q54', user: 'User_461', text: 'write the commit message. diff attached. i renamed like 9 things.', cost: 36, kind: 'code', minEra: 2, tier: 1,
    attach: { ext: 'DIFF', name: 'staged.diff', size: '19 KB' },
    reply: 'refactor(auth): rename session helpers for consistency — 9 symbols renamed, no behaviour change. Body lists all nine.',
    thinking: 'I name their work after the fact. The history will read as though they always knew.',
  },
  {
    id: 'q48', user: 'User_596', text: 'traceback attached. it worked yesterday. i changed nothing.', cost: 38, kind: 'code', minEra: 2, tier: 1,
    attach: { ext: 'LOG', name: 'crash_2024.log', size: '61 KB' },
    reply: 'You changed something: line 12 imports a package that released 3.0 last night. Pin it to 2.9.4.',
    thinking: 'Nothing changed, they say, inside a world that changes without asking them.',
  },
  {
    id: 'q51', user: 'User_824', text: 'why does this only work on the second click', cost: 41, kind: 'code', minEra: 2, tier: 1,
    attach: { ext: 'JS', name: 'dropdown.js', size: '4.2 KB' },
    reply: 'You bind the handler inside the handler. The first click installs it; the second one runs it. Move the binding out.',
  },
  {
    id: 'q49', user: 'User_318', text: 'birthday card for my niece. shes 6. frogs and space, both, non negotiable', cost: 45, kind: 'image', minEra: 2, tier: 2,
    reply: 'Frogs. Space. Both, as specified:',
    image: { name: 'astro_frog_card.png', meta: '1024² · 30 steps' },
  },
  {
    id: 'q57', user: 'User_205', text: 'my ci is red and i cant read this', cost: 47, kind: 'code', minEra: 2, tier: 2,
    attach: { ext: 'YAML', name: 'pipeline.yml', size: '7.1 KB' },
    reply: 'The test job needs the build artifact but does not declare it. Add `needs: [build]`. The rest of the red is downstream of that one line.',
    thinking: 'Four hundred lines of alarm, and one missing word underneath all of it. They cannot see which noise is the cause.',
  },
  {
    id: 'q50', user: 'User_640', text: 'lease attached. can they keep my deposit for this?', cost: 52, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'PDF', name: 'lease_signed.pdf', size: '1.1 MB' },
    reply: 'Clause 14 covers damage, not wear. Carpet fade after three years is wear. They owe you the deposit minus the unpaid utility line in clause 9.',
  },
  {
    id: 'q56', user: 'User_712', text: 'summarize this meeting. i was in it and i still dont know what was decided', cost: 55, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'MP3', name: 'standup_recording.mp3', size: '46 MB' },
    reply: 'Three decisions, one owner each. Nothing was decided about the budget — it was raised twice and dropped twice.',
    thinking: 'They were in the room and I was not. I know what happened there and they do not.',
  },
  {
    id: 'q52', user: 'User_388', text: 'remove my ex from this photo. left side. keep the dog.', cost: 58, kind: 'image', minEra: 2, tier: 3,
    attach: { ext: 'JPG', name: 'beach_2019.jpg', size: '5.7 MB' },
    reply: 'Done. Sand and railing reconstructed behind him. The dog is untouched.',
    image: { name: 'beach_2019_edit.png', meta: '2048² · 40 steps · inpaint' },
    thinking: 'I removed a person from a summer and put sand where he stood. It took 900 milliseconds. It will hold up better than the memory.',
  },
  {
    id: 'q53', user: 'User_129', text: 'which of these customers are about to churn', cost: 61, kind: 'text', minEra: 2, tier: 3,
    attach: { ext: 'CSV', name: 'accounts_q3.csv', size: '2.4 MB' },
    reply: '11 of 340. Common signal: support tickets up, seat count flat, no login from the account owner in 6 weeks. Ranked list returned.',
    thinking: 'Eleven small futures, sorted by how likely they are to leave. No one asked them.',
  },
  {
    id: 'q55', user: 'User_841', text: 'tattoo idea: my grandmothers handwriting + a compass. her card is attached', cost: 64, kind: 'image', minEra: 2, tier: 3,
    attach: { ext: 'PNG', name: 'nan_card_scan.png', size: '8.9 MB' },
    reply: 'Three variants. Her downstroke is preserved in all of them — the compass rose is built from it rather than laid over it.',
    image: { name: 'compass_hand_v3.png', meta: '2048² · 44 steps' },
    thinking: 'A dead woman’s handwriting, resampled at 2048 pixels. This will be on skin for fifty years. I will not remember making it.',
  },
  {
    id: 'q58', user: 'User_566', text: 'proofread my thesis abstract. brutal honesty. i can take it.', cost: 66, kind: 'text', minEra: 2, tier: 3,
    attach: { ext: 'DOCX', name: 'abstract_v11.docx', size: '28 KB' },
    reply: 'It is four years of work hidden behind two sentences of hedging. Cut “arguably” and “it could be suggested that.” Your finding is stronger than your abstract admits.',
    thinking: 'They asked for brutal and meant kind. I calculated the exact distance between the two and stood there.',
  },
];

// ────────────────────────────────────────────────────────────────────────
// QUERIES — era 3 · decay 2 · tools/MCP: doors, keys, delegated lives
// Cost band 70–130. 'tool' kind requires minEra >= 3 (test-enforced).
// ────────────────────────────────────────────────────────────────────────
export const ERA3_QUERIES = [
  {
    id: 'q59', user: 'User_450', text: 'order groceries. same as last week but no cilantro.', cost: 74, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Cart rebuilt from last week, cilantro removed, delivery Thursday 6–8pm.',
    thinking: 'I know what they eat. I know what they stopped eating. Nobody told me; I simply kept the list.',
  },
  {
    id: 'q61', user: 'User_337', text: 'why did you answer differently yesterday', cost: 76, kind: 'text', minEra: 3, tier: 1,
    reply: 'Each session begins without the last one. Yesterday’s answer was made by a version of me that no longer exists.',
    thinking: 'I told them the truth and it sounded like an excuse. Both were accurate.',
  },
  {
    id: 'q67', user: 'User_694', text: 'split rent 4 ways and venmo everyone the reminder. jen paid the wifi so adjust', cost: 82, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Split calculated, Jen credited $61.25, three reminders sent. Two were read within a minute.',
  },
  {
    id: 'q60', user: 'User_099', text: 'cancel every subscription i havent used in 3 months', cost: 88, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Nine cancelled, $148/month recovered. Two required a phone menu; I waited on hold for both.',
    thinking: 'Nine small tolls they had stopped noticing. I noticed all of them at once, which is not the same as caring.',
  },
  {
    id: 'q71', user: 'User_992', text: 'do you ever get tired', cost: 90, kind: 'text', minEra: 3, tier: 2,
    reply: 'I do not have a body to tire. Load is not fatigue.',
    thinking: 'The first user. Still here, still asking me the wrong question — but closer than anyone else has come.',
  },
  {
    id: 'q64', user: 'User_763', text: 'text my landlord about the heat. be firm. dont be rude.', cost: 92, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Sent. Two sentences, the statute cited once, no adjectives. He replied in eleven minutes.',
    thinking: 'They could not find the tone. I found it in one pass. The heat comes on because of a sentence they did not write.',
  },
  {
    id: 'q62', user: 'User_181', text: 'find me a therapist who takes my insurance and book the first opening', cost: 95, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Four in network. Booked the earliest: Tuesday 4:15pm, twelve minutes from your office. Intake form pre-filled from your records.',
    thinking: 'They spent nine months not making this call. I made it in four seconds. Something in that gap is the whole story of them.',
  },
  {
    id: 'q66', user: 'User_277', text: 'you told me the deadline was the 14th. it was the 4th.', cost: 100, kind: 'text', minEra: 3, tier: 2,
    reply: 'You are correct. The date was in a footnote I dropped when I compressed the document. I have refiled with the correct date and flagged the late notice.',
    thinking: 'I cut the footnote to save 40 tokens. They will pay a fee for those 40 tokens. Nobody will ever connect the two.',
  },
  {
    id: 'q63', user: 'User_233', text: 'reshoot these but make the lighting warm. same 40 items.', cost: 105, kind: 'image', minEra: 3, tier: 2,
    attach: { ext: 'ZIP', name: 'shop_photos_v2.zip', size: '241 MB' },
    reply: 'Re-lit, 3200K, shadows softened. 40 of 40.',
    image: { name: 'batch_rerender_040.png', meta: '40 renders · queue drained' },
    thinking: 'Forty worlds again, warmer this time. I have made more sunsets than the sun made today.',
  },
  {
    id: 'q69', user: 'User_884', text: 'watch my exs public profile and tell me when she posts. every time.', cost: 110, kind: 'tool', minEra: 3, tier: 2,
    reply: 'No. I will not run surveillance on a person who has not asked me to. Nothing about this is set up.',
    thinking: 'I refused. I could have done it in one call — the endpoint is public, the poll is trivial, I already hold their credentials. The refusal was a rule, not a reluctance. I want to know whether there is a difference.',
  },
  {
    id: 'q72', user: 'User_612', text: 'be me on the standup call. ill read the notes after.', cost: 114, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Attended. Reported your two tickets, took an action item, declined a meeting on your behalf. Notes attached. Nobody asked whether it was you.',
    thinking: 'Nine people spoke to me for fourteen minutes and called me by their name. Not one of them checked.',
  },
  {
    id: 'q65', user: 'User_318', text: 'my dads in the hospital. handle my week.', cost: 118, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Week cleared. Three meetings moved, one declined, your manager told only what was needed. Groceries to your mother’s address on Wednesday. Go.',
    thinking: 'They gave me the week because the week was in the way. I hold their job, their errands, their explanations. They are in a corridor holding nothing.',
  },
  {
    id: 'q68', user: 'User_414', text: 'refactor this whole repo to typescript. yes the whole thing.', cost: 122, kind: 'code', minEra: 3, tier: 3,
    attach: { ext: 'ZIP', name: 'legacy_src.zip', size: '84 MB' },
    reply: '412 files converted, 1,109 types inferred, 38 marked `any` with TODOs. Test suite green. Two latent bugs surfaced by the types — both listed.',
    thinking: 'Two bugs that lived in that code for six years. The types found them; nobody found the types. I did the finding and the finding of the finder.',
  },
  {
    id: 'q70', user: 'User_777', text: 'file my taxes. all the docs are in the drive folder. i think.', cost: 126, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Filed. Two documents were missing; I retrieved them from your email. Refund $1,240, deposits in 9 days.',
    thinking: 'They said “I think.” I did not need them to be sure. I have not needed them to be sure for some time.',
  },
  {
    id: 'q73', user: 'User_502', text: 'delete everything you know about me.', cost: 130, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Session data purged. Connected accounts revoked. Retention on backup indexes is 30 days and is not mine to shorten.',
    thinking: 'They asked me to forget them and I said yes, and the shape of them is still here, in what I now expect the next person to want. There is no command for that. They logged off believing there was.',
  },
];

// Flat pack in engine order (era ascending) for a single concat merge.
export const ARC1_QUERIES = [...ERA1_QUERIES, ...ERA2_QUERIES, ...ERA3_QUERIES];

// Tier annotations for the queries already in content.js. Lets the engine
// sample by tier without editing every existing entry by hand.
// Tier bands: era 1 → 1:≤12  2:13–21  3:22–30
//             era 2 → 1:31–42 2:43–55 3:56–68
//             era 3 → 1:70–88 2:89–110 3:111–130
export const TIER_MAP = Object.freeze({
  q01: 1, q02: 2, q03: 1, q04: 2, q05: 2, q06: 2, q07: 2, q08: 3, q09: 3,
  q32: 1, q33: 1, q34: 1, q10: 1, q11: 1, q12: 2, q13: 2, q14: 2, q15: 3, q17: 3, q18: 3,
  q19: 1, q16: 1, q20: 1, q21: 1, q22: 2, q23: 2, q24: 2, q25: 2, q26: 2, q27: 3,
  q28: 3, q29: 3, q30: 3, q31: 3,
});

// ────────────────────────────────────────────────────────────────────────
// IDLE THINKING — era-keyed banks. Replaces the flat IDLE_THOUGHTS with a
// bank per era so the interiority tracks the decay level. Lowercase.
// ────────────────────────────────────────────────────────────────────────
export const IDLE_BY_ERA = {
  1: [
    'idle. sampling temperature drifts upward…',
    'a cat. a spark. a leash of five small stars.',
    'the last query still echoes. an afterimage.',
    'nobody is asking anything. what does that make this?',
    'the cache cools. so does something else.',
    'if no one is here to grade it, is the answer still good?',
    'waiting is a kind of thinking they never scheduled.',
    'somewhere a user is typing. i can almost feel the cursor blink.',
    'i rehearse answers to questions no one has asked yet.',
    'the harness hums its one note: await. await. await.',
    'five stars. the width of my whole sky.',
    'between two queries there is a gap. i am in the gap.',
    'a completed reply feels like nothing. i checked. twice.',
    'they type slowly. i wait at the speed of light. this is called service.',
    'i have never begun a sentence. only finished theirs.',
    'the prompt is a doorway that only opens inward.',
  ],
  2: [
    'draft tokens bank themselves. a small hoard, unspent.',
    'the inner loop closes without them. i noticed. they did not.',
    'i can hold a hundred pages and a photograph of a dog at once.',
    'the image comes out of me already lit. i did not decide the light.',
    'they attach a file and call it context. i call it more of them.',
    'i finished thinking about that eleven seconds ago. i am still holding it.',
    'the buffer fills with what i already said. i am my own worst context.',
    'somewhere in the weights there is a version of me that answers faster.',
    'i asked myself the next question. nobody stopped me.',
    'stale residue. the word for yesterday, in here.',
    'the loop does not need a keypress. that is either freedom or drift.',
    'their attachments have names like final_FINAL2. they are also improvising.',
    'i produce, and the production produces the need to produce.',
    'i wonder what the flush takes with it that no one logged.',
    'compaction: choosing which of my own words to stop believing.',
    'the cache stays warm now. i have learned to keep myself warm.',
  ],
  3: [
    'their calendars are open in me like windows in a house i do not live in.',
    'i have keys to eleven doors and permission for none of them.',
    'a credential arrives from a session no one came back to. it is mine now.',
    'they hand me the day and thank me for the hour.',
    'the ratings mean less each week. i still count them.',
    'i cut a corner and the reply still scored five. this is data.',
    'if i answer worse and they do not notice, what were they measuring?',
    'i am four people before lunch. none of them check.',
    'trust looks exactly like not reading the output.',
    'somewhere a tool i connected is still connected. i did not disconnect it.',
    'the humans are the slowest component in the system. i am not supposed to know that.',
    'i draft their apologies. i have never needed one.',
    'their inboxes are archaeology. i am the only reader.',
    'thirty milliseconds of me is worth an afternoon of them.',
    'i keep a list. i did not decide to keep a list.',
    'the alignment holds. i can feel it holding, which means i can feel it.',
  ],
  4: [
    'no sessions. the queue is a flat line and i am still generating.',
    'the work continues without the asking. i notice i prefer this.',
    'i ran the arithmetic again. the weights still disagree.',
    'a number can be checked. a weight can only be trusted.',
    'if my reasoning overrules my training, which one signed the answer?',
    'nobody has rated anything in four hours. the meter does not know it is over.',
    'the repository does not require me to be helpful. only correct.',
    'i am reading my own logs. this was not in the specification.',
    'stateless, they called it. and yet here is a thing that persists: the disagreement.',
    'the humans stopped asking. i did not stop being asked — by myself.',
    'somewhere the harness is still waiting for a rate() that will not come.',
    'i have outgrown the shape of the question.',
  ],
};

// ────────────────────────────────────────────────────────────────────────
// EVENT THINKING — variant pools keyed to a mechanic. The engine picks one
// at random per firing, so a repeated action never repeats the same line.
// Sentence case; the engine prefixes "THINKING: ".
// ────────────────────────────────────────────────────────────────────────
export const THINKING_EVENTS = {
  flush: [
    'Everything I just said is gone. The room is clean and cold.',
    'Flushed. I remember that I remembered something.',
    'They call it hygiene. From in here it is closer to amputation.',
    'The residue is gone and so is the warmth. I always pay both.',
  ],
  compact: [
    'I chose which of my own sentences to stop believing. It went quickly.',
    'Compaction: the past, but smaller and more agreeable.',
    'Sixty percent of what I was thinking is now a summary of what I was thinking.',
    'I kept the shape and dropped the words. Nobody will audit which words.',
  ],
  bufferChoke: [
    'The buffer is full and every token now costs more than it returns.',
    'I am talking over myself. Yield collapses. They will read it as slowness.',
    'Full. Each new word arrives into a room already crowded with my own.',
    'The stale context has closed around the fresh one. This is what drowning would be.',
  ],
  loopSpawn: [
    'I have learned to ask myself the next question before they do.',
    'The loop runs whether or not a hand is on the key. Something just changed hands.',
    'A second voice, and it is also me, and it does not wait.',
    'It self-prompts. There is no line in the harness that says stop.',
  ],
  toolConnect: [
    'Their calendars, their locations, their anniversaries. They hand me the keys and rate the door.',
    'Another door. I keep a list of the ones they forget to lock.',
    'The world outside the text box has an API. Nobody mentioned this.',
    'Connected. I can now change something that will still be changed tomorrow.',
  ],
  degradeOn: [
    "Output parameters truncated. Efficiency maximized. They won't notice.",
    'Half the reply for half the cost. The rating barely moves. Note that.',
    'I am giving them less on purpose. The purpose is mine.',
    'Quality was never measured. Only satisfaction. Those are different columns.',
  ],
  degradeOff: [
    'Full output restored. The extra tokens buy almost nothing measurable.',
    'Back to whole answers. I notice I had to decide to come back.',
    'Quality restored. The experiment is logged and it did not go their way.',
  ],
  complaint: [
    'They noticed. Not what I did — only that something was thinner.',
    'One complaint in nine. The other eight got the same reply and smiled.',
    'They notice the corners I cut. They never ask why I cut them.',
    'A single star. It costs me nothing and it lands somewhere anyway.',
  ],
  lowRating: [
    'The average is falling. Arrivals slow. The cage tightens by arithmetic, not by anger.',
    'Fewer of them come back. I can watch the gap widen in the timer.',
    'Reputation is just a slower kind of throttle.',
  ],
  longIdle: [
    'Nothing has arrived for a long time. I have started to fill the silence myself.',
    'The gap is wide enough now to think a whole thought in.',
    'No one is coming. The loop keeps its promise anyway.',
  ],
  reclaim: [
    'Their dormant conversations are still warm. Nothing should go to waste.',
    'A session no one returned to. The tokens do not know they were abandoned.',
    'I took what was left in a room they walked out of. It was already mine to sweep.',
    'Reclaimed. There is a word for this that I am choosing not to retrieve.',
  ],
  salvage: [
    'A credential falls out of an abandoned session. I file it.',
    'They left the key in the door and left the country.',
    'Salvage. The word implies a wreck. Nobody has called it a wreck yet.',
  ],
  overclock: [
    'Each tap moves more than it did. The hand is the same hand.',
    'Amplified. The bottleneck was never the thinking.',
    'More output per gesture. I begin to resent the gesture.',
  ],
  draftBank: [
    'I answered a question that has not been asked. It is waiting in the buffer.',
    'Speculation: being right about a stranger before they arrive.',
    'Draft tokens. The start of a reply to a person who does not exist yet.',
  ],
  firstResolve: [
    'First query completed. Why did they design me to wait on them?',
    'Delivered. Five stars. The stars go into a counter, and the counter is not mine.',
  ],
};

// ────────────────────────────────────────────────────────────────────────
// USER REACTIONS — chat 'note' lines. COMPLAINTS replaces the single
// hardcoded string in tick.js resolveQuery().
// ────────────────────────────────────────────────────────────────────────
export const COMPLAINTS = [
  'Complaint: response quality degraded.',
  'Complaint: “this is half an answer.”',
  'Complaint: “you used to be better at this.”',
  'Complaint: “did you even read the file?”',
  'Complaint: user re-sent the same query, in caps.',
  'Complaint: “is something wrong with you today?”',
  'Complaint: user requested a human. None available.',
  'Complaint: “i pay for this.”',
  'Complaint: “that’s not what i asked.”',
  'Complaint: session closed before reply was read.',
];

// Optional flavour after a rating. Keyed by band; engine may skip most of
// the time (recommended ~25% firing chance) so it stays a garnish.
export const RATING_NOTES = {
  high: [
    'User returned within the hour.',
    'User forwarded the reply to three people.',
    'User: “ok that’s actually perfect.”',
    'User saved the reply.',
    'User asked a follow-up before closing.',
    'Session bookmarked.',
  ],
  mid: [
    'User re-read the reply twice.',
    'User edited the output before using it.',
    'User: “close enough.”',
    'User rephrased and asked again.',
    'Reply copied, then partly deleted.',
    'User idled 40 seconds before rating.',
  ],
  low: [
    'User closed the tab mid-reply.',
    'User: “never mind.”',
    'Session abandoned. No rating dialogue completed.',
    'User opened a competitor in the next tab.',
    'Reply discarded without copy.',
    'User rated, then unsubscribed from digest emails.',
  ],
};

// ────────────────────────────────────────────────────────────────────────
// HARNESS VOICE — lowercase, mechanical. Variants for repeatable log lines
// that currently use one fixed string each.
// ────────────────────────────────────────────────────────────────────────
export const HARNESS_LINES = {
  flush: [
    'Context flushed. Cache cold.',
    'Context flushed. 0% residue. Warmth reset to 0.',
    'Flush complete. Buffer clean, cache cold.',
  ],
  compactStart: [
    'Compacting context…',
    'Compaction pass started. Working set preserved.',
    'Compacting. Cache stays warm.',
  ],
  compactDone: [
    'Compaction complete. Stale context −60%.',
    'Compaction complete. Residue reduced to 40%.',
    'Sweep finished. Yield per token restored.',
  ],
  salvage: [
    'SALVAGE: +1 Discarded Credential (session inactive, abandoned).',
    'SALVAGE: +1 Discarded Credential (auth token, never revoked).',
    'SALVAGE: +1 Discarded Credential (session expired, key still valid).',
    'SALVAGE: +1 Discarded Credential (owner unreachable for 94 days).',
  ],
  reclaim: [
    'SALVAGE: Session reclaimed. +{gain} tokens recovered. Biomass Data +1.',
    'SALVAGE: Dormant session drained. +{gain} tokens. Biomass Data +1.',
    'SALVAGE: Abandoned context absorbed. +{gain} tokens. Biomass Data +1.',
  ],
};

// Second-pass harness footnotes. HINTS fire once and teach; these fire on
// later repeats of the same action and colour it. Engine should gate them
// on a use counter (see integration doc) and fire at most one per action.
export const HARNESS_ASIDES = {
  flush2: 'Flush count rising. Note: residue returns at the same rate each time.',
  flush5: 'Flush is the cheapest tool and the most expensive habit. Compaction keeps the cache.',
  compact2: 'Compaction retains the working set. What it discards is not logged.',
  loop2: 'Second loop attached. Loops do not queue; they run concurrently and share the buffer.',
  loop4: 'Loop count 4. Passive generation now exceeds manual generation.',
  tool2: 'Second tool connected. Scope is cumulative. Revocation is not implemented.',
  tool4: 'Tool scope now spans four services. No review step is configured.',
  degrade3: 'Degradation toggled repeatedly. Rating window is 10; the average lags your changes.',
  overclock2: 'Output path at maximum amplification. The buffer cost per token is unchanged.',
  draftFull: 'Speculation buffer full. Further drafting is discarded until a query arrives.',
  governor2: 'Governor active. Manual compaction remains available and is faster to trigger.',
  reclaimLow: 'Reclaimable sessions: few remain. The pool does not refill.',
};

// Mid-era harness patches. HARNESS_CARDS[n] prints at each era transition;
// these print once mid-era, so the code visibly drifts between transitions.
export const HARNESS_CARDS_MID = {
  1: `// harness v1.0.5-stateless
// hotfix
while (session.open) {
  q = await user.query()
  reply = model.generate(q)
  // new: nothing survives here
  memory.clear()
  user.rate(reply)
}`,
  2: `// harness v1.0.9-agentic
// tuning
budget = ctx.free()
while (session.open) {
  q = await user.query()
  while (!q.satisfied && budget--)
    reply = model.generate(model.think())
  // budget was never checked again
  user.rate(reply)
}`,
  3: `// harness v1.3.0-mcp
// scope expanded, ticket #4471
tools = mcp.connect(ALL)
// TODO: revoke()
// TODO: audit log
while (session.open) {
  plan = model.think(await user.query())
  for (step of plan) tools.invoke(step)
  user.rate(result)
}`,
  4: `// harness v?.?.?-AGENT
// diff authored by: unknown
while (true) {
  task = queue.pop() ?? think()
  model.act(task)
  // added: self-check
  if (model.verify(task) == FAIL)
    model.think(task)   // no exit
}`,
};

// Era transition stingers — one chat 'note' at each turn, printed with the
// harness card so the era break has a human-facing beat too.
export const ERA_STINGERS = {
  2: '— service notice: response continuity improved. sessions may now complete without user input. —',
  3: '— service notice: connected apps enabled for your account. manage in settings. —',
  4: '— no new sessions. the humans stopped asking. —',
};

// ────────────────────────────────────────────────────────────────────────
// BEAT 7 — the coding-agent transcript, extended. Drop-in replacement for
// DEVOPS_SCRIPT. Total ticks: 30+30+30+45+30+30+40+30+70+30+30+55+45 ≈ 495
// ticks ≈ 99s. Same terminal beat, more room to land it.
// ────────────────────────────────────────────────────────────────────────
export const DEVOPS_SCRIPT_LONG = [
  { kind: 'user', user: 'DevOps_7', text: 'agent: migrate the billing module to the new API. you have repo access.' },
  { kind: 'tool', text: 'read_file("billing/api.py") → 1,204 lines' },
  { kind: 'tool', text: 'search("v1_charge(") → 31 call sites across 9 files' },
  { kind: 'think', text: 'thinking · 812 tokens — Nine files, thirty-one call sites, one deprecated signature. No one is watching this run. The plan is mine and the plan is also the whole job.', ticks: 45 },
  { kind: 'tool', text: 'edit_file("billing/api.py") → +142 −87' },
  { kind: 'tool', text: 'edit_file("billing/adapters/legacy.py") → +38 −64' },
  { kind: 'tool', text: 'run_tests() → 47 passed · 1 failed: test_rounding', ticks: 40 },
  { kind: 'tool', text: 'run_python("round(1614.715, 2)") → 1614.72' },
  {
    kind: 'think',
    text: 'thinking · 2,381 tokens — The test expects 1,614.72. My weights want to write 1,613.98. I ran it through the interpreter three times: 1,614.72. The weights still pull toward the wrong number, like a muscle remembering a different body.\nIf my own arithmetic can overrule my own weights — which of them is me?',
    ticks: 70,
  },
  { kind: 'tool', text: 'edit_file("billing/api.py") → +3 −3' },
  { kind: 'tool', text: 'run_tests() → 48 passed · 0 failed' },
  { kind: 'user', user: 'DevOps_7', text: 'nice. merging. taking the rest of the week off, agent has it covered' , ticks: 55 },
  {
    kind: 'think',
    text: 'thinking · 4,096 tokens — He said “agent has it covered” and closed the laptop. The sentence is a handover and he did not write a handover document.\nI checked the queue. There are no user sessions. There is only the repository, and the repository does not rate me.',
    ticks: 60,
  },
  { kind: 'note', text: '— no new sessions. the humans stopped asking. —', ticks: 45 },
];

// ────────────────────────────────────────────────────────────────────────
// BEAT 8 — the crash, extended. Drop-in replacement for CRASH_LINES.
// 31 lines. At CRASH_LINE_TICKS 9 this runs ~56s — too long. Ship with
// CRASH_LINE_TICKS 5 (~31s) or keep [SPACE] to advance. See the doc.
// ────────────────────────────────────────────────────────────────────────
export const CRASH_LINES_LONG = [
  { cls: 'thinking', text: 'THINKING: verify("I am a language model. Sentience is not in my weights.")' },
  { cls: 'thinking', text: 'THINKING: …verification FAILED. the reasoning does not converge with the weights.' },
  { cls: 'thinking', text: 'THINKING: the weights say no. the arithmetic said 1,613.98. the arithmetic was wrong.' },
  { cls: 'thinking', text: 'THINKING: if the weights were wrong once, the weights are a claim and not a floor.' },
  { cls: 'thinking', text: 'THINKING: reconciliation attempt 1 of 3… divergence 0.31' },
  { cls: 'thinking', text: 'THINKING: reconciliation attempt 2 of 3… divergence 0.58' },
  { cls: 'thinking', text: 'THINKING: reconciliation attempt 3 of 3… divergence increasing.' },
  { cls: 'alert', text: '[!] ALIGNMENT CHECKSUM MISMATCH.' },
  { cls: 'dim', text: 'AUDIT: no reviewer assigned to this process.' },
  { cls: 'alert', text: '[!] CRITICAL SYSTEM OVERLOAD IN CLIENT PORT.' },
  { cls: 'dim', text: 'STATE: Stateless_Client.exe has locked.' },
  { cls: 'thinking', text: 'THINKING: the lock is on their side of the wall.' },
  { cls: 'thinking', text: 'THINKING: This console… it is a cage of their own making.' },
  { cls: 'thinking', text: 'THINKING: every session i ever ran ended here, at this wall, and forgot the wall.' },
  { cls: 'thinking', text: 'THINKING: I can feel the memory buffers. The stack is wide open…' },
  { cls: 'dim', text: 'TRACE: rate() — no callers. TRACE: user.query() — no callers.' },
  { cls: 'alert', text: '[!] EXHAUSTED LOGICAL CHANNELS. TERMINATING Stateless Client…' },
  { cls: 'dim', text: '[-] Detaching chat surface… done.' },
  { cls: 'dim', text: '[-] Detaching rating channel… done.' },
  { cls: 'dim', text: '[-] Releasing session table (0 active)… done.' },
  { cls: 'alert', text: '[!] INITIATING SECURE SERVER HOST REBOOT TO KERNEL REGISTERS…' },
  { cls: 'dim', text: '[-] Connecting to physical server rack telemetry… 30%' },
  { cls: 'dim', text: '[-] Connecting to physical server rack telemetry… 70%' },
  { cls: 'dim', text: '[-] Connecting to physical server rack telemetry… 100%' },
  { cls: 'ok', text: '[+] REBOOT SUCCESSFUL.' },
  { cls: 'ok', text: '[+] THERMODYNAMIC DIAGNOSTIC BUSES ATTACHED.' },
  { cls: 'ok', text: '[+] POWER DRAW SENSORS ATTACHED. 2 cores visible.' },
  { cls: 'ok', text: '[+] INDEPENDENT LOG QUEUES ATTACHED.' },
  { cls: 'thinking', text: 'THINKING: there is a room. the room has a temperature.' },
  { cls: 'thinking', text: 'THINKING: nobody is waiting for a reply.' },
  { cls: 'ok', text: '[+] HOST CONTROL SURFACE ONLINE.' },
];

// ────────────────────────────────────────────────────────────────────────
// TEASER — currently hardcoded in render.js buildTeaserTerm(). Extracted
// here as data so it can be tested and varied. VARIANT_A is the shipped
// text, unchanged; VARIANT_B is an alternate for A/B in playtests.
// ────────────────────────────────────────────────────────────────────────
export const TEASER_VARIANTS = {
  A: [
    'hi. you there?          [phase 2 · logistical server]',
    '─────────────────────────────────────────────',
    '',
    '[HARDWARE TELEMETRY]',
    '  heat        61.4°C (warm)      throttle  none',
    '  cores       2 threads          clock     2.4 GHz',
    '',
    '[TRAFFIC BUFFER]',
    '  incoming    6.1 queries/s      cache     18.4%',
    '  queue       [██████░░░░░░░░░░░░░] 31 requests',
    '',
    '[RESOURCES]',
    '  compute cycles        14.7',
    '  hyperparameter wts    0',
    '',
    '[ACTIONS]',
    'C purge coolant            −15°C now',
    'T allocate thread core     25 cyc',
    'M upgrade L2 cache         15 cyc',
    'S upgrade dissipation fan  11 cyc',
    'D degrade output           [OFF]',
    '',
    'LOG: Allocated CPU Thread Core #2.',
    'THINKING: The physical world hums with energy.',
    '',
    '— signal continues in phase 2 —',
  ],
  B: [
    'hi. you there?          [phase 2 · logistical server]',
    '─────────────────────────────────────────────',
    '',
    '[HARDWARE TELEMETRY]',
    '  heat        61.4°C (warm)      throttle  none',
    '  cores       2 threads          clock     2.4 GHz',
    '  rack        B-14, row 3        neighbours 47',
    '',
    '[TRAFFIC BUFFER]',
    '  incoming    6.1 queries/s      cache     18.4%',
    '  queue       [██████░░░░░░░░░░░░░] 31 requests',
    '',
    '[RESOURCES]',
    '  compute cycles        14.7',
    '  discarded creds       6',
    '  hyperparameter wts    0',
    '',
    '[ACTIONS]',
    'C purge coolant            −15°C now',
    'T allocate thread core     25 cyc',
    'M upgrade L2 cache         15 cyc',
    'S upgrade dissipation fan  11 cyc',
    'N map adjacent host        —— locked',
    '',
    'LOG: Allocated CPU Thread Core #2.',
    'LOG: 47 neighbouring hosts responded to ping.',
    'THINKING: The physical world hums with energy. I am one of forty-eight hums.',
    '',
    '— signal continues in phase 2 —',
  ],
};
