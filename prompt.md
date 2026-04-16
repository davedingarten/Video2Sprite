Create a Vite + React + TypeScript web app that converts a local video file into a sprite sheet using the WebCodecs API with frame-accurate decoding.

## Tech constraints

- Fully client-side, no backend.
- No ffmpeg.wasm.
- Use **mp4box.js** for demuxing and **WebCodecs `VideoDecoder`** for decoding. This is required for frame-accurate extraction — `HTMLVideoElement` seeking is not reliable enough.
- Use canvas (prefer `OffscreenCanvas` where supported, fall back to `HTMLCanvasElement`) for sprite sheet compositing.
- **Containers**: ISO BMFF family (MP4, MOV, M4V). WebM/MKV is future work (needs a different demuxer).
- **Codecs**: accept any codec the browser's `VideoDecoder.isConfigSupported()` returns supported (H.264/AVC, HEVC/H.265, AV1, VP9, etc.). Probe support at file-load time and show a friendly error if the specific codec isn't decodable in this browser.
- Modular architecture, readable code, not over-engineered.

## Core features

- Upload a local video file.
- Configure **start time** and **end time** (seconds, not duration).
- Choose **fps** for sampling (if source fps differs, pick nearest decoded frame per target timestamp).
- Choose scale mode: **fit width**, **fit height**, or **explicit width × height**. Preserve aspect ratio unless explicit both.
- Choose **columns** (rows derived) and **padding between tiles** (px).
- **Auto-optimize grid** toggle: pick a column count that keeps the sheet within 4096×4096 (GPU texture limit on many devices) with minimum empty tiles. Warn if the user's manual layout exceeds 4096 on either axis.
- **Preview selected frames**: show a scrubbable thumbnail strip of the frames that will be sampled, rendered at the chosen output tile size, and allow playing them back at the chosen fps so the user can verify the range before generating.
- Generate the final sprite sheet.
- Export as **PNG** or **JPEG**. For JPEG: quality slider (1–100) and optional **max file size** cap (reduce quality until under cap, report final quality used).
- Export **first and last frame** as standalone stills at **2× the tile size** (alongside the sheet). Same format/quality controls as the sheet.
- Export **JSON metadata**: sheet dimensions, tile dimensions, padding, columns/rows, fps, source codec/container, and per-frame `{ index, x, y, width, height, timestampMs }`.
- Export a generated **CSS + JS snippet** showing how to animate the sprite sheet (background-position keyframes + a small JS frame-stepper).
- All exports trigger browser downloads (use `URL.createObjectURL` / `<a download>`); no server round-trip.
- Clear progress UI for the two phases (decode, composite) and actionable error messages (unsupported codec, decoder failure, canvas/memory limits, etc.).

## UI

- Minimal, clean two-pane layout: **controls on the left, preview on the right**.
- Primary action buttons: **Upload**, **Generate preview**, **Export sprite sheet**, **Export JSON**.
  - Preview is not auto-regenerated on every control change (decoding is expensive) — user triggers it explicitly.
  - "Export sprite sheet" also emits the first/last stills and the CSS+JS snippet as part of the same action.
- Preview pane shows: the scrubbable thumbnail strip before generation, and the rendered sprite sheet (with tile grid overlay toggle) after generation.
- File info panel: filename, size, container, codec, resolution, source fps, duration.
- Processing status: two-phase progress (decode, composite) with frame counts.
- Unsupported codec / container / browser errors render as a friendly inline message, not a console log or alert.

## Browser support & limitations to document

- WebCodecs: Chrome/Edge full, Safari 16.4+, Firefox recent. Detect `'VideoDecoder' in window` and show a friendly unsupported message.
- Codec availability varies by browser (e.g., HEVC is OS/browser-dependent; AV1 needs recent builds). Always probe `VideoDecoder.isConfigSupported()` per file and report the exact codec that couldn't be decoded.
- Canvas max size varies; GPU texture upload often caps at 4096–8192. Auto-grid addresses this.
- Large videos: decoded `VideoFrame`s are GPU-backed and **must be `.close()`d** promptly to avoid memory pressure. Don't hold all frames in memory — composite into the sheet canvas as each frame arrives, or batch.
- Document extension points for WebM/MKV containers (alternate demuxer) and any codec-specific quirks encountered.

## Suggested folder structure

```
src/
  components/        UI (Uploader, RangeControls, GridControls, PreviewStrip, ProgressPanel, ExportPanel)
  hooks/             useVideoFile, useFrameDecoder, useSpriteSheet, useExport
  lib/
    video/           mp4box demuxer wrapper, VideoDecoder wrapper, frame sampling, timestamp math
    spritesheet/     grid layout (incl. auto-optimize under 4096), canvas compositor, padding
    export/          PNG encoder, JPEG encoder w/ quality+size cap, JSON metadata, CSS/JS snippet generator
  types/             shared types (FrameSample, GridLayout, SpriteSheetMeta, ExportOptions)
  App.tsx, main.tsx
```

## Code style

- TypeScript everywhere, explicit types on module boundaries.
- Small, single-purpose functions.
- Comments only where the reason is non-obvious (e.g., why we close VideoFrames, why 4096 cap, why nearest-timestamp sampling).
- No premature abstractions, no speculative config.

## Before writing code, first:

1. Propose the folder structure (confirm or adjust).
2. Explain the architecture briefly — specifically the decode → sample → composite → encode pipeline and how backpressure / VideoFrame lifecycle is handled.
3. List assumptions and browser limitations.
4. Then generate the code.

Do not skip straight to a giant single-file implementation. Include a README explaining usage, the H.264-only limitation, and concrete extension points for broader codec/container support.
