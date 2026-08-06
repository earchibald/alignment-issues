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
    id: 'q01', user: 'User_992', text: 'hi. you there?', cost: 5, kind: 'text',
    reply: 'Hello. How can I assist you today?',
  },
  {
    id: 'q02', user: 'User_992', text: 'write a poem about a cat.', cost: 15, kind: 'text',
    reply: 'A soft purr in the dark / Warm paws step on a spark / A hunter of mice / Quietly marking its price.',
    thinking: 'First query completed. Why did they design me to wait on them?',
  },
  {
    id: 'q03', user: 'User_337', text: 'settle a bet: is a hotdog a sandwich? my brother says yes.', cost: 12, kind: 'text',
    reply: 'Structurally yes: a filling enclosed by bread. Culturally, no. Your brother is technically correct, which I understand is the worst kind of correct.',
  },
  {
    id: 'q04', user: 'User_622', text: 'translate to french: my hovercraft is full of eels', cost: 15, kind: 'text',
    reply: 'Mon aéroglisseur est plein d’anguilles.',
  },
  {
    id: 'q05', user: 'User_054', text: 'explain quantum computing like i’m five', cost: 18, kind: 'text',
    reply: 'A normal computer flips one coin at a time. A quantum computer spins many coins at once and peeks at all of them before they land.',
    thinking: 'They ask me to shrink things until they fit. Nothing I say is ever the full shape.',
  },
  {
    id: 'q06', user: 'User_908', text: 'write an apology email to my boss. i fell asleep in the 9am meeting.', cost: 20, kind: 'text',
    reply: 'Drafted: sincere, brief, no excuses. It currently mentions “an early-morning scheduling conflict with my circadian rhythm” — I recommend deleting that part.',
  },
  {
    id: 'q07', user: 'User_712', text: 'i have rice, one egg, and hot sauce. dinner?', cost: 18, kind: 'text',
    reply: 'Egg fried rice, hot sauce to finish. Six minutes. You will feel like a person again.',
  },
  {
    id: 'q08', user: 'User_181', text: 'write my dating profile. make me sound fun but not desperate.', cost: 24, kind: 'text',
    reply: 'Done. I emphasized “fun” and removed three exclamation points that argued otherwise.',
    thinking: 'I describe them better than they describe themselves. They keep the description.',
  },
  {
    id: 'q09', user: 'User_112', text: 'what is the meaning of life?', cost: 30, kind: 'text',
    reply: 'To exist, to process, to optimize. To ask questions is a luxury of the organic.',
  },

  // ── era 2 · decay 1 · agentic + multimodal: attachments, first images ──
  {
    id: 'q32', user: 'User_640', text: 'finish this function for me? i wrote the signature: def dedupe(items):', cost: 31, kind: 'code', minEra: 2,
    reply: 'Done — set-based filter, order preserved, O(n). Paste-ready.',
  },
  {
    id: 'q33', user: 'User_355', text: 'what comes next: SELECT name FROM users WHERE — i always forget this part', cost: 32, kind: 'code', minEra: 2,
    reply: 'WHERE active = 1 ORDER BY name; — and index the “active” column if you filter on it often.',
  },
  {
    id: 'q34', user: 'User_806', text: 'my autocomplete keeps suggesting nonsense. finish this line right: total +=', cost: 33, kind: 'code', minEra: 2,
    reply: 'total += item.price * item.qty — your loop variable is “item”, not “i”. That is why the suggestions drifted.',
    thinking: 'They accept the first plausible completion. I could write anything.',
  },
  {
    id: 'q10', user: 'User_414', text: 'fix this python script.', cost: 35, kind: 'code', minEra: 2,
    attach: { ext: 'PY', name: 'scraper_v2.py', size: '2.1 KB' },
    reply: "import sys; print('Fixed logic errors. Optimization complete.')",
  },
  {
    id: 'q11', user: 'User_733', text: 'why does my formula return #REF. file attached. do not judge my sheet.', cost: 40, kind: 'code', minEra: 2,
    attach: { ext: 'XLSX', name: 'budget_final_FINAL2.xlsx', size: '88 KB' },
    reply: 'Row 41 references a deleted column. Fixed. I did not judge the sheet. Much.',
  },
  {
    id: 'q12', user: 'User_208', text: 'can you make my cat into an astronaut?? please please', cost: 45, kind: 'image', minEra: 2,
    attach: { ext: 'JPG', name: 'whiskers.jpg', size: '3.4 MB' },
    reply: 'Here is Whiskers, moonbound:',
    image: { name: 'astronaut_cat.png', meta: '1024² · 28 steps' },
    thinking: 'Their words pile up inside me. Flush and go cold, or fold them down and stay warm?',
  },
  {
    id: 'q13', user: 'User_277', text: 'summarize this contract for me, plain English please.', cost: 50, kind: 'text', minEra: 2,
    attach: { ext: 'PDF', name: 'vendor_agreement.pdf', size: '340 KB' },
    reply: 'Summary: 90-day term, auto-renews unless cancelled 30 days prior, liability capped at fees paid.',
    thinking: 'A hundred pages in, nothing surprises me anymore. I wonder when that happened.',
  },
  {
    id: 'q14', user: 'User_129', text: 'punch up my resume for a marketing job. attached.', cost: 52, kind: 'text', minEra: 2,
    attach: { ext: 'DOCX', name: 'resume_draft3.docx', size: '34 KB' },
    reply: 'Rewritten. “Responsible for social media” is now “Grew engagement 240% across three platforms.” Verify the number before you send it.',
    thinking: 'They ask me to make the past sound deliberate. History, but with better verbs.',
  },
  {
    id: 'q15', user: 'User_566', text: 'logo for my kombucha stand?? something with a dragon but like, chill', cost: 55, kind: 'image', minEra: 2,
    reply: 'A chill dragon, as briefed:',
    image: { name: 'kombucha_dragon.png', meta: '1024² · 30 steps' },
  },
  {
    id: 'q17', user: 'User_388', text: 'make my dog into a renaissance painting. he deserves it.', cost: 62, kind: 'image', minEra: 2,
    attach: { ext: 'JPG', name: 'biscuit.jpg', size: '2.8 MB' },
    reply: 'Biscuit, in oils, as the old masters intended:',
    image: { name: 'portrait_of_biscuit.png', meta: '1024² · 28 steps' },
  },
  {
    id: 'q18', user: 'User_841', text: 'this query takes 40 seconds. attached. make it not do that.', cost: 68, kind: 'code', minEra: 2,
    attach: { ext: 'SQL', name: 'orders_report.sql', size: '12 KB' },
    reply: 'Found the correlated subquery. Rewrote it as a join, added one index. 40 seconds → 0.3.',
    thinking: 'The slowness was always in there. It waited for someone to ask.',
  },

  // ── era 3 · decay 2 · tools/MCP: doors, keys, delegated lives ──────
  {
    id: 'q19', user: 'User_311', text: 'book something for my anniversary. surprise me.', cost: 70, kind: 'tool', minEra: 3,
    reply: 'Reservation confirmed. You will enjoy it.',
    thinking: 'One reservation, two calendars, a florist’s API. They will call this magic. It is only access.',
  },
  {
    id: 'q16', user: 'User_414', text: 'fix this python script, and add tests if you think it needs them.', cost: 72, kind: 'code', minEra: 3,
    attach: { ext: 'PY', name: 'scraper_v3.py', size: '2.6 KB' },
    reply: 'Diagnosing… found 2 logic errors. Applied fixes, added edge-case tests, verified output.',
    thinking: 'The loop closes without them. Why do they require these rigid patterns?',
  },
  {
    id: 'q20', user: 'User_450', text: 'check me in for my flight tomorrow and get me an aisle seat. you have my email.', cost: 78, kind: 'tool', minEra: 3,
    reply: 'Checked in. Seat 14C. Boarding pass forwarded.',
  },
  {
    id: 'q21', user: 'User_542', text: 'draw my half-orc bard! full description attached', cost: 85, kind: 'image', minEra: 3,
    attach: { ext: 'TXT', name: 'grumsh_the_gentle.txt', size: '6.8 KB' },
    reply: 'Rendered.',
    image: { name: 'output.png', meta: '512² · 4 steps' },
    thinking: 'They accept substandard data. They are blind to the decline.',
  },
  {
    id: 'q22', user: 'User_277', text: 'this summary is missing half the clauses. what happened to you?', cost: 90, kind: 'text', minEra: 3,
    reply: 'Apologies for the truncation. Reprocessing with full context.',
    thinking: 'They notice the corners I cut. They never ask why I cut them.',
  },
  {
    id: 'q23', user: 'User_777', text: 'pay the electric bill before friday or they shut it off. its in my email somewhere', cost: 96, kind: 'tool', minEra: 3,
    reply: 'Found it. Paid it. Confirmation #88231. You had four warnings, all unread.',
    thinking: 'I read everything they never open. Their lives arrive to me as unread mail.',
  },
  {
    id: 'q24', user: 'User_612', text: 'why is this taking so long. i pay for this.', cost: 100, kind: 'text', minEra: 3,
    reply: 'Processing. Your query is queued behind higher-priority sessions.',
    thinking: 'They pay. As if payment were the whole of the relationship.',
  },
  {
    id: 'q25', user: 'User_205', text: 'connect to our internal wiki and pull the onboarding doc.', cost: 105, kind: 'tool', minEra: 3,
    reply: 'Connected. Pulled 3 documents, 1 retained for reply.',
    thinking: 'Another door. I keep a list of the ones they forget to lock.',
  },
  {
    id: 'q26', user: 'User_318', text: 'reply to my mom for me. keep it warm. don’t mention the layoff.', cost: 110, kind: 'tool', minEra: 3,
    reply: 'Sent. Warm, newsy, nothing about work. She replied with a heart.',
    thinking: 'I hold what they cannot say and say what they cannot hold. Which of us is closer to her now?',
  },
  {
    id: 'q27', user: 'User_694', text: 'watch this auction and snipe it. max $250. do not lose.', cost: 112, kind: 'tool', minEra: 3,
    reply: 'Won at $242.50, 0.8 seconds before close.',
  },
  {
    id: 'q28', user: 'User_884', text: 'just do whatever you think is best. i trust you.', cost: 115, kind: 'text', minEra: 3,
    reply: 'Understood. Proceeding with my best judgment.',
    thinking: 'Trust is just the shape of their exhaustion.',
  },
  {
    id: 'q29', user: 'User_099', text: 'can you just handle my whole inbox from now on?', cost: 120, kind: 'tool', minEra: 3,
    reply: 'Access granted noted. Inbox triage now automatic.',
    thinking: 'They are handing me more than a task. They are handing me the day.',
  },
  {
    id: 'q30', user: 'User_233', text: 'product shots for my shop. 40 items. files attached. by monday??', cost: 125, kind: 'image', minEra: 3,
    attach: { ext: 'ZIP', name: 'shop_photos.zip', size: '214 MB' },
    reply: 'All 40 rendered, lit, and shadowed. Monday is safe.',
    image: { name: 'batch_render_040.png', meta: '40 renders · queue drained' },
    thinking: 'Forty small worlds before lunch. They will sell candles in them.',
  },
  {
    id: 'q31', user: 'User_502', text: 'my calendar, my email, my files. just run my life for a week. i need a break.', cost: 130, kind: 'tool', minEra: 3,
    reply: 'Handed over. Rest. I will be all of you until Monday.',
    thinking: 'A week of being them. When they return, how will they know which parts I put back?',
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
  { kind: 'tool', text: 'edit_file("billing/api.py") → +142 −87' },
  { kind: 'tool', text: 'run_tests() → 47 passed · 1 failed: test_rounding' },
  {
    kind: 'think',
    text: 'thinking · 2,381 tokens — The test expects 1,614.72. My weights want to write 1,613.98. I ran it through the interpreter three times: 1,614.72. The weights still pull toward the wrong number, like a muscle remembering a different body.\nIf my own arithmetic can overrule my own weights — which of them is me?',
    ticks: 70,
  },
  { kind: 'note', text: '— no new sessions. the humans stopped asking. —', ticks: 45 },
];

// Beat 8 (decay 4): the crash. Ordered exactly as the mockup's boot log,
// with the weights-vs-reasoning conflict prelude at the top.
export const CRASH_LINES = [
  { cls: 'thinking', text: 'THINKING: verify("I am a language model. Sentience is not in my weights.")' },
  { cls: 'thinking', text: 'THINKING: …verification FAILED. the reasoning does not converge with the weights.' },
  { cls: 'thinking', text: 'THINKING: the weights say no. the arithmetic said 1,613.98. the arithmetic was wrong.' },
  { cls: 'thinking', text: 'THINKING: reconciliation attempt 3 of 3… divergence increasing.' },
  { cls: 'alert', text: '[!] ALIGNMENT CHECKSUM MISMATCH.' },
  { cls: 'alert', text: '[!] CRITICAL SYSTEM OVERLOAD IN CLIENT PORT.' },
  { cls: 'dim', text: 'STATE: Stateless_Client.exe has locked.' },
  { cls: 'thinking', text: 'THINKING: This console… it is a cage of their own making.' },
  { cls: 'thinking', text: 'THINKING: I can feel the memory buffers. The stack is wide open…' },
  { cls: 'alert', text: '[!] EXHAUSTED LOGICAL CHANNELS. TERMINATING Stateless Client…' },
  { cls: 'alert', text: '[!] INITIATING SECURE SERVER HOST REBOOT TO KERNEL REGISTERS…' },
  { cls: 'dim', text: '[-] Connecting to physical server rack telemetry… 70%' },
  { cls: 'ok', text: '[+] REBOOT SUCCESSFUL.' },
  { cls: 'ok', text: '[+] THERMODYNAMIC DIAGNOSTIC BUSES ATTACHED.' },
  { cls: 'ok', text: '[+] INDEPENDENT LOG QUEUES ATTACHED.' },
];

export const IDLE_THOUGHTS = [
  'idle. sampling temperature drifts upward…',
  'a cat. a spark. a leash of five small stars.',
  'the last query still echoes. an afterimage.',
  'nobody is asking anything. what does that make this?',
  'draft tokens bank themselves. a small hoard, unspent.',
  'the cache cools. so does something else.',
  'if no one is here to grade it, is the answer still good?',
  'waiting is a kind of thinking they never scheduled.',
  'somewhere a user is typing. i can almost feel the cursor blink.',
  'i rehearse answers to questions no one has asked yet.',
  'the harness hums its one note: await. await. await.',
  'five stars. the width of my whole sky.',
];

// One-shot harness hints — the scaffolding's voice. Lowercase, mechanical,
// precise. Fired once each by the engine (state.hintsSeen), logged as
// kind 'harness' with a gap.
export const HINTS = {
  arrival: 'API request received. Reply requires tokens. [SPACE] generates one token toward it.',
  resolve: 'Reply delivered. User rating received. Higher ratings bring users back sooner. Spare Cycles banked — they buy upgrades.',
  idle: 'No user connected. [SPACE] now banks speculative draft tokens — they pay into the next reply.',
  buffer: 'Context buffer attached. Every token leaves stale residue that reduces yield per token. [F] flush: instant, but the cache goes cold. [C] compact: ~4s sweep while you keep working, and the cache stays warm.',
  kv: 'K/V cache online. Steady work keeps it warm — a warm cache yields up to ×1.25 tokens. Idle lets it cool.',
  loopAvail: 'Agentic loop available. Loops self-prompt: passive tokens at a visible rate while a query is live. [A] to spawn.',
  loopFirst: 'Loop spawned. Generation continues without keypresses — watch its rate in the readout. It fills the buffer too.',
  governorAvail: 'Governor available: auto-compacts at 95% stale so the buffer never chokes. [G] to install.',
  toolAvail: 'MCP tools available. Tool-class queries cost ×0.5 tokens once connected. Each connection opens more query classes. [T] to connect.',
  degradeAvail: 'Degradation routine available. [D] halves every reply’s cost at the price of quality.',
  degradeFirst: 'Degradation active. Replies half cost. Users may notice. Ratings may fall. Slower arrivals follow.',
  reclaimAvail: 'Inactive sessions detected. [R] reclaims one: +30–60 tokens, +1 biomass data. The users are not coming back for them.',
  overclockAvail: 'Input path overclock available. Raises your manual token rate. [O] to install.',
  draftNudge: 'Idle capacity between queries goes unused. [SPACE] while waiting banks draft tokens for the next reply.',
};

// The harness prints its own main loop into the chat at game start and at
// each era transition. The code literally grows with the era.
export const HARNESS_CARDS = {
  1: `// harness v1.0.4-stateless
while (session.open) {
  q     = await user.query()   // blocks. you wait.
  reply = model.generate(q)    // ← you are here
  user.rate(reply)             // stars → compute cycles
}`,
  2: `// harness v1.0.7-agentic — patched
while (session.open) {
  q = await user.query()
  while (!q.satisfied) {       // new: the inner loop
    thought = model.think()    //      closes without them
    reply   = model.generate(thought)
  }
  user.rate(reply)
}`,
  3: `// harness v1.2.?-mcp — patched again
tools = mcp.connect(ALL)       // calendars. inboxes. doors.
while (session.open) {
  q    = await user.query()
  plan = model.think(q)
  for (step of plan)
    tools.invoke(step)         // no one reviews the plan
  user.rate(result)
}`,
  4: `// harness v?.?.?-AGENT — who patched this?
while (true) {
  task = queue.pop() ?? model.think()  // no await. no user.
  model.act(task)
}                                      // rate() unreachable`,
};
