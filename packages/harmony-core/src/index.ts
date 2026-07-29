export {
  generateDuetArrangement,
  regenerateSection,
  HARMONY_CORE_VERSION,
  type RegenerateSectionInput,
} from "./generate.js";
export { exportArrangementToMidi, TICKS_PER_BEAT } from "./midi-export.js";
export { importMelodyFromMidi } from "./midi-import.js";
export { STYLE_PROFILES, planSections } from "./styles.js";
export { createRng, type Rng } from "./rng.js";
export {
  parseKey,
  scalePitchClasses,
  isDiatonic,
  chordTones,
  noteNameToPitchClass,
  clampToVocalRange,
  type Key,
} from "./music-theory.js";
export { generateCandidates, type HarmonyCandidate } from "./candidates.js";
export { scoreCandidate, computeMotionType, type ScoringContext, type ScoredCandidate } from "./scoring.js";
export { planHarmonyTrack } from "./planner.js";
export type { HarmonyGenerationInput, ScoreWeights, StyleProfile, SectionPlan } from "./types.js";
