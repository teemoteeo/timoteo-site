// Call Me Maybe: steps through a real constrained-decoding trace of Qwen3-0.6B
(function () {
  const { buttons } = PJ;
  const D = window.CALLMEMAYBE_DATA;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const vis = s => esc(s.replace(/\n/g, '↵').replace(/\t/g, '⇥').replace(/ /g, '·'));
  const promptEl = document.getElementById('cmm-prompt');
  const jsonEl = document.getElementById('cmm-json');
  const listEl = document.getElementById('cmm-list');
  const kindEl = document.getElementById('cmm-kind');
  const rawEl = document.getElementById('cmm-raw');
  let run, frames, i, playing = true, timer = null;

  function build(r) {
    const f = [{ t: 'inject', text: '{"name": "' }];
    for (const e of r.events) f.push(e);
    f.push({ t: 'inject', text: '}' });
    return f;
  }
  function firstObjectEnd(s) {
    let depth = 0, inStr = false, escp = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      if (inStr) { if (escp) escp = false; else if (ch === '\\') escp = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return k + 1; }
    }
    return -1;
  }
  function render() {
    let html = '';
    frames.slice(0, i + 1).forEach((e, k) => {
      const text = e.t === 'pick' ? e.chosen : e.text;
      if (text == null) return;
      const cls = (e.t === 'inject' ? 'inj' : 'gen') + (k === i ? ' cur' : '');
      html += `<span class="${cls}">${esc(text)}</span>`;
    });
    jsonEl.innerHTML = html + (i < frames.length - 1 ? '<span class="caret"></span>' : '');
    const e = frames[i];
    if (e.t === 'pick') {
      kindEl.textContent = `forward pass · ${e.legal.toLocaleString('en')} / 151,643 legal`;
      const hi = e.top[0][1], lo = e.top[e.top.length - 1][1] - 2;
      listEl.innerHTML = e.top.map(([tok, lg, ok]) => {
        const pick = ok && tok === e.chosen;
        const w = Math.max(4, (lg - lo) / (hi - lo) * 100);
        return `<div class="cand ${pick ? 'pick' : ok ? 'ok' : 'bad'}"><code>${vis(tok)}</code><span class="bar"><i style="width:${w}%"></i></span><span class="lg-v">${lg.toFixed(1)}</span></div>`;
      }).join('');
    } else if (e.t === 'forced') {
      kindEl.textContent = 'single legal token';
      listEl.innerHTML = `<div class="cmm-note">Only <code>${vis(e.text)}</code> fits the grammar here, so the model isn't called at all.</div>`;
    } else {
      kindEl.textContent = 'injected';
      listEl.innerHTML = `<div class="cmm-note">The grammar already knows this text: <code>${vis(e.text)}</code><br><br>It's appended to the context directly, with no forward pass.</div>`;
    }
  }
  function renderRaw() {
    const full = run.unconstrained;
    const end = firstObjectEnd(full);
    rawEl.innerHTML = end < 0 ? `<b>${esc(full)}</b>`
      : esc(full.slice(0, end)) + `<b>${esc(full.slice(end))}</b>`;
  }
  function next() {
    if (i < frames.length - 1) { i++; render(); schedule(); }
    else { timer = setTimeout(() => { i = 0; render(); schedule(); }, 3500); }
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    const e = frames[i];
    timer = setTimeout(next, e.t === 'pick' ? 1400 : 800);
  }
  function load(r) {
    run = r; frames = build(r); i = 0;
    promptEl.textContent = r.prompt;
    renderRaw(); render(); schedule();
  }
  buttons(document.getElementById('viz-prompt'),
    D.runs.map((r, k) => ({ label: r.label, r })), it => load(it.r));
  const pb = document.getElementById('viz-play');
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? 'pause' : 'play'; schedule(); };
  document.getElementById('viz-step').onclick = () => {
    playing = false; pb.textContent = 'play'; clearTimeout(timer);
    i = (i + 1) % frames.length; render();
  };
  load(D.runs[0]);
})();
