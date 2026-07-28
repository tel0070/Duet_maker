# PRIVACY.md

## Summary

Core features run entirely in your browser. Your music files, MIDI, chord
progressions, and generated arrangements are not uploaded to any server by
this app, by default, ever, for the core feature set.

## What happens to a file you open in Duet Maker

- **Today (Level 1, implemented and verified)**: the editor's "MIDI 멜로디
  가져오기" button reads the file with the browser's `File`/`ArrayBuffer`
  APIs and parses it entirely client-side
  (`packages/harmony-core/src/midi-import.ts`). Verified in this project's
  own development process, with browser devtools open, that no network
  request is made when importing a file. The same is true for the project
  JSON import/export buttons. No file you open is ever sent anywhere.
- **MIDI / chord-progression input (Level 1)**: parsed and held entirely in
  browser memory / IndexedDB. No network request is made with the file's
  content.
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
  edits) — browser **IndexedDB**, implemented as a single autosave slot
  (`apps/web/src/lib/storage.ts`). Verified in this project's own
  development process by editing a project, reloading the page, and
  confirming it came back — including the generated arrangement.
- Exported files (MIDI, MusicXML — MusicXML not yet implemented, JSON) —
  written to disk only when the user explicitly clicks an export/download
  action.
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

The editor's "새 프로젝트" button clears the single autosave slot. Full
IndexedDB deletion is also achievable via the browser's own
site-data-clearing UI (which will also delete any locally-cached model
files from future Level 2 features). Because everything lives in the
browser, there is no server-side account or data for this project to
delete on your behalf — there's nothing there to begin with. A dedicated
"모든 로컬 데이터 삭제" button covering more than the single autosave slot
(e.g. once multi-project storage exists) has not been built yet.

## Third-party services

None are used by the core app. If Phase 5's optional local engine or a
future singing-synthesis adapter (Phase 6) introduces a third-party
model/library, its data-handling behavior will be documented here before
it ships, not after.
