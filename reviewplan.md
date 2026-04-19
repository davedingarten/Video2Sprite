# Review Plan

Combined punch list from two code reviews (self-review + external review). Ordered by priority. Each item lists the concrete fix and the files to touch.

---

## P0 — Correctness bugs (ship-blocking)

### 1. Snippet timing mismatch between preview and export
**Problem.** Preview uses `actualFps = emittedFrames / duration` (`src/App.tsx:654`), but export snippet generation hard-codes the requested `targetFps` (`src/hooks/useExport.ts:163`). When the source can't supply the requested fps, the exported animation runs faster than what the user saw in-app.

**Fix.**
- In `useExport.ts`, compute `actualFps = frameTimestampsMs.length / (endSec - startSec)` (same formula as preview) and pass that to `buildSnippet` and metadata.
- Fall back to `targetFps` only when the timestamps array is empty.
- Unify: extract a `computeActualFps(timestamps, dur, fallback)` helper in `src/lib/video/` and call it from both `App.tsx` and `useExport.ts` so they can't drift again.

### 2. Trim range leakage (frames outside start/end)
**Problem.** `planSampling()` picks the nearest sample to each target timestamp (`src/lib/video/sampler.ts:48`), so the first emitted frame can be < `startSec` and the last can be > `endSec`.

**Fix.**
- After picking the nearest sample, clamp: if the chosen sample timestamp < `startSec` or > `endSec`, snap to the next sample on the *inside* of the range (if one exists).
- If the range is shorter than one sample interval, pick the single sample nearest the midpoint of the range but still within `[startSec, endSec]`; if none exists, throw a friendly `"Range too short for any source frame"` error.
- Add unit test for this (see P2 testing item).

### 3. Oversized export has no UI failure path
**Problem.** When the encoder can't hit the max-size target during *export* (not preview), `useExport.ts:131` logs a `console.warn` and the app still writes the oversized file to the ZIP. User gets a silent broken-contract asset.

**Fix.**
- Surface a hard error through `useExport`'s error state when `result.converged === false` and `maxFileSizeBytes` was set.
- UI: show the error banner in the Export section with the same message style used elsewhere ("Can't reach N KB — smallest is X KB at quality Q. Reduce fps, range, or dimensions.").
- Offer a "Export anyway" button so the user can opt in after acknowledging.

### 4. Max-size / lossless contract dropped in fallback paths
**Problem.** On primary encoder failure, `useExport.ts:75` falls back to `encodeJpegCanvasFallback` / `encodeWebpCanvasFallback` which accept only `quality` (see `src/lib/export/jpeg.ts:114`, `src/lib/export/webp.ts:99`). `maxBytes` and `lossless` are silently discarded.

**Fix.**
- Either: extend the canvas fallbacks to honor `maxBytes` (bisect by calling `toBlob` in a loop), or
- Refuse to fall back when `maxBytes`/`lossless` is set and surface the primary error instead (simpler, more honest).
- Recommend the latter — canvas fallback is an emergency path, not a contract-honoring path.

### 5. Silent compression errors in preview
**Problem.** `previewCompression()` in `App.tsx:312-314` catches and discards errors. CLAUDE.md explicitly forbids silent console errors.

**Fix.** Add `const [compressError, setCompressError] = useState<string | null>(null)` and show a banner in the Export section. Clear on setting change (same effect that clears `encodeResult`).

---

## P1 — Robustness

### 6. Thumbnail extraction assumes OffscreenCanvas
**Problem.** `src/lib/video/thumbnails.ts:17` unconditionally constructs `OffscreenCanvas`. `main.tsx:8` only gates on `VideoDecoder`, and the compositor already has an `HTMLCanvasElement` fallback (`src/lib/spritesheet/compositor.ts:17`). So upload succeeds but the filmstrip crashes on browsers without `OffscreenCanvas`.

**Fix.** Mirror the compositor's fallback pattern: try `OffscreenCanvas`, fall back to a detached `HTMLCanvasElement`. Pass `ImageBitmap`s out either way.

### 7. Lint gate failing
**Problem.** `npm run lint` currently reports:
- `_err` unused in `src/App.tsx:312` (will be removed by P0 #5)
- Effect-driven state updates in `TimelineEditor.tsx:54`, `TimelineEditor.tsx:107`, `SpritePlayer.tsx:115`

**Fix.**
- The `_err` goes away once we surface the error.
- Audit the three effect-driven `setState` calls; most can be replaced by derived state (`useMemo`) or event-driven updates. If any are genuinely effect-bound, refactor until lint passes without suppressions.
- Add `npm run lint` to a pre-push check once clean.

---

## P1 — Code hygiene (self-review items)

### 8. Guard empty snippet variants
**Problem.** `buildHtml` in `src/lib/export/snippet.ts` produces an empty `<body>` when no variants are checked. Currently the UI allows unchecking all.

**Fix.** Disable the Export button when `snippetVariants.length === 0`, or force a minimum of one (keep `steps-css` checked and disabled if nothing else is chosen).

### 9. Replace effect-mirrored axis with derived state
**Problem.** `App.tsx:87-95` uses `useEffect` + `eslint-disable` to keep the non-`manualAxis` axis in sync with `estimatedFrames`. Fragile.

**Fix.** Store only `manualAxis` + the edited value. Derive the other axis via `useMemo` on every render. No effect, no suppression.

### 10. Stale comment in `buildJs`
Trivial: comment in `src/lib/export/snippet.ts` `buildJs` still says "Frame-stepper for .${cls}" but the demo targets `#anim-vanilla`. Leave the library JS targeting any passed-in element; update the comment.

---

## P2 — Performance

### 11. Cache demux / sample plans
**Problem.** `extractFrames` is called twice in `generateSheet` (count then composite) at `App.tsx:220` and `App.tsx:245`; stills extraction re-decodes again at `stills.ts:29` and `stills.ts:47`. Each call re-demuxes, re-probes, and re-decodes.

**Fix.**
- Collapse the count+composite pass: composite into a growable buffer, finalize the layout after the last frame, then composite a single pass into the final canvas. Or pre-compute `frameCount` from `planSampling()` without decoding.
- Cache the demux result + sample plan per-file so stills extraction reuses it.
- Expected win: ~2× faster generate, ~1.5× faster full export on long clips.

---

## P2 — Testing

### 12. Automated tests
`test/` currently only holds fixture videos. Add Vitest-based unit tests for:
- `planSampling()` — boundary behavior for trim range (covers P0 #2).
- `buildSnippet()` — actualFps vs targetFps output; variants produce isolated `demo.html` sections (covers P0 #1 and the recent refactor).
- `encodeJpeg` / `encodeWebp` bisection convergence — synthetic `ImageData` with known compressibility.
- `autoOptimize()` — 4096 cap honored.

---

## Execution order (recommended)

1. **P0 #1, #2, #5** — correctness bugs, small surgical fixes.
2. **P0 #3, #4** — export contract honesty (UI + fallback path).
3. **P1 #6, #7** — thumbnails fallback + lint clean.
4. **P1 #8, #9, #10** — UX/hygiene.
5. **P2 #11, #12** — perf + tests.

Target: P0 shippable in one sitting; P1 in a follow-up PR; P2 scoped as separate issues.
