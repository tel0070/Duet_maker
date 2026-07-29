/**
 * Minimal wrapper around MediaRecorder, structured the same way as
 * audio-engine.ts: browser-API calls (requestMicrophoneStream) are kept
 * separate from the injectable logic (createRecordingSession takes a
 * recorder factory), so the chunk-collection/blob-assembly behavior can be
 * unit-tested with a fake recorder instead of needing a real microphone.
 */

export interface MediaRecorderLike {
  start(): void;
  stop(): void;
  readonly state: string;
  readonly mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

export type RecorderFactory = (stream: MediaStream) => MediaRecorderLike;

const defaultFactory: RecorderFactory = (stream) => new MediaRecorder(stream) as unknown as MediaRecorderLike;

export interface RecordingHandle {
  /** Stops the recorder and resolves with the assembled recording. */
  stop: () => Promise<Blob>;
  /** Stops the recorder and discards whatever was captured. */
  cancel: () => void;
}

export function createRecordingSession(stream: MediaStream, createRecorder: RecorderFactory = defaultFactory): RecordingHandle {
  const recorder = createRecorder(stream);
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let resolveStopped!: (blob: Blob) => void;
  const stopped = new Promise<Blob>((resolve) => {
    resolveStopped = resolve;
  });
  recorder.onstop = () => {
    for (const track of stream.getTracks()) track.stop();
    resolveStopped(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
  };

  recorder.start();

  return {
    stop: () => {
      recorder.stop();
      return stopped;
    },
    cancel: () => {
      chunks.length = 0;
      recorder.stop();
    },
  };
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("이 브라우저에서는 마이크 녹음을 지원하지 않습니다.");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}
