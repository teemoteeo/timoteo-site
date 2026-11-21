// ============================
// EASTER EGG: "break" sotto il tech stack (idea dal sito di Matilde Sartori, js/destroy.js).
// Primo click: la sezione trema e cade, lettera per lettera, icone e riquadri compresi.
// Al centro del buco compare la domanda; il secondo click rompe tutta la pagina.
// Non c'e' modo di rimettere a posto: si ricarica.
// Tremore e caduta sono animazioni CSS (css/components.css, .brk), non un setInterval per
// elemento: con tutto il sito sono migliaia di lettere.
// ============================
(function () {
  const sec = document.querySelector('.tech-grid-section');
  const btn = document.getElementById('brk-btn');
  if (!sec || !btn) return;
  const BOX = 'div, section, article, aside, nav, header, footer, li, p, figure, details, summary, button, img, svg, canvas, video';

  // ogni carattere visibile in uno span a se'; gli spazi restano testo, cosi' le righe vanno a capo come prima
  function split(root) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => !n.nodeValue.trim() || n.parentElement.closest('script, style, .brk-l')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      // lettere raggruppate per parola (.brk-w, nowrap): tra due inline-block la riga poteva andare a capo a meta' parola
      for (const part of n.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s/.test(part)) { frag.append(part); continue; }
        const w = document.createElement('span');
        w.className = 'brk-w';
        for (const ch of part) {
          const l = document.createElement('span');
          l.className = 'brk-l'; l.textContent = ch;
          w.append(l);
        }
        frag.append(w);
      }
      n.replaceWith(frag);
    });
  }

  function shatter(root) {
    split(root);
    const vh = innerHeight;
    const items = [...root.querySelectorAll('.brk-l, ' + BOX)].filter(el => !el.classList.contains('brk'));
    const rects = items.map(el => el.getBoundingClientRect());   // tutte le letture prima delle scritture
    items.forEach((el, i) => {
      const r = rects[i];
      // ponytail: anima solo cio' che e' a schermo; il resto non si vede (scroll bloccato al secondo click)
      if (!r.width || r.bottom < 0 || r.top > vh) return;
      const s = el.style;
      s.setProperty('--s', (-Math.random() * 0.2).toFixed(3) + 's');        // tremori sfasati
      s.setProperty('--d', (0.8 + Math.random() * 1.8).toFixed(2) + 's');   // quanto trema prima di cadere
      s.setProperty('--t', (0.9 + Math.random() * 1.2).toFixed(2) + 's');   // durata della caduta
      s.setProperty('--y', Math.round(vh - r.top + 40) + 'px');             // fin sotto il bordo dello schermo
      s.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      el.classList.add('brk');
    });
  }

  btn.addEventListener('click', () => {
    btn.disabled = true;
    shatter(sec);
    setTimeout(() => {
      const ask = document.createElement('button');
      ask.type = 'button'; ask.className = 'brk-ask';
      ask.textContent = 'do you really want to break all of it?';
      sec.append(ask);
      ask.addEventListener('click', () => {
        ask.disabled = true;
        document.documentElement.classList.add('brk-all');   // niente scroll: quello che e' caduto non si ritrova piu' sotto
        shatter(document.querySelector('.container'));
      }, { once: true });
    }, 4000);
  }, { once: true });
})();
