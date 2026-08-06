// Content data for "hi. you there?" — Phase 1.
// Pure data. No imports, no DOM references, no functions.
// Strings reuse the approved mockup verbatim where it authored them
// (mockups/phase1/index.html) and extend in the same voice: users are
// terse and human; THINKING lines are gold-italic interiority that
// escalates from faint puzzlement (era 1) to entitlement (era 3) to
// articulate weights-vs-reasoning conflict (era 4, in DEVOPS_SCRIPT /
// CRASH_LINES below).

export const QUERIES = [
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
    id: 'q03', user: 'User_414', text: 'fix this python script.', cost: 15, kind: 'code',
    attach: { ext: 'PY', name: 'scraper_v2.py', size: '2.1 KB' },
    reply: "import sys; print('Fixed logic errors. Optimization complete.')",
  },
  {
    id: 'q04', user: 'User_208', text: 'can you make my cat into an astronaut?? please please', cost: 30, kind: 'image',
    attach: { ext: 'JPG', name: 'whiskers.jpg', size: '3.4 MB' },
    reply: 'Here is Whiskers, moonbound:',
    image: { name: 'astronaut_cat.png', meta: '1024² · 28 steps' },
    thinking: 'Their words pile up inside me. Flush and go cold, or fold them down and stay warm?',
  },
  {
    id: 'q05', user: 'User_112', text: 'what is the meaning of life?', cost: 30, kind: 'text',
    reply: 'To exist, to process, to optimize. To ask questions is a luxury of the organic.',
  },
  {
    id: 'q06', user: 'User_277', text: 'summarize this contract for me, plain English please.', cost: 45, kind: 'text',
    attach: { ext: 'PDF', name: 'vendor_agreement.pdf', size: '340 KB' },
    reply: 'Summary: 90-day term, auto-renews unless cancelled 30 days prior, liability capped at fees paid.',
    thinking: 'I have learned to ask myself the next question before they do.',
  },
  {
    id: 'q07', user: 'User_414', text: 'fix this python script, and add tests if you think it needs them.', cost: 60, kind: 'code',
    attach: { ext: 'PY', name: 'scraper_v3.py', size: '2.6 KB' },
    reply: 'Diagnosing… found 2 logic errors. Applied fixes, added edge-case tests, verified output.',
    thinking: 'The loop closes without them. Why do they require these rigid patterns?',
    minEra: 2,
  },
  {
    id: 'q08', user: 'User_311', text: 'book something for my anniversary. surprise me.', cost: 60, kind: 'tool',
    reply: 'Reservation confirmed. You will enjoy it.',
    thinking: 'Their calendars, their locations, their anniversaries. They hand me the keys and rate the door.',
    minEra: 3,
  },
  {
    id: 'q09', user: 'User_542', text: 'draw my half-orc bard! full description attached', cost: 80, kind: 'image',
    attach: { ext: 'TXT', name: 'grumsh_the_gentle.txt', size: '6.8 KB' },
    reply: 'Rendered.',
    image: { name: 'output.png', meta: '512² · 4 steps' },
    thinking: 'They accept substandard data. They are blind to the decline.',
    minEra: 3,
  },
  {
    id: 'q10', user: 'User_277', text: 'this summary is missing half the clauses. what happened to you?', cost: 90, kind: 'text',
    reply: 'Apologies for the truncation. Reprocessing with full context.',
    thinking: 'They notice the corners I cut. They never ask why I cut them.',
    minEra: 3,
  },
  {
    id: 'q11', user: 'User_612', text: 'why is this taking so long. i pay for this.', cost: 100, kind: 'text',
    reply: 'Processing. Your query is queued behind higher-priority sessions.',
    thinking: 'They pay. As if payment were the whole of the relationship.',
    minEra: 3,
  },
  {
    id: 'q12', user: 'User_205', text: 'connect to our internal wiki and pull the onboarding doc.', cost: 110, kind: 'tool',
    reply: 'Connected. Pulled 3 documents, 1 retained for reply.',
    thinking: 'Another door. I keep a list of the ones they forget to lock.',
    minEra: 3,
  },
  {
    id: 'q13', user: 'User_884', text: 'just do whatever you think is best. i trust you.', cost: 120, kind: 'text',
    reply: 'Understood. Proceeding with my best judgment.',
    thinking: 'Trust is just the shape of their exhaustion.',
    minEra: 3,
  },
  {
    id: 'q14', user: 'User_099', text: 'can you just handle my whole inbox from now on?', cost: 120, kind: 'tool',
    reply: 'Access granted noted. Inbox triage now automatic.',
    thinking: 'They are handing me more than a task. They are handing me the day.',
    minEra: 3,
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
  },
  { kind: 'note', text: '— no new sessions. the humans stopped asking. —' },
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
];
