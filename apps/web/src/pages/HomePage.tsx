import { exportArrangementToMidi } from "@duet-maker/harmony-core";
import { AudioMixPlayer } from "../components/AudioMixPlayer.js";
import { AudioUploadPanel } from "../components/AudioUploadPanel.js";
import { downloadBlob } from "../lib/download.js";
import { useSessionStore } from "../store/session-store.js";
import "./HomePage.css";

export function HomePage() {
  const status = useSessionStore((s) => s.status);
  const arrangement = useSessionStore((s) => s.arrangement);
  const melody = useSessionStore((s) => s.melody);
  const bpm = useSessionStore((s) => s.bpm);
  const vocalStemBlob = useSessionStore((s) => s.vocalStemBlob);
  const instrumentalStemBlob = useSessionStore((s) => s.instrumentalStemBlob);
  const reset = useSessionStore((s) => s.reset);

  const ready = status === "ready" && arrangement && vocalStemBlob && instrumentalStemBlob;

  function handleDownloadMidi() {
    if (!arrangement) return;
    const bytes = exportArrangementToMidi({ melody, harmonyTrack: arrangement.harmonyTrack, bpm });
    downloadBlob(bytes, "duet-harmony.mid", "audio/midi");
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>Duet Maker</h1>
        <p>노래 파일을 올리면 화음을 자동으로 만들어 드려요.</p>
      </header>

      <section className="home-section">
        <AudioUploadPanel />
      </section>

      {ready && (
        <section className="home-section">
          <h2>결과</h2>
          <AudioMixPlayer
            vocalStemBlob={vocalStemBlob}
            instrumentalStemBlob={instrumentalStemBlob}
            melody={melody}
            harmony={arrangement.harmonyTrack}
            bpm={bpm}
          />
          <div className="home-midi-row">
            <button type="button" onClick={handleDownloadMidi}>
              화음 MIDI 다운로드
            </button>
            <button type="button" onClick={reset}>
              다른 곡으로 다시 하기
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
