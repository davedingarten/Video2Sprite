import { extractFrames } from './extract';

// Extract ~count evenly-spaced filmstrip thumbnails across the full file,
// each sized (tileW × tileH). Bitmaps are GPU-backed — caller MUST close().
export async function extractThumbnails(
  file: File,
  durationSec: number,
  count: number,
  tileW: number,
  tileH: number,
  signal?: AbortSignal,
): Promise<ImageBitmap[]> {
  if (count <= 0 || durationSec <= 0) return [];

  const targetFps = count / durationSec;
  const bitmaps: ImageBitmap[] = [];
  const canvas = new OffscreenCanvas(tileW, tileH);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable for thumbnails.');

  await extractFrames(file, { startSec: 0, endSec: durationSec, targetFps }, ({ frame }) => {
    if (signal?.aborted) {
      frame.close();
      return;
    }
    ctx.drawImage(frame, 0, 0, tileW, tileH);
    frame.close();
    bitmaps.push(canvas.transferToImageBitmap());
  });

  if (signal?.aborted) {
    for (const b of bitmaps) b.close();
    return [];
  }
  return bitmaps;
}
