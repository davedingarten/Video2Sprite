import { useEffect, useRef, useState, useCallback } from 'react';
import type { GridLayout } from '../types';

interface Props {
  bitmap: ImageBitmap;
  layout: GridLayout;
  fps: number;
  frameCount: number;
  // Optional controlled mode — when provided, the component defers to these
  // instead of managing internal state. Lets two players share a scrubber.
  frame?: number;
  playing?: boolean;
  onFrameChange?: (frame: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  hideControls?: boolean;
}

export function SpritePlayer({
  bitmap, layout, fps, frameCount,
  frame: controlledFrame,
  playing: controlledPlaying,
  onFrameChange,
  onPlayingChange,
  hideControls,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isControlled = controlledFrame !== undefined && controlledPlaying !== undefined;
  const [internalPlaying, setInternalPlaying] = useState(true);
  const [internalFrame, setInternalFrame] = useState(0);
  const playing = isControlled ? controlledPlaying! : internalPlaying;
  const frame = isControlled ? controlledFrame! : internalFrame;

  const frameRef = useRef(0);
  const playingRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

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

  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  function setFrame(f: number) {
    if (isControlled) {
      onFrameChange?.(f);
    } else {
      setInternalFrame(f);
    }
  }
  function setPlaying(p: boolean) {
    if (isControlled) {
      onPlayingChange?.(p);
    } else {
      setInternalPlaying(p);
    }
  }

  // Animation loop. Only one of the paired players should run this when
  // controlled externally — otherwise both would race. Convention: the
  // first-mounted controlled player doesn't tick; tick is driven externally
  // via controlledFrame changes. Internal (uncontrolled) mode ticks here.
  useEffect(() => {
    if (isControlled) return;
    const interval = 1000 / Math.max(1, fps);

    function tick(ts: number) {
      if (!playingRef.current) return;
      if (lastTickRef.current === 0) {
        lastTickRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (ts - lastTickRef.current >= interval) {
        const next = (frameRef.current + 1) % frameCount;
        frameRef.current = next;
        setInternalFrame(next);
        drawFrame(next);
        lastTickRef.current += interval;
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
  }, [playing, fps, frameCount, drawFrame, isControlled]);

  // Redraw whenever external frame changes (controlled mode).
  useEffect(() => {
    drawFrame(frame);
  }, [frame, drawFrame]);

  useEffect(() => {
    drawFrame(0);
    if (!isControlled) {
      setInternalFrame(0);
      frameRef.current = 0;
    }
  }, [bitmap, layout, drawFrame, isControlled]);

  function togglePlay() {
    setPlaying(!playing);
    lastTickRef.current = 0;
  }

  function scrub(f: number) {
    if (playing) setPlaying(false);
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
      {!hideControls && (
        <div className="sprite-player__controls">
          <button className="sprite-player__playbtn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? '⏸' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={frameCount - 1}
            value={frame}
            onChange={(e) => scrub(Number(e.target.value))}
            className="sprite-player__scrubber"
          />
          <span className="sprite-player__counter">
            <span>{frame + 1}<span style={{ opacity: 0.45 }}>/{frameCount}</span></span>
            <span style={{ opacity: 0.35, margin: '0 5px' }}>·</span>
            <span>{(frame / fps).toFixed(2)}s<span style={{ opacity: 0.45 }}>/{((frameCount - 1) / fps).toFixed(2)}s</span></span>
          </span>
        </div>
      )}
    </div>
  );
}

interface SharedControlsProps {
  frame: number;
  playing: boolean;
  fps: number;
  frameCount: number;
  onFrame: (f: number) => void;
  onPlaying: (p: boolean) => void;
}

export function SpriteSharedControls({
  frame, playing, fps, frameCount, onFrame, onPlaying,
}: SharedControlsProps) {
  return (
    <div className="sprite-player__controls">
      <button
        className="sprite-player__playbtn"
        onClick={() => onPlaying(!playing)}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={frameCount - 1}
        value={frame}
        onChange={(e) => {
          if (playing) onPlaying(false);
          onFrame(Number(e.target.value));
        }}
        className="sprite-player__scrubber"
      />
      <span className="sprite-player__counter">
        <span>{frame + 1}<span style={{ opacity: 0.45 }}>/{frameCount}</span></span>
        <span style={{ opacity: 0.35, margin: '0 5px' }}>·</span>
        <span>{(frame / fps).toFixed(2)}s<span style={{ opacity: 0.45 }}>/{((frameCount - 1) / fps).toFixed(2)}s</span></span>
      </span>
    </div>
  );
}
