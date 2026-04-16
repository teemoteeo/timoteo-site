// ============================
// INTRO + BOOT
// ============================
(function() {
  const overlay = document.getElementById('intro-overlay');
  const introText = document.getElementById('intro-text');
  const container = document.querySelector('.container');
  const bootSeq = document.getElementById('boot-sequence');
  const msg = 'click to meet me...';

  if (sessionStorage.getItem('introSeen')) {
    overlay.remove(); bootSeq.remove();
    container.classList.add('visible');
    document.querySelectorAll('[data-boot]').forEach(el => el.classList.add('revealed'));
    return;
  }

  let i = 0;
  function type() {
    if (i < msg.length) { introText.textContent += msg[i++]; setTimeout(type, 30 + Math.random() * 80); }
  }
  setTimeout(type, 600);

  function runBoot() {
    const b1 = document.getElementById('boot-line-1');
    const b2 = document.getElementById('boot-line-2');
    [
      [0, () => { overlay.classList.add('gone'); bootSeq.classList.add('active'); }],
      [50, () => { b1.textContent = '> BOOTING SYSTEM...'; b1.classList.add('visible'); }],
      [900, () => { b2.textContent = '> LOADING PROFILE...'; b2.classList.add('visible'); }],
      [1400, () => { bootSeq.classList.remove('active'); container.classList.add('visible'); }],
      [1500, () => { document.querySelector('[data-boot="profile"]').classList.add('revealed'); }],
      [1650, () => { document.querySelector('[data-boot="contacts"]').classList.add('revealed'); }],
      [1800, () => { document.querySelector('[data-boot="nav"]').classList.add('revealed'); }],
      [2000, () => { document.querySelectorAll('[data-boot="bio"]').forEach(el => el.classList.add('revealed')); }],
      [2200, () => { document.querySelector('[data-boot="projects"]').classList.add('revealed'); }],
      [2400, () => { document.querySelector('[data-boot="display"]').classList.add('revealed'); }],
      [3000, () => { overlay.remove(); bootSeq.remove(); }],
    ].forEach(([t, fn]) => setTimeout(fn, t));
  }

  function dismiss() {
    sessionStorage.setItem('introSeen', 'true');
    runBoot();
  }
  overlay.onclick = dismiss;
  overlay.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); } };
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
