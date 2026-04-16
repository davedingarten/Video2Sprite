export interface SampleTimestamp {
  timestampUs: number;
}

export interface SamplingPlan {
  targetTimestampsUs: number[];
  pickedSampleIndices: number[];
  decodeStartIndex: number; // index of the keyframe at/before the first picked sample
  keepTimestampsUs: Set<number>;
}

// Given source samples and a requested range/fps, choose the nearest source
// sample for each target timestamp, then widen the decode window backward to
// the preceding keyframe so the decoder has enough reference context for
// P/B frames. Without this, non-keyframe picks would be un-decodable.
export function planSampling(
  samples: readonly SampleTimestamp[],
  keyframeIndices: readonly number[],
  startSec: number,
  endSec: number,
  targetFps: number,
): SamplingPlan {
  if (!Number.isFinite(targetFps) || targetFps <= 0) {
    throw new Error(`Invalid target fps: ${targetFps}`);
  }
  if (endSec <= startSec) {
    throw new Error(`End time (${endSec}s) must be greater than start time (${startSec}s).`);
  }
  if (samples.length === 0) {
    return {
      targetTimestampsUs: [],
      pickedSampleIndices: [],
      decodeStartIndex: 0,
      keepTimestampsUs: new Set(),
    };
  }

  const startUs = Math.round(startSec * 1_000_000);
  const endUs = Math.round(endSec * 1_000_000);
  const gapUs = 1_000_000 / targetFps;

  const targets: number[] = [];
  for (let t = startUs; t < endUs; t += gapUs) targets.push(Math.round(t));

  const picked: number[] = [];
  const keep = new Set<number>();
  let cursor = 0;
  for (const target of targets) {
    while (
      cursor + 1 < samples.length &&
      Math.abs(samples[cursor + 1].timestampUs - target) <=
        Math.abs(samples[cursor].timestampUs - target)
    ) {
      cursor++;
    }
    picked.push(cursor);
    keep.add(samples[cursor].timestampUs);
  }

  const firstPicked = picked[0] ?? 0;
  let decodeStart = 0;
  for (const k of keyframeIndices) {
    if (k <= firstPicked) decodeStart = k;
    else break;
  }

  return {
    targetTimestampsUs: targets,
    pickedSampleIndices: picked,
    decodeStartIndex: decodeStart,
    keepTimestampsUs: keep,
  };
}
