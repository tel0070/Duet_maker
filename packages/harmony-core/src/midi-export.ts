import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";

export const TICKS_PER_BEAT = 480;

interface AbsoluteEvent {
  tick: number;
  /** Sort priority at the same tick: note-off must be written before note-on. */
  priority: number;
  bytes: number[];
}

function beatsToTicks(beats: number): number {
  return Math.round(beats * TICKS_PER_BEAT);
}

function writeVariableLengthQuantity(value: number): number[] {
  const bytes: number[] = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  return bytes;
}

function noteEventsToAbsoluteEvents(
  notes: Array<{ pitch: number; startTime: number; duration: number; velocity: number }>,
  channel: number,
): AbsoluteEvent[] {
  const events: AbsoluteEvent[] = [];
  for (const note of notes) {
    const startTick = beatsToTicks(note.startTime);
    const endTick = beatsToTicks(note.startTime + note.duration);
    events.push({
      tick: startTick,
      priority: 1,
      bytes: [0x90 | channel, note.pitch & 0x7f, note.velocity & 0x7f],
    });
    events.push({
      tick: Math.max(endTick, startTick + 1),
      priority: 0,
      bytes: [0x80 | channel, note.pitch & 0x7f, 0],
    });
  }
  return events;
}

function buildTrackChunk(events: AbsoluteEvent[]): Uint8Array {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.priority - b.priority);
  const bytes: number[] = [];
  let lastTick = 0;
  for (const event of sorted) {
    bytes.push(...writeVariableLengthQuantity(event.tick - lastTick));
    bytes.push(...event.bytes);
    lastTick = event.tick;
  }
  // End of track meta event.
  bytes.push(0x00, 0xff, 0x2f, 0x00);

  const header = [
    0x4d,
    0x54,
    0x72,
    0x6b, // "MTrk"
    (bytes.length >> 24) & 0xff,
    (bytes.length >> 16) & 0xff,
    (bytes.length >> 8) & 0xff,
    bytes.length & 0xff,
  ];
  return new Uint8Array([...header, ...bytes]);
}

function buildTempoTrack(bpm: number): Uint8Array {
  const microsecondsPerBeat = Math.round(60_000_000 / bpm);
  const tempoBytes: AbsoluteEvent = {
    tick: 0,
    priority: 1,
    bytes: [
      0xff,
      0x51,
      0x03,
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff,
    ],
  };
  return buildTrackChunk([tempoBytes]);
}

export interface ExportArrangementToMidiInput {
  melody: NoteEvent[];
  harmonyTrack: HarmonyNote[];
  bpm: number;
}

/**
 * Serializes the main melody and generated harmony to a 3-track Standard
 * MIDI File (format 1): tempo track, melody track (channel 0), harmony
 * track (channel 1). No external dependency — this is a minimal SMF writer,
 * not a general-purpose MIDI library.
 */
export function exportArrangementToMidi(input: ExportArrangementToMidiInput): Uint8Array {
  const { melody, harmonyTrack, bpm } = input;
  const melodyById = new Map(melody.map((n) => [n.id, n]));

  const melodyEvents = noteEventsToAbsoluteEvents(melody, 0);

  const harmonyNotes: Array<{ pitch: number; startTime: number; duration: number; velocity: number }> = [];
  for (const h of harmonyTrack) {
    if (h.generatedPitch === null) continue;
    const source = melodyById.get(h.originalNoteId);
    if (!source) continue;
    harmonyNotes.push({
      pitch: h.generatedPitch,
      startTime: source.startTime,
      duration: source.duration,
      velocity: source.velocity,
    });
  }
  const harmonyEvents = noteEventsToAbsoluteEvents(harmonyNotes, 1);

  const tempoTrack = buildTempoTrack(bpm);
  const melodyTrack = buildTrackChunk(melodyEvents);
  const harmonyTrackChunk = buildTrackChunk(harmonyEvents);

  const header = new Uint8Array([
    0x4d,
    0x54,
    0x68,
    0x64, // "MThd"
    0x00,
    0x00,
    0x00,
    0x06, // header length = 6
    0x00,
    0x01, // format 1 (multiple simultaneous tracks)
    0x00,
    0x03, // 3 tracks
    (TICKS_PER_BEAT >> 8) & 0xff,
    TICKS_PER_BEAT & 0xff,
  ]);

  const totalLength =
    header.length + tempoTrack.length + melodyTrack.length + harmonyTrackChunk.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of [header, tempoTrack, melodyTrack, harmonyTrackChunk]) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
