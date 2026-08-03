# AGENTS.md — Duet Maker

This is the single source of truth for any coding agent (Claude, Kimi,
Codex, or a human) working on this repository. `CLAUDE.md`, `KIMI.md`, and
`CODEX.md` are thin pointers to this file — do not duplicate its content
there, and do not assume the reader has access to any prior chat transcript.
Everything you need to continue this project is either in this file, in
`docs/`, or in the code and its tests.

## 1. Project purpose

Duet Maker is a browser-based vocal arrangement tool. A user provides a
solo melody (MIDI or direct input) and a chord progression; the app
generates a musically coherent **second vocal part** — harmony above/below,
unison, octave, common-tone holds, counter-melody, call-and-response — that
varies by song section and by one of four styles (Clean Pop, Emotional,
Dramatic, True Duet). It is explicitly **not** a fixed-interval transposer.

Hard constraints that shape every design decision here (do not relax these
without asking a human first, per `docs/adr/`):

- No paid APIs, no required account/login, no required server. Core
  features run entirely in the visitor's browser.
- User audio/MIDI/project files are never sent to a server. This will
  remain true even after Level 2/3 analysis features (see §3) are added —
  those are also designed to run browser/local-only.
- Kept independent of any single AI coding tool. Nothing in the source
  requires "remembering" a chat conversation to understand.

## 2. Current implementation status (as of this writing)

Read this section skeptically — verify against the actual code and test
output before trusting it, and update it the moment it goes stale.

| Area | Status |
|---|---|
| `packages/shared-types` | Done. Core data model + zod schemas + provider interfaces + project-file schema/migration. 20 tests passing. |
| `packages/harmony-core` | Done (Phase 1 MVP). Candidate generation, 13-component scoring, beam-search phrase planner, 4 distinct style strategies, seeded RNG, MIDI export + import, section-scoped partial regeneration (`regenerateSection`) with **two-sided continuity** (voice-leads into *and* out of the regenerated section). 104 tests passing. Wired into `apps/web`. |
| `apps/web` | Landing page + a working editor (**Phase 2 checklist fully done**) + guide playback & recording (**Phase 3 checklist fully done**) + audio-upload/local-engine integration (**Phase 5 web-side wiring done**). MIDI import, chord/section/note tables, drag/resize/add/delete for melody notes *and* drag/resize for chord and section bands on the piano roll, style picker, generate + per-section regenerate actions, harmony results table, MIDI/JSON/**MP3** export, multi-project IndexedDB storage with a "최근 프로젝트" list (open/delete), Web Audio guide playback (4 voices, per-track volume, speed control, synced main+harmony, A-B loop, 4-beat count-in), microphone recording (record/stop/playback/download), a "재생하며 녹음" action, an "오디오 업로드" panel that drives local-engine end-to-end (separate → tempo/key/chords → melody/sections, Korean progress text) and fills the editor from the result, and an "AudioMixPlayer" that mixes the separated vocal/instrumental stems with the generated harmony (independent mute + volume per track) and can render that exact mix to MP3 — all real, all covered by Playwright/Vitest tests where browser-testable and manually verified in a real browser (see `HANDOFF.md`). Phase 2/3 checklists are fully built out; Phase 5's web-side wiring is done, only real-song runtime is unverified. |
| `local-engine` | **Phase 5 implemented and verified end-to-end against synthetic audio in this dev sandbox** — see `local-engine/README.md`'s "Verified in development" note for exactly what was and wasn't confirmed (no real song was run through it here). FastAPI, localhost-only (binds 127.0.0.1), job-polling API. Demucs (`htdemucs`, two-stems) for separation, basic-pitch for melody transcription, librosa (beat tracking + chroma) with a from-scratch Krumhansl-Schmuckler key detector and chord-template matcher for tempo/key/chords, and a chroma/timbre self-similarity segmenter for sections. 20 pytest tests passing (pure math + a real end-to-end FastAPI+pipeline run against a fixture with known ground truth). See `local-engine/README.md` for install-size caveats (Demucs can pull a multi-GB CUDA torch wheel unless the CPU wheel is installed first) and known limitations (major/minor-only chords, heuristic section-type labels). |
| `packages/music-domain`, `packages/audio-ui` | Deliberately not created — see `docs/DECISIONS.md` for why (harmony-core's music theory lives in that package directly; the Phase 3 playback engine is small enough to live in `apps/web/src/lib/audio-engine.ts` rather than a separate `audio-ui` package — revisit if audio code grows enough to be reused outside `apps/web`). |
| CI (`.github/workflows/`) | `pull-request-check.yml` and `deploy-production.yml` are written and were validated locally (lint/typecheck/test/build/e2e all pass). **Whether they have actually run green on GitHub, and whether GitHub Pages is actually serving the site, has not been confirmed as of this commit — check the Actions tab and the live URL before claiming deployment works.** |

## 3. Overall structure

```
apps/web/            React+TS app: landing page + editor (chords/sections/melody tables,
                      piano roll display, style picker, MIDI/JSON export, IndexedDB autosave)
packages/shared-types/  Core data model (NoteEvent, ChordEvent, SongSection, ...), zod schemas, provider interfaces
packages/harmony-core/  Pure-TS harmony generation engine (no DOM dependency) — the core deliverable
local-engine/           Reserved for the optional Python analysis server (Phase 5, not started)
examples/               Golden fixtures: demo projects, chord progressions, generated MIDI
scripts/                Windows .bat helpers
docs/                   Architecture, product spec, harmony rules, deployment, privacy, etc.
```

`apps/web` has exactly two views, switched by a URL hash (`#editor`), not
react-router — see `apps/web/src/Root.tsx`. State lives in a single Zustand
store (`apps/web/src/store/project-store.ts`) that wraps
`generateDuetArrangement`/`exportArrangementToMidi`/`importMelodyFromMidi`
from `packages/harmony-core` directly (no network hop, no worker yet — see
`docs/DECISIONS.md` on when a Web Worker becomes necessary).

Provider interfaces in `packages/shared-types/src/providers.ts`
(`PitchExtractionProvider`, `ChordDetectionProvider`, `SectionDetectionProvider`,
`StemSeparationProvider`, `AudioAnalysisProvider`, `VocalSynthesisProvider`)
are the seam between "always works in any browser" (harmony-core, MIDI
input) and "optional, heavier analysis" (Level 2/3 features, local-engine).
Application code must depend on these interfaces, never on a specific model
or library name.

## 4. Key commands

Run from the repo root (pnpm workspace):

```bash
pnpm install       # install all workspace packages
pnpm dev           # start the web app dev server
pnpm build         # build packages, then the web app
pnpm test          # unit tests across all packages (vitest)
pnpm test:unit     # unit tests for packages/ only
pnpm test:e2e      # Playwright smoke test for apps/web
pnpm lint          # eslint, whole repo
pnpm typecheck     # tsc --noEmit, every package (src AND tests)
pnpm format        # prettier --write
pnpm validate       # lint && typecheck && test && build — run before every commit
```

Per-package, if you only touched one package:
`pnpm --filter @duet-maker/harmony-core run test`, etc.

Windows: `scripts\setup-windows.bat` once, then `scripts\start-web.bat` or
`scripts\validate-project.bat`.

Regenerating the example fixtures after a harmony-core change:
`pnpm --filter @duet-maker/harmony-core run generate:examples` (review the
diff before committing — see `examples/README.md`).

## 5. Coding rules

- User-facing copy (UI strings, error messages) is Korean. Code identifiers
  (functions, variables, files) are English.
- No comments that restate what the code does. A comment is for a
  non-obvious *why* (see the existing code for the level of comment density
  expected — sparse, and only where it earns its place).
- Every provider interface implementation must report a real `confidence`,
  never a hardcoded placeholder. Never display a random or fabricated
  number as if it were a real analysis result.
- Don't add a UI affordance (button, panel, menu item) for a feature that
  isn't wired up. Either hide it or label it "준비 중" / a named status
  tier (see `apps/web/src/App.tsx` `FEATURES` array for the pattern).
- Same input + same `seed` must always produce byte-identical
  `DuetArrangement` output from `generateDuetArrangement`. If you touch
  `packages/harmony-core`, do not introduce `Math.random()` — use
  `createRng` from `rng.ts`.
- Don't weaken a test to make it pass. If a test is wrong, fix the test and
  say why in the commit message; don't delete it silently.

## 6. Test strategy

See `docs/TEST_STRATEGY.md` for the full picture. Summary:

- `packages/shared-types/tests/` — schema validation + project migration.
- `packages/harmony-core/tests/` — music theory correctness, candidate
  generation, all 13 scoring components including `voiceLeading`'s
  two-sided (backward + forward) blend, style differentiation, MIDI byte
  structure (verified with an independent hand-rolled reader, not just
  round-tripping through the same writer), 9 scenario progressions × 4
  styles as an integration matrix, and `regenerateSection`'s "everything
  outside the target section is byte-identical" guarantee plus a test
  that forces two different pitches onto the locked note right after a
  regenerated section and confirms the section's last note actually
  responds to each (proving the forward seam is real, not coincidental).
- `apps/web/tests/unit/` — multi-project storage (IndexedDB, via
  `fake-indexeddb`: list/load/save/delete by id, last-opened tracking, the
  legacy single-slot migration, and skipping corrupted entries), Zustand
  store behavior (including the section-regenerate action's guard/error
  path, and multi-project actions — fork-on-sample-load, keep-id-on-
  import, open/delete/refresh), landing page, hash routing, piano-roll
  coordinate math (pure functions), audio-engine scheduling logic (via a
  fake `AudioContext` with spied nodes), microphone-recording chunk
  assembly (via a fake `MediaRecorder` + fake `MediaStream`, and a stubbed
  `navigator` for the no-API-available error path) — all without needing
  real audio/microphone hardware — and an integration-style editor test
  that adds a note/chord through the actual table UI and generates a real
  arrangement.
- `apps/web/tests/e2e/` — Playwright specs covering the landing page, a
  real end-to-end editor flow (load sample → generate → verify the result
  table, switch style → verify the result actually changed, no console
  errors during use), piano-roll drag/resize/add/delete for melody notes
  *and* drag-to-move/drag-to-resize for chord and section bands (these
  can only really be verified with a real layout engine — jsdom doesn't
  lay out SVG, so the pointer-event wiring itself isn't covered by unit
  tests; `piano-roll-band-drag.spec.ts` also confirms the note
  resize-handle locator used by the pre-existing note-drag tests still
  resolves correctly now that chord/section resize handles exist in the
  DOM too, since they intentionally use a different CSS class), the
  section-regenerate button's enabled/disabled state and wiring,
  guide playback (play/stop status text, both-tracks-together status,
  auto-stop once a short note actually finishes — this one genuinely
  waits out real Web Audio scheduling in Chromium, not a mock; plus A-B
  loop — confirms playback keeps going well past when a one-shot would
  have auto-stopped — and count-in — confirms playback is genuinely
  delayed and still auto-stops afterward), microphone recording
  (launched with Chromium's
  `--use-fake-device-for-media-stream`/`--use-fake-ui-for-media-stream`
  flags — see `playwright.config.ts` — so `getUserMedia`/`MediaRecorder`
  run for real against a synthetic device, no actual microphone needed
  and nothing depends on OS-level permission prompts), the "재생하며
  녹음" combined action (`sync-playback-recording.spec.ts`: confirms both
  systems actually start together and stop together, and that it falls
  back to melody-only playback when no harmony exists yet), and
  multi-project management (`project-management.spec.ts`: editing a blank
  project actually saves it and lists it, "새 프로젝트" doesn't delete the
  previous one, opening a listed project genuinely switches the editor's
  fields, and deleting the currently-open one falls back to a fresh blank
  project — all against real IndexedDB timing, not a mock).
- There is no separate "human evaluation" tooling yet (spec calls for a
  1-5 rating form); not built, not claimed as built.

## 7. Contracts you must not break without updating docs + tests together

- The zod schemas in `packages/shared-types/src/*.ts` — anything persisted
  or exchanged between packages. If a field's meaning changes, bump
  `CURRENT_SCHEMA_VERSION` in `project.ts` and add a migration branch; never
  reinterpret an old field silently.
- `NoteEvent`/`ChordEvent`/`SongSection` timing unit is **beats** (quarter
  notes) from song start, not seconds or milliseconds. See
  `docs/DATA_FORMATS.md`.
- `generateDuetArrangement`'s determinism guarantee (§5 above).
- The MIDI export format (3-track SMF: tempo, melody channel 0, harmony
  channel 1, 480 ticks/beat) — `packages/harmony-core/tests/midi-export.test.ts`
  encodes this contract explicitly.
- User files never leave the browser. Do not add a fetch/XHR call that
  uploads project or audio content anywhere, ever, without an explicit,
  separately-approved architecture change.

## 8. Current priorities (next recommended work, in order)

1. Confirm CI is actually green on GitHub (Actions tab) and that GitHub
   Pages is actually serving the built site at the real URL. As of this
   commit this has been validated locally but not confirmed on GitHub
   infrastructure — do not claim "온라인 공개 완료" until you have checked.
   This is the only item left on the original punch list that isn't a
   bigger phase-scale undertaking, and it needs a human decision (see
   `docs/adr/0001-hosting-choice.md`), not more code.
2. Phase 2's and Phase 3's checklists, plus two-sided section-regeneration
   continuity, are all now fully done. Next phase-scale work is Phase 4
   (vocal file analysis / browser-side pitch extraction) — a materially
   larger undertaking than anything above; don't start it without
   re-reading `docs/PRODUCT_SPEC.md`'s Phase 4 section first.

## 9. Known issues / deliberate simplifications

- `delayedEntry` and `repeatPhrase` (`ArrangementInstruction` flags) are
  currently reflected only as Korean explanatory text and mild scoring
  bias, not as a distinct phrase-boundary algorithm. A real implementation
  would detect phrase boundaries (rests/gaps in the melody) and mechanically
  delay/repeat notes at those boundaries. Tracked, not yet built.
- `tensionResolutionScore` approximates "does this dissonance resolve" by
  checking proximity to the *next chord's* tones, not by looking ahead at
  the actually-selected next harmony note (which the beam search hasn't
  chosen yet at scoring time). This is a reasonable approximation, not a
  bug, but a smarter two-pass approach could do better.
- The "human evaluation form" (1-5 ratings, spec §16) does not exist yet.
- `packages/music-domain` and `packages/audio-ui` from the originally
  proposed structure were not created — see `docs/DECISIONS.md`.
- The piano roll (`apps/web/src/components/PianoRoll.tsx`) supports
  drag-to-move, drag-to-resize, double-click-to-add, and Delete-to-remove
  for melody notes, and drag-to-move/drag-to-resize for chord bands (pink)
  and section bands (purple) too — all editable in sync with their tables
  (`ChordTable.tsx`/`SectionTable.tsx`), whichever is more convenient for a
  given edit. Chord/section resize handles use a distinct CSS class
  (`piano-roll-band-resize-handle`, not `piano-roll-resize-handle`) from
  melody notes' resize handles specifically so existing note-drag e2e
  locators keep resolving to the right element now that more resize
  handles exist earlier in DOM order. The drag geometry math (both
  `dragToNotePatch` for notes and `dragToBandPatch` for chords/sections)
  is a pure module (`apps/web/src/lib/piano-roll-geometry.ts`,
  unit-tested) separate from the pointer-event wiring (which can only
  really be verified with Playwright, since jsdom doesn't lay out SVG —
  see `apps/web/tests/e2e/piano-roll-drag.spec.ts` and
  `piano-roll-band-drag.spec.ts`). Double-click-to-add and
  Delete-to-remove remain melody-note-only — chords/sections are always
  added/removed via their tables.
- "화음 생성" always regenerates the *entire* arrangement for the selected
  style (it does replace only that style's entry in `project.arrangements`,
  not duplicate it — see `project-store.test.ts`). Per-section regeneration
  exists (`regenerateSection` in `packages/harmony-core`, wired to a
  "재생성" button per row in `SectionTable.tsx`), with **two-sided
  continuity**: the regenerated section's first note voice-leads from the
  locked note *before* it (via `prevHarmonyPitch`, as always), and its
  last note also factors in the locked note *after* it (via
  `ScoringContext.nextHarmonyPitch`/`nextMelodyPitch`, blended into
  `voiceLeadingScore`) — so the seam back out gets real consideration
  too, not just whatever the beam search happened to prefer on other
  grounds. This is one step of lookahead (only the note *immediately*
  after a fixed boundary), not a full two-pass reconciliation. See
  `packages/harmony-core/src/generate.ts`'s `regenerateSection` docstring
  and `docs/DECISIONS.md`.
- Guide playback (`apps/web/src/lib/audio-engine.ts`) uses plain Web Audio
  oscillators (triangle/sawtooth/sine waves with an ADSR-ish envelope per
  voice) — genuinely 4 distinct, listenable timbres, but explicitly not a
  claim of realistic piano/synth/choir/voice sound. A-B loop (region
  re-scheduled via a self-perpetuating `setTimeout` chain, `sliceScheduledToRegion`)
  and a 4-beat count-in (`scheduleCountIn`, accented downbeat click) both
  exist now; the loop region is entered manually as start/end beats, not
  picked from a section dropdown — see `docs/DECISIONS.md`.
- Microphone recording (`apps/web/src/lib/recorder.ts`,
  `RecordingPanel.tsx`) and guide playback (`PlaybackPanel.tsx`) can now be
  started together via `EditorPage.tsx`'s "재생하며 녹음" button, which
  calls each panel's `ref`-exposed imperative handle in sequence (start
  recording, then start playback). This is **not** sample-accurate
  audio-graph sync — it is two independent systems (a `MediaRecorder`
  capturing the mic, and Web Audio oscillators driving the speakers)
  started by one click, with whatever real-world delay that implies (mic
  permission grant, if not already granted, happens before playback
  starts). Each panel's own standalone start/stop buttons still work
  independently. See `docs/DECISIONS.md`.
- Multi-project storage (`apps/web/src/lib/storage.ts`) keys IndexedDB
  records by each project's own `id` instead of a single fixed slot, plus
  a small `meta` object store tracking which project id was last opened.
  A pre-existing single-slot autosave (stored under the literal key
  `"current"`) is migrated in place, lazily, the first time `listProjects`
  or `loadLastOpenedProject` runs after upgrading — not a separate
  migration step the user has to trigger. Loading a sample project always
  forks to a new id (so reselecting the same sample never silently
  overwrites a previously edited copy); importing a project JSON file
  keeps that file's own id (so re-importing your own export resumes/
  overwrites that same entry, which is what a user expects). See
  `docs/DECISIONS.md`.
- The editor has no Web Worker — `generateDuetArrangement` runs on the main
  thread. Fine at the note counts in the demo projects (tens of notes,
  sub-100ms); revisit if real user songs are long enough to cause visible
  UI blocking (see spec's "Web Worker" performance requirement).

## 10. Starting new work

1. `git pull`, then `pnpm install`.
2. Read this file, then `docs/ARCHITECTURE.md` and `docs/HARMONY_RULES.md`
   if you're touching the engine, or `docs/DATA_FORMATS.md` if you're
   touching schemas.
3. Run `pnpm validate` once before changing anything, to confirm you're
   starting from a green baseline.
4. Make your change with tests. If you're changing harmony-core scoring or
   candidate generation, add/update tests in `packages/harmony-core/tests/`
   — don't just eyeball a few generated notes.

## 11. Before ending a work session

1. `pnpm validate` (lint, typecheck, test, build) — fix or clearly report
   failures; don't leave the tree red without saying so.
2. If you changed harmony-core's algorithm, run
   `pnpm --filter @duet-maker/harmony-core run generate:examples` and
   review the fixture diff.
3. Update `HANDOFF.md` (always), `ROADMAP.md` (if a phase item moved),
   `CHANGELOG.md` (if user-visible), and `docs/adr/` (if you made a
   consequential technical decision).
4. Never write "as discussed earlier" or reference a chat conversation in
   any committed file. Every decision worth keeping goes in `docs/DECISIONS.md`
   or an ADR, in plain prose a stranger could follow.
