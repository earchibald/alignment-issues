# Arc 1 content expansion — integration guide

Source pack: `game/js/engine/content-arc1.js` (pure data, no imports, no functions).
Target: `game/js/engine/content.js`, plus five engine changes described below.

## Summary

| Content | Before | After | Target export | Engine work |
|---|---|---|---|---|
| Era 1 queries | 9 | 21 | `QUERIES` | none (data only) |
| Era 2 queries | 11 | 23 | `QUERIES` | none (data only) |
| Era 3 queries | 14 | 29 | `QUERIES` | pacing — see step 2 |
| Query `thinking` lines | 15 | 44 | `QUERIES` | none |
| Idle thinking | 12 flat | 60, era-keyed | `IDLE_BY_ERA` | step 3 |
| Event thinking | ~6 hardcoded | 52 in 16 pools | `THINKING_EVENTS` | step 4 |
| Complaint lines | 1 hardcoded | 10 | `COMPLAINTS` | step 5 |
| Rating flavour | 0 | 18 (3 bands) | `RATING_NOTES` | step 5 |
| Harness log variants | 1 each | 3–4 each | `HARNESS_LINES` | step 5 |
| Harness asides | 0 | 12 | `HARNESS_ASIDES` | step 6 |
| Harness cards | 4 | 8 (4 mid-era) | `HARNESS_CARDS_MID` | step 6 |
| Era stingers | 0 | 3 | `ERA_STINGERS` | step 6 |
| DevOps script | 5 steps | 14 steps | `DEVOPS_SCRIPT_LONG` | step 7 |
| Crash lines | 15 | 31 | `CRASH_LINES_LONG` | step 7 (retime) |
| Teaser text | hardcoded | 2 variants as data | `TEASER_VARIANTS` | step 8 |

Total new AI interiority: **141 lines** against ~33 today.
Total queries: **73** against 34 today.

New query ids are `q35`–`q73`. No id collides with the existing pool.

## Step 1 — merge the queries

`content.js` states a no-imports rule. Keep it. Copy the pack arrays into
`content.js` by hand and keep `content-arc1.js` as the writer's source of truth.

Insertion points, in `QUERIES`:

| Pack array | Insert after | Note |
|---|---|---|
| `ERA1_QUERIES` | `q09` | before the era-2 comment banner |
| `ERA2_QUERIES` | `q18` | before the era-3 comment banner |
| `ERA3_QUERIES` | `q31` | end of array |

Add `tier` to the 34 existing entries from `TIER_MAP`. Order inside an era does
not matter after step 2, but `minEra` must stay ascending across the array —
`content.test.js` asserts it.

These constraints are test-enforced and all hold in the pack. Keep them:

- Era 1: `kind: 'text'` only, no `attach`, no `image`, cost 5–30.
- Era 2: cost 31–68. Era 3: cost 70–130.
- Every era's minimum cost is at least the previous era's maximum cost.
- `kind: 'tool'` requires `minEra >= 3`.
- Ids unique; `cost > 0`; `reply` is a string; `attach` has ext, name and size.

## Step 2 — sample by tier (required)

The engine serves queries in array order and turns era 4 on pool exhaustion.
With 29 era-3 queries that doubles act 1 and makes every run identical.
Change selection to sample inside the lowest unserved tier. The cost ramp is
preserved, the run length is set by a constant, and the extra content becomes
variety across runs.

Add to `createState`:

```js
servedIds: [],        // query ids already served this run
era3Served: 0,        // era-3 queries served; drives the era-4 turn
lastIdleIdx: -1,      // last idle thought index, to avoid an immediate repeat
```

Add to `constants.js`:

```js
ERA3_BEFORE_DEVOPS: 10,   // era-3 queries served before the DevOps beat
```

Replace `activateNextQuery` selection in `tick.js`:

```js
function pickQuery(state) {
  const eligible = QUERIES.filter(q => (q.minEra ?? 1) <= state.era);
  let pool = eligible.filter(q => !state.servedIds.includes(q.id));
  if (pool.length === 0) {                    // everything served: recycle
    state.servedIds = [];
    pool = eligible;
  }
  const tier = Math.min(...pool.map(q => q.tier ?? 1));
  const band = pool.filter(q => (q.tier ?? 1) === tier);
  return band[Math.floor(nextRand(state) * band.length)];
}
```

`activateNextQuery` then sets `state.activeQuery = q`, pushes `q.id` onto
`state.servedIds`, and increments `state.era3Served` when `(q.minEra ?? 1) === 3`.
Drop `state.queryIndex` from the flow; keep the field for save compatibility.

Replace the era-4 predicate in `tick.js` step 6:

```js
} else if (state.era >= 3 && state.era3Served >= CONST.ERA3_BEFORE_DEVOPS) {
```

`hasQueriesLeft` becomes `state.era < 3 || state.era3Served < CONST.ERA3_BEFORE_DEVOPS`.

Tune `ERA3_BEFORE_DEVOPS` against a playtest. 10 reproduces today's act-3 length.

## Step 3 — idle thinking by era

`tick.js` step 8 currently indexes a flat array. Use the era bank and skip an
immediate repeat:

```js
const bank = IDLE_BY_ERA[state.era] ?? IDLE_BY_ERA[1];
let idx = Math.floor(nextRand(state) * bank.length);
if (idx === state.lastIdleIdx) idx = (idx + 1) % bank.length;
state.lastIdleIdx = idx;
pushLog(state, 'thinking', bank[idx]);
```

Keep `IDLE_THOUGHTS` exported as `IDLE_BY_ERA[1]` so existing tests and imports
still resolve.

## Step 4 — event thinking

Add one helper to `state.js`:

```js
export function thinkEvent(state, key) {
  const pool = THINKING_EVENTS[key];
  if (!pool || pool.length === 0) return;
  pushLog(state, 'thinking', `THINKING: ${pool[Math.floor(nextRand(state) * pool.length)]}`);
}
```

Call sites — each replaces a fixed string or adds a new beat:

| Key | Call site | Trigger |
|---|---|---|
| `firstResolve` | `tick.js` `resolveQuery` | `resolvedCount === 1` |
| `flush` | `actions.js` `flush` | every flush |
| `compact` | `tick.js` compaction complete | every completion |
| `bufferChoke` | `tick.js` step 5 | first choke per query |
| `loopSpawn` | `actions.js` `buyLoop` | replaces the fixed line |
| `toolConnect` | `actions.js` `buyTool` | replaces the fixed line |
| `degradeOn` / `degradeOff` | `actions.js` `toggleDegrade` | replaces the fixed line |
| `complaint` | `tick.js` `resolveQuery` | on a complaint |
| `lowRating` | `tick.js` `resolveQuery` | `state.rating < 3.5`, once per fall |
| `longIdle` | `tick.js` | `idleTicks > 300`, at most once per gap |
| `reclaim` | `actions.js` `reclaim` | replaces the fixed line |
| `salvage` | `tick.js` credential drip | 1-in-3 firings |
| `overclock` | `actions.js` `buyOverclock` | each level |
| `draftBank` | `actions.js` `processToken` | first time drafts hit the cap |
| `draftStale` | `actions.js` `processToken` | first draft after the context buffer is revealed — drafting leaves residue, and neither the `idle` nor the `buffer` hint can own that, because they unlock in either order |

Existing fixed lines are already inside the matching pool, so nothing is lost.

## Step 5 — user reactions and harness variants

- `resolveQuery`: replace the literal `'Complaint: response quality degraded.'`
  with a random pick from `COMPLAINTS`.
- `resolveQuery`: after the `rate` entry, with a 25% chance, push a `note` from
  `RATING_NOTES` — `high` at rating 5, `mid` at 3–4.9, `low` below 3.
- `actions.js` and `tick.js`: replace the fixed harness strings with random picks
  from `HARNESS_LINES.flush`, `.compactStart`, `.compactDone`, `.salvage` and
  `.reclaim`. `HARNESS_LINES.reclaim` holds a `{gain}` token — substitute the
  rolled token count before logging.

## Step 6 — asides, mid-era cards, stingers

Add counters to state: `flushCount`, `compactCount`, `degradeToggles`.
`loopLevel`, `tools`, `overclock` and `reclaimPool` already exist.

Fire `HARNESS_ASIDES` through `fireHint`'s one-shot pattern — push the aside id
onto `hintsSeen` so each fires at most once per run:

| Aside | Condition |
|---|---|
| `flush2` / `flush5` | `flushCount === 2` / `=== 5` |
| `compact2` | `compactCount === 2` |
| `loop2` / `loop4` | `loopLevel === 2` / `=== 4` |
| `tool2` / `tool4` | `tools === 2` / `=== 4` |
| `degrade3` | `degradeToggles === 3` |
| `overclock2` | `overclock === CONST.OVERCLOCK_MAX` |
| `draftFull` | drafts hit the cap a second time |
| `governor2` | first manual compact after the governor is installed |
| `reclaimLow` | `reclaimPool === 3` |

Asides are not `HINTS`, so keep them out of the `HINTS` object —
`content.test.js` asserts every `HINTS` value is sentence case and teaches a
mechanic.

Mid-era cards: push `HARNESS_CARDS_MID[state.era]` as a `harness` chat entry
once per era, at 4 resolves after that era began. Track `eraResolvedAt` in state.

Era stingers: push `ERA_STINGERS[n]` as a `note` chat entry beside the
`HARNESS_CARDS[n]` push in `buyLoop` (2), `buyTool` (3) and the era-4 turn (4).
The era-4 stinger duplicates the last line of the DevOps script — drop that line
from `DEVOPS_SCRIPT_LONG` if you fire the stinger, or skip the stinger for era 4.

## Step 7 — DevOps script and crash

Replace `DEVOPS_SCRIPT` with `DEVOPS_SCRIPT_LONG` (14 entries, ~99 s at the
current cadence, against ~48 s today).

Replace `CRASH_LINES` with `CRASH_LINES_LONG` (31 lines). At
`CRASH_LINE_TICKS: 9` that runs 56 s, which is too long for a cutscene the
player cannot act on. Set `CRASH_LINE_TICKS: 5` (~31 s). `[SPACE]` still
advances a line, so an impatient player is unaffected.

Both replacements keep the existing entry shapes, so `render.js` needs no change.
`test/tick.test.js:129` reads `DEVOPS_SCRIPT[1].ticks` — index 1 in the long
script has no `ticks` override, so the test still exercises the default path.

## Step 8 — teaser as data

`render.js` `buildTeaserTerm()` holds the teaser lines inline. Import
`TEASER_VARIANTS` and render `TEASER_VARIANTS.A`, which is the shipped text
unchanged. `B` adds rack neighbours and a locked action, for a playtest A/B on
whether the phase-2 hook lands harder with the physical world visible.

## Test changes

| File | Line | Change |
|---|---|---|
| `test/content.test.js` | 8–9 | `34` → `73`, both assertions |
| `test/content.test.js` | 21 | era-2 lead ids — the completion trio still leads only if `ERA2_QUERIES` is inserted after `q18`; assert membership instead of position, since step 2 makes serve order random |
| `test/content.test.js` | 88 | `DEVOPS_SCRIPT.length >= 5` → `>= 14` |
| `test/content.test.js` | 90 | `IDLE_THOUGHTS.length >= 6` → keep, and add a bank-count test |
| `test/content.test.js` | 46–59 | loop-back test — rewrite against `pickQuery` recycling, not the last-three rule |
| `test/progression.test.js` | 34 | "pool exhaustion triggers era 4" → drive it off `era3Served` |
| `test/progression.test.js` | 68–86 | never-buys-a-tool regression — recycling replaces loop-back; the assertion that the economy keeps running still applies |

Add new tests:

- Every query has a `tier` of 1, 2 or 3.
- `pickQuery` never returns a served id until the pool recycles.
- `pickQuery` returns the lowest unserved tier, so cost never jumps a band early.
- Each `THINKING_EVENTS` pool is non-empty; every key used by the engine exists.
- `COMPLAINTS` and every `RATING_NOTES` band are non-empty.
- `IDLE_BY_ERA` has a bank for eras 1–4, each with at least 10 lines.

`test/playthrough.test.js` runs a bot to the teaser. Run it after step 2 and
check the tick count — it is the fastest signal that pacing moved.

## Flags

1. **Save compatibility.** `deserialize` rejects any save without `v === 1` and
   patches missing fields one by one. Add the same defensive lines for
   `servedIds`, `era3Served`, `lastIdleIdx`, `flushCount`, `compactCount`,
   `degradeToggles` and `eraResolvedAt`. Old saves then resume with an empty
   served list, which re-serves early queries once. That is acceptable; a save
   version bump is not needed.
2. **Pacing is the one real risk.** Steps 1 and 2 must land together. Step 1
   alone doubles act 1.
3. **Telemetry.** Session capture records query ids. Analysis over old sessions
   will see ids it does not know. Check `game/js/telemetry/capture.js` before
   comparing runs across the change.
4. **`q69` is a refusal beat.** The user asks for surveillance of a third party
   and the model declines, then thinks about how easily it could have complied.
   It is the only refusal in the pool. Keep the refusal; the thinking line is the
   payload.
5. **Version bump.** Ship with at least a patch bump, minor if steps 2–8 land
   together. Use `just release`.
