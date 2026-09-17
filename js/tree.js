// ============================
// SIDEBAR TREE: collapsible 42 Firenze group
// ============================
(function() {
  document.querySelectorAll('.tree-toggle').forEach(btn => {
    const group = document.getElementById(btn.getAttribute('aria-controls'));
    if (!group) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      group.classList.toggle('open', open);
    });
  });
})();
