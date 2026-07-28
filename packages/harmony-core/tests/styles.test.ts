import { describe, expect, it } from "vitest";
import { STYLE_PROFILES, planSections } from "../src/styles.js";
import { section } from "./fixtures.js";

describe("planSections — 스타일별 구간 계획 (not just re-weighted copies)", () => {
  it("assigns a different instruction shape to the same section type across styles", () => {
    const verse = section("verse", 0, 8);
    const instructions = (["cleanPop", "emotional", "dramatic", "trueDuet"] as const).map(
      (style) => JSON.stringify(planSections(style, [verse])[0]!.instruction),
    );
    expect(new Set(instructions).size).toBeGreaterThan(1);
  });

  it("gives every plan a non-empty Korean rationale", () => {
    const sections = [
      section("intro", 0, 4),
      section("verse", 4, 12),
      section("chorus", 12, 20),
      section("finalChorus", 20, 28),
    ];
    for (const style of ["cleanPop", "emotional", "dramatic", "trueDuet"] as const) {
      for (const plan of planSections(style, sections)) {
        expect(plan.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("intensifies the final chorus relative to the verse for every style", () => {
    for (const style of ["cleanPop", "emotional", "dramatic", "trueDuet"] as const) {
      const profile = STYLE_PROFILES[style];
      const verseDensity = profile.sectionDensityMultiplier.verse ?? 1;
      const finalChorusDensity = profile.sectionDensityMultiplier.finalChorus ?? 1;
      expect(finalChorusDensity).toBeGreaterThan(verseDensity);
    }
  });
});

describe("STYLE_PROFILES", () => {
  it("defines exactly the four required styles", () => {
    expect(Object.keys(STYLE_PROFILES).sort()).toEqual(
      ["cleanPop", "dramatic", "emotional", "trueDuet"].sort(),
    );
  });

  it("gives trueDuet a higher counterMelody preference than cleanPop", () => {
    expect(STYLE_PROFILES.trueDuet.relationPreference.counterMelody ?? 0).toBeGreaterThan(
      STYLE_PROFILES.cleanPop.relationPreference.counterMelody ?? 0,
    );
  });
});
