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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRubik(); });

  function openRubik() {
    document.getElementById('rubik-modal').classList.add('open');
    initRubik();
  }
  function closeRubik() {
    document.getElementById('rubik-modal').classList.remove('open');
  }
})();
