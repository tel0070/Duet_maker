import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingSession, requestMicrophoneStream, type MediaRecorderLike } from "../../src/lib/recorder.js";

function fakeStream() {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return { getTracks: () => tracks, tracks } as unknown as MediaStream & { tracks: typeof tracks };
}

function fakeRecorderFactory() {
  let instance!: MediaRecorderLike & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  const factory = (_stream: MediaStream) => {
    const start = vi.fn();
    const stop = vi.fn(() => {
      instance.onstop?.();
    });
    instance = { start, stop, state: "inactive", mimeType: "audio/webm", ondataavailable: null, onstop: null };
    return instance;
  };
  return { factory, getInstance: () => instance };
}

describe("createRecordingSession", () => {
  it("starts the recorder immediately", () => {
    const { factory, getInstance } = fakeRecorderFactory();
    createRecordingSession(fakeStream(), factory);
    expect(getInstance().start).toHaveBeenCalled();
  });

  it("assembles collected chunks into a blob using the recorder's mimeType", async () => {
    const { factory, getInstance } = fakeRecorderFactory();
    const session = createRecordingSession(fakeStream(), factory);
    const chunk1 = new Blob(["a"], { type: "audio/webm" });
    const chunk2 = new Blob(["bb"], { type: "audio/webm" });
    getInstance().ondataavailable?.({ data: chunk1 });
    getInstance().ondataavailable?.({ data: chunk2 });

    const blob = await session.stop();

    expect(blob.type).toBe("audio/webm");
    expect(blob.size).toBe(chunk1.size + chunk2.size);
  });

  it("ignores zero-size data events", async () => {
    const { factory, getInstance } = fakeRecorderFactory();
    const session = createRecordingSession(fakeStream(), factory);
    getInstance().ondataavailable?.({ data: new Blob([]) });

    const blob = await session.stop();
    expect(blob.size).toBe(0);
  });

  it("stops every track in the stream once recording stops", async () => {
    const stream = fakeStream();
    const { factory } = fakeRecorderFactory();
    const session = createRecordingSession(stream, factory);

    await session.stop();

    for (const track of stream.tracks) expect(track.stop).toHaveBeenCalled();
  });

  it("cancel() discards collected chunks but still releases the stream", () => {
    const stream = fakeStream();
    const { factory, getInstance } = fakeRecorderFactory();
    const session = createRecordingSession(stream, factory);
    getInstance().ondataavailable?.({ data: new Blob(["a"]) });

    session.cancel();

    for (const track of stream.tracks) expect(track.stop).toHaveBeenCalled();
  });
});

describe("requestMicrophoneStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws a clear Korean error when the browser has no mediaDevices API", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestMicrophoneStream()).rejects.toThrow(/마이크 녹음을 지원하지 않습니다/);
  });

  it("delegates to navigator.mediaDevices.getUserMedia when available", async () => {
    const fakeMediaStream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeMediaStream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    const stream = await requestMicrophoneStream();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stream).toBe(fakeMediaStream);
  });
});
