// ============================
// LIQUID GLASS: the light on a glass panel follows the pointer
// ============================
(function () {
  if (!window.matchMedia('(hover: hover)').matches) return;
  document.addEventListener('pointermove', function (e) {
    const el = e.target.closest && e.target.closest('.glass');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();
