import { useEffect, useRef, useState, useCallback } from 'react';
import type { GridLayout } from '../types';

interface Props {
  bitmap: ImageBitmap;
  layout: GridLayout;
  fps: number;
  frameCount: number;
}

export function SpritePlayer({ bitmap, layout, fps, frameCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const playingRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const loopStartRef = useRef<number>(0);

  const drawFrame = useCallback((f: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const col = f % layout.columns;
    const row = Math.floor(f / layout.columns);
    const sx = layout.padding + col * (layout.tileWidth + layout.padding);
    const sy = layout.padding + row * (layout.tileHeight + layout.padding);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      bitmap,
      sx, sy, layout.tileWidth, layout.tileHeight,
      0, 0, canvas.width, canvas.height,
    );
  }, [bitmap, layout]);

  // Animation loop
  useEffect(() => {
    const interval = 1000 / Math.max(1, fps);
    console.log(`[SpritePlayer] start — fps=${fps.toFixed(2)}, frames=${frameCount}, interval=${interval.toFixed(1)}ms`);

    function tick(ts: number) {
      if (!playingRef.current) return;
      if (lastTickRef.current === 0) {
        // First tick: initialise clock without advancing
        lastTickRef.current = ts;
        loopStartRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (ts - lastTickRef.current >= interval) {
        const prev = frameRef.current;
        const next = (prev + 1) % frameCount;
        // Log when loop completes
        if (next === 0) {
          const elapsed = ts - loopStartRef.current;
          const expected = frameCount * interval;
          console.log(`[SpritePlayer] loop done — elapsed=${elapsed.toFixed(0)}ms, expected=${expected.toFixed(0)}ms`);
          loopStartRef.current = ts;
        }
        frameRef.current = next;
        setFrame(next);
        drawFrame(next);
        // Accumulate against when the tick *should* have fired to prevent drift
        lastTickRef.current += interval;
        // If we're more than one interval behind (tab was in background etc.), catch up
        if (ts - lastTickRef.current > interval) lastTickRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    if (playing) {
      lastTickRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, fps, frameCount, drawFrame]);

  // Draw on frame change when scrubbing (not playing)
  useEffect(() => {
    if (!playing) drawFrame(frame);
  }, [frame, playing, drawFrame]);

  // Draw initial frame
  useEffect(() => {
    drawFrame(0);
    setFrame(0);
    frameRef.current = 0;
  }, [bitmap, layout, drawFrame]);

  function togglePlay() {
    const next = !playing;
    playingRef.current = next;
    lastTickRef.current = 0;
    setPlaying(next);
  }

  function scrub(f: number) {
    frameRef.current = f;
    setFrame(f);
  }

  return (
    <div className="sprite-player">
      <canvas
        ref={canvasRef}
        width={layout.tileWidth}
        height={layout.tileHeight}
        className="sprite-player__canvas"
      />
      <div className="sprite-player__controls">
        <button className="sprite-player__playbtn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={frameCount - 1}
          value={frame}
          onChange={(e) => {
            if (playing) { playingRef.current = false; setPlaying(false); }
            scrub(Number(e.target.value));
          }}
          className="sprite-player__scrubber"
        />
        <span className="sprite-player__counter">
          <span>{frame + 1}<span style={{ opacity: 0.45 }}>/{frameCount}</span></span>
          <span style={{ opacity: 0.35, margin: '0 5px' }}>·</span>
          <span>{(frame / fps).toFixed(2)}s<span style={{ opacity: 0.45 }}>/{((frameCount - 1) / fps).toFixed(2)}s</span></span>
        </span>
      </div>
    </div>
  );
}
