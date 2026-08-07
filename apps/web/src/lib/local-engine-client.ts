import type {
  AudioAnalysisProvider,
  ChordDetectionProvider,
  ChordEvent,
  ConfidenceScored,
  NoteEvent,
  PitchExtractionCapabilities,
  PitchExtractionProvider,
  ProgressState,
  SectionDetectionProvider,
  SongSection,
  StemSeparationProvider,
  StemSeparationResult,
} from "@duet-maker/shared-types";

/**
 * HTTP client for local-engine (see local-engine/README.md) — the optional
 * Phase 5 analysis service. Every request stays on 127.0.0.1; nothing here
 * ever sends audio anywhere else (see docs/PRIVACY.md).
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

function baseUrl(): string {
  return (import.meta.env.VITE_LOCAL_ENGINE_URL as string | undefined) ?? DEFAULT_BASE_URL;
}

export async function isLocalEngineAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`${baseUrl()}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

interface JobStatus {
  jobId: string;
  stage: string;
  fraction: number;
  done: boolean;
  cancelled: boolean;
  error: string | null;
}

class CancelledError extends Error {
  constructor() {
    super("취소되었습니다.");
  }
}

async function startJob(path: string, form: FormData): Promise<string> {
  const response = await fetch(`${baseUrl()}${path}`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`로컬 엔진 요청에 실패했습니다 (${response.status}).`);
  }
  const body = (await response.json()) as { jobId: string };
  return body.jobId;
}

async function pollUntilDone(jobId: string, onProgress: (progress: ProgressState) => void, isCancelled: () => boolean): Promise<void> {
  for (;;) {
    if (isCancelled()) throw new CancelledError();
    const response = await fetch(`${baseUrl()}/jobs/${jobId}`);
    if (!response.ok) {
      throw new Error("로컬 엔진 작업 상태를 확인할 수 없습니다.");
    }
    const status = (await response.json()) as JobStatus;
    onProgress({ fraction: status.fraction, stage: status.stage });
    if (status.cancelled) throw new CancelledError();
    if (status.error) throw new Error(status.error);
    if (status.done) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

function requestCancel(jobId: string | null): void {
  if (!jobId) return;
  void fetch(`${baseUrl()}/jobs/${jobId}/cancel`, { method: "POST" }).catch(() => undefined);
}

function audioForm(audio: Blob): FormData {
  const form = new FormData();
  form.append("file", audio, "input.audio");
  return form;
}

/** Also carries the real detected beat-time map alongside the file, for
 * endpoints that need accurate seconds<->beats conversion (see
 * beatsToSecondsWithMap in audio-engine.ts for why a single bpm isn't
 * enough — this is the same fix, on the request-building side). */
function audioFormWithBeatTimes(audio: Blob, beatTimes: number[]): FormData {
  const form = audioForm(audio);
  form.append("beat_times", JSON.stringify(beatTimes));
  return form;
}

interface TempoKeyChordsResponse {
  bpm: number;
  key: string;
  keyConfidence: number;
  chords: ConfidenceScored<ChordEvent>[];
  /** The real, non-uniform detected beat grid (seconds) — see
   * beatsToSecondsWithMap in audio-engine.ts. `bpm` above is still the
   * single average (kept for display and the MIDI export's single-tempo
   * track), but every other seconds<->beats conversion should use this. */
  beatTimes: number[];
}

async function fetchTempoKeyChords(
  audio: Blob,
  onProgress: (progress: ProgressState) => void,
  isCancelled: () => boolean,
  registerJobId: (jobId: string) => void,
): Promise<TempoKeyChordsResponse> {
  const jobId = await startJob("/analyze/tempo-key-chords", audioForm(audio));
  registerJobId(jobId);
  await pollUntilDone(jobId, onProgress, isCancelled);
  const response = await fetch(`${baseUrl()}/analyze/${jobId}/chords-result`);
  if (!response.ok) throw new Error("코드/키 분석 결과를 가져오지 못했습니다.");
  return (await response.json()) as TempoKeyChordsResponse;
}

/** Common bookkeeping (jobId/cancelled/progress) shared by every provider below. */
abstract class LocalEngineProviderBase {
  protected jobId: string | null = null;
  protected cancelled = false;
  protected progress: ProgressState = { fraction: 0, stage: "대기 중" };

  async isAvailable(): Promise<boolean> {
    return isLocalEngineAvailable();
  }

  cancel(): void {
    this.cancelled = true;
    requestCancel(this.jobId);
  }

  getProgress(): ProgressState {
    return this.progress;
  }

  protected reset(): void {
    this.cancelled = false;
    this.jobId = null;
    this.progress = { fraction: 0, stage: "대기 중" };
  }

  protected trackProgress = (progress: ProgressState): void => {
    this.progress = progress;
  };

  protected isCancelled = (): boolean => this.cancelled;
}

export class LocalEngineStemSeparationProvider extends LocalEngineProviderBase implements StemSeparationProvider {
  providerId = "local-engine-demucs";
  displayName = "로컬 엔진 (Demucs 보컬 분리)";

  async separate(audio: Blob): Promise<StemSeparationResult> {
    this.reset();
    const jobId = await startJob("/separate", audioForm(audio));
    this.jobId = jobId;
    await pollUntilDone(jobId, this.trackProgress, this.isCancelled);

    const [vocalResponse, instrumentalResponse, confidenceResponse] = await Promise.all([
      fetch(`${baseUrl()}/separate/${jobId}/vocal`),
      fetch(`${baseUrl()}/separate/${jobId}/instrumental`),
      fetch(`${baseUrl()}/separate/${jobId}/confidence`),
    ]);
    if (!vocalResponse.ok || !instrumentalResponse.ok || !confidenceResponse.ok) {
      throw new Error("보컬 분리 결과를 가져오지 못했습니다.");
    }
    const { confidence } = (await confidenceResponse.json()) as { confidence: number };
    return {
      vocalStemBlob: await vocalResponse.blob(),
      instrumentalStemBlob: await instrumentalResponse.blob(),
      confidence,
    };
  }
}

export class LocalEnginePitchExtractionProvider extends LocalEngineProviderBase implements PitchExtractionProvider {
  providerId = "local-engine-basic-pitch";
  displayName = "로컬 엔진 (basic-pitch 멜로디 채보)";

  getCapabilities(): PitchExtractionCapabilities {
    return { maxAudioDurationSeconds: 600, supportsPolyphonic: false };
  }

  /**
   * Standalone use only — determines its own tempo map first since this
   * interface has no bpm/beatTimes parameter. `analyseFull` below shares
   * one tempo detection across pitch/chords/sections instead of repeating it.
   */
  async analyseAudio(audio: Blob): Promise<Array<ConfidenceScored<NoteEvent>>> {
    this.reset();
    const { beatTimes } = await fetchTempoKeyChords(audio, () => undefined, this.isCancelled, () => undefined);
    return this.analyseAudioWithBeatTimes(audio, beatTimes);
  }

  async analyseAudioWithBeatTimes(audio: Blob, beatTimes: number[]): Promise<Array<ConfidenceScored<NoteEvent>>> {
    this.reset();
    const form = audioFormWithBeatTimes(audio, beatTimes);
    const jobId = await startJob("/pitch/analyze", form);
    this.jobId = jobId;
    await pollUntilDone(jobId, this.trackProgress, this.isCancelled);
    const response = await fetch(`${baseUrl()}/pitch/${jobId}/result`);
    if (!response.ok) throw new Error("멜로디 채보 결과를 가져오지 못했습니다.");
    const body = (await response.json()) as { notes: ConfidenceScored<NoteEvent>[] };
    return body.notes;
  }
}

export class LocalEngineChordDetectionProvider extends LocalEngineProviderBase implements ChordDetectionProvider {
  providerId = "local-engine-chroma-chords";
  displayName = "로컬 엔진 (코드 진행 분석)";

  async detectChords(audio: Blob): Promise<Array<ConfidenceScored<ChordEvent>>> {
    this.reset();
    const result = await fetchTempoKeyChords(audio, this.trackProgress, this.isCancelled, (jobId) => {
      this.jobId = jobId;
    });
    return result.chords;
  }
}

export class LocalEngineSectionDetectionProvider extends LocalEngineProviderBase implements SectionDetectionProvider {
  providerId = "local-engine-segmentation";
  displayName = "로컬 엔진 (구간 분석)";

  async detectSections(audio: Blob): Promise<Array<ConfidenceScored<SongSection>>> {
    this.reset();
    const { beatTimes } = await fetchTempoKeyChords(audio, () => undefined, this.isCancelled, () => undefined);
    return this.detectSectionsWithBeatTimes(audio, beatTimes);
  }

  async detectSectionsWithBeatTimes(audio: Blob, beatTimes: number[]): Promise<Array<ConfidenceScored<SongSection>>> {
    this.reset();
    const jobId = await startJob("/analyze/sections", audioFormWithBeatTimes(audio, beatTimes));
    this.jobId = jobId;
    await pollUntilDone(jobId, this.trackProgress, this.isCancelled);
    const response = await fetch(`${baseUrl()}/analyze/${jobId}/sections-result`);
    if (!response.ok) throw new Error("구간 분석 결과를 가져오지 못했습니다.");
    const body = (await response.json()) as { sections: ConfidenceScored<SongSection>[] };
    return body.sections;
  }
}

export interface FullSongAnalysisResult {
  key: string;
  keyConfidence: number;
  bpm: number;
  /** The real detected beat-time map — use this (not `bpm`) for any
   * seconds<->beats conversion of real audio playback/export. */
  beatTimes: number[];
  chords: ConfidenceScored<ChordEvent>[];
  melody: Array<ConfidenceScored<NoteEvent>>;
  sections: Array<ConfidenceScored<SongSection>>;
  vocalStemBlob: Blob;
  instrumentalStemBlob: Blob;
  separationConfidence: number;
}

/**
 * The actual sequence the "오디오 업로드" flow drives: separate the vocal
 * first, detect tempo/key/chords from the *instrumental* stem (more
 * rhythmically stable than an a cappella vocal), then reuse that one beat-
 * time map for both pitch extraction (on the vocal stem) and section
 * detection (on the instrumental stem) — this is why `AudioAnalysisProvider`
 * composes the four single-purpose providers instead of each figuring out
 * tempo on its own.
 */
export class LocalEngineAudioAnalysisProvider extends LocalEngineProviderBase implements AudioAnalysisProvider {
  providerId = "local-engine-full";
  displayName = "로컬 엔진 (전체 분석)";

  private separationProvider = new LocalEngineStemSeparationProvider();

  async analyse(audio: Blob): Promise<{
    melody: Array<ConfidenceScored<NoteEvent>>;
    chords: Array<ConfidenceScored<ChordEvent>>;
    sections: Array<ConfidenceScored<SongSection>>;
  }> {
    const result = await this.analyseFull(audio);
    return { melody: result.melody, chords: result.chords, sections: result.sections };
  }

  async analyseFull(audio: Blob): Promise<FullSongAnalysisResult> {
    this.reset();

    this.trackProgress({ fraction: 0.05, stage: "보컬 분리 중..." });
    const separation = await this.separationProvider.separate(audio);
    if (this.isCancelled()) throw new CancelledError();

    this.trackProgress({ fraction: 0.4, stage: "템포/키/코드 분석 중..." });
    const tempoKeyChords = await fetchTempoKeyChords(
      separation.instrumentalStemBlob,
      () => undefined,
      this.isCancelled,
      () => undefined,
    );
    if (this.isCancelled()) throw new CancelledError();

    this.trackProgress({ fraction: 0.65, stage: "멜로디 채보 중..." });
    const pitchProvider = new LocalEnginePitchExtractionProvider();
    const melody = await pitchProvider.analyseAudioWithBeatTimes(separation.vocalStemBlob, tempoKeyChords.beatTimes);
    if (this.isCancelled()) throw new CancelledError();

    this.trackProgress({ fraction: 0.85, stage: "구간(벌스/코러스) 분석 중..." });
    const sectionProvider = new LocalEngineSectionDetectionProvider();
    const sections = await sectionProvider.detectSectionsWithBeatTimes(
      separation.instrumentalStemBlob,
      tempoKeyChords.beatTimes,
    );

    this.trackProgress({ fraction: 1, stage: "완료" });
    return {
      key: tempoKeyChords.key,
      keyConfidence: tempoKeyChords.keyConfidence,
      bpm: tempoKeyChords.bpm,
      beatTimes: tempoKeyChords.beatTimes,
      chords: tempoKeyChords.chords,
      melody,
      sections,
      vocalStemBlob: separation.vocalStemBlob,
      instrumentalStemBlob: separation.instrumentalStemBlob,
      separationConfidence: separation.confidence,
    };
  }

  cancel(): void {
    super.cancel();
    this.separationProvider.cancel();
  }
}
