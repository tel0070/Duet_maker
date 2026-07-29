import { describe, expect, it, vi } from "vitest";
import {
  beatsToSeconds,
  harmonyToScheduled,
  midiToFrequency,
  notesToScheduled,
  schedulePlayback,
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
