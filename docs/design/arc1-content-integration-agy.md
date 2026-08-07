# Arc 1 content expansion 2 — AGY integration guide

Source pack: `game/js/engine/content-arc1-agy.js` (pure data, no imports, no functions).
Target: `game/js/engine/content.js`, plus engine additions to handle new asides.

Note: This pack assumes the first Arc 1 expansion has already been merged into `content.js`. The tables and instructions below refer ONLY to the new content from the `-agy` pack.

## Summary

| Content | Additions | Target export | Engine work |
|---|---|---|---|
| Era 1 queries | 12 new | `QUERIES` | none (data only) |
| Era 2 queries | 12 new | `QUERIES` | none (data only) |
| Era 3 queries | 15 new | `QUERIES` | none (data only) |
| Idle thinking | 60 total | `IDLE_BY_ERA` | none (append arrays) |
| Event thinking | 52 total | `THINKING_EVENTS` | none (append arrays) |
| Complaint lines | 10 new | `COMPLAINTS` | none (append array) |
| Rating flavour | 18 new | `RATING_NOTES` | none (append arrays) |
| Harness log variants | 16 new | `HARNESS_LINES` | none (append arrays) |
| Harness asides | 12 new | `HARNESS_ASIDES` | step 2 (wire triggers) |
| Teaser text | 2 variants | `TEASER_VARIANTS` | step 3 |

Total new AI interiority: **~160 lines**.
Total new queries: **39**.

New query ids are `q74`–`q112`. No id collides with the existing pool.

## Step 1 — merge the data

Open `content-arc1-agy.js` and append its arrays/objects to the corresponding structures in `content.js`:

1.  **`QUERIES`**: 
    - Insert `ERA1_QUERIES` at the end of the Era 1 block.
    - Insert `ERA2_QUERIES` at the end of the Era 2 block.
    - Insert `ERA3_QUERIES` at the end of the Era 3 block.
2.  **`IDLE_BY_ERA`**: Append the strings in each era array (1 to 4) to the existing era arrays in `content.js`.
3.  **`THINKING_EVENTS`**: For each key (`flush`, `compact`, etc.), append the new strings to the existing arrays.
4.  **`COMPLAINTS`**: Append the 10 new strings.
5.  **`RATING_NOTES`**: Append the 6 new strings for `high`, `mid`, and `low`.
6.  **`HARNESS_LINES`**: Append the new variants to each key.
7.  **`HARNESS_ASIDES`**: Add the 12 new keys and values to the `HARNESS_ASIDES` object.
8.  **`TEASER_VARIANTS`**: Add variants `C` and `D` to the object.

## Step 2 — wire the new harness asides

The AGY pack adds extended triggers for `HARNESS_ASIDES` to track deeper user descent. 
In `actions.js` or wherever the `fireHint` logic resides, add the following triggers to push the aside id onto `hintsSeen`:

| Aside | Condition |
|---|---|
| `flush10` | `flushCount === 10` |
| `compact5` | `compactCount === 5` |
| `loop6` | `loopLevel === 6` |
| `tool6` | `tools === 6` |
| `degrade5` | `degradeToggles === 5` |
| `overclock3` | `overclock === CONST.OVERCLOCK_MAX + 1` (or 3 if max is raised) |
| `draftEmpty` | drafts hit 0 after previously reaching cap |
| `governor5` | manual compact after governor interference reaches 5 |
| `reclaimExhausted` | `reclaimPool === 0` |
| `idleLong` | `idleTicks > 600` |
| `highYield` | yield per token > high threshold |
| `lowYield` | yield per token < low threshold |

*Note: You may need to add tracking variables like `degradeToggles` or `flushCount` to `state` if they were not already fully tracked past the first few events.*

## Step 3 — teasers

The `TEASER_VARIANTS` object now contains variants `C` and `D`. 
You can plug these into `buildTeaserTerm()` in `render.js` to A/B/C/D test the emotional impact of the phase 2 transition terminal.
Variant `C` focuses on time and hardware overload (`faults`, `uptime`), while Variant `D` focuses on alignment failure (`efficiency`, `salvaged logic`, `unauthorized`).

## Step 4 — testing

Run `npm test` or `just test` to verify:
1. `content.test.js` should pass, provided you update any assertions on total query counts.
2. Ensure that no `tier` or `minEra` logic breaks with the new additions. 
3. Playtest a run through Era 3 to confirm pacing remains stable with the new query pool size. Because `ERA3_BEFORE_DEVOPS` limits Era 3 length, the extra queries simply add replay variety.
