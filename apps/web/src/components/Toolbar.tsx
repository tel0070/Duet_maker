import { migrateProjectFile } from "@duet-maker/shared-types";
import { exportArrangementToMidi } from "@duet-maker/harmony-core";
import { useRef, useState } from "react";
import { downloadBlob } from "../lib/download.js";
import { loadSampleProject, SAMPLE_PROJECTS } from "../lib/sample-projects.js";
import { useProjectStore } from "../store/project-store.js";
import "./Toolbar.css";

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const loadSample = useProjectStore((s) => s.loadSampleProject);
  const importProjectFile = useProjectStore((s) => s.importProjectFile);
  const newProject = useProjectStore((s) => s.newProject);
  const importMelodyFile = useProjectStore((s) => s.importMelodyFile);
  const currentArrangement = useProjectStore((s) => s.currentArrangement());
  const importError = useProjectStore((s) => s.importError);

  const [sampleError, setSampleError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const midiInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  async function handleSampleChange(slug: string) {
    if (!slug) return;
    try {
      const sample = await loadSampleProject(slug);
      loadSample(sample);
      setSampleError(null);
    } catch (error) {
      setSampleError(error instanceof Error ? error.message : "샘플을 불러오지 못했습니다.");
    }
  }

  function handleExportMidi() {
    if (!currentArrangement) return;
    const bytes = exportArrangementToMidi({
      melody: project.mainMelody,
      harmonyTrack: currentArrangement.harmonyTrack,
      bpm: project.bpm,
    });
    downloadBlob(bytes, `${project.name || "duet"}.mid`, "audio/midi");
  }

  function handleExportJson() {
    downloadBlob(JSON.stringify(project, null, 2), `${project.name || "duet"}.json`, "application/json");
  }

  async function handleImportJson(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      const parsed = migrateProjectFile(raw);
      importProjectFile(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "프로젝트 파일을 읽을 수 없습니다.");
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <label htmlFor="sample-select">샘플 프로젝트</label>
        <select id="sample-select" defaultValue="" onChange={(e) => handleSampleChange(e.target.value)}>
          <option value="">선택...</option>
          {SAMPLE_PROJECTS.map((sample) => (
            <option key={sample.slug} value={sample.slug}>
              {sample.name}
            </option>
          ))}
        </select>
        {sampleError && <span className="toolbar-error">{sampleError}</span>}
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={() => newProject()}>
          새 프로젝트
        </button>
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={() => midiInputRef.current?.click()}>
          MIDI 멜로디 가져오기
        </button>
        <input
          ref={midiInputRef}
          type="file"
          accept=".mid,.midi,audio/midi"
          className="toolbar-hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importMelodyFile(file);
            e.target.value = "";
          }}
        />
        {importError && <span className="toolbar-error">{importError}</span>}
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={handleExportMidi} disabled={!currentArrangement}>
          MIDI 내보내기
        </button>
        <button type="button" onClick={handleExportJson}>
          프로젝트 JSON 내보내기
        </button>
        <button type="button" onClick={() => jsonInputRef.current?.click()}>
          프로젝트 JSON 가져오기
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          accept="application/json"
          className="toolbar-hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportJson(file);
            e.target.value = "";
          }}
        />
        {jsonError && <span className="toolbar-error">{jsonError}</span>}
      </div>
    </div>
  );
}
