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
  // Prefer OffscreenCanvas; fall back to a detached HTMLCanvasElement so
  // the filmstrip still works on browsers without OffscreenCanvas.
  // OffscreenCanvas can synchronously transferToImageBitmap; the DOM
  // canvas path collects pending createImageBitmap promises and resolves
  // them after the decode loop finishes.
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const offCanvas = useOffscreen ? new OffscreenCanvas(tileW, tileH) : null;
  const domCanvas = useOffscreen
    ? null
    : Object.assign(document.createElement('canvas'), { width: tileW, height: tileH });
  const ctx = (offCanvas ?? domCanvas!).getContext('2d', { alpha: false }) as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('2d context unavailable for thumbnails.');

  const bitmaps: ImageBitmap[] = [];
  const pending: Promise<ImageBitmap>[] = [];

  await extractFrames(file, { startSec: 0, endSec: durationSec, targetFps }, ({ frame }) => {
    if (signal?.aborted) {
      frame.close();
      return;
    }
    ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0, tileW, tileH);
    frame.close();
    if (offCanvas) {
      bitmaps.push(offCanvas.transferToImageBitmap());
    } else {
      // DOM canvas is reused, so snapshot now via createImageBitmap before
      // the next drawImage overwrites it.
      pending.push(createImageBitmap(domCanvas!));
    }
  });

  if (pending.length) bitmaps.push(...(await Promise.all(pending)));

  if (signal?.aborted) {
    for (const b of bitmaps) b.close();
    return [];
  }
  return bitmaps;
}
