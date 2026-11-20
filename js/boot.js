// ============================
// INTRO + BOOT + CUBO
// ============================
// Prima visita della sessione: due righe di boot, poi la pagina e' vuota (resta lo
// spazio) e c'e' solo il cubo, grande al centro, con CLICK THE CUBE sotto. Click o tap
// sul cubo (o sulla scritta): il cubo mescola ancora grande, poi vola al suo posto
// nell'hero girando e la pagina si monta a cascata. Esc, Invio, scroll o "skip"
// entrano subito, senza shuffle.
// Il cubo e' lo stesso elemento della pagina, spostato con transform (FLIP): nessun
// secondo canvas WebGL. Con prefers-reduced-motion, o gia' visto nella sessione: pagina subito.
(function() {
  const overlay = document.getElementById('intro-overlay');
  const container = document.querySelector('.container');
  const bootSeq = document.getElementById('boot-sequence');
  const root = document.documentElement;

  const reveal = sel => document.querySelectorAll(sel).forEach(el => el.classList.add('revealed'));
  const skip = sessionStorage.getItem('introSeen')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (skip) {
    overlay.remove(); bootSeq.remove();
    container.classList.add('visible');
    reveal('[data-boot]');
    return;
  }
  sessionStorage.setItem('introSeen', 'true');

  const b1 = document.getElementById('boot-line-1');
  const b2 = document.getElementById('boot-line-2');
  overlay.classList.add('gone'); bootSeq.classList.add('active');
  setTimeout(() => { b1.textContent = '> BOOTING SYSTEM...'; b1.classList.add('visible'); }, 25);
  setTimeout(() => { b2.textContent = '> LOADING PROFILE...'; b2.classList.add('visible'); }, 450);
  setTimeout(() => { overlay.remove(); bootSeq.remove(); startIntro(); }, 700);

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
    // il cubo si fa notare: ogni 2.6s gira una faccia e la rimette a posto
    const tease = setInterval(() => window.rubikTease && window.rubikTease(), 2600);
    setTimeout(() => window.rubikTease && window.rubikTease(), 900);

    let entered = false;
    function enter(shuffle) {
      if (entered) return;
      entered = true;
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
      // la pagina si monta a cascata mentre il cubo vola (su mobile [data-boot] e' gia' visibile)
      [['[data-boot="profile"]', 0], ['[data-boot="contacts"]', 80], ['[data-boot="nav"]', 160],
       ['[data-boot="oracle"]', 240], ['[data-boot="bio"]', 120], ['[data-boot="featured"]', 260],
       ['[data-boot="projects"]', 340], ['[data-boot="display"]', 420]]
        .forEach(([sel, t]) => setTimeout(() => reveal(sel), t));
      setTimeout(() => {
        cube.classList.remove('flying'); root.classList.remove('landing'); ui.remove();
        window.cubeRes = 960; if (window.rubikRes) window.rubikRes(960);   // piccolo: risoluzione normale
      }, 950);
    }

    // click/tap sul cubo: solo se non e' un trascinamento (il drag ruota il cubo)
    let down = null;
    cube.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    cube.addEventListener('pointerup', e => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) enter(true);
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
