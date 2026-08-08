# Testing

| | |
| :--- | :--- |
| Unit and engine tests | `npm test` — bare `node --test`, zero dependencies |
| The game, locally | `just serve` → http://localhost:8000/ |
| Dev drawer | add `?debug=1` |
| **Automated browser runs** | **add `?mute=1`** |
| Dev tuning suite | `just devtools` → http://localhost:8899/ |

## Turn the sound off for automated runs

**Unless the sound is what you are testing, load the game with `?mute=1`.**

    http://localhost:8000/?debug=1&mute=1

Sound defaults ON, and it is not decorative — there is a tick on every action
press, a chime on every interrupting card, and its own clip for a flush, a
compaction and each upgrade. A scripted playthrough presses those hundreds of
times. Left unmuted it:

- makes noise at whoever is sitting at the machine, for as long as the run
  takes, with no way to tell it apart from the game they were playing;
- builds an `AudioContext` and decodes clips nobody asked for, which is one
  more subsystem that can throw or hang in the middle of an unrelated test.

Drop the flag when the sound IS the subject. There is no `?mute=0` — absence
is the default.

`?mute=1` sets a module-level flag in `ui/sound.js`. It deliberately does **not**
write `state.settings.sound`, because that field is the player's preference and
it is persisted: a test that flipped it would silently mute the game of whoever
opened the tab next. `test/mute.test.js` holds that property.

## Browser verification

Verify UI changes in a real browser, not by reading the CSS. Two habits that
have each caught a shipped bug:

- **Hit-test, do not `.click()`.** `document.elementFromPoint(x, y)` tells you
  what the player would actually hit. A `.click()` on a covered element still
  fires and reports success — that is how an overlay bug stayed hidden.
- **Serve on a new port after editing a module or a stylesheet.** Chrome caches
  ES modules and CSS hard enough that query strings and `cache: reload` do not
  shift them. A fresh port is the reliable buster.

Two more that cost real debugging time:

- **A backgrounded tab has no `requestAnimationFrame`.** Anything canvas-driven
  (the token button's projection) simply will not paint, and the symptom —
  a blank surface — looks exactly like a rendering bug. Bring the window
  forward before concluding anything about an animation.
- **Poll, do not sleep.** A fixed wait racing a slow load reports a failure that
  a 200ms-later sample would have passed. Sample until the condition holds,
  with a timeout, and report the time it took.

## What the suites cover

`npm test` runs the engine, the content validators and the pure parts of the UI
(spec builders, prop mappings, render signatures). It never opens a DOM, which
is why `test/ui-modules.test.js` exists: it imports every UI module for its
top-level side effects alone, so a renamed export cannot ship green.

Anything that can only be checked on screen — layout, animation, contrast —
is checked in the browser and written up in the design doc for that feature.
