import { createFile, DataStream, Endianness } from 'mp4box';
import type { ContainerKind } from '../../types';

export interface DemuxedTrack {
  trackId: number;
  codec: string;
  description?: Uint8Array;
  width: number;
  height: number;
  timescale: number;
  durationSec: number;
  sourceFps: number;
  nbSamples: number;
  container: ContainerKind;
}

export interface DemuxedSample {
  index: number;
  data: Uint8Array;
  timestampUs: number;
  durationUs: number;
  isSync: boolean;
}

export interface DemuxResult {
  track: DemuxedTrack;
  samples: DemuxedSample[];
}

function containerFromName(name: string): ContainerKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.mov')) return 'mov';
  if (lower.endsWith('.m4v')) return 'm4v';
  return 'mp4';
}

// Serialize the codec-specific config box (avcC / hvcC / vpcC / av1C) into
// the Uint8Array that VideoDecoder.configure expects as `description`.
// The 8-byte box header is skipped because the decoder wants only the payload.
function codecDescription(mp4: ReturnType<typeof createFile>, trackId: number): Uint8Array | undefined {
  const trak = (mp4 as unknown as { getTrackById: (id: number) => unknown }).getTrackById(trackId) as {
    mdia?: { minf?: { stbl?: { stsd?: { entries?: Array<Record<string, unknown>> } } } };
  } | null;
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const box = (entry?.avcC ?? entry?.hvcC ?? entry?.vpcC ?? entry?.av1C) as
    | { write: (stream: unknown) => void }
    | undefined;
  if (!box) return undefined;
  const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
  box.write(stream);
  const full = new Uint8Array((stream as unknown as { buffer: ArrayBuffer }).buffer);
  return full.slice(8);
}

export async function demuxFile(file: File): Promise<DemuxResult> {
  const mp4 = createFile();
  const container = containerFromName(file.name);
  const samples: DemuxedSample[] = [];

  return await new Promise<DemuxResult>((resolve, reject) => {
    let videoTrackId: number | null = null;
    let ready = false;

    interface Mp4InfoTrack {
      id: number;
      codec: string;
      type?: 'audio' | 'video' | 'subtitles' | 'metadata';
      timescale: number;
      duration: number;
      nb_samples: number;
      track_width?: number;
      track_height?: number;
      video?: { width: number; height: number };
    }

    (mp4 as unknown as { onError: (err: unknown) => void }).onError = (err) => {
      reject(new Error(`mp4box parse error: ${typeof err === 'string' ? err : JSON.stringify(err)}`));
    };

    (mp4 as unknown as {
      onReady: (info: { videoTracks: Mp4InfoTrack[]; tracks: Mp4InfoTrack[] }) => void;
    }).onReady = (info) => {
      // mp4box sometimes leaves tracks it doesn't recognize out of `videoTracks`
      // (e.g. ProRes). Fall back to scanning all tracks by handler type so the
      // capability probe can report the real codec name instead of a vague
      // "no video track" error.
      const vt: Mp4InfoTrack | undefined =
        info.videoTracks?.[0] ?? info.tracks?.find((t) => t.type === 'video');
      if (!vt) {
        const trackSummary = (info.tracks ?? [])
          .map((t) => `${t.type ?? '?'}/${t.codec || '?'}`)
          .join(', ');
        reject(
          new Error(
            `No decodable video track found. The file may use a codec mp4box.js can't parse (e.g., Apple ProRes). Try H.264 / H.265 / VP9 / AV1. Tracks seen: ${trackSummary || 'none'}.`,
          ),
        );
        return;
      }
      videoTrackId = vt.id;

      const description = codecDescription(mp4, vt.id);
      const durationSec = vt.duration / vt.timescale;
      const track: DemuxedTrack = {
        trackId: vt.id,
        codec: vt.codec,
        description,
        width: vt.video?.width ?? vt.track_width ?? 0,
        height: vt.video?.height ?? vt.track_height ?? 0,
        timescale: vt.timescale,
        durationSec,
        sourceFps: durationSec > 0 ? vt.nb_samples / durationSec : 0,
        nbSamples: vt.nb_samples,
        container,
      };

      (mp4 as unknown as {
        setExtractionOptions: (id: number, user: unknown, opts: { nbSamples: number }) => void;
      }).setExtractionOptions(vt.id, null, { nbSamples: 1000 });

      (mp4 as unknown as { start: () => void }).start();

      ready = true;
      // Defer resolve until flush has drained samples.
      queueMicrotask(() => resolve({ track, samples }));
    };

    interface Mp4Sample {
      cts: number;
      duration: number;
      timescale: number;
      is_sync: boolean;
      data: ArrayBuffer | Uint8Array;
    }

    (mp4 as unknown as {
      onSamples: (id: number, user: unknown, received: Mp4Sample[]) => void;
    }).onSamples = (_id, _user, received) => {
      for (const s of received) {
        const data = s.data instanceof Uint8Array ? s.data : new Uint8Array(s.data);
        samples.push({
          index: samples.length,
          data,
          timestampUs: Math.round((s.cts / s.timescale) * 1_000_000),
          durationUs: Math.round((s.duration / s.timescale) * 1_000_000),
          isSync: Boolean(s.is_sync),
        });
      }
    };

    file
      .arrayBuffer()
      .then((buf) => {
        const tagged = buf as ArrayBuffer & { fileStart: number };
        tagged.fileStart = 0;
        (mp4 as unknown as { appendBuffer: (b: ArrayBuffer) => void }).appendBuffer(tagged);
        (mp4 as unknown as { flush: () => void }).flush();
        if (!ready) reject(new Error('Unable to parse video header; file may be truncated or not an MP4/MOV.'));
        void videoTrackId;
      })
      .catch(reject);
  });
}
