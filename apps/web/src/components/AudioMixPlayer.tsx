import type { HarmonyNote } from "@duet-maker/shared-types";
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
import type { MelodyNote } from "../lib/local-engine-client.js";
import { encodeAudioBufferToMp3 } from "../lib/mp3-export.js";
import "./AudioMixPlayer.css";

export type MixMode = "instrumentalHarmony" | "instrumentalHarmonyVocal";

export interface AudioMixPlayerProps {
  vocalStemBlob: Blob;
  instrumentalStemBlob: Blob;
  melody: MelodyNote[];
  harmony: HarmonyNote[];
  /** The real detected beat-time map, not a single bpm — used as a
   * fallback for any melody note missing its own exact real-world
   * timestamp (see MelodyNote/beatsToSecondsWithMap). Real recorded audio
   * needs to stay locked to the song's actual tempo either way. */
  beatTimes: number[];
}

const MODES: { id: MixMode; label: string; fileSuffix: string }[] = [
  { id: "instrumentalHarmony", label: "반주 + 화음", fileSuffix: "instrumental-harmony" },
  { id: "instrumentalHarmonyVocal", label: "반주 + 화음 + 원곡 보컬", fileSuffix: "instrumental-harmony-vocal" },
];

/**
 * Two fixed presets instead of the old per-track mute checkboxes + volume
 * sliders — that flexibility was exactly the kind of "왜 이게 있는지 모르겠음"
 * clutter this app got rewritten to remove. Both presets always include the
 * generated harmony and the instrumental; the only choice is whether the
 * original vocal is in the mix too.
 */
export function AudioMixPlayer({
  vocalStemBlob,
  instrumentalStemBlob,
  melody,
  harmony,
  beatTimes,
}: AudioMixPlayerProps) {
  const [playingMode, setPlayingMode] = useState<MixMode | null>(null);
  const [exportingMode, setExportingMode] = useState<MixMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const handlesRef = useRef<PlaybackHandle[]>([]);

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  function stop() {
    for (const handle of handlesRef.current) handle.stop();
    handlesRef.current = [];
    setPlayingMode(null);
  }

  async function play(mode: MixMode) {
    setError(null);
    stop();
    try {
      const ctx = getAudioContext();
      const [instrumentalBuffer, vocalBuffer] = await Promise.all([
        decodeAudioBlob(ctx, instrumentalStemBlob),
        mode === "instrumentalHarmonyVocal" ? decodeAudioBlob(ctx, vocalStemBlob) : Promise.resolve(null),
      ]);
      const startAt = ctx.currentTime + 0.05;
      const handles: PlaybackHandle[] = [playAudioBuffer(ctx, instrumentalBuffer, { gain: 0.8, startAt })];

      if (vocalBuffer) handles.push(playAudioBuffer(ctx, vocalBuffer, { gain: 0.8, startAt }));

      const scheduled = harmonyToScheduled(melody, harmony, beatTimes);
      if (scheduled.length > 0) {
        handles.push(schedulePlayback(ctx, scheduled, "softSynth", { gain: 0.6, startAt }));
      }

      handlesRef.current = handles;
      setPlayingMode(mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "재생에 실패했습니다.");
    }
  }

  async function handleExportMp3(mode: MixMode) {
    setError(null);
    setExportingMode(mode);
    try {
      const ctx = getAudioContext();
      const [instrumentalBuffer, vocalBuffer] = await Promise.all([
        decodeAudioBlob(ctx, instrumentalStemBlob),
        mode === "instrumentalHarmonyVocal" ? decodeAudioBlob(ctx, vocalStemBlob) : Promise.resolve(null),
      ]);
      const rendered = await renderMixOffline({
        melody,
        harmony,
        bpm: beatTimes,
        vocalBuffer,
        instrumentalBuffer,
        vocalGain: 0.8,
        instrumentalGain: 0.8,
        harmonyGain: 0.6,
      });
      const mp3Bytes = encodeAudioBufferToMp3(rendered);
      const suffix = MODES.find((m) => m.id === mode)?.fileSuffix ?? mode;
      downloadBlob(mp3Bytes, `duet-${suffix}.mp3`, "audio/mpeg");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MP3 내보내기에 실패했습니다.");
    } finally {
      setExportingMode(null);
    }
  }

  return (
    <div className="audio-mix-player">
      {MODES.map((mode) => (
        <div key={mode.id} className="audio-mix-mode">
          <span className="audio-mix-mode-label">{mode.label}</span>
          <div className="audio-mix-mode-actions">
            {playingMode === mode.id ? (
              <button type="button" onClick={stop}>
                정지
              </button>
            ) : (
              <button type="button" onClick={() => void play(mode.id)}>
                재생
              </button>
            )}
            <button type="button" onClick={() => void handleExportMp3(mode.id)} disabled={exportingMode !== null}>
              {exportingMode === mode.id ? "저장하는 중..." : "MP3로 저장"}
            </button>
          </div>
        </div>
      ))}

      {error && <p className="audio-mix-error">{error}</p>}
    </div>
  );
}
