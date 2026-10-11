// story.html: one zoomable map of data/story.json (pan and zoom in 2D, like a geographic map).
// Time runs left→right in world units, lanes stack top→bottom, card size = importance (1–5).
// Text lives in world space: small items only become readable as you zoom in.
import { fmtDate, fmtRange, MONTHS } from './util.js';

const d3 = window.d3;
const day = d3.utcParse('%Y-%m-%d');
const D0 = day('2021-09-01'), D1 = day('2026-12-31');
const UPD = 2;                                   // world units per day
const X = t => (t - D0) / 864e5 * UPD;
const W = X(D1);

// Importance → card width and title size. Cards are portrait: room for a photo later.
const CARD_W = [24, 34, 48, 70, 104];
const TITLE = [6, 7.5, 10, 15, 22];
const BOXED = 4;                                 // levels ≥ BOXED get a boxed label
const NOS_SCALE = 0.75;                          // a "no" is drawn smaller than a job of the same level
const colorOf = e => e.lane === 'nos' ? 'var(--opt)' : `var(--imp-${e.importance ?? 1})`;
const MIN_PX = 2.5;                              // text smaller than this on screen is hidden

const HOLDERS = { whatsapp: 'WhatsApp', instagram: 'Instagram', modelscom: 'models.com', email: 'Email (Google)', none: 'nessuna traccia digitale' };
const KINDS = { casting: 'Casting', fitting: 'Fitting', opzione: 'Opzione' };
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const $ = id => document.getElementById(id);
const ctx = document.createElement('canvas').getContext('2d');
const textWidth = (s, size, weight = 400) => { ctx.font = `${weight} 100px ${FONT}`; return ctx.measureText(String(s)).width * size / 100; };

const data = await fetch('data/story.json').then(r => r.json());
const types = data._meta.types;

// ---- layout ----------------------------------------------------------------
const lanes = [];
let cursor = 70;
const lane = (key, label, h) => { const l = { key, label, y: cursor, h }; lanes.push(l); cursor += h + 70; return l; };

// Drop-packing: each box falls from the spine until it no longer overlaps a placed one.
// Most important first, so they sit closest to their date.
function pack(items, top) {
  const placed = [];
  for (const it of items) {
    let y = top;
    for (let moved = true; moved;) {
      moved = false;
      for (const p of placed)
        if (it.x0 < p.x1 && p.x0 < it.x1 && y < p.y1 && p.y < y + it.bh) { y = p.y1 + 6; moved = true; }
    }
    it.y = y;
    placed.push({ x0: it.x0, x1: it.x1, y, y1: y + it.bh });
  }
  return d3.max(placed, p => p.y1) - top;
}

// Jobs and options share one lane; color tells them apart.
function cards() {
  return data.events.filter(e => e.date).map(e => {
    const f = e.lane === 'nos' ? NOS_SCALE : 1;
    const lvl = e.importance ?? 1, w = CARD_W[lvl - 1] * f, fs = TITLE[lvl - 1] * f, fd = Math.max(1.4, fs * 0.4);
    const t = day(e.date), title = e.client ?? e.title ?? 'Cliente non noto';
    const lines = [
      `${e.date_precision === 'month' ? fmtDate(e.date.slice(0, 7)) : fmtRange(e.date, e.date_end)} · ${e.city ?? 'città non nota'}`,
      e.lane === 'nos' ? `${KINDS[e.kind] ?? e.kind} · ${types[e.type]} · ${e.outcome}` : `${types[e.type]} · ${e.status === 'confirmed' ? 'confermato' : 'da verificare'}`,
      `dato: ${e.holders.map(h => HOLDERS[h]).join(' + ')}${e.holder_inferred ? ' (dedotto)' : ''}`,
    ];
    const bw = Math.max(w, textWidth(title, fs, 500) + fs, ...lines.map(l => textWidth(l, fd))) + 4;
    const bh = w * 1.25 + fs * 1.7 + lines.length * fd * 1.3 + 6;
    const cx = X(t);
    return { ...e, lvl, w, fs, fd, t, title, lines, bw, bh, cx, x0: cx - bw / 2, x1: cx + bw / 2 };
  }).sort((a, b) => b.w - a.w || a.t - b.t);
}

const agLane = lane('agencies', 'Agenzie', 60);
const items = cards();
const jobs = items.filter(e => e.lane === 'jobs'), nos = items.filter(e => e.lane === 'nos');
const evLane = lane('events', 'Lavori e opzioni', 0);   // last: the tallest lane
cursor += (evLane.h = pack(items, evLane.y + 40) + 40);
const H = cursor;

// ---- draw ------------------------------------------------------------------
const svg = d3.select('#map-svg');
const view = d3.select('#view');                 // carries the zoom transform
const world = d3.select('#world');               // untransformed: the minimap <use>s it
svg.attr('aria-label', `Mappa della carriera 2021–2026: ${jobs.length} lavori e ${nos.length} opzioni o casting. Tab per spostarsi tra i lavori.`);

const years = d3.utcYear.range(d3.utcYear.ceil(D0), D1);
const months = d3.utcMonth.range(d3.utcMonth.ceil(D0), D1).filter(m => m.getUTCMonth() !== 0);
const grid = world.append('g').attr('class', 'grid');
grid.selectAll('.gm').data(months).join('line').attr('class', 'gm').attr('x1', X).attr('x2', X).attr('y1', 0).attr('y2', H);
grid.selectAll('.gy').data(years).join('line').attr('class', 'gy').attr('x1', X).attr('x2', X).attr('y1', 0).attr('y2', H);
grid.selectAll('.gl').data(lanes.slice(1)).join('line').attr('class', 'gl').attr('x1', 0).attr('x2', W).attr('y1', l => l.y - 55).attr('y2', l => l.y - 55);

// Boxed label: ink box, paper text (the Calculating Empires tag).
function boxed(g, text, x, y, size, anchor = 'start') {
  const w = textWidth(text, size, 500) + size * 0.8, h = size * 1.4;
  const x0 = anchor === 'middle' ? x - w / 2 : x;
  g.append('rect').attr('class', 'box').attr('x', x0).attr('y', y - h / 2).attr('width', w).attr('height', h);
  g.append('text').attr('class', 'box-text').attr('x', x0 + w / 2).attr('y', y).attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central').style('font-size', `${size}px`).text(text);
}
const small = (g, text, x, y, size = 3, anchor = 'start') => g.append('text').attr('class', 'detail')
  .attr('x', x).attr('y', y).attr('text-anchor', anchor).style('font-size', `${size}px`).text(text);

// Agencies
const ag = world.append('g').attr('class', 'agencies');
for (const a of data.agencies) {
  const x0 = X(day(a.from)), x1 = a.to ? X(d3.utcDay.offset(day(a.to), 1)) : W, main = a.role === 'main';
  const y = agLane.y + (main ? 0 : 44);
  ag.append('rect').attr('class', main ? 'ag-main' : 'ag-sec').attr('x', x0).attr('y', y).attr('width', x1 - x0).attr('height', main ? 2.5 : 1.2);
  boxed(ag, a.name, x0, y - 14, main ? 20 : 12);
  small(ag, `${a.city} · ${fmtRange(a.from.slice(0, 7), a.to?.slice(0, 7))}`, x0, y + (main ? 12 : 8));
}

// Cards hang from a spine at the top of their lane: a tick on the date, a leader down to the card.
function drawCards(laneObj, items) {
  const spineY = laneObj.y + 10;
  const g = world.append('g').attr('class', 'cards');
  g.append('line').attr('class', 'spine').attr('x1', 0).attr('x2', W).attr('y1', spineY).attr('y2', spineY);
  // Leaders in their own layer below every card, so none crosses a card face.
  g.append('g').selectAll('line').data(items).join('line').attr('class', 'leader').style('--c', colorOf)
    .attr('x1', d => d.cx).attr('x2', d => d.cx).attr('y1', spineY).attr('y2', d => d.y);
  const c = g.selectAll('g.card').data(items, d => d.id).join('g')
    .attr('class', d => `card ${d.lane} ${d.status}${d.image ? ' has-image' : ''}`)
    .attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', d => [d.title, ...d.lines].join('. '))
    .style('--c', colorOf)
    .sort((a, b) => a.t - b.t);                 // DOM (and Tab) order = date order
  c.filter(d => d.date_precision === 'month').append('line').attr('class', 'month-span')
    .attr('x1', d => X(d3.utcMonth.floor(d.t))).attr('x2', d => X(d3.utcMonth.ceil(d.t))).attr('y1', spineY).attr('y2', spineY);
  c.filter(d => d.date_end).append('line').attr('class', 'range-span')
    .attr('x1', d => d.cx).attr('x2', d => X(d3.utcDay.offset(day(d.date_end), 1))).attr('y1', spineY).attr('y2', spineY);
  c.append('circle').attr('class', 'tick').attr('cx', d => d.cx).attr('cy', spineY).attr('r', d => 1 + d.lvl * 0.7);
  c.append('rect').attr('class', 'face').attr('x', d => d.cx - d.w / 2).attr('y', d => d.y).attr('width', d => d.w).attr('height', d => d.w * 1.25);
  // Photo slot: shown as soon as story.json carries an image path.
  c.filter(d => d.image).append('image').attr('href', d => d.image).attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('x', d => d.cx - d.w / 2).attr('y', d => d.y).attr('width', d => d.w).attr('height', d => d.w * 1.25);
  // Failed options show the brand logo, inked white on the card.
  // An HTML <img> (via foreignObject): SVG <image> mis-scales logos whose files lack a proper viewBox.
  c.filter(d => d.logo).append('foreignObject').attr('class', d => d.logo_raw ? 'logo raw' : 'logo')
    .attr('x', d => d.cx - d.w * 0.4).attr('y', d => d.y + d.w * 0.1).attr('width', d => d.w * 0.8).attr('height', d => d.w * 1.05)
    .append('xhtml:img').attr('src', d => d.logo).attr('alt', '');
  c.filter(d => d.image).append('rect').attr('class', 'frame')
    .attr('x', d => d.cx - d.w / 2).attr('y', d => d.y).attr('width', d => d.w).attr('height', d => d.w * 1.25);
  c.each(function (d) {
    const g = d3.select(this), ty = d.y + d.w * 1.25 + d.fs * 0.95;
    if (d.lvl >= BOXED && d.lane === 'jobs') boxed(g, d.title, d.cx, ty, d.fs, 'middle');
    else g.append('text').attr('class', 'title').attr('x', d.cx).attr('y', ty).attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central').style('font-size', `${d.fs}px`).text(d.title);
    d.lines.forEach((l, i) => small(g, l, d.cx, ty + d.fs * 0.9 + d.fd * (1.1 + i * 1.3), d.fd, 'middle'));
  });
  return c;
}
const cardSel = drawCards(evLane, items);

// ---- zoom, pan, sticky axes, minimap, URL -----------------------------------
const map = $('map');
const vw = () => map.clientWidth, vh = () => map.clientHeight;
// Wide screens: whole width. Narrow screens: the lanes above the options fill the height, pan sideways.
const fit = () => {
  if (vw() >= 700) { const k = vw() / (W + 120); return d3.zoomIdentity.translate(60 * k, 30).scale(k); }
  const k = vh() * 0.92 / (evLane.y + 260);
  return d3.zoomIdentity.translate(vw() / 2 - X(day('2023-01-01')) * k, 30).scale(k);
};
const zoom = d3.zoom().scaleExtent([0.03, 40]).on('zoom', zoomed);

const texts = world.selectAll('text').nodes().map(n => ({ n, fs: parseFloat(n.style.fontSize) || 12, on: true }));
const mini = d3.select('#mini').attr('viewBox', `0 0 ${W} ${H}`).style('height', `${Math.min(90, 200 * H / W)}px`);
mini.append('use').attr('href', '#world');
const lens = mini.append('rect').attr('class', 'lens');
const axis = d3.select('#years');
const laneNames = d3.select('#lane-names').selectAll('div').data(lanes).join('div').attr('class', 'lane-name').text(l => l.label);

let urlTimer;
const stage = $('stage'), stageVideo = $('stage-video');
let active = null;                               // { d, k, i } of the card whose video or photos are showing
function zoomed({ transform: t, sourceEvent }) {
  view.attr('transform', t);
  if (active && sourceEvent && leftCard(t)) hideStage();   // only your own pan/zoom closes it
  for (const x of texts) {                      // level of detail
    const on = x.fs * t.k >= MIN_PX;
    if (on !== x.on) { x.n.style.display = on ? '' : 'none'; x.on = on; }
  }
  const showMonths = t.k * UPD * 30 > 44;
  svg.classed('show-months', showMonths);
  const ticks = [D0, ...years].map(y => ({ t: y, label: String(y.getUTCFullYear()), cls: 'y' }));
  if (showMonths) ticks.push(...months.map(m => ({ t: m, label: MONTHS[m.getUTCMonth()], cls: 'm' })));
  let lastX = -Infinity;                         // drop a label that would collide with the previous one
  const shown = ticks.sort((a, b) => a.t - b.t).filter(d => { const x = t.applyX(X(d.t)); return x - lastX > 44 && (lastX = x, true); });
  axis.selectAll('span').data(shown, d => +d.t).join('span')
    .attr('class', d => `tick ${d.cls}`).style('transform', d => `translateX(${t.applyX(X(d.t))}px)`).text(d => d.label);
  // Lane name sticks to the top until the next lane pushes it out.
  laneNames.style('transform', (l, i) => {
    const next = lanes[i + 1] ? t.applyY(lanes[i + 1].y - 55) - 26 : Infinity;
    return `translateY(${Math.min(Math.max(0, t.applyY(l.y - 55)), next)}px)`;
  }).style('display', (l, i) => lanes[i + 1] && t.applyY(lanes[i + 1].y) - t.applyY(l.y) < 40 ? 'none' : null);
  const [x0, y0] = t.invert([0, 0]), [x1, y1] = t.invert([vw(), vh()]);
  lens.attr('x', x0).attr('y', y0).attr('width', x1 - x0).attr('height', y1 - y0);
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => history.replaceState(null, '', `?pos=${Math.round(-t.x / t.k)},${Math.round(-t.y / t.k)},${t.k.toFixed(3)}`), 300);
}

svg.call(zoom).on('dblclick.zoom', null);
const pos = new URLSearchParams(location.search).get('pos')?.split(',').map(Number);
svg.call(zoom.transform, pos?.length === 3 && pos.every(Number.isFinite) ? d3.zoomIdentity.scale(pos[2]).translate(-pos[0], -pos[1]) : fit());

// Click, tap, Enter or Tab focus on a card: fly to it. A card with a video goes to the left half
// (top half on phones) and its video plays centered in the other half, until you move away.
const narrow = () => vw() < 700;
function flyTo(d) {
  const split = hasStage(d), w = split && !narrow() ? vw() / 2 : vw(), h = split && narrow() ? vh() / 2 : vh();
  const k = Math.min(40, Math.min(w * 0.8 / d.bw, h * 0.8 / d.bh));
  svg.transition().duration(600).call(zoom.transform,
    d3.zoomIdentity.translate(w / 2, h / 2).scale(k).translate(-d.cx, -(d.y + d.bh / 2)));
  return k;
}
// Shows with a video play it; jobs with photos get a browsable gallery in the same half.
const stageImg = $('stage-img'), stagePrev = $('stage-prev'), stageNext = $('stage-next'), stageCount = $('stage-count');
const hasStage = d => !!d.videos || d.images?.length > 0;
function showStage(d, k) {
  hideStage();
  active = { d, k, i: 0 };
  stage.hidden = false;
  stage.classList.toggle('photos', !d.videos);
  if (d.videos) {
    let i = 0;
    stageVideo.onended = () => { i = (i + 1) % d.videos.length; stageVideo.src = d.videos[i]; stageVideo.play().catch(() => {}); };
    stageVideo.src = d.videos[0];
    stageVideo.play().catch(() => {});
  } else showPhoto(0);
}
function showPhoto(i) {
  const { d } = active, n = d.images.length;
  active.i = (i + n) % n;
  stageImg.src = d.images[active.i];
  stageImg.alt = `${d.title}, foto ${active.i + 1} di ${n}`;
  stageCount.textContent = n > 1 ? `${active.i + 1} / ${n}` : '';
  stagePrev.hidden = stageNext.hidden = n < 2;
  if (n > 1) new Image().src = d.images[(active.i + 1) % n];   // preload the next one
}
function hideStage() {
  if (!active) return;
  active = null;
  stage.hidden = true;
  stageVideo.pause();
  stageVideo.removeAttribute('src');
  stageVideo.load();
  stageImg.removeAttribute('src');
}
const step = dir => { if (active && !active.d.videos) showPhoto(active.i + dir); };
stagePrev.onclick = () => step(-1);
stageNext.onclick = () => step(1);
document.addEventListener('keydown', ev => { if (ev.key === 'ArrowLeft') step(-1); if (ev.key === 'ArrowRight') step(1); });
// Swipe on the photo (phones).
let swipeX = null;
stageImg.addEventListener('pointerdown', ev => { swipeX = ev.clientX; });
stageImg.addEventListener('pointerup', ev => { if (swipeX != null && Math.abs(ev.clientX - swipeX) > 40) step(ev.clientX < swipeX ? 1 : -1); swipeX = null; });
// Moved away = the card's center left its half of the screen, or the zoom changed a lot.
function leftCard(t) {
  const { d, k } = active, [x, y] = t.apply([d.cx, d.y + d.bh / 2]);
  const [w, h] = narrow() ? [vw(), vh() / 2] : [vw() / 2, vh()];
  return x < 0 || x > w || y < 0 || y > h || t.k < k / 1.6 || t.k > k * 1.6;
}
const select = d => { const k = flyTo(d); if (hasStage(d)) showStage(d, k); else hideStage(); };
cardSel.on('click', (ev, d) => { ev.stopPropagation(); select(d); })
    .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(d); } })
    .on('focus', (ev, d) => { if (ev.currentTarget.matches(':focus-visible')) flyTo(d); });

// Minimap: click or drag to move there.
mini.on('pointerdown pointermove', ev => {
  if (ev.type === 'pointermove' && !ev.buttons) return;
  ev.preventDefault();
  const [mx, my] = d3.pointer(ev, mini.node());
  svg.call(zoom.translateTo, mx, my);
});

$('zoom-in').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
$('zoom-out').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
$('zoom-fit').onclick = () => svg.transition().duration(450).call(zoom.transform, fit());

// Theme: follows the system until toggled.
const root = document.documentElement, themeBtn = $('theme');
const setTheme = th => { root.dataset.theme = th; themeBtn.textContent = th === 'light' ? 'Scuro' : 'Chiaro'; };
setTheme(matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
themeBtn.onclick = () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light');

// Info panel: the three numbers and how to read the map.
const nJobs = data.events.filter(e => e.lane === 'jobs').length, nNos = data.events.filter(e => e.lane === 'nos').length;
$('n-jobs').textContent = nJobs;
$('n-nos').textContent = nNos;
$('n-ratio').textContent = String(Math.round(nNos * 10 / nJobs) / 10).replace('.', ',');
const info = $('info');
$('info-btn').onclick = ev => { ev.stopPropagation(); info.hidden = !info.hidden; };
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { info.hidden = true; hideStage(); } });

new ResizeObserver(() => svg.call(zoom.transform, d3.zoomTransform(svg.node()))).observe(map);
