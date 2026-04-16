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
  const logoGeo = new THREE.PlaneGeometry(0.4, 0.4);
  const bodyGeo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const logoTexture = new THREE.TextureLoader().load('rubik-cube-icon.svg');
  logoTexture.encoding = THREE.sRGBEncoding;
  logoTexture.minFilter = THREE.LinearFilter;
  logoTexture.magFilter = THREE.LinearFilter;
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

document.addEventListener('DOMContentLoaded', initRubikCube);
