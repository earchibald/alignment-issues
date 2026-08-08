# Map & timetable

Arc 1 on one axis. Every story beat, reveal, verb and purchase, with what it
costs, what it does, and what has to happen before it appears.

```bash
just devtools          # http://localhost:8899/#timeline
```

## What it is for

Two questions, one dataset:

- **Map** — when does each thing land, and what causes what. Select anything and
  the dashed lines show what it connects to.
- **Timetable** — the same items as a table: when, cost, effect, gate.

The lanes read top to bottom as cause and effect: a **pressure** builds, a
**reveal** announces the relief, a **verb** or a **purchase** answers it, and
the **story** turns.

## The spine, if you read nothing else

Two purchases are era changes:

| Buy | Cost | Also does |
|---|---|---|
| Agentic loop L1 | 2 cycles | Era 1 → 2. The cheapest thing in the game turns the world. |
| MCP tool ×1 | 10 cycles | Era 2 → 3, and fires the degrade reveal. |

Era 3 → 4 is the exception: it is served, not bought — 19 era-3 queries, then
the DevOps transcript. Era 4 ends when passive output crosses 2500 tokens, which
is why loops matter to the ending and taps do not.

## Times are authored

Costs, effects and gates are read out of `engine/constants.js` and
`engine/actions.js` and are accurate as written. **The times are estimates.**
They exist so the shape can be argued with, and they are draggable: move a
marker and the whole picture rearranges around it.

When a time has to be true rather than plausible, the **Pacing** tab measures it
by running the real engine.

Moved times are kept in `localStorage` and never written to the project. `Reset
times` clears them all; the detail panel has a per-item reset for the one you
are looking at.

## Keys

| Key | Does |
|---|---|
| `j` `k` | Previous / next item in time order |
| `←` `→` | Move the selected item by 0.1 min (`Shift` = 0.5) |
| `+` `-` | Zoom the time axis |
| `Esc` | Deselect |

Drag any marker to move it. `Copy JSON` puts the whole arrangement on the
clipboard — every item with its time, cost, gate and effect.

## Adding to the model

`model.js` is the whole dataset: `LANES`, `ERAS`, `ITEMS`. An item needs
`id`, `lane`, `kind`, `at`, `label`, and as much of `cost` / `effect` / `gate` /
`value` / `what` / `links` as applies. `links` is a list of other item ids and is
drawn in both directions, so it only has to be stated once.
