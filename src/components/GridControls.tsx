export type LayoutMode = 'auto' | 'columns' | 'rows';

interface Props {
  layoutMode: LayoutMode;
  columns: number;
  rows: number;
  padding: number;
  onLayoutModeChange: (m: LayoutMode) => void;
  onColumnsChange: (c: number) => void;
  onRowsChange: (r: number) => void;
  onPaddingChange: (p: number) => void;
}

export function GridControls({
  layoutMode,
  columns,
  rows,
  padding,
  onLayoutModeChange,
  onColumnsChange,
  onRowsChange,
  onPaddingChange,
}: Props) {
  return (
    <section className="control-section">
      <h3 className="control-section__title">Grid</h3>

      <div className="field-row">
        <label>Layout</label>
        <div className="radio-group">
          <label className="radio-group__item">
            <input
              type="radio"
              name="layout-mode"
              checked={layoutMode === 'auto'}
              onChange={() => onLayoutModeChange('auto')}
            />
            <span>Auto</span>
          </label>
          <label className="radio-group__item">
            <input
              type="radio"
              name="layout-mode"
              checked={layoutMode === 'columns'}
              onChange={() => onLayoutModeChange('columns')}
            />
            <span>Columns</span>
          </label>
          <label className="radio-group__item">
            <input
              type="radio"
              name="layout-mode"
              checked={layoutMode === 'rows'}
              onChange={() => onLayoutModeChange('rows')}
            />
            <span>Rows</span>
          </label>
        </div>
      </div>

      {layoutMode === 'columns' && (
        <div className="field-row">
          <label>Columns</label>
          <input
            type="number"
            min={1}
            max={256}
            step={1}
            value={columns}
            onChange={(e) => onColumnsChange(Math.max(1, Number(e.target.value)))}
            className="num-input num-input--sm"
          />
        </div>
      )}

      {layoutMode === 'rows' && (
        <div className="field-row">
          <label>Rows</label>
          <input
            type="number"
            min={1}
            max={256}
            step={1}
            value={rows}
            onChange={(e) => onRowsChange(Math.max(1, Number(e.target.value)))}
            className="num-input num-input--sm"
          />
        </div>
      )}

      <div className="field-row">
        <label>Padding</label>
        <input
          type="number"
          min={0}
          max={64}
          step={1}
          value={padding}
          onChange={(e) => onPaddingChange(Math.max(0, Number(e.target.value)))}
          className="num-input num-input--sm"
        />
        <span className="range-unit">px</span>
      </div>
    </section>
  );
}
