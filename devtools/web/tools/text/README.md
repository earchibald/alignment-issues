# Text editor

Every string in the game, in one list: search it, edit it, add to it.

```bash
just devtools          # http://localhost:8899/#text
```

## How it works

The server scans the source for string literals and returns each one with its
**byte range** and a structural path — `QUERIES[12].reply`, `HINTS.arrival`,
`IDLE_BY_ERA.3[7]`. The browser never sees a file, and never sends one back. It
sends operations against the ranges it was given.

That is what keeps the diff honest. Editing a reply changes exactly one line;
comments, formatting, trailing commas and the file's whole shape are untouched
because nothing ever rewrites them. `devtools/scan.js` is a scanner, not a
parser: it tokenises enough to be correct about where strings, comments and
structure begin and end, and it never evaluates the file.

Every write is verified first. The client sends the exact source text it
believes is at that range; if the file has moved underneath it — a hand edit,
another tab, a branch switch — the write is refused and you reload. A save is
all-or-nothing per file.

## Copy and idents

A UI file's string literals are mostly class names, testids and event keys. Those
are structure that happens to be spelled with quotes, and editing one is a code
change, not a copy change — so they are hidden behind the **idents** toggle
(`i`). What is left is what a player reads: 889 strings across six files.

## Adding

| Want | Do |
|---|---|
| A new idle thought, complaint, rating note… | `+ add to …` at the end of that list, or `n` |
| A new query, or any record with fields | Select any string in a nearby entry and press `d` |

Duplicating clones the whole record and gives it the next free id, so the shape
is right and only the words need writing. The server refuses an id that is
already used: ids are how the engine remembers what it has served, so a
collision would be data corruption rather than an inconvenience.

Structural changes save straight to disk, and refuse to run while edits are
staged — a clone built from stale text would be a quiet wrong answer.

## Keys

| Key | Does |
|---|---|
| `/` | Search. `Enter` jumps to the first result, `Esc` clears |
| `j` `k` / `↓` `↑` | Move |
| `Enter` | Edit the selected string |
| `⌘↵` | Done editing (stages it) |
| `⇥` | Stage and move to the next string — for working down a list |
| `Esc` | Cancel the edit |
| `⌘S` | Save every staged edit |
| `u` | Revert the selected row |
| `n` / `d` | Add a string / duplicate an entry |
| `i` | Show structural strings too |
| `g` `G` | Top / end |
| `?` | The key map |

## Which files

`devtools/text-store.js` holds the list. Adding a file is one line there, and
nothing else has to change.

Edits here count as tool output for the **Publish release** guard — otherwise
fixing a typo would block publishing — but they are listed separately in the
confirmation, because "your copy changed" and "a slider moved" are different
things to be agreeing to.
