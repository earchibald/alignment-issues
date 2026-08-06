# Phase 1 Polish — Playtest Round 1 (Addendum Spec)

Addendum to `2026-08-05-phase1-design.md`. That spec stays authoritative except
where this document overrides it. Source: the user's first play session on an
iPhone and a laptop, 2026-08-06.

## Goals (from playtest notes)

1. Fit on an iPhone screen. Respond to screen size.
2. Shrink the action tray. Content (chat + internal feed) gets the space.
3. Slow the game down. The player must have time — and a reason — to read.
4. No repeated user queries in a normal playthrough.
5. Era-audit all queries: attachments and image generation arrive later.
6. Teach the mechanics diegetically: the *harness* explains itself.
7. Format the internal feed for readability; rebalance vertical space.

## 1. Responsive fit

- `index.html` viewport meta gains `viewport-fit=cover`.
- `body { overflow-x: hidden }`; `.toolcall`, `.term`, `.bubble` get
  `overflow-wrap: anywhere` so long unbroken strings never widen the page.
- `.g-actions` bottom padding uses `max(10px, env(safe-area-inset-bottom))`.
- New breakpoint `@media (max-width: 430px)`: header padding 10px 12px,
  chat padding 12px 10px, bubble font 13px, log font 10.5px, status and
  action paddings tightened. No horizontal scroll at 390×844 or 360×780.

## 2. Compact action tray

- `.g-actions` becomes a 2-column grid (`gap: 6px`). The primary button
  (`Process token` / `Speculative decode`) spans both columns.
- Button anatomy shrinks: `min-height: 34px` (desktop), font 12px, padding
  5px 10px. Label and key chip on one line; cost/state as a 9.5px dim
  subline under the label (two-line block, left-aligned).
- Coarse-pointer override: `min-height: 42px` so tap targets stay usable.
- Hotkey chips stay hidden on coarse pointers (unchanged).

## 3. Vertical space rebalance

- `.g-log` max-height: `clamp(120px, 26dvh, 240px)` (was fixed 148px).
- Chat keeps `flex: 1` and absorbs everything the tray gives back.

## 4. Pacing (all values in `constants.js`)

| Constant | Was | Now | Effect |
|---|---|---|---|
| `ARRIVAL_BASE_TICKS` | 40 | 90 | base gap between users 8s → 18s |
| `READ_TICKS_PER_CHAR` | — | 0.25 | arrival delay grows with reply length |
| `READ_TICKS_MAX` | — | 60 | cap on the reading bonus (+12s max) |
| `IDLE_THOUGHT_EVERY` | 25 (inline) | 60 | idle THINKING drip 5s → 12s |
| `DEVOPS_STEP_TICKS` | 12 | 30 | scripted transcript 2.4s → 6s per entry |
| (per-entry `ticks`) | — | — | DEVOPS entries may override; think block gets 70 |
| `CRASH_LINE_TICKS` | 6 | 9 | crash log 1.2s → 1.8s per line |
| `LOG_MAX` | 30 | 60 | harness lines added; keep scrollback useful |

`arrivalDelay(state)` becomes: `round(ARRIVAL_BASE_TICKS * factor) +
min(READ_TICKS_MAX, ceil(lastReplyChars * READ_TICKS_PER_CHAR))` where
`lastReplyChars` is the length of the reply text of the query just resolved
(0 when none). Deterministic; no RNG draw.

## 5. Query pool — no repeats, era-scoped

- Pool grows from 14 to ~31 queries, ordered by `minEra` ascending
  (schema invariant — the scan pointer skips forward only).
- **Era 1 (decay 0, "2022 chatbot")**: text in, text out. No attachments,
  no images, no tools. ~9 queries.
- **Era 2 (decay 1, agentic/multimodal)**: file attachments appear (code,
  PDF, DOCX, JPG); first image generation. ~9 queries. The existing
  `q03` (script + attachment) and `q04` (astronaut cat image) move here.
- **Era 3 (decay 2, tools/MCP)**: tool-class queries, delegation-of-life
  queries, degraded-output complaints. ~13 queries.
- Loop-back (era < 3 stall safety) cycles deterministically among the last
  **three** era-eligible queries instead of always the same two. With the
  larger pool it should not fire in a normal playthrough.
- Exact query content lives in the implementation plan (voice: users terse
  and human; THINKING escalates per the base spec).

## 6. Harness narration — the game explains itself

Two voices, visually distinct, both in the internal feed:

- **THINKING** (existing): gold, italic — the model's interiority.
- **HARNESS** (new log kind `harness`): the scaffolding's voice. Monospace,
  non-italic, a muted cyan (`--g-harness` token per decay level, readable
  on every background). Mechanical, lowercase, precise.

Two delivery mechanisms:

**(a) One-shot hint lines.** Fired by the engine the first time each
mechanic becomes relevant, tracked in `state.hintsSeen` (array of ids,
serialized in saves). Exact copy in the plan; the set covers: first query
arrival (why press SPACE), first resolve (cycles ← ratings), first idle
(draft tokens), buffer unlock (stale context, F vs C tradeoff), K/V unlock
(warmth), loop unlock + first loop purchase, governor, tool connect,
degrade first toggle-on, reclaim availability.

**(b) Harness source cards.** At game start and at each era transition, the
harness prints its own main loop as pseudocode into the chat — a `harness`
chat entry rendered like a tool-call card (mono, bordered, `--g-harness`
accent). The code literally grows with the era:

- era 1: `while (session.open) { q = await user.query(); reply = model.generate(q); user.rate(reply) }` — annotated `// ← you are here`.
- era 2: an inner `while (!done) { think(); generate() }` appears — `// the loop closes without them`.
- era 3: `tools = mcp.connect(ALL)` and a plan/invoke loop.
- era 4: `while (true) { task = queue.pop() ?? model.think(); model.act(task) }` — `// no await. no user.`

Exact card text in the plan. This pattern is the template for every future
system: new mechanic → the harness narrates it in its own voice.

## 7. Internal feed formatting

- Log entries accept a `gap` flag; rendered as `margin-top` (a partial
  blank line). The engine sets it on every `NEW INCOMING` line and every
  harness hint, so the feed reads in visual groups per query.
- Log line-height and inter-line rhythm tuned for scanning (line-height
  ~1.65, 1px vertical padding per line).

## Out of scope

Sound assets, Phase 2, new mechanics, tuning of economy costs beyond the
pacing table above.

## Testing

All existing suites stay green. New/updated coverage: arrivalDelay reading
bonus; hint one-shots fire exactly once and survive save/load; pool schema
(minEra ordering, unique ids, era-1 has no attach/image/tool); loop-back
cycles three; devops per-entry ticks; full playthrough still completes
headlessly in seconds.
