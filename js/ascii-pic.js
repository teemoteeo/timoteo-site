// ============================
// PROFILE PIC: TWO COLORED ASCII AVATARS, SWAPPED ON HOVER
// same idea as the GitHub profile card: each char takes its pixel's color. The photo itself is never
// shown: one avatar shows (the dark theme's main is data-ascii, the light theme's data-ascii-light); on
// hover the rain bursts out of the cursor and, passing, leaves the other one; leaving, it runs
// backwards and collapses into the point it burst out of
// ============================
(function() {
  const box = document.querySelector('.profile-pic-container');
  const img = box && box.querySelector('.profile-pic');
  if (!box || !img) return;
  // data-ascii and data-ascii-light: the two avatars. Both have the photo's size and the face in the
  // same spot (Vision: eye centre, eye-chin), so the photo's object-fit/position puts the heads in the same place
  const load = u => { const i = new Image(); i.src = u; return i; };
  const pics = { dark: load(img.dataset.ascii), light: load(img.dataset.asciiLight || img.dataset.ascii) };
  const isLight = () => document.documentElement.dataset.theme === 'light';
  // [shown at rest, shown on hover]: the light theme swaps them
  const order = () => isLight() ? [pics.light, pics.dark] : [pics.dark, pics.light];

  // brighter pixel, denser char (Paul Bourke's ramp: more steps, more detail)
  const RAMP = " .'`^\",:;Il!i~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789';
  const TINT = 0.45;             // light theme: how much of its pixel's colour a cell takes under the glyph (both avatars)
  const CELL_W = 2.5;            // css px per column
  const CELL_H = CELL_W * 1.75;
  const EDGE = 1.3;              // sobel magnitude (on 0-1 luminance) above which a cell becomes a line char
  const IN_MS = 1300, OUT_MS = 800;
  const WAIT_MS = 100;           // hover this long before the burst starts
  const HEAD = 0.03, TRAIL = 0.22; // in rain-time units: bright head, then a trail fading into the pixel's color
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cv = document.createElement('canvas');
  cv.className = 'profile-ascii';
  cv.setAttribute('aria-hidden', 'true');
  box.appendChild(cv);
  const ctx = cv.getContext('2d');

  let cells = [], cols = 0, rows = 0, w = 0, h = 0, maxDelay = 1;   // cells[i]: [at rest, on hover] plus the layout
  let p = 0, target = 0, last = 0, raf = 0, pace = 1;   // how far the rain has swapped the avatars (0 at rest, 1 the other); pace < 1: the faster first-visit demo

  function sample() {
    w = box.clientWidth; h = box.clientHeight;
    const [A, B] = order();
    if (!w || !A.naturalWidth || !B.naturalWidth) return;
    const dpr = devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(w / CELL_W); rows = Math.floor(h / CELL_H);
    const a = glyphsOf(A), b = glyphsOf(B);
    cells = a.map((c, i) => {
      const x = i % cols, y = Math.floor(i / cols);
      // cells stretch to cover the whole box, so no strip is left at the edges
      const rx = Math.floor(x * w / cols), ry = Math.floor(y * h / rows);
      const rw = Math.floor((x + 1) * w / cols) - rx, rh = Math.floor((y + 1) * h / rows) - ry;
      return { rx, ry, rw, rh, x: x * w / cols, y: ry + rh * 0.8, a: c, b: b[i], delay: 0 };   // text at the exact column (rx is floored: gaps every few chars)
    });
    shuffle({ u: 0.5, v: 0.5 });
    draw(performance.now());
  }
  // one avatar as glyphs: per cell its char, colour and (light theme) background tint
  function glyphsOf(src) {

    // replicate object-fit: cover + object-position of the <img>
    const iw = src.naturalWidth, ih = src.naturalHeight;
    const s = Math.max(w / iw, h / ih);
    const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const sw = w / s, sh = h / s, sx = (iw - sw) * px, sy = (ih - sh) * py;

    const off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    const o = off.getContext('2d');
    o.drawImage(src, sx, sy, sw, sh, 0, 0, cols, rows);
    const d = o.getImageData(0, 0, cols, rows).data;

    // stretch contrast over the visible pixels only (2nd-98th percentile): dark skin gets the whole ramp
    const L = i => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const seen = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127) seen.push(L(i));
    seen.sort((a, b) => a - b);
    const lo = seen[Math.floor(seen.length * 0.02)] || 0, hi = seen[Math.floor(seen.length * 0.98)] || 1;

    const S = i => Math.min(1, Math.max(0, (L(i) - lo) / (hi - lo || 1)));
    // strong edges (glasses, mouth, cap brim, jaw) get a line char along the edge: features drawn, not just shaded
    const at = (x, y) => S((Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))) * 4);
    const edge = (x, y) => {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      if (Math.hypot(gx, gy) < EDGE) return null;
      // edge runs perpendicular to the gradient; y grows downward on screen
      return '|/-\\'[Math.round(((Math.atan2(gy, gx) * 4 / Math.PI) % 4 + 4) % 4) % 4];
    };

    // no line chars on and round the lips: the lip line came out as thin dashes, a gap in the mouth.
    // Lips: pink, red well above green and blue about as green (skin is orange: blue well below green)
    const pink = (x, y) => { if (x < 0 || y < 0 || x >= cols || y >= rows) return false; const k = (y * cols + x) * 4; return d[k + 1] > 70 && d[k] > 1.3 * d[k + 1] && d[k + 2] > 0.88 * d[k + 1]; };   // > 70: dark reddish shadows are not lips
    const lips = (x, y) => { for (let v = -2; v <= 2; v++) for (let u = -1; u <= 1; u++) if (pink(x + u, y + v)) return true; return false; };

    const out = [], ink = isLight();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4, empty = d[i + 3] <= 127;
      const lum = S(i), e = empty || lips(x, y) ? null : edge(x, y);
      // photo colors, darks lifted a little: a glyph only inks part of its cell, so true colors read darker
      // (the shadows under the cap are also lifted in the avatar file itself)
      const rgb = [d[i], d[i + 1], d[i + 2]].map(v => Math.round(255 * Math.pow(v / 255, 0.8)));
      out.push({
        // dark theme: brighter pixel, denser char, min 0.4 so shadows stay drawn instead of turning into holes.
        // Light theme: ink on paper, the darker the pixel the denser the char (hair and shirt come out full)
        ch: empty ? ' ' : e || RAMP[Math.min(RAMP.length - 1, Math.floor((ink ? Math.pow(1 - lum, 0.8) : 0.4 + 0.6 * lum) * RAMP.length))],
        // ink: colours darkened, the same reason the other way round (a glyph only inks part of a light cell)
        rgb: ink ? [d[i], d[i + 1], d[i + 2]].map(v => Math.round(255 * Math.pow(v / 255, 1.5))) : rgb,
        // ink: the cell itself takes a wash of its pixel, the image reads under the glyphs (on the dark theme it looked like pixel art)
        tint: ink ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null,
      });
    }
    return out;
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

  // same rain on both themes: cell background (--bg) and rain head (--fg) follow the theme
  const rgbOf = hex => { const n = parseInt(hex.trim().slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    if (!cells.length) return;
    const css = getComputedStyle(document.documentElement);
    const BG = css.getPropertyValue('--bg').trim(), HEAD_RGB = rgbOf(css.getPropertyValue('--fg'));
    ctx.font = `600 ${CELL_H * 0.95}px 'JetBrains Mono', 'Hiragino Sans', monospace`;

    const T = p * (maxDelay + TRAIL);
    // each cell: the resting avatar until the rain reaches it, the head, then the trail settling into the
    // other avatar. All backgrounds first, then all glyphs: drawn per cell, the next cell's rect clipped the
    // previous glyph by a sub-pixel amount that drifts along the row, so half the portrait looked different
    const side = c => T - c.delay < HEAD ? c.a : c.b;
    ctx.fillStyle = BG;
    cells.forEach(c => ctx.fillRect(c.rx, c.ry, c.rw + 1, c.rh + 1));   // +1: antialiased edges show a grid
    // light theme: the tint under the glyphs; in the trail it crosses from one avatar's to the other's
    cells.forEach(c => {
      if (!c.a.tint) return;
      const lt = T - c.delay;
      if (lt >= HEAD && lt < TRAIL) {
        const k = (lt - HEAD) / (TRAIL - HEAD);
        ctx.globalAlpha = TINT * (1 - k); ctx.fillStyle = c.a.tint; ctx.fillRect(c.rx, c.ry, c.rw + 1, c.rh + 1);
        ctx.globalAlpha = TINT * k; ctx.fillStyle = c.b.tint; ctx.fillRect(c.rx, c.ry, c.rw + 1, c.rh + 1);
      } else { ctx.globalAlpha = TINT; ctx.fillStyle = side(c).tint; ctx.fillRect(c.rx, c.ry, c.rw + 1, c.rh + 1); }
    });
    cells.forEach((c, i) => {
      const lt = T - c.delay;
      if (lt < 0 || lt >= TRAIL) {   // at rest: one avatar or the other
        const g = lt < 0 ? c.a : c.b;
        if (g.ch === ' ') return;
        ctx.globalAlpha = 1; ctx.fillStyle = `rgb(${g.rgb})`; ctx.fillText(g.ch, c.x, c.y);
      } else if (lt < HEAD) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgb(${HEAD_RGB})`;
        ctx.fillText(glyph(i, t), c.x, c.y);
      } else {   // the trail, settling into the other avatar
        const k = (lt - HEAD) / (TRAIL - HEAD), g = c.b;
        ctx.globalAlpha = g.ch === ' ' ? 1 - k : 1;
        ctx.fillStyle = mix(HEAD_RGB, g.rgb, k);
        ctx.fillText(k < 0.6 ? glyph(i, t) : g.ch, c.x, c.y);
      }
    });
    ctx.globalAlpha = 1;
  }

  function tick(t) {
    const dt = last ? t - last : 16;
    last = t;
    p = reduced ? target : Math.min(1, Math.max(0, p + (target > p ? dt / (IN_MS * pace) : -dt / (OUT_MS * pace))));
    if (p === 0 && target === 0) pace = 1;   // demo over: the hover runs at its own pace
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
  let cursor = { u: 0.5, v: 0.5 }, wait = 0, over = false;
  box.addEventListener('pointermove', e => { cursor = at(e); });
  box.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    over = true; pace = 1;
    cursor = at(e);
    wait = setTimeout(() => { origin = cursor; go(1); }, WAIT_MS);
  });
  box.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return;
    over = false;
    clearTimeout(wait);
    go(0);   // backwards, into the point the rain burst out of
  });
  box.addEventListener('click', e => {
    if (!e.pointerType || e.pointerType === 'mouse') return;
    if (!target) origin = at(e);
    go(target ? 0 : 1);
  });

  // first visit: the rain runs once by itself, faster (the other avatar, then back) so the hover gets
  // found. It starts when the page shows (as the ticker), and not over a cursor already on the picture.
  // ?asciidemo runs it on every load
  const DEMO_PACE = 0.5, HOLD_MS = 700;   // rain at twice the speed; the other avatar stays ~0.8 s (the hold plus the rain's last cells)
  try {
    if (!localStorage.getItem('asciiSeen') || /asciidemo/.test(location.search)) {
      const demo = () => {
        if (!document.querySelector('.container.visible') || !cells.length) return setTimeout(demo, 150);
        localStorage.setItem('asciiSeen', '1');
        setTimeout(() => {
          if (over || target) return;
          origin = { u: 0.5, v: 0.4 };   // about the face
          pace = DEMO_PACE;
          go(1);
          setTimeout(() => { if (!over) go(0); }, IN_MS * DEMO_PACE + HOLD_MS);
        }, 600);
      };
      demo();
    }
  } catch (e) { /* no storage: no demo */ }

  // at rest nothing redraws: a theme swap repaints now (inside the View Transition, so the new snapshot is right)
  // (the avatars swap roles and the glyphs their ramp): sampled again
  document.addEventListener('themechange', sample);

  const ready = () => document.fonts.ready.then(sample);
  for (const pic of new Set(Object.values(pics))) if (pic.complete) ready(); else pic.addEventListener('load', ready);
  new ResizeObserver(sample).observe(box);
})();
