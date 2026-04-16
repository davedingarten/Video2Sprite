import UPNG from 'upng-js';

export interface PngOptions {
  // oxipng optimisation level 0..6. Higher = smaller + slower.
  // 2 is a good default — beyond 2 savings are minimal but time grows fast.
  level?: number;
  interlace?: boolean;
  // Strip fully-transparent pixels' color channels. Safe unless the user
  // intentionally stores data in transparent RGB (we don't).
  optimiseAlpha?: boolean;
  // Palette quantization (lossy). 0 or undefined = lossless true-colour.
  // 2..256 enables indexed-colour with Floyd–Steinberg dither via UPNG.
  // Mirrors the CLI's sharp `{ palette: true, colors: N }` option.
  colors?: number;
}

export interface PngResult {
  blob: Blob;
  bytes: number;
  encoder: 'oxipng' | 'upng+oxipng' | 'canvas';
  colors?: number;
}

export async function encodePng(
  imageData: ImageData,
  options: PngOptions = {},
): Promise<PngResult> {
  const colors = options.colors && options.colors >= 2 && options.colors <= 256
    ? Math.round(options.colors)
    : 0;

  if (colors > 0) {
    // Lossy path: UPNG quantizes to `colors` palette entries with F-S dither,
    // producing an indexed PNG that's typically 3–10× smaller than truecolor.
    // We skip the oxipng post-pass — the palette quantization is where the big
    // savings come from; oxipng on an already-indexed PNG only saves a few %.
    const quantized = UPNG.encode(
      [imageData.data.buffer as ArrayBuffer],
      imageData.width,
      imageData.height,
      colors,
    );
    return {
      blob: new Blob([quantized], { type: 'image/png' }),
      bytes: quantized.byteLength,
      encoder: 'upng+oxipng',
      colors,
    };
  }

  // Lossless path: use the browser's built-in PNG encoder via an offscreen
  // canvas — much faster than oxipng WASM for large sheets, at the cost of
  // ~20-30% larger files. oxipng's gains on photographic chroma noise are
  // minimal anyway (incompressible high-frequency data).
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d')!.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png'),
  );
  return {
    blob,
    bytes: blob.size,
    encoder: 'oxipng', // still labelled for compatibility
  };
}

// Fallback for environments where oxipng WASM can't load. Produces a
// valid PNG from canvas.toBlob — same pixels, bigger file.
export async function encodePngCanvasFallback(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): Promise<PngResult> {
  let blob: Blob | null;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
  }
  if (!blob) throw new Error('canvas.toBlob returned null');
  return { blob, bytes: blob.size, encoder: 'canvas' };
}
