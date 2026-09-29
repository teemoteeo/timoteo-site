// Fly-In: replays the real turn log of every map in the project's data/maps
(function () {
  const { C, canvas } = PJ;
  const MAPS = window.FLYIN_MAPS;
  const el = document.getElementById('viz');
  const sel = document.getElementById('viz-map');
  const turnEl = document.getElementById('viz-turn');
  const lineEl = document.getElementById('viz-line');
  const noteEl = document.getElementById('viz-cmd');
  const ZONE = { normal: C.blue, restricted: C.red, priority: C.teal, blocked: C.muted };
  let D, names, box, states, total, ratio, fit, ctx, P;
  let playing = true, last = 0, t = 0;
  const TURN_MS = 900;

  // map picker, grouped by difficulty like the repo folders
  const groups = {};
  MAPS.forEach((m, i) => { (groups[m.level] = groups[m.level] || []).push([m, i]); });
  sel.innerHTML = Object.entries(groups).map(([lvl, ms]) =>
    `<optgroup label="${lvl}">${ms.map(([m, i]) => `<option value="${i}">${m.name} · ${m.drones} drones</option>`).join('')}</optgroup>`).join('');
  // desktop: the same maps as a list in the column on the left
  const list = document.getElementById('viz-maps');
  list.innerHTML = Object.entries(groups).map(([lvl, ms]) =>
    `<span class="lv">${lvl}</span>` + ms.map(([m, i]) => `<button type="button" data-i="${i}">${m.name}<i>${m.drones}</i></button>`).join('')).join('');
  list.onclick = e => { const b = e.target.closest('button'); if (b) { sel.value = b.dataset.i; load(+b.dataset.i); } };
  const DEFAULT = Math.max(0, MAPS.findIndex(m => m.id === 'hard/01_maze_nightmare'));

  function load(i) {
    D = MAPS[i]; i = +i;
    names = Object.keys(D.hubs);
    const xs = names.map(n => D.hubs[n].x), ys = names.map(n => D.hubs[n].y);
    box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    // canvas height follows the shape of the map
    ratio = Math.min(0.9, Math.max(0.32, ((box.y1 - box.y0) + 1.2) / ((box.x1 - box.x0) + 1.2)));
    states = [];
    const cur = {};
    for (let d = 1; d <= D.drones; d++) cur['D' + d] = [D.start];
    states.push({ ...cur });
    for (const moves of D.turns) {
      for (const [id, ...where] of moves) cur[id] = where;
      states.push({ ...cur });
    }
    total = D.turns.length;
    turnEl.max = total; t = 0;
    list.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    document.getElementById('viz-name').textContent = `${D.level} · ${D.name} · ${D.drones} drones`;
    noteEl.textContent = `python -m src data/maps/${D.id}.txt`;
    document.getElementById('viz-stats').textContent = `${total} turns, path cost ${D.cost}`;
    ({ ctx, fit } = canvas(el, w => (w < 600 ? Math.max(ratio, 0.6) : ratio)));
    fit(); project(); draw();
  }

  function project() {
    const w = el.clientWidth, h = el.clientHeight, pad = names.length > 40 ? 24 : 44;
    const sx = (w - pad * 2) / Math.max(1, box.x1 - box.x0), sy = (h - pad * 2) / Math.max(1, box.y1 - box.y0);
    const s = Math.min(sx, box.y1 === box.y0 ? sx : sy);
    const ox = (w - (box.x1 - box.x0) * s) / 2, oy = (h - (box.y1 - box.y0) * s) / 2;
    P = n => { const hb = D.hubs[n]; return [ox + (hb.x - box.x0) * s, oy + (hb.y - box.y0) * s]; };
    P.s = s;
  }
  function pos(where) {
    if (where.length === 1) return P(where[0]);
    const a = P(where[0]), b = P(where[1]);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function draw() {
    const w = el.clientWidth, h = el.clientHeight;
    const big = names.length > 40, r = Math.max(4, Math.min(11, P.s * 0.28));
    // zone names only when there is room for them, otherwise just start and goal
    const labels = !big && P.s >= 78;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1; ctx.strokeStyle = C.border2;
    for (const [a, b] of D.edges) {
      const p = P(a), q = P(b);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    const k = Math.min(Math.floor(t), total), f = t - Math.floor(t);
    const A = states[k], B = states[Math.min(k + 1, total)];
    const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    ctx.textAlign = 'center';
    for (const n of names) {
      const hb = D.hubs[n], [x, y] = P(n);
      const special = hb.role !== 'hub';
      const col = special ? (hb.role === 'start_hub' ? C.green : C.yellow) : ZONE[hb.zone];
      const rr = special ? r + 4 : r;
      ctx.fillStyle = C.bg2; ctx.strokeStyle = col; ctx.lineWidth = special ? 2 : 1.25;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (hb.zone === 'blocked') { ctx.beginPath(); ctx.moveTo(x - rr * .6, y - rr * .6); ctx.lineTo(x + rr * .6, y + rr * .6); ctx.stroke(); }
      if (labels || special) {
        ctx.fillStyle = C.muted; ctx.font = '9.5px JetBrains Mono';
        const tw = ctx.measureText(n).width / 2 + 4;   // keep labels inside the canvas
        ctx.fillText(n, Math.min(w - tw, Math.max(tw, x)), y - rr - 6);
        if (labels && !special && hb.cap > 1) ctx.fillText('×' + hb.cap, x, y + rr + 13);
      }
    }
    const groupsAt = {};
    for (let d = 1; d <= D.drones; d++) {
      const id = 'D' + d;
      const p0 = pos(A[id]), p1 = pos(B[id]);
      const x = p0[0] + (p1[0] - p0[0]) * ease, y = p0[1] + (p1[1] - p0[1]) * ease;
      const key = Math.round(x / 6) + ':' + Math.round(y / 6);
      (groupsAt[key] = groupsAt[key] || []).push([x, y, B[id]]);
    }
    const dr = big ? 2.2 : 3.2;
    for (const g of Object.values(groupsAt)) {
      const n = Math.min(g.length, 7);
      g.forEach(([x, y, where], i) => {
        const off = ((i % n) - (n - 1) / 2) * (dr * 2.2), row = Math.floor(i / n) * dr * 2.2;
        const done = where.length === 1 && where[0] === D.end;
        ctx.fillStyle = done ? C.muted : where.length === 2 ? C.red : C.teal;
        ctx.beginPath(); ctx.arc(x + off, y + row, dr, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.textAlign = 'left'; ctx.fillStyle = C.dim; ctx.font = '11px JetBrains Mono';
    ctx.fillText(`turn ${Math.min(k + (f > 0 ? 1 : 0), total)} / ${total}`, 14, h - 12);
    const moves = D.turns[Math.min(k, total - 1)] || [];
    const txt = moves.map(m => m.length === 3 ? `${m[0]}-${m[1]}-${m[2]}` : m.join('-')).join(' ');
    lineEl.textContent = `Turn ${String(Math.min(k + 1, total)).padStart(2)}: ` + (txt.length > 220 ? txt.slice(0, 220) + ' …' : txt);
    turnEl.value = t;
  }

  function frame(now) {
    const dt = last ? now - last : 0; last = now;
    if (playing) { t += dt / TURN_MS; if (t > total + 1.2) t = 0; draw(); }
    requestAnimationFrame(frame);
  }
  const pb = document.getElementById('viz-play');
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? 'pause' : 'play'; };
  turnEl.oninput = () => { t = +turnEl.value; draw(); };
  sel.onchange = () => load(+sel.value);
  window.addEventListener('resize', () => { fit(); project(); draw(); });
  sel.value = DEFAULT; load(DEFAULT);
  requestAnimationFrame(frame);
})();
