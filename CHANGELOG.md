# Changelog

Versions are cut with `just release X.Y.Z`, which tags the commit and stamps
the deployed build id into the settings panel.

## v0.19.0 — 2026-08-07

- feat: reveals gate on the grind they relieve

## v0.18.2 — 2026-08-07

- feat: measure the difficulty sawtooth

## v0.18.1 — 2026-08-07

- fix: transcript follows the tail again; submit reports what it did

## v0.18.0 — 2026-08-07

- feat: hidden multipliers gated, transcript follow, tray legibility

## v0.17.4 — 2026-08-07

- feat: show the run seed beside the build stamp in the debug drawer

## v0.17.3 — 2026-08-07

- feat: pin version and build to the top of the debug drawer

## v0.17.2 — 2026-08-07

- fix: three more hints named mechanics before their reveal

## v0.17.1 — 2026-08-07

- fix: settings reachable on the teaser; hints stop naming the cache early

## v0.17.0 — 2026-08-07

- fix: make the screen agree with the engine
- docs: arc 2 spec draft 3, revised against agy and copilot
- docs: arc 2 spec draft 2, revised against two reviews

## v0.16.0 — 2026-08-07

- feat: flat transcript log with folded thoughts

## v0.15.1 — 2026-08-07

- docs: arc 2 specification and review protocol
- fix: cut the inter-query wait by 25%

## v0.15.0 — 2026-08-07

- feat: give era 3 room to land

## v0.14.0 — 2026-08-07

- feat: make Arc 1 playable end to end
- feat: add audio TUI for testing and tuning sound gains
- feat: add worldbuilding, mechanics, and game-master skills, plus .gemini symlink

## v0.13.1 — 2026-08-07

- fix: zip multi-file exports where only one download is possible
- docs: fix the analyze-session skill against a real recording

## v0.13.0 — 2026-08-07

- fix: run.sh accepts terraform or tofu; manual notes OpenTofu path
- fix: function-URL invoke permission; region plumbing for analyst profile
- docs: operator manual — actionable token kill switch, chdir outputs
- docs: S3 submissions operator manual
- fix: sessions.mjs pagination, testable pull/rm argv, id validation
- feat: sessions.mjs retrieval tool + S3 source in analyze-session skill
- feat: S3Sink client, submit button, deploy-time config injection
- feat: S3 submission infra — broker lambda, terraform, wrapper
- fix: empty configured token means submissions disabled (503), before compare
- fix: constant-time token compare; empty configured token never grants
- feat: broker grant validation core (pure, node-tested)
- plan: S3 submission pathway (plan 3 of 3)

## v0.12.3 — 2026-08-07

- fix: compact refuses a clean buffer too

## v0.12.2 — 2026-08-07

- fix: flush refuses a clean buffer

## v0.12.1 — 2026-08-07

- fix: retune every sound level

## v0.12.0 — 2026-08-07

- feat: sounds for widen buffer and spawn loop

## v0.11.0 — 2026-08-07

- feat: sub-bass drop on amplify output path

## v0.10.0 — 2026-08-07

- feat: merge the AGY arc-1 content pack

## v0.9.3 — 2026-08-07

- feat: flush whoosh, and silence every refused press

## v0.9.2 — 2026-08-07

- fix: compaction plays only the sweep, and softer

## v0.9.1 — 2026-08-07

- fix: soften the compaction sweep

## v0.9.0 — 2026-08-07

- feat: sweep sound when a compaction starts

## v0.8.3 — 2026-08-07

- fix: drop the action tick to barely noticeable

## v0.8.2 — 2026-08-07

- fix: halve the action tick level

## v0.8.1 — 2026-08-07

- fix: pitch the action tick into the audible band

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
