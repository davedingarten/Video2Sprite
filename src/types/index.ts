export type ContainerKind = 'mp4' | 'mov' | 'm4v';

export type ScaleMode =
  | { kind: 'fit-width'; width: number }
  | { kind: 'fit-height'; height: number }
  | { kind: 'explicit'; width: number; height: number };

export interface VideoFileInfo {
  filename: string;
  sizeBytes: number;
  container: ContainerKind;
  codec: string;
  width: number;
  height: number;
  sourceFps: number;
  durationSec: number;
}

export interface FrameSample {
  index: number;
  timestampMs: number;
}

export interface GridLayout {
  columns: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  padding: number;
  sheetWidth: number;
  sheetHeight: number;
  frameCount: number;
  emptyTiles: number;
}

export interface FramePlacement {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  timestampMs: number;
}

export interface SpriteSheetMeta {
  sheet: { width: number; height: number };
  tile: { width: number; height: number };
  padding: number;
  columns: number;
  rows: number;
  fps: number;
  codec: string;
  container: ContainerKind;
  frames: FramePlacement[];
}

export type ExportFormat = 'png' | 'jpeg';

export interface ExportOptions {
  format: ExportFormat;
  jpegQuality: number;
  maxFileSizeBytes?: number;
}
