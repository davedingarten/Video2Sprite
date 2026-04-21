import { useEffect, useState } from 'react';
import { SpriteDemo, MiniBanner } from './SpriteDemo';
import './landing.css';

// Landing is a separate route — no WebCodecs required, no video state.
// Links to /app use history.pushState so the SPA router in main.tsx
// picks up the change without a full page reload.
function go(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function BrandMark() {
  return (
    <div className="brand">
      <span className="brand__mark" aria-hidden>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <polygon points="5 3 19 12 5 21 5 3" fill="white" />
        </svg>
      </span>
      <span className="brand__word">
        video<span className="brand__two">2</span>sprite
      </span>
    </div>
  );
}

function Nav({ isMobile }: { isMobile: boolean }) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <a href="/" className="nav__brand" onClick={(e) => { e.preventDefault(); go('/'); }}>
          <BrandMark />
        </a>
        <nav className="nav__links" aria-label="Primary">
          <a href="#how" className="nav__link">How it works</a>
          <a href="#specs" className="nav__link">Specs</a>
          <a href="#privacy" className="nav__link">Privacy</a>
          <a href="#faq" className="nav__link">FAQ</a>
        </nav>
        {isMobile ? (
          <span className="nav__cta nav__cta--disabled" aria-disabled>
            Desktop only
          </span>
        ) : (
          <a
            href="/app"
            className="btn btn--primary nav__cta"
            onClick={(e) => { e.preventDefault(); go('/app'); }}
          >
            Open the tool <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </header>
  );
}

// Mobile banner — sits above the nav on small screens so it's the first
// thing visible. The product literally cannot run here; we'd rather set
// expectations up top than let someone tap through and bounce.
function MobileNotice() {
  return (
    <aside className="mobile-notice" role="note">
      <span className="mobile-notice__icon" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M12 17v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <div className="mobile-notice__body">
        <strong>Desktop-only tool.</strong>
        <span>The sprite generator needs a desktop browser — keep reading on mobile, then open it on your laptop.</span>
      </div>
    </aside>
  );
}

function Hero({ isMobile }: { isMobile: boolean }) {
  return (
    <section className="hero">
      <div className="hero__grid">
        <div className="hero__copy">
          <div className="eyebrow">
            <span className="eyebrow__dot" />
            BROWSER-ONLY · NO UPLOAD · DESKTOP
          </div>
          <h1 className="hero__headline">
            <span>The ad network</span>
            <span>said <em>no video.</em></span>
            <span className="hero__pink">Ship motion anyway.</span>
          </h1>
          <p className="hero__sub">
            Video2Sprite turns any MP4 into a sprite sheet in your browser —
            the oldest trick in HTML5 display for getting motion past DV360,
            CM360, and the Google Display Network.
          </p>
          <div className="hero__ctas">
            {isMobile ? (
              <>
                <span className="btn btn--disabled btn--xl" aria-disabled>
                  Open on desktop →
                </span>
                <a href="#how" className="btn btn--ghost btn--xl">See how it works</a>
              </>
            ) : (
              <>
                <a
                  href="/app"
                  className="btn btn--primary btn--xl"
                  onClick={(e) => { e.preventDefault(); go('/app'); }}
                >
                  Open the tool <span aria-hidden>→</span>
                </a>
                <a href="#how" className="btn btn--ghost btn--xl">See how it works</a>
              </>
            )}
          </div>
          <dl className="hero__stats">
            <div>
              <dt>4096<span>px</span></dt>
              <dd>GPU-safe cap,<br/>auto-optimized</dd>
            </div>
            <div>
              <dt>7</dt>
              <dd>encode passes<br/>to hit target KB</dd>
            </div>
            <div>
              <dt>0</dt>
              <dd>bytes leave<br/>your machine</dd>
            </div>
          </dl>
        </div>

        <div className="hero__demo">
          <div className="hero__slot-label">
            <span className="hero__slot-dim">AD&nbsp;SLOT</span>
            <span className="hero__slot-sep" aria-hidden />
            <span>MEDIUM RECTANGLE</span>
          </div>
          <SpriteDemo />
        </div>
      </div>

      <div className="hero__marquee" aria-hidden>
        <div className="hero__marquee-track">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="hero__marquee-row">
              <span>DV360</span>
              <span className="dot" />
              <span>Campaign&nbsp;Manager&nbsp;360</span>
              <span className="dot" />
              <span>Google&nbsp;Display</span>
              <span className="dot" />
              <span>Xandr</span>
              <span className="dot" />
              <span>Amazon&nbsp;Ads</span>
              <span className="dot" />
              <span>The&nbsp;Trade&nbsp;Desk</span>
              <span className="dot" />
              <span>LinkedIn&nbsp;Ads</span>
              <span className="dot" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="problem" id="specs">
      <div className="problem__inner">
        <div className="section-head">
          <span className="section-kicker">§01&nbsp;&nbsp;THE&nbsp;CONSTRAINT</span>
          <h2 className="section-title">
            Four boxes. <em>No video tag.</em> <br />
            Your creative still has to move.
          </h2>
        </div>

        <p className="problem__lede">
          Programmatic display specifies what can ship and what can't — and
          <em>&nbsp;&lt;video&gt;</em>&nbsp;almost always can't. The old
          workaround: pre-bake the motion into a sprite sheet and step through
          it with CSS <span className="mono">animation-timing-function: steps()</span>.
          That's what this tool makes trivial.
        </p>

        <div className="banners">
          <MiniBanner w={300} h={250} label="Medium Rectangle" />
          <MiniBanner w={728} h={90} label="Leaderboard" />
          <MiniBanner w={160} h={600} label="Skyscraper" />
          <MiniBanner w={300} h={600} label="Half Page" />
        </div>

        <div className="problem__foot">
          <span className="mono">IAB&nbsp;standard&nbsp;ad&nbsp;sizes,&nbsp;to&nbsp;scale</span>
          <span className="problem__foot-sep" />
          <span>Each plays the same 12-frame sheet, stepped with&nbsp;<span className="mono">steps(12)</span></span>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: '01',
    head: 'Drop in your cut',
    body: 'Any MP4, MOV, or M4V. H.264, HEVC, AV1, VP9 — anything your browser can decode. The file is read locally; nothing is uploaded, ever.',
    hint: 'MP4 · MOV · M4V',
  },
  {
    n: '02',
    head: 'Trim and sample',
    body: 'Scrub a filmstrip to set your in- and out-point. Pick a target FPS. We use WebCodecs to pull the nearest decoded frame for each timestamp — no <video>.currentTime guessing.',
    hint: 'FPS · IN/OUT · DIMENSIONS',
  },
  {
    n: '03',
    head: 'Preview the sheet',
    body: 'Auto-grid packs frames inside the 4096×4096 GPU texture cap. Flip between live-play, sheet view, and an original-vs-compressed split to sanity-check quality before you export.',
    hint: 'AUTO-GRID · 4096 CAP · SPLIT VIEW',
  },
  {
    n: '04',
    head: 'Ship the bundle',
    body: 'One click writes a ZIP: the sheet (PNG, JPEG, or WebP), first and last frame at 2× for stills, a JSON manifest with per-frame coordinates, and ready-to-paste CSS + JS snippets.',
    hint: 'ZIP · CSS steps() · GSAP · JSON',
  },
];

function HowItWorks() {
  return (
    <section className="how" id="how">
      <div className="how__inner">
        <div className="section-head">
          <span className="section-kicker">§02&nbsp;&nbsp;THE&nbsp;PIPELINE</span>
          <h2 className="section-title">
            Four steps. <br />
            <em>One tab.</em> No backend.
          </h2>
        </div>

        <ol className="how__list">
          {STEPS.map((s) => (
            <li key={s.n} className="how__item">
              <div className="how__n">{s.n}</div>
              <div className="how__body">
                <h3 className="how__head">{s.head}</h3>
                <p className="how__p">{s.body}</p>
                <span className="how__hint mono">{s.hint}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FEATURES: { title: string; body: string; tag: string }[] = [
  {
    title: 'Frame-accurate decode',
    body: 'WebCodecs VideoDecoder with keyframe-widened nearest-timestamp sampling. No HTMLVideoElement seeking. The frame you see is the frame that gets sampled.',
    tag: 'decode',
  },
  {
    title: '4096-aware auto-grid',
    body: 'Most GPUs cap texture uploads around 4096×4096. Auto-grid picks the column count that stays inside and leaves the fewest empty tiles. A warning bar surfaces when it can\'t.',
    tag: 'layout',
  },
  {
    title: 'Target-size encoder',
    body: 'Quality-slider encoding for JPEG and WebP plus a target-KB mode that bisects quality to hit your size cap in seven encodes. A PNG path runs oxipng and optional 2–256-color quantization.',
    tag: 'encode',
  },
  {
    title: 'Compression preview',
    body: 'Re-encode the current sheet at your chosen settings and see the byte count plus a side-by-side original-vs-compressed split with a shared scrubber. Confirm quality before you export.',
    tag: 'preview',
  },
  {
    title: 'Playback snippets',
    body: 'CSS steps(), vanilla JS, a 15-line tiny JS loop, or a GSAP driver — emitted on demand alongside the sheet. Drop the generated files into your ad template; they Just Work.',
    tag: 'snippet',
  },
  {
    title: 'JSON manifest',
    body: 'Structured metadata: sheet dimensions, padding, columns/rows, source codec/container, and per-frame { index, x, y, width, height, timestampMs }. For pipelines that need it.',
    tag: 'manifest',
  },
  {
    title: 'First / last stills',
    body: 'Exported alongside the sheet at 2× tile size, in the same format and quality. The static poster frame for networks that demand a non-animated fallback.',
    tag: 'stills',
  },
  {
    title: 'ZIP in one click',
    body: 'Sheet + stills + manifest + snippets bundled into a single download. Drag it into your ad-template repo, the creative team, or the send folder for your trafficker.',
    tag: 'export',
  },
];

function Features() {
  return (
    <section className="features">
      <div className="features__inner">
        <div className="section-head">
          <span className="section-kicker">§03&nbsp;&nbsp;WHAT'S&nbsp;IN&nbsp;THE&nbsp;BOX</span>
          <h2 className="section-title">
            Built for the <em>spec sheet</em>, <br />
            not the demo reel.
          </h2>
        </div>

        <div className="features__grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <span className="feature__tag mono">{f.tag}</span>
              <h3 className="feature__title">{f.title}</h3>
              <p className="feature__body">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="privacy" id="privacy">
      <div className="privacy__inner">
        <span className="section-kicker privacy__kicker">§04&nbsp;&nbsp;ARCHITECTURE</span>
        <h2 className="privacy__title">
          Your client's rough cut <br />
          <em>stays in your browser tab.</em>
        </h2>
        <p className="privacy__body">
          There is no server. No bucket. No queue. When you pick a file,
          mp4box.js demuxes it in a worker and WebCodecs decodes it on your
          GPU. Every frame is drawn into a canvas and closed immediately —
          nothing is buffered, nothing is transmitted. Pull the wifi and the
          tool still works.
        </p>

        <ul className="privacy__list">
          <li>
            <span className="privacy__dot" style={{ background: '#FF3366' }} />
            <div>
              <strong>No upload.</strong>
              <span>Files are read with <span className="mono">FileReader</span> into the tab's memory. Not sent anywhere.</span>
            </div>
          </li>
          <li>
            <span className="privacy__dot" style={{ background: '#FF9F43' }} />
            <div>
              <strong>No telemetry.</strong>
              <span>No analytics SDKs, no pings on decode, no request to a backend — there is no backend.</span>
            </div>
          </li>
          <li>
            <span className="privacy__dot" style={{ background: '#F5F1E8' }} />
            <div>
              <strong>No GPU leak.</strong>
              <span>VideoFrames are <span className="mono">.close()</span>d as soon as they're drawn, so a 40-second clip doesn't evict your desktop.</span>
            </div>
          </li>
        </ul>

        <div className="privacy__proof">
          <span className="privacy__proof-k">proof</span>
          <code className="privacy__proof-v">
            <span className="privacy__proof-comment"># Network tab during a full export:</span><br />
            &gt;&nbsp;0&nbsp;requests&nbsp;·&nbsp;0&nbsp;kB&nbsp;sent&nbsp;·&nbsp;0&nbsp;kB&nbsp;received
          </code>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: 'Does this work on a phone or tablet?',
    a: 'No — this is a desktop-only tool. Mobile browsers either don\'t ship the WebCodecs decoders this relies on, or the available decoders skip frames to save battery, which breaks frame-accurate extraction. The UI also assumes a two-pane layout with a scrubbable timeline. Open the tool on a laptop or desktop.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Chrome 94+, Edge 94+, Safari 16.4+, and recent Chromium forks — anything that exposes the WebCodecs VideoDecoder on desktop. Firefox doesn\'t ship WebCodecs yet; the tool detects this on load and shows a friendly message instead of silently failing.',
  },
  {
    q: 'Which containers and codecs work?',
    a: 'ISO-BMFF containers (MP4, MOV, M4V) via mp4box.js. Any codec your browser can decode: H.264/AVC is universal; HEVC, AV1, and VP9 work where the OS/browser expose a decoder. Codec support is probed per-file with VideoDecoder.isConfigSupported(), so you get a specific error, not a generic one.',
  },
  {
    q: 'What about WebM, MKV, or ProRes?',
    a: 'Not yet. Those need a different demuxer — it\'s on the list but intentionally scoped out of the MVP. If your pipeline outputs one of these, transcode to MP4 first (or open an issue with a sample file and we\'ll prioritize).',
  },
  {
    q: 'Is there a file-size cap?',
    a: 'Your choice. Switch the encoder to target-size mode and type "200" to hit the IAB 200 KB cap; the encoder bisects quality in about seven passes and reports the final quality used. If the target is physically unreachable at the current dimensions, you get a specific "smallest is X KB at quality Y" message — not a silent clip.',
  },
  {
    q: 'Why not GIF or animated WebP?',
    a: 'Banner networks don\'t accept them consistently, and at typical ad-creative sizes a sprite sheet + CSS steps() beats both on file size, color fidelity, and frame accuracy. If a network asks specifically for animated WebP, open the sheet in your encoder of choice — but for shipping to DV360/CM360/GDN, sprites are the move.',
  },
  {
    q: 'How big can my video be?',
    a: 'Practically, a minute or two of 1080p at a sane FPS. Frames are drawn straight into the sheet canvas and disposed — nothing is buffered — so the ceiling is the 4096×4096 GPU cap, not RAM. Push past it and auto-grid or the preview warning bar will tell you exactly what to trim.',
  },
  {
    q: 'Can I animate this without GSAP?',
    a: 'Yes — that\'s the default. The exported ZIP includes a pure CSS steps() snippet that animates the background-position of a single div, plus a 15-line vanilla JS stepper for when you need precise frame control. GSAP is offered as an alternative, not a dependency.',
  },
  {
    q: 'Is this free? Open source?',
    a: 'Free to use. The tool runs entirely in your browser, so there\'s nothing to charge for — no servers, no per-export pricing, no seats.',
  },
];

function FAQ() {
  return (
    <section className="faq" id="faq">
      <div className="faq__inner">
        <div className="section-head">
          <span className="section-kicker">§05&nbsp;&nbsp;FINE&nbsp;PRINT</span>
          <h2 className="section-title">
            Questions your <em>ad ops</em> <br />
            lead will ask.
          </h2>
        </div>

        <div className="faq__list">
          {FAQ_ITEMS.map((item, i) => (
            <details key={item.q} className="faq__item">
              <summary className="faq__summary">
                <span className="faq__n mono">Q.{String(i + 1).padStart(2, '0')}</span>
                <span className="faq__q">{item.q}</span>
                <span className="faq__chev" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </summary>
              <div className="faq__a">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({ isMobile }: { isMobile: boolean }) {
  return (
    <section className="cta">
      <div className="cta__inner">
        <div className="cta__kicker mono">
          <span className="cta__dot" />
          READY WHEN YOU ARE
        </div>
        <h2 className="cta__headline">
          Load a clip. <br />
          <em>Ship motion.</em>
        </h2>
        <p className="cta__sub">
          {isMobile
            ? 'Open this page on a desktop browser to run the tool.'
            : 'No signup. No upload. The tool is one click away.'}
        </p>
        {isMobile ? (
          <span className="btn btn--disabled btn--xl cta__btn" aria-disabled>
            Desktop required →
          </span>
        ) : (
          <a
            href="/app"
            className="btn btn--primary btn--xl cta__btn"
            onClick={(e) => { e.preventDefault(); go('/app'); }}
          >
            Open the tool <span aria-hidden>→</span>
          </a>
        )}
        <p className="cta__foot mono">
          DESKTOP · CHROME 94+ · EDGE 94+ · SAFARI 16.4+
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__col footer__col--brand">
          <BrandMark />
          <p className="footer__tag">
            Browser-only sprite-sheet generator for HTML5 banner ads.
            Built with WebCodecs, mp4box.js, and no backend whatsoever.
          </p>
        </div>
        <div className="footer__col">
          <h4 className="footer__h">Product</h4>
          <ul>
            <li><a href="/app" onClick={(e) => { e.preventDefault(); go('/app'); }}>Open the tool</a></li>
            <li><a href="#how">How it works</a></li>
            <li><a href="#specs">Ad specs</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>
        <div className="footer__col">
          <h4 className="footer__h">Built on</h4>
          <ul>
            <li>WebCodecs</li>
            <li>mp4box.js</li>
            <li>mozjpeg · oxipng · libwebp</li>
            <li>Vite · React · TypeScript</li>
          </ul>
        </div>
      </div>
      <div className="footer__rule" />
      <div className="footer__base">
        <span className="mono">© {new Date().getFullYear()} · VIDEO2SPRITE</span>
        <span className="mono">BUILT IN THE BROWSER, STAYS IN THE BROWSER</span>
      </div>
    </footer>
  );
}

// `isMobile` is resolved from a media query rather than a user-agent sniff.
// The question is really "do they have a desktop-class viewport?", which
// maps cleanly onto a width check.
function useIsMobile(breakpointPx = 900) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width: ${breakpointPx}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpointPx]);
  return isMobile;
}

export default function Landing() {
  // Progressive enhancement: after mount, toggle a class so CSS-only
  // entry animations kick in. Without this SSR/hydration looks inert.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Next tick to guarantee paint before transition
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const isMobile = useIsMobile();

  return (
    <div className={`landing${mounted ? ' is-mounted' : ''}${isMobile ? ' is-mobile' : ''}`}>
      {isMobile && <MobileNotice />}
      <Nav isMobile={isMobile} />
      <main>
        <Hero isMobile={isMobile} />
        <Problem />
        <HowItWorks />
        <Features />
        <Privacy />
        <FAQ />
        <CTA isMobile={isMobile} />
      </main>
      <Footer />
    </div>
  );
}
