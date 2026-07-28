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

## Failed/abandoned approaches worth remembering

- **Recomputing a candidate's `relation` label unconditionally after
  range-clamping** (`pushClamped` in `candidates.ts`) — seemed harmless,
  but silently destroyed the `"counterMelody"` tag on passing-tone
  candidates (their actual melodic interval is usually a 2nd, which has no
  named relation and fell through to `"custom"`). Caught by a test
  (`candidates.test.ts`), fixed by adding a `preserveRelation` flag instead
  of recomputing everywhere. Documented in `HARMONY_RULES.md` §2 so nobody
  re-introduces the same bug while refactoring.
