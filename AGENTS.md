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
| `packages/harmony-core` | Done (Phase 1 MVP). Candidate generation, 13-component scoring, beam-search phrase planner, 4 distinct style strategies, seeded RNG, MIDI export. 91 tests passing. **Not yet wired into any UI.** |
| `apps/web` | Landing page only. Explains the project, links to GitHub, states current feature status. No piano roll, no upload, no editor — that is Phase 2, not started. |
| `local-engine` | Not started (Phase 5). See `local-engine/README.md`. |
| `packages/music-domain`, `packages/audio-ui` | Deliberately not created yet — see `docs/DECISIONS.md` for why (nothing currently needs them; creating empty placeholder packages was judged worse than adding them when Phase 2 UI work actually needs them). |
| CI (`.github/workflows/`) | `pull-request-check.yml` and `deploy-production.yml` are written and were validated locally (lint/typecheck/test/build/e2e all pass). **Whether they have actually run green on GitHub, and whether GitHub Pages is actually serving the site, has not been confirmed as of this commit — check the Actions tab and the live URL before claiming deployment works.** |

## 3. Overall structure

```
apps/web/            Static React+TS landing page (Phase 2 will add the editor here)
packages/shared-types/  Core data model (NoteEvent, ChordEvent, SongSection, ...), zod schemas, provider interfaces
packages/harmony-core/  Pure-TS harmony generation engine (no DOM dependency) — the core deliverable
local-engine/           Reserved for the optional Python analysis server (Phase 5, not started)
examples/               Golden fixtures: demo projects, chord progressions, generated MIDI
scripts/                Windows .bat helpers
docs/                   Architecture, product spec, harmony rules, deployment, privacy, etc.
```

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
  generation, all 13 scoring components, style differentiation, MIDI byte
  structure (verified with an independent hand-rolled reader, not just
  round-tripping through the same writer), and 9 scenario progressions × 4
  styles as an integration matrix.
- `apps/web/tests/unit/` — React Testing Library smoke tests.
- `apps/web/tests/e2e/` — one Playwright spec, loads the landing page and
  checks for console errors.
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

1. **Phase 2: web editor.** Wire `packages/harmony-core` into `apps/web`:
   MIDI/MusicXML import, piano roll for the main melody, chord timeline
   input, a "generate" action per style, a rendered harmony piano roll with
   per-note `styleReason`/`scoreBreakdown` shown in the UI, MIDI export
   download. IndexedDB project persistence. This is the highest-value next
   step — the engine is ready and tested, but unreachable by an actual user
   today.
2. Confirm CI is actually green on GitHub (Actions tab) and that GitHub
   Pages is actually serving the built landing page at the real URL. As of
   this commit this has been validated locally but not confirmed on GitHub
   infrastructure — do not claim "온라인 공개 완료" until you have checked.
3. Phase 3 (guide audio playback + recording) only after Phase 2's editor
   exists — there is nothing to play/record against yet.

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
