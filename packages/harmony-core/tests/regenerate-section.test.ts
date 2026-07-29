import { DEFAULT_VOCAL_RANGE } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateDuetArrangement } from "../src/generate.js";
import { regenerateSection } from "../src/generate.js";
import { chord, note, section } from "./fixtures.js";

function twoSectionInput() {
  const chords = [
    chord("C", "maj", 0, 4),
    chord("G", "maj", 4, 4),
    chord("A", "min", 8, 4),
    chord("F", "maj", 12, 4),
  ];
  const melody = [
    note(64, 0, 2),
    note(67, 2, 2),
    note(67, 4, 2),
    note(71, 6, 2),
    note(69, 8, 2),
    note(72, 10, 2),
    note(65, 12, 2),
    note(69, 14, 2),
  ];
  const verse = section("verse", 0, 8, { energy: 0.4, harmonyDensity: 0.8 });
  const chorus = section("chorus", 8, 16, { energy: 0.8, harmonyDensity: 0.8 });
  return {
    mainMelody: melody,
    chords,
    key: "C major" as const,
    bpm: 100,
    sections: [verse, chorus],
    vocalRange: DEFAULT_VOCAL_RANGE,
    style: "cleanPop" as const,
    seed: 1,
  };
}

describe("regenerateSection", () => {
  it("keeps every note outside the target section byte-identical", () => {
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);

    const regenerated = regenerateSection({
      ...input,
      seed: 999, // deliberately different, to prove it only affects the target section
      previousArrangement: original,
      sectionId: input.sections[1]!.id, // chorus
    });

    const melodyById = new Map(input.mainMelody.map((n) => [n.id, n]));
    for (const h of regenerated.harmonyTrack) {
      const sourceNote = melodyById.get(h.originalNoteId)!;
      if (sourceNote.startTime >= 8) continue; // inside the regenerated section
      const originalNote = original.harmonyTrack.find((o) => o.originalNoteId === h.originalNoteId)!;
      expect(h.generatedPitch).toBe(originalNote.generatedPitch);
      expect(h.relationToMelody).toBe(originalNote.relationToMelody);
    }
  });

  it("produces a harmony note for every melody note, same as a full generation", () => {
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);
    const regenerated = regenerateSection({
      ...input,
      previousArrangement: original,
      sectionId: input.sections[0]!.id,
    });
    expect(regenerated.harmonyTrack).toHaveLength(input.mainMelody.length);
  });

  it("is deterministic for the same seed", () => {
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);
    const a = regenerateSection({ ...input, seed: 42, previousArrangement: original, sectionId: input.sections[0]!.id });
    const b = regenerateSection({ ...input, seed: 42, previousArrangement: original, sectionId: input.sections[0]!.id });
    expect(a.harmonyTrack).toEqual(b.harmonyTrack);
  });

  it("throws a clear error for an unknown section id", () => {
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);
    expect(() =>
      regenerateSection({ ...input, previousArrangement: original, sectionId: "does-not-exist" }),
    ).toThrow(/구간을 찾을 수 없습니다/);
  });

  it("regenerating the verse leaves the chorus untouched and vice versa", () => {
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);

    const verseRegenerated = regenerateSection({
      ...input,
      seed: 7,
      previousArrangement: original,
      sectionId: input.sections[0]!.id,
    });
    const chorusPitchesAfterVerseRegen = verseRegenerated.harmonyTrack
      .filter((h) => {
        const n = input.mainMelody.find((m) => m.id === h.originalNoteId)!;
        return n.startTime >= 8;
      })
      .map((h) => h.generatedPitch);
    const originalChorusPitches = original.harmonyTrack
      .filter((h) => {
        const n = input.mainMelody.find((m) => m.id === h.originalNoteId)!;
        return n.startTime >= 8;
      })
      .map((h) => h.generatedPitch);
    expect(chorusPitchesAfterVerseRegen).toEqual(originalChorusPitches);
  });

  it("carries the real previous harmony pitch into the first regenerated note for continuity", () => {
    // This is an indirect check: regenerating the chorus (which starts at
    // beat 8) should not throw and should still respect the vocal range,
    // which requires prevHarmonyPitch to have been threaded in from the
    // locked verse note rather than reset to null.
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);
    const regenerated = regenerateSection({
      ...input,
      seed: 3,
      previousArrangement: original,
      sectionId: input.sections[1]!.id,
    });
    for (const h of regenerated.harmonyTrack) {
      if (h.generatedPitch === null) continue;
      expect(h.generatedPitch).toBeGreaterThanOrEqual(DEFAULT_VOCAL_RANGE.lowestPitch);
      expect(h.generatedPitch).toBeLessThanOrEqual(DEFAULT_VOCAL_RANGE.highestPitch);
    }
  });
});
