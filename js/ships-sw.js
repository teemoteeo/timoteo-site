// ============================
// SHIPS SW: the famous starships of Star Wars, as ASCII
// ============================
// The saga's ships, modeled with the mesh language of js/ships.js (box / loft / ext + engine /
// gun / dots) and rasterized by its engine (copied verbatim below) into tinted ASCII sprites.
// Standalone: it does not touch the home background. A turntable lab on a full-page canvas;
// ?shiplab=destroyer|falcon|tie|xwing|ywing|deathstar preselects (a corner selector switches),
// &ang=<rad> freezes the turntable, &elev=<rad>, &size=<px>.
// In node it exports the mesh side for the terminal harness (.ships-work/sw-shot.js).
(function () {
  const INTENSITY = 0.65;         // the knob: glyph strength over the page bg, dark theme (0-1)
  const INK = 0.4;                // same on the light theme
  const CELL_W = 2.5, CELL_H = CELL_W * 1.75;   // css px per cell, as the avatar
  const CELL_CAP = [4000, 16000]; // above these cell counts: 2x2, then 1x1 samples per cell (else 2x3)
  const AMB = 0.05, DIF = 0.95, RIM = 0.2, GAMMA = 1.4;
  const LIGHT = norm([-0.45, -0.75, -0.5]);  // towards the key light, world space
  const CREASE = 0.25;            // cos of the angle between faces that draws an edge char
  const LEVELS = 4;               // brightness buckets per glyph
  const TONE = [0.82, 0.9, 0.97, 1.04];   // plating: a few tones, one per panel
  // Bourke's ramp (as in ascii-pic.js) without the bars, slashes and brackets: those read as edges at this size
  const RAMP = " .'`,:;~+icrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const EDGES = '|/-\\';
  const FIRE = ' .:+*o#@';     // exhaust, sparse to dense
  // material colours: [dark theme, light theme (darker, more saturated ink)]; hull = --fg
  const PALETTE = {
    hull: [null, null], hullDark: ['#a3a0ab', '#4a4852'], red: ['#e0574e', '#b3261e'], rust: ['#c4805a', '#8a4a22'],
    blue: ['#86a2cf', '#2f5596'], glowBlue: ['#9fd0ff', '#1d5fbf'], glowWarm: ['#ffab7a', '#c2410c'],
    glass: ['#92c6d8', '#1f6f8b'], window: ['#ffd47e', '#a86500'],
  };

  // ---------- vectors ----------
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : v; }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
  const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
  const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
  const app = (M, p) => [dot(M[0], p), dot(M[1], p), dot(M[2], p)];
  // place a part: rotate (x, y, z order) then move
  const at = (x, y, z, ax = 0, ay = 0, az = 0) => { const R = mul(rz(az), mul(ry(ay), rx(ax))); const f = p => { const q = app(R, p); return [q[0] + x, q[1] + y, q[2] + z]; }; f.R = R; return f; };
  const id = p => p; id.R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  // ---------- mesh building ----------
  // ship space: x forward, y up, z sideways. Normals point away from the part's centre.
  // Parts take o.fl (EMIT: lights itself, DARK: recessed, SMOOTH: per-vertex normals) and
  // o.col (a PALETTE key, default hull). Exhaust cones (EXH) are drawn as glow, not as hull.
  const EMIT = 1, DARK = 2, SMOOTH = 4, EXH = 8;
  const COLS = Object.keys(PALETTE);
  let T, fid, PANEL;
  function tri(a, b, c, ctr, f, fl, col, vn) {
    const n0 = cross(sub(b, a), sub(c, a));
    if (Math.hypot(n0[0], n0[1], n0[2]) < 1e-9) return;
    let n = norm(n0);
    if (dot(n, sub([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], ctr)) < 0) n = n.map(v => -v);
    if (fl & 16) n = n.map(v => -v);   // inward-facing part (the inside of a nozzle)
    T.push([a, b, c, n, f, fl & 15, COLS.indexOf(col || 'hull'), vn || [n, n, n]]);
  }
  function fan(pts, ctr, fl, col) { fid++; const m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]); pts.forEach((p, i) => tri(m, p, pts[(i + 1) % pts.length], ctr, fid, fl, col)); }

  // tube along x through sections [x, cy, cz, ry, rz]; o: n sides, rot, xf, fl, col, inward,
  // w (per-section glow for exhaust), cap0/cap1 flags (false = open) with col0/col1
  function loft(secs, o = {}) {
    const n = o.n || 10, rot = o.rot || 0, xf = o.xf || id, fl = (o.fl || 0) | (o.inward ? 16 : 0), sm = fl & SMOOTH;
    const rings = secs.map(([x, cy, cz, ry_, rz_]) => Array.from({ length: n }, (_, k) => {
      const a = rot + k * 2 * Math.PI / n;
      return xf([x, cy + ry_ * Math.sin(a), cz + rz_ * Math.cos(a)]);
    }));
    const nrm = secs.map(([, , , ry_, rz_], i) => Array.from({ length: n }, (_, k) => {
      if (o.w) return [o.w[i], 0, 0];
      const a = rot + k * 2 * Math.PI / n, v = norm(app(xf.R, [0, Math.sin(a) / (ry_ || 1e-3), Math.cos(a) / (rz_ || 1e-3)]));
      return o.inward ? v.map(q => -q) : v;
    }));
    const mid = secs.reduce((s, q) => [s[0] + q[0] / secs.length, s[1] + q[1] / secs.length, s[2] + q[2] / secs.length], [0, 0, 0]);
    if (sm || o.w) fid++;
    for (let i = 0; i < secs.length - 1; i++) {
      const c = xf([(secs[i][0] + secs[i + 1][0]) / 2, (secs[i][1] + secs[i + 1][1]) / 2, (secs[i][2] + secs[i + 1][2]) / 2]);
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, A = rings[i][k], Bq = rings[i + 1][k], Cq = rings[i + 1][k1], D = rings[i][k1];
        if (!sm && !o.w) fid++;
        const s = sm || o.w;
        tri(A, Bq, Cq, c, fid, fl, o.col, s && [nrm[i][k], nrm[i + 1][k], nrm[i + 1][k1]]);
        tri(A, Cq, D, c, fid, fl, o.col, s && [nrm[i][k], nrm[i + 1][k1], nrm[i][k1]]);
      }
    }
    const C = xf(mid), cf = fl & ~SMOOTH & ~16;
    if (o.cap0 !== false && !o.w) fan(rings[0], C, o.cap0 || cf, o.col0 || o.col);
    if (o.cap1 !== false && !o.w) fan(rings[rings.length - 1], C, o.cap1 || cf, o.col1 || o.col);
  }
  // polygon [[x, z]...] extruded from y0 to y1; top shrunk by `inset` towards its centre (bevel)
  function ext(poly, y0, y1, o = {}) {
    const xf = o.xf || id, fl = o.fl || 0, k = 1 - (o.inset || 0);
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const bot = poly.map(([x, z]) => xf([x, y0, z]));
    const top = poly.map(([x, z]) => xf([cx + (x - cx) * k, y1, cz + (z - cz) * k]));
    const C = xf([cx, (y0 + y1) / 2, cz]);
    poly.forEach((_, i) => { const j = (i + 1) % poly.length; fid++; tri(bot[i], bot[j], top[j], C, fid, o.side || fl, o.col); tri(bot[i], top[j], top[i], C, fid, o.side || fl, o.col); });
    fan(top, C, o.top || fl, o.col); fan(bot, C, fl, o.col);
  }
  const box = (x0, x1, y0, y1, z0, z1, o) => ext([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y1, o);
  const both = f => { f(1); f(-1); };
  // a nozzle facing aft (-x) with its rim at x: outer bell, dark inner wall, glowing disc set
  // back inside, and an exhaust cone behind it
  function engine(x, y, z, r, len, col, xf = id) {
    const place = q => xf([q[0], q[1] + y, q[2] + z]); place.R = xf.R;
    loft([[x, 0, 0, r, r], [x + len * 0.35, 0, 0, r * 1.02, r * 1.02], [x + len, 0, 0, r * 0.8, r * 0.8]], { n: 14, xf: place, fl: SMOOTH, col: 'hullDark', cap0: false });
    loft([[x + 0.01, 0, 0, r * 0.88, r * 0.88], [x + len * 0.5, 0, 0, r * 0.78, r * 0.78]], { n: 14, xf: place, inward: true, fl: DARK, col: 'hullDark', cap0: false, cap1: false });
    fan(Array.from({ length: 14 }, (_, k) => { const a = k * 2 * Math.PI / 14; return place([x + len * 0.5, r * 0.78 * Math.sin(a), r * 0.78 * Math.cos(a)]); }), place([x + len, 0, 0]), EMIT, col);
    loft([[x + len * 0.45, 0, 0, r * 0.7, r * 0.7], [x - r * 1.5, 0, 0, r * 0.45, r * 0.45], [x - r * 4.5, 0, 0, 0.02, 0.02]], { n: 10, xf: place, fl: EXH, col, w: [1, 0.6, 0] });
  }
  const gun = (x0, x1, y, z, r, xf = id) => { const pl = q => xf([q[0], q[1] + y, q[2] + z]); pl.R = xf.R; loft([[x0, 0, 0, r, r], [x1, 0, 0, r, r], [x1 + r * 3, 0, 0, r * 0.6, r * 0.6]], { n: 6, xf: pl, col: 'hullDark' }); };
  const dots = (pts, s, col, xf) => pts.forEach(([x, y, z]) => box(x - s, x + s, y - s * 0.7, y + s * 0.7, z - s, z + s, { fl: EMIT, col, xf }));

  // ---------- ships: the famous ones ----------
  // sphere (or a sphere with a round hole at local +x, from polar angle th0) with normals from its
  // centre: a SMOOTH loft has cylinder normals, so its poles shade flat
  function orb(R, o = {}) {
    const n = o.n || 16, m = o.m || 10, th0 = o.th0 || 0, xf = o.xf || id, fl = (o.fl || 0) | SMOOTH;
    const P = (i, k) => { const t = th0 + (Math.PI - th0) * i / m, a = k * 2 * Math.PI / n; return [Math.cos(t), Math.sin(t) * Math.sin(a), Math.sin(t) * Math.cos(a)]; };
    const C = xf([0, 0, 0]);
    fid++;
    for (let i = 0; i < m; i++) for (let k = 0; k < n; k++) {
      const q = [P(i, k), P(i + 1, k), P(i + 1, k + 1), P(i, k + 1)], w = q.map(v => xf(v.map(c => c * R))), vn = q.map(v => app(xf.R, v));
      tri(w[0], w[1], w[2], C, fid, fl, o.col, [vn[0], vn[1], vn[2]]);
      tri(w[0], w[2], w[3], C, fid, fl, o.col, [vn[0], vn[2], vn[3]]);
    }
  }
  // flat bar of width w from p to q ([x, z] in the part's plane), extruded y0..y1
  const bar = (p, q, w, y0, y1, o) => { const d = norm([q[1] - p[1], 0, p[0] - q[0]]), h = w / 2; ext([[p[0] + d[0] * h, p[1] + d[2] * h], [q[0] + d[0] * h, q[1] + d[2] * h], [q[0] - d[0] * h, q[1] - d[2] * h], [p[0] - d[0] * h, p[1] - d[2] * h]], y0, y1, o); };
  // chain two placements: A after B
  const comp = (A, B) => { const f = p => A(B(p)); f.R = mul(A.R, B.R); return f; };
  // seeded random (each ship sets sd), so the greebles are the same on every build
  let sd = 1;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const rr = (a, b) => a + (b - a) * rnd();
  // detail parts take G: SMOOTH only stops crease edge chars (box normals stay per face), which at
  // this size would turn every greeble into a knot of |/-\
  const G = SMOOTH;
  // greebles: n small boxes standing on the plane y = 0 of xf, inside [x0, x1] x [z0, z1], s wide, up to h tall
  function greeble(n, x0, x1, z0, z1, s, h, xf, col = 'hull') {
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1), z = rr(z0, z1), w = rr(0.3, 1) * s / 2, d = rr(0.3, 1) * s / 2;
      box(x - w, x + w, -h, rr(0.25, 1) * h, z - d, z + d, { xf, fl: G, col: rnd() < 0.3 ? 'hullDark' : col });
    }
  }
  // a part standing on a sphere's surface (centre c, radius R) at polar angle a from +y, azimuth l
  const onBall = (c, R, a, l) => at(c[0] + R * Math.sin(a) * Math.sin(l), c[1] + R * Math.cos(a), c[2] + R * Math.sin(a) * Math.cos(l), a, l, 0);

  // engine light: blue for the Rebels (Falcon, X-wing, Y-wing), red for the Empire (Star Destroyer, TIE)
  const BUILD = {
    // Imperial Star Destroyer: flat hexagonal dagger (16:4:1) with the dark seam round its edge,
    // plated slopes, a trench down the deck, terraced superstructure with turbolaser batteries and
    // window rows, bridge tower with the T-shaped bridge and its two shield domes, ventral hangar,
    // engine block with three big and four small engines
    destroyer() {
      PANEL = 1.6; sd = 11;
      const RY = x => x < -12 ? 1.05 + 0.05 * (-12 - x) / 4 : 1.05 - 0.97 * (x + 12) / 28;
      const RZ = x => x < -12 ? 4.4 + 0.2 * (-12 - x) / 4 : 4.4 - 4.28 * (x + 12) / 28;
      const top = x => 0.866 * RY(x);                 // deck height (flat top of the hex)
      loft([[-16, 0, 0, 1.1, 4.6], [-12, 0, 0, 1.05, 4.4], [16, 0, 0, 0.08, 0.12]], { n: 6 });
      ext([[-16, -4.65], [-12, -4.45], [16, -0.16], [16, 0.16], [-12, 4.45], [-16, 4.65]], -0.07, 0.07, { fl: DARK, col: 'hullDark' });   // hull seam
      box(0, 13.5, -0.03, 0.03, -0.14, 0.14, { xf: at(-1, top(-1) + 0.01, 0, 0, 0, -Math.atan(0.866 * 0.97 / 28)), fl: DARK, col: 'hullDark' });   // deck trench
      box(-7, 3, -0.2, 0.05, -0.9, 0.9, { xf: at(0, -top(-2), 0), fl: DARK, col: 'hullDark' });   // ventral hangar
      both(s => {
        // plating on the upper slopes: boxes standing on the face, aimed along its normal
        for (let i = 0; i < 110; i++) {
          const x = rr(-12, 12), u = rr(0.12, 0.88), ry_ = RY(x), rz_ = RZ(x), k = Math.min(1, rz_ / 3);
          const w = rr(0.2, 0.9) * k / 2, d = rr(0.12, 0.45) * k / 2;
          box(-w, w, -0.1, rr(0.04, 0.16), -d, d, { xf: at(x, 0.866 * ry_ * (1 - u), (rz_ / 2) * (1 + u) * s, Math.atan2(0.866 * ry_, rz_ / 2) * s), fl: G, col: rnd() < 0.3 ? 'hullDark' : 'hull' });
        }
        [-1, 3, 7].forEach(x => { const z = (2.2 - 2.14 * (x + 12) / 28 - 0.35) * s; box(x - 0.3, x + 0.3, top(x) - 0.1, top(x) + 0.25, z - 0.25, z + 0.25, { inset: 0.2 }); gun(x, x + 0.8, top(x) + 0.15, z, 0.05); });
      });
      // terraces, each narrower and shorter towards the stern: [x0, x1, half width at x0, at x1, y0, y1]
      const TER = [[-15.5, -3, 2.8, 0.55, 0.85, 1.6], [-15.2, -7, 2.1, 0.6, 1.6, 2.35], [-14.8, -10, 1.5, 0.6, 2.35, 3.0]];
      TER.forEach(([x0, x1, w0, w1, y0, y1], i) => {
        ext([[x0, -w0], [x1, -w1], [x1, w1], [x0, w0]], y0, y1, { inset: 0.04 + 0.02 * i });
        const w = x => w0 + (w1 - w0) * (x - x0) / (x1 - x0);
        for (let n = 0; n < 34; n++) { const x = rr(x0 + 0.3, x1 - 0.4), z = rr(-0.8, 0.8) * w(x) * 0.85; box(x - 0.12, x + 0.12, y1 - 0.05, y1 + rr(0.03, 0.12), z - 0.12, z + 0.12, { fl: G, col: rnd() < 0.3 ? 'hullDark' : 'hull' }); }
        both(s => {
          for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.32) dots([[x, (y0 + y1) / 2, (w(x) - 0.03) * s]], 0.045, 'window');   // window row
          if (i < 2) for (let x = x0 + 1.2; x < x1 - 1; x += 2.2) { const z = w(x) * 0.8 * s; box(x - 0.35, x + 0.35, y1, y1 + 0.22, z - 0.28, z + 0.28, { inset: 0.2 }); gun(x, x + 1.0, y1 + 0.15, z - 0.1, 0.05); gun(x, x + 1.0, y1 + 0.15, z + 0.1, 0.05); }
        });
      });
      box(-14.1, -12.6, 3.0, 4.7, -0.38, 0.38, { inset: 0.05 });                 // tower neck
      both(s => ext([[-14.4, 0.38 * s], [-12.8, 0.38 * s], [-13.3, 1.1 * s], [-14.4, 1.1 * s]], 3.0, 3.6, { inset: 0.1 }));   // neck shoulders
      box(-14.5, -12.3, 4.7, 5.35, -2.4, 2.4, { inset: 0.04 });                  // the T bridge
      box(-12.32, -12.28, 4.88, 5.08, -2.2, 2.2, { fl: EMIT, col: 'window' });   // bridge windows
      box(-14.2, -12.9, 5.35, 5.42, -0.5, 0.5, { fl: EMIT, col: 'window' });    // lit band on top
      box(-13.9, -13.6, 5.35, 6.4, -0.04, 0.04); box(-13.3, -13.2, 5.35, 6.0, 0.3, 0.36);   // masts
      both(s => {
        box(-13.7, -13.5, 5.35, 5.75, 1.7 * s - 0.08, 1.7 * s + 0.08);
        orb(0.5, { n: 12, m: 7, xf: at(-13.6, 6.15, 1.7 * s) });                // shield domes
      });
      box(-16.9, -14.5, -0.85, 1.75, -4.1, 4.1, { inset: 0.04 });               // engine block
      greeble(18, -16.6, -14.8, -3.8, 3.8, 0.45, 0.1, at(0, 1.75, 0));
      [-2.15, 0, 2.15].forEach(z => engine(-17.3, 0.45, z, 0.95, 1.0, 'red'));
      both(s => { engine(-17.0, -0.4, 3.65 * s, 0.36, 0.5, 'red'); engine(-17.0, 1.3, 3.65 * s, 0.36, 0.5, 'red'); });
    },
    // Millennium Falcon: flat saucer with radial ribs and plated rings, the two forward mandibles
    // and the slot between them, cockpit tube on the starboard side, quad gun turrets top and
    // bottom, radar dish, docking ports, a wide band of engine glow along the rear arc
    falcon() {
      PANEL = 0.7; sd = 5;
      const up = at(0, 0, 0, 0, 0, Math.PI / 2);   // loft along x -> along y: a horizontal disc
      loft([[-0.5, 0, 0, 3.0, 3.0], [-0.25, 0, 0, 4.4, 4.4], [0.15, 0, 0, 4.5, 4.5], [0.35, 0, 0, 4.25, 4.25], [0.55, 0, 0, 3.0, 3.0], [0.62, 0, 0, 1.6, 1.6]], { n: 28, xf: up });   // flat facets: a SMOOTH loft would shade the top like a wall
      loft([[0.6, 0, 0, 1.3, 1.3], [0.85, 0, 0, 1.0, 1.0], [0.95, 0, 0, 0.5, 0.5]], { n: 18, xf: up });   // turret hump
      // ribs down the sloping rim, everywhere but the mandibles and the cockpit corridor
      const slope = Math.atan2(0.2, 1.25);
      for (let d = 0; d < 360; d += 12) {
        if (d < 42 || d > 318 || (d > 52 && d < 100)) continue;
        const f = d * Math.PI / 180, xf = comp(at(0, 0, 0, 0, -f, 0), at(3.0, 0.55, 0, 0, 0, -slope));
        box(0, 1.27, -0.04, 0.09, -0.06, 0.06, { xf, fl: G, col: d % 24 ? 'hull' : 'hullDark' });
        if (d % 24) box(0.15, 1.1, -0.04, 0.03, 0.12, 0.5, { xf, fl: DARK | G, col: 'hullDark' });   // recessed panel between ribs
      }
      for (let i = 0; i < 70; i++) {             // plating on the inner ring
        const f = rr(0.5, 2 * Math.PI - 0.5), r = rr(1.75, 2.9), w = rr(0.12, 0.35), d = rr(0.08, 0.25);
        box(-w, w, -0.06, rr(0.03, 0.12), -d, d, { xf: at(r * Math.cos(f), 0.6, r * Math.sin(f), 0, -f, 0), fl: G, col: rnd() < 0.35 ? 'hullDark' : 'hull' });
      }
      // quad laser turrets, dorsal and ventral
      both(s => {
        orb(0.36, { n: 12, m: 7, xf: at(0, s > 0 ? 1.0 : -0.55, 0) });
        both(t => gun(0.15, 1.15, (s > 0 ? 1.0 : -0.55) + 0.06 * t, 0.12, 0.035)); both(t => gun(0.15, 1.15, (s > 0 ? 1.0 : -0.55) + 0.06 * t, -0.12, 0.035));
      });
      both(s => {
        ext([[2.0, 0.32 * s], [6.3, 0.32 * s], [6.3, 0.95 * s], [4.7, 1.6 * s], [2.0, 1.6 * s]], -0.3, 0.3, { inset: 0.04 });   // mandibles
        greeble(14, 2.6, 5.9, 0.45 * s, 0.9 * s, 0.3, 0.08, at(0, 0.29, 0));
        box(5.9, 6.45, -0.18, 0.18, 0.4 * s, 0.85 * s, { col: 'hullDark' });   // power couplings at the tips
        box(6.2, 6.55, -0.08, 0.08, 0.5 * s, 0.6 * s);
        // docking ports: short tubes out of each flank
        loft([[0, 0, 0, 0.42, 0.42], [0.7, 0, 0, 0.42, 0.42], [0.8, 0, 0, 0.3, 0.3]], { n: 12, fl: SMOOTH, xf: at(-0.3, 0, 4.0 * s, 0, -Math.PI / 2 * s, 0), col1: 'hullDark' });
      });
      box(2.4, 4.6, -0.46, 0.5, -0.3, 0.3, { fl: DARK, col: 'hullDark' });      // the slot between the mandibles
      // cockpit: corridor tube out of the starboard rim, framed glass at its tip
      loft([[0.6, 0.05, 3.85, 0.42, 0.42], [3.4, 0.05, 3.85, 0.42, 0.42], [3.9, 0.05, 3.85, 0.34, 0.34]], { n: 12, fl: SMOOTH, cap0: false });
      [1.4, 2.2, 3.0].forEach(x => loft([[x, 0.05, 3.85, 0.45, 0.45], [x + 0.12, 0.05, 3.85, 0.45, 0.45]], { n: 12, col: 'hullDark', cap0: false, cap1: false }));
      loft([[3.88, 0.05, 3.85, 0.35, 0.35], [4.25, 0.05, 3.85, 0.24, 0.24], [4.45, 0.05, 3.85, 0.04, 0.04]], { n: 12, fl: SMOOTH, col: 'glass' });
      [4.02, 4.18, 4.32].forEach((x, i) => loft([[x, 0.05, 3.85, 0.31 - i * 0.07, 0.31 - i * 0.07], [x + 0.03, 0.05, 3.85, 0.3 - i * 0.07, 0.3 - i * 0.07]], { n: 12, col: 'hullDark', cap0: false, cap1: false }));
      // radar dish on a mast, port side forward
      box(1.4, 1.6, 0.4, 1.0, -1.5, -1.3);
      loft([[0, 0, 0, 0.05, 0.05], [0.12, 0, 0, 0.6, 0.6], [0.16, 0, 0, 0.65, 0.65]], { n: 14, xf: at(1.6, 1.15, -1.4, 0, 0, 1.0) });
      box(-2.6, 0.8, 0.5, 0.62, -0.25, 0.25, { col: 'hullDark' });               // spine plating
      // engine band: nozzles along the rear rim in a dark recess, each aimed out along its radius
      for (let i = 0; i < 9; i++) { const f = Math.PI + (i - 4) * 0.115; engine(0, 0, 0, 0.3, 0.3, 'glowBlue', at(4.25 * Math.cos(f), 0, 4.25 * Math.sin(f), 0, Math.PI - f, 0)); }
    },
    // TIE Fighter (TIE/ln): ball cockpit with the raised eight-spoked window, top hatch, chin guns,
    // pylon plates and the twin engine housing at the back; tapered pylons; two tall hexagonal
    // solar panels, each folded along its midline so top and bottom lean in towards the ball:
    // near-black cells with fine lines, a light frame and six spars, a hexagonal hub outside
    tie() {
      PANEL = 0.3; sd = 3;
      const H = 2.7, W = 2.4, FOLD = 0.1;
      orb(1, { n: 20, m: 12 });
      loft([[0.84, 0, 0, 0.6, 0.6], [1.0, 0, 0, 0.52, 0.52]], { n: 8, rot: Math.PI / 8, col: 'glass' });   // window
      loft([[0.86, 0, 0, 0.66, 0.66], [1.05, 0, 0, 0.57, 0.57]], { n: 16, col: 'hullDark', cap0: false, cap1: false });   // its raised frame
      for (let i = 0; i < 4; i++) box(1.0, 1.05, -0.025, 0.025, -0.53, 0.53, { xf: at(0, 0, 0, i * Math.PI / 4), col: 'hullDark' });   // spokes
      orb(0.1, { n: 8, m: 5, col: 'hullDark', xf: at(1.04, 0, 0) });
      loft([[0, 0, 0, 0.4, 0.4], [0.1, 0, 0, 0.34, 0.34]], { n: 14, xf: at(0, 0.94, 0, 0, 0, Math.PI / 2), col: 'hullDark' });   // top hatch
      box(-1.02, -0.78, -0.3, 0.06, -0.34, 0.34, { col: 'hullDark', inset: 0.1 });   // engine housing
      both(s => {
        gun(0.55, 1.18, -0.62, 0.2 * s, 0.05);                                    // chin guns
        engine(-1.06, -0.12, 0.16 * s, 0.11, 0.15, 'red');
        loft([[0, 0, 0, 0.42, 0.42], [0.08, 0, 0, 0.36, 0.36]], { n: 16, xf: at(0, 0, 0.92 * s, 0, -Math.PI / 2 * s, 0), col: 'hullDark' });   // pylon plate
        ext([[-0.28, 0.85 * s], [0.28, 0.85 * s], [0.5, W * s], [-0.5, W * s]], -0.16, 0.16, { inset: 0.04 });   // pylon, wider at the wing
        loft([[0, 0, 0, 0.3, 0.3], [0.2, 0, 0, 0.3, 0.3]], { n: 10, xf: at(0, 0, 0.95 * s, 0, -Math.PI / 2 * s, 0), col: 'hullDark' });   // collar
        loft([[-0.12, 0, 0, 0.5, 0.5], [0.12, 0, 0, 0.47, 0.47], [0.2, 0, 0, 0.32, 0.32]], { n: 6, rot: Math.PI / 2, xf: at(0, 0, W * s, 0, -Math.PI / 2 * s, 0) });   // hub
        // the two halves of the panel, top (h = 1) and bottom, folded about the midline
        const half = k => [[0.866 * k * H, 0], [0.866 * k * H, 0.5 * k * H], [0, k * H], [-0.866 * k * H, 0.5 * k * H], [-0.866 * k * H, 0]];
        both(h => {
          const xf = at(0, 0, W * s, Math.PI / 2 - h * FOLD * s), P = k => half(k).map(([x, v]) => [x, -h * v]);   // local (x, -v) -> world (x, v)
          ext(P(1), -0.045, 0.045, { xf, fl: DARK, col: 'hullDark' });          // cells
          [0.32, 0.52, 0.72, 0.88].forEach(k => { const Q = P(k); for (let j = 0; j < 4; j++) bar(Q[j], Q[j + 1], 0.035, -0.06, 0.06, { xf, fl: G, col: 'hullDark' }); });   // cell lines
          const Q = P(1);
          for (let j = 0; j < 4; j++) bar(Q[j], Q[j + 1], 0.16, -0.08, 0.08, { xf });   // frame
          [1, 2, 3].forEach(j => bar([0, 0], Q[j], 0.1, -0.075, 0.075, { xf }));        // spars to the corners
        });
      });
    },
    // X-wing (T-65): long chamfered fuselage whose nose drops to a low tip, framed canopy and
    // astromech, four wings in a shallow X (s-foils open about 14 degrees) with red squadron
    // stripes, a big intake-and-nozzle engine at each wing root (the upper and lower pair almost
    // touching), long cannons with cooling sleeves and flash suppressors at the tips
    xwing() {
      PANEL = 0.8; sd = 7;
      const CANT = 0.25;
      // fuselage: octagon (flat top, bottom and sides, chamfered corners)
      loft([[-4.6, 0, 0, 0.52, 0.62], [-3.6, 0.02, 0, 0.6, 0.7], [-0.6, 0.05, 0, 0.62, 0.68], [1.5, -0.02, 0, 0.5, 0.55], [4.5, -0.12, 0, 0.31, 0.38], [7.2, -0.2, 0, 0.15, 0.2], [8.0, -0.22, 0, 0.07, 0.1]], { n: 8, rot: Math.PI / 8 });
      loft([[7.95, -0.22, 0, 0.08, 0.11], [8.25, -0.23, 0, 0.03, 0.04]], { n: 8, rot: Math.PI / 8, col: 'hullDark' });   // nose cone
      both(s => {
        bar([1.6, 0.53 * s], [6.6, 0.24 * s], 0.05, -0.2, -0.1, { fl: DARK | G, col: 'hullDark' });   // nose side seam
        bar([2.2, 0.5 * s], [3.6, 0.42 * s], 0.06, -0.05, 0.1, { col: 'red' });                        // squadron flash
        greeble(9, -4.3, -1.0, -0.3, 0.3, 0.3, 0.05, at(0, 0, 0.62 * s, Math.PI / 2 * s));
      });
      greeble(10, 0.2, 3.3, -0.1, 0.1, 0.25, 0.04, at(2.0, 0.38, 0, 0, 0, -0.085));   // nose top panels, on the slope
      greeble(12, -4.4, -2.4, -0.4, 0.4, 0.3, 0.06, at(0, 0.57, 0));                // rear deck
      box(-4.66, -4.58, -0.35, 0.4, -0.45, 0.45, { col: 'hullDark' });             // tail plate
      // canopy: glass bubble with three frames, astromech in its socket behind
      loft([[-0.9, 0.52, 0, 0.05, 0.1], [-0.2, 0.68, 0, 0.3, 0.36], [0.9, 0.6, 0, 0.25, 0.32], [1.7, 0.44, 0, 0.04, 0.08]], { n: 12, fl: SMOOTH, col: 'glass' });
      [[-0.35, 0.99], [0.3, 0.97], [0.95, 0.85]].forEach(([x, y]) => box(x, x + 0.06, 0.5, y, -0.37, 0.37, { col: 'hullDark' }));
      box(-2.1, -1.15, 0.6, 0.7, -0.4, 0.4, { col: 'hullDark' });
      orb(0.33, { n: 12, m: 7, col: 'blue', xf: at(-1.62, 0.7, 0) });            // astromech dome
      both(s => both(t => {
        const xf = at(0, 0.22 * t, 0, -CANT * t * s);   // cant: top wings tip up, bottom ones down
        ext([[-4.3, 0.45 * s], [-1.7, 0.45 * s], [-2.35, 5.3 * s], [-3.95, 5.3 * s]], -0.06, 0.06, { xf, inset: 0.02 });
        ext([[-4.3, 0.6 * s], [-4.0, 0.6 * s], [-3.92, 5.2 * s], [-3.95, 5.2 * s]], -0.065, 0.065, { xf, col: 'hullDark' });   // trailing edge flap
        box(-4.08, -2.12, -0.07, 0.07, 3.15 * s, 3.65 * s, { xf, col: 'red' });
        box(-3.98, -2.25, -0.068, 0.068, 4.35 * s, 4.5 * s, { xf, col: 'red' });
        box(-3.9, -2.9, -0.14, 0.14, 0.4 * s, 0.68 * s, { xf, col: 'hullDark' });   // s-foil actuator
        // engine: nacelle with an intake lip and bands, nozzle at the back
        const ez = 1.2 * s;
        loft([[-4.45, 0, ez, 0.44, 0.44], [-3.6, 0, ez, 0.47, 0.47], [-0.4, 0, ez, 0.47, 0.47], [0.15, 0, ez, 0.43, 0.43]], { n: 14, fl: SMOOTH, xf, cap0: false, cap1: false });
        loft([[0.15, 0, ez, 0.45, 0.45], [0.4, 0, ez, 0.42, 0.42]], { n: 14, fl: SMOOTH, xf, col: 'hullDark', cap0: false, cap1: DARK, col1: 'hullDark' });   // intake
        [-3.3, -2.1, -0.9].forEach(x => loft([[x, 0, ez, 0.5, 0.5], [x + 0.14, 0, ez, 0.5, 0.5]], { n: 14, xf, col: 'hullDark', cap0: false, cap1: false }));
        engine(-4.8, 0, ez, 0.4, 0.42, 'glowBlue', xf);
        // wingtip cannon: mount, cooling sleeve, barrel, flash suppressor
        const cz = 5.42 * s;
        box(-4.05, -2.2, -0.11, 0.11, 5.2 * s, 5.4 * s, { xf, inset: 0.1 });
        loft([[-4.1, 0, cz, 0.13, 0.13], [-1.6, 0, cz, 0.13, 0.13]], { n: 8, xf, col: 'hullDark' });
        [-3.4, -2.8, -2.2].forEach(x => loft([[x, 0, cz, 0.16, 0.16], [x + 0.18, 0, cz, 0.16, 0.16]], { n: 8, xf, cap0: false, cap1: false }));
        loft([[-1.6, 0, cz, 0.06, 0.06], [2.6, 0, cz, 0.055, 0.055]], { n: 6, xf, col: 'hullDark' });
        loft([[2.6, 0, cz, 0.1, 0.1], [3.0, 0, cz, 0.1, 0.1], [3.1, 0, cz, 0.05, 0.05]], { n: 6, xf, col: 'hullDark' });
      }));
    },
    // Y-wing: long cockpit nose with twin cannons, framed canopy and ion turret, an open neck full
    // of machinery, crossbar holding two banded engine nacelles with striped intake domes in front
    // and the exhaust at the back
    ywing() {
      PANEL = 0.9; sd = 9;
      loft([[1.4, 0, 0, 0.7, 0.9], [4, 0.05, 0, 0.72, 0.92], [6.6, -0.05, 0, 0.45, 0.6], [8.4, -0.15, 0, 0.12, 0.18]], { n: 8, rot: Math.PI / 8 });
      loft([[3.2, 0.5, 0, 0.05, 0.1], [3.9, 0.7, 0, 0.32, 0.45], [5.2, 0.55, 0, 0.22, 0.35], [6.0, 0.35, 0, 0.04, 0.06]], { n: 10, fl: SMOOTH, col: 'glass' });
      [4.2, 4.9].forEach(x => box(x, x + 0.07, 0.4, x < 4.5 ? 1.0 : 0.85, -0.45, 0.45, { col: 'hullDark' }));   // canopy frame
      greeble(10, 6.0, 7.6, -0.3, 0.3, 0.3, 0.05, at(0, 0.36, 0));
      both(s => { gun(7.0, 8.7, -0.25, 0.38 * s, 0.05); bar([1.8, 0.845 * s], [6.2, 0.615 * s], 0.06, -0.1, 0.02, { fl: DARK, col: 'hullDark' }); });
      orb(0.24, { n: 10, m: 6, xf: at(2.9, 0.72, 0) });                         // ion turret
      both(s => gun(2.9, 3.7, 0.82, 0.08 * s, 0.035));
      orb(0.3, { n: 12, m: 7, xf: at(2.1, 0.62, 0) });                          // astromech dome
      // the open neck: frame, pipes and boxes
      box(-1.4, 1.5, -0.32, 0.32, -0.38, 0.38, { col: 'hullDark' });
      box(-1.0, 1.4, 0.32, 0.4, -0.15, 0.15, { col: 'hullDark' });
      for (let i = 0; i < 8; i++) { const y = rr(-0.3, 0.3), z = rr(-0.5, 0.5), r = rr(0.04, 0.08); loft([[-1.4, y, z, r, r], [1.5, y, z, r, r]], { n: 6 }); }
      greeble(14, -1.3, 1.3, -0.4, 0.4, 0.3, 0.08, at(0, 0.4, 0), 'hullDark');
      both(s => greeble(10, -1.3, 1.3, -0.25, 0.25, 0.3, 0.08, at(0, 0, 0.42 * s, Math.PI / 2 * s), 'hullDark'));
      ext([[-2.3, -3.4], [-0.6, -3.4], [-0.6, 3.4], [-2.3, 3.4]], -0.17, 0.17, { inset: 0.03 });   // crossbar
      box(-2.0, -0.6, -0.4, 0.4, -0.5, 0.5, { inset: 0.1 });
      greeble(16, -2.1, -0.8, -2.6, 2.6, 0.3, 0.06, at(0, 0.17, 0));
      both(s => {
        const z = 3.4 * s;
        loft([[-7.4, 0, z, 0.55, 0.55], [-1, 0, z, 0.6, 0.6], [2.8, 0, z, 0.6, 0.6], [3.2, 0, z, 0.72, 0.72], [4.1, 0, z, 0.62, 0.62], [4.6, 0, z, 0.25, 0.25]], { n: 14, fl: SMOOTH, cap0: false });
        [[3.25, 3.55, 0.75], [3.72, 3.88, 0.7]].forEach(([a, b, r]) => loft([[a, 0, z, r, r], [b, 0, z, r, r]], { n: 14, fl: SMOOTH, col: 'red', cap0: false, cap1: false }));   // intake stripes
        [-6.6, -5.0, -3.4, 0.4, 1.8].forEach(x => loft([[x, 0, z, 0.64, 0.64], [x + 0.16, 0, z, 0.64, 0.64]], { n: 14, col: 'hullDark', cap0: false, cap1: false }));   // bands
        loft([[-7.75, 0, z, 0.66, 0.66], [-7.45, 0, z, 0.66, 0.66]], { n: 14, col: 'hullDark', cap0: false, cap1: false });   // vectral ring
        greeble(8, -6.4, -1.2, -0.25, 0.25, 0.3, 0.06, at(0, 0.58, z));
        engine(-7.8, 0, z, 0.48, 0.45, 'glowBlue');
        both(t => ext([[-7.2, 0], [-5.6, 0], [-6.4, 0.75], [-7.3, 0.75]], -0.05, 0.05, { xf: at(0, 0.5 * t, z, -Math.PI / 2 * t) }));   // rear fins
      });
    },
    // Death Star: battle station sphere covered in city, the superlaser dish (lip, tributary
    // emitters, focus lens) sunk into the northern hemisphere, the equatorial trench, city lights
    deathstar() {
      PANEL = 1.1; sd = 13;
      const R = 9, th0 = 0.3, xf = at(0, 0, 0, 0, -Math.PI / 3, Math.PI / 2);   // dish axis: 30 degrees north, facing +z
      const dish = app(xf.R, [1, 0, 0]);
      orb(R, { n: 40, m: 24, th0, xf });
      const xr = R * Math.cos(th0), rr_ = R * Math.sin(th0);
      loft([[xr, 0, 0, rr_, rr_], [xr - 0.35, 0, 0, rr_ * 0.55, rr_ * 0.55], [xr - 0.5, 0, 0, 0.15, 0.15]], { n: 24, xf, inward: true, fl: DARK, col: 'hullDark', cap1: false });
      loft([[xr - 0.12, 0, 0, rr_ + 0.12, rr_ + 0.12], [xr + 0.12, 0, 0, rr_ + 0.05, rr_ + 0.05]], { n: 24, xf, col: 'hullDark', cap0: false, cap1: false });   // lip
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(-0.12, 0.12, -0.12, 0.12, -0.12, 0.12, { xf: comp(xf, at(xr - 0.175, rr_ * 0.775 * Math.sin(a), rr_ * 0.775 * Math.cos(a))), col: 'hull' }); }   // tributary emitters
      orb(0.3, { n: 8, m: 5, xf: at(...xf([xr - 0.5, 0, 0])), col: 'hullDark' });   // focus lens
      loft([[-0.2, 0, 0, R + 0.06, R + 0.06], [0.2, 0, 0, R + 0.06, R + 0.06]], { n: 48, fl: DARK, col: 'hullDark', xf: at(0, 0, 0, 0, 0, Math.PI / 2), cap0: false, cap1: false });   // trench
      // city: blocks standing on the surface, towers along the trench, a scatter of lights
      for (let i = 0; i < 420; i++) {
        const a = Math.acos(rr(-1, 1)), l = rr(0, 2 * Math.PI), n = [Math.sin(a) * Math.sin(l), Math.cos(a), Math.sin(a) * Math.cos(l)];
        if (dot(n, dish) > Math.cos(th0 + 0.06) || Math.abs(n[1]) < 0.03) continue;
        const w = rr(0.12, 0.45), d = rr(0.12, 0.45);
        box(-w, w, -0.08, rr(0.04, 0.22), -d, d, { xf: onBall([0, 0, 0], R, a, l), fl: G, col: rnd() < 0.35 ? 'hullDark' : 'hull' });
      }
      for (let l = 0; l < 2 * Math.PI; l += 0.11) both(s => box(-0.1, 0.1, -0.05, rr(0.12, 0.35), -0.08, 0.08, { xf: onBall([0, 0, 0], R, Math.PI / 2 - 0.04 * s, l + rr(-0.03, 0.03)), fl: G }));
      for (let i = 0; i < 90; i++) {
        const a = Math.acos(rr(-1, 1)), l = rr(0, 2 * Math.PI), n = [Math.sin(a) * Math.sin(l), Math.cos(a), Math.sin(a) * Math.cos(l)];
        if (dot(n, dish) > Math.cos(th0 + 0.06) || Math.abs(n[1]) < 0.03) continue;
        dots([[0, 0.03, 0]], 0.06, 'window', onBall([0, 0, 0], R, a, l));
      }
    },
  };
  const MESH = {};
  function mesh(kind) {
    if (MESH[kind]) return MESH[kind];
    T = []; fid = 0; PANEL = 1; BUILD[kind]();
    const n = T.length, p = new Float32Array(n * 9), nr = new Float32Array(n * 3), vn = new Float32Array(n * 9), f = new Int32Array(n), fl = new Uint8Array(n), fc = new Uint8Array(fid + 1), ff = new Uint8Array(fid + 1);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    T.forEach((t, i) => {
      for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) { p[i * 9 + v * 3 + c] = t[v][c]; vn[i * 9 + v * 3 + c] = t[7][v][c]; }
      for (let c = 0; c < 3; c++) nr[i * 3 + c] = t[3][c];
      f[i] = t[4]; fl[i] = t[5]; fc[t[4]] = t[6]; ff[t[4]] = t[5];
      if (!(t[5] & EXH)) for (let v = 0; v < 3; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], t[v][c]); hi[c] = Math.max(hi[c], t[v][c]); }
    });
    return (MESH[kind] = { n, p, nr, vn, f, fl, fc, ff, panel: PANEL, faces: fid + 1, len: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) });   // len: largest extent
  }

  // node: the terminal harness only needs the mesh side
  if (typeof window === 'undefined') { module.exports = { BUILD, mesh, PALETTE, COLS, RAMP, EDGES, FIRE, AMB, DIF, RIM, GAMMA, LIGHT, CREASE, LEVELS, TONE, norm, sub, add, cross, dot, mul, rx, ry, rz, app }; return; }

  // ---------- glyphs ----------
  // cells keep their exact css size: cell c spans device px floor(c * cwF) .. floor((c + 1) * cwF),
  // as in ascii-pic.js; the glyph masks are drawn once with the avatar's font
  let dpr = 1, cwF = 2.5, chF = 4.375, MW = 4, MH = 6, masks = null, bg = [14, 13, 16], pal = [], light = false;
  function readTheme() {
    const css = getComputedStyle(document.documentElement);
    const rgb = s => { s = s.trim(); const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    light = document.documentElement.dataset.theme === 'light';
    const fg = rgb(css.getPropertyValue('--fg'));
    bg = rgb(css.getPropertyValue('--bg'));
    pal = COLS.map(k => { const c = PALETTE[k][light ? 1 : 0]; return c ? rgb(c) : fg; });
  }
  function buildMasks(scale) {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cwF = CELL_W * scale * dpr; chF = CELL_H * scale * dpr;
    MW = Math.ceil(cwF) + 1; MH = Math.ceil(chF) + 1;
    const c = document.createElement('canvas'); c.width = MW; c.height = MH;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = `600 ${CELL_H * scale * 0.95 * dpr}px 'JetBrains Mono', monospace`;
    x.fillStyle = '#fff';
    masks = {};
    for (const g of RAMP + EDGES + FIRE) {
      x.clearRect(0, 0, MW, MH); x.fillText(g, 0, chF * 0.8);
      const d = x.getImageData(0, 0, MW, MH).data, m = new Uint8Array(MW * MH);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
      masks[g] = m;
    }
  }

  // ---------- rasterizer ----------
  const hash = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  let F = 1000;                            // focal length, css px
  // a job: yields often so a big ship can be spread over frames.
  // R: ship->world rotation, C: world position of the ship's origin, k: world units per ship unit,
  // buf: the ship's scratch buffers, cvs: its sprite. Returns the sprite and where C lands in it (device px)
  function* render(kind, R, C, k, buf, cvs, flick = 1) {
    const m = mesh(kind), P = m.p, N = m.n, Fd = F * dpr;
    buf.stage = 'setup';
    if (!buf.V || buf.V.length < N * 9) { buf.V = new Float32Array(N * 9); buf.fn = new Float32Array(m.faces * 3); }   // reused: less garbage
    const V = buf.V, cx0 = Fd * C[0] / C[2], cy0 = Fd * C[1] / C[2];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < N * 3; i++) {
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const Z = Math.max(0.5, C[2] + k * (R[2][0] * px + R[2][1] * py + R[2][2] * pz));
      const X = Fd * (C[0] + k * (R[0][0] * px + R[0][1] * py + R[0][2] * pz)) / Z - cx0;
      const Y = Fd * (C[1] + k * (R[1][0] * px + R[1][1] * py + R[1][2] * pz)) / Z - cy0;
      V[i * 3] = X; V[i * 3 + 1] = Y; V[i * 3 + 2] = Z;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    const ox = x0 - cwF, oy = y0 - chF;
    const cols = Math.ceil((x1 - x0) / cwF) + 2, rows = Math.ceil((y1 - y0) / chF) + 2, nc = cols * rows;
    const SX = nc > CELL_CAP[1] ? 1 : 2, SY = nc > CELL_CAP[1] ? 1 : nc > CELL_CAP[0] ? 2 : 3, NS = SX * SY;
    const W = cols * SX, H = rows * SY, sw = cwF / SX, sh = chF / SY;
    if (!buf.zb || buf.zb.length < W * H) { const s = Math.ceil(W * H * 1.6); buf.zb = new Float32Array(s); buf.lb = new Float32Array(s); buf.fb = new Int32Array(s); buf.gb = new Float32Array(s); buf.gc = new Uint8Array(s); }
    const { zb, lb, fb, gb, gc } = buf;
    zb.fill(Infinity, 0, W * H); fb.fill(-1, 0, W * H); gb.fill(0, 0, W * H);
    const fn = buf.fn;
    // panel seams only when a panel spans several cells; narrower than that they turn into noise
    const unitPx = Fd * k / C[2], seam = m.panel * unitPx / cwF > 7 ? Math.max(0.04, 0.6 * cwF / (m.panel * unitPx)) : 0;
    const lv = [0, 0, 0];
    let work = 0;
    for (let pass = 0; pass < 2; pass++) for (let t = 0; t < N; t++) {
      const fl = m.fl[t];
      if (!(fl & EXH) !== !pass) continue;   // hull first, exhaust glow second
      const a = t * 9;
      const n0 = m.nr[t * 3], n1 = m.nr[t * 3 + 1], n2 = m.nr[t * 3 + 2];
      const nx = R[0][0] * n0 + R[0][1] * n1 + R[0][2] * n2, ny = R[1][0] * n0 + R[1][1] * n1 + R[1][2] * n2, nz = R[2][0] * n0 + R[2][1] * n1 + R[2][2] * n2;
      // world view ray to the face (camera at the origin)
      const vx = (V[a] + V[a + 3] + V[a + 6]) / 3 + cx0, vy = (V[a + 1] + V[a + 4] + V[a + 7]) / 3 + cy0, vz = Fd;
      const vl = Math.hypot(vx, vy, vz);
      if (!pass) {
        const facing = -(nx * vx + ny * vy + nz * vz) / vl;
        if (facing < -0.02) continue;
        const fi = m.f[t];
        fn[fi * 3] = nx; fn[fi * 3 + 1] = ny; fn[fi * 3 + 2] = nz;
        for (let v = 0; v < 3; v++) {
          if (fl & EMIT) { lv[v] = 1; continue; }
          const q0 = m.vn[a + v * 3], q1 = m.vn[a + v * 3 + 1], q2 = m.vn[a + v * 3 + 2];
          const wx = R[0][0] * q0 + R[0][1] * q1 + R[0][2] * q2, wy = R[1][0] * q0 + R[1][1] * q1 + R[1][2] * q2, wz = R[2][0] * q0 + R[2][1] * q1 + R[2][2] * q2;
          const fc = Math.max(0, -(wx * vx + wy * vy + wz * vz) / vl);
          lv[v] = (AMB + DIF * Math.max(0, wx * LIGHT[0] + wy * LIGHT[1] + wz * LIGHT[2]) + RIM * (1 - fc) ** 3) * (fl & DARK ? 0.35 : 1);
        }
      } else for (let v = 0; v < 3; v++) lv[v] = m.vn[a + v * 3] * flick;
      const ax = (V[a] - ox) / sw, ay = (V[a + 1] - oy) / sh, bx = (V[a + 3] - ox) / sw, by = (V[a + 4] - oy) / sh, cx = (V[a + 6] - ox) / sw, cy = (V[a + 7] - oy) / sh;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-6) continue;
      const ia = 1 / area, fi = m.f[t], col = m.fc[fi], plate = !pass && !(fl & EMIT);
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const za = V[a + 2], zbv = V[a + 5], zc = V[a + 8], l0 = lv[0], l1 = lv[1], l2 = lv[2];
      for (let j = j0; j <= j1; j++) {
        const py = j + 0.5;
        for (let i = i0; i <= i1; i++) {
          const px = i + 0.5;
          const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * ia;
          const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * ia;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * za + w1 * zbv + w2 * zc, s = j * W + i;
          if (z >= zb[s]) continue;
          let l = w0 * l0 + w1 * l1 + w2 * l2;
          if (pass) { if (l > gb[s]) { gb[s] = l; gc[s] = col; } continue; }
          if (plate) {
            // plating: panels in ship space, a tone each, seams between them when big enough
            const qx = (w0 * P[a] + w1 * P[a + 3] + w2 * P[a + 6]) / (m.panel * 1.6), qy = (w0 * P[a + 1] + w1 * P[a + 4] + w2 * P[a + 7]) / m.panel, qz = (w0 * P[a + 2] + w1 * P[a + 5] + w2 * P[a + 8]) / m.panel;
            const fx = Math.floor(qx), fy = Math.floor(qy), fz = Math.floor(qz);
            l *= TONE[(hash(fx, fy, fz) * 4) | 0];
            if (seam && (qx - fx < seam * 0.6 || qz - fz < seam)) l *= 0.62;
          }
          zb[s] = z; fb[s] = fi; lb[s] = l;
        }
        if ((work += i1 - i0 + 1) > 6000) { work = 0; yield; buf.stage = 'tri'; }
      }
    }
    yield; buf.stage = 'resolve';
    // resolve cells: coverage, mean light, nearest face, exhaust glow
    const cov = buf.cov && buf.cov.length >= nc ? buf.cov : (buf.cov = new Float32Array(nc * 1.6)), lum = buf.lum && buf.lum.length >= nc ? buf.lum : (buf.lum = new Float32Array(nc * 1.6));
    const fc = buf.fc && buf.fc.length >= nc ? buf.fc : (buf.fc = new Int32Array(nc * 1.6)), glow = buf.gl && buf.gl.length >= nc ? buf.gl : (buf.gl = new Float32Array(nc * 1.6)), gcol = buf.gcl && buf.gcl.length >= nc ? buf.gcl : (buf.gcl = new Uint8Array(nc * 1.6));
    for (let r = 0; r < rows; r++) {
      if ((r & 63) === 63) yield;
      for (let c = 0; c < cols; c++) {
        let cnt = 0, sum = 0, z = Infinity, fi = -1, g = 0, gcc = 0;
        for (let v = 0; v < SY; v++) for (let u = 0; u < SX; u++) {
          const s = (r * SY + v) * W + c * SX + u;
          if (gb[s] > g) { g = gb[s]; gcc = gc[s]; }
          if (fb[s] < 0) continue;
          cnt++; sum += lb[s]; if (zb[s] < z) { z = zb[s]; fi = fb[s]; }
        }
        const q = r * cols + c;
        cov[q] = cnt / NS; lum[q] = cnt ? sum / cnt : 0; fc[q] = fi; glow[q] = g; gcol[q] = gcc;
      }
    }
    yield; buf.stage = 'glyph0';
    // glyphs, tinted per cell with the colour of its face
    const IW = Math.floor(cols * cwF), IH = Math.floor(rows * chF);
    if (!buf.img || buf.img.width < IW || buf.img.height < IH) buf.img = new ImageData(Math.ceil(IW * 1.4), Math.ceil(IH * 1.4));   // headroom: an approaching ship grows every redraw
    const img = buf.img, D = img.data, SW = img.width;
    D.fill(0, 0, IH * SW * 4);
    const strength = light ? INK : INTENSITY, cmin = Math.min(1, 2 / NS) - 1e-6;
    const on = q => cov[q] >= cmin;
    const g = (arr, c, r) => { c = Math.max(0, Math.min(cols - 1, c)); r = Math.max(0, Math.min(rows - 1, r)); return arr[r * cols + c]; };
    const sobel = (arr, c, r) => [
      g(arr, c + 1, r - 1) + 2 * g(arr, c + 1, r) + g(arr, c + 1, r + 1) - g(arr, c - 1, r - 1) - 2 * g(arr, c - 1, r) - g(arr, c - 1, r + 1),
      g(arr, c - 1, r + 1) + 2 * g(arr, c, r + 1) + g(arr, c + 1, r + 1) - g(arr, c - 1, r - 1) - 2 * g(arr, c, r - 1) - g(arr, c + 1, r - 1)];
    const ff = m.ff;
    for (let r = 0; r < rows; r++) {
      if ((r & 3) === 3) { yield; buf.stage = 'glyph'; }
      const Y0 = Math.floor(r * chF), CH = Math.floor((r + 1) * chF) - Y0;
      for (let c = 0; c < cols; c++) {
        const q = r * cols + c, hull = on(q), gl = glow[q];
        if (!hull && gl < 0.12) continue;
        let chr, ink, col, a, opaque = hull;
        if (gl > 0.3 || (!hull && gl >= 0.12)) {
          // exhaust: the brightest, most saturated thing on the ship, flickering
          const v = Math.min(1, gl * (0.85 + 0.3 * hash(c, r, flick * 1e3 | 0)));
          chr = FIRE[Math.max(1, Math.min(FIRE.length - 1, Math.round(v * (FIRE.length - 1))))];
          ink = v; col = pal[gcol[q]]; a = Math.min(1, (0.35 + 0.65 * v) * strength * 2);
        } else {
          const fi = fc[q], em = fi >= 0 && (ff[fi] & EMIT);
          let v = em ? 1 : Math.pow(Math.min(1, lum[q]), GAMMA);
          // edge chars only on the outer silhouette and on sharp creases with a clear change in light
          let edge = false;
          if (!em) for (let d = 0; d < 4 && !edge; d++) {
            const cc = c + (d === 0 ? 1 : d === 1 ? -1 : 0), rr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) { edge = true; break; }
            const q2 = rr * cols + cc;
            if (!on(q2)) { edge = cov[q] < 1; continue; }
            const f1 = fc[q], f2 = fc[q2];
            if (f1 === f2 || f1 < 0 || f2 < 0 || (ff[f1] | ff[f2]) & (EMIT | SMOOTH)) continue;
            edge = fn[f1 * 3] * fn[f2 * 3] + fn[f1 * 3 + 1] * fn[f2 * 3 + 1] + fn[f1 * 3 + 2] * fn[f2 * 3 + 2] < CREASE && Math.abs(lum[q] - lum[q2]) > 0.25;
          }
          if (edge) {
            let [gx, gy] = sobel(cov, c, r);
            if (Math.hypot(gx, gy) < 0.3) [gx, gy] = sobel(lum, c, r);
            chr = EDGES[Math.round(((Math.atan2(gy / chF, gx / cwF) * 4 / Math.PI) % 4 + 4) % 4) % 4];
            v = Math.max(v, 0.4);
          }
          // light theme: ink on paper, darker surface = denser char; glowing parts stay full ink
          ink = light && !em ? 0.12 + 0.88 * (1 - v) : v;
          if (!chr) chr = RAMP[Math.min(RAMP.length - 1, Math.floor((0.06 + 0.94 * ink) * RAMP.length))];
          a = (0.2 + 0.8 * Math.ceil(ink * LEVELS) / LEVELS) * (em ? Math.min(1, strength * 1.8) : strength);
          col = pal[fi >= 0 ? m.fc[fi] : 0];
        }
        const X0 = Math.floor(c * cwF), CW = Math.floor((c + 1) * cwF) - X0;
        const mk = masks[chr];
        for (let y = 0; y < CH; y++) {
          let o = ((Y0 + y) * SW + X0) * 4;
          const mi = y * MW;
          for (let x = 0; x < CW; x++, o += 4) {
            const kk = mk[mi + x] * a / 255;
            if (opaque) { D[o] = bg[0] + (col[0] - bg[0]) * kk; D[o + 1] = bg[1] + (col[1] - bg[1]) * kk; D[o + 2] = bg[2] + (col[2] - bg[2]) * kk; D[o + 3] = 255; }
            else if (kk > 0) { D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = kk * 255; }
          }
        }
      }
    }
    yield; buf.stage = 'copy';   // the copy to the sprite is a step of its own
    // the sprite canvas only grows (with headroom): resizing a canvas reallocates it and its texture
    if (cvs.width < IW || cvs.height < IH) { cvs.width = Math.ceil(IW * 1.25); cvs.height = Math.ceil(IH * 1.25); yield; }
    const cx = cvs.getContext('2d');
    cx.clearRect(0, 0, cvs.width, cvs.height);
    // in bands: one big putImageData was the 30-200 ms frame (the sprite shown meanwhile is the other canvas)
    for (let y = 0; y < IH; y += 96) { cx.putImageData(img, 0, 0, 0, y, IW, Math.min(96, IH - y)); if (y + 96 < IH) yield; }
    return { cvs, ax: -ox, ay: -oy, w: IW, h: IH };
  }
  const finish = gen => { let r; while (!(r = gen.next()).done); return r.value; };

  // ---------- lab ----------
  const NAMES = { destroyer: 'Imperial Star Destroyer', falcon: 'Millennium Falcon', tie: 'TIE Fighter', xwing: 'X-wing', ywing: 'Y-wing', deathstar: 'Death Star' };
  const VIEW = { tie: 1.1 };     // turntable start (rad, default 0.6): the TIE's near panel hides the ball at 0.6
  const cv = document.createElement('canvas');
  cv.id = 'ships-sw';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let VW = 0, VH = 0;
  function size() { VW = innerWidth; VH = innerHeight; cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr); }
  const q = new URLSearchParams(location.search), ang = parseFloat(q.get('ang')), elev = parseFloat(q.get('elev') || 0.35), px = parseFloat(q.get('size'));
  let lab = BUILD[q.get('shiplab')] ? q.get('shiplab') : 'destroyer';
  const sel = document.createElement('select');
  sel.setAttribute('aria-label', 'ship');
  sel.style.cssText = 'position:fixed;top:16px;left:16px;z-index:1;background:var(--bg);color:var(--fg);border:1px solid currentColor;font:600 13px "JetBrains Mono",monospace;padding:4px 8px';
  for (const k in BUILD) sel.add(new Option(NAMES[k], k));
  sel.value = lab;
  document.body.appendChild(sel);
  const buf = {}, c2 = document.createElement('canvas'), B = [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  let t0 = performance.now(), raf = 0;
  function loop(now) {
    const t = isNaN(ang) ? (VIEW[lab] || 0.6) + (now - t0) / 1000 * 0.3 : ang;
    // seen from 3 ship lengths; the focal length sets the size
    const m = mesh(lab), Z = 3 * m.len;
    if (!m.ys) { let lo = 1e9, hi = -1e9; for (let i = 1; i < m.p.length; i += 3) { lo = Math.min(lo, m.p[i]); hi = Math.max(hi, m.p[i]); } m.ys = hi - lo; }
    // as ships.js's lab, plus a cap for ships taller than long (TIE, Death Star): they fit the height
    F = 3 * (px || Math.min(VW * 0.75, VH * 1.2, VH * 0.7 * m.len / m.ys));
    const spr = finish(render(lab, mul(rx(elev), mul(ry(t), B)), [0, 0, Z], 1, buf, c2, 0.9 + 0.2 * Math.random()));
    ctx.fillStyle = `rgb(${bg})`; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(spr.cvs, 0, 0, spr.w, spr.h, Math.round(cv.width / 2 - spr.ax), Math.round(cv.height / 2 - spr.ay), spr.w, spr.h);
    raf = isNaN(ang) ? requestAnimationFrame(loop) : 0;
  }
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };
  sel.addEventListener('change', () => { lab = sel.value; t0 = performance.now(); redraw(); });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { buildMasks(1); size(); redraw(); }, 150); });
  function start() { readTheme(); buildMasks(1); size(); redraw(); }
  (document.fonts ? document.fonts.load("600 12px 'JetBrains Mono'").then(() => document.fonts.ready) : Promise.resolve()).then(start, start);
})();
