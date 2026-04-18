import encode from '@jsquash/webp/encode';
import { defaultOptions } from '@jsquash/webp/meta';

export interface WebpOptions {
  // 0-100 (same shape as JPEG quality).
  quality: number;
  // Lossless mode bypasses quality-based lossy compression. Useful for
  // flat/graphic content where it can beat PNG; otherwise prefer lossy.
  lossless?: boolean;
  // When set, bisect quality until the output fits. Ignored in lossless mode.
  maxBytes?: number;
  minQuality?: number;
  onProgress?: (iteration: number, total: number) => void;
}

export interface WebpResult {
  blob: Blob;
  quality: number;
  bytes: number;
  converged: boolean;
  encoder: 'webp' | 'canvas';
  lossless: boolean;
}

const DEFAULT_MIN_QUALITY = 10;

export async function encodeWebp(imageData: ImageData, options: WebpOptions): Promise<WebpResult> {
  const minQ = options.minQuality ?? DEFAULT_MIN_QUALITY;
  const maxQ = clampQuality(options.quality);
  const lossless = options.lossless === true;

  if (lossless) {
    const buf = await webpEncode(imageData, maxQ, true);
    return blobResult(buf, maxQ, true, 'webp', true);
  }

  if (!options.maxBytes) {
    const buf = await webpEncode(imageData, maxQ, false);
    return blobResult(buf, maxQ, true, 'webp', false);
  }

  let lo = minQ;
  let hi = maxQ;
  let best: { buf: ArrayBuffer; q: number } | null = null;
  const totalIter = Math.ceil(Math.log2(hi - lo + 2));
  let iter = 0;

  while (lo <= hi) {
    iter++;
    options.onProgress?.(iter, totalIter);
    const mid = Math.floor((lo + hi) / 2);
    const buf = await webpEncode(imageData, mid, false);
    if (buf.byteLength <= options.maxBytes) {
      best = { buf, q: mid };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best) return blobResult(best.buf, best.q, true, 'webp', false);
  const floorBuf = await webpEncode(imageData, minQ, false);
  return blobResult(floorBuf, minQ, false, 'webp', false);
}

async function webpEncode(imageData: ImageData, quality: number, lossless: boolean): Promise<ArrayBuffer> {
  try {
    const buf = await encode(imageData, { ...defaultOptions, quality, lossless: lossless ? 1 : 0 });
    return buf;
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    throw new Error(`webp encode failed at q=${quality}: ${msg}`);
  }
}

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 75;
  return Math.max(0, Math.min(100, Math.round(q)));
}

function blobResult(
  buf: ArrayBuffer,
  quality: number,
  converged: boolean,
  encoder: WebpResult['encoder'],
  lossless: boolean,
): WebpResult {
  return {
    blob: new Blob([buf], { type: 'image/webp' }),
    quality,
    bytes: buf.byteLength,
    converged,
    encoder,
    lossless,
  };
}

// Emergency path: browser's built-in canvas encoder.
export async function encodeWebpCanvasFallback(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<WebpResult> {
  const q = clampQuality(quality) / 100;
  let blob: Blob | null;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: 'image/webp', quality: q });
  } else {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', q),
    );
  }
  if (!blob) throw new Error('canvas.toBlob returned null');
  return {
    blob,
    quality: clampQuality(quality),
    bytes: blob.size,
    converged: true,
    encoder: 'canvas',
    lossless: false,
  };
}
