// ============================
// ANTEPRIME: i video delle card partono su hover (o focus da tastiera);
// sui touch partono quando la card e' quasi tutta a schermo.
// Ogni clip ha una versione per tema (images/previews/light/ per quelle registrate
// sul tema chiaro): la sorgente la mette questo script, e la cambia al cambio tema.
// ============================
(function () {
  const vids = [...document.querySelectorAll('video.pv[data-pv]')];
  const LIGHT = new Set(['fp', 'pol', 'rag', 'flyin', 'codexion', 'cmm', 'amaze']);   // polenta: clip scura con la luminosita' invertita; hdgr: solo scura
  const src = n => 'images/previews/' + (document.documentElement.dataset.theme === 'light' && LIGHT.has(n) ? 'light/' : '') + n + '.mp4?v=6#t=0.001';
  function load() {
    vids.forEach(v => {
      const s = src(v.dataset.pv);
      if (v.getAttribute('src') === s) return;
      const was = !v.paused;
      v.setAttribute('src', s);
      if (was) v.play().catch(() => {});
    });
  }
  load();
  document.addEventListener('themechange', load);

  const play = v => v.play().catch(() => {});
  const stop = v => v.pause();
  if (window.matchMedia('(hover: hover)').matches) {
    vids.forEach(v => {
      const card = v.closest('.feat, .pr');
      card.addEventListener('pointerenter', () => play(v));
      card.addEventListener('pointerleave', () => stop(v));
      card.addEventListener('focusin', () => play(v));
      card.addEventListener('focusout', () => stop(v));
    });
  } else if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? play : stop)(e.target)), { threshold: 0.75 });
    vids.forEach(v => io.observe(v));
  }
})();
