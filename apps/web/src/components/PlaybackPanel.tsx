import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";
import { useRef, useState } from "react";
import {
  beatsToSeconds,
  harmonyToScheduled,
  notesToScheduled,
  scheduleCountIn,
  schedulePlayback,
  sliceScheduledToRegion,
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

const COUNT_IN_BEATS = 4;

type TrackKind = "melody" | "harmony" | "both";

const TRACK_LABELS: Record<TrackKind, string> = {
  melody: "메인 멜로디",
  harmony: "두 번째 보컬",
  both: "메인 멜로디 + 두 번째 보컬",
};

function totalDurationSeconds(notes: ScheduledNote[], rate: number): number {
  if (notes.length === 0) return 0;
  return Math.max(...notes.map((n) => n.startTime + n.duration)) / rate;
}

function totalMelodyBeats(notes: NoteEvent[]): number {
  if (notes.length === 0) return 0;
  return Math.max(...notes.map((n) => n.startTime + n.duration));
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

  const [countInEnabled, setCountInEnabled] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(() => Math.max(4, Math.round(totalMelodyBeats(melody))));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const countInHandleRef = useRef<PlaybackHandle | null>(null);
  const loopHandlesRef = useRef<PlaybackHandle[]>([]);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopGenerationRef = useRef(0);
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
    loopGenerationRef.current += 1;
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = null;
    countInHandleRef.current?.stop();
    countInHandleRef.current = null;
    for (const handle of loopHandlesRef.current) handle.stop();
    loopHandlesRef.current = [];
    setPlayingLabel(null);
  }

  function armAutoStop(durationSeconds: number) {
    autoStopTimerRef.current = setTimeout(() => {
      loopHandlesRef.current = [];
      setPlayingLabel(null);
    }, durationSeconds * 1000 + 150);
  }

  function play(kind: TrackKind) {
    if ((kind === "harmony" || kind === "both") && !harmony) return;
    stopAll();
    const ctx = getAudioContext();
    const generation = loopGenerationRef.current;

    const fullMelody = kind !== "harmony" ? notesToScheduled(melody, bpm) : [];
    const fullHarmony = kind !== "melody" && harmony ? harmonyToScheduled(melody, harmony, bpm) : [];

    const regionStartSeconds = loopEnabled ? beatsToSeconds(loopStartBeat, bpm) : 0;
    const regionEndSeconds = loopEnabled
      ? beatsToSeconds(loopEndBeat, bpm)
      : Math.max(totalDurationSeconds(fullMelody, 1), totalDurationSeconds(fullHarmony, 1));
    const regionDurationSeconds = Math.max(0, regionEndSeconds - regionStartSeconds);

    const melodyRegion = loopEnabled
      ? sliceScheduledToRegion(fullMelody, regionStartSeconds, regionEndSeconds)
      : fullMelody;
    const harmonyRegion = loopEnabled
      ? sliceScheduledToRegion(fullHarmony, regionStartSeconds, regionEndSeconds)
      : fullHarmony;

    const countInSeconds = countInEnabled ? (beatsToSeconds(COUNT_IN_BEATS, bpm) / rate) : 0;
    const firstStartAt = ctx.currentTime + 0.05 + countInSeconds;

    if (countInEnabled) {
      countInHandleRef.current = scheduleCountIn(ctx, COUNT_IN_BEATS, bpm, rate, firstStartAt);
    }

    const scheduleIteration = (startAt: number) => {
      if (generation !== loopGenerationRef.current) return;
      const handles: PlaybackHandle[] = [];
      if (melodyRegion.length > 0) {
        handles.push(schedulePlayback(ctx, melodyRegion, voice, { gain: melodyVolume, playbackRate: rate, startAt }));
      }
      if (harmonyRegion.length > 0) {
        handles.push(schedulePlayback(ctx, harmonyRegion, voice, { gain: harmonyVolume, playbackRate: rate, startAt }));
      }
      loopHandlesRef.current = handles;

      if (loopEnabled && regionDurationSeconds > 0) {
        const iterationMs = (regionDurationSeconds / rate) * 1000;
        loopTimerRef.current = setTimeout(() => scheduleIteration(startAt + regionDurationSeconds / rate), iterationMs);
      }
    };

    scheduleIteration(firstStartAt);

    const label = loopEnabled ? `${TRACK_LABELS[kind]} (구간 반복: ${loopStartBeat}~${loopEndBeat}비트)` : TRACK_LABELS[kind];
    setPlayingLabel(label);

    if (!loopEnabled) {
      armAutoStop(countInSeconds + Math.max(totalDurationSeconds(melodyRegion, rate), totalDurationSeconds(harmonyRegion, rate)));
    }
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
        <label className="playback-checkbox">
          <input type="checkbox" checked={countInEnabled} onChange={(e) => setCountInEnabled(e.target.checked)} />
          카운트인 ({COUNT_IN_BEATS}비트)
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
        <label className="playback-checkbox">
          <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
          구간 반복 (A-B 루프)
        </label>
        <label>
          시작(비트)
          <input
            type="number"
            min={0}
            step={1}
            value={loopStartBeat}
            disabled={!loopEnabled}
            onChange={(e) => setLoopStartBeat(Math.max(0, Math.min(Number(e.target.value), loopEndBeat - 1)))}
          />
        </label>
        <label>
          끝(비트)
          <input
            type="number"
            min={loopStartBeat + 1}
            step={1}
            value={loopEndBeat}
            disabled={!loopEnabled}
            onChange={(e) => setLoopEndBeat(Math.max(loopStartBeat + 1, Number(e.target.value)))}
          />
        </label>
      </div>

      <div className="playback-row">
        <button type="button" onClick={() => play("melody")} disabled={!hasMelody}>
          메인 멜로디만 재생
        </button>
        <button type="button" onClick={() => play("harmony")} disabled={!hasHarmony}>
          두 번째 보컬만 재생
        </button>
        <button type="button" onClick={() => play("both")} disabled={!hasMelody || !hasHarmony}>
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
