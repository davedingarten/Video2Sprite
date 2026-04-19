// Actual emitted fps may diverge from requested targetFps when the source
// can't supply enough samples in the range. Compute from the timestamps
// we actually kept so preview and exported snippets show the same speed.
export function computeActualFps(
  frameTimestampsMs: readonly number[],
  durationSec: number,
  fallbackFps: number,
): number {
  if (frameTimestampsMs.length > 0 && durationSec > 0) {
    return frameTimestampsMs.length / durationSec;
  }
  return fallbackFps;
}
