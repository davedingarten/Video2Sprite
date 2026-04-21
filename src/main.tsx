import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import Landing from './components/Landing/Landing.tsx';

// Simple two-route SPA: / = marketing landing, /app = the tool.
// We avoid react-router for a single route boundary — history.pushState
// + popstate is enough and ships zero extra bytes.
function UnsupportedBrowser() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
        fontFamily: 'system-ui, sans-serif',
        color: '#c9d1d9',
        background: '#0d1117',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 32 }}>⚠️</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Browser not supported</h1>
      <p style={{ margin: 0, fontSize: 14, color: '#8b949e', maxWidth: 420, lineHeight: 1.6 }}>
        Video2Sprite requires the <strong>WebCodecs API</strong> (<code>VideoDecoder</code>),
        which is available in Chrome 94+, Edge 94+, and Safari 16.4+.
        <br /><br />
        Firefox does not yet support WebCodecs.
      </p>
      <a
        href="/"
        style={{ color: '#FF3366', fontSize: 13, marginTop: 12 }}
        onClick={(e) => {
          e.preventDefault();
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      >
        ← Back to marketing site
      </a>
    </div>
  );
}

function Root() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onNav = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  // Scroll to top on route change — the landing has its own scroll
  // position, and bouncing into /app with a saved scroll looks broken.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  const isAppRoute = path === '/app' || path.startsWith('/app/');

  if (isAppRoute) {
    if (!('VideoDecoder' in window)) {
      return <UnsupportedBrowser />;
    }
    return <App />;
  }

  return <Landing />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
