import { DEFAULT_VOCAL_RANGE, type ArrangementInstruction } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { parseKey } from "../src/music-theory.js";
import { computeMotionType, scoreCandidate, type ScoringContext } from "../src/scoring.js";
import { STYLE_PROFILES } from "../src/styles.js";
import { chord } from "./fixtures.js";

const key = parseKey("C major");
const NO_INSTRUCTION: ArrangementInstruction = {
  singTogether: false,
  harmonyAbove: true,
  harmonyBelow: false,
  unison: false,
  octave: false,
  rest: false,
  callAndResponse: false,
  counterMelody: false,
  delayedEntry: false,
  repeatPhrase: false,
  sustainedPad: false,
};

function baseCtx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    melodyPitch: 67,
    prevMelodyPitch: 64,
    chord: chord("C", "maj", 0, 4),
    nextChord: null,
    key,
    vocalRange: DEFAULT_VOCAL_RANGE,
    prevHarmonyPitch: 64,
    recentRelations: [],
    recentHarmonyPitches: [],
    instruction: NO_INSTRUCTION,
    relationPreference: {},
    ...overrides,
  };
}

const weights = STYLE_PROFILES.cleanPop.weights;

describe("scoreCandidate — 도약 감점 (leap penalty)", () => {
  it("scores a stepwise motion higher than a large leap under otherwise-equal conditions", () => {
    const step = scoreCandidate(
      { pitch: 65, relation: "custom", chordRole: "third" },
      baseCtx({ prevHarmonyPitch: 64 }),
      weights,
    );
    const leap = scoreCandidate(
      { pitch: 84, relation: "custom", chordRole: "third" },
      baseCtx({ prevHarmonyPitch: 64 }),
      weights,
    );
    expect(step.breakdown.singability).toBeGreaterThan(leap.breakdown.singability);
    expect(step.breakdown.voiceLeading).toBeGreaterThan(leap.breakdown.voiceLeading);
  });
});

describe("scoreCandidate — 불협화음 감점 (dissonance penalty)", () => {
  it("scores a minor second lower than a third or a fifth", () => {
    const second = scoreCandidate(
      { pitch: 68, relation: "custom", chordRole: "nonChordTone" },
      baseCtx(),
      weights,
    );
    const third = scoreCandidate(
      { pitch: 64, relation: "custom", chordRole: "third" },
      baseCtx(),
      weights,
    );
    expect(second.breakdown.consonance).toBeLessThan(third.breakdown.consonance);
  });

  it("scores a tritone as the least consonant interval", () => {
    const tritone = scoreCandidate(
      { pitch: 61, relation: "custom", chordRole: "nonChordTone" },
      baseCtx(),
      weights,
    );
    const fifth = scoreCandidate(
      { pitch: 74, relation: "custom", chordRole: "fifth" },
      baseCtx(),
      weights,
    );
    expect(tritone.breakdown.consonance).toBeLessThan(fifth.breakdown.consonance);
  });
});

describe("scoreCandidate — 텐션 해결 (tension resolution)", () => {
  it("rewards a non-chord tone that resolves by step into the next chord", () => {
    // melody G(67), next chord F major (F=65,A=69,C=72). A non-chord tone at
    // 68 (G#) is one step from A(69), a chord tone of the next chord.
    const resolvingNonChordTone = scoreCandidate(
      { pitch: 68, relation: "counterMelody", chordRole: "nonChordTone" },
      baseCtx({ nextChord: chord("F", "maj", 4, 4) }),
      weights,
    );
    const unresolvedNonChordTone = scoreCandidate(
      { pitch: 68, relation: "counterMelody", chordRole: "nonChordTone" },
      baseCtx({ nextChord: null }),
      weights,
    );
    expect(resolvingNonChordTone.breakdown.tensionResolution).toBeGreaterThan(
      unresolvedNonChordTone.breakdown.tensionResolution,
    );
  });
});

describe("scoreCandidate — 공통음 유지 (common tone)", () => {
  it("does not penalize holding the same pitch across a chord change when it still fits", () => {
    const held = scoreCandidate(
      { pitch: 67, relation: "commonTone", chordRole: "fifth" },
      baseCtx({ prevHarmonyPitch: 67 }),
      weights,
    );
    expect(held.breakdown.voiceLeading).toBeGreaterThanOrEqual(0.85);
  });
});

describe("computeMotionType — 상·하 화음 전환 (contrary/parallel motion)", () => {
  it("detects contrary motion when melody and harmony move opposite directions", () => {
    expect(computeMotionType(60, 62, 67, 64)).toBe("contrary");
  });

  it("detects parallel motion when both move the same direction", () => {
    expect(computeMotionType(60, 62, 67, 69)).toBe("parallel");
  });

  it("detects oblique motion when only one voice moves", () => {
    expect(computeMotionType(60, 60, 67, 69)).toBe("oblique");
  });

  it("returns none when there is no previous harmony pitch to compare", () => {
    expect(computeMotionType(60, 62, null, 64)).toBe("none");
  });
});

describe("scoreCandidate — parallel fifths/octaves penalty", () => {
  it("penalizes parallel perfect fifths more than a comparable oblique motion", () => {
    // melody 60->62 (up a step), harmony 67->69 (up a step): both perfect
    // fifths above the melody, moving in the same direction = parallel 5ths.
    const parallelFifths = scoreCandidate(
      { pitch: 69, relation: "custom", chordRole: "fifth" },
      baseCtx({ melodyPitch: 62, prevMelodyPitch: 60, prevHarmonyPitch: 67 }),
      weights,
    );
    // melody 60->62, harmony 67->70 (not a perfect interval from the new
    // melody pitch) — same leap size, no parallel-perfect-interval fault.
    const nonParallel = scoreCandidate(
      { pitch: 70, relation: "custom", chordRole: "third" },
      baseCtx({ melodyPitch: 62, prevMelodyPitch: 60, prevHarmonyPitch: 67 }),
      weights,
    );
    expect(parallelFifths.breakdown.voiceLeading).toBeLessThan(nonParallel.breakdown.voiceLeading);
  });
});

describe("scoreCandidate — styleMatch differs by style profile", () => {
  it("weights octave relations higher for Dramatic than for Clean Pop", () => {
    const octaveCandidate = { pitch: 79, relation: "octaveAbove" as const, chordRole: "root" as const };
    const cleanPopScore = scoreCandidate(
      octaveCandidate,
      baseCtx({ relationPreference: STYLE_PROFILES.cleanPop.relationPreference }),
      STYLE_PROFILES.cleanPop.weights,
    );
    const dramaticScore = scoreCandidate(
      octaveCandidate,
      baseCtx({ relationPreference: STYLE_PROFILES.dramatic.relationPreference }),
      STYLE_PROFILES.dramatic.weights,
    );
    expect(dramaticScore.breakdown.styleMatch).toBeGreaterThan(cleanPopScore.breakdown.styleMatch);
  });
});
