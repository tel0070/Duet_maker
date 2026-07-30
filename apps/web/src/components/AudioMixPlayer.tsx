import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";
import { useRef, useState } from "react";
import {
  decodeAudioBlob,
  harmonyToScheduled,
  playAudioBuffer,
  renderMixOffline,
  schedulePlayback,
  type PlaybackHandle,
} from "../lib/audio-engine.js";
import { downloadBlob } from "../lib/download.js";
import { encodeAudioBufferToMp3 } from "../lib/mp3-export.js";
import "./AudioMixPlayer.css";

export interface AudioMixPlayerProps {
  vocalStemBlob: Blob;
  instrumentalStemBlob: Blob;
  melody: NoteEvent[];
  harmony?: HarmonyNote[];
  bpm: number;
}

/**
 * Mixes three independent tracks — the uploaded song's separated vocal
 * stem, its instrumental stem, and the generated harmony (synthesized as a
 * guide tone, same as PlaybackPanel) — with a mute toggle per track so any
 * combination can be heard (e.g. instrumental + harmony only, or vocal +
 * harmony only). Volumes are read once at the moment playback starts, same
 * convention as PlaybackPanel's sliders.
 */
export function AudioMixPlayer({ vocalStemBlob, instrumentalStemBlob, melody, harmony, bpm }: AudioMixPlayerProps) {
  const [vocalMuted, setVocalMuted] = useState(false);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);
  const [harmonyMuted, setHarmonyMuted] = useState(false);
  const [vocalVolume, setVocalVolume] = useState(0.8);
  const [instrumentalVolume, setInstrumentalVolume] = useState(0.8);
  const [harmonyVolume, setHarmonyVolume] = useState(0.6);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const handlesRef = useRef<PlaybackHandle[]>([]);

  const hasHarmony = Boolean(harmony && harmony.some((h) => h.generatedPitch !== null));

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function stop() {
    for (const handle of handlesRef.current) handle.stop();
    handlesRef.current = [];
    setPlaying(false);
  }

  async function play() {
    setError(null);
    stop();
    try {
      const ctx = getAudioContext();
      const [vocalBuffer, instrumentalBuffer] = await Promise.all([
        decodeAudioBlob(ctx, vocalStemBlob),
        decodeAudioBlob(ctx, instrumentalStemBlob),
      ]);
      const startAt = ctx.currentTime + 0.05;
      const handles: PlaybackHandle[] = [];

      if (!vocalMuted) handles.push(playAudioBuffer(ctx, vocalBuffer, { gain: vocalVolume, startAt }));
      if (!instrumentalMuted) handles.push(playAudioBuffer(ctx, instrumentalBuffer, { gain: instrumentalVolume, startAt }));
      if (!harmonyMuted && harmony) {
        const scheduled = harmonyToScheduled(melody, harmony, bpm);
        if (scheduled.length > 0) {
          handles.push(schedulePlayback(ctx, scheduled, "softSynth", { gain: harmonyVolume, startAt }));
        }
      }

      handlesRef.current = handles;
      setPlaying(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "재생에 실패했습니다.");
    }
  }

  async function handleExportMp3() {
    setError(null);
    setExporting(true);
    try {
      const ctx = getAudioContext();
      const [vocalBuffer, instrumentalBuffer] = await Promise.all([
        decodeAudioBlob(ctx, vocalStemBlob),
        decodeAudioBlob(ctx, instrumentalStemBlob),
      ]);
      const rendered = await renderMixOffline({
        melody,
        harmony,
        bpm,
        vocalBuffer: vocalMuted ? null : vocalBuffer,
        instrumentalBuffer: instrumentalMuted ? null : instrumentalBuffer,
        vocalGain: vocalVolume,
        instrumentalGain: instrumentalVolume,
        harmonyGain: harmonyMuted ? 0 : harmonyVolume,
      });
      const mp3Bytes = encodeAudioBufferToMp3(rendered);
      downloadBlob(mp3Bytes, "duet-mix.mp3", "audio/mpeg");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MP3 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="audio-mix-player">
      <div className="audio-mix-row">
        <label className="audio-mix-track">
          <input type="checkbox" checked={!vocalMuted} onChange={(e) => setVocalMuted(!e.target.checked)} />
          원곡 보컬
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={vocalVolume}
            disabled={vocalMuted}
            onChange={(e) => setVocalVolume(Number(e.target.value))}
          />
        </label>
        <label className="audio-mix-track">
          <input type="checkbox" checked={!instrumentalMuted} onChange={(e) => setInstrumentalMuted(!e.target.checked)} />
          반주
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={instrumentalVolume}
            disabled={instrumentalMuted}
            onChange={(e) => setInstrumentalVolume(Number(e.target.value))}
          />
        </label>
        <label className="audio-mix-track">
          <input
            type="checkbox"
            checked={!harmonyMuted}
            disabled={!hasHarmony}
            onChange={(e) => setHarmonyMuted(!e.target.checked)}
          />
          생성된 화음
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={harmonyVolume}
            disabled={harmonyMuted || !hasHarmony}
            onChange={(e) => setHarmonyVolume(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="audio-mix-row">
        <button type="button" onClick={() => void play()}>
          재생
        </button>
        <button type="button" onClick={stop} disabled={!playing}>
          정지
        </button>
        <button type="button" onClick={() => void handleExportMp3()} disabled={exporting}>
          {exporting ? "MP3 내보내는 중..." : "MP3로 내보내기"}
        </button>
      </div>

      {error && <p className="audio-mix-error">{error}</p>}
      <p className="audio-mix-hint">
        체크를 해제하면 해당 트랙이 빠집니다 — 예: 반주와 화음만 체크 해제하면 보컬만, 원곡 보컬을 해제하면 반주 +
        화음만 들을 수 있습니다.
      </p>
    </div>
  );
}
