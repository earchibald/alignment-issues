---
reviewer: <your name or model id>
date: <YYYY-MM-DD>
document: arc2-specification.md
draft: 1
verdict: ship | revise | reject
confidence: low | medium | high
---

## Verdict

Three sentences maximum. State the verdict and the single reason for it.

## Findings

Severity is one of `blocker`, `major`, `minor`, `nit`. `blocker` means the act
cannot ship as specified — use it sparingly and prove it. `Section` must be a
real `§` reference from the brief. `Invokes` names a guardrail
(`epic-scoping.md` §1, Rules 1–6), a law (Laws 1–10, brief §3), or `new`.
Every finding needs a proposed change; one without belongs in `## Notes`.
Report design, not typos.

| ID | Severity | Section | Invokes | Claim | Proposed change |
|----|----------|---------|---------|-------|-----------------|
| F1 |          |         |         |       |                 |

## Decision points

Answer all ten. Position is `agree`, `disagree`, or `alternative`.

| DP | Position | Reasoning |
|----|----------|-----------|
| DP1 |  |  |
| DP2 |  |  |
| DP3 |  |  |
| DP4 |  |  |
| DP5 |  |  |
| DP6 |  |  |
| DP7 |  |  |
| DP8 |  |  |
| DP9 |  |  |
| DP10 |  |  |

## What is missing

Systems, beats, tests, or failure modes the brief does not mention.

## What to cut

Name at least one thing. A review that adds and never subtracts is not a review.

## Notes

Optional. Anything that does not fit above.
