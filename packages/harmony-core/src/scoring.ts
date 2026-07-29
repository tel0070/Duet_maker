import type {
  ArrangementInstruction,
  ChordEvent,
  MotionType,
  RelationToMelody,
  VocalRange,
} from "@duet-maker/shared-types";
import type { HarmonyCandidate } from "./candidates.js";
import { chordTones, intervalClass, isDiatonic, type Key } from "./music-theory.js";
import type { ScoreWeights } from "./types.js";

export interface ScoringContext {
  melodyPitch: number;
  prevMelodyPitch: number | null;
  chord: ChordEvent | null;
  nextChord: ChordEvent | null;
  key: Key;
  vocalRange: VocalRange;
  prevHarmonyPitch: number | null;
  /**
   * The harmony pitch already locked in for the *next* melody note, when
   * known — only non-null when that note is a fixed choice from
   * `regenerateSection` (see `planHarmonyTrack`'s `fixedChoices`). `null`
   * during an ordinary full generation, where the next note hasn't been
   * decided yet. Lets `voiceLeadingScore` consider the seam *out* of a
   * regenerated section, not just the seam *in*.
   */
  nextHarmonyPitch: number | null;
  /** The next melody note's pitch, paired with `nextHarmonyPitch` for the
   * same parallel-fifths/octaves check the backward direction gets. */
  nextMelodyPitch: number | null;
  recentRelations: RelationToMelody[];
  recentHarmonyPitches: number[];
  instruction: ArrangementInstruction;
  relationPreference: Partial<Record<RelationToMelody, number>>;
}

function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

export function computeMotionType(
  prevMelodyPitch: number | null,
  melodyPitch: number,
  prevHarmonyPitch: number | null,
  candidatePitch: number | null,
): MotionType {
  if (candidatePitch === null || prevHarmonyPitch === null) return "none";
  const melodyDir = prevMelodyPitch === null ? 0 : sign(melodyPitch - prevMelodyPitch);
  const harmonyDir = sign(candidatePitch - prevHarmonyPitch);
  if (melodyDir === 0 && harmonyDir === 0) return "static";
  if (melodyDir === 0 || harmonyDir === 0) return "oblique";
  if (melodyDir === harmonyDir) return "parallel";
  return "contrary";
}

const CONSONANCE_BY_INTERVAL_CLASS = [1.0, 0.1, 0.2, 0.95, 0.95, 0.85, 0.05];

function chordFitScore(candidate: HarmonyCandidate): number {
  if (candidate.pitch === null) return 0.5;
  if (candidate.chordRole && candidate.chordRole !== "nonChordTone") return 1;
  return 0.15;
}

function scaleFitScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.5;
  return isDiatonic(candidate.pitch, ctx.key) ? 1 : 0.2;
}

function consonanceScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.6;
  const ic = intervalClass(candidate.pitch, ctx.melodyPitch);
  return CONSONANCE_BY_INTERVAL_CLASS[ic] ?? 0.2;
}

function leapToScore(leap: number, table: number[]): number {
  const idx = leap === 0 ? 0 : leap <= 2 ? 1 : leap <= 4 ? 2 : leap <= 7 ? 3 : leap <= 12 ? 4 : 5;
  return table[idx] ?? 0.05;
}

function isPerfectInterval(semitones: number): boolean {
  const mod = ((semitones % 12) + 12) % 12;
  return mod === 0 || mod === 7;
}

/**
 * Scores how well `pitch` connects to a neighboring harmony pitch (leap
 * size + a parallel-fifths/octaves check), independent of which direction
 * (backward to the previous note, or forward to a locked next note)
 * that neighbor is in — `voiceLeadingScore` calls this once per known
 * direction and blends the results.
 */
function directionalVoiceLeadingScore(
  pitch: number,
  melodyPitch: number,
  neighborHarmonyPitch: number | null,
  neighborMelodyPitch: number | null,
): number {
  if (neighborHarmonyPitch === null) return 0.8;
  const leap = Math.abs(pitch - neighborHarmonyPitch);
  let score = leapToScore(leap, [0.9, 1.0, 0.8, 0.6, 0.35, 0.1]);

  if (neighborMelodyPitch !== null) {
    const melodyMoved = melodyPitch !== neighborMelodyPitch;
    const harmonyMoved = pitch !== neighborHarmonyPitch;
    const sameDirection =
      melodyMoved &&
      harmonyMoved &&
      sign(melodyPitch - neighborMelodyPitch) === sign(pitch - neighborHarmonyPitch);
    const currentInterval = pitch - melodyPitch;
    const neighborInterval = neighborHarmonyPitch - neighborMelodyPitch;
    if (
      sameDirection &&
      isPerfectInterval(currentInterval) &&
      isPerfectInterval(neighborInterval)
    ) {
      // Parallel fifths/octaves — a classical voice-leading fault.
      score *= 0.4;
    }
  }
  return score;
}

function voiceLeadingScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.6;
  const backward = directionalVoiceLeadingScore(candidate.pitch, ctx.melodyPitch, ctx.prevHarmonyPitch, ctx.prevMelodyPitch);
  if (ctx.nextHarmonyPitch === null) return backward;
  // A locked note right after this one (regenerateSection) — blend in how
  // smoothly this candidate leads into it, so the seam *out* of a
  // regenerated section gets the same consideration as the seam *in*.
  const forward = directionalVoiceLeadingScore(candidate.pitch, ctx.melodyPitch, ctx.nextHarmonyPitch, ctx.nextMelodyPitch);
  return (backward + forward) / 2;
}

function singabilityScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.7;
  if (ctx.prevHarmonyPitch === null) return 0.8;
  const leap = Math.abs(candidate.pitch - ctx.prevHarmonyPitch);
  return leapToScore(leap, [0.9, 1.0, 0.85, 0.6, 0.3, 0.05]);
}

function rangeScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 1;
  const { comfortableLow, comfortableHigh, lowestPitch, highestPitch } = ctx.vocalRange;
  if (candidate.pitch >= comfortableLow && candidate.pitch <= comfortableHigh) return 1;
  const distance =
    candidate.pitch < comfortableLow
      ? comfortableLow - candidate.pitch
      : candidate.pitch - comfortableHigh;
  const halfSpan = Math.max(1, (highestPitch - lowestPitch) / 2);
  return Math.max(0, 1 - distance / halfSpan);
}

function independenceScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  const motion = computeMotionType(ctx.prevMelodyPitch, ctx.melodyPitch, ctx.prevHarmonyPitch, candidate.pitch);
  switch (motion) {
    case "contrary":
      return 1.0;
    case "oblique":
      return 0.7;
    case "parallel":
      return 0.4;
    case "static":
      return 0.5;
    default:
      return 0.6;
  }
}

function tensionResolutionScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.6;
  if (candidate.chordRole && candidate.chordRole !== "nonChordTone") return 0.8;
  if (!ctx.nextChord) return 0.4;
  const nextTones = chordTones(ctx.nextChord);
  const resolvesByStep = nextTones.some((tone) => {
    const below = tone.pitchClass;
    const diff = Math.abs(((candidate.pitch! - below) % 12 + 12) % 12);
    return diff <= 2 || diff >= 10;
  });
  return resolvesByStep ? 0.75 : 0.3;
}

type RelationCategory =
  | "rest"
  | "unisonLike"
  | "octave"
  | "above"
  | "below"
  | "counter"
  | "commonTone"
  | "other";

function categorize(relation: RelationToMelody): RelationCategory {
  switch (relation) {
    case "rest":
      return "rest";
    case "unison":
      return "unisonLike";
    case "octaveAbove":
    case "octaveBelow":
      return "octave";
    case "thirdAbove":
    case "fourthAbove":
    case "fifthAbove":
    case "sixthAbove":
      return "above";
    case "thirdBelow":
    case "fourthBelow":
    case "fifthBelow":
    case "sixthBelow":
      return "below";
    case "counterMelody":
      return "counter";
    case "commonTone":
      return "commonTone";
    default:
      return "other";
  }
}

function sectionAppropriatenessScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  const instr = ctx.instruction;
  const category = categorize(candidate.relation);
  const matches: Record<RelationCategory, boolean> = {
    rest: instr.rest,
    unisonLike: instr.unison || instr.singTogether,
    octave: instr.octave,
    above: instr.harmonyAbove,
    below: instr.harmonyBelow,
    counter: instr.counterMelody || instr.callAndResponse,
    commonTone: instr.sustainedPad || instr.harmonyBelow || instr.harmonyAbove,
    other: false,
  };
  if (matches[category]) return 1.0;
  if (instr.rest && candidate.pitch !== null) return 0.1;
  return 0.3;
}

function repetitionBalanceScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  const window = ctx.recentRelations.slice(-4);
  const repeats = window.filter((r) => r === candidate.relation).length;
  return Math.max(0.1, 1 - 0.25 * repeats);
}

function styleMatchScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  const preference = ctx.relationPreference[candidate.relation] ?? 1.0;
  return Math.min(1, preference / 1.5);
}

function duetInterestScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  switch (candidate.relation) {
    case "counterMelody":
      return 1.0;
    case "commonTone":
      return 0.8;
    case "rest":
      return ctx.instruction.rest ? 0.7 : 0.4;
    case "unison":
      return ctx.instruction.singTogether ? 0.85 : 0.5;
    case "octaveAbove":
    case "octaveBelow":
      return 0.7;
    default:
      return 0.5;
  }
}

function phraseShapeScore(candidate: HarmonyCandidate, ctx: ScoringContext): number {
  if (candidate.pitch === null) return 0.6;
  const recent = ctx.recentHarmonyPitches.slice(-3);
  if (recent.length < 2) return 0.7;
  const points = [...recent, candidate.pitch];
  const directions: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    directions.push(sign(points[i]! - points[i - 1]!));
  }
  const nonZero = directions.filter((d) => d !== 0);
  if (nonZero.length >= 3 && nonZero.every((d) => d === nonZero[0])) return 0.4;
  const hasChange = nonZero.some((d, i) => i > 0 && d !== nonZero[i - 1]);
  return hasChange ? 0.9 : 0.6;
}

export interface ScoredCandidate {
  candidate: HarmonyCandidate;
  total: number;
  breakdown: Record<keyof ScoreWeights, number>;
}

export function scoreCandidate(
  candidate: HarmonyCandidate,
  ctx: ScoringContext,
  weights: ScoreWeights,
): ScoredCandidate {
  const breakdown: Record<keyof ScoreWeights, number> = {
    chordFit: chordFitScore(candidate),
    scaleFit: scaleFitScore(candidate, ctx),
    consonance: consonanceScore(candidate, ctx),
    voiceLeading: voiceLeadingScore(candidate, ctx),
    singability: singabilityScore(candidate, ctx),
    range: rangeScore(candidate, ctx),
    independence: independenceScore(candidate, ctx),
    tensionResolution: tensionResolutionScore(candidate, ctx),
    sectionAppropriateness: sectionAppropriatenessScore(candidate, ctx),
    repetitionBalance: repetitionBalanceScore(candidate, ctx),
    styleMatch: styleMatchScore(candidate, ctx),
    duetInterest: duetInterestScore(candidate, ctx),
    phraseShape: phraseShapeScore(candidate, ctx),
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(breakdown) as Array<keyof ScoreWeights>) {
    weightedSum += breakdown[key] * weights[key];
    weightTotal += weights[key];
  }
  const total = weightTotal > 0 ? weightedSum / weightTotal : 0;

  return { candidate, total, breakdown };
}
