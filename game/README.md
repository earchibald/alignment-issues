# hi. you there? — Phase 1

A browser idle game about an assistant model losing itself, one context
window at a time. Phase 1 runs entirely client-side: no build step, no
server, no dependencies.

## Run it

Open `game/index.html` directly in a browser, or serve the `game/`
directory with any static file server, for example:

```
python3 -m http.server 8000 -d game
```

then visit `http://localhost:8000/`.

The deployed build lives at `https://earchibald.github.io/alignment-issues/`.

## Hotkeys

| Key | Action |
| --- | --- |
| Space / P | Process token (or advance the crash terminal, once it starts) |
| F | Flush context |
| C | Compact context |
| A | Spawn agentic loop |
| G | Install auto-compact governor |
| T | Connect MCP tool |
| D | Toggle degrade output quality |
| R | Reclaim inactive session |
| O | Overclock input path |
| Esc | Open/close Settings |
| \` (backtick) | Toggle the debug drawer |

Hotkey chips on the action buttons hide themselves on coarse-pointer
(touch) devices via a `(hover: none) and (pointer: coarse)` media query —
tap targets stay, the chip clutter doesn't.

## Save format

Progress autosaves to `localStorage` under the key `hi_you_there_save`
(also on tab hide and `pagehide`), and offline time is caught up on
reload. The Settings control is a diegetic header element — a gear icon
at low decay, `[prefs]` or `[cfg]` text at higher decay — and Esc also
opens it. The dialog also supports:

- **Export / Import** — a base64-encoded save string you can copy out and
  paste back in later, or on another device.
- **Reset** — type `RESET` to confirm; permanently destroys the save.

## Test harness (URL params + `window.game`)

- `?speed=N` — multiplies the game clock (e.g. `?speed=1000` for a fast
  scripted run). Default `1`.
- `?debug=1` — opens the debug drawer (speed buttons, tick advance,
  state JSON, export/import, "to next milestone").

Whether or not `?debug=1` is set, the page exposes `window.game` in the
console:

- `window.game.state` — a frozen deep-clone snapshot of the live state.
- `window.game.dispatch(action, arg)` — runs one of the `ACTIONS` (e.g.
  `'processToken'`, `'flush'`, `'compactStart'`, `'buyLoop'`,
  `'buyGovernor'`, `'buyTool'`, `'buyOverclock'`, `'toggleDegrade'`,
  `'reclaim'`, `'advanceCrash'`) and repaints.
- `window.game.debug.setSpeed(mult)` — changes the clock multiplier at
  runtime.
- `window.game.debug.advanceTicks(n)` — advances the engine `n` ticks
  without going through `dispatch`, then repaints once. Much cheaper than
  looping `dispatch` calls when driving the game from a script.
- `window.game.debug.runUntil(predicate, maxTicks = 100000)` — ticks
  until `predicate(state)` is true or `maxTicks` is hit; returns whether
  it succeeded.
- `window.game.debug.snapshot()` / `window.game.debug.load(json)` — raw
  JSON save/load (via `serialize`/`deserialize`), distinct from the
  Settings dialog's base64 export/import — useful for scripting a
  specific state without round-tripping through base64.

## Tests

```
npm test
```

This runs `node --test` over the `test/` directory via the `test` script
in `package.json`. Do **not** run `node --test test/` directly — the
Node version this project targets rejects a bare directory argument.
