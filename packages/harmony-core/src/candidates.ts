import type { ChordEvent, ChordRole, RelationToMelody } from "@duet-maker/shared-types";
import type { VocalRange } from "@duet-maker/shared-types";
import {
  chordTones,
  clampToVocalRange,
  nearestPitchAtOrAbove,
  nearestPitchAtOrBelow,
  pitchClassOf,
  relationForInterval,
  scalePitchClasses,
  type Key,
} from "./music-theory.js";

export interface HarmonyCandidate {
  pitch: number | null;
  relation: RelationToMelody;
  chordRole: ChordRole | null;
}

export interface CandidateGenerationParams {
  melodyPitch: number;
  chord: ChordEvent | null;
  key: Key;
  vocalRange: VocalRange;
  prevHarmonyPitch: number | null;
}

/**
 * Clamps `pitch` into range and labels it. For chord-tone/octave/unison
 * candidates the label is *recomputed* from the resulting interval
 * (`preserveRelation: false`) — if clamping shifted an "octave above"
 * candidate back down into the melody's own octave, it no longer sounds
 * like an octave and should not claim to be one. Passing-tone candidates
 * (counter-melody) use `preserveRelation: true` because "counterMelody" is
 * a distinct conceptual category, not one of the named-interval relations
 * — recomputing would mislabel a step-wise passing tone as e.g. "custom".
 */
function pushClamped(
  target: HarmonyCandidate[],
  pitch: number,
  relation: RelationToMelody,
  chordRole: ChordRole,
  vocalRange: VocalRange,
  melodyPitch: number,
  preserveRelation = false,
) {
  const clamped = clampToVocalRange(pitch, vocalRange);
  if (clamped === null) return;
  target.push({
    pitch: clamped,
    relation: preserveRelation
      ? relation
      : clamped === melodyPitch
        ? "unison"
        : relationForInterval(melodyPitch, clamped),
    chordRole,
  });
}

/**
 * Generates the raw candidate pool for one melody note: chord tones (above
 * and below), tensions/extensions, unison, octave, a common-tone hold from
 * the previous harmony note, one diatonic passing-tone ("counter melody")
 * option, and rest. Phase 2 of docs/HARMONY_RULES.md.
 */
export function generateCandidates(
  params: CandidateGenerationParams,
): HarmonyCandidate[] {
  const { melodyPitch, chord, key, vocalRange, prevHarmonyPitch } = params;
  const candidates: HarmonyCandidate[] = [];

  const tones = chord
    ? chordTones(chord)
    : scalePitchClasses(key).map((pitchClass) => ({
        pitchClass,
        role: "nonChordTone" as ChordRole,
      }));

  for (const tone of tones) {
    const below = nearestPitchAtOrBelow(tone.pitchClass, melodyPitch);
    const above = nearestPitchAtOrAbove(tone.pitchClass, melodyPitch);
    for (const pitch of new Set([below, above])) {
      pushClamped(candidates, pitch, "custom", tone.role, vocalRange, melodyPitch);
    }
  }

  // Unison: same pitch as melody.
  const melodyPc = pitchClassOf(melodyPitch);
  const melodyToneRole =
    tones.find((t) => t.pitchClass === melodyPc)?.role ?? "nonChordTone";
  pushClamped(candidates, melodyPitch, "unison", melodyToneRole, vocalRange, melodyPitch);

  // Octave above/below.
  pushClamped(candidates, melodyPitch + 12, "octaveAbove", melodyToneRole, vocalRange, melodyPitch);
  pushClamped(candidates, melodyPitch - 12, "octaveBelow", melodyToneRole, vocalRange, melodyPitch);

  // Common tone: hold the previous harmony pitch if it still fits the
  // current chord/scale (encourages sustained inner voices across changes).
  if (prevHarmonyPitch !== null) {
    const prevPc = pitchClassOf(prevHarmonyPitch);
    const matchingTone = tones.find((t) => t.pitchClass === prevPc);
    if (matchingTone) {
      const clamped = clampToVocalRange(prevHarmonyPitch, vocalRange);
      if (clamped !== null) {
        candidates.push({
          pitch: clamped,
          relation: "commonTone",
          chordRole: matchingTone.role,
        });
      }
    }
  }

  // Counter-melody: nearest diatonic scale tones one step away from the
  // melody that are not already chord tones — an independent-contour option.
  const scaleTones = scalePitchClasses(key);
  const chordPcs = new Set(tones.map((t) => t.pitchClass));
  for (const direction of [1, -1] as const) {
    let step = melodyPitch + direction;
    for (let i = 0; i < 12; i += 1, step += direction) {
      const pc = pitchClassOf(step);
      if (scaleTones.includes(pc) && !chordPcs.has(pc)) {
        pushClamped(candidates, step, "counterMelody", "nonChordTone", vocalRange, melodyPitch, true);
        break;
      }
    }
  }

  candidates.push({ pitch: null, relation: "rest", chordRole: null });

  // De-duplicate by (pitch, relation).
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.pitch}|${c.relation}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
