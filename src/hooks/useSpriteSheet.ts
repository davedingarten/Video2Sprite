import { useCallback, useRef, useState } from 'react';
import { extractFrames, type ExtractOptions } from '../lib/video/extract';
import { autoOptimize } from '../lib/spritesheet/auto-optimize';
import { computeLayout } from '../lib/spritesheet/layout';
import { canvasToImageBitmap, createCompositor } from '../lib/spritesheet/compositor';
import type { GridLayout, VideoFileInfo } from '../types';

export interface GenerateInput {
  file: File;
  extract: ExtractOptions;
  tileWidth: number;
  tileHeight: number;
  padding: number;
  // when set, columns overrides auto-optimize
  columns?: number;
  background?: string;
}

export interface SheetProgress {
  phase: 'idle' | 'counting' | 'compositing' | 'done' | 'error';
  framesPlanned: number;
  framesDrawn: number;
}

export interface GenerateResult {
  bitmap: ImageBitmap;
  layout: GridLayout;
  info: VideoFileInfo;
  overMaxDim: boolean;
}

// Two-pass flow: decode once to learn the actual frame count (nearest-sample
// picking can return fewer than targetFps asks for), then decode again and
// draw into a correctly-sized sheet. Running decode twice is cheap on short
// ranges and avoids growing/copying canvases mid-composite.
export function useSpriteSheet() {
  const [progress, setProgress] = useState<SheetProgress>({
    phase: 'idle',
    framesPlanned: 0,
    framesDrawn: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const generate = useCallback(async (input: GenerateInput): Promise<GenerateResult> => {
    if (busyRef.current) throw new Error('already generating');
    busyRef.current = true;
    setError(null);
    setProgress({ phase: 'counting', framesPlanned: 0, framesDrawn: 0 });

    try {
      let frameCount = 0;
      let info: VideoFileInfo | null = null;
      const countRes = await extractFrames(input.file, input.extract, ({ frame }) => {
        frameCount++;
        frame.close();
      });
      info = countRes.info;
      if (frameCount === 0) throw new Error('no frames in selected range');

      const layout: GridLayout = input.columns
        ? computeLayout({
            columns: input.columns,
            frameCount,
            tileWidth: input.tileWidth,
            tileHeight: input.tileHeight,
            padding: input.padding,
          })
        : autoOptimize({
            frameCount,
            tileWidth: input.tileWidth,
            tileHeight: input.tileHeight,
            padding: input.padding,
          }).layout;
      const overMaxDim = layout.sheetWidth > 4096 || layout.sheetHeight > 4096;

      setProgress({ phase: 'compositing', framesPlanned: frameCount, framesDrawn: 0 });

      const compositor = createCompositor(layout, input.background);
      await extractFrames(input.file, input.extract, ({ frame, outputIndex }) => {
        compositor.drawFrame(frame, outputIndex);
        frame.close();
        setProgress((p) => ({ ...p, framesDrawn: p.framesDrawn + 1 }));
      });

      const bitmap = await canvasToImageBitmap(compositor.canvas);
      setProgress({ phase: 'done', framesPlanned: frameCount, framesDrawn: frameCount });
      return { bitmap, layout, info, overMaxDim };
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      setProgress({ phase: 'error', framesPlanned: 0, framesDrawn: 0 });
      throw err;
    } finally {
      busyRef.current = false;
    }
  }, []);

  return { generate, progress, error };
}
