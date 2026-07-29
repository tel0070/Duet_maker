import type { ChordEvent } from "./chord-event.js";
import type { NoteEvent } from "./note-event.js";
import type { SongSection } from "./song-section.js";

/**
 * Provider adapter contracts for optional, heavier analysis/synthesis
 * features (spec sections 13-14). These are TypeScript interfaces only —
 * intentionally not zod schemas, since they describe async behaviour, not
 * serializable data. No implementation lives in this package.
 *
 * Rules for every implementation of these interfaces (see AGENTS.md):
 * - Must report real `confidence`, never a hardcoded placeholder.
 * - Must never block the main thread; long-running work belongs in a
 *   Web Worker (browser) or a local process (local-engine), reached only
 *   through these interfaces — never hardcode a specific model name into
 *   application code that consumes a provider.
 * - `isAvailable` must reflect an actual runtime capability check
 *   (WebGPU/WASM support, local-engine reachable, etc.), not a static true.
 */

export interface ProgressState {
  /** 0 to 1. */
  fraction: number;
  /** Korean, UI-facing status text, e.g. "피치 추출 중...". */
  stage: string;
}

export type ConfidenceScored<T> = T & { confidence: number };

export interface StemSeparationResult {
  vocalStemBlob: Blob;
  instrumentalStemBlob: Blob;
  confidence: number;
}

export interface StemSeparationProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  separate(audio: Blob): Promise<StemSeparationResult>;
  cancel(): void;
  getProgress(): ProgressState;
}

export interface PitchExtractionCapabilities {
  maxAudioDurationSeconds: number;
  supportsPolyphonic: boolean;
}

export interface PitchExtractionProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  analyseAudio(audio: Blob): Promise<Array<ConfidenceScored<NoteEvent>>>;
  cancel(): void;
  getProgress(): ProgressState;
  getCapabilities(): PitchExtractionCapabilities;
}

export interface ChordDetectionProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  detectChords(audio: Blob): Promise<Array<ConfidenceScored<ChordEvent>>>;
  cancel(): void;
  getProgress(): ProgressState;
}

export interface SectionDetectionProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  detectSections(audio: Blob): Promise<Array<ConfidenceScored<SongSection>>>;
  cancel(): void;
  getProgress(): ProgressState;
}

/** Convenience bundle for full-mix analysis; a given implementation may
 * compose the four specific providers above rather than doing its own thing. */
export interface AudioAnalysisProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  analyse(audio: Blob): Promise<{
    melody: Array<ConfidenceScored<NoteEvent>>;
    chords: Array<ConfidenceScored<ChordEvent>>;
    sections: Array<ConfidenceScored<SongSection>>;
  }>;
  cancel(): void;
  getProgress(): ProgressState;
}

export type GuideVoiceType = "piano" | "softSynth" | "choirPad" | "humming";

export interface VocalSynthesisRenderRequest {
  notes: NoteEvent[];
  voiceType: GuideVoiceType;
  languageHint?: string;
}

/**
 * Guide-audio / future singing-synthesis adapter. The initial (and only
 * currently implemented) provider is a `LocalGuideSynthProvider` that plays
 * `voiceType` through Web Audio oscillators/samples — no model, no network.
 * Room is left here for a real singing-synthesis model (e.g. DiffSinger) to
 * be plugged in later without changing any call site.
 */
export interface VocalSynthesisProvider {
  providerId: string;
  displayName: string;
  isAvailable(): Promise<boolean>;
  supportedLanguages: string[];
  supportedVoiceTypes: GuideVoiceType[];
  render(request: VocalSynthesisRenderRequest): Promise<Blob>;
  cancel(): void;
  getProgress(): ProgressState;
}
