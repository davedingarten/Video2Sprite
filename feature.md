# Features

Ideas to build next. Ordered loosely; not a commitment.

## 1. WebP export — ✅ DONE

Shipped: `@jsquash/webp` encoder with quality/max-KB bisection (same shape as JPEG) plus a lossless toggle. Wired into the format selector and compression preview.

**Touchpoints:** `src/lib/export/webp.ts`, `src/hooks/useExport.ts`, `src/App.tsx`.

## 2. Lighter playback snippets + a GSAP variant — ✅ DONE

Shipped: four snippet drivers emitted on demand. The export UI exposes them as four checkboxes; only selected files go into the ZIP.

- `steps-css` — pure-CSS `steps()` keyframes (default on)
- `vanilla-js` — ~50-line `requestAnimationFrame` frame-stepper with play/pause/seek (default on)
- `tiny-js` — ~10-line `setInterval` loop-forever (opt-in)
- `gsap` — returns a scrub-able / pause-able GSAP tween (opt-in; pulls gsap from CDN in demo HTML)

`demo.html` adapts to whichever interactive driver is present.

**Touchpoints:** `src/lib/export/snippet.ts`, `src/hooks/useExport.ts`, `src/App.tsx`.

## 3. Animated image export (GIF / animated WebP) — ❌ DECIDED AGAINST

Considered, skipped. The sprite-sheet-plus-snippet bundle is the tool's value prop precisely because ad networks accept it in contexts where animated images are disallowed. Revisit if users ask for an animated-image escape hatch; start with GIF via a light encoder (`gifenc`).
