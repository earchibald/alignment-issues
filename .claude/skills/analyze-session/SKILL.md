---
name: analyze-session
description: Analyze a recorded gameplay session of "hi. you there?" — locate exported hyt-session files, transcribe audio with Whisper, merge into a wall-clock timeline, and write a playtest report. Use when asked to analyze a play session, a session recording, a telemetry export, or hyt-session-* files.
---

# Analyze a recorded gameplay session

Turn an exported session (events JSONL + optional audio recordings) into a
playtest report with the developer's spoken commentary aligned to gameplay
events.

## 1. Locate the session files

A session is one `hyt-session-<id>.jsonl` plus zero or more audio files
`hyt-session-<id>-r<k>.m4a` (or `.webm`). `<id>` matches `\d{13}-[a-z0-9]{4}`.

- If the user gave a path, use it.
- Else search, newest first:
  - `ls -t ~/Downloads/hyt-session-*.jsonl`
  - `ls -t ~/Library/Mobile\ Documents/com~apple~CloudDocs/Downloads/hyt-session-*.jsonl`
- If more than one candidate is recent, confirm the choice with the user.
- Collect the audio files that share the chosen `<id>`.

## 2. Transcribe the audio

Skip this section when the session has no audio files.

Probe for a transcriber, in this order:

1. `mlx_whisper --help` — install with `pip install mlx-whisper`; models
   download automatically on first use.
2. `whisper-cli --help` — install with `brew install whisper-cpp`; it needs a
   model file once:
   `curl -L --create-dirs -o ~/.cache/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`

If neither is present, ask the user which to install. Suggest mlx-whisper on
Apple Silicon.

m4a decode support varies between transcribers. Convert each recording to
16 kHz mono WAV first with the macOS built-in converter:

    afconvert -f WAVE -d LEI16@16000 -c 1 hyt-session-<id>-r1.m4a /tmp/hyt-r1.wav

Transcribe each WAV to JSON with segment timestamps. KEEP the `-r<k>` marker
in the output filename — the merge script reads the recording index from it:

    mlx_whisper /tmp/hyt-r1.wav --output-dir /tmp --output-format json --output-name hyt-session-<id>-r1

or:

    whisper-cli -m ~/.cache/whisper/ggml-base.en.bin -f /tmp/hyt-r1.wav -oj -of /tmp/hyt-session-<id>-r1

Either JSON shape works; the merge script detects it.

## 3. Merge into a timeline

    node scripts/session-merge.mjs <events.jsonl> [transcript.json ...] [--out <file>] [--snapshots]

Add `--snapshots` when you need the periodic state readouts.

Read the whole timeline before analyzing. Reading notes:

- The LAST `session end` row is the true end; rows can continue after an
  earlier one (iOS tab restore).
- `--- state swap ---` dividers mark reset/import/load; the game tick can
  jump backward across them.
- A recording without a `■ stopped` row ended abruptly (killed tab or device
  stop); its final commentary maps to the end of the session.

## 4. Analyze

Work through this checklist against the timeline. For every finding, quote
the supporting 🎙 voice lines with their timestamps.

1. **Friction** — negative or frustrated commentary near an event; repeated
   actions without progress.
2. **Pacing** — waits the player calls out; gaps over 30 s with no events or
   commentary; spacing of era/phase transitions.
3. **Confusion** — "what does X mean"; misread mechanics; settings opened to
   look something up.
4. **Bugs** — anything called out as broken, plus `rec.error` rows and
   unexpected state.
5. **Ideas** — feature wishes, verbatim.
6. **Progression** — one table row per `milestone`: wall clock, offset, tick,
   what changed.

## 5. Write the report

Write `docs/playtests/<sessionId>-report.md`:

    # Playtest <sessionId> — <date>
    ## Summary        (3-6 sentences: what this session showed)
    ## Friction       (finding → evidence quotes → suggested change)
    ## Pacing
    ## Confusion
    ## Bugs
    ## Ideas
    ## Progression    (the milestone table)
    ## Follow-ups     (concrete next actions, ranked)

Omit empty sections, but say in the Summary that they were empty. For a
session without audio, still run the merge (step 3, no transcript files) —
the rendered timeline beats raw JSONL — and state in the Summary that the
analysis is events-only.

S3 retrieval is not wired yet (plan 3): sessions arrive as local files only.
