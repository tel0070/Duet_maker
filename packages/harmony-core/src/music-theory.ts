import type {
  ChordEvent,
  ChordRole,
  RelationToMelody,
  VocalRange,
} from "@duet-maker/shared-types";

export const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const FLAT_ALIASES: Record<string, number> = {
  Db: 1,
  Eb: 3,
  Gb: 6,
  Ab: 8,
  Bb: 10,
  Cb: 11,
  Fb: 4,
};

export function noteNameToPitchClass(name: string): number {
  const trimmed = name.trim();
  const sharpIndex = PITCH_CLASS_NAMES.indexOf(
    trimmed as (typeof PITCH_CLASS_NAMES)[number],
  );
  if (sharpIndex >= 0) return sharpIndex;
  if (trimmed in FLAT_ALIASES) return FLAT_ALIASES[trimmed]!;
  throw new Error(`인식할 수 없는 음이름입니다: ${name}`);
}

export function pitchClassOf(midiPitch: number): number {
  return ((midiPitch % 12) + 12) % 12;
}

export type Mode = "major" | "minor";

export interface Key {
  tonic: number;
  mode: Mode;
}

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/** Parses strings like "C major", "A minor", "F# major", "Bb minor". */
export function parseKey(key: string): Key {
  const match = /^\s*([A-Ga-g][#b]?)\s+(major|minor)\s*$/.exec(key);
  if (!match) {
    throw new Error(
      `키 문자열을 해석할 수 없습니다: "${key}" (예: "C major", "A minor")`,
    );
  }
  const [, rawTonic, rawMode] = match as unknown as [string, string, string];
  const tonicName =
    rawTonic.length === 2
      ? `${rawTonic[0]!.toUpperCase()}${rawTonic[1]}`
      : rawTonic.toUpperCase();
  return {
    tonic: noteNameToPitchClass(tonicName),
    mode: rawMode.toLowerCase() as Mode,
  };
}

export function scalePitchClasses(key: Key): number[] {
  const intervals =
    key.mode === "major" ? MAJOR_SCALE_INTERVALS : NATURAL_MINOR_SCALE_INTERVALS;
  return intervals.map((interval) => (key.tonic + interval) % 12);
}

export function isDiatonic(midiPitch: number, key: Key): boolean {
  return scalePitchClasses(key).includes(pitchClassOf(midiPitch));
}

export interface ChordTone {
  pitchClass: number;
  role: ChordRole;
}

const QUALITY_INTERVALS: Record<string, Array<[number, ChordRole]>> = {
  maj: [
    [0, "root"],
    [4, "third"],
    [7, "fifth"],
  ],
  min: [
    [0, "root"],
    [3, "third"],
    [7, "fifth"],
  ],
  dim: [
    [0, "root"],
    [3, "third"],
    [6, "fifth"],
  ],
  aug: [
    [0, "root"],
    [4, "third"],
    [8, "fifth"],
  ],
  maj7: [
    [0, "root"],
    [4, "third"],
    [7, "fifth"],
    [11, "seventh"],
  ],
  min7: [
    [0, "root"],
    [3, "third"],
    [7, "fifth"],
    [10, "seventh"],
  ],
  dom7: [
    [0, "root"],
    [4, "third"],
    [7, "fifth"],
    [10, "seventh"],
  ],
  m7b5: [
    [0, "root"],
    [3, "third"],
    [6, "fifth"],
    [10, "seventh"],
  ],
  dim7: [
    [0, "root"],
    [3, "third"],
    [6, "fifth"],
    [9, "seventh"],
  ],
  sus2: [
    [0, "root"],
    [2, "third"],
    [7, "fifth"],
  ],
  sus4: [
    [0, "root"],
    [5, "third"],
    [7, "fifth"],
  ],
  five: [
    [0, "root"],
    [7, "fifth"],
  ],
};

const EXTENSION_INTERVALS: Record<string, [number, ChordRole]> = {
  "9": [2, "ninth"],
  b9: [1, "ninth"],
  "#9": [3, "ninth"],
  "11": [5, "eleventh"],
  "#11": [6, "eleventh"],
  "13": [9, "thirteenth"],
  b13: [8, "thirteenth"],
};

/** Chord tones (root/3rd/5th/7th + requested extensions) as pitch classes. */
export function chordTones(chord: ChordEvent): ChordTone[] {
  const rootPc = noteNameToPitchClass(chord.root);
  const base = QUALITY_INTERVALS[chord.quality] ?? QUALITY_INTERVALS.maj!;
  const tones: ChordTone[] = base.map(([interval, role]) => ({
    pitchClass: (rootPc + interval) % 12,
    role,
  }));
  for (const extension of chord.extensions) {
    const entry = EXTENSION_INTERVALS[extension];
    if (!entry) continue;
    const [interval, role] = entry;
    tones.push({ pitchClass: (rootPc + interval) % 12, role });
  }
  return tones;
}

/** Nearest absolute MIDI pitch with the given pitch class, at or below `target`. */
export function nearestPitchAtOrBelow(pitchClass: number, target: number): number {
  const diff = ((target - pitchClass) % 12 + 12) % 12;
  return target - diff;
}

/** Nearest absolute MIDI pitch with the given pitch class, at or above `target`. */
export function nearestPitchAtOrAbove(pitchClass: number, target: number): number {
  const below = nearestPitchAtOrBelow(pitchClass, target);
  return below === target ? target : below + 12;
}

/** Semitone distance (unsigned, 0-6) between two pitches' pitch-class interval. */
export function intervalClass(a: number, b: number): number {
  const raw = Math.abs(pitchClassOf(a) - pitchClassOf(b));
  return Math.min(raw, 12 - raw);
}

/**
 * Names the signed interval from melody to harmony as one of the
 * RelationToMelody labels. `custom` covers intervals with no named slot
 * (seconds, sevenths) — those are still valid candidates, just scored low on
 * consonance rather than excluded.
 */
export function relationForInterval(
  melodyPitch: number,
  harmonyPitch: number,
): RelationToMelody {
  const semitones = harmonyPitch - melodyPitch;
  if (semitones === 0) return "unison";
  const above = semitones > 0;
  const magnitude = Math.abs(semitones);
  if (magnitude === 12) return above ? "octaveAbove" : "octaveBelow";
  const mod = magnitude % 12;
  switch (mod) {
    case 3:
    case 4:
      return above ? "thirdAbove" : "thirdBelow";
    case 5:
      return above ? "fourthAbove" : "fourthBelow";
    case 7:
      return above ? "fifthAbove" : "fifthBelow";
    case 8:
    case 9:
      return above ? "sixthAbove" : "sixthBelow";
    default:
      return "custom";
  }
}

/**
 * Shifts `pitch` by octaves until it sits inside the vocal range's hard
 * bounds, preferring the comfortable band. Returns null only if the hard
 * range spans less than an octave and no octave-shift of this pitch class
 * lands inside it.
 */
export function clampToVocalRange(
  pitch: number,
  range: VocalRange,
): number | null {
  let candidate = pitch;
  while (candidate < range.lowestPitch) candidate += 12;
  while (candidate > range.highestPitch) candidate -= 12;
  if (candidate < range.lowestPitch || candidate > range.highestPitch) {
    return null;
  }

  // Prefer whichever octave (within the hard range) falls in the
  // comfortable band, if a shift by exactly one octave gets us there.
  const up = candidate + 12;
  const down = candidate - 12;
  const inComfort = (p: number) =>
    p >= range.comfortableLow && p <= range.comfortableHigh;
  if (!inComfort(candidate)) {
    if (up <= range.highestPitch && inComfort(up)) return up;
    if (down >= range.lowestPitch && inComfort(down)) return down;
  }
  return candidate;
}
