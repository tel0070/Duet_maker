import { z } from "zod";

export const relationToMelodySchema = z.enum([
  "unison",
  "thirdAbove",
  "thirdBelow",
  "fourthAbove",
  "fourthBelow",
  "fifthAbove",
  "fifthBelow",
  "sixthAbove",
  "sixthBelow",
  "octaveAbove",
  "octaveBelow",
  "commonTone",
  "counterMelody",
  "rest",
  "custom",
]);
export type RelationToMelody = z.infer<typeof relationToMelodySchema>;

export const chordRoleSchema = z.enum([
  "root",
  "third",
  "fifth",
  "seventh",
  "ninth",
  "eleventh",
  "thirteenth",
  "nonChordTone",
]);
export type ChordRole = z.infer<typeof chordRoleSchema>;

export const motionTypeSchema = z.enum([
  "parallel",
  "similar",
  "oblique",
  "contrary",
  "static",
  "none",
]);
export type MotionType = z.infer<typeof motionTypeSchema>;

/**
 * One generated second-vocal note, always tied back to the main-melody note
 * it was derived from (`originalNoteId`) so edits and re-generation stay
 * aligned to the source melody. `generatedPitch: null` means the second
 * vocal rests here.
 */
export const harmonyNoteSchema = z.object({
  originalNoteId: z.string().min(1),
  generatedPitch: z.number().int().min(0).max(127).nullable(),
  relationToMelody: relationToMelodySchema,
  chordRole: chordRoleSchema,
  motionType: motionTypeSchema,
  /** Human-readable (Korean, UI-facing) explanation of why this note was chosen. */
  styleReason: z.string(),
  /** Named score components that summed/weighted into this note's selection. */
  scoreBreakdown: z.record(z.string(), z.number()),
  confidence: z.number().min(0).max(1),
});
export type HarmonyNote = z.infer<typeof harmonyNoteSchema>;
