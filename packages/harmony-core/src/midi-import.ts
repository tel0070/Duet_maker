import type { NoteEvent } from "@duet-maker/shared-types";

interface RawTrackEvent {
  tick: number;
  status: number;
  data: number[];
}

interface RawTrack {
  events: RawTrackEvent[];
}

function readVariableLengthQuantity(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let pos = offset;
  for (;;) {
    const byte = bytes[pos]!;
    value = (value << 7) | (byte & 0x7f);
    pos += 1;
    if ((byte & 0x80) === 0) break;
  }
  return [value, pos];
}

function readChunkId(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! << 24) |
    (bytes[offset + 1]! << 16) |
    (bytes[offset + 2]! << 8) |
    bytes[offset + 3]!
  );
}

const META_OR_SYSEX = new Set([0xff, 0xf0, 0xf7]);
/** Number of data bytes following a channel-voice status byte's high nibble. */
const CHANNEL_MESSAGE_LENGTH: Record<number, number> = {
  0x8: 2, // note off
  0x9: 2, // note on
  0xa: 2, // polyphonic aftertouch
  0xb: 2, // control change
  0xc: 1, // program change
  0xd: 1, // channel aftertouch
  0xe: 2, // pitch bend
};

function parseTrackChunk(bytes: Uint8Array, offset: number, length: number): RawTrack {
  const events: RawTrackEvent[] = [];
  let pos = offset;
  const end = offset + length;
  let tick = 0;
  let runningStatus = 0;

  while (pos < end) {
    const [delta, afterDelta] = readVariableLengthQuantity(bytes, pos);
    pos = afterDelta;
    tick += delta;

    let status = bytes[pos]!;
    if (status < 0x80) {
      // Running status: reuse the previous status byte, this byte is data.
      status = runningStatus;
    } else {
      pos += 1;
      if (status < 0xf0) runningStatus = status;
    }

    if (status === 0xff) {
      const type = bytes[pos]!;
      const [len, afterLen] = readVariableLengthQuantity(bytes, pos + 1);
      const data = Array.from(bytes.slice(afterLen, afterLen + len));
      events.push({ tick, status, data: [type, ...data] });
      pos = afterLen + len;
    } else if (status === 0xf0 || status === 0xf7) {
      const [len, afterLen] = readVariableLengthQuantity(bytes, pos);
      pos = afterLen + len;
    } else {
      const highNibble = (status >> 4) & 0x0f;
      const dataLength = CHANNEL_MESSAGE_LENGTH[highNibble] ?? 0;
      const data = Array.from(bytes.slice(pos, pos + dataLength));
      if (!META_OR_SYSEX.has(status)) {
        events.push({ tick, status, data });
      }
      pos += dataLength;
    }
  }

  return { events };
}

export interface ParsedMidiFile {
  ticksPerBeat: number;
  tracks: RawTrack[];
}

function parseStandardMidiFile(bytes: Uint8Array): ParsedMidiFile {
  if (readChunkId(bytes, 0) !== "MThd") {
    throw new Error("유효한 MIDI 파일이 아닙니다 (MThd 헤더를 찾을 수 없습니다).");
  }
  const trackCount = (bytes[10]! << 8) | bytes[11]!;
  const division = (bytes[12]! << 8) | bytes[13]!;
  if ((division & 0x8000) !== 0) {
    throw new Error("SMPTE 타임코드 기반 MIDI 파일은 지원하지 않습니다.");
  }

  const tracks: RawTrack[] = [];
  let offset = 14;
  for (let i = 0; i < trackCount && offset < bytes.length; i += 1) {
    if (readChunkId(bytes, offset) !== "MTrk") {
      throw new Error(`예상하지 못한 청크입니다 (MTrk가 아님): offset ${offset}`);
    }
    const length = readUint32(bytes, offset + 4);
    tracks.push(parseTrackChunk(bytes, offset + 8, length));
    offset += 8 + length;
  }

  return { ticksPerBeat: division, tracks };
}

function trackToNotes(track: RawTrack, ticksPerBeat: number): NoteEvent[] {
  const openByPitch = new Map<number, Array<{ tick: number; velocity: number }>>();
  const notes: Array<{ pitch: number; startTick: number; endTick: number; velocity: number }> = [];
  let counter = 0;

  for (const event of track.events) {
    const highNibble = (event.status >> 4) & 0x0f;
    const pitch = event.data[0];
    if (pitch === undefined) continue;
    const velocity = event.data[1] ?? 0;

    if (highNibble === 0x9 && velocity > 0) {
      const stack = openByPitch.get(pitch) ?? [];
      stack.push({ tick: event.tick, velocity });
      openByPitch.set(pitch, stack);
    } else if (highNibble === 0x8 || (highNibble === 0x9 && velocity === 0)) {
      const stack = openByPitch.get(pitch);
      const open = stack?.pop();
      if (open) {
        notes.push({ pitch, startTick: open.tick, endTick: event.tick, velocity: open.velocity });
      }
    }
  }

  return notes
    .filter((n) => n.endTick > n.startTick)
    .sort((a, b) => a.startTick - b.startTick)
    .map((n) => {
      counter += 1;
      return {
        id: `midi-import-${counter}`,
        pitch: n.pitch,
        startTime: n.startTick / ticksPerBeat,
        duration: (n.endTick - n.startTick) / ticksPerBeat,
        velocity: n.velocity,
        confidence: 1,
        source: "midi-import" as const,
        editable: true,
      };
    });
}

/**
 * Extracts a single melodic line from a Standard MIDI File. Heuristic: the
 * track with the most notes is treated as "the melody" (ties broken by
 * earliest track index). This is a reasonable default for a file the user
 * exported as a single melodic line, but is not a source-separation
 * algorithm — a multi-instrument file will not be split into parts. For
 * best results, ask users to export a single-track melody.
 */
export function importMelodyFromMidi(bytes: Uint8Array): NoteEvent[] {
  const parsed = parseStandardMidiFile(bytes);
  let best: NoteEvent[] = [];
  for (const track of parsed.tracks) {
    const notes = trackToNotes(track, parsed.ticksPerBeat);
    if (notes.length > best.length) best = notes;
  }
  return best;
}
