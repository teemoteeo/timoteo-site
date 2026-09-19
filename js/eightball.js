// ============================
// MAGIC 8-BALL
// ============================
// La palla NON legge la domanda. La risposta e' estratta a caso tra le 20
// facce dell'icosaedro originale: l'input serve solo al rituale, come nel
// giocattolo vero. Niente parsing, niente rete, niente persistenza.
(function () {
  const root = document.querySelector('.oracle');
  if (!root) return;

  const form   = document.getElementById('eb-form');
  const input  = document.getElementById('eb-input');
  const btn    = document.getElementById('eb-btn');
  const status = document.getElementById('eb-status');
  const srOut  = document.getElementById('eb-answer');
  const shell  = document.getElementById('eb-ball');

  const ANSWERS = [
    'It is certain',
    'It is decidedly so',
    'Without a doubt',
    'Yes definitely',
    'You may rely on it',
    'As I see it, yes',
    'Most likely',
    'Outlook good',
    'Yes',
    'Signs point to yes',
    'Reply hazy, try again',
    'Ask again later',
    'Better not tell you now',
    'Cannot predict now',
    'Concentrate and ask again',
    "Don't count on it",
    'My reply is no',
    'My sources say no',
    'Outlook not so good',
    'Very doubtful'
  ];

  // Uniforme su tutte e 20 (1/20 ciascuna): scarto i valori nella coda che
  // renderebbe il modulo sbilanciato. Nessuna memoria delle estrazioni, quindi
  // la stessa risposta puo' uscire due volte di fila come nell'originale.
  function pick(n) {
    const buf = new Uint32Array(1);
    const limit = 4294967296 - (4294967296 % n);
    let v;
    do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= limit);
    return v % n;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TYPE_MIN = 28, TYPE_JITTER = 45;

  let busy = false;
  let typeTimer = null;

  function setStatus(text, nagging) {
    status.textContent = text;
    status.classList.toggle('is-nagging', !!nagging);
    status.classList.remove('is-answer');
    root.classList.toggle('is-nagging', !!nagging);
  }

  // Presenter di riserva: niente WebGL, niente three.js. La risposta compare
  // nella riga di stato, con lo stesso typewriter del boot.
  const textPresenter = {
    mirrorToSr: false,
    hasAnswer: false,
    run: function (answer, opts, done) {
      this.hasAnswer = true;
      root.classList.remove('is-nagging');
      status.classList.remove('is-nagging');
      status.classList.add('is-answer');
      if (opts.reduceMotion) { status.textContent = answer; done(); return; }
      let i = 0;
      status.textContent = '';
      (function type() {
        if (i >= answer.length) { typeTimer = null; done(); return; }
        status.textContent += answer[i++];
        typeTimer = setTimeout(type, TYPE_MIN + Math.random() * TYPE_JITTER);
      })();
    },
    reset: function () {
      if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }
      this.hasAnswer = false;
      setStatus('');
    }
  };

  let presenter = textPresenter;

  function ask() {
    if (busy) return;
    if (!input.value.trim()) {
      setStatus('ask something first', true);
      input.focus();
      return;
    }
    busy = true;
    btn.disabled = true;
    srOut.textContent = '';
    if (presenter.mirrorToSr) setStatus('');

    const answer = ANSWERS[pick(ANSWERS.length)];
    presenter.run(answer, { reduceMotion: reduceMotion.matches }, function () {
      busy = false;
      btn.disabled = false;
      // Con la palla 3D il testo vive dentro il triangolo: per gli screen
      // reader lo rimando in una live region, e la riga di stato resta libera.
      if (presenter.mirrorToSr) {
        srOut.textContent = answer;
        setStatus('ask again?');
      }
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); ask(); });

  input.addEventListener('input', function () {
    if (input.value.trim() && status.classList.contains('is-nagging')) setStatus('');
    if (!busy && presenter.hasAnswer) { presenter.reset(); srOut.textContent = ''; }
  });

  // ---- API per il presenter 3D (js/eightball-3d.js) ----
  window.__eightball = {
    ask: ask,
    attach: function (p) {
      presenter.reset();
      presenter = p;
      shell.classList.add('is-live');
    }
  };

  // ---- LAZY LOAD three.js (stessa strategia del cubo) ----
  // three.js e' ~150KB gzip ed e' gia' una dipendenza del cubo: se lo script
  // e' gia' in pagina mi aggancio a quello invece di scaricarlo due volte.
  const V = '?v=20260919a';
  const THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  let started = false;

  function withThree(cb) {
    if (window.THREE) { cb(); return; }
    const pending = document.querySelector('script[src*="three.min.js"]');
    if (pending) { pending.addEventListener('load', cb); return; }
    const s = document.createElement('script');
    s.src = THREE_SRC;
    s.onload = cb;
    // se il CDN non risponde resta la palla di riserva: risponde lo stesso
    document.head.appendChild(s);
  }

  function load3d() {
    if (started) return;
    started = true;
    withThree(function () {
      const s = document.createElement('script');
      s.src = 'js/eightball-3d.js' + V;
      document.head.appendChild(s);
    });
  }

  input.addEventListener('focus', load3d, { once: true });
  btn.addEventListener('click', load3d, { once: true });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load3d(); }
    }, { rootMargin: '400px' });
    io.observe(root);
  } else {
    load3d();
  }
})();
