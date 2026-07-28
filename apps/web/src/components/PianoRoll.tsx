import type { ChordEvent, HarmonyNote, NoteEvent, RelationToMelody, SongSection } from "@duet-maker/shared-types";
import "./PianoRoll.css";

const PX_PER_BEAT = 28;
const ROW_HEIGHT = 10;
const HEADER_HEIGHT = 44;

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function pitchLabel(pitch: number): string {
  return `${PITCH_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

const SECTION_LABELS_KO: Record<SongSection["type"], string> = {
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

export interface PianoRollProps {
  melody: NoteEvent[];
  harmony?: HarmonyNote[];
  chords: ChordEvent[];
  sections: SongSection[];
  selectedNoteId?: string | null;
  onSelectNote?: (id: string) => void;
}

export function PianoRoll({ melody, harmony, chords, sections, selectedNoteId, onSelectNote }: PianoRollProps) {
  interface RenderedHarmonyNote {
    note: NoteEvent;
    pitch: number;
    relation: RelationToMelody;
  }
  const harmonyByNoteId = new Map((harmony ?? []).map((h) => [h.originalNoteId, h]));
  const harmonyNotes: RenderedHarmonyNote[] = [];
  for (const note of melody) {
    const h = harmonyByNoteId.get(note.id);
    if (!h || h.generatedPitch === null) continue;
    harmonyNotes.push({ note, pitch: h.generatedPitch, relation: h.relationToMelody });
  }

  const allPitches = [...melody.map((n) => n.pitch), ...harmonyNotes.map((h) => h.pitch)];
  const minPitch = allPitches.length ? Math.min(...allPitches) - 2 : 55;
  const maxPitch = allPitches.length ? Math.max(...allPitches) + 2 : 79;
  const endTimes = [
    ...melody.map((n) => n.startTime + n.duration),
    ...chords.map((c) => c.startTime + c.duration),
    ...sections.map((s) => (Number.isFinite(s.endTime) ? s.endTime : 0)),
  ];
  const maxTime = Math.max(4, ...endTimes);

  const width = maxTime * PX_PER_BEAT + 16;
  const height = (maxPitch - minPitch + 1) * ROW_HEIGHT + HEADER_HEIGHT;

  function pitchY(pitch: number): number {
    return (maxPitch - pitch) * ROW_HEIGHT + HEADER_HEIGHT;
  }

  if (melody.length === 0) {
    return <p className="piano-roll-empty">멜로디가 없습니다. 음표를 추가하거나 MIDI 파일을 가져오세요.</p>;
  }

  return (
    <div className="piano-roll-scroll">
      <svg width={width} height={height} role="img" aria-label="메인 멜로디와 생성된 화음 피아노롤">
        {sections.map((section) => {
          const end = Number.isFinite(section.endTime) ? section.endTime : maxTime;
          return (
            <g key={section.id}>
              <rect
                x={section.startTime * PX_PER_BEAT}
                y={0}
                width={(end - section.startTime) * PX_PER_BEAT}
                height={20}
                className="piano-roll-section-band"
              />
              <text x={section.startTime * PX_PER_BEAT + 4} y={14} className="piano-roll-section-label">
                {SECTION_LABELS_KO[section.type]}
              </text>
            </g>
          );
        })}

        {chords.map((chord) => (
          <text
            key={chord.id}
            x={chord.startTime * PX_PER_BEAT + 4}
            y={38}
            className="piano-roll-chord-label"
          >
            {chord.root}
            {chord.quality}
          </text>
        ))}

        {melody.map((note) => (
          <rect
            key={note.id}
            x={note.startTime * PX_PER_BEAT}
            y={pitchY(note.pitch)}
            width={Math.max(2, note.duration * PX_PER_BEAT - 1)}
            height={ROW_HEIGHT - 1}
            tabIndex={0}
            role="button"
            aria-label={`메인 멜로디 음표 ${pitchLabel(note.pitch)}, ${note.startTime}박부터 ${note.duration}박`}
            className={`piano-roll-note piano-roll-note--melody${
              selectedNoteId === note.id ? " piano-roll-note--selected" : ""
            }`}
            onClick={() => onSelectNote?.(note.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectNote?.(note.id);
            }}
          >
            <title>{pitchLabel(note.pitch)}</title>
          </rect>
        ))}

        {harmonyNotes.map(({ note, pitch, relation }) => (
          <g key={`harmony-${note.id}`}>
            <rect
              x={note.startTime * PX_PER_BEAT}
              y={pitchY(pitch)}
              width={Math.max(2, note.duration * PX_PER_BEAT - 1)}
              height={ROW_HEIGHT - 1}
              className="piano-roll-note piano-roll-note--harmony"
            >
              <title>{`두 번째 보컬: ${pitchLabel(pitch)} (${relation})`}</title>
            </rect>
            <text
              x={note.startTime * PX_PER_BEAT + 2}
              y={pitchY(pitch) + ROW_HEIGHT - 2}
              className="piano-roll-harmony-mark"
              aria-hidden="true"
            >
              2
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
