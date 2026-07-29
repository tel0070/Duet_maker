# HANDOFF.md

## Last updated

2026-07-29 (Phase 2 editor + piano-roll drag + section regeneration + multi-project management + chord/section piano-roll dragging + two-sided regeneration continuity, then Phase 3 guide playback + microphone recording + A-B loop/count-in + sync)

## Current phase

Phase 0 and Phase 1 are done. **Phase 2 (web editor) checklist is now
fully done**, including multi-project management and chord/section
piano-roll dragging. **Phase 3 (guide playback & recording) checklist is
fully done**, including the "재생하며 녹음" combined action. The one
remaining known limitation tracked in `AGENTS.md` (two-sided
section-regeneration continuity) is now also fixed.

## Working features

- `packages/shared-types`: full data model, zod validation, project-file
  schema + migration. 20 tests.
- `packages/harmony-core`: chord/scale-aware candidate generation, 13-score
  evaluator, beam-search planner, 4 structurally distinct styles, seeded
  reproducible generation, MIDI **export**/**import**, and
  **`regenerateSection`** (locks everything outside one section to its
  previous exact choice, with two-sided continuity — voice-leads into
  *and* out of the regenerated section). 104 tests.
- `apps/web`: landing page (`#`) + editor (`#editor`). The editor:
  - Loads a sample project, starts blank, or imports a melody from a
    `.mid` file.
  - Edits chords, sections, and melody notes via tables, **and** directly
    on the piano roll — melody notes with drag to move/resize,
    double-click to add, Delete to remove; chord and section bands with
    drag to move/resize (add/remove for those stays table-only).
  - Generates a real arrangement per style via `generateDuetArrangement`,
    or regenerates just one section via `regenerateSection`.
  - Shows the full per-note result table (relation, chord role, motion,
    confidence, Korean `styleReason`).
  - Exports real MIDI and project-JSON files; imports project JSON back.
  - Autosaves each project to IndexedDB, keyed by its own id, and restores
    the last-opened one on refresh. A "최근 프로젝트" panel lists every
    saved project (name + last-updated time) with "열기"/"삭제" per row;
    "새 프로젝트" starts a fresh, unsaved project without deleting
    anything else.
  - **Plays a guide audio track**: 4 voices (piano/soft synth/choir pad/
    humming), main melody alone / harmony alone / both together in sync,
    independent volume per track, 0.5x-1.25x speed, an A-B loop (start/end
    beat inputs, repeats until stopped) and a 4-beat count-in (accented
    downbeat click before playback starts).
  - **Records from the microphone**: "녹음 시작"/"녹음 정지" via
    `getUserMedia`+`MediaRecorder`, playback of the take via a native
    `<audio>` element, and a download button. Verified end-to-end with
    Playwright launched against a synthetic fake device (Chromium's
    `--use-fake-device-for-media-stream` flag) — no real microphone needed
    for the test to be genuine, and the same flag means this also runs
    correctly in CI.
  - **"재생하며 녹음"**: one button starts recording and guide playback
    together (falls back to melody-only if no harmony has been generated
    yet); a matching "재생·녹음 정지" stops both. Each panel's own
    standalone controls still work independently.
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — written and validated locally; not yet confirmed on
  GitHub's own infrastructure (see below).

## Partially working features

None — every item originally scoped for Phase 2 and Phase 3 is built.

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
  `docs/DECISIONS.md`. Continuity is now two-sided: `ScoringContext`
  gained `nextHarmonyPitch`/`nextMelodyPitch` (only non-null when the
  immediately next note is locked), and `voiceLeadingScore` blends a
  backward and forward leap check via a shared
  `directionalVoiceLeadingScore` helper. Zero effect on
  `generateDuetArrangement`'s determinism, since an ordinary full
  generation never populates `fixedChoices`.
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
- **A-B loop re-schedules rather than natively looping**: since guide
  playback is per-note oscillators (not one `AudioBufferSourceNode`), the
  loop is a `setTimeout` chain that re-slices and re-schedules the region
  each iteration, guarded by a generation counter so `stopAll()` reliably
  kills any in-flight chain — see `docs/DECISIONS.md`.
- **"재생하며 녹음" starts two independent systems, not one merged audio
  graph**: `PlaybackPanel`/`RecordingPanel` each expose their play/record
  actions via `forwardRef`+`useImperativeHandle`; `EditorPage` calls
  `start()` then `playBoth()` in sequence. The recorded file only contains
  what the microphone actually picked up — not a clean guide+voice mix.
  See `docs/DECISIONS.md` for why that's the deliberate scope, not a
  shortfall.
- **Multi-project storage keys the same IndexedDB store by project id**
  instead of adding a second store or rewriting the schema; a small new
  `meta` store just tracks which id was last opened. A pre-existing
  single-slot save is migrated in place, lazily, the first time it's read
  after upgrading — no separate migration step. `loadSampleProject` forks
  to a new id every time (so reselecting a sample never overwrites a
  previous edit); `importProjectFile` keeps the file's own id (so
  re-importing your own export resumes that same entry). See
  `docs/DECISIONS.md`.
- **Chord/section piano-roll dragging reuses the melody-note drag flow**
  via a `kind` discriminator (`"note" | "chord" | "section"`) in
  `PianoRoll.tsx`'s single `DragSession`/`onDragMove`/`endDrag` pipeline,
  and a new `dragToBandPatch` geometry function that's `dragToNotePatch`
  minus the pitch dimension. `SongSection`'s `endTime` is converted to/from
  a derived `duration` locally in `PianoRoll.tsx` so the shared band-patch
  math doesn't need to know about that schema difference. Chord/section
  resize handles use a distinct CSS class from melody notes' handles
  specifically so the pre-existing note-drag e2e locators keep resolving
  correctly now that more resize handles exist earlier in the SVG's DOM
  order. See `docs/DECISIONS.md`.

## Next recommended task

Pick one:

1. **Confirm the GitHub Pages deployment decision** with a human — open
   since Phase 0, still unresolved. This is now the only item left on the
   original punch list that isn't a bigger phase-scale undertaking, and it
   needs a human decision, not more code.
2. Phase 2's and Phase 3's checklists, plus two-sided section-regeneration
   continuity, are all now fully done. The next phase-scale work is Phase 4
   (vocal file analysis / browser-side pitch extraction) — read
   `docs/PRODUCT_SPEC.md`'s Phase 4 section before starting, it is a
   materially bigger undertaking than anything above.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize (notes + chord/section bands), section regen, playback, recording, sync, project management
```

Expected: all green. As of this handoff: 207 unit tests (20 shared-types +
104 harmony-core + 83 web) and 33 Playwright e2e tests, all passing; lint
and typecheck clean; build succeeds.

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, "화음 생성", try "가이드 재생" → "함께 재생" (try the "구간 반복"
and "카운트인" toggles too), "녹음" → "녹음 시작", "재생하며 녹음" to try
both together (grant the microphone permission prompt), add a note or
rename the project to see it appear under "최근 프로젝트", drag a chord or
section band on the piano roll, and try "재생성" on a section that isn't
the last one to see two-sided continuity in action.

## Files changed in the latest major work (this session)

Two-sided section-regeneration continuity, added right after chord/section
piano-roll dragging:

- `packages/harmony-core/src/scoring.ts` — added
  `nextHarmonyPitch`/`nextMelodyPitch` to `ScoringContext`; refactored
  `voiceLeadingScore`'s body into a `directionalVoiceLeadingScore` helper
  (leap size + parallel-fifths/octaves check) called once per known
  direction and blended `(backward + forward) / 2` when a forward pitch
  is known.
- `packages/harmony-core/src/planner.ts` — converted the main note loop
  to an indexed `for` loop so it can look at `sortedMelody[noteIndex + 1]`;
  computes `nextHarmonyPitch` only when that next note has a
  `fixedChoices` entry (i.e. only during `regenerateSection`, only for
  the last free note before a locked boundary) — `null` for every note
  in an ordinary full generation.
- `packages/harmony-core/src/generate.ts` — updated `regenerateSection`'s
  docstring from "continuity is one-directional" to describe the
  two-sided behavior.
- `packages/harmony-core/tests/scoring.test.ts` — 2 new tests: a
  candidate that leads smoothly into a known next pitch scores higher
  than one that leaps away from it; the blended score sits strictly
  between backward-only and forward-only.
- `packages/harmony-core/tests/regenerate-section.test.ts` — 1 new test:
  forces two very different pitches onto the locked note right after a
  regenerated section and confirms the section's last note measurably
  shifts toward whichever pitch was actually used each time (verified the
  effect is real, not coincidental, by checking the actual computed
  pitches before removing the debug print).
- `docs/HARMONY_RULES.md` — updated the `voiceLeading` row's description.

(Prior major work: chord/section piano-roll dragging, multi-project
management, syncing recording with playback, A-B loop/count-in,
microphone recording, guide playback, section-level regeneration,
piano-roll drag editing, and the initial Phase 2 editor — see earlier
commits.)

## Items requiring human evaluation

- **Musical quality** — listen to `examples/midi/*.mid` or export fresh
  ones and judge; no automated human-rating tooling exists.
- **Guide sound / recording quality** — are 4 simple oscillator timbres
  and un-normalized browser-default recording good enough, or would either
  benefit from more work even though the Phase 3 checklist is complete?
  Judgment call.
- **Hosting decision** — make the repo public, pay for a plan, or switch
  to Cloudflare Pages. See `docs/adr/0001-hosting-choice.md`.
