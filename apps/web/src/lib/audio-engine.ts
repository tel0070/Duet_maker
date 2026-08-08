import type { HarmonyNote, NoteEvent } from "@duet-maker/shared-types";

export type GuideVoice = "piano" | "softSynth" | "choirPad" | "humming";

export function midiToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

/**
 * Like `beatsToSeconds`, but anchored to the REAL detected beat grid
 * (`beatTimes[i]` = the actual timestamp of beat i, from local-engine's
 * tempo analysis) instead of a single constant-tempo formula. A single bpm
 * drifts for any real song whose tempo isn't perfectly constant - confirmed
 * on a real user's song, where the real detected tempo climbed from ~130 to
 * ~131 BPM start-to-finish. That's well under 1% per beat, but it
 * accumulates linearly over a multi-minute song into a drift large enough
 * to throw generated harmony completely off the real beat by the second
 * half. Extrapolates using the nearest real interval's local tempo past
 * either edge of the map, rather than clamping.
 */
export function beatsToSecondsWithMap(beats: number, beatTimes: number[]): number {
  if (beatTimes.length < 2) {
    throw new Error("beatTimes는 최소 2개 이상의 박자가 필요합니다.");
  }
  let i = Math.floor(beats);
  if (beats < 0) i = 0;
  else if (i > beatTimes.length - 2) i = beatTimes.length - 2;
  const beatTime = beatTimes[i] as number;
  const nextBeatTime = beatTimes[i + 1] as number;
  return beatTime + (beats - i) * (nextBeatTime - beatTime);
}

/** A single bpm (legacy, constant-tempo) or a real detected beat-time map. */
export type TempoInput = number | number[];

function beatsToSecondsAny(beats: number, tempo: TempoInput): number {
  return typeof tempo === "number" ? beatsToSeconds(beats, tempo) : beatsToSecondsWithMap(beats, tempo);
}

/** A NoteEvent that may also carry its exact real-world timestamp (seconds)
 * from local-engine's pitch detection - see local-engine-client.ts's
 * `MelodyNote`. Optional so plain NoteEvent[] (manual/MIDI-imported melody,
 * with no real recording to time against) still works unchanged. */
interface NoteWithOptionalSeconds extends NoteEvent {
  startTimeSeconds?: number;
  durationSeconds?: number;
}

/**
 * Prefers the note's own exact real-world timestamp over converting
 * startTime/duration (beats) through a tempo map or scalar bpm, whenever
 * that timestamp is available. The tempo map/bpm is always only an
 * *estimate* of the song's real tempo - ballads especially (sparse
 * percussion, expressive rubato vocal timing) are exactly where that
 * estimate is least reliable, and no amount of improving the estimate
 * fixes that. A note carrying its own real detected instant can't drift
 * relative to the real recording no matter how good or bad that estimate
 * is, because it never goes through it.
 */
function noteStartEndSeconds(note: NoteWithOptionalSeconds, tempo: TempoInput): [number, number] {
  if (typeof note.startTimeSeconds === "number" && typeof note.durationSeconds === "number") {
    return [note.startTimeSeconds, note.startTimeSeconds + note.durationSeconds];
  }
  return [beatsToSecondsAny(note.startTime, tempo), beatsToSecondsAny(note.startTime + note.duration, tempo)];
}

export interface ScheduledNote {
  frequency: number;
  /** Seconds, relative to playback start (not `ctx.currentTime`). */
  startTime: number;
  duration: number;
  /** 0-127, mirrors the source NoteEvent's velocity. */
  velocity: number;
}

export function notesToScheduled(notes: NoteWithOptionalSeconds[], tempo: TempoInput): ScheduledNote[] {
  return notes.map((n) => {
    // Duration is derived from (end - start), not converted on its own:
    // with a real beat-time map, the interval spanning beat 5-6 can have a
    // different local tempo than the interval spanning beat 0-1, so
    // converting a *relative* length in isolation (as if it always started
    // at beat 0) would silently use the wrong one. This form is exact for
    // the scalar-bpm case too, since that conversion is linear anyway.
    const [startTime, endTime] = noteStartEndSeconds(n, tempo);
    return {
      frequency: midiToFrequency(n.pitch),
      startTime,
      duration: endTime - startTime,
      velocity: n.velocity,
    };
  });
}

/** Seconds from playback start to the end of the last-finishing note, at the given playback rate. */
export function totalDurationSeconds(notes: ScheduledNote[], rate: number): number {
  if (notes.length === 0) return 0;
  return Math.max(...notes.map((n) => n.startTime + n.duration)) / rate;
}

/**
 * Clips notes to `[startSeconds, endSeconds)`, cutting off any part outside
 * the region and rebasing `startTime` to be relative to `startSeconds` — so
 * the result can be scheduled with a fresh `startAt` on every loop
 * iteration. Used for A-B loop playback.
 */
export function sliceScheduledToRegion(
  notes: ScheduledNote[],
  startSeconds: number,
  endSeconds: number,
): ScheduledNote[] {
  if (endSeconds <= startSeconds) return [];
  const sliced: ScheduledNote[] = [];
  for (const note of notes) {
    const noteEnd = note.startTime + note.duration;
    if (noteEnd <= startSeconds || note.startTime >= endSeconds) continue;
    const clippedStart = Math.max(note.startTime, startSeconds);
    const clippedEnd = Math.min(noteEnd, endSeconds);
    sliced.push({ ...note, startTime: clippedStart - startSeconds, duration: clippedEnd - clippedStart });
  }
  return sliced;
}

/** Rests (`generatedPitch: null`) and notes missing their source melody note are skipped. */
export function harmonyToScheduled(
  melody: NoteWithOptionalSeconds[],
  harmony: HarmonyNote[],
  tempo: TempoInput,
): ScheduledNote[] {
  const melodyById = new Map(melody.map((n) => [n.id, n]));
  const scheduled: ScheduledNote[] = [];
  for (const h of harmony) {
    if (h.generatedPitch === null) continue;
    const source = melodyById.get(h.originalNoteId);
    if (!source) continue;
    // See notesToScheduled's comment: prefers the source melody note's own
    // exact real-world timestamp over the tempo map/bpm, when available.
    const [startTime, endTime] = noteStartEndSeconds(source, tempo);
    scheduled.push({
      frequency: midiToFrequency(h.generatedPitch),
      startTime,
      duration: endTime - startTime,
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
  ctx: BaseAudioContext,
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

/** Decodes a recorded/separated stem Blob (wav/mp3/etc.) into a playable buffer. */
export async function decodeAudioBlob(ctx: AudioContext, blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export interface PlayBufferOptions {
  /** Linear gain, 0-1. Default 1. */
  gain?: number;
  /** Same `ctx.currentTime`-relative convention as `SchedulePlaybackOptions.startAt`. */
  startAt?: number;
}

/** Plays a whole decoded buffer (a vocal/instrumental stem) once, starting at `startAt`. */
export function playAudioBuffer(ctx: BaseAudioContext, buffer: AudioBuffer, options: PlayBufferOptions = {}): PlaybackHandle {
  const startAt = options.startAt ?? ctx.currentTime + 0.05;
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(options.gain ?? 1, startAt);

  source.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start(startAt);

  return {
    stop: () => {
      try {
        source.stop();
      } catch {
        // Already stopped (its scheduled end time already passed) — fine.
      }
    },
  };
}

export interface MixRenderOptions {
  melody: NoteWithOptionalSeconds[];
  harmony?: HarmonyNote[];
  /** A single bpm (legacy, constant-tempo) or a real detected beat-time
   * map — see `beatsToSecondsWithMap`. Pass the map whenever real recorded
   * audio (a vocal/instrumental stem) is involved, so the harmony stays
   * locked to the actual song instead of drifting against it. */
  bpm: TempoInput;
  /** A real recorded/separated vocal stem. Mutually exclusive in practice
   * with `includeMelodyGuide` — don't turn both on, or the melody plays twice. */
  vocalBuffer?: AudioBuffer | null;
  instrumentalBuffer?: AudioBuffer | null;
  vocalGain?: number;
  instrumentalGain?: number;
  harmonyGain?: number;
  harmonyVoice?: GuideVoice;
  /** Renders the main melody as a synthesized guide tone (PlaybackPanel's
   * use case: no real vocal recording exists, only MIDI/manual notes). */
  includeMelodyGuide?: boolean;
  melodyGain?: number;
  melodyVoice?: GuideVoice;
}

/**
 * Renders the same mix `AudioMixPlayer`/`PlaybackPanel` play live, but into
 * an in-memory buffer via `OfflineAudioContext` instead of real speakers —
 * this is what MP3 export encodes. Reuses `schedulePlayback`/`playAudioBuffer`
 * as-is (both take `BaseAudioContext`, which `OfflineAudioContext` also is)
 * rather than duplicating the scheduling logic for an offline-only path.
 */
export async function renderMixOffline(options: MixRenderOptions): Promise<AudioBuffer> {
  const { melody, harmony, bpm, vocalBuffer, instrumentalBuffer } = options;
  const harmonyScheduled = harmony ? harmonyToScheduled(melody, harmony, bpm) : [];
  const melodyScheduled = options.includeMelodyGuide ? notesToScheduled(melody, bpm) : [];

  const totalSeconds =
    Math.max(
      vocalBuffer?.duration ?? 0,
      instrumentalBuffer?.duration ?? 0,
      totalDurationSeconds(harmonyScheduled, 1),
      totalDurationSeconds(melodyScheduled, 1),
    ) + 1; // +1s tail so the last note's release doesn't get truncated.
  const sampleRate = vocalBuffer?.sampleRate ?? instrumentalBuffer?.sampleRate ?? 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.max(1, Math.ceil(totalSeconds * sampleRate)), sampleRate);

  if (vocalBuffer) playAudioBuffer(offlineCtx, vocalBuffer, { gain: options.vocalGain ?? 1, startAt: 0 });
  if (instrumentalBuffer) playAudioBuffer(offlineCtx, instrumentalBuffer, { gain: options.instrumentalGain ?? 1, startAt: 0 });
  if (melodyScheduled.length > 0) {
    schedulePlayback(offlineCtx, melodyScheduled, options.melodyVoice ?? "piano", {
      gain: options.melodyGain ?? 0.6,
      startAt: 0,
    });
  }
  if (harmonyScheduled.length > 0) {
    schedulePlayback(offlineCtx, harmonyScheduled, options.harmonyVoice ?? "softSynth", {
      gain: options.harmonyGain ?? 0.6,
      startAt: 0,
    });
  }

  return offlineCtx.startRendering();
}

export interface CountInOptions {
  /** Peak linear gain per click, 0-1. Default 0.4. */
  gain?: number;
}

/**
 * Schedules `beats` short metronome clicks, one per beat, timed so the last
 * click lands exactly `beatsToSeconds(1, bpm) / playbackRate` seconds before
 * `endAt` — i.e. the count-in ends right where real playback should begin.
 * The first click (beat 1) is pitched higher to mark the downbeat. Returns a
 * `PlaybackHandle` so it can be silenced early the same way as
 * `schedulePlayback`'s handle.
 */
export function scheduleCountIn(
  ctx: AudioContext,
  beats: number,
  bpm: number,
  playbackRate: number,
  endAt: number,
  options: CountInOptions = {},
): PlaybackHandle {
  const gainValue = options.gain ?? 0.4;
  const beatSeconds = beatsToSeconds(1, bpm) / playbackRate;
  const active: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  for (let i = 0; i < beats; i++) {
    const t0 = endAt - (beats - i) * beatSeconds;
    if (t0 < ctx.currentTime) continue;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(i === 0 ? 1600 : 1000, t0);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gainValue, t0);
    gainNode.gain.linearRampToValueAtTime(0, t0 + 0.05);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);

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
