// Fly-In: the project's curses TUI (src/tui.py), recorded frame by frame
// by tools/flyin_tui_export.py and replayed with the same clock and keys.
(function () {
  const T = window.FLYIN_TUI;
  const DELAYS_MS = [150, 300, 600, 1000, 1500, 2500];  // same as tui.py
  const pre = document.getElementById('tui');
  const sel = document.getElementById('viz-map');
  const list = document.getElementById('viz-maps');
  const turnEl = document.getElementById('viz-turn');
  const pb = document.getElementById('viz-play');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let M, t = 0, target = 0, playing = true, speed = 3, prevNow = 0, shown = '';

  // map list and select, grouped by difficulty like data/maps
  const groups = {};
  T.maps.forEach((m, i) => (groups[m.level] = groups[m.level] || []).push([m, i]));
  const order = ['easy', 'medium', 'hard', 'challenger', 'custom'].filter(l => groups[l]);
  sel.innerHTML = order.map(l => `<optgroup label="${l}">${groups[l].map(([m, i]) =>
    `<option value="${i}">${m.name}</option>`).join('')}</optgroup>`).join('');
  list.innerHTML = order.map(l => `<span class="lv">${l}</span>` + groups[l].map(([m, i]) =>
    `<button type="button" data-i="${i}">${m.name}<i>${m.last}</i></button>`).join('')).join('');
  list.onclick = e => { const b = e.target.closest('button'); if (b) load(+b.dataset.i); };
  sel.onchange = () => load(+sel.value);

  // one terminal row: text plus attribute runs [start, len, pair|bold<<4|dim<<5|reverse<<6]
  function row([text, runs]) {
    let out = '', at = 0;
    for (const [s, n, a] of runs) {
      out += esc(text.slice(at, s));
      const cls = [a & 15 ? 'c' + (a & 15) : '', a & 16 ? 'b' : '', a & 32 ? 'd' : '', a & 64 ? 'r' : ''].join(' ').trim();
      out += `<span class="${cls}">${esc(text.slice(s, s + n).padEnd(n))}</span>`;
      at = s + n;
    }
    return out + esc(text.slice(at));
  }

  function frameAt(time) {  // last recorded frame at or before `time`
    let lo = 0, hi = M.frames.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (M.frames[mid][0] <= time + 1e-9) lo = mid; else hi = mid - 1; }
    return M.frames[lo][1];
  }

  function draw() {
    const ids = frameAt(t);
    const lines = ids.map(i => row(T.lines[i]));
    // the header was recorded as "playing 1000ms": show the live state, right-aligned like curses
    const live = `${playing ? 'playing' : 'paused'} ${DELAYS_MS[speed]}ms `;
    lines[0] = lines[0].replace('playing 1000ms ', live.padStart('playing 1000ms '.length));
    const html = lines.join('\n');
    if (html !== shown) { pre.innerHTML = html; shown = html; }
    turnEl.value = t;
    pb.textContent = playing ? 'pause' : 'play';
  }

  function fit() {  // whole terminal width visible, like a maximised window
    pre.style.fontSize = '';
    const w = pre.parentElement.clientWidth - 24;
    pre.style.fontSize = Math.max(7, Math.min(16, w / (M.cols * 0.6))) + 'px';  // phones: scroll sideways below 7px
  }

  function load(i) {
    M = T.maps[i];
    sel.value = i;
    list.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    turnEl.max = M.last;
    t = 0; target = M.last; playing = true;
    document.getElementById('viz-cmd').textContent = `make tui MAP=data/maps/${M.id}.txt`;
    fit(); draw();
  }

  // same keys as TerminalUI.handle()
  function key(k) {
    if (k === ' ') {
      if (playing) { target = t; playing = false; }
      else { if (t >= M.last) t = 0; target = M.last; playing = true; }
    } else if (k === 'ArrowRight') { target = Math.min(M.last, Math.floor(t) + 1); playing = true; }
    else if (k === 'ArrowLeft') { target = Math.max(0, Math.ceil(t) - 1); playing = true; }
    else if (k === '+' || k === '=') speed = Math.max(0, speed - 1);
    else if (k === '-' || k === '_') speed = Math.min(DELAYS_MS.length - 1, speed + 1);
    else if (k === 'r') { t = 0; target = M.last; playing = true; }
    else return false;
    draw();
    return true;
  }
  pre.addEventListener('keydown', e => { if (key(e.key)) e.preventDefault(); });
  pb.onclick = () => key(' ');
  turnEl.oninput = () => { t = target = +turnEl.value; playing = false; draw(); };
  addEventListener('resize', () => { fit(); });

  function tick(now) {  // TerminalUI.advance(): glide toward the target
    const dt = prevNow ? (now - prevNow) / 1000 : 0;
    prevNow = now;
    if (playing) {
      const step = dt * 1000 / DELAYS_MS[speed];
      t = t < target ? Math.min(target, t + step) : Math.max(target, t - step);
      if (t === target) playing = false;
      draw();
    }
    requestAnimationFrame(tick);
  }

  load(Math.max(0, T.maps.findIndex(m => m.id === 'hard/01_maze_nightmare')));
  requestAnimationFrame(tick);
})();
