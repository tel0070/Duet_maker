import { sectionTypeSchema, type SongSection } from "@duet-maker/shared-types";
import { useState } from "react";
import { useProjectStore } from "../store/project-store.js";
import "./EditorTable.css";

const TYPES = sectionTypeSchema.options;

export function SectionTable() {
  const sections = useProjectStore((s) => s.project.sections);
  const addSection = useProjectStore((s) => s.addSection);
  const updateSection = useProjectStore((s) => s.updateSection);
  const removeSection = useProjectStore((s) => s.removeSection);
  const regenerateSection = useProjectStore((s) => s.regenerateSection);
  const hasArrangement = useProjectStore((s) => s.currentArrangement() !== null);

  const [draft, setDraft] = useState({
    type: "verse" as SongSection["type"],
    startTime: 0,
    endTime: 8,
    energy: 0.5,
    harmonyDensity: 0.6,
  });

  const sorted = [...sections].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="editor-table">
      <table>
        <thead>
          <tr>
            <th>구간 종류</th>
            <th>시작(박)</th>
            <th>끝(박)</th>
            <th>에너지</th>
            <th>화음 밀도</th>
            <th aria-label="구간 재생성" />
            <th aria-label="삭제" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((section) => (
            <tr key={section.id}>
              <td>
                <select
                  value={section.type}
                  onChange={(e) => updateSection(section.id, { type: e.target.value as SongSection["type"] })}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={section.startTime}
                  onChange={(e) => updateSection(section.id, { startTime: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={section.endTime}
                  onChange={(e) => updateSection(section.id, { endTime: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={section.energy}
                  onChange={(e) => updateSection(section.id, { energy: Number(e.target.value) })}
                  aria-label={`${section.type} 구간 에너지`}
                />
              </td>
              <td>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={section.harmonyDensity}
                  onChange={(e) => updateSection(section.id, { harmonyDensity: Number(e.target.value) })}
                  aria-label={`${section.type} 구간 화음 밀도`}
                />
              </td>
              <td>
                <button
                  type="button"
                  aria-label={`${section.type} 구간만 다시 생성`}
                  title="전체 화음을 한 번 생성한 뒤, 이 구간만 다시 생성합니다. 다른 구간은 그대로 유지됩니다."
                  disabled={!hasArrangement}
                  onClick={() => regenerateSection(section.id)}
                >
                  재생성
                </button>
              </td>
              <td>
                <button type="button" aria-label={`${section.type} 구간 삭제`} onClick={() => removeSection(section.id)}>
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
          addSection(draft);
        }}
      >
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as SongSection["type"] })}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
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
          aria-label="끝 박"
          value={draft.endTime}
          onChange={(e) => setDraft({ ...draft, endTime: Number(e.target.value) })}
        />
        <button type="submit">구간 추가</button>
      </form>
    </div>
  );
}
