/// <reference lib="webworker" />
import JSZip from 'jszip';
import { encodeJpeg, type JpegOptions } from '../lib/export/jpeg';
import { encodePng, type PngOptions } from '../lib/export/png';
import { encodeWebp, type WebpOptions } from '../lib/export/webp';
import { buildMetadata, metadataBlob } from '../lib/export/metadata';
import { buildSnippet } from '../lib/export/snippet';
import type { ExportOptions } from '../types';
import type {
  ExportRequest,
  PreviewRequest,
  ProgressMessage,
  WorkerRequest,
  WorkerResponse,
} from './exportProtocol';

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

type EncodeResult =
  | { blob: Blob; bytes: number; quality?: number; converged?: boolean };

function progress(id: number, phase: ProgressMessage['phase'], i?: number, n?: number) {
  ctx.postMessage({ id, type: 'progress', phase, i, n } satisfies ProgressMessage);
}

async function encodeImageData(
  id: number,
  phase: ProgressMessage['phase'],
  imageData: ImageData,
  options: ExportOptions,
  pngColors?: number,
): Promise<EncodeResult> {
  if (options.format === 'jpeg') {
    const opts: JpegOptions = {
      quality: options.jpegQuality,
      maxBytes: options.maxFileSizeBytes,
      onProgress: (i, n) => progress(id, phase, i, n),
    };
    const r = await encodeJpeg(imageData, opts);
    return { blob: r.blob, bytes: r.bytes, quality: r.quality, converged: r.converged };
  }
  if (options.format === 'webp') {
    const opts: WebpOptions = {
      quality: options.jpegQuality,
      maxBytes: options.webpLossless ? undefined : options.maxFileSizeBytes,
      lossless: options.webpLossless,
      onProgress: (i, n) => progress(id, phase, i, n),
    };
    const r = await encodeWebp(imageData, opts);
    return { blob: r.blob, bytes: r.bytes, quality: r.quality, converged: r.converged };
  }
  const opts: PngOptions = { level: 2, colors: pngColors };
  const r = await encodePng(imageData, opts);
  return { blob: r.blob, bytes: r.bytes };
}

async function handlePreview(msg: PreviewRequest) {
  const result = await encodeImageData(msg.id, 'sheet', msg.imageData, msg.options, msg.pngColors);
  const buffer = await result.blob.arrayBuffer();
  const response: WorkerResponse = {
    id: msg.id,
    type: 'preview-success',
    buffer,
    mime: result.blob.type,
    bytes: result.bytes,
    quality: result.quality,
    converged: result.converged,
  };
  ctx.postMessage(response, [buffer]);
}

async function handleExport(msg: ExportRequest) {
  // 1 — sheet
  progress(msg.id, 'sheet');
  const sheetResult = await encodeImageData(msg.id, 'sheet', msg.sheet, msg.options, msg.pngColors);
  const needsBail =
    sheetResult.converged === false &&
    msg.options.maxFileSizeBytes != null &&
    !msg.forceOversize;
  if (needsBail) {
    const response: WorkerResponse = {
      id: msg.id,
      type: 'oversize',
      bytes: sheetResult.bytes,
      quality: sheetResult.quality ?? 0,
      targetBytes: msg.options.maxFileSizeBytes!,
    };
    ctx.postMessage(response);
    return;
  }

  const files: { name: string; blob: Blob }[] = [];
  const sheetName = `spritesheet.${msg.ext}`;
  files.push({ name: sheetName, blob: sheetResult.blob });

  // 2 — stills (already captured on main; just encode)
  progress(msg.id, 'stills');
  const firstResult = await encodeImageData(msg.id, 'stills', msg.stills.first, msg.options, msg.pngColors);
  const lastResult = await encodeImageData(msg.id, 'stills', msg.stills.last, msg.options, msg.pngColors);
  files.push({ name: `first.${msg.ext}`, blob: firstResult.blob });
  files.push({ name: `last.${msg.ext}`, blob: lastResult.blob });

  // 3 — metadata
  progress(msg.id, 'metadata');
  const meta = buildMetadata({
    layout: msg.layout,
    info: msg.info,
    fps: msg.actualFps,
    frameTimestampsMs: msg.frameTimestampsMs,
  });
  files.push({ name: 'metadata.json', blob: metadataBlob(meta) });

  // 4 — snippet
  progress(msg.id, 'snippet');
  const snippet = buildSnippet({
    layout: msg.layout,
    fps: msg.actualFps,
    frameCount: msg.frameTimestampsMs.length,
    sheetFilename: sheetName,
    variants: msg.options.snippetVariants,
  });
  if (snippet.css) files.push({ name: 'anim.css', blob: new Blob([snippet.css], { type: 'text/css' }) });
  if (snippet.js) files.push({ name: 'anim.js', blob: new Blob([snippet.js], { type: 'text/javascript' }) });
  if (snippet.tinyJs) files.push({ name: 'anim-tiny.js', blob: new Blob([snippet.tinyJs], { type: 'text/javascript' }) });
  if (snippet.gsapJs) files.push({ name: 'anim-gsap.js', blob: new Blob([snippet.gsapJs], { type: 'text/javascript' }) });
  files.push({ name: 'demo.html', blob: new Blob([snippet.html], { type: 'text/html' }) });

  // 5 — zip
  progress(msg.id, 'zipping');
  const zip = new JSZip();
  const dir = zip.folder(msg.baseName)!;
  for (const { name, blob } of files) dir.file(name, blob);
  const zipBuf = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });

  const response: WorkerResponse = {
    id: msg.id,
    type: 'export-success',
    zip: zipBuf,
    zipName: `${msg.baseName}-sprite.zip`,
  };
  ctx.postMessage(response, [zipBuf]);
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'preview') await handlePreview(msg);
    else if (msg.type === 'export') await handleExport(msg);
  } catch (err) {
    const response: WorkerResponse = {
      id: msg.id,
      type: 'error',
      message: (err as Error).message ?? String(err),
    };
    ctx.postMessage(response);
  }
};
