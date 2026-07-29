# HANDOFF.md

## Last updated

2026-07-28 (Phase 2 editor + piano-roll drag + section regeneration, then Phase 3 guide playback)

## Current phase

Phase 0 and Phase 1 are done. Phase 2 (web editor) is functional but not
feature-complete. Phase 3 (guide playback & recording) is **partially**
done: playback works, recording doesn't exist yet.

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
  - **Plays a guide audio track** (new this round): pick one of 4 voices
    (piano/soft synth/choir pad/humming), play the main melody alone, the
    generated harmony alone, or both together in sync; independent volume
    per track; 0.5x-1.25x speed. All real Web Audio — verified with a fake
    `AudioContext` in unit tests (correct frequencies/timing/gain) and in
    a real Chromium browser via Playwright (status text updates, stop
    actually silences playback, auto-stop fires when a note's scheduled
    end time genuinely passes).
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — written and validated locally; not yet confirmed on
  GitHub's own infrastructure (see below).

## Partially working features

- **Phase 3 is playback-only.** No microphone recording, no A-B loop, no
  count-in. The playback panel is deliberately scoped to what's tested and
  working, not a promise of the full Phase 3 checklist.
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
  not natural piano/choir/voice recordings — don't let the Korean labels
  ("피아노", "합창 패드") imply more realism than a few Web Audio
  oscillators actually produce.

## Recent architectural decisions

- **No react-router**; two views switched by `window.location.hash`.
- **Zustand for editor state**, hand-written IndexedDB wrapper (not
  `persist` middleware) — see `docs/DECISIONS.md`.
- **MIDI import lives in `packages/harmony-core`**, symmetric to export.
- **Section regeneration reuses the existing beam search** via an
  optional `fixedChoices` map in `planHarmonyTrack`, rather than a second
  algorithm — see `docs/DECISIONS.md` for the one-directional-continuity
  tradeoff.
- **Piano-roll drag math is a pure module** separate from pointer-event
  wiring, specifically so it's unit-testable without a real layout engine.
- **Guide playback (`apps/web/src/lib/audio-engine.ts`) is also split
  into pure scheduling-math functions** (`midiToFrequency`,
  `beatsToSeconds`, `notesToScheduled`/`harmonyToScheduled`) plus a
  `schedulePlayback` function that takes a real `AudioContext` — tested
  by passing a hand-built fake context (plain objects + `vi.fn()` spies,
  no real audio library) and asserting on what got scheduled, the same
  pattern used for `piano-roll-geometry.ts`'s drag math. No audio
  library dependency (Tone.js etc.) — plain oscillators/gain nodes were
  enough for 4 simple guide voices; revisit only if a real need for
  sample-based instruments shows up.
- **Recording was not started this round** — playback existing was a
  prerequisite for recording being useful (you'd want to hear the guide
  while you sing along), and was judged higher-value to ship first and
  solidly rather than rushing both.

## Next recommended task

Pick one:

1. **Microphone recording** (`getUserMedia` + `MediaRecorder`) — the
   remaining big Phase 3 piece. Note: harder to e2e-test than playback
   (needs Playwright's fake-media-device launch flags); plan the test
   strategy before writing the feature, not after.
2. **Confirm the GitHub Pages deployment decision** with a human — open
   since Phase 0, still unresolved.
3. A-B loop / count-in for the existing playback panel — smaller than
   recording.
4. Multi-project management, chord/section piano-roll dragging, or
   two-sided section-regeneration continuity — see `AGENTS.md` §8 for the
   full list, roughly in priority order.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize, section regen, guide playback
```

Expected: all green. As of this handoff: 171 unit tests (20 shared-types +
101 harmony-core + 50 web) and 16 Playwright e2e tests, all passing; lint
and typecheck clean; build succeeds.

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, pick a style, "화음 생성", then scroll to "가이드 재생" and click
"함께 재생".

## Files changed in the latest major work (this session)

Guide playback, added after section-level regeneration:

- `apps/web/src/lib/audio-engine.ts` (+ test) — new: pure scheduling math
  + `schedulePlayback` (real `AudioContext`, tested via a fake one).
- `apps/web/src/components/PlaybackPanel.tsx` (+ CSS) — new: voice/speed/
  volume controls, melody-only / harmony-only / both / stop actions.
- `apps/web/src/pages/EditorPage.tsx` — added a "가이드 재생" section.
- `apps/web/tests/e2e/playback.spec.ts` — new.

(Prior major work: section-level regeneration, piano-roll drag editing,
and the initial Phase 2 editor — see earlier commits for those file lists.)

## Items requiring human evaluation

- **Musical quality** — listen to `examples/midi/*.mid` or export fresh
  ones and judge; no automated human-rating tooling exists.
- **Guide sound quality** — are 4 simple oscillator timbres good enough
  for a rehearsal guide, or does this need real samples/synthesis before
  Phase 3 feels "done"? Judgment call, not resolved here.
- **Hosting decision** — make the repo public, pay for a plan, or switch
  to Cloudflare Pages. See `docs/adr/0001-hosting-choice.md`.
