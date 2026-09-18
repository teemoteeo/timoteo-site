// A-Maze-ing: replays carve_steps + bidirectional BFS layers exported from generator.py / solver.py
(function () {
  const { C, canvas, buttons } = PJ;
  const D = window.AMAZEING_DATA;
  const el = document.getElementById('viz');
  const ratio = (D.h + 1) / (D.w + 1);
  const { ctx, fit } = canvas(el, ratio);
  const phaseEl = document.getElementById('viz-phase');
  let A, walls, step, phase, playing = true, acc = 0, last = 0;
  const N = 1, E = 2, S = 4, W = 8;

  function reset(algo) {
    A = D.algos[algo];
    walls = Array.from({ length: D.h }, () => Array(D.w).fill(15));
    step = 0; phase = 'carve'; acc = 0;
  }
  function apply(s) {
    const [cy, cx, wh, ny, nx, wo] = s;
    walls[cy][cx] &= ~(1 << wh); walls[ny][nx] &= ~(1 << wo);
  }
  function draw() {
    const w = el.clientWidth, h = el.clientHeight;
    const cs = Math.min(w / (D.w + 1), h / (D.h + 1));
    const ox = (w - cs * D.w) / 2, oy = (h - cs * D.h) / 2;
    ctx.clearRect(0, 0, w, h);
    const pat = new Set(A.pattern.map(([x, y]) => x + ',' + y));
    // BFS layers
    if (phase !== 'carve') {
      const upto = phase === 'solve' ? step : A.layers.length;
      for (let i = 0; i < upto; i++) {
        const [side, cells] = A.layers[i];
        ctx.fillStyle = side === 'a' ? 'rgba(91,156,246,0.22)' : 'rgba(224,108,117,0.22)';
        const pad = cs * 0.28;
        for (const [x, y] of cells) ctx.fillRect(ox + x * cs + pad, oy + y * cs + pad, cs - pad * 2, cs - pad * 2);
      }
    }
    for (const k of pat) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillStyle = C.yellow; ctx.globalAlpha = 0.55;
      ctx.fillRect(ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4); ctx.globalAlpha = 1;
    }
    // walls
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) {
      const v = walls[y][x], X = ox + x * cs, Y = oy + y * cs;
      if (v & N) { ctx.moveTo(X, Y); ctx.lineTo(X + cs, Y); }
      if (v & W) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + cs); }
      if (y === D.h - 1 && v & S) { ctx.moveTo(X, Y + cs); ctx.lineTo(X + cs, Y + cs); }
      if (x === D.w - 1 && v & E) { ctx.moveTo(X + cs, Y); ctx.lineTo(X + cs, Y + cs); }
    }
    ctx.stroke();
    // path
    if (phase === 'done') {
      ctx.strokeStyle = C.teal; ctx.lineWidth = Math.max(2, cs * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      A.path.forEach(([x, y], i) => {
        const px = ox + (x + .5) * cs, py = oy + (y + .5) * cs;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    // entry / exit
    const mark = ([x, y], col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + (x + .5) * cs, oy + (y + .5) * cs, cs * 0.28, 0, Math.PI * 2); ctx.fill(); };
    mark(D.entry, C.blue); mark(D.exit, C.red);
    const labels = {
      carve: `carving · ${step}/${A.carve.length} walls removed`,
      solve: `bidirectional bfs · layer ${step}/${A.layers.length}`,
      done: `shortest path · ${A.path.length} cells`,
    };
    phaseEl.textContent = labels[phase];
  }
  function tick(dt) {
    acc += dt;
    const rate = { carve: 6, solve: 45, done: 1800 }[phase];
    while (acc > rate) {
      acc -= rate;
      if (phase === 'carve') {
        if (step < A.carve.length) { apply(A.carve[step]); step += 1; }
        else { phase = 'solve'; step = 0; }
      } else if (phase === 'solve') {
        if (step < A.layers.length) step++; else { phase = 'done'; step = A.path.length; }
      } else { reset(cur); }
    }
  }
  let cur = 'DFS';
  function frame(now) {
    const dt = last ? now - last : 0; last = now;
    if (playing) { tick(dt); draw(); }
    requestAnimationFrame(frame);
  }
  buttons(document.getElementById('viz-algo'),
    ['DFS', 'PRIM', 'KRUSKAL'].map(k => ({ label: k.toLowerCase(), k })),
    it => { cur = it.k; reset(cur); draw(); });
  const pb = document.getElementById('viz-play');
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? 'pause' : 'play'; };
  document.getElementById('viz-skip').onclick = () => {
    A.carve.slice(step).forEach(apply); phase = 'done'; step = 0; draw();
  };
  window.addEventListener('resize', () => { fit(); draw(); });
  reset(cur); fit(); draw();
  requestAnimationFrame(frame);
})();
