# HANDOFF.md

## Last updated

2026-07-28 (initial Phase 0 + Phase 1 build)

## Current phase

Phase 0 (repo/docs/tooling foundation) and Phase 1 (Harmony Core MVP) are
complete. Phase 2 (web editor UI) has not started — `apps/web` is a landing
page only.

## Working features

- `packages/shared-types`: full data model (NoteEvent, ChordEvent,
  SongSection, VocalRange, HarmonyNote, ArrangementInstruction,
  DuetArrangement), zod validation, project-file schema + migration stub,
  provider interfaces. 20 tests passing.
- `packages/harmony-core`: chord/scale-aware candidate generation (not
  fixed-interval), 13-component scoring, beam-search phrase planner,
  section-aware harmony density, 4 genuinely different style strategies
  (Clean Pop / Emotional / Dramatic / True Duet — different section plans,
  not just re-weighted copies), seeded reproducible generation, Standard
  MIDI File export (3-track, verified with an independent byte-level
  reader in tests). 91 tests passing.
- `examples/`: 3 demo songs (pop ballad, jazz ii-V-I turnaround, minor
  ballad), each with a full validated `ProjectFile` (all 4 style
  arrangements included) and an exported MIDI file. Regeneratable via
  `pnpm --filter @duet-maker/harmony-core run generate:examples`.
- `apps/web`: static landing page (React + Vite + TS). States project
  status honestly per-feature (Stable/Beta/준비 중), links to GitHub,
  privacy notice, license notice. Unit tests (Testing Library) + one
  Playwright e2e smoke test, both passing.
- CI workflows written: `pull-request-check.yml` (lint/typecheck/test/build
  + e2e smoke on every PR), `deploy-production.yml` (same checks, then
  GitHub Pages deploy on push to `main`), `dependency-review.yml`,
  `scheduled-health-check.yml` (weekly `pnpm validate`).

## Partially working features

- None of `packages/harmony-core`'s output is reachable by an actual user
  yet — it's a tested library with no UI. That's the entire scope of
  Phase 2.

## Known failures / unverified claims

- **CI has not been confirmed green on GitHub's infrastructure.** All
  checks (`pnpm validate`, Playwright e2e with a base path, MIDI byte
  structure) were run and passed *locally* in this dev environment. The
  workflow YAML has not yet executed on an actual GitHub Actions runner.
  Verify the Actions tab after push.
- **GitHub Pages is not confirmed to be serving the site.** This repo is
  currently **private**. GitHub Pages deployment via Actions on a private
  repo requires GitHub Pro/Team/Enterprise, or the repo must be made
  public. Until one of those is true and Settings → Pages → Source is set
  to "GitHub Actions" (one-time manual step, not automatable from here),
  `deploy-production.yml` will not successfully publish a live URL even
  though it will build correctly. See `docs/DEPLOYMENT.md`.
- `delayedEntry`/`repeatPhrase` arrangement instructions are only
  approximated via scoring bias + explanatory text, not a real
  phrase-boundary mechanism. See `AGENTS.md` §9.

## Recent architectural decisions

See `docs/DECISIONS.md` and `docs/adr/0001-hosting-choice.md` for full
rationale. Summary:

- Monorepo via pnpm workspaces (no Nx/Turborepo — not needed at this size).
- Time in `NoteEvent`/`ChordEvent`/`SongSection` is in **beats**, not
  seconds (see `docs/DATA_FORMATS.md`).
- Harmony scoring is 13 named components (matching the spec's list)
  combined as a weighted average per style, plus a beam search (width 6-8)
  over the melody so choices are phrase-aware, not purely greedy.
- MIDI export is a small hand-written Standard MIDI File writer (no
  `midi-writer-js`/`tonejs-midi` dependency) — the format is simple enough
  that a ~150-line writer is more auditable than a dependency, and it's
  covered by a byte-level test using an independent reader.
- `packages/music-domain` and `packages/audio-ui` (from the originally
  proposed structure) were not created — nothing needs them yet; creating
  empty stub packages was judged worse than adding them when Phase 2
  actually needs them.
- Initial hosting target: GitHub Pages (not Cloudflare Pages) — see ADR
  0001. This is provisional: the repo's current private visibility means
  GitHub Pages via Actions won't actually publish until the repo is public
  or on a paid plan; this is a human decision, not something to route
  around automatically.

## Next recommended task

**Phase 2: wire `packages/harmony-core` into `apps/web`.** Concretely:

1. MIDI file import (parse to `NoteEvent[]`) and/or a minimal piano-roll
   input for the main melody.
2. A chord-progression input UI (even a simple text-grid is fine for a
   first cut).
3. Style picker (4 styles) + "generate" action calling
   `generateDuetArrangement`.
4. Render the resulting harmony track (can start as a simple note list
   before a full piano roll) with each note's `styleReason` visible.
5. MIDI export download button using `exportArrangementToMidi`.
6. IndexedDB persistence of the project (schema already defined in
   `packages/shared-types/src/project.ts`).

Do not start Phase 3 (audio playback/recording) before this exists — there
is nothing to play or record against yet.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate   # lint + typecheck + test + build, all packages
```

Expected: all green. As of this handoff: lint clean, typecheck clean, 91
harmony-core tests + 20 shared-types tests + 4 web unit tests + 2 Playwright
e2e tests all passing, build succeeds for all packages.

## Files changed in the latest major work

Initial build — effectively the entire repository. Notable files if you
need to jump straight to the core logic:

- `packages/harmony-core/src/generate.ts` — entry point,
  `generateDuetArrangement`.
- `packages/harmony-core/src/planner.ts` — beam search.
- `packages/harmony-core/src/scoring.ts` — the 13 scoring components.
- `packages/harmony-core/src/styles.ts` — the 4 style strategies.
- `packages/harmony-core/src/midi-export.ts` — SMF writer.
- `packages/shared-types/src/*.ts` — the data model.
- `apps/web/src/App.tsx` — landing page content.

## Items requiring human evaluation

- **Musical quality**: no automated test can confirm the generated harmony
  actually sounds good. Listen to `examples/midi/*.mid` and judge; the
  spec's proposed 1-5 human rating form (naturalness, independence,
  emotional appeal, singability, chord fit, "sounds like a duet",
  repetitiveness, replay value) has not been built yet.
- **Hosting decision**: confirm whether this repo should go public (for
  free GitHub Pages) or stay private with a paid plan, or move to
  Cloudflare Pages instead (works on private repos on the free tier) — see
  `docs/adr/0001-hosting-choice.md`. This is a real open decision, not
  resolved by this work.
