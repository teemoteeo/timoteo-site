// ============================
// EASTER EGG: break (idea dal sito di Matilde Sartori, js/destroy.js).
// Il trigger e' una crepa quasi invisibile nell'angolo del tech stack (#brk-crack): tenendoci sopra il
// mouse la crepa si allarga sul vetro, e a piena lunghezza (o al click) rompe tutto il sito. Il testo
// si stacca subito, lettera per lettera, con un'onda d'urto dal punto del colpo; poco dopo le crepe
// corrono sul vetro e ogni riquadro va in frantumi (bordi frastagliati, schegge piccole all'impatto e
// grandi ai bordi). Quello che sta sopra lo schermo cade attraverso. Fisica vera: rimbalzi, urti, un
// mucchio in fondo, polvere ASCII dove i pezzi sbattono. Poi compare solo REBUILD.
//
// Prestazioni (le navi di js/ships.js girano sullo stesso thread):
// - il DOM si nasconde con una sola scrittura all'impatto; da li' il sito lo disegnano i canvas;
// - 3 livelli: still (i riquadri ancora interi, con le crepe del vetro: dipinti una volta, a ogni
//   distacco si cancella solo quella scheggia), rest (il mucchio: chi si posa ci viene cotto e lascia
//   la fisica), live (solo cio' che si muove, ridisegnato a ogni frame);
// - ogni pezzo in volo e' uno sprite gia' pronto: per frame un drawImage, niente path ne' clip.
// ============================
(function () {
  const trigger = document.getElementById('brk-crack');
  const container = document.querySelector('.container');
  if (!trigger || !container) return;
  const GRAV = 2600;              // px/s^2
  const RIPPLE = 5000;            // px/s: l'onda che stacca il testo, quasi istantanea
  const TEXT_HOLD = [0.03, 0.2];  // s di tremore di una lettera prima di cadere
  const GLASS_AFTER = 0.25;       // s dopo il colpo in cui le crepe partono sul vetro...
  const CRACK = 2200;             // px/s ...e la velocita' a cui corrono
  const GLASS_HOLD = [0.1, 0.45]; // s tra il passaggio della crepa e il distacco di una scheggia
  const KICK = [60, 260];         // px/s: spinta di distacco, in fuori dal punto d'impatto
  const REST = 0.25, SLIDE = 0.86;   // rimbalzo, attrito a ogni contatto
  const SHAKE = 8;                // px: scossa all'impatto
  const CELL = 24;                // px: griglia delle collisioni
  const SLEEP = [4, 0.25, 3.5];   // px, s: un pezzo che resta entro tanto per tanto si posa (la velocita' no: nel mucchio gli urti la tengono
                                  // sempre un po' su); s: dopo tanto in volo si posa comunque, se poggia sul fondo o sul mucchio (il costo resta limitato)
  const DUST = ".,:;'`*";
  const REBUILD_AT = 1.2;         // s dopo il colpo in cui compare REBUILD
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let VW = 0, VH = 0, dpr = 1, wrap = null, L = null, S = null, Rz = null, atlas = null;
  let byKey = false, raf = 0, last = 0, t0 = 0, done = false, tEnd = 0, pi = 0, ci = 0;
  const live = [], pending = [], dust = [], boxCracks = [], still = new Map(), grid = new Map();
  const rand = (a, b) => a + Math.random() * (b - a);
  const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const lightTheme = () => document.documentElement.dataset.theme === 'light';

  // ---------- testo ----------
  // il testo dei ::before/::after (come '~/' e ' ·') diventa testo vero, cosi' cade anche lui
  function pseudos(root) {
    const todo = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('svg')) continue;
      for (const w of ['::before', '::after']) {
        const cs = getComputedStyle(el, w), c = cs.content;
        if (!c || c[0] !== '"' || cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
        let txt; try { txt = JSON.parse(c); } catch (e) { txt = c.slice(1, -1); }
        if (txt.trim()) todo.push([el, w, txt, cs]);
      }
    }
    for (const [el, w, txt, cs] of todo) {
      const s = document.createElement('brk-ps');
      s.textContent = txt;
      for (const k of ['color', 'fontSize', 'fontWeight', 'fontFamily', 'letterSpacing', 'textTransform']) s.style[k] = cs[k];
      if (w === '::before') el.prepend(s); else el.append(s);
      el.classList.add('brk-nops');
    }
  }
  // ogni carattere visibile in un <brk-l>, raggruppati per parola in <brk-w> (nowrap). Tag propri,
  // non span: le regole del sito come `span + span::before` mettevano un separatore tra ogni lettera
  function split(root) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => !n.nodeValue.trim() || n.parentElement.closest('script, style, brk-l, svg')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      for (const part of n.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s/.test(part)) { frag.append(part); continue; }
        const w = document.createElement('brk-w');
        for (const ch of part) { const l = document.createElement('brk-l'); l.textContent = ch; w.append(l); }
        frag.append(w);
      }
      n.replaceWith(frag);
    });
  }

  // ---------- geometria del vetro ----------
  const area = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  function clip(pts, R) {   // Sutherland-Hodgman contro un rettangolo
    for (const [ax, v, s] of [[0, R.x, 1], [0, R.x + R.w, -1], [1, R.y, 1], [1, R.y + R.h, -1]]) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = (a[ax] - v) * s >= 0, ib = (b[ax] - v) * s >= 0;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      pts = out;
      if (!pts.length) break;
    }
    return pts;
  }
  // una crepa non e' mai dritta: il lato a-b a zigzag, uguale per le due schegge che lo condividono
  // (seme dai suoi estremi, in ordine fisso)
  function jag(a, b) {
    const flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]), p = flip ? b : a, q = flip ? a : b;
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, n = Math.max(1, Math.round(len / 6));
    const nx = -dy / len, ny = dx / len, amp = Math.min(1.8, len * 0.05);
    let seed = (Math.round(p[0] * 8) * 73856093) ^ (Math.round(p[1] * 8) * 19349663) ^ (Math.round(q[0] * 8) * 83492791) ^ (Math.round(q[1] * 8) * 2654435761);
    const out = [p];
    for (let i = 1; i < n; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      const j = ((seed >>> 8) / 16777216 - 0.5) * 2 * amp;
      out.push([p[0] + dx * i / n + nx * j, p[1] + dy * i / n + ny * j]);
    }
    out.push(q);
    return flip ? out.reverse() : out;
  }
  // vetro rotto: raggi dal punto d'impatto (portato dentro il riquadro) e anelli sempre piu' larghi;
  // ogni cella raggio x anello e' una scheggia. Ritorna le schegge e le crepe (ogni lato una volta)
  function shatter(R, P) {
    const c = [Math.min(R.x + R.w, Math.max(R.x, P[0])), Math.min(R.y + R.h, Math.max(R.y, P[1]))];
    const far = Math.max(...[[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]].map(q => Math.hypot(q[0] - c[0], q[1] - c[1])));
    const n = Math.max(12, Math.min(28, Math.round(10 + Math.sqrt(R.w * R.h) / 18)));
    const rot = Math.random() * 6.28, ang = Array.from({ length: n }, (_, i) => rot + (i + rand(-0.3, 0.3)) * 2 * Math.PI / n);
    const rings = [];
    for (let r = Math.max(5, Math.min(18, far * 0.05)); ; r *= rand(1.28, 1.5)) { rings.push(r); if (r * 0.8 > far) break; }
    const pt = rings.map((r, k) => ang.map(a => { const q = k === rings.length - 1 ? r : r * rand(0.88, 1.12); return [c[0] + Math.cos(a) * q, c[1] + Math.sin(a) * q]; }));
    const loop = ps => ps.flatMap((p, i) => jag(p, ps[(i + 1) % ps.length]).slice(0, -1));
    const polys = [], edges = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      edges.push(jag(c, pt[0][i]));
      for (let k = 0; k < rings.length; k++) {
        edges.push(jag(pt[k][i], pt[k][j]));
        if (k < rings.length - 1) edges.push(jag(pt[k][i], pt[k + 1][i]));
      }
      for (let k = -1; k < rings.length - 1; k++) {
        const q = clip(loop(k < 0 ? [c, pt[0][i], pt[0][j]] : [pt[k][i], pt[k + 1][i], pt[k + 1][j], pt[k][j]]), R);
        if (q.length > 2 && area(q) > 2) polys.push(q);
      }
    }
    return { polys, edges };
  }

  // ---------- immagini: fotografate in un canvas della misura a schermo (object-fit e filter compresi) ----------
  function snap(el, w, h, cs, loaded) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
    const x = c.getContext('2d');
    if (cs.filter && cs.filter !== 'none') x.filter = cs.filter;
    const paint = src => {
      try {
        const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height, fit = cs.objectFit;
        if ((fit === 'cover' || fit === 'contain') && sw && sh) {
          const k = (fit === 'cover' ? Math.max : Math.min)(w / sw, h / sh), dw = sw * k, dh = sh * k;
          x.drawImage(src, (w - dw) / 2 * dpr, (h - dh) / 2 * dpr, dw * dpr, dh * dpr);
        } else x.drawImage(src, 0, 0, c.width, c.height);
      } catch (e) { /* non ancora caricata: resta trasparente */ }
    };
    if (el.tagName.toLowerCase() === 'svg') {
      const s = el.cloneNode(true), src = [el, ...el.querySelectorAll('*')], dst = [s, ...s.querySelectorAll('*')];
      src.forEach((o, i) => { const k = getComputedStyle(o); dst[i].style.fill = k.fill; dst[i].style.stroke = k.stroke; dst[i].style.opacity = k.opacity; });   // CSS rules do not travel with the markup
      s.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); s.setAttribute('width', w); s.setAttribute('height', h);
      s.style.color = cs.color;
      const img = new Image();
      img.onload = () => { paint(img); loaded && loaded(c); };   // a moment later: still in time for the shards
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s));
    } else paint(el);
    return c;
  }
  const alphaOf = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(/[\s,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  function fillOf(cs) {
    if (alphaOf(cs.backgroundColor) > 0.02) return cs.backgroundColor;
    const m = cs.backgroundImage.includes('gradient') && /rgba?\([^)]*\)/.exec(cs.backgroundImage);   // un gradiente: il suo primo colore
    return m && alphaOf(m[0]) > 0.01 ? m[0] : null;
  }

  // ---------- sprite ----------
  const glyphs = new Map();
  function letterSprite(st, ch, w, h) {
    const key = st.id + '|' + ch;
    let c = glyphs.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.ceil((w + 6) * dpr); c.height = Math.ceil((h + 6) * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.font = st.font; x.fillStyle = st.color; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText(ch, c.width / dpr / 2 + st.ox, c.height / dpr / 2 + st.by);
    c.ox = c.width / 2; c.oy = c.height / 2;
    glyphs.set(key, c);
    return c;
  }
  const path = (x, poly) => { x.beginPath(); poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); };
  // a shard as it looks, in its own frame (centroid at the origin), cut to the box's rounded corners
  function shardSprite(b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of b.poly) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((x1 - x0 + 2) * dpr)); c.height = Math.max(1, Math.ceil((y1 - y0 + 2) * dpr));
    const x = c.getContext('2d');
    c.ox = (1 - x0) * dpr; c.oy = (1 - y0) * dpr;
    x.setTransform(dpr, 0, 0, dpr, c.ox, c.oy);
    if (b.rr) { x.beginPath(); x.roundRect(b.box.x - b.x, b.box.y - b.y, b.box.w, b.box.h, b.rr); x.clip(); }
    path(x, b.poly);
    if (b.img) { x.save(); x.clip(); x.drawImage(b.img, b.ix, b.iy, b.iw, b.ih); x.restore(); }
    else if (b.fill) { x.fillStyle = b.fill; x.fill(); }
    if (b.stroke) { x.strokeStyle = b.stroke; x.lineWidth = 1 / dpr; x.stroke(); }
    return c;
  }

  // ---------- il colpo ----------
  function layer() {
    const c = document.createElement('canvas');
    c.width = Math.round(VW * dpr); c.height = Math.round(VH * dpr);
    c.style.width = VW + 'px'; c.style.height = VH + 'px';   // px espliciti: un 100% qui veniva 15px piu' stretto
    wrap.append(c);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return x;
  }
  function strike(P) {
    document.documentElement.classList.add('brk-all');   // niente scroll: le coordinate sono quelle dello schermo
    const d = document.documentElement;
    VW = d.clientWidth; VH = d.clientHeight; dpr = Math.min(3, devicePixelRatio || 1);
    wrap = document.createElement('div');
    wrap.id = 'brk'; wrap.setAttribute('aria-hidden', 'true');
    document.body.append(wrap);
    S = layer(); Rz = layer(); L = layer();
    t0 = last = performance.now() / 1000;
    trigger.classList.add('brk-hide');
    pseudos(container);
    split(container);

    const styles = new Map(), lt = lightTheme();
    const glassFill = lt ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.045)', glassEdge = lt ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.26)';
    const tc = p => t0 + GLASS_AFTER + Math.hypot(p[0] - P[0], p[1] - P[1]) / CRACK;
    const fontM = new Map(), clips = new Map();
    // the window an element is seen through: its overflow-clipping ancestors, intersected
    const clipOf = el => {
      if (!el || el === document.body) return [0, -1e9, VW, VH];   // open upwards: what is above the screen falls in too
      let c = clips.get(el);
      if (c) return c;
      const p = clipOf(el.parentElement), k = getComputedStyle(el);
      if (k.overflowX !== 'visible' || k.overflowY !== 'visible') { const r = el.getBoundingClientRect(); c = [Math.max(p[0], r.left), Math.max(p[1], r.top), Math.min(p[2], r.right), Math.min(p[3], r.bottom)]; }
      else c = p;
      clips.set(el, c);
      return c;
    };
    for (const el of container.querySelectorAll('*')) {
      if (el.parentElement.closest('svg') || el.closest('#brk-crack')) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.top > VH || r.right < 0 || r.left > VW) continue;   // below the screen it stays; above it, it falls through
      const R = { x: r.left, y: r.top, w: r.width, h: r.height }, cx = R.x + R.w / 2, cy = R.y + R.h / 2, W = clipOf(el.parentElement);
      if (cx < W[0] - 1 || cx > W[2] + 1 || cy < W[1] - 1 || cy > W[3] + 1) continue;   // clipped away: it was never on screen

      if (el.tagName === 'BRK-L') {
        const host = el.parentElement.parentElement;
        let st = styles.get(host);
        if (!st) {
          const cs = getComputedStyle(el), font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          if (!fontM.has(font)) { L.font = font; const m = L.measureText('Hg'); fontM.set(font, [m.fontBoundingBoxAscent || m.actualBoundingBoxAscent, m.fontBoundingBoxDescent || m.actualBoundingBoxDescent]); }
          const [A, D] = fontM.get(font);
          st = { id: styles.size, font, color: cs.color, tt: cs.textTransform, ox: -(parseFloat(cs.letterSpacing) || 0) / 2, by: (A - D) / 2, al: +cs.opacity };
          styles.set(host, st);
        }
        const t = el.textContent, ch = st.tt === 'uppercase' ? t.toUpperCase() : st.tt === 'lowercase' ? t.toLowerCase() : t;
        live.push({ st: 1, spr: letterSprite(st, ch, R.w, R.h), al: st.al, x: cx, y: cy, a: 0, r: Math.max(2, Math.min(R.w, R.h) * 0.42), letter: true, through: R.y + R.h < 0,
          ph: Math.random() * 6.28, rel: t0 + Math.hypot(cx - P[0], cy - P[1]) / RIPPLE + rand(TEXT_HOLD[0], TEXT_HOLD[1]), P });
        continue;
      }

      const tag = el.tagName.toLowerCase(), media = tag === 'img' || tag === 'canvas' || tag === 'video' || tag === 'svg';
      const cs = getComputedStyle(el), glass = el.classList.contains('glass');
      const rr = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, R.w / 2, R.h / 2);
      let fill = null, stroke = null, img = null;
      if (media) img = snap(el, R.w, R.h, cs, c => { S.save(); S.setTransform(dpr, 0, 0, dpr, 0, 0); S.globalAlpha = +cs.opacity; S.drawImage(c, R.x, R.y, R.w, R.h); S.restore(); });
      else if (glass) { fill = glassFill; stroke = glassEdge; }
      else {
        fill = fillOf(cs);
        const side = ['Top', 'Right', 'Bottom', 'Left'].map(k => { const w = parseFloat(cs['border' + k + 'Width']) || 0, c = cs['border' + k + 'Color']; return w && alphaOf(c) > 0.02 ? [w, c] : null; });
        if (side.every(v => v)) stroke = side[0][1];
        else side.forEach((v, k) => {   // a rule on one side only breaks into sticks
          if (!v) return;
          const [w, c] = v, hz = k % 2 === 0, x0 = k === 1 ? R.x + R.w - w : R.x, y0 = k === 2 ? R.y + R.h - w : R.y, len = hz ? R.w : R.h, n = Math.max(1, Math.round(len / rand(40, 80)));
          for (let i = 0; i < n; i++) {
            const a = len * i / n, b = len * (i + 1) / n, px = hz ? x0 + (a + b) / 2 : x0 + w / 2, py = hz ? y0 + w / 2 : y0 + (a + b) / 2, hl = (b - a) / 2;
            const poly = hz ? [[-hl, -w / 2], [hl, -w / 2], [hl, w / 2], [-hl, w / 2]] : [[-w / 2, -hl], [w / 2, -hl], [w / 2, hl], [-w / 2, hl]];
            S.fillStyle = c; S.fillRect(px - (hz ? hl : w / 2), py - (hz ? w / 2 : hl), hz ? 2 * hl : w, hz ? w : 2 * hl);
            pending.push({ through: R.y + R.h < 0, poly, fill: c, al: 1, x: px, y: py, a: 0, r: Math.max(2, hl * 0.6), ph: Math.random() * 6.28, rel: tc([px, py]) + rand(GLASS_HOLD[0], GLASS_HOLD[1]), P });
          }
        });
        if (!fill && !stroke) continue;
      }
      // the box whole on the still layer, as it was; its shards are cut out of it one by one
      const al = media ? +cs.opacity : 1;
      S.globalAlpha = al;
      S.beginPath(); S.roundRect(R.x, R.y, R.w, R.h, rr);
      if (img) { S.save(); S.clip(); S.drawImage(img, R.x, R.y, R.w, R.h); S.restore(); }
      else if (fill) { S.fillStyle = fill; S.fill(); }
      if (stroke) { S.strokeStyle = stroke; S.lineWidth = 1 / dpr; S.stroke(); }
      S.globalAlpha = 1;
      const small = !glass && R.w * R.h < 3600;
      const { polys, edges } = small ? { polys: [[[R.x, R.y], [R.x + R.w, R.y], [R.x + R.w, R.y + R.h], [R.x, R.y + R.h]]], edges: [] } : shatter(R, P);
      for (const q of polys) {
        const qx = q.reduce((s, p) => s + p[0], 0) / q.length, qy = q.reduce((s, p) => s + p[1], 0) / q.length;
        pending.push({ through: R.y + R.h < 0, poly: q.map(p => [p[0] - qx, p[1] - qy]), fill, stroke, img, ix: R.x - qx, iy: R.y - qy, iw: R.w, ih: R.h, al, glass, rr, box: R,
          x: qx, y: qy, a: 0, r: Math.max(3, Math.sqrt(area(q) / Math.PI) * 0.85), ph: Math.random() * 6.28, rel: tc([qx, qy]) + rand(GLASS_HOLD[0], GLASS_HOLD[1]), P });
      }
      const inside = p => p[0] >= R.x - 0.5 && p[0] <= R.x + R.w + 0.5 && p[1] >= R.y - 0.5 && p[1] <= R.y + R.h + 0.5;
      if (glass) for (const e of edges) for (let i = 1; i < e.length; i++) {   // cracks show on the glass only
        const a = e[i - 1], b = e[i];
        if (inside(a) && inside(b)) boxCracks.push([a[0], a[1], b[0], b[1], tc([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), glassEdge]);
      }
    }
    container.style.opacity = '0';   // the one DOM write: from here the canvases are the site
    pending.sort((a, b) => a.rel - b.rel);
    boxCracks.sort((a, b) => a[4] - b[4]);
    tEnd = t0 + REBUILD_AT;
    raf = requestAnimationFrame(frame);
  }
  // ---------- fisica ----------
  function kick(b) {
    const dx = b.x - b.P[0], dy = b.y - b.P[1], d = Math.hypot(dx, dy) || 1, k = rand(KICK[0], KICK[1]) * (b.letter ? 1 : 0.6);
    b.vx = dx / d * k + rand(-20, 20); b.vy = dy / d * k * 0.5 - rand(0, 120); b.va = rand(-1, 1) * (b.letter ? 9 : 3); b.still = 0; b.t1 = last;
  }
  function puff(x, y, v) {
    for (let n = Math.min(4, v / 300 | 0); n > 0 && dust.length < 800; n--)
      dust.push({ x, y, vx: rand(-0.2, 0.2) * v, vy: -rand(0, 0.35) * v, l: 0, L: rand(0.5, 1.3), c: Math.random() * DUST.length | 0 });
  }
  const cells = (b, f) => { const x0 = Math.floor((b.x - b.r) / CELL), x1 = Math.floor((b.x + b.r) / CELL), y0 = Math.floor((b.y - b.r) / CELL), y1 = Math.floor((b.y + b.r) / CELL); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(y * 4096 + x); };
  function step(dt) {
    const moving = [];
    for (const b of live) {
      if (b.st !== 2) continue;
      b.touch = 0;
      b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt; b.va *= 0.995;
      if (b.through) { if (b.y - b.r * 2 > VH) b.st = 4; continue; }   // from above the screen: straight through it, no floor, no knocks
      if (b.y + b.r > VH) { const v = b.vy; b.y = VH - b.r; b.touch = 1; if (v > 0) { b.vy = -v * REST; b.vx *= SLIDE; b.va = b.vx / b.r * 0.5; if (v > 500) puff(b.x, VH, v); } }
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * REST; } else if (b.x + b.r > VW) { b.x = VW - b.r; b.vx = -Math.abs(b.vx) * REST; }
      moving.push(b);
    }
    // moving vs moving: each pair once, in the first cell both boxes share (arrays reused, no garbage)
    for (const c of grid.values()) c.length = 0;
    for (const b of moving) {
      b.gx = Math.floor((b.x - b.r) / CELL); b.gy = Math.floor((b.y - b.r) / CELL);
      cells(b, k => { const c = grid.get(k); if (c) c.push(b); else grid.set(k, [b]); });
    }
    for (const [k, c] of grid) {
      if (c.length < 2) continue;
      const cy = Math.floor(k / 4096), cx = k - cy * 4096;
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
        const a = c[i], b = c[j];
        if (Math.max(a.gx, b.gx) === cx && Math.max(a.gy, b.gy) === cy) hit(a, b, false);
      }
    }
    // moving vs settled: the pile does not move
    for (const b of moving) cells(b, k => { const c = still.get(k); if (c) for (const o of c) hit(b, o, true); });
  }
  function hit(a, b, fixed) {
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 === 0) return;
    if (fixed) a.touch = 1;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d, ma = a.r * a.r, mb = b.r * b.r, wa = fixed ? 1 : mb / (ma + mb), wb = 1 - wa;
    a.x -= nx * pen * wa; a.y -= ny * pen * wa; b.x += nx * pen * wb; b.y += ny * pen * wb;
    const bvx = fixed ? 0 : b.vx, bvy = fixed ? 0 : b.vy, vn = (bvx - a.vx) * nx + (bvy - a.vy) * ny;
    if (vn >= 0) return;
    const j = -(1 + REST) * vn, f = -vn < 60 ? 0.9 : 1 - SLIDE;   // a resting contact grips (relative sliding only), or the pile flows like a liquid
    a.vx -= nx * j * wa; a.vy -= ny * j * wa;
    if (!fixed) { b.vx += nx * j * wb; b.vy += ny * j * wb; }
    const rvx = bvx - a.vx, rvy = bvy - a.vy, rn = rvx * nx + rvy * ny, tx = rvx - rn * nx, ty = rvy - rn * ny;
    a.vx += tx * f * wa; a.vy += ty * f * wa;
    if (!fixed) { b.vx -= tx * f * wb; b.vy -= ty * f * wb; }
    if (-vn > 650) puff(a.x + nx * a.r, a.y + ny * a.r, -vn * 0.6);
  }
  // a piece that stays slow long enough settles: baked into the pile layer, out of the physics
  function settle(dt, now) {
    let any = false;
    for (const b of live) {
      if (b.st !== 2 || b.through) continue;
      if (now - b.t1 > SLEEP[2] && b.touch) b.still = SLEEP[1];   // resting on the floor or the pile, never mid-air
      else if (b.ax === undefined || Math.hypot(b.x - b.ax, b.y - b.ay) > SLEEP[0]) { b.ax = b.x; b.ay = b.y; b.still = 0; continue; }
      if ((b.still += dt) < SLEEP[1]) continue;
      b.st = 3; any = true;
      put(Rz, b, 0, 0);
      cells(b, k => { const c = still.get(k); if (c) c.push(b); else still.set(k, [b]); });
      if (!b.letter) b.spr = null;
    }
    if (any || live.some(b => b.st === 4)) for (let i = live.length - 1; i >= 0; i--) if (live[i].st >= 3) live.splice(i, 1);
  }

  // ---------- disegno ----------
  function put(x, b, dx, dy) {
    const c = Math.cos(b.a), s = Math.sin(b.a);
    x.setTransform(c, s, -s, c, (b.x + dx) * dpr, (b.y + dy) * dpr);
    x.globalAlpha = b.al;
    x.drawImage(b.spr, -b.spr.ox, -b.spr.oy);
  }
  function dustAtlas() {
    if (atlas) return atlas;
    const w = Math.ceil(7 * dpr), h = Math.ceil(14 * dpr);
    atlas = document.createElement('canvas');
    atlas.width = w * DUST.length; atlas.height = h;
    const x = atlas.getContext('2d');
    x.fillStyle = cssVar('--fg'); x.font = `500 ${11 * dpr}px 'JetBrains Mono', monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
    [...DUST].forEach((c, i) => x.fillText(c, i * w + w / 2, h / 2));
    atlas.cw = w; atlas.ch = h;
    return atlas;
  }
  // glass crack segments due by now, each stroked once on the still layer (they go with the shards cut out of it)
  function cracks(now) {
    if (ci < boxCracks.length && boxCracks[ci][4] <= now) {
      S.setTransform(dpr, 0, 0, dpr, 0, 0);
      S.lineWidth = 1 / dpr; S.lineCap = 'round';
      let col = null;
      S.beginPath();
      for (; ci < boxCracks.length && boxCracks[ci][4] <= now; ci++) {
        const g = boxCracks[ci];
        if (g[5] !== col) { if (col) { S.strokeStyle = col; S.stroke(); S.beginPath(); } col = g[5]; }
        S.moveTo(g[0], g[1]); S.lineTo(g[2], g[3]);
      }
      S.strokeStyle = col; S.stroke();
    }
  }
  function draw(now) {
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.clearRect(0, 0, L.canvas.width, L.canvas.height);
    for (const b of live) {
      if (b.st === 1) {   // trembling in place: smooth sines, not noise
        const k = Math.min(1, (now - t0) / 0.1);
        put(L, b, k * 1.1 * Math.sin(now * 47 + b.ph), k * 1.1 * Math.sin(now * 53 + b.ph * 1.7));
        continue;
      }
      put(L, b, 0, 0);
      if (b.glass) {   // a glint sweeps a shard as it turns to the light
        const g = Math.pow(Math.max(0, Math.cos(2 * b.a + b.ph)), 12);
        if (g > 0.03) {
          const c = Math.cos(b.a) * dpr, s = Math.sin(b.a) * dpr;
          L.setTransform(c, s, -s, c, b.x * dpr, b.y * dpr);
          L.globalAlpha = g * 0.3; L.fillStyle = '#fff';
          path(L, b.poly); L.fill();
        }
      }
    }
    const A = dustAtlas();
    L.setTransform(1, 0, 0, 1, 0, 0);
    for (const d of dust) {
      L.globalAlpha = (1 - d.l / d.L) * 0.8;
      L.drawImage(A, d.c * A.cw, 0, A.cw, A.ch, Math.round(d.x * dpr - A.cw / 2), Math.round(d.y * dpr - A.ch / 2), A.cw, A.ch);
    }
    L.globalAlpha = 1;
  }

  function frame(ms) {
    raf = 0;
    const now = ms / 1000, dt = Math.min(1 / 30, Math.max(0, now - last));
    last = now;
    const u = now - t0, A = calm || u > 1.5 ? 0 : SHAKE * Math.exp(-u / 0.3);
    wrap.style.translate = A ? `${(A * Math.sin(u * 2 * Math.PI * 13)).toFixed(1)}px ${(A * 0.6 * Math.sin(u * 2 * Math.PI * 17 + 1)).toFixed(1)}px` : '';
    cracks(now);
    // shards whose crack has passed: cut out of the still layer, into the air
    if (pi < pending.length && pending[pi].rel <= now) {
      S.save(); S.globalCompositeOperation = 'destination-out'; S.lineWidth = 2 / dpr; S.globalAlpha = 1; S.fillStyle = S.strokeStyle = '#000';   // opaque: destination-out erases by the source's alpha
      for (; pi < pending.length && pending[pi].rel <= now; pi++) {
        const b = pending[pi];
        S.setTransform(dpr, 0, 0, dpr, b.x * dpr, b.y * dpr);
        path(S, b.poly); S.fill(); S.stroke();
        b.spr = shardSprite(b); b.st = 2; kick(b); live.push(b);
        if (Math.random() < 0.25) puff(b.x, b.y, 350);
      }
      S.restore();
      if (pi >= pending.length) { S.setTransform(1, 0, 0, 1, 0, 0); S.clearRect(0, 0, S.canvas.width, S.canvas.height); }   // the outer half of the boxes' outlines lies outside every shard
    }
    for (const b of live) if (b.st === 1 && now >= b.rel) { b.st = 2; kick(b); }
    step(dt / 2); step(dt / 2);
    settle(dt, now);
    for (const d of dust) { d.l += dt; d.vy += GRAV * 0.25 * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
    for (let i = dust.length - 1; i >= 0; i--) if (dust[i].l >= dust[i].L) dust.splice(i, 1);
    draw(now);
    if (!done && now > tEnd) { done = true; end(); }
    if (live.length || dust.length || pi < pending.length || ci < boxCracks.length || !done) raf = requestAnimationFrame(frame);
  }

  // ---------- la fine: solo REBUILD ----------
  function end() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'brk-rebuild'; b.textContent = 'rebuild';
    b.addEventListener('click', () => { try { sessionStorage.setItem('introSeen', 'true'); } catch (e) {} location.reload(); });
    document.body.append(b);
    if (byKey) b.focus({ preventScroll: true });   // from the keyboard the focus follows; with the mouse no outline
  }

  // ---------- the trigger: a crack that grows while the mouse rests on it ----------
  // it creeps over the tech stack's glass from the corner; leaving keeps it as far as it got;
  // at full length (or on a click, at any length) the whole site breaks
  const GROW = 3.2;               // s of hovering from nothing to the break
  const pane = document.getElementById('tech-grid');
  let gc = null, gx = null, segs = null, reach = 0, gk = 0, hover = false, gl = 0, graf = 0, broken = false;
  function growLayer() {
    const sec = trigger.parentElement;
    gc = document.createElement('canvas');
    gc.className = 'brk-grow'; gc.setAttribute('aria-hidden', 'true');
    const W = pane.offsetWidth, H = pane.offsetHeight, k = Math.min(3, devicePixelRatio || 1);
    gc.width = Math.round(W * k); gc.height = Math.round(H * k);
    Object.assign(gc.style, { left: pane.offsetLeft + 'px', top: pane.offsetTop + 'px', width: W + 'px', height: H + 'px' });
    sec.insertBefore(gc, trigger);
    gx = gc.getContext('2d');
    gx.setTransform(k, 0, 0, k, 0, 0);
    gx.strokeStyle = cssVar('--fg'); gx.lineCap = 'round';
    // branches from the trigger's centre, heading into the box; each segment knows its distance along the crack
    const t = trigger.getBoundingClientRect(), g = pane.getBoundingClientRect();
    const ox = t.left + t.width / 2 - g.left, oy = t.top + t.height / 2 - g.top, base = Math.atan2(H / 2 - oy, W / 2 - ox);
    segs = [];
    const go = (x, y, a, len, depth, d) => {
      while (len > 0) {
        const st = rand(3, 8);
        a += rand(-0.28, 0.28);
        const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
        if (nx < 2 || ny < 2 || nx > W - 2 || ny > H - 2) return;
        segs.push([x, y, nx, ny, d, depth]);
        d += st; x = nx; y = ny; len -= st;
        if (depth < 4 && Math.random() < 0.07) go(x, y, a + (Math.random() < 0.5 ? -1 : 1) * rand(0.45, 1.2), len * rand(0.25, 0.6), depth + 1, d);
      }
    };
    for (let i = 0; i < 8; i++) go(ox, oy, base + rand(-1.15, 1.15), Math.hypot(W, H) * rand(0.45, 1.05), 0, 0);
    segs.sort((a, b) => a[4] - b[4]);
    reach = Math.max(...segs.map(s => s[4]));
  }
  function grow(ms) {
    graf = 0;
    if (broken) return;
    const now = ms / 1000, dt = gl ? Math.min(0.05, now - gl) : 0;
    gl = now;
    if (hover) gk = Math.min(1, gk + dt / GROW);
    // slow at first, then faster: the glass gives way
    const r = reach * Math.pow(gk, 1.4), n0 = gk;
    let i0 = gx.i || 0, i = i0;
    while (i < segs.length && segs[i][4] <= r) i++;
    for (let depth = 0; depth < 5 && i > i0; depth++) {
      gx.globalAlpha = 0.65 - depth * 0.1; gx.lineWidth = depth ? 0.5 : 0.9;
      gx.beginPath();
      for (let j = i0; j < i; j++) { const s = segs[j]; if (s[5] === depth) { gx.moveTo(s[0], s[1]); gx.lineTo(s[2], s[3]); } }
      gx.stroke();
    }
    gx.i = i;
    // near the end the glass trembles
    const q = Math.max(0, (gk - 0.6) / 0.4);
    pane.style.translate = hover && q ? `${(0.8 * q * Math.sin(now * 61)).toFixed(2)}px ${(0.5 * q * Math.sin(now * 47)).toFixed(2)}px` : '';
    if (n0 >= 1) return fire();
    if (hover) graf = requestAnimationFrame(grow); else gl = 0;
  }
  function fire() {
    if (broken) return;
    broken = true;
    hover = false; cancelAnimationFrame(graf);
    pane.style.translate = '';
    trigger.disabled = true;
    const r = trigger.getBoundingClientRect();
    strike([r.left + r.width / 2, r.top + r.height / 2]);
  }
  trigger.addEventListener('mouseenter', () => {
    if (broken) return;
    if (!gc) growLayer();
    hover = true;
    if (!graf) graf = requestAnimationFrame(grow);
  });
  trigger.addEventListener('mouseleave', () => { hover = false; });   // the crack stays as far as it got
  trigger.addEventListener('click', e => {
    if (broken) return;
    const r = trigger.getBoundingClientRect();
    broken = true; hover = false; cancelAnimationFrame(graf);
    pane.style.translate = ''; trigger.disabled = true; byKey = !e.detail;
    strike(e.detail ? [e.clientX, e.clientY] : [r.left + r.width / 2, r.top + r.height / 2]);   // detail 0: from the keyboard
  });
})();
