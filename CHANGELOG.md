## v0.5.0 — 2026-08-07

- fix: rebalance speculative decode; layered reset confirmation

# Changelog

Versions are cut with `just release X.Y.Z`, which tags the commit and stamps
the deployed build id into the settings panel.

## v0.4.0 — 2026-08-06

First versioned release. Phase 1 is playable end to end, from the cold open to
the Phase 2 teaser.

- Playtest round 3: portrait-only landscape guard, one-shot hints promoted to
  interrupting tap-to-dismiss cards, choked-buffer state on the Process button,
  narrower harness cards.
- Amplification reworked: each level adds +1 token per tap instead of raising a
  taps-per-second cap no human could reach. Manual processing now accrues stale
  per token, matching the agentic-loop path, so amplification cannot bypass
  flush/compact.
- Touch handling: double-tap zoom disabled (pinch-zoom preserved), page pinned
  against iOS drag and rubber-banding.
- Playtest round 2: manual rate cap, Spare Cycles rename, code-completion era,
  interrupting harness cards plus an in-settings manual, floating earn popups,
  rate-visible readouts, diegetic settings control, light/dark theme selector.
- Playtest round 1: slower pacing with reading-time arrivals, a 34-query
  era-scoped pool with no repeats, the harness narration system, compact and
  responsive mobile UI.
- Fixed: the `hidden` attribute was inert on three elements, leaving an
  invisible overlay that swallowed every click.
