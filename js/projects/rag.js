// RAG against the machine: replays real retrievals over the vLLM repo.
// A: the repo as nested circles lights up term by term.
// C: each result opens its BM25 score split by term.
// D: the answer, with the text it was taken from highlighted in the source.
(function () {
  const { C } = PJ;
  const D = window.RAG_DATA;
  const N = D.n, F = D.files.length;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = n => n.toLocaleString('en');
  const set = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };
  const ease = p => p < 0 ? 0 : p > 1 ? 1 : 1 - Math.pow(1 - p, 3);

  const textEl = $('rag-text'), countEl = $('rag-count');
  const listEl = $('rag-list'), outEl = $('rag-out'), tabsEl = $('rag-tabs');
  const srcPathEl = $('rag-srcp'), srcEl = $('rag-src'), svg = $('rag-pack');

  // ---- decode per-term chunk scores (varint delta + uint8, base64) ----
  function decode(b64, scale) {
    const bin = atob(b64), idx = [], val = [];
    let i = 0, pos = 0;
    while (i < bin.length) {
      let d = 0, sh = 0, c;
      do { c = bin.charCodeAt(i++); d |= (c & 127) << sh; sh += 7; } while (c & 128);
      pos += d; idx.push(pos); val.push(bin.charCodeAt(i++) * scale);
    }
    return { idx, val };
  }
  // file heat after k terms = best chunk score in that file so far
  function prepare(r) {
    if (r._heat) return;
    const cum = new Float32Array(N), seen = new Uint8Array(N);
    const heat = [new Float32Array(F)], inTerm = [], union = [0], peak = [];
    let u = 0;
    r.terms.forEach(([t, n]) => {
      const { idx, val } = decode(D.td[t], n / D.sc / r.mx);
      peak.push(val.reduce((m, v) => v > m ? v : m, 0));
      const h = Float32Array.from(heat[heat.length - 1]), mark = new Uint8Array(F);
      for (let j = 0; j < idx.length; j++) {
        const i = idx[j], f = D.cf[i];
        cum[i] += val[j];
        if (cum[i] > h[f]) h[f] = cum[i];
        mark[f] = 1;
        if (!seen[i]) { seen[i] = 1; u++; }
      }
      heat.push(h); inTerm.push(mark); union.push(u);
    });
    r._heat = heat; r._in = inTerm; r._union = union;
    // a term's weight = the most it adds to any chunk (idf with tf saturation)
    const pm = Math.max(...peak);
    r._w = peak.map(v => v / pm);
  }

  // ---- A: static pack, drawn once ----
  const P0 = D.pack;
  svg.setAttribute('viewBox', `0 0 ${P0.size} ${P0.size}`);
  const mk = (tag, attrs, parent) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.appendChild(el); return el;
  };
  const gDirs = mk('g', { fill: 'none', stroke: 'rgba(255,255,255,.13)', 'stroke-width': .7 }, svg);
  P0.dirs.forEach(([x, y, r]) => mk('circle', { cx: x, cy: y, r }, gDirs));
  const gLeaf = mk('g', {}, svg);
  const leaves = P0.leaves.map(([x, y, r], f) =>
    mk('circle', { cx: x, cy: y, r: Math.max(.7, r), 'data-f': f, class: 'lf' }, gLeaf));
  const gLab = mk('g', { class: 'dl' }, svg);
  P0.dirs.filter(d => d[4] && d[2] > 26).forEach(([x, y, r, , name]) => {
    const t = mk('text', { x, y: y - r + 13, 'text-anchor': 'middle' }, gLab);
    t.textContent = name + '/';
  });
  const gRing = mk('g', {}, svg);
  const tip = $('rag-tip');
  svg.addEventListener('mousemove', e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (f === undefined) { tip.hidden = true; return; }
    tip.textContent = D.files[f]; tip.hidden = false;
    const b = svg.parentElement.getBoundingClientRect();
    tip.style.left = Math.min(b.width - tip.offsetWidth - 8, e.clientX - b.left + 12) + 'px';
    tip.style.top = (e.clientY - b.top + 14) + 'px';
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });

  let packKey = '';
  function paintPack(r, k, firing, ranked) {
    const key = k + '|' + firing + '|' + ranked;
    if (key === packKey) return;
    packKey = key;
    const h = r._heat[k], cur = firing ? r._in[k] : null;
    const tops = ranked ? new Set(r.top.map(t => t.f)) : null;
    for (let f = 0; f < F; f++) {
      const el = leaves[f];
      let fill, op;
      if (cur && cur[f]) { fill = C.teal; op = .95; }
      else if (tops && tops.has(f)) { fill = C.teal; op = 1; }
      else if (h[f] > 0) { fill = C.fg; op = (.14 + .86 * Math.pow(Math.min(1, h[f]), 1.25)) * (ranked ? .55 : 1); }
      else { fill = C.muted; op = .16; }
      if (el._fill !== fill) { el._fill = fill; el.setAttribute('fill', fill); }
      if (el._op !== op) { el._op = op; el.style.fillOpacity = op; }
    }
  }
  function drawRings(r) {
    gRing.innerHTML = '';
    const byFile = {};
    r.top.forEach((t, i) => (byFile[t.f] = byFile[t.f] || []).push(i));
    Object.keys(byFile).forEach((f, n) => {
      const [x, y, rr] = P0.leaves[f], R = Math.max(rr + 4, 8);
      const g = mk('g', { class: 'ring', style: `--i:${byFile[f][0]}` }, gRing);
      mk('circle', { cx: x, cy: y, r: R }, g);
      const t = mk('text', { x: x + R * .72 + 3, y: y - R * .72 - 2 }, g);
      t.textContent = byFile[f].map(i => i + 1).join('·');
    });
  }

  // ---- markdown-lite answer with [n] citations ----
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const quoted = s => [...s.matchAll(/`([^`\n]+)`/g), ...s.matchAll(/\*\*([^*\n]+)\*\*/g)].map(m => m[1]);
  function md(s, r, done) {
    return esc(s)
      .replace(/```\w*\n?([\s\S]*?)(```|$)/g, (_, c) => `<code class="blk">${c.trim()}</code>`)
      .replace(/`([^`\n]+)`/g, (_, c) => {
        const k = done ? r.top.findIndex(t => t.x.includes(unesc(c))) : -1;
        return `<code>${c}</code>` + (k >= 0 ? `<sup>[${k + 1}]</sup>` : '');
      })
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  }

  // ---- source with highlights ----
  function paintSource(r, s, withAnswer) {
    const t = r.top[s], txt = t.x;
    srcPathEl.textContent = `${t.p} [${t.a}:${t.b}]`;
    const marks = [];
    if (withAnswer) quoted(r.ans).forEach(c => {
      if (c.length < 3) return;
      for (let i = txt.indexOf(c); i >= 0; i = txt.indexOf(c, i + 1)) marks.push([i, i + c.length, 'a']);
    });
    const terms = new Set(r.terms.map(x => x[0]).filter(x => x.length > 2));
    for (const m of txt.matchAll(/[A-Za-z0-9_]+/g)) {
      const lw = m[0].toLowerCase();
      if (!terms.has(lw)) continue;
      const a = m.index, b = a + m[0].length;
      if (!marks.some(([x, y]) => a < y && b > x)) marks.push([a, b, 't']);
    }
    marks.sort((x, y) => x[0] - y[0]);
    let html = '', p = 0;
    marks.forEach(([a, b, c]) => { if (a < p) return; html += esc(txt.slice(p, a)) + `<mark class="${c}">${esc(txt.slice(a, b))}</mark>`; p = b; });
    set(srcEl, html + esc(txt.slice(p)));
    tabsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === s));
    const first = srcEl.querySelector('mark.a');
    if (first && withAnswer && srcEl._scrolled !== s + '|' + r.q) {
      srcEl._scrolled = s + '|' + r.q;
      srcEl.scrollTop = Math.max(0, first.offsetTop - srcEl.offsetTop - 40);
    }
  }

  // ---- timeline ----
  let run, T = 0, last = 0, P = null, runIdx = 0, pick = -1;
  // after a question ends, wait HOLD ms before the next one.
  // one flag freezes both the animation and that countdown: only the
  // pause button toggles it
  const HOLD = 15000;
  let wait = 0, paused = false;
  function phases(r) {
    const p = {};
    p.type = r.q.length * 20;
    p.tok = p.type + 1100;
    p.term = 460;
    p.terms = p.tok + r.terms.length * p.term;
    p.rank = p.terms + 1600;
    p.ctx = p.rank + 700;
    p.ans = p.ctx + Math.min(5200, Math.max(1400, r.ans.length * 13));
    p.end = p.ans + 400;
        return p;
  }

  function buildDom(r) {
    const termIdx = {};
    r.terms.forEach(([t], k) => termIdx[t] = k);
    // the question itself becomes the tokenizer view: one span per word,
    // stopwords struck, every kept word shaded by its heaviest term
    let wi = 0;
    r._qhtml = esc(r.q).replace(/[A-Za-z0-9_]+/g, m => {
      const w = r.words[wi++];
      const ks = w ? w.t.filter(x => x[1]).map(x => termIdx[x[0]]) : [];
      if (!ks.length) return `<span class="qw stop">${m}</span>`;
      const wt = Math.max(...ks.map(k => r._w[k]));
      const tip = w.t.filter(x => x[1]).map(x => `${x[0]} ${(r._w[termIdx[x[0]]] * 100).toFixed(0)}%`).join(' · ');
      return `<span class="qw${w.t.length > 1 ? ' split' : ''}" data-ks="${ks.join(',')}" style="--w:${Math.max(.06, Math.pow(wt, 1.6)).toFixed(2)}" title="${esc(tip)}">${m}</span>`;
    });
    const K = r.terms.length, smax = r.top[0].s;
    const tc = j => `hsl(${78 + j * (110 / Math.max(1, K - 1))} ${62 - j * 2}% ${72 - j * 2.2}%)`;
    listEl.innerHTML = r.top.map((t, i) => {
      const cut = t.p.lastIndexOf('/') + 1;
      const a = t.a / t.L * 100, wd = Math.max(.8, (t.b - t.a) / t.L * 100);
      const segs = t.c.map((v, j) => v > 0 ? `<i style="width:${v / smax * 100}%;background:${tc(j)}"></i>` : '').join('');
      const legend = t.c.map((v, j) => [v, j]).filter(x => x[0] > 0).sort((x, y) => y[0] - x[0])
        .map(([v, j]) => `<span><i style="background:${tc(j)}"></i>${esc(r.terms[j][0])} <em>${v.toFixed(1)}</em></span>`).join('');
      return `<div class="rr${t.hit ? ' hit' : ''}" style="--i:${i}" data-i="${i}">
        <button class="rr-head" aria-expanded="false">
          <span class="rk">${i + 1}</span>
          <span class="rm"><span class="rp"><span>${esc(t.p.slice(0, cut))}</span>${esc(t.p.slice(cut))}</span>
          <span class="rf"><i style="left:${a}%;width:${wd}%"></i></span></span>
          <span class="rs">${t.s.toFixed(1)}</span>
          <span class="gt" aria-label="ground truth">✓</span>
        </button>
        <div class="rx"><div class="xb">${segs}</div><div class="xl">${legend}</div></div></div>`;
    }).join('');
    listEl.querySelectorAll('.rr').forEach(el => {
      el.querySelector('.rr-head').onclick = () => {
        const open = !el.classList.contains('open');
        listEl.querySelectorAll('.rr.open').forEach(o => { o.classList.remove('open'); o.querySelector('.rr-head').setAttribute('aria-expanded', 'false'); });
        if (open) { el.classList.add('open'); el.querySelector('.rr-head').setAttribute('aria-expanded', 'true'); }
        pick = +el.dataset.i;
      };
    });
    tabsEl.innerHTML = r.top.map((t, i) =>
      `<button class="viz-btn" data-i="${i}">${i + 1}${t.hit ? ' ✓' : ''}</button>`).join('');
    tabsEl.querySelectorAll('button').forEach(b => b.onclick = () => { pick = +b.dataset.i; });
    drawRings(r);
    packKey = '';
    srcEl._scrolled = '';
  }

  function render() {
    const r = run, p = P;
    const nType = Math.floor(Math.min(1, T / p.type) * r.q.length);
    set(textEl, T < p.type ? esc(r.q.slice(0, nType)) + '<span class="caret"></span>' : r._qhtml);
    textEl.classList.toggle('struck', T >= p.type + 500);
    const K = r.terms.length;
    const kNow = T < p.tok ? -1 : Math.floor((T - p.tok) / p.term);
    textEl.querySelectorAll('.qw[data-ks]').forEach(el => {
      const ks = el.dataset.ks.split(',').map(Number);
      el.classList.toggle('fire', T < p.terms && ks.includes(kNow));
      el.classList.toggle('done', T >= p.terms || Math.max(...ks) < kNow);
    });
    const kDone = T < p.tok ? 0 : Math.min(K, kNow + 1);
    const firing = T >= p.tok && T < p.terms;
    const ranked = T >= p.terms + 400;
    paintPack(r, firing ? kNow : kDone, firing, ranked);
    svg.classList.toggle('ranked', ranked);
    const u = r._union[kDone];
    set(countEl, ranked
      ? `<b>${fmt(u)}</b> chunks matched → <b class="t">5</b> retrieved`
      : T >= p.tok ? `<b>${fmt(u)}</b> / ${fmt(N)} chunks share a term`
        : `${fmt(F)} files · ${fmt(N)} chunks`);
    listEl.classList.toggle('on', ranked);
    listEl.classList.toggle('gt-on', T >= p.ans);
    const nAns = T < p.ctx ? 0 : Math.floor(Math.min(1, (T - p.ctx) / (p.ans - p.ctx)) * r.ans.length);
    const done = T >= p.ans;
    set(outEl, nAns ? md(r.ans.slice(0, nAns), r, done) + (done ? '' : '<span class="caret"></span>')
      : T >= p.rank ? '<span class="caret"></span>' : '');
    $('rag-ansp').classList.toggle('on', T >= p.rank);
    if (T >= p.rank) paintSource(r, pick < 0 ? 0 : pick, done);
    else { set(srcEl, ''); srcPathEl.textContent = ''; }
  }

  function frame(now) {
    const dt = last ? Math.min(100, now - last) : 0; last = now;
    if (!paused) {
      if (T < P.end) T = Math.min(P.end, T + dt);
      else if ((wait += dt) >= HOLD) load((runIdx + 1) % D.runs.length);
    }
    const left = Math.ceil((HOLD - wait) / 1000);
    const at = T < P.end ? '' : paused ? 'next question paused' : `next question in ${left}s`;
    if (autoEl.textContent !== at) autoEl.textContent = at;
    render();
    requestAnimationFrame(frame);
  }

  const sel = $('viz-sel');
  function load(i) {
    runIdx = i; run = D.runs[i]; prepare(run); P = phases(run); T = 0; pick = -1;
    wait = 0; setPaused(false);
    sel.value = String(i);
    buildDom(run);
  }
  const labels = ['lora endpoint', 'mm_kwargs vs tok_kwargs', 'cuda for sm100', 'reasoning flag', 'main config', 'metrics endpoint',
    'tool calling flag', 'reproducibility', 'attention backend', 'build jobs', 'structured outputs', 'zmq bug', 'rocm triton commit',
    'int4 calibration', 'paged attention warp', 'multi-model serving'];
  sel.innerHTML = D.runs.map((r, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} · ${labels[i] || 'q' + (i + 1)}</option>`).join('');
  sel.onchange = () => load(+sel.value);
  $('viz-prev').onclick = () => load((runIdx - 1 + D.runs.length) % D.runs.length);
  $('viz-next').onclick = () => load((runIdx + 1) % D.runs.length);
  const pb = $('viz-play');
  function setPaused(v) {
    paused = v;
    pb.textContent = v ? 'resume' : 'pause';
    pb.classList.toggle('on', v);
  }
  pb.onclick = () => setPaused(!paused);
  $('viz-skip').onclick = () => load((runIdx + 1) % D.runs.length);
  // clicking a result or a source only changes what is shown:
  // the animation and the next-question countdown keep running
  const autoEl = $('viz-auto');
  autoEl.onclick = () => load((runIdx + 1) % D.runs.length);
  load(0);
  requestAnimationFrame(frame);
})();
