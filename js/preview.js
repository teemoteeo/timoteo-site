// ============================
// ANTEPRIME: i video delle card partono su hover (o focus da tastiera);
// sui touch partono quando la card e' quasi tutta a schermo
// ============================
(function () {
  const vids = [...document.querySelectorAll('video.pv')];
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
