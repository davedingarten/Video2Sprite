export interface DecodeConfig {
  codec: string;
  description?: Uint8Array;
  codedWidth: number;
  codedHeight: number;
  maxInFlight?: number;
}

export interface DecodeableSample {
  data: Uint8Array;
  timestampUs: number;
  durationUs: number;
  isKey: boolean;
}

// Feed encoded samples to a VideoDecoder and dispatch decoded frames to `onFrame`.
// `onFrame` OWNS THE FRAME — it must call `.close()` when done, or the GPU memory leaks.
export async function decodeSamples(
  samples: Iterable<DecodeableSample>,
  config: DecodeConfig,
  onFrame: (frame: VideoFrame) => void,
): Promise<void> {
  const maxInFlight = config.maxInFlight ?? 32;
  let decodeError: Error | null = null;

  const decoder = new VideoDecoder({
    output: (frame) => {
      if (decodeError) {
        frame.close();
        return;
      }
      try {
        onFrame(frame);
      } catch (err) {
        decodeError = err instanceof Error ? err : new Error(String(err));
        frame.close();
      }
    },
    error: (err) => {
      decodeError = err instanceof Error ? err : new Error(String(err));
    },
  });

  decoder.configure({
    codec: config.codec,
    codedWidth: config.codedWidth,
    codedHeight: config.codedHeight,
    description: config.description,
  });

  for (const s of samples) {
    if (decodeError) break;
    while (decoder.decodeQueueSize > maxInFlight && !decodeError) {
      // Yield so the decoder can drain before we push more work.
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    decoder.decode(
      new EncodedVideoChunk({
        type: s.isKey ? 'key' : 'delta',
        timestamp: s.timestampUs,
        duration: s.durationUs,
        data: s.data,
      }),
    );
  }

  if (!decodeError) {
    try {
      await decoder.flush();
    } catch (err) {
      decodeError = err instanceof Error ? err : new Error(String(err));
    }
  }
  decoder.close();

  if (decodeError) throw decodeError;
}
