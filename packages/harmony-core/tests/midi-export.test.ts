import { DEFAULT_VOCAL_RANGE } from "@duet-maker/shared-types";
import { describe, expect, it } from "vitest";
import { generateDuetArrangement } from "../src/generate.js";
import { exportArrangementToMidi, TICKS_PER_BEAT } from "../src/midi-export.js";
import { progressionCGAmF } from "./fixtures.js";

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  );
}

function readChunkId(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
}

/** Minimal SMF reader used only by this test, independent of the writer,
 * so a correctness bug in the writer can't hide behind a matching bug in
 * the same code that produced the assertion. */
function parseMidiTrackNoteOns(bytes: Uint8Array, trackOffset: number, trackLength: number): number[] {
  const notes: number[] = [];
  let i = trackOffset;
  const end = trackOffset + trackLength;
  while (i < end) {
    // delta time (variable length quantity)
    while (bytes[i]! & 0x80) i += 1;
    i += 1;
    const status = bytes[i]!;
    if (status === 0xff) {
      // meta event: 0xFF, type, length, data...
      const length = bytes[i + 2]!;
      i += 3 + length;
    } else if ((status & 0xf0) === 0x90) {
      notes.push(bytes[i + 1]!);
      i += 3;
    } else if ((status & 0xf0) === 0x80) {
      i += 3;
    } else {
      break;
    }
  }
  return notes;
}

describe("exportArrangementToMidi", () => {
  it("writes a valid SMF header (MThd, format 1, 3 tracks, declared ticks-per-beat)", () => {
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

    expect(readChunkId(bytes, 0)).toBe("MThd");
    expect(readUint32(bytes, 4)).toBe(6);
    const format = (bytes[8]! << 8) | bytes[9]!;
    const trackCount = (bytes[10]! << 8) | bytes[11]!;
    const division = (bytes[12]! << 8) | bytes[13]!;
    expect(format).toBe(1);
    expect(trackCount).toBe(3);
    expect(division).toBe(TICKS_PER_BEAT);
  });

  it("encodes every melody note as a note-on in the melody track", () => {
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

    // Skip header (14 bytes) + tempo track chunk to reach the melody track.
    let offset = 14;
    const tempoLength = readUint32(bytes, offset + 4);
    offset += 8 + tempoLength;
    expect(readChunkId(bytes, offset)).toBe("MTrk");
    const melodyLength = readUint32(bytes, offset + 4);
    const melodyNotes = parseMidiTrackNoteOns(bytes, offset + 8, melodyLength);

    expect(melodyNotes.sort()).toEqual([...melody.map((n) => n.pitch)].sort());
  });

  it("omits rests from the harmony track note count", () => {
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

    let offset = 14;
    const tempoLength = readUint32(bytes, offset + 4);
    offset += 8 + tempoLength;
    const melodyLength = readUint32(bytes, offset + 4);
    offset += 8 + melodyLength;
    const harmonyLength = readUint32(bytes, offset + 4);
    const harmonyNotes = parseMidiTrackNoteOns(bytes, offset + 8, harmonyLength);

    const expectedCount = arrangement.harmonyTrack.filter((h) => h.generatedPitch !== null).length;
    expect(harmonyNotes.length).toBe(expectedCount);
  });
});
