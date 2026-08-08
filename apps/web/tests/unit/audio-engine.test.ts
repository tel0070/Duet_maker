import { describe, expect, it, vi } from "vitest";
import {
  beatsToSeconds,
  beatsToSecondsWithMap,
  harmonyToScheduled,
  midiToFrequency,
  notesToScheduled,
  scheduleCountIn,
  schedulePlayback,
  sliceScheduledToRegion,
  type ScheduledNote,
} from "../../src/lib/audio-engine.js";

describe("midiToFrequency", () => {
  it("maps A4 (MIDI 69) to 440Hz", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5);
  });

  it("maps one octave up/down to double/half frequency", () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 3);
    expect(midiToFrequency(57)).toBeCloseTo(220, 3);
  });
});

describe("beatsToSeconds", () => {
  it("converts beats to seconds at a given BPM", () => {
    expect(beatsToSeconds(1, 60)).toBe(1);
    expect(beatsToSeconds(2, 120)).toBe(1);
    expect(beatsToSeconds(4, 90)).toBeCloseTo(2.6667, 3);
  });
});

describe("beatsToSecondsWithMap", () => {
  it("matches the constant-tempo scalar formula on a uniform grid", () => {
    const beatTimes = [0, 1, 2, 3, 4];
    for (const beats of [0, 0.5, 1.5, 3.9]) {
      expect(beatsToSecondsWithMap(beats, beatTimes)).toBeCloseTo(beatsToSeconds(beats, 60), 10);
    }
  });

  it("tracks a real local tempo change a single average bpm would miss", () => {
    // beat 0->1 is 1s/beat (60bpm), beat 1->2 is 0.5s/beat (120bpm) - a
    // single average bpm over the whole map (80bpm here) would place beat
    // 1.5 at 1.125s, not the real 1.25s.
    const beatTimes = [0, 1, 1.5];
    expect(beatsToSecondsWithMap(1.5, beatTimes)).toBeCloseTo(1.25, 10);
    expect(beatsToSeconds(1.5, 80)).not.toBeCloseTo(1.25, 2);
  });

  it("extrapolates past either edge of the map instead of clamping", () => {
    expect(beatsToSecondsWithMap(-0.5, [2, 3, 4])).toBeCloseTo(1.5, 10);
    expect(beatsToSecondsWithMap(2.5, [0, 1, 2])).toBeCloseTo(2.5, 10);
  });

  it("rejects a too-short map", () => {
    expect(() => beatsToSecondsWithMap(1, [0])).toThrow();
  });
});

describe("notesToScheduled / harmonyToScheduled", () => {
  it("converts melody notes to frequency+seconds", () => {
    const scheduled = notesToScheduled(
      [{ id: "n1", pitch: 69, startTime: 2, duration: 1, velocity: 100, confidence: 1, source: "user-input", editable: true }],
      120,
    );
    expect(scheduled).toEqual([{ frequency: 440, startTime: 1, duration: 0.5, velocity: 100 }]);
  });

  it("skips rests and orphaned harmony notes", () => {
    const melody = [
      { id: "n1", pitch: 60, startTime: 0, duration: 1, velocity: 90, confidence: 1, source: "user-input" as const, editable: true },
    ];
    const harmony = [
      {
        originalNoteId: "n1",
        generatedPitch: null,
        relationToMelody: "rest" as const,
        chordRole: "nonChordTone" as const,
        motionType: "none" as const,
        styleReason: "",
        scoreBreakdown: {},
        confidence: 0.5,
      },
      {
        originalNoteId: "missing",
        generatedPitch: 64,
        relationToMelody: "thirdAbove" as const,
        chordRole: "third" as const,
        motionType: "none" as const,
        styleReason: "",
        scoreBreakdown: {},
        confidence: 0.5,
      },
    ];
    expect(harmonyToScheduled(melody, harmony, 120)).toEqual([]);
  });

  it("includes a harmony note that resolves to a real pitch and source note", () => {
    const melody = [
      { id: "n1", pitch: 60, startTime: 0, duration: 2, velocity: 90, confidence: 1, source: "user-input" as const, editable: true },
    ];
    const harmony = [
      {
        originalNoteId: "n1",
        generatedPitch: 64,
        relationToMelody: "thirdAbove" as const,
        chordRole: "third" as const,
        motionType: "none" as const,
        styleReason: "",
        scoreBreakdown: {},
        confidence: 0.5,
      },
    ];
    const scheduled = harmonyToScheduled(melody, harmony, 120);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.frequency).toBeCloseTo(midiToFrequency(64), 5);
  });

  it("accepts a beat-time map instead of a scalar bpm, with correct durations even across a local tempo change", () => {
    // beat 0->1 is 1s/beat, beat 5->6 is 0.5s/beat - if duration were
    // converted independently of the note's actual start position (the bug
    // this guards against), a 1-beat-long note starting at beat 5 would
    // wrongly get the *first* interval's 1s duration instead of the real
    // interval's 0.5s.
    const beatTimes = [0, 1, 2, 3, 4, 5, 5.5, 6];
    const melody = [
      { id: "n1", pitch: 60, startTime: 5, duration: 1, velocity: 90, confidence: 1, source: "user-input" as const, editable: true },
    ];
    const scheduled = notesToScheduled(melody, beatTimes);
    expect(scheduled).toEqual([{ frequency: midiToFrequency(60), startTime: 5, duration: 0.5, velocity: 90 }]);

    const harmony = [
      {
        originalNoteId: "n1",
        generatedPitch: 64,
        relationToMelody: "thirdAbove" as const,
        chordRole: "third" as const,
        motionType: "none" as const,
        styleReason: "",
        scoreBreakdown: {},
        confidence: 0.5,
      },
    ];
    const scheduledHarmony = harmonyToScheduled(melody, harmony, beatTimes);
    expect(scheduledHarmony).toEqual([
      { frequency: midiToFrequency(64), startTime: 5, duration: 0.5, velocity: 90 },
    ]);
  });

  it("prefers a melody note's own exact real-world timestamp over the tempo map/bpm when present", () => {
    // A deliberately WRONG beat-time map (as if beat-tracking mis-measured
    // the song entirely, e.g. a ballad with sparse/soft percussion) - if
    // startTimeSeconds/durationSeconds are honored, the result must match
    // them exactly regardless of how wrong the map is.
    const wrongBeatTimes = [0, 100, 200];
    const melody = [
      {
        id: "n1",
        pitch: 60,
        startTime: 5,
        duration: 1,
        velocity: 90,
        confidence: 1,
        source: "user-input" as const,
        editable: true,
        startTimeSeconds: 12.34,
        durationSeconds: 0.56,
      },
    ];
    const scheduled = notesToScheduled(melody, wrongBeatTimes);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.frequency).toBeCloseTo(midiToFrequency(60), 10);
    expect(scheduled[0]!.startTime).toBeCloseTo(12.34, 10);
    expect(scheduled[0]!.duration).toBeCloseTo(0.56, 10);
    expect(scheduled[0]!.velocity).toBe(90);

    const harmony = [
      {
        originalNoteId: "n1",
        generatedPitch: 64,
        relationToMelody: "thirdAbove" as const,
        chordRole: "third" as const,
        motionType: "none" as const,
        styleReason: "",
        scoreBreakdown: {},
        confidence: 0.5,
      },
    ];
    const scheduledHarmony = harmonyToScheduled(melody, harmony, wrongBeatTimes);
    expect(scheduledHarmony).toHaveLength(1);
    expect(scheduledHarmony[0]!.frequency).toBeCloseTo(midiToFrequency(64), 10);
    expect(scheduledHarmony[0]!.startTime).toBeCloseTo(12.34, 10);
    expect(scheduledHarmony[0]!.duration).toBeCloseTo(0.56, 10);
    expect(scheduledHarmony[0]!.velocity).toBe(90);
  });
});

describe("sliceScheduledToRegion", () => {
  const notes: ScheduledNote[] = [
    { frequency: 440, startTime: 0, duration: 1, velocity: 100 }, // fully before region
    { frequency: 494, startTime: 1.5, duration: 1, velocity: 100 }, // straddles region start
    { frequency: 523, startTime: 3, duration: 1, velocity: 100 }, // fully inside
    { frequency: 587, startTime: 4.5, duration: 1, velocity: 100 }, // straddles region end
    { frequency: 659, startTime: 6, duration: 1, velocity: 100 }, // fully after region
  ];

  it("clips notes to the region and rebases startTime relative to region start", () => {
    const sliced = sliceScheduledToRegion(notes, 2, 5);
    expect(sliced).toEqual([
      { frequency: 494, startTime: 0, duration: 0.5, velocity: 100 },
      { frequency: 523, startTime: 1, duration: 1, velocity: 100 },
      { frequency: 587, startTime: 2.5, duration: 0.5, velocity: 100 },
    ]);
  });

  it("returns an empty array when the region is empty or inverted", () => {
    expect(sliceScheduledToRegion(notes, 3, 3)).toEqual([]);
    expect(sliceScheduledToRegion(notes, 5, 2)).toEqual([]);
  });
});

interface FakeParam {
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
  value: number;
}
function fakeParam(): FakeParam {
  return {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    value: 0,
  };
}

function createFakeAudioContext(currentTime = 0) {
  const oscillators: Array<{ type: string; frequency: FakeParam; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = [];
  const gains: Array<{ gain: FakeParam; connect: ReturnType<typeof vi.fn> }> = [];

  const ctx = {
    currentTime,
    destination: {},
    createOscillator: () => {
      const osc = { type: "sine", frequency: fakeParam(), start: vi.fn(), stop: vi.fn(), connect: vi.fn() };
      oscillators.push(osc);
      return osc;
    },
    createGain: () => {
      const gain = { gain: fakeParam(), connect: vi.fn() };
      gains.push(gain);
      return gain;
    },
  };
  return { ctx: ctx as unknown as AudioContext, oscillators, gains };
}

describe("schedulePlayback", () => {
  it("creates one oscillator+gain per note, skipping zero-duration notes", () => {
    const { ctx, oscillators } = createFakeAudioContext();
    schedulePlayback(
      ctx,
      [
        { frequency: 440, startTime: 0, duration: 1, velocity: 100 },
        { frequency: 220, startTime: 1, duration: 0, velocity: 100 }, // skipped
      ],
      "piano",
    );
    expect(oscillators).toHaveLength(1);
  });

  it("sets the oscillator frequency to the note's frequency and starts it at startAt + note.startTime", () => {
    const { ctx, oscillators } = createFakeAudioContext(10);
    schedulePlayback(ctx, [{ frequency: 523.25, startTime: 2, duration: 1, velocity: 100 }], "softSynth", {
      startAt: 10.05,
    });
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(523.25, 12.05);
    expect(oscillators[0]!.start).toHaveBeenCalledWith(12.05);
  });

  it("scales note timing by playbackRate", () => {
    const { ctx, oscillators } = createFakeAudioContext(0);
    schedulePlayback(ctx, [{ frequency: 440, startTime: 2, duration: 1, velocity: 100 }], "piano", {
      startAt: 0,
      playbackRate: 0.5, // half speed => everything takes twice as long
    });
    expect(oscillators[0]!.start).toHaveBeenCalledWith(4);
  });

  it("scales peak gain by velocity and the gain option", () => {
    const { ctx, gains } = createFakeAudioContext(0);
    schedulePlayback(ctx, [{ frequency: 440, startTime: 0, duration: 1, velocity: 127 }], "piano", {
      startAt: 0,
      gain: 0.8,
    });
    const rampCalls = gains[0]!.gain.linearRampToValueAtTime.mock.calls;
    const peakCall = rampCalls[0]!;
    expect(peakCall[0]).toBeCloseTo(0.8, 5);
  });

  it("uses the same startAt for two separate calls when passed explicitly (melody/harmony sync)", () => {
    const { ctx, oscillators } = createFakeAudioContext(5);
    schedulePlayback(ctx, [{ frequency: 440, startTime: 0, duration: 1, velocity: 100 }], "piano", { startAt: 5.05 });
    schedulePlayback(ctx, [{ frequency: 550, startTime: 0, duration: 1, velocity: 100 }], "piano", { startAt: 5.05 });
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0]!.start).toHaveBeenCalledWith(5.05);
    expect(oscillators[1]!.start).toHaveBeenCalledWith(5.05);
  });

  it("stop() ramps gain to 0 and stops oscillators without throwing", () => {
    const { ctx, oscillators, gains } = createFakeAudioContext(0);
    const handle = schedulePlayback(ctx, [{ frequency: 440, startTime: 0, duration: 5, velocity: 100 }], "piano", {
      startAt: 0,
    });
    expect(() => handle.stop()).not.toThrow();
    expect(gains[0]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    expect(oscillators[0]!.stop).toHaveBeenCalled();
  });
});

describe("scheduleCountIn", () => {
  it("schedules one click per beat, ending exactly at endAt", () => {
    const { ctx, oscillators } = createFakeAudioContext(0);
    scheduleCountIn(ctx, 4, 120, 1, 2.05);
    // 120bpm = 0.5s/beat; 4 clicks land at 0.05, 0.55, 1.05, 1.55, the last one exactly one beat before 2.05.
    expect(oscillators).toHaveLength(4);
    expect(oscillators[3]!.start.mock.calls[0]![0]).toBeCloseTo(1.55, 10);
    expect(oscillators[0]!.start.mock.calls[0]![0]).toBeCloseTo(0.05, 10);
  });

  it("accents the first beat with a higher pitch than the rest", () => {
    const { ctx, oscillators } = createFakeAudioContext(0);
    scheduleCountIn(ctx, 4, 120, 1, 2);
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(1600, expect.any(Number));
    expect(oscillators[1]!.frequency.setValueAtTime).toHaveBeenCalledWith(1000, expect.any(Number));
  });

  it("scales beat spacing by playbackRate", () => {
    const { ctx, oscillators } = createFakeAudioContext(0);
    scheduleCountIn(ctx, 2, 120, 0.5, 3); // half speed => 1s per beat instead of 0.5s
    expect(oscillators[1]!.start).toHaveBeenCalledWith(2);
    expect(oscillators[0]!.start).toHaveBeenCalledWith(1);
  });

  it("skips clicks that would fall before ctx.currentTime", () => {
    const { ctx, oscillators } = createFakeAudioContext(5); // context already past the count-in window
    scheduleCountIn(ctx, 4, 120, 1, 2.05);
    expect(oscillators).toHaveLength(0);
  });

  it("stop() silences any still-sounding clicks without throwing", () => {
    const { ctx, oscillators, gains } = createFakeAudioContext(0);
    const handle = scheduleCountIn(ctx, 2, 120, 1, 1.05);
    expect(() => handle.stop()).not.toThrow();
    expect(gains[0]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
    expect(oscillators[0]!.stop).toHaveBeenCalled();
  });
});
