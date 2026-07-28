import { z } from "zod";

export const sectionTypeSchema = z.enum([
  "intro",
  "verse",
  "preChorus",
  "chorus",
  "postChorus",
  "bridge",
  "breakdown",
  "finalChorus",
  "outro",
  "custom",
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const songSectionSchema = z
  .object({
    id: z.string().min(1),
    type: sectionTypeSchema,
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    /** Perceived energy/intensity, 0 (sparse) to 1 (climax). Drives style decisions. */
    energy: z.number().min(0).max(1),
    /** Target proportion of melody notes that get a harmony note, 0 to 1. */
    harmonyDensity: z.number().min(0).max(1),
    label: z.string().optional(),
  })
  .refine((section) => section.endTime > section.startTime, {
    message: "endTime must be greater than startTime",
    path: ["endTime"],
  });
export type SongSection = z.infer<typeof songSectionSchema>;
