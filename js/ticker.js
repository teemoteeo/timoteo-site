// ============================
// TICKER
// ============================
(function() {
  const items = document.querySelectorAll('.interest-list li');
  const words = Array.from(items).map(li => li.textContent);
  let idx = 0;

  function getDelay() { return Math.floor(Math.random() * 1000) + 1200; }

  function typeWord(el, word) {
    return new Promise(resolve => {
      el.textContent = ''; el.classList.add('active');
      let ci = 0;
      const cur = document.createElement('span');
      cur.textContent = '█'; cur.style.color = 'var(--teal)';
      el.appendChild(cur);
      function addChar() {
        if (ci < word.length) {
          el.insertBefore(document.createTextNode(word[ci++]), cur);
          setTimeout(addChar, 30 + Math.random() * 80);
        } else { setTimeout(delChars, getDelay()); }
      }
      function delChars() {
        const nodes = Array.from(el.childNodes).filter(n => n.nodeType === 3);
        let i = nodes.length - 1;
        function del() {
          if (i >= 0) { nodes[i--].remove(); setTimeout(del, 15 + Math.random() * 25); }
          else { cur.remove(); el.classList.remove('active'); resolve(); }
        }
        del();
      }
      addChar();
    });
  }

  async function cycle() {
    while (true) {
      await typeWord(items[idx], words[idx]);
      idx = (idx + 1) % words.length;
      await new Promise(r => setTimeout(r, 600));
    }
  }

  function waitAndStart() {
    if (document.querySelector('.container.visible')) cycle();
    else setTimeout(waitAndStart, 100);
  }
  waitAndStart();
})();

// ============================
// PROJECT NAME TYPING
// ============================
(function() {
  const names = document.querySelectorAll('.nav-list .project-name');

  function typeEl(el, text, delay) {
    return new Promise(resolve => {
      setTimeout(() => {
        el.textContent = '';
        let i = 0;
        const cur = document.createElement('span');
        cur.textContent = '█'; cur.style.opacity = '0.5';
        el.appendChild(cur);
        function addChar() {
          if (i < text.length) {
            el.insertBefore(document.createTextNode(text[i++]), cur);
            setTimeout(addChar, 40 + Math.random() * 90);
          } else { cur.remove(); resolve(); }
        }
        addChar();
      }, delay);
    });
  }

  async function loop() {
    let d = 200;
    for (const el of names) {
      const t = el.dataset.orig || (el.dataset.orig = el.textContent);
      await typeEl(el, t, d);
      d = 500;
    }
    await new Promise(r => setTimeout(r, 45000));
    loop();
  }

  function waitAndStart() {
    if (document.querySelector('.container.visible')) setTimeout(loop, 500);
    else setTimeout(waitAndStart, 100);
  }
  waitAndStart();
})();
