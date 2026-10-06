// ============================
// INTRO + BOOT
// ============================
(function() {
  const overlay = document.getElementById('intro-overlay');
  const container = document.querySelector('.container');
  const bootSeq = document.getElementById('boot-sequence');

  // Su mobile l'intro non serve: niente tap a vuoto prima del contenuto.
  const skipIntro = window.matchMedia('(max-width: 900px)').matches
    || sessionStorage.getItem('introSeen')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (skipIntro) {
    overlay.remove(); bootSeq.remove();
    container.classList.add('visible');
    document.querySelectorAll('[data-boot]').forEach(el => el.classList.add('revealed'));
    return;
  }

  function runBoot() {
    const b1 = document.getElementById('boot-line-1');
    const b2 = document.getElementById('boot-line-2');
    [
      [0, () => { overlay.classList.add('gone'); bootSeq.classList.add('active'); }],
      [25, () => { b1.textContent = '> BOOTING SYSTEM...'; b1.classList.add('visible'); }],
      [450, () => { b2.textContent = '> LOADING PROFILE...'; b2.classList.add('visible'); }],
      [700, () => { bootSeq.classList.remove('active'); container.classList.add('visible'); }],
      [750, () => { document.querySelector('[data-boot="profile"]').classList.add('revealed'); }],
      [825, () => { document.querySelector('[data-boot="contacts"]').classList.add('revealed'); }],
      [900, () => { document.querySelector('[data-boot="nav"]').classList.add('revealed'); }],
      [975, () => { document.querySelector('[data-boot="oracle"]').classList.add('revealed'); }],
      [1000, () => { document.querySelectorAll('[data-boot="bio"]').forEach(el => el.classList.add('revealed')); }],
      [1100, () => { document.querySelector('[data-boot="projects"]').classList.add('revealed'); }],
      [1200, () => { document.querySelector('[data-boot="display"]').classList.add('revealed'); }],
      [1500, () => { overlay.remove(); bootSeq.remove(); }],
    ].forEach(([t, fn]) => setTimeout(fn, t));
  }

  // niente click-gate: il boot parte da solo (~1.5s) e va saltato con reduced-motion
  sessionStorage.setItem('introSeen', 'true');
  runBoot();
})();

// ============================
// AGE CLOCK
// ============================
function updateAge() {
  const birth = new Date(2003, 0, 9);
  const now = new Date();
  let yr = now.getFullYear() - birth.getFullYear();
  let mo = now.getMonth() - birth.getMonth();
  let d = now.getDate() - birth.getDate();
  if (d < 0) { d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); mo--; }
  if (mo < 0) { mo += 12; yr--; }
  document.getElementById('age-clock').textContent = `${yr} years ${mo} months ${d} days`;
}
updateAge();
setInterval(updateAge, 60000);
