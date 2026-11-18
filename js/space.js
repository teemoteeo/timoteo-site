// ============================
// SPAZIO: stelle su una canvas fissa dietro la pagina
// ============================
// disegnate una volta (e a ogni resize): niente animazione, niente costo per frame
(function () {
  const c = document.createElement('canvas');
  c.id = 'space';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  const ctx = c.getContext('2d');
  // seme fisso: le stelle restano le stesse a ogni visita e a ogni resize
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function draw() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 42;
    const n = Math.round(w * h / 2600);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h, k = rnd();
      // poche stelle grandi e luminose, molte piccole e fioche
      const r = k > 0.985 ? 1.3 : k > 0.9 ? 0.9 : 0.55;
      const a = k > 0.985 ? 0.95 : 0.2 + rnd() * 0.45;
      const t = rnd(); // temperatura: qualche stella fredda, qualche calda
      ctx.fillStyle = t < 0.12 ? `rgba(190,210,255,${a})` : t > 0.92 ? `rgba(255,225,190,${a})` : `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  }
  draw();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
})();
