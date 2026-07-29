import { z } from "zod";

/**
 * Where a NoteEvent's pitch/timing originally came from. Kept on every note so
 * downstream code (and other coding agents) can tell an edited-by-hand note
 * from a machine-generated one without a side channel.
 */
export const noteSourceSchema = z.enum([
  "user-input",
  "midi-import",
  "musicxml-import",
  "pitch-detection",
  "generated",
]);
export type NoteSource = z.infer<typeof noteSourceSchema>;

/**
 * A single melody note. Timing is expressed in beats (quarter notes) from the
 * start of the song, not seconds — see docs/DATA_FORMATS.md for the rationale
 * (BPM-independent piano-roll math, matches MIDI/MusicXML tick semantics).
 */
export const noteEventSchema = z.object({
  id: z.string().min(1),
  /** MIDI note number, 0-127 (60 = middle C). */
  pitch: z.number().int().min(0).max(127),
  /** Beats from song start. */
  startTime: z.number().min(0),
  /** Length in beats. Must be positive. */
  duration: z.number().positive(),
  /** MIDI velocity, 0-127. */
  velocity: z.number().int().min(0).max(127),
  lyric: z.string().optional(),
  /** 0 (guess) to 1 (certain). 1 for user-entered/imported notes. */
  confidence: z.number().min(0).max(1),
  source: noteSourceSchema,
  /** Whether the user is allowed to drag/resize/delete this note in the UI. */
  editable: z.boolean(),
});
export type NoteEvent = z.infer<typeof noteEventSchema>;
