import type { GridLayout, SnippetVariant } from '../../types';

export interface SnippetInput {
  layout: GridLayout;
  fps: number;
  frameCount: number;
  sheetFilename: string;
  className?: string;
  loop?: boolean;
  // Which playback drivers to emit. Defaults to ['steps-css', 'vanilla-js'].
  variants?: SnippetVariant[];
}

export interface SnippetFiles {
  css: string;
  js?: string;       // vanilla-js driver (full-featured)
  tinyJs?: string;   // minimal loop-forever driver
  gsapJs?: string;   // GSAP-driven snippet (requires gsap at runtime)
  html: string;
  variants: SnippetVariant[];
}

const DEFAULT_VARIANTS: SnippetVariant[] = ['steps-css', 'vanilla-js'];

export function buildSnippet(input: SnippetInput): SnippetFiles {
  const { layout, fps, frameCount } = input;
  const cls = input.className ?? 'sprite-anim';
  const loop = input.loop ?? true;
  const durationSec = frameCount / fps;
  const stepX = layout.tileWidth + layout.padding;
  const stepY = layout.tileHeight + layout.padding;
  const variants = input.variants && input.variants.length > 0 ? input.variants : DEFAULT_VARIANTS;

  // Base CSS is always emitted — every driver needs width/height/bg-image.
  // Keyframes are scoped to .${cls}--css so they don't fight JS drivers that
  // mutate background-position on sibling elements.
  const baseCss = buildBaseCss({ cls, sheet: input.sheetFilename, tileW: layout.tileWidth, tileH: layout.tileHeight });
  const keyframesCss = variants.includes('steps-css')
    ? buildKeyframesCss({ cls, columns: layout.columns, stepX, stepY, durationSec, frameCount, padding: layout.padding, loop })
    : '';
  const css = keyframesCss ? `${baseCss}\n${keyframesCss}` : baseCss;

  const js = variants.includes('vanilla-js')
    ? buildJs({ cls, fps, frameCount, columns: layout.columns, stepX, stepY, padding: layout.padding, loop })
    : undefined;

  const tinyJs = variants.includes('tiny-js')
    ? buildTinyJs({ cls, fps, frameCount, columns: layout.columns, stepX, stepY, padding: layout.padding })
    : undefined;

  const gsapJs = variants.includes('gsap')
    ? buildGsapJs({ cls, fps, frameCount, columns: layout.columns, stepX, stepY, padding: layout.padding })
    : undefined;

  const html = buildHtml(cls, variants);

  return { css, js, tinyJs, gsapJs, html, variants };
}

function buildBaseCss(o: { cls: string; sheet: string; tileW: number; tileH: number }): string {
  return `.${o.cls} {
  width: ${o.tileW}px;
  height: ${o.tileH}px;
  background-image: url("${o.sheet}");
  background-repeat: no-repeat;
}
`;
}

function buildKeyframesCss(o: {
  cls: string;
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

  const keyframeEntries: string[] = [];
  for (let i = 0; i < o.frameCount; i++) {
    const col = i % o.columns;
    const row = Math.floor(i / o.columns);
    const x = -(o.padding + col * o.stepX);
    const y = -(o.padding + row * o.stepY);
    const pct = ((i / o.frameCount) * 100).toFixed(4);
    keyframeEntries.push(`  ${pct}% { background-position: ${x}px ${y}px; }`);
  }
  const lastCol = (o.frameCount - 1) % o.columns;
  const lastRow = Math.floor((o.frameCount - 1) / o.columns);
  const lastX = -(o.padding + lastCol * o.stepX);
  const lastY = -(o.padding + lastRow * o.stepY);
  keyframeEntries.push(`  100% { background-position: ${lastX}px ${lastY}px; }`);

  return `/* ${o.frameCount} frames, ${o.columns}x${rows}, ${o.durationSec.toFixed(3)}s */
.${o.cls}--css {
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

// Ultra-light driver: loops forever. Targets .${cls}--tiny so it doesn't
// collide with other driver instances on the same demo page.
function buildTinyJs(o: {
  cls: string;
  fps: number;
  frameCount: number;
  columns: number;
  stepX: number;
  stepY: number;
  padding: number;
}): string {
  return `// Tiny sprite driver — loops forever, no API.
(function () {
  var el = document.querySelector('.${o.cls}--tiny');
  if (!el) return;
  var f = 0, N = ${o.frameCount}, C = ${o.columns};
  var SX = ${o.stepX}, SY = ${o.stepY}, P = ${o.padding};
  setInterval(function () {
    var c = f % C, r = (f / C) | 0;
    el.style.backgroundPosition = -(P + c * SX) + 'px ' + -(P + r * SY) + 'px';
    f = (f + 1) % N;
  }, ${Math.round(1000 / o.fps)});
})();
`;
}

function buildGsapJs(o: {
  cls: string;
  fps: number;
  frameCount: number;
  columns: number;
  stepX: number;
  stepY: number;
  padding: number;
}): string {
  return `// GSAP sprite driver — requires gsap at runtime.
// Usage:  var tween = window.spriteAnim(document.querySelector('.${o.cls}'));
(function () {
  var FPS = ${o.fps};
  var FRAME_COUNT = ${o.frameCount};
  var COLS = ${o.columns};
  var STEP_X = ${o.stepX};
  var STEP_Y = ${o.stepY};
  var PAD = ${o.padding};

  window.spriteAnim = function (el) {
    return gsap.to({ f: 0 }, {
      f: FRAME_COUNT - 1,
      duration: FRAME_COUNT / FPS,
      ease: "steps(" + (FRAME_COUNT - 1) + ")",
      repeat: -1,
      onUpdate: function () {
        var i = Math.round(this.targets()[0].f);
        var col = i % COLS, row = (i / COLS) | 0;
        el.style.backgroundPosition = -(PAD + col * STEP_X) + "px " + -(PAD + row * STEP_Y) + "px";
      }
    });
  };
})();
`;
}

function buildHtml(cls: string, variants: SnippetVariant[]): string {
  const sections: string[] = [];
  const scripts: string[] = [];
  const initLines: string[] = [];

  if (variants.includes('steps-css')) {
    sections.push(`  <section class="demo">
    <h2>steps-css <small>(pure CSS, auto-plays)</small></h2>
    <div class="${cls} ${cls}--css"></div>
  </section>`);
  }

  if (variants.includes('vanilla-js')) {
    sections.push(`  <section class="demo">
    <h2>vanilla-js <small>(play / pause / seek)</small></h2>
    <div class="${cls}" id="anim-vanilla"></div>
    <div class="controls">
      <button id="play-vanilla">Play</button>
      <button id="pause-vanilla">Pause</button>
    </div>
  </section>`);
    scripts.push('<script src="anim.js"></script>');
    initLines.push(`    var ctrl = window.SpriteAnim(document.getElementById('anim-vanilla'));
    document.getElementById('play-vanilla').onclick = ctrl.play;
    document.getElementById('pause-vanilla').onclick = ctrl.pause;`);
  }

  if (variants.includes('tiny-js')) {
    sections.push(`  <section class="demo">
    <h2>tiny-js <small>(minimal loop, no controls)</small></h2>
    <div class="${cls} ${cls}--tiny"></div>
  </section>`);
    scripts.push('<script src="anim-tiny.js"></script>');
  }

  if (variants.includes('gsap')) {
    sections.push(`  <section class="demo">
    <h2>gsap <small>(tween-based)</small></h2>
    <div class="${cls}" id="anim-gsap"></div>
    <div class="controls">
      <button id="play-gsap">Play</button>
      <button id="pause-gsap">Pause</button>
    </div>
  </section>`);
    scripts.push('<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>');
    scripts.push('<script src="anim-gsap.js"></script>');
    initLines.push(`    var tween = window.spriteAnim(document.getElementById('anim-gsap'));
    document.getElementById('play-gsap').onclick = function () { tween.play(); };
    document.getElementById('pause-gsap').onclick = function () { tween.pause(); };`);
  }

  const initScript = initLines.length
    ? `  <script>
${initLines.join('\n')}
  </script>`
    : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sprite animation demo</title>
  <link rel="stylesheet" href="anim.css" />
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 32px auto; padding: 0 16px; color: #222; }
    .demo { margin: 24px 0; padding: 16px; border: 1px solid #e3e3e3; border-radius: 8px; background: #fafafa; }
    .demo h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
    .demo h2 small { color: #888; font-weight: 400; font-size: 13px; margin-left: 6px; }
    .controls { margin-top: 12px; }
    .controls button { margin-right: 8px; padding: 6px 12px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Sprite animation demos</h1>
${sections.join('\n')}
  ${scripts.join('\n  ')}
${initScript}
</body>
</html>
`;
}
