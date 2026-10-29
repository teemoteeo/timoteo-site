// ============================
// KONAMI CODE EASTER EGG
// ============================
(function() {
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;
  const hint = document.getElementById('konami-hint');

  document.addEventListener('keydown', e => {
    if (e.key === seq[pos]) {
      pos++;
      if (pos >= seq.length) { pos = 0; openRubik(); }
    } else {
      pos = e.key === seq[0] ? 1 : 0;
      if (pos === 1) { hint.style.opacity = '1'; setTimeout(() => hint.style.opacity = '0', 2000); }
    }
  });

  document.getElementById('rubik-close').onclick = closeRubik;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeRubik(); closeNeofetch(); } });

  // type "neofetch" anywhere (outside inputs) to open the GitHub profile card
  let typed = '';
  const neo = document.getElementById('neofetch-modal');
  const card = document.getElementById('neofetch-card');
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-8);
    if (typed === 'neofetch') {
      if (!card.src) card.src = card.dataset.src;
      neo.classList.add('open');
    }
  });
  document.getElementById('neofetch-close').onclick = closeNeofetch;
  neo.onclick = e => { if (e.target === neo) closeNeofetch(); };
  function closeNeofetch() { neo.classList.remove('open'); }

  function openRubik() {
    document.getElementById('rubik-modal').classList.add('open');
    initRubik();
  }
  function closeRubik() {
    document.getElementById('rubik-modal').classList.remove('open');
  }
})();
