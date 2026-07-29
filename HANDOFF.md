# HANDOFF.md

## Last updated

2026-07-29 (Phase 2 editor + piano-roll drag + section regeneration + multi-project management + chord/section piano-roll dragging, then Phase 3 guide playback + microphone recording + A-B loop/count-in + sync)

## Current phase

Phase 0 and Phase 1 are done. **Phase 2 (web editor) checklist is now
fully done**, including multi-project management and chord/section
piano-roll dragging. **Phase 3 (guide playback & recording) checklist is
fully done**, including the "재생하며 녹음" combined action.

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

- **Section regeneration's continuity is one-directional** (voice-leads
  in from the note before the section, doesn't specially optimize the
  seam back out). This is the only remaining item across Phase 2 and
  Phase 3's original checklists.

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
   since Phase 0, still unresolved.
2. Two-sided section-regeneration continuity — see `AGENTS.md` §9. This is
   the only item left across Phase 2 and Phase 3's original checklists.
3. Phase 2's and Phase 3's checklists are now both fully done; the next
   phase-scale work is Phase 4 (vocal file analysis / browser-side pitch
   extraction) — read `docs/PRODUCT_SPEC.md`'s Phase 4 section before
   starting, it is a materially bigger undertaking than anything above.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize (notes + chord/section bands), section regen, playback, recording, sync, project management
```

Expected: all green. As of this handoff: 204 unit tests (20 shared-types +
101 harmony-core + 83 web) and 33 Playwright e2e tests, all passing; lint
and typecheck clean; build succeeds.

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, "화음 생성", try "가이드 재생" → "함께 재생" (try the "구간 반복"
and "카운트인" toggles too), "녹음" → "녹음 시작", "재생하며 녹음" to try
both together (grant the microphone permission prompt), add a note or
rename the project to see it appear under "최근 프로젝트", and drag a
chord or section band on the piano roll.

## Files changed in the latest major work (this session)

Chord/section piano-roll dragging, added right after multi-project
management:

- `apps/web/src/lib/piano-roll-geometry.ts` — new `dragToBandPatch`
  (shares beat-snapping/floor logic with `dragToNotePatch`, minus pitch).
- `apps/web/src/components/PianoRoll.tsx` — generalized the drag session
  to a `kind: "note" | "chord" | "section"` discriminator; added
  `onUpdateChord`/`onUpdateSection` props, band rects for chords/sections
  with their own resize handles (`piano-roll-band-resize-handle`, a
  distinct class from melody notes' handles), and a converted-duration
  round-trip for `SongSection`'s `startTime`/`endTime`.
- `apps/web/src/components/PianoRoll.css` — chord-band styling, shared
  resize-handle styling, `pointer-events: none` on band labels so they
  don't intercept drags meant for the band beneath them.
- `apps/web/src/pages/EditorPage.tsx` — wired `updateChord`/`updateSection`
  into the new `PianoRoll` props.
- `apps/web/tests/unit/piano-roll-geometry.test.ts` — 4 new tests for
  `dragToBandPatch`.
- `apps/web/tests/e2e/piano-roll-band-drag.spec.ts` — new: dragging/
  resizing a chord or section band produces the exact expected table
  values, no console errors, and the pre-existing note-drag tests still
  pass unmodified (confirming no locator collision).
- `apps/web/src/pages/LandingPage.tsx` — removed the now-false "코드와
  구간은 표로만 편집할 수 있습니다" claim.

(Prior major work: multi-project management, syncing recording with
playback, A-B loop/count-in, microphone recording, guide playback,
section-level regeneration, piano-roll drag editing, and the initial
Phase 2 editor — see earlier commits.)

## Items requiring human evaluation

- **Musical quality** — listen to `examples/midi/*.mid` or export fresh
  ones and judge; no automated human-rating tooling exists.
- **Guide sound / recording quality** — are 4 simple oscillator timbres
  and un-normalized browser-default recording good enough, or would either
  benefit from more work even though the Phase 3 checklist is complete?
  Judgment call.
- **Hosting decision** — make the repo public, pay for a plan, or switch
  to Cloudflare Pages. See `docs/adr/0001-hosting-choice.md`.
