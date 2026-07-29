# TEST_STRATEGY.md

## What exists today

| Suite | Location | Count | What it covers |
|---|---|---|---|
| Schema/migration unit tests | `packages/shared-types/tests/` | 20 | zod validation for every core type, project-file migration success/failure paths |
| harmony-core unit tests | `packages/harmony-core/tests/{music-theory,candidates,scoring,styles,midi-export,midi-import}.test.ts` | 48 | chord-tone construction, scale membership, range clamping, each of the 13 scoring components individually (including leap penalty, dissonance penalty, tension resolution, common-tone handling, parallel-fifths penalty), style differentiation, MIDI byte structure (export and a round-trip import) |
| harmony-core reproducibility/integration | `packages/harmony-core/tests/generate.test.ts` | 9 | same seed → identical output, 4 styles genuinely differ, chord changes propagate, vocal range respected, missing-chord warning fires, every note has a grounded explanation |
| harmony-core section regeneration | `packages/harmony-core/tests/regenerate-section.test.ts` | 6 | notes outside the target section stay byte-identical, full note coverage, determinism, unknown-section-id error, cross-section isolation (regenerating the verse doesn't touch the chorus), vocal-range continuity into the regenerated section |
| Scenario matrix | `packages/harmony-core/tests/scenarios.test.ts` | 38 | 9 standard progressions (C-G-Am-F, vi-IV-I-V, ii-V-I, minor ballad, fast chord changes, climbing final chorus, long sustain, fast notes, rest-heavy phrase) × 4 styles, checked for validity (in-range, correct note count) plus two structural spot-checks |
| Web unit tests | `apps/web/tests/unit/{storage,project-store,EditorPage,LandingPage,Root,piano-roll-geometry}.test.tsx` | 38 | IndexedDB round-trip (via `fake-indexeddb`), the Zustand store's mutating actions, generation flow, and section-regenerate guard/error path, an integration test that drives the actual table UI to add a note/chord and generate a real arrangement, landing page content, hash-based view switching, and the pure pixel↔beat/pitch conversion + drag-to-patch math behind piano-roll editing |
| Web e2e | `apps/web/tests/e2e/{landing,editor,piano-roll-drag,section-regenerate}.spec.ts` | 12 | Playwright, real Chromium: landing page loads with no console errors; loading a sample project and generating actually produces a result; switching styles actually changes the per-note result table (not just the rounded score); no console errors while using the editor; dragging a note moves it (verified via the note table's actual values, not just visually); resizing via the drag handle changes duration; a plain click selects rather than moving; double-click adds a note; Delete removes the selected note; the section-regenerate button's disabled/enabled state and that clicking it doesn't error |

Total: 171 tests, all passing as of this writing. Run `pnpm test` for unit
tests, `pnpm test:e2e` for the Playwright suite, or `pnpm validate` for the
full lint+typecheck+test+build gate (unit tests only — run `test:e2e`
separately).

## Why a "scenario matrix" instead of just unit tests

The spec calls for testing standard chord progressions (`C-G-Am-F`,
`ii-V-I`, etc.) and edge cases (long sustains, fast notes, rest-heavy
phrases) explicitly, because the beam search's behavior on a *sequence* of
notes isn't fully captured by testing `scoreCandidate` in isolation. The
scenario matrix doesn't (and can't) assert "this sounds good" — it asserts
things that would definitely be bugs if violated: every note gets a
harmony decision, every pitch is in range, the score is a finite number.
Musical quality is a human-evaluation concern (see below), not something
`expect().toBe()` can verify.

## What does not exist yet

- **Human evaluation tooling.** The spec calls for a 1-5 rating form
  (naturalness, independence, emotional appeal, singability, chord fit,
  "sounds like a duet", repetitiveness, replay value) saved as local
  JSON/CSV. Not built. Until it exists, judge musical quality by listening
  to `examples/midi/*.mid` directly.
- **Musical regression fixtures with committed "golden" scores.**
  `examples/demo-projects/*.json` capture input+seed+output+scores today,
  but there's no automated diff-and-flag step yet if a harmony-core change
  shifts them — that's a manual review step
  (`pnpm --filter @duet-maker/harmony-core run generate:examples`, then
  `git diff`) rather than a CI gate. Consider adding a CI check that fails
  if the fixtures are stale (regenerated output differs from committed
  output) once this matters more.
- **Touch-drag verification** — the piano roll's drag handlers use pointer
  events (which cover touch in principle, and `touch-action: none` is set
  on draggable elements), but the e2e tests only simulate mouse drags;
  actual touch-screen dragging hasn't been verified on a real device.
- **Cross-browser e2e** — Playwright is configured for Chromium only so
  far (matches what's preinstalled in this dev environment); Firefox/
  WebKit projects aren't configured in `playwright.config.ts`.

## Adding tests for new harmony-core behavior

If you change scoring, candidate generation, or planning logic:

1. Add/extend a unit test for the specific function you changed —
   `scoring.test.ts` and `candidates.test.ts` are structured as one
   `describe` block per concept (e.g. "도약 감점", "공통음 유지") matching
   the spec's own penalty/bonus list; keep that mapping legible so a
   reviewer can check spec coverage at a glance.
   `docs/HARMONY_RULES.md` §3 is the map from spec named-score → actual
   function; update both together.
2. If the change could plausibly shift generated output, run
   `generate:examples` and look at the diff before deciding whether it's
   the expected effect of your change or a regression.
3. Don't loosen an assertion just to make a test pass — if the test's
   expectation was actually wrong (this happened twice during initial
   development: a lexicographic-vs-numeric array sort, and a fixture
   ID-stability bug caught by the reproducibility test), fix the test and
   say so, don't just relax the threshold.
