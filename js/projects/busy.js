// BUSY: a simulated workday on an approximated macOS desktop. The menu bar switch follows
// the app in front, the popover adds up green and red time. Clicking a pill flips that rule
// and, as in the app, the whole day is recoloured with the current rules.
// Every app window is a small scene that plays only while that app is in front.
(function () {
  const $ = id => document.getElementById(id);
  // [app, site, minutes, closed afterwards]; app null = away (idle pause). In the morning everything
  // stays open and you switch around; later, apps and tabs you won't need again get closed.
  const SCRIPT = [
    ['Safari', 'mail.google.com', 20], ['Claude', null, 30], ['Terminal', null, 35], ['Safari', 'instagram.com', 12],
    ['Terminal', null, 25], ['Safari', 'agenziaentrate.gov.it', 25, ['agenziaentrate.gov.it']], ['Claude', null, 20], ['Safari', 'instagram.com', 15],
    ['Safari', 'mail.google.com', 15], ['Xcode', null, 32, ['Xcode']], ['Safari', 'instagram.com', 10], [null, null, 60],
    ['Claude', null, 25], ['Terminal', null, 30], ['Safari', 'instagram.com', 14], ['Safari', 'youtube.com', 35, ['youtube.com']],
    ['Safari', 'agenziaentrate.gov.it', 20, ['agenziaentrate.gov.it']], ['Terminal', null, 35], ['Safari', 'instagram.com', 12], ['Claude', null, 20, ['Claude']],
    ['Safari', 'mail.google.com', 15], ['Safari', 'instagram.com', 18], ['Terminal', null, 20, ['Terminal']], ['Safari', 'instagram.com', 18, ['Safari']],
    [null, null, 99], ['Safari', 'netflix.com', 60],
  ];
  const START = 9 * 60;
  let t = 0;
  const day = SCRIPT.map(([app, site, min, close]) => {
    const s = { app, site, key: site || app || 'away', start: t, end: t + min, close: close || [] };
    t += min;
    return s;
  });
  const TOTAL = t;
  // The whole loop lasts 45 s: the day, idle stretches at 4× speed, then a 3 s hold before the next day.
  const LOOP_MS = 45000, HOLD_MS = 3000, IDLE_SPEED = 4;
  const MS_PER_MIN = (LOOP_MS - HOLD_MS) / day.reduce((m, s) => m + (s.end - s.start) / (s.app ? 1 : IDLE_SPEED), 0);
  const rules = {
    Claude: 'green', Terminal: 'green', Xcode: 'green', 'mail.google.com': 'green', 'agenziaentrate.gov.it': 'green',
    'instagram.com': 'red', 'youtube.com': 'red', 'netflix.com': 'red',
  };

  let now = 0, playing = true, last = 0, hold = 0, shown = null, idle = false, seg = null;
  const cat = s => (s.app ? rules[s.key] : 'paused');
  const hm = m => String(Math.floor((START + m) / 60) % 24).padStart(2, '0') + ':' + String(Math.floor(START + m) % 60).padStart(2, '0');
  const dur = m => {
    const h = Math.floor(m / 60), mm = Math.floor(m % 60);
    return h ? h + 'h' + (mm ? ' ' + mm + 'm' : '') : mm + 'm';
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; if (html) d.innerHTML = html; return d; };

  // ---------- window chrome ----------
  const ICON = {
    side: '<svg width="16" height="13" viewBox="0 0 16 13"><rect x=".7" y=".7" width="14.6" height="11.6" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 1v11" stroke="currentColor" stroke-width="1.3"/></svg>',
    back: '<svg width="9" height="13" viewBox="0 0 9 13"><path d="M7 1.5 2 6.5l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    fwd: '<svg width="9" height="13" viewBox="0 0 9 13" opacity=".4"><path d="m2 1.5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    lock: '<svg width="9" height="11" viewBox="0 0 9 11"><rect x=".5" y="4.5" width="8" height="6" rx="1.2" fill="currentColor"/><path d="M2.3 4.6V3.2a2.2 2.2 0 0 1 4.4 0v1.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    share: '<svg width="13" height="15" viewBox="0 0 13 15"><path d="M6.5 1v9M3.5 4l3-3 3 3M4 6.5H2v7.5h9V6.5H9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
    plus: '<svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    tabs: '<svg width="15" height="13" viewBox="0 0 15 13"><rect x="3.5" y=".7" width="10.8" height="8.6" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 4v6.3a2 2 0 0 0 2 2h7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  };
  const PTR = '<svg class="ptr" viewBox="0 0 13 20"><path d="M1 1v15.5l3.9-3.7 2.7 6.1 2.4-1.1-2.7-5.9h5.4z" fill="#000" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  const TL = '<span class="tl"><i></i><i></i><i></i></span>';
  // Sites are pages (tabs) of one Safari window; the other apps have their own window.
  const safari = (url, body) => '<div class="sf-page">' + body + '</div>';
  const plain = (app, title, body) => '<div class="mw w-' + app + '"><div class="mw-bar">' + TL + '<div class="mw-title">' + title + '</div></div><div class="mw-body">' + body + '</div>' + PTR + '</div>';
  const SAFARI = '<div class="mw w-Safari"><div class="mw-bar">' + TL + ICON.side + ICON.back + ICON.fwd + '<div class="mw-url">' + ICON.lock + '<span class="sf-url"></span></div>' +
    ICON.share + ICON.plus + ICON.tabs + '</div><div class="sf-tabs"></div><div class="mw-body sf-pages"></div>' + PTR + '</div>';
  const TABS = {
    'mail.google.com': ['Inbox – Gmail', '#ea4335'], 'instagram.com': ['Instagram', '#d62976'], 'youtube.com': ['I tried deep work for 30 days – YouTube', '#ff0000'],
    'netflix.com': ['Night Shift | Netflix', '#e50914'], 'agenziaentrate.gov.it': ['Agenzia delle Entrate', '#0066cc'],
  };
  const MENUS = {
    Finder: ['File', 'Edit', 'View', 'Go', 'Window', 'Help'], Safari: ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Window', 'Help'],
    Claude: ['File', 'Edit', 'View', 'Window', 'Help'], Terminal: ['Shell', 'Edit', 'View', 'Window', 'Help'],
    Xcode: ['File', 'Edit', 'View', 'Find', 'Navigate', 'Editor', 'Product', 'Debug', 'Window'],
  };
  // Real macOS icons, exported from the apps.
  const DOCK = ['Finder', 'Safari', 'Messages', 'Claude', 'Terminal', 'Xcode', 'Settings', null, 'Trash'];
  const dockIcon = app => $('bz-dock').querySelector('[data-app="' + app + '"]');

  // ---------- scene engine: each window has its own clock, advanced only while it is in front ----------
  const apps = {}, wins = {};
  let z = 1;
  function windowOf(app) {
    if (wins[app]) return wins[app];
    const tpl = document.createElement('template');
    tpl.innerHTML = (app === 'Safari' ? SAFARI : WINDOWS[app].html).trim();
    const w = tpl.content.firstChild;
    w.classList.add('launch');
    $('bz-desk').appendChild(w);
    dockIcon(app).classList.add('run', 'bounce');
    return (wins[app] = w);
  }
  function mount(s) {
    if (apps[s.key]) return apps[s.key];
    const a = { clock: 0, waits: [] }, win = windowOf(s.app);
    if (s.site) {
      const tpl = document.createElement('template');
      tpl.innerHTML = WINDOWS[s.key].html.trim();
      a.el = win.querySelector('.sf-pages').appendChild(tpl.content.firstChild);
      a.tab = win.querySelector('.sf-tabs').appendChild(document.createElement('span'));
      a.tab.innerHTML = '<i style="--c:' + TABS[s.key][1] + '"></i>';
      a.tab.append(TABS[s.key][0]);
      a.site = s.key;
    } else a.el = win;
    const sleep = ms => new Promise(r => a.waits.push({ t: a.clock + ms, r }));
    apps[s.key] = a;
    WINDOWS[s.key].play(a.el, sleep);
    return a;
  }
  // Brings the app (and the site's tab) to the front; idle time shows the lock screen over everything.
  function front(s) {
    $('bz-lock').classList.toggle('on', !s.app);
    $('bz-menus').innerHTML = MENUS[s.app || 'Finder'].map(m => '<span>' + m + '</span>').join('');
    if (!s.app) return;
    const a = mount(s), win = wins[s.app];
    for (const w of Object.values(wins)) w.classList.toggle('bg', w !== win);
    win.style.zIndex = ++z;
    if (s.site) showTab(win, a);
  }
  function showTab(win, a) {
    win.querySelectorAll('.sf-page').forEach(p => { p.hidden = p !== a.el; });
    win.querySelectorAll('.sf-tabs span').forEach(t => t.classList.toggle('on', t === a.tab));
    win.querySelector('.sf-url').textContent = a.site;
  }
  // Quits an app (window and Dock dot go) or closes a Safari tab; quitting Safari closes its tabs.
  function quit(key) {
    const a = apps[key];
    if (a && a.tab) {
      const active = a.tab.classList.contains('on');
      a.tab.remove();
      a.el.remove();
      delete apps[key];
      // Closing the tab in view shows the last one still open, as Safari does.
      const rest = Object.values(apps).filter(o => o.tab);
      if (active && rest.length) showTab(wins.Safari, rest[rest.length - 1]);
      return;
    }
    const w = wins[key];
    if (!w) return;
    for (const k of Object.keys(apps)) if (apps[k].el === w || w.contains(apps[k].el)) delete apps[k];
    delete wins[key];
    dockIcon(key).classList.remove('run', 'bounce');
    w.classList.add('closing');
    setTimeout(() => w.remove(), 250);
  }
  function advance(a, dt) {
    if (!a) return;
    a.clock += dt;
    const due = a.waits.filter(w => w.t <= a.clock);
    a.waits = a.waits.filter(w => w.t > a.clock);
    due.forEach(w => w.r());
  }
  // Mouse pointer: glides to an element, optionally clicks it.
  async function point(w, target, sleep, click) {
    w = target.closest('.mw');
    const p = w.querySelector('.ptr'), r = target.getBoundingClientRect(), o = w.getBoundingClientRect();
    const x = r.left - o.left + r.width * 0.55, y = r.top - o.top + r.height * 0.5;
    if (p.style.opacity !== '1') {
      // First appearance: show up a little away from the target instead of gliding in from the corner.
      p.style.transition = 'none';
      p.style.transform = 'translate(' + (x + 70) + 'px,' + (y + 45) + 'px)';
      p.getBoundingClientRect();
      p.style.transition = '';
      p.style.opacity = 1;
    }
    p.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    await sleep(700);
    if (click) {
      target.classList.add('pressed');
      await sleep(160);
      target.classList.remove('pressed');
    }
  }
  async function type(node, text, sleep, min, max) {
    for (const ch of text) { node.textContent += ch; await sleep(rnd(min, max)); }
  }

  // ---------- the apps ----------
  const TERM = [
    ['git status', ['On branch ui-recap-regole', "Your branch is up to date with 'origin/ui-recap-regole'.", '', 'Changes not staged for commit:', '<span class="del">\tmodified:   BUSY/App/BUSYApp.swift</span>', '<span class="del">\tmodified:   BUSY/UI/Theme.swift</span>']],
    ['claude', ['<span class="cc">✻</span> Welcome to <b>Claude Code</b>', '<span class="dim">  /help for help · cwd: ~/BUSY</span>', ' ',
      '&gt; make the sidebar look like System Settings', '<span class="cc">⏺</span> Read(BUSY/App/BUSYApp.swift)', '<span class="cc">⏺</span> Update(BUSY/App/BUSYApp.swift)', '  <span class="add">+38</span> <span class="del">−12</span>  NSSplitViewController with a glass sidebar', '<span class="cc">⏺</span> Bash(xcodebuild -scheme BUSY build)', '  <span class="ok">** BUILD SUCCEEDED **</span>', '<span class="cc">⏺</span> Done: the sidebar floats like System Settings.']],
    ['xcodebuild -scheme BUSY -configuration Release build | xcpretty', ['<span class="dim">▸ Compiling BUSYApp.swift</span>', '<span class="dim">▸ Compiling RecapView.swift</span>', '<span class="dim">▸ Compiling Sampler.swift</span>', '<span class="dim">▸ Compiling Classifier.swift</span>', '<span class="dim">▸ Linking BUSY</span>', '<span class="dim">▸ Signing BUSY.app</span>', '<span class="ok">** BUILD SUCCEEDED **</span> <span class="dim">[14.2 sec]</span>']],
    ['git commit -am "Sidebar in stile macOS 26"', ['[ui-recap-regole 42c09ec] Sidebar in stile macOS 26', ' 6 files changed, <span class="add">185 insertions(+)</span>, <span class="del">89 deletions(-)</span>']],
    ['git push', ['Enumerating objects: 23, done.', 'Writing objects: 100% (12/12), 4.81 KiB | 4.81 MiB/s, done.', 'To github.com:teemoteeo/BUSY.git', '   87fe974..42c09ec  ui-recap-regole -&gt; ui-recap-regole']],
  ];
  const CHATS = [
    ['Fixed-width window', 'How do I keep a Mac window fixed in width but let it grow in height?',
      'Set contentMinSize and contentMaxSize to the same width and leave the height open. Add .fullScreenNone to the collection behaviour, so the green button only zooms vertically, the way System Settings does.',
      'Why does my sidebar disappear when I drag its edge?', 'NavigationSplitView lets the user collapse it. Use an NSSplitViewController instead and set canCollapse = false on the sidebar item.'],
    ['F24 deadline', 'If the F24 is due on the 16th and that\'s a Sunday, when do I pay?',
      'When a tax deadline falls on a Saturday or a public holiday, it moves to the next working day, so you\'d pay on Monday the 17th without penalties.',
      'What is the F24 form, in two lines?', 'It\'s the form used in Italy to pay most taxes and contributions. You can file it online through your bank or the Agenzia delle Entrate.'],
    ['Commit message', 'Write a short commit message for the sidebar changes, in Italian.',
      '"Sidebar in stile macOS 26 e finestra ridimensionabile": sidebar di vetro con NSSplitViewController, titolo più grande, margini allineati al titolo.',
      'Summarise what changed in BUSYApp.swift', 'The sidebar moved to an NSSplitViewController, the window got a toolbar for the larger corner radius, and the page title is now bigger.'],
  ];
  const MAILS = [
    ['Tre Mobile', 'La tua fattura di ottobre è disponibile', 'Ciao Timoteo,\nla fattura di ottobre è pronta. Importo: 9,99 €.\nScadenza addebito: 15/10.'],
    ['GitHub', '[teemoteeo/BUSY] Run succeeded: build', 'All jobs have passed.\nbuild — macOS 14, macOS 26 ✓\nCommit 42c09ec by teemoteeo.'],
    ['Giulia', 'aperitivo venerdì?', 'Ciao! Venerdì alle 19 da Santo Spirito, ci sei?\nPorta anche Marco se vuole 🙂'],
    ['42 Firenze', 'Evaluation booked: rag-against-the-machine', 'Your evaluation is booked for Monday at 14:00.\nLocation: cluster 2.'],
  ];
  const OLD_MAILS = [['Agenzia delle Entrate', 'Dichiarazione precompilata disponibile', '8:47'], ['Mamma', 'pranzo domenica?', '8:30'],
    ['Notion', 'Your weekly digest', 'Oct 2'], ['LinkedIn', 'You appeared in 12 searches this week', 'Oct 2'], ['Apple', 'Your receipt from Apple', 'Oct 1'],
    ['Figma', 'New comment on Portfolio', 'Sep 30'], ['Trenitalia', 'Il tuo biglietto Firenze → Udine', 'Sep 29'], ['Spotify', 'Your Daily Mix is ready', 'Sep 28']];
  const IG = [
    ['giulia.travels', '#e0a96d', 'radial-gradient(circle at 70% 32%,#fff1c9 0 7%,transparent 8%),linear-gradient(transparent 62%,#2b4162 62%),linear-gradient(#ffb36b,#ff6f61 55%,#8e4a7e)', 'tramonto a Positano, non male'],
    ['pasta.lab', '#c0392b', 'radial-gradient(circle at 50% 52%,#f6d27a 0 26%,#e9b44c 27% 30%,transparent 31%),radial-gradient(circle at 50% 52%,#fff 0 40%,transparent 41%),linear-gradient(135deg,#3a2a1e,#6b4c35)', 'cacio e pepe, ricetta in bio'],
    ['tramonti.firenze', '#f39c12', 'linear-gradient(transparent 55%,#3d2b1f 55% 58%,transparent 58%),linear-gradient(#2c3e7a,#c06c84 50%,#f8b195)', 'Ponte Vecchio stasera'],
    ['marco_runs', '#16a085', 'radial-gradient(ellipse at 50% 120%,#2ecc71 0 40%,transparent 41%),linear-gradient(#74ebd5,#acb6e5)', '12 km al Parco delle Cascine'],
    ['udine.daily', '#8e44ad', 'linear-gradient(90deg,transparent 30%,#d9c7a7 30% 70%,transparent 70%),linear-gradient(transparent 40%,#a8885f 40%),linear-gradient(#9fc5e8,#cfe2f3)', 'Piazza Libertà, mattina presto'],
  ];
  const SUBS = ['Where were you last night?', 'Working. Like always.', 'Nobody works until four in the morning.', 'Then you don\'t know the night shift.', '…', 'Get in the car.', 'Where are we going?', 'Somewhere nobody is watching.'];
  const PRE = ['<span class="k">import</span> Foundation', ' ', '<span class="c">/// What a sample counts as.</span>',
    '<span class="k">enum</span> <span class="t">Category</span>: <span class="t">String</span>, <span class="t">Codable</span> {', '    <span class="k">case</span> green, red, paused, unknown', '}', ' '];
  const CODE = [
    [['k', 'struct'], ['', ' '], ['t', 'Totals'], ['', ' {']],
    [['', '    '], ['k', 'var'], ['', ' green: '], ['t', 'TimeInterval'], ['', ' = '], ['n', '0']],
    [['', '    '], ['k', 'var'], ['', ' red: '], ['t', 'TimeInterval'], ['', ' = '], ['n', '0']],
    [['', ' ']],
    [['', '    '], ['c', '/// Share of classified time that was green.']],
    [['', '    '], ['k', 'var'], ['', ' percentage: '], ['t', 'Double'], ['', ' {']],
    [['', '        '], ['k', 'let'], ['', ' classified = green + red']],
    [['', '        '], ['k', 'guard'], ['', ' classified > '], ['n', '0'], ['', ' '], ['k', 'else'], ['', ' { '], ['k', 'return'], ['', ' '], ['n', '0'], ['', ' }']],
    [['', '        '], ['k', 'return'], ['', ' green / classified * '], ['n', '100']],
    [['', '    }']],
    [['', '}']],
  ];

  const WINDOWS = {
    Terminal: {
      html: plain('Terminal', 'BUSY — zsh — 80×24', '<div class="tm mono"></div>'),
      async play(w, sleep) {
        const out = w.querySelector('.tm');
        const line = html => { const d = el('', html); out.appendChild(d); while (out.children.length > 22) out.firstChild.remove(); return d; };
        for (;;) for (const [cmd, lines] of TERM) {
          const l = line('<span class="p">timoteo@mac BUSY %</span> <span class="cmd"></span><span class="cur"></span>');
          await sleep(500);
          await type(l.querySelector('.cmd'), cmd, sleep, 25, 70);
          await sleep(300);
          l.querySelector('.cur').remove();
          for (const o of lines) { line(o || ' '); await sleep(rnd(70, 260)); }
          await sleep(900);
        }
      },
    },
    Claude: {
      html: plain('Claude', 'Claude', '<div class="cl"><div class="cl-side"><div class="cl-new"><i>+</i>New chat</div><small>Recents</small>' +
        CHATS.map(c => '<span>' + c[0] + '</span>').join('') + '<span>Recipe for 6 people</span><span>Cover letter draft</span></div>' +
        '<div class="cl-main"><div class="cl-head"></div><div class="cl-thread"></div><div class="cl-box"><span></span><div class="cl-send">↑</div></div></div></div>'),
      async play(w, sleep) {
        const thread = w.querySelector('.cl-thread'), box = w.querySelector('.cl-box span'), send = w.querySelector('.cl-send');
        const items = w.querySelectorAll('.cl-side span'), head = w.querySelector('.cl-head');
        for (;;) for (const [i, [title, q, a, pq, pa]] of CHATS.entries()) {
          items.forEach((it, j) => it.classList.toggle('on', j === i));
          head.textContent = title;
          // Each chat already has an earlier exchange, as a real one would.
          thread.innerHTML = '';
          thread.appendChild(el('cl-user')).textContent = pq;
          thread.appendChild(el('cl-ai')).textContent = pa;
          await sleep(500);
          await type(box, q, sleep, 18, 55);
          await sleep(250);
          await point(w, send, sleep, true);
          box.textContent = '';
          thread.appendChild(el('cl-user')).textContent = q;
          const ai = thread.appendChild(el('cl-ai', '<span class="cl-spark">✻</span>'));
          while (thread.children.length > 4) thread.firstChild.remove();
          await sleep(1100);
          ai.textContent = '';
          for (const word of a.split(' ')) { ai.textContent += word + ' '; await sleep(rnd(35, 90)); }
          await sleep(2600);
        }
      },
    },
    'mail.google.com': {
      html: safari('mail.google.com', '<div class="gm"><div class="gm-top"><div class="gm-logo"><svg width="22" height="16" viewBox="0 0 22 16"><path d="M1.5 15V3l9.5 7 9.5-7v12" fill="none" stroke="#ea4335" stroke-width="2.6" stroke-linejoin="round"/></svg>Gmail</div>' +
        '<div class="gm-search">⌕ Search mail</div><div class="gm-av">T</div></div><div class="gm-body"><div class="gm-side"><div class="gm-compose">✎ Compose</div>' +
        '<span class="on">Inbox <b class="gm-count">2</b></span><span>Starred</span><span>Snoozed</span><span>Sent</span><span>Drafts <b>3</b></span></div>' +
        '<div class="gm-main"><div class="gm-tabs"><span class="on">Primary</span><span>Promotions</span><span>Social</span></div><div class="gm-list">' +
        OLD_MAILS.map(([f, s, d], i) => '<div class="gm-row' + (i < 2 ? ' unread' : '') + '"><i></i><b>' + f + '</b><span>' + s + '</span><em>' + d + '</em></div>').join('') +
        '</div><div class="gm-read"><div class="gm-back">←</div><h3></h3><div class="gm-from"><i></i><div><b></b><br><small>to me</small></div></div><div class="gm-text"></div></div></div></div></div>'),
      async play(w, sleep) {
        const list = w.querySelector('.gm-list'), main = w.querySelector('.gm-main'), count = w.querySelector('.gm-count');
        let unread = 2;
        for (;;) for (const [from, subject, body] of MAILS) {
          await sleep(900);
          const row = el('gm-row unread new', '<i></i><b></b><span></span><em>' + hm(now) + '</em>');
          row.children[1].textContent = from;
          row.children[2].textContent = subject;
          list.prepend(row);
          while (list.children.length > 9) list.lastChild.remove();
          count.textContent = ++unread;
          await sleep(1000);
          await point(w, row, sleep, true);
          w.querySelector('.gm-read h3').textContent = subject;
          w.querySelector('.gm-from b').textContent = from;
          w.querySelector('.gm-text').textContent = body;
          main.classList.add('reading');
          row.classList.remove('unread');
          count.textContent = --unread;
          await sleep(2600);
          await point(w, w.querySelector('.gm-back'), sleep, true);
          main.classList.remove('reading');
        }
      },
    },
    'instagram.com': {
      html: safari('instagram.com', '<div class="ig"><div class="ig-nav"><b>Ig</b><span>⌂</span><span>⌕</span><span>◎</span><span>▷</span><span>✉</span><span>♡</span><span>⊕</span></div>' +
        '<div class="ig-view"><div class="ig-feed"><div class="ig-stories">' + IG.concat(IG.slice(0, 1)).map(p => '<i style="--c:' + p[1] + '"></i>').join('') + '</div></div></div>' +
        '<div class="ig-sugg">Suggested for you' + ['chef.lorenzo', 'firenze.eats', 'design.daily'].map((n, i) => '<div><i style="--c:' + IG[i + 2][1] + '"></i>' + n + '<em>Follow</em></div>').join('') + '</div></div>'),
      async play(w, sleep) {
        const view = w.querySelector('.ig-view'), feed = w.querySelector('.ig-feed');
        const post = ([user, c, img, cap], i) => el('ig-post', '<div class="ig-head"><i style="--c:' + c + '"></i>' + user + ' <small>· ' + (i % 9 + 1) + 'h</small></div>' +
          '<div class="ig-img" style="background:' + img + '"></div><div class="ig-act"><span class="like">♡</span><span>◯</span><span>➤</span><span>⌑</span></div>' +
          '<p><b class="likes">' + (800 + (i * 1373) % 9000) + '</b> likes</p><p><b>' + user + '</b> ' + cap + '</p>');
        IG.forEach((p, i) => feed.appendChild(post(p, i)));
        let y = 0, n = IG.length;
        for (;;) {
          // Scroll a bit, like a thumb on a trackpad, then stop and double-tap the post in view.
          const dist = rnd(260, 380);
          for (let d = 0; d < dist; d += 7) {
            y += 7;
            const first = feed.firstElementChild, gap = first.classList.contains('ig-stories') ? 16 : 22;
            if (y > first.offsetHeight + gap) {
              y -= first.offsetHeight + gap;
              first.remove();
              if (!first.classList.contains('ig-stories')) feed.appendChild(post(IG[n % IG.length], n++));
            }
            feed.style.transform = 'translateY(' + -y + 'px)';
            await sleep(16);
          }
          await sleep(500);
          const mid = view.getBoundingClientRect().top + view.clientHeight / 2;
          const img = [...feed.querySelectorAll('.ig-img')].sort((a, b) =>
            Math.abs(a.getBoundingClientRect().top + 145 - mid) - Math.abs(b.getBoundingClientRect().top + 145 - mid))[0];
          await point(w, img, sleep, true);
          const like = img.parentElement.querySelector('.like');
          if (!like.classList.contains('on')) {
            img.appendChild(el('ig-heart', '♥'));
            like.textContent = '♥';
            like.classList.add('on');
            const likes = img.parentElement.querySelector('.likes');
            likes.textContent = +likes.textContent + 1;
          }
          await sleep(1100);
          const heart = img.querySelector('.ig-heart');
          if (heart) heart.remove();
        }
      },
    },
    'youtube.com': {
      html: safari('youtube.com', '<div class="yt"><div class="yt-top"><div class="yt-logo"><i></i>YouTube</div><div class="yt-search">Search</div></div><div class="yt-main"><div>' +
        '<div class="yt-player"><div class="scene"><div class="yt-sky"></div><div class="yt-sun"></div><div class="ridge r1"></div><div class="ridge r2"></div><div class="ridge r3"></div></div>' +
        '<div class="vctrl"><div class="vbar"><i></i></div><div class="vrow"><span>❚❚</span><span>⏭</span><span>🔈</span><span class="vt"></span><span class="grow"></span><span>CC</span><span>⚙</span><span>⛶</span></div></div></div>' +
        '<h4>I tried deep work for 30 days (honest results)</h4><div class="yt-ch"><i></i><div><b>Slow Focus</b>1.2M subscribers</div><span class="yt-sub">Subscribe</span><span class="yt-pill">👍 48K</span></div></div>' +
        '<div class="yt-side">' + [['Why you can\'t focus anymore', 'Brain Things', '18:22', 'linear-gradient(135deg,#355c7d,#c06c84)'], ['My minimal desk setup 2026', 'Studio Neri', '12:07', 'linear-gradient(135deg,#232526,#757f9a)'],
          ['Lofi beats to study to', 'Night Radio', 'LIVE', 'linear-gradient(135deg,#41295a,#2f0743)'], ['How Tuscany makes olive oil', 'Slow Travel', '24:51', 'linear-gradient(135deg,#5a7d2a,#c9d66b)']]
          .map(([ti, c, d, g]) => '<div><i data-d="' + d + '" style="--c:' + g + '"></i><span>' + ti + '<small>' + c + '</small></span></div>').join('') + '</div></div></div>'),
      async play(w, sleep) {
        const bar = w.querySelector('.vbar i'), time = w.querySelector('.vt'), T = 35 * 60 + 2;
        for (let s = 12 * 60 + 41; ; s = (s + 1) % T) {
          bar.style.width = (s / T * 100) + '%';
          time.textContent = mmss(s) + ' / ' + mmss(T);
          await sleep(220);
        }
      },
    },
    'netflix.com': {
      html: safari('netflix.com', '<div class="nf"><div class="scene"><div class="nf-sky"></div><div class="nf-moon"></div><div class="nf-back"></div><div class="nf-city"></div></div>' +
        '<div class="nf-top">←&nbsp; <b>Night Shift</b><small>S1:E4 “Overtime”</small></div><div class="nf-sub"></div>' +
        '<div class="vctrl"><div class="vbar"><i></i></div><div class="vrow"><span>❚❚</span><span>↺10</span><span>↻10</span><span>🔈</span><span class="grow"></span><span class="vt"></span><span>💬</span><span>⛶</span></div></div></div>'),
      async play(w, sleep) {
        const bar = w.querySelector('.vbar i'), time = w.querySelector('.vt'), sub = w.querySelector('.nf-sub'), T = 52 * 60;
        let s = 9 * 60, i = 0, next = 0;
        for (;;) {
          bar.style.width = (s / T * 100) + '%';
          time.textContent = mmss(T - s);
          if (s >= next) { sub.textContent = SUBS[i++ % SUBS.length]; next = s + 9; }
          s = (s + 1) % T;
          await sleep(240);
        }
      },
    },
    'agenziaentrate.gov.it': {
      html: safari('agenziaentrate.gov.it', '<div class="ae"><div class="ae-slim">Agenzia delle Entrate · Servizi online</div><div class="ae-top"><span class="ae-emb">AE</span><b>Agenzia delle Entrate</b><span class="ae-who">Area riservata</span></div>' +
        '<div class="ae-view login"><div class="ae-card"><h3>Accedi all\'area riservata</h3><div class="ae-tabs"><span class="on">SPID</span><span>CIE</span><span>CNS</span></div>' +
        '<label>Codice fiscale</label><div class="ae-field"><span class="cf"></span><span class="caret"></span></div><div class="ae-btn spid">Entra con SPID</div></div></div>' +
        '<div class="ae-view home"><h2>Benvenuto, TIMOTEO<small>Ultimo accesso: 2 ottobre 2026, 18:40</small></h2><div class="ae-grid">' +
        '<div class="ae-card"><b>Dichiarazione precompilata 2026</b><span class="ae-state">Da inviare</span><p>Modello 730 · rimborso previsto 312,00 €</p><div class="ae-btn send">Invia dichiarazione</div></div>' +
        '<div class="ae-card"><b>Cassetto fiscale</b><p>Versamenti, rimborsi, atti del registro</p></div><div class="ae-card"><b>F24 web</b><p>Paga imposte e contributi online</p></div>' +
        '<div class="ae-card"><b>Comunicazioni (2)</b><p>Avviso di scadenza IMU</p></div></div><div class="ae-ok">✓ Dichiarazione inviata · protocollo n. 26100312345678</div></div>' +
        '<div class="ae-wait"><i></i></div></div>'),
      async play(w, sleep) {
        const ae = w.querySelector('.ae'), cf = w.querySelector('.cf'), state = w.querySelector('.ae-state'), who = w.querySelector('.ae-who');
        for (;;) {
          ae.className = 'ae'; cf.textContent = ''; state.textContent = 'Da inviare'; state.classList.remove('done'); who.textContent = 'Area riservata';
          await sleep(500);
          await point(w, w.querySelector('.ae-field'), sleep, true);
          await type(cf, 'RSSMRA80A01H501U', sleep, 60, 140);
          await sleep(300);
          await point(w, w.querySelector('.spid'), sleep, true);
          ae.classList.add('wait');
          await sleep(1300);
          ae.classList.remove('wait');
          ae.classList.add('in');
          who.textContent = 'TIMOTEO';
          await sleep(1400);
          await point(w, w.querySelector('.send'), sleep, true);
          ae.classList.add('wait');
          await sleep(1000);
          ae.classList.remove('wait');
          ae.classList.add('sent');
          state.textContent = 'Inviata';
          state.classList.add('done');
          await sleep(3500);
        }
      },
    },
    Xcode: {
      html: '<div class="mw w-Xcode"><div class="mw-bar xc-bar">' + TL + '<span class="xc-run">▶</span><span class="xc-run">■</span><span class="xc-scheme">BUSY ›  My Mac</span>' +
        '<div class="xc-status"><span class="msg">BUSY | Ready</span><i></i></div></div><div class="mw-body"><div class="xc mono"><div class="xc-side">▾ BUSY<br>&nbsp;▾ App<br>&nbsp;&nbsp;&nbsp;BUSYApp.swift<br>&nbsp;▾ Core<br>' +
        '&nbsp;&nbsp;&nbsp;Classifier.swift<br>&nbsp;&nbsp;&nbsp;Sampler.swift<br>&nbsp;▾ Storage<br><span class="on">&nbsp;&nbsp;Totals.swift</span>&nbsp;▾ UI<br>&nbsp;&nbsp;&nbsp;RecapView.swift<br>&nbsp;&nbsp;&nbsp;Theme.swift</div>' +
        '<div class="xc-ed"><div class="xc-tabs">Totals.swift</div><div class="xc-gut"></div><div class="xc-code"></div></div></div></div>' + PTR + '</div>',
      async play(w, sleep) {
        const code = w.querySelector('.xc-code'), gut = w.querySelector('.xc-gut'), msg = w.querySelector('.xc-status .msg'), prog = w.querySelector('.xc-status i');
        for (;;) {
          code.innerHTML = PRE.map(l => '<div>' + l + '</div>').join('');
          gut.textContent = PRE.map((_, i) => i + 1).join('\n') + '\n';
          msg.textContent = 'BUSY | Ready'; prog.style.width = 0;
          for (const [n, tokens] of CODE.entries()) {
            code.querySelectorAll('.cur').forEach(l => l.classList.remove('cur'));
            const lineEl = code.appendChild(el('cur'));
            gut.textContent += (PRE.length + n + 1) + '\n';
            const caret = el('caret');
            for (const [cls, text] of tokens) {
              const span = document.createElement('span');
              if (cls) span.className = cls;
              lineEl.appendChild(span);
              lineEl.appendChild(caret);
              await type(span, text, sleep, 15, 45);
            }
            caret.remove();
            await sleep(rnd(120, 300));
          }
          await sleep(400);
          await point(w, w.querySelector('.xc-run'), sleep, true);
          for (let i = 1; i <= 12; i++) {
            msg.textContent = 'Building BUSY: Compiling ' + i + ' of 12';
            prog.style.width = (i / 12 * 100) + '%';
            await sleep(rnd(90, 200));
          }
          prog.style.width = 0;
          msg.innerHTML = 'BUSY | <span class="ok">Build Succeeded</span> | Today at ' + hm(now);
          await sleep(3500);
        }
      },
    },
  };

  function render() {
    const cur = day.find(s => now >= s.start && now < s.end) || day[day.length - 1];
    const c = cat(cur);
    $('bz-switch').className = 'bz-switch ' + c;
    $('bz-app').textContent = cur.app || 'Finder';
    $('bz-clock').textContent = hm(now);
    $('bz-time').textContent = 'Sat 3 Oct  ' + hm(now);
    $('bz-rule').innerHTML = cur.app
      ? '· <code>' + cur.key + '</code> → <b class="' + c + '">' + c + '</b>'
      : '· <b class="paused">paused</b>';
    if (seg !== cur) {
      if (seg) seg.close.forEach(quit);
      seg = cur;
    }
    if (shown !== cur.key || !apps[cur.key] && cur.app) { shown = cur.key; front(cur); }
    $('bz-away-clock').textContent = hm(now);
    idle = !cur.app;

    const tot = { green: 0, red: 0, paused: 0 }, per = {};
    let tl = '';
    for (const s of day) {
      if (s.start >= now) break;
      const m = Math.min(s.end, now) - s.start, k = cat(s);
      tot[k] += m;
      if (s.app) per[s.key] = (per[s.key] || 0) + m;
      tl += '<i class="' + k + '" style="left:' + (s.start / TOTAL * 100) + '%;width:' + (m / TOTAL * 100) + '%"></i>';
    }
    $('bz-green').textContent = dur(tot.green);
    $('bz-red').textContent = dur(tot.red);
    const cls = tot.green + tot.red;
    $('bz-share').textContent = cls ? Math.round(tot.green / cls * 100) + '% of classified time green' : '';
    $('bz-tl').innerHTML = tl;
    // Rows are kept and updated in place: rebuilt every frame, a click would land on a dead button.
    const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const list = $('bz-top');
    for (const r of rows.values()) r.hidden = true;
    top.forEach(([k, m], i) => {
      const r = row(k);
      r.hidden = false;
      r.children[1].textContent = dur(m);
      const pill = r.children[2];
      pill.className = 'bz-pill ' + rules[k];
      pill.textContent = rules[k];
      pill.setAttribute('aria-label', 'mark ' + k + ' as ' + (rules[k] === 'green' ? 'red' : 'green'));
      // Moved only when the order changes, so keyboard focus stays put.
      if (list.children[i] !== r) list.insertBefore(r, list.children[i] || null);
    });
  }

  const rows = new Map();
  function row(k) {
    if (!rows.has(k)) {
      const r = document.createElement('div');
      r.className = 'bz-row';
      r.innerHTML = '<span></span><span></span><button class="bz-pill"></button>';
      r.children[0].textContent = k;
      r.children[2].dataset.k = k;
      rows.set(k, r);
    }
    return rows.get(k);
  }

  $('bz-top').addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    rules[k] = rules[k] === 'green' ? 'red' : 'green';
    render();
  });
  const screen = document.querySelector('.bz-screen');
  $('viz-play').onclick = () => {
    playing = !playing;
    $('viz-play').textContent = playing ? 'pause' : 'play';
    screen.classList.toggle('paused', !playing);
  };
  // A new day starts from an empty desktop.
  function newDay() {
    Object.keys(wins).forEach(quit);
    now = 0; hold = 0; seg = null; shown = null;
    render();
  }
  $('viz-restart').onclick = newDay;

  function frame(ts) {
    const dt = last ? Math.min(ts - last, 100) : 0;
    last = ts;
    if (playing) {
      // Idle stretches run faster: nothing happens on screen.
      if (now < TOTAL) now = Math.min(TOTAL, now + dt / MS_PER_MIN * (idle ? IDLE_SPEED : 1));
      else if ((hold += dt) > HOLD_MS) newDay();
      render();
      advance(apps[shown], dt);
    }
    requestAnimationFrame(frame);
  }
  // The popover arrow points at the switch, wherever the layout puts it.
  function aim() {
    const pop = document.querySelector('.bz-pop'), sw = $('bz-switch').getBoundingClientRect();
    pop.style.setProperty('--arrow-x', (sw.left + sw.width / 2 - pop.getBoundingClientRect().left) + 'px');
  }
  addEventListener('resize', aim);
  $('bz-dock').innerHTML = DOCK.map(app => app ? '<i class="' + (app === 'Finder' ? 'run' : '') + '" data-app="' + app + '"><img src="../icons/dock/' + app.toLowerCase() + '.png" alt=""></i>' : '<span class="sep"></span>').join('');
  $('bz-axis').innerHTML = [0, TOTAL / 2, TOTAL].map(m => '<span>' + hm(m) + '</span>').join('');
  render();
  aim();
  requestAnimationFrame(frame);
})();
