# Workers Plan

Plan for improving export responsiveness. Reshuffled so the biggest latency win lands first, and the worker boundary is clean when we get there.

---

## Goal

Keep the UI responsive during compression preview, full export, and ZIP generation — and cut wall-clock time for repeated exports.

The real main-thread blockers today:

- `@jsquash/jpeg` / `@jsquash/webp` WASM encoders (CPU-bound on main)
- `UPNG.encode` with palette quantization (seconds on a 4096² sheet)
- The `maxBytes` quality binary search — runs an encoder 5–10× per export
- `JSZip.generateAsync` DEFLATE
- A second full decode pass inside `extractStills` for first/last frames

Video decode/demux stay on the main thread for now.

---

## Phase 1 — Reduce Repeated Work (do this first)

No worker plumbing. Just stop doing the same work twice. Expected impact: larger than Phase 2 on first-click latency, and sets up a clean worker boundary.

### Targets

1. **Cache demux results.** `demuxFile(file)` should run once per `File` and be reused across preview, export, and still extraction.
2. **Reuse the sampling plan / `frameTimestampsMs`** between preview and export instead of recomputing.
3. **Capture first/last frames during the primary decode pass.** `extractStills` currently re-decodes the whole video. Emit the first and last `ImageData` (or `VideoFrame` → `ImageData`) from the compositor pass and hand them to export alongside the sheet `imageData`.
4. **Remove count-only decode passes** wherever they exist — derive counts from the sampling plan.

### Shape changes

- `useSpriteSheet` (or wherever the compositor runs) returns: `{ sheet: ImageData, firstStill: ImageData, lastStill: ImageData, frameTimestampsMs: number[] }`.
- `extractStills` is deleted or reduced to a no-op wrapper that just forwards the already-captured stills.
- `useExport.exportAll` no longer takes `extract: ExtractOptions` for the purpose of re-extracting stills; it takes `stills: { first: ImageData, last: ImageData }` directly.

### Success criteria

- A second export of the same file does not re-demux or re-decode.
- Export never decodes the video a second time for stills.
- Output ZIP contents are byte-identical to today (same encoder settings).

---

## Phase 2 — Export Worker

Now that stills are plain `ImageData` already captured upstream, the worker owns *all* encoding uniformly.

### Files to add

- `src/workers/export.worker.ts`
- `src/lib/export/exportWorkerClient.ts` — reuses one worker instance across clicks

### Files to update

- `src/hooks/useExport.ts`
- `src/App.tsx` (only if export call signature changes)

### Moves into the worker

- image encoding (jpeg / webp / png + UPNG palette)
- `maxBytes` quality search
- `buildMetadata`
- `buildSnippet`
- `JSZip.generateAsync`

### Stays on the main thread

- React state, buttons, error banners
- Final `downloadBlob` trigger (needs DOM)
- Video decode / demux / compositing (unchanged)

---

## Worker API

Small, explicit, transferables-aware.

### Requests

- `preview-compression`
- `start-export`

### Responses

- `progress`
- `success`
- `error`

### Payloads

`preview-compression`

- `imageData: ImageData`
- `options: ExportOptions`
- `pngColors?: number`

`start-export`

- `sheet: ImageData`
- `stills: { first: ImageData, last: ImageData }`
- `options: ExportOptions`
- `pngColors?: number`
- `layout: GridLayout`
- `info: VideoFileInfo`
- `frameTimestampsMs: number[]`
- `actualFps: number` (computed on main, so the worker doesn't need `computeActualFps`)

`progress`

- `phase: 'sheet' | 'stills' | 'metadata' | 'snippet' | 'zipping'`
- `i?: number`, `n?: number`

`success`

- preview: `{ buffer: ArrayBuffer, mime: string, bytes: number, quality?: number, converged?: boolean }`
- export: `{ zip: ArrayBuffer }` (main thread wraps in `Blob`, triggers download)

`error`

- `{ message: string }`

### Transferables (do not skip)

Every `ImageData` crossing `postMessage` must transfer its backing buffer or it will be **copied**. A 4096² sheet is ~64 MB per copy.

- Sending into the worker: transfer `sheet.data.buffer`, `stills.first.data.buffer`, `stills.last.data.buffer`.
- Sending back out: transfer `zip` (`ArrayBuffer`) and the preview `buffer`.
- After transfer the source `ImageData` is unusable — capture anything you still need (e.g. for UI preview) *before* transferring. The current flow already stashes a preview elsewhere; verify this holds.

### DOM fallbacks inside the worker

The current `encodeImageData` fallbacks (`useExport.ts:77-83`, `png.ts:76`, `jpeg.ts:121`, `webp.ts:106`) create an `HTMLCanvasElement`. That doesn't exist in a worker.

Two options, pick one and commit:

1. **Drop the fallback path inside the worker.** jsquash + UPNG are reliable; main-thread fallbacks exist today mostly as paranoia. Surface the primary error if WASM fails.
2. **Switch fallbacks to `OffscreenCanvas.convertToBlob`**, which works in workers. Acceptable quality, no DOM.

Recommendation: option 1 for simplicity; revisit if we actually see WASM failures in the wild.

### Worker lifecycle

- One worker instance per tab, lazily constructed on first export/preview, kept alive for the session.
- `exportWorkerClient` owns a simple request-id → `{resolve, reject, onProgress}` map so concurrent preview + export calls don't cross streams.
- No termination on success; terminate only if the user navigates away or we detect a stuck request.

---

## Phase 3 — Optional Media Worker (deferred)

Only after Phase 2 is stable and we have a concrete complaint about decode jank.

Candidate work: thumbnail extraction, demuxing, sampling-plan computation, decode/compositing.

Open questions to resolve *before* starting this phase:

- Does `VideoDecoder` work in a Worker in every browser we support? (Chromium yes; Safari has historically lagged.)
- Does `OffscreenCanvas` with `transferToImageBitmap` give us the compositor behavior we need?
- Does mp4box.js run cleanly in a worker bundle under Vite?

Verify, then plan. No speculative work.

---

## Suggested Order

1. Cache `demuxFile` results
2. Reuse sampling plan between preview and export
3. Capture first/last stills during primary decode pass; delete `extractStills` re-decode
4. Add `export.worker.ts` + `exportWorkerClient.ts`
5. Move compression preview into the worker (transferables)
6. Move full export encoding + ZIP into the worker (transferables)
7. Keep download trigger on main
8. Stop. Consider Phase 3 only if decode jank is a real complaint.

---

## Success Criteria

- UI stays responsive during compression preview
- UI stays responsive during export
- Second export of the same file skips demux and avoids a second decode pass
- Export errors surface cleanly in React (worker `error` messages propagate to the existing banner)
- Final ZIP contents match today's non-worker output (same encoders, same options, same file names)
- No `ImageData` copy across `postMessage` — verified by transfer list in every send

---

## Non-Goals

- No new UI during this work
- No change to output file formats or snippet variants
- No change to decode / compositing pipeline in Phase 1 or 2
- No backwards-compat shims for the old non-worker export path once Phase 2 lands — delete it
