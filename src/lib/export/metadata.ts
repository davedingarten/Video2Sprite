import type { FramePlacement, GridLayout, SpriteSheetMeta, VideoFileInfo } from '../../types';
import { tilePosition } from '../spritesheet/layout';

export interface MetadataInput {
  layout: GridLayout;
  info: VideoFileInfo;
  // fps chosen for the output (not the source fps)
  fps: number;
  // parallel arrays of kept frame indices + their source timestamps in ms
  frameTimestampsMs: number[];
}

export function buildMetadata(input: MetadataInput): SpriteSheetMeta {
  const { layout, info, fps, frameTimestampsMs } = input;
  const frames: FramePlacement[] = frameTimestampsMs.map((ms, index) => {
    const { x, y } = tilePosition(layout, index);
    return {
      index,
      x,
      y,
      width: layout.tileWidth,
      height: layout.tileHeight,
      timestampMs: ms,
    };
  });

  return {
    sheet: { width: layout.sheetWidth, height: layout.sheetHeight },
    tile: { width: layout.tileWidth, height: layout.tileHeight },
    padding: layout.padding,
    columns: layout.columns,
    rows: layout.rows,
    fps,
    codec: info.codec,
    container: info.container,
    frames,
  };
}

export function metadataBlob(meta: SpriteSheetMeta): Blob {
  const text = JSON.stringify(meta, null, 2);
  return new Blob([text], { type: 'application/json' });
}
