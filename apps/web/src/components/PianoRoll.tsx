import type { ChordEvent, HarmonyNote, NoteEvent, RelationToMelody, SongSection } from "@duet-maker/shared-types";
import { useState } from "react";
import { dragToNotePatch, pxToBeats, pxToPitch, quantizeBeats } from "../lib/piano-roll-geometry.js";
import "./PianoRoll.css";

const PX_PER_BEAT = 28;
const ROW_HEIGHT = 10;
const HEADER_HEIGHT = 44;
/** Below this many pixels of total pointer movement, a press+release counts
 * as a click (select), not a drag. */
const DRAG_THRESHOLD_PX = 3;

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

interface DragSession {
  noteId: string;
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  original: { pitch: number; startTime: number; duration: number };
  moved: boolean;
}

export interface PianoRollProps {
  melody: NoteEvent[];
  harmony?: HarmonyNote[];
  chords: ChordEvent[];
  sections: SongSection[];
  selectedNoteId?: string | null;
  onSelectNote?: (id: string) => void;
  /** Omit to make the roll read-only (no drag, no double-click-to-add). */
  onUpdateNote?: (id: string, patch: Partial<NoteEvent>) => void;
  onAddNote?: (note: { pitch: number; startTime: number; duration: number; velocity: number }) => void;
  onDeleteNote?: (id: string) => void;
}

export function PianoRoll({
  melody,
  harmony,
  chords,
  sections,
  selectedNoteId,
  onSelectNote,
  onUpdateNote,
  onAddNote,
  onDeleteNote,
}: PianoRollProps) {
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [livePatch, setLivePatch] = useState<{ pitch: number; startTime: number; duration: number } | null>(null);

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

  function displayedNote(note: NoteEvent) {
    if (drag && drag.noteId === note.id && livePatch) return livePatch;
    return note;
  }

  function beginDrag(e: React.PointerEvent<SVGRectElement>, note: NoteEvent, mode: "move" | "resize") {
    if (!onUpdateNote || note.editable === false) {
      onSelectNote?.(note.id);
      return;
    }
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      noteId: note.id,
      mode,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      original: { pitch: note.pitch, startTime: note.startTime, duration: note.duration },
      moved: false,
    });
    setLivePatch({ pitch: note.pitch, startTime: note.startTime, duration: note.duration });
  }

  function onDragMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const deltaXPx = e.clientX - drag.startClientX;
    const deltaYPx = e.clientY - drag.startClientY;
    if (Math.abs(deltaXPx) + Math.abs(deltaYPx) > DRAG_THRESHOLD_PX) {
      setDrag({ ...drag, moved: true });
    }
    const patch = dragToNotePatch({
      mode: drag.mode,
      originalPitch: drag.original.pitch,
      originalStartTime: drag.original.startTime,
      originalDuration: drag.original.duration,
      deltaXPx,
      deltaYPx,
      pxPerBeat: PX_PER_BEAT,
      rowHeight: ROW_HEIGHT,
    });
    setLivePatch(patch);
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.moved && livePatch) {
      onUpdateNote?.(drag.noteId, livePatch);
    } else {
      onSelectNote?.(drag.noteId);
    }
    setDrag(null);
    setLivePatch(null);
  }

  function handleBackgroundDoubleClick(e: React.MouseEvent<SVGRectElement>) {
    if (!onAddNote) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const startTime = quantizeBeats(pxToBeats(x, PX_PER_BEAT));
    const pitch = pxToPitch(y - HEADER_HEIGHT, maxPitch, ROW_HEIGHT);
    onAddNote({ pitch, startTime, duration: 1, velocity: 90 });
  }

  if (melody.length === 0) {
    return <p className="piano-roll-empty">멜로디가 없습니다. 음표를 추가하거나 MIDI 파일을 가져오세요.</p>;
  }

  return (
    <div className="piano-roll-scroll">
      <p className="piano-roll-hint">
        {onUpdateNote
          ? "음표를 드래그해 이동하고, 오른쪽 끝을 드래그해 길이를 조절하세요. 빈 곳을 더블클릭하면 음표가 추가되고, 음표를 선택한 뒤 Delete 키로 삭제할 수 있습니다."
          : null}
      </p>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="메인 멜로디와 생성된 화음 피아노롤"
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect
          x={0}
          y={HEADER_HEIGHT}
          width={width}
          height={height - HEADER_HEIGHT}
          fill="transparent"
          onDoubleClick={handleBackgroundDoubleClick}
        />

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

        {melody.map((note) => {
          const shown = displayedNote(note);
          const noteWidthPx = Math.max(2, shown.duration * PX_PER_BEAT - 1);
          return (
            <g key={note.id}>
              <rect
                x={shown.startTime * PX_PER_BEAT}
                y={pitchY(shown.pitch)}
                width={noteWidthPx}
                height={ROW_HEIGHT - 1}
                tabIndex={0}
                role="button"
                aria-label={`메인 멜로디 음표 ${pitchLabel(shown.pitch)}, ${shown.startTime}박부터 ${shown.duration}박`}
                className={`piano-roll-note piano-roll-note--melody${
                  selectedNoteId === note.id ? " piano-roll-note--selected" : ""
                }`}
                onPointerDown={(e) => beginDrag(e, note, "move")}
                onClick={() => {
                  if (!onUpdateNote) onSelectNote?.(note.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectNote?.(note.id);
                  if ((e.key === "Delete" || e.key === "Backspace") && onDeleteNote) {
                    e.preventDefault();
                    onDeleteNote(note.id);
                  }
                }}
              >
                <title>{pitchLabel(shown.pitch)}</title>
              </rect>
              {onUpdateNote && note.editable !== false && (
                <rect
                  x={shown.startTime * PX_PER_BEAT + noteWidthPx - 3}
                  y={pitchY(shown.pitch)}
                  width={4}
                  height={ROW_HEIGHT - 1}
                  className="piano-roll-resize-handle"
                  onPointerDown={(e) => beginDrag(e, note, "resize")}
                >
                  <title>드래그해서 길이 조절</title>
                </rect>
              )}
            </g>
          );
        })}

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
