import { extractFrames, type ExtractOptions } from '../video/extract';
import { drawDownscaled } from '../spritesheet/downscale';

export interface StillsResult {
  first: ImageData;
  last: ImageData;
}

// Re-extracts the first and last frames of the chosen range at 2× tile size.
// We run a single decode pass and capture both frames, closing all others
// immediately to avoid GPU memory accumulation.
//
// The "2×" scale is done by drawing into an oversized canvas — VideoDecoder
// emits frames at the source resolution; the caller decides display size.
export async function extractStills(
  file: File,
  extract: ExtractOptions,
  tileWidth: number,
  tileHeight: number,
): Promise<StillsResult> {
  const stillW = tileWidth * 2;
  const stillH = tileHeight * 2;

  let firstData: ImageData | null = null;
  let lastData: ImageData | null = null;
  let totalEmitted = 0;

  // First pass: count frames so we know which is last.
  await extractFrames(file, extract, ({ frame }) => {
    totalEmitted++;
    frame.close();
  });
  if (totalEmitted === 0) throw new Error('no frames in selected range');

  const lastIndex = totalEmitted - 1;
  totalEmitted = 0;

  // Second pass: capture first and last into canvases at 2× tile size.
  const canvas = document.createElement('canvas');
  canvas.width = stillW;
  canvas.height = stillH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  await extractFrames(file, extract, ({ frame, outputIndex }) => {
    if (outputIndex === 0 || outputIndex === lastIndex) {
      ctx.clearRect(0, 0, stillW, stillH);
      const srcW = (frame as unknown as { displayWidth: number }).displayWidth;
      const srcH = (frame as unknown as { displayHeight: number }).displayHeight;
      drawDownscaled(ctx, frame as unknown as CanvasImageSource, srcW, srcH, 0, 0, stillW, stillH);
      const data = ctx.getImageData(0, 0, stillW, stillH);
      if (outputIndex === 0) firstData = data;
      if (outputIndex === lastIndex) lastData = data;
    }
    frame.close();
    totalEmitted++;
  });

  if (!firstData || !lastData) throw new Error('failed to capture still frames');
  return { first: firstData, last: lastData };
}
