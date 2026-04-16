import { useCallback, useState } from 'react';
import { demuxFile } from '../lib/video/demuxer';
import { checkCodecSupport } from '../lib/video/capability';
import type { VideoFileInfo, ContainerKind } from '../types';
import type { DemuxedTrack } from '../lib/video/demuxer';

export type VideoFileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface VideoFileState {
  file: File | null;
  info: VideoFileInfo | null;
  status: VideoFileStatus;
  error: string | null;
}

function trackToInfo(file: File, track: DemuxedTrack): VideoFileInfo {
  return {
    filename: file.name,
    sizeBytes: file.size,
    container: track.container as ContainerKind,
    codec: track.codec,
    width: track.width,
    height: track.height,
    sourceFps: track.sourceFps,
    durationSec: track.durationSec,
  };
}

export function useVideoFile() {
  const [state, setState] = useState<VideoFileState>({
    file: null,
    info: null,
    status: 'idle',
    error: null,
  });

  const load = useCallback(async (file: File) => {
    setState({ file, info: null, status: 'loading', error: null });
    try {
      const { track } = await demuxFile(file);
      await checkCodecSupport(track.codec, track.width, track.height, track.description);
      const info = trackToInfo(file, track);
      setState({ file, info, status: 'ready', error: null });
    } catch (err) {
      setState({ file, info: null, status: 'error', error: (err as Error).message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ file: null, info: null, status: 'idle', error: null });
  }, []);

  return { ...state, load, reset };
}
