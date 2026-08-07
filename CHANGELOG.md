# Changelog

Versions are cut with `just release X.Y.Z`, which tags the commit and stamps
the deployed build id into the settings panel.

## v0.8.0 — 2026-08-07

- feat: microtick sound on action presses

## v0.7.3 — 2026-08-07

- fix: multi-file export uses one directory dialog, not sequential save dialogs

## v0.7.2 — 2026-08-07

- fix: no back-to-back duplicate thinking lines; recorder docks into side panel

## v0.7.1 — 2026-08-07

- fix: session export uses a save dialog on desktop, share sheet on touch

## v0.7.0 — 2026-08-07

- feat: arc 1 content expansion — 73 queries, tier sampling, event thinking

## v0.6.1 — 2026-08-07

- fix: debug drawer no longer blocks play

## v0.6.0 — 2026-08-07

- fix: full draft buffer no longer warms the K/V cache; -5% arrival gap
- feat: card-up sound plus Acknowledgements section in settings
- feat: analyze-session skill + playtests directory
- feat: session-merge audio correlation, Whisper parsing, CLI
- fix: session-merge reports physical line numbers past blank lines
- feat: session-merge core — JSONL parse, wall time, event timeline
- plan: session analysis tooling (plan 2 of 3)
- chore: changelog entries go under the header, not above it
- fix: final-review — gate recording on live session, orphan-proof session start, audioMs on rec.error
- feat: session list with export/delete in dev drawer
- feat: session bundles, JSONL serialization, FileExportSink
- fix: recorder error path suppresses stop mark; guard concurrent start
- feat: dev-mode recording overlay with correlation marks
- fix: telemetry session-start failure must not block game startup
- feat: wire session telemetry into the game loop
- feat: game-aware telemetry hooks (chat/log/milestone deltas)
- feat: IndexedDB EventStore implementation
- feat: telemetry capture core with injected clock and store
- feat: telemetry EventStore interface + MemoryStore

## v0.5.0 — 2026-08-07

- fix: rebalance speculative decode; layered reset confirmation

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
