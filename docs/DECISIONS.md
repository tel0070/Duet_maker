# DECISIONS.md

Running log of consequential decisions and why. Formal, structural
decisions (ones future work must actively honor or deliberately reverse)
get a numbered ADR in `docs/adr/` instead; this file is for everything else
worth remembering.

## Monorepo tooling: pnpm workspaces, no Nx/Turborepo

At 4 packages with fast individual test suites (< 2s each), a build
orchestrator would add configuration surface without solving a problem
that exists yet. Revisit if package count or build time grows.

## `packages/music-domain` and `packages/audio-ui` were not created

The originally proposed repo structure included these as separate
packages. Nothing built so far needs them: harmony-core's music theory
utilities (`music-theory.ts`) are small enough to live inside
`packages/harmony-core` itself rather than a separate `music-domain`
package, and there's no UI-specific audio code yet (no playback, no
recording) to justify `audio-ui` existing as an empty shell. Create them
when Phase 3/4 work actually needs a home for that code, with real content
from the start — an empty placeholder package (a `package.json` with no
exports) was judged worse than the alternative of creating it later, since
empty packages tend to accumulate stale boilerplate nobody maintains.

## MIDI export: hand-written writer, not a dependency

See `docs/MODEL_RESEARCH.md` "Deliberately not used" section for the full
reasoning — short version: the needed format is small, a dependency adds
more surface area than it saves, and the hand-written version is fully
covered by an independent byte-level test.

## Timing unit is beats, not seconds

See `docs/DATA_FORMATS.md`. Chosen for BPM-independence and to match
MIDI/piano-roll conventions. Constant-BPM assumption for the MVP is a
known limitation, not an oversight — tempo maps are out of scope until a
concrete need arises.

## Scoring: 13 named components, weighted average, not a single opaque score

The spec explicitly named 13 score types. Rather than approximate with
fewer, more generic scores, `packages/harmony-core/src/scoring.ts`
implements exactly those 13 as separate functions, even where some overlap
conceptually (e.g. `voiceLeading` vs `singability` both consider leap size,
but from different angles — voice-leading correctness vs. ease of singing).
This trades some implementation complexity for direct spec traceability
(`docs/HARMONY_RULES.md` §3 maps each one) and for a genuinely explainable
per-note `scoreBreakdown` in the UI.

## Beam search over greedy note-by-note selection

A purely greedy algorithm (pick the single best candidate for each note in
isolation) cannot represent phrase-level effects like "avoid four notes of
parallel thirds in a row" or "shape this phrase's contour" — by the time
you notice the problem, the greedy choice is already locked in. Beam
search (width 6-8, tracking each beam's own recent-relations/recent-pitches
history) was chosen over full dynamic programming for simplicity; DP would
require a more complete state representation to get the same phrase-level
lookback and wasn't judged worth the added complexity at this stage.

## Initial hosting: GitHub Pages over Cloudflare Pages

Given full write-up as ADR 0001 (`docs/adr/0001-hosting-choice.md`) because
it's a structural decision with real tradeoffs (notably: Cloudflare Pages
supports private-repo deploys on its free tier; GitHub Pages via Actions
does not).

## Phase 2 editor: no react-router

The editor has exactly two views (`landing`, `editor`) for now, switched by
`window.location.hash` in `apps/web/src/Root.tsx`. Adding react-router for
two views would be pure overhead. Revisit when a third view (or nested
routes within the editor) actually appears.

## Phase 2 editor: Zustand, one store, debounced manual autosave

Chosen over React Context (too much boilerplate for this much shared,
frequently-updated state) and over Zustand's `persist` middleware (its
`StateStorage` interface is string-based; validating the persisted blob
against the exact `ProjectFile` zod schema on every load was important
enough — see `packages/shared-types/src/project.ts`'s `migrateProjectFile`
— that a hand-written IndexedDB wrapper calling it directly
(`apps/web/src/lib/storage.ts`) was simpler than adapting `persist` to fit.
Autosave is triggered explicitly at the end of each mutating store action
(`queueAutosave`), debounced 500ms, rather than a generic
subscribe-to-everything approach — keeps the "what triggers a save" logic
visible at each call site.

## Multi-project storage: key by project id, not a second store or a rewrite

The original single-slot autosave (`apps/web/src/lib/storage.ts`) stored
exactly one `ProjectFile` under the literal key `"current"`. Moving to
multi-project support did not mean introducing a new object store
alongside it or restructuring the schema — it meant keying the *same*
`"projects"` object store by each project's own `id` field (already part
of `ProjectFileV1`) instead of a fixed string, plus one small new `"meta"`
object store holding a single `lastOpenedProjectId` pointer so refreshing
the page reopens whichever project was open, not an arbitrary one.

A pre-existing single-slot save is migrated in place, lazily: the first
time `listProjects()` or `loadLastOpenedProject()` runs after the code
upgrades (`DB_VERSION` 1 → 2), it checks for a value still sitting under
the legacy `"current"` key, re-keys it under its own `id`, marks it
last-opened, and deletes the legacy key. This is a no-op on every
subsequent call (the legacy key won't exist anymore), so it needed no
separate "run this migration" step in the app's startup sequence — reading
the data at all is enough to migrate it, and a user's in-progress project
is never silently dropped by the upgrade.

Two different "load a project I didn't just save myself" paths needed
different id semantics, so the store exposes them as two distinct actions
rather than one generic `loadProject`-ish action:

- **`loadSampleProject`** (dropdown-selecting a bundled demo song) forks to
  a brand-new id every time. The sample JSON files ship with a fixed id;
  keeping that id would mean reselecting the same sample a second time
  silently overwrites whatever the user had already edited into that
  slot — a real data-loss trap once saves are keyed by id instead of
  always sharing the one autosave slot.
- **`importProjectFile`** (the "프로젝트 JSON 가져오기" file picker) keeps
  the imported file's own id. Re-importing a file you previously exported
  from this same app is a legitimate "resume this project" action, and a
  user reasonably expects that to update the same saved entry rather than
  create a duplicate every time.

`newProject` ("새 프로젝트") no longer touches storage at all. Previously
it called the single-slot `clearCurrentProject()`, which was fine when
there was only one slot to begin with; with multiple projects, deleting
anything as a side effect of "start something new" would be a surprising
and unnecessary loss. A blank project simply isn't persisted until the
user actually edits it, exactly like any other project before its first
autosave fires.

## Phase 2 editor: table-based editing first, piano-roll dragging as a follow-up

The first Phase 2 pass shipped `PianoRoll.tsx` as display + click-to-select
only, with all actual edits going through `NoteTable`/`ChordTable`/
`SectionTable`. That was a deliberate scope cut to ship a complete, tested,
working end-to-end flow (import → edit → generate → export → persist) in
one pass, rather than a piano roll with half-finished drag interactions —
and it was tracked as explicit follow-up work rather than left unstated.

The follow-up added drag-to-move, drag-to-resize, double-click-to-add, and
Delete-to-remove for **melody notes** on the piano roll
(`apps/web/src/components/PianoRoll.tsx`), on top of the existing tables
(which still work and stay in sync). Chords and sections stayed
table-only for that pass — dragging a chord/section band wasn't judged
worth the extra interaction design (resizing a chord changes its harmonic
content, not just its shape, so "drag the edge" is less obviously the
right UI than it is for a melody note) until a concrete need showed up.

The drag math (`apps/web/src/lib/piano-roll-geometry.ts`: px↔beat/pitch
conversion, snapping to a sixteenth-note grid, MIDI-range clamping, and
the move/resize→patch calculation) is a pure module with no DOM
dependency, kept separate from the pointer-event wiring in `PianoRoll.tsx`
specifically so it has real unit tests — jsdom doesn't lay out SVG, so
anything depending on actual bounding-box coordinates can only be
verified with a real browser (Playwright: `piano-roll-drag.spec.ts`).
A click vs. drag is disambiguated by total pointer movement
(`DRAG_THRESHOLD_PX = 3`): under that, releasing selects the note instead
of committing a (likely accidental) move.

A second follow-up extended dragging to **chord and section bands** too
(pink/purple bands above the melody). Rather than write a second geometry
module, `dragToBandPatch` reuses the same beat-snapping and floor-at-one-
snap-unit logic as `dragToNotePatch`, minus the pitch dimension bands
don't have. `PianoRoll.tsx`'s single `DragSession`/`onDragMove`/`endDrag`
pointer-handling flow is shared across all three drag kinds (note, chord,
section) via a `kind` discriminator, rather than three separate handler
sets — the only kind-specific branching is which patch function to call
and which callback (`onUpdateNote`/`onUpdateChord`/`onUpdateSection`) to
invoke on release. `SongSection` has `startTime`/`endTime` rather than
`startTime`/`duration` like `ChordEvent` and `NoteEvent`, so the section
case converts `endTime - startTime` to a duration before the shared patch
math and converts back (`startTime + duration → endTime`) before calling
`onUpdateSection`, keeping the derived-duration concept purely local to
`PianoRoll.tsx` rather than leaking into the schema.

Chord and section resize handles use a distinct CSS class
(`piano-roll-band-resize-handle`, with `--chord`/`--section` modifiers)
from melody notes' `piano-roll-resize-handle`, purely so the pre-existing
note-drag e2e tests' `.piano-roll-resize-handle` locator keeps resolving
to a melody note's handle — sections and chords render earlier in the SVG
than melody notes, so without a distinct class, `.first()` on a shared
class would have silently started grabbing the wrong element. Double-
click-to-add and Delete-to-remove were not extended to chords/sections in
this pass — both already have dedicated "추가"/"삭제" controls in their
tables, and double-click/Delete conventions for a *band* (what does
Delete do if focus is ambiguous between a note and a section?) weren't
judged worth resolving without a concrete request.

## Phase 3 guide playback: plain Web Audio oscillators, no audio library

`apps/web/src/lib/audio-engine.ts` uses `OscillatorNode` + `GainNode`
directly (no Tone.js or similar). Four guide voices (piano/soft synth/
choir pad/humming) are each just a waveform type
(triangle/sawtooth/sine) plus an attack/sustain/release envelope on the
gain — genuinely four different, listenable sounds, but explicitly not a
claim of realistic instrument or voice timbre. A dependency like Tone.js
would add real value once (if) sample-based instruments or effects chains
are needed; for four synthesized tones it would mostly add a library to
track licenses/updates for. Revisit if guide-audio quality becomes a
priority the current oscillators can't meet.

Split the same way as the piano-roll drag math: pure functions
(`midiToFrequency`, `beatsToSeconds`, `notesToScheduled`/
`harmonyToScheduled`) separate from `schedulePlayback`, which takes a real
`AudioContext` but is tested by passing a hand-built fake one (plain
objects + `vi.fn()` spies standing in for `createOscillator`/
`createGain`) — this lets the scheduling *logic* (right frequency, right
start time, right gain envelope, respects `playbackRate`) be asserted in
milliseconds under Vitest, with real-browser Playwright tests reserved for
what actually needs a real `AudioContext` (does it produce sound at all,
does the UI status update, does stop actually silence it).

Melody+harmony sync (the "함께 재생" button) works by computing
`ctx.currentTime + 0.05` once and passing it as `startAt` to both
`schedulePlayback` calls, rather than letting each call default it
independently (which would put them a few milliseconds apart — probably
inaudible, but needlessly imprecise for something explicitly advertised
as "synced playback").

Microphone recording was not attempted in the same pass as playback: it
needs `getUserMedia`/`MediaRecorder`, browser permission prompts, and a
different Playwright testing setup (fake-media-device launch flags) that
wasn't worth rushing into the same change as a first playback
implementation. Implemented as a follow-up (see next section).

## Microphone recording: same pure-logic/thin-wrapper split as playback, no media library

`apps/web/src/lib/recorder.ts` mirrors `audio-engine.ts`'s structure:
`createRecordingSession` takes an injectable `RecorderFactory` (defaults
to `(stream) => new MediaRecorder(stream)`), so its actual logic — collect
non-empty `dataavailable` chunks, assemble them into a `Blob` tagged with
the recorder's `mimeType` on `stop`, release every track in the stream —
is unit-tested against a hand-built fake recorder + fake `MediaStream`
(plain objects + `vi.fn()`), with no real microphone involved.
`requestMicrophoneStream` (the actual `getUserMedia` call) is left as a
thin, separately-testable wrapper that throws a Korean error if
`navigator.mediaDevices` doesn't exist at all, rather than a raw
`undefined is not a function` browser exception.

No recording/media library (RecordRTC, etc.) was added — `MediaRecorder`
already does the encoding, and the only logic this project owns is chunk
bookkeeping, which is a handful of lines.

Testing the real `getUserMedia`/`MediaRecorder` path (not just the
injectable logic) needed `playwright.config.ts` to launch Chromium with
`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` (plus
`permissions: ["microphone"]`) so a synthetic audio device is always
present and auto-granted — this makes the e2e test genuine (it drives the
real browser API end-to-end) without depending on real hardware or an
interactive permission prompt, and works the same way in CI. Note this
flag affects *any* test that calls `getUserMedia` in this project, so if
a future test wants to assert "permission denied" behavior specifically,
it'll need `context.grantPermissions([])`/`clearPermissions()`, not this
global config.

Recording was intentionally **not synced to playback** in this initial
pass — "녹음 시작" and "함께 재생" were two separate manual clicks, not one
combined action. A "재생하며 녹음" action combining them was added as a
follow-up (see the dedicated section below) — not a sample-accurate merge,
just one click starting both.

## A-B loop and count-in: region-slicing + a self-rescheduling setTimeout chain, manual beat entry

`sliceScheduledToRegion` (`apps/web/src/lib/audio-engine.ts`) is a pure
function that clips a `ScheduledNote[]` array to `[startSeconds,
endSeconds)` and rebases each note's `startTime` to the region start. The
loop itself is not a Web Audio native loop (`AudioBufferSourceNode.loop`
doesn't apply here — these are per-note oscillators, not one buffer) —
`PlaybackPanel.tsx` re-slices once, then re-invokes `schedulePlayback` with
a fresh `startAt` every `regionDurationSeconds / rate` via a `setTimeout`
chain, the same idiom already used for `armAutoStop`. A `loopGenerationRef`
counter (bumped on every `stopAll()`) is checked before each rescheduled
iteration fires, so starting a new playback action or hitting stop reliably
kills any in-flight loop chain instead of leaving a stray timer to fire into
a stopped context.

The loop region is entered as two beat-number inputs (start/end), not
picked from a `SongSection` dropdown. A section-based picker would read
nicer ("루프: 절 1") but ties the loop UI to needing sections to exist and
match what the user actually wants to rehearse, which is often a sub-phrase
smaller than a full section (e.g. just the tricky bridge transition, not
the whole bridge). Revisit if manual beat entry proves annoying in
practice — the underlying `sliceScheduledToRegion` function doesn't care
where the region numbers came from.

Count-in (`scheduleCountIn`) reuses the same oscillator+gain approach as
`schedulePlayback` rather than a sample-based click, for the same reason
`docs/DECISIONS.md`'s guide-playback entry gives: one dependency-free code
path, not a claim of a "real" metronome sound. It schedules backward from
the real playback start time (`endAt`) rather than forward from "now", so
the last click always lands exactly one beat before the first real note —
scheduling forward from "now" would have required separately computing and
matching that same offset, with more room for the two to drift apart. The
first click is pitched higher (1600Hz vs 1000Hz) to mark the downbeat, a
common metronome convention. Fixed at 4 beats (not configurable) — a
single on/off toggle was judged enough for the common case; a beat-count
selector can be added if 4 turns out to be the wrong default for some
users' workflow.

## "재생하며 녹음": one click starting two independent systems, not merged audio graphs

`PlaybackPanel` and `RecordingPanel` each own their own state (an
`AudioContext` and a `MediaRecorder` session respectively) and were built,
tested, and shipped independently. Combining them for "재생하며 녹음" did
**not** mean merging those into one audio graph (e.g. routing the guide's
`AudioContext` output into the same stream the `MediaRecorder` captures) —
that would let a user's recording literally contain the guide track baked
in, which is a real feature some users might want, but a materially bigger
change (audio-graph routing, and a decision about whether the baked-in
guide is even desired in the exported file) than what "sync recording with
guide playback" was scoped to mean here (see `AGENTS.md` §8's phrasing:
"a single 재생하며 녹음 action").

Instead, each panel gained a `forwardRef`+`useImperativeHandle` API
(`PlaybackPanelHandle`, `RecordingPanelHandle`) so `EditorPage.tsx` can
call `recordingRef.current.start()` then `playbackRef.current.playBoth()`
in sequence — two independent systems started by one click, each still
usable on its own via their existing standalone buttons. `start()` returns
whether the mic access actually succeeded, so the combined action doesn't
also start playback if the user denied the permission prompt (the
recording panel's own error text still explains why). If no harmony has
been generated yet, the combined action falls back to `playMelody()`
rather than doing nothing — recording yourself singing along to just the
main melody is still a real, useful case even before a duet arrangement
exists.

This means the recorded file only ever contains what the microphone
picked up (the user's voice, and acoustically whatever the room's speakers
leaked into the mic) — not a clean mix of guide + voice. That tradeoff is
the actual scope of "sync recording with guide playback" here: a
convenience button, not a mixer.

## Section regeneration: lock notes via the existing beam search, not a second algorithm

`regenerateSection` doesn't implement a separate "partial" search
algorithm. Instead, `planHarmonyTrack` gained an optional `fixedChoices:
Map<noteId, HarmonyCandidate>` — for a note in that map, the candidate
pool collapses to exactly one item (its previous choice), so the beam
search still runs unchanged, it just has nothing to decide at that note.
This was chosen over writing a second planner because it guarantees the
locked notes' `scoreBreakdown`/`styleReason` stay consistent with the
*current* chord/section context (recomputed by the same `scoreCandidate`
call every other note gets) without any risk of the two algorithms
drifting apart over time.

Continuity is deliberately **one-directional**: the first regenerated
note sees the real `prevHarmonyPitch` from the locked note before the
section (beams are still built left-to-right in time order, so this falls
out for free), but the locked note *after* the section was fixed before
regeneration ran, so the seam into it isn't specially optimized. Making
that symmetric would need the beam search to also score against a fixed
*future* note — a real two-sided constraint-satisfaction change, not a
small tweak — and wasn't judged worth doing before seeing whether the
one-directional version is actually noticeable in practice. Tracked as a
possible follow-up in `AGENTS.md` §8, not silently accepted as "done."

The web UI's regenerate button is disabled until a full generation exists
for the current style, because `regenerateSection` needs a previous
arrangement to lock everything else *to* — there's no "regenerate from
nothing" partial mode.

## MIDI import lives in `packages/harmony-core`, not `apps/web`

Symmetric to `midi-export.ts`. Keeps all Standard-MIDI-File byte-format
knowledge (variable-length quantities, running status, track chunk
parsing) in one tested, dependency-free package rather than splitting it
across the engine and the UI layer. Heuristic used to pick "the melody"
out of a multi-track file: the track with the most notes — documented as
a real limitation (not a source-separation algorithm) in
`packages/harmony-core/src/midi-import.ts`'s docstring.

## Failed/abandoned approaches worth remembering

- **Recomputing a candidate's `relation` label unconditionally after
  range-clamping** (`pushClamped` in `candidates.ts`) — seemed harmless,
  but silently destroyed the `"counterMelody"` tag on passing-tone
  candidates (their actual melodic interval is usually a 2nd, which has no
  named relation and fell through to `"custom"`). Caught by a test
  (`candidates.test.ts`), fixed by adding a `preserveRelation` flag instead
  of recomputing everywhere. Documented in `HARMONY_RULES.md` §2 so nobody
  re-introduces the same bug while refactoring.
