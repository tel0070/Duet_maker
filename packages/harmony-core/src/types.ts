import type {
  ArrangementInstruction,
  ChordEvent,
  DuetStyle,
  NoteEvent,
  RelationToMelody,
  SectionType,
  SongSection,
  VocalRange,
} from "@duet-maker/shared-types";

/** Normalized input to generateDuetArrangement — see docs/HARMONY_RULES.md §1. */
export interface HarmonyGenerationInput {
  mainMelody: NoteEvent[];
  chords: ChordEvent[];
  /** e.g. "C major", "A minor". */
  key: string;
  bpm: number;
  sections: SongSection[];
  vocalRange: VocalRange;
  style: DuetStyle;
  /** Any integer. Same input + same seed => byte-identical output. */
  seed: number;
}

export interface ScoreWeights {
  chordFit: number;
  scaleFit: number;
  consonance: number;
  voiceLeading: number;
  singability: number;
  range: number;
  independence: number;
  tensionResolution: number;
  sectionAppropriateness: number;
  repetitionBalance: number;
  styleMatch: number;
  duetInterest: number;
  phraseShape: number;
}

export interface StyleProfile {
  id: DuetStyle;
  displayName: string;
  descriptionKo: string;
  weights: ScoreWeights;
  /** Multiplier >1 favors this relation, <1 disfavors it, for this style specifically. */
  relationPreference: Partial<Record<RelationToMelody, number>>;
  /** Multiplies the section's own harmonyDensity for this style. */
  sectionDensityMultiplier: Partial<Record<SectionType, number>>;
  beamWidth: number;
}

export interface SectionPlan {
  sectionId: string;
  instruction: ArrangementInstruction;
  reason: string;
}
