import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";

export type GuideVoice = "piano" | "softSynth" | "choirPad" | "humming";

export function midiToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export interface ScheduledNote {
  frequency: number;
  /** Seconds, relative to playback start (not `ctx.currentTime`). */
  startTime: number;
  duration: number;
  /** 0-127, mirrors the source NoteEvent's velocity. */
  velocity: number;
}

export function notesToScheduled(notes: NoteEvent[], bpm: number): ScheduledNote[] {
  return notes.map((n) => ({
    frequency: midiToFrequency(n.pitch),
    startTime: beatsToSeconds(n.startTime, bpm),
    duration: beatsToSeconds(n.duration, bpm),
    velocity: n.velocity,
  }));
}

/** Rests (`generatedPitch: null`) and notes missing their source melody note are skipped. */
export function harmonyToScheduled(melody: NoteEvent[], harmony: HarmonyNote[], bpm: number): ScheduledNote[] {
  const melodyById = new Map(melody.map((n) => [n.id, n]));
  const scheduled: ScheduledNote[] = [];
  for (const h of harmony) {
    if (h.generatedPitch === null) continue;
    const source = melodyById.get(h.originalNoteId);
    if (!source) continue;
    scheduled.push({
      frequency: midiToFrequency(h.generatedPitch),
      startTime: beatsToSeconds(source.startTime, bpm),
      duration: beatsToSeconds(source.duration, bpm),
      velocity: source.velocity,
    });
  }
  return scheduled;
}

interface VoiceEnvelope {
  oscType: OscillatorType;
  /** Seconds to reach peak gain. */
  attack: number;
  /** Seconds before the note ends to start releasing to 0. */
  release: number;
  /** Fraction of peak gain held during the sustain phase (0-1). */
  sustainLevel: number;
}

/**
 * Deliberately simple, clearly-synthetic timbres — this is a rehearsal
 * guide, not a claim of natural instrument/voice sound. See AGENTS.md:
 * never present a placeholder as if it were higher-fidelity than it is.
 */
const VOICE_ENVELOPES: Record<GuideVoice, VoiceEnvelope> = {
  piano: { oscType: "triangle", attack: 0.004, release: 0.3, sustainLevel: 0.15 },
  softSynth: { oscType: "sawtooth", attack: 0.04, release: 0.2, sustainLevel: 0.55 },
  choirPad: { oscType: "sine", attack: 0.22, release: 0.5, sustainLevel: 0.75 },
  humming: { oscType: "sine", attack: 0.08, release: 0.25, sustainLevel: 0.65 },
};

export interface SchedulePlaybackOptions {
  /** Peak linear gain for the loudest note (velocity 127), 0-1. Default 0.5. */
  gain?: number;
  /** 1 = normal speed, 0.5 = half speed, etc. Default 1. */
  playbackRate?: number;
  /** `ctx.currentTime`-relative moment playback should begin. Pass the
   * same value to two calls (melody + harmony) to keep them in sync;
   * defaults to `ctx.currentTime + 0.05` (a small safety margin so the
   * very first note isn't scheduled in the past). */
  startAt?: number;
}

export interface PlaybackHandle {
  stop: () => void;
}

/**
 * Schedules one Web-Audio oscillator+envelope per note. Returns immediately
 * (scheduling is sample-accurate via AudioParam automation, not driven by
 * JS timers) with a handle that fades out and stops anything still
 * sounding.
 */
export function schedulePlayback(
  ctx: AudioContext,
  notes: ScheduledNote[],
  voice: GuideVoice,
  options: SchedulePlaybackOptions = {},
): PlaybackHandle {
  const envelope = VOICE_ENVELOPES[voice];
  const gainValue = options.gain ?? 0.5;
  const rate = options.playbackRate ?? 1;
  const startAt = options.startAt ?? ctx.currentTime + 0.05;

  const active: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  for (const note of notes) {
    if (note.duration <= 0) continue;
    const t0 = startAt + note.startTime / rate;
    const dur = Math.max(0.05, note.duration / rate);
    const peak = gainValue * Math.max(0, Math.min(1, note.velocity / 127));

    const osc = ctx.createOscillator();
    osc.type = envelope.oscType;
    osc.frequency.setValueAtTime(note.frequency, t0);

    const gainNode = ctx.createGain();
    const attackEnd = t0 + Math.min(envelope.attack, dur / 2);
    const releaseStart = Math.max(attackEnd, t0 + dur - envelope.release);
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, attackEnd);
    gainNode.gain.linearRampToValueAtTime(peak * envelope.sustainLevel, releaseStart);
    gainNode.gain.linearRampToValueAtTime(0, t0 + dur);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    active.push({ osc, gain: gainNode });
  }

  return {
    stop: () => {
      const now = ctx.currentTime;
      for (const { osc, gain } of active) {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.03);
          osc.stop(now + 0.05);
        } catch {
          // Already stopped (its scheduled end time already passed) — fine.
        }
      }
    },
  };
}
