import { z } from "zod";

export const pitchClassSchema = z.enum([
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
]);
export type PitchClass = z.infer<typeof pitchClassSchema>;

/** Triad/seventh quality. Extensions (9/11/13, alterations) are layered on
 * top via `extensions` rather than exploding this enum combinatorially. */
export const chordQualitySchema = z.enum([
  "maj",
  "min",
  "dim",
  "aug",
  "maj7",
  "min7",
  "dom7",
  "m7b5",
  "dim7",
  "sus2",
  "sus4",
  "five", // power chord / root+fifth only, common in rock demos
]);
export type ChordQuality = z.infer<typeof chordQualitySchema>;

export const chordSourceSchema = z.enum([
  "user-input",
  "chord-detection",
  "generated",
]);
export type ChordSource = z.infer<typeof chordSourceSchema>;

export const chordEventSchema = z.object({
  id: z.string().min(1),
  root: pitchClassSchema,
  quality: chordQualitySchema,
  /** e.g. ["9"], ["11", "13"], ["b9"]. Free-form but validated non-empty strings. */
  extensions: z.array(z.string().min(1)).default([]),
  /** Slash-chord bass note, e.g. "E" in C/E. */
  bass: pitchClassSchema.optional(),
  startTime: z.number().min(0),
  duration: z.number().positive(),
  confidence: z.number().min(0).max(1),
  source: chordSourceSchema,
});
export type ChordEvent = z.infer<typeof chordEventSchema>;
