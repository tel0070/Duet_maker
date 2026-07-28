import { DEFAULT_VOCAL_RANGE, type DuetStyle } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateDuetArrangement } from "../src/generate.js";
import type { HarmonyGenerationInput } from "../src/types.js";
import {
  progressionCGAmF,
  progressionClimbingFinalChorus,
  progressionFastChordChanges,
  progressionFastNotes,
  progressionIiVI,
  progressionLongSustain,
  progressionMinorBallad,
  progressionRestHeavyPhrase,
  progressionViIvIV,
} from "./fixtures.js";

const SCENARIOS: Array<{
  name: string;
  build: () => ReturnType<typeof progressionCGAmF>;
  key: string;
}> = [
  { name: "C-G-Am-F", build: progressionCGAmF, key: "C major" },
  { name: "vi-IV-I-V", build: progressionViIvIV, key: "C major" },
  { name: "ii-V-I", build: progressionIiVI, key: "C major" },
  { name: "minor ballad", build: progressionMinorBallad, key: "A minor" },
  { name: "fast chord changes", build: progressionFastChordChanges, key: "C major" },
  { name: "climbing final chorus", build: progressionClimbingFinalChorus, key: "C major" },
  { name: "long sustain", build: progressionLongSustain, key: "C major" },
  { name: "fast notes", build: progressionFastNotes, key: "C major" },
  { name: "rest-heavy phrase", build: progressionRestHeavyPhrase, key: "C major" },
];

const STYLES: DuetStyle[] = ["cleanPop", "emotional", "dramatic", "trueDuet"];

describe("scenario tests — standard progressions", () => {
  for (const scenario of SCENARIOS) {
    for (const style of STYLES) {
      it(`${scenario.name} / ${style}: generates a valid, in-range arrangement`, () => {
        const { chords, melody, sections } = scenario.build();
        const input: HarmonyGenerationInput = {
          mainMelody: melody,
          chords,
          key: scenario.key,
          bpm: 100,
          sections,
          vocalRange: DEFAULT_VOCAL_RANGE,
          style,
          seed: 123,
        };
        const arrangement = generateDuetArrangement(input);

        expect(arrangement.harmonyTrack.length).toBe(melody.length);
        for (const h of arrangement.harmonyTrack) {
          if (h.generatedPitch === null) continue;
          expect(h.generatedPitch).toBeGreaterThanOrEqual(DEFAULT_VOCAL_RANGE.lowestPitch);
          expect(h.generatedPitch).toBeLessThanOrEqual(DEFAULT_VOCAL_RANGE.highestPitch);
        }
        expect(Number.isFinite(arrangement.overallScore)).toBe(true);
      });
    }
  }

  it("keeps the long-sustain note's harmony note tied to that single melody note", () => {
    const { chords, melody, sections } = progressionLongSustain();
    const arrangement = generateDuetArrangement({
      mainMelody: melody,
      chords,
      key: "C major",
      bpm: 100,
      sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      style: "cleanPop",
      seed: 1,
    });
    expect(arrangement.harmonyTrack).toHaveLength(1);
    expect(arrangement.harmonyTrack[0]!.originalNoteId).toBe(melody[0]!.id);
  });

  it("handles a rest-heavy melody without crashing and keeps per-note explanations", () => {
    const { chords, melody, sections } = progressionRestHeavyPhrase();
    const arrangement = generateDuetArrangement({
      mainMelody: melody,
      chords,
      key: "C major",
      bpm: 100,
      sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      style: "emotional",
      seed: 1,
    });
    expect(arrangement.harmonyTrack).toHaveLength(melody.length);
    expect(arrangement.harmonyTrack.every((h) => h.styleReason.length > 0)).toBe(true);
  });
});
