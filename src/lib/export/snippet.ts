import type { GridLayout } from '../../types';

export interface SnippetInput {
  layout: GridLayout;
  fps: number;
  frameCount: number;
  sheetFilename: string;
  className?: string; // defaults to "sprite-anim"
  loop?: boolean;
}

export interface SnippetFiles {
  css: string;
  js: string;
  html: string; // demo page referencing both
}

// Two playback strategies shipped together so the consumer can pick:
// 1. Pure-CSS steps() keyframes — runs without JS, decodes fast, but can't
//    pause / scrub / change fps at runtime.
// 2. JS frame-stepper — uses requestAnimationFrame, offers play/pause/seek.
export function buildSnippet(input: SnippetInput): SnippetFiles {
  const { layout, fps, frameCount } = input;
  const cls = input.className ?? 'sprite-anim';
  const loop = input.loop ?? true;
  const durationSec = frameCount / fps;
  const stepX = layout.tileWidth + layout.padding;
  const stepY = layout.tileHeight + layout.padding;

  const css = buildCss({
    cls,
    sheet: input.sheetFilename,
    tileW: layout.tileWidth,
    tileH: layout.tileHeight,
    columns: layout.columns,
    stepX,
    stepY,
    durationSec,
    frameCount,
    padding: layout.padding,
    loop,
  });

  const js = buildJs({
    cls,
    fps,
    frameCount,
    columns: layout.columns,
    stepX,
    stepY,
    padding: layout.padding,
    loop,
  });

  const html = buildHtml(cls);

  return { css, js, html };
}

function buildCss(o: {
  cls: string;
  sheet: string;
  tileW: number;
  tileH: number;
  columns: number;
  stepX: number;
  stepY: number;
  durationSec: number;
  frameCount: number;
  padding: number;
  loop: boolean;
}): string {
  const rows = Math.ceil(o.frameCount / o.columns);
  const iter = o.loop ? 'infinite' : '1';

  // Build keyframe stops at every frame so rows advance correctly.
  // Each step sets background-position to (-col*stepX, -row*stepY).
  const keyframeEntries: string[] = [];
  for (let i = 0; i < o.frameCount; i++) {
    const col = i % o.columns;
    const row = Math.floor(i / o.columns);
    const x = -(o.padding + col * o.stepX);
    const y = -(o.padding + row * o.stepY);
    const pct = ((i / o.frameCount) * 100).toFixed(4);
    keyframeEntries.push(`  ${pct}% { background-position: ${x}px ${y}px; }`);
  }
  // final stop so the last frame holds until wrap
  const lastCol = (o.frameCount - 1) % o.columns;
  const lastRow = Math.floor((o.frameCount - 1) / o.columns);
  const lastX = -(o.padding + lastCol * o.stepX);
  const lastY = -(o.padding + lastRow * o.stepY);
  keyframeEntries.push(`  100% { background-position: ${lastX}px ${lastY}px; }`);

  return `/* ${o.frameCount} frames, ${o.columns}x${rows}, ${o.durationSec.toFixed(3)}s */
.${o.cls} {
  width: ${o.tileW}px;
  height: ${o.tileH}px;
  background-image: url("${o.sheet}");
  background-repeat: no-repeat;
  animation: ${o.cls}-play ${o.durationSec}s steps(1, end) ${iter};
}

@keyframes ${o.cls}-play {
${keyframeEntries.join('\n')}
}
`;
}

function buildJs(o: {
  cls: string;
  fps: number;
  frameCount: number;
  columns: number;
  stepX: number;
  stepY: number;
  padding: number;
  loop: boolean;
}): string {
  return `// Frame-stepper for .${o.cls} — supports play/pause/seek.
(function () {
  var FPS = ${o.fps};
  var FRAME_COUNT = ${o.frameCount};
  var COLS = ${o.columns};
  var STEP_X = ${o.stepX};
  var STEP_Y = ${o.stepY};
  var PAD = ${o.padding};
  var LOOP = ${o.loop ? 'true' : 'false'};

  function positionFor(i) {
    var col = i % COLS;
    var row = Math.floor(i / COLS);
    return { x: -(PAD + col * STEP_X), y: -(PAD + row * STEP_Y) };
  }

  window.SpriteAnim = function (el) {
    var frame = 0;
    var playing = false;
    var lastTs = 0;
    var acc = 0;
    var frameMs = 1000 / FPS;

    function render() {
      var p = positionFor(frame);
      el.style.backgroundPosition = p.x + 'px ' + p.y + 'px';
    }
    function tick(ts) {
      if (!playing) return;
      if (!lastTs) lastTs = ts;
      acc += ts - lastTs;
      lastTs = ts;
      while (acc >= frameMs) {
        frame++;
        acc -= frameMs;
        if (frame >= FRAME_COUNT) {
          if (LOOP) frame = 0;
          else { frame = FRAME_COUNT - 1; playing = false; break; }
        }
      }
      render();
      if (playing) requestAnimationFrame(tick);
    }

    render();
    return {
      play: function () { if (playing) return; playing = true; lastTs = 0; requestAnimationFrame(tick); },
      pause: function () { playing = false; },
      seek: function (i) { frame = Math.max(0, Math.min(FRAME_COUNT - 1, i | 0)); render(); },
      get frame() { return frame; },
      get frameCount() { return FRAME_COUNT; }
    };
  };
})();
`;
}

function buildHtml(cls: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sprite animation demo</title>
  <link rel="stylesheet" href="anim.css" />
</head>
<body>
  <div class="${cls}" id="anim"></div>
  <div>
    <button id="play">Play</button>
    <button id="pause">Pause</button>
  </div>
  <script src="anim.js"></script>
  <script>
    var ctrl = window.SpriteAnim(document.getElementById('anim'));
    document.getElementById('play').onclick = ctrl.play;
    document.getElementById('pause').onclick = ctrl.pause;
  </script>
</body>
</html>
`;
}
