# hi. you there? — agent guidance

Mirrored at `AGENTS.md` (a symlink), so every agent reads the same file.

## Shape of the project

- `game/` is vanilla ESM. **Zero dependencies, no build step, no framework.**
  Ported code gets rewritten, not bundled.
- `game/js/engine/` is pure — no DOM. `game/js/ui/` owns the DOM.
- `game/js/config/*-settings.js` are GENERATED override layers written by the
  dev suite. Defaults live beside the code they belong to; edit those.
- `npm test` is bare `node --test`. Never add a test dependency.
- Ship with `just release X.Y.Z`. Bump the patch at minimum for any shipped
  change, the minor for a feature.

## Testing

Full detail in [`docs/operations/testing.md`](docs/operations/testing.md). The
rules worth repeating here:

- **Load the game with `?mute=1` for any automated run**, unless the sound is
  what you are testing. Sound is on by default and fires on every action press;
  an unmuted scripted playthrough makes noise at whoever is at the machine and
  spins up an audio graph nobody asked for.
- Verify UI in a real browser. Hit-test with `elementFromPoint`, not `.click()`.
- Serve on a **new port** after editing a module or stylesheet — Chrome's cache
  ignores query strings and `cache: reload`.
- A backgrounded tab gets no `requestAnimationFrame`. Canvas work will not paint
  and it looks exactly like a bug. Bring the window forward first.
- Poll for a condition; do not sleep a fixed time and sample once.

## Dev suite

`just devtools` → http://localhost:8899/. Tools drive the **real** game modules
over the server's read-only `/gamejs-raw` mount — the pacing tool runs the
actual engine, the Token Button tool the actual renderer. A tool that previews
its own copy of the physics drifts, and then you are tuning fiction. Do not
introduce one.

Adding a knob means three places agreeing: the default in the module, the
schema in `devtools/server.js`, and nothing else — the tuner panel builds its
controls by iterating the module's own settings object. Tests assert the module
and the schema hold the same keys in **both** directions.

## Writing

Prose follows ASD-STE100 rules (see the global `~/.claude/CLAUDE.md`): one idea
per sentence, active voice, no synonym rotation. Lead with the point.

Summaries and tables go where the medium is read: **top** of a document,
**bottom** of chat and terminal output.

## Comments

Explain why, not what. A comment that earns its place names the failure it
prevents — the bug that was shipped, the reading that was wrong, the number
that was measured. Match the density of the file you are in.
