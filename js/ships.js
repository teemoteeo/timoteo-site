// ============================
// SHIPS: low-poly starships flying through the space behind the page, as ASCII
// ============================
// ships live in world space (x right, y down, z away from the viewer) and are seen through one
// perspective camera. Each ship's mesh is rasterized (z-buffer, 2x4 samples per cell, shadows from
// a shadow map, light falling off with depth) into its own grid of cells, the same size as the
// avatar's ASCII (js/ascii-pic.js), turned into tinted glyphs and cached as a sprite. Lit surfaces
// get the glyph ramp; dim ones, and the outline, get braille dots, one per sample, so shade and
// silhouette keep the samples' resolution. Per frame sprites only move; a ship is re-rasterized
// when its pose or its size changed enough, within a time budget (big ones over several frames).
// ?shiplab=xwing|tie|ywing|falcon|destroyer: one ship large on a turntable (&ang=<rad> freezes it, &elev=<rad>)
// once per page view, one group after the other comes in filling the biggest empty part of the page,
// then flies away towards the top right: the Star Destroyer with its TIEs, then the Falcon with
// X-wings and Y-wings, who jump to lightspeed
(function () {
  const INTENSITY = 0.65;         // the knob: glyph strength over the page bg, dark theme (0-1)
  const INK = 0.4;                // same on the light theme
  const CELL_W = 2.5, CELL_H = CELL_W * 1.75;   // css px per cell, as the avatar
  const RERASTER = 0.02;          // change of heading/roll/view (rad) before a sprite is redrawn
  const SCALE_STEP = 0.025;       // ... or of on-screen size
  const BUDGET = 4;               // ms of rasterizing per frame (moving, drawing and the last step of a job come on top)
  const CELL_CAP = [30000, 80000]; // above these cell counts: 2x2, then 1x1 samples per cell (else 2x4, a braille cell)
  const FOCAL = 1.15;             // focal length in viewport heights
  const DT_MAX = 0.05;
  const FIRST_SPAWN = 1;          // s after the page shows before the first group comes in
  const GAP = [3, 6];             // s of empty sky between two groups
  // one group at a time. lead: kind, length (world units), its on-screen length when it fills the
  // empty box (x box width, capped at px css), s for the whole pass.
  // escort: [kind, length, ahead, up, right], offsets in lead lengths in the lead's own frame
  // (ahead < 0 is behind the lead, so nearer the camera and bigger)
  const GROUPS = [
    // TIEs at about 1:37 of the Destroyer (the real one is 1:250, which would leave dots); the
    // hull is 0.65 lead lengths wide, so the flankers fly past its rim
    { lead: 'destroyer', len: 60, edge: 0.75, px: 1500, time: 19, swing: 0.04, sway: 0.03, escort: [
      ['tie', 1.6, -0.1, 0.1, 0.4], ['tie', 1.6, -0.18, 0.06, 0.47], ['tie', 1.6, -0.26, 0.13, 0.36], ['tie', 1.6, 0.1, 0.08, 0.44],
      ['tie', 1.6, 0, -0.05, -0.4], ['tie', 1.6, -0.1, 0, -0.5], ['tie', 1.6, 0.3, 0.14, -0.1], ['tie', 1.6, -0.34, 0.16, -0.24],
    ] },
    // a V trailing the Falcon; at `jump` of the pass they jump to lightspeed, the Falcon first
    { lead: 'falcon', len: 8, edge: 0.3, px: 420, time: 15, swing: 0.1, sway: 0.2, jump: 0.5, escort: [
      ['xwing', 3, -0.8, 0.08, 0.5], ['xwing', 3, -0.85, -0.04, -0.52],
      ['ywing', 3.6, -1.4, 0.12, 0.95], ['ywing', 3.6, -1.45, 0, -1],
    ] },
  ];
  // the lead's course, in world space so perspective does the rest. Coming in: from nearer and
  // lower left, heading along `enter` (nearly across: no near end looming), slowing down to `slow` of its speed as it reaches the box
  // centre at the size that fills the box (`lead`: that leg's length, x the depth there), in the
  // first `stay` of the pass. Going away: it turns for the vanishing point `vanish` (viewport
  // fractions, top right) and speeds up (`ease`) until it is `depth` times deeper. The escort
  // drifts round its slot by up to `sway` lead lengths on every axis, depth included
  const PATH = { vanish: [0.94, 0.04], enter: [1, -0.04, 0.12], lead: 0.3, stay: 0.32, slow: 0.35, depth: 8, ease: 2.2 };
  // the jump to lightspeed, in three beats. Slow: over `brake` s before the lead's jump the group
  // brakes to `idle` of its speed. Charge: meanwhile each ship's engines swell to `glow` times,
  // pulsing `pulse` times a second (only the engines: the hull keeps its light), and it trembles
  // up to `shake` css px. Go: each shoots off along the heading, ever faster (a lead lengths x
  // (e^(rate s) - 1) after s seconds), the lead first, the escort `after` s behind it; gone after
  // `gone` s. The streak is glyphs: `lines` lines across the ship, from where it was `trail` s ago to where it is
  const JUMP = { brake: 1.8, idle: 0.06, glow: 3.5, pulse: 2.5, shake: 2.2, a: 0.05, rate: 11, after: [0.35, 0.45, 0.6, 0.7], gone: 0.7, trail: 0.4, lines: 9 };
  const BOX_MIN = 0.3;            // an empty box narrower than this (x viewport width) is not used: lower left instead
  const HORIZON = 0.22;           // the vanishing point's height (viewport fraction): high, so ships flying level
                                  // climb the screen and show their decks, as from a camera looking down
  const FADE = 0.62;              // fraction of the pass after which the group fades out
  const FAR_DIM = 0.55;           // light lost with distance over the pass: far ships dissolve into dots
  const BANK = 1.1;               // roll per rad/s of turn: ships lean into their curves
  const AMB = 0.05, DIF = 0.95, RIM = 0.2, GAMMA = 1.2;
  const EXPOSE = 0.95;            // the brightest 5% of a ship's hull is scaled to this (up to 2.5x): full range at any light angle
  const LIGHT = norm([-0.8, -0.42, -0.42]);  // towards the key light, world space: low and from the left, so slopes part and greebles cast long shadows
  const SHADOW = 0.12;            // diffuse light left in a cast shadow
  const ZFOG = 0.5;               // light lost from the nearest to the farthest point of a ship
  const DOTS = 0.3;               // ink below which a cell is drawn as braille dots
  const CREASE = 0.25;            // cos of the angle between faces that draws an edge char
  const LEVELS = 4;               // brightness buckets per glyph
  const DITHER = [0, 4, 6, 2, 1, 5, 7, 3].map(v => (v + 0.5) / 8);   // per braille dot (row-major 2x4): ordered threshold
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

  const lab = new URLSearchParams(location.search).get('shiplab');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced && !lab) return;
  // desktop only for now: a mouse and a wide window when the page loads
  if (!lab && !matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches) return;

  // ---------- vectors ----------
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return l ? [v[0] / l, v[1] / l, v[2] / l] : v; }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const mix = (a, b, k) => add(a, sub(b, a), k);
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
  // a straight hull through sections [x, [[y, z]...]] (convex rings, same point count), flat quads,
  // end caps; o.fls / o.cols: flag and colour per side of the ring
  function hull(secs, o = {}) {
    const P = secs.map(([x, pts]) => pts.map(([y, z]) => [x, y, z])), n = P[0].length;
    const ctr = ps => ps.reduce((s, p) => add(s, p, 1 / ps.length), [0, 0, 0]);
    for (let i = 0; i < P.length - 1; i++) {
      const c = ctr([...P[i], ...P[i + 1]]);
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, fl = o.fls ? o.fls[k] : o.fl || 0, col = o.cols ? o.cols[k] : o.col;
        fid++; tri(P[i][k], P[i + 1][k], P[i + 1][k1], c, fid, fl, col); tri(P[i][k], P[i + 1][k1], P[i][k1], c, fid, fl, col);
      }
    }
    fan(P[0], ctr([...P[0], ...P[1]]), o.fl || 0, o.col); fan(P[P.length - 1], ctr([...P[P.length - 1], ...P[P.length - 2]]), o.fl || 0, o.col);
  }
  const both = f => { f(1); f(-1); };
  // a nozzle facing aft (-x) with its rim at x: outer bell, dark inner wall, glowing disc set
  // back inside, and an exhaust cone behind it
  function engine(x, y, z, r, len, col, xf = id, plume = 4.5) {
    const place = q => xf([q[0], q[1] + y, q[2] + z]); place.R = xf.R;
    loft([[x, 0, 0, r, r], [x + len * 0.35, 0, 0, r * 1.02, r * 1.02], [x + len, 0, 0, r * 0.8, r * 0.8]], { n: 14, xf: place, fl: SMOOTH, col: 'hullDark', cap0: false });
    loft([[x + 0.01, 0, 0, r * 0.88, r * 0.88], [x + len * 0.5, 0, 0, r * 0.78, r * 0.78]], { n: 14, xf: place, inward: true, fl: DARK, col: 'hullDark', cap0: false, cap1: false });
    fan(Array.from({ length: 14 }, (_, k) => { const a = k * 2 * Math.PI / 14; return place([x + len * 0.5, r * 0.78 * Math.sin(a), r * 0.78 * Math.cos(a)]); }), place([x + len, 0, 0]), EMIT, col);
    loft([[x + len * 0.45, 0, 0, r * 0.7, r * 0.7], [x - r * 1.5, 0, 0, r * 0.45, r * 0.45], [x - r * plume, 0, 0, 0.02, 0.02]], { n: 10, xf: place, fl: EXH, col, w: [1, 0.6, 0] });
  }
  const gun = (x0, x1, y, z, r, xf = id) => { const pl = q => xf([q[0], q[1] + y, q[2] + z]); pl.R = xf.R; loft([[x0, 0, 0, r, r], [x1, 0, 0, r, r], [x1 + r * 3, 0, 0, r * 0.6, r * 0.6]], { n: 6, xf: pl, col: 'hullDark' }); };
  const dots = (pts, s, col, xf) => pts.forEach(([x, y, z]) => box(x - s, x + s, y - s * 0.7, y + s * 0.7, z - s, z + s, { fl: EMIT, col, xf }));

  // ---------- ships: Star Wars (the same models as js/ships-sw.js, its lab page; the Death Star stays there) ----------
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
  const srnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const srr = (a, b) => a + (b - a) * srnd();
  // detail parts take G: SMOOTH only stops crease edge chars (box normals stay per face), which at
  // this size would turn every greeble into a knot of |/-\
  const G = SMOOTH;
  // greebles: n small boxes standing on the plane y = 0 of xf, inside [x0, x1] x [z0, z1], s wide, up to h tall
  function greeble(n, x0, x1, z0, z1, s, h, xf, col = 'hull') {
    for (let i = 0; i < n; i++) {
      const x = srr(x0, x1), z = srr(z0, z1), w = srr(0.3, 1) * s / 2, d = srr(0.3, 1) * s / 2;
      box(x - w, x + w, -h, srr(0.25, 1) * h, z - d, z + d, { xf, fl: G, col: srnd() < 0.3 ? 'hullDark' : col });
    }
  }

  // engine light: blue for the Rebels (Falcon, X-wing, Y-wing), red for the Empire (Star Destroyer, TIE)
  const BUILD = {
    // Imperial Star Destroyer, after the blueprint and the studio models (.ships-work/refs): a wedge
    // 32 long and 0.65 as wide, a low ridge down the deck and a deeper keel, a recessed wall round
    // the rim between two overhanging lips, packed with greebles and window rows; plated slopes,
    // turbolaser batteries on the shoulders, a stepped superstructure with lit window bands, the
    // bridge tower with the T-shaped bridge, its two shield domes and the tractor array; ventral
    // hangar and reactor dome; engine block with three big and four small engines
    destroyer() {
      PANEL = 1.6; sd = 11;
      const X0 = -16, X1 = 16, f = x => Math.max(0.012, (X1 - x) / (X1 - X0));
      const W = x => 10.4 * f(x), UP = x => 2.2 * f(x), DN = x => 2.8 * f(x), RH = x => 0.1 + 0.28 * f(x);
      const WALL = x => W(x) - 0.4 * f(x) - 0.04;                       // the rim wall, set back under the lips
      const top = (x, u) => UP(x) - (UP(x) - RH(x)) * u;                // deck height, u = 0 on the ridge, 1 at the wall
      const bot = (x, u) => -DN(x) + (DN(x) - RH(x)) * u;
      const ring = x => [[UP(x), 0], [RH(x), WALL(x)], [-RH(x), WALL(x)], [-DN(x), 0], [-RH(x), -WALL(x)], [RH(x), -WALL(x)]];
      hull([[X0, ring(X0)], [X1, ring(X1)]], { fls: [0, DARK, 0, 0, DARK, 0], cols: ['hull', 'hullDark', 'hull', 'hull', 'hullDark', 'hull'] });
      const RIM = Math.atan2(W(X0), X1 - X0);                            // the rim's angle to the axis
      both(s => {
        // lips: thin plates along the edge, overhanging the wall
        const lip = (y0, y1) => hull([X0, X1].map(x => [x, [[y1(x), WALL(x) * 0.93 * s], [y1(x), W(x) * s], [y0(x), W(x) * s], [y0(x), WALL(x) * 0.93 * s]]]), { col: 'hull' });
        lip(x => RH(x) - 0.1 * f(x) - 0.03, x => RH(x) + 0.04);
        lip(x => -RH(x) - 0.04, x => -RH(x) + 0.1 * f(x) + 0.03);
        // the wall: greebles and window rows in a frame turned with the rim (local z out of the wall)
        const onWall = (x, y) => at(x, y, WALL(x) * s, 0, RIM * s, 0);
        for (let i = 0; i < 260; i++) {
          const x = srr(X0 + 0.3, X1 - 2.5), h = RH(x), w = srr(0.1, 0.45) * (0.5 + f(x)), d = srr(0.05, 0.3) * f(x) + 0.03;
          box(-w, w, -h * srr(0.3, 0.9), h * srr(0.3, 0.9), 0, d * s, { xf: onWall(x, srr(-0.3, 0.3) * h), fl: G, col: srnd() < 0.4 ? 'hullDark' : 'hull' });
        }
        for (let x = X0 + 0.4; x < X1 - 4; x += 0.2) {
          if (srnd() < 0.45) continue;
          const row = srnd() < 0.5 ? 0 : srnd() < 0.5 ? 0.5 : -0.5, h = RH(x);
          box(-0.06, 0.06, row * h - 0.05, row * h + 0.05, 0, 0.02 * s, { xf: onWall(x, 0), fl: EMIT, col: 'window' });
        }
        // plating on the upper slopes, finer towards the bow: boxes on the face, aimed along its normal
        for (let i = 0; i < 420; i++) {
          const x = srr(X0 + 0.4, X1 - 1.5), u = srr(0.06, 0.94), k = 0.35 + 0.65 * f(x);
          const w = srr(0.25, 1.1) * k / 2, d = srr(0.15, 0.6) * k / 2, ang = Math.atan2(UP(x) - RH(x), WALL(x));
          box(-w, w, -0.1, srr(0.03, 0.14) * k, -d, d, { xf: at(x, top(x, u), WALL(x) * u * s, ang * s), fl: G, col: srnd() < 0.3 ? 'hullDark' : 'hull' });
        }
        for (let i = 0; i < 90; i++) {   // and a little under the keel
          const x = srr(X0 + 0.4, X1 - 3), u = srr(0.1, 0.9), k = 0.35 + 0.65 * f(x), w = srr(0.3, 1) * k / 2, d = srr(0.2, 0.6) * k / 2;
          box(-w, w, -srr(0.03, 0.12) * k, 0.1, -d, d, { xf: at(x, bot(x, u), WALL(x) * u * s, -Math.atan2(DN(x) - RH(x), WALL(x)) * s), fl: G, col: 'hullDark' });
        }
        // turbolaser batteries on the shoulders, beside the superstructure
        [-12.5, -9.5, -6.5, -3.5].forEach(x => {
          const u = (5.8 - 4.8 * (x + 15.8) / 14.3 + 1.1) / WALL(x), z = WALL(x) * u * s, y = top(x, u);   // just outside the first terrace
          box(x - 0.45, x + 0.45, y - 0.1, y + 0.3, z - 0.4, z + 0.4, { inset: 0.25 });
          gun(x, x + 1.1, y + 0.2, z - 0.12, 0.06); gun(x, x + 1.1, y + 0.2, z + 0.12, 0.06);
        });
      });
      // ventral hangar (a dark wedge just under the keel) and the reactor dome
      const ys = (x, z) => bot(x, z / WALL(x));
      hull([-5, 1].map(x => [x, [[-DN(x) - 0.03, 0], [ys(x, 1.3) - 0.03, -1.3], [ys(x, 1.3) - 0.03, 1.3]]]), { fl: DARK, col: 'hullDark' });
      orb(1.7, { n: 16, m: 9, xf: at(-9, -DN(-9) + 0.6, 0) });
      // superstructure: terraces, each narrower and shorter towards the stern: [x0, x1, half width at x0, at x1, y0, y1]
      const TER = [[-15.8, -1.5, 5.8, 1.0, 1.0, 2.9], [-15.6, -5.5, 4.6, 1.2, 2.9, 3.8], [-15.4, -8.5, 3.4, 1.2, 3.8, 4.6], [-15.2, -11, 2.3, 1.0, 4.6, 5.3]];
      TER.forEach(([x0, x1, w0, w1, y0, y1], i) => {
        ext([[x0, -w0], [x1, -w1], [x1, w1], [x0, w0]], y0, y1, { inset: 0.04 + 0.02 * i });
        const w = x => w0 + (w1 - w0) * (x - x0) / (x1 - x0);
        for (let n = 0; n < 50; n++) { const x = srr(x0 + 0.3, x1 - 0.4), z = srr(-0.8, 0.8) * w(x) * 0.85; box(x - 0.14, x + 0.14, y1 - 0.05, y1 + srr(0.03, 0.14), z - 0.14, z + 0.14, { fl: G, col: srnd() < 0.3 ? 'hullDark' : 'hull' }); }
        box(x0 + 0.4, x1 - 0.3, y1 - 0.02, y1 + 0.05, -w1 * 0.25, w1 * 0.25, { fl: DARK, col: 'hullDark' });   // a dark seam down each terrace
        both(s => {
          for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.26) if (srnd() < 0.7) dots([[x, y0 + (y1 - y0) * (srnd() < 0.5 ? 0.35 : 0.65), (w(x) - 0.03) * s]], 0.05, 'window');   // window bands
          if (i < 2) for (let x = x0 + 1.2; x < x1 - 1; x += 2.4) { const z = w(x) * 0.8 * s; box(x - 0.35, x + 0.35, y1, y1 + 0.22, z - 0.28, z + 0.28, { inset: 0.2 }); gun(x, x + 1.0, y1 + 0.15, z - 0.1, 0.05); gun(x, x + 1.0, y1 + 0.15, z + 0.1, 0.05); }
        });
      });
      // bridge tower
      box(-14.4, -12.6, 5.3, 7.7, -0.55, 0.55, { inset: 0.05 });                 // neck
      both(s => ext([[-14.6, 0.5 * s], [-12.8, 0.5 * s], [-13.4, 1.4 * s], [-14.6, 1.4 * s]], 5.3, 6.0, { inset: 0.1 }));   // neck shoulders
      box(-14.9, -12.1, 7.7, 8.55, -3.0, 3.0, { inset: 0.04 });                   // the T bridge
      greeble(30, -14.7, -12.3, -2.8, 2.8, 0.3, 0.08, at(0, 7.72, 0));            // its underside
      box(-12.13, -12.08, 7.95, 8.28, -2.8, 2.8, { fl: EMIT, col: 'window' });    // bridge windows
      both(s => dots(Array.from({ length: 9 }, (_, i) => [-14.6 + i * 0.3, 8.12, 2.98 * s]), 0.05, 'window'));   // its flanks
      box(-14.3, -12.9, 8.55, 8.62, -0.6, 0.6, { fl: EMIT, col: 'window' });     // lit band on top
      box(-13.9, -13.0, 8.55, 8.8, -0.6, 0.6); box(-14.1, -12.8, 8.8, 8.86, -1.0, 1.0);   // tractor array
      box(-13.7, -13.6, 8.86, 9.6, -0.04, 0.04);                                  // mast
      both(s => {
        box(-13.7, -13.4, 8.55, 9.05, 2.1 * s - 0.1, 2.1 * s + 0.1);
        orb(0.6, { n: 12, m: 7, xf: at(-13.55, 9.55, 2.1 * s) });                  // shield domes
      });
      // engine block: three big engines on the rim line, four small ones above and below between them
      box(-16.9, -15.9, -1.9, 2.0, -6.0, 6.0, { inset: 0.03 });
      greeble(26, -16.8, -16.0, -5.6, 5.6, 0.45, 0.12, at(0, 2.0, 0));
      [-4.0, 0, 4.0].forEach(z => engine(-17.6, 0.15, z, 1.15, 1.2, 'red', id, 2));   // short plumes: the glow is in the nozzles
      both(s => both(t => engine(-17.3, 1.15 * t, 2.0 * s, 0.5, 0.7, 'red', id, 2)));
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
        const f = srr(0.5, 2 * Math.PI - 0.5), r = srr(1.75, 2.9), w = srr(0.12, 0.35), d = srr(0.08, 0.25);
        box(-w, w, -0.06, srr(0.03, 0.12), -d, d, { xf: at(r * Math.cos(f), 0.6, r * Math.sin(f), 0, -f, 0), fl: G, col: srnd() < 0.35 ? 'hullDark' : 'hull' });
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
      for (let i = 0; i < 8; i++) { const y = srr(-0.3, 0.3), z = srr(-0.5, 0.5), r = srr(0.04, 0.08); loft([[-1.4, y, z, r, r], [1.5, y, z, r, r]], { n: 6 }); }
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
    return (MESH[kind] = { n, p, nr, vn, f, fl, fc, ff, panel: PANEL, faces: fid + 1, len: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]),   // len: largest extent
      c: mix(lo, hi, 0.5), r: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 });   // bounding sphere, for the shadow map
  }

  // ---------- glyphs ----------
  // cells keep their exact css size: cell c spans device px floor(c * cwF) .. floor((c + 1) * cwF),
  // as in ascii-pic.js; the glyph masks are drawn once with the avatar's font
  let dpr = 1, cwF = 2.5, chF = 4.375, MW = 4, MH = 6, masks = null, dotm = null, bg = [14, 13, 16], pal = [], light = false;
  function readTheme() {
    atlas = null;
    const css = getComputedStyle(document.documentElement);
    const rgb = s => { s = s.trim(); const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    light = document.documentElement.dataset.theme === 'light';
    const fg = rgb(css.getPropertyValue('--fg'));
    bg = rgb(css.getPropertyValue('--bg'));
    pal = COLS.map(k => { const c = PALETTE[k][light ? 1 : 0]; return c ? rgb(c) : fg; });
  }
  function buildMasks(scale) {
    atlas = null;
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
    // braille: drawn, not taken from the font (exact dots at any size): bit row * 2 + col
    const rd = Math.max(0.6, Math.min(cwF / 2, chF / 4) * 0.5);
    dotm = Array.from({ length: 256 }, (_, bits) => {
      const m = new Uint8Array(MW * MH);
      for (let b = 0; b < 8; b++) if (bits >> b & 1) {
        const cx = ((b & 1) + 0.5) * cwF / 2, cy = ((b >> 1) + 0.5) * chF / 4;
        for (let y = 0; y < MH; y++) for (let x2 = 0; x2 < MW; x2++) {
          const v = Math.max(0, Math.min(1, rd + 0.5 - Math.hypot(x2 + 0.5 - cx, y + 0.5 - cy)));
          if (v) m[y * MW + x2] = Math.max(m[y * MW + x2], v * 255);
        }
      }
      return m;
    });
  }

  // ---------- rasterizer ----------
  const hash = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const TONE = [0.82, 0.9, 0.97, 1.04];   // plating: a few tones, one per panel
  let F = 1000;                            // focal length, css px
  // shadow map: the hull seen from the light (L, ship space), per texel the depth towards the
  // light of what is nearest it. Kept in sm (one per ship) while the light stays put in the ship's frame
  function* shadow(m, L, S, sm) {
    if (sm.S === S && dot(sm.L, L) > 0.9998) return sm;
    const a = norm(cross(L, Math.abs(L[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), b = cross(L, a), k = S / (2 * m.r);
    const A = a.map(v => v * k), B = b.map(v => v * k), au = S / 2 - dot(m.c, A), bv = S / 2 - dot(m.c, B);
    const map = sm.map && sm.map.length === S * S ? sm.map : new Float32Array(S * S);
    map.fill(-Infinity);
    const P = m.p, u = [0, 0, 0], v = [0, 0, 0], d = [0, 0, 0];
    let work = 0;
    for (let t = 0; t < m.n; t++) {
      if (m.fl[t] & (EXH | EMIT)) continue;
      for (let j = 0; j < 3; j++) { const o = t * 9 + j * 3, p0 = P[o], p1 = P[o + 1], p2 = P[o + 2]; u[j] = p0 * A[0] + p1 * A[1] + p2 * A[2] + au; v[j] = p0 * B[0] + p1 * B[1] + p2 * B[2] + bv; d[j] = p0 * L[0] + p1 * L[1] + p2 * L[2]; }
      const area = (u[1] - u[0]) * (v[2] - v[0]) - (v[1] - v[0]) * (u[2] - u[0]);
      if (Math.abs(area) < 1e-9) continue;
      const ia = 1 / area, i0 = Math.max(0, Math.floor(Math.min(u[0], u[1], u[2]))), i1 = Math.min(S - 1, Math.ceil(Math.max(u[0], u[1], u[2])));
      const j0 = Math.max(0, Math.floor(Math.min(v[0], v[1], v[2]))), j1 = Math.min(S - 1, Math.ceil(Math.max(v[0], v[1], v[2])));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = i + 0.5, py = j + 0.5;
        const w0 = ((u[1] - px) * (v[2] - py) - (v[1] - py) * (u[2] - px)) * ia, w1 = ((u[2] - px) * (v[0] - py) - (v[2] - py) * (u[0] - px)) * ia, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * d[0] + w1 * d[1] + w2 * d[2], s = j * S + i;
        if (z > map[s]) map[s] = z;
      }
      if ((work += (i1 - i0 + 1) * (j1 - j0 + 1) + 20) > 40000) { work = 0; yield; }
    }
    return Object.assign(sm, { S, L, map, A, B, au, bv, bias: 2.5 / k });
  }
  // a job: yields often so a big ship can be spread over frames.
  // R: ship->world rotation, C: world position of the ship's origin, k: world units per ship unit,
  // buf: the ship's scratch buffers, cvs: its sprite. Returns the sprite and where C lands in it (device px)
  // dim: light left at this distance; sm: the ship's shadow map cache
  function* render(kind, R, C, k, buf, cvs, flick = 1, dim = 1, sm = {}) {
    const m = mesh(kind), P = m.p, N = m.n, Fd = F * dpr;
    buf.stage = 'setup';
    if (!buf.V || buf.V.length < N * 9) { buf.V = new Float32Array(N * 9); buf.fn = new Float32Array(m.faces * 3); }   // reused: less garbage
    const V = buf.V, cx0 = Fd * C[0] / C[2], cy0 = Fd * C[1] / C[2];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, zn = 1e9, zf = -1e9;
    for (let i = 0; i < N * 3; i++) {
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const Z = Math.max(0.5, C[2] + k * (R[2][0] * px + R[2][1] * py + R[2][2] * pz));
      const X = Fd * (C[0] + k * (R[0][0] * px + R[0][1] * py + R[0][2] * pz)) / Z - cx0;
      const Y = Fd * (C[1] + k * (R[1][0] * px + R[1][1] * py + R[1][2] * pz)) / Z - cy0;
      V[i * 3] = X; V[i * 3 + 1] = Y; V[i * 3 + 2] = Z;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      if (Z < zn) zn = Z; if (Z > zf) zf = Z;
    }
    const ox = x0 - cwF, oy = y0 - chF;
    const cols = Math.ceil((x1 - x0) / cwF) + 2, rows = Math.ceil((y1 - y0) / chF) + 2, nc = cols * rows;
    const SX = nc > CELL_CAP[1] ? 1 : 2, SY = nc > CELL_CAP[1] ? 1 : nc > CELL_CAP[0] ? 2 : 4, NS = SX * SY;
    const W = cols * SX, H = rows * SY, sw = cwF / SX, sh = chF / SY;
    if (!buf.zb || buf.zb.length < W * H) { const s = Math.ceil(W * H * 1.6); buf.zb = new Float32Array(s); buf.lb = new Float32Array(s); buf.fb = new Int32Array(s); buf.gb = new Float32Array(s); buf.gc = new Uint8Array(s); }
    const { zb, lb, fb, gb, gc } = buf;
    zb.fill(Infinity, 0, W * H); fb.fill(-1, 0, W * H); gb.fill(0, 0, W * H);
    const fn = buf.fn;
    // panel seams only when a panel spans several cells; narrower than that they turn into noise
    const unitPx = Fd * k / C[2], seam = m.panel * unitPx / cwF > 7 ? Math.max(0.04, 0.6 * cwF / (m.panel * unitPx)) : 0;
    // the light in ship space (R is a rotation: its transpose undoes it) and its shadow map, about as fine as the samples
    const L = [0, 1, 2].map(j => R[0][j] * LIGHT[0] + R[1][j] * LIGHT[1] + R[2][j] * LIGHT[2]);
    const SM = yield* shadow(m, L, Math.min(512, Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(W, H) * 0.7)))), sm);
    const map = SM.map, S = SM.S, A = SM.A, B = SM.B, au = SM.au, bv = SM.bv, bias = SM.bias;
    // light falls off with depth across the ship, and with its distance (dim)
    const zi = ZFOG / Math.max(1e-3, zf - zn);
    const la = [0, 0, 0], ld = [0, 0, 0];
    let work = 0;
    buf.stage = 'tri';
    for (let pass = 0; pass < 2; pass++) for (let t = 0; t < N; t++) {
      const fl = m.fl[t];
      if (!(fl & EXH) !== !pass) continue;   // hull first, exhaust glow second
      const a = t * 9;
      const n0 = m.nr[t * 3], n1 = m.nr[t * 3 + 1], n2 = m.nr[t * 3 + 2];
      const nx = R[0][0] * n0 + R[0][1] * n1 + R[0][2] * n2, ny = R[1][0] * n0 + R[1][1] * n1 + R[1][2] * n2, nz = R[2][0] * n0 + R[2][1] * n1 + R[2][2] * n2;
      // world view ray to the face (camera at the origin)
      const vx = (V[a] + V[a + 3] + V[a + 6]) / 3 + cx0, vy = (V[a + 1] + V[a + 4] + V[a + 7]) / 3 + cy0, vz = Fd;
      const vl = Math.hypot(vx, vy, vz);
      const dk = fl & DARK ? 0.35 : 1;
      if (!pass) {
        const facing = -(nx * vx + ny * vy + nz * vz) / vl;
        if (facing < -0.02) continue;
        const fi = m.f[t];
        fn[fi * 3] = nx; fn[fi * 3 + 1] = ny; fn[fi * 3 + 2] = nz;
        for (let v = 0; v < 3; v++) {
          if (fl & EMIT) { la[v] = 1; ld[v] = 0; continue; }
          const q0 = m.vn[a + v * 3], q1 = m.vn[a + v * 3 + 1], q2 = m.vn[a + v * 3 + 2];
          const wx = R[0][0] * q0 + R[0][1] * q1 + R[0][2] * q2, wy = R[1][0] * q0 + R[1][1] * q1 + R[1][2] * q2, wz = R[2][0] * q0 + R[2][1] * q1 + R[2][2] * q2;
          const fc = Math.max(0, -(wx * vx + wy * vy + wz * vz) / vl);
          la[v] = (AMB + RIM * (1 - fc) ** 3) * dk;
          ld[v] = DIF * Math.max(0, wx * LIGHT[0] + wy * LIGHT[1] + wz * LIGHT[2]) * dk;
        }
      } else for (let v = 0; v < 3; v++) { la[v] = m.vn[a + v * 3] * flick; ld[v] = 0; }
      const ax = (V[a] - ox) / sw, ay = (V[a + 1] - oy) / sh, bx = (V[a + 3] - ox) / sw, by = (V[a + 4] - oy) / sh, cx = (V[a + 6] - ox) / sw, cy = (V[a + 7] - oy) / sh;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-6) continue;
      const ia = 1 / area, fi = m.f[t], col = m.fc[fi], plate = !pass && !(fl & EMIT), lit = plate && (ld[0] + ld[1] + ld[2]) > 0;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), j1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const za = V[a + 2], zbv = V[a + 5], zc = V[a + 8];
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
          let l = w0 * la[0] + w1 * la[1] + w2 * la[2];
          if (pass) { if (l > gb[s]) { gb[s] = l; gc[s] = col; } continue; }
          if (plate) {
            const sx = w0 * P[a] + w1 * P[a + 3] + w2 * P[a + 6], sy = w0 * P[a + 1] + w1 * P[a + 4] + w2 * P[a + 7], sz = w0 * P[a + 2] + w1 * P[a + 5] + w2 * P[a + 8];
            // direct light, unless something nearer the light covers this point in the shadow map
            if (lit) {
              const u = (sx * A[0] + sy * A[1] + sz * A[2] + au) | 0, v = (sx * B[0] + sy * B[1] + sz * B[2] + bv) | 0;
              const occ = u >= 0 && v >= 0 && u < S && v < S && sx * L[0] + sy * L[1] + sz * L[2] < map[v * S + u] - bias;
              l += (w0 * ld[0] + w1 * ld[1] + w2 * ld[2]) * (occ ? SHADOW : 1);
            }
            // plating: panels in ship space, a tone each, seams between them when big enough
            const qx = sx / (m.panel * 1.6), qy = sy / m.panel, qz = sz / m.panel;
            const fx = Math.floor(qx), fy = Math.floor(qy), fz = Math.floor(qz);
            l *= TONE[(hash(fx, fy, fz) * 4) | 0];
            if (seam && (qx - fx < seam * 0.6 || qz - fz < seam)) l *= 0.62;
            l *= 1 - (z - zn) * zi;
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
    // braille bits per cell: the dots over covered samples (the outline), and those whose ink beats the dither (the shade)
    const cb = buf.cb && buf.cb.length >= nc ? buf.cb : (buf.cb = new Uint8Array(nc * 1.6)), db = buf.db && buf.db.length >= nc ? buf.db : (buf.db = new Uint8Array(nc * 1.6)), eb = buf.eb && buf.eb.length >= nc ? buf.eb : (buf.eb = new Uint8Array(nc * 1.6));
    const ff = m.ff;
    // exposure: the hull's 95th percentile of light (every 5th sample, 64 bins) to EXPOSE, then the distance dimming
    const hist = new Uint32Array(64);
    let hn = 0;
    for (let s = 0; s < W * H; s += 5) if (fb[s] >= 0 && !(ff[fb[s]] & EMIT)) { hist[Math.min(63, lb[s] * 48 | 0)]++; hn++; }
    let p95 = 63;
    for (let i = 63, acc = 0; i >= 0; i--) if ((acc += hist[i]) > hn * 0.05) { p95 = (i + 1) / 48; break; }
    const ex = Math.min(2.5, EXPOSE / Math.max(1e-3, p95)) * dim;
    for (let r = 0; r < rows; r++) {
      if ((r & 63) === 63) yield;
      for (let c = 0; c < cols; c++) {
        let cnt = 0, sum = 0, z = Infinity, fi = -1, g = 0, gcc = 0, bc = 0, bd = 0, be = 0;
        for (let v = 0; v < SY; v++) for (let u = 0; u < SX; u++) {
          const s = (r * SY + v) * W + c * SX + u;
          if (gb[s] > g) { g = gb[s]; gcc = gc[s]; }
          if (fb[s] < 0) continue;
          cnt++; sum += ff[fb[s]] & EMIT ? 1 : lb[s] * ex; if (zb[s] < z) { z = zb[s]; fi = fb[s]; }
        }
        for (let b = 0; b < 8; b++) {
          const s = (r * SY + ((b >> 1) * SY >> 2)) * W + c * SX + ((b & 1) * SX >> 1);
          if (fb[s] < 0) continue;
          bc |= 1 << b;
          if (ff[fb[s]] & EMIT) { be |= 1 << b; continue; }
          const ls = Math.pow(Math.min(1, lb[s] * ex), GAMMA);
          if ((light ? 0.12 + 0.88 * (1 - ls) : ls) > DITHER[b] * DOTS) bd |= 1 << b;
        }
        const q = r * cols + c;
        eb[q] = be;
        cov[q] = cnt / NS; lum[q] = cnt ? sum / cnt : 0; fc[q] = fi; glow[q] = g; gcol[q] = gcc; cb[q] = bc; db[q] = bd;
      }
    }
    yield; buf.stage = 'glyph0';
    // glyphs, tinted per cell with the colour of its face
    const IW = Math.floor(cols * cwF), IH = Math.floor(rows * chF);
    if (!buf.img || buf.img.width < IW || buf.img.height < IH) buf.img = new ImageData(Math.ceil(IW * 1.4), Math.ceil(IH * 1.4));   // headroom: an approaching ship grows every redraw
    const img = buf.img, D = img.data, SW = img.width;
    D.fill(0, 0, IH * SW * 4);
    const strength = light ? INK : INTENSITY, cmin = 1 / NS - 1e-6;
    const on = q => cov[q] >= cmin;
    const g = (arr, c, r) => { c = Math.max(0, Math.min(cols - 1, c)); r = Math.max(0, Math.min(rows - 1, r)); return arr[r * cols + c]; };
    const sobel = (arr, c, r) => [
      g(arr, c + 1, r - 1) + 2 * g(arr, c + 1, r) + g(arr, c + 1, r + 1) - g(arr, c - 1, r - 1) - 2 * g(arr, c - 1, r) - g(arr, c - 1, r + 1),
      g(arr, c - 1, r + 1) + 2 * g(arr, c, r + 1) + g(arr, c + 1, r + 1) - g(arr, c - 1, r - 1) - 2 * g(arr, c, r - 1) - g(arr, c + 1, r - 1)];
    for (let r = 0; r < rows; r++) {
      if ((r & 3) === 3) { yield; buf.stage = 'glyph'; }
      const Y0 = Math.floor(r * chF), CH = Math.floor((r + 1) * chF) - Y0;
      for (let c = 0; c < cols; c++) {
        const q = r * cols + c, hull = on(q), gl = glow[q];
        if (!hull && gl < 0.12) continue;
        let chr, ink, col, a, mk, opaque = hull;
        if (gl > 0.3 || (!hull && gl >= 0.12)) {
          // exhaust: the brightest, most saturated thing on the ship, flickering
          const v = Math.min(1, gl * (0.85 + 0.3 * hash(c, r, flick * 1e3 | 0)));
          chr = FIRE[Math.max(1, Math.min(FIRE.length - 1, Math.round(v * (FIRE.length - 1))))];
          ink = v; col = pal[gcol[q]]; a = Math.min(1, (0.35 + 0.65 * v) * strength * 2);
        } else {
          const fi = fc[q], em = fi >= 0 && (ff[fi] & EMIT);
          let v = em ? 1 : Math.pow(Math.min(1, lum[q]), GAMMA);
          // light theme: ink on paper, darker surface = denser char; glowing parts stay full ink
          ink = light && !em ? 0.12 + 0.88 * (1 - v) : v;
          col = pal[fi >= 0 ? m.fc[fi] : 0];
          // the outline and the faint surfaces: braille dots, one per sample (the outline sharp, the
          // shade dithered), the outline's cells see-through round their dots
          if (em) {   // windows and lights: their own samples as bright dots
            mk = dotm[eb[q]];
            a = Math.min(1, strength * 1.8);
          } else if (cov[q] < 1 || ink < DOTS) {
            mk = dotm[ink >= DOTS ? cb[q] : db[q]];
            a = (0.45 + 0.55 * Math.max(ink, DOTS)) * strength;
            opaque = cov[q] >= 1;
          }
          // edge chars only on sharp creases with a clear change in light
          let edge = false;
          if (!em && !mk) for (let d = 0; d < 4 && !edge; d++) {
            const cc = c + (d === 0 ? 1 : d === 1 ? -1 : 0), rr = r + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            const q2 = rr * cols + cc;
            if (!on(q2)) continue;
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
          if (edge) ink = light ? Math.min(ink, 0.6) : v;
          if (!mk) {
            if (!chr) chr = RAMP[Math.min(RAMP.length - 1, Math.floor((0.06 + 0.94 * ink) * RAMP.length))];
            a = (0.2 + 0.8 * Math.ceil(ink * LEVELS) / LEVELS) * (em ? Math.min(1, strength * 1.8) : strength);
          }
        }
        const X0 = Math.floor(c * cwF), CW = Math.floor((c + 1) * cwF) - X0;
        if (!mk) mk = masks[chr];
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

  // ship->world rotation from a forward vector and a roll around it (0 = top up on screen)
  function frameOf(f, roll) {
    const r = norm(cross(f, [0, -1, 0])), u = cross(r, f), s = cross(f, u);
    const c = Math.cos(roll), sn = Math.sin(roll);
    const U = add(u.map(v => v * c), s, sn), S = add(s.map(v => v * c), u, -sn);
    return [[f[0], U[0], S[0]], [f[1], U[1], S[1]], [f[2], U[2], S[2]]];
  }

  // ---------- canvas ----------
  const cv = document.createElement('canvas');
  cv.id = 'ships';
  cv.setAttribute('aria-hidden', 'true');
  const space = document.getElementById('space');
  if (space) space.after(cv); else document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  let VW = 0, VH = 0;
  function size() {
    VW = innerWidth; VH = innerHeight; F = FOCAL * VH;
    cv.width = Math.round(VW * dpr); cv.height = Math.round(VH * dpr);
  }
  const toWorld = (u, v, z) => [(u - 0.5) * VW * z / F, (v - HORIZON) * VH * z / F, z];

  // ---------- lab ----------
  function runLab() {
    cv.style.zIndex = 10000;
    const q = new URLSearchParams(location.search), ang = parseFloat(q.get('ang')), elev = parseFloat(q.get('elev') || 0.35), px = parseFloat(q.get('size'));
    const t0 = performance.now(), buf = {}, c2 = document.createElement('canvas');
    const B = [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
    (function loop(now) {
      const t = isNaN(ang) ? (now - t0) / 1000 * 0.3 : ang;
      // seen from 3 ship lengths, about as close as a pass gets; the focal length sets the size
      const m = mesh(lab), Z = 3 * m.len;
      F = 3 * (px || Math.min(VW * 0.75, VH * 1.2));
      const spr = finish(render(lab, mul(rx(elev), mul(ry(t), B)), [0, 0, Z], 1, buf, c2, 0.9 + 0.2 * Math.random()));
      ctx.fillStyle = `rgb(${bg})`; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(spr.cvs, Math.round(cv.width / 2 - spr.ax), Math.round(cv.height / 2 - spr.ay));
      if (isNaN(ang)) requestAnimationFrame(loop);
    })(t0);
  }

  // ---------- flight ----------
  const root = document.documentElement;
  const isSmall = () => innerWidth <= 639;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rr = (a, b) => a + (b - a) * rnd();
  const ships = [];
  let group = null, turn = 0, nextAt = FIRST_SPAWN;
  let simT = 0, last = 0, raf = 0, timer = 0, ready = false;
  const cost = [];
  // one set of raster buffers for all ships (only one job is ever half done): they grow once to
  // the biggest sprite instead of every approaching ship reallocating megabytes (the GC spikes)
  const SCRATCH = {};

  // the biggest empty part of the viewport (css px): the page's content (leaf elements, and anything
  // with a background or a border) marked on a grid, then the largest free rectangle, its width
  // counted up to 2.5 heights (a sliver is no room for a ship) and cut to that
  function freeBox() {
    const G = 16, nx = Math.ceil(VW / G), ny = Math.ceil(VH / G), occ = new Uint8Array(nx * ny);
    for (const el of document.body.getElementsByTagName('*')) {
      if (el === cv || el.id === 'space') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= VH || r.right <= 0 || r.left >= VW || r.width * r.height > VW * VH * 0.5) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      const leaf = !el.firstElementChild || /^(IMG|VIDEO|CANVAS|INPUT|BUTTON|TEXTAREA|svg)$/.test(el.tagName) || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!leaf) { const cs = getComputedStyle(el); if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' && cs.borderTopWidth === '0px') continue; }
      for (let y = Math.max(0, Math.floor(r.top / G)); y < Math.min(ny, Math.ceil(r.bottom / G)); y++)
        occ.fill(1, y * nx + Math.max(0, Math.floor(r.left / G)), y * nx + Math.min(nx, Math.ceil(r.right / G)));
    }
    const h = new Uint16Array(nx);
    let best = null, bs = 0;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) h[x] = occ[y * nx + x] ? 0 : h[x] + 1;
      for (let x = 0; x < nx; x++) {   // the widest rectangle as tall as column x, ending on this row
        if (!h[x]) continue;
        let l = x, r = x;
        while (l > 0 && h[l - 1] >= h[x]) l--;
        while (r < nx - 1 && h[r + 1] >= h[x]) r++;
        const w = Math.min(r - l + 1, 2.5 * h[x]), sc = w * h[x];
        if (sc > bs) { bs = sc; best = { x: ((l + r + 1) / 2 - w / 2) * G, y: (y - h[x] + 1) * G, w: w * G, h: h[x] * G }; }
      }
    }
    return best && best.w >= BOX_MIN * VW ? best : { x: 0.04 * VW, y: 0.5 * VH, w: 0.5 * VW, h: 0.46 * VH };
  }
  // a pass: the lead flies two Hermite legs in world space, into the box and away from it, meeting
  // at the box centre with one heading and one speed. The escort drifts round its slot in the
  // lead's frame. Every ship heads where it is going and banks into its turns
  function launch(g) {
    const b = freeBox(), px = Math.min(g.edge * b.w, g.px), zb = F * g.len / px;
    const Pb = toWorld((b.x + b.w / 2) / VW, (b.y + b.h * 0.5) / VH, zb);
    const d = norm([(PATH.vanish[0] - 0.5) * VW / F, (PATH.vanish[1] - HORIZON) * VH / F, 1]);   // the heading whose vanishing point is top right
    const e = norm(PATH.enter), l1 = zb * PATH.lead, P0 = add(Pb, e, -l1), P3 = add(Pb, d, zb * (PATH.depth - 1) / d[2]);
    const m = e, l2 = Math.hypot(...sub(P3, Pb));   // across the box, the turn comes after
    const jit = [rr(-1, 1) * VW, rr(-0.6, 0.6) * VH, 0].map(v => v * g.swing * zb / F);
    // leg 1 runs s = u + (1 - slow)(u - u^2): speed 2 - slow at the start, slow at the end;
    // leg 2 starts at that same speed (a, in its own units) and speeds up as u^ease
    const T1 = g.time * PATH.stay, T2 = g.time - T1, M2 = l2 * 0.5;
    const a = Math.min(1, PATH.slow * l1 / T1 * T2 / M2);
    group = { g, t: 0, box: b, T1, T2, a, legs: [[P0, Pb, e.map(v => v * l1), m.map(v => v * l1)], [Pb, add(P3, jit), m.map(v => v * M2), d.map(v => v * l2)]] };
    const ship = (kind, len, off) => ({ kind, off, k: len / mesh(kind).len, ph: [0, 1, 2].map(() => rnd() * 6.28), w: [0, 1, 2].map(() => rr(0.3, 0.7)),
      buf: SCRATCH, sm: {}, cvs: [document.createElement('canvas'), document.createElement('canvas')], spr: null, job: null, at: null, rect: null });
    if (g.jump) { group.tJ = g.jump * g.time; const w = warp(group.tJ); group.fJ = norm(sub(lead(w + 0.1), lead(w))); }
    ships.push(ship(g.lead, g.len, null), ...g.escort.map(([kind, len, ...off]) => ship(kind, len, off)));
    if (g.jump) ships.forEach((sh, i) => { sh.jt = group.tJ + (i ? JUMP.after[Math.min(i, JUMP.after.length) - 1] + 0.1 * Math.max(0, i - JUMP.after.length) : 0); });
    fly(0);
  }
  const herm = ([p0, p1, m0, m1], s) => { const s2 = s * s, s3 = s2 * s; return [0, 1, 2].map(i => (2 * s3 - 3 * s2 + 1) * p0[i] + (s3 - 2 * s2 + s) * m0[i] + (-2 * s3 + 3 * s2) * p1[i] + (s3 - s2) * m1[i]); };
  // the lead at time t (past either end it keeps going: the headings look a little ahead, the escort trails back)
  function lead(t) {
    const gr = group;
    if (t < gr.T1) { const u = t / gr.T1; return herm(gr.legs[0], u + (1 - PATH.slow) * (u - u * u)); }
    const u = (t - gr.T1) / gr.T2;
    return herm(gr.legs[1], gr.a * u + (1 - gr.a) * Math.pow(u, PATH.ease));
  }
  // path time: with a jump ahead the group brakes, its speed 1 - (1 - idle) u^2 over the brake, then idles
  function warp(t) {
    const gr = group;
    if (!gr.g.jump) return t;
    const B = JUMP.brake, t0 = gr.tJ - B, u = (t - t0) / B, k = (1 - JUMP.idle) / 3;
    return u <= 0 ? t : u <= 1 ? t0 + B * (u - k * u * u * u) : t0 + B * (1 - k) + (t - gr.tJ) * JUMP.idle;
  }
  // how far a ship has charged for its jump, 0-1
  const charge = (sh, t) => sh.jt === undefined ? 0 : Math.max(0, Math.min(1, (t - group.tJ + JUMP.brake) / (sh.jt - group.tJ + JUMP.brake)));
  const boost = sh => 1 + (JUMP.glow - 1) * (sh.ch || 0) ** 2 * (0.65 + 0.35 * Math.sin(group.t * JUMP.pulse * 2 * Math.PI));
  const prog = t => { const u = (t - group.T1) / group.T2; return u <= 0 ? 0 : Math.min(1, group.a * u + (1 - group.a) * Math.pow(u, PATH.ease)); };
  // where a ship is at time t. The escort flies the lead's own track, `ahead` lead lengths along it
  // (a path time found by bisection on the chord), offset up/right in the lead's frame there: in a
  // turn it turns where the lead did. A rigid formation swung the ships behind out like a whip,
  // against the turn, nearly stopping them and flipping their heading and bank. calm: without the drift
  function posAt(sh, t, calm) {
    const g = group.g, tw = warp(t), p = lead(tw);
    let q = p;
    if (sh.off) {
      const d = sh.off.map((o, i) => o + (calm ? 0 : g.sway) * (i === 1 ? 0.6 : 1) * Math.sin(sh.w[i] * tw + sh.ph[i]));   // path time: the drift slows with the group
      const D = Math.abs(d[0]) * g.len, s = Math.sign(d[0]), far = dt => Math.hypot(...sub(lead(tw + s * dt), p)) < D;
      let lo = 0, hi = 0.5;
      while (far(hi) && hi < 64) { lo = hi; hi *= 2; }
      for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (far(m)) lo = m; else hi = m; }
      const ts = tw + s * (lo + hi) / 2, b = lead(ts), R = frameOf(norm(sub(lead(ts + 0.1), b)), 0);
      q = [0, 1, 2].map(i => b[i] + g.len * (R[i][1] * d[1] + R[i][2] * d[2]));
    }
    // the jump: e^x - 1 - x leaves at the speed it had, then runs away exponentially
    if (sh.jt === undefined || t <= sh.jt) return q;
    const x = JUMP.rate * (t - sh.jt);
    return add(q, group.fJ, g.len * JUMP.a * (Math.exp(x) - 1 - x));
  }
  // moves the group on by dt; true once the pass is over
  function fly(dt) {
    const gr = group, g = gr.g, t = (gr.t += dt), q = t / g.time, h = 0.1;
    const fog = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (1 - q) / (1 - FADE))), dim = 1 - FAR_DIM * prog(warp(t));
    for (const sh of ships) {
      sh.fog = fog; sh.dim = dim; sh.ch = charge(sh, t);
      if (sh.jt !== undefined && t > sh.jt) { sh.jump = t - sh.jt; sh.C = posAt(sh, t); sh.px = F * sh.k / sh.C[2]; continue; }   // pose frozen, only moving
      // heading and bank from the track without the drift: near the slow middle of the pass the drift
      // outruns the group, and a nose following it would swing round
      const p = posAt(sh, t), p0 = posAt(sh, t, 1), p1 = posAt(sh, t + h, 1), f = norm(sub(p1, p0)), f1 = norm(sub(posAt(sh, t + 2 * h, 1), p1));
      const S = frameOf(f, 0).map(r => r[2]);
      let roll = Math.max(-1, Math.min(1, BANK * dot(sub(f1, f), S) / h)), fw = f;
      // charging: nose onto the jump heading, wings level
      if (sh.ch) { const k = sh.ch * sh.ch * (3 - 2 * sh.ch); fw = norm(mix(f, gr.fJ, k)); roll *= 1 - k; }
      sh.C = p; sh.f = fw; sh.rl = roll; sh.R = frameOf(fw, roll);
      sh.px = F * sh.k / p[2];
    }
    return q >= 1 || (g.jump && ships.every(sh => sh.jump > JUMP.gone + JUMP.trail));
  }
  function moved(sh) {
    const a = sh.at, d = norm(sh.C), pd = a.d;
    return Math.hypot(sh.f[0] - a.f[0], sh.f[1] - a.f[1], sh.f[2] - a.f[2]) + Math.abs(sh.rl - a.rl) + Math.hypot(d[0] - pd[0], d[1] - pd[1], d[2] - pd[2]);
  }
  // small (far) ships are redrawn on bigger changes: cheap at the back, smooth up front
  const tol = sh => { const l = sh.px * mesh(sh.kind).len; return l < 60 ? 3 : l < 130 ? 1.8 : 1; };
  const stale = sh => !sh.jump && (!sh.at || moved(sh) > RERASTER * tol(sh) || Math.abs(sh.px / sh.at.px - 1) > SCALE_STEP * tol(sh) || Math.abs(boost(sh) - sh.at.b) > 0.35);   // jumping: too fast to redraw, the sprite just shrinks
  function job(sh) {
    // two canvases per ship: the new sprite is written into the one not on screen
    sh.job = render(sh.kind, sh.R, sh.C, sh.k, sh.buf, sh.cvs[sh.spr && sh.spr.cvs === sh.cvs[0] ? 1 : 0], (0.85 + 0.3 * Math.random()) * boost(sh), sh.dim, sh.sm);
    sh.at = { f: sh.f, rl: sh.rl, d: norm(sh.C), px: sh.px, b: boost(sh), R: sh.R, C: sh.C };
  }
  const done = (sh, spr) => { sh.spr = spr; spr.px = sh.at.px; spr.R = sh.at.R; spr.C = sh.at.C; sh.job = null; };
  function paintNow(sh) {
    for (const o of ships) if (o.job) done(o, finish(o.job));   // the half-done job owns the shared buffers
    job(sh); done(sh, finish(sh.job));
  }
  // the hyperspace streak, in glyphs on the page's cell grid: JUMP.lines lines across the ship
  // (spread over its on-screen size, so they close in as it shrinks), each from a point of its own
  // along the last JUMP.trail s to the ship; near the head the stroke that runs along the line
  // (one of | / - \), then : and . fading to the tail
  let atlas = null;
  function glyphAtlas() {
    if (atlas) return atlas;
    const chars = EDGES + ':.', col = pal[COLS.indexOf('glowBlue')], c = document.createElement('canvas');
    c.width = MW * chars.length; c.height = MH;
    const x = c.getContext('2d'), img = x.createImageData(c.width, MH);
    [...chars].forEach((ch, i) => { const m = masks[ch]; for (let y = 0; y < MH; y++) for (let k = 0; k < MW; k++) { const o = (y * c.width + i * MW + k) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = m[y * MW + k]; } });
    x.putImageData(img, 0, 0);
    return (atlas = c);
  }
  function streak(sh) {
    const t = group.t, t0 = Math.max(sh.jt, t - JUMP.trail), fade = Math.min(1, Math.max(0, 1 - (sh.jump - JUMP.gone) / JUMP.trail));
    if (t - t0 < 0.01 || fade <= 0) return;
    const A = glyphAtlas(), N = 16, pts = [], size = [], len = mesh(sh.kind).len;
    for (let i = 0; i <= N; i++) {
      const C = posAt(sh, t0 + (t - t0) * i / N);
      pts.push([(VW / 2 + F * C[0] / C[2]) * dpr, (VH * HORIZON + F * C[1] / C[2]) * dpr]); size.push(F * sh.k * len / C[2] * dpr * 0.3);
    }
    const dx = pts[N][0] - pts[0][0], dy = pts[N][1] - pts[0][1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl;
    const ei = Math.round(((Math.atan2(dx, -dy) * 4 / Math.PI) % 4 + 4) % 4) % 4;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let l = 0; l < JUMP.lines; l++) {
      const o = 2 * l / (JUMP.lines - 1) - 1, h = hash(l, sh.ph[0] * 1e3 | 0, 7), i0 = Math.floor(h * 0.45 * N);
      let last = -1;
      for (let i = i0; i < N; i++) {
        const ax = pts[i][0] + nx * size[i] * o, ay = pts[i][1] + ny * size[i] * o, bx = pts[i + 1][0] + nx * size[i + 1] * o, by = pts[i + 1][1] + ny * size[i + 1] * o;
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax) / cwF, Math.abs(by - ay) / chF)));
        for (let k = 0; k < n; k++) {
          const c = Math.floor((ax + (bx - ax) * k / n) / cwF), r = Math.floor((ay + (by - ay) * k / n) / chF), key = r * 1e5 + c;
          if (key === last) continue;
          last = key;
          const v = Math.pow((i + k / n - i0) / (N - i0), 1.6) * fade * (0.6 + 0.4 * h);
          if (v < 0.04) continue;
          const X = Math.floor(c * cwF), Y = Math.floor(r * chF);
          ctx.globalAlpha = Math.min(1, v * 1.3) * sh.fog;
          ctx.drawImage(A, (v > 0.45 ? ei : v > 0.2 ? 4 : 5) * MW, 0, MW, MH, X, Y, MW, MH);
          if (X < x0) x0 = X; if (Y < y0) y0 = Y; if (X > x1) x1 = X; if (Y > y1) y1 = Y;
        }
      }
    }
    if (x1 < x0) return;
    const r = sh.rect, R = [x0 - 1, y0 - 1, x1 + MW + 1, y1 + MH + 1];
    sh.rect = r ? [Math.min(r[0], R[0]), Math.min(r[1], R[1]), Math.max(r[0] + r[2], R[2]) - Math.min(r[0], R[0]), Math.max(r[1] + r[3], R[3]) - Math.min(r[1], R[1])] : [R[0], R[1], R[2] - R[0], R[3] - R[1]];
  }
  // sprite px -> device px now: [a, b, c, d, e, f] as for setTransform. Least squares over ~48
  // of the hull's vertices, projected with the sprite's pose (sprite px: relative to where its C
  // lands, plus the anchor) and with the pose now
  const NOBEND = /nobend/.test(location.search);   // test: the old way, only slid and scaled
  function bend(sh, C) {
    const sp = sh.spr, R0 = sp.R, C0 = sp.C, R1 = sh.R, k = sh.k, Fd = F * dpr, m = mesh(sh.kind);
    const P = m.p, nv = m.n * 3, step = Math.max(1, Math.floor(nv / 48)), pts = [];
    for (let i = step >> 1; i < nv; i += step) pts.push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const proj = (R, Cw, p) => {
      const X = Cw[0] + k * (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]);
      const Y = Cw[1] + k * (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2]);
      const Z = Math.max(0.5, Cw[2] + k * (R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]));
      return [Fd * X / Z, Fd * Y / Z];
    };
    const ax = Fd * C0[0] / C0[2] - sp.ax, ay = Fd * C0[1] / C0[2] - sp.ay;   // sprite origin in the old projection
    const cx = VW / 2 * dpr, cy = VH * HORIZON * dpr;
    // normal equations for x' = a u + c v + e and y' = b u + d v + f
    let suu = 0, suv = 0, svv = 0, su = 0, sv = 0, n = 0, sxu = 0, sxv = 0, sx = 0, syu = 0, syv = 0, sy = 0;
    for (const p of pts) {
      const o = proj(R0, C0, p), q = proj(R1, C, p), u = o[0] - ax, v = o[1] - ay, X = q[0] + cx, Y = q[1] + cy;
      suu += u * u; suv += u * v; svv += v * v; su += u; sv += v; n++;
      sxu += X * u; sxv += X * v; sx += X; syu += Y * u; syv += Y * v; sy += Y;
    }
    const det = suu * (svv * n - sv * sv) - suv * (suv * n - sv * su) + su * (suv * sv - svv * su);
    const solve = (bu, bv, b1) => [
      (bu * (svv * n - sv * sv) - suv * (bv * n - sv * b1) + su * (bv * sv - svv * b1)) / det,
      (suu * (bv * n - sv * b1) - bu * (suv * n - sv * su) + su * (suv * b1 - bv * su)) / det,
      (suu * (svv * b1 - bv * sv) - suv * (suv * b1 - bv * su) + bu * (suv * sv - svv * su)) / det];
    const [a, c, e] = solve(sxu, sxv, sx), [b, d, f] = solve(syu, syv, sy);
    return [a, b, c, d, e, f];
  }
  function draw(all) {
    if (all) ctx.clearRect(0, 0, cv.width, cv.height);
    else for (const sh of ships) if (sh.rect) ctx.clearRect(...sh.rect);
    // far to near: the nearer hull covers the farther one
    for (const sh of ships.slice().sort((a, b) => b.C[2] - a.C[2])) {
      sh.rect = null;
      if (!sh.spr || sh.fog <= 0.01) continue;
      // the sprite was drawn for one pose (spr.R, spr.C); until the next one is ready (a big ship
      // takes several frames) it is bent onto the pose at C: the affine map that best carries
      // four points of the hull from where they were to where they are now. Turning, the hull
      // turns smoothly instead of in steps; moving, it slides and scales. The cleared rect grows over every copy
      const put = (C, alpha, ox = 0, oy = 0) => {
        const M = NOBEND ? (() => { const k = F * sh.k / C[2] / sh.spr.px; return [k, 0, 0, k, (VW / 2 + F * C[0] / C[2]) * dpr - sh.spr.ax * k, (VH * HORIZON + F * C[1] / C[2]) * dpr - sh.spr.ay * k]; })() : bend(sh, C), w = sh.spr.w, h = sh.spr.h;
        if (Math.abs(M[0] * M[3] - M[1] * M[2]) * w * h < 0.25) return;
        const e = Math.round(M[4]) + ox, f = Math.round(M[5]) + oy;
        ctx.globalAlpha = alpha;
        ctx.setTransform(M[0], M[1], M[2], M[3], e, f);
        ctx.drawImage(sh.spr.cvs, 0, 0, w, h, 0, 0, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        let x = 1e9, y = 1e9, x1 = -1e9, y1 = -1e9;
        for (const [u, v] of [[0, 0], [w, 0], [0, h], [w, h]]) {
          const X = M[0] * u + M[2] * v + e, Y = M[1] * u + M[3] * v + f;
          x = Math.min(x, X); y = Math.min(y, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
        }
        x = Math.floor(x) - 1; y = Math.floor(y) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
        const r = sh.rect;
        sh.rect = r ? [Math.min(r[0], x), Math.min(r[1], y), Math.max(r[0] + r[2], x1) - Math.min(r[0], x), Math.max(r[1] + r[3], y1) - Math.min(r[1], y)] : [x, y, x1 - x, y1 - y];
      };
      if (!sh.jump) {
        if (!sh.ch) { put(sh.C, sh.fog); continue; }
        // charging: trembling (the engines' pulse is in the sprite)
        const j = JUMP.shake * sh.ch * sh.ch * dpr;
        put(sh.C, sh.fog, Math.round(j * Math.sin(group.t * 2 * Math.PI * 9 + sh.ph[0])), Math.round(j * Math.sin(group.t * 2 * Math.PI * 13 + sh.ph[1])));   // two sines: a hum, not per-frame noise
        continue;
      }
      // lightspeed: the glyph streak, the ship at its head
      ctx.globalCompositeOperation = 'lighter';
      streak(sh);
      ctx.globalCompositeOperation = 'source-over';
      if (sh.jump < JUMP.gone) put(sh.C, sh.fog);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!running()) return;
    const t0 = performance.now();
    const dt = last ? Math.max(0, Math.min(DT_MAX, (now - last) / 1000)) : 0;
    last = now; simT += dt;
    if (!group && turn < GROUPS.length && simT >= nextAt) launch(GROUPS[turn++]);   // each group once, then an empty sky
    else if (group && fly(dt)) {
      for (const sh of ships) if (sh.rect) ctx.clearRect(...sh.rect);
      ships.length = 0; group = null; nextAt = simT + rr(...GAP);
    }
    // re-raster: unfinished jobs first, then the ships that changed most, until the budget is spent
    const live = ships.filter(sh => sh.job || stale(sh));
    const pr = sh => sh.job ? 9 : !sh.at ? 8 : moved(sh) + Math.abs(sh.px / sh.at.px - 1) * 2;
    live.sort((a, b) => pr(b) - pr(a));
    for (const sh of live) {
      if (performance.now() - t0 > BUDGET) break;
      if (!sh.job) job(sh);
      let r;
      do r = sh.job.next(); while (!r.done && performance.now() - t0 <= BUDGET);
      if (r.done) done(sh, r.value);
    }
    draw(false);
    cost.push(performance.now() - t0); if (cost.length > 600) cost.shift();
    if (ships.length) raf = requestAnimationFrame(frame); else if (turn < GROUPS.length) sleep();
  }
  // nothing in the sky: no rAF, just a timer until the next group
  function sleep() {
    clearTimeout(timer);
    const at = nextAt;
    timer = setTimeout(() => { simT = Math.max(simT, at); last = 0; kick(); }, Math.max(0, at - simT) * 1000);
  }
  const running = () => ready && !document.hidden;
  function kick() {
    if (raf || !running()) return;
    clearTimeout(timer);
    last = 0; raf = requestAnimationFrame(frame);
  }
  function halt() { cancelAnimationFrame(raf); raf = 0; clearTimeout(timer); }

  function start() {
    readTheme(); buildMasks(isSmall() && !lab ? 1.3 : 1); size();
    if (lab && BUILD[lab]) return runLab();
    Object.keys(BUILD).forEach(mesh);   // build the meshes now, not in the middle of a frame
    // the intro and boot overlays own the screen until the page shows
    const shown = () => !document.getElementById('intro-overlay') && !root.classList.contains('intro')
      && document.querySelector('.container.visible');
    const wait = setInterval(() => { if (shown()) { clearInterval(wait); ready = true; kick(); } }, 250);
    document.addEventListener('visibilitychange', () => document.hidden ? halt() : kick());
    // theme swap happens inside a View Transition: repaint synchronously so the new snapshot is already right
    const repaint = () => { ships.forEach(sh => sh.C && paintNow(sh)); draw(true); };
    document.addEventListener('themechange', () => { readTheme(); repaint(); });
    let rt;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { buildMasks(isSmall() ? 1.3 : 1); size(); repaint(); }, 150); });
    window.ships = {
      stats: () => { const s = [...cost].sort((a, b) => a - b); return { over8: s.filter(v => v > 8).length, frames: s.length, avg: s.reduce((a, b) => a + b, 0) / (s.length || 1), p95: s[Math.floor(s.length * 0.95)] || 0, max: s[s.length - 1] || 0, alive: ships.length }; },
      box: () => group && group.box,
      list: () => ships.map(sh => ({ kind: sh.kind, sx: Math.round(VW / 2 + F * sh.C[0] / sh.C[2]), sy: Math.round(VH * HORIZON + F * sh.C[1] / sh.C[2]), z: +sh.C[2].toFixed(1), px: Math.round(sh.px * mesh(sh.kind).len), fog: +sh.fog.toFixed(2), spr: sh.spr && [sh.spr.w, sh.spr.h], job: !!sh.job, lag: sh.at ? +moved(sh).toFixed(3) : 0, rect: sh.rect })),
      // test hooks: start group i now; run n seconds of 60 fps frames synchronously (a throttled tab would barely advance)
      launch: i => { ctx.clearRect(0, 0, cv.width, cv.height); ships.length = 0; launch(GROUPS[i]); turn = i + 1; kick(); },
      // test: how far (device px) the hull on screen is from where it really is, over 60 vertices (worst, mean)
      err: kind => {
        const sh = ships.find(o => o.kind === kind); if (!sh || !sh.spr || !sh.spr.R) return null;
        const m = mesh(sh.kind), sp = sh.spr, Fd = F * dpr, C = sh.C, k = sh.k;
        const M = NOBEND ? (() => { const q = F * sh.k / C[2] / sp.px; return [q, 0, 0, q, (VW / 2 + F * C[0] / C[2]) * dpr - sp.ax * q, (VH * HORIZON + F * C[1] / C[2]) * dpr - sp.ay * q]; })() : bend(sh, C);
        const pr = (R, Cw, i) => { const P = m.p, p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], X = Cw[0] + k * (R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2]), Y = Cw[1] + k * (R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2]), Z = Math.max(0.5, Cw[2] + k * (R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2])); return [Fd * X / Z, Fd * Y / Z]; };
        let mx = 0, sum = 0; const n = m.n * 3, step = Math.max(1, Math.floor(n / 60));
        for (let i = 0, c = 0; i < n; i += step, c++) {
          const o = pr(sp.R, sp.C, i), u = o[0] - (Fd * sp.C[0] / sp.C[2] - sp.ax), v = o[1] - (Fd * sp.C[1] / sp.C[2] - sp.ay);
          const t = pr(sh.R, C, i), e = Math.hypot(M[0] * u + M[2] * v + M[4] - t[0] - VW / 2 * dpr, M[1] * u + M[3] * v + M[5] - t[1] - VH * HORIZON * dpr);
          mx = Math.max(mx, e); sum += e;
        }
        return [mx, sum / Math.ceil(n / step)];
      },
      step: sec => { let t = last || performance.now(); for (let i = 0; i < sec * 60; i++) { cancelAnimationFrame(raf); raf = 0; frame(t += 1000 / 60); } return ships.length; },
    };
  }
  (document.fonts ? document.fonts.load("600 12px 'JetBrains Mono'").then(() => document.fonts.ready) : Promise.resolve()).then(start, start);
})();
