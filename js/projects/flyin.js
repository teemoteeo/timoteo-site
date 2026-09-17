// Fly-In: replays the real turn log of hard_01.map
(function () {
  const { C, canvas } = PJ;
  const D = window.FLYIN_DATA;
  const el = document.getElementById('viz');
  const { ctx, fit } = canvas(el, w => w < 600 ? 0.8 : 0.5);
  const turnEl = document.getElementById('viz-turn');
  const lineEl = document.getElementById('viz-line');
  let playing = true, last = 0, t = 0; // t in turns (float)
  const TURN_MS = 900;

  const names = Object.keys(D.hubs);
  const xs = names.map(n => D.hubs[n].x), ys = names.map(n => D.hubs[n].y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const ZONE = { normal: C.blue, restricted: C.red, priority: C.teal, blocked: C.muted };

  // positions after each turn: {drone: [zone] | [from, to]}
  const states = [];
  let cur = {};
  for (let d = 1; d <= D.drones; d++) cur['D' + d] = ['hub'];
  states.push(JSON.parse(JSON.stringify(cur)));
  for (const moves of D.turns) {
    for (const [id, ...where] of moves) cur[id] = where;
    states.push(JSON.parse(JSON.stringify(cur)));
  }
  const total = D.turns.length;
  turnEl.max = total;

  let P;
  function project() {
    const w = el.clientWidth, h = el.clientHeight, pad = 48;
    P = n => {
      const hb = D.hubs[n];
      return [pad + (hb.x - minX) / (maxX - minX) * (w - pad * 2),
              pad + (hb.y - minY) / (maxY - minY || 1) * (h - pad * 2)];
    };
  }
  function pos(where) {
    if (where.length === 1) return P(where[0]);
    const a = P(where[0]), b = P(where[1]);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function draw() {
    const w = el.clientWidth, h = el.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1; ctx.strokeStyle = C.border2;
    for (const [a, b] of D.edges) {
      const p = P(a), q = P(b);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    const k = Math.min(Math.floor(t), total), f = t - Math.floor(t);
    const A = states[k], B = states[Math.min(k + 1, total)];
    const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const occ = {};
    for (const id in B) { const z = B[id].length === 1 ? B[id][0] : null; if (z) occ[z] = (occ[z] || 0) + 1; }
    for (const n of names) {
      const hb = D.hubs[n], [x, y] = P(n);
      const special = hb.role !== 'hub';
      const col = special ? (hb.role === 'start_hub' ? C.green : C.yellow) : ZONE[hb.zone];
      ctx.fillStyle = C.bg2; ctx.strokeStyle = col; ctx.lineWidth = special ? 2 : 1.25;
      ctx.beginPath(); ctx.arc(x, y, special ? 15 : 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.font = '9.5px JetBrains Mono'; ctx.textAlign = 'center';
      ctx.fillText(n, x, y - (special ? 22 : 17));
      if (!special && hb.cap > 1) { ctx.fillStyle = C.muted; ctx.fillText('×' + hb.cap, x, y + 24); }
    }
    // drones: group co-located to offset
    const groups = {};
    for (let d = 1; d <= D.drones; d++) {
      const id = 'D' + d;
      const p0 = pos(A[id]), p1 = pos(B[id]);
      const x = p0[0] + (p1[0] - p0[0]) * ease, y = p0[1] + (p1[1] - p0[1]) * ease;
      const key = Math.round(x / 6) + ':' + Math.round(y / 6);
      (groups[key] = groups[key] || []).push([id, x, y, B[id]]);
    }
    for (const g of Object.values(groups)) {
      g.forEach(([id, x, y, where], i) => {
        const off = (i - (g.length - 1) / 2) * 7;
        const done = where.length === 1 && where[0] === 'goal';
        const flying = where.length === 2;
        ctx.fillStyle = done ? C.muted : flying ? C.red : C.teal;
        ctx.beginPath(); ctx.arc(x + off, y, 3.2, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.textAlign = 'left'; ctx.fillStyle = C.dim; ctx.font = '11px JetBrains Mono';
    ctx.fillText(`turn ${Math.min(k + (f > 0 ? 1 : 0), total)} / ${total}`, 14, h - 14);
    const moves = D.turns[Math.min(k, total - 1)] || [];
    lineEl.textContent = `Turn ${String(Math.min(k + 1, total)).padStart(2)}: ` + moves.map(m => m.join('-')).join(' ');
    turnEl.value = t;
  }

  function frame(now) {
    const dt = last ? now - last : 0; last = now;
    if (playing) {
      t += dt / TURN_MS;
      if (t > total + 1.2) t = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }
  const pb = document.getElementById('viz-play');
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? 'pause' : 'play'; };
  turnEl.oninput = () => { t = +turnEl.value; draw(); };
  window.addEventListener('resize', () => { fit(); project(); draw(); });
  fit(); project(); draw();
  if (PJ.reduced) { playing = false; pb.textContent = 'play'; }
  requestAnimationFrame(frame);
})();
