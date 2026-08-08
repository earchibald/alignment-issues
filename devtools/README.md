# dev suite

Tuning tools for *hi. you there?*. Not shipped with the game: `devtools/` is
never deployed, and nothing in `game/` imports from here.

```bash
just devtools          # http://localhost:8899
```

The workflow is: tune an effect until it feels right, pick the variant you want,
press **Apply settings to project**, confirm, reload the game.

## Layout

```
devtools/
  server.js              static server + the only writer into the project tree
  web/
    index.html           suite shell
    css/suite.css        shell chrome, dialog, tooltip layer
    js/suite.js          tab strip, lazy mount/unmount
    js/registry.js       the tool list — one line per tool
    js/apply.js          confirm dialog and the apply request
    js/tooltip.js        shared rendered tooltips
    tools/<id>/          one directory per tool
```

## Adding a tool

1. Write `web/tools/<id>/tool.js` exporting a `tool` object:

   | Field | Meaning |
   |---|---|
   | `id`, `label`, `blurb` | Identity and the one-line description under the tab strip. |
   | `css` | Stylesheet path, loaded once when the tab first opens. |
   | `mount(host)` | Build the UI into `host` and start. |
   | `unmount()` | Stop loops and drop document-level listeners. |
   | `getSettings()` | The object the Apply button sends. Optional — a tool with no settings just will not apply. |
   | `settingsNote` | Optional. What `getSettings` deliberately leaves out, shown in the confirm dialog. |

2. Add one line to `web/js/registry.js`. Tools are imported lazily, so a large
   suite still costs one tool's parse at start-up.

3. Add a `TOOLS` entry to `server.js` with the destination path and a schema.
   (A tool that writes source rather than settings — the text editor — goes in
   `text-store.js` instead, and needs no `getSettings`: the Apply button turns
   itself off for tools that have none.)
   **The browser never names a path.** It names a tool; the server decides where
   that tool writes and what shape the payload may take. Keys outside the schema
   are rejected, and out-of-range values are rejected rather than clamped — a
   clamped value would be a lie about what you applied.

The server binds to `127.0.0.1` only. It writes to the working tree; it has no
business being reachable from the network.

## Publish release

Next to Apply. It bumps the patch version, commits, pushes, tags, deploys and
verifies the live site — then reports the version and build actually being
served, or the step that failed.

**It refuses unless the only modified tracked files are ones a tool writes.**
That is the generated settings files, plus the source files the text editor
edits — otherwise fixing a typo in a reply would block publishing. Copy edits
are listed apart from settings in the confirmation, because "your text changed"
and "a slider moved" are different things to be agreeing to. Anything else in the diff means a human was editing by hand, and that work does
not get swept into a release they did not ask for. The check runs again when the
button is pressed, not only when the page loaded it, because the tree can change
in between.

Two things it deliberately does not hide:

- A release publishes `main`, so every commit since the last tag ships with
  it. The confirmation lists them.
- The tests run as part of the release. A tuning change that breaks one stops
  the release there, and nothing is published.

The publish itself shells out to `just release`, which already does preflight,
version bump, changelog, tag, push, watch the Actions run and verify. A second
release path here could disagree with that one. Success is confirmed by
re-reading the live `js/version.js`, not by trusting an exit code.

## Apply

One confirmation, not two. Everything the server writes is inside git, so the
undo is `git diff` and `git checkout`. A second "are you really sure" would be
ceremony over a reversible action.

The dialog shows the exact JSON payload and the destination path before you
commit to it. A re-apply with identical settings reports "no change" and does not
touch the file's mtime.

## Tools

| Tab | Writes | Notes |
|---|---|---|
| Map & timetable | nothing — a drawing board | [tool README](web/tools/timeline/README.md) — Arc 1 on one axis, with costs, effects and gates |
| Pacing | `game/js/config/pacing-settings.js` | [tool README](web/tools/pacing/README.md) — runs the real engine in a sandboxed frame |
| Diffusion text | `game/js/config/diffusion-settings.js` | [answer-diffusion-design](../docs/superpowers/specs/2026-08-07-answer-diffusion-design.md) |
| Text editor | the game's source, in place | [tool README](web/tools/text/README.md) — every string in the game, searchable |

## Reading the game from a tool

Two read-only mounts expose `game/js` to the browser, so a tool can simulate
against the shipped engine instead of a copy of it:

| Mount | Use |
|---|---|
| `/gamejs/…` | The graph a simulation imports. A tool may redirect parts of it with an import map — the pacing lab swaps `engine/constants.js` for its own shim. |
| `/gamejs-raw/…` | The same tree with no rewriting, for reading real values. |

Both are GET-only and share the traversal guard with the static handler. The
mount is `game/js` whole rather than a subdirectory, because engine modules
import across it (`engine/constants.js` reads `../config/pacing-settings.js`).

A tool whose schema is marked `partial` may omit keys: its generated module is
an override layer, so writing every key would pin today's defaults forever.
