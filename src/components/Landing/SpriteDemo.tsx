import { useEffect, useState, type CSSProperties } from 'react';

const TOTAL_FRAMES = 12;
const FPS = 10;

// Canonical 300×250 aspect ratio for every frame. Banner panels that want
// a different shape apply object-fit externally — the sprite sheet stays
// one source.
const FRAME_W = 300;
const FRAME_H = 250;

function clamp01(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// A single frame rendered as SVG. The full sprite sheet is these 12
// SVGs laid out in a 4×3 grid — see SheetStrip below.
// `fit="meet"` letterboxes at extreme aspect ratios (skyscraper,
// leaderboard) so content isn't cropped — used by MiniBanner.
function Frame({
  frame,
  small = false,
  fit = 'slice',
}: {
  frame: number;
  small?: boolean;
  fit?: 'slice' | 'meet';
}) {
  const p = frame / (TOTAL_FRAMES - 1);

  // VIDEO stays up through frames 0–4, fades across 3–4
  const videoOp = clamp01(1 - (p - 0.25) * 3.5);
  // SPRITE reveals across frames 5–8
  const spriteOp = clamp01((p - 0.45) * 3);
  // Pink sweep bar crosses the banner between frames 3–7
  const barProgress = clamp01((p - 0.2) / 0.45);
  const barX = -FRAME_W * 0.3 + barProgress * (FRAME_W + FRAME_W * 0.3);
  // CTA arrow in the last two frames
  const ctaOp = clamp01((p - 0.8) * 5);
  // Subtle frame-counter tick that always runs — proves motion even if bg fails
  const dotX = 24 + (frame % TOTAL_FRAMES) * ((FRAME_W - 48) / (TOTAL_FRAMES - 1));

  return (
    <svg
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio={`xMidYMid ${fit}`}
      style={{ display: 'block', width: '100%', height: '100%', background: '#0B0B0A' }}
      shapeRendering={small ? 'crispEdges' : 'geometricPrecision'}
    >
      {/* Ink background */}
      <rect width={FRAME_W} height={FRAME_H} fill="#0B0B0A" />

      {/* Diagonal grid texture */}
      <defs>
        <pattern id={`diag-${small ? 's' : 'l'}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
        <linearGradient id={`bar-${small ? 's' : 'l'}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF3366" />
          <stop offset="100%" stopColor="#FF9F43" />
        </linearGradient>
      </defs>
      <rect width={FRAME_W} height={FRAME_H} fill={`url(#diag-${small ? 's' : 'l'})`} />

      {/* "VIDEO" — the before state */}
      <g opacity={videoOp}>
        <text
          x={FRAME_W / 2}
          y={FRAME_H / 2 + 6}
          textAnchor="middle"
          fontFamily="'Fraunces', 'Times New Roman', serif"
          fontSize={small ? 54 : 72}
          fontStyle="italic"
          fontWeight={500}
          fill="#F5F1E8"
          letterSpacing="-2"
        >
          video
        </text>
        <text
          x={FRAME_W / 2}
          y={FRAME_H / 2 + 34}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize={10}
          letterSpacing="4"
          fill="rgba(245,241,232,0.45)"
        >
          CAN'T PLAY HERE
        </text>
      </g>

      {/* Sweep bar */}
      <g opacity={barProgress > 0 && barProgress < 1 ? 1 : 0}>
        <rect
          x={barX}
          y={0}
          width={FRAME_W * 0.35}
          height={FRAME_H}
          fill={`url(#bar-${small ? 's' : 'l'})`}
          transform={`skewX(-8)`}
        />
      </g>

      {/* "sprite." — the after state */}
      <g opacity={spriteOp}>
        <text
          x={FRAME_W / 2}
          y={FRAME_H / 2 - 8}
          textAnchor="middle"
          fontFamily="'Fraunces', 'Times New Roman', serif"
          fontSize={small ? 62 : 82}
          fontStyle="italic"
          fontWeight={500}
          fill="#F5F1E8"
          letterSpacing="-3"
        >
          sprite
        </text>
        <text
          x={FRAME_W / 2}
          y={FRAME_H / 2 + 14}
          textAnchor="middle"
          fontFamily="'Fraunces', 'Times New Roman', serif"
          fontSize={small ? 62 : 82}
          fontStyle="italic"
          fontWeight={500}
          fill="#FF3366"
          letterSpacing="-3"
        >
          sheet.
        </text>
      </g>

      {/* Bottom chrome — present in every frame for brand consistency */}
      <g>
        <line x1="20" y1={FRAME_H - 36} x2={FRAME_W - 20} y2={FRAME_H - 36} stroke="rgba(245,241,232,0.14)" strokeWidth="1" />
        <text
          x={20}
          y={FRAME_H - 18}
          fontFamily="'JetBrains Mono', monospace"
          fontSize={9}
          letterSpacing="2"
          fill="rgba(245,241,232,0.5)"
        >
          300×250 · IAB
        </text>
        <text
          x={FRAME_W - 20}
          y={FRAME_H - 18}
          textAnchor="end"
          fontFamily="'JetBrains Mono', monospace"
          fontSize={9}
          letterSpacing="2"
          fill="rgba(245,241,232,0.5)"
        >
          {String(frame + 1).padStart(2, '0')} / {TOTAL_FRAMES}
        </text>
        <circle cx={dotX} cy={FRAME_H - 36} r={2.2} fill="#FF9F43" />
      </g>

      {/* CTA chip — appears only on final frames */}
      <g opacity={ctaOp} transform={`translate(${FRAME_W / 2 - 56}, ${FRAME_H - 74})`}>
        <rect width="112" height="26" rx="13" fill="#FF3366" />
        <text
          x="56"
          y="17"
          textAnchor="middle"
          fontFamily="'Albert Sans', system-ui, sans-serif"
          fontSize={11}
          fontWeight={700}
          letterSpacing="1.6"
          fill="#0B0B0A"
        >
          TRY IT  →
        </text>
      </g>
    </svg>
  );
}

function SheetStrip({ activeFrame }: { activeFrame: number }) {
  // 4 columns × 3 rows
  const cols = 4;
  const rows = Math.ceil(TOTAL_FRAMES / cols);
  return (
    <div
      className="demo-sheet"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 4,
      }}
    >
      {Array.from({ length: TOTAL_FRAMES }).map((_, i) => {
        const isActive = i === activeFrame;
        return (
          <div
            key={i}
            className={`demo-sheet__cell${isActive ? ' is-active' : ''}`}
            style={{ aspectRatio: `${FRAME_W}/${FRAME_H}` }}
          >
            <Frame frame={i} small />
            <span className="demo-sheet__index">{String(i + 1).padStart(2, '0')}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SpriteDemo() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % TOTAL_FRAMES);
    }, 1000 / FPS);
    return () => window.clearInterval(id);
  }, []);

  const ratioStyle: CSSProperties = { aspectRatio: `${FRAME_W} / ${FRAME_H}` };

  return (
    <div className="demo">
      <div className="demo__banner" style={ratioStyle} aria-label="Sprite animation preview, 300 by 250">
        <Frame frame={frame} />
        <div className="demo__corners" aria-hidden>
          <span /><span /><span /><span />
        </div>
      </div>

      <div className="demo__caption">
        <span className="demo__caption-mono">300×250</span>
        <span className="demo__caption-dot" aria-hidden>·</span>
        <span className="demo__caption-mono">12 frames</span>
        <span className="demo__caption-dot" aria-hidden>·</span>
        <span className="demo__caption-mono">10&nbsp;fps</span>
        <span className="demo__caption-dot" aria-hidden>·</span>
        <span className="demo__caption-mono">14&nbsp;KB</span>
      </div>

      <div className="demo__sheet-wrap">
        <div className="demo__sheet-label">
          <span>THE SHEET</span>
          <span className="demo__sheet-playhead">
            <span className="demo__sheet-dot" />
            PLAYING {String(frame + 1).padStart(2, '0')}
          </span>
        </div>
        <SheetStrip activeFrame={frame} />
      </div>
    </div>
  );
}

// A tiny looping banner preview rendered at true proportional pixel
// scale so multiple IAB sizes can be eyeballed side by side. `scale`
// maps real banner pixels to on-screen pixels (0.55 ≈ half-size).
export function MiniBanner({
  w,
  h,
  label,
  scale = 0.55,
}: {
  w: number;
  h: number;
  label: string;
  scale?: number;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f + 1) % TOTAL_FRAMES), 1000 / FPS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <figure
      className="mini-banner"
      style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}
    >
      <div className="mini-banner__screen">
        <Frame frame={frame} small fit="meet" />
      </div>
      <figcaption className="mini-banner__cap">
        <span className="mini-banner__dim">{w}×{h}</span>
        <span className="mini-banner__name">{label}</span>
      </figcaption>
    </figure>
  );
}
