import type { DuetArrangement } from "@duet-maker/shared-types";
import { parseKey } from "./music-theory.js";
import { planHarmonyTrack } from "./planner.js";
import { createRng } from "./rng.js";
import { planSections, STYLE_PROFILES } from "./styles.js";
import type { HarmonyGenerationInput } from "./types.js";

export const HARMONY_CORE_VERSION = "0.1.0";

/**
 * Generates a full second-vocal arrangement for one style. Deterministic:
 * the same input + seed always produces byte-identical output (see
 * rng.ts). Call this once per style to compare Clean Pop / Emotional /
 * Dramatic / True Duet side by side.
 */
export function generateDuetArrangement(input: HarmonyGenerationInput): DuetArrangement {
  const key = parseKey(input.key);
  const style = STYLE_PROFILES[input.style];
  const sectionPlans = planSections(input.style, input.sections);
  const instructionsBySectionId = new Map(
    sectionPlans.map((plan) => [plan.sectionId, plan.instruction]),
  );
  const rng = createRng(input.seed);

  const planResult = planHarmonyTrack({
    melody: input.mainMelody,
    chords: input.chords,
    sections: input.sections,
    key,
    vocalRange: input.vocalRange,
    instructionsBySectionId,
    style,
    rng,
  });

  return {
    sourceMelody: input.mainMelody,
    harmonyTrack: planResult.harmonyTrack,
    sectionPlans,
    style: input.style,
    overallScore: planResult.overallScore,
    scoreBreakdown: planResult.scoreBreakdown,
    warnings: planResult.warnings,
    generationVersion: HARMONY_CORE_VERSION,
    randomSeed: input.seed,
  };
}
