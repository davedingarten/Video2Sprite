# Video2Sprite — Implementation Progress

Step-by-step build plan. Each phase produces something verifiable before moving on. Check items off as they're completed.

**Status legend:** `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Scaffold `[x]`

Goal: app boots to an empty two-pane layout; folder structure and shared types in place.

- [x] `npm create vite@latest` — React + TypeScript
- [x] Install deps: `mp4box`
- [x] Folder structure: `src/{components,hooks,lib/video,lib/spritesheet,lib/export,types}`
- [x] Shared types in `src/types/index.ts`: `FrameSample`, `GridLayout`, `SpriteSheetMeta`, `ExportOptions`, `VideoFileInfo`
- [x] Stub empty modules in each `lib/*` folder so imports resolve
- [x] `App.tsx` renders empty left (controls) / right (preview) shell
- [x] `npm run dev` boots without errors (`vite build` also passes)

**Verify:** ✅ app loads, two-pane layout visible, no console errors. Build + dev both clean.

---

## Phase 2 — Video decode pipeline `[x]`

Goal: given an MP4 file, start/end, and target fps, produce `VideoFrame`s at requested timestamps.

- [x] `lib/video/demuxer.ts` — mp4box.js wrapper: track metadata + sample list, codec description extraction for AVC / HEVC / VP9 / AV1; fallback to `info.tracks` scan when mp4box drops a codec from `videoTracks` (e.g. ProRes)
- [x] `lib/video/capability.ts` — `VideoDecoder.isConfigSupported()` probe; friendly error if unsupported
- [x] `lib/video/decoder.ts` — `VideoDecoder` wrapper with backpressure (cap in-flight frames); caller owns `VideoFrame.close()`
- [x] `lib/video/sampler.ts` — nearest-frame picker; widens decode window back to preceding keyframe for P/B-frame context
- [x] `lib/video/extract.ts` — top-level orchestrator (demux → capability → plan → decode → emit kept frames)
- [x] Temporary test button in `App.tsx`

**Verified:** MP4/H.264 at 1080x1920, 20 frames @ 10fps emitted in 140ms, timestamps aligned to 100ms grid. ProRes MOV surfaces a specific error (no browser VideoDecoder supports ProRes; expected).

---

## Phase 3 — Sprite sheet compositor `[x]`

Goal: stream of `VideoFrame`s → single composed canvas.

- [x] `lib/spritesheet/layout.ts` — manual grid (cols + padding → rows, sheet dims)
- [x] `lib/spritesheet/auto-optimize.ts` — pick column count keeping sheet ≤ 4096×4096 with minimum empty tiles
- [x] `lib/spritesheet/compositor.ts` — `OffscreenCanvas` when available, `HTMLCanvasElement` fallback; draw each frame into its tile with padding; close `VideoFrame` immediately after draw
- [x] `hooks/useSpriteSheet.ts` — wires decoder stream → compositor, exposes progress

**Verified:** sheet renders in preview pane, tiles align with grid overlay, repeated runs don't grow memory.

---

## Phase 4 — Export pipeline `[x]`

Goal: produce downloadable blobs for all exports. Compression must match the CLI's quality (mozjpeg for JPEG, oxipng for PNG).

- [x] `lib/export/jpeg.ts` — **mozjpeg via `@jsquash/jpeg`**; quality slider; binary-search max-size cap; canvas fallback
- [x] `lib/export/png.ts` — **oxipng lossless** + **UPNG.js palette quantization** (2–256 colors, Floyd–Steinberg dither); oxipng post-pass on quantized output
- [x] `lib/export/stills.ts` — first and last frames of the selected range at 2× tile size; same format/quality controls as sheet
- [x] `lib/export/metadata.ts` — JSON: `{ sheet: {w,h}, tile: {w,h}, padding, columns, rows, fps, codec, container, frames: [{index, x, y, width, height, timestampMs}] }`
- [x] `lib/export/snippet.ts` — CSS keyframes animation + tiny JS frame-stepper + demo HTML
- [x] `hooks/useExport.ts` — `exportAll` (sheet + stills + snippet) and `exportMetadata` (JSON only); downloads via `URL.createObjectURL` + `<a download>`

**Verified:** build clean, all modules type-check, JPEG/PNG compression visible in test harness.

---

## Phase 5 — UI shell and controls `[x]`

Goal: all controls visible, file info populates after upload. Can run in parallel with phases 2–4.

- [x] `components/Uploader.tsx` — drag/drop + file picker
- [x] `components/FileInfoPanel.tsx` — filename, size, container, codec, resolution, source fps, duration
- [x] `components/RangeControls.tsx` — start/end time sliders with numeric input
- [x] `components/SamplingControls.tsx` — target fps, scale mode (fit-width / fit-height / explicit w×h)
- [x] `components/GridControls.tsx` — columns, padding, auto-optimize toggle
- [x] `hooks/useVideoFile.ts` — upload → demuxer → metadata state
- [x] Minimal clean styling (`components/components.css` with CSS variables)

**Verified:** upload populates file info, all controls interactive, Generate preview runs and displays sheet.

---

## Phase 6 — Preview, progress, exports wired up `[ ]`

Goal: end-to-end flow from upload to downloads.

- [ ] `components/PreviewStrip.tsx` — scrubbable thumbnail strip at output tile size; playback at chosen fps
- [ ] "Generate preview" button — explicit trigger (not on every control change)
- [ ] `components/ProgressPanel.tsx` — two-phase progress (decode / composite) with frame counts
- [ ] Preview pane shows rendered sheet after generation with tile-grid overlay toggle
- [ ] `components/ExportPanel.tsx` — "Export sprite sheet" (sheet + stills + CSS/JS) and "Export JSON" buttons trigger downloads
- [ ] `components/ErrorBanner.tsx` — friendly inline messages for unsupported codec/container/browser

**Verify:** full flow with an MP4/H.264 file end-to-end; preview plays; exports download; intentionally-bad codec shows friendly error.

---

## Phase 7 — Polish, test, and README `[ ]`

Goal: ship-ready.

- [ ] Browser support gate at app boot (`'VideoDecoder' in window`)
- [ ] Manual test matrix: MP4/H.264 ✓, MOV ✓, HEVC (if browser supports) ✓, AV1 (if browser supports) ✓, corrupt file, 0-length range, range beyond duration, very long videos
- [ ] Auto-grid keeps sheet within 4096×4096 across range of inputs
- [ ] JPEG max-size cap convergence verified
- [ ] Metadata JSON is structurally correct and timestamps align with source
- [ ] Animation snippet visibly animates in a standalone HTML file
- [ ] `README.md` — usage, container/codec support matrix, browser support, `VideoFrame` lifecycle note, 4096 cap explanation, extension points (WebM/MKV demuxer, other containers)

**Verify:** README reads as complete documentation; all manual tests pass.

---

## Notes / decisions log

_Record non-obvious decisions and why, as they come up._

- **Demuxer**: mp4box.js (ISO BMFF: MP4, MOV, M4V). WebM/MKV deferred — needs different demuxer.
- **Codecs**: accept any codec `VideoDecoder.isConfigSupported()` says yes to. Probe per-file.
- **4096×4096 sheet cap**: GPU texture upload limit on many devices. Auto-grid optimizes within this.
- **Preview is not auto-regenerated** on control change — decoding is expensive. User clicks "Generate preview" explicitly.
