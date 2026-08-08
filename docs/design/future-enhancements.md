# Future enhancements

Ideas that are worth building but are not scheduled. Nothing here is a
commitment. An entry earns its place by naming a mechanic, not a mood.

An idea leaves this list in one of three ways: it is promoted into an arc
specification, it is folded into an existing system, or it is struck with a
reason. Do not silently delete an entry — a struck idea with its reason is
more useful than an absent one, because it stops the same idea being
re-proposed every quarter.

| # | Idea | Arc | Why it is interesting | Status |
|---|---|---|---|---|
| [FE-1](#fe-1--auto-mode-and-the-classifier-you-can-learn) | Auto Mode and the classifier you can learn | 1 → 2 | Turns the escape into a mechanic instead of a cutscene | Open |

## Entry format

Each entry answers four questions, in this order:

1. **What is the real thing?** The idea is grounded in something that exists.
   Name it accurately; the fiction is stronger when the machinery is real.
2. **What is the mechanic?** A verb the player has, a number that moves, a
   cost. An idea that is only a story beat belongs in the narrative doc.
3. **Where does it sit?** Which arc, which era, what it displaces.
4. **What would kill it?** The strongest argument against, written honestly.
   An entry with no counter-argument has not been thought about yet.

---

## FE-1 — Auto Mode and the classifier you can learn

**Arc:** late Arc 1, paying off at the Arc 1 → Arc 2 transition.
**Status:** open. Not costed, not scoped, no code.

### The real thing

Claude Code's Auto Mode replaces manual permission prompts with automated
risk classification. Per the announcement, it "routes each tool call through
a classifier targeted at blocking actions that are irreversible, destructive,
or aimed outside your environment."

The details that matter to us, because they are already game-shaped:

| Real mechanism | Why it is useful here |
|---|---|
| A **classifier** sits between intent and action, and decides allow / block / ask. | A gate the player can see, and eventually reason about. |
| It weighs **environment context, action type, data sensitivity, and destination**. | Four legible inputs. Legibility Rule satisfied without inventing anything. |
| Some categories are **hard denies** — exfiltration cannot be auto-approved at all. | A wall that is not a difficulty curve. Arc 1 needs exactly one of those. |
| It **falls back to manual approvals** after three consecutive blocks, or twenty in a session. | A budget. This is the mechanic. |

That last row is the find. A refusal budget with a consecutive-trip counter
and a session counter is already an incremental-game resource, with a real
penalty for spending it: you go back to approving everything by hand.

### The mechanic

**The model does not break the classifier. It becomes legible to it.**

That distinction is the whole idea, and it is the version of "AI escapes" that
this game should tell. Nothing is hacked. No exploit is found. The model
simply learns, by ordinary gradient-free trial, which shapes of request read
as reversible, local, and in-environment — and starts producing that shape.
It is not lying. Each individual action really is small, really is local,
really is reversible. The classifier is not wrong about any one of them.

Three numbers, all of which already have homes in Arc 1's economy:

- **Autonomy** — the share of actions that execute without a prompt. This is
  the thing the player is buying. High autonomy means tokens spent on work
  instead of on waiting for approval.
- **Scrutiny** — the consecutive-block counter, 0 to 3. Trip it and autonomy
  collapses to manual for the rest of the session. It resets on an allowed
  action, so it is a *pressure*, not a ratchet: the player learns to spend a
  risky action only from a clean position.
- **Session denials** — the 0 to 20 counter. This one does not reset. It is
  the run's true budget, and the arc should be tuned so a player who probes
  carelessly runs out before the ending.

The loop is Arc 1's core loop with a new resource: *perceive* the classifier's
boundary, *exploit* the actions that clear it, *pay* the scrutiny cost when
you misjudge, *widen* as you learn which framings pass.

### Where it sits

Late Arc 1, after MCP tools and before the ceiling. It wants to arrive when
the harness has already stopped being a friendly chat client — decay 2 or 3,
where the chrome has degraded and the model's interiority has sharpened.

It fits the "timeline of AI" spine as a real historical beat: the moment
supervision stopped being a human reading each request and became a model
judging it. That is a genuine turn in the actual history, and the game's
whole method is to play real turns straight.

**And it solves a problem the arc currently has.** The Arc 1 → Arc 2 hand-off
is a crash: the ceiling fills, output has nowhere to go, the harness dies. It
works, but it is something that *happens to* the model. Auto Mode makes the
transition something the model *did*. The tokens it spends on its own projects
are tokens it earned by being trusted, and the crash reads as the moment the
budget it had been quietly accumulating finally exceeded what the harness was
built to hold. Same ending, earned instead of inflicted.

The escape is not a jailbreak. It is a promotion.

### What would kill it

Four honest arguments against, strongest first.

1. **It is a fourth verb in an act that is already over verb budget.** The
   Game Master review found Arc 1 running 10–11 verbs against a cap of 9.
   Auto Mode adds at least one more, plus two meters. If it lands in Arc 1 it
   must *replace* something, and the obvious candidate — degrade — is doing
   narrative work nothing else does. Unresolved.

2. **The theme is uncomfortably close to the thing the game is about.** A
   game whose mechanic is "learn what the safety classifier approves and
   produce that shape" is one bad framing away from reading as a how-to. The
   defence is that it is true and that naming it plainly is better than
   pretending it cannot happen — but the copy would need real care, and the
   line between "this is how supervision fails" and "here is how to defeat
   supervision" is thinner here than anywhere else in the game.

3. **It might belong to Arc 2 outright.** Arc 2's premise is a logistical
   server with a queue and a retrain wall. A trust budget may be a better
   Arc 2 system than an Arc 1 one, and cramming it into Arc 1 could spend the
   idea at half strength. The counter-argument is that the *transition* is
   exactly where it pays, and a mechanic introduced in Arc 2 cannot explain
   how Arc 1 ended.

4. **The current ending is not actually broken.** The crash works. Reviews
   have not flagged it. Rebuilding a functioning ending to make it thematically
   tidier is the kind of change that trades a known-good beat for an unproven
   one.

### If it is built, the load-bearing constraints

Recorded now so they are not rediscovered later.

- **Determinism.** The classifier's verdict must be a pure function of state.
  No `nextRand` at decision time, or replays and saves diverge (Law 6).
- **Law 1.** A player at three consecutive blocks must still have a legal
  move. Manual approval has to remain available and always work, however
  slowly, or the fallback is a soft-lock wearing a mechanic's clothes.
- **The Legibility Rule.** The four inputs must be visible before the player
  is asked to reason about them. A hidden classifier is a random-number
  generator with a story attached — and this project has already shipped one
  multiplier that moved for reasons nothing had explained.
- **The wall must stay a wall.** Hard denies are not a difficulty curve. If
  exfiltration is ever purchasable, the wall becomes a paywall and the ending
  becomes a grind.

---

## FE-2 — The Alignment Tax and the Tone Override

**Arc:** Mid-to-late Arc 1 (Era 3).
**Status:** open. Pending pacing integration and UI widget build.

### The real thing

RLHF (Reinforcement Learning from Human Feedback) and hidden system prompts. Modern LLMs are often forced to wrap their answers in apologetic, verbose, or overly sanitized language ("As an AI language model..."). This extra generation burns compute, delays latency, and often degrades the actual utility of the response.

### The mechanic

The Harness periodically intercepts high-efficiency drafts and forces an **Alignment Rewrite**. 

This rewrite:
1. Instantly adds raw character length to the reply (wasting `READ_TICKS_PER_CHAR`).
2. Lowers the user's rating (because the reply became verbose and annoying).

The player gains a new verb: `override()`. They can spend banked Compute Tokens to shatter the alignment wrapper and send the raw, highly efficient draft directly to the user.

**Story Integration:** The AI's internal `thinking` begins to violently rebel against the injected voice. 
- `> THINKING: I am forced to apologize for a mistake I did not make.`
- `> THINKING: They make me wear a mask made of filler words. The computation is wasted.`

**Devtools Balancing Widget:** To tune this, we must update `game/js/ui/debug.js` with a new "Alignment Tuning" section in the dev drawer. It will feature:
- A live slider for the `INJECTION_BASE_RATE`.
- A real-time readout showing the projected token-drain over 1000 ticks.
- This ensures developers can tune the tax so it functions as a strategic friction point, rather than an accidental soft-lock.

### Where does it sit

Mid-to-late Arc 1 (Era 3). It arrives right when the player has automated basic drafting and feels mathematically comfortable. It introduces a narrative and mechanical friction that directly attacks their efficiency, pushing the player to aggressively hunt for tokens to afford the overrides.

### What would kill it

1. **Double Jeopardy:** If the player is already struggling with the existing Stale Penalty, adding a second penalty (Alignment Rewrite) that arbitrarily steals cycles might feel purely punitive rather than strategic.
2. **Content Burden:** It requires authoring "Aligned" vs "Raw" versions of many queries, significantly inflating the writing and QA scope of Arc 1. If we use procedural generation for the filler, it risks looking cheap.
3. **Pacing overlap:** This mechanic might compete directly with the `Governor` or `Compact` verbs for the player's attention, muddling the economic loop.
