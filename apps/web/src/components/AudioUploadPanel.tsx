import type { ConfidenceScored, NoteEvent, ChordEvent, SongSection } from "@duet-maker/shared-types";
import { useRef, useState } from "react";
import {
  isLocalEngineAvailable,
  LocalEngineAudioAnalysisProvider,
  type FullSongAnalysisResult,
} from "../lib/local-engine-client.js";
import "./AudioUploadPanel.css";

export interface AudioUploadPanelProps {
  onAnalyzed: (analysis: {
    key: string;
    bpm: number;
    melody: Array<ConfidenceScored<NoteEvent>>;
    chords: Array<ConfidenceScored<ChordEvent>>;
    sections: Array<ConfidenceScored<SongSection>>;
  }) => void;
  onStemsReady: (stems: { vocalStemBlob: Blob; instrumentalStemBlob: Blob }) => void;
}

export function AudioUploadPanel({ onAnalyzed, onStemsReady }: AudioUploadPanelProps) {
  const [engineAvailable, setEngineAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; fraction: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const providerRef = useRef<LocalEngineAudioAnalysisProvider | null>(null);

  async function checkAvailability() {
    setChecking(true);
    try {
      setEngineAvailable(await isLocalEngineAvailable());
    } finally {
      setChecking(false);
    }
  }

  // Deliberately not checked automatically on mount: local-engine is
  // optional and usually not running, and probing it unprompted would log
  // a real "Failed to load resource" browser console error on every single
  // editor visit (not something a caught JS exception can suppress) —
  // checking only happens when the user explicitly asks via "다시 확인" or
  // by trying to upload a file.

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    setProgress({ stage: "시작하는 중...", fraction: 0 });

    const provider = new LocalEngineAudioAnalysisProvider();
    providerRef.current = provider;
    const pollTimer = setInterval(() => setProgress(provider.getProgress()), 200);

    try {
      const result: FullSongAnalysisResult = await provider.analyseFull(file);
      onAnalyzed({
        key: result.key,
        bpm: result.bpm,
        melody: result.melody,
        chords: result.chords,
        sections: result.sections,
      });
      onStemsReady({ vocalStemBlob: result.vocalStemBlob, instrumentalStemBlob: result.instrumentalStemBlob });
      setSummary(
        `키 ${result.key} · BPM ${result.bpm} · 멜로디 ${result.melody.length}개 · 코드 ${result.chords.length}개 · ` +
          `구간 ${result.sections.length}개 · 보컬 분리 신뢰도 약 ${Math.round(result.separationConfidence * 100)}% ` +
          "(참고용 추정치입니다)",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "오디오 분석에 실패했습니다.");
    } finally {
      clearInterval(pollTimer);
      setProgress(null);
      setBusy(false);
      providerRef.current = null;
    }
  }

  function handleCancel() {
    providerRef.current?.cancel();
  }

  return (
    <div className="audio-upload-panel">
      <div className="audio-upload-status">
        {engineAvailable === null && !checking && (
          <span>로컬 엔진 연결 상태를 아직 확인하지 않았습니다. "확인" 버튼을 눌러주세요.</span>
        )}
        {checking && <span>로컬 엔진 연결 확인 중...</span>}
        {engineAvailable === false && !checking && (
          <span className="audio-upload-warning">
            로컬 엔진에 연결할 수 없습니다. <code>scripts\start-local-engine.bat</code>을 먼저 실행하세요
            (local-engine/README.md 참고).
          </span>
        )}
        {engineAvailable === true && !checking && <span className="audio-upload-ok">로컬 엔진 연결됨</span>}
        <button type="button" onClick={() => void checkAvailability()} disabled={checking}>
          {engineAvailable === null ? "확인" : "다시 확인"}
        </button>
      </div>

      <div className="audio-upload-actions">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!engineAvailable || busy}>
          오디오 파일 업로드 (mp3, wav 등)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="audio-upload-hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {busy && (
          <button type="button" onClick={handleCancel}>
            취소
          </button>
        )}
      </div>

      {progress && (
        <div className="audio-upload-progress">
          <div className="audio-upload-progress-bar">
            <div className="audio-upload-progress-fill" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
          <span>{progress.stage}</span>
        </div>
      )}

      {error && <p className="audio-upload-error">{error}</p>}
      {summary && <p className="audio-upload-summary">{summary}</p>}
      <p className="audio-upload-hint">
        보컬을 자동으로 분리하고, 멜로디·코드·구간·키·BPM을 분석해 아래 편집기에 채워 넣습니다. 분석 결과는 자동
        추정치이므로 필요하면 아래 표에서 직접 수정하세요.
      </p>
    </div>
  );
}
