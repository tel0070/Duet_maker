import { z } from "zod";
import { harmonyNoteSchema } from "./harmony-note.js";
import { noteEventSchema } from "./note-event.js";

export const duetStyleSchema = z.enum([
  "cleanPop",
  "emotional",
  "dramatic",
  "trueDuet",
]);
export type DuetStyle = z.infer<typeof duetStyleSchema>;

/**
 * Section-level arrangement directive. This is a set of independent toggles
 * rather than a single enum because a real section plan often combines more
 * than one idea (e.g. `unison` on the last two words plus `sustainedPad`
 * underneath). Mutually-exclusive combinations (e.g. `rest` + `unison`) are
 * rejected by harmony-core's planner, not by this schema — the schema only
 * encodes what shape a plan has, not which combinations are musically valid.
 */
export const arrangementInstructionSchema = z.object({
  singTogether: z.boolean(),
  harmonyAbove: z.boolean(),
  harmonyBelow: z.boolean(),
  unison: z.boolean(),
  octave: z.boolean(),
  rest: z.boolean(),
  callAndResponse: z.boolean(),
  counterMelody: z.boolean(),
  delayedEntry: z.boolean(),
  repeatPhrase: z.boolean(),
  sustainedPad: z.boolean(),
});
export type ArrangementInstruction = z.infer<
  typeof arrangementInstructionSchema
>;

export const ALL_INSTRUCTIONS_OFF: ArrangementInstruction = {
  singTogether: false,
  harmonyAbove: false,
  harmonyBelow: false,
  unison: false,
  octave: false,
  rest: false,
  callAndResponse: false,
  counterMelody: false,
  delayedEntry: false,
  repeatPhrase: false,
  sustainedPad: false,
};

export const sectionPlanSchema = z.object({
  sectionId: z.string().min(1),
  instruction: arrangementInstructionSchema,
  /** Korean, UI-facing explanation of why this plan was chosen for this section. */
  reason: z.string(),
});
export type SectionPlan = z.infer<typeof sectionPlanSchema>;

/**
 * The full output of one generation run: the (unchanged) source melody, the
 * generated second-vocal track, and the per-section plan + scoring that
 * produced it. `randomSeed` + `generationVersion` together make a run
 * reproducible and diffable across harmony-core versions.
 */
export const duetArrangementSchema = z.object({
  sourceMelody: z.array(noteEventSchema),
  harmonyTrack: z.array(harmonyNoteSchema),
  sectionPlans: z.array(sectionPlanSchema),
  style: duetStyleSchema,
  overallScore: z.number(),
  scoreBreakdown: z.record(z.string(), z.number()),
  warnings: z.array(z.string()),
  generationVersion: z.string().min(1),
  randomSeed: z.number().int(),
});
export type DuetArrangement = z.infer<typeof duetArrangementSchema>;
