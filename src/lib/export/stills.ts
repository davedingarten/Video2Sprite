import { drawDownscaled } from '../spritesheet/downscale';

export interface StillsResult {
  first: ImageData;
  last: ImageData;
}

// Captures first + last frames at 2× tile size from an in-progress decode pass.
// The caller drives this from inside its VideoFrame output callback; frames are
// drawn into a shared 2× canvas and snapshotted as ImageData. Avoids the second
// full decode pass the old extractStills() ran.
export function createStillCapture(tileWidth: number, tileHeight: number, lastIndex: number) {
  const stillW = tileWidth * 2;
  const stillH = tileHeight * 2;
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(stillW, stillH)
      : Object.assign(document.createElement('canvas'), { width: stillW, height: stillH });
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('2D canvas context unavailable for still capture');
  ctx.imageSmoothingEnabled = true;
  (ctx as OffscreenCanvasRenderingContext2D).imageSmoothingQuality = 'high';

  let first: ImageData | null = null;
  let last: ImageData | null = null;

  return {
    capture(frame: VideoFrame, outputIndex: number) {
      if (outputIndex !== 0 && outputIndex !== lastIndex) return;
      ctx.clearRect(0, 0, stillW, stillH);
      const srcW = (frame as unknown as { displayWidth: number }).displayWidth;
      const srcH = (frame as unknown as { displayHeight: number }).displayHeight;
      drawDownscaled(
        ctx as CanvasRenderingContext2D,
        frame as unknown as CanvasImageSource,
        srcW, srcH,
        0, 0, stillW, stillH,
      );
      const data = (ctx as CanvasRenderingContext2D).getImageData(0, 0, stillW, stillH);
      if (outputIndex === 0) first = data;
      if (outputIndex === lastIndex) last = data;
    },
    result(): StillsResult {
      if (!first || !last) throw new Error('failed to capture still frames');
      return { first, last };
    },
  };
}
