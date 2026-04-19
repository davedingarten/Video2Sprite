import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from 'react';
import { extractThumbnails } from '../lib/video/thumbnails';

interface Props {
  file: File;
  duration: number;
  startSec: number;
  endSec: number;
  targetFps: number;
  sourceFps: number;
  onChange: (startSec: number, endSec: number) => void;
}

const STRIP_COUNT = 15;
const STRIP_W = 60;
const STRIP_H = 40;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function TimelineEditor({
  file,
  duration,
  startSec,
  endSec,
  targetFps,
  sourceFps,
  onChange,
}: Props) {
  const step = duration > 60 ? 0.1 : 0.01;
  const frames = Math.max(0, Math.round((endSec - startSec) * targetFps));
  const clipDur = Math.max(0, endSec - startSec);
  // Source frame indices — useful for exact-frame trimming independent of
  // the output sampling rate.
  const startFrame = sourceFps > 0 ? Math.round(startSec * sourceFps) : 0;
  const endFrame = sourceFps > 0 ? Math.round(endSec * sourceFps) : 0;
  const maxFrame = sourceFps > 0 ? Math.round(duration * sourceFps) : 0;

  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const [dragPreviewSec, setDragPreviewSec] = useState(startSec);

  // Object URL for the <video> preview source. createObjectURL must run
  // in an effect so the matching revoke always pairs with it — a
  // render-time (useMemo) call can leak on aborted renders / StrictMode.
  const [videoURL, setVideoURL] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-system sync: blob URL lifecycle must pair with revoke in the cleanup
    setVideoURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // When dragging, show the scrub position; otherwise track the range start.
  const previewSec = dragging ? dragPreviewSec : startSec;

  // Filmstrip thumbs via WebCodecs (small, ~15 bitmaps).
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let produced: ImageBitmap[] = [];
    const strip = stripRef.current;
    if (strip) strip.innerHTML = '';

    extractThumbnails(file, duration, STRIP_COUNT, STRIP_W, STRIP_H, controller.signal)
      .then((bitmaps) => {
        if (cancelled || !stripRef.current) {
          for (const b of bitmaps) b.close();
          return;
        }
        produced = bitmaps;
        const host = stripRef.current;
        host.innerHTML = '';
        for (const b of bitmaps) {
          const c = document.createElement('canvas');
          c.width = b.width;
          c.height = b.height;
          const ctx = c.getContext('2d');
          if (ctx) ctx.drawImage(b, 0, 0);
          host.appendChild(c);
        }
      })
      .catch(() => { /* non-fatal: strip stays empty */ });

    return () => {
      cancelled = true;
      controller.abort();
      for (const b of produced) b.close();
    };
  }, [file, duration]);

  // Seek the <video> on scrub changes. Browser coalesces rapid seeks — only the
  // last currentTime actually decodes, which is exactly what we want.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(previewSec)) return;
    if (v.readyState < 1) return;
    if (Math.abs(v.currentTime - previewSec) > 0.005) {
      v.currentTime = previewSec;
    }
  }, [previewSec]);

  function secondsFromClientX(clientX: number): number {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * duration;
  }

  function handlePointerDown(which: 'start' | 'end') {
    return (e: RPointerEvent<HTMLDivElement>) => {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setDragging(which);
      setDragPreviewSec(which === 'start' ? startSec : endSec);
    };
  }

  function handlePointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const s = secondsFromClientX(e.clientX);
    if (dragging === 'start') {
      const clamped = clamp(s, 0, endSec - step);
      onChange(clamped, endSec);
      setDragPreviewSec(clamped);
    } else {
      const clamped = clamp(s, startSec + step, duration);
      onChange(startSec, clamped);
      setDragPreviewSec(clamped);
    }
  }

  function handlePointerUp(e: RPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    setDragging(null);
  }

  const lo = duration > 0 ? (startSec / duration) * 100 : 0;
  const hi = duration > 0 ? (endSec / duration) * 100 : 100;

  function setStart(v: number) {
    onChange(clamp(v, 0, endSec - step), endSec);
  }
  function setEnd(v: number) {
    onChange(startSec, clamp(v, startSec + step, duration));
  }
  function setStartFrame(f: number) {
    if (sourceFps <= 0) return;
    setStart(clamp(f, 0, maxFrame) / sourceFps);
  }
  function setEndFrame(f: number) {
    if (sourceFps <= 0) return;
    setEnd(clamp(f, 0, maxFrame) / sourceFps);
  }

  return (
    <div className="timeline-editor">
      <h3 className="timeline-editor__title">Set range</h3>
      <p className="timeline-editor__subtitle">
        Drag the handles to pick the start and end of the clip.
      </p>

      <div className="timeline-editor__preview">
        {videoURL && (
          <video
            ref={videoRef}
            src={videoURL}
            className="timeline-editor__video"
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={() => {
              if (videoRef.current) videoRef.current.currentTime = previewSec;
            }}
          />
        )}
        <div className="timeline-editor__time-badge">
          {previewSec.toFixed(2)}s
        </div>
      </div>

      <div
        ref={trackRef}
        className="timeline-editor__track"
        style={{ '--lo': `${lo}%`, '--hi': `${hi}%` } as CSSProperties}
      >
        <div className="timeline-editor__strip-clip">
          <div ref={stripRef} className="timeline-editor__strip" aria-hidden />
          <div className="timeline-editor__dim timeline-editor__dim--left" />
          <div className="timeline-editor__dim timeline-editor__dim--right" />
        </div>
        <div className="timeline-editor__frame" aria-hidden />
        <div
          className="timeline-editor__handle timeline-editor__handle--start"
          role="slider"
          aria-label="Start"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={startSec}
          onPointerDown={handlePointerDown('start')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M2.5 1L6.5 7L2.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div
          className="timeline-editor__handle timeline-editor__handle--end"
          role="slider"
          aria-label="End"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={endSec}
          onPointerDown={handlePointerDown('end')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M5.5 1L1.5 7L5.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <div className="timeline-editor__inputs">
        <div className="timeline-editor__input-group">
          <span className="timeline-editor__input-label">Start</span>
          <input
            type="number" min={0} max={endSec - step} step={step}
            value={startSec.toFixed(2)}
            onChange={(e) => setStart(Number(e.target.value))}
            className="num-input num-input--sm"
          />
          <span className="range-unit">s</span>
          <input
            type="number" min={0} max={Math.max(0, endFrame - 1)} step={1}
            value={startFrame}
            onChange={(e) => setStartFrame(Number(e.target.value))}
            className="num-input num-input--sm"
            disabled={sourceFps <= 0}
          />
          <span className="range-unit">f</span>
        </div>
        <div className="timeline-editor__input-group">
          <span className="timeline-editor__input-label">End</span>
          <input
            type="number" min={startSec + step} max={duration} step={step}
            value={endSec.toFixed(2)}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="num-input num-input--sm"
          />
          <span className="range-unit">s</span>
          <input
            type="number" min={startFrame + 1} max={maxFrame} step={1}
            value={endFrame}
            onChange={(e) => setEndFrame(Number(e.target.value))}
            className="num-input num-input--sm"
            disabled={sourceFps <= 0}
          />
          <span className="range-unit">f</span>
        </div>
        <span className="timeline-editor__meta">
          {clipDur.toFixed(2)}s · {frames} frames @ {targetFps} fps
        </span>
      </div>
    </div>
  );
}
