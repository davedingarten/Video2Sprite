import type { ScaleMode } from '../types';

interface Props {
  targetFps: number;
  scaleMode: ScaleMode;
  sourceWidth: number;
  sourceHeight: number;
  onFpsChange: (fps: number) => void;
  onScaleModeChange: (mode: ScaleMode) => void;
}

export function SamplingControls({
  targetFps,
  scaleMode,
  sourceWidth,
  sourceHeight,
  onFpsChange,
  onScaleModeChange,
}: Props) {
  const kind = scaleMode.kind;

  function setKind(k: ScaleMode['kind']) {
    if (k === 'fit-width') onScaleModeChange({ kind: 'fit-width', width: 320 });
    else if (k === 'fit-height') onScaleModeChange({ kind: 'fit-height', height: 240 });
    else onScaleModeChange({ kind: 'explicit', width: sourceWidth, height: sourceHeight });
  }

  return (
    <section className="control-section">
      <h3 className="control-section__title">Sampling</h3>

      <div className="field-row">
        <label>Target fps</label>
        <input
          type="number"
          min={1}
          max={60}
          step={1}
          value={targetFps}
          onChange={(e) => onFpsChange(Math.max(1, Math.min(60, Number(e.target.value))))}
          className="num-input"
        />
      </div>

      <div className="field-row">
        <label>Scale</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as ScaleMode['kind'])} className="select">
          <option value="fit-width">Fit width</option>
          <option value="fit-height">Fit height</option>
          <option value="explicit">Explicit</option>
        </select>
      </div>

      {kind === 'fit-width' && (
        <div className="field-row">
          <label>Width px</label>
          <input
            type="number" min={1} max={4096} step={1}
            value={(scaleMode as { kind: 'fit-width'; width: number }).width}
            onChange={(e) => onScaleModeChange({ kind: 'fit-width', width: Number(e.target.value) })}
            className="num-input"
          />
        </div>
      )}
      {kind === 'fit-height' && (
        <div className="field-row">
          <label>Height px</label>
          <input
            type="number" min={1} max={4096} step={1}
            value={(scaleMode as { kind: 'fit-height'; height: number }).height}
            onChange={(e) => onScaleModeChange({ kind: 'fit-height', height: Number(e.target.value) })}
            className="num-input"
          />
        </div>
      )}
      {kind === 'explicit' && (
        <div className="field-row">
          <label>W × H px</label>
          <input
            type="number" min={1} max={4096}
            value={(scaleMode as { kind: 'explicit'; width: number; height: number }).width}
            onChange={(e) => onScaleModeChange({
              kind: 'explicit',
              width: Number(e.target.value),
              height: (scaleMode as { kind: 'explicit'; width: number; height: number }).height,
            })}
            className="num-input"
            style={{ width: 70 }}
          />
          <span style={{ color: 'var(--muted)' }}>×</span>
          <input
            type="number" min={1} max={4096}
            value={(scaleMode as { kind: 'explicit'; width: number; height: number }).height}
            onChange={(e) => onScaleModeChange({
              kind: 'explicit',
              width: (scaleMode as { kind: 'explicit'; width: number; height: number }).width,
              height: Number(e.target.value),
            })}
            className="num-input"
            style={{ width: 70 }}
          />
        </div>
      )}
    </section>
  );
}
