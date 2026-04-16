interface Props {
  columns: number;
  padding: number;
  autoOptimize: boolean;
  onColumnsChange: (c: number) => void;
  onPaddingChange: (p: number) => void;
  onAutoOptimizeChange: (v: boolean) => void;
}

export function GridControls({
  columns,
  padding,
  autoOptimize,
  onColumnsChange,
  onPaddingChange,
  onAutoOptimizeChange,
}: Props) {
  return (
    <section className="control-section">
      <h3 className="control-section__title">Grid</h3>

      <div className="field-row">
        <label>
          <input
            type="checkbox"
            checked={autoOptimize}
            onChange={(e) => onAutoOptimizeChange(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Auto-optimize columns
        </label>
      </div>

      {!autoOptimize && (
        <div className="field-row">
          <label>Columns</label>
          <input
            type="number"
            min={1}
            max={256}
            step={1}
            value={columns}
            onChange={(e) => onColumnsChange(Math.max(1, Number(e.target.value)))}
            className="num-input"
          />
        </div>
      )}

      <div className="field-row">
        <label>Padding px</label>
        <input
          type="number"
          min={0}
          max={64}
          step={1}
          value={padding}
          onChange={(e) => onPaddingChange(Math.max(0, Number(e.target.value)))}
          className="num-input"
        />
      </div>
    </section>
  );
}
