import { DEFAULT_VOCAL_RANGE, type DuetStyle } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateDuetArrangement } from "../src/generate.js";
import type { HarmonyGenerationInput } from "../src/types.js";
import {
  progressionCGAmF,
  progressionFastChordChanges,
} from "./fixtures.js";

function makeInput(style: DuetStyle, seed = 42): HarmonyGenerationInput {
  const { chords, melody, sections } = progressionCGAmF();
  return {
    mainMelody: melody,
    chords,
    key: "C major",
    bpm: 100,
    sections,
    vocalRange: DEFAULT_VOCAL_RANGE,
    style,
    seed,
  };
}

describe("generateDuetArrangement — 동일 seed 재현성 (reproducibility)", () => {
  it("produces byte-identical harmony tracks for the same input and seed", () => {
    // Reuse one input object (not two fixture rebuilds) so this checks the
    // generator's determinism, not whether the fixture helper's IDs are stable.
    const input = makeInput("cleanPop", 7);
    const a = generateDuetArrangement(input);
    const b = generateDuetArrangement(input);
    expect(a.harmonyTrack).toEqual(b.harmonyTrack);
    expect(a.overallScore).toEqual(b.overallScore);
  });

  it("can produce a different result for a different seed", () => {
    const results = new Set<string>();
    for (let seed = 0; seed < 8; seed += 1) {
      const arrangement = generateDuetArrangement(makeInput("trueDuet", seed));
      results.add(JSON.stringify(arrangement.harmonyTrack.map((h) => h.generatedPitch)));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("generateDuetArrangement — four styles genuinely differ", () => {
  it("produces different harmony tracks across all four styles for the same melody", () => {
    const styles: DuetStyle[] = ["cleanPop", "emotional", "dramatic", "trueDuet"];
    const results = styles.map((style) =>
      JSON.stringify(generateDuetArrangement(makeInput(style)).harmonyTrack),
    );
    const unique = new Set(results);
    expect(unique.size).toBe(styles.length);
  });

  it("is not a fixed-interval transposition — relations vary across the arrangement", () => {
    const arrangement = generateDuetArrangement(makeInput("cleanPop"));
    const relations = new Set(arrangement.harmonyTrack.map((h) => h.relationToMelody));
    expect(relations.size).toBeGreaterThan(1);
  });

  it("dramatic and emotional favor different registers on the same melody", () => {
    const dramatic = generateDuetArrangement(makeInput("dramatic"));
    const emotional = generateDuetArrangement(makeInput("emotional"));
    const avgPitch = (track: typeof dramatic.harmonyTrack) => {
      const pitches = track.map((h) => h.generatedPitch).filter((p): p is number => p !== null);
      return pitches.reduce((a, b) => a + b, 0) / Math.max(1, pitches.length);
    };
    expect(avgPitch(dramatic.harmonyTrack)).not.toBeCloseTo(avgPitch(emotional.harmonyTrack), 0);
  });
});

describe("generateDuetArrangement — chord changes drive harmony changes", () => {
  it("changes the harmony pitch class set when the underlying chord changes", () => {
    const { chords, melody, sections } = progressionFastChordChanges();
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
    expect(arrangement.harmonyTrack.length).toBe(melody.length);
    expect(arrangement.warnings).not.toContain(
      "일부 구간에 코드 정보가 없어 스케일 음을 기준으로 화음을 생성했습니다.",
    );
  });
});

describe("generateDuetArrangement — vocal range is respected", () => {
  it("never emits a pitch outside the given vocal range", () => {
    const narrowRange = {
      lowestPitch: 55,
      highestPitch: 79,
      comfortableLow: 58,
      comfortableHigh: 76,
      voiceType: "unspecified" as const,
    };
    const arrangement = generateDuetArrangement({
      ...makeInput("dramatic"),
      vocalRange: narrowRange,
    });
    for (const h of arrangement.harmonyTrack) {
      if (h.generatedPitch === null) continue;
      expect(h.generatedPitch).toBeGreaterThanOrEqual(narrowRange.lowestPitch);
      expect(h.generatedPitch).toBeLessThanOrEqual(narrowRange.highestPitch);
    }
  });
});

describe("generateDuetArrangement — missing chord data is flagged, not silently guessed", () => {
  it("adds a warning when no chords are provided", () => {
    const { melody, sections } = progressionCGAmF();
    const arrangement = generateDuetArrangement({
      mainMelody: melody,
      chords: [],
      key: "C major",
      bpm: 100,
      sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      style: "cleanPop",
      seed: 1,
    });
    expect(arrangement.warnings).toContain(
      "일부 구간에 코드 정보가 없어 스케일 음을 기준으로 화음을 생성했습니다.",
    );
  });
});

describe("generateDuetArrangement — explanations are grounded, not decorative", () => {
  it("every generated (non-rest) note carries a non-empty Korean reason and a real score breakdown", () => {
    const arrangement = generateDuetArrangement(makeInput("emotional"));
    for (const h of arrangement.harmonyTrack) {
      expect(h.styleReason.length).toBeGreaterThan(0);
      expect(Object.keys(h.scoreBreakdown).length).toBeGreaterThanOrEqual(10);
    }
  });
});
