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

## Pipeline audit — v0.26.1

Triggered by a report of noticeable lag before a sound played, "as if waiting
for the animation to finish". Measured rather than guessed, and the first
hypothesis was wrong.

| Suspect | Verdict |
| :--- | :--- |
| Projection stealing main-thread time | **Not guilty.** Queued-work latency identical tapping (p50 4.6ms), idle (4.6ms) and with the loop stopped (4.6ms) |
| Sound firing after the paint | **Not guilty.** `dispatch` plays before `paintNow()`, and always did |
| Draw loop running at double speed | **Guilty.** 120fps against physics authored for 60 |
| Layout forced every frame | **Guilty.** `getBoundingClientRect()` inside the draw loop |
| Web Audio nodes never released | **Guilty.** 1360 still connected after 680 presses |
| Every clip decoded on the press that needs it | **Guilty.** First use of each of 9 clips stalls |

Two lessons for the next audit, both from probes that lied:

- `btn.click()` runs **synchronously** and skips the browser's input queue, so
  it cannot see input delay at all. It reported 0.6ms while the complaint was
  about lag.
- A backgrounded tab throttles timers to 1/sec and rAF to zero. Two runs
  produced pure garbage before the probe started reporting whether the page had
  been visible throughout. Measure that, or measure the browser instead of the
  game.

### What was fixed

**The loop ran at double speed.** Every constant in the draw loop is
per-*frame* and authored at 60fps — `sparkleEnergy -= 1 / (60 * sparkleDuration)`
says so in the source. Uncapped on a 120Hz display, waves, sparkles and the
ring settle all ran twice as fast as tuned, and incoming tokens spawned at
twice the rate `autoRate` asked for. The draw is now paced to 60fps, which
restores the authored timing and halves the work as a side effect: measured
59.6fps on a 120Hz display. `dueForFrame()` carries 1ms of slack, because rAF
lands a hair early often enough that a strict comparison would halve a 60Hz
display to 30.

Delta-time normalisation was the alternative. It would have re-timed every
constant in the file against numbers that were tuned by eye.

**A forced layout every frame.** `resize()` called `getBoundingClientRect()`
inside the draw loop — a synchronous layout, 120 times a second, for a number
that changes when the tray rebuilds and never otherwise. The ResizeObserver is
now the only reader of the face's size. Measured 0 layouts/sec from the loop.
`devicePixelRatio` is still checked per frame, because dragging a window to
another monitor changes it with no resize at all, and reading it is free.

**The audio graph leaked.** `playBuffer` connected a fresh source and gain to
`destination` on every sound and never disconnected either. A node connected to
destination stays in the graph until it is disconnected, and the action tick
fires up to ten times a second — an act is tens of thousands of presses. Now
torn down on `ended`: 402 connects, 402 disconnects, 0 left.

**Every clip stalled on first use.** Each of the nine sounds was fetched and
decoded *inside* its first play call, so the first flush of a run went press →
fetch → decode → noise, once per clip, all through the first act. This is the
best candidate for what was actually heard. They are now decoded on the first
user gesture, which is also the earliest the autoplay policy allows a context
to start.

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
