import { z } from "zod";

export const voiceTypeSchema = z.enum([
  "soprano",
  "mezzoSoprano",
  "alto",
  "tenor",
  "baritone",
  "bass",
  "unspecified",
]);
export type VoiceType = z.infer<typeof voiceTypeSchema>;

/**
 * comfortableLow/High should sit inside lowestPitch/highestPitch — the
 * generator prefers the comfortable band and only uses the outer band under
 * pressure (e.g. a dramatic octave leap), scored down as it approaches the
 * hard edges.
 */
export const vocalRangeSchema = z
  .object({
    lowestPitch: z.number().int().min(0).max(127),
    highestPitch: z.number().int().min(0).max(127),
    comfortableLow: z.number().int().min(0).max(127),
    comfortableHigh: z.number().int().min(0).max(127),
    voiceType: voiceTypeSchema,
  })
  .refine((r) => r.lowestPitch <= r.comfortableLow, {
    message: "comfortableLow must be within [lowestPitch, highestPitch]",
    path: ["comfortableLow"],
  })
  .refine((r) => r.comfortableHigh <= r.highestPitch, {
    message: "comfortableHigh must be within [lowestPitch, highestPitch]",
    path: ["comfortableHigh"],
  })
  .refine((r) => r.comfortableLow <= r.comfortableHigh, {
    message: "comfortableLow must be <= comfortableHigh",
    path: ["comfortableLow"],
  })
  .refine((r) => r.lowestPitch <= r.highestPitch, {
    message: "lowestPitch must be <= highestPitch",
    path: ["lowestPitch"],
  });
export type VocalRange = z.infer<typeof vocalRangeSchema>;

/** Reasonable defaults, roughly a comfortable pop mid-range (MIDI note numbers). */
export const DEFAULT_VOCAL_RANGE: VocalRange = {
  lowestPitch: 45, // A2
  highestPitch: 74, // D5
  comfortableLow: 52, // E3
  comfortableHigh: 69, // A4
  voiceType: "unspecified",
};
