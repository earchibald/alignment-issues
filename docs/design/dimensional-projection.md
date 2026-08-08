# The dimensional projection

Status: **Built** — v0.26.0
Source: `matrix-visuals/src/Visualizations.jsx`, `DimensionalProjection`
Port: `game/js/ui/projection.js` · Tests: `test/projection.test.js`

| | |
| :--- | :--- |
| What it is | The animated face of the token-generation button in Arc 1 |
| Where it sits | Bottom of the action tray, full width, 104px tall |
| What it reads out | K/V cache warmth (hue), context residue (wave boundary), agentic loop (incoming tokens) |
| What it costs | One `<canvas>`, one rAF loop, no dependencies, no build step |
| Arc 2 | Not used. Arc 2 has no tap verb and its own terminal surface |

## The four driving props

Section 2 of the sandbox's integration guide names them. What they mean in this
game is decided in `projectionProps(state)`, which is pure and tested.

| Prop | Bound to | Reads as |
| :--- | :--- | :--- |
| `tapsCount` | A landed `processToken` | One wave leaves the ring per press |
| `autoRate` | Loop level × rate, **only while a user is waiting** | Tokens fly in from off-face |
| `contextHealth` | `100 − stale`, once the buffer is revealed | How far a wave gets before it hits the wall |
| `cacheHealth` | `warmth`, once the K/V cache is revealed | Orb hue, red → green, and the orb's wobble |

Two rules hold across all four:

- **A meter the player has not been shown reads as healthy.** Before the buffer
  exists there is no residue to suffocate the waves with, and before the K/V
  cache exists a cold cache is not a fact about the world. Both sit at 100
  until their mechanic is revealed. Otherwise the game opens on a red,
  strangled orb reporting on systems that do not exist yet — the same
  premature-vocabulary rule the tooltips follow, applied to colour.
- **`autoRate` is effect, not intent.** The loop only self-prompts while a user
  is waiting, so an idle machine shows no incoming tokens however many levels
  were bought. Law 5.

## Three departures from the sandbox

The guide asks for a straight copy of a React component. This codebase has no
React, no bundler and no dependencies, so the physics were carried over and the
plumbing rewritten. Three changes are load-bearing and should not be undone.

**1. The geometry scales.** The source hardcodes a 380×120 button and an orb of
radius 50, and the guide's own note 3 says those numbers must be kept in step
with the CSS by hand. They are not. Every length is authored against `REF_H`
and multiplied by the live height, so the composition survives a 320px phone
and a 700px desktop.

The wave boundary needed more than that. `waveReach` was a flat 350px measured
for a 380-wide face; scaled by height alone, most of that range falls off-canvas
on a tray button, and a suffocating buffer draws the same picture as a clean
one — the context meter reports nothing at all. It is now a multiple of the
face's own half-diagonal, so `> 1` always means "runs clear off the corners"
whatever shape the button is. This was caught on screen, not in review.

**2. One persistent canvas.** `renderActions()` rebuilds the tray with
`replaceChildren()` whenever its signature moves, which is several times a
second. Building the canvas inside the button would destroy the trails, the
in-flight waves and the rAF loop every time. The node is owned by
`ui/projection.js` and re-parented into each new button instead.

**3. The loop is not always running.** The source animates forever. This one
stands down when the tray is hidden (Arc 2, the crash, the teaser), when the
document is in the background, and completely under `prefers-reduced-motion`,
where it paints a still frame on change and no waves, sparkles or particles at
all.

## Layout

The token button moved to the **bottom** of the tray. It is the one control
pressed continuously, so it belongs under the thumb; the situational buttons
stack above it rather than pushing it around as they appear. `actionSpecs()`
emits it last and a test holds that across every scene. Nothing downstream
matches on index — only on `testid`.

Colours come from theme variables (`--proj-face`, `--proj-wave`,
`--proj-token`, `--proj-radius`) because the tray repaints across five decay
palettes. At decay 3/4 the waves join the CRT green rather than staying violet,
which would have been the one thing on screen that never belonged to the
terminal.

## Known and deliberate

- **The ring is clipped at peak tap.** At rest the composition fits inside the
  face; a tap pushes the ring past the top and bottom edges and the clip cuts
  it. That is the enclosure the energy is pressing against, and it is the shot.
  A test asserts both halves so neither drifts.
- **The face is dark in every era, including the bright ones.** At decay 0 the
  client is a white SaaS app with a black glowing screen at the bottom. The
  token generator is the one piece of hardware in a web app; the contrast is
  the point. Worth revisiting if the light eras start to feel incoherent.
- **`waveOverflowDistance` is 0.** `.act` has `overflow: hidden` for the tap
  sweep, so the holographic bleed the guide describes is not free. It would
  need the sweep moved onto a separate layer first.

## Tuning

The dev suite's **Token Button** tab writes
`game/js/config/dimensional-settings.js`, which is merged over the defaults in
`projection.js` — the same override arrangement `engine/constants.js` and
`arc2-constants.js` use. The defaults stay readable in one place as the
documented baseline instead of being rewritten by every apply.

The tuner and the module have to agree on key names, and there is no runtime
error when they do not: the slider moves, the apply succeeds, the file is
written, and the button does not change. `test/projection.test.js` asserts the
dev-suite schema and `PROJECTION` have exactly the same keys, in **both**
directions — a knob with no slider is as bad as a slider with no knob.

The colour knobs (`faceColor`, `waveColor`, `tokenColor`) default to empty,
meaning "let the decay palette drive it". A hex pinned there wins in all five
eras, so it is a deliberate override rather than the normal way to set a colour.

## Bugs found on the way in

**The loop could die on startup.** `projectionNode()` creates the canvas and
schedules the first frame; `render.js` prepends it into a button that is itself
attached later. If that first frame won the race, `draw()` hit its
`!node.isConnected` guard and returned *without* rescheduling — so the loop
stopped for the rest of the session and the button stayed blank. All three
idle cases (unparented, tray hidden, tab backgrounded) now reschedule, and
`projectionNode()` doubles as a heartbeat on every tray rebuild. Verified over
12 cold loads: all paint, worst case 90ms.

## Not built

- No sound. The tap already has one; the waves do not.
- No Arc 2 use. Arc 2 has no tap verb and owns its own terminal surface.
