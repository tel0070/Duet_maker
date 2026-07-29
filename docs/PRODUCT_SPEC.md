# PRODUCT_SPEC.md

## What this is

A web tool: upload or enter a solo melody + chord progression, generate a
second vocal part in one of four styles, review/edit it, export MIDI. No
login, no server upload of user content.

## What this is not (at least not yet)

- Not an AI singing-voice synthesizer. Output today is MIDI-level pitch
  data, meant to be previewed with a piano/synth/hum guide sound or a
  user's own recording — not a finished vocal track.
- Not a fixed-interval "harmonizer" plugin. See `docs/HARMONY_RULES.md`.
- Not a full DAW. Editing scope is deliberately narrow: the main melody,
  the chord progression, section boundaries, and the generated second
  vocal.

## MVP scope (Phase 1, done) vs. full product

| | Phase 1 MVP (done) | Eventual full product |
|---|---|---|
| Input | MIDI-shaped melody + chords + key/BPM + sections + vocal range, all as structured data | + audio upload, + auto-detected melody/chords/sections |
| Output | 4 styles of `DuetArrangement` + MIDI export | + piano/synth/hum playback, + user recording, + natural singing synthesis (optional adapter) |
| Editing | None (Phase 1 didn't include a UI) | Full piano-roll editing, section-level regenerate commands |
| Persistence | None | IndexedDB autosave, JSON project export/import |

## Target user

Someone with a solo vocal recording or MIDI melody who wants a plausible
second harmony/duet part without hiring an arranger or already knowing
voice-leading theory. Explanations (`styleReason` on every generated note)
exist specifically so a non-expert can learn *why* a choice was made, not
just receive an opaque result.

## The four styles, as a product concept

- **Clean Pop** — safe, singable, mostly thirds/sixths, chorus-forward
  density. The "just make it sound nice" default.
- **Emotional** — lower harmonies, common-tone holds, suspensions/resolves,
  sparse verses, ballad-appropriate.
- **Dramatic** — wide intervals (octaves, fifths), big final-chorus payoff,
  large dynamic range between sparse and dense sections.
- **True Duet** — alternating call-and-response, counter-melody, unison
  moments, phrases that read as two independent singers rather than one
  voice plus harmony.

These differ structurally (different per-section arrangement instructions
in `packages/harmony-core/src/styles.ts`), not just by weight tuning — this
was a specific, testable requirement (see
`packages/harmony-core/tests/styles.test.ts` and `generate.test.ts`).

## Explainability as a product requirement

Every non-rest harmony note carries a Korean, UI-facing `styleReason` and a
`scoreBreakdown` (the actual numeric scores that were computed, not
decorative text). This is load-bearing for the target user — see
`docs/HARMONY_RULES.md` §5 for how the explanation text is generated.

## Explicit non-goals for now

- Multi-user collaboration, sharing, or cloud accounts.
- Commercial distribution features (this is a personal creative tool — see
  the license notice in `README.md`).
- Real-time collaborative editing.
