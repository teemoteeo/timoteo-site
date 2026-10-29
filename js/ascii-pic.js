// ============================
// PROFILE PIC → COLORED ASCII ON HOVER
// same idea as the GitHub profile card: each char takes its pixel's color
// ============================
(function() {
  const box = document.querySelector('.profile-pic-container');
  const img = box && box.querySelector('.profile-pic');
  if (!box || !img) return;

  const RAMP = ' .:-=+*#%@';     // brighter pixel, denser char
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
  const CELL_W = 5;              // css px per column
  const CELL_H = CELL_W * 1.75;
  const IN_MS = 1300, OUT_MS = 800;
  const WAIT_MS = 100;           // hover this long before the burst starts
  const HEAD = 0.03, TRAIL = 0.22; // in rain-time units: bright head, then a trail fading into the pixel's color
  const HEAD_RGB = [240, 236, 221]; // --fg
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cv = document.createElement('canvas');
  cv.className = 'profile-ascii';
  cv.setAttribute('aria-hidden', 'true');
  box.appendChild(cv);
  const ctx = cv.getContext('2d');

  let cells = [], cols = 0, rows = 0, w = 0, h = 0, maxDelay = 1;
  let p = 0, target = 0, last = 0, raf = 0;

  function sample() {
    w = box.clientWidth; h = box.clientHeight;
    if (!w || !img.naturalWidth) return;
    const dpr = devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(w / CELL_W); rows = Math.floor(h / CELL_H);

    // replicate object-fit: cover + object-position of the <img>
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(w / iw, h / ih);
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const sw = w / s, sh = h / s, sx = (iw - sw) * px, sy = (ih - sh) * py;

    const off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    const o = off.getContext('2d');
    o.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
    const d = o.getImageData(0, 0, cols, rows).data;

    cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      // lift darks a little so the skin tones keep their warmth on the dark background
      const rgb = [d[i], d[i + 1], d[i + 2]].map(v => Math.round(255 * Math.pow(v / 255, 0.8)));
      // cells stretch to cover the whole box, so no strip of photo is left at the edges
      const rx = Math.floor(x * w / cols), ry = Math.floor(y * h / rows);
      const rw = Math.floor((x + 1) * w / cols) - rx, rh = Math.floor((y + 1) * h / rows) - ry;
      cells.push({
        rx, ry, rw, rh, x: rx, y: ry + rh * 0.8,
        ch: RAMP[Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length))],
        rgb, color: `rgb(${rgb})`, delay: 0,
      });
    }
    shuffle({ u: 0.5, v: 0.5 });
    draw(performance.now());
  }

  // delays grow with the distance from the point where the cursor triggered the effect:
  // in, it bursts out of that point; out, the animation runs backwards and collapses back into it
  function shuffle(o) {
    maxDelay = 0;
    cells.forEach((c, i) => {
      const dist = Math.hypot((i % cols) / cols - o.u, Math.floor(i / cols) / rows - o.v);
      c.delay = dist * 0.8 + Math.random() * 0.25;
      maxDelay = Math.max(maxDelay, c.delay);
    });
  }

  // a different glyph per cell, changing ~16 times a second
  const glyph = (i, t) => GLYPHS[((Math.imul(i + 1, 2654435761) ^ Math.imul(Math.floor(t / 60) + 1, 40503)) >>> 0) % GLYPHS.length];
  const mix = (a, b, k) => `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k))})`;

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    if (p <= 0) return;
    ctx.font = `600 ${CELL_H * 0.95}px 'JetBrains Mono', 'Hiragino Sans', monospace`;

    const T = p * (maxDelay + TRAIL);
    cells.forEach((c, i) => {
      const lt = T - c.delay;
      if (lt < 0) return;
      // hard cut: once the rain reaches a cell, the photo under it is gone
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0e0d10';
      ctx.fillRect(c.rx, c.ry, c.rw, c.rh);
      if (lt < HEAD) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${HEAD_RGB})`;
        ctx.fillText(glyph(i, t), c.x, c.y);
      } else if (lt < TRAIL) {
        const k = (lt - HEAD) / (TRAIL - HEAD);
        ctx.globalAlpha = c.ch === ' ' ? 1 - k : 1;
        ctx.fillStyle = mix(HEAD_RGB, c.rgb, k);
        ctx.fillText(k < 0.6 ? glyph(i, t) : c.ch, c.x, c.y);
      } else if (c.ch !== ' ') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.color;
        ctx.fillText(c.ch, c.x, c.y);
      }
    });

    ctx.globalAlpha = 1;
  }

  function tick(t) {
    const dt = last ? t - last : 16;
    last = t;
    p = reduced ? target : Math.min(1, Math.max(0, p + (target > p ? dt / IN_MS : -dt / OUT_MS)));
    draw(t);
    if (p !== target) raf = requestAnimationFrame(tick);
    else { raf = 0; last = 0; }
  }

  let origin = { u: 0.5, v: 0.5 };
  function go(to) {
    // only from rest: re-rolling mid-animation would make cells jump
    if (to !== target && (p === 0 || p === 1)) shuffle(origin);
    target = to;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // hover on mouse; touch has no hover (a tap fires enter+leave), so a tap toggles
  const at = e => {
    const r = box.getBoundingClientRect();
    return { u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  let cursor = { u: 0.5, v: 0.5 }, wait = 0;
  box.addEventListener('pointermove', e => { cursor = at(e); });
  box.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    cursor = at(e);
    wait = setTimeout(() => { origin = cursor; go(1); }, WAIT_MS);
  });
  box.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(wait);
    go(0);
  });
  box.addEventListener('click', e => {
    if (!e.pointerType || e.pointerType === 'mouse') return;
    if (!target) origin = at(e);
    go(target ? 0 : 1);
  });

  const ready = () => document.fonts.ready.then(sample);
  if (img.complete) ready(); else img.addEventListener('load', ready);
  new ResizeObserver(() => { if (img.complete) sample(); }).observe(box);
})();
