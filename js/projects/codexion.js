// Codexion: replays real ./codexion logs.
// The log only says "has taken a dongle"; which one is deterministic from the code:
// coder i (0-based) owns dongles i and (i+1)%n and always locks the lower index first.
(function () {
  const { C, canvas, buttons } = PJ;
  const D = window.CODEXION_DATA;
  const tableEl = document.getElementById('viz');
  const ganttEl = document.getElementById('viz-gantt');
  const T = canvas(tableEl, w => w < 600 ? 1.0 : 0.62);
  const G = canvas(ganttEl, w => 0); // height set per scenario
  const logEl = document.getElementById('viz-log');
  const cmdEl = document.getElementById('viz-cmd');
  const outEl = document.getElementById('viz-outcome');
  let sc, M, t = 0, end = 0, playing = true, last = 0;
  const SPEED = 0.3;

  const COL = { wait: C.yellow, compile: C.teal, debug: C.blue, refactor: C.violet, burn: C.red, done: C.muted, idle: C.muted };
  const LABEL = { wait: 'waiting', compile: 'compiling', debug: 'debugging', refactor: 'refactoring', burn: 'burned out', done: 'done', idle: '' };

  // ---------- model built from the log ----------
  function build(s) {
    const n = s.n;
    const coders = Array.from({ length: n }, () => ({ segs: [], takes: [], burn: null, compiles: [] }));
    const dongles = Array.from({ length: n }, () => ({ holds: [] })); // {coder, from, to}
    const taken = Array.from({ length: n }, () => 0);
    const open = Array.from({ length: n }, () => []); // open holds per coder
    const lines = [];
    const cursor = Array.from({ length: n }, () => ({ state: 'wait', since: 0 }));
    const close = (i, ts) => { const c = cursor[i]; if (ts > c.since) coders[i].segs.push([c.state, c.since, ts]); };
    for (const [ts, id, msg] of s.log) {
      const i = id - 1, left = i, right = (i + 1) % n;
      const lo = Math.min(left, right), hi = Math.max(left, right);
      let text = msg;
      if (msg === 'has taken a dongle') {
        const d = taken[i] % 2 === 0 ? lo : hi; taken[i]++;
        const h = { coder: i, from: ts, to: Infinity };
        dongles[d].holds.push(h); open[i].push(h); coders[i].takes.push([d, ts]);
        text = `has taken dongle d${d}`;
      } else if (msg === 'is compiling') {
        close(i, ts); cursor[i] = { state: 'compile', since: ts }; coders[i].compiles.push(ts);
      } else if (msg === 'is debugging') {
        close(i, ts); cursor[i] = { state: 'debug', since: ts };
        open[i].forEach(h => h.to = ts); open[i] = []; taken[i] = 0;
        text = `is debugging  · releases d${lo}, d${hi}`;
      } else if (msg === 'is refactoring') {
        close(i, ts); cursor[i] = { state: 'refactor', since: ts };
        const endRef = ts + s.refactor;
        coders[i].segs.push(['refactor', ts, endRef]);
        const done = coders[i].compiles.length >= s.required;
        cursor[i] = { state: done ? 'done' : 'wait', since: endRef };
      } else if (msg === 'burned out') {
        close(i, ts); coders[i].burn = ts; cursor[i] = { state: 'burn', since: ts };
      }
      lines.push([ts, id, text, msg]);
    }
    const stop = s.log[s.log.length - 1][0];
    const burned = coders.some(c => c.burn !== null);
    const horizon = burned ? stop + 150 : Math.max(stop + s.refactor, ...coders.map(c => c.segs.length ? c.segs[c.segs.length - 1][2] : 0)) + 50;
    if (burned) coders.forEach(c => { c.segs = c.segs.filter(sg => sg[1] < stop).map(([st, x, y]) => [st, x, Math.min(y, stop)]); });
    for (let i = 0; i < n; i++) {
      const c = cursor[i];
      if (c.state !== 'done' && c.state !== 'burn') close(i, burned ? stop : horizon);
      open[i].forEach(h => h.to = burned ? stop : horizon);
    }
    return { coders, dongles, lines, horizon, burned, stop };
  }

  function coderState(i, time) {
    const c = M.coders[i];
    if (c.burn !== null && time >= c.burn) return 'burn';
    for (const [st, a, b] of c.segs) if (time >= a && time < b) return st;
    const lastSeg = c.segs[c.segs.length - 1];
    if (lastSeg && time >= lastSeg[2]) return M.burned ? 'idle' : 'done';
    return 'wait';
  }
  function dongleState(d, time) {
    for (const h of M.dongles[d].holds) {
      if (time >= h.from && time < h.to) return { held: h.coder, k: Math.min(1, (time - h.from) / 90) };
      if (time >= h.to && time < h.to + sc.cooldown && h.to < M.stop) return { cool: 1 - (time - h.to) / sc.cooldown, by: h.coder, k: Math.max(0, 1 - (time - h.to) / 90) };
    }
    return { free: true };
  }

  // ---------- table ----------
  function drawTable() {
    const { ctx } = T; const w = tableEl.clientWidth, h = tableEl.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const n = sc.n, cx = w / 2, cy = h / 2 + 4;
    const R = Math.min(w, h) * (w < 600 ? 0.34 : 0.37);
    const rD = R * 0.58;
    const ang = i => i / n * Math.PI * 2 - Math.PI / 2;
    const cpos = i => [cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R];
    // table
    ctx.strokeStyle = C.border2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rD + 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'center';
    ctx.fillText(sc.sched.toUpperCase(), cx, cy - 6);
    ctx.fillStyle = C.dim; ctx.fillText(`${Math.floor(t)} ms`, cx, cy + 10);

    // dongles (drawn under coders): coder i sits between dongle i-1 and i
    for (let d = 0; d < n; d++) {
      const a = (d - 0.5) / n * Math.PI * 2 - Math.PI / 2; // dongle d sits between coder d-1 and coder d (0-based)
      const rest = [cx + Math.cos(a) * rD, cy + Math.sin(a) * rD];
      const s = dongleState(d, t);
      const pos = rest;
      let col = C.muted, fill = C.bg2;
      if (s.held !== undefined) {
        const [px, py] = cpos(s.held);
        col = coderState(s.held, t) === 'compile' ? C.teal : C.yellow;
        // usage line: from the dongle to the coder's ring
        const dx = px - rest[0], dy = py - rest[1], len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rest[0] + ux * 14, rest[1] + uy * 14); ctx.lineTo(px - ux * 25, py - uy * 25); ctx.stroke();
        ctx.lineCap = 'butt';
      } else if (s.cool !== undefined) {
        col = C.red;
      }
      ctx.save(); ctx.translate(pos[0], pos[1]); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = fill; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      roundRect(ctx, -6, -11, 12, 22, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(-3, -15, 6, 4);
      ctx.restore();
      ctx.fillStyle = s.free ? C.muted : col; ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lr = rD - 26, lx = cx + Math.cos(a) * lr, ly = cy + Math.sin(a) * lr;
      ctx.fillText('d' + d, lx, ly); ctx.textBaseline = 'alphabetic';
    }
    // coders
    for (let i = 0; i < n; i++) {
      const [x, y] = cpos(i), st = coderState(i, t), col = COL[st];
      const lastC = [0, ...M.coders[i].compiles].filter(v => v <= t).pop();
      const frac = st === 'burn' ? 1 : (st === 'done' || st === 'idle') ? 0 : Math.min(1, (t - lastC) / sc.burnout);
      ctx.lineWidth = 3; ctx.strokeStyle = C.border;
      ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = frac > 0.75 ? C.red : C.muted;
      ctx.beginPath(); ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.font = '500 11px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y); ctx.textBaseline = 'alphabetic';
      const ca = Math.cos(ang(i)), sa = Math.sin(ang(i));
      let lx, ly;
      if (w < 600) { ctx.textAlign = 'center'; lx = x; ly = sa < -0.3 ? y - 28 : y + 36; }
      else {
        ctx.textAlign = Math.abs(ca) < 0.3 ? 'center' : ca > 0 ? 'left' : 'right';
        lx = x + ca * 30; ly = y + sa * 34 + (Math.abs(ca) < 0.3 ? (sa < 0 ? -4 : 8) : 3);
      }
      ctx.fillStyle = col; ctx.font = '10px JetBrains Mono'; ctx.fillText(LABEL[st], lx, ly);
    }
  }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------- timeline ----------
  const ROW = 18, TOP = 22, LEFT = 34;
  function ganttSize() { return TOP + sc.n * ROW + 10; }
  function xOf(time, w) { return LEFT + time / M.horizon * (w - LEFT - 12); }
  function drawGantt() {
    const { ctx } = G; const w = ganttEl.clientWidth, h = ganttEl.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '9px JetBrains Mono'; ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    const step = M.horizon > 1200 ? 250 : 100;
    for (let v = 0; v <= M.horizon; v += step) {
      const x = xOf(v, w);
      ctx.fillText(v, x, 11);
      ctx.strokeStyle = C.border; ctx.beginPath(); ctx.moveTo(x, TOP - 4); ctx.lineTo(x, h - 6); ctx.stroke();
    }
    for (let i = 0; i < sc.n; i++) {
      const y = TOP + i * ROW;
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText('c' + (i + 1), LEFT - 8, y + 12);
      for (const [st, a, b] of M.coders[i].segs) {
        const x0 = xOf(a, w), x1 = xOf(b, w);
        ctx.fillStyle = COL[st];
        ctx.globalAlpha = st === 'wait' ? 0.18 : 0.85;
        ctx.fillRect(x0, y + 3, Math.max(1, x1 - x0), ROW - 6);
        ctx.globalAlpha = 1;
      }
      // holding one dongle while waiting: solid yellow underline
      const holds = M.dongles.flatMap(d => d.holds).filter(hh => hh.coder === i);
      for (const hh of holds) {
        const comp = M.coders[i].segs.find(([st, a]) => st === 'compile' && a >= hh.from);
        const until = comp ? Math.min(comp[1], hh.to) : hh.to;
        if (until > hh.from) { ctx.fillStyle = C.yellow; ctx.fillRect(xOf(hh.from, w), y + ROW - 5, xOf(until, w) - xOf(hh.from, w), 2); }
      }
      if (M.coders[i].burn !== null) {
        const x = xOf(M.coders[i].burn, w);
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x, y + ROW / 2, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    const px = xOf(Math.min(t, M.horizon), w);
    ctx.strokeStyle = C.fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, TOP - 6); ctx.lineTo(px, h - 4); ctx.stroke();
  }

  function drawLog() {
    const shown = M.lines.filter(l => l[0] <= t).slice(-9);
    logEl.innerHTML = shown.map(([ts, id, text, raw], k) =>
      `<div class="${raw === 'burned out' ? 'bad' : ''}${k === shown.length - 1 ? ' now' : ''}"><span>${String(ts).padStart(4, ' ')}</span> ${id} ${text}</div>`).join('');
  }
  function draw() { drawTable(); drawGantt(); drawLog(); }

  function frame(now) {
    const dt = last ? now - last : 0; last = now;
    if (playing) {
      t += dt * SPEED;
      if (t > M.horizon + 600) t = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }
  function resize() {
    T.fit();
    const w = ganttEl.parentElement.clientWidth, d = window.devicePixelRatio || 1, h = ganttSize();
    ganttEl.width = w * d; ganttEl.height = h * d; ganttEl.style.height = h + 'px';
    G.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function load(s) {
    sc = s; M = build(s); t = 0;
    cmdEl.textContent = s.args;
    outEl.textContent = M.burned
      ? `coder ${M.coders.findIndex(c => c.burn !== null) + 1} burned out at ${M.stop} ms`
      : `all ${s.n} coders compiled ${s.required}× · no burnout`;
    outEl.style.color = M.burned ? C.red : C.teal;
    resize(); draw();
  }
  // scrub by clicking / dragging the timeline
  let dragging = false;
  const scrub = e => {
    const r = ganttEl.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    t = Math.max(0, Math.min(M.horizon, (x - LEFT) / (r.width - LEFT - 12) * M.horizon));
    draw();
  };
  ganttEl.addEventListener('pointerdown', e => { dragging = true; playing = false; pb.textContent = 'play'; scrub(e); });
  window.addEventListener('pointermove', e => { if (dragging) scrub(e); });
  window.addEventListener('pointerup', () => dragging = false);

  buttons(document.getElementById('viz-scn'), D.scenarios, load);
  const pb = document.getElementById('viz-play');
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? 'pause' : 'play'; };
  window.addEventListener('resize', () => { resize(); draw(); });
  load(D.scenarios[0]);
  requestAnimationFrame(frame);
})();
