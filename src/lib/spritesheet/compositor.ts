import type { GridLayout } from '../../types';
import { tilePosition } from './layout';
import { drawDownscaled } from './downscale';

export type SheetCanvas = OffscreenCanvas | HTMLCanvasElement;

export interface Compositor {
  canvas: SheetCanvas;
  layout: GridLayout;
  drawFrame(frame: VideoFrame, index: number): void;
  drawn: number;
}

// Prefer OffscreenCanvas: draws are off the main DOM compositor path and
// the resulting canvas can be transferred to a worker later without copy.
export function createCompositor(layout: GridLayout, background?: string): Compositor {
  const canvas: SheetCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(layout.sheetWidth, layout.sheetHeight)
      : Object.assign(document.createElement('canvas'), {
          width: layout.sheetWidth,
          height: layout.sheetHeight,
        });

  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('2D canvas context unavailable');

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, layout.sheetWidth, layout.sheetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  (ctx as OffscreenCanvasRenderingContext2D).imageSmoothingQuality = 'high';

  const compositor: Compositor = {
    canvas,
    layout,
    drawn: 0,
    drawFrame(frame, index) {
      if (index < 0 || index >= layout.columns * layout.rows) {
        throw new Error(`tile index ${index} out of range`);
      }
      const { x, y } = tilePosition(layout, index);
      const srcW = (frame as unknown as { displayWidth: number }).displayWidth;
      const srcH = (frame as unknown as { displayHeight: number }).displayHeight;
      drawDownscaled(
        ctx as CanvasRenderingContext2D,
        frame as unknown as CanvasImageSource,
        srcW, srcH,
        x, y,
        layout.tileWidth, layout.tileHeight,
      );
      compositor.drawn++;
    },
  };

  return compositor;
}

export async function canvasToImageBitmap(canvas: SheetCanvas): Promise<ImageBitmap> {
  if (canvas instanceof OffscreenCanvas) return canvas.transferToImageBitmap();
  return await createImageBitmap(canvas);
}

export function canvasToImageData(canvas: SheetCanvas): ImageData {
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error('2D canvas context unavailable for ImageData read');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
