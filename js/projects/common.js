// Shared helpers for project visualizations
window.PJ = (function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const C = {
    bg: css('--bg'), bg2: css('--bg2'), surface: css('--surface'),
    fg: css('--fg'), dim: css('--fg-dim'), muted: css('--fg-muted'),
    border: 'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.16)',
    teal: css('--teal'), red: css('--red'), yellow: css('--yellow'),
    blue: css('--blue'), green: css('--green'), violet: css('--violet'),
  };
  // HiDPI canvas sized to its CSS width with a fixed aspect ratio
  function canvas(el, ratio) {
    const ctx = el.getContext('2d');
    function fit() {
      const w = el.parentElement.clientWidth;
      const h = Math.round(w * (typeof ratio === 'function' ? ratio(w) : ratio));
      const d = window.devicePixelRatio || 1;
      el.width = w * d; el.height = h * d;
      el.style.height = h + 'px';
      ctx.setTransform(d, 0, 0, d, 0, 0);
      return { w, h };
    }
    return { ctx, fit };
  }
  function buttons(container, items, onPick, initial) {
    const btns = items.map(it => {
      const b = document.createElement('button');
      b.className = 'viz-btn'; b.textContent = it.label;
      b.onclick = () => { btns.forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(it); };
      container.appendChild(b);
      return b;
    });
    btns[initial || 0].classList.add('on');
    return btns;
  }
  // Le viz partono sempre da sole: prima restavano in pausa quando il sistema
  // chiedeva movimento ridotto (su iOS "Riduci movimento" e' una preferenza
  // comune). Si possono comunque fermare col bottone pause.
  return { C, canvas, buttons };
})();
