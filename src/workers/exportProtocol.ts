import type { ExportOptions, GridLayout, VideoFileInfo } from '../types';

export type ExportProgressPhase = 'sheet' | 'stills' | 'metadata' | 'snippet' | 'zipping';

export interface PreviewRequest {
  id: number;
  type: 'preview';
  imageData: ImageData;
  options: ExportOptions;
  pngColors?: number;
}

export interface ExportRequest {
  id: number;
  type: 'export';
  sheet: ImageData;
  stills: { first: ImageData; last: ImageData };
  options: ExportOptions;
  pngColors?: number;
  forceOversize?: boolean;
  layout: GridLayout;
  info: VideoFileInfo;
  actualFps: number;
  frameTimestampsMs: number[];
  // Archive name fragment — matches `input.info.filename` base today but the
  // main thread can override if needed.
  baseName: string;
  // Encoded extension chosen from options.format; included so the worker
  // doesn't have to replicate the main-thread mapping.
  ext: string;
}

export type WorkerRequest = PreviewRequest | ExportRequest;

export interface ProgressMessage {
  id: number;
  type: 'progress';
  phase: ExportProgressPhase;
  i?: number;
  n?: number;
}

export interface PreviewSuccessMessage {
  id: number;
  type: 'preview-success';
  buffer: ArrayBuffer;
  mime: string;
  bytes: number;
  quality?: number;
  converged?: boolean;
}

export interface ExportSuccessMessage {
  id: number;
  type: 'export-success';
  zip: ArrayBuffer;
  zipName: string;
}

// Returned in place of export-success when the maxBytes contract can't be
// met and forceOversize was not set. Mirrors the `OversizeInfo` the hook
// surfaces to the UI today.
export interface OversizeMessage {
  id: number;
  type: 'oversize';
  bytes: number;
  quality: number;
  targetBytes: number;
}

export interface ErrorMessage {
  id: number;
  type: 'error';
  message: string;
}

export type WorkerResponse =
  | ProgressMessage
  | PreviewSuccessMessage
  | ExportSuccessMessage
  | OversizeMessage
  | ErrorMessage;
