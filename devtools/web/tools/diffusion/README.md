# Diffusion text lab

A tab in the dev suite. It tunes how a generated answer resolves out of noise as
tokens arrive, then writes the chosen settings into the game.

```bash
just devtools          # http://localhost:8899
```

The implementation spec for the game side is
[answer-diffusion-design](../../../../docs/superpowers/specs/2026-08-07-answer-diffusion-design.md).
`rng.js`, `charset.js`, `schedulers.js`, `diffuser.js` and `text-view.js` are
ported into the game as they are; `controls.js`, `token-source.js` and `tool.js`
are lab-only.

## Applying

Pick a scheduler with the radio in its panel header — that panel's name is what
Apply sends as `scheduler`. Then press **Apply settings to project** in the
suite bar. The stream controls (tokens/sec, expected tokens), the seed and the
target text simulate a token stream; the game has a real one and derives
progress from `state.tokens / effectiveCost`, so those four are not applied.

## What it does

The answer starts as a full-length field of noise. As simulated tokens arrive,
each character cell gains a rising chance of showing its true glyph, and a
separately rising chance that a correct glyph sticks. Early correct glyphs
usually churn away again. Every cell resolves exactly at the end.

Four schedulers run side by side on the same target text and the same token
stream, so you can compare them directly.

| Scheduler | Behaviour |
|---|---|
| Uniform | Every cell shares the global progress. Whole-field shimmer. |
| Stochastic settle | Random per-cell resolve windows. The scattered, classic look. |
| Wavefront (biased) | Blends left-to-right order with randomness. Streaming, but fuzzy ahead of the front. |
| Coarse-to-fine spans | Resolves word-sized spans in a confidence-like order. Closest to real masked-diffusion LMs. |

## Parameters

Control labels are abbreviated to keep the bar one row deep. Every control
carries hover text with the full description, drawn by the page rather than by
the browser's native `title` tooltip, because some embedded browser views never
paint native tooltips at all. This table is the same information in one place.

| Control | Hotkey | Effect |
|---|---|---|
| tokens/sec | `1` | Arrival rate of simulated tokens. |
| expected | `2` | Token count the answer is expected to take. `p` hits 1 here. |
| relative shimmer | `M` | Off: constant churn Hz. On: churn tied to the token rate. See below. |
| shimmer Hz | `3` | Constant churn rate. Used when relative shimmer is off. |
| per token | `4` | Churn steps per token. Used when relative shimmer is on. |
| floor Hz | `=` | Lower bound on effective Hz in relative mode. |
| `gamma` | `5` | Correctness ramp. `P(correct) = q^gamma`. Higher = correct glyphs appear later and more suddenly. |
| `lockBase` | `6` | Ceiling on the per-step chance that a correct glyph locks. |
| `delta` | `7` | Lock ramp. `P(lock \| correct) = lockBase · q^delta`. Higher = almost nothing sticks until late. |
| `unsettle` | `8` | Chance per step that a locked cell comes loose again while still inside its window. |
| `spread` | `9` | How scattered the per-cell resolve windows are. 0 = every cell resolves on the same schedule. |
| bias (wave) | `0` | Wavefront only. 0 = stochastic, 1 = strict left-to-right wipe. The middle is the interesting part. |
| spanJitter | `-` | Spans only. Randomness added to the span confidence ordering. |
| preserve char class | `C` | Keep this on. See below. |
| block noise | `B` | Scramble whitespace too. See below. |
| glyphs in noise | `G` | Mix non-alphabetic glyphs into the noise pool. See below. |
| lum jitter | `Q` | Brightness variation on unlocked cells, re-rolled each redraw. |
| lock flash | `W` | How much brighter a cell flashes when it locks. 0 disables it. |
| hold ms | `E` | How long the flash stays at full strength. |
| fade ms | `T` | How long it takes to fade after the hold. 0 = hard cut. |

`q` is a cell's local progress: 0 when its resolve window opens, 1 when it closes.
Global progress `p` is `tokensReceived / tokensExpected`.

## Hotkeys

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `R` / `S` | Reset / reseed |
| `C` `B` `G` `M` | Toggle char class, block noise, glyph noise, relative shimmer |
| `1`…`0` `-` `=` `Q` `W` `E` `T` | Pick the slider the arrow keys drive |
| `,` `.` | Cycle to the previous / next slider |
| `←` `→` | Adjust the selected slider. `Shift` moves ten steps. |
| `[` `]` | Scrub back / forward 2% |

## Shimmer modes

Constant shimmer decouples churn from the stream: at 3 tokens/sec the text still
boils at 20 Hz, which reads as busy and slightly untethered. Relative shimmer
ties churn to arrivals, so each token buys a fixed number of redraws and a slow
stream churns slowly.

Taken literally, though, a slow stream gives each cell so few redraws that the
effect reads as steppy rather than liquid. **floor Hz** is the lower
bound: below it, churn decouples from arrivals again and the rate holds. At 3
tokens/sec and 1.5 steps per token the raw rate is 4.5 Hz, so the default floor
of 8 takes over. The readout under the progress bar shows the effective rate and
marks it `(floor)` when the floor is what is driving it.

## Block noise

With **block noise** on, whitespace stops being structural. The answer starts as
a solid slab of letters the same length as the text, and spaces and line breaks
have to resolve like any other cell — so the layout reflows as words separate out
of the block. It is the more dramatic opening, at the cost of the readable word
shapes you get for free with it off. Both resolve exactly.

## Two things that matter more than the tuning

**Preserve character class.** Lowercase stays lowercase, digits stay digits,
punctuation stays punctuation. With block noise off, whitespace never scrambles
at all, so word shapes, line breaks, and sentence structure are readable from
frame one and only glyph identity is unknown. Turn the checkbox off to see how
much worse the unstructured version looks — it reads as static, not as an answer
arriving.

**Remasking.** `unsettle` lets a locked cell come loose again. Without it the
effect is a one-way wipe. With it, cells visibly reconsider, which is what makes
it read as diffusion. Real masked-diffusion LMs do the same thing: they keep
high-confidence tokens and re-mask the uncertain ones between steps.

## Extending to images

`diffuser.js` is deliberately target-agnostic. It knows about values, class tags,
and resolve windows, not about text. An image version feeds it palette indices
per block instead of characters, plus a different `noise` function, and renders
to a canvas rather than to spans. The schedulers work unchanged if you map a
block's `(x, y)` to a 1-D index — a radial or blue-noise scheduler would be the
natural addition there. Nothing in `diffuser.js` or `schedulers.js` would change.

## Render options

**luminance jitter** and **lock flash** are purely cosmetic: they live in the
view, never feed back into the simulation, and draw from `Math.random` rather
than the seeded stream on purpose — otherwise turning a slider up would change
which glyphs the diffuser picks and a re-scrub would stop reproducing. **glyphs
in noise** is different: it changes what the noise pool contains, so it draws
from the seeded stream like every other noise draw and stays reproducible.

**glyphs in noise** mixes box-drawing, block, arrow, maths and Greek characters
into the noise pool, about a third of draws. The unresolved field then reads as
"not language yet" rather than as scrambled words. It applies to scrambled
whitespace too, so a block-noise field is not purely alphabetic.

**luminance jitter** varies the brightness of unsolved cells — unlocked *and*
still showing the wrong glyph — re-rolled on every redraw, so the field shimmers
in luminance as well as in glyph. The jitter rate follows the shimmer rate.

A cell that has landed on its true glyph holds steady even before it locks, so
the field reads in three states rather than two: churning noise, a
correct-but-provisional glyph, and a committed one. Only the first churns.

**lock flash** marks the moment a cell commits. Strength sets the peak brightness
and glow, hold is the time at full strength, and fade is the linear decay after
it — a fade of 0 cuts out hard at the end of the hold. Decay runs per animation
frame rather than per shimmer tick, so a short flash still fades smoothly at a
low shimmer rate. With `unsettle` above 0 a cell that comes loose and relocks
flashes again.

## Reference

The confidence-ordering and remasking behaviour is modelled on masked diffusion
language models:

- [Large Language Diffusion Models (LLaDA)](https://arxiv.org/pdf/2502.09992)
- [Re-evaluating Confidence Remasking in Masked Diffusion Language Models](https://arxiv.org/pdf/2606.12232)
- [A Survey on Diffusion Language Models](https://arxiv.org/pdf/2508.10875)
