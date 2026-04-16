import type { VideoFileInfo } from '../types';

function fmt(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function hhmmss(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(2);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(5, '0')}`;
  return `${m}:${String(s).padStart(5, '0')}`;
}

interface Props {
  info: VideoFileInfo;
  onReset: () => void;
}

export function FileInfoPanel({ info, onReset }: Props) {
  return (
    <div className="file-info">
      <div className="file-info__header">
        <span className="file-info__name" title={info.filename}>{info.filename}</span>
        <button className="btn-ghost" onClick={onReset} title="Load a different file">✕</button>
      </div>
      <dl className="file-info__grid">
        <dt>Size</dt>       <dd>{fmt(info.sizeBytes)}</dd>
        <dt>Container</dt>  <dd>{info.container.toUpperCase()}</dd>
        <dt>Codec</dt>      <dd>{info.codec}</dd>
        <dt>Resolution</dt> <dd>{info.width} × {info.height}</dd>
        <dt>Source fps</dt> <dd>{info.sourceFps.toFixed(2)}</dd>
        <dt>Duration</dt>   <dd>{hhmmss(info.durationSec)}</dd>
      </dl>
    </div>
  );
}
