// footprint: eleven years of my own data exports, aggregated.
// Data: js/projects/data/footprint.js (window.FOOTPRINT), made by
// scripts/export_public.py. Aggregates only, no names, no coordinates.
(function () {
  const D = window.FOOTPRINT, C = PJ.C;
  if (!D) return;
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('en-US');
  const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mlabel = m => MON[+m.slice(5) - 1] + ' ' + m.slice(0, 4);
  const rd = (s, w) => `<span class="rd">${s || '█'.repeat(w || 8)}</span>`;

  const SRC = [
    { k: 'sp', name: 'spotify', col: C.green },
    { k: 'ig', name: 'instagram', col: C.red },
    { k: 'yt', name: 'youtube', col: C.yellow },
    { k: 'gs', name: 'google search', col: C.blue },
    { k: 'gm', name: 'google maps', col: C.teal },
  ];
  const CITY_COL = { Udine: C.blue, Milan: C.yellow, Paris: C.red, Florence: C.teal };
  const cityCol = c => CITY_COL[c] || C.violet;

  const M = D.months;
  const tot = m => m.sp + m.ig + m.yt + m.gs + m.gm;
  D.phases.forEach((p, i) => { p.label = ['first phone', 'music first', 'the social peak', 'on the move'][i]; });
  const phaseOf = m => D.phases.findIndex(p => m >= p.start && m <= p.end);
  const year = y => D.music.find(x => x.y === y);

  // ---------- stats ----------
  $('fp-events').textContent = fmt(D.totals.events) + ' events';
  const contacts = Math.max(...D.social.map(s => s.contacts));
  $('fp-stats').innerHTML = [
    [fmt(D.totals.events), 'events'],
    [M.length, 'months'],
    [fmt(D.others ? D.others.people : contacts), 'DM conversations'],
    ['0', 'other people named here'],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');

  // ---------- derived facts ----------
  // stable moves: a city that stays dominant for 3+ consecutive months
  const moves = [];
  for (let i = 0; i < M.length; i++) {
    const c = M[i].city; if (!c) continue;
    let run = 0;
    for (let j = i; j < M.length && run < 3; j++) { if (M[j].city === c) run++; else if (M[j].city) break; }
    const last = moves[moves.length - 1];
    if (run >= 3 && (!last || last.city !== c)) moves.push({ city: c, m: M[i].m });
  }
  const dev = D.devices;
  const phoneAt = m => {
    const c = dev.filter(d => m >= d.from && m <= d.to && !/MacBook|PlayStation|PC|Linux/.test(d.name));
    c.sort((a, b) => b.n - a.n);
    if (!c[0]) return '—';
    // Spotify stops logging the model in late 2022; the last phone (iPhone 16, out Sep 2024) is supplied by me
    if (/hidden/.test(c[0].name)) return m >= '2024-09' ? 'iPhone 16' : 'iPhone (model not logged)';
    return c[0].name;
  };

  // ---------- timeline: map + volume strip ----------
  const G = D.grid, BASE = window.FP_BASE;
  const tlC = $('tl'), tl = PJ.canvas(tlC, w => (w < 520 ? 104 : 116) / w);
  const mpC = $('mp'), mp = PJ.canvas(mpC, w => (w < 700 ? 1.05 : 0.64));
  let cur = M.length - 1, W = 0, H = 0;
  const pad = { l: 8, r: 8, t: 20, b: 34 };
  const maxT = Math.max(...M.map(tot));
  const xOf = i => pad.l + (i + 0.5) * (W - pad.l - pad.r) / M.length;

  function drawTL() {
    ({ w: W, h: H } = tl.fit());
    const ctx = tl.ctx, ph = H - pad.t - pad.b, cw = (W - pad.l - pad.r) / M.length;
    const y = v => pad.t + ph - (v / maxT) * ph;
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px JetBrains Mono, monospace';
    D.phases.forEach((p, k) => {
      const a = M.findIndex(m => m.m >= p.start), b = M.map(m => m.m <= p.end).lastIndexOf(true);
      const x0 = pad.l + a * cw, x1 = pad.l + (b + 1) * cw;
      if (k % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(x0, pad.t - 14, x1 - x0, ph + 14); }
      ctx.strokeStyle = C.border2; ctx.beginPath(); ctx.moveTo(x0 + .5, pad.t - 14); ctx.lineTo(x0 + .5, pad.t + ph); ctx.stroke();
      ctx.fillStyle = phaseOf(M[cur].m) === k ? C.fg : C.muted;
      const full = '0' + (k + 1) + ' ' + p.label;
      ctx.fillText(ctx.measureText(full).width < x1 - x0 - 10 ? full : '0' + (k + 1), x0 + 5, pad.t - 4);
    });
    const base = M.map(() => 0);
    SRC.forEach(s => {
      ctx.beginPath();
      M.forEach((m, i) => { const v = base[i] + m[s.k]; i ? ctx.lineTo(xOf(i), y(v)) : ctx.moveTo(xOf(i), y(v)); });
      for (let i = M.length - 1; i >= 0; i--) ctx.lineTo(xOf(i), y(base[i]));
      ctx.closePath(); ctx.globalAlpha = .45; ctx.fillStyle = s.col; ctx.fill(); ctx.globalAlpha = 1;
      M.forEach((m, i) => { base[i] += m[s.k]; });
    });
    // dim the future
    const cx = Math.round(xOf(cur)) + .5;
    ctx.fillStyle = 'rgba(14,13,16,0.55)'; ctx.fillRect(cx + cw / 2, pad.t - 14, W - cx, ph + 14);
    const sy = pad.t + ph + 5;
    M.forEach((m, i) => {
      ctx.fillStyle = m.city ? cityCol(m.city) : 'rgba(255,255,255,0.05)';
      ctx.globalAlpha = m.city ? (i <= cur ? .9 : .3) : 1;
      ctx.fillRect(pad.l + i * cw, sy, Math.max(1, cw - .5), 5);
    });
    ctx.globalAlpha = 1; ctx.fillStyle = C.muted;
    M.forEach((m, i) => {
      if (m.m.endsWith('-01')) {
        const yr = m.m.slice(0, 4);
        if (W < 520 && +yr % 2) return;
        ctx.fillText(W < 520 ? "'" + yr.slice(2) : yr, pad.l + i * cw, H - 6);
      }
    });
    ctx.strokeStyle = C.fg; ctx.beginPath(); ctx.moveTo(cx, pad.t - 14); ctx.lineTo(cx, sy + 5); ctx.stroke();
    ctx.fillStyle = C.fg; ctx.beginPath(); ctx.arc(cx, y(tot(M[cur])), 3, 0, 7); ctx.fill();
  }
  $('tl-legend').innerHTML = SRC.map(s => `<span class="lg"><i style="background:${s.col};opacity:.7"></i>${s.name}</span>`).join('')
    + '<span class="grow"></span>'
    + Object.keys(CITY_COL).map(c => `<span class="lg"><i style="background:${CITY_COL[c]}"></i>${c.toLowerCase()}</span>`).join('');

  // map: country outlines + 5 km cells lighting up month by month
  const basePath = BASE ? new Path2D(BASE.d) : null;
  const toBase = (la, lo) => [(lo - BASE.B.lon0) * BASE.K * (BASE.W / ((BASE.B.lon1 - BASE.B.lon0) * BASE.K)),
                              (BASE.B.lat1 - la) * (BASE.W / ((BASE.B.lon1 - BASE.B.lon0) * BASE.K))];
  const cellXY = G.cells.map(([la, lo]) => toBase(la, lo));
  const cityXY = {}; D.cities.forEach(c => { cityXY[c.city] = toBase(c.ll[0], c.ll[1]); });
  const TAU = 5;                                    // months of afterglow
  const glow = new Float32Array(G.cells.length), seen = new Float32Array(G.cells.length);
  function accumulate() {
    glow.fill(0); seen.fill(0);
    for (let i = 0; i <= cur; i++) {
      const f = Math.exp(-(cur - i) / TAU);
      for (const [c, n] of G.months[i]) { glow[c] += n * f; seen[c] += n; }
    }
  }
  // fixed frame on where I lived; places outside it are listed under the map
  function view(w, h) {
    const v = w < 700 ? { lon0: -4, lon1: 18, lat0: 39.2, lat1: 53.2 } : { lon0: -8, lon1: 22.5, lat0: 39.3, lat1: 53.1 };
    const [x0, y1] = toBase(v.lat0, v.lon0), [x1, y0] = toBase(v.lat1, v.lon1);
    const s = Math.max(w / (x1 - x0), h / (y1 - y0));
    return { s, ox: -x0 * s + (w - (x1 - x0) * s) / 2, oy: -y0 * s + (h - (y1 - y0) * s) / 2 };
  }
  function drawMap() {
    if (!BASE) return;
    const { w, h } = mp.fit(), ctx = mp.ctx, d = window.devicePixelRatio || 1, v = view(w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.setTransform(d * v.s, 0, 0, d * v.s, d * v.ox, d * v.oy);
    ctx.fillStyle = '#1b1a20'; ctx.fill(basePath);
    ctx.lineWidth = 0.8 / v.s; ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.stroke(basePath);
    ctx.restore();
    accumulate();
    const px = ([x, y]) => [x * v.s + v.ox, y * v.s + v.oy];
    const cs = Math.max(2.2, 0.045 * (BASE.W / ((BASE.B.lon1 - BASE.B.lon0) * BASE.K)) * v.s);
    // memory: everywhere the data has ever pointed
    ctx.fillStyle = C.fg;
    for (let c = 0; c < seen.length; c++) {
      if (!seen[c]) continue;
      const [x, y] = px(cellXY[c]); if (x < -5 || y < -5 || x > w + 5 || y > h + 5) continue;
      ctx.globalAlpha = Math.min(.32, .07 + Math.log10(1 + seen[c]) * .09);
      ctx.fillRect(x - cs / 2, y - cs / 2, cs, cs);
    }
    // present: afterglow of the last months
    ctx.globalCompositeOperation = 'lighter';
    for (let c = 0; c < glow.length; c++) {
      if (glow[c] < .05) continue;
      const [x, y] = px(cellXY[c]); if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const a = Math.min(1, Math.sqrt(glow[c]) / 3.2);
      ctx.fillStyle = C.teal;
      ctx.globalAlpha = a * .18; const g = cs * (2.5 + a * 4); ctx.fillRect(x - g / 2, y - g / 2, g, g);
      ctx.globalAlpha = .25 + a * .75; ctx.fillRect(x - cs / 2, y - cs / 2, cs, cs);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // places stay on the map once the data has put me there:
    // cities I lived in in their colour, places I travelled to in grey
    const city = M[cur].city, now = M[cur].m, LIVED = Object.keys(CITY_COL);
    const lived = new Set();
    for (let i = 0; i <= cur; i++) if (LIVED.includes(M[i].city)) lived.add(M[i].city);
    const trips = (D.places || []).filter(p => p.first <= now && !lived.has(p.name));
    const halo = (t, x, y, col, a = 1) => {
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(11,10,13,.9)';
      ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.globalAlpha = a; ctx.fillText(t, x, y); ctx.restore();
    };
    const boxes = [];
    const free = (x, y, bw, bh) => !boxes.some(b => x < b[0] + b[2] && x + bw > b[0] && y < b[1] + b[3] && y + bh > b[1]);
    const M_ = 5, inFrame = (x, y) => x >= M_ && x <= w - M_ && y >= M_ && y <= h - M_;
    const panel = (x, y) => w >= 700 && x > w - 320 && y < 200;   // readout panel area
    const mark = (name, ll, kind) => {
      const [x, y] = px(toBase(ll[0], ll[1])), on = name === city;
      ctx.font = kind === 'lived' || on ? '11px JetBrains Mono, monospace' : '9.5px JetBrains Mono, monospace';
      const lab = name.toLowerCase(), tw = ctx.measureText(lab).width;
      ctx.fillStyle = kind === 'lived' ? cityCol(name) : C.muted;
      ctx.globalAlpha = kind === 'lived' ? .85 : .9;
      ctx.beginPath(); ctx.arc(x, y, kind === 'lived' ? 2.2 : 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      if (on) {
        const left = x + 40 + tw > w - 8, sx = left ? -1 : 1, tx = left ? x - 38 - tw : x + 38;
        ctx.strokeStyle = C.fg; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 16 * sx, y); ctx.lineTo(x + 34 * sx, y); ctx.stroke();
        halo(lab, tx, y + 4, C.fg); boxes.push([tx - 2, y - 8, tw + 4, 14]);
        return;
      }
      // try right of the dot, then left, then below; skip if all collide
      const cands = [[x + 8, y + 4], [x - 8 - tw, y + 4], [x - tw / 2, y + 16]];
      for (const [tx, ty] of cands) {
        if (tx < 4 || tx + tw > w - 4) continue;
        if (!free(tx - 2, ty - 11, tw + 4, 13) || panel(tx + tw, ty) || panel(tx, ty)) continue;
        halo(lab, tx, ty, kind === 'lived' ? C.fg : C.muted, kind === 'lived' ? 1 : .95);
        boxes.push([tx - 2, ty - 11, tw + 4, 13]);
        break;
      }
    };
    const elsewhere = [];
    // current city first (ring), then lived, then trips by weight
    const all = [...[...lived].map(c => ({ name: c, ll: D.cities.find(x => x.city === c).ll, kind: 'lived' })),
                 ...trips.slice().sort((a, b) => b.n - a.n).map(p => ({ name: p.name, ll: p.ll, kind: 'trip' }))];
    if (city && !all.some(p => p.name === city)) {
      const c = D.cities.find(x => x.city === city); if (c) all.push({ name: city, ll: c.ll, kind: 'trip' });
    }
    all.sort((a, b) => (b.name === city) - (a.name === city));
    all.forEach(p => {
      const [x, y] = px(toBase(p.ll[0], p.ll[1]));
      if (inFrame(x, y)) mark(p.name, p.ll, p.kind); else elsewhere.push(p.name.toLowerCase());
    });
    ctx.globalAlpha = 1;
    const ntrip = trips.length + (city && !lived.has(city) && !trips.some(t => t.name === city) ? 1 : 0);
    $('mp-else').innerHTML = (ntrip ? `<b>${ntrip}</b> places visited` : '') +
      (elsewhere.length ? ` · off the map: ${elsewhere.join(' · ')}` : '');
    $('mp-month').textContent = mlabel(M[cur].m);
    $('mp-city').innerHTML = city ? city.toLowerCase() : '<span style="color:var(--fg-muted)">no location signal</span>';
  }
  function drawRead() {
    const m = M[cur], t = tot(m), yr = m.m.slice(0, 4), mu = year(yr);
    const top = SRC.slice().sort((a, b) => m[b.k] - m[a.k])[0];
    const p = D.phases[phaseOf(m.m)];
    $('tl-read').innerHTML =
      `<div><span class="k">phase</span><span class="v">${p ? '0' + (phaseOf(m.m) + 1) + ' · ' + p.label : '—'}</span></div>` +
      `<div><span class="k">events</span><span class="v">${fmt(t)}</span> <span class="d">· mostly ${top.name}</span></div>` +
      `<div><span class="k">phone</span><span class="v">${phoneAt(m.m)}</span></div>` +
      `<div><span class="k">00–05h</span><span class="v">${pct(m.night)}</span> <span class="d">of activity</span></div>` +
      `<div><span class="k">on repeat</span><span class="v">${mu ? mu.top[0].toLowerCase() : '—'}</span> <span class="d">(${yr})</span></div>`;
  }
  function setCur(i) {
    cur = Math.max(0, Math.min(M.length - 1, i));
    drawTL(); drawMap(); drawRead();
  }
  function fromPointer(e) {
    const r = tlC.getBoundingClientRect();
    setCur(Math.floor((e.clientX - r.left - pad.l) / ((r.width - pad.l - pad.r) / M.length)));
  }
  let drag = false;
  tlC.addEventListener('pointerdown', e => { drag = true; stop(); tlC.setPointerCapture(e.pointerId); fromPointer(e); });
  tlC.addEventListener('pointermove', e => drag && fromPointer(e));
  tlC.addEventListener('pointerup', () => { drag = false; });
  tlC.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stop(); setCur(cur + (e.key === 'ArrowRight' ? 1 : -1)); }
  });
  let timer = null;
  function stop() { clearInterval(timer); timer = null; $('tl-play').textContent = 'play'; }
  function play() {
    if (cur >= M.length - 1) setCur(0);
    $('tl-play').textContent = 'pause';
    timer = setInterval(() => { if (cur >= M.length - 1) stop(); else setCur(cur + 1); }, 170);   // ms per month: ~23 s from 2015 to today
  }
  $('tl-play').onclick = () => (timer ? stop() : play());
  // plays once by itself the first time the map scrolls into view
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); if (!timer) { setCur(0); play(); } }
    }, { threshold: .45 });
    io.observe(mpC);
  }


  // ---------- inferences ----------
  // verdict: 'ok' = checked and correct, 'no' = I won't confirm, '' = not checked
  const soc = y => D.social.find(s => s.y === y) || {};
  const sl = y => D.sleep.find(s => s.y === y) || {};
  const yt = y => (D.yt_topics.years.find(s => s.y === y) || { share: {} }).share;
  const hh = h => String(h).padStart(2, '0') + ':00';
  const fw = Object.keys(D.facts.paris_months).sort().map(k => MON[+k - 1]).join(' and ');
  const firstOf = c => (moves.find(v => v.city === c) || {}).m;
  const cc = D.countries.filter(c => c.cc !== 'IT' && c.n >= 10);
  const CCN = { GB: 'UK', HR: 'Croatia', FR: 'France', GR: 'Greece', PT: 'Portugal', ES: 'Spain', US: 'USA', HU: 'Hungary', IE: 'Ireland', DE: 'Germany' };
  const hu = D.countries.find(c => c.cc === 'HU');
  const lin = dev.find(d => d.name === 'Linux');
  const phones = dev.filter(d => d.n >= 2000 && !/MacBook|PlayStation|PC|Linux/.test(d.name));
  const ps4 = dev.find(d => /PlayStation/.test(d.name));
  const mus = D.music, itLo = mus.find(m => m.y === '2017'), itHi = mus.reduce((a, b) => (b.it_share > a.it_share ? b : a));
  const bday = D.facts.birthday, home = D.facts.home;
  const circle = D.social.map(s => s.circle80), cMax = Math.max(...circle);
  const spark = `<svg class="inf-spark" viewBox="0 0 ${D.social.length * 14} 34">${D.social.map((s, i) => {
    const h = s.circle80 / cMax * 26, hot = s.y === '2025';
    return `<rect x="${i * 14 + 2}" y="${30 - h}" width="10" height="${h}" fill="${hot ? C.teal : C.border2}"/>`;
  }).join('')}<text x="0" y="34" font-size="0">inner circle size per year</text></svg>`;
  const spring = (y, k) => M.filter(m => m.m >= y + '-03' && m.m <= y + '-05').reduce((a, m) => a + m[k], 0);
  const ratio = k => spring('2020', k) / spring('2019', k);

  const CARDS = [
    { t: 'birthday', c: 5, v: 'ok', src: 'instagram dms · keyword count',
      claim: `I was born on ${+bday.md.slice(3)} ${['January','February','March','April','May','June','July','August','September','October','November','December'][+bday.md.slice(0, 2) - 1]}.`,
      ev: `<b>${bday.n}</b> messages with "auguri" or "happy birthday" fall on a single day of the year. The next busiest day has <b>${bday.runner_up}</b>.` },
    { t: 'moves', c: 5, v: 'ok', src: 'google maps · dominant city per month',
      claim: `Udine → Milan (${mlabel(firstOf('Milan'))}) → Paris (${mlabel(moves.filter(v => v.city === 'Paris').pop().m)}) → Florence (${mlabel(firstOf('Florence'))}).`,
      ev: 'A new city takes over my map activity and stays for months. Moving house shows up in the data within about a month.' },
    { t: 'home', c: 5, v: 'ok', src: 'google maps · late-night directions',
      claim: `Lived in ${home.city}, ${home.street}, from ${mlabel(home.from)} to ${mlabel(home.to)}.`,
      ev: `Between 11pm and 6am I asked Maps for directions to the same address <b>${home.n_directions}</b> times. Nobody needs directions at 3am unless they're going home.` },
    { t: 'work', c: 3, v: 'ok', src: 'google maps · seasonality',
      claim: 'Works in fashion.',
      ev: `Before I moved there, Paris only shows up as my city in <b>${fw}</b>, year after year. Those are the months of Paris Men's Fashion Week. (I was walking in it.)` },
    { t: 'relationship', c: 3, v: 'x', src: 'instagram dms · metadata only',
      claim: 'In 2025 one person became the centre of my messaging.',
      ev: `One thread takes <b>${pct(soc('2025').top_share)}</b> of all my DMs that year. In 2024 no thread was above <b>${pct(soc('2024').top_share, 1)}</b>, and the circle that gets 80% of my messages shrank from <b>${soc('2024').circle80}</b> to <b>${soc('2025').circle80}</b>. It reads like a new relationship. It isn't: the thread is <b>"gooners club"</b>, a group chat. Metadata alone can't tell a partner from a group chat.` + spark },
    { t: 'phones', c: 5, v: 'ok', src: 'spotify · device string on every play',
      claim: phones.map(p => p.name.replace(' (model hidden by Spotify)', ' 16')).join(' → ') + '.',
      ev: `Every play logged the device model, so the upgrades are dated to the month. Also: a PlayStation 4 from ${mlabel(ps4.from)} to ${mlabel(ps4.to)}. Then, from ${mlabel((phones.find(p => /hidden/.test(p.name)) || {}).from || '2022-10')}, Spotify stopped writing the model and only says "ios". So the iPhone 16 at the end is the one fact on this page the data couldn't give: I had to supply it myself.` },
    { t: 'learning to code', c: 4, v: 'ok', src: 'youtube topics · spotify clients',
      claim: `Started programming seriously in late 2025.`,
      ev: `Tech & code goes from <b>${pct(yt('2024')['tech & code'], 1)}</b> of my YouTube in 2024 to <b>${pct(yt('2026')['tech & code'], 1)}</b> in 2026. A Linux Spotify client appears in ${mlabel(lin.from)}: school machines.` },
    { t: 'sleep', c: 4, v: '', src: 'all sources · hour of day',
      claim: `Night owl, and getting later.`,
      ev: `My quietest 6 hours moved from <b>${hh(sl('2017').start)}–${hh(sl('2017').end)}</b> in 2017 to <b>${hh(sl('2026').start)}–${hh(sl('2026').end)}</b> in 2026. The share of DMs sent between midnight and 5am went from <b>${pct(soc('2017').night, 1)}</b> to <b>${pct(soc('2025').night)}</b>.` },
    { t: 'travel', c: 4, v: 'ok', src: 'spotify · connection country',
      claim: `Been to ${cc.map(c => CCN[c.cc] || c.cc).join(', ')}.`,
      ev: `Every play logs which country it was streamed from. A trip to Hungary in ${mlabel(hu.first)} left <b>${hu.n}</b> plays behind.` },
    { t: 'roots', c: 4, v: 'ok', src: 'spotify · artist nationality',
      claim: 'Italian, and listening more and more like one.',
      ev: `Italian artists go from <b>${pct(itLo.it_share, 1)}</b> of my plays in 2017 to <b>${pct(itHi.it_share)}</b> in ${itHi.y}. My most played artist of 2024 is Italian, the first time that happens.` },
    { t: 'lockdown', c: 4, v: 'ok', src: 'spotify + maps + instagram · volume',
      claim: 'Spring 2020: I stopped going anywhere.',
      ev: `Compared with March–May 2019, Spotify plays drop to <b>${pct(ratio('sp'))}</b> (no more music on the walk to school), Maps to <b>${pct(ratio('gm'))}</b>, while Instagram goes <b>up ${pct(ratio('ig') - 1)}</b>. The quietest hours shift two hours later that year. You can see the lockdown without reading any news.` },
  ];
  const V = { ok: ['ok', '✓ correct'], no: ['no', '✕ not confirming'], x: ['x', '✕ wrong'], '': ['', '· unverified'] };
  $('inf').innerHTML = CARDS.map((c, i) => `
    <article class="led-row">
      <div class="led-n">${String(i + 1).padStart(2, '0')}</div>
      <div class="led-claim"><span class="led-t">${c.t}</span>${c.claim}</div>
      <div class="led-ev">${c.ev}</div>
      <div class="led-meta"><span>${c.src}</span>
        <span class="inf-conf" title="confidence ${c.c}/5">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= c.c ? 'on' : ''}"></i>`).join('')}</span>
        <span class="inf-verdict ${V[c.v][0]}">${V[c.v][1]}</span></div>
    </article>`).join('');

  // ---------- meta's own profile of me ----------
  const MA = D.meta_ads;
  if (MA) {
    const TR = {
      'Cambiamento recente di rete o dispositivo mobile': 'Recently changed network or device',
      'Potenziale cambiamento di rete o dispositivo mobile': 'Likely to change network or device',
      'Uso di reti Wi-Fi': 'Wi-Fi users',
      'Utenti di reti o dispositivi mobili': 'Mobile network users',
    };
    $('ma-stats').innerHTML = [
      [fmt(MA.adv_total), 'advertisers that hold me in an audience'],
      [fmt(MA.adv_lists), 'of them uploaded a customer list my profile matched'],
      [MA.ads_per_day, 'ads a day, measured over the last week of the export'],
      [MA.videos_per_day, 'videos a day in the same week'],
    ].map(([b, t]) => `<div><b>${b}</b><span>${t}</span></div>`).join('');
    $('ma-adv').innerHTML = MA.sample.map(a => `<span${/prada|dior|chanel|zegna/i.test(a) ? ' class="hot"' : ''}>${a}</span>`).join('<i>·</i>')
      + `<i>·</i><span class="more">+ ${fmt(MA.adv_total - MA.sample.length)} more</span>`;
    $('ma-cat').innerHTML = MA.categories.map(c => `<li>${TR[c] || c}</li>`).join('');
    const cd = new Date(MA.consent_date + 'T00:00:00Z');
    $('ma-consent').textContent = `${cd.getUTCDate()} ${MON[cd.getUTCMonth()]} ${cd.getUTCFullYear()}`;
    $('ma-based').textContent = MA.based_in;
  }
  if (D.others) {
    $('ot-msgs').textContent = fmt(D.others.msgs_received);
    $('ot-people').textContent = fmt(D.others.people);
  }

  // ---------- rhythm ----------
  const heat = PJ.canvas($('rh-heat'), .42), sleepC = PJ.canvas($('rh-sleep'), w => (D.sleep.length * 16 + 26) / w);
  let phase = D.phases.length - 1;
  const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  function drawHeat() {
    const { w, h } = heat.fit(), ctx = heat.ctx, l = 30, t = 4, b = 16;
    const cw = (w - l) / 24, ch = (h - t - b) / 7, mat = D.phases[phase].circadian;
    ctx.clearRect(0, 0, w, h); ctx.font = '9.5px JetBrains Mono, monospace';
    for (let d = 0; d < 7; d++) {
      ctx.fillStyle = C.muted; ctx.fillText(DOW[d], 0, t + d * ch + ch / 2 + 3);
      for (let hr = 0; hr < 24; hr++) {
        ctx.fillStyle = C.teal; ctx.globalAlpha = .04 + Math.sqrt(mat[d][hr]) * .96;
        ctx.fillRect(l + hr * cw + .5, t + d * ch + .5, cw - 1, ch - 1);
      }
    }
    ctx.globalAlpha = 1; ctx.fillStyle = C.muted;
    [0, 6, 12, 18].forEach(hr => ctx.fillText(String(hr).padStart(2, '0'), l + hr * cw, h - 3));
    const p = D.phases[phase];
    $('rh-title').textContent = `phase 0${phase + 1} · ${mlabel(p.start)} – ${mlabel(p.end)}`;
  }
  function drawSleep() {
    const { w, h } = sleepC.fit(), ctx = sleepC.ctx, l = 36, rowH = 16, t = 2;
    const cw = (w - l) / 24;
    ctx.clearRect(0, 0, w, h); ctx.font = '9.5px JetBrains Mono, monospace';
    D.sleep.forEach((s, i) => {
      const y0 = t + i * rowH, mx = Math.max(...s.hours);
      ctx.fillStyle = C.muted; ctx.fillText(s.y, 0, y0 + 10);
      s.hours.forEach((v, hr) => {
        ctx.fillStyle = C.fg; ctx.globalAlpha = .05 + (v / mx) * .5;
        ctx.fillRect(l + hr * cw, y0 + 2, cw - .5, rowH - 6);
      });
      ctx.globalAlpha = 1; ctx.strokeStyle = C.teal; ctx.lineWidth = 1.5;
      const segs = s.start + 6 <= 24 ? [[s.start, 6]] : [[s.start, 24 - s.start], [0, s.start + 6 - 24]];
      segs.forEach(([a, n]) => ctx.strokeRect(l + a * cw + .75, y0 + 1.25, n * cw - 1.5, rowH - 3.5));
    });
    ctx.lineWidth = 1; ctx.fillStyle = C.muted;
    [0, 6, 12, 18].forEach(hr => ctx.fillText(String(hr).padStart(2, '0'), l + hr * cw, h - 3));
  }
  PJ.buttons($('rh-btns'), D.phases.map((p, i) => ({ label: '0' + (i + 1), i })), it => { phase = it.i; drawHeat(); }, phase);
  const s0 = sl('2017'), s1 = sl('2026'), shift = ((s1.start - s0.start) + 24) % 24;
  $('rh-shift').textContent = `${shift} hours later (${hh(s0.start)} → ${hh(s1.start)})`;

  // ---------- who picked it ----------
  if (D.picked) {
    const PY = D.picked.youtube.filter(r => r.n > 5000), PS = D.picked.spotify;
    const stackRows = (rows, keys, cols) => rows.map(r => `<div class="yt-row"><span>${r.y}</span><div class="stack">${
      keys.map((k, i) => `<i title="${k} ${pct(r[k], 1)}" style="width:${r[k] * 100}%;background:${cols[i]}"></i>`).join('')
    }</div><span class="n">${pct(keys.slice(0, 2).reduce((a, k) => a + r[k], 0))}</span></div>`).join('');
    const legend = (keys, cols, names) => keys.map((k, i) => `<span class="lg"><i style="background:${cols[i]}"></i>${names[i]}</span>`).join('');
    const YK = ['searched', 'subscribed', 'served', 'ad'], YC = [C.teal, C.green, 'rgba(255,255,255,0.16)', C.red];
    $('pk-yt').innerHTML = stackRows(PY, YK, YC) + '<div class="yt-row" style="margin:0"><span></span><span style="font-size:10px;color:var(--fg-muted)">share of videos in my watch history</span><span class="n">chosen</span></div>';
    $('pk-yt-legend').innerHTML = legend(YK, YC, ['searched for it', 'channel I follow', 'feed / autoplay / links', 'ads']);
    const SK = ['picked', 'queue', 'other'], SC = [C.teal, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)'];
    $('pk-sp').innerHTML = stackRows(PS.map(r => ({ ...r, _: 0 })), ['picked', '_', 'queue', 'other'], [C.teal, C.teal, SC[1], SC[2]])
      + '<div class="yt-row" style="margin:0"><span></span><span style="font-size:10px;color:var(--fg-muted)">share of plays</span><span class="n">picked</span></div>';
    $('pk-sp-legend').innerHTML = legend(SK, SC, ['I tapped the song', 'queue: previous ended or skip', 'other']);
    const last = PY[PY.length - 1], notMine = last.served + last.ad;
    $('pk-big').textContent = pct(notMine);
    $('pk-big-t').innerHTML = `of what YouTube logged as "watched" in ${last.y} I never searched for and don't subscribe to: <strong style="color:var(--fg)">${pct(last.served)}</strong> came from the feed, <strong style="color:var(--fg)">${pct(last.ad)}</strong> were ads.`;
    $('pk-subs').textContent = D.picked.subs;
    const s0 = PS.find(r => r.y === '2019'), s1 = PS[PS.length - 1];
    const yc = last.searched + last.subscribed;
    $('pk-after').innerHTML = `Music is a different story. On Spotify I tap the song myself <strong>${pct(s1.picked)}</strong> of the time in ${s1.y}, up from <strong>${pct(s0.picked)}</strong> in 2019, and most of the rest plays from queues and playlists, some mine and some Spotify's. On YouTube I pick <strong>${pct(yc)}</strong>. The shift to Italian rap has my fingerprints on it. The drift on YouTube mostly doesn't.`;
  }

  // ---------- taste ----------
  const hMax = Math.max(...mus.map(m => m.hours));
  $('mu').innerHTML = '<tr><th>year</th><th>hours</th><th class="hide-s"></th><th>italian</th><th class="hide-s"></th><th>top artists</th></tr>' +
    mus.map(m => `<tr><td class="y">${m.y}</td>
      <td><div class="bar"><i style="width:${m.hours / hMax * 100}%;background:${C.green}"></i></div></td><td class="num hide-s">${fmt(m.hours)}h</td>
      <td><div class="bar"><i style="width:${m.it_share / 0.35 * 100}%;background:${C.teal}"></i></div></td><td class="num hide-s">${pct(m.it_share)}</td>
      <td class="art" title="${m.top.join(', ')}">${m.top.slice(0, 3).join(' · ')}</td></tr>`).join('');
  const TC = [C.red, C.green, C.teal, C.yellow, C.blue, C.violet, '#b07cc6', '#6ec6c0', '#c89b6e', '#8a8f5e'];
  const cats = D.yt_topics.cats;
  $('yt').innerHTML = D.yt_topics.years.map(r => {
    const known = cats.reduce((a, k) => a + r.share[k], 0);
    return `<div class="yt-row"><span>${r.y}</span><div class="stack">${cats.map((k, i) => `<i title="${k} ${pct(r.share[k], 1)}" style="width:${r.share[k] * 100}%;background:${TC[i]};opacity:.8"></i>`).join('')}<i title="unlabelled" style="width:${(1 - known) * 100}%;background:transparent"></i></div><span class="n">${fmt(r.n)}</span></div>`;
  }).join('') + '<div class="yt-row" style="margin:0"><span></span><span style="font-size:10px;color:var(--fg-muted)">share of videos watched</span><span class="n">videos</span></div>';
  $('yt-legend').innerHTML = cats.map((k, i) => `<span class="lg"><i style="background:${TC[i]};opacity:.8"></i>${k}</span>`).join('') + '<span class="lg"><i style="background:var(--border)"></i>unlabelled</span>';


  // ---------- side rail: one square per chapter, green = where you are ----------
  {
    const blocks = [document.querySelector('.pj-head'), ...document.querySelectorAll('.pj-sec.fp-ch')].filter(Boolean);
    const rail = document.createElement('nav'); rail.className = 'fp-rail'; rail.setAttribute('aria-label', 'chapters');
    rail.innerHTML = blocks.map((b, i) => {
      const t = i ? b.querySelector('h2 .num').textContent + ' ' + b.querySelector('h2 .tt').textContent : 'top';
      return `<a href="#${b.id || 'top'}" data-t="${t.replace(/"/g, '')}" aria-label="${t.replace(/"/g, '')}"></a>`;
    }).join('');
    document.body.appendChild(rail);
    const links = [...rail.querySelectorAll('a')];
    const mark = () => { let cur = 0; blocks.forEach((b, i) => { if (b.getBoundingClientRect().top < innerHeight * .4) cur = i; }); links.forEach((a, i) => a.classList.toggle('on', i === cur)); };
    addEventListener('scroll', mark, { passive: true }); mark();
  }
  // ---------- boot ----------
  function all() { drawTL(); drawMap(); drawRead(); drawHeat(); drawSleep(); }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(all, 120); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(all);
  all();
})();
