import { DEFAULT_VOCAL_RANGE, type DuetArrangement } from "@duet-maker/shared-types";
import { generateBestArrangement } from "../lib/auto-harmony.js";
import {
  LocalEngineAudioAnalysisProvider,
  type FullSongAnalysisResult,
  type MelodyNote,
} from "../lib/local-engine-client.js";
import { create } from "zustand";

export type SessionStatus = "idle" | "processing" | "ready" | "error";

export interface SessionState {
  status: SessionStatus;
  progress: { stage: string; fraction: number } | null;
  error: string | null;

  /** Single average tempo — kept only for the MIDI export's single-tempo
   * meta-track (see HomePage.tsx). Real audio playback/export uses
   * `beatTimes` instead (see audio-engine.ts's beatsToSecondsWithMap). */
  bpm: number;
  beatTimes: number[];
  melody: MelodyNote[];
  arrangement: DuetArrangement | null;
  vocalStemBlob: Blob | null;
  instrumentalStemBlob: Blob | null;

  provider: LocalEngineAudioAnalysisProvider | null;

  processFile: (file: File) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

function blankResultFields() {
  return {
    bpm: 120,
    beatTimes: [] as number[],
    melody: [] as MelodyNote[],
    arrangement: null as DuetArrangement | null,
    vocalStemBlob: null as Blob | null,
    instrumentalStemBlob: null as Blob | null,
  };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "idle",
  progress: null,
  error: null,
  provider: null,
  ...blankResultFields(),

  processFile: async (file) => {
    const provider = new LocalEngineAudioAnalysisProvider();
    set({ status: "processing", error: null, progress: { stage: "시작하는 중...", fraction: 0 }, provider });

    const pollTimer = setInterval(() => {
      const current = get().provider;
      if (current) set({ progress: current.getProgress() });
    }, 200);

    try {
      const analysis: FullSongAnalysisResult = await provider.analyseFull(file);
      if (analysis.melody.length === 0) {
        throw new Error("이 곡에서 멜로디를 찾지 못했습니다. 다른 파일로 시도해보세요.");
      }

      set({ progress: { stage: "화음을 만드는 중...", fraction: 0.97 } });
      const arrangement = generateBestArrangement({
        mainMelody: analysis.melody,
        chords: analysis.chords,
        key: analysis.key,
        bpm: analysis.bpm,
        sections: analysis.sections,
        vocalRange: DEFAULT_VOCAL_RANGE,
      });

      set({
        status: "ready",
        progress: null,
        bpm: analysis.bpm,
        beatTimes: analysis.beatTimes,
        melody: analysis.melody,
        arrangement,
        vocalStemBlob: analysis.vocalStemBlob,
        instrumentalStemBlob: analysis.instrumentalStemBlob,
      });
    } catch (caught) {
      set({
        status: "error",
        progress: null,
        error: caught instanceof Error ? caught.message : "처리에 실패했습니다.",
      });
    } finally {
      clearInterval(pollTimer);
      set({ provider: null });
    }
  },

  cancel: () => {
    get().provider?.cancel();
  },

  reset: () => {
    set({ status: "idle", progress: null, error: null, provider: null, ...blankResultFields() });
  },
}));
