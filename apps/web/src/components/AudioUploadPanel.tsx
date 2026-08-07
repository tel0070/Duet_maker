import { useRef, useState } from "react";
import { isLocalEngineAvailable } from "../lib/local-engine-client.js";
import { useSessionStore } from "../store/session-store.js";
import "./AudioUploadPanel.css";

export function AudioUploadPanel() {
  const status = useSessionStore((s) => s.status);
  const progress = useSessionStore((s) => s.progress);
  const error = useSessionStore((s) => s.error);
  const processFile = useSessionStore((s) => s.processFile);
  const cancel = useSessionStore((s) => s.cancel);

  const [engineAvailable, setEngineAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = status === "processing";

  async function checkAvailability() {
    setChecking(true);
    try {
      setEngineAvailable(await isLocalEngineAvailable());
    } finally {
      setChecking(false);
    }
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
            로컬 엔진에 연결할 수 없습니다. Duet Maker 실행 파일을 먼저 켜주세요.
          </span>
        )}
        {engineAvailable === true && !checking && <span className="audio-upload-ok">로컬 엔진 연결됨</span>}
        <button type="button" onClick={() => void checkAvailability()} disabled={checking}>
          {engineAvailable === null ? "확인" : "다시 확인"}
        </button>
      </div>

      <div className="audio-upload-actions">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!engineAvailable || busy}>
          노래 파일 올리기 (mp3, wav)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="audio-upload-hidden-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
            e.target.value = "";
          }}
        />
        {busy && (
          <button type="button" onClick={cancel}>
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
      <p className="audio-upload-hint">
        보컬을 분리하고 화음을 자동으로 만듭니다. 곡 길이에 따라 몇 분 걸릴 수 있습니다.
      </p>
    </div>
  );
}
