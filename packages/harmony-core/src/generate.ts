import type { DuetArrangement } from "@duet-maker/shared-types";
import type { HarmonyCandidate } from "./candidates.js";
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

export interface RegenerateSectionInput extends HarmonyGenerationInput {
  /** The arrangement to keep everything outside the target section from. */
  previousArrangement: DuetArrangement;
  /** Must be one of `input.sections[].id`. */
  sectionId: string;
}

/**
 * Re-decides the harmony only for melody notes that fall inside one
 * section, keeping every other note's pitch/relation/chordRole exactly as
 * they were in `previousArrangement` — so regenerating a verse doesn't
 * also reshuffle the chorus. A locked note's `scoreBreakdown`/`styleReason`
 * still get recomputed against the *current* chord/section/instruction
 * context (so they stay accurate if chords changed since the last full
 * generation), but its pitch is never reconsidered.
 *
 * Continuity is two-sided: the first regenerated note sees the real
 * `prevHarmonyPitch` from the (locked) note just before the section, so
 * the entry into the section voice-leads naturally, and the last
 * regenerated note also sees the (locked) `nextHarmonyPitch` just after
 * the section via `ScoringContext.nextHarmonyPitch`, so the seam *out*
 * factors into its own scoring too — not just a coincidence of whichever
 * candidate happened to win on other grounds. This is one step of
 * lookahead (only the note *immediately* after a fixed boundary), not a
 * full two-pass reconciliation; see docs/DECISIONS.md.
 *
 * Throws if `sectionId` doesn't match any section in `input.sections`.
 */
export function regenerateSection(input: RegenerateSectionInput): DuetArrangement {
  const targetSection = input.sections.find((s) => s.id === input.sectionId);
  if (!targetSection) {
    throw new Error(`구간을 찾을 수 없습니다: ${input.sectionId}`);
  }

  const key = parseKey(input.key);
  const style = STYLE_PROFILES[input.style];
  const sectionPlans = planSections(input.style, input.sections);
  const instructionsBySectionId = new Map(
    sectionPlans.map((plan) => [plan.sectionId, plan.instruction]),
  );
  const rng = createRng(input.seed);

  const melodyById = new Map(input.mainMelody.map((n) => [n.id, n]));
  const fixedChoices = new Map<string, HarmonyCandidate>();
  for (const h of input.previousArrangement.harmonyTrack) {
    const note = melodyById.get(h.originalNoteId);
    if (!note) continue; // note no longer exists — nothing to fix it to.
    const inTargetSection = note.startTime >= targetSection.startTime && note.startTime < targetSection.endTime;
    if (inTargetSection) continue; // this is exactly what we want to re-decide.
    fixedChoices.set(h.originalNoteId, {
      pitch: h.generatedPitch,
      relation: h.relationToMelody,
      chordRole: h.generatedPitch === null ? null : h.chordRole,
    });
  }

  const planResult = planHarmonyTrack({
    melody: input.mainMelody,
    chords: input.chords,
    sections: input.sections,
    key,
    vocalRange: input.vocalRange,
    instructionsBySectionId,
    style,
    rng,
    fixedChoices,
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
