import { useState } from "react";
import { useProjectStore } from "../store/project-store.js";
import "./EditorTable.css";

export interface NoteTableProps {
  selectedNoteId?: string | null;
}

export function NoteTable({ selectedNoteId }: NoteTableProps) {
  const notes = useProjectStore((s) => s.project.mainMelody);
  const addNote = useProjectStore((s) => s.addNote);
  const updateNote = useProjectStore((s) => s.updateNote);
  const removeNote = useProjectStore((s) => s.removeNote);

  const [draft, setDraft] = useState({ pitch: 67, startTime: 0, duration: 1, velocity: 90, lyric: "" });

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="editor-table">
      <table>
        <thead>
          <tr>
            <th>음높이(MIDI)</th>
            <th>시작(박)</th>
            <th>길이(박)</th>
            <th>가사</th>
            <th aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((note) => (
            <tr key={note.id} className={note.id === selectedNoteId ? "editor-table-row--selected" : ""}>
              <td>
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={note.pitch}
                  disabled={!note.editable}
                  onChange={(e) => updateNote(note.id, { pitch: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step={0.25}
                  value={note.startTime}
                  disabled={!note.editable}
                  onChange={(e) => updateNote(note.id, { startTime: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={note.duration}
                  disabled={!note.editable}
                  onChange={(e) => updateNote(note.id, { duration: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={note.lyric ?? ""}
                  disabled={!note.editable}
                  onChange={(e) => updateNote(note.id, { lyric: e.target.value })}
                />
              </td>
              <td>
                <button type="button" aria-label="음표 삭제" onClick={() => removeNote(note.id)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        className="editor-table-add-form"
        onSubmit={(e) => {
          e.preventDefault();
          addNote({ ...draft, lyric: draft.lyric || undefined });
        }}
      >
        <input
          type="number"
          aria-label="음높이(MIDI)"
          min={0}
          max={127}
          value={draft.pitch}
          onChange={(e) => setDraft({ ...draft, pitch: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="시작 박"
          step={0.25}
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="길이(박)"
          min={0.25}
          step={0.25}
          value={draft.duration}
          onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
        />
        <input
          type="text"
          aria-label="가사"
          placeholder="가사 (선택)"
          value={draft.lyric}
          onChange={(e) => setDraft({ ...draft, lyric: e.target.value })}
        />
        <button type="submit">음표 추가</button>
      </form>
    </div>
  );
}
