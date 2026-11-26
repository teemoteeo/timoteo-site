// ============================
// SELECTED WORK: RUOTA DI PIANETI + LA CARD DEL PIANETA ATTIVO
// ============================
// Layout: a sinistra una ruota con i tre pianeti (l'attivo davanti e grande, gli altri sopra e sotto),
// a destra dell'attivo la sua card. Click su un pianeta: la ruota gira e lo porta davanti. Hover: la sua
// card in anteprima, che torna quella del selezionato quando togli il cursore.
// Tre progetti come pianeti a puntini, nello stile di DotPlanet.jsx di POLENTA (Points a
// pixel fissi + una sfera piena appena dentro che nasconde i puntini dietro):
//   POLENTA   Marte + Luna, sempre insieme (i puntini sono quelli di POLENTA)
//   Footprint la Terra da foto satellitare (NASA Blue Marble) con la heatmap 2020-2026 animata in rosso
//   RAG       la Morte Nera di js/ships-sw.js (tools/deathstar-dots.js)
// Le card .feat di selected work (index.html, data-planet) vengono spostate nello stage: si vede solo quella
// del pianeta attivo, con la clip che gira. Il progetto si apre solo dalla card; i pianeti si trascinano.
// Si parte da Footprint. Ogni corpo ha due palette (tema scuro / chiaro), cambiate su 'themechange'.
// three.js r128 e' quello del cubo e della palla 8: lo riuso se c'e'. Si carica solo vicino alla sezione.
// Solo desktop con hover: sotto 901px / touch resta la lista .featured intera (css/planets.css).
(function () {
  const stage = document.querySelector('.sys-stage');
  if (!stage || !matchMedia('(min-width: 901px) and (hover: hover)').matches) return;
  const sr = stage.querySelector('.sys-sr');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isLight = () => document.documentElement.dataset.theme === 'light';
  const ORDER = ['pol', 'fp', 'rag'];
  const feats = {}; document.querySelectorAll('.featured .feat[data-planet]').forEach(f => { feats[f.dataset.planet] = f; });
  const P = {}; ORDER.forEach(id => { const a = feats[id].querySelector('.feat-link'); P[id] = { name: a.textContent, url: a.getAttribute('href'), ext: a.target === '_blank' }; });
  // le card entrano nello stage, tra il pianeta attivo e la mezzaluna (la sezione .featured resta vuota, css la nasconde)
  const card = document.createElement('div'); card.className = 'sys-card';
  card.append(document.querySelector('.featured .feat-grid')); stage.append(card);

  // la card del pianeta attivo: le altre nascoste, la sua clip in play (js/preview.js le mette la sorgente)
  let shown = '';
  function showCard(id) {
    if (shown === id) return;
    shown = id;
    ORDER.forEach(k => {
      const f = feats[k], v = f.querySelector('video.pv'), on = k === id;
      f.classList.toggle('is-active', on);
      if (v) on ? v.play().catch(() => {}) : v.pause();
    });
  }
  showCard('fp');

  let T, D;
  const ll = (lon, lat) => { const c = Math.cos(lat * D); return [c * Math.sin(lon * D), Math.sin(lat * D), c * Math.cos(lon * D)]; };
  const DOT_K = .7;   // puntini piccoli rispetto alla sfera: l'effetto digitale
  const themed = [];  // funzioni (light) => ridipingi; chiamate al cambio tema

  function points(xyz, col, dot) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(xyz instanceof Float32Array ? xyz : new Float32Array(xyz), 3));
    g.setAttribute('color', new T.BufferAttribute(col, 4));
    return new T.Points(g, new T.PointsMaterial({ size: dot * DOT_K, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
  }
  // uno strato di puntini colorato da colorAt(i, light) -> [r, g, b, a] (0-1), ridipinto al cambio tema
  function layer(xyz, n, colorAt, dot) {
    const col = new Float32Array(n * 4), pts = points(xyz, col, dot), attr = pts.geometry.attributes.color;
    const paint = L => { for (let i = 0; i < n; i++) col.set(colorAt(i, L), i * 4); attr.needsUpdate = true; };
    paint(isLight()); themed.push(paint);
    return pts;
  }
  function fill(dark, light, r = .995, geo) {
    const m = new T.Mesh(geo || new T.SphereGeometry(r, 64, 32), new T.MeshBasicMaterial({ color: isLight() ? light : dark, side: geo ? T.DoubleSide : T.FrontSide }));
    themed.push(L => m.material.color.set(L ? light : dark));
    return m;
  }

  // POLENTA: [lon, lat, peso] con un colore per tema
  function dotBody(dots, dark, light, fd, fl, dot) {
    const xyz = [];
    dots.forEach(([lon, lat]) => xyz.push(...ll(lon, lat)));
    const at = (i, L) => { const c = L ? light : dark, w = dots[i][2] ?? 1; return [c[0] / 255, c[1] / 255, c[2] / 255, c[3] * w]; };
    return new T.Group().add(fill(fd, fl), layer(xyz, dots.length, at, dot));
  }

  // Marte e Luna sono un corpo solo (Luna 0.51 come in POLENTA). La Luna sta in alto a destra, staccata di 0.2
  // (distanza 1.71): la coppia e' larga 2.86 invece di 3.13 e da attiva lascia piu' spazio alla card
  function polenta(mars, moon) {
    const m = dotBody(mars, [255, 165, 120, .88], [170, 72, 34, .9], '#1d1512', '#e9ddd3', 1.8);
    const l = dotBody(moon, [205, 208, 215, .59], [58, 60, 68, .85], '#17181c', '#e2e0da', 1.4);
    l.position.set(1.35, 1.05, 0); l.scale.setScalar(.51);
    const g = new T.Group().add(m, l);
    g.userData.tick = dt => { m.rotation.y += dt / 9; l.rotation.y += dt / 6.4; };
    g.userData.hit = [[m, 1], [l, 1]];
    return g;
  }

  // Morte Nera: sfera con il buco della parabola + sfera interna che chiude la vista attraverso il buco
  function deathStar({ axis, cut, dots }) {
    const xyz = new Float32Array(dots.length * 3); dots.forEach(([x, y, z], i) => xyz.set([x, y, z], i * 3));
    const at = (i, L) => {
      const w = dots[i][3];
      if (dots[i][4]) return L ? [.85, .5, 0, 1] : [1, .83, .5, 1];
      // tema chiaro: come lo scuro, sfera grigia con i pannelli chiari (puntini scuri su sfera chiara sembrava rumore)
      return L ? [.5 * w + .32, .51 * w + .32, .55 * w + .33, .6 + .4 * w] : [.75 * w + .1, .76 * w + .1, .8 * w + .1, .55 + .4 * w];
    };
    const th = Math.acos(cut) + .02;
    const shell = fill('#141418', '#55575e', 0, new T.SphereGeometry(.985, 64, 48, 0, Math.PI * 2, th, Math.PI - th));
    shell.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...axis));
    const g = new T.Group().add(shell, fill('#0c0c0f', '#3c3e44', .87), layer(xyz, dots.length, at, 1.5));
    // il cratere parte dietro, a -120 gradi dal centro: girando (rotation.y cresce, i punti vanno da sinistra
    // verso il centro) spunta dal bordo sinistro dopo ~5s e arriva al centro in ~19s, mentre lo guardi
    g.rotation.y = -120 * D - Math.atan2(axis[0], axis[2]);
    g.userData.tick = dt => { g.rotation.y += dt / 9; };
    g.userData.hit = [[g, 1]];
    return g;
  }

  // Terra: un colore solo, la foto decide il peso: mare quasi spento, terra sulla luminosita' in 4 livelli
  function earth(img) {
    const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, W, H).data, n = 60000, g = Math.PI * (3 - Math.sqrt(5)), xyz = [], w = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lat = Math.asin(1 - 2 * (i + .5) / n) / D, lon = ((i * g / D) % 360 + 540) % 360 - 180;
      const k = (Math.min(H - 1, (90 - lat) / 180 * H | 0) * W + Math.min(W - 1, (lon + 180) / 360 * W | 0)) * 4;
      const R = px[k], G = px[k + 1], B = px[k + 2], sea = B > R * 1.4 && B > G * 1.2, l = (.299 * R + .587 * G + .114 * B) / 255;
      xyz.push(...ll(lon, lat)); w[i] = sea ? -1 : Math.ceil(Math.min(1, .35 + l * 1.1) * 4) / 4;
    }
    const at = (i, L) => L ? [30 / 255, 80 / 255, 160 / 255, w[i] < 0 ? .16 : w[i] * .9] : [190 / 255, 215 / 255, 1, w[i] < 0 ? .12 : w[i]];
    return new T.Group().add(fill('#0b1018', '#e1e5ec'), layer(xyz, n, at, 1.8));
  }

  // FOOTPRINT: heatmap rossa sopra la Terra, un puntino per cella da 5 km, due strati: memoria (rosso tenue)
  // e presente (mese corrente con coda di TAU mesi, puntini piu' grossi). Un giro = un ciclo: i mesi dal 2020
  // partono quando l'Europa entra da sinistra (START) e finiscono con l'Europa al centro (PLAY), poi resta la
  // heatmap dei 10 anni fino al giro dopo. L'asse e' inclinato verso la camera: a meta' giro l'Europa e' al centro.
  function footprint(img) {
    const e = earth(img), F = window.FOOTPRINT, cells = F.grid.cells, NC = cells.length, M = F.grid.months.length;
    const xyz = []; cells.forEach(([la, lo]) => xyz.push(...ll(lo, la).map(v => v * 1.004)));
    const memCol = new Float32Array(NC * 4), glowCol = new Float32Array(NC * 4);
    const mem = points(xyz, memCol, 2), glw = points(xyz, glowCol, 4.2), mA = mem.geometry.attributes.color, gA = glw.geometry.attributes.color;
    const red = L => { const c = L ? [.82, .1, .08] : [1, .23, .2]; for (let i = 0; i < NC; i++) { memCol.set(c, i * 4); glowCol.set(c, i * 4); } mA.needsUpdate = gA.needsUpdate = true; };
    red(isLight()); themed.push(red);
    e.add(mem, glw);
    const TAU = 5, decay = Math.exp(-1 / TAU), glow = new Float32Array(NC), seen = new Float32Array(NC), total = new Float32Array(NC);
    F.grid.months.forEach(m => m.forEach(([c, v]) => { total[c] += v; }));
    const lMax = Math.log10(1 + Math.max(...total));
    function paint(fin) {
      for (let c = 0; c < NC; c++) {
        const m = seen[c] ? .2 + .55 * Math.log10(1 + seen[c]) / lMax : 0, t = .35 + .65 * Math.log10(1 + total[c]) / lMax;
        memCol[c * 4 + 3] = total[c] ? m + (t - m) * fin : 0;
        glowCol[c * 4 + 3] = Math.min(1, Math.sqrt(glow[c]) / 3.2) * (1 - fin);
      }
      mA.needsUpdate = gA.needsUpdate = true;
    }
    const FRONT = -9 * D, FIRST = F.months.findIndex(m => m.m === '2020-01');
    const START = .25, PLAY = .5, RATE = (M - FIRST) / (PLAY - START);   // mesi per giro (~324)
    let phase = START, month = FIRST - 1, fin = 0;   // al caricamento si parte subito dal 2020
    const tilt = new T.Group().add(e); tilt.rotation.x = 41 * D;
    const reset = () => { month = FIRST - 1; fin = 0; glow.fill(0); seen.fill(0); paint(0); };
    tilt.userData.tick = (dt, label) => {
      phase += dt / 9 / (2 * Math.PI);   // stessa velocita' degli altri pianeti
      if (phase >= 1) { phase -= 1; reset(); }
      e.rotation.y = FRONT + Math.PI + phase * 2 * Math.PI;
      const target = Math.min(M - 1, FIRST + Math.floor(Math.max(0, phase - START) * RATE));
      if (target > month) {
        while (month < target) { month++; for (let c = 0; c < NC; c++) glow[c] *= decay; for (const [c, v] of F.grid.months[month]) { glow[c] += v; seen[c] += v; } }
        paint(0);
      }
      if (phase > PLAY && fin < 1) { fin = Math.min(1, fin + dt / 1.5); paint(fin); }
      const m = F.months[Math.max(FIRST, month)].m.split('-');
      label.textContent = 'footprint · ' + (phase > PLAY ? '2015 – 2026' : new Date(m[0], m[1] - 1).toLocaleString('en', { month: 'short' }) + ' ' + m[0]);
    };
    tilt.userData.hit = [[e, 1]];
    return tilt;
  }

  // ---------- scena ----------
  function boot() {
    T = window.THREE; D = Math.PI / 180;
    const r = new T.WebGLRenderer({ alpha: true, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    stage.prepend(r.domElement);
    // camera ortografica: con lo stage cosi' largo la prospettiva stirava in ovali i pianeti ai lati
    const sc = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    // ruota a sinistra: i tre pianeti sul bordo di un cerchio (centro C, raggio R) a 120 gradi l'uno dall'altro.
    // Quello attivo sta davanti, a destra del cerchio a meta' altezza, grande; gli altri due sopra e sotto,
    // piccoli. La card sta a destra dell'attivo. HH e' meta' altezza della scena; la card prende
    // --card-l (px) da qui.
    const HH = 1.25, BIG = .68, SMALL = .3, R = .82;
    // il canvas sborda dallo stage di PAD (unita' di scena) per lato: mentre la ruota gira i pianeti escono
    // sopra, sotto e a sinistra, e dentro lo stage venivano tagliati come in una scatola
    const PAD = .6;
    // La scala (u, px per unita') viene dall'altezza del css; se la card piu' alta delle tre non ci sta (schermi
    // stretti: card stretta, testo lungo) lo stage cresce ma i pianeti restano della stessa misura, centrati.
    let W = 1, H = 1, C = 0, PX = 0;
    function size() {
      stage.style.minHeight = '';
      W = stage.clientWidth;
      const u = stage.clientHeight / (2 * HH), X = W / 2 / u;   // px per unita'; meta' larghezza in unita'
      C = -X + 1;   // sopra e sotto stanno a C - R/2: la coppia piccola di POLENTA e' larga 1
      // Marte+Luna davanti (centrati con dx): la Luna finisce a C + R + 1.43 * BIG
      stage.style.setProperty('--card-l', (C + R + 1.43 * BIG + .12 + X) * u + 'px');
      const tall = Math.max(...ORDER.map(k => { const f = feats[k], d = f.style.display; f.style.display = 'grid'; const h = f.offsetHeight; f.style.display = d; return h; }));
      stage.style.minHeight = tall + 24 + 'px';
      H = stage.clientHeight;
      const Y = H / 2 / u;   // meta' altezza in unita'
      PX = Math.round(PAD * u);
      const cw = W + 2 * PX, ch = H + 2 * PX, now = r.getSize(new T.Vector2());
      // setSize svuota il canvas: dopo il render del frame lasciava un frame vuoto a ogni cambio di card
      if (now.x !== cw || now.y !== ch) { r.setSize(cw, ch); r.domElement.style.inset = -PX + 'px'; }
      const p = PX / u;
      cam.left = -X - p; cam.right = X + p; cam.top = Y + p; cam.bottom = -Y - p; cam.updateProjectionMatrix();
      cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0);
    }
    const ro = new ResizeObserver(size); ro.observe(stage); ro.observe(card); size();   // card: i font che arrivano tardi

    const bodies = [];
    let sel = ORDER.indexOf('fp');
    // ogni corpo: outer (posto e scala sulla ruota) > ... > spin (la rotazione del drag) > la sfera (che gira da se').
    // Uno spin per ogni sfera di userData.hit: Marte e Luna si trascinano ciascuno per conto suo
    function place(id, obj, big, name) {
      const outer = new T.Group(); outer.userData = obj.userData; sc.add(outer);
      const spins = obj.userData.hit.map(([o]) => {
        const S = new T.Group();
        if (o === obj) { outer.add(S); S.add(o); }
        else { const p = o.parent; S.position.copy(o.position); o.position.set(0, 0, 0); p.remove(o); p.add(S); S.add(o); }
        return { S, vx: 0, vy: 0 };
      });
      if (!obj.parent) outer.add(obj);
      const l = document.createElement('div'); l.className = 'sys-label'; l.textContent = l.dataset.n = name; stage.appendChild(l);
      const mats = []; obj.traverse(o => { if (o.isPoints) mats.push(o.material); });   // i puntini: la loro opacita' e' la luce
      bodies[ORDER.indexOf(id)] = { id, obj: outer, spins, big, l, mats, lit: 0 };
    }
    ORDER.forEach(id => {   // link per la tastiera: a fuoco attivano il pianeta
      const a = document.createElement('a'); a.href = P[id].url; a.textContent = P[id].name;
      if (P[id].ext) { a.target = '_blank'; a.rel = 'noopener'; }
      a.addEventListener('focus', () => select(ORDER.indexOf(id)));
      sr.appendChild(a);
    });
    const J = p => fetch('images/dots/' + p + '.json').then(x => x.json());
    const IMG = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
    const SCRIPT = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
    Promise.all([J('mars-dots'), J('moon-dots'), J('deathstar-dots'), IMG('images/dots/earth.jpg'), window.FOOTPRINT ? 0 : SCRIPT('js/projects/data/footprint.js?v=20261003k')])
      .then(([mars, moon, dsd, img]) => {
        const pol = polenta(mars, moon); pol.userData.dx = -.43;   // Marte + Luna: centrata la coppia, non Marte (per unita' di scala)
        place('pol', pol, 1, 'polenta');
        place('fp', footprint(img), 1.1, 'footprint');
        place('rag', deathStar(dsd), 1, 'rag');
      });
    document.addEventListener('themechange', () => { const L = isLight(); themed.forEach(f => f(L)); });

    // off va da `from` a `target` lungo la ruota, dalla parte piu' corta, in SPIN secondi (ease in-out); tw 0..1.
    // La card cambia a meta' giro (loop), quando il pianeta sta arrivando davanti
    const SPIN = .75;
    let off = sel, from = sel, target = sel, tw = 1;
    function select(i) {
      if (i < 0 || i === sel) return;
      sel = i;
      const n = ORDER.length; let t = i; while (t - off > n / 2) t -= n; while (off - t > n / 2) t += n;
      from = off; target = t; tw = 0;
    }

    // hit test in schermo: centro e raggio proiettati di ogni sfera (con un po' di margine: facile da prendere)
    const v = new T.Vector3(), v2 = new T.Vector3(), ws = new T.Vector3();
    function screenCircle(mesh, rad) {
      mesh.getWorldPosition(v); mesh.getWorldScale(ws);
      v2.copy(v); v2.x += rad * ws.x; v.project(cam); v2.project(cam);
      const cw = W + 2 * PX, ch = H + 2 * PX;   // in px dello stage, non del canvas
      return [(v.x + 1) / 2 * cw - PX, (1 - v.y) / 2 * ch - PX, Math.abs(v2.x - v.x) / 2 * cw];
    }
    // il corpo piu' vicino alla camera sotto il puntatore; in hitK la sfera presa (Marte o Luna)
    let hitK = 0;
    function hitAt(x, y) {
      let best = -1, bz = -1e9;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i]; if (!b) continue;
        b.obj.userData.hit.forEach(([mesh, rad], k) => { const [cx, cy, cr] = screenCircle(mesh, rad); if (Math.hypot(x - cx, y - cy) < cr * 1.15 + 6 && b.obj.position.z > bz) { best = i; bz = b.obj.position.z; hitK = k; } });
      }
      return best;
    }
    const local = e => { const b = stage.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    // Click (o presa per il drag) su un pianeta: la ruota lo porta davanti, e' il selezionato. Hover su un altro
    // pianeta a ruota ferma: la sua card in anteprima (hot, e il pianeta cresce un po'); tolto il cursore torna
    // la card del selezionato. Il test si rifa' a ogni frame sull'ultima posizione del mouse (la ruota si muove
    // anche col mouse fermo); dopo un click, il pianeta che arriva sotto il mouse fermo non fa anteprima finche'
    // il mouse non esce dai pianeti (armed). I pianeti non aprono niente: il progetto si apre solo dalla card.
    const DIM = .35;   // luce dei puntini a pianeta spento (0-1)
    let ptr = null, armed = true, hot = -1, hov = -1;   // hot: anteprima della card; hov: sotto il mouse (luce)
    // drag: il pianeta preso gira su se stesso come un mappamondo (premultiply: assi dello schermo, la ruota non
    // ruota), 1 raggio trascinato = 1 radiante; lasciato, continua per inerzia. Prenderne uno sopra o sotto lo
    // seleziona: la ruota lo porta davanti mentre lo stai girando
    let drag = null;
    const q = new T.Quaternion(), qp = new T.Quaternion(), AX = new T.Vector3(1, 0, 0), AY = new T.Vector3(0, 1, 0), Q0 = new T.Quaternion();
    // gira lo spin sp di (ax, ay) radianti attorno agli assi dello schermo: lo spin puo' stare dentro un gruppo
    // ruotato (la Terra e' inclinata di 41 gradi), quindi la rotazione si porta nel suo spazio: P^-1 q P
    function turn(sp, ax, ay) {
      q.setFromAxisAngle(AX, ay).multiply(qp.setFromAxisAngle(AY, ax));
      sp.S.parent.getWorldQuaternion(qp);
      sp.S.quaternion.premultiply(q.premultiply(qp.clone().invert()).multiply(qp));
    }
    stage.addEventListener('pointerdown', e => {
      if (e.button) return;
      const i = hitAt(...local(e)); if (i < 0) return;
      e.preventDefault(); stage.setPointerCapture(e.pointerId);
      const b = bodies[i];
      drag = { b, k: hitK, sp: b.spins[hitK], x: e.clientX, y: e.clientY, t: performance.now() }; drag.sp.vx = drag.sp.vy = 0;
      stage.classList.add('is-drag'); select(i); armed = false;
    });
    stage.addEventListener('pointermove', e => {
      ptr = local(e);
      if (!drag) return;
      const { b, k, sp } = drag, cr = Math.max(14, screenCircle(...b.obj.userData.hit[k])[2]), now = performance.now(), dt = Math.max(.008, (now - drag.t) / 1000);
      const ax = (e.clientX - drag.x) / cr, ay = (e.clientY - drag.y) / cr;
      turn(sp, ax, ay);
      sp.vx += (ax / dt - sp.vx) * .5; sp.vy += (ay / dt - sp.vy) * .5;   // velocita' angolare, smussata
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
    });
    const drop = () => {
      if (!drag) return;
      if (performance.now() - drag.t > 80) drag.sp.vx = drag.sp.vy = 0;   // fermo prima di lasciare: niente lancio
      drag = null; armed = false; stage.classList.remove('is-drag');
    };
    stage.addEventListener('pointerup', drop);
    stage.addEventListener('pointercancel', drop);
    stage.addEventListener('pointerleave', () => { ptr = null; });
    function hover(dt) {
      const i = ptr ? hitAt(...ptr) : -1, settled = tw >= 1;
      hov = drag ? bodies.indexOf(drag.b) : i;
      stage.classList.toggle('is-hit', i >= 0);
      if (i < 0 && settled) armed = true;   // durante il giro il cursore passa nel vuoto: non conta
      hot = settled && !drag && armed && i >= 0 && i !== sel ? i : -1;
    }

    // loop: fermo fuori schermo
    let on = true, last = performance.now();
    new IntersectionObserver(es => { const was = on; on = es[0].isIntersecting; if (on && !was) { last = performance.now(); requestAnimationFrame(loop); } }).observe(stage);
    function loop(now) {
      if (!on) return;
      const dt = still ? 0 : Math.min(.05, (now - last) / 1000); last = now;
      tw = still ? 1 : Math.min(1, tw + dt / SPIN);
      off = from + (target - from) * (tw < .5 ? 4 * tw ** 3 : 1 - (2 - 2 * tw) ** 3 / 2);
      if (tw >= .45) showCard(ORDER[hot >= 0 ? hot : sel]);   // l'anteprima dell'hover, se c'e'
      bodies.forEach((b, i) => {
        if (!b) return;
        // th: 0 davanti (destra della ruota), +120 sopra, -120 sotto; front: 1 davanti, 0 sopra/sotto
        b.h = (b.h || 0) + ((i === hot) - (b.h || 0)) * Math.min(1, dt * 10 || 1);
        // luce: spenti (DIM) di base, accesi se selezionati o sotto il mouse. Scuro: il colore dei puntini
        // moltiplicato (scurisce davvero: l'opacita' si sommava tra puntini sovrapposti). Chiaro: l'opacita',
        // cosi' i puntini sbiadiscono nella sfera chiara di sotto
        b.lit += (+(i === sel || i === hov) - b.lit) * Math.min(1, dt * 6 || 1);
        const k = DIM + (1 - DIM) * b.lit, L = isLight();
        b.mats.forEach(m => { m.color.setScalar(L ? 1 : k); m.opacity = L ? k * k : 1; });   // k^2: i puntini sovrapposti sommano
        b.spins.forEach(sp => {   // inerzia del drag, poi torna piano dritto (Footprint deve guardare l'Europa)
          if (drag && drag.sp === sp) return;
          if (Math.hypot(sp.vx, sp.vy) > .05) { turn(sp, sp.vx * dt, sp.vy * dt); const k = Math.exp(-dt * 2.5); sp.vx *= k; sp.vy *= k; }
          else { sp.vx = sp.vy = 0; sp.S.quaternion.slerp(Q0, Math.min(1, dt * 1.2)); }
        });
        const th = (off - i) * 120 * D, front = (Math.cos(th) + .5) / 1.5;
        const s = b.big * (SMALL + (BIG - SMALL) * front) * (1 + .12 * b.h);   // dietro (-1/3) ancora piu' piccolo
        b.obj.position.set(C + R * Math.cos(th) + (b.obj.userData.dx || 0) * s, R * Math.sin(th), front);   // z: davanti sopra
        b.obj.scale.setScalar(s);
        if (b.obj.userData.tick) b.obj.userData.tick(dt, b.l);
        if (i !== sel && b.l.textContent !== b.l.dataset.n) b.l.textContent = b.l.dataset.n;   // il mese di Footprint solo da attivo
        const [cx, cy, cr] = screenCircle(...b.obj.userData.hit[0]);
        const mid = b.id === 'pol' ? cx + cr * .43 : cx;   // etichetta di POLENTA sotto la coppia
        b.l.style.transform = `translate(${mid - b.l.offsetWidth / 2}px, ${cy + cr + 8}px)`;
        b.l.classList.toggle('is-on', i === sel);
        b.l.style.opacity = Math.max(0, Math.min(1, front * 3 + 1));   // chi passa dietro: niente etichetta
      });
      hover(dt);
      r.render(sc, cam);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // un solo three.js per pagina: se cube-loader / eightball lo stanno caricando mi aggancio
  function start() {
    if (window.THREE) return boot();
    const pending = document.querySelector('script[src*="three.min.js"]');
    if (pending) return pending.addEventListener('load', boot);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = boot;
    document.head.appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '300px' });
    io.observe(stage);
  } else start();
})();
