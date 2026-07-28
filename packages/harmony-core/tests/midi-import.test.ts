import { DEFAULT_VOCAL_RANGE } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateDuetArrangement } from "../src/generate.js";
import { exportArrangementToMidi } from "../src/midi-export.js";
import { importMelodyFromMidi } from "../src/midi-import.js";
import { progressionCGAmF } from "./fixtures.js";

describe("importMelodyFromMidi", () => {
  it("round-trips a melody through export then import (pitch/timing preserved)", () => {
    const { chords, melody, sections } = progressionCGAmF();
    const arrangement = generateDuetArrangement({
      mainMelody: melody,
      chords,
      key: "C major",
      bpm: 120,
      sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      style: "cleanPop",
      seed: 1,
    });
    const bytes = exportArrangementToMidi({
      melody: arrangement.sourceMelody,
      harmonyTrack: arrangement.harmonyTrack,
      bpm: 120,
    });

    const imported = importMelodyFromMidi(bytes);

    expect(imported).toHaveLength(melody.length);
    const originalSorted = [...melody].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < imported.length; i += 1) {
      expect(imported[i]!.pitch).toBe(originalSorted[i]!.pitch);
      expect(imported[i]!.startTime).toBeCloseTo(originalSorted[i]!.startTime, 5);
      expect(imported[i]!.duration).toBeCloseTo(originalSorted[i]!.duration, 5);
    }
  });

  it("marks every imported note as midi-import source with full confidence", () => {
    const { chords, melody, sections } = progressionCGAmF();
    const bytes = exportArrangementToMidi({
      melody,
      harmonyTrack: generateDuetArrangement({
        mainMelody: melody,
        chords,
        key: "C major",
        bpm: 100,
        sections,
        vocalRange: DEFAULT_VOCAL_RANGE,
        style: "cleanPop",
        seed: 1,
      }).harmonyTrack,
      bpm: 100,
    });
    const imported = importMelodyFromMidi(bytes);
    for (const note of imported) {
      expect(note.source).toBe("midi-import");
      expect(note.confidence).toBe(1);
      expect(note.editable).toBe(true);
    }
  });

  it("throws a clear error for a non-MIDI file", () => {
    const garbage = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(() => importMelodyFromMidi(garbage)).toThrow(/유효한 MIDI 파일/);
  });

  it("picks the busier track as the melody when multiple tracks have notes", () => {
    const { chords, melody, sections } = progressionCGAmF();
    const arrangement = generateDuetArrangement({
      mainMelody: melody,
      chords,
      key: "C major",
      bpm: 120,
      sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      style: "trueDuet", // sparser harmony track (more rests) than melody
      seed: 1,
    });
    const bytes = exportArrangementToMidi({
      melody: arrangement.sourceMelody,
      harmonyTrack: arrangement.harmonyTrack,
      bpm: 120,
    });
    const imported = importMelodyFromMidi(bytes);
    // The melody track always has at least as many notes as the harmony
    // track (one harmony note per melody note at most), so it must win.
    expect(imported.length).toBe(melody.length);
  });
});
