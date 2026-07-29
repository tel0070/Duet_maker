import { DEFAULT_VOCAL_RANGE } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateCandidates } from "../src/candidates.js";
import { parseKey } from "../src/music-theory.js";
import { chord } from "./fixtures.js";

const key = parseKey("C major");

describe("generateCandidates", () => {
  it("always includes a rest option", () => {
    const candidates = generateCandidates({
      melodyPitch: 67,
      chord: chord("C", "maj", 0, 4),
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: null,
    });
    expect(candidates.some((c) => c.pitch === null && c.relation === "rest")).toBe(true);
  });

  it("produces only chord-tone pitch classes for non-unison/octave/rest candidates", () => {
    const activeChord = chord("C", "maj", 0, 4);
    const candidates = generateCandidates({
      melodyPitch: 67,
      chord: activeChord,
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: null,
    });
    const chordTonePcs = new Set([0, 4, 7]);
    for (const c of candidates) {
      if (c.pitch === null) continue;
      if (["unison", "octaveAbove", "octaveBelow", "counterMelody"].includes(c.relation)) continue;
      expect(chordTonePcs.has(c.pitch % 12)).toBe(true);
    }
  });

  it("is not a fixed third — different chords produce different candidate pitch-class sets", () => {
    const overC = generateCandidates({
      melodyPitch: 67,
      chord: chord("C", "maj", 0, 4),
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: null,
    });
    const overF = generateCandidates({
      melodyPitch: 67,
      chord: chord("F", "maj", 0, 4),
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: null,
    });
    const pcsC = new Set(overC.filter((c) => c.pitch !== null).map((c) => c.pitch! % 12));
    const pcsF = new Set(overF.filter((c) => c.pitch !== null).map((c) => c.pitch! % 12));
    expect([...pcsC].sort()).not.toEqual([...pcsF].sort());
  });

  it("offers a common-tone candidate that holds the previous harmony pitch when it fits the new chord", () => {
    // Previous harmony pitch (67 = G) is the fifth of C major and also the
    // root-adjacent... actually check it against F major where G is not a tone;
    // use C -> Am, where G is not a chord tone of Am either. Instead verify
    // against a chord that DOES contain the pitch class: G major contains G.
    const candidates = generateCandidates({
      melodyPitch: 71,
      chord: chord("G", "maj", 4, 4),
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: 67, // G, a chord tone of G major
    });
    expect(
      candidates.some((c) => c.pitch === 67 && c.relation === "commonTone"),
    ).toBe(true);
  });

  it("omits the common-tone candidate when the held pitch no longer fits the chord", () => {
    const candidates = generateCandidates({
      melodyPitch: 62,
      chord: chord("F", "maj", 4, 4), // F, A, C — no C# or D#, etc.
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: 61, // C#, not in F major triad
    });
    expect(candidates.some((c) => c.relation === "commonTone")).toBe(false);
  });

  it("clamps octave candidates into the vocal range", () => {
    const narrowRange = {
      lowestPitch: 60,
      highestPitch: 72,
      comfortableLow: 62,
      comfortableHigh: 70,
      voiceType: "unspecified" as const,
    };
    const candidates = generateCandidates({
      melodyPitch: 67,
      chord: chord("C", "maj", 0, 4),
      key,
      vocalRange: narrowRange,
      prevHarmonyPitch: null,
    });
    for (const c of candidates) {
      if (c.pitch === null) continue;
      expect(c.pitch).toBeGreaterThanOrEqual(narrowRange.lowestPitch);
      expect(c.pitch).toBeLessThanOrEqual(narrowRange.highestPitch);
    }
  });

  it("falls back to scale tones (not silence) when no chord is active", () => {
    const candidates = generateCandidates({
      melodyPitch: 67,
      chord: null,
      key,
      vocalRange: DEFAULT_VOCAL_RANGE,
      prevHarmonyPitch: null,
    });
    expect(candidates.length).toBeGreaterThan(1);
  });
});
