# CHANGELOG.md

User-visible changes only. Internal refactors with no behavior change don't
need an entry.

## [Unreleased]

### Added

- **A working editor.** `apps/web` now has a real editor at `#editor`, not
  just a landing page: load a sample project or import a melody from a
  `.mid` file, edit chords/sections/melody notes via tables, view them on a
  piano roll alongside the generated harmony, pick one of four styles and
  generate a real arrangement, see the per-note reasons and scores, export
  MIDI or a project JSON file, and have your work autosaved to the browser
  (IndexedDB) and restored after a refresh.
- MIDI import in `packages/harmony-core` (`importMelodyFromMidi`),
  symmetric to the existing export.
- Project JSON export/import in the editor, validated against the same
  schema used for autosave.
- Initial project scaffold: pnpm monorepo, documentation set, standard
  commands.
- `packages/shared-types`: core music data model shared across the project.
- `packages/harmony-core`: chord/scale-aware second-vocal generation engine
  with four styles (Clean Pop, Emotional, Dramatic, True Duet) and per-note
  Korean explanations.
- Example demo projects and MIDI files under `examples/`.
- CI: pull-request checks and a GitHub Pages deploy workflow (not yet
  confirmed live — see `HANDOFF.md`).

### Known limitations

- Note/chord/section editing is table-based, not drag-on-piano-roll.
- Regeneration always covers the whole song; there's no per-section
  regenerate yet.
- Only one autosave slot exists (no multi-project list).

There is no released/deployed version yet.
