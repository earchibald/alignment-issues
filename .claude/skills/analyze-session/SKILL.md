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

1. `mlx_whisper --help` — install with `pipx install mlx-whisper` (pipx keeps
   it out of the active Python environment and still puts the binary on
   PATH); models download automatically on first use.
2. `whisper-cli --help` — install with `brew install whisper-cpp`; it needs a
   model file once:
   `curl -L --create-dirs -o ~/.cache/whisper/ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`

If neither is present, ask the user which to install. Suggest mlx-whisper on
Apple Silicon.

Convert each recording to 16 kHz mono WAV first, with ffmpeg
(`brew install ffmpeg`):

    ffmpeg -v error -y -i hyt-session-<id>-r1.m4a -ac 1 -ar 16000 -c:a pcm_s16le /tmp/hyt-r1.wav

Use ffmpeg, not `afconvert`. Despite the `.m4a` name, Chrome's MediaRecorder
writes a FRAGMENTED MP4 (`moof`/`mdat`) carrying OPUS, not AAC. CoreAudio
opens neither, so `afconvert` fails outright with `AudioFileOpenURL failed`.
ffmpeg reads both. `.webm` recordings (the Firefox/fallback branch) convert
with the same command.

Transcribe each WAV to JSON with segment timestamps. KEEP the `-r<k>` marker
in the output filename — the merge script reads the recording index from it:

    mlx_whisper /tmp/hyt-r1.wav --model mlx-community/whisper-base.en-mlx \
      --output-dir /tmp --output-format json --output-name hyt-session-<id>-r1

Pass `--model` explicitly. mlx_whisper defaults to `whisper-tiny`, which
drops and mangles words in ordinary playtest commentary — on the same clip
tiny gave "and just testing recording" where base.en gave "And I'm just
testing the recording." Step up to `mlx-community/whisper-small.en-mlx` when
the commentary is quiet or fast.

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

## S3 source (optional)

When the user names a session id (or says "latest") and no local files
match, pull from the submissions bucket first:

    node scripts/sessions.mjs list
    node scripts/sessions.mjs pull <sessionId> --dest /tmp/hyt-pull
    # or: node scripts/sessions.mjs pull --latest --dest /tmp/hyt-pull

A row ending in 🎙 has audio; the file count tells you how many recordings
came with it.

`list` reads the bucket name from `infra/outputs.json`, which only exists on
a machine that has run terraform. Without it the command stops with
`no bucket configured` — export the name instead, it is not a secret:

    export HYT_BUCKET=earchibald-hyt-session-submissions

Then continue from step 2 with the pulled files. This path also needs the
`hyt-analyst` AWS profile, from docs/operations/s3-submissions-setup.md. If
`list` fails with a credentials error, point the user at that manual — do
not improvise AWS access.

Delete a submission once it is pulled and reported, so the bucket does not
accumulate personal recordings:

    node scripts/sessions.mjs rm <sessionId>
