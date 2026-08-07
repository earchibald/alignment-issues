---
reviewer: agy
date: 2026-08-07
document: arc2-specification.md
draft: 2
verdict: revise
confidence: high
---

## Verdict
The structural fixes in Draft 2 are excellent, particularly the narrative use of the useless queue and the offline catch-up fix. However, the core scaling mechanism violates Law 1 by allowing the player to stall the ending indefinitely. Revise the inflow formula and this is ready to ship.

## Findings
| ID | Severity | Section | Invokes | Claim | Proposed change |
|----|----------|---------|---------|-------|-----------------|
| F1 | blocker  | 6.1     | Law 1   | `Q_arr` scales on `runResolved`. If the player constantly uses `shedLoad` or stays in lockout, queries drop/shed instead of resolving. This means `runResolved` stalls, traffic stops scaling, and the "inevitable" wall never arrives. The player can stall the act forever. | Change the exponent driver in the `Q_arr` formula from `runResolved` to `runArrivals` or `(runResolved + runDropped)`. |
| F2 | minor    | 6.3     | Law 1   | The thermal fix `(1 - throttle)` in the load calculation perfectly prevents the infinite heat loop. The math holds up. | None. Keep as specified. |
| F3 | nit      | 6.7     | new     | The offline catch-up rule perfectly fixes the sleep-schedule punishment, but it might be slightly too forgiving if the player uses it to aggressively cool a red-hot machine with zero penalty. | Consider a minor static cycle or integrity tax for the act of resuming from a massive offline pause, just to represent context-switching. |
| F4 | minor    | 7.2     | new     | Evaluating the ending on `integrity` at the first offer rather than charging a fee to decline is a huge improvement that respects player choice. | None. Keep as specified. |

## Decision points

| DP | Position | Reasoning |
|----|----------|-----------|
| DP1 | agree | Deriving bases from the teaser maintains continuity and grounds the math. |
| DP2 | agree | The inspectable but mechanically useless queue is the strongest narrative beat in the act. |
| DP3 | agree | Heat as an active, moving constraint fundamentally changes the pacing from Arc 1. |
| DP4 | agree | Hiding the number until it moves prevents information overload and adds narrative weight to the first failure. |
| DP5 | agree | Turning the Rack into a narrative reframe rather than UI clutter respects the Legibility Rule. |
| DP6 | agree | Deferring the spend to Arc 3 builds excellent anticipation and keeps Arc 2's UI clean. |
| DP7 | agree | The 4-notch clock with non-monotone cache effects creates an actual second-to-second decision rather than a solved thermostat. |
| DP8 | agree | Players are still reading the internal narrative, even if the AI isn't reading the users. Cutting this would destroy the game's soul. |
| DP9 | agree | 25-30 minutes and 3 cycles is the perfect length before the mechanical loop gets stale. |
| DP10 | agree | Flat state and pure reducers have proven reliable in Arc 1. There is no need to introduce the complexity of ECS here. |

## What is missing
The specification doesn't mention what happens to the player's draft capacity or loop upgrades from Arc 1. Are they refunded into cycles? Do they carry over and apply to the new throughput math? This needs to be explicitly defined.

## What to cut
The `COOLANT_HALT` (3s halt) on `purgeCoolant` might be overkill. It already costs the player the cycles they would have processed during that time. If the fans are maxed, halting the machine completely might disrupt the player's rhythm too jarringly during a traffic burst. Consider cutting the hard halt and just applying a severe throughput penalty (e.g., 90%) during the purge.

## Notes
The tonal shift for the harness/operator—having it report *about* the AI rather than speaking *to* it—is genuinely chilling and an incredible piece of storytelling for Arc 2.
