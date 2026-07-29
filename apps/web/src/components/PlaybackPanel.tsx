import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";
import { useRef, useState } from "react";
import {
  harmonyToScheduled,
  notesToScheduled,
  schedulePlayback,
  type GuideVoice,
  type PlaybackHandle,
  type ScheduledNote,
} from "../lib/audio-engine.js";
import "./PlaybackPanel.css";

const VOICE_LABELS: Record<GuideVoice, string> = {
  piano: "피아노",
  softSynth: "신시사이저",
  choirPad: "합창 패드",
  humming: "허밍",
};

function totalDurationSeconds(notes: ScheduledNote[], rate: number): number {
  if (notes.length === 0) return 0;
  return Math.max(...notes.map((n) => n.startTime + n.duration)) / rate;
}

export interface PlaybackPanelProps {
  melody: NoteEvent[];
  harmony?: HarmonyNote[];
  bpm: number;
}

/**
 * Guide-audio playback only — piano/synth/choir-pad/humming oscillator
 * tones, not a natural-voice synthesizer (see AGENTS.md / docs/PRIVACY.md
 * for why: no model, no network, and no claim of realism beyond what a
 * few Web Audio oscillators actually produce).
 */
export function PlaybackPanel({ melody, harmony, bpm }: PlaybackPanelProps) {
  const [voice, setVoice] = useState<GuideVoice>("piano");
  const [melodyVolume, setMelodyVolume] = useState(0.6);
  const [harmonyVolume, setHarmonyVolume] = useState(0.6);
  const [rate, setRate] = useState(1);
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeHandlesRef = useRef<PlaybackHandle[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  function stopAll() {
    for (const handle of activeHandlesRef.current) handle.stop();
    activeHandlesRef.current = [];
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    setPlayingLabel(null);
  }

  function armAutoStop(durationSeconds: number) {
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = setTimeout(() => {
      activeHandlesRef.current = [];
      setPlayingLabel(null);
    }, durationSeconds * 1000 + 150);
  }

  function playMelodyOnly() {
    stopAll();
    const ctx = getAudioContext();
    const scheduled = notesToScheduled(melody, bpm);
    const handle = schedulePlayback(ctx, scheduled, voice, { gain: melodyVolume, playbackRate: rate });
    activeHandlesRef.current = [handle];
    setPlayingLabel("메인 멜로디");
    armAutoStop(totalDurationSeconds(scheduled, rate));
  }

  function playHarmonyOnly() {
    if (!harmony) return;
    stopAll();
    const ctx = getAudioContext();
    const scheduled = harmonyToScheduled(melody, harmony, bpm);
    const handle = schedulePlayback(ctx, scheduled, voice, { gain: harmonyVolume, playbackRate: rate });
    activeHandlesRef.current = [handle];
    setPlayingLabel("두 번째 보컬");
    armAutoStop(totalDurationSeconds(scheduled, rate));
  }

  function playBoth() {
    if (!harmony) return;
    stopAll();
    const ctx = getAudioContext();
    const startAt = ctx.currentTime + 0.05;
    const melodyScheduled = notesToScheduled(melody, bpm);
    const harmonyScheduled = harmonyToScheduled(melody, harmony, bpm);
    const melodyHandle = schedulePlayback(ctx, melodyScheduled, voice, {
      gain: melodyVolume,
      playbackRate: rate,
      startAt,
    });
    const harmonyHandle = schedulePlayback(ctx, harmonyScheduled, voice, {
      gain: harmonyVolume,
      playbackRate: rate,
      startAt,
    });
    activeHandlesRef.current = [melodyHandle, harmonyHandle];
    setPlayingLabel("메인 멜로디 + 두 번째 보컬");
    armAutoStop(Math.max(totalDurationSeconds(melodyScheduled, rate), totalDurationSeconds(harmonyScheduled, rate)));
  }

  const hasHarmony = Boolean(harmony && harmony.some((h) => h.generatedPitch !== null));
  const hasMelody = melody.length > 0;

  return (
    <div className="playback-panel">
      <div className="playback-row">
        <label>
          가이드 음색
          <select value={voice} onChange={(e) => setVoice(e.target.value as GuideVoice)}>
            {Object.entries(VOICE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          재생 속도
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
          </select>
        </label>
      </div>

      <div className="playback-row">
        <label>
          메인 멜로디 볼륨
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={melodyVolume}
            onChange={(e) => setMelodyVolume(Number(e.target.value))}
          />
        </label>
        <label>
          두 번째 보컬 볼륨
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={harmonyVolume}
            onChange={(e) => setHarmonyVolume(Number(e.target.value))}
            disabled={!hasHarmony}
          />
        </label>
      </div>

      <div className="playback-row">
        <button type="button" onClick={playMelodyOnly} disabled={!hasMelody}>
          메인 멜로디만 재생
        </button>
        <button type="button" onClick={playHarmonyOnly} disabled={!hasHarmony}>
          두 번째 보컬만 재생
        </button>
        <button type="button" onClick={playBoth} disabled={!hasMelody || !hasHarmony}>
          함께 재생
        </button>
        <button type="button" onClick={stopAll} disabled={!playingLabel}>
          정지
        </button>
      </div>

      <p className="playback-status" aria-live="polite">
        {playingLabel ? `재생 중: ${playingLabel}` : "재생 중인 트랙이 없습니다."}
      </p>
    </div>
  );
}
