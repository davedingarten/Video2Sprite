interface Props {
  duration: number;
  startSec: number;
  endSec: number;
  onChange: (startSec: number, endSec: number) => void;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function RangeControls({ duration, startSec, endSec, onChange }: Props) {
  const step = duration > 60 ? 0.1 : 0.01;

  function setStart(v: number) {
    onChange(clamp(v, 0, endSec - step), endSec);
  }
  function setEnd(v: number) {
    onChange(startSec, clamp(v, startSec + step, duration));
  }

  return (
    <section className="control-section">
      <h3 className="control-section__title">Range</h3>
      <div className="range-row">
        <label className="range-label">Start</label>
        <input
          type="range"
          min={0}
          max={duration}
          step={step}
          value={startSec}
          onChange={(e) => setStart(Number(e.target.value))}
          className="slider"
        />
        <input
          type="number"
          min={0}
          max={endSec - step}
          step={step}
          value={startSec.toFixed(2)}
          onChange={(e) => setStart(Number(e.target.value))}
          className="num-input"
        />
        <span className="range-unit">s</span>
      </div>
      <div className="range-row">
        <label className="range-label">End</label>
        <input
          type="range"
          min={0}
          max={duration}
          step={step}
          value={endSec}
          onChange={(e) => setEnd(Number(e.target.value))}
          className="slider"
        />
        <input
          type="number"
          min={startSec + step}
          max={duration}
          step={step}
          value={endSec.toFixed(2)}
          onChange={(e) => setEnd(Number(e.target.value))}
          className="num-input"
        />
        <span className="range-unit">s</span>
      </div>
    </section>
  );
}
