/* ============================
   SIDEBAR RUBIK'S CUBE
   ============================ */
function initRubikCube() {
  const canvas = document.getElementById('sb-cube-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(480, 480, false);
  renderer.setClearColor(0x0e0d10);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(5.5, 5.5, 5.5);
  camera.lookAt(0, 0, 0);

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const SC = { U:0xffffff, D:0xffd600, F:0xe53935, B:0x1565c0, L:0x43a047, R:0xef6c00 };
  const cubies = [];
  const stickerGeo = new THREE.BoxGeometry(0.8, 0.8, 0.045);
  // Marchio: PNG 256x128 incorporato, gia' ritagliato da icons/rubik.svg.
  // Non punto piu' al file perche' dava due problemi:
  //  - nell'SVG il marchio e' una fascia dentro un quadrato 600x600 quasi
  //    tutto bianco, e steso su un piano quadrato restava alto due pixel;
  //  - una texture presa da un file esterno sporca la canvas, e da file://
  //    WebGL la rifiuta ("tainted canvases may not be loaded"): aperto in
  //    locale, senza server, il logo non compariva affatto.
  // 256x128 e' potenza di due: la texture usa le mipmap e non sfarina quando
  // lo sticker e' piccolo e visto di taglio.
  const LOGO_PNG = 'data:image/png;base64,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';
  const logoGeo = new THREE.PlaneGeometry(0.72, 0.36);
  const bodyGeo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const logoTexture = new THREE.TextureLoader().load(LOGO_PNG);
  logoTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const logoMat = new THREE.MeshBasicMaterial({
    map: logoTexture,
    transparent: true,
    alphaTest: 0.04,
    toneMapped: false,
    side: THREE.DoubleSide
  });

  function createStickerMaterial(color) {
    return new THREE.MeshBasicMaterial({ color });
  }

  for (let gx = -1; gx <= 1; gx++) {
    for (let gy = -1; gy <= 1; gy++) {
      for (let gz = -1; gz <= 1; gz++) {
        const cubie = new THREE.Object3D();
        cubie.userData.gridPos = { x: gx, y: gy, z: gz };

        cubie.add(new THREE.Mesh(bodyGeo, bodyMat));

        const faceList = [];
        if (gy ===  1) faceList.push({ c: SC.U, ax: 'y', d:  1 });
        if (gy === -1) faceList.push({ c: SC.D, ax: 'y', d: -1 });
        if (gz ===  1) faceList.push({ c: SC.F, ax: 'z', d:  1 });
        if (gz === -1) faceList.push({ c: SC.B, ax: 'z', d: -1 });
        if (gx ===  1) faceList.push({ c: SC.R, ax: 'x', d:  1 });
        if (gx === -1) faceList.push({ c: SC.L, ax: 'x', d: -1 });

        for (const f of faceList) {
          const sm = createStickerMaterial(f.c);
          const s = new THREE.Mesh(stickerGeo, sm);
          s.renderOrder = 1;
          if (f.ax === 'y') {
            s.position.y = f.d * 0.48;
            s.rotation.x = f.d > 0 ? -Math.PI/2 : Math.PI/2;
          } else if (f.ax === 'z') {
            s.position.z = f.d * 0.48;
            if (f.d < 0) s.rotation.y = Math.PI;
          } else {
            s.position.x = f.d * 0.48;
            s.rotation.y = f.d > 0 ? Math.PI/2 : -Math.PI/2;
          }

          cubie.add(s);

          if (gx === 0 && gy === 1 && gz === 0 && f.ax === 'y' && f.d === 1) {
            const logo = new THREE.Mesh(logoGeo, logoMat);
            logo.position.y = 0.506;
            logo.rotation.x = -Math.PI / 2;
            logo.renderOrder = 2;
            cubie.add(logo);
          }
        }

        cubie.position.set(gx, gy, gz);
        cubeGroup.add(cubie);
        cubies.push(cubie);
      }
    }
  }

  const MOVE_DEFS = {
    "U":  { coord:'y', val: 1, axis:'y', dir:-1 },
    "U'": { coord:'y', val: 1, axis:'y', dir: 1 },
    "D":  { coord:'y', val:-1, axis:'y', dir: 1 },
    "D'": { coord:'y', val:-1, axis:'y', dir:-1 },
    "F":  { coord:'z', val: 1, axis:'z', dir:-1 },
    "F'": { coord:'z', val: 1, axis:'z', dir: 1 },
    "B":  { coord:'z', val:-1, axis:'z', dir: 1 },
    "B'": { coord:'z', val:-1, axis:'z', dir:-1 },
    "R":  { coord:'x', val: 1, axis:'x', dir:-1 },
    "R'": { coord:'x', val: 1, axis:'x', dir: 1 },
    "L":  { coord:'x', val:-1, axis:'x', dir: 1 },
    "L'": { coord:'x', val:-1, axis:'x', dir:-1 },
  };
  const INVERSE = {
    "U":"U'","U'":"U","D":"D'","D'":"D",
    "F":"F'","F'":"F","B":"B'","B'":"B",
    "R":"R'","R'":"R","L":"L'","L'":"L"
  };

  const SOLVE_TIME_FACTOR = 0.75;
  const SHUFFLE_TIME_FACTOR = 0.5;
  const MAX_SHUFFLE_MS = 3000;

  let isMoving = false, autoRotate = true, isDragging = false;
  let lastPX = 0, lastPY = 0;
  let state = 'idle', executedMoves = [], aborted = false;
  let timerInterval = null, solveStart = 0, shuffleTimeout = null, btnFadeTimeout = null;

  const btn = document.getElementById('sb-cube-btn');
  const lbl = document.getElementById('sb-cube-label');

  function snapMatrix(obj) {
    obj.updateMatrix();
    const e = obj.matrix.elements;
    for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
    obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  }

  function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function doMove(name, cb, dur) {
    const def = MOVE_DEFS[name];
    if (!def) { cb && cb(); return; }
    isMoving = true;
    const affected = cubies.filter(c => Math.round(c.userData.gridPos[def.coord]) === def.val);
    const pivot = new THREE.Object3D();
    cubeGroup.add(pivot);
    for (const c of affected) pivot.attach(c);
    const t0 = performance.now(), angle = def.dir * Math.PI / 2;
    dur = dur || 80;
    function frame(now) {
      const t = Math.min((now - t0) / dur, 1);
      pivot.rotation[def.axis] = angle * ease(t);
      if (t < 1) { requestAnimationFrame(frame); return; }
      pivot.rotation[def.axis] = angle;
      for (const c of affected) {
        cubeGroup.attach(c);
        c.position.x = Math.round(c.position.x);
        c.position.y = Math.round(c.position.y);
        c.position.z = Math.round(c.position.z);
        snapMatrix(c);
        c.userData.gridPos = { x: c.position.x, y: c.position.y, z: c.position.z };
      }
      cubeGroup.remove(pivot);
      isMoving = false;
      cb && cb();
    }
    requestAnimationFrame(frame);
  }

  function runMoves(moves, delayFn, onComplete, onAbort, durFn) {
    let i = 0;
    aborted = false;
    function next() {
      if (aborted) { onAbort && onAbort(); return; }
      if (i >= moves.length) { onComplete && onComplete(); return; }
      const moveIndex = i + 1;
      doMove(
        moves[i++],
        () => setTimeout(next, delayFn ? delayFn(moveIndex, moves.length) : 0),
        durFn ? durFn(moveIndex, moves.length) : undefined
      );
    }
    next();
  }

  const ALL_MOVES = Object.keys(MOVE_DEFS);
  function randomMove() {
    return ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
  }

  function shuffleDur() {
    return 80 * SHUFFLE_TIME_FACTOR;
  }

  function shuffleLoop() {
    if (aborted) {
      if (shuffleTimeout) { clearTimeout(shuffleTimeout); shuffleTimeout = null; }
      state = 'shuffled'; lbl.textContent = ''; syncBtn();
      return;
    }
    const move = randomMove();
    executedMoves.push(move);
    doMove(move, () => setTimeout(shuffleLoop, 0), shuffleDur());
  }

  function solveDelay(moveIndex, totalMoves) {
    const progress = moveIndex / totalMoves;
    const openingPause = moveIndex <= 2 ? 70 + Math.random() * 80 : 0;
    const latePause = progress > 0.78 ? 40 + Math.random() * 70 : 0;
    const r = Math.random();
    if (r < 0.05) return (1200 + Math.random() * 700 + openingPause) * SOLVE_TIME_FACTOR; // lunga riflessione
    if (r < 0.24) return (280  + Math.random() * 220 + openingPause + latePause) * SOLVE_TIME_FACTOR; // esitazione
    return (100 + Math.random() * 50 + openingPause * 0.4) * SOLVE_TIME_FACTOR; // mossa fluida ma umana
  }
  function solveDur(moveIndex, totalMoves) {
    const settle = moveIndex / totalMoves > 0.82 ? 10 : 0;
    return (135 + Math.random() * 45 + settle) * SOLVE_TIME_FACTOR;
  }

  function setCubeButton(label, disabled) {
    btn.disabled = disabled;
    if (btn.dataset.label === label) return;
    if (btnFadeTimeout) clearTimeout(btnFadeTimeout);
    btn.classList.add('is-fading');
    btnFadeTimeout = setTimeout(() => {
      btn.textContent = label;
      btn.dataset.label = label;
      btn.classList.remove('is-fading');
      btnFadeTimeout = null;
    }, 90);
  }

  function syncBtn() {
    if (state === 'idle')           { setCubeButton('shuffle', false); }
    else if (state === 'shuffling') { setCubeButton('stop', false); }
    else if (state === 'shuffled')  { setCubeButton('solve', false); }
    else if (state === 'solving')   { setCubeButton('solving\u2026', true); }
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function resetCubies() {
    let idx = 0;
    for (let gx = -1; gx <= 1; gx++) {
      for (let gy = -1; gy <= 1; gy++) {
        for (let gz = -1; gz <= 1; gz++) {
          const c = cubies[idx++];
          if (c.parent !== cubeGroup) cubeGroup.attach(c);
          c.position.set(gx, gy, gz);
          c.quaternion.set(0, 0, 0, 1);
          c.userData.gridPos = { x: gx, y: gy, z: gz };
        }
      }
    }
  }

  btn.onclick = function() {
    if (state === 'idle') {
      stopTimer();
      lbl.textContent = '';
      executedMoves = [];
      aborted = false;
      state = 'shuffling'; syncBtn();
      shuffleTimeout = setTimeout(() => { aborted = true; }, MAX_SHUFFLE_MS);
      shuffleLoop();
    } else if (state === 'shuffling') {
      aborted = true; // shuffleLoop checks this after current move and transitions to 'shuffled'
    } else if (state === 'shuffled') {
      state = 'solving'; syncBtn();
      solveStart = performance.now();
      timerInterval = setInterval(() => {
        lbl.textContent = ((performance.now() - solveStart) / 1000).toFixed(1) + 's';
      }, 100);
      const sol = executedMoves.slice().reverse().map(m => INVERSE[m]);
      runMoves(sol, solveDelay,
        () => {
          stopTimer();
          lbl.textContent = ((performance.now() - solveStart) / 1000).toFixed(2) + 's';
          state = 'idle'; syncBtn();
        },
        null,
        solveDur
      );
    }
  };

  canvas.addEventListener('pointerdown', e => {
    isDragging = true; autoRotate = false;
    lastPX = e.clientX; lastPY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return;
    cubeGroup.rotation.y += (e.clientX - lastPX) * 0.012;
    cubeGroup.rotation.x += (e.clientY - lastPY) * 0.012;
    lastPX = e.clientX; lastPY = e.clientY;
  });
  canvas.addEventListener('pointerup', () => { isDragging = false; autoRotate = true; });
  canvas.addEventListener('pointercancel', () => { isDragging = false; autoRotate = true; });

  (function render() {
    requestAnimationFrame(render);
    if (autoRotate && !isMoving) cubeGroup.rotation.y += 0.004;
    renderer.render(scene, camera);
  })();

  syncBtn();
}

window.initRubikCube = initRubikCube;
// puo' essere caricato dinamicamente da cube-loader.js, cioe' a DOM gia' pronto
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRubikCube);
else initRubikCube();
