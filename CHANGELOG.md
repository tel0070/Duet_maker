# CHANGELOG.md

User-visible changes only. Internal refactors with no behavior change don't
need an entry.

## [Unreleased]

### Added

- **Chord/section piano-roll dragging.** Chord and section bands on the
  piano roll can now be dragged to move (start time) and dragged at the
  right edge to resize (duration), the same interaction already available
  for melody notes — in addition to the existing table editors, which stay
  in sync.
- **Multi-project management.** The editor now has a "최근 프로젝트" panel
  listing every project saved in this browser, with "열기"/"삭제" per
  project. "새 프로젝트" no longer deletes anything — it just starts an
  unsaved blank project. A previous single-slot autosave is migrated in
  automatically.
- **재생하며 녹음 (play while recording).** A single button in the editor
  now starts the microphone recording and guide playback together (falls
  back to melody-only playback if no harmony has been generated yet), and
  a matching button stops both. Not sample-accurate audio-graph sync —
  two independent systems started by one click.
- **A-B loop and count-in for guide playback.** The playback panel now has
  a "구간 반복 (A-B 루프)" toggle with start/end beat inputs that repeats
  the selected region indefinitely until stopped, and a "카운트인
  (4비트)" toggle that plays 4 metronome clicks (accented downbeat) before
  playback starts.
- **Microphone recording.** The editor can record from the microphone,
  play the take back, and download it. Not synced to guide playback —
  two independent actions for now.
- **Guide playback.** The editor can now play the main melody, the
  generated second vocal, or both together (in sync), through one of four
  simple guide voices (piano/soft synth/choir pad/humming), with
  independent volume per track and 0.5x-1.25x speed control. This is
  synthetic guide audio for rehearsal, not a natural-voice synthesizer.
- **Section-level regeneration.** Each row in the editor's section table
  now has a "재생성" button that regenerates only that section's harmony,
  keeping every other section's notes exactly as they were. Disabled until
  a full generation exists for the current style.
- **Piano-roll drag editing.** Melody notes on the editor's piano roll can
  now be dragged to move (time + pitch), dragged at the right edge to
  resize (duration), added by double-clicking empty space, and deleted by
  selecting a note and pressing Delete — in addition to the existing table
  editor. Chords and sections are still table-only.
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

- Section regeneration voice-leads correctly *into* the regenerated
  section but doesn't specially optimize the seam back *out* of it.

There is no released/deployed version yet.
