import { useRef, useState } from 'react';
import { extractFrames } from './lib/video/extract';
import './App.css';

export default function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const append = (s: string) => setLines((prev) => [...prev, s]);

  async function runDecodeTest() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      append('✖ pick a file first');
      return;
    }
    setLines([]);
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await extractFrames(
        f,
        { startSec: 0, endSec: 2, targetFps: 10 },
        ({ frame, outputIndex, timestampMs }) => {
          append(
            `#${outputIndex}  t=${timestampMs.toFixed(1)}ms  ${frame.displayWidth}x${frame.displayHeight}`,
          );
          frame.close();
        },
      );
      const dt = (performance.now() - t0).toFixed(0);
      append(
        `\n✔ ${res.info.filename}  ${res.info.container}/${res.info.codec}  ${res.info.width}x${res.info.height}  ${res.info.sourceFps.toFixed(2)}fps  ${res.info.durationSec.toFixed(2)}s`,
      );
      append(
        `  emitted ${res.framesEmitted}/${res.targetsRequested} frames in ${dt}ms`,
      );
    } catch (err) {
      append(`✖ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Video2Sprite — Phase 2 test harness</h1>
      </header>
      <main className="app-body">
        <aside className="controls-pane" aria-label="Controls">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/*" />
            <button onClick={runDecodeTest} disabled={busy}>
              {busy ? 'Decoding…' : 'Test decode (first 2s @ 10fps)'}
            </button>
            <p className="placeholder" style={{ marginTop: 8 }}>
              Temporary harness. Proper UI comes in Phase 5.
            </p>
          </div>
        </aside>
        <section className="preview-pane" aria-label="Preview" style={{ alignItems: 'stretch', justifyContent: 'flex-start' }}>
          <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {lines.length ? lines.join('\n') : 'Pick a video, click the button. Frames will log here.'}
          </pre>
        </section>
      </main>
    </div>
  );
}
