// ============================
// TECH STACK GRID
// ============================
(function() {
  const I = 'icons/stack/';

  const items = [
    { label: 'C',          icon: 'c.svg' },
    { label: 'Python',     icon: 'python.svg' },
    { label: 'JavaScript', icon: 'javascript.svg' },
    { label: 'Go',         icon: 'go.svg' },
    { label: 'Linux',      icon: 'linux.svg' },
    { label: 'Git',        icon: 'git.svg' },
    { label: 'GitHub',     icon: 'github.svg', invert: true },
    { label: 'Vercel',     icon: 'vercel.svg', invert: true },
    { label: 'Neovim',     icon: 'neovim.svg' },
    { label: 'Obsidian',   icon: 'obsidian.svg' },
    { label: 'Claude',     icon: 'claude.svg' },
    { label: 'GPT',        icon: 'openai.svg' },
    { label: 'MLX',        icon: 'mlx.png' },
    { label: 'LM Studio',  icon: 'lmstudio.svg' },
    { label: 'Qwen',       icon: 'qwen.svg' },
  ];

  const grid = document.getElementById('tech-grid');
  if (!grid) return;

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tech-grid-item';
    if (item.icon) {
      const img = document.createElement('img');
      img.src = I + item.icon;
      img.alt = item.label;
      img.loading = 'lazy';
      if (item.invert) img.style.filter = 'invert(1)';
      el.appendChild(img);
    } else {
      const m = document.createElement('div');
      m.className = 'tech-mono';
      m.textContent = item.mono;
      el.appendChild(m);
    }
    const span = document.createElement('span');
    span.textContent = item.label;
    el.appendChild(span);
    grid.appendChild(el);
  });
})();
