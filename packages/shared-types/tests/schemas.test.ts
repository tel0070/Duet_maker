import { describe, expect, it } from "vitest";
import {
  ALL_INSTRUCTIONS_OFF,
  DEFAULT_VOCAL_RANGE,
  arrangementInstructionSchema,
  chordEventSchema,
  duetArrangementSchema,
  harmonyNoteSchema,
  noteEventSchema,
  songSectionSchema,
  vocalRangeSchema,
} from "../src/index.js";

function makeNote(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "n1",
    pitch: 60,
    startTime: 0,
    duration: 1,
    velocity: 90,
    confidence: 1,
    source: "user-input",
    editable: true,
    ...overrides,
  };
}

describe("noteEventSchema", () => {
  it("accepts a well-formed note", () => {
    expect(noteEventSchema.safeParse(makeNote()).success).toBe(true);
  });

  it("rejects pitch outside MIDI range", () => {
    expect(noteEventSchema.safeParse(makeNote({ pitch: 128 })).success).toBe(
      false,
    );
    expect(noteEventSchema.safeParse(makeNote({ pitch: -1 })).success).toBe(
      false,
    );
  });

  it("rejects zero or negative duration", () => {
    expect(
      noteEventSchema.safeParse(makeNote({ duration: 0 })).success,
    ).toBe(false);
    expect(
      noteEventSchema.safeParse(makeNote({ duration: -2 })).success,
    ).toBe(false);
  });

  it("rejects confidence outside [0,1]", () => {
    expect(
      noteEventSchema.safeParse(makeNote({ confidence: 1.5 })).success,
    ).toBe(false);
  });
});

describe("chordEventSchema", () => {
  function makeChord(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "c1",
      root: "C",
      quality: "maj",
      extensions: [],
      startTime: 0,
      duration: 4,
      confidence: 1,
      source: "user-input",
      ...overrides,
    };
  }

  it("accepts a well-formed chord", () => {
    expect(chordEventSchema.safeParse(makeChord()).success).toBe(true);
  });

  it("rejects an invalid root pitch class", () => {
    expect(
      chordEventSchema.safeParse(makeChord({ root: "H" })).success,
    ).toBe(false);
  });

  it("accepts a slash chord bass note", () => {
    const parsed = chordEventSchema.safeParse(makeChord({ bass: "E" }));
    expect(parsed.success).toBe(true);
  });
});

describe("songSectionSchema", () => {
  function makeSection(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "s1",
      type: "verse",
      startTime: 0,
      endTime: 8,
      energy: 0.4,
      harmonyDensity: 0.3,
      ...overrides,
    };
  }

  it("accepts a well-formed section", () => {
    expect(songSectionSchema.safeParse(makeSection()).success).toBe(true);
  });

  it("rejects endTime <= startTime", () => {
    expect(
      songSectionSchema.safeParse(makeSection({ endTime: 0 })).success,
    ).toBe(false);
    expect(
      songSectionSchema.safeParse(
        makeSection({ startTime: 8, endTime: 8 }),
      ).success,
    ).toBe(false);
  });
});

describe("vocalRangeSchema", () => {
  it("accepts the shared default range", () => {
    expect(vocalRangeSchema.safeParse(DEFAULT_VOCAL_RANGE).success).toBe(
      true,
    );
  });

  it("rejects a comfortable band outside the hard range", () => {
    const invalid = { ...DEFAULT_VOCAL_RANGE, comfortableHigh: 100 };
    expect(vocalRangeSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects comfortableLow greater than comfortableHigh", () => {
    const invalid = {
      ...DEFAULT_VOCAL_RANGE,
      comfortableLow: 70,
      comfortableHigh: 60,
    };
    expect(vocalRangeSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("harmonyNoteSchema", () => {
  it("accepts a rest (null generatedPitch)", () => {
    const rest = {
      originalNoteId: "n1",
      generatedPitch: null,
      relationToMelody: "rest",
      chordRole: "nonChordTone",
      motionType: "none",
      styleReason: "이 구간은 가사를 강조하기 위해 쉼으로 처리했습니다.",
      scoreBreakdown: { restBonus: 0.5 },
      confidence: 0.8,
    };
    expect(harmonyNoteSchema.safeParse(rest).success).toBe(true);
  });
});

describe("arrangementInstructionSchema", () => {
  it("accepts the all-off default", () => {
    expect(
      arrangementInstructionSchema.safeParse(ALL_INSTRUCTIONS_OFF).success,
    ).toBe(true);
  });
});

describe("duetArrangementSchema", () => {
  it("accepts an empty-but-well-typed arrangement", () => {
    const arrangement = {
      sourceMelody: [],
      harmonyTrack: [],
      sectionPlans: [],
      style: "cleanPop",
      overallScore: 0,
      scoreBreakdown: {},
      warnings: [],
      generationVersion: "0.1.0",
      randomSeed: 42,
    };
    expect(duetArrangementSchema.safeParse(arrangement).success).toBe(true);
  });

  it("rejects an unknown style", () => {
    const arrangement = {
      sourceMelody: [],
      harmonyTrack: [],
      sectionPlans: [],
      style: "smoothJazz",
      overallScore: 0,
      scoreBreakdown: {},
      warnings: [],
      generationVersion: "0.1.0",
      randomSeed: 42,
    };
    expect(duetArrangementSchema.safeParse(arrangement).success).toBe(false);
  });
});
