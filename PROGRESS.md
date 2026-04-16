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

## Phase 2 — Video decode pipeline `[ ]`

Goal: given an MP4 file, start/end, and target fps, produce `VideoFrame`s at requested timestamps.

- [ ] `lib/video/demuxer.ts` — mp4box.js wrapper: load file, return `{ track, codec, description, duration, width, height, fps, container }`
- [ ] `lib/video/capability.ts` — `VideoDecoder.isConfigSupported()` probe; throws friendly error if unsupported
- [ ] `lib/video/decoder.ts` — `VideoDecoder` wrapper with backpressure (cap in-flight frames), strict `VideoFrame.close()` on every output
- [ ] `lib/video/sampler.ts` — given start/end/fps, compute target timestamps; nearest-frame picker
- [ ] `hooks/useFrameDecoder.ts` — orchestrates demux → decode → sample, yields frames via async iterator/callback

**Verify:** console-log frame dump from a sample MP4; confirm timestamps match expected sampling grid; no memory growth when sampling hundreds of frames.

---

## Phase 3 — Sprite sheet compositor `[ ]`

Goal: stream of `VideoFrame`s → single composed canvas.

- [ ] `lib/spritesheet/layout.ts` — manual grid (cols + padding → rows, sheet dims)
- [ ] `lib/spritesheet/auto-optimize.ts` — pick column count keeping sheet ≤ 4096×4096 with minimum empty tiles
- [ ] `lib/spritesheet/compositor.ts` — `OffscreenCanvas` when available, `HTMLCanvasElement` fallback; draw each frame into its tile with padding; close `VideoFrame` immediately after draw
- [ ] `hooks/useSpriteSheet.ts` — wires decoder stream → compositor, exposes progress

**Verify:** render a sheet to a canvas and show it in the preview pane; tile boundaries visible; no memory growth.

---

## Phase 4 — Export pipeline `[ ]`

Goal: produce downloadable blobs for all exports.

- [ ] `lib/export/png.ts` — canvas → PNG blob
- [ ] `lib/export/jpeg.ts` — canvas → JPEG blob with quality slider; optional max-file-size cap via binary-search on quality
- [ ] `lib/export/stills.ts` — first and last `VideoFrame` at 2× tile size (re-decode or cache); same format/quality controls as sheet
- [ ] `lib/export/metadata.ts` — JSON: `{ sheet: {w,h}, tile: {w,h}, padding, columns, rows, fps, codec, container, frames: [{index, x, y, width, height, timestampMs}] }`
- [ ] `lib/export/snippet.ts` — CSS keyframes animation + tiny JS frame-stepper
- [ ] `hooks/useExport.ts` — triggers browser downloads via `URL.createObjectURL` + `<a download>`

**Verify:** all blobs open/validate correctly; animation snippet plays in a test HTML file; JPEG max-size cap actually converges.

---

## Phase 5 — UI shell and controls `[ ]`

Goal: all controls visible, file info populates after upload. Can run in parallel with phases 2–4.

- [ ] `components/Uploader.tsx` — drag/drop + file picker
- [ ] `components/FileInfoPanel.tsx` — filename, size, container, codec, resolution, source fps, duration
- [ ] `components/RangeControls.tsx` — start/end time sliders with numeric input
- [ ] `components/SamplingControls.tsx` — target fps, scale mode (fit-width / fit-height / explicit w×h)
- [ ] `components/GridControls.tsx` — columns, padding, auto-optimize toggle
- [ ] `hooks/useVideoFile.ts` — upload → demuxer → metadata state
- [ ] Minimal clean styling (CSS modules or similar)

**Verify:** upload a file, all info populates correctly, all controls are interactive.

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
