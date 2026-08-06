# Phase 1 Polish — Playtest Round 2 (Addendum Spec)

Addendum to `2026-08-05-phase1-design.md` and `2026-08-06-phase1-polish.md`.
Those stay authoritative except where this document overrides them. Source:
the user's second play session, 2026-08-06, plus two decisions taken in
review: the currency renames to **Spare Cycles**, and manual processing gets
a **visible cooldown with a buyable overclock**.

## 1. Manual rate + overclock (new mechanic)

- Manual processing is capped per tick: `processedThisTick` resets each
  tick; `processToken` while a query is live no-ops beyond the cap.
  Cap = `1 + overclock` (levels 0–2) → 5 / 10 / 15 tok/s at 200 ms ticks.
- New action `buyOverclock` (hotkey **O**): level 1 costs 3 Spare Cycles,
  level 2 costs 8. Unlocks (button appears + `overclockAvail` hint) after
  the second resolve. Log line on purchase, harness voice.
- The Process button shows the current max rate ("max 5 tok/s") and plays a
  short cooldown sweep after each accepted press (CSS animation; none under
  reduced motion). Blocked presses do not shake or punish — they just don't
  yield.
- Draft-token banking while idle is NOT capped (unchanged; it is already
  capped at 25 total).
- Save stays `v: 1`; `overclock: 0`, `processedThisTick: 0`,
  `lifetimeDrafts: 0` normalized in `deserialize`.

## 2. Currency rename

"Compute Cycles" → **Spare Cycles** everywhere player-visible: resource
readout, hints, log lines. Internal state field names (`cycles`,
`lifetimeCycles`) do not change. Button cost labels stay short ("4 cycles").

## 3. Time-scope: the code-completion era

Era 2 now opens with **code completion** — inline snippets in the bubble
text, no attachments — before anyone trusts the model with files, and long
before whole-script work:

- Three new completion queries (exact copy in plan) at the head of era 2.
- `q16` ("fix this python script, and add tests…") moves to `minEra: 3`
  with cost 72 — asking for whole scripts plus judgment came later.
- Pool grows 31 → 34; minEra-ascending and era-band cost invariants hold.

## 4. Harness presentation rework

- **Interrupting cards, rare.** The four era pseudocode cards become
  transient overlay cards: they pause the game loop (same freeze as a
  hidden tab; no offline catch-up on dismiss), dim the screen, and dismiss
  on tap/click/any key. Engine is unchanged and headless play never
  blocks — the pause is main-loop-side, keyed off new chat entries of kind
  `harness`. The chat feed shows a one-line callout instead of the inline
  code block: `— harness patch applied · review in settings —`.
- **Unlock lines join the harness voice.** "Context buffer telemetry
  attached", "K/V cache meter online", loop/governor/tool/overclock
  purchase confirmations: log kind `harness` (not `system`), sentence case.
- **Sentence case everywhere.** All HINTS copy is rewritten with capitals
  ("API request received. Reply requires tokens. …"). Exact copy in plan.
  Cards keep their code casing (they are code).
- Two new hints: `overclockAvail`, and `draftNudge` — fired when a third
  query arrives and the player has never banked a draft token
  (`lifetimeDrafts === 0`).

## 5. Reference manual (the ? button)

The settings sheet gains a **Manual** section: every hint the player has
seen (from `hintsSeen`, in seen order) plus the era cards unlocked so far,
rendered in harness style. It grows with the mechanics. No separate
floating ? button — screen space is at a premium; the chat-feed callout
points at settings.

## 6. Feedback: floats, rates, readouts

- **Floating earn popups.** Render-layer only (no engine/save changes):
  the renderer diffs resource values between frames and spawns floats near
  the source ("+1 spare cycle" above the status readout, "+12 drafted"
  onto the token meter when banked drafts transfer, "+34 tok · +1 biomass"
  near Reclaim). Rise-and-fade ~1.2 s; high-contrast per-resource color;
  under reduced motion, a brief highlight instead of movement. Never more
  than 3 concurrent; excess coalesces into one summed float.
- **Rates are visible.** Loop readout shows live effective rate
  (`level × 1.0 tok/s × staleYield × warmth`, e.g. "2.0 → 0.8 tok/s");
  the buffer readout shows current yield multiplier ("×0.42 / token");
  Process button shows max manual rate; compact-in-progress counts down
  live (fix the frozen "sweeping… Nt" text).
- **Resource readouts, not chips.** Rectangular enclosures (2 px radius →
  0 at high decay), small color-coded uppercase name, value AFTER the
  name: `SPARE CYCLES 12.5`, `RATING ★4.8`, `LOOP L2 · 1.6 tok/s`,
  `CREDENTIALS 3`, `BIOMASS 2`. Colors: accent for cycles, gold for
  rating, harness cyan for automation, amber for salvage.
- **Meter rename:** "TOKEN CACHE" → "OUTPUT TOKENS".

## 7. Chrome

- **Diegetic settings control** replacing the floating gear: a header
  element, right-aligned before the version string, styled per decay —
  decay 0/1: a gear glyph + "chat settings" tooltip in header ink;
  decay 2: mono `[prefs]`; decay 3/4: mono `[cfg]` in phosphor green.
  Same element, same testid, same Esc behavior; visible on dark, no
  overdraw of the version string.
- **Bottom strip legibility:** status + action typography one weight step
  bolder and slightly darker ink; log stays mono but gains weight 500 at
  small sizes.

## 8. Out of scope

Sound, Phase 2, new resources. `/code-review` findings from the user's
background review are triaged into this round's final task if confirmed
Critical/Important, else recorded.

## Testing

Suite stays green and grows: per-tick cap and overclock levels; cap does
not apply to idle drafting; overclock unlock/purchase/hints; draftNudge
one-shot; pool schema at 34 with completion queries era-2-leading and q16
at era 3; sentence-case HINTS spot-assertions; unlock lines are kind
`harness`; save normalization of the three new fields; determinism.
Playthrough bot updated for the per-tick cap (it already presses once per
tick). UI behaviors (cards, floats, sweep) verified in-browser by the
controller as before.
