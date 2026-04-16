import type { GridLayout } from '../../types';
import { computeLayout } from './layout';

export interface AutoOptimizeInput {
  frameCount: number;
  tileWidth: number;
  tileHeight: number;
  padding: number;
  maxSheetDim?: number;
}

export interface AutoOptimizeResult {
  layout: GridLayout;
  // true when we couldn't find a column count that stays within maxSheetDim.
  // Caller should warn the user — the chosen layout overshoots.
  overMaxDim: boolean;
}

// GPU texture upload on many devices caps around 4096x4096. We pick the
// column count that (1) stays within that box if possible, (2) has the
// fewest empty trailing tiles, and (3) has the smallest resulting sheet
// area as a tie-breaker.
const DEFAULT_MAX_DIM = 4096;

export function autoOptimize(input: AutoOptimizeInput): AutoOptimizeResult {
  const { frameCount, tileWidth, tileHeight, padding } = input;
  const maxDim = input.maxSheetDim ?? DEFAULT_MAX_DIM;

  let bestFit: GridLayout | null = null;
  let bestOver: GridLayout | null = null;

  for (let columns = 1; columns <= frameCount; columns++) {
    const layout = computeLayout({ columns, frameCount, tileWidth, tileHeight, padding });
    const fits = layout.sheetWidth <= maxDim && layout.sheetHeight <= maxDim;

    if (fits) {
      if (!bestFit || isBetter(layout, bestFit)) bestFit = layout;
    } else {
      if (!bestOver || overshootArea(layout, maxDim) < overshootArea(bestOver, maxDim)) {
        bestOver = layout;
      }
    }
  }

  if (bestFit) return { layout: bestFit, overMaxDim: false };
  // fallback: layout with smallest overshoot
  return { layout: bestOver!, overMaxDim: true };
}

function isBetter(a: GridLayout, b: GridLayout): boolean {
  if (a.emptyTiles !== b.emptyTiles) return a.emptyTiles < b.emptyTiles;
  return a.sheetWidth * a.sheetHeight < b.sheetWidth * b.sheetHeight;
}

function overshootArea(l: GridLayout, maxDim: number): number {
  const dx = Math.max(0, l.sheetWidth - maxDim);
  const dy = Math.max(0, l.sheetHeight - maxDim);
  return dx * l.sheetHeight + dy * l.sheetWidth;
}
