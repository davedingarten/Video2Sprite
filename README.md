# Video2Sprite

A fully client-side web app that converts a local video file into a sprite sheet. Frame-accurate extraction via WebCodecs, mozjpeg / oxipng / WebP compression, and a ZIP bundle of the sheet + stills + metadata + playback snippets.

Primary use case: **banner ads where video is disallowed**. The sprite-sheet-plus-snippet bundle is the tool's reason to exist — it's what ad networks accept in contexts where `<video>` or animated images don't ship.

## Features

- **Drop in a video** (MP4 / MOV / M4V, H.264 / HEVC / AV1 / VP9 — whichever the browser's `VideoDecoder` supports)
- **iOS-style timeline trimmer** with filmstrip thumbnails and frame-precise scrubbing
- **Sampling controls** — target fps, output tile width/height (with AR lock)
- **Grid layout** — Auto (minimize empty tiles within 4096×4096), lock Columns, or lock Rows (e.g. rows=1 for a single-row filmstrip)
- **Compression preview** — encode the current sheet and see the file size + visual diff before exporting
- **Split view** — original vs compressed with a shared scrubber
- **Export formats** — JPEG (mozjpeg), PNG (oxipng + UPNG palette quantization), WebP (lossy bisect or lossless)
- **Max-KB target** — binary-search the quality that fits (JPEG + WebP)
- **Playback snippets** (pick any combo)
  - CSS `steps()` keyframes (no JS)
  - Vanilla JS frame-stepper with play/pause/seek
  - Tiny JS (~10 lines, loop forever, no API)
  - GSAP (returns a scrub-able tween; pairs with ScrollTrigger)
- **Exports as a single ZIP** — `spritesheet.{jpg,png,webp}`, `first.*`, `last.*` at 2× tile size, `metadata.json`, `anim.css`, `anim.js`, `anim-tiny.js`, `anim-gsap.js`, `demo.html`

Everything runs in the browser. No backend. No ffmpeg.wasm.

## Stack

- Vite + React + TypeScript
- [mp4box.js](https://github.com/gpac/mp4box.js/) — MP4 / MOV / M4V demuxing
- [WebCodecs `VideoDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder) — frame-accurate decode
- [`OffscreenCanvas`](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) (with `HTMLCanvasElement` fallback) — sheet compositing
- `@jsquash/jpeg` (mozjpeg), `@jsquash/webp`, `@jsquash/oxipng` + `upng-js` — encoders

## Getting started

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Serve the built app
```

## Supported inputs

| Container | Status |
|---|---|
| MP4 (`.mp4`, `.m4v`) | ✅ |
| QuickTime (`.mov`) | ✅ (same ISO BMFF family as MP4) |
| WebM / MKV | ❌ (different demuxer, deferred) |

| Codec | Status |
|---|---|
| H.264 / AVC | ✅ everywhere |
| HEVC | ⚠️ browser-dependent |
| AV1 | ⚠️ browser-dependent |
| VP9 | ⚠️ browser-dependent |
| ProRes | ❌ (no browser `VideoDecoder` supports it) |

Codec support is probed per-file via `VideoDecoder.isConfigSupported()` — unsupported codecs surface a specific error naming the codec string.

## Browser support

Requires a browser with WebCodecs (`VideoDecoder`). Chromium-based browsers work out of the box. Safari gained WebCodecs recently; feature availability varies by OS version. Firefox is behind a flag at the time of writing.

## Non-obvious constraints

- **4096×4096 sheet cap.** Many GPUs cap texture uploads around there. Auto-grid picks a column count that keeps the sheet within this and minimizes empty tiles. When manual settings overshoot, a warning bar shows in the preview pane.
- **`VideoFrame.close()` is `free()`.** Frames are GPU-backed. We close each frame immediately after drawing it into the sheet.
- **Seeks don't substitute for WebCodecs.** `HTMLVideoElement.currentTime` is frame-precise for *display* (used in the timeline preview), but is not a substitute for WebCodecs during extraction.
- **Preview is manually triggered.** Decoding is expensive; sliders don't re-decode. The user clicks "Generate preview" explicitly, which also locks the controls until "Edit settings" is clicked.

## Layout

```
src/
  components/        Uploader, FileInfoPanel, TimelineEditor, SamplingControls,
                     GridControls, SpritePlayer
  hooks/             useVideoFile, useExport
  lib/
    video/           demuxer, decoder, capability probe, sampler, extract, thumbnails
    spritesheet/     layout, auto-optimize, compositor
    export/          jpeg, png, webp, stills, metadata, snippet
  types/             shared types
  App.tsx, main.tsx
```

## License

TBD.
