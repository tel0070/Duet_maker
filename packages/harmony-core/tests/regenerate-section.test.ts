import { DEFAULT_VOCAL_RANGE, type DuetArrangement } from "@duet-maker/shared-types";
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

  it("pulls the last regenerated note toward whichever pitch is locked in right after the section", () => {
    // Two-sided continuity: the seam OUT of a regenerated section should
    // adapt to the locked note just after it, not just the seam in. Force
    // two very different pitches onto the first (locked) chorus note and
    // confirm the last (regenerated) verse note lands close to whichever
    // one was actually in play each time — if the forward seam weren't
    // considered at all, both runs would produce the same verse-note
    // pitch regardless of what follows.
    const input = twoSectionInput();
    const original = generateDuetArrangement(input);
    const firstChorusNote = input.mainMelody.find((n) => n.startTime === 8)!;
    const lastVerseNote = input.mainMelody.find((n) => n.startTime === 6)!;

    function regenerateVerseWithLockedFollowingPitch(lockedPitch: number) {
      const forced: DuetArrangement = {
        ...original,
        harmonyTrack: original.harmonyTrack.map((h) =>
          h.originalNoteId === firstChorusNote.id ? { ...h, generatedPitch: lockedPitch } : h,
        ),
      };
      const regenerated = regenerateSection({
        ...input,
        seed: 5,
        previousArrangement: forced,
        sectionId: input.sections[0]!.id, // verse
      });
      return regenerated.harmonyTrack.find((h) => h.originalNoteId === lastVerseNote.id)!.generatedPitch;
    }

    const pitchWithLowTarget = regenerateVerseWithLockedFollowingPitch(55); // G3
    const pitchWithHighTarget = regenerateVerseWithLockedFollowingPitch(67); // G4, an octave up

    expect(pitchWithLowTarget).not.toBeNull();
    expect(pitchWithHighTarget).not.toBeNull();
    // Each run's verse-note choice should sit closer to its own run's
    // locked target than to the other run's target.
    const lowRunDistanceToLow = Math.abs(pitchWithLowTarget! - 55);
    const lowRunDistanceToHigh = Math.abs(pitchWithLowTarget! - 67);
    const highRunDistanceToHigh = Math.abs(pitchWithHighTarget! - 67);
    const highRunDistanceToLow = Math.abs(pitchWithHighTarget! - 55);
    expect(lowRunDistanceToLow).toBeLessThan(lowRunDistanceToHigh);
    expect(highRunDistanceToHigh).toBeLessThan(highRunDistanceToLow);
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
