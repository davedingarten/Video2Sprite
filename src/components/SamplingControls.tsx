import { useState } from 'react';
import type { ScaleMode } from '../types';

interface Props {
  targetFps: number;
  scaleMode: ScaleMode;
  sourceWidth: number;
  sourceHeight: number;
  onFpsChange: (fps: number) => void;
  onScaleModeChange: (mode: ScaleMode) => void;
}

function getWH(mode: ScaleMode, ar: number): { w: number; h: number } {
  if (mode.kind === 'fit-width') return { w: mode.width, h: Math.round(mode.width / ar) };
  if (mode.kind === 'fit-height') return { w: Math.round(mode.height * ar), h: mode.height };
  return { w: mode.width, h: mode.height };
}

export function SamplingControls({
  targetFps, scaleMode, sourceWidth, sourceHeight,
  onFpsChange, onScaleModeChange,
}: Props) {
  const [lockAR, setLockAR] = useState(true);
  const ar = sourceHeight > 0 ? sourceWidth / sourceHeight : 1;
  const { w, h } = getWH(scaleMode, ar);

  function handleWidth(val: number) {
    const width = Math.max(1, Math.min(4096, val));
    const height = lockAR ? Math.max(1, Math.round(width / ar)) : h;
    onScaleModeChange({ kind: 'explicit', width, height });
  }

  function handleHeight(val: number) {
    const height = Math.max(1, Math.min(4096, val));
    const width = lockAR ? Math.max(1, Math.round(height * ar)) : w;
    onScaleModeChange({ kind: 'explicit', width, height });
  }

  return (
    <section className="control-section">
      <h3 className="control-section__title">Sampling</h3>

      <div className="field-row">
        <label>Target fps</label>
        <input
          type="number" min={1} max={60} step={1} value={targetFps}
          onChange={(e) => onFpsChange(Math.max(1, Math.min(60, Number(e.target.value))))}
          className="num-input num-input--sm"
        />
      </div>

      <div className="field-row">
        <label>Dimensions</label>
        <input
          type="number" min={1} max={4096} step={1} value={w}
          onChange={(e) => handleWidth(Number(e.target.value))}
          className="num-input num-input--sm"
        />
        <span className="range-unit">width</span>
        <input
          type="number" min={1} max={4096} step={1} value={h}
          onChange={(e) => handleHeight(Number(e.target.value))}
          className="num-input num-input--sm"
        />
        <span className="range-unit">height</span>
      </div>

      <div className="field-row">
        <label>Lock AR</label>
        <input
          type="checkbox" checked={lockAR}
          onChange={(e) => setLockAR(e.target.checked)}
        />
      </div>
    </section>
  );
}
