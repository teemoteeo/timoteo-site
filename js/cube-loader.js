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

  const V = '?v=20260918c';
  let started = false;

  function load() {
    if (started) return;
    started = true;
    const three = document.createElement('script');
    three.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    three.onload = function () {
      const engine = document.createElement('script');
      engine.src = 'js/rubik3d.js' + V;
      engine.onload = function () { shell.classList.add('is-live'); };
      document.head.appendChild(engine);
    };
    // se il CDN non risponde resta il placeholder: il cubo non e' contenuto critico
    document.head.appendChild(three);
  }

  if (btn) btn.addEventListener('click', load, { once: true });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '400px' });
    io.observe(stack);
  } else {
    load();
  }
})();
