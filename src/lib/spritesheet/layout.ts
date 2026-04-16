import type { GridLayout } from '../../types';

export interface LayoutInput {
  columns: number;
  frameCount: number;
  tileWidth: number;
  tileHeight: number;
  padding: number;
}

// Padding applies on every edge and between every tile, so a sheet with
// `cols` columns has `cols + 1` padding bands horizontally.
export function computeLayout(input: LayoutInput): GridLayout {
  const { columns, frameCount, tileWidth, tileHeight, padding } = input;
  if (columns < 1) throw new Error('columns must be >= 1');
  if (frameCount < 1) throw new Error('frameCount must be >= 1');
  if (tileWidth < 1 || tileHeight < 1) throw new Error('tile dimensions must be >= 1');
  if (padding < 0) throw new Error('padding must be >= 0');

  const rows = Math.ceil(frameCount / columns);
  const sheetWidth = columns * tileWidth + (columns + 1) * padding;
  const sheetHeight = rows * tileHeight + (rows + 1) * padding;
  const emptyTiles = rows * columns - frameCount;

  return {
    columns,
    rows,
    tileWidth,
    tileHeight,
    padding,
    sheetWidth,
    sheetHeight,
    frameCount,
    emptyTiles,
  };
}

export function tilePosition(layout: GridLayout, index: number): { x: number; y: number } {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  const x = layout.padding + col * (layout.tileWidth + layout.padding);
  const y = layout.padding + row * (layout.tileHeight + layout.padding);
  return { x, y };
}
