# HARMONY_RULES.md

This document describes what `packages/harmony-core` actually does, in
enough detail that another agent can verify the code matches this
description (or update this doc when it doesn't). If code and doc
disagree, trust the code and tests, then fix this file.

## 1. Input normalization

`generateDuetArrangement(input: HarmonyGenerationInput)` takes:
`mainMelody: NoteEvent[]`, `chords: ChordEvent[]`, `key: string` (e.g. "C
major"), `bpm`, `sections: SongSection[]`, `vocalRange: VocalRange`,
`style: DuetStyle`, `seed: number`. Timing is in **beats** (see
`docs/DATA_FORMATS.md`). The melody is sorted by `startTime` internally;
the returned `sourceMelody` is the original, unsorted input.

## 2. Candidate generation (`src/candidates.ts`)

For each melody note, the candidate pool is built from:

1. **Chord tones** — every pitch class in the active chord (root, third,
   fifth, seventh, and any requested extensions via `chord.extensions`,
   e.g. `"9"`), placed at the nearest occurrence above *and* below the
   melody pitch (`nearestPitchAtOrBelow`/`Above` in `music-theory.ts`).
   This is the mechanism that makes the output chord-aware rather than a
   fixed transposition: change the chord, and this whole pool changes.
2. **Unison** — same pitch as the melody.
3. **Octave above/below** — melody ± 12 semitones.
4. **Common tone** — if the previous harmony note's pitch class is still a
   chord tone of the *new* chord, offer holding that exact pitch (encourages
   sustained inner voices across a chord change instead of hopping every
   note).
5. **Counter-melody / passing tone** — the nearest diatonic scale tone one
   step away from the melody that is *not* a chord tone, one candidate in
   each direction. Tagged `relation: "counterMelody"` and preserved as such
   through range-clamping (see the `preserveRelation` note in
   `candidates.ts` — this was a real bug caught by a test: naively
   recomputing the relation label after octave-clamping silently turned
   "counterMelody" into "custom").
6. **Rest** — always offered (`pitch: null`).

If no chord is active at a given time (`chord: null`), the pool falls back
to scale tones with `chordRole: "nonChordTone"` and a warning is added to
the arrangement (`"일부 구간에 코드 정보가 없어 스케일 음을 기준으로 화음을
생성했습니다."`) — never silently guessed as if it were confident.

Every candidate pitch is clamped into the vocal range
(`clampToVocalRange`), preferring the comfortable band over the hard edges,
and shifted by octaves as needed. A candidate is dropped only if no octave
of it fits the hard range at all (only possible with a sub-octave range).

## 3. Scoring (`src/scoring.ts`) — 13 components

Each candidate gets a score 0-1 (usually) on each of:

| Name | What it measures |
|---|---|
| `chordFit` | Is this pitch an actual chord tone right now? |
| `scaleFit` | Is this pitch diatonic to the given key? |
| `consonance` | Interval-class consonance vs. the melody (unison/3rd/6th high, 2nd/tritone/7th low) — a fixed lookup table by pitch-class distance. |
| `voiceLeading` | Leap size from the *previous harmony note*, plus a penalty (×0.4) for parallel perfect fifths/octaves with the melody (a classical voice-leading fault, detected by comparing motion direction and interval quality between consecutive notes). |
| `singability` | Leap size again, tuned as a distinct curve from voiceLeading (this one is about "is this an easy vocal line to sing", not "is this technically correct voice leading"). |
| `range` | Distance from the comfortable vocal band. |
| `independence` | Rewards contrary/oblique motion against the melody; penalizes parallel motion (a harmony line that never has its own contour isn't very "duet"). |
| `tensionResolution` | For a non-chord tone, checks whether it sits a step away from a tone of the *next* chord (an approximation — see `AGENTS.md` §9 for its known limitation). |
| `sectionAppropriateness` | Does this candidate's relation category match the section's `ArrangementInstruction` (see §4)? |
| `repetitionBalance` | Penalizes repeating the same relation too many times in the last 4 notes. |
| `styleMatch` | Looks up the active style's `relationPreference` table (e.g. Dramatic weights `octaveAbove` far higher than Clean Pop does). |
| `duetInterest` | Rewards distinctly "duet" techniques (counter-melody, purposeful rest, common tone) over defaulting to plain thirds every time. |
| `phraseShape` | Looks at the last 3 harmony pitches; penalizes a long monotonic run, rewards at least one direction change (a crude melodic-contour check). |

These combine as a weighted average using the active style's `weights`
(`ScoreWeights` in `types.ts`) — the same 13 numbers, but different per
style, so e.g. Dramatic weights `styleMatch`/`sectionAppropriateness` more
and `singability`/`voiceLeading` less than Clean Pop does.

## 4. Section-level arrangement plans (`src/styles.ts`)

Before scoring individual notes, `planSections(style, sections)` assigns
each `SongSection` an `ArrangementInstruction` (a set of boolean flags:
`harmonyAbove`, `harmonyBelow`, `unison`, `octave`, `rest`, `singTogether`,
`counterMelody`, `callAndResponse`, `sustainedPad`, `delayedEntry`,
`repeatPhrase`) **and** a Korean `reason` string, via a per-style,
per-section-type lookup (`planCleanPop`/`planEmotional`/`planDramatic`/
`planTrueDuet`). This is the mechanism that makes the four styles
*structurally* different — e.g. True Duet's verse plan is
`callAndResponse + delayedEntry`, while Clean Pop's verse plan is a plain
`harmonyBelow` — not just a re-weighted copy of the same algorithm.

`sectionAppropriatenessScore` then rewards candidates whose relation
category matches the active instruction's flags.

## 5. Density and the phrase-level planner (`src/planner.ts`)

Not every note gets a harmony note — that would violate the "don't fill
every section equally" requirement. For each note, an *effective density*
is computed as `section.harmonyDensity × style.sectionDensityMultiplier[section.type]`,
plus a small on-beat bonus, clamped to [0,1]. A seeded `rng()` call (one
per note, not per beam — see below) decides whether to attempt harmonizing
that note at all; if not, the candidate pool for that note is forced to
`[rest]`. This is a hard structural guarantee, not just a scoring nudge:
every style's `sectionDensityMultiplier` table gives `finalChorus` a higher
multiplier than `verse` (asserted directly in `styles.test.ts`), so a
verse-vs-final-chorus density difference is guaranteed by construction, not
left to chance.

Choices are **not** made note-by-note greedily. A beam search (width 6-8
depending on style) carries multiple candidate *sequences* forward,
re-scoring every candidate against each surviving beam's own history
(`recentRelations`, `recentHarmonyPitches`, `lastHarmonyPitch`), and keeps
only the top-scoring sequences at each step. The final arrangement is the
highest-total-score complete sequence. This is what makes
phrase-level effects (repetition avoidance, contour shape, contrary-motion
runs) possible — a purely greedy per-note choice can't see far enough
ahead to avoid, say, four notes of parallel thirds in a row.

## 6. Reproducibility

`createRng(seed)` (mulberry32) is the only source of randomness anywhere in
this package. Same `mainMelody` + `chords` + `sections` + `vocalRange` +
`style` + `seed` always produces a byte-identical `DuetArrangement`
(asserted in `generate.test.ts`). Never use `Math.random()` in this
package.

## 7. Explanation generation (`explainCandidate` in `planner.ts`)

Each harmony note's `styleReason` is a template keyed by the chosen
`relation` (and, for `rest`/`octaveAbove`, the section type), e.g. "가사를
강조하기 위해 유니즌으로 배치했습니다." This is grounded in the actual
decision (which candidate the beam search picked), not decorative text
generated independently — `scoreBreakdown` on the same note contains the
real numbers that produced that choice, so a UI can show both together.

## 8. MIDI export (`src/midi-export.ts`)

A minimal, dependency-free Standard MIDI File writer: 3 tracks (tempo,
melody on channel 0, harmony on channel 1), 480 ticks per beat, format 1.
Rest notes (`generatedPitch: null`) are simply omitted from the harmony
track. See `AGENTS.md` §7 for why this is treated as a stable contract.
