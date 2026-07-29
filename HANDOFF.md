# HANDOFF.md

## Last updated

2026-07-28 (Phase 2 editor + piano-roll drag + section regeneration, then Phase 3 guide playback + microphone recording)

## Current phase

Phase 0 and Phase 1 are done. Phase 2 (web editor) is functional but not
feature-complete. Phase 3 (guide playback & recording) is **almost**
done — playback and recording both work; only A-B loop/count-in remain.

## Working features

- `packages/shared-types`: full data model, zod validation, project-file
  schema + migration. 20 tests.
- `packages/harmony-core`: chord/scale-aware candidate generation, 13-score
  evaluator, beam-search planner, 4 structurally distinct styles, seeded
  reproducible generation, MIDI **export**/**import**, and
  **`regenerateSection`** (locks everything outside one section to its
  previous exact choice). 101 tests.
- `apps/web`: landing page (`#`) + editor (`#editor`). The editor:
  - Loads a sample project, starts blank, or imports a melody from a
    `.mid` file.
  - Edits chords, sections, and melody notes via tables, **and** melody
    notes directly on the piano roll (drag to move/resize, double-click
    to add, Delete to remove).
  - Generates a real arrangement per style via `generateDuetArrangement`,
    or regenerates just one section via `regenerateSection`.
  - Shows the full per-note result table (relation, chord role, motion,
    confidence, Korean `styleReason`).
  - Exports real MIDI and project-JSON files; imports project JSON back.
  - Autosaves to IndexedDB (single slot) and restores on refresh.
  - **Plays a guide audio track**: 4 voices (piano/soft synth/choir pad/
    humming), main melody alone / harmony alone / both together in sync,
    independent volume per track, 0.5x-1.25x speed.
  - **Records from the microphone** (new this round): "녹음 시작"/"녹음
    정지" via `getUserMedia`+`MediaRecorder`, playback of the take via a
    native `<audio>` element, and a download button. Verified end-to-end
    with Playwright launched against a synthetic fake device (Chromium's
    `--use-fake-device-for-media-stream` flag) — no real microphone
    needed for the test to be genuine, and the same flag means this also
    runs correctly in CI.
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — written and validated locally; not yet confirmed on
  GitHub's own infrastructure (see below).

## Partially working features

- **Phase 3 is missing only A-B loop and count-in.** Playback and
  recording both work; they are not synced to each other (starting the
  guide and starting a recording are two independent manual clicks).
- **Project persistence** is a single autosave slot, not a multi-project
  library.
- **Piano-roll drag editing covers melody notes only** — chords/sections
  are table-only.
- **Section regeneration's continuity is one-directional** (voice-leads
  in from the note before the section, doesn't specially optimize the
  seam back out).

## Known failures / unverified claims

- **CI has not been confirmed green on GitHub's infrastructure.** Everything
  (`pnpm validate`, `pnpm test:e2e`, manual browser walkthroughs) was run
  and passed *locally*. The workflow YAML has not yet executed on an
  actual GitHub Actions runner.
- **GitHub Pages is not confirmed to be serving the site.** This repo is
  private; needs GitHub Pro/Team/Enterprise or to be made public. See
  `docs/DEPLOYMENT.md` / `docs/adr/0001-hosting-choice.md` — human
  decision, unresolved since Phase 0.
- `delayedEntry`/`repeatPhrase` arrangement instructions are approximated
  via scoring bias + text only (Phase 1 limitation, unchanged).
- Guide playback timbres are genuinely 4 distinct oscillator-based sounds,
  not natural piano/choir/voice recordings.
- Recorded audio's actual container/codec depends on what the visiting
  browser's `MediaRecorder` defaults to (typically `audio/webm;
  codecs=opus` in Chromium) — not normalized/transcoded to a fixed format.
  Fine for playback-in-browser and re-download, but worth knowing if a
  user expects a specific file type.

## Recent architectural decisions

- **No react-router**; two views switched by `window.location.hash`.
- **Zustand for editor state**, hand-written IndexedDB wrapper (not
  `persist` middleware) — see `docs/DECISIONS.md`.
- **MIDI import lives in `packages/harmony-core`**, symmetric to export.
- **Section regeneration reuses the existing beam search** via an
  optional `fixedChoices` map in `planHarmonyTrack` — see
  `docs/DECISIONS.md` for the one-directional-continuity tradeoff.
- **Piano-roll drag math is a pure module** separate from pointer-event
  wiring, specifically so it's unit-testable without a real layout engine.
- **Guide playback and recording both follow the same "pure logic +
  thin browser-API wrapper" split**: `audio-engine.ts`'s scheduling math
  and `recorder.ts`'s chunk-assembly logic are each unit-tested against a
  hand-built fake (`AudioContext` / `MediaRecorder`+`MediaStream`), while
  the actual browser-API behavior (does sound come out, does a real
  recording get produced) is left to Playwright, which now launches
  Chromium with fake-media-device flags specifically so that layer is
  testable too, not just assumed to work. No audio/media library
  dependency for either (no Tone.js, no RecordRTC) — the browser APIs
  were sufficient.

## Next recommended task

Pick one:

1. **A-B loop and count-in** — the one remaining Phase 3 checklist item.
2. **Sync recording with guide playback** — a single "재생하며 녹음"
   action, now that both pieces independently work.
3. **Confirm the GitHub Pages deployment decision** with a human — open
   since Phase 0, still unresolved.
4. Multi-project management, chord/section piano-roll dragging, or
   two-sided section-regeneration continuity — see `AGENTS.md` §8.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize, section regen, playback, recording
```

Expected: all green. As of this handoff: 178 unit tests (20 shared-types +
101 harmony-core + 57 web) and 18 Playwright e2e tests, all passing; lint
and typecheck clean; build succeeds.

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, "화음 생성", try "가이드 재생" → "함께 재생", and "녹음" → "녹음
시작" (grant the microphone permission prompt).

## Files changed in the latest major work (this session)

Microphone recording, added right after guide playback:

- `apps/web/src/lib/recorder.ts` (+ test) — new: `requestMicrophoneStream`,
  `createRecordingSession` (injectable recorder factory for testing).
- `apps/web/src/components/RecordingPanel.tsx` (+ CSS) — new: record/stop/
  playback/download UI.
- `apps/web/src/lib/download.ts` — widened `downloadBlob` to accept a
  `Blob` directly (previously only `Uint8Array | string`).
- `apps/web/src/pages/EditorPage.tsx` — added a "녹음" section.
- `apps/web/playwright.config.ts` — added microphone permission +
  fake-device launch flags.
- `apps/web/tests/e2e/recording.spec.ts` — new.
- `apps/web/tests/e2e/playback.spec.ts` — fixed a locator collision (both
  "정지" and "녹음 정지" now match a substring `getByRole` query; playback's
  stop-button locator now uses `exact: true`).

(Prior major work: guide playback, section-level regeneration, piano-roll
drag editing, and the initial Phase 2 editor — see earlier commits.)

## Items requiring human evaluation

- **Musical quality** — listen to `examples/midi/*.mid` or export fresh
  ones and judge; no automated human-rating tooling exists.
- **Guide sound / recording quality** — are 4 simple oscillator timbres
  and un-normalized browser-default recording good enough, or does
  either need more work before Phase 3 feels "done"? Judgment call.
- **Hosting decision** — make the repo public, pay for a plan, or switch
  to Cloudflare Pages. See `docs/adr/0001-hosting-choice.md`.
