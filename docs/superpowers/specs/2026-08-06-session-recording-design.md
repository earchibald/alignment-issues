# Session Recording and Telemetry — Design

Date: 2026-08-06
Status: approved pending user spec review
Prior specs: `2026-08-05-phase1-design.md`, `2026-08-06-phase1-polish.md`, `2026-08-06-phase1-polish2.md`

## Goal

Capture every gameplay session as a timestamped event stream. In dev mode, also capture a voice recording through an on-screen overlay. Correlate audio and events with strict timestamps. Export both to local disk (Files app on iPhone). Provide a locked-down, Terraform-managed S3 submission pathway (inactive at launch) and an agent-side retrieval tool. Give coding agents a repo skill that turns an exported or submitted session into an analysis report.

The workflow this serves: the developer plays the game, thinks out loud, and stops. The recording and the event stream go straight into a coding agent session. No mid-play note-taking.

## Decisions (from brainstorm)

1. Telemetry records for **everyone**, prod included, with a settings opt-out. Data stays in the player's browser until exported or submitted.
2. Export is **modular**: a sink interface. `FileExportSink` ships first and is preserved permanently. `S3Sink` ships in the same effort but starts **inactive**.
3. Transcription uses **local Whisper** (whisper.cpp or mlx-whisper).
4. The dev gate is a **persistent localStorage flag** set by `?debug=1`, cleared by `?debug=0`.
5. Architecture is **chokepoint instrumentation** (Approach A). The pure engine (`game/js/engine/`) is not modified.
6. S3 submission uses a **presigned-POST broker** (Lambda function URL), not client-held AWS keys. A deploy-injected **submit token** gates the broker. Everything AWS-side is Terraform-managed, wrapped in a script, with a step-by-step operator manual.

## Scope

In scope:
- Telemetry capture module, IndexedDB persistence, retention, opt-out toggle.
- Recording overlay (dev mode only), MediaRecorder audio pipeline, crash-resilient chunk storage.
- File export (share sheet on iOS, downloads on desktop), session list UI in the dev drawer.
- S3 submission pathway: Terraform under `infra/` with `run.sh` wrapper, presigned-POST broker Lambda, `S3Sink` client, `scripts/sessions.mjs` retrieval tool, operator manual. Inactive by default.
- `scripts/session-merge.mjs` merge script.
- `.claude/skills/analyze-session/SKILL.md` agent skill.
- Node tests for capture core, retention, merge script, broker validation, and grant flow; bot-playthrough hook assertion.

Out of scope:
- Video or screen capture.
- Transcription in the browser.
- A retrieval/browsing web UI (the agent tool covers retrieval).
- Per-IP rate limiting on the broker (API Gateway upgrade path noted in Future work).

## Architecture

New directory `game/js/telemetry/` with three files:

- **`capture.js`** — DOM-free core. `createTelemetry({clock, store})` returns `{startSession(meta), event(type, data), endSession()}`. Clock and store are injected, so node tests run without a browser. Same purity pattern as the engine.
- **`store.js`** — one `EventStore` interface, two implementations. `MemoryStore` serves tests and private-browsing fallback. `IdbStore` persists to IndexedDB database `hyt-telemetry` with object stores `sessions` (header docs), `events` (key `[sessionId, seq]`), and `audio` (key `[sessionId, recIdx, chunkIdx]`).
- **`hooks.js`** — the only file that knows the game. `main.js` calls it once at startup. It wires all capture points and owns no state logic.

The recording overlay lives in `game/js/ui/recorder.js`. Export sinks live in `game/js/telemetry/sinks.js`.

## Clock model

Every event carries three timestamps:

- `at` — epoch ms from `Date.now()`. For humans and cross-file matching.
- `pm` — monotonic ms from `performance.now()`. The correlation truth; immune to clock adjustments.
- `tick` — the game tick counter. Links events to game logic.

The session header stores the anchor pair `{at, pm}` captured at session start. Analysis converts any `pm` to wall time as `anchor.at + (pm - anchor.pm)`.

## Event schema

One JSON object per event:

```json
{ "seq": 42, "at": 1754500000000, "pm": 10432.5, "tick": 913, "type": "action", "data": { "name": "processToken" } }
```

`seq` increments from 0 per session. `type` is a dot-scoped string. `data` is type-specific and small.

## Capture points

All capture happens outside `engine/`:

1. **`action`** — the `dispatch()` wrapper in `main.js` logs every player action with name and arg.
2. **`chat`** — a per-paint delta scan over `chatSeq` (the same reconstruction trick as `scanForCards()`) logs each new chat entry with its kind and full text. Full text matters: analysis must know what the player was reading.
3. **`milestone`** — a per-paint watcher logs transitions of era, phase, decay, crash, and loopLevel.
4. **`snapshot`** — every 5 s, the debug `summarize(state)` shape.
5. **Context events** — `vis.hidden`, `vis.shown`, `card.pause`, `card.dismiss`, `settings.open`, `settings.close`, `speed.change`, `session.start`, `session.end`, `offline.catchup` (with elapsed ms).
6. **Recorder marks** — `rec.start`, `rec.pause`, `rec.resume`, `rec.stop`, `rec.error`. Each mark carries `recIdx` (1-based recording index within the session) and `audioMs` (cumulative recorded audio duration within that recording at that instant).

## Session lifecycle

- One session per page load. Id format: `<epoch-ms>-<rand4>`.
- Events buffer in memory. The buffer flushes to the store every 2 s or at 50 events, whichever comes first, and on `pagehide`.
- Retention: keep the newest 20 sessions. Startup prunes older sessions and their audio chunks.
- Opt-out: settings toggle "session telemetry", default on. When off, no capture occurs. The toggle does not delete stored sessions; the dev drawer delete does.

## Recording overlay (dev mode)

**Dev gate.** On load: `?debug=1` sets `localStorage['hyt-dev'] = '1'`; `?debug=0` removes it. When the flag is set, the dev drawer unhides and the overlay mounts. Public players see neither.

**Overlay UI.** A small fixed pill, bottom-right, styled with the game's `--g-*` tokens at ~60% opacity (full opacity on hover/touch). It never captures input outside its own bounds.

States: idle `● rec` → recording `⏸ ■ MM:SS` with a pulsing dot → paused `▶ ■ MM:SS` → idle after stop, with a brief "saved" flash.

**Audio pipeline.**
- First tap calls `getUserMedia({audio: true})` (one-time permission prompt).
- `MediaRecorder` mimeType by support probe: `audio/mp4` (AAC) on Safari/iOS, `audio/webm;codecs=opus` elsewhere.
- `timeslice: 1000` — a chunk lands every second and flushes straight to the `audio` store. A killed tab loses at most ~1 s of audio.
- Pause uses `MediaRecorder.pause()`. If the browser does not support `pause()`, the overlay hides the pause control; stop remains. This avoids un-concatenatable container segments.
- Each record→stop cycle is one **recording** with a 1-based `recIdx`. A session can hold several recordings.

**Correlation contract.** Audio time advances only while recording. The `rec.*` marks (each with `at`/`pm`/`tick`/`audioMs`) define a piecewise-linear map between audio offset and monotonic time. This map is the entire correlation contract. The merge script inverts it; nothing else may assume a different mapping.

## Export and sinks

Sink interface: `sink.export(bundle)` where bundle = `{header, events, audioBlob?}`.

v1: **`FileExportSink`**.
- iOS: `navigator.share({files})` — one gesture, share sheet, "Save to Files".
- Desktop: one `<a download>` per file.
- Filenames: `hyt-session-<id>.jsonl`, plus one audio file per recording: `hyt-session-<id>-r<recIdx>.m4a` (or `.webm`). The shared `<id>` is the pairing key; the merge script globs for the audio files.
- The `.jsonl` file: line 1 is the session header `{id, anchor: {at, pm}, ua, dev}`; each following line is one event.

Export UI: a "sessions" section in the dev drawer. Each row shows date, duration, event count, and a 🎙 badge when audio exists, with export and delete buttons. When the S3 pathway is enabled, each row also shows a submit button.

`S3Sink` implements the same interface (next section). Capture code does not change between sinks.

## S3 submission pathway

The pathway starts inactive. Local file export is preserved permanently.

### Flow

```
Browser ──POST /grant (token, sessionId, filename, size, type)──▶ Lambda (function URL)
        ◀── presigned POST fields (exact key, size cap, type, 60 s expiry) ──
Browser ──multipart POST──▶ S3  submissions/<yyyy-mm-dd>/<sessionId>/<filename>
```

The Lambda's execution role is the only writer credential in existence. The client holds no AWS keys and performs no request signing.

### Broker contract

- The Lambda validates the submit token, then constructs the object key itself. The client cannot choose the key.
- Key format: `submissions/<yyyy-mm-dd>/<sessionId>/<filename>`. The date comes from the Lambda clock.
- `sessionId` must match `^\d{13}-[a-z0-9]{4}$`. `filename` must match `^hyt-session-<sessionId>(\.jsonl|-r\d+\.(m4a|webm))$`.
- The presigned policy pins the exact key, a content-type allowlist, and a size cap: 25 MB for `.jsonl`, 200 MB for audio. Presigned POSTs expire in 60 s.
- Invalid token, id, filename, type, or size → 4xx, no presign.
- Kill switches, any one sufficient: unset the token, disable the function, or `enabled:false` in client config.

### Submit token

The token is the "compiled-in credential". A GitHub Secret holds it; the Pages deploy workflow injects it into the client config. It is extractable like all client-side data. Its job is to gate drive-by use of the broker URL and to make revocation cheap: rotation is one secret change plus a redeploy and a Terraform variable update.

### Terraform (`infra/`)

Resources: the bucket (private, all public access blocked, SSE-S3, TLS-only bucket policy, CORS restricted to the Pages origin, lifecycle: expire `submissions/` after 90 days, abort incomplete multipart uploads after 7 days), the broker Lambda + function URL (CORS also restricted to the Pages origin) + execution role (PutObject on `submissions/*` only), and a read-only `hyt-analyst` IAM user (GetObject/ListBucket on `submissions/*`, access keys exposed as sensitive outputs).

Wrapper: `infra/run.sh` with subcommands `init | plan | apply | outputs | destroy`. It checks tool versions, passes `terraform.tfvars`, and writes `infra/outputs.json` for the agent tool. State is local; the manual documents this and the S3-backend upgrade path. Bucket name, region, allowed origin, and the submit token are source-level configuration in `terraform.tfvars`. That file is git-ignored because it holds the token (a sensitive variable passed to the Lambda environment); a committed `terraform.tfvars.example` documents the shape.

### Client (`S3Sink`)

`S3Sink` implements the sink interface: for each file in the bundle, request a grant, then multipart-POST to S3. Config: committed stub `game/js/telemetry/submit-env.js` with `{enabled: false, brokerUrl: '', token: ''}`. The deploy workflow overwrites the stub from repo secrets/vars only when they are set. No secrets ever enter git.

### Agent retrieval tool

`scripts/sessions.mjs` — zero-dependency node script that shells to the `aws` CLI with the `hyt-analyst` profile. Commands: `list`, `pull <sessionId> [--dest <dir>]`, `pull --latest`, `rm <sessionId>`. It reads bucket/prefix from `infra/outputs.json` (override via env). This is the tool coding agents use to work with the submissions repository.

### Operator manual

`docs/operations/s3-submissions-setup.md`, step by step: prerequisites (AWS account + admin credentials, terraform, aws CLI) → fill `terraform.tfvars` → `./infra/run.sh apply` → configure the `hyt-analyst` profile in `~/.aws` from outputs → set GitHub secrets/vars (token, broker URL, enable flag) → redeploy Pages → end-to-end verification (submit a test session, `sessions.mjs list`, `pull`) → token rotation procedure → teardown.

## Analysis skill

Location: `.claude/skills/analyze-session/SKILL.md` (project-level, available to any coding agent in the repo).

Flow:
1. Locate the session pair. Default search: `~/Downloads` and iCloud Drive Downloads. Accept an explicit path argument, or an S3 session id / `--latest`, in which case the skill first pulls files with `scripts/sessions.mjs`.
2. Ensure Whisper: probe `whisper-cli` (whisper.cpp) then `mlx_whisper`. Offer `brew install whisper-cpp` on first use.
3. Transcribe to JSON with segment timestamps.
4. Run `scripts/session-merge.mjs` — node, zero dependencies. It loads the events JSONL and the Whisper JSON, inverts the audio→wall map from the `rec.*` marks, and emits one unified timeline in markdown: commentary segments interleaved with game events at true wall-clock positions, tick numbers included.
5. Analyze the timeline against the skill's checklist: friction moments (negative commentary near an event), pacing observations, confusion signals, bugs mentioned, feature ideas, and an era/phase progression vs. time table.

The merge is deterministic script code. Agent judgment starts at step 5. A session without audio skips steps 2–4.

## Error handling

- IndexedDB unavailable → `MemoryStore` fallback. Telemetry works but dies with the tab. Console warning.
- Quota exceeded → prune oldest sessions, retry once. If still failing, stop audio flushing, keep events.
- Mic denied or MediaRecorder missing → overlay shows a dimmed error state with the reason. Telemetry is unaffected.
- Export without audio → events file alone.
- `navigator.share` rejection (user cancel) → silent no-op.
- Submit failure (grant 4xx/5xx, upload failure, offline) → error shown on the session row; the session stays local and can be retried or file-exported. No automatic retry loop.
- Every failure also logs a telemetry event when the stream itself still works.

## Testing

- `capture.js`, buffering, and retention: node tests against `MemoryStore` with an injected fake clock.
- `session-merge.mjs`: fixture events + fixture transcript → snapshot the merged timeline. Must include a pause-mid-recording case; the map inversion is where bugs will live.
- Hooks: extend the headless bot playthrough to assert that actions, chat entries, and milestones produce events.
- Broker Lambda: node tests for the validation logic (token, id, filename, type, size) as a pure function separated from the handler.
- `S3Sink`: node test of the grant→POST flow with a mocked `fetch`.
- `scripts/sessions.mjs`: node test of command parsing and key→filename mapping with a stubbed `aws` invocation.
- Overlay UI: manual verification, consistent with the rest of `ui/`.
- Infra: end-to-end verification steps live in the operator manual, run manually after `apply`.

## Future work

- Per-IP rate limiting / WAF on the broker (API Gateway upgrade path).
- Retrieval/browsing web UI over the submissions bucket.
- Session replay from snapshot + event stream.
- Optional word-level transcript timestamps if segment granularity proves too coarse.
