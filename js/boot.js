// ============================
// INTRO + BOOT + CUBO
// ============================
// Prima visita della sessione: la pagina e' vuota (resta lo spazio) e al centro, grande, compare
// subito un cubo di Rubik fatto di caratteri (asciiCube): gira e le facce prendono il colore una
// alla volta, sempre piu' veloce, mentre three.js si scarica. Pronto il cubo vero, l'ASCII sfuma e
// resta il cubo WebGL con CLICK THE CUBE accanto. Click o tap sul cubo (o sulla scritta): il cubo
// mescola ancora grande, poi vola al suo posto nell'hero girando e la pagina si monta a cascata.
// Esc, Invio, scroll o "skip" entrano subito, senza shuffle. (Prima c'erano due righe di boot
// che aspettavano three.js: laggava.)
// Il cubo e' lo stesso elemento della pagina, spostato con transform (FLIP): nessun
// secondo canvas WebGL. Con prefers-reduced-motion, o gia' visto nella sessione: pagina subito.
(function() {
  const container = document.querySelector('.container');
  const root = document.documentElement;

  const reveal = sel => document.querySelectorAll(sel).forEach(el => el.classList.add('revealed'));
  const skip = sessionStorage.getItem('introSeen')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (skip) {
    container.classList.add('visible');
    reveal('[data-boot]');
    return;
  }
  sessionStorage.setItem('introSeen', 'true');
  // dopo gli altri script (cube-loader definisce cubeLoad): three.js si scarica mentre gira l'ASCII
  setTimeout(() => { window.cubeLoad && window.cubeLoad(); startIntro(); }, 0);

  // ---------- il cubo ASCII ----------
  // Il cubo vero fatto di caratteri, nello stesso punto e nella stessa posa: i pixel vengono da
  // icons/cube-ph.png (il segnaposto, che e' il cubo WebGL a riposo), una cella di testo per blocco di
  // pixel, e ogni carattere prende il colore del suo pixel. Prima compare la sagoma (corpo nero e
  // tasselli ancora grigi), poi i tasselli si colorano uno alla volta, faccia per faccia, ogni volta
  // prima (STEP0 * RATIO^k). Poi il cubo si materializza: una scansione dall'alto (con un po' di
  // disordine) trasforma ogni carattere, con un lampo, nei pixel veri dell'immagine in quel punto. Alla fine
  // sul canvas c'e' il cubo intero, identico al cubo WebGL fermo: done() e' vero e l'intro ci mette sotto
  // il cubo vero, poi toglie il canvas. Nessun cubo nuovo che compare: e' lo stesso che prende corpo.
  // I pixel della materializzazione sono quelli del canvas WebGL (copiati dopo ogni render, a piena
  // risoluzione): il segnaposto da 340px ingrandito era sgranato. Il segnaposto resta se three.js tarda.
  const RAMP = '.:-=+*#%@';
  const PAL = [[245, 245, 245], [229, 57, 53], [239, 108, 0], [21, 101, 192], [67, 160, 71], [255, 214, 0]];   // js/rubik3d.js
  const STEP0 = .15, RATIO = .86, BODY_IN = .3, MAT = 1.1;   // MAT: durata della materializzazione
  function asciiCube(target, img) {
    const cv = document.createElement('canvas'), x = cv.getContext('2d');
    cv.className = 'ci-ascii';
    const light = root.dataset.theme === 'light';
    const grey = getComputedStyle(root).getPropertyValue('--fg-muted').trim() || '#888';
    let W = 0, H = 0, dpr = 1, grid = null, t0 = 0, raf = 0, end = Infinity, matAt = Infinity, snap = null;
    window.rubikAfterRender = c => {   // la copia del cubo vero, fermo nella posa del segnaposto (rubikHold)
      if (!c.width) return;
      if (!snap) snap = document.createElement('canvas');
      if (snap.width !== c.width || snap.height !== c.height) { snap.width = c.width; snap.height = c.height; }
      const g = snap.getContext('2d'); g.clearRect(0, 0, snap.width, snap.height); g.drawImage(c, 0, 0);
    };
    function fit() {
      dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    fit(); addEventListener('resize', fit);
    // la griglia: colore medio di ogni cella, classe (vuota, corpo nero, colore della palette), tasselli
    // come componenti connesse della stessa classe, e quando compare ciascuno
    function build(rw) {
      const fs = Math.max(7, Math.round(rw / 60)), cols = Math.round(rw / (fs * .62)), rows = Math.round(rw / (fs * 1.05));
      const c = document.createElement('canvas'); c.width = cols; c.height = rows;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, cols, rows);
      const px = g.getImageData(0, 0, cols, rows).data, n = cols * rows;
      const cls = new Int8Array(n), rgb = [], comp = new Int32Array(n).fill(-1), comps = [];
      for (let k = 0; k < n; k++) {
        const r = px[k * 4], gg = px[k * 4 + 1], b = px[k * 4 + 2], a = px[k * 4 + 3];
        rgb[k] = [r, gg, b];
        if (a < 120) cls[k] = -1;
        else if (Math.max(r, gg, b) < 80) cls[k] = 0;
        else { let best = 1, bd = 1e9; PAL.forEach((q, i) => { const d = (q[0] - r) ** 2 + (q[1] - gg) ** 2 + (q[2] - b) ** 2; if (d < bd) { bd = d; best = i + 1; } }); cls[k] = best; }
      }
      for (let k = 0; k < n; k++) {   // flood fill dei tasselli
        if (cls[k] < 1 || comp[k] >= 0) continue;
        const id = comps.length, st = [k], cells = []; comp[k] = id;
        while (st.length) {
          const q = st.pop(), cx = q % cols, cy = (q / cols) | 0; cells.push(q);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy, m = ny * cols + nx;
            if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && comp[m] < 0 && cls[m] === cls[k]) { comp[m] = id; st.push(m); }
          }
        }
        const mx = cells.reduce((s, q) => s + q % cols, 0) / cells.length, my = cells.reduce((s, q) => s + ((q / cols) | 0), 0) / cells.length;
        comps.push({ cls: cls[k], cells, mx, my, at: 0 });
      }
      // ordine: faccia per faccia (la classe piu' in alto, poi da sinistra), dentro la faccia in ordine di lettura;
      // i pezzetti (logo, bordi sfumati) escono insieme al tassello grande piu' vicino
      const big = comps.filter(o => o.cells.length >= 6), small = comps.filter(o => o.cells.length < 6);
      const face = {}; big.forEach(o => { (face[o.cls] = face[o.cls] || []).push(o); });
      const faces = Object.values(face).map(a => ({ a, y: a.reduce((s, o) => s + o.my, 0) / a.length, x: a.reduce((s, o) => s + o.mx, 0) / a.length }))
        .sort((p, q) => Math.abs(p.y - q.y) > rows * .12 ? p.y - q.y : p.x - q.x);
      let tt = BODY_IN, d = STEP0;
      faces.forEach(f => f.a.sort((p, q) => Math.abs(p.my - q.my) > 2 ? p.my - q.my : p.mx - q.mx).forEach(o => { o.at = tt; tt += d; d *= RATIO; }));
      small.forEach(o => { let b = big[0], bd = 1e9; big.forEach(q => { const dd = (q.mx - o.mx) ** 2 + (q.my - o.my) ** 2; if (dd < bd) { bd = dd; b = q; } }); o.at = b ? b.at : BODY_IN; });
      matAt = tt - d / RATIO + .2;
      // quando ogni cella diventa pixel: riga (dall'alto) + un po' di caso, smussato
      const mat = new Float32Array(n);
      for (let k = 0; k < n; k++) { const key = ((k / cols | 0) / rows) * .75 + Math.random() * .25; mat[k] = MAT * key * key * (3 - 2 * key); }
      end = matAt + MAT + .05;
      return { fs, cols, rows, cls, rgb, comp, comps, rw, mat };
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const r = target().getBoundingClientRect(); if (!r.width) return;
      if (!grid || Math.abs(grid.rw - r.width) > 1) grid = build(r.width);
      const t = (now - t0) / 1000, { fs, cols, rows, cls, rgb, comp, comps, mat } = grid, cw = r.width / cols, ch = r.height / rows;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      const mt = t - matAt;   // > 0: materializzazione in corso
      if (mt > 0) {   // le celle gia' materializzate: i pixel dell'immagine, ritagliati (rettangoli un filo piu' grandi: niente righe tra le celle)
        x.save(); x.beginPath();
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (mt >= mat[j * cols + i]) x.rect(r.left + i * cw - .3, r.top + j * ch - .3, cw + .6, ch + .6);
        x.clip(); x.globalAlpha = 1; x.drawImage(snap || img, r.left, r.top, r.width, r.height); x.restore();
      }
      x.font = `700 ${fs}px 'JetBrains Mono', monospace`; x.textBaseline = 'middle'; x.textAlign = 'center';
      const fade = Math.min(1, t / BODY_IN);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, c = cls[k]; if (c < 0 || (mt > 0 && mt >= mat[k])) continue;
        const o = c > 0 ? comps[comp[k]] : null, on = o && t >= o.at, pre = mt > mat[k] - .12;   // pre: sta per materializzarsi
        let ch2, col, a;
        if (!on) { ch2 = c === 0 ? '.' : ':'; col = grey; a = fade * (c === 0 ? .25 : .6); }   // corpo appena accennato, tasselli grigi
        else {
          const [R, G, B] = rgb[k], lum = (.299 * R + .587 * G + .114 * B) / 255, fl = Math.max(0, 1 - (t - o.at) / .18);
          ch2 = fl > .5 ? '@' : RAMP[Math.min(RAMP.length - 1, 3 + Math.floor(lum * (RAMP.length - 3)))];
          col = light && lum > .85 ? '#a29e95' : `rgb(${R},${G},${B})`; a = 1;
        }
        if (pre) { ch2 = '@'; col = light ? '#222' : '#fff'; a = 1; }   // il lampo prima del pixel
        x.globalAlpha = a; x.fillStyle = col;
        x.fillText(ch2, r.left + (i + .5) * cw, r.top + (j + .5) * ch);
      }
    }
    const ready = img.complete && img.naturalWidth ? Promise.resolve() : (img.decode ? img.decode() : new Promise(ok => img.onload = ok));
    ready.then(() => { t0 = performance.now(); raf = requestAnimationFrame(frame); }, () => { end = 0; });
    return {
      el: cv,
      done: () => grid && (performance.now() - t0) / 1000 >= end || end === 0,
      stop() { cancelAnimationFrame(raf); removeEventListener('resize', fit); cv.remove(); window.rubikAfterRender = null; },
    };
  }

  // i blocchi che compongono la pagina: sono box veri sia su desktop sia su mobile,
  // dove sidebar, main e i wrapper diventano display:contents
  const COMPOSE = '.site-domain, .profile-pic-container, .profile-id, .sidebar-contacts, nav[data-boot], .oracle, '
    + '.hero-copy-shell, .ticker-wrapper, .featured, .system, [data-boot="projects"], .bio-block, '
    + '.display-header, .display-section, .tech-grid-section, .other-section';

  function startIntro() {
    const cube = document.querySelector('.sidebar-cube');
    const btn = document.getElementById('sb-cube-btn');
    root.classList.add('intro');
    container.classList.add('visible');
    window.scrollTo(0, 0);
    document.querySelector('.hero-cube-shell').classList.add('revealed');

    const ui = document.createElement('div');
    ui.id = 'cube-intro';
    const verb = window.matchMedia('(hover: hover)').matches ? 'click' : 'tap';
    ui.innerHTML = '<span class="ci-domain">teemoteeo.dev</span>'
      + '<button class="ci-shuffle" type="button">' + verb + ' the cube<br>to advance</button>'
      + '<button class="ci-skip" type="button">skip →</button>';
    document.body.appendChild(ui);

    // cubo grande al centro; la scritta a meta' tra il cubo e il bordo destro (sui telefoni
    // tra il cubo e il fondo). Il cubo disegnato occupa ~70% del canvas: il suo bordo e'
    // a size * .35 dal centro, non al bordo del canvas.
    function place() {
      cube.style.transform = '';
      const r = cube.getBoundingClientRect(), wide = innerWidth >= 700;
      const size = wide ? Math.min(innerHeight * 0.8, innerWidth * 0.58, 900) : Math.min(innerWidth * 0.94, innerHeight * 0.62, 760);
      const cx = innerWidth / 2, cy = wide ? innerHeight / 2 : innerHeight * 0.45;
      const k = size / r.width;
      const lx = wide ? (cx + size * 0.35 + innerWidth) / 2 : cx, ly = wide ? cy : (cy + size * 0.35 + innerHeight) / 2;
      ui.style.setProperty('--ci-x', lx + 'px');
      ui.style.setProperty('--ci-y', ly + 'px');
      // canvas a piena risoluzione finche' il cubo e' grande (rubik3d la legge all'avvio)
      window.cubeRes = Math.min(2048, Math.round(size * (devicePixelRatio || 1)));
      if (window.rubikRes) window.rubikRes(window.cubeRes);
      cube.style.transform = `translate(${cx - (r.left + r.width / 2)}px, ${cy - (r.top + r.height / 2)}px) scale(${k})`;
    }
    place();
    addEventListener('resize', place);
    // prima il cubo ASCII; il cubo vero resta nascosto (anche se three.js arriva prima) finche' l'ASCII
    // ha colorato tutte le facce e three.js e' pronto (al massimo 4s, poi entra il segnaposto)
    let entered = false, revealed = false, tease = 0;
    cube.classList.add('ascii-wait'); ui.classList.add('ci-wait');
    const ph = cube.querySelector('.cube-ph'), cubeCanvas = document.getElementById('sb-cube-canvas');
    const ascii = asciiCube(() => cube.classList.contains('is-live') ? cubeCanvas : ph, ph); ui.prepend(ascii.el);
    const t0 = performance.now();
    (function wait() {
      if (entered) return;
      if (window.rubikHold) window.rubikHold(true);   // fermo nella posa dell'ASCII finche' non lo sostituisce
      if (ascii.done() && (cube.classList.contains('is-live') || performance.now() - t0 > 4000)) showCube();
      else requestAnimationFrame(wait);   // al frame: nessuna pausa tra cubo completo e partenza
    })();
    // l'ASCII sfuma e il cubo vero compare sul posto, fermo: stessa posa del segnaposto, combaciano
    function showCube() {
      revealed = true;
      ascii.el.classList.add('out'); setTimeout(ascii.stop, 800);   // .ci-ascii.out: aspetta che il cubo sotto sia pieno
      cube.classList.replace('ascii-wait', 'cube-reveal'); ui.classList.remove('ci-wait');
      // parte subito: il canvas ASCII ricopia il cubo vero a ogni frame (rubikAfterRender), girano insieme
      if (window.rubikHold) window.rubikHold(false);
      // entered spegne anche cube-in: togliendo solo cube-reveal, il canvas ripartiva con cube-in (lampo)
      setTimeout(() => cube.classList.replace('cube-reveal', 'entered'), 700);
      // il cubo si fa notare: ogni 2.6s gira una faccia e la rimette a posto (la prima dopo che ha ripreso a girare)
      tease = setInterval(() => window.rubikTease && window.rubikTease(), 2600);
    }

    function enter(shuffle) {
      if (entered) return;
      entered = true;
      if (!revealed) { ascii.stop(); cube.classList.remove('ascii-wait'); ui.classList.remove('ci-wait'); }
      ['keydown', 'wheel', 'touchmove'].forEach(t => removeEventListener(t, onSkip));
      clearInterval(tease);
      ui.classList.add('out');
      // prima mescola ancora grande, poi vola (lo skip vola subito). Se three.js non e'
      // ancora arrivato dal CDN aspetta fino a 1.5s il cubo vero, altrimenti vola senza shuffle
      if (!shuffle || !btn) return fly();
      const t0 = performance.now();
      (function go() {
        if (cube.classList.contains('is-live') && !(window.rubikBusy && window.rubikBusy())) { btn.click(); setTimeout(fly, 700); }
        else if (performance.now() - t0 > 1500) fly();
        else setTimeout(go, 50);
      })();
    }
    function fly() {
      removeEventListener('resize', place);
      root.classList.add('landing');
      root.classList.remove('intro');
      cube.classList.add('flying');
      cube.style.transform = '';
      if (window.rubikSpin) window.rubikSpin(900, Math.PI * 2);   // un giro intero mentre vola
      // la pagina si compone a pezzi mentre il cubo vola: ogni blocco entra in dissolvenza,
      // in ordine di lettura (dall'alto, poi da sinistra), sia nel layout desktop sia mobile
      const blocks = [...document.querySelectorAll(COMPOSE)].filter(e => e.getClientRects().length);
      const pos = e => { const r = e.getBoundingClientRect(); return [Math.round(r.top / 60), r.left]; };
      blocks.map(e => [e, pos(e)]).sort((a, b) => (a[1][0] - b[1][0]) || (a[1][1] - b[1][1]))
        // tutto si compone quando il cubo arriva (il volo dura 900ms): pochissimo scarto tra i blocchi
        .forEach(([e], i) => e.style.setProperty('--d', (420 + Math.min(i, 10) * 22) + 'ms'));   // parte a meta' volo, finito quando il cubo si posa
      root.classList.add('compose');
      reveal('[data-boot]');
      setTimeout(() => {
        cube.classList.remove('flying'); root.classList.remove('landing'); ui.remove();
        window.cubeRes = 512; if (window.rubikRes) window.rubikRes(512);   // piccolo: risoluzione normale
      }, 950);
    }

    // click/tap sul cubo: solo se non e' un trascinamento (il drag ruota il cubo)
    let down = null;
    cube.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    cube.addEventListener('pointerup', e => {
      if (revealed && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) enter(true);
      down = null;
    });
    ui.querySelector('.ci-shuffle').addEventListener('click', () => enter(true));
    ui.querySelector('.ci-skip').addEventListener('click', () => enter(false));
    function onSkip(e) {
      if (e.type !== 'keydown' || e.key === 'Escape' || e.key === 'Enter') enter(false);
    }
    ['keydown', 'wheel', 'touchmove'].forEach(t => addEventListener(t, onSkip, { passive: true }));
  }
})();

// ============================
// AGE CLOCK
// ============================
function updateAge() {
  const birth = new Date(2003, 0, 9);
  const now = new Date();
  let yr = now.getFullYear() - birth.getFullYear();
  let mo = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();
  if (d < 0) { d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); mo--; }
  if (mo < 0) { mo += 12; yr--; }
  document.getElementById('age-clock').textContent = `${yr} years ${mo} months ${d} days`;
}
updateAge();
setInterval(updateAge, 60000);
