// ============================
// CUBO: PLACEHOLDER -> LAZY THREE.JS
// ============================
// three.js e' ~150KB gzip e serve solo per questo cubo. Finche' non entra
// nel viewport mostriamo un placeholder SVG (2KB, inline) nella stessa
// posizione: nessun salto di layout, nessuno script bloccante.
(function () {
  const stack = document.querySelector('.sidebar-cube-stack');
  const shell = document.querySelector('.sidebar-cube');
  const btn   = document.getElementById('sb-cube-btn');
  if (!stack || !shell) return;

  const V = '?v=20261126d';
  let started = false;

  function load() {
    if (started) return;
    started = true;
    function engine() {
      const s = document.createElement('script');
      s.src = 'js/rubik3d.js' + V;
      s.onload = function () { shell.classList.add('is-live'); };
      document.head.appendChild(s);
    }
    // three.js lo carica anche la palla 8 (js/eightball.js): se c'e' gia', o sta arrivando, mi aggancio
    // a quello (prima a volte si scaricava e si eseguiva due volte, ~600KB di parse in piu')
    if (window.THREE) return engine();
    const pending = document.querySelector('script[src*="three.min.js"]');
    if (pending) return pending.addEventListener('load', engine);
    const three = document.createElement('script');
    three.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    three.onload = engine;
    // se il CDN non risponde resta il placeholder: il cubo non e' contenuto critico
    document.head.appendChild(three);
  }

  if (btn) btn.addEventListener('click', load, { once: true });
  window.cubeLoad = load;   // l'intro (js/boot.js) lo chiama durante le righe di boot

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '400px' });
    io.observe(stack);
  } else {
    load();
  }
})();
