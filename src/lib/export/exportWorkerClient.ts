import type { ExportOptions, GridLayout, VideoFileInfo } from '../../types';
import type {
  ExportProgressPhase,
  ExportRequest,
  PreviewRequest,
  WorkerResponse,
} from '../../workers/exportProtocol';

// Single lazy worker instance reused across preview + export calls.
// Spawning a new worker per click added ~100ms + WASM cold-start each time.
let worker: Worker | null = null;
let nextId = 1;

type ProgressHandler = (phase: ExportProgressPhase, i?: number, n?: number) => void;

interface Pending {
  resolve: (value: WorkerResponse) => void;
  reject: (err: Error) => void;
  onProgress?: ProgressHandler;
}

const pending = new Map<number, Pending>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL('../../workers/export.worker.ts', import.meta.url),
    { type: 'module' },
  );
  worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.phase, msg.i, msg.n);
      return;
    }
    pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(msg);
  };
  worker.onerror = (ev) => {
    const err = new Error(ev.message || 'export worker crashed');
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker = null;
  };
  return worker;
}

export interface PreviewResult {
  blob: Blob;
  bytes: number;
  quality?: number;
  converged?: boolean;
}

export async function previewCompression(
  imageData: ImageData,
  options: ExportOptions,
  pngColors?: number,
  onProgress?: ProgressHandler,
): Promise<PreviewResult> {
  const w = ensureWorker();
  const id = nextId++;
  const req: PreviewRequest = { id, type: 'preview', imageData, options, pngColors };
  const result = await new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage(req);
  });
  if (result.type !== 'preview-success') {
    throw new Error(`unexpected response type: ${result.type}`);
  }
  return {
    blob: new Blob([result.buffer], { type: result.mime }),
    bytes: result.bytes,
    quality: result.quality,
    converged: result.converged,
  };
}

export interface ExportRunInput {
  sheet: ImageData;
  stills: { first: ImageData; last: ImageData };
  options: ExportOptions;
  pngColors?: number;
  forceOversize?: boolean;
  layout: GridLayout;
  info: VideoFileInfo;
  actualFps: number;
  frameTimestampsMs: number[];
  baseName: string;
  ext: string;
}

export type ExportRunResult =
  | { kind: 'success'; zip: Blob; zipName: string }
  | { kind: 'oversize'; bytes: number; quality: number; targetBytes: number };

export async function runExport(
  input: ExportRunInput,
  onProgress?: ProgressHandler,
): Promise<ExportRunResult> {
  const w = ensureWorker();
  const id = nextId++;
  const req: ExportRequest = { id, type: 'export', ...input };
  const result = await new Promise<WorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    w.postMessage(req);
  });
  if (result.type === 'oversize') {
    return {
      kind: 'oversize',
      bytes: result.bytes,
      quality: result.quality,
      targetBytes: result.targetBytes,
    };
  }
  if (result.type !== 'export-success') {
    throw new Error(`unexpected response type: ${result.type}`);
  }
  return {
    kind: 'success',
    zip: new Blob([result.zip], { type: 'application/zip' }),
    zipName: result.zipName,
  };
}
