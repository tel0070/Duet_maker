import type { ChordEvent, NoteEvent, SongSection } from "@duet-maker/shared-types";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function note(
  pitch: number,
  startTime: number,
  duration: number,
  overrides: Partial<NoteEvent> = {},
): NoteEvent {
  return {
    id: nextId("note"),
    pitch,
    startTime,
    duration,
    velocity: 90,
    confidence: 1,
    source: "user-input",
    editable: true,
    ...overrides,
  };
}

export function chord(
  root: ChordEvent["root"],
  quality: ChordEvent["quality"],
  startTime: number,
  duration: number,
  overrides: Partial<ChordEvent> = {},
): ChordEvent {
  return {
    id: nextId("chord"),
    root,
    quality,
    extensions: [],
    startTime,
    duration,
    confidence: 1,
    source: "user-input",
    ...overrides,
  };
}

export function section(
  type: SongSection["type"],
  startTime: number,
  endTime: number,
  overrides: Partial<SongSection> = {},
): SongSection {
  return {
    id: nextId("section"),
    type,
    startTime,
    endTime,
    energy: 0.5,
    harmonyDensity: 0.6,
    ...overrides,
  };
}

/** C-G-Am-F, one chord per bar (4 beats), 4 bars, melody outlines each chord. */
export function progressionCGAmF() {
  const chords = [
    chord("C", "maj", 0, 4),
    chord("G", "maj", 4, 4),
    chord("A", "min", 8, 4),
    chord("F", "maj", 12, 4),
  ];
  const melody = [
    note(64, 0, 2), // E over C
    note(67, 2, 2), // G over C
    note(67, 4, 2), // G over G
    note(71, 6, 2), // B over G
    note(69, 8, 2), // A over Am
    note(72, 10, 2), // C over Am
    note(65, 12, 2), // F over F
    note(69, 14, 2), // A over F
  ];
  const sections = [section("verse", 0, 16)];
  return { chords, melody, sections };
}

/** vi-IV-I-V. */
export function progressionViIvIV() {
  const chords = [
    chord("A", "min", 0, 4),
    chord("F", "maj", 4, 4),
    chord("C", "maj", 8, 4),
    chord("G", "maj", 12, 4),
  ];
  const melody = [
    note(69, 0, 4),
    note(65, 4, 4),
    note(67, 8, 4),
    note(71, 12, 4),
  ];
  const sections = [section("chorus", 0, 16, { energy: 0.8, harmonyDensity: 0.8 })];
  return { chords, melody, sections };
}

/** ii-V-I in C. */
export function progressionIiVI() {
  const chords = [
    chord("D", "min7", 0, 2),
    chord("G", "dom7", 2, 2),
    chord("C", "maj7", 4, 4),
  ];
  const melody = [note(62, 0, 2), note(67, 2, 2), note(72, 4, 4)];
  const sections = [section("bridge", 0, 8)];
  return { chords, melody, sections };
}

/** Minor-key ballad progression, i-VI-III-VII. */
export function progressionMinorBallad() {
  const chords = [
    chord("A", "min", 0, 4),
    chord("F", "maj", 4, 4),
    chord("C", "maj", 8, 4),
    chord("G", "maj", 12, 4),
  ];
  const melody = [
    note(60, 0, 4),
    note(62, 4, 4),
    note(64, 8, 4),
    note(62, 12, 4),
  ];
  const sections = [section("bridge", 0, 16, { energy: 0.3, harmonyDensity: 0.4 })];
  return { chords, melody, sections };
}

/** Chords changing twice within one bar. */
export function progressionFastChordChanges() {
  const chords = [
    chord("C", "maj", 0, 2),
    chord("A", "min", 2, 2),
    chord("F", "maj", 4, 2),
    chord("G", "maj", 6, 2),
  ];
  const melody = [note(67, 0, 2), note(69, 2, 2), note(65, 4, 2), note(71, 6, 2)];
  const sections = [section("verse", 0, 8)];
  return { chords, melody, sections };
}

/** A climbing final-chorus melody, high register. */
export function progressionClimbingFinalChorus() {
  const chords = [chord("C", "maj", 0, 8), chord("G", "maj", 8, 8)];
  const melody = [
    note(67, 0, 2),
    note(69, 2, 2),
    note(72, 4, 2),
    note(76, 6, 2),
    note(74, 8, 4),
    note(79, 12, 4),
  ];
  const sections = [section("finalChorus", 0, 16, { energy: 0.95, harmonyDensity: 0.9 })];
  return { chords, melody, sections };
}

/** One long sustained melody note. */
export function progressionLongSustain() {
  const chords = [chord("C", "maj", 0, 8)];
  const melody = [note(67, 0, 8)];
  const sections = [section("bridge", 0, 8)];
  return { chords, melody, sections };
}

/** Many short, fast notes in one bar. */
export function progressionFastNotes() {
  const chords = [chord("C", "maj", 0, 4)];
  const melody = Array.from({ length: 8 }, (_, i) => note(60 + (i % 5), i * 0.5, 0.5));
  const sections = [section("chorus", 0, 4)];
  return { chords, melody, sections };
}

/** A phrase with large rests between short melody notes. */
export function progressionRestHeavyPhrase() {
  const chords = [chord("C", "maj", 0, 16)];
  const melody = [note(67, 0, 1), note(69, 4, 1), note(72, 8, 1), note(67, 12, 1)];
  const sections = [section("verse", 0, 16)];
  return { chords, melody, sections };
}
