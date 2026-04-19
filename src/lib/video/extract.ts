import type { VideoFileInfo } from '../../types';
import { demuxFile, type DemuxedTrack } from './demuxer';
import { checkCodecSupport } from './capability';
import { decodeSamples, type DecodeableSample, type DecodeConfig } from './decoder';
import { planSampling, type SamplingPlan } from './sampler';

export interface ExtractOptions {
  startSec: number;
  endSec: number;
  targetFps: number;
}

export interface ExtractedFrame {
  frame: VideoFrame; // caller MUST call .close()
  outputIndex: number; // 0-based index among emitted frames
  timestampMs: number;
}

export interface ExtractResult {
  info: VideoFileInfo;
  framesEmitted: number;
  targetsRequested: number;
}

// A prepared decode plan. Splitting this out from runExtract lets callers learn
// framesPlanned (== emitted count) without paying for a full decode pass.
export interface ExtractPlan {
  info: VideoFileInfo;
  track: DemuxedTrack;
  window: DecodeableSample[];
  decoderConfig: DecodeConfig;
  plan: SamplingPlan;
  framesPlanned: number;
  targetsRequested: number;
}

export async function prepareExtract(
  file: File,
  options: ExtractOptions,
): Promise<ExtractPlan> {
  const { track, samples } = await demuxFile(file);
  await checkCodecSupport(track.codec, track.width, track.height, track.description);

  const info: VideoFileInfo = {
    filename: file.name,
    sizeBytes: file.size,
    container: track.container,
    codec: track.codec,
    width: track.width,
    height: track.height,
    sourceFps: track.sourceFps,
    durationSec: track.durationSec,
  };

  const keyframes: number[] = [];
  for (let i = 0; i < samples.length; i++) if (samples[i].isSync) keyframes.push(i);

  const plan = planSampling(samples, keyframes, options.startSec, options.endSec, options.targetFps);

  const lastPicked = plan.pickedSampleIndices[plan.pickedSampleIndices.length - 1] ?? plan.decodeStartIndex;
  const window: DecodeableSample[] = samples.slice(plan.decodeStartIndex, lastPicked + 1).map((s) => ({
    data: s.data,
    timestampUs: s.timestampUs,
    durationUs: s.durationUs,
    isKey: s.isSync,
  }));

  return {
    info,
    track,
    window,
    decoderConfig: {
      codec: track.codec,
      description: track.description,
      codedWidth: track.width,
      codedHeight: track.height,
    },
    plan,
    framesPlanned: plan.keepTimestampsUs.size,
    targetsRequested: plan.targetTimestampsUs.length,
  };
}

export async function runExtract(
  prepared: ExtractPlan,
  onFrame: (f: ExtractedFrame) => void,
): Promise<number> {
  let emitted = 0;
  await decodeSamples(prepared.window, prepared.decoderConfig, (frame) => {
    if (frame.timestamp !== null && prepared.plan.keepTimestampsUs.has(frame.timestamp)) {
      onFrame({ frame, outputIndex: emitted++, timestampMs: frame.timestamp / 1000 });
    } else {
      frame.close();
    }
  });
  return emitted;
}

export async function extractFrames(
  file: File,
  options: ExtractOptions,
  onFrame: (f: ExtractedFrame) => void,
): Promise<ExtractResult> {
  const prepared = await prepareExtract(file, options);
  const emitted = await runExtract(prepared, onFrame);
  return {
    info: prepared.info,
    framesEmitted: emitted,
    targetsRequested: prepared.targetsRequested,
  };
}
