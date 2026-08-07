# Pacing lab

Tune the reveal ladder and the difficulty curve, and watch the sawtooth move.

## What it is for

The design target is a **sawtooth**: effort per reply climbs until it is just
short of annoying, then a mechanic lands and cuts it back. Before this tool
the only way to ask "is it too fast?" was to play it and guess — and a
playtest answered *"everything feels like it's coming very quickly and that's
just too much"* against a build where nine of twelve reveals landed inside the
first 66 seconds, every one of them while a reply still cost four to six taps.

The metric is **landed taps per reply**. That is what a player experiences as
grind, and what every relief mechanic reduces.

## It runs the real engine

Not a model of one. Each run creates a throwaway iframe whose import map
points `engine/constants.js` at a shim carrying the tool's knobs; the engine
module graph is then built fresh against them.

```
runner.html         import map: /gamejs/engine/constants.js -> const-shim.js
  const-shim.js     real defaults (via /gamejs-raw) + the knobs
  run.js            one playthrough per seed, real ACTIONS and tick()
```

A hand-written model would drift from the game, and a chart that drifts from
the game is worse than no chart. The numbers here match `scripts/pacing.mjs`
because both drive the same engine with the same policy.

Two things follow from that:

- The mount is `game/js` **as a whole**, not `game/js/engine`. `constants.js`
  imports `../config/pacing-settings.js`, which a mount rooted at `engine/`
  would put outside the served tree.
- The frame is recreated per run rather than reused. `CONST` is frozen at
  module evaluation, so there is nothing to invalidate — throwing the world
  away is the only honest option, and it costs about 40 ms.

## Reading the charts

| Panel | What to look for |
|---|---|
| **Difficulty sawtooth** | Reveals (dashed lines) should sit at the **top** of a climb. One on a flat stretch is relief for a problem the player does not have yet. |
| **Reveal cadence** | Bars under 3 s are drawn red: two mechanics arriving in the same breath. |
| **Where the run goes** | Share of the run per era. Era 3 is the climax and has its own knob. |
| **Run length by seed** | A median hiding a wide spread is not worth tuning against. |

The summary strip flags the two failure modes directly: *reveals in first 90s*
(front-loading) and *reveals on rising effort* (whether the sawtooth exists
at all).

## Gates and backstops

Every reveal is `enough grind OR a backstop`. The backstop exists so a flat
curve can never strand a mechanic — most of all the loop, since the arc cannot
end without one running.

That means **a gate can be masked by its own backstop**. If moving a gate does
nothing, the backstop is firing first; raise the backstop and the gate takes
over. The tool makes this visible rather than mysterious: change one and watch
whether the reveal moves.

## Apply

Writes `game/js/config/pacing-settings.js`, which `engine/constants.js` merges
over its defaults. Only knobs that **differ** from the engine's own values are
written — pinning every default would silently hold the old value the next
time a default moved. An empty object means "ship the defaults".
