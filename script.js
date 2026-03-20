// ========== SHARED TYPING UTILITY ==========
const TypingUtil = {
  getHumanDelay() {
    const baseDelay = Math.floor(Math.random() * 81) + 40;
    return Math.random() < 0.1 ? Math.floor(Math.random() * 101) + 300 : baseDelay;
  },

  createCursor(parent) {
    const cursor = document.createElement('span');
    cursor.textContent = '█';
    cursor.style.color = '#ffffff';
    parent.appendChild(cursor);

    /*let visible = true;
    const interval = setInterval(() => {
      cursor.style.opacity = visible ? '1' : '0';
      visible = !visible;
    }, 400);*/

    return { cursor, interval:null };
  },

  typeText(element, text, onComplete, withCursor = true) {
    element.textContent = '';
    let charIndex = 0;
    let cursorData = null;

    if (withCursor) {
      cursorData = this.createCursor(element);
    }

    const typeChar = () => {
      if (charIndex < text.length) {
        const textNode = document.createTextNode(text[charIndex]);
        if (withCursor) {
          element.insertBefore(textNode, cursorData.cursor);
        } else {
          element.appendChild(textNode);
        }
        charIndex++;
        setTimeout(typeChar, this.getHumanDelay());
      } else {
        if (withCursor) {
          clearInterval(cursorData.interval);
          cursorData.cursor.remove();
        }
        if (onComplete) onComplete();
      }
    };

    typeChar();
  },

  deleteText(element, onComplete) {
    const cursor = element.querySelector('span');
    const textNodes = Array.from(element.childNodes).filter(n => n.nodeType === 3);
    let charIndex = textNodes.length - 1;

    const deleteChar = () => {
      if (charIndex >= 0) {
        textNodes[charIndex].remove();
        charIndex--;
        setTimeout(deleteChar, Math.floor(Math.random() * 31) + 20);
      } else {
        if (onComplete) onComplete();
      }
    };

    deleteChar();
  }
};

// ========== INTRO OVERLAY + BOOT SEQUENCE ==========
(function() {
  const overlay = document.getElementById('intro-overlay');
  const introText = document.getElementById('intro-text');
  const container = document.querySelector('.container');
  const bootSequence = document.getElementById('boot-sequence');
  const message = 'click to meet me...';

  // Skip if already seen
  if (sessionStorage.getItem('introSeen')) {
    overlay.remove();
    bootSequence.remove();
    container.classList.add('visible');
    document.querySelectorAll('[data-boot]').forEach(el => el.classList.add('revealed'));
    return;
  }

  // Type intro message
  let i = 0;
  function type() {
    if (i < message.length) {
      introText.textContent += message[i++];
      setTimeout(type, 25 + Math.random() * 100);
    }
  }
  setTimeout(type, 800);

  // Boot sequence
  function runBootSequence() {
    const bootLine1 = document.getElementById('boot-line-1');
    const bootLine2 = document.getElementById('boot-line-2');

    // Timeline
    const timeline = [
      { time: 0, action: () => {
        overlay.classList.add('fade-out');
        bootSequence.classList.add('active');
      }},
      { time: 50, action: () => {
        bootLine1.textContent = '> BOOTING SYSTEM...';
        bootLine1.classList.add('visible');
      }},
      { time: 950, action: () => {
        bootLine2.textContent = '> LOADING PROFILE...';
        bootLine2.classList.add('visible');
      }},
      { time: 1500, action: () => {
        bootSequence.classList.remove('active');
        container.classList.add('visible');
        document.querySelector('[data-boot="photo"]').classList.add('revealed');
      }},
      { time: 1700, action: () => {
        document.querySelector('[data-boot="name"]').classList.add('revealed');
      }},
      { time: 1800, action: () => {
        document.querySelector('[data-boot="born"]').classList.add('revealed');
      }},
      { time: 2300, action: () => {
        document.querySelector('[data-boot="age"]').classList.add('revealed');
      }},
      { time: 1900, action: () => {
        document.querySelector('[data-boot="code"]').classList.add('revealed');
      }},
      { time: 1900, action: () => {
        document.querySelector('[data-boot="pseudocode"]').classList.add('revealed');
      }},
      { time: 8100, action: () => {
        // Reveal everything else
        document.querySelectorAll('[data-boot]:not(.revealed)').forEach(el => {
          el.classList.add('revealed');
        });
        // Cleanup
        setTimeout(() => {
          overlay.remove();
          bootSequence.remove();
        }, 1500);
      }}
    ];

    timeline.forEach(({ time, action }) => setTimeout(action, time));
  }

  function dismissOverlay() {
    sessionStorage.setItem('introSeen', 'true');
    runBootSequence();
  }

  overlay.onclick = dismissOverlay;
  overlay.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismissOverlay();
    }
  };
})();

// ========== AGE CLOCK ==========
function updateAge() {
  const birthDate = new Date(2003, 0, 9, 15, 45, 0);
  const now = new Date();

  let years = now.getFullYear() - birthDate.getFullYear();
  let months = now.getMonth() - birthDate.getMonth();
  let days = now.getDate() - birthDate.getDate();
  let hours = now.getHours() - birthDate.getHours();
  let minutes = now.getMinutes() - birthDate.getMinutes();
  let seconds = now.getSeconds() - birthDate.getSeconds();

  if (seconds < 0) { seconds += 60; minutes--; }
  if (minutes < 0) { minutes += 60; hours--; }
  if (hours < 0) { hours += 24; days--; }
  if (days < 0) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }
  if (months < 0) { months += 12; years--; }

  const parts = [];
  if (years > 0) parts.push(years + (years === 1 ? 'year' : 'years'));
  if (months > 0) parts.push(months + (months === 1 ? 'month' : 'months'));
  if (days > 0) parts.push(days + (days === 1 ? 'day' : 'days'));
  if (hours > 0) parts.push(hours + (hours === 1 ? 'hour' : 'hours'));
  if (minutes > 0) parts.push(minutes + (minutes === 1 ? 'minute' : 'minutes'));
  
  const ageText = parts.join(' ') + ' ' + seconds + 's';
  document.getElementById('age-clock').textContent = ageText;
}

updateAge();
const ageInterval = setInterval(updateAge, 1000);

// Cleanup on page unload
window.addEventListener('beforeunload', () => clearInterval(ageInterval));

// ========== PROJECT NAMES TYPING ==========
(function() {
  const projectNames = document.querySelectorAll('.nav-list .project-name');

  function typeProjectName(element, text, startDelay) {
    return new Promise((resolve) => {
      setTimeout(() => {
        TypingUtil.typeText(element, text, resolve, true);
      }, startDelay);
    });
  }

  async function typeAllProjects() {
    let initialDelay = 150;
    for (let i = 0; i < projectNames.length; i++) {
      const projectName = projectNames[i];
      const text = projectName.dataset.originalText || projectName.textContent;
      if (!projectName.dataset.originalText) {
        projectName.dataset.originalText = text;
      }
      await typeProjectName(projectName, text, initialDelay);
      initialDelay = 450;
    }
    await new Promise(resolve => setTimeout(resolve, 45000));
    typeAllProjects();
  }
  function startTyping() {
    if (document.querySelector('.container.visible')) {
      setTimeout(() => {
        if (projectNames.length > 0) typeAllProjects();
      }, 8000);
    } else {
      // Check again in 100ms
      setTimeout(startTyping, 100);
    }
  }

  startTyping();
})();

// ========== INTEREST LIST TYPING ==========
(function() {
  const interestList = document.querySelectorAll('.interest-list li');
  const words = Array.from(interestList).map(li => li.textContent);
  let currentIndex = 0;

  function getRandomDelay() {
    return Math.floor(Math.random() * 1000) + 1000;
  }

  function typeWord(element, word) {
    return new Promise((resolve) => {
      element.textContent = '';
      element.classList.add('active');
      
      const cursorData = TypingUtil.createCursor(element);
      let charIndex = 0;

      function typeChar() {
        if (charIndex < word.length) {
          const textNode = document.createTextNode(word[charIndex]);
          element.insertBefore(textNode, cursorData.cursor);
          charIndex++;
          setTimeout(typeChar, TypingUtil.getHumanDelay());
        } else {
          setTimeout(() => {
            deleteChars();
          }, getRandomDelay());
        }
      }

      function deleteChars() {
        const textNodes = Array.from(element.childNodes).filter(n => n.nodeType === 3);
        let i = textNodes.length - 1;
        
        function del() {
          if (i >= 0) {
            textNodes[i].remove();
            i--;
            setTimeout(del, Math.floor(Math.random() * 31) + 20);
          } else {
            clearInterval(cursorData.interval);
            cursorData.cursor.remove();
            element.classList.remove('active');
            resolve();
          }
        }
        del();
      }

      typeChar();
    });
  }

  async function cycleWords() {
    while (true) {
      await typeWord(interestList[currentIndex], words[currentIndex]);
      currentIndex = (currentIndex + 1) % words.length;
      await new Promise(resolve => setTimeout(resolve, 900));
    }
  }

  function startTyping() {
    if (document.querySelector('.container.visible')) {
      cycleWords();
    } else {
      setTimeout(startTyping, 100);
    }
  }

  if (interestList.length > 0) {
    startTyping();
}
})();

(function() {
  const CDN = 'https://cdn.jsdelivr.net/npm/tech-stack-icons@latest/icons/';
  const DEV = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/';

  const badges = [
    { label: 'Claude',     cls: 'tb-claude',   src: CDN + 'claude.svg' },
    { label: 'C',          cls: 'tb-c',         src: DEV + 'c/c-original.svg' },
    { label: 'Python',     cls: 'tb-python',    src: CDN + 'python.svg' },
    { label: 'HTML',       cls: 'tb-html',      src: CDN + 'html5.svg' },
    { label: 'CSS',        cls: 'tb-css',       src: CDN + 'css3.svg' },
    { label: 'JavaScript', cls: 'tb-js',        src: CDN + 'js.svg' },
    { label: 'ChatGPT',    cls: 'tb-chatgpt',   src: CDN + 'openai.svg' },
    { label: 'Cursor',     cls: 'tb-cursor',    src: 'icons/cursor.svg' },
    { label: 'Gemini',     cls: 'tb-gemini',    src: CDN + 'gemini.svg' },
    { label: 'Ollama',     cls: 'tb-ollama',    src: CDN + 'ollama.svg' },
    { label: 'DeepSeek',   cls: 'tb-deepseek',  src: CDN + 'deepseek.svg' },
    { label: 'GitHub',     cls: 'tb-github',    src: CDN + 'github.svg' },
  ];

  const track = document.getElementById('tech-track');
  if (!track) return;

  [...badges, ...badges].forEach(b => {
    const el = document.createElement('div');
    el.className = 'tech-badge ' + b.cls;
    const img = document.createElement('img');
    img.src = b.src;
    img.alt = b.label;
    const span = document.createElement('span');
    span.textContent = b.label;
    el.appendChild(img);
    el.appendChild(span);
    track.appendChild(el);
  });
})();

(function() {
  const DEV   = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/';
  const LOCAL = 'icons/';

  const items = [
    { label: 'Claude',     src: LOCAL + 'claude.svg' },
    { label: 'C',          src: DEV   + 'c/c-original.svg' },
    { label: 'Python',     src: DEV   + 'python/python-original.svg' },
    { label: 'HTML',       src: DEV   + 'html5/html5-original.svg' },
    { label: 'CSS',        src: DEV   + 'css3/css3-original.svg' },
    { label: 'JavaScript', src: DEV   + 'javascript/javascript-original.svg' },
    { label: 'GitHub',     src: DEV   + 'github/github-original.svg' },
    { label: 'Go',         src: DEV   + 'go/go-original.svg' },
    { label: 'Figma',      src: DEV   + 'figma/figma-original.svg' },
    { label: 'Java',       src: DEV   + 'java/java-original.svg' },
    { label: 'Neovim',     src: DEV   + 'neovim/neovim-original.svg' },
    { label: 'ChatGPT',    src: LOCAL + 'openai.svg' },
    { label: 'Cursor',     src: LOCAL + 'cursor.svg' },
    { label: 'Gemini',     src: LOCAL + 'gemini.svg' },
    { label: 'Ollama',     src: LOCAL + 'ollama.svg' },
    { label: 'DeepSeek',   src: LOCAL + 'deepseek.svg' },
  ];

  const grid = document.getElementById('tech-grid');
  if (!grid) return;

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tech-grid-item';
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.label;
    img.onerror = () => { img.style.opacity = '0.15'; };
    const span = document.createElement('span');
    span.textContent = item.label;
    el.appendChild(img);
    el.appendChild(span);
    grid.appendChild(el);
  });
})();
