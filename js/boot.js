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
  // Rasterizzatore minimo: per ogni cella di testo sul canvas, la faccia visibile che la copre (cubo
  // convesso: al massimo una), le coordinate (u, v) sulla faccia -> il tassello 3x3 (bordi vuoti) e la
  // luce -> un carattere della rampa. Le facce senza colore sono grigie; COLOR_AT dice quando ognuna
  // prende il suo colore (sempre la piu' rivolta verso chi guarda tra quelle ancora grigie), e la
  // rotazione accelera con loro. Colori di js/rubik3d.js.
  const FACES = [   // normale, asse u, asse v, colore (scuro, chiaro: il bianco sul fondo chiaro sparisce)
    [[0, 1, 0], [1, 0, 0], [0, 0, 1], '#ffffff', '#9d998f'],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0], '#e53935', '#e53935'],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0], '#ef6c00', '#ef6c00'],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0], '#1565c0', '#1565c0'],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0], '#43a047', '#43a047'],
    [[0, -1, 0], [1, 0, 0], [0, 0, -1], '#ffd600', '#c9a400'],
  ];
  const COLOR_AT = [.45, .83, 1.13, 1.36, 1.53, 1.655];   // secondi: intervalli 380, 300, 230, 170, 125 ms
  const RAMP = '.:-=+*#%@';
  function asciiCube(geom) {
    const cv = document.createElement('canvas'), x = cv.getContext('2d');
    cv.className = 'ci-ascii';
    const LD = [-.35, .55, .75], ll = Math.hypot(...LD); LD.forEach((c, i) => LD[i] = c / ll);
    const light = root.dataset.theme === 'light';
    const grey = getComputedStyle(root).getPropertyValue('--fg-muted').trim() || '#888';
    const colored = new Array(6).fill(-1);   // secondo in cui la faccia ha preso colore
    let t = 0, spin = 0, last = performance.now(), raf = 0, W = 0, H = 0, dpr = 1;
    function fit() {
      dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    fit(); addEventListener('resize', fit);
    function rot(v, ax, ay) {   // prima attorno a y, poi a x
      const x1 = v[0] * Math.cos(ay) + v[2] * Math.sin(ay), z1 = -v[0] * Math.sin(ay) + v[2] * Math.cos(ay);
      return [x1, v[1] * Math.cos(ax) - z1 * Math.sin(ax), v[1] * Math.sin(ax) + z1 * Math.cos(ax)];
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      const n = colored.filter(c => c >= 0).length;
      spin += dt * (.9 + 6 * (n / 6) ** 2);   // sempre piu' veloce
      const ay = spin, ax = -.42 + .35 * spin;   // gira su y e piu' piano su x: prima o poi si vedono tutte e sei
      const F = FACES.map(f => ({ n: rot(f[0], ax, ay), a: rot(f[1], ax, ay), b: rot(f[2], ax, ay), col: f[light ? 4 : 3] }));
      if (n < 6 && t >= COLOR_AT[n]) {   // la prossima: la piu' rivolta verso chi guarda tra le grigie
        let k = -1; F.forEach((f, i) => { if (colored[i] < 0 && (k < 0 || f.n[2] > F[k].n[2])) k = i; });
        colored[k] = t;
      }
      const { cx, cy, size } = geom(), S = size * .35 / 1.6;   // il cubo vero occupa ~70% del suo canvas
      const fs = Math.max(7, Math.round(size / 78)), cw = fs * .62, ch = fs * 1.05;
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      x.font = `600 ${fs}px 'JetBrains Mono', monospace`; x.textBaseline = 'middle'; x.textAlign = 'center';
      x.globalAlpha = 1;
      const vis = F.map((f, i) => [f, i]).filter(([f]) => f.n[2] > .02);
      const R = S * 1.75;
      for (const [f, i] of vis) {
        const det = f.a[0] * f.b[1] - f.b[0] * f.a[1]; if (Math.abs(det) < 1e-4) continue;
        const shade = .3 + .7 * Math.max(0, f.n[0] * LD[0] + f.n[1] * LD[1] + f.n[2] * LD[2]);
        const on = colored[i] >= 0, flash = on ? Math.max(0, 1 - (t - colored[i]) / .3) : 0;
        x.fillStyle = on ? f.col : grey;
        x.globalAlpha = Math.min(1, t / .25) * (on ? .55 + .45 * shade + .3 * flash : .35 + .5 * shade);
        const lv = Math.min(RAMP.length - 1, Math.floor((shade + flash * .5) * RAMP.length));
        for (let py = cy - R + ch / 2; py < cy + R; py += ch) for (let px = cx - R + cw / 2; px < cx + R; px += cw) {
          const dx = (px - cx) / S - f.n[0], dy = (cy - py) / S - f.n[1];
          const u = (dx * f.b[1] - dy * f.b[0]) / det, v = (f.a[0] * dy - f.a[1] * dx) / det;
          if (u < -1 || u > 1 || v < -1 || v > 1) continue;
          const su = (u + 1) * 1.5 % 1, sv = (v + 1) * 1.5 % 1;
          if (Math.min(su, 1 - su, sv, 1 - sv) < .1) continue;   // il nero tra i tasselli
          x.fillText(RAMP[lv], px, py);
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return {
      el: cv,
      done: () => colored.every(c => c >= 0),
      stop() { cancelAnimationFrame(raf); removeEventListener('resize', fit); cv.remove(); },
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
    let geo = null;   // centro e misura del cubo grande: li usa anche il cubo ASCII
    function place() {
      cube.style.transform = '';
      const r = cube.getBoundingClientRect(), wide = innerWidth >= 700;
      const size = wide ? Math.min(innerHeight * 0.8, innerWidth * 0.58, 900) : Math.min(innerWidth * 0.94, innerHeight * 0.62, 760);
      const cx = innerWidth / 2, cy = wide ? innerHeight / 2 : innerHeight * 0.45;
      const k = size / r.width;
      const lx = wide ? (cx + size * 0.35 + innerWidth) / 2 : cx, ly = wide ? cy : (cy + size * 0.35 + innerHeight) / 2;
      ui.style.setProperty('--ci-x', lx + 'px');
      ui.style.setProperty('--ci-y', ly + 'px');
      geo = { cx, cy, size };
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
    const ascii = asciiCube(() => geo); ui.prepend(ascii.el);
    const t0 = performance.now();
    (function wait() {
      if (entered) return;
      if (ascii.done() && (cube.classList.contains('is-live') || performance.now() - t0 > 4000)) showCube();
      else setTimeout(wait, 50);
    })();
    // l'ASCII sfuma e il cubo vero compare sul posto con mezzo giro in 3D
    function showCube() {
      revealed = true;
      ascii.el.classList.add('out'); setTimeout(ascii.stop, 500);
      cube.classList.replace('ascii-wait', 'cube-reveal'); ui.classList.remove('ci-wait');
      if (window.rubikSpin) window.rubikSpin(1100, -Math.PI);
      // entered spegne anche cube-in: togliendo solo cube-reveal, il canvas ripartiva con cube-in (lampo)
      setTimeout(() => cube.classList.replace('cube-reveal', 'entered'), 700);
      // il cubo si fa notare: ogni 2.6s gira una faccia e la rimette a posto
      tease = setInterval(() => window.rubikTease && window.rubikTease(), 2600);
      setTimeout(() => !entered && window.rubikTease && window.rubikTease(), 900);
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
