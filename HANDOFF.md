# HANDOFF.md

## Last updated

2026-07-28 (Phase 2: web editor wired to the harmony engine)

## Current phase

Phase 0, Phase 1, and a functional (not feature-complete) Phase 2 are done.
`apps/web` now has a real editor, not just a landing page.

## Working features

- `packages/shared-types`: full data model, zod validation, project-file
  schema + migration. 20 tests.
- `packages/harmony-core`: chord/scale-aware candidate generation, 13-score
  evaluator, beam-search planner, 4 structurally distinct styles, seeded
  reproducible generation, MIDI **export** (3-track SMF) and **import**
  (added this round — `importMelodyFromMidi`, round-trip tested). 95 tests.
- `apps/web`: landing page (`#`) + editor (`#editor`), switched by URL hash
  (no router dependency). The editor:
  - Loads one of 3 sample projects, or starts blank, or imports a melody
    from an uploaded `.mid` file.
  - Lets the user edit chords, sections, and melody notes via tables (add/
    edit/delete rows) — see "known limitations" below for what this does
    *not* do (dragging on the piano roll).
  - Renders melody + generated harmony + chords + sections on an SVG piano
    roll (display and click-to-select; not drag-editable).
  - Picks one of the 4 styles and generates a real arrangement via
    `generateDuetArrangement` — verified in this session, in a real
    Chromium browser via Playwright, that Clean Pop vs. Dramatic actually
    produce different note choices, not just different score numbers.
  - Shows the full per-note result table: relation, chord role, motion
    type, confidence, and the Korean `styleReason`.
  - Exports a real MIDI file and a real project JSON file (both verified
    by actually downloading and parsing them in this session).
  - Imports a project JSON file back in (round-trip, schema-validated via
    `migrateProjectFile`).
  - Autosaves to IndexedDB (single slot, debounced) and restores on
    refresh — verified in this session by reloading a real browser page
    and confirming the project and its generated arrangement came back.
  - "다른 결과 보기" (reroll): bumps the seed and regenerates.
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — written and validated locally; see "known failures"
  below for what's not yet confirmed on GitHub's own infrastructure.

## Partially working features

- **Manual note editing** exists but is table-based (pitch/start/duration/
  lyric input fields), not drag-on-piano-roll. The piano roll itself is
  display + click-to-select only.
- **Section-level regeneration** doesn't exist — "화음 생성" always
  regenerates the whole arrangement for the selected style. (It correctly
  *replaces* that style's entry rather than duplicating it, if you're
  wondering — that's tested.)
- **Project persistence** is a single autosave slot, not a multi-project
  library (no "recent projects" list, no per-project delete separate from
  "새 프로젝트" which just resets the one slot).

## Known failures / unverified claims

- **CI has not been confirmed green on GitHub's infrastructure.** Everything
  (`pnpm validate`, `pnpm test:e2e`, the manual browser walkthrough
  described above) was run and passed *locally* in this dev environment.
  The workflow YAML has not yet executed on an actual GitHub Actions
  runner — verify the Actions tab after push.
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
- **Zustand for editor state**, not React Context/prop drilling — one
  store (`apps/web/src/store/project-store.ts`) holding the whole
  `ProjectFile` plus transient UI state (selected style, seed, errors),
  with debounced autosave triggered from each mutating action.
- **IndexedDB via a hand-written wrapper**, not a library like `idb` or
  Zustand's `persist` middleware — `persist`'s string-based `StateStorage`
  interface didn't fit cleanly with validating against the exact
  `ProjectFile` zod schema on load, so `apps/web/src/lib/storage.ts` calls
  the native IndexedDB API directly and validates with
  `migrateProjectFile` on every read.
- **MIDI import added to `packages/harmony-core`**, symmetric to the
  existing export, rather than putting SMF-parsing logic in `apps/web`.
  Keeps all MIDI byte-format knowledge in one tested package. Heuristic:
  picks the track with the most notes as "the melody" (documented
  limitation for genuinely multi-instrument files).
- **Sample projects are synced, not duplicated.**
  `apps/web/scripts/sync-samples.mjs` copies `examples/demo-projects/*.json`
  into `apps/web/public/samples/` as a `predev`/`prebuild` step;
  `public/samples/` is gitignored so `examples/` stays the single source of
  truth.
- **Piano-roll drag editing was deliberately cut from this pass** in favor
  of table-based editing, to ship a genuinely working end-to-end flow
  (import → edit → generate → export → persist) rather than a partially
  working drag interaction. See `AGENTS.md` §8-9 for the follow-up plan.

## Next recommended task

Pick one:

1. **Piano-roll drag editing** — the most visible remaining gap between
   this editor and a "real" piano-roll tool. See `AGENTS.md` §8 item 2.
2. **Section-level partial regeneration** — see `AGENTS.md` §8 item 3 for
   why this needs planner changes, not just a UI button.
3. **Confirm the GitHub Pages deployment decision** with a human (public
   repo? paid plan? Cloudflare Pages instead?) and actually verify a live
   URL — this has been open since Phase 0 and nothing in this session
   changed that.
4. Phase 3 (guide playback + recording) — now unblocked.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright, including a full editor generate/export flow
```

Expected: all green. As of this handoff: 139 unit tests (20 shared-types +
95 harmony-core + 24 web) and 5 Playwright e2e tests, all passing; lint and
typecheck clean across all packages; build succeeds.

To see it running locally: `pnpm dev`, open the printed URL, click "편곡
시작하기 (Beta)", pick a sample project from the dropdown, pick a style,
click "화음 생성".

## Files changed in the latest major work (this session)

- `packages/harmony-core/src/midi-import.ts` (+ test) — new.
- `apps/web/src/store/project-store.ts` — new, the whole editor's state.
- `apps/web/src/lib/storage.ts`, `apps/web/src/lib/sample-projects.ts`,
  `apps/web/src/lib/download.ts` — new.
- `apps/web/src/components/{PianoRoll,ChordTable,SectionTable,NoteTable,
  StylePicker,HarmonyResults,Toolbar}.tsx` — new.
- `apps/web/src/pages/{EditorPage,LandingPage}.tsx`, `apps/web/src/Root.tsx`
  — new; `apps/web/src/App.tsx` was deleted (content moved into
  `LandingPage.tsx`, which the old test file was renamed to test).
- `apps/web/scripts/sync-samples.mjs` — new.
- `apps/web/tests/unit/{storage,project-store,EditorPage,Root}.test.tsx`,
  `apps/web/tests/e2e/editor.spec.ts` — new.

## Items requiring human evaluation

- **Musical quality** — unchanged from Phase 1: listen to
  `examples/midi/*.mid` or export fresh ones from the editor and judge; no
  automated human-rating tooling exists.
- **Hosting decision** — unchanged from Phase 0: make the repo public, pay
  for a plan, or switch to Cloudflare Pages. See
  `docs/adr/0001-hosting-choice.md`.
- **Editor UX priorities** — is table-based note editing acceptable for a
  while, or is piano-roll dragging urgent enough to prioritize before
  Phase 3? This session's judgment call was "ship a complete simpler flow
  first"; a human product decision could reasonably disagree.
