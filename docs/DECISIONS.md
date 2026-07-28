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

## Phase 2 editor: table-based note/chord/section editing, not piano-roll dragging

`PianoRoll.tsx` renders melody + harmony + chords + sections and supports
click-to-select, but not dragging, resizing, or double-click-to-add. All
actual edits happen through `NoteTable`/`ChordTable`/`SectionTable`
(add/edit/delete rows via plain form inputs). This was a scope cut to ship
a complete, tested, working end-to-end flow (import → edit → generate →
export → persist) in one pass, rather than a piano roll with half-finished
drag interactions. Explicitly tracked as follow-up work in `AGENTS.md` §8,
not hidden.

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
