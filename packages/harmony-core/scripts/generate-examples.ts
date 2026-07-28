/**
 * One-off maintenance script: regenerates the committed files under
 * examples/. Not part of the standard build — run manually after a
 * harmony-core algorithm change to refresh the golden fixtures:
 *
 *   pnpm --filter @duet-maker/harmony-core run generate:examples
 *
 * If the generated arrangements change meaningfully, that's expected after
 * an intentional algorithm change; review the diff before committing it as
 * the new baseline (spec: "음악적 회귀 테스트").
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_VOCAL_RANGE,
  migrateProjectFile,
  type ChordEvent,
  type DuetStyle,
  type NoteEvent,
  type SongSection,
} from "@duet-maker/shared-types";
import { generateDuetArrangement } from "../src/generate.js";
import { exportArrangementToMidi } from "../src/midi-export.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_ROOT = join(__dirname, "..", "..", "..", "examples");

let idCounter = 0;
function id(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function note(pitch: number, startTime: number, duration: number, lyric?: string): NoteEvent {
  return {
    id: id("note"),
    pitch,
    startTime,
    duration,
    velocity: 92,
    lyric,
    confidence: 1,
    source: "user-input",
    editable: true,
  };
}

function chord(
  root: ChordEvent["root"],
  quality: ChordEvent["quality"],
  startTime: number,
  duration: number,
): ChordEvent {
  return {
    id: id("chord"),
    root,
    quality,
    extensions: [],
    startTime,
    duration,
    confidence: 1,
    source: "user-input",
  };
}

function section(
  type: SongSection["type"],
  startTime: number,
  endTime: number,
  overrides: Partial<SongSection> = {},
): SongSection {
  return {
    id: id("section"),
    type,
    startTime,
    endTime,
    energy: 0.5,
    harmonyDensity: 0.6,
    ...overrides,
  };
}

interface DemoSong {
  slug: string;
  name: string;
  key: string;
  bpm: number;
  melody: NoteEvent[];
  chords: ChordEvent[];
  sections: SongSection[];
}

function buildCGAmFDemo(): DemoSong {
  return {
    slug: "c-g-am-f-pop-ballad",
    name: "C-G-Am-F 팝 발라드 예시",
    key: "C major",
    bpm: 96,
    chords: [
      chord("C", "maj", 0, 4),
      chord("G", "maj", 4, 4),
      chord("A", "min", 8, 4),
      chord("F", "maj", 12, 4),
      chord("C", "maj", 16, 4),
      chord("G", "maj", 20, 4),
      chord("A", "min", 24, 4),
      chord("F", "maj", 28, 4),
    ],
    melody: [
      note(64, 0, 2, "그대"),
      note(67, 2, 2, "모습"),
      note(67, 4, 2, "이제"),
      note(71, 6, 2, "는"),
      note(69, 8, 2, "기억"),
      note(72, 10, 2, "속"),
      note(65, 12, 2, "에만"),
      note(69, 14, 2, "남아"),
      note(67, 16, 1.5, "그래"),
      note(72, 17.5, 1.5, "도"),
      note(74, 19, 2, "괜찮"),
      note(72, 21, 1, "아"),
      note(69, 22, 2, "요"),
      note(65, 24, 2, "지금"),
      note(67, 26, 2, "이순"),
      note(71, 28, 4, "간"),
    ],
    sections: [
      section("intro", 0, 4, { energy: 0.2, harmonyDensity: 0.1 }),
      section("verse", 4, 16, { energy: 0.35, harmonyDensity: 0.4 }),
      section("chorus", 16, 24, { energy: 0.75, harmonyDensity: 0.8 }),
      section("finalChorus", 24, 32, { energy: 0.95, harmonyDensity: 0.95 }),
    ],
  };
}

function buildIiVIDemo(): DemoSong {
  return {
    slug: "ii-v-i-jazz-turnaround",
    name: "ii-V-I 재즈 턴어라운드 예시",
    key: "C major",
    bpm: 110,
    chords: [
      chord("D", "min7", 0, 2),
      chord("G", "dom7", 2, 2),
      chord("C", "maj7", 4, 4),
      chord("D", "min7", 8, 2),
      chord("G", "dom7", 10, 2),
      chord("C", "maj7", 12, 4),
    ],
    melody: [
      note(62, 0, 1, "달"),
      note(65, 1, 1, "빛"),
      note(67, 2, 1, "아"),
      note(71, 3, 1, "래"),
      note(72, 4, 2, "우"),
      note(69, 6, 2, "리"),
      note(62, 8, 1, "둘"),
      note(65, 9, 1, "만"),
      note(67, 10, 1, "의"),
      note(69, 11, 1, "밤"),
      note(72, 12, 4, "이야"),
    ],
    sections: [section("bridge", 0, 16, { energy: 0.55, harmonyDensity: 0.6 })],
  };
}

function buildMinorBalladDemo(): DemoSong {
  return {
    slug: "minor-ballad",
    name: "단조 발라드 예시",
    key: "A minor",
    bpm: 72,
    chords: [
      chord("A", "min", 0, 4),
      chord("F", "maj", 4, 4),
      chord("C", "maj", 8, 4),
      chord("G", "maj", 12, 4),
      chord("A", "min", 16, 4),
      chord("F", "maj", 20, 4),
      chord("C", "maj", 24, 4),
      chord("E", "min", 28, 4),
    ],
    melody: [
      note(60, 0, 4, "떠나"),
      note(62, 4, 4, "간"),
      note(64, 8, 4, "너의"),
      note(62, 12, 4, "자리"),
      note(60, 16, 2, "아직"),
      note(59, 18, 2, "도"),
      note(60, 20, 4, "남아"),
      note(64, 24, 4, "있어"),
      note(67, 28, 4, "요"),
    ],
    sections: [
      section("verse", 0, 16, { energy: 0.25, harmonyDensity: 0.3 }),
      section("bridge", 16, 32, { energy: 0.6, harmonyDensity: 0.55 }),
    ],
  };
}

const DEMOS = [buildCGAmFDemo(), buildIiVIDemo(), buildMinorBalladDemo()];
const STYLES: DuetStyle[] = ["cleanPop", "emotional", "dramatic", "trueDuet"];
const SEED = 1;

function main() {
  mkdirSync(join(EXAMPLES_ROOT, "demo-projects"), { recursive: true });
  mkdirSync(join(EXAMPLES_ROOT, "midi"), { recursive: true });
  mkdirSync(join(EXAMPLES_ROOT, "chord-progressions"), { recursive: true });

  for (const demo of DEMOS) {
    const arrangements = STYLES.map((style) =>
      generateDuetArrangement({
        mainMelody: demo.melody,
        chords: demo.chords,
        key: demo.key,
        bpm: demo.bpm,
        sections: demo.sections,
        vocalRange: DEFAULT_VOCAL_RANGE,
        style,
        seed: SEED,
      }),
    );

    const now = new Date().toISOString();
    const project = migrateProjectFile({
      schemaVersion: "1.0.0",
      id: demo.slug,
      name: demo.name,
      createdAt: now,
      updatedAt: now,
      bpm: demo.bpm,
      key: demo.key,
      mainMelody: demo.melody,
      chords: demo.chords,
      sections: demo.sections,
      vocalRange: DEFAULT_VOCAL_RANGE,
      arrangements,
    });
    writeFileSync(
      join(EXAMPLES_ROOT, "demo-projects", `${demo.slug}.json`),
      JSON.stringify(project, null, 2) + "\n",
    );

    writeFileSync(
      join(EXAMPLES_ROOT, "chord-progressions", `${demo.slug}.json`),
      JSON.stringify(
        { key: demo.key, bpm: demo.bpm, chords: demo.chords, sections: demo.sections },
        null,
        2,
      ) + "\n",
    );

    const cleanPop = arrangements.find((a) => a.style === "cleanPop")!;
    const midiBytes = exportArrangementToMidi({
      melody: demo.melody,
      harmonyTrack: cleanPop.harmonyTrack,
      bpm: demo.bpm,
    });
    writeFileSync(join(EXAMPLES_ROOT, "midi", `${demo.slug}-cleanpop-duet.mid`), midiBytes);

    console.log(`Generated example: ${demo.slug}`);
  }
}

main();
