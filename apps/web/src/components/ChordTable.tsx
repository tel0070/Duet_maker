import { chordQualitySchema, pitchClassSchema, type ChordEvent } from "@duet-maker/shared-types";
import { useState } from "react";
import { useProjectStore } from "../store/project-store.js";
import "./EditorTable.css";

const ROOTS = pitchClassSchema.options;
const QUALITIES = chordQualitySchema.options;

export function ChordTable() {
  const chords = useProjectStore((s) => s.project.chords);
  const addChord = useProjectStore((s) => s.addChord);
  const updateChord = useProjectStore((s) => s.updateChord);
  const removeChord = useProjectStore((s) => s.removeChord);

  const [draft, setDraft] = useState({ root: "C" as ChordEvent["root"], quality: "maj" as ChordEvent["quality"], startTime: 0, duration: 4 });

  const sorted = [...chords].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="editor-table">
      <table>
        <thead>
          <tr>
            <th>루트</th>
            <th>종류</th>
            <th>시작(박)</th>
            <th>길이(박)</th>
            <th aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((chord) => (
            <tr key={chord.id}>
              <td>
                <select value={chord.root} onChange={(e) => updateChord(chord.id, { root: e.target.value as ChordEvent["root"] })}>
                  {ROOTS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={chord.quality}
                  onChange={(e) => updateChord(chord.id, { quality: e.target.value as ChordEvent["quality"] })}
                >
                  {QUALITIES.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={chord.startTime}
                  onChange={(e) => updateChord(chord.id, { startTime: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={chord.duration}
                  onChange={(e) => updateChord(chord.id, { duration: Number(e.target.value) })}
                />
              </td>
              <td>
                <button type="button" aria-label={`${chord.root}${chord.quality} 코드 삭제`} onClick={() => removeChord(chord.id)}>
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
          addChord({ ...draft, extensions: [] });
        }}
      >
        <select value={draft.root} onChange={(e) => setDraft({ ...draft, root: e.target.value as ChordEvent["root"] })}>
          {ROOTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={draft.quality}
          onChange={(e) => setDraft({ ...draft, quality: e.target.value as ChordEvent["quality"] })}
        >
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <input
          type="number"
          aria-label="시작 박"
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: Number(e.target.value) })}
        />
        <input
          type="number"
          min={0.25}
          step={0.25}
          aria-label="길이(박)"
          value={draft.duration}
          onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
        />
        <button type="submit">코드 추가</button>
      </form>
    </div>
  );
}
