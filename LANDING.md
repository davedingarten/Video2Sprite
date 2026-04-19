# Video2Sprite

### Turn any video into a sprite sheet — right in your browser.

Drop in an MP4 or MOV. Get a pixel-perfect sprite sheet, ready-to-drop animation code, and size-capped exports in seconds. No uploads, no accounts, no waiting on a server.

---

## Why Video2Sprite?

Display networks ban video. Animated GIFs look terrible. Lottie can't render the video you already have. Sprite sheets are the answer — a single image, a single `<div>`, every browser, every ad platform.

But building them is a chore: frame extraction, grid math, size-capping for strict ad-tech limits, writing the animation loop. Video2Sprite collapses all of that into a single screen.

---

## Features

### Frame-accurate extraction
Powered by **WebCodecs** — the same decoder Chrome, Edge, and Safari use for native video. Every frame comes out exact. No seek-drift, no duplicate frames, no missing ones.

### 100% client-side
Your video never leaves your machine. There's no server, no upload, no bandwidth cost, and no privacy worry. The app is a static page; your browser does all the work.

### Filmstrip trimmer
Scrub through your clip on a live preview while 15 thumbnails show the whole timeline. Pick start and end to the millisecond — or to the exact frame, thanks to dual sec/frame input boxes per handle.

### Smart grid layout
- **Auto mode** picks an optimal columns × rows grid that fits within the 4096 px GPU texture cap.
- **Manual mode** lets you set columns *or* rows — the other updates automatically to fit your frame count.
- Padding between tiles, if you need it.

### Target-size export
Need the sheet under **150 KB** for an ad slot? Set a max file size and Video2Sprite bisects the JPEG or WebP quality until it fits — then reports the achieved quality so you know how much headroom you have. Warns you up-front if your target isn't reachable.

### Three export formats
- **PNG** (lossless, via OxiPNG)
- **JPEG** (with quality bisection)
- **WebP** (lossy or lossless, with quality bisection)

### One-click animation code
Export your sheet and get a `demo.html` that showcases four ways to drive it — side by side, in the same page:

- **steps-css** — pure CSS keyframes, no JS, auto-plays.
- **vanilla-js** — frame-stepper with play / pause / seek.
- **tiny-js** — 10-line `setInterval` loop for when you just need it to run.
- **GSAP** — tween-based, scrub-able, ScrollTrigger-ready.

Every driver lives in its own isolated section so you can copy-paste the one you want.

### Bonus exports
- First frame at 2× (perfect for ad fallback stills)
- Last frame at 2×
- JSON metadata — frame count, fps, grid, tile size — for when you're feeding a custom engine

### Two-phase progress
Decode and composite each get their own progress bar. No mystery spinners.

### Friendly errors
Wrong codec? Wrong browser? Unsupported container? You get a plain-English explanation, not a silent console error.

---

## Perfect for

- **Ad creatives** where video is banned but motion sells
- **Banner animations** that need to stay under strict KB limits
- **Game devs** prototyping sprite animations from reference footage
- **UI designers** turning mockup recordings into loopable promos

---

## How it works

1. Drop in a video (MP4 / MOV, up to ~100 MB comfortably).
2. Trim with the filmstrip scrubber.
3. Pick your target fps, grid, format, and size cap.
4. Hit **Export sprite sheet**.
5. Drop the sheet + demo.html on your server. Done.

No installs. No signups. No usage limits. No file leaves your device.

---

## Browser support

Chrome, Edge, Safari, Firefox (any current version). Codec support varies by browser — Video2Sprite probes your browser's decoder for each upload and tells you up front if something won't work.

---

**Ready?** Drop a video into the uploader and watch it become a sprite sheet.
