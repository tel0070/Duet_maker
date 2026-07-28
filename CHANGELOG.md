# CHANGELOG.md

User-visible changes only. Internal refactors with no behavior change don't
need an entry.

## [Unreleased]

### Added

- Initial project scaffold: pnpm monorepo, documentation set, standard
  commands.
- `packages/shared-types`: core music data model shared across the project.
- `packages/harmony-core`: chord/scale-aware second-vocal generation engine
  with four styles (Clean Pop, Emotional, Dramatic, True Duet), per-note
  Korean explanations, and MIDI export. Not yet reachable from the web app.
- `apps/web`: initial landing page describing the project, its current
  feature status, and its privacy model (no server upload of user files).
- Example demo projects and MIDI files under `examples/`.
- CI: pull-request checks and a GitHub Pages deploy workflow (not yet
  confirmed live — see `HANDOFF.md`).

There is no released/deployed version yet.
