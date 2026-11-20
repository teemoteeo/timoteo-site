// ============================
// EASTER EGG: gli interruttori [data-theme-switch] (BUSY in home e nella sua pagina)
// accendono il tema chiaro. Lo stato iniziale lo mette lo script inline nel <head>
// (niente flash al caricamento); la scelta resta in localStorage.
// Il pomello parte subito; il tema cambia al frame dopo, dentro una View Transition:
// il browser scambia il tema in un frame solo e fa la dissolvenza sulle istantanee,
// e la vista nuova resta viva, quindi il pomello continua a scorrere.
// ============================
(function () {
  const sws = [...document.querySelectorAll('[data-theme-switch]')];
  if (!sws.length) return;
  const root = document.documentElement, meta = document.querySelector('meta[name="theme-color"]');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function apply(light) {
    if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
    if (meta) meta.content = light ? '#f2f0e9' : '#0e0d10';
    try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
    document.dispatchEvent(new Event('themechange'));   // js/preview.js swaps the clips
  }
  function set(light, animate) {
    sws.forEach(s => s.setAttribute('aria-checked', String(light)));
    if (!animate || calm || !document.startViewTransition) return apply(light);
    requestAnimationFrame(() => document.startViewTransition(() => apply(light)));
  }
  set(root.dataset.theme === 'light', false);
  sws.forEach(s => s.addEventListener('click', () => set(s.getAttribute('aria-checked') !== 'true', true)));
})();
