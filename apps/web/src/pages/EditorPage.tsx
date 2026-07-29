import { useEffect, useRef, useState } from "react";
import { ChordTable } from "../components/ChordTable.js";
import { HarmonyResults } from "../components/HarmonyResults.js";
import { NoteTable } from "../components/NoteTable.js";
import { PianoRoll } from "../components/PianoRoll.js";
import { PlaybackPanel, type PlaybackPanelHandle } from "../components/PlaybackPanel.js";
import { ProjectList } from "../components/ProjectList.js";
import { RecordingPanel, type RecordingPanelHandle } from "../components/RecordingPanel.js";
import { SectionTable } from "../components/SectionTable.js";
import { StylePicker } from "../components/StylePicker.js";
import { Toolbar } from "../components/Toolbar.js";
import { useProjectStore } from "../store/project-store.js";
import "./EditorPage.css";

export function EditorPage() {
  const project = useProjectStore((s) => s.project);
  const setName = useProjectStore((s) => s.setName);
  const setKey = useProjectStore((s) => s.setKey);
  const setBpm = useProjectStore((s) => s.setBpm);
  const generate = useProjectStore((s) => s.generate);
  const reroll = useProjectStore((s) => s.reroll);
  const generationError = useProjectStore((s) => s.generationError);
  const currentArrangement = useProjectStore((s) => s.currentArrangement());
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const hydrated = useProjectStore((s) => s.hydrated);
  const addNote = useProjectStore((s) => s.addNote);
  const updateNote = useProjectStore((s) => s.updateNote);
  const removeNote = useProjectStore((s) => s.removeNote);

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [syncStarting, setSyncStarting] = useState(false);

  const playbackRef = useRef<PlaybackPanelHandle>(null);
  const recordingRef = useRef<RecordingPanelHandle>(null);

  // Runs once on mount to restore the last autosaved project, if any.
  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  const hasMelody = project.mainMelody.length > 0;
  const hasHarmony = Boolean(currentArrangement?.harmonyTrack.some((h) => h.generatedPitch !== null));

  async function playWhileRecording() {
    setSyncStarting(true);
    try {
      const started = await recordingRef.current?.start();
      if (started) {
        if (hasHarmony) {
          playbackRef.current?.playBoth();
        } else {
          playbackRef.current?.playMelody();
        }
      }
    } finally {
      setSyncStarting(false);
    }
  }

  async function stopPlaybackAndRecording() {
    playbackRef.current?.stop();
    await recordingRef.current?.stop();
  }

  if (!hydrated) {
    return <p className="editor-loading">저장된 프로젝트를 불러오는 중...</p>;
  }

  return (
    <div className="editor-page">
      <Toolbar />

      <section className="editor-section">
        <h2>최근 프로젝트</h2>
        <ProjectList />
      </section>

      <section className="editor-section">
        <h2>프로젝트 정보</h2>
        <div className="editor-project-fields">
          <label>
            이름
            <input type="text" value={project.name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            키
            <input type="text" value={project.key} onChange={(e) => setKey(e.target.value)} placeholder="예: C major" />
          </label>
          <label>
            BPM
            <input type="number" min={20} max={300} value={project.bpm} onChange={(e) => setBpm(Number(e.target.value))} />
          </label>
        </div>
      </section>

      <section className="editor-section">
        <h2>멜로디 · 코드 · 구간</h2>
        <PianoRoll
          melody={project.mainMelody}
          harmony={currentArrangement?.harmonyTrack}
          chords={project.chords}
          sections={project.sections}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
          onUpdateNote={updateNote}
          onAddNote={addNote}
          onDeleteNote={(id) => {
            removeNote(id);
            setSelectedNoteId((current) => (current === id ? null : current));
          }}
        />
        <div className="editor-tables-grid">
          <div>
            <h3>멜로디 음표</h3>
            <NoteTable selectedNoteId={selectedNoteId} />
          </div>
          <div>
            <h3>코드 진행</h3>
            <ChordTable />
          </div>
          <div>
            <h3>곡 구간</h3>
            <SectionTable />
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h2>화음 생성</h2>
        <StylePicker />
        <div className="editor-generate-actions">
          <button type="button" onClick={() => generate()}>
            화음 생성
          </button>
          <button type="button" onClick={() => reroll()} disabled={!currentArrangement}>
            다른 결과 보기
          </button>
        </div>
        {generationError && <p className="editor-error">{generationError}</p>}
        <HarmonyResults arrangement={currentArrangement} />
      </section>

      <section className="editor-section">
        <h2>가이드 재생</h2>
        <PlaybackPanel
          ref={playbackRef}
          melody={project.mainMelody}
          harmony={currentArrangement?.harmonyTrack}
          bpm={project.bpm}
        />
      </section>

      <section className="editor-section">
        <h2>녹음</h2>
        <RecordingPanel ref={recordingRef} />
      </section>

      <section className="editor-section">
        <h2>재생하며 녹음</h2>
        <p className="editor-hint">
          위 두 기능을 한 번에 시작하는 편의 버튼입니다. 마이크 녹음을 먼저 시작한 뒤 곧바로 가이드 재생을
          시작합니다 (표본 단위로 정확히 맞춘 동기화는 아닙니다).
        </p>
        <div className="editor-generate-actions">
          <button type="button" onClick={() => void playWhileRecording()} disabled={!hasMelody || syncStarting}>
            재생하며 녹음
          </button>
          <button type="button" onClick={() => void stopPlaybackAndRecording()}>
            재생·녹음 정지
          </button>
        </div>
      </section>
    </div>
  );
}
