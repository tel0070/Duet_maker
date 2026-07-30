import { Mp3Encoder } from "@breezystack/lamejs";

const MP3_BLOCK_SIZE = 1152; // lamejs's required per-call sample-block size.

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

/** Encodes a rendered `AudioBuffer` (e.g. from `renderMixOffline`) to MP3 bytes. */
export function encodeAudioBufferToMp3(buffer: AudioBuffer, kbps = 192): Uint8Array {
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channelCount, buffer.sampleRate, kbps);

  const left = floatTo16BitPcm(buffer.getChannelData(0));
  const right = channelCount > 1 ? floatTo16BitPcm(buffer.getChannelData(1)) : undefined;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += MP3_BLOCK_SIZE) {
    const leftBlock = left.subarray(i, i + MP3_BLOCK_SIZE);
    const encoded = right
      ? encoder.encodeBuffer(leftBlock, right.subarray(i, i + MP3_BLOCK_SIZE))
      : encoder.encodeBuffer(leftBlock);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
