import { useCallback, useState } from 'react';
import type { StillsResult } from '../lib/export/stills';
import { runExport, type ExportRunInput } from '../lib/export/exportWorkerClient';
import type { GridLayout, VideoFileInfo, ExportOptions } from '../types';

export interface ExportInput {
  // Pre-captured ImageData from the compositor canvas (stored before
  // transferToImageBitmap empties the OffscreenCanvas).
  imageData: ImageData;
  // First/last frames captured during the same decode pass that built the
  // sheet — no second decode required.
  stills: StillsResult;
  layout: GridLayout;
  info: VideoFileInfo;
  actualFps: number;
  frameTimestampsMs: number[];
  options: ExportOptions;
  // For palette PNG
  pngColors?: number;
  // When true, proceed with the export even if the max-size contract
  // couldn't be met. Set by the UI after the user acknowledges.
  forceOversize?: boolean;
}

export interface OversizeInfo {
  bytes: number;
  quality: number;
  targetBytes: number;
}

export type ExportPhase =
  | 'idle'
  | 'sheet'
  | 'stills'
  | 'metadata'
  | 'snippet'
  | 'zipping'
  | 'done'
  | 'error';

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Short delay so the browser has time to initiate the download before revoke.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatKB(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

export function useExport() {
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [oversize, setOversize] = useState<OversizeInfo | null>(null);

  const exportAll = useCallback(async (input: ExportInput) => {
    setError(null);
    setOversize(null);
    const ext = input.options.format === 'jpeg' ? 'jpg'
      : input.options.format === 'webp' ? 'webp'
      : 'png';
    const baseName = input.info.filename.replace(/\.[^.]+$/, '');

    const req: ExportRunInput = {
      sheet: input.imageData,
      stills: input.stills,
      options: input.options,
      pngColors: input.pngColors,
      forceOversize: input.forceOversize,
      layout: input.layout,
      info: input.info,
      actualFps: input.actualFps,
      frameTimestampsMs: input.frameTimestampsMs,
      baseName,
      ext,
    };

    setPhase('sheet');
    try {
      const result = await runExport(req, (phaseName) => {
        setPhase(phaseName);
      });
      if (result.kind === 'oversize') {
        setOversize({
          bytes: result.bytes,
          quality: result.quality,
          targetBytes: result.targetBytes,
        });
        setPhase('error');
        setError(
          `Can't reach ${formatKB(result.targetBytes)} — smallest is ${formatKB(result.bytes)} at quality ${result.quality}. Reduce fps, range, or dimensions.`,
        );
        return;
      }
      downloadBlob(result.zip, result.zipName);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
      throw err;
    }
  }, []);

  const clearOversize = useCallback(() => {
    setOversize(null);
    setError(null);
    setPhase('idle');
  }, []);

  return { exportAll, phase, error, oversize, clearOversize };
}
