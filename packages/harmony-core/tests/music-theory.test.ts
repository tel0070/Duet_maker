import { describe, expect, it } from "vitest";
import {
  chordTones,
  clampToVocalRange,
  intervalClass,
  isDiatonic,
  nearestPitchAtOrAbove,
  nearestPitchAtOrBelow,
  noteNameToPitchClass,
  parseKey,
  pitchClassOf,
  relationForInterval,
  scalePitchClasses,
} from "../src/music-theory.js";
import { chord } from "./fixtures.js";
import { DEFAULT_VOCAL_RANGE } from "@duet-maker/shared-types";

describe("noteNameToPitchClass", () => {
  it("resolves sharps and flats to the same pitch class", () => {
    expect(noteNameToPitchClass("C#")).toBe(noteNameToPitchClass("Db"));
    expect(noteNameToPitchClass("C")).toBe(0);
    expect(noteNameToPitchClass("B")).toBe(11);
  });
});

describe("parseKey", () => {
  it("parses major and minor keys, case-insensitively", () => {
    expect(parseKey("C major")).toEqual({ tonic: 0, mode: "major" });
    expect(parseKey("a minor")).toEqual({ tonic: 9, mode: "minor" });
    expect(parseKey("F# major").tonic).toBe(6);
  });

  it("throws on an unparseable key string", () => {
    expect(() => parseKey("nonsense")).toThrow();
  });
});

describe("scalePitchClasses / isDiatonic — 조성 내 음 계산", () => {
  it("computes the seven pitch classes of C major", () => {
    const key = parseKey("C major");
    expect(scalePitchClasses(key)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("computes natural minor scale degrees", () => {
    const key = parseKey("A minor");
    expect(scalePitchClasses(key)).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });

  it("flags out-of-key pitches as non-diatonic", () => {
    const key = parseKey("C major");
    expect(isDiatonic(60, key)).toBe(true); // C
    expect(isDiatonic(61, key)).toBe(false); // C#
    expect(isDiatonic(72, key)).toBe(true); // C an octave up
  });
});

describe("chordTones — 코드톤 생성", () => {
  it("builds a major triad as root/third/fifth", () => {
    const tones = chordTones(chord("C", "maj", 0, 4));
    expect(tones.map((t) => t.pitchClass).sort()).toEqual([0, 4, 7]);
    expect(tones.find((t) => t.pitchClass === 0)?.role).toBe("root");
    expect(tones.find((t) => t.pitchClass === 4)?.role).toBe("third");
    expect(tones.find((t) => t.pitchClass === 7)?.role).toBe("fifth");
  });

  it("lowers the third and does not affect the fifth for a minor chord", () => {
    const tones = chordTones(chord("A", "min", 0, 4));
    expect(tones.map((t) => t.pitchClass).sort()).toEqual([0, 4, 9]);
  });

  it("adds a minor seventh for a dominant 7th chord", () => {
    const tones = chordTones(chord("G", "dom7", 0, 4));
    const seventh = tones.find((t) => t.role === "seventh");
    expect(seventh?.pitchClass).toBe((7 + 10) % 12);
  });

  it("adds a requested ninth extension", () => {
    const tones = chordTones(chord("C", "dom7", 0, 4, { extensions: ["9"] }));
    const ninth = tones.find((t) => t.role === "ninth");
    expect(ninth?.pitchClass).toBe(2);
  });

  it("falls back to the root+fifth power-chord shape for 'five'", () => {
    const tones = chordTones(chord("E", "five", 0, 4));
    expect(tones.map((t) => t.pitchClass).sort((a, b) => a - b)).toEqual([4, 11]);
  });
});

describe("nearestPitchAtOrBelow / nearestPitchAtOrAbove", () => {
  it("finds the closest occurrence of a pitch class in each direction", () => {
    expect(nearestPitchAtOrBelow(0, 65)).toBe(60); // C at/below F4(65)
    expect(nearestPitchAtOrAbove(0, 65)).toBe(72);
    expect(nearestPitchAtOrBelow(5, 65)).toBe(65); // already F
    expect(nearestPitchAtOrAbove(5, 65)).toBe(65);
  });
});

describe("intervalClass / relationForInterval", () => {
  it("reduces intervals to an unsigned pitch-class distance", () => {
    expect(intervalClass(60, 64)).toBe(4); // major third
    expect(intervalClass(60, 72)).toBe(0); // octave
    expect(intervalClass(60, 66)).toBe(6); // tritone
  });

  it("names common relations correctly", () => {
    expect(relationForInterval(60, 60)).toBe("unison");
    expect(relationForInterval(60, 64)).toBe("thirdAbove");
    expect(relationForInterval(60, 56)).toBe("thirdBelow");
    expect(relationForInterval(60, 72)).toBe("octaveAbove");
    expect(relationForInterval(60, 48)).toBe("octaveBelow");
    expect(relationForInterval(60, 67)).toBe("fifthAbove");
  });
});

describe("clampToVocalRange — 음역 제한", () => {
  it("shifts a pitch above the hard range down by octaves", () => {
    const clamped = clampToVocalRange(90, DEFAULT_VOCAL_RANGE);
    expect(clamped).not.toBeNull();
    expect(clamped!).toBeLessThanOrEqual(DEFAULT_VOCAL_RANGE.highestPitch);
    expect(clamped! % 12).toBe(pitchClassOf(90));
  });

  it("shifts a pitch below the hard range up by octaves", () => {
    const clamped = clampToVocalRange(20, DEFAULT_VOCAL_RANGE);
    expect(clamped).not.toBeNull();
    expect(clamped!).toBeGreaterThanOrEqual(DEFAULT_VOCAL_RANGE.lowestPitch);
  });

  it("leaves an already-comfortable pitch untouched", () => {
    expect(clampToVocalRange(60, DEFAULT_VOCAL_RANGE)).toBe(60);
  });

  it("returns null when no octave of the pitch fits the hard range", () => {
    const tinyRange = {
      lowestPitch: 60,
      highestPitch: 60,
      comfortableLow: 60,
      comfortableHigh: 60,
      voiceType: "unspecified" as const,
    };
    expect(clampToVocalRange(61, tinyRange)).toBeNull();
    expect(clampToVocalRange(60, tinyRange)).toBe(60);
  });
});
