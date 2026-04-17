import encode from '@jsquash/jpeg/encode';

export interface JpegOptions {
  // 0-100. Matches the CLI's mozjpeg --quality semantics (higher = better).
  quality: number;
  // When set, the encoder drops quality by binary search until the output
  // fits. Null/undefined means "use the given quality once, don't bisect."
  maxBytes?: number;
  // Lowest quality the bisection is allowed to try before giving up and
  // returning the smallest JPEG it could produce.
  minQuality?: number;
  // Called each bisection iteration so the UI can show progress.
  onProgress?: (iteration: number, total: number) => void;
}

export interface JpegResult {
  blob: Blob;
  quality: number;
  bytes: number;
  converged: boolean;
  encoder: 'mozjpeg' | 'canvas';
}

const DEFAULT_MIN_QUALITY = 10;

// Keep mozjpeg settings in one place so quality numbers stay comparable
// across calls (progressive + trellis matches the CLI's cjpeg defaults).
const MOZJPEG_BASE = {
  baseline: false,
  arithmetic: false,
  progressive: true,
  optimize_coding: true,
  smoothing: 0,
  quant_table: 3,
  trellis_multipass: false,
  trellis_opt_zero: false,
  trellis_opt_table: false,
  trellis_loops: 1,
  auto_subsample: true,
  chroma_subsample: 2,
  separate_chroma_quality: false,
  chroma_quality: 75,
} as const;

export async function encodeJpeg(imageData: ImageData, options: JpegOptions): Promise<JpegResult> {
  const minQ = options.minQuality ?? DEFAULT_MIN_QUALITY;
  const maxQ = clampQuality(options.quality);

  if (!options.maxBytes) {
    const buf = await mozEncode(imageData, maxQ);
    return blobResult(buf, maxQ, true, 'mozjpeg');
  }

  let lo = minQ;
  let hi = maxQ;
  let best: { buf: ArrayBuffer; q: number } | null = null;
  const totalIter = Math.ceil(Math.log2(hi - lo + 2));
  let iter = 0;

  // Binary search: find the highest quality whose output fits under maxBytes.
  // Converges in log2(quality-range) encodes — ~7 for 0..100.
  while (lo <= hi) {
    iter++;
    options.onProgress?.(iter, totalIter);
    const mid = Math.floor((lo + hi) / 2);
    const buf = await mozEncode(imageData, mid);
    if (buf.byteLength <= options.maxBytes) {
      best = { buf, q: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best) return blobResult(best.buf, best.q, true, 'mozjpeg');
  // Nothing fit: emit the smallest JPEG we can and flag non-convergence
  // so the UI can surface a warning.
  const floorBuf = await mozEncode(imageData, minQ);
  return blobResult(floorBuf, minQ, false, 'mozjpeg');
}

async function mozEncode(imageData: ImageData, quality: number): Promise<ArrayBuffer> {
  try {
    return await encode(imageData, { ...MOZJPEG_BASE, quality });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    throw new Error(`mozjpeg encode failed at q=${quality}: ${msg}`);
  }
}

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 80;
  return Math.max(0, Math.min(100, Math.round(q)));
}

function blobResult(
  buf: ArrayBuffer,
  quality: number,
  converged: boolean,
  encoder: JpegResult['encoder'],
): JpegResult {
  return {
    blob: new Blob([buf], { type: 'image/jpeg' }),
    quality,
    bytes: buf.byteLength,
    converged,
    encoder,
  };
}

// Emergency path when the WASM module fails to load (e.g. restrictive CSP).
// Produces a JPEG via the browser's built-in encoder — noticeably larger
// than mozjpeg at the same quality, but keeps exports working.
export async function encodeJpegCanvasFallback(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<JpegResult> {
  const q = clampQuality(quality) / 100;
  let blob: Blob | null;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
  } else {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', q),
    );
  }
  if (!blob) throw new Error('canvas.toBlob returned null');
  return {
    blob,
    quality: clampQuality(quality),
    bytes: blob.size,
    converged: true,
    encoder: 'canvas',
  };
}
