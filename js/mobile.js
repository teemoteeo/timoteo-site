// ============================
// COMPORTAMENTI SOLO-MOBILE
// ============================
(function () {
  const mq = window.matchMedia('(max-width: 900px)');

  // 1. Blocco foto editoriale: compare solo se il file esiste davvero.
  //    Sondo l'immagine prima di metterla nel DOM, cosi' su desktop non
  //    scarica nulla e su mobile non lascia un buco se il file manca.
  const fig = document.querySelector('.mobile-photo');
  const img = fig && fig.querySelector('img[data-src]');
  if (fig && img && mq.matches) {
    const probe = new Image();
    probe.onload = function () {
      img.src = img.dataset.src;
      fig.classList.add('is-ready');
    };
    probe.onerror = function () { fig.remove(); };
    probe.src = img.dataset.src;
  }

  // 2. L'easter egg della foto era :hover -> su touch diventa un tap.
  const pic = document.querySelector('.profile-pic-container');
  if (pic) {
    pic.addEventListener('click', function () {
      if (mq.matches) pic.classList.toggle('is-flipped');
    });
  }
})();
