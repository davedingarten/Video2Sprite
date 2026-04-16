import { useEffect, useRef, useState } from 'react';
import { useVideoFile } from './hooks/useVideoFile';
import { useExport } from './hooks/useExport';
import { Uploader } from './components/Uploader';
import { FileInfoPanel } from './components/FileInfoPanel';
import { RangeControls } from './components/RangeControls';
import { SamplingControls } from './components/SamplingControls';
import { GridControls } from './components/GridControls';
import { SpritePlayer } from './components/SpritePlayer';
import { extractFrames } from './lib/video/extract';
import { autoOptimize } from './lib/spritesheet/auto-optimize';
import { computeLayout } from './lib/spritesheet/layout';
import { canvasToImageData, createCompositor } from './lib/spritesheet/compositor';
import type { GridLayout, ScaleMode } from './types';
import './App.css';
import './components/components.css';

// Tile dimensions derived from scale mode + source dimensions.
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

export default function App() {
  const { file, info, status, error: fileError, load, reset } = useVideoFile();

  // Extract controls
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(0);
  const [targetFps, setTargetFps] = useState(10);
  const [scaleMode, setScaleMode] = useState<ScaleMode>({ kind: 'fit-width', width: 320 });
  const [columns, setColumns] = useState(6);
  const [padding, setPadding] = useState(0);
  const [autoOptimizeGrid, setAutoOptimizeGrid] = useState(true);

  // Sheet state
  const [sheetBitmap, setSheetBitmap] = useState<ImageBitmap | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{
    cols: number; rows: number; tileW: number; tileH: number; padding: number; w: number; h: number;
  } | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [showSheet, setShowSheet] = useState(true);
  const [settingsLocked, setSettingsLocked] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; drawn: number; total: number } | null>(null);
  const sheetImageDataRef = useRef<ImageData | null>(null);
  const layoutRef = useRef<GridLayout | null>(null);
  const timestampsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Export controls
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [jpegQuality, setJpegQuality] = useState(85);
  const [jpegMaxKB, setJpegMaxKB] = useState<number | ''>('');
  const [pngColors, setPngColors] = useState(0);
  const { exportAll, exportMetadata, phase: exportPhase, error: exportError } = useExport();

  // When a new file loads, reset range to full duration.
  useEffect(() => {
    if (info) {
      setStartSec(0);
      setEndSec(info.durationSec);
    }
  }, [info]);

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

    const { tileWidth, tileHeight } = resolveTile(scaleMode, info.width, info.height);

    try {
      setProgress({ phase: 'Counting frames…', drawn: 0, total: 0 });
      let frameCount = 0;
      await extractFrames(file, { startSec, endSec, targetFps }, ({ frame }) => {
        frameCount++;
        frame.close();
      });
      if (frameCount === 0) throw new Error('No frames in the selected range.');

      const layout = autoOptimizeGrid
        ? autoOptimize({ frameCount, tileWidth, tileHeight, padding }).layout
        : computeLayout({ columns, frameCount, tileWidth, tileHeight, padding });

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
      setShowSheet(true);
      setProgress(null);
    } catch (err) {
      setGenError((err as Error).message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  // Redraw canvas with optional tile-grid overlay whenever bitmap changes or sheet view is shown.
  useEffect(() => {
    if (!showSheet) return;
    const canvas = canvasRef.current;
    if (!canvas || !sheetBitmap || !sheetInfo) return;
    canvas.width = sheetBitmap.width;
    canvas.height = sheetBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(sheetBitmap, 0, 0);
    if (overlay) {
      ctx.strokeStyle = 'rgba(255,51,102,0.4)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= sheetInfo.cols; c++) {
        const x = sheetInfo.padding + c * (sheetInfo.tileW + sheetInfo.padding) - 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sheetInfo.h); ctx.stroke();
      }
      for (let r = 0; r <= sheetInfo.rows; r++) {
        const y = sheetInfo.padding + r * (sheetInfo.tileH + sheetInfo.padding) - 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sheetInfo.w, y); ctx.stroke();
      }
    }
  }, [sheetBitmap, sheetInfo, overlay, showSheet]);

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
                <RangeControls
                  duration={info.durationSec}
                  startSec={startSec}
                  endSec={endSec}
                  onChange={(s, e) => { setStartSec(s); setEndSec(e); }}
                />
                <SamplingControls
                  targetFps={targetFps}
                  scaleMode={scaleMode}
                  sourceWidth={info.width}
                  sourceHeight={info.height}
                  onFpsChange={setTargetFps}
                  onScaleModeChange={setScaleMode}
                />
                <GridControls
                  columns={columns}
                  padding={padding}
                  autoOptimize={autoOptimizeGrid}
                  onColumnsChange={setColumns}
                  onPaddingChange={setPadding}
                  onAutoOptimizeChange={setAutoOptimizeGrid}
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
                        onChange={(e) => setExportFormat(e.target.value as 'jpeg' | 'png')}
                      >
                        <option value="jpeg">JPEG (mozjpeg)</option>
                        <option value="png">PNG (oxipng)</option>
                      </select>
                    </div>

                    {exportFormat === 'jpeg' && (
                      <>
                        <div className="field-row">
                          <label>Quality</label>
                          <input
                            type="range" min={10} max={100} value={jpegQuality}
                            onChange={(e) => setJpegQuality(Number(e.target.value))}
                            className="slider"
                          />
                          <span className="field-value">{jpegQuality}</span>
                        </div>
                        <div className="field-row">
                          <label>Max KB</label>
                          <input
                            type="number" placeholder="none" value={jpegMaxKB}
                            onChange={(e) => setJpegMaxKB(e.target.value === '' ? '' : Number(e.target.value))}
                            className="num-input"
                          />
                        </div>
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

                    {exportError && <div className="error-banner" style={{ marginTop: 8 }}>{exportError}</div>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
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
                              maxFileSizeBytes: jpegMaxKB ? Number(jpegMaxKB) * 1024 : undefined,
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
                      <button
                        className="btn-secondary"
                        disabled={busy || !layoutRef.current}
                        onClick={() => {
                          if (!info || !layoutRef.current) return;
                          exportMetadata({
                            file: file!,
                            layout: layoutRef.current,
                            info,
                            extract: { startSec, endSec, targetFps },
                            frameTimestampsMs: timestampsRef.current,
                          });
                        }}
                      >
                        Export JSON
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
            <div className="preview-content">
              <div className="preview-toolbar">
                <span className="preview-info">
                  {sheetInfo.w}×{sheetInfo.h} · {sheetInfo.cols}×{sheetInfo.rows} grid
                </span>
                <div className="view-toggle">
                  <button
                    className={`view-toggle__btn${showSheet ? ' view-toggle__btn--active' : ''}`}
                    onClick={() => setShowSheet(true)}
                  >
                    Sheet
                  </button>
                  <button
                    className={`view-toggle__btn${!showSheet ? ' view-toggle__btn--active' : ''}`}
                    onClick={() => setShowSheet(false)}
                  >
                    Animate
                  </button>
                </div>
                {showSheet && (
                  <label className="grid-overlay-label">
                    <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                    Grid
                  </label>
                )}
              </div>

              <div className="preview-frame">
                {!showSheet ? (() => {
                  const fc = timestampsRef.current.length;
                  const dur = endSec - startSec;
                  const actualFps = fc > 1 && dur > 0 ? fc / dur : targetFps;
                  return (
                    <SpritePlayer
                      bitmap={sheetBitmap}
                      layout={layoutRef.current!}
                      fps={actualFps}
                      frameCount={fc || sheetInfo.cols * sheetInfo.rows}
                    />
                  );
                })() : (
                  <canvas
                    ref={canvasRef}
                    style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 140px)', width: 'auto', height: 'auto', display: 'block' }}
                  />
                )}
              </div>
            </div>
          ) : (
            <p className="placeholder">
              {isReady ? 'Configure controls and click Generate preview.' : 'Upload a video to get started.'}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
