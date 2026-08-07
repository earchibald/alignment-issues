# Answer diffusion — design spec

Status: ready to implement. Owner: primary coding agent.
Tuning tool: `devtools/` (`just devtools`) — the Diffusion text tab.
Generated settings: `game/js/config/diffusion-settings.js`.

## Summary

| Item | Decision |
|---|---|
| What | While a query is being answered, the transcript shows the answer resolving out of noise. It locks before the query resolves. |
| Progress source | `state.tokens / effectiveCost(state, state.activeQuery)` — already computed for the OUTPUT TOKENS meter. |
| New engine state | None. The effect is view-only. Saves and replays are unaffected. |
| New files | `game/js/ui/diffusion/` (5 modules) + `game/js/config/diffusion-settings.js` (generated). |
| Touched files | `game/js/ui/render.js`, `game/js/ui/settings.js`, `game/css/*`. |
| Hard rule | Never call `nextRand(state)`. The effect uses its own PRNG. |
| Ends when | Cells force-resolve at `SETTLE_AT` (before `p = 1`), so the handoff to the real entry changes only the header. |
| Off switch | Settings toggle, plus automatic off under `prefers-reduced-motion`. |
| Out of scope | Image-card diffusion. Designed for, deferred to phase 2. |

## Goal

An answer today appears whole, the instant `resolveQuery` runs. The player taps,
a meter fills, and then a finished paragraph exists. The work is invisible.

This effect makes the work visible. As tokens accumulate, the answer is present
on screen at full length but unresolved — a field of noise the same shape as the
text. Characters settle into place as the token count climbs. By the time the
query resolves, the answer is readable and still. The transition to "sent" is
then a change of label, not a change of content.

The fiction: you are watching the model decide what it is going to say.

## Non-goals

- Do not change what any answer says. `q.reply` is authoritative and unmodified.
- Do not change the economy, pacing, or rating. No engine behaviour moves.
- Do not animate user queries, harness cards, thinking lines, hints, or logs.
  Only the model's answer to the active query diffuses.
- Do not add a save field. The effect must survive a reload by rebuilding from
  the same `state.tokens`, not by restoring animation state.

## Where it plugs in

Read these before writing code:

| File | What matters |
|---|---|
| `game/js/engine/tick.js` → `resolveQuery` | Pushes `{kind:'sys', text:q.reply}`, then clears `state.activeQuery` and zeroes `state.tokens`. |
| `game/js/engine/actions.js` → `effectiveCost` | Cost of the active query, after degrade and tool discounts. |
| `game/js/ui/render.js` → `renderChat`, `addChatEphemera`, `removeChatEphemera` | The transcript render. Ephemera are the existing pattern for nodes that are not in `state.chat`. |
| `game/js/ui/components.js` → `entryBlock` | The markup every transcript entry uses. The pending answer must use it too. |
| `game/js/ui/settings.js` → `installSettings` | Where the off switch goes, beside the sound and telemetry toggles. |

Progress is:

```js
const q = state.activeQuery;
const cost = effectiveCost(state, q);
const p = cost > 0 ? Math.min(1, state.tokens / cost) : 1;
```

This is the same number `render.js` already puts in the OUTPUT TOKENS meter.
Derive it; do not recompute a second version of it.

## Modules to port

Copy these from `devtools/web/tools/diffusion/` into `game/js/ui/diffusion/`.
The algorithms are settled and tuned. Port them as they are; do not redesign
them mid-port.

| Module | Role |
|---|---|
| `rng.js` | Seeded PRNG. The game already has `engine/rng.js` — **do not use it**, see Constraints. |
| `charset.js` | Class-preserving noise glyphs. |
| `schedulers.js` | The four resolve orders. |
| `diffuser.js` | Cell state machine. Target-agnostic. |
| `text-view.js` | Span grid, luminance jitter, lock flash. |

`text-view.js` renders three states, not two: a cell that is churning noise, a
cell showing its true glyph but not yet locked, and a locked cell. Luminance
jitter applies only to the first. Keep that distinction on the port — it is what
makes a near-finished answer look near-finished.

`token-source.js`, `controls.js`, `tool.js` are lab-only. Do not port them: the
game has a real token stream and no sliders.

One new module, `game/js/ui/diffusion/pending-answer.js`, owns the lifecycle
described below. It is the only file `render.js` imports.

## Lifecycle

```
activeQuery becomes non-null
        │
        ▼
  create pending node ────► append to transcript tail (ephemeral, not in state.chat)
        │
        ▼
  per frame: p = tokens / cost ──► diffuser.tick(mapped p) ──► view.render
        │
        ▼
  p >= SETTLE_AT ──► every cell force-resolves; text is readable and still
        │
        ▼
  resolveQuery fires ──► real sys entry appended ──► pending node removed
```

### Creating the node

Create the pending node on the first render where `state.activeQuery` is
non-null and the previous render's was null. Build it with `entryBlock` so the
markup matches a real entry exactly, with:

- the same `who` and `side` a resolved `sys` entry gets,
- an extra class `pending` on the wrapper,
- `text: ''`, then mount the diffusion span grid into `.e-body`.

The node lives at the tail of the transcript, after every entry in `state.chat`.
It is not pushed through `pushChat` and never enters `state`.

### Surviving re-renders

`renderChat` appends new entries when `state.chatSeq` changes, and other entries
arrive while a query is active — thinking lines, harness asides, hints. The
pending node must:

- stay in the DOM across those renders, keeping its animation state,
- always end up **after** newly appended entries, so it stays at the tail,
- not be destroyed by `removeChatEphemera`, which clears the caret and note.

Move it to the end after any append rather than rebuilding it. Rebuilding resets
every cell to noise and reads as a glitch.

### The settle window

`p` reaches 1 only at the instant `tick` resolves the query, so a naive mapping
would still be mid-resolve at handoff. Map progress instead:

```js
const effective = Math.min(1, p / SETTLE_AT);   // SETTLE_AT = 0.92
```

Every cell is fully locked once `p >= SETTLE_AT`. The last 8% of the meter is
the answer sitting finished, waiting to be sent. That gap is the point: the
player sees the answer complete, then sees it go out.

### The handoff

When `resolveQuery` pushes the real `sys` entry:

1. `renderChat` appends the real entry as it does today. No change there.
2. `pending-answer.js` removes the pending node in the **same** render pass.

The body text is byte-identical by then, so nothing in the paragraph moves. Only
the `pending` class disappears. Do not cross-fade, and do not animate the swap —
a transition here reads as a repaint bug, not as a send.

Assert the identity in a test: at removal, the pending node's `textContent` must
equal `q.reply`. If it does not, the settle window or the force-resolve is wrong.

## Constraints

**Never call `nextRand(state)`.** It advances `state.rngState`, which seeds the
whole run. A cosmetic effect that consumes engine randomness would change query
order, ratings, and idle thoughts, and would break save/replay determinism and
the telemetry playthrough tests. Use `mulberry32` from the ported `rng.js`,
seeded from `state.seed ^ constant ^ resolvedCount` so a reload during the same
query produces the same field. Luminance jitter and lock flash use
`Math.random`; they are view-only and must not consume even the local stream.

**No new save fields.** `state.v` stays 1. On reload mid-query, rebuild the node
from `state.tokens` and jump straight to that progress. The player sees a
partially resolved answer, which is correct — that is where the work is.

**Reduced motion.** Under `prefers-reduced-motion: reduce`, render the pending
answer fully settled from the start: correct text, no churn, no flash, no
jitter. Do not skip the node — the answer should still appear as it is generated.
Re-check the media query on change; do not read it once at load.

**Off switch.** Add a toggle to the settings dialog, default on, persisted the
way the sound and telemetry toggles already persist. Off means no pending node
at all: the transcript behaves exactly as it does today.

**Accessibility.** Mark the noise field `aria-hidden="true"` while unresolved.
Screen readers must not read churning characters. Announce the answer once, at
the real entry. Keep one accessible copy of the final text.

**Performance.** One span per character, and long answers run to a few hundred
characters — acceptable, and the demo runs four of these at once. Still:

- one `requestAnimationFrame` loop, shared with any existing loop,
- redraw at the shimmer rate, not per frame; only flash decay is per frame,
- write only cells that changed, as `text-view.js` already does,
- stop the loop when no query is active.

## Edge cases

| Case | Required behaviour |
|---|---|
| Ceiling query (`activeQuery.id === 'ceiling'`) | No pending answer. It has no reply and never resolves. Skip it explicitly. |
| Flush of draft tokens | `state.tokens` jumps up. The effect continues from the new `p`; it does not restart or rewind. |
| Choked buffer / compacting | Tokens stop accruing. The field keeps churning at a frozen `p`. Stalled work looks stalled — this is correct, not a bug. |
| Degrade mode | Cost halves, so `p` climbs faster. No special casing. Optionally force `glyphNoise` on while degraded, if it reads well; not required. |
| Answer shorter than a few characters | Effect still applies. Do not add a length threshold. |
| Reload mid-query | Rebuild at current `p`, per Constraints. |
| Crash / teaser phase | `state.phase !== 1`. No pending node. |
| Two queries back to back | The node is destroyed and recreated. State from the previous answer must not leak into the next. |

## Settings and the tuning loop

`game/js/config/diffusion-settings.js` is generated by the dev suite. Import
`DIFFUSION_SETTINGS` and use it directly. Do not copy the values into
`constants.js`, and do not hand-edit the file expecting it to survive — the next
apply overwrites it.

The loop is: run `just devtools`, tune on the Diffusion text tab, pick a
scheduler with its panel radio, press **Apply settings to project**, confirm, and
reload the game. The write is a normal working-tree edit; `git diff` shows it.

Commit the generated file. It is the effect's tuning, and the game does not run
without it. Fall back to the built-in defaults if the import is missing, so a
fresh clone that has not run the tool still boots.

## Acceptance criteria

1. During an active query, the transcript tail shows an unresolved field the
   same length as `q.reply`, which resolves as tokens accumulate.
2. At `p >= 0.92` the pending text equals `q.reply` exactly, and stops moving.
3. When the query resolves, the paragraph does not move, reflow, or re-animate.
4. `state.rngState` is identical after a query with the effect on and off.
5. A save taken mid-query, reloaded, produces the same visible progress.
6. With the toggle off, or under reduced motion, the transcript matches today's
   behaviour for every existing test.
7. No new keys in the save payload. `save.test.js` passes unchanged.

## Test plan

Add `test/diffusion.test.js` (`node --test`, matching the existing suite).

**Pure, no DOM:**
- `schedulers` — each returns one offset per character, all within `[0, 1)`.
- `diffuser` — from noise to `p = 1`, the values equal the target exactly; over
  a full run most cells change more than once; whitespace never scrambles unless
  `blockNoise` is set.
- Determinism — same seed and params give an identical value sequence.

**Engine safety (the important one):**
- Run a scripted query to resolution twice, once with the effect module imported
  and driven, once without. Assert `state.rngState`, `state.chat` and
  `state.ratings` are identical. This is the regression that matters: it is the
  one that silently corrupts saves.

**DOM-level**, following the pattern in `ui-modules.test.js`:
- Pending node appears when `activeQuery` is set, and is gone one render after
  the real entry lands.
- At removal, pending `textContent === q.reply`.
- Reduced motion renders settled text immediately.

Do not assert on intermediate noise content. It is random by design; testing it
would only pin the implementation.

## Phase 2 — image cards

`diffuser.js` is target-agnostic on purpose: it knows values, class tags and
resolve windows, not characters. An image card (`components.js` → `genImgCard`)
can reuse it unchanged by feeding it palette indices per block, a different
noise function, and a canvas renderer instead of a span grid. The four
schedulers work as they are once a block's `(x, y)` maps to a 1-D index; a
radial or blue-noise scheduler is the natural addition.

Do not build this in phase 1. Do not change `diffuser.js` in a way that assumes
characters, or phase 2 pays for it.
