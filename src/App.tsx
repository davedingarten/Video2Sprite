import { useEffect, useRef, useState } from 'react';
import { useVideoFile } from './hooks/useVideoFile';
import { useExport } from './hooks/useExport';
import { Uploader } from './components/Uploader';
import { FileInfoPanel } from './components/FileInfoPanel';
import { TimelineEditor } from './components/TimelineEditor';
import { SamplingControls } from './components/SamplingControls';
import { GridControls, type LayoutMode } from './components/GridControls';
import { SpritePlayer, SpriteSharedControls } from './components/SpritePlayer';
import { extractFrames } from './lib/video/extract';
import { autoOptimize } from './lib/spritesheet/auto-optimize';
import { computeLayout } from './lib/spritesheet/layout';
import { canvasToImageData, createCompositor } from './lib/spritesheet/compositor';
import { encodeJpeg } from './lib/export/jpeg';
import { encodePng } from './lib/export/png';
import { encodeWebp } from './lib/export/webp';
import type { GridLayout, ScaleMode, SnippetVariant } from './types';
import './App.css';
import './components/components.css';

function resolveTile(
  scaleMode: ScaleMode,
  srcW: number,
  srcH: number,
): { tileWidth: number; tileHeight: number } {
  const ar = srcW / srcH;
  if (scaleMode.kind === 'fit-width') {
    return { tileWidth: scaleMode.width, tileHeight: Math.round(scaleMode.width / ar) };
  }
  if (scaleMode.kind === 'fit-height') {
    return { tileWidth: Math.round(scaleMode.height * ar), tileHeight: scaleMode.height };
  }
  return { tileWidth: scaleMode.width, tileHeight: scaleMode.height };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1_000)} KB`;
}

function openBitmapInNewTab(bitmap: ImageBitmap) {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d')!.drawImage(bitmap, 0, 0);
  c.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Keep URL alive long enough for the new tab to load it
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
}

export default function App() {
  const { file, info, status, error: fileError, load, reset } = useVideoFile();

  // Extract controls
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [targetFps, setTargetFps] = useState(10);
  const [scaleMode, setScaleMode] = useState<ScaleMode>({ kind: 'fit-width', width: 320 });
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('auto');
  const [columns, setColumns] = useState(6);
  const [rows, setRows] = useState(1);
  // Which axis the user last edited — the other is derived from it when
  // frame count changes, so the pair stays consistent.
  const [manualAxis, setManualAxis] = useState<'columns' | 'rows'>('columns');
  const [padding, setPadding] = useState(0);

  const estimatedFrames = Math.max(0, Math.round((endSec - startSec) * targetFps));

  function handleColumnsChange(c: number) {
    const cols = Math.max(1, c);
    setColumns(cols);
    setManualAxis('columns');
    if (estimatedFrames > 0) setRows(Math.max(1, Math.ceil(estimatedFrames / cols)));
  }
  function handleRowsChange(r: number) {
    const rs = Math.max(1, r);
    setRows(rs);
    setManualAxis('rows');
    if (estimatedFrames > 0) setColumns(Math.max(1, Math.ceil(estimatedFrames / rs)));
  }

  // Keep the derived axis in sync when the frame count changes (fps or range edit).
  useEffect(() => {
    if (layoutMode !== 'manual' || estimatedFrames <= 0) return;
    if (manualAxis === 'columns') {
      setRows(Math.max(1, Math.ceil(estimatedFrames / Math.max(1, columns))));
    } else {
      setColumns(Math.max(1, Math.ceil(estimatedFrames / Math.max(1, rows))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute on frame-count change
  }, [estimatedFrames]);

  // Sheet state
  const [sheetBitmap, setSheetBitmap] = useState<ImageBitmap | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{
    cols: number; rows: number; tileW: number; tileH: number; padding: number; w: number; h: number;
  } | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; drawn: number; total: number } | null>(null);
  const sheetImageDataRef = useRef<ImageData | null>(null);
  const layoutRef = useRef<GridLayout | null>(null);
  const timestampsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRefCompressed = useRef<HTMLCanvasElement>(null);

  // Compressed preview state
  const [compressedBitmap, setCompressedBitmap] = useState<ImageBitmap | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressedBytes, setCompressedBytes] = useState<number | null>(null);
  const [compressProgress, setCompressProgress] = useState<{ i: number; n: number } | null>(null);

  // Shared playback state for split-view (original vs compressed).
  const [sharedFrame, setSharedFrame] = useState(0);
  const [sharedPlaying, setSharedPlaying] = useState(true);

  // Export controls
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [compressionMode, setCompressionMode] = useState<'quality' | 'maxSize'>('quality');
  const [jpegQuality, setJpegQuality] = useState(85);
  const [targetKB, setTargetKB] = useState<number | ''>(200);
  const [pngColors, setPngColors] = useState(0);
  const [webpLossless, setWebpLossless] = useState(false);
  const [snippetVariants, setSnippetVariants] = useState<SnippetVariant[]>(['steps-css', 'vanilla-js']);
  // Last encode result — drives the quality readout + unreachable warning in target-size mode.
  const [encodeResult, setEncodeResult] = useState<{ quality: number; bytes: number; converged: boolean } | null>(null);
  const { exportAll, phase: exportPhase, error: exportError } = useExport();

  const useMaxBytes = compressionMode === 'maxSize' && targetKB !== '' && Number(targetKB) > 0;
  const activeMaxBytes = useMaxBytes ? Number(targetKB) * 1000 : undefined;

  function toggleSnippetVariant(v: SnippetVariant) {
    setSnippetVariants(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  // When a new file loads, reset range to full duration.
  useEffect(() => {
    if (info) {
      setStartSec(0);
      setEndSec(info.durationSec);
    }
  }, [info]);

  // Clear compressed preview when export settings change
  useEffect(() => {
    setCompressedBitmap(prev => { prev?.close(); return null; });
    setCompressedBytes(null);
    setEncodeResult(null);
  }, [exportFormat, compressionMode, jpegQuality, targetKB, pngColors, webpLossless]);

  // Drive playback for split-view shared scrubber. Only runs when both
  // originals + compressed are showing (otherwise each SpritePlayer self-ticks).
  useEffect(() => {
    if (!sheetBitmap || !compressedBitmap || !sharedPlaying || showSheet) return;
    const fc = timestampsRef.current.length || (sheetInfo?.cols ?? 1) * (sheetInfo?.rows ?? 1);
    const dur = endSec - startSec;
    const fps = fc > 1 && dur > 0 ? fc / dur : targetFps;
    const interval = 1000 / Math.max(1, fps);
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      if (!last) { last = ts; raf = requestAnimationFrame(tick); return; }
      if (ts - last >= interval) {
        setSharedFrame(f => (f + 1) % fc);
        last += interval;
        if (ts - last > interval) last = ts;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sheetBitmap, compressedBitmap, sharedPlaying, showSheet, endSec, startSec, targetFps, sheetInfo]);

  function clearCompressed() {
    setCompressedBitmap(prev => { prev?.close(); return null; });
    setCompressedBytes(null);
  }

  function unlockSettings() {
    setSettingsLocked(false);
    sheetBitmap?.close();
    setSheetBitmap(null);
    setSheetInfo(null);
    sheetImageDataRef.current = null;
    layoutRef.current = null;
    timestampsRef.current = [];
    setProgress(null);
    setGenError(null);
    clearCompressed();
  }

  function handleReset() {
    reset();
    unlockSettings();
  }

  async function generateSheet() {
    if (!file || !info) return;
    setBusy(true);
    setGenError(null);
    sheetBitmap?.close();
    setSheetBitmap(null);
    sheetImageDataRef.current = null;
    layoutRef.current = null;
    timestampsRef.current = [];
    clearCompressed();

    const { tileWidth, tileHeight } = resolveTile(scaleMode, info.width, info.height);

    try {
      setProgress({ phase: 'Counting frames…', drawn: 0, total: 0 });
      let frameCount = 0;
      await extractFrames(file, { startSec, endSec, targetFps }, ({ frame }) => {
        frameCount++;
        frame.close();
      });
      if (frameCount === 0) throw new Error('No frames in the selected range.');

      // Manual mode: in reciprocal UI we keep columns/rows mirrored, but re-derive
      // from whichever axis the user last touched since actual frameCount may
      // differ slightly from the estimate (source-fps rounding, etc).
      const resolvedColumns = manualAxis === 'rows'
        ? Math.max(1, Math.ceil(frameCount / Math.max(1, rows)))
        : columns;
      const layout = layoutMode === 'auto'
        ? autoOptimize({ frameCount, tileWidth, tileHeight, padding }).layout
        : computeLayout({ columns: resolvedColumns, frameCount, tileWidth, tileHeight, padding });

      if (layout.sheetWidth > 4096 || layout.sheetHeight > 4096) {
        setGenError(
          `Sheet is ${layout.sheetWidth}×${layout.sheetHeight} — exceeds the 4096 GPU cap. Reduce fps, range, or tile size.`,
        );
      }

      const compositor = createCompositor(layout);
      const timestamps: number[] = [];
      setProgress({ phase: 'Compositing…', drawn: 0, total: frameCount });
      await extractFrames(file, { startSec, endSec, targetFps }, ({ frame, outputIndex, timestampMs }) => {
        compositor.drawFrame(frame, outputIndex);
        frame.close();
        timestamps.push(timestampMs);
        setProgress({ phase: 'Compositing…', drawn: outputIndex + 1, total: frameCount });
      });
      layoutRef.current = layout;
      timestampsRef.current = timestamps;

      sheetImageDataRef.current = canvasToImageData(compositor.canvas);
      const bitmap =
        compositor.canvas instanceof OffscreenCanvas
          ? compositor.canvas.transferToImageBitmap()
          : await createImageBitmap(compositor.canvas);

      setSheetBitmap(bitmap);
      setSheetInfo({
        cols: layout.columns, rows: layout.rows,
        tileW: layout.tileWidth, tileH: layout.tileHeight,
        padding: layout.padding, w: layout.sheetWidth, h: layout.sheetHeight,
      });
      setSettingsLocked(true);
      setShowSheet(false); // default to animation view
      setProgress(null);
    } catch (err) {
      setGenError((err as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  async function previewCompression() {
    if (!sheetImageDataRef.current) return;
    setCompressing(true);
    setCompressProgress(null);
    try {
      let blob: Blob;
      let bytes: number;
      let result: { quality: number; bytes: number; converged: boolean } | null = null;
      if (exportFormat === 'jpeg') {
        const r = await encodeJpeg(sheetImageDataRef.current, {
          quality: jpegQuality,
          maxBytes: activeMaxBytes,
          onProgress: (i, n) => setCompressProgress({ i, n }),
        });
        blob = r.blob; bytes = r.bytes;
        result = { quality: r.quality, bytes: r.bytes, converged: r.converged };
      } else if (exportFormat === 'webp') {
        const r = await encodeWebp(sheetImageDataRef.current, {
          quality: jpegQuality,
          maxBytes: webpLossless ? undefined : activeMaxBytes,
          lossless: webpLossless,
          onProgress: (i, n) => setCompressProgress({ i, n }),
        });
        blob = r.blob; bytes = r.bytes;
        result = { quality: r.quality, bytes: r.bytes, converged: r.converged };
      } else {
        const r = await encodePng(sheetImageDataRef.current, {
          colors: pngColors || undefined,
        });
        blob = r.blob; bytes = r.bytes;
      }
      const bitmap = await createImageBitmap(blob);
      setCompressedBitmap(prev => { prev?.close(); return bitmap; });
      setCompressedBytes(bytes);
      setEncodeResult(result);
    } catch (_err) {
      // compression errors are non-fatal for preview
    } finally {
      setCompressing(false);
      setCompressProgress(null);
    }
  }

  // Redraw canvases whenever bitmap, overlay, or sheet view changes.
  useEffect(() => {
    if (!showSheet || !sheetInfo) return;

    function draw(canvas: HTMLCanvasElement | null, bitmap: ImageBitmap | null) {
      if (!canvas || !bitmap) return;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      if (overlay) {
        ctx.strokeStyle = 'rgba(255,51,102,0.4)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= sheetInfo!.cols; c++) {
          const x = sheetInfo!.padding + c * (sheetInfo!.tileW + sheetInfo!.padding) - 0.5;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sheetInfo!.h); ctx.stroke();
        }
        for (let r = 0; r <= sheetInfo!.rows; r++) {
          const y = sheetInfo!.padding + r * (sheetInfo!.tileH + sheetInfo!.padding) - 0.5;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sheetInfo!.w, y); ctx.stroke();
        }
      }
    }

    draw(canvasRef.current, sheetBitmap);
    draw(canvasRefCompressed.current, compressedBitmap);
  }, [sheetBitmap, compressedBitmap, sheetInfo, overlay, showSheet]);

  const isReady = status === 'ready';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="brand-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <polygon points="5 3 19 12 5 21 5 3" fill="white"/>
            </svg>
          </div>
          <h1>VIDEO<span className="brand-accent">2</span>SPRITE</h1>
        </div>
      </header>
      <main className="app-body">
        {/* ── Controls pane ── */}
        <aside className="controls-pane" aria-label="Controls">
          {(status === 'idle' || status === 'loading' || status === 'error') && (
            <Uploader onFile={load} disabled={status === 'loading'} />
          )}
          {status === 'loading' && (
            <p className="placeholder" style={{ marginTop: 12 }}>Reading file…</p>
          )}
          {status === 'error' && fileError && (
            <div className="error-banner" style={{ marginTop: 12 }}>{fileError}</div>
          )}

          {isReady && info && (
            <>
              <FileInfoPanel info={info} onReset={handleReset} />
              <hr className="divider" />

              {settingsLocked && (
                <div className="settings-status">
                  <span>✓ Preview ready</span>
                  <button className="settings-status__edit" onClick={unlockSettings}>Edit settings</button>
                </div>
              )}

              <div className={settingsLocked ? 'settings-locked' : ''}>
                <SamplingControls
                  targetFps={targetFps}
                  scaleMode={scaleMode}
                  sourceWidth={info.width}
                  sourceHeight={info.height}
                  onFpsChange={setTargetFps}
                  onScaleModeChange={setScaleMode}
                />
                <GridControls
                  layoutMode={layoutMode}
                  columns={columns}
                  rows={rows}
                  padding={padding}
                  onLayoutModeChange={setLayoutMode}
                  onColumnsChange={handleColumnsChange}
                  onRowsChange={handleRowsChange}
                  onPaddingChange={setPadding}
                />
              </div>

              {!settingsLocked && (
                <>
                  <hr className="divider" />
                  {genError && <div className="error-banner">{genError}</div>}
                  <button className="btn-primary" onClick={generateSheet} disabled={busy}>
                    {busy && progress
                      ? `${progress.phase}${progress.total > 0 ? ` ${progress.drawn}/${progress.total}` : ''}`
                      : 'Generate preview'}
                  </button>
                </>
              )}

              {sheetBitmap && (
                <>
                  <hr className="divider" />
                  <section className="control-section">
                    <h3 className="control-section__title">Export</h3>

                    <div className="field-row">
                      <label>Format</label>
                      <select
                        className="select"
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value as 'jpeg' | 'png' | 'webp')}
                      >
                        <option value="jpeg">JPEG (mozjpeg)</option>
                        <option value="webp">WebP</option>
                        <option value="png">PNG (oxipng)</option>
                      </select>
                    </div>

                    {exportFormat === 'webp' && (
                      <div className="field-row">
                        <label>Lossless</label>
                        <input
                          type="checkbox"
                          checked={webpLossless}
                          onChange={(e) => setWebpLossless(e.target.checked)}
                        />
                      </div>
                    )}

                    {(exportFormat === 'jpeg' || (exportFormat === 'webp' && !webpLossless)) && (
                      <>
                        <div className="field-row">
                          <label>Mode</label>
                          <div className="radio-group">
                            <label className="radio-group__item">
                              <input
                                type="radio"
                                name="compression-mode"
                                checked={compressionMode === 'quality'}
                                onChange={() => setCompressionMode('quality')}
                              />
                              <span>Quality</span>
                            </label>
                            <label className="radio-group__item">
                              <input
                                type="radio"
                                name="compression-mode"
                                checked={compressionMode === 'maxSize'}
                                onChange={() => setCompressionMode('maxSize')}
                              />
                              <span>Target size</span>
                            </label>
                          </div>
                        </div>

                        {compressionMode === 'quality' ? (
                          <div className="field-row">
                            <label>Quality</label>
                            <input
                              type="range" min={10} max={100} value={jpegQuality}
                              onChange={(e) => setJpegQuality(Number(e.target.value))}
                              className="slider"
                            />
                            <input
                              type="number" min={10} max={100} step={1} value={jpegQuality}
                              onChange={(e) => setJpegQuality(Math.max(10, Math.min(100, Number(e.target.value))))}
                              className="num-input num-input--sm"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="field-row">
                              <label>Target</label>
                              <input
                                type="number" min={1} placeholder="200" value={targetKB}
                                onChange={(e) => {
                                  if (e.target.value === '') { setTargetKB(''); return; }
                                  setTargetKB(Math.max(1, Number(e.target.value)));
                                }}
                                className="num-input num-input--sm"
                              />
                              <span className="range-unit">KB</span>
                            </div>
                            <div className="field-row">
                              <label>Quality</label>
                              <span className="field-readout">
                                {encodeResult ? `≈ ${encodeResult.quality}` : '—'}
                              </span>
                            </div>
                            {encodeResult && !encodeResult.converged && targetKB !== '' && (
                              <div className="error-banner" style={{ marginBottom: 8 }}>
                                Can&rsquo;t reach {targetKB} KB — smallest is {formatBytes(encodeResult.bytes)} at quality {encodeResult.quality}. Reduce fps, range, or dimensions.
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {exportFormat === 'png' && (
                      <div className="field-row">
                        <label>Colors</label>
                        <input
                          type="range" min={0} max={256} value={pngColors}
                          onChange={(e) => setPngColors(Number(e.target.value))}
                          className="slider"
                        />
                        <span className="field-value">{pngColors === 0 ? 'full' : pngColors}</span>
                      </div>
                    )}

                    <div className="compress-row">
                      <button
                        className="btn-secondary"
                        disabled={busy || compressing}
                        onClick={previewCompression}
                      >
                        {compressing
                          ? compressProgress
                            ? `Compressing… ${compressProgress.i}/${compressProgress.n}`
                            : 'Compressing…'
                          : 'Preview compression'}
                      </button>
                    </div>

                    {exportError && <div className="error-banner" style={{ marginTop: 8 }}>{exportError}</div>}

                    <div className="snippet-variants">
                      <div className="snippet-variants__title">Playback snippets</div>
                      {([
                        { id: 'steps-css', label: 'CSS steps()' },
                        { id: 'vanilla-js', label: 'Vanilla JS' },
                        { id: 'tiny-js', label: 'Tiny JS (loop only)' },
                        { id: 'gsap', label: 'GSAP' },
                      ] as const).map(({ id, label }) => (
                        <label key={id} className="snippet-variants__item">
                          <input
                            type="checkbox"
                            checked={snippetVariants.includes(id)}
                            onChange={() => toggleSnippetVariant(id)}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn-primary"
                        disabled={busy || exportPhase === 'sheet' || exportPhase === 'stills'}
                        onClick={() => {
                          if (!file || !info || !sheetImageDataRef.current || !layoutRef.current) return;
                          exportAll({
                            file,
                            imageData: sheetImageDataRef.current,
                            layout: layoutRef.current,
                            info,
                            extract: { startSec, endSec, targetFps },
                            frameTimestampsMs: timestampsRef.current,
                            options: {
                              format: exportFormat,
                              jpegQuality,
                              maxFileSizeBytes: exportFormat === 'webp' && webpLossless ? undefined : activeMaxBytes,
                              webpLossless: exportFormat === 'webp' ? webpLossless : undefined,
                              snippetVariants,
                            },
                            pngColors: exportFormat === 'png' ? pngColors : undefined,
                          });
                        }}
                      >
                        {exportPhase === 'sheet' ? 'Encoding sheet…'
                          : exportPhase === 'stills' ? 'Encoding stills…'
                          : exportPhase === 'metadata' ? 'Building metadata…'
                          : exportPhase === 'snippet' ? 'Building snippet…'
                          : exportPhase === 'zipping' ? 'Zipping…'
                          : 'Export sprite sheet'}
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </aside>

        {/* ── Preview pane ── */}
        <section className="preview-pane" aria-label="Preview">
          {sheetBitmap && sheetInfo && layoutRef.current ? (
            <>
              {(sheetInfo.w > 4096 || sheetInfo.h > 4096) && (
                <div className="preview-warning-bar" role="status">
                  <span className="preview-warning-bar__icon" aria-hidden>⚠</span>
                  Sheet is {sheetInfo.w}×{sheetInfo.h} — exceeds the 4096 GPU cap. Reduce fps, range, or tile size.
                </div>
              )}
              <div className="preview-toolbar">
                <span className="preview-info">
                  {sheetInfo.w}×{sheetInfo.h}
                  <span className="preview-info__sep">·</span>
                  {sheetInfo.cols}×{sheetInfo.rows}
                  <span className="preview-info__sep">·</span>
                  {timestampsRef.current.length} frames @ {targetFps} fps
                  <span className="preview-info__sep">·</span>
                  {(endSec - startSec).toFixed(2)}s
                  <span className="preview-info__sep">·</span>
                  {sheetInfo.tileW}×{sheetInfo.tileH} tile
                  {compressedBytes !== null && (
                    <span className="preview-info__badge">{formatBytes(compressedBytes)}</span>
                  )}
                </span>
                <div className="preview-toolbar__right">
                  {showSheet && (
                    <label className="grid-overlay-label">
                      <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                      Grid
                    </label>
                  )}
                  <div className="view-toggle">
                    <button
                      className={`view-toggle__btn${!showSheet ? ' view-toggle__btn--active' : ''}`}
                      onClick={() => setShowSheet(false)}
                    >Animate</button>
                    <button
                      className={`view-toggle__btn${showSheet ? ' view-toggle__btn--active' : ''}`}
                      onClick={() => setShowSheet(true)}
                    >Sheet</button>
                  </div>
                </div>
              </div>

              <div className="preview-frame">
                {!showSheet ? (() => {
                  const fc = timestampsRef.current.length;
                  const dur = endSec - startSec;
                  const actualFps = fc > 1 && dur > 0 ? fc / dur : targetFps;
                  const totalFrames = fc || sheetInfo.cols * sheetInfo.rows;
                  const playerProps = {
                    layout: layoutRef.current!,
                    fps: actualFps,
                    frameCount: totalFrames,
                  };
                  return compressedBitmap ? (
                    <div className="preview-player-stack">
                      <div className="preview-split">
                        <div className="preview-split__panel">
                          <span className="preview-split__label">Original</span>
                          <SpritePlayer
                            bitmap={sheetBitmap}
                            {...playerProps}
                            frame={sharedFrame}
                            playing={sharedPlaying}
                            onFrameChange={setSharedFrame}
                            onPlayingChange={setSharedPlaying}
                            hideControls
                          />
                        </div>
                        <div className="preview-split__panel">
                          <span className="preview-split__label">
                            Compressed{compressedBytes !== null ? ` (${formatBytes(compressedBytes)})` : ''}
                          </span>
                          <SpritePlayer
                            bitmap={compressedBitmap}
                            {...playerProps}
                            frame={sharedFrame}
                            playing={sharedPlaying}
                            onFrameChange={setSharedFrame}
                            onPlayingChange={setSharedPlaying}
                            hideControls
                          />
                        </div>
                      </div>
                      <SpriteSharedControls
                        frame={sharedFrame}
                        playing={sharedPlaying}
                        fps={actualFps}
                        frameCount={totalFrames}
                        onFrame={setSharedFrame}
                        onPlaying={setSharedPlaying}
                      />
                    </div>
                  ) : (
                    <SpritePlayer bitmap={sheetBitmap} {...playerProps} />
                  );
                })() : (
                  compressedBitmap ? (
                    <div className="preview-split">
                      <div className="preview-split__panel">
                        <span className="preview-split__label">Original</span>
                        <canvas
                          ref={canvasRef}
                          className="sheet-canvas"
                          title="Click to open in new tab"
                          onClick={() => openBitmapInNewTab(sheetBitmap)}
                        />
                      </div>
                      <div className="preview-split__panel">
                        <span className="preview-split__label">Compressed</span>
                        <canvas
                          ref={canvasRefCompressed}
                          className="sheet-canvas"
                          title="Click to open in new tab"
                          onClick={() => openBitmapInNewTab(compressedBitmap)}
                        />
                      </div>
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className="sheet-canvas"
                      title="Click to open in new tab"
                      onClick={() => openBitmapInNewTab(sheetBitmap)}
                    />
                  )
                )}
              </div>
            </>
          ) : isReady && info && file ? (
            <div className="preview-frame">
              <TimelineEditor
                file={file}
                duration={info.durationSec}
                startSec={startSec}
                endSec={endSec}
                targetFps={targetFps}
                sourceFps={info.sourceFps}
                onChange={(s, e) => { setStartSec(s); setEndSec(e); }}
              />
            </div>
          ) : (
            <div className="preview-empty">
              <p className="placeholder">Upload a video to get started.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
