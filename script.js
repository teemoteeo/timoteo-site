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
      setTimeout(type, 75 + Math.random() * 100);
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
      { time: 800, action: () => {
        bootLine1.textContent = '> BOOTING SYSTEM...';
        bootLine1.classList.add('visible');
      }},
      { time: 1600, action: () => {
        bootLine2.textContent = '> LOADING PROFILE...';
        bootLine2.classList.add('visible');
      }},
      { time: 2300, action: () => {
        bootSequence.classList.remove('active');
        container.classList.add('visible');
        document.querySelector('[data-boot="photo"]').classList.add('revealed');
      }},
      { time: 2500, action: () => {
        document.querySelector('[data-boot="name"]').classList.add('revealed');
      }},
      { time: 2800, action: () => {
        document.querySelector('[data-boot="born"]').classList.add('revealed');
      }},
      { time: 2800, action: () => {
        document.querySelector('[data-boot="age"]').classList.add('revealed');
      }},
      { time: 2700, action: () => {
        document.querySelector('[data-boot="code"]').classList.add('revealed');
      }},
      { time: 2700, action: () => {
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

  if (interestList.length > 0) {
    cycleWords();
  }
})();
