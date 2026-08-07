---
reviewer: GPT-5.5 Copilot CLI
date: 2026-08-07
document: arc2-specification.md
draft: 2
verdict: revise
confidence: high
---

## Verdict

Revise. Draft 2 fixes the large Draft 1 shape, especially heat, queue inspect, and the clock, but several implementation contracts are still not single-source. I would not build from it until the ending predicate, migration target, offline accounting, and opening upgrade costs are made exact and testable.

## Findings

| ID | Severity | Section | Invokes | Claim | Proposed change |
|----|----------|---------|---------|-------|-----------------|
| F1 | blocker | §5.1, §7.2, §9.4, §11.1, §11.5 | Law 1, Law 10 | The act says it ends at "the wall", that `integrity` 0.25 makes the wall visible, that wall-scale is about 1,000-1,500 lifetime cycles, and that static tests should inspect a monotone predicate, but it never defines the predicate that sets `retrainOffered`. Without that predicate, tests 3, 5, and 17 are unwriteable, and an implementation could accidentally tie the ending to `integrity`, queue state, or spendable cycle balance. | Add a named monotone driver and exact threshold/formula, for example `wallProgress = runResolved` or `arc2LifetimeCycles` with `RETRAIN_AT_*`. List every state field read by the predicate, then make §11.1(5) and §11.5 assert that exact function. |
| F2 | major | §9.1, §9.2 | Law 8 | The schema contradicts itself on the Arc 2 entry state: §9.1 says migration sets `phase: 5` for an Arc 1 teaser save, while §9.2 says `phase` is preserved and "stays 2" and `era -> 5`. The current Arc 1 state also uses `phase` for coarse run state and `era` for act-era progression, so this ambiguity is likely to become a save migration bug. | Define the fields once, preferably `phase: 2` or equivalent Arc marker plus `era: 5`, and update §9.1/§9.2 to match. Add a migration test that loads a teaser save and asserts the exact `phase`, `era`, `decay`, and Arc 2 defaults. |
| F3 | major | §6.7, §11.2 | Law 1, Law 8 | Offline catch-up says the queue holds, nobody is dropped, and `integrity` does not move, but then says offline drops still count toward `lifetimeDropped`. It also says the return screen reports backlog that accumulated, without specifying whether `queue` may exceed `queueCap` while offline. Those are different state models and they drive different endings, counters, and resume decisions. | Pick one offline model. If the intent is "no one is dropped offline", then do not increment `lifetimeDropped`; track `offlineBacklog` or allow over-cap `queue` with overflow disabled until the player resumes. If the intent is "arrivals beyond cap are counted as dropped", define that as a visible non-integrity counter and explain why it is not a moral cost. |
| F4 | major | §5.4, §8.1, §9.1, §14 | Law 10 | The opening upgrade costs are ambiguous because Arc 2 starts with existing hardware. §8.1 prints core 25, cache 15, fan 11 at the opening, but §14 gives cost curves `25 * 1.35^n`, `15 * 1.35^n`, and `11 * 1.30^n` while §9.1 starts at `cores: 2` and `cacheLevel: 2`. If current level is `n`, the next core costs `25 * 1.35^2 = 45.6` and the next cache costs `15 * 1.35^2 = 27.3`, not 25 and 15. | Define cost exponents relative to purchases made during Arc 2, such as `coreBuys = cores - 2`, `cacheBuys = cacheLevel - 2`, and `sinkBuys = sinkLevel`, or change the printed opening costs and pacing arithmetic. Make test 17 use the same cost function. |
| F5 | major | §6.4 | Rule 1, Law 6 | `shedLoad` is the new pressure valve, but its effect is underspecified and potentially dominant. "Dump the current backlog now" for a fixed `-0.02 integrity` means that after 20 dropped queries it is as cheap as the capped involuntary loss for a whole session, while deleting an arbitrary queue and bypassing the core/cache tradeoff. | Specify availability, amount, and accounting: for example, shed only `max(0, queue - queueCap)` or a fixed `SHED_MAX`, put it on a cooldown, count shed queries separately, and print the exact number of requests and `integrity` charge before the reducer accepts it. |
| F6 | minor | §6.2, §11.5 | Law 10 | Test 18 proves movement, not meaning. A scripted policy can change clock notches eight times in 12 minutes even if one fixed notch is economically optimal, so the test can pass while the dial is still decoration. | Pair the notch-change count with a dominance check: no single-notch policy may meet the same competent-policy envelope, or the expert policy must outperform the best fixed-notch policy on time-to-wall, max queue, or `integrity` retained by a stated margin. |

## Decision points

| DP | Position | Reasoning |
|----|----------|-----------|
| DP1 | agree | The teaser is the right source for opening scale, and handing growths to test 17 is the correct Law 10 move. This only holds after F4 makes cost indices agree with the teaser state. |
| DP2 | agree | Killing the chat panel while keeping the queue inspectable preserves the act break without deleting the human unit of scale. Counting queue opens is the strongest new responsibility instrument in Draft 2. |
| DP3 | agree | Heat should carry the act because it changes continuously and visibly. The clock is the right touch surface because it changes throughput, heat, cache quality, and legibility in one control. |
| DP4 | agree | One falling legibility number is cleaner than parallel moral meters, and hiding the number until first spend is stronger than showing an abstract score early. The 0.25 "wall visible" language needs to stay display-only unless F1 defines it as part of the terminal predicate. |
| DP5 | agree | Pre-cutting the Rack as a system is the right scope call. Keeping it as a reframe beat preserves the experience-review insight without adding a host-management game. |
| DP6 | agree | Prestige as an earned counter, with spending deferred to Arc 3, protects the verb budget and avoids a half-specified reward board. The high-water formula is the right anti-farm fix. |
| DP7 | agree | Four notches are more legible than a continuous dial, and the cache term creates the needed non-monotone payoff. Strengthen the test as in F6 so the notches remain decisions rather than choreography. |
| DP8 | agree | The player remains the reader even when the AI is not, so the content floor should rise from Draft 1. Add event distribution quotas so 90 lines cannot satisfy the letter while leaving some mechanics voiceless. |
| DP9 | agree | 25-30 minutes and three cycles are better matched to the reduced visual surface than Draft 1's longer arc. The duration target cannot be actionable until F1 defines the wall predicate and F4 defines upgrade costs. |
| DP10 | agree | Flat state and pure reducers are correct for this scalar design and for the existing test/save model. ECS should remain rejected unless S2 introduces heterogeneous host records in a later save version. |

## What is missing

The missing contract is the exact wall/retrain lifecycle: first offer predicate, decline timing, second offer timing, and which state fields survive each branch. Draft 2 also needs a precise return-from-offline screen and reducer rule, because §6.7 is now a core Law 1 defense rather than flavor.

The content floor needs distribution constraints, not just a total count: at least one tested THINKING pool per event key named in §7.3, plus enough operator lines for the 0.75, 0.50, and 0.25 stages without reuse fatigue.

## What to cut

Cut the first-lockout blackout scene from S1 before cutting any mechanical surface. Keep lockout, cooling, and the one-time line hook, but defer the four-second dramatic presentation until playtest proves the interruption helps more than it fights the second-to-second clock play.

If another cut is needed, cut the operator's third stage at 0.25 before touching queue inspect, heat, `integrity`, or the Law 1 suite.

## Notes

`npm test` is green: 193 passed on 2026-08-07.
