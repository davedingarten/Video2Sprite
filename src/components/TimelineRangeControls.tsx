import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { extractThumbnails } from '../lib/video/thumbnails';

interface Props {
  file: File;
  duration: number;
  startSec: number;
  endSec: number;
  targetFps: number;
  onChange: (startSec: number, endSec: number) => void;
}

const THUMB_COUNT = 15;
const THUMB_W = 60;
const THUMB_H = 40;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function TimelineRangeControls({ file, duration, startSec, endSec, targetFps, onChange }: Props) {
  const step = duration > 60 ? 0.1 : 0.01;
  const frames = Math.max(0, Math.round((endSec - startSec) * targetFps));

  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  // Thumbnail extraction — re-run when file/duration changes.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let produced: ImageBitmap[] = [];
    const strip = stripRef.current;
    if (!strip) return;
    strip.innerHTML = '';

    extractThumbnails(file, duration, THUMB_COUNT, THUMB_W, THUMB_H, controller.signal)
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
          c.width = THUMB_W;
          c.height = THUMB_H;
          const ctx = c.getContext('2d');
          if (ctx) ctx.drawImage(b, 0, 0);
          host.appendChild(c);
        }
      })
      .catch(() => { /* non-fatal: leave strip empty */ });

    return () => {
      cancelled = true;
      controller.abort();
      for (const b of produced) b.close();
      produced = [];
    };
  }, [file, duration]);

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
    };
  }

  function handlePointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const s = secondsFromClientX(e.clientX);
    if (dragging === 'start') {
      onChange(clamp(s, 0, endSec - step), endSec);
    } else {
      onChange(startSec, clamp(s, startSec + step, duration));
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

  return (
    <section className="control-section">
      <h3 className="control-section__title">Range</h3>

      <div
        ref={trackRef}
        className="timeline"
        style={{ '--lo': `${lo}%`, '--hi': `${hi}%` } as CSSProperties}
      >
        <div ref={stripRef} className="timeline__strip" aria-hidden />
        <div className="timeline__dim timeline__dim--left" />
        <div className="timeline__dim timeline__dim--right" />
        <div className="timeline__frame">
          <div
            className="timeline__handle timeline__handle--start"
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
              <path d="M5.5 1L1.5 7L5.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div
            className="timeline__handle timeline__handle--end"
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
              <path d="M2.5 1L6.5 7L2.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="range-time-row">
        <input
          type="number" min={0} max={endSec - step} step={step}
          value={startSec.toFixed(2)}
          onChange={(e) => setStart(Number(e.target.value))}
          className="num-input"
        />
        <span className="range-unit">s</span>
        <span className="range-sep">—</span>
        <input
          type="number" min={startSec + step} max={duration} step={step}
          value={endSec.toFixed(2)}
          onChange={(e) => setEnd(Number(e.target.value))}
          className="num-input"
        />
        <span className="range-unit">s</span>
        <span className="range-frames">{frames} frames</span>
      </div>
    </section>
  );
}
