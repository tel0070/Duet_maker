# Examples

Small, license-clean fixtures used by tests, docs, and manual demos. Nothing
here is copyrighted third-party material — every melody/chord progression was
written for this repository.

- `demo-projects/*.json` — full `ProjectFile` (schemaVersion 1.0.0) records:
  main melody, chords, sections, vocal range, and one generated
  `DuetArrangement` per style (Clean Pop / Emotional / Dramatic / True Duet).
  These double as regression fixtures — if a harmony-core change alters
  their `overallScore`/`harmonyTrack` significantly, that's expected after an
  intentional algorithm change, but review the diff before accepting it as
  the new baseline.
- `chord-progressions/*.json` — just the key/BPM/chords/sections from each
  demo project, for tests or tools that only need progression data.
- `midi/*.mid` — the main melody + generated Clean Pop harmony for each demo,
  exported as a 3-track Standard MIDI File (tempo, melody, harmony).

Regenerate all of the above after a harmony-core algorithm change:

```bash
pnpm --filter @duet-maker/harmony-core run generate:examples
```
