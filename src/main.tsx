import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;

if (!('VideoDecoder' in window)) {
  root.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;gap:16px;font-family:system-ui,sans-serif;color:#c9d1d9;
      background:#0d1117;padding:24px;text-align:center;
    ">
      <div style="font-size:32px">⚠️</div>
      <h1 style="margin:0;font-size:20px;font-weight:600">Browser not supported</h1>
      <p style="margin:0;font-size:14px;color:#8b949e;max-width:420px;line-height:1.6">
        Video2Sprite requires the <strong>WebCodecs API</strong> (<code>VideoDecoder</code>),
        which is available in Chrome 94+, Edge 94+, and Safari 16.4+.<br/><br/>
        Firefox does not yet support WebCodecs.
      </p>
    </div>
  `;
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
