# Video2Sprite — Project Instructions

A fully client-side web app that converts a local video file into a sprite sheet with frame-accurate extraction via WebCodecs.

## Quick orientation

- `prompt.md` — the canonical spec. Read this first.
- `PROGRESS.md` — step-by-step implementation plan with checkable status. Update it as phases move forward.
- `src/` — application code (once scaffolded).

## Tech stack

- **Vite + React + TypeScript**
- **mp4box.js** — MP4/MOV/M4V (ISO BMFF) demuxing
- **WebCodecs `VideoDecoder`** — frame-accurate decode (any codec the browser supports)
- **`OffscreenCanvas`** (with `HTMLCanvasElement` fallback) — sprite sheet compositing
- **No backend. No ffmpeg.wasm.** Everything runs in the browser.

## Architecture at a glance

```
Upload → Demux (mp4box) → Decode (VideoDecoder) → Sample frames
  → Composite into sheet canvas (with padding) → Encode (PNG/JPEG)
  → Exports: sheet, first/last stills at 2×, JSON metadata, CSS+JS snippet
```

Two phases the UI surfaces to the user: **decode** and **composite**.

## Folder layout

```
src/
  components/        UI (Uploader, RangeControls, GridControls, PreviewStrip, ProgressPanel, ExportPanel, ...)
  hooks/             useVideoFile, useFrameDecoder, useSpriteSheet, useExport
  lib/
    video/           demuxer, decoder, capability probe, sampler
    spritesheet/     layout, auto-optimize, compositor
    export/          png, jpeg, stills, metadata, snippet
  types/             shared types
  App.tsx, main.tsx
```

## Non-obvious rules / gotchas

- **Always `.close()` a `VideoFrame` immediately after use.** Frames are GPU-backed. Leaking a handful is fine; leaking hundreds will crash the tab. Treat it like `free()`.
- **Do not buffer all frames in memory.** Stream: decode one → draw into sheet canvas → close. Backpressure the decoder so in-flight frames are capped.
- **Probe the codec per-file.** Call `VideoDecoder.isConfigSupported()` before decoding. HEVC/AV1/VP9 availability varies by browser and OS. Report the exact codec string when it fails.
- **4096×4096 sheet cap.** Many GPUs cap texture uploads around there. Auto-grid picks a column count that keeps the sheet within this and minimizes empty tiles. Warn when manual settings blow past it.
- **Preview is manually triggered.** Don't re-decode on every slider tick — the user clicks "Generate preview" when ready.
- **`HTMLVideoElement` seeking is NOT a substitute** for WebCodecs. It's not frame-accurate. Don't fall back to it.
- **H.264 inside MOV works** via mp4box (both are ISO BMFF). WebM/MKV would need a different demuxer — deferred.

## Exports (from one "Export sprite sheet" action)

- Sprite sheet (PNG or JPEG with quality slider + optional max-file-size cap)
- First frame still at 2× tile size
- Last frame still at 2× tile size
- CSS + JS animation snippet

Plus a separate "Export JSON" button for the metadata file.

## UI

- Two-pane: controls left, preview right.
- Primary buttons: **Upload**, **Generate preview**, **Export sprite sheet**, **Export JSON**.
- File info panel: filename, size, container, codec, resolution, source fps, duration.
- Two-phase progress (decode + composite) with frame counts.
- Friendly inline error messaging for unsupported codec/container/browser — no `alert()`, no silent console errors.

## Code style

- TypeScript everywhere, explicit types at module boundaries.
- Small, single-purpose functions.
- Comments only where the *why* is non-obvious (e.g., `VideoFrame.close()` calls, 4096 cap, nearest-timestamp sampling). No narration of what the code does.
- No premature abstractions or speculative config. Three similar lines beats the wrong abstraction.
- No backwards-compat shims during development. Change code directly.

## Development

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build
npm run preview    # preview built app
```

## When in doubt

Re-read `prompt.md` — it's the source of truth for scope. Update `PROGRESS.md` as tasks move to in-progress or done.
