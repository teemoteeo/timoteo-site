// ============================
// RUBIK'S CUBE ENGINE
// ============================
(function() {
  const canvas = document.getElementById('rubik-canvas');
  const ctx = canvas.getContext('2d');
  const W = 680, H = 680;
  canvas.width = W; canvas.height = H;

  // Face colors (dark luxury palette)
  const COLORS = {
    U: '#f0ecdd', // white/cream
    D: '#d4a84b', // gold
    F: '#e06c75', // red
    B: '#5b9cf6', // blue
    L: '#c8f06e', // green/accent
    R: '#e5954a', // orange
    X: '#1f1e23'  // inside
  };

  // Cube state: 6 faces × 9 stickers
  // Faces: 0=U 1=D 2=F 3=B 4=L 5=R
  let cube;
  let isAnimating = false;
  let moveQueue = [];
  let status = document.getElementById('rubik-status');
  let btnShuffle = document.getElementById('btn-shuffle');
  let btnSolve = document.getElementById('btn-solve');

  function initCube() {
    cube = [
      Array(9).fill('U'), // 0 up
      Array(9).fill('D'), // 1 down
      Array(9).fill('F'), // 2 front
      Array(9).fill('B'), // 3 back
      Array(9).fill('L'), // 4 left
      Array(9).fill('R'), // 5 right
    ];
  }

  // Isometric projection
  const ISO = {
    cx: W / 2,
    cy: H / 2 - 10,
    s: 70, // sticker size
    gap: 3,
  };

  // Draw a parallelogram sticker
  function drawSticker(ctx, pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Iso transform
  function iso(xi, yi, zi) {
    const s = ISO.s;
    const x = ISO.cx + (xi - zi) * s * 0.866;
    const y = ISO.cy + (xi + zi) * s * 0.5 - yi * s;
    return [x, y];
  }

  function renderCube() {
    ctx.clearRect(0, 0, W, H);
    const g = ISO.gap / ISO.s;

    // Draw top face (U = face 0)
    // sticker layout: row-major, [0][1][2] top row, [3][4][5] mid, [6][7][8] bottom
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const xi = col;
        const yi = 3;
        const zi = 2 - row;
        const tl = iso(xi + g,     yi, zi + 1 - g);
        const tr = iso(xi + 1 - g, yi, zi + 1 - g);
        const br = iso(xi + 1 - g, yi, zi + g);
        const bl = iso(xi + g,     yi, zi + g);
        const idx = row * 3 + col;
        drawSticker(ctx, [tl, tr, br, bl], COLORS[cube[0][idx]]);
      }
    }

    // Draw front face (F = face 2)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const xi = col;
        const yi = 2 - row;
        const zi = 3;
        const tl = iso(xi + g,     yi + 1 - g, zi);
        const tr = iso(xi + 1 - g, yi + 1 - g, zi);
        const br = iso(xi + 1 - g, yi + g,     zi);
        const bl = iso(xi + g,     yi + g,     zi);
        const idx = row * 3 + col;
        drawSticker(ctx, [tl, tr, br, bl], COLORS[cube[2][idx]]);
      }
    }

    // Draw right face (R = face 5)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const xi = 3;
        const yi = 2 - row;
        const zi = 2 - col;
        const tl = iso(xi, yi + 1 - g, zi + 1 - g);
        const tr = iso(xi, yi + 1 - g, zi + g);
        const br = iso(xi, yi + g,     zi + g);
        const bl = iso(xi, yi + g,     zi + 1 - g);
        const idx = row * 3 + col;
        drawSticker(ctx, [tl, tr, br, bl], COLORS[cube[5][idx]]);
      }
    }
  }

  // Rotate a face array 90° clockwise
  function rotateFaceCW(f) {
    return [f[6],f[3],f[0], f[7],f[4],f[1], f[8],f[5],f[2]];
  }
  function rotateFaceCCW(f) {
    return [f[2],f[5],f[8], f[1],f[4],f[7], f[0],f[3],f[6]];
  }

  // Apply a move to the cube state
  function applyMove(c, move) {
    let n = JSON.parse(JSON.stringify(c));
    switch(move) {
      case 'U':  return moveU(n, false);
      case 'U_': return moveU(n, true);
      case 'D':  return moveD(n, false);
      case 'D_': return moveD(n, true);
      case 'F':  return moveF(n, false);
      case 'F_': return moveF(n, true);
      case 'R':  return moveR(n, false);
      case 'R_': return moveR(n, true);
      case 'L':  return moveL(n, false);
      case 'L_': return moveL(n, true);
      case 'B':  return moveB(n, false);
      case 'B_': return moveB(n, true);
      default: return n;
    }
  }

  function moveU(n, ccw) {
    if (!ccw) {
      n[0] = rotateFaceCW(n[0]);
      const tmp = [n[2][0],n[2][1],n[2][2]];
      [n[2][0],n[2][1],n[2][2]] = [n[5][0],n[5][1],n[5][2]];
      [n[5][0],n[5][1],n[5][2]] = [n[3][0],n[3][1],n[3][2]];
      [n[3][0],n[3][1],n[3][2]] = [n[4][0],n[4][1],n[4][2]];
      [n[4][0],n[4][1],n[4][2]] = tmp;
    } else {
      n[0] = rotateFaceCCW(n[0]);
      const tmp = [n[2][0],n[2][1],n[2][2]];
      [n[2][0],n[2][1],n[2][2]] = [n[4][0],n[4][1],n[4][2]];
      [n[4][0],n[4][1],n[4][2]] = [n[3][0],n[3][1],n[3][2]];
      [n[3][0],n[3][1],n[3][2]] = [n[5][0],n[5][1],n[5][2]];
      [n[5][0],n[5][1],n[5][2]] = tmp;
    }
    return n;
  }

  function moveD(n, ccw) {
    if (!ccw) {
      n[1] = rotateFaceCW(n[1]);
      const tmp = [n[2][6],n[2][7],n[2][8]];
      [n[2][6],n[2][7],n[2][8]] = [n[4][6],n[4][7],n[4][8]];
      [n[4][6],n[4][7],n[4][8]] = [n[3][6],n[3][7],n[3][8]];
      [n[3][6],n[3][7],n[3][8]] = [n[5][6],n[5][7],n[5][8]];
      [n[5][6],n[5][7],n[5][8]] = tmp;
    } else {
      n[1] = rotateFaceCCW(n[1]);
      const tmp = [n[2][6],n[2][7],n[2][8]];
      [n[2][6],n[2][7],n[2][8]] = [n[5][6],n[5][7],n[5][8]];
      [n[5][6],n[5][7],n[5][8]] = [n[3][6],n[3][7],n[3][8]];
      [n[3][6],n[3][7],n[3][8]] = [n[4][6],n[4][7],n[4][8]];
      [n[4][6],n[4][7],n[4][8]] = tmp;
    }
    return n;
  }

  function moveF(n, ccw) {
    if (!ccw) {
      n[2] = rotateFaceCW(n[2]);
      const tmp = [n[0][6],n[0][7],n[0][8]];
      [n[0][6],n[0][7],n[0][8]] = [n[4][8],n[4][5],n[4][2]];
      [n[4][8],n[4][5],n[4][2]] = [n[1][2],n[1][1],n[1][0]];
      [n[1][2],n[1][1],n[1][0]] = [n[5][0],n[5][3],n[5][6]];
      [n[5][0],n[5][3],n[5][6]] = tmp;
    } else {
      n[2] = rotateFaceCCW(n[2]);
      const tmp = [n[0][6],n[0][7],n[0][8]];
      [n[0][6],n[0][7],n[0][8]] = [n[5][0],n[5][3],n[5][6]];
      [n[5][0],n[5][3],n[5][6]] = [n[1][2],n[1][1],n[1][0]];
      [n[1][2],n[1][1],n[1][0]] = [n[4][8],n[4][5],n[4][2]];
      [n[4][8],n[4][5],n[4][2]] = tmp;
    }
    return n;
  }

  function moveR(n, ccw) {
    if (!ccw) {
      n[5] = rotateFaceCW(n[5]);
      const tmp = [n[0][2],n[0][5],n[0][8]];
      [n[0][2],n[0][5],n[0][8]] = [n[2][2],n[2][5],n[2][8]];
      [n[2][2],n[2][5],n[2][8]] = [n[1][2],n[1][5],n[1][8]];
      [n[1][2],n[1][5],n[1][8]] = [n[3][6],n[3][3],n[3][0]];
      [n[3][6],n[3][3],n[3][0]] = tmp;
    } else {
      n[5] = rotateFaceCCW(n[5]);
      const tmp = [n[0][2],n[0][5],n[0][8]];
      [n[0][2],n[0][5],n[0][8]] = [n[3][6],n[3][3],n[3][0]];
      [n[3][6],n[3][3],n[3][0]] = [n[1][2],n[1][5],n[1][8]];
      [n[1][2],n[1][5],n[1][8]] = [n[2][2],n[2][5],n[2][8]];
      [n[2][2],n[2][5],n[2][8]] = tmp;
    }
    return n;
  }

  function moveL(n, ccw) {
    if (!ccw) {
      n[4] = rotateFaceCW(n[4]);
      const tmp = [n[0][0],n[0][3],n[0][6]];
      [n[0][0],n[0][3],n[0][6]] = [n[3][8],n[3][5],n[3][2]];
      [n[3][8],n[3][5],n[3][2]] = [n[1][0],n[1][3],n[1][6]];
      [n[1][0],n[1][3],n[1][6]] = [n[2][0],n[2][3],n[2][6]];
      [n[2][0],n[2][3],n[2][6]] = tmp;
    } else {
      n[4] = rotateFaceCCW(n[4]);
      const tmp = [n[0][0],n[0][3],n[0][6]];
      [n[0][0],n[0][3],n[0][6]] = [n[2][0],n[2][3],n[2][6]];
      [n[2][0],n[2][3],n[2][6]] = [n[1][0],n[1][3],n[1][6]];
      [n[1][0],n[1][3],n[1][6]] = [n[3][8],n[3][5],n[3][2]];
      [n[3][8],n[3][5],n[3][2]] = tmp;
    }
    return n;
  }

  function moveB(n, ccw) {
    if (!ccw) {
      n[3] = rotateFaceCW(n[3]);
      const tmp = [n[0][0],n[0][1],n[0][2]];
      [n[0][0],n[0][1],n[0][2]] = [n[5][2],n[5][5],n[5][8]];
      [n[5][2],n[5][5],n[5][8]] = [n[1][8],n[1][7],n[1][6]];
      [n[1][8],n[1][7],n[1][6]] = [n[4][0],n[4][3],n[4][6]];
      [n[4][0],n[4][3],n[4][6]] = tmp;
    } else {
      n[3] = rotateFaceCCW(n[3]);
      const tmp = [n[0][0],n[0][1],n[0][2]];
      [n[0][0],n[0][1],n[0][2]] = [n[4][0],n[4][3],n[4][6]];
      [n[4][0],n[4][3],n[4][6]] = [n[1][8],n[1][7],n[1][6]];
      [n[1][8],n[1][7],n[1][6]] = [n[5][2],n[5][5],n[5][8]];
      [n[5][2],n[5][5],n[5][8]] = tmp;
    }
    return n;
  }

  // Generate solve sequence (reverse of shuffle)
  let shuffleMoves = [];

  const ALL_MOVES = ['U','U_','D','D_','F','F_','R','R_','L','L_','B','B_'];
  const INVERSES = { U:'U_', U_:'U', D:'D_', D_:'D', F:'F_', F_:'F', R:'R_', R_:'R', L:'L_', L_:'L', B:'B_', B_:'B' };

  function shuffleCube() {
    if (isAnimating) return;
    initCube();
    shuffleMoves = [];
    const n = 20;
    for (let i = 0; i < n; i++) {
      const m = ALL_MOVES[Math.floor(Math.random() * ALL_MOVES.length)];
      shuffleMoves.push(m);
      cube = applyMove(cube, m);
    }
    renderCube();
    btnSolve.disabled = false;
    setStatus('shuffled · ' + n + ' moves');
  }

  const SOLVE_TIME_FACTOR = 0.75;

  // Human-like timing: random pauses simulating thinking
  function humanDelay(moveIndex, total) {
    const base = 180 + Math.random() * 140;
    const thinkChance = Math.random();
    if (thinkChance < 0.08) return (base + 800 + Math.random() * 1200) * SOLVE_TIME_FACTOR; // long pause
    if (thinkChance < 0.22) return (base + 300 + Math.random() * 400) * SOLVE_TIME_FACTOR;  // short pause
    return base * SOLVE_TIME_FACTOR;
  }

  function solveCube() {
    if (isAnimating || shuffleMoves.length === 0) return;
    isAnimating = true;
    btnShuffle.disabled = true;
    btnSolve.disabled = true;

    const solveMoves = shuffleMoves.slice().reverse().map(m => INVERSES[m]);
    let i = 0;

    function step() {
      if (i >= solveMoves.length) {
        isAnimating = false;
        btnShuffle.disabled = false;
        shuffleMoves = [];
        setStatus('solved ✓');
        setTimeout(() => setStatus(''), 3000);
        return;
      }
      const move = solveMoves[i++];
      cube = applyMove(cube, move);
      renderCube();
      const pct = Math.floor((i / solveMoves.length) * 100);
      setStatus('solving... ' + pct + '%');
      setTimeout(step, humanDelay(i, solveMoves.length));
    }
    step();
  }

  function setStatus(s) { status.textContent = s; }

  window.initRubik = function() {
    initCube();
    shuffleMoves = [];
    btnSolve.disabled = true;
    btnShuffle.disabled = false;
    setStatus('konami code activated');
    renderCube();
  };

  btnShuffle.onclick = shuffleCube;
  btnSolve.onclick = solveCube;
})();
