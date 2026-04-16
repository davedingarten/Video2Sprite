// Step-downscale src into ctx at (dstX, dstY, dstW, dstH).
// When the source is >2× the target in either dimension, a single bilinear
// pass skips too many source pixels and produces aliasing. Halving each step
// keeps enough samples for clean edges.
// Must be synchronous — called from VideoDecoder output callbacks which the
// browser does not await.
export function drawDownscaled(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  dstX: number,
  dstY: number,
  dstW: number,
  dstH: number,
): void {
  if (srcW <= dstW * 2 && srcH <= dstH * 2) {
    ctx.drawImage(src, dstX, dstY, dstW, dstH);
    return;
  }
  const midW = Math.max(dstW, Math.ceil(srcW / 2));
  const midH = Math.max(dstH, Math.ceil(srcH / 2));
  const tmp: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(midW, midH)
      : Object.assign(document.createElement('canvas'), { width: midW, height: midH });
  const tmpCtx = tmp.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  tmpCtx.imageSmoothingEnabled = true;
  (tmpCtx as OffscreenCanvasRenderingContext2D).imageSmoothingQuality = 'high';
  tmpCtx.drawImage(src, 0, 0, midW, midH);
  drawDownscaled(ctx, tmp as unknown as CanvasImageSource, midW, midH, dstX, dstY, dstW, dstH);
}
