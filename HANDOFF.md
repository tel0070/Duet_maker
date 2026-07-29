# HANDOFF.md

## Last updated

2026-07-28 (Phase 2: web editor, piano-roll drag editing, section-level partial regeneration)

## Current phase

Phase 0, Phase 1, and a functional (not feature-complete) Phase 2 are done.
`apps/web` has a real editor with table-based editing, direct piano-roll
editing for melody notes, and per-section regeneration.

## Working features

- `packages/shared-types`: full data model, zod validation, project-file
  schema + migration. 20 tests.
- `packages/harmony-core`: chord/scale-aware candidate generation, 13-score
  evaluator, beam-search planner, 4 structurally distinct styles, seeded
  reproducible generation, MIDI **export** (3-track SMF) and **import**
  (`importMelodyFromMidi`, round-trip tested), and **`regenerateSection`**
  (re-decides only the notes inside one section, locking everything else
  to its previous exact choice). 101 tests.
- `apps/web`: landing page (`#`) + editor (`#editor`), switched by URL hash
  (no router dependency). The editor:
  - Loads one of 3 sample projects, or starts blank, or imports a melody
    from an uploaded `.mid` file.
  - Lets the user edit chords, sections, and melody notes via tables (add/
    edit/delete rows).
  - Also lets the user edit melody notes directly on the piano roll: drag
    a note to move it (time + pitch), drag its right edge to resize
    (duration), double-click empty space to add a new note, select a note
    and press Delete to remove it. Chords/sections remain table-only.
  - Renders melody + generated harmony + chords + sections on an SVG piano
    roll.
  - Picks one of the 4 styles and generates a real arrangement via
    `generateDuetArrangement` — verified, in a real Chromium browser via
    Playwright, that Clean Pop vs. Dramatic actually produce different
    note choices, not just different score numbers.
  - **Regenerates a single section** via a "재생성" button on each row of
    the section table — calls `regenerateSection`, disabled until a full
    generation exists for the current style. Verified (in
    `packages/harmony-core`'s own tests) that notes outside the target
    section keep their exact previous pitch/relation.
  - Shows the full per-note result table: relation, chord role, motion
    type, confidence, and the Korean `styleReason`.
  - Exports a real MIDI file and a real project JSON file (both verified
    by actually downloading and parsing them).
  - Imports a project JSON file back in (round-trip, schema-validated via
    `migrateProjectFile`).
  - Autosaves to IndexedDB (single slot, debounced) and restores on
    refresh — verified by reloading a real browser page and confirming the
    project and its generated arrangement came back.
  - "다른 결과 보기" (reroll): bumps the seed and regenerates.
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — written and validated locally; see "known failures"
  below for what's not yet confirmed on GitHub's own infrastructure.

## Partially working features

- **Project persistence** is a single autosave slot, not a multi-project
  library (no "recent projects" list, no per-project delete separate from
  "새 프로젝트" which just resets the one slot).
- **Piano-roll drag editing covers melody notes only** — chords and
  sections can only be edited through their tables, not by dragging bands
  on the roll.
- **Section regeneration's continuity is one-directional** — the
  regenerated section voice-leads correctly from the locked note *before*
  it, but the seam into the locked note *after* it isn't specially
  optimized. See `AGENTS.md` §9.

## Known failures / unverified claims

- **CI has not been confirmed green on GitHub's infrastructure.** Everything
  (`pnpm validate`, `pnpm test:e2e`, manual browser walkthroughs) was run
  and passed *locally* in this dev environment. The workflow YAML has not
  yet executed on an actual GitHub Actions runner — verify the Actions tab
  after push.
- **GitHub Pages is not confirmed to be serving the site.** This repo is
  private; GitHub Pages via Actions on a private repo needs GitHub Pro/
  Team/Enterprise, or the repo must be made public. See
  `docs/DEPLOYMENT.md` and `docs/adr/0001-hosting-choice.md` — this is a
  human decision, not something resolved by this session's work.
- `delayedEntry`/`repeatPhrase` arrangement instructions are only
  approximated via scoring bias + explanatory text (unchanged from Phase 1
  — see `AGENTS.md` §9).

## Recent architectural decisions

- **No react-router.** Two views (`landing`, `editor`), switched by
  `window.location.hash`. See `apps/web/src/Root.tsx` and
  `docs/DECISIONS.md`.
- **Zustand for editor state**, not React Context/prop drilling.
- **IndexedDB via a hand-written wrapper**, not a library like `idb` or
  Zustand's `persist` middleware — see `docs/DECISIONS.md`.
- **MIDI import added to `packages/harmony-core`**, symmetric to the
  existing export.
- **Sample projects are synced, not duplicated**, via
  `apps/web/scripts/sync-samples.mjs` (predev/prebuild).
- **Piano-roll drag geometry is a pure module**
  (`apps/web/src/lib/piano-roll-geometry.ts`), kept separate from the
  pointer-event wiring in `PianoRoll.tsx` so the math is unit-testable
  (jsdom doesn't lay out SVG). 12 unit tests for the math, 5 Playwright
  e2e tests for the actual drag interaction.
- **Section regeneration re-uses the existing beam-search planner** rather
  than writing a second algorithm: `planHarmonyTrack` grew an optional
  `fixedChoices` map that collapses a note's candidate pool to exactly one
  item (its previous choice) without otherwise changing the algorithm's
  shape. `regenerateSection` (in `generate.ts`) builds that map from every
  note *outside* the target section's time range, taken from the passed-in
  previous arrangement. See `docs/DECISIONS.md` for why continuity is only
  guaranteed in one direction (into the section, not out of it).

## Next recommended task

Pick one:

1. **Confirm the GitHub Pages deployment decision** with a human (public
   repo? paid plan? Cloudflare Pages instead?) and actually verify a live
   URL — open since Phase 0, still unresolved.
2. Phase 3 (guide playback + recording) — now unblocked.
3. Multi-project management, if a single autosave slot proves limiting.
4. Drag support for chords/sections on the piano roll, if the tables prove
   insufficient in practice.
5. Two-sided continuity for `regenerateSection`, if the one-directional
   seam proves audibly rough in practice.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright, including drag/resize/add/delete and section regenerate
```

Expected: all green. As of this handoff: 159 unit tests (20 shared-types +
101 harmony-core + 38 web) and 12 Playwright e2e tests, all passing; lint
and typecheck clean across all packages; build succeeds.

To see it running locally: `pnpm dev`, open the printed URL, click "편곡
시작하기 (Beta)", pick a sample project, pick a style, click "화음 생성".
Try dragging a melody note on the piano roll, then click "재생성" next to
one section in the 곡 구간 table.

## Files changed in the latest major work (this session)

Section-level partial regeneration, added after piano-roll drag editing:

- `packages/harmony-core/src/planner.ts` — `PlanHarmonyTrackParams` gained
  an optional `fixedChoices` map; a locked note's candidate pool collapses
  to one item and skips the density RNG roll.
- `packages/harmony-core/src/generate.ts` — new `regenerateSection` +
  `RegenerateSectionInput`.
- `packages/harmony-core/tests/regenerate-section.test.ts` — new.
- `apps/web/src/store/project-store.ts` — new `regenerateSection` action.
- `apps/web/src/components/SectionTable.tsx` — "재생성" button per row.
- `apps/web/tests/e2e/section-regenerate.spec.ts` — new.

(Prior major work: piano-roll drag editing, and before that the whole
Phase 2 editor — see earlier commits for those file lists.)

## Items requiring human evaluation

- **Musical quality** — unchanged from Phase 1: listen to
  `examples/midi/*.mid` or export fresh ones from the editor and judge; no
  automated human-rating tooling exists.
- **Hosting decision** — unchanged from Phase 0: make the repo public, pay
  for a plan, or switch to Cloudflare Pages. See
  `docs/adr/0001-hosting-choice.md`.
