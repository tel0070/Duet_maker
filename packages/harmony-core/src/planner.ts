import type {
  ArrangementInstruction,
  ChordEvent,
  HarmonyNote,
  NoteEvent,
  RelationToMelody,
  SectionType,
  SongSection,
  VocalRange,
} from "@duet-maker/shared-types";
import { generateCandidates, type HarmonyCandidate } from "./candidates.js";
import { type Key } from "./music-theory.js";
import type { Rng } from "./rng.js";
import { computeMotionType, scoreCandidate, type ScoringContext } from "./scoring.js";
import type { ScoreWeights, StyleProfile } from "./types.js";

function findActiveChord(chords: ChordEvent[], time: number): ChordEvent | null {
  const active = chords.find((c) => time >= c.startTime && time < c.startTime + c.duration);
  if (active) return active;
  const previous = [...chords]
    .filter((c) => c.startTime <= time)
    .sort((a, b) => b.startTime - a.startTime)[0];
  return previous ?? null;
}

function findNextChord(chords: ChordEvent[], time: number): ChordEvent | null {
  const upcoming = [...chords]
    .filter((c) => c.startTime > time)
    .sort((a, b) => a.startTime - b.startTime)[0];
  return upcoming ?? null;
}

const DEFAULT_SECTION: SongSection = {
  id: "__default__",
  type: "verse",
  startTime: 0,
  endTime: Number.POSITIVE_INFINITY,
  energy: 0.5,
  harmonyDensity: 0.5,
};

function findActiveSection(sections: SongSection[], time: number): SongSection {
  return (
    sections.find((s) => time >= s.startTime && time < s.endTime) ?? DEFAULT_SECTION
  );
}

const SECTION_LABELS_KO: Record<SectionType, string> = {
  intro: "인트로",
  verse: "벌스",
  preChorus: "프리코러스",
  chorus: "코러스",
  postChorus: "포스트코러스",
  bridge: "브리지",
  breakdown: "브레이크다운",
  finalChorus: "마지막 코러스",
  outro: "아웃트로",
  custom: "구간",
};

function explainCandidate(candidate: HarmonyCandidate, sectionType: SectionType): string {
  const section = SECTION_LABELS_KO[sectionType];
  switch (candidate.relation) {
    case "rest":
      return `${section}에서는 메인 보컬을 강조하기 위해 두 번째 보컬을 쉬게 했습니다.`;
    case "unison":
      return "가사를 강조하기 위해 유니즌으로 배치했습니다.";
    case "octaveAbove":
      return `${section}의 에너지를 강조하기 위해 옥타브 위 화음을 사용했습니다.`;
    case "octaveBelow":
      return "무게감을 더하기 위해 옥타브 아래 화음을 사용했습니다.";
    case "thirdAbove":
      return "자연스러운 3도 위 화음으로 배치했습니다.";
    case "thirdBelow":
      return "부드러운 3도 아래 화음으로 배치했습니다.";
    case "sixthAbove":
      return "6도 위 화음으로 색을 더했습니다.";
    case "sixthBelow":
      return "6도 아래 화음으로 따뜻한 색을 더했습니다.";
    case "fifthAbove":
    case "fifthBelow":
      return "5도 관계의 화음으로 안정적인 울림을 만들었습니다.";
    case "fourthAbove":
    case "fourthBelow":
      return "4도 관계의 화음으로 배치했습니다.";
    case "commonTone":
      return "이전 화음의 공통음을 유지해 코드가 바뀌어도 자연스럽게 이어지도록 했습니다.";
    case "counterMelody":
      return "독립적인 대선율로 두 번째 성부만의 존재감을 살렸습니다.";
    default:
      return "코드 톤에 맞춰 화음을 배치했습니다.";
  }
}

interface BeamStep {
  candidate: HarmonyCandidate;
  breakdown: Record<keyof ScoreWeights, number>;
  scoreTotal: number;
  noteId: string;
  sectionType: SectionType;
}

interface Beam {
  path: BeamStep[];
  scoreSum: number;
  lastHarmonyPitch: number | null;
  recentRelations: RelationToMelody[];
  recentHarmonyPitches: number[];
}

export interface PlanHarmonyTrackParams {
  melody: NoteEvent[];
  chords: ChordEvent[];
  sections: SongSection[];
  key: Key;
  vocalRange: VocalRange;
  instructionsBySectionId: Map<string, ArrangementInstruction>;
  style: StyleProfile;
  rng: Rng;
}

export interface PlanHarmonyTrackResult {
  harmonyTrack: HarmonyNote[];
  overallScore: number;
  scoreBreakdown: Record<string, number>;
  warnings: string[];
}

export function planHarmonyTrack(params: PlanHarmonyTrackParams): PlanHarmonyTrackResult {
  const { melody, chords, sections, key, vocalRange, instructionsBySectionId, style, rng } = params;
  const sortedMelody = [...melody].sort((a, b) => a.startTime - b.startTime);
  const warnings = new Set<string>();

  let beams: Beam[] = [
    { path: [], scoreSum: 0, lastHarmonyPitch: null, recentRelations: [], recentHarmonyPitches: [] },
  ];

  let prevNote: NoteEvent | null = null;
  for (const note of sortedMelody) {
    const chord = findActiveChord(chords, note.startTime);
    if (!chord) {
      warnings.add(
        "일부 구간에 코드 정보가 없어 스케일 음을 기준으로 화음을 생성했습니다.",
      );
    }
    const nextChord = findNextChord(chords, note.startTime);
    const section = findActiveSection(sections, note.startTime);
    const instruction = instructionsBySectionId.get(section.id) ?? {
      singTogether: false,
      harmonyAbove: true,
      harmonyBelow: false,
      unison: false,
      octave: false,
      rest: false,
      callAndResponse: false,
      counterMelody: false,
      delayedEntry: false,
      repeatPhrase: false,
      sustainedPad: false,
    };

    const densityMultiplier = style.sectionDensityMultiplier[section.type] ?? 1;
    const baseDensity = Math.min(1, Math.max(0, section.harmonyDensity * densityMultiplier));
    const onBeatBonus = Number.isInteger(note.startTime) ? 0.15 : 0;
    const effectiveDensity = Math.min(1, baseDensity + onBeatBonus);
    const shouldHarmonize = rng() < effectiveDensity;

    const restOnly: HarmonyCandidate[] = [{ pitch: null, relation: "rest", chordRole: null }];

    const nextBeams: Beam[] = [];
    for (const beam of beams) {
      // Candidates depend on prevHarmonyPitch, which differs per beam, so
      // the pool is regenerated per beam rather than shared across them.
      const pool = shouldHarmonize
        ? generateCandidates({
            melodyPitch: note.pitch,
            chord,
            key,
            vocalRange,
            prevHarmonyPitch: beam.lastHarmonyPitch,
          })
        : restOnly;

      for (const candidate of pool) {
        const ctx: ScoringContext = {
          melodyPitch: note.pitch,
          prevMelodyPitch: prevNote?.pitch ?? null,
          chord,
          nextChord,
          key,
          vocalRange,
          prevHarmonyPitch: beam.lastHarmonyPitch,
          recentRelations: beam.recentRelations,
          recentHarmonyPitches: beam.recentHarmonyPitches,
          instruction,
          relationPreference: style.relationPreference,
        };
        const scored = scoreCandidate(candidate, ctx, style.weights);
        if (scored.breakdown.range < 0.3 && candidate.pitch !== null) {
          warnings.add("일부 화음이 편안한 음역을 벗어나 조정되었습니다.");
        }

        nextBeams.push({
          path: [
            ...beam.path,
            {
              candidate,
              breakdown: scored.breakdown,
              scoreTotal: scored.total,
              noteId: note.id,
              sectionType: section.type,
            },
          ],
          scoreSum: beam.scoreSum + scored.total,
          lastHarmonyPitch: candidate.pitch,
          recentRelations: [...beam.recentRelations, candidate.relation].slice(-6),
          recentHarmonyPitches:
            candidate.pitch !== null
              ? [...beam.recentHarmonyPitches, candidate.pitch].slice(-6)
              : beam.recentHarmonyPitches,
        });
      }
    }

    nextBeams.sort((a, b) => b.scoreSum - a.scoreSum);
    beams = nextBeams.slice(0, style.beamWidth);
    prevNote = note;
  }

  const best = beams[0];
  if (!best || best.path.length === 0) {
    return { harmonyTrack: [], overallScore: 0, scoreBreakdown: {}, warnings: [] };
  }

  const harmonyTrack: HarmonyNote[] = [];
  const aggregated: Record<string, number> = {};
  let prevMelodyForMotion: number | null = null;
  let prevHarmonyForMotion: number | null = null;

  for (let i = 0; i < best.path.length; i += 1) {
    const step = best.path[i]!;
    const note = sortedMelody[i]!;
    const motionType = computeMotionType(
      prevMelodyForMotion,
      note.pitch,
      prevHarmonyForMotion,
      step.candidate.pitch,
    );

    harmonyTrack.push({
      originalNoteId: step.noteId,
      generatedPitch: step.candidate.pitch,
      relationToMelody: step.candidate.relation,
      chordRole: step.candidate.chordRole ?? "nonChordTone",
      motionType,
      styleReason: explainCandidate(step.candidate, step.sectionType),
      scoreBreakdown: step.breakdown,
      confidence: Math.max(0, Math.min(1, step.scoreTotal)),
    });

    for (const [k, v] of Object.entries(step.breakdown)) {
      aggregated[k] = (aggregated[k] ?? 0) + v;
    }
    prevMelodyForMotion = note.pitch;
    prevHarmonyForMotion = step.candidate.pitch;
  }

  const scoreBreakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(aggregated)) {
    scoreBreakdown[k] = v / best.path.length;
  }

  return {
    harmonyTrack,
    overallScore: best.scoreSum / best.path.length,
    scoreBreakdown,
    warnings: [...warnings],
  };
}
