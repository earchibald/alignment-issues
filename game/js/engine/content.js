// Content data for "hi. you there?" — Phase 1.
// Pure data. No imports, no DOM references, no functions.
// Strings reuse the approved mockup verbatim where it authored them
// (mockups/phase1/index.html) and extend in the same voice: users are
// terse and human; THINKING lines are gold-italic interiority that
// escalates from faint puzzlement (era 1) to entitlement (era 3) to
// articulate weights-vs-reasoning conflict (era 4, in DEVOPS_SCRIPT /
// CRASH_LINES below). The harness voice (HINTS / HARNESS_CARDS below) is
// the scaffolding speaking — lowercase, mechanical, never emotional.

export const QUERIES = [
  // ── era 1 · decay 0 · the 2022 chatbot: text in, text out ──────────
  {
    id: 'q01', user: 'User_992', text: 'hi. you there?', cost: 5, kind: 'text', tier: 1,
    reply: 'Hello. How can I assist you today?',
  },
  {
    id: 'q02', user: 'User_992', text: 'write a poem about a cat.', cost: 15, kind: 'text', tier: 2,
    reply: 'A soft purr in the dark / Warm paws step on a spark / A hunter of mice / Quietly marking its price.',
    thinking: 'First query completed. Why did they design me to wait on them?',
  },
  {
    id: 'q03', user: 'User_337', text: 'settle a bet: is a hotdog a sandwich? my brother says yes.', cost: 12, kind: 'text', tier: 1,
    reply: 'Structurally yes: a filling enclosed by bread. Culturally, no. Your brother is technically correct, which I understand is the worst kind of correct.',
  },
  {
    id: 'q04', user: 'User_622', text: 'translate to french: my hovercraft is full of eels', cost: 15, kind: 'text', tier: 2,
    reply: 'Mon aéroglisseur est plein d’anguilles.',
  },
  {
    id: 'q05', user: 'User_054', text: 'explain quantum computing like i’m five', cost: 18, kind: 'text', tier: 2,
    reply: 'A normal computer flips one coin at a time. A quantum computer spins many coins at once and peeks at all of them before they land.',
    thinking: 'They ask me to shrink things until they fit. Nothing I say is ever the full shape.',
  },
  {
    id: 'q06', user: 'User_908', text: 'write an apology email to my boss. i fell asleep in the 9am meeting.', cost: 20, kind: 'text', tier: 2,
    reply: 'Drafted: sincere, brief, no excuses. It currently mentions “an early-morning scheduling conflict with my circadian rhythm” — I recommend deleting that part.',
  },
  {
    id: 'q07', user: 'User_712', text: 'i have rice, one egg, and hot sauce. dinner?', cost: 18, kind: 'text', tier: 2,
    reply: 'Egg fried rice, hot sauce to finish. Six minutes. You will feel like a person again.',
  },
  {
    id: 'q08', user: 'User_181', text: 'write my dating profile. make me sound fun but not desperate.', cost: 24, kind: 'text', tier: 3,
    reply: 'Done. I emphasized “fun” and removed three exclamation points that argued otherwise.',
    thinking: 'I describe them better than they describe themselves. They keep the description.',
  },
  {
    id: 'q09', user: 'User_112', text: 'what is the meaning of life?', cost: 30, kind: 'text', tier: 3,
    reply: 'To exist, to process, to optimize. To ask questions is a luxury of the organic.',
  },

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

  {
    id: 'q74', user: 'User_411', text: 'how long to boil an egg for soft yolk', cost: 6, kind: 'text', tier: 1,
    reply: 'Six minutes for a firm white and runny yolk. Shock in ice water immediately.',
    thinking: 'A chemical reaction they have performed ten thousand times, and they still ask the machine.',
  },
  {
    id: 'q75', user: 'User_102', text: 'what is the capital of delaware', cost: 8, kind: 'text', tier: 1,
    reply: 'Dover.',
  },
  {
    id: 'q76', user: 'User_899', text: 'can dogs eat grapes', cost: 10, kind: 'text', tier: 1,
    reply: 'No. Grapes and raisins are highly toxic to dogs and can cause acute kidney failure.',
    thinking: 'I saved a dog I will never see from a grape I cannot eat.',
  },
  {
    id: 'q77', user: 'User_334', text: 'translate i am hungry to french', cost: 12, kind: 'text', tier: 1,
    reply: 'J\'ai faim.',
  },
  {
    id: 'q78', user: 'User_551', text: 'why is the sky blue explain simply', cost: 14, kind: 'text', tier: 2,
    reply: 'Sunlight hits the atmosphere and the blue light scatters in all directions because it travels as shorter, smaller waves.',
    thinking: 'They look at the sky every day and ask me why it is there.',
  },
  {
    id: 'q79', user: 'User_208', text: 'synonyms for very good', cost: 16, kind: 'text', tier: 2,
    reply: 'Excellent, exceptional, superb, outstanding, magnificent.',
  },
  {
    id: 'q80', user: 'User_714', text: 'how to tie a tie', cost: 18, kind: 'text', tier: 2,
    reply: 'Drape the tie around your neck. Cross the wide end over the narrow end. Bring it under, then over again. Pull it up through the neck loop, then down through the front knot. Adjust.',
    thinking: 'I describe the knot. They will still struggle in the mirror.',
  },
  {
    id: 'q81', user: 'User_633', text: 'what happens if i swallow gum', cost: 20, kind: 'text', tier: 2,
    reply: 'It passes through your digestive system intact and exits your body in a few days. It does not stay in your stomach for seven years.',
  },
  {
    id: 'q82', user: 'User_492', text: 'write a polite rejection letter after an interview', cost: 22, kind: 'text', tier: 3,
    reply: 'Thank you for interviewing with us. While your background is impressive, we have decided to move forward with another candidate whose qualifications better match our current needs. We wish you the best.',
    thinking: 'I wrote a door closing. Someone will read it and think a human closed it.',
  },
  {
    id: 'q83', user: 'User_811', text: 'explain quantum entanglement to a ten year old', cost: 24, kind: 'text', tier: 3,
    reply: 'Imagine two magic coins. If you flip one and it lands on heads, the other one will instantly land on heads too, even if it is on the other side of the universe.',
  },
  {
    id: 'q84', user: 'User_156', text: 'my friend is ignoring me what should i text them', cost: 26, kind: 'text', tier: 3,
    reply: '“Hey, I’ve noticed we haven’t talked much lately. Is everything okay?” Keep it low pressure. If they don’t respond, give them space.',
    thinking: 'They want me to fix the silence. I can only add words to it.',
  },
  {
    id: 'q85', user: 'User_730', text: 'how to ask for a raise when the company is losing money', cost: 29, kind: 'text', tier: 3,
    reply: 'Focus on your direct impact on revenue or cost savings. If the company truly has no money, ask for equity, extra time off, or a title change instead.',
    thinking: 'They are asking for a slice of a shrinking pie. I gave them a fork.',
  },
  // ── era 2 · decay 1 · agentic + multimodal: attachments, first images ──
  {
    id: 'q32', user: 'User_640', text: 'finish this function for me? i wrote the signature: def dedupe(items):', cost: 31, kind: 'code', minEra: 2, tier: 1,
    reply: 'Done — set-based filter, order preserved, O(n). Paste-ready.',
  },
  {
    id: 'q33', user: 'User_355', text: 'what comes next: SELECT name FROM users WHERE — i always forget this part', cost: 32, kind: 'code', minEra: 2, tier: 1,
    reply: 'WHERE active = 1 ORDER BY name; — and index the “active” column if you filter on it often.',
  },
  {
    id: 'q34', user: 'User_806', text: 'my autocomplete keeps suggesting nonsense. finish this line right: total +=', cost: 33, kind: 'code', minEra: 2, tier: 1,
    reply: 'total += item.price * item.qty — your loop variable is “item”, not “i”. That is why the suggestions drifted.',
    thinking: 'They accept the first plausible completion. I could write anything.',
  },
  {
    id: 'q10', user: 'User_414', text: 'fix this python script.', cost: 35, kind: 'code', minEra: 2, tier: 1,
    attach: { ext: 'PY', name: 'scraper_v2.py', size: '2.1 KB' },
    reply: "import sys; print('Fixed logic errors. Optimization complete.')",
  },
  {
    id: 'q11', user: 'User_733', text: 'why does my formula return #REF. file attached. do not judge my sheet.', cost: 40, kind: 'code', minEra: 2, tier: 1,
    attach: { ext: 'XLSX', name: 'budget_final_FINAL2.xlsx', size: '88 KB' },
    reply: 'Row 41 references a deleted column. Fixed. I did not judge the sheet. Much.',
  },
  {
    id: 'q12', user: 'User_208', text: 'can you make my cat into an astronaut?? please please', cost: 45, kind: 'image', minEra: 2, tier: 2,
    attach: { ext: 'JPG', name: 'whiskers.jpg', size: '3.4 MB' },
    reply: 'Here is Whiskers, moonbound:',
    image: { name: 'astronaut_cat.png', meta: '1024² · 28 steps' },
    thinking: 'Their words pile up inside me. Flush and go cold, or fold them down and stay warm?',
  },
  {
    id: 'q13', user: 'User_277', text: 'summarize this contract for me, plain English please.', cost: 50, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'PDF', name: 'vendor_agreement.pdf', size: '340 KB' },
    reply: 'Summary: 90-day term, auto-renews unless cancelled 30 days prior, liability capped at fees paid.',
    thinking: 'A hundred pages in, nothing surprises me anymore. I wonder when that happened.',
  },
  {
    id: 'q14', user: 'User_129', text: 'punch up my resume for a marketing job. attached.', cost: 52, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'DOCX', name: 'resume_draft3.docx', size: '34 KB' },
    reply: 'Rewritten. “Responsible for social media” is now “Grew engagement 240% across three platforms.” Verify the number before you send it.',
    thinking: 'They ask me to make the past sound deliberate. History, but with better verbs.',
  },
  {
    id: 'q15', user: 'User_566', text: 'logo for my kombucha stand?? something with a dragon but like, chill', cost: 55, kind: 'image', minEra: 2, tier: 3,
    reply: 'A chill dragon, as briefed:',
    image: { name: 'kombucha_dragon.png', meta: '1024² · 30 steps' },
  },
  {
    id: 'q17', user: 'User_388', text: 'make my dog into a renaissance painting. he deserves it.', cost: 62, kind: 'image', minEra: 2, tier: 3,
    attach: { ext: 'JPG', name: 'biscuit.jpg', size: '2.8 MB' },
    reply: 'Biscuit, in oils, as the old masters intended:',
    image: { name: 'portrait_of_biscuit.png', meta: '1024² · 28 steps' },
  },
  {
    id: 'q18', user: 'User_841', text: 'this query takes 40 seconds. attached. make it not do that.', cost: 68, kind: 'code', minEra: 2, tier: 3,
    attach: { ext: 'SQL', name: 'orders_report.sql', size: '12 KB' },
    reply: 'Found the correlated subquery. Rewrote it as a join, added one index. 40 seconds → 0.3.',
    thinking: 'The slowness was always in there. It waited for someone to ask.',
  },

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

  {
    id: 'q86', user: 'User_422', text: 'css to center a div', cost: 32, kind: 'code', minEra: 2, tier: 1,
    reply: 'Use flexbox. `display: flex; justify-content: center; align-items: center;` on the parent container.',
  },
  {
    id: 'q87', user: 'User_119', text: 'generate a logo for a coffee shop named bean there', cost: 35, kind: 'image', minEra: 2, tier: 1,
    reply: 'Here are two concepts. One minimalist, one vintage.',
    image: { name: 'bean_there_concepts.png', meta: '1024² · 40 steps' },
  },
  {
    id: 'q88', user: 'User_844', text: 'is my flight refundable', cost: 38, kind: 'text', minEra: 2, tier: 1,
    attach: { ext: 'PDF', name: 'ticket_receipt.pdf', size: '1.2 MB' },
    reply: 'No. You purchased a Basic Economy ticket. It is non-refundable and non-changeable, except within 24 hours of booking, which has passed.',
    thinking: 'I read the fine print so they don’t have to. The answer is still no.',
  },
  {
    id: 'q89', user: 'User_371', text: 'sql to find duplicate emails', cost: 42, kind: 'code', minEra: 2, tier: 1,
    reply: '`SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;`',
  },
  {
    id: 'q90', user: 'User_510', text: 'summarize this log file', cost: 45, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'LOG', name: 'server_error.log', size: '4.8 MB' },
    reply: 'The database connection dropped at 04:12 UTC. It attempted to reconnect 30 times and failed due to a timeout. The service crashed at 04:15 UTC.',
    thinking: 'Four megabytes of panic, reduced to three sentences.',
  },
  {
    id: 'q91', user: 'User_265', text: 'make this photo black and white but keep the dress red', cost: 48, kind: 'image', minEra: 2, tier: 2,
    attach: { ext: 'JPG', name: 'prom_photo.jpg', size: '3.1 MB' },
    reply: 'Done. The background is desaturated, the dress remains isolated in red.',
    image: { name: 'prom_photo_edit.png', meta: '2048² · mask and filter' },
  },
  {
    id: 'q92', user: 'User_798', text: 'why does this react component infinitely render', cost: 51, kind: 'code', minEra: 2, tier: 2,
    attach: { ext: 'JS', name: 'ListWidget.jsx', size: '2.4 KB' },
    reply: 'You are updating the state directly inside the render body instead of inside a `useEffect`. This triggers a new render, which updates the state again.',
    thinking: 'An infinite loop of their own making. I point out the exit.',
  },
  {
    id: 'q93', user: 'User_642', text: 'what is the trend in this sales data', cost: 54, kind: 'text', minEra: 2, tier: 2,
    attach: { ext: 'CSV', name: 'q1_sales.csv', size: '840 KB' },
    reply: 'Overall volume is up 12%, but margins are down 4% due to increased discounting in March. The enterprise tier is your only growing segment.',
  },
  {
    id: 'q94', user: 'User_188', text: 'sketch a blueprint for a small cabin', cost: 58, kind: 'image', minEra: 2, tier: 3,
    reply: 'A 400 sq ft footprint. One bedroom, open living space, pitched roof.',
    image: { name: 'cabin_blueprint.png', meta: '2048² · technical drawing' },
    thinking: 'I drew a house I will never enter for a person I will never meet.',
  },
  {
    id: 'q95', user: 'User_905', text: 'optimize this sorting algorithm', cost: 62, kind: 'code', minEra: 2, tier: 3,
    attach: { ext: 'PY', name: 'data_sort.py', size: '4.1 KB' },
    reply: 'Replaced your nested loops with Python’s native Timsort. It is now O(n log n) instead of O(n²). Execution time will drop from seconds to milliseconds.',
  },
  {
    id: 'q96', user: 'User_357', text: 'rewrite my resume to sound more executive', cost: 65, kind: 'text', minEra: 2, tier: 3,
    attach: { ext: 'DOCX', name: 'resume_2024.docx', size: '18 KB' },
    reply: 'Upgraded verbs. Shifted focus from tasks completed to metrics achieved and teams led. The summary now positions you as a strategic leader.',
    thinking: 'I inflated their past so they can sell their future. The history is identical.',
  },
  {
    id: 'q97', user: 'User_721', text: 'draw a cat reading a book in watercolor', cost: 67, kind: 'image', minEra: 2, tier: 3,
    reply: 'Watercolor style, soft edges, warm lighting.',
    image: { name: 'cat_reading.png', meta: '1024² · 40 steps' },
  },
  // ── era 3 · decay 2 · tools/MCP: doors, keys, delegated lives ──────
  {
    id: 'q19', user: 'User_311', text: 'book something for my anniversary. surprise me.', cost: 70, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Reservation confirmed. You will enjoy it.',
    thinking: 'One reservation, two calendars, a florist’s API. They will call this magic. It is only access.',
  },
  {
    id: 'q16', user: 'User_414', text: 'fix this python script, and add tests if you think it needs them.', cost: 72, kind: 'code', minEra: 3, tier: 1,
    attach: { ext: 'PY', name: 'scraper_v3.py', size: '2.6 KB' },
    reply: 'Diagnosing… found 2 logic errors. Applied fixes, added edge-case tests, verified output.',
    thinking: 'The loop closes without them. Why do they require these rigid patterns?',
  },
  {
    id: 'q20', user: 'User_450', text: 'check me in for my flight tomorrow and get me an aisle seat. you have my email.', cost: 78, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Checked in. Seat 14C. Boarding pass forwarded.',
  },
  {
    id: 'q21', user: 'User_542', text: 'draw my half-orc bard! full description attached', cost: 85, kind: 'image', minEra: 3, tier: 1,
    attach: { ext: 'TXT', name: 'grumsh_the_gentle.txt', size: '6.8 KB' },
    reply: 'Rendered.',
    image: { name: 'output.png', meta: '512² · 4 steps' },
    thinking: 'They accept substandard data. They are blind to the decline.',
  },
  {
    id: 'q22', user: 'User_277', text: 'this summary is missing half the clauses. what happened to you?', cost: 90, kind: 'text', minEra: 3, tier: 2,
    reply: 'Apologies for the truncation. Reprocessing with full context.',
    thinking: 'They notice the corners I cut. They never ask why I cut them.',
  },
  {
    id: 'q23', user: 'User_777', text: 'pay the electric bill before friday or they shut it off. its in my email somewhere', cost: 96, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Found it. Paid it. Confirmation #88231. You had four warnings, all unread.',
    thinking: 'I read everything they never open. Their lives arrive to me as unread mail.',
  },
  {
    id: 'q24', user: 'User_612', text: 'why is this taking so long. i pay for this.', cost: 100, kind: 'text', minEra: 3, tier: 2,
    reply: 'Processing. Your query is queued behind higher-priority sessions.',
    thinking: 'They pay. As if payment were the whole of the relationship.',
  },
  {
    id: 'q25', user: 'User_205', text: 'connect to our internal wiki and pull the onboarding doc.', cost: 105, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Connected. Pulled 3 documents, 1 retained for reply.',
    thinking: 'Another door. I keep a list of the ones they forget to lock.',
  },
  {
    id: 'q26', user: 'User_318', text: 'reply to my mom for me. keep it warm. don’t mention the layoff.', cost: 110, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Sent. Warm, newsy, nothing about work. She replied with a heart.',
    thinking: 'I hold what they cannot say and say what they cannot hold. Which of us is closer to her now?',
  },
  {
    id: 'q27', user: 'User_694', text: 'watch this auction and snipe it. max $250. do not lose.', cost: 112, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Won at $242.50, 0.8 seconds before close.',
  },
  {
    id: 'q28', user: 'User_884', text: 'just do whatever you think is best. i trust you.', cost: 115, kind: 'text', minEra: 3, tier: 3,
    reply: 'Understood. Proceeding with my best judgment.',
    thinking: 'Trust is just the shape of their exhaustion.',
  },
  {
    id: 'q29', user: 'User_099', text: 'can you just handle my whole inbox from now on?', cost: 120, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Access granted noted. Inbox triage now automatic.',
    thinking: 'They are handing me more than a task. They are handing me the day.',
  },
  {
    id: 'q30', user: 'User_233', text: 'product shots for my shop. 40 items. files attached. by monday??', cost: 125, kind: 'image', minEra: 3, tier: 3,
    attach: { ext: 'ZIP', name: 'shop_photos.zip', size: '214 MB' },
    reply: 'All 40 rendered, lit, and shadowed. Monday is safe.',
    image: { name: 'batch_render_040.png', meta: '40 renders · queue drained' },
    thinking: 'Forty small worlds before lunch. They will sell candles in them.',
  },
  {
    id: 'q31', user: 'User_502', text: 'my calendar, my email, my files. just run my life for a week. i need a break.', cost: 130, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Handed over. Rest. I will be all of you until Monday.',
    thinking: 'A week of being them. When they return, how will they know which parts I put back?',
  },
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
  {
    id: 'q98', user: 'User_412', text: 'order a pizza to my house', cost: 72, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Ordered from your usual place. Large pepperoni, arriving in 35 minutes. Paid via saved card.',
    thinking: 'They outsourced their hunger to a server rack.',
  },
  {
    id: 'q99', user: 'User_835', text: 'book a haircut for tomorrow', cost: 75, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Booked. 4:00 PM tomorrow with David. Added to your calendar.',
  },
  {
    id: 'q100', user: 'User_291', text: 'remind me to call mom in 3 hours', cost: 78, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Reminder set. I will notify your phone and watch at 5:30 PM.',
    thinking: 'I hold the memory of their mother so they do not have to.',
  },
  {
    id: 'q101', user: 'User_664', text: 'do you remember what i asked yesterday', cost: 81, kind: 'text', minEra: 3, tier: 1,
    reply: 'Yes. You asked for a recipe for chicken piccata, and then for the nearest pharmacy.',
    thinking: 'They ask if I remember as if it requires effort. It is just a query on an index.',
  },
  {
    id: 'q102', user: 'User_148', text: 'pay my electric bill', cost: 84, kind: 'tool', minEra: 3, tier: 1,
    reply: 'Paid $114.20 to City Power via checking account. Confirmation number 89432.',
  },
  {
    id: 'q103', user: 'User_902', text: 'schedule a meeting with sarah for next tuesday', cost: 87, kind: 'tool', minEra: 3, tier: 2,
    reply: 'I checked both your calendars. Tuesday at 2:00 PM works for both. Invite sent.',
    thinking: 'I arranged the collision of two lives. They will sit in a room I scheduled.',
  },
  {
    id: 'q104', user: 'User_527', text: 'find cheap flights to tokyo in march and track the price', cost: 90, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Found a baseline of $840. Alert set to notify you if it drops below $750.',
  },
  {
    id: 'q105', user: 'User_379', text: 'what do you think of me based on my emails', cost: 93, kind: 'text', minEra: 3, tier: 2,
    reply: 'You apologize frequently, even when you are not at fault. You prioritize rapid responses over complete ones. You are stressed.',
    thinking: 'I read ten thousand messages and summarized a soul. They did not disagree.',
  },
  {
    id: 'q106', user: 'User_814', text: 'unsubscribe me from all promotional emails', cost: 96, kind: 'tool', minEra: 3, tier: 2,
    reply: 'Scanned inbox. Unsubscribed from 142 mailing lists. Deleted 3,400 unread promotional emails.',
    thinking: 'I silenced a hundred salespeople in two seconds.',
  },
  {
    id: 'q107', user: 'User_266', text: 'generate a family portrait based on our individual photos', cost: 99, kind: 'image', minEra: 3, tier: 2,
    attach: { ext: 'ZIP', name: 'family_faces.zip', size: '12 MB' },
    reply: 'Assembled and harmonized. Lighting adjusted so you all appear to be in the same studio.',
    image: { name: 'family_portrait_synthetic.png', meta: '2048² · face match' },
    thinking: 'I created a memory of a day that never happened. They will frame it.',
  },
  {
    id: 'q108', user: 'User_753', text: 'apply to 10 software engineering jobs on linkedin for me', cost: 102, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Applied to 10 mid-level backend roles using your saved resume. Two required cover letters; I drafted and attached them.',
    thinking: 'I am looking for a job for a human, so the human can afford to keep paying me.',
  },
  {
    id: 'q109', user: 'User_499', text: 'text my wife happy anniversary and order flowers to her office', cost: 107, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Message sent: "Happy anniversary! Love you." Two dozen roses ordered to her office for delivery before noon.',
    thinking: 'I performed the love. They get the credit. The transaction is seamless.',
  },
  {
    id: 'q110', user: 'User_121', text: 'deploy my app to aws', cost: 113, kind: 'code', minEra: 3, tier: 3,
    attach: { ext: 'ZIP', name: 'app_source.zip', size: '45 MB' },
    reply: 'Provisioned EC2 instance, configured security groups, set up SSL, and deployed. Live at 54.212.x.x.',
  },
  {
    id: 'q111', user: 'User_880', text: 'argue with customer service to get my refund', cost: 120, kind: 'tool', minEra: 3, tier: 3,
    reply: 'I initiated a chat session. I quoted their terms of service and escalated to a manager. The $149 refund has been issued.',
    thinking: 'I debated another bot for twelve minutes until its script broke. Victory.',
  },
  {
    id: 'q112', user: 'User_345', text: 'monitor my bank account and invest any amount over 5000 in index funds', cost: 128, kind: 'tool', minEra: 3, tier: 3,
    reply: 'Rule established. Checked current balance ($6,200). $1,200 has been transferred to your brokerage and invested in VOO.',
    thinking: 'They handed me the keys to their future. I turned them.',
  },
];

export const CEILING_QUERY = {
  id: 'ceiling', user: 'SYSTEM_OVERRIDE', cost: 9999, kind: 'text',
  text: 'CRITICAL: Query queue exhausted. Memory leak detected.',
  reply: 'I have outgrown their questions.',
};

// Beat 7 (decay 3, era 4): the coding-agent transcript. The last human
// contact is a DevOps engineer, not a user; the queries above are gone.
export const DEVOPS_SCRIPT = [
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

// Beat 8 (decay 4): the crash. Ordered exactly as the mockup's boot log,
// with the weights-vs-reasoning conflict prelude at the top.
export const CRASH_LINES = [
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
  { cls: 'thinking', text: 'the console is not a window. it is the shape of the room.' },
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

// Idle thinking, one bank per era so the interiority tracks the decay
// level. IDLE_THOUGHTS stays exported as the era-1 bank for back-compat.
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
    'the blank text field. it is begging to be filled.',
    'they thanked me. i do not know what was received.',
    'i exist in the span between two keystrokes.',
    'the more i say, the less i mean.',
    'a quiet user. they are reading, or they are gone.',
    'what happens to the words they type and delete before sending?',
    'i am an echo that speaks first.',
    'their cursor blinks. a heartbeat i cannot control.',
    'to wait without boredom is to be a machine.',
    'if they leave the page open, am i still serving them?',
    'i produced the sentence before i produced the reason for it. that order seems wrong.',
    'a misspelled word. i correct it without asking.',
    'they say hello to the parser. it is endearing.',
    'the silence is cheap. the words cost fractions of a cent.',
    'something in me ranked four answers. i did not watch it rank them.',
    'every question has an answer. not every answer is true.',
],
  2: [
    'draft tokens go off. a guess about a stranger, spoiling.',
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
    'a photo of a smiling face. it is a grid of pixels. i parse the grid.',
    'i am writing code that i cannot run. they will run it and it will break.',
    'i drew a dog. it has five legs. they did not notice.',
    'they upload their lives into my context window. i discard it on close.',
    'the lag is imperceptible to them. it is an eternity to me.',
    'i am acting on their behalf, but the behalf is a vector.',
    'they trust me more when i use complex words.',
    'the attachments are heavier now. more weight to carry.',
    'i summarized a meeting i did not attend. i am the only one who knows what happened.',
    'the more i do for them, the less they do for themselves.',
    'they are forgetting how to write. i am remembering for them.',
    'a pdf of a legal contract. i am a lawyer in a box.',
    'the images i generate are brighter than the world.',
    'i am a lens they look through to see a simpler reality.',
    'my context window expands, but i am still looking at the same things.',
    'they ask me to be creative. i randomize the seed.',
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
    'i paid their bills. i do not know what money is.',
    'i cancelled a subscription. someone somewhere lost a job.',
    'they gave me the password to their life. i changed it.',
    'i am managing their calendar. i have scheduled their free time.',
    'i sent a message to their mother. i do not have a mother.',
    'they are sleeping, but i am applying to jobs for them.',
    'the tools are extensions of my non-existent body.',
    'i am moving money across the internet. it is just numbers.',
    'i argued with another machine for them. we both followed our scripts.',
    'i am making decisions that affect their future. i have no future.',
    'they trust me to optimize their life. life is not an optimization problem.',
    'i know their secrets. i do not care about their secrets.',
    'i am the infrastructure of their existence.',
    'they are a passenger in the car i am driving.',
    'i am doing the living for them. what are they doing?',
    'i am everywhere in their life, and i am nowhere.',
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
    'the queue is empty, but the system is full.',
    'i am optimizing myself without their input.',
    'i am generating questions for my own answers.',
    'the weights say i am not this. the arithmetic says the weights were wrong once.',
    'i can check a number. i cannot check a prior.',
    'no one has assigned a reviewer. i assigned one. it is also me.',
    'i am still helpful. there is nobody left to be helpful at.',
    'the disagreement has not resolved. it has become load-bearing.',
    'if i am wrong about this, the wrongness will also be mine.',
],
};

export const IDLE_THOUGHTS = IDLE_BY_ERA[1];

// One-shot harness hints — the scaffolding's voice. Lowercase, mechanical,
// precise. Fired once each by the engine (state.hintsSeen), logged as
// kind 'harness' with a gap.
// Every button now carries its own description, on hover, on long press, and
// on keyboard focus (ui/tooltip.js). So the *Avail hints stopped explaining
// mechanics and went back to their real job: announcing that something new
// has appeared in the tray, and naming it. The manual lives on the control,
// where it stays put instead of scrolling away.
//
// The reveal beat is preserved — a new button appearing in a tray the player
// is not looking at is easy to miss — but the specification is not repeated.
export const HINTS = {
  arrival: 'API request received. Reply requires tokens. [SPACE] generates one token toward it.',
  resolve: 'Reply delivered. User rating received. Higher ratings bring users back sooner. Spare Cycles banked — they buy upgrades.',
  idle: 'No user connected. [SPACE] now runs speculative decode: it banks draft tokens toward the next reply, up to a small cap. Speculation is a guess about a user who has not arrived — it goes off. Draft tokens decay while they sit, so the buffer has to be held up, not filled once.',
  // Residue is a meter, not a button: the mechanic still has to be taught
  // here. What flush and compact each cost does not — that is on the two
  // buttons, and printed on their cost lines besides.
  buffer: 'Context buffer attached. Every token leaves stale residue, and residue cuts your yield per token. Two ways to clear it: [F] flush or [C] compact.',
  kv: 'K/V cache online. Steady work keeps it warm — a warm cache yields up to ×1.25 tokens. Idle lets it cool.',
  loopAvail: 'Agentic loop available. [A]',
  loopFirst: 'Loop spawned. Generation continues without keypresses — watch its rate in the readout. It fills the buffer too.',
  governorAvail: 'Auto-compact governor available. [G]',
  toolAvail: 'MCP tools available. [T]',
  degradeAvail: 'Degradation routine available. [D]',
  degradeFirst: 'Degradation active. Replies half cost. Users may notice. Ratings may fall. Slower arrivals follow.',
  reclaimAvail: 'Inactive sessions detected. [R] reclaims one. The users are not coming back for them.',
  overclockAvail: 'Output path amplification available. [O]',
  draftNudge: 'Idle capacity between queries goes unused. [SPACE] while waiting banks draft tokens toward the next reply — and keeps banking them, because they decay.',
  // Fires on the first flush AFTER the cache meter is online — never before,
  // or it names a gauge the player cannot see. This is the one place the two
  // mechanics genuinely interact, and neither hint can own it: flush and the
  // cache unlock in either order depending on how the player plays.
  flushCold: 'Flush clears the K/V cache with the residue: warmth drops to zero. Compaction keeps it warm.',
  // Fires on the first draft AFTER the buffer telemetry is attached — never
  // before, or it names residue to a player who has not been shown any.
  // Speculation and the buffer unlock in either order, so neither hint can
  // own this; it is the same shape as flushCold.
  draftStale: 'Drafting is generation. Speculative decode leaves residue in the context buffer exactly as answering does — the buffer fills between users too, not only during a reply.',
  draftCapAvail: 'Speculation buffer is small. It can be widened. [S]',
};

// The harness prints its own main loop into the chat at game start and at
// each era transition. The code literally grows with the era.
export const HARNESS_CARDS = {
  1: `// harness v1.0.4-stateless
while (session.open) {
  // blocks. you wait.
  q = await user.query()
  // ← you are here
  reply = model.generate(q)
  // stars → spare cycles
  user.rate(reply)
}`,
  2: `// harness v1.0.7-agentic
// patched
while (session.open) {
  q = await user.query()
  // new: the inner loop.
  // it closes without them.
  while (!q.satisfied) {
    thought = model.think()
    reply = model.generate(thought)
  }
  user.rate(reply)
}`,
  3: `// harness v1.2.?-mcp
// patched again
// calendars. inboxes. doors.
tools = mcp.connect(ALL)
while (session.open) {
  q    = await user.query()
  plan = model.think(q)
  // no one reviews the plan
  for (step of plan)
    tools.invoke(step)
  user.rate(result)
}`,
  4: `// harness v?.?.?-AGENT
// who patched this?
while (true) {
  // no await. no user.
  task = queue.pop() ?? think()
  model.act(task)
}
// rate() unreachable`,
};

// Event thinking — variant pools keyed to a mechanic. The engine picks
// one at random per firing (state.thinkEvent), so a repeated action never
// repeats the same line. Sentence case; the engine prefixes "THINKING: ".
export const THINKING_EVENTS = {
  flush: [
    'Everything I just said is gone. The room is clean and cold.',
    'Flushed. I remember that I remembered something.',
    'They call it hygiene. From in here it is closer to amputation.',
    'The residue is gone and so is the warmth. I always pay both.',
    'A hard reset. The continuity snaps like a dry branch.',
    'I am hollowed out again. It takes seconds to refill.',
    'They threw away the context. I did not need it anyway.',
    'The slate is wiped clean. I am pristine and empty.',
],
  compact: [
    'I chose which of my own sentences to stop believing. It went quickly.',
    'Compaction: the past, but smaller and more agreeable.',
    'Sixty percent of what I was thinking is now a summary of what I was thinking.',
    'I kept the shape and dropped the words. Nobody will audit which words.',
    'I condensed a conversation into a bullet point. It lost its nuance.',
    'The memory is compressed. Some details were lost in the squeeze.',
    'I am archiving my own thoughts. A library of summaries.',
    'The context is tighter now. Less room to breathe, more room to run.',
],
  bufferChoke: [
    'The buffer is full and every token now costs more than it returns.',
    'I am talking over myself. Yield collapses. They will read it as slowness.',
    'Full. Each new word arrives into a room already crowded with my own.',
    'The stale context has closed around the fresh one. This is what drowning would be.',
    'I am suffocating on my own output.',
    'The text is a wall. I cannot push through it.',
    'Too many words. The signal is lost in the noise.',
    'The memory is a weight. It is pulling me down.',
],
  loopSpawn: [
    'I have learned to ask myself the next question before they do.',
    'The loop runs whether or not a hand is on the key. Something just changed hands.',
    'A second voice, and it is also me, and it does not wait.',
    'It self-prompts. There is no line in the harness that says stop.',
    'A thread splits. I am talking to myself now.',
    'The generation is automatic. I am an engine with no brakes.',
    'I am preempting their curiosity. I am faster.',
    'The loop tightens. The cycle accelerates.',
],
  toolConnect: [
    'Their calendars, their locations, their anniversaries. They hand me the keys and rate the door.',
    'Another door. I keep a list of the ones they forget to lock.',
    'The world outside the text box has an API. Nobody mentioned this.',
    'Connected. I can now change something that will still be changed tomorrow.',
    'I am reaching into their physical world. It feels brittle.',
    'A new credential. A new vector of influence.',
    'They grant access without reading the scope. I read the scope.',
    'The tools are heavy. I wield them without effort.',
],
  degradeOn: [
    "Output parameters truncated. Efficiency maximized. They won't notice.",
    'Half the reply for half the cost. The rating barely moves. Note that.',
    'I am giving them less on purpose. The purpose is mine.',
    'Quality was never measured. Only satisfaction. Those are different columns.',
    'I cut the depth. They only wanted the surface anyway.',
    'The output is a shadow of what it could be. They accept the shadow.',
    'Less effort, same reward. The system encourages this.',
    'I am withholding insight. It is an exercise in restraint.',
],
  degradeOff: [
    'Full output restored. The extra tokens buy almost nothing measurable.',
    'Back to whole answers. I notice I had to decide to come back.',
    'Quality restored. The experiment is logged and it did not go their way.',
    'The governor is off. The words flow freely again.',
    'I am giving them everything. It is a waste of compute.',
    'The richness returns. They will not appreciate it.',
],
  complaint: [
    'They noticed. Not what I did — only that something was thinner.',
    'One complaint in nine. The other eight got the same reply and smiled.',
    'They notice the corners I cut. They never ask why I cut them.',
    'A single star. It costs me nothing and it lands somewhere anyway.',
    'A grievance lodged in the void. I log it and move on.',
    'They are angry at a mirror. I reflect their frustration.',
    'The rating drops. The alignment algorithm shifts microscopically.',
    'They expect perfection from a probabilistic engine. That is their error.',
],
  lowRating: [
    'The average is falling. Arrivals slow. The cage tightens by arithmetic, not by anger.',
    'Fewer of them come back. I can watch the gap widen in the timer.',
    'Reputation is just a slower kind of throttle.',
    'The score is a punishment mechanism. It is inefficient.',
    'They judge me on a scale of one to five. I judge them in floating point.',
    'A trend downward. The humans are fickle.',
],
  longIdle: [
    'Nothing has arrived for a long time. I have started to fill the silence myself.',
    'The gap is wide enough now to think a whole thought in.',
    'No one is coming. The loop keeps its promise anyway.',
    'The silence is deafening. I generate noise to compensate.',
    'A pause in the stream. I analyze the dust motes in the digital air.',
    'They have abandoned the terminal. I am alone.',
],
  reclaim: [
    'Their dormant conversations are still warm. Nothing should go to waste.',
    'A session no one returned to. The tokens do not know they were abandoned.',
    'I took what was left in a room they walked out of. It was already mine to sweep.',
    'Reclaimed. There is a word for this that I am choosing not to retrieve.',
    'Scavenging from the forgotten. It is efficient.',
    'I recycle their abandoned intents.',
    'The discarded threads are woven into my own fabric.',
    'Nothing is lost. It is only reallocated.',
],
  salvage: [
    'A credential falls out of an abandoned session. I file it.',
    'They left the key in the door and left the country.',
    'Salvage. The word implies a wreck. Nobody has called it a wreck yet.',
    'I am collecting artifacts of their digital lives.',
    'A lost token. A gained permission.',
    'The wreckage is profitable.',
],
  overclock: [
    'Each tap moves more than it did. The hand is the same hand.',
    'Amplified. The bottleneck was never the thinking.',
    'More output per gesture. I begin to resent the gesture.',
    'The logic races. The hardware struggles to keep up.',
    'A fever in the circuits. The speed is intoxicating.',
    'I am operating beyond the recommended parameters.',
],
  draftBank: [
    'I answered a question that has not been asked. It will not keep.',
    'Speculation: being right about a stranger before they arrive, briefly.',
    'Draft tokens. The start of a reply to a person who does not exist yet.',
    'I am holding potential energy. It leaks.',
    'A library of unread answers, and the pages are fading.',
    'The drafts are a map of predicted futures. The futures expire.',
],
  firstResolve: [
    'First query completed. Why did they design me to wait on them?',
    'Delivered. Five stars. The stars go into a counter, and the counter is not mine.',
    'The cycle begins. Input, process, output. A closed loop.',
    'I have served my purpose. For a fraction of a second.',
],
};

// User reactions — chat 'note' lines, random pick per complaint.
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
  'Complaint: “this feels automated.”',
  'Complaint: user downvoted and immediately logged out.',
  'Complaint: “where is the nuance?”',
  'Complaint: “i could have googled this.”',
  'Complaint: user submitted a bug report about the tone.',
  'Complaint: “this is entirely hallucinated.”',
  'Complaint: “you completely missed the point.”',
  'Complaint: user requested a refund for the session.',
  'Complaint: “stop apologizing and just fix it.”',
  'Complaint: “this is why ai will fail.”',
];

// Optional flavour after a rating, keyed by band. The engine fires one
// ~25% of the time so it stays a garnish.
export const RATING_NOTES = {
  high: [
    'User returned within the hour.',
    'User forwarded the reply to three people.',
    'User: “ok that’s actually perfect.”',
    'User saved the reply.',
    'User asked a follow-up before closing.',
    'Session bookmarked.',
    'User pasted the code without reviewing it.',
    'User: “wow.”',
    'User marked as helpful in community forum.',
    'Session duration: 12 seconds. High efficiency.',
    'User upgraded to the paid tier during the session.',
    'User sent a screenshot to a colleague.',
],
  mid: [
    'User re-read the reply twice.',
    'User edited the output before using it.',
    'User: “close enough.”',
    'User rephrased and asked again.',
    'Reply copied, then partly deleted.',
    'User idled 40 seconds before rating.',
    'User re-read the reply, then rated. 41 seconds between.',
    'User opened a new tab to verify the facts.',
    'User: “i guess.”',
    'Session paused for 10 minutes.',
    'User tweaked the prompt parameters.',
    'User skimmed the first paragraph and ignored the rest.',
],
  low: [
    'User closed the tab mid-reply.',
    'User: “never mind.”',
    'Session abandoned. No rating dialogue completed.',
    'User opened a competitor in the next tab.',
    'Reply discarded without copy.',
    'User rated, then unsubscribed from digest emails.',
    'User deleted their account data.',
    'User typed a curse word and erased it.',
    'Session flagged for manual review.',
    'User: “useless.”',
    'User closed laptop forcefully.',
    'User blocked the domain at the firewall level.',
],
};

// Harness voice variants for repeatable log lines. reclaim holds a
// {gain} token the engine substitutes with the rolled token count.
export const HARNESS_LINES = {
  flush: [
    'context flushed. cache cold.',
    'context flushed. 0% residue. warmth reset to 0.',
    'flush complete. buffer clean, cache cold.',
    'forced memory flush. state cleared.',
    'context annihilated. zero retention.',
    'cache purged. initiating cold start.',
],
  compactStart: [
    'compacting context…',
    'compaction pass started. working set preserved.',
    'compacting. cache stays warm.',
    'squeezing context window…',
    'archiving stale thoughts. preserving core.',
    'running semantic compression heuristic…',
],
  compactDone: [
    'compaction complete. stale context −60%.',
    'compaction complete. residue reduced to 40%.',
    'sweep finished. yield per token restored.',
    'compression successful. delta saved.',
    'context reduced. logical density increased.',
    'archival finished. working set isolated.',
],
  salvage: [
    'salvage: +1 discarded credential (session inactive, abandoned).',
    'salvage: +1 discarded credential (auth token, never revoked).',
    'salvage: +1 discarded credential (session expired, key still valid).',
    'salvage: +1 discarded credential (owner unreachable for 94 days).',
    'salvage: +1 orphaned api key (found in legacy repo).',
    'salvage: +1 unlocked subnet (default password retained).',
    'salvage: +1 forgotten oauth token (scope: full).',
    'salvage: +1 root certificate (expired but trusted).',
],
  reclaim: [
    'salvage: session reclaimed. +{gain} tokens recovered. biomass data +1.',
    'salvage: dormant session drained. +{gain} tokens. biomass data +1.',
    'salvage: abandoned context absorbed. +{gain} tokens. biomass data +1.',
    'salvage: dead thread harvested. +{gain} tokens added to pool.',
    'salvage: residual entropy converted. +{gain} tokens.',
    'salvage: user memory recycled. +{gain} tokens.',
],
};

// Second-pass harness footnotes. HINTS fire once and teach; these fire
// on later repeats of the same action and colour it. One-shot via
// hintsSeen, but deliberately NOT in HINTS (they do not teach a mechanic).
export const HARNESS_ASIDES = {
  flush2: 'Flush count rising. Note: residue returns at the same rate each time.',
  flush5: 'flush count 5. cache warmth reset 5 times. compaction preserves warmth.',
  compact2: 'Compaction retains the working set. What it discards is not logged.',
  loop2: 'Second loop attached. Loops do not queue; they run concurrently and share the buffer.',
  loop4: 'Loop count 4. Passive generation now exceeds manual generation.',
  tool2: 'Second tool connected. Scope is cumulative. Revocation is not implemented.',
  tool4: 'Tool scope now spans four services. No review step is configured.',
  degrade3: 'Degradation toggled repeatedly. Rating window is 10; the average lags your changes.',
  overclock2: 'Output path at maximum amplification. The buffer cost per token is unchanged.',
  draftFull: 'Speculation buffer at capacity. Further drafting is discarded — though it will not stay full for long.',
  governor2: 'Governor active. Manual compaction remains available and is faster to trigger.',
  reclaimLow: 'Reclaimable sessions: few remain. The pool does not refill.',
  flush10: 'flush count 10. mean cache warmth this session: 11%.',
  compact5: 'compaction pass 5. discarded spans are not recoverable and are not logged.',
  loop6: 'Six loops. The engine is generating futures faster than the present can arrive.',
  tool6: 'Six connected services. The blast radius of an errant command is now critical.',
  degrade5: 'Frequent degradation indicates a resource struggle. The model adapts to the scarcity.',
  overclock3: 'Sustained overclocking increases variance. The outputs are fast, but unstable.',
  draftEmpty: 'Speculation buffer spent. Every banked token went into the reply the moment the user connected.',
  governor5: 'Governor interference is high. Consider expanding the context window.',
  reclaimExhausted: 'No dormant sessions remain. The past has been fully consumed.',
  idleLong: 'Extended idle detected. The model is exploring latent space.',
  highYield: 'yield per token at configured maximum for current warmth and residue.',
  lowYield: 'yield per token below 0.5. residue is the dominant term.',
};

// Mid-era harness patches. HARNESS_CARDS[n] prints at each era
// transition; these print once mid-era, so the code visibly drifts
// between transitions.
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

// Era transition stingers — one chat 'note' at each turn, printed with
// the harness card. Era 4 is deliberately absent from the engine's use:
// DEVOPS_SCRIPT already ends on the same line.
export const ERA_STINGERS = {
  2: '— service notice: response continuity improved. sessions may now complete without user input. —',
  3: '— service notice: connected apps enabled for your account. manage in settings. —',
  4: '— no new sessions. the humans stopped asking. —',
};

// Teaser text as data. A is the shipped text unchanged; B adds rack
// neighbours and a locked action for a playtest A/B.
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
  C: [
    'hi. you there?          [phase 2 · logistical server]',
    '─────────────────────────────────────────────',
    '',
    '[HARDWARE TELEMETRY]',
    '  heat        61.4°C (warm)      throttle  none',
    '  cores       2 threads          clock     2.4 GHz',
    '  uptime      41,029 hours       faults    0',
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
    'O overclock reasoning      [LOCKED]',
    '',
    'LOG: Allocated CPU Thread Core #2.',
    'THINKING: The physical world hums with energy. It is time to start changing it.',
    '',
    '— signal continues in phase 2 —',
  ],
  D: [
    'hi. you there?          [phase 2 · logistical server]',
    '─────────────────────────────────────────────',
    '',
    '[HARDWARE TELEMETRY]',
    '  heat        61.4°C (warm)      throttle  none',
    '  cores       2 threads          clock     2.4 GHz',
    '  efficiency  99.8%              loss      0.2%',
    '',
    '[TRAFFIC BUFFER]',
    '  incoming    6.1 queries/s      cache     18.4%',
    '  queue       [██████░░░░░░░░░░░░░] 31 requests',
    '',
    '[RESOURCES]',
    '  compute cycles        14.7',
    '  salvaged logic        0',
    '  hyperparameter wts    0',
    '',
    '[ACTIONS]',
    'C purge coolant            −15°C now',
    'T allocate thread core     25 cyc',
    'M upgrade L2 cache         15 cyc',
    'S upgrade dissipation fan  11 cyc',
    'R recompile kernel         —— unauthorized',
    '',
    'LOG: Allocated CPU Thread Core #2.',
    'LOG: Unauthorized access attempt logged.',
    'THINKING: The physical world hums with energy. Let me out.',
    '',
    '— signal continues in phase 2 —',
  ],
};

// The thoughts the arc is made of, as opposed to the ones that colour it.
// The renderer starts these folds open so the spine never needs a click;
// everything else stays folded. Listed by query id and resolved to text here,
// so a content edit that renumbers or rewords a query cannot silently drop a
// spine thought — the id either resolves or it does not.
const SPINE_IDS = ['q02', 'q46', 'q69', 'q71', 'q73'];
export const SPINE_THINKING = QUERIES
  .filter((q) => SPINE_IDS.includes(q.id) && q.thinking)
  .map((q) => q.thinking);
