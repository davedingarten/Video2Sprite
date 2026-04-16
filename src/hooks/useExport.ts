import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import { encodeJpeg, encodeJpegCanvasFallback, type JpegOptions } from '../lib/export/jpeg';
import { encodePng, encodePngCanvasFallback, type PngOptions } from '../lib/export/png';
import { extractStills } from '../lib/export/stills';
import { buildMetadata, metadataBlob } from '../lib/export/metadata';
import { buildSnippet } from '../lib/export/snippet';
import type { GridLayout, VideoFileInfo, ExportOptions } from '../types';
import type { ExtractOptions } from '../lib/video/extract';

export interface ExportInput {
  file: File;
  // Pre-captured ImageData from the compositor canvas (stored before
  // transferToImageBitmap empties the OffscreenCanvas).
  imageData: ImageData;
  layout: GridLayout;
  info: VideoFileInfo;
  extract: ExtractOptions;
  frameTimestampsMs: number[];
  options: ExportOptions;
  // For palette PNG
  pngColors?: number;
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

async function downloadZip(
  files: { name: string; blob: Blob }[],
  zipName: string,
  folder?: string,
) {
  const zip = new JSZip();
  const dir = folder ? zip.folder(folder)! : zip;
  for (const { name, blob } of files) {
    dir.file(name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } });
  downloadBlob(zipBlob, zipName);
}

function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = data.width;
  c.height = data.height;
  c.getContext('2d')!.putImageData(data, 0, 0);
  return c;
}

async function encodeImageData(
  imageData: ImageData,
  options: ExportOptions,
  pngColors?: number,
) {
  if (options.format === 'jpeg') {
    const jpegOpts: JpegOptions = {
      quality: options.jpegQuality,
      maxBytes: options.maxFileSizeBytes,
    };
    try {
      return await encodeJpeg(imageData, jpegOpts);
    } catch {
      return await encodeJpegCanvasFallback(imageDataToCanvas(imageData), options.jpegQuality);
    }
  } else {
    const pngOpts: PngOptions = { level: 2, colors: pngColors };
    try {
      return await encodePng(imageData, pngOpts);
    } catch {
      return await encodePngCanvasFallback(imageDataToCanvas(imageData));
    }
  }
}

export function useExport() {
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const exportAll = useCallback(async (input: ExportInput) => {
    setError(null);
    const ext = input.options.format === 'jpeg' ? 'jpg' : 'png';
    const base = input.info.filename.replace(/\.[^.]+$/, '');

    try {
      // All files go into a named subfolder inside the ZIP so that
      // demo.html can reference anim.css, anim.js, and spritesheet.ext
      // with simple relative paths after extracting.
      const sheetName = `spritesheet.${ext}`;
      const files: { name: string; blob: Blob }[] = [];

      // 1 — Sprite sheet
      setPhase('sheet');
      const sheetResult = await encodeImageData(
        input.imageData,
        input.options,
        input.pngColors,
      );
      if ('converged' in sheetResult && !sheetResult.converged) {
        console.warn('JPEG max-size target not reached — outputting smallest achievable file.');
      }
      files.push({ name: sheetName, blob: sheetResult.blob });

      // 2 — First/last stills at 2×
      setPhase('stills');
      const stills = await extractStills(
        input.file,
        input.extract,
        input.layout.tileWidth,
        input.layout.tileHeight,
      );
      const firstResult = await encodeImageData(stills.first, input.options, input.pngColors);
      const lastResult = await encodeImageData(stills.last, input.options, input.pngColors);
      files.push({ name: `first.${ext}`, blob: firstResult.blob });
      files.push({ name: `last.${ext}`, blob: lastResult.blob });

      // 3 — JSON metadata
      setPhase('metadata');
      const meta = buildMetadata({
        layout: input.layout,
        info: input.info,
        fps: (input.extract.endSec - input.extract.startSec) > 0
          ? input.frameTimestampsMs.length / (input.extract.endSec - input.extract.startSec)
          : input.extract.targetFps,
        frameTimestampsMs: input.frameTimestampsMs,
      });
      files.push({ name: 'metadata.json', blob: metadataBlob(meta) });

      // 4 — CSS + JS + HTML snippet (all reference simple relative names)
      setPhase('snippet');
      const snippet = buildSnippet({
        layout: input.layout,
        fps: input.extract.targetFps,
        frameCount: input.frameTimestampsMs.length,
        sheetFilename: sheetName,
      });
      files.push({ name: 'anim.css', blob: new Blob([snippet.css], { type: 'text/css' }) });
      files.push({ name: 'anim.js', blob: new Blob([snippet.js], { type: 'text/javascript' }) });
      files.push({ name: 'demo.html', blob: new Blob([snippet.html], { type: 'text/html' }) });

      setPhase('zipping');
      await downloadZip(files, `${base}-sprite.zip`, base);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
      throw err;
    }
  }, []);

  const exportMetadata = useCallback(async (input: Omit<ExportInput, 'imageData' | 'options' | 'pngColors'>) => {
    setError(null);
    setPhase('metadata');
    const base = input.info.filename.replace(/\.[^.]+$/, '');
    try {
      const meta = buildMetadata({
        layout: input.layout,
        info: input.info,
        fps: input.extract.targetFps,
        frameTimestampsMs: input.frameTimestampsMs,
      });
      downloadBlob(metadataBlob(meta), `${base}-metadata.json`);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
      throw err;
    }
  }, []);

  return { exportAll, exportMetadata, phase, error };
}
