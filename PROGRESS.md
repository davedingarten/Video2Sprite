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

---

## Phase 2 — Video decode pipeline `[x]`

Goal: given an MP4 file, start/end, and target fps, produce `VideoFrame`s at requested timestamps.

- [x] `lib/video/demuxer.ts` — mp4box.js wrapper
- [x] `lib/video/capability.ts` — `VideoDecoder.isConfigSupported()` probe
- [x] `lib/video/decoder.ts` — backpressured `VideoDecoder` wrapper
- [x] `lib/video/sampler.ts` — nearest-frame picker with keyframe widening
- [x] `lib/video/extract.ts` — top-level orchestrator

---

## Phase 3 — Sprite sheet compositor `[x]`

- [x] `lib/spritesheet/layout.ts`
- [x] `lib/spritesheet/auto-optimize.ts`
- [x] `lib/spritesheet/compositor.ts`
- [x] `hooks/useSpriteSheet.ts`

---

## Phase 4 — Export pipeline `[x]`

- [x] `lib/export/jpeg.ts` — mozjpeg via `@jsquash/jpeg` + max-size bisection + canvas fallback
- [x] `lib/export/png.ts` — oxipng lossless + UPNG palette quantization
- [x] `lib/export/webp.ts` — `@jsquash/webp` with quality/max-size bisection + lossless toggle
- [x] `lib/export/stills.ts` — first/last frames at 2× tile size
- [x] `lib/export/metadata.ts` — structured JSON
- [x] `lib/export/snippet.ts` — CSS steps, vanilla JS, tiny JS, and GSAP drivers; selectable
- [x] `hooks/useExport.ts` — single-click ZIP export

---

## Phase 5 — UI shell and controls `[x]`

- [x] `components/Uploader.tsx`
- [x] `components/FileInfoPanel.tsx`
- [x] `components/TimelineEditor.tsx` — iOS-style trimmer with filmstrip + `<video>` scrubbing preview
- [x] `components/SamplingControls.tsx` — fps + dimensions (width/height with AR lock)
- [x] `components/GridControls.tsx` — layout mode (Auto / Columns / Rows) + padding
- [x] `hooks/useVideoFile.ts`
- [x] Styling (`components/components.css`, `App.css` — light theme, Albert Sans, DD Studio palette)

---

## Phase 6 — Preview, progress, exports wired up `[x]`

- [x] Explicit "Generate preview" trigger (not re-decoded on slider changes)
- [x] Two-phase progress (counting → compositing) with frame counts
- [x] Sprite player: play/pause/scrub; live "Animate" / "Sheet" view toggle
- [x] Compression preview — encode the current sheet at the selected settings and show the result byte-size
- [x] Side-by-side Original vs Compressed split view with a single shared scrubber
- [x] Grid overlay toggle
- [x] Settings lock: freezes controls after preview; explicit "Edit settings" to re-unlock and regenerate
- [x] Export: sheet + first/last stills (2×) + metadata JSON + snippet files packaged as a ZIP
- [x] Export JSON: separate button, metadata only
- [x] Friendly inline error messaging for unsupported codec/container/browser
- [x] Preview-pane warning bar when the sheet exceeds the 4096 GPU cap

---

## Phase 7 — Polish, test, and README `[~]`

- [x] Browser support gated implicitly via `VideoDecoder.isConfigSupported()` probe with friendly error
- [x] Auto-grid keeps sheet ≤ 4096×4096 when possible; warns in preview when it can't
- [x] JPEG max-size cap via binary search (7 encodes ≈ 0..100)
- [x] WebP max-size cap — same bisection shape, respects lossless bypass
- [x] Metadata JSON structurally correct
- [x] Animation snippets animate correctly as standalone files
- [x] `README.md` — user-facing docs
- [ ] Manual test matrix across codecs/containers (MP4/H.264 ✓, MOV ✓, HEVC, AV1, corrupt file, 0-length range, very long videos)

---

## Post-MVP changes (2026-04)

- Replaced dual-range slider with iOS-style `TimelineEditor`: filmstrip thumbnails via WebCodecs + `<video>` element for frame-precise scrubbing.
- Light theme + Albert Sans typography; dropped Source Code Pro (0/8 ambiguity at small sizes).
- Grid layout radio: Auto / Columns / Rows (Rows=1 → single-row filmstrip).
- Export-format selector now includes WebP; JPEG + WebP share quality + max-KB controls.
- Playback-snippet picker: CSS steps, Vanilla JS, Tiny JS, GSAP — emitted on demand.
- Compression preview decoupled from full export — encode once, see file size and visual diff, then export.

---

## Notes / decisions log

- **Demuxer**: mp4box.js (ISO BMFF: MP4, MOV, M4V). WebM/MKV deferred — needs different demuxer.
- **Codecs**: accept any codec `VideoDecoder.isConfigSupported()` says yes to. Probe per-file.
- **4096×4096 sheet cap**: GPU texture upload limit on many devices. Auto-grid optimizes within this; a warning bar surfaces in the preview pane when the layout overshoots.
- **`<video>` vs WebCodecs for preview**: WebCodecs for extraction (frame-accurate); `<video>.currentTime` for the trimmer preview (also frame-precise for display, and the browser coalesces rapid seeks).
- **Animated image export** (GIF / animated WebP): declined. See `feature.md`.
- **Preview is not auto-regenerated** on control change — decoding is expensive. User clicks "Generate preview" explicitly; controls lock after generation until explicitly unlocked.
