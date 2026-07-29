import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { downloadBlob } from "../lib/download.js";
import { createRecordingSession, requestMicrophoneStream, type RecordingHandle } from "../lib/recorder.js";
import "./RecordingPanel.css";

export interface RecordingPanelHandle {
  /** Starts recording. Resolves to `true` if recording actually started,
   * `false` if it failed (e.g. permission denied) — the failure reason is
   * shown in this panel's own error text either way. */
  start: () => Promise<boolean>;
  stop: () => Promise<void>;
}

/**
 * Microphone recording. Exposes `start`/`stop` via `ref` so a parent (see
 * EditorPage's "재생하며 녹음") can trigger recording together with guide
 * playback as one combined action, in addition to this panel's own
 * standalone buttons. See docs/DECISIONS.md for why that combination isn't
 * sample-accurate audio-graph sync, just a single click starting both.
 */
export const RecordingPanel = forwardRef<RecordingPanelHandle>(function RecordingPanel(_props, ref) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const handleRef = useRef<RecordingHandle | null>(null);
  const blobRef = useRef<Blob | null>(null);

  async function startRecording(): Promise<boolean> {
    setError(null);
    try {
      const stream = await requestMicrophoneStream();
      handleRef.current = createRecordingSession(stream);
      setIsRecording(true);
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "마이크에 접근할 수 없습니다.");
      return false;
    }
  }

  async function stopRecording() {
    const handle = handleRef.current;
    if (!handle) return;
    handleRef.current = null;
    const blob = await handle.stop();
    blobRef.current = blob;
    setRecordingUrl(URL.createObjectURL(blob));
    setIsRecording(false);
  }

  function downloadRecording() {
    if (!blobRef.current) return;
    downloadBlob(blobRef.current, "recording.webm");
  }

  useImperativeHandle(ref, () => ({
    start: startRecording,
    stop: stopRecording,
  }));

  return (
    <div className="recording-panel">
      <div className="recording-row">
        <button type="button" onClick={() => void startRecording()} disabled={isRecording}>
          녹음 시작
        </button>
        <button type="button" onClick={() => void stopRecording()} disabled={!isRecording}>
          녹음 정지
        </button>
        <button type="button" onClick={downloadRecording} disabled={!recordingUrl}>
          녹음 파일 내보내기
        </button>
      </div>
      {error && <p className="recording-error">{error}</p>}
      <p className="recording-status" aria-live="polite">
        {isRecording ? "녹음 중..." : "녹음 중이 아닙니다."}
      </p>
      {recordingUrl && <audio controls src={recordingUrl} className="recording-audio" />}
      <p className="recording-hint">
        마이크 권한이 필요합니다. 녹음 파일은 브라우저에만 저장되며 서버로 전송되지 않습니다.
      </p>
    </div>
  );
});
