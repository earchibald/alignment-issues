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
   **The browser never names a path.** It names a tool; the server decides where
   that tool writes and what shape the payload may take. Keys outside the schema
   are rejected, and out-of-range values are rejected rather than clamped — a
   clamped value would be a lie about what you applied.

The server binds to `127.0.0.1` only. It writes to the working tree; it has no
business being reachable from the network.

## Apply

One confirmation, not two. Everything the server writes is inside git, so the
undo is `git diff` and `git checkout`. A second "are you really sure" would be
ceremony over a reversible action.

The dialog shows the exact JSON payload and the destination path before you
commit to it. A re-apply with identical settings reports "no change" and does not
touch the file's mtime.

## Tools

| Tab | Writes | Spec |
|---|---|---|
| Diffusion text | `game/js/config/diffusion-settings.js` | [answer-diffusion-design](../docs/superpowers/specs/2026-08-07-answer-diffusion-design.md) |
