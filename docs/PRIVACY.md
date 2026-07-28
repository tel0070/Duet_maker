# PRIVACY.md

## Summary

Core features run entirely in your browser. Your music files, MIDI, chord
progressions, and generated arrangements are not uploaded to any server by
this app, by default, ever, for the core feature set.

## What happens to a file you open in Duet Maker

- **Today** (Phase 0/1 state): there is no upload UI yet at all — the
  landing page has no file input. This section describes the *design
  commitment* for when Phase 2 adds one, and will be updated with "as
  verified" language once that UI exists and has been tested.
- **MIDI / chord-progression input (Level 1, planned)**: parsed and held
  entirely in browser memory / IndexedDB. No network request is made with
  the file's content.
- **Vocal/a cappella upload for pitch extraction (Level 2, planned,
  Phase 4)**: processed in a Web Worker, in the browser, on
  capability-permitting devices. Still no upload.
- **Full-mix analysis via the optional local engine (Level 3, planned,
  Phase 5)**: the local-engine process runs on `localhost` only, started
  by the user on their own machine. The browser talks to it over
  `localhost` HTTP; nothing leaves that machine. If `local-engine` isn't
  running, Level 3 features are simply unavailable — the app does not fall
  back to any cloud service.

## What is stored, and where

- Project data (melody, chords, sections, generated arrangements, user
  edits) — browser **IndexedDB**, once Phase 2 implements persistence.
  Not implemented yet.
- Exported files (MIDI, MusicXML, project JSON) — written to disk only
  when the user explicitly clicks an export/download action.
- Nothing is stored on any server operated by this project. There is no
  server in this project's default architecture (see `ARCHITECTURE.md`).

## Analytics

None are implemented, and none are planned by default (see the project
brief in the repository's founding spec: visitor tracking is explicitly
excluded from the MVP). If analytics are ever added, the requirement
(carried over from that spec and binding on any future change) is: no
collection of filenames, MIDI/audio content, generated arrangements, or
recordings; a written update to this document; and a way for users to opt
out.

## Deleting your data

Once IndexedDB persistence exists (Phase 2): clearing it will be exposed as
an explicit in-app action, and is also achievable via the browser's own
site-data-clearing UI (which will also delete any locally-cached model
files from Level 2 features). Because everything lives in the browser,
there is no server-side account or data for this project to delete on your
behalf — there's nothing there to begin with.

## Third-party services

None are used by the core app. If Phase 5's optional local engine or a
future singing-synthesis adapter (Phase 6) introduces a third-party
model/library, its data-handling behavior will be documented here before
it ships, not after.
