// ============================
// MAGIC 8-BALL — RESA 3D
// ============================
// Stessa tecnica del cubo in sidebar: three.js su canvas, caricato pigro.
// La finestrella e' un foro vero nella sfera, non un disco appoggiato sopra:
// il triangolo risale dentro la cavita' e a mezz'aria lo nasconde il guscio.
function initEightBall() {
  const api = window.__eightball;
  const canvas = document.getElementById('eb-canvas');
  if (!api || !canvas || !window.THREE) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) {
    return; // niente WebGL: resta la palla di riserva, che risponde in testo
  }
  renderer.setSize(560, 560, false);
  renderer.setClearColor(0x0e0d10);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 4.3);
  camera.lookAt(0, 0, 0);

  const R = 1;
  // Finestra piu' larga del giocattolo vero: a 236px di palla e' l'unico modo
  // perche' la risposta dentro il triangolo resti leggibile.
  const WIN = 0.56;
  const APERTURE = Math.asin(WIN);     // apertura del foro sul guscio
  const WIN_Z = Math.cos(APERTURE);
  // La faccia emerge dal fondo del liquido. Affondata deve stare tutta DENTRO
  // la sfera, non solo nascosta di fronte: durante il mezzo giro la palla si
  // vede di profilo e qualsiasi sporgenza esce dalla sagoma.
  const FACE_Z = 0.56, SUNK_Y = -0.54, SUNK_Z = 0.05;

  const ball = new THREE.Group();
  scene.add(ball);

  // ---- guscio: sfera con il polo forato, ruotato verso la camera ----
  const shellGeo = new THREE.SphereGeometry(R, 64, 48, 0, Math.PI * 2, APERTURE, Math.PI - APERTURE);
  shellGeo.rotateX(Math.PI / 2);
  ball.add(new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({
    color: 0x131219, roughness: 0.42, metalness: 0.12, side: THREE.FrontSide
  })));
  // La parete interna e' un mesh a parte, opaco: con lo stesso materiale
  // lucido del guscio le luci ci lasciavano sopra una pallina bianca.
  ball.add(new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({
    color: 0x0d1526, roughness: 1, metalness: 0, side: THREE.BackSide
  })));

  // ---- ghiera sul bordo del foro ----
  const bezel = new THREE.Mesh(
    new THREE.TorusGeometry(WIN, 0.026, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0x17161d, roughness: 0.75, metalness: 0.05 })
  );
  bezel.position.z = WIN_Z;
  ball.add(bezel);

  // ---- lato "8": e' questo che guarda la camera a riposo ----
  const CAP_R = 0.42;
  const capGeo = new THREE.SphereGeometry(1.004, 48, 20, 0, Math.PI * 2, 0, Math.asin(CAP_R));
  capGeo.rotateX(-Math.PI / 2);   // il polo della calotta guarda -Z
  // UV planari lungo l'asse della calotta: quelle sferiche, che si stringono
  // verso il polo, stirerebbero il numero. Cosi' l'8 sta SULLA curvatura,
  // senza il distacco che lascerebbe un disco piatto appoggiato sopra.
  const capPos = capGeo.attributes.position, capUv = capGeo.attributes.uv;
  for (let i = 0; i < capPos.count; i++) {
    capUv.setXY(i, 0.5 - capPos.getX(i) / (2 * CAP_R), 0.5 + capPos.getY(i) / (2 * CAP_R));
  }

  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = badgeCanvas.height = 256;
  const bctx = badgeCanvas.getContext('2d');
  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  badgeTex.minFilter = THREE.LinearFilter;
  badgeTex.magFilter = THREE.LinearFilter;

  function drawBadge() {
    bctx.fillStyle = '#f0ecdd';
    bctx.fillRect(0, 0, 256, 256);
    bctx.fillStyle = '#12111a';
    bctx.font = '600 176px "JetBrains Mono", monospace';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText('8', 128, 132);
    badgeTex.needsUpdate = true;
  }
  drawBadge();

  ball.add(new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
    map: badgeTex, roughness: 0.5, metalness: 0
  })));

  // ---- faccia dell'icosaedro: triangolo con il testo dentro ----
  const TEX = 512;
  const texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = TEX;
  const tctx = texCanvas.getContext('2d');
  const faceTex = new THREE.CanvasTexture(texCanvas);
  faceTex.minFilter = THREE.LinearFilter;
  faceTex.magFilter = THREE.LinearFilter;

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 3, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      map: faceTex,
      emissive: 0xffffff,
      emissiveMap: faceTex,
      emissiveIntensity: 0.34,
      roughness: 0.8,
      metalness: 0,
      transparent: true
    })
  );
  face.position.set(0, SUNK_Y, SUNK_Z);
  face.rotation.x = 0.6;
  ball.add(face);

  // ---- torbidita' del liquido ----
  const murk = new THREE.Mesh(
    new THREE.CircleGeometry(WIN * 0.995, 48),
    new THREE.MeshBasicMaterial({ color: 0x0b1424, transparent: true, opacity: 1, depthWrite: false })
  );
  murk.position.z = WIN_Z - 0.02;
  murk.renderOrder = 3;
  ball.add(murk);

  // ---- vetro: un velo di riflesso sopra la finestrella ----
  const glassCanvas = document.createElement('canvas');
  glassCanvas.width = glassCanvas.height = 256;
  const gctx = glassCanvas.getContext('2d');
  const glare = gctx.createRadialGradient(92, 78, 6, 104, 96, 96);
  glare.addColorStop(0, 'rgba(240,236,221,0.55)');
  glare.addColorStop(0.45, 'rgba(160,190,235,0.12)');
  glare.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = glare;
  gctx.fillRect(0, 0, 256, 256);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(WIN * 0.97, 48),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(glassCanvas),
      transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  glass.position.z = WIN_Z + 0.008;
  glass.renderOrder = 4;
  ball.add(glass);

  // ---- luci: chiave calda in alto a sinistra, resto solo per staccare dal fondo ----
  scene.add(new THREE.AmbientLight(0x3c3d4e, 0.5));
  const key = new THREE.DirectionalLight(0xf6f1e2, 1.3);
  key.position.set(-2.4, 3.0, 3.4);
  scene.add(key);
  // accento teal diffuso: una direzionale, a incidenza radente, lasciava sul
  // guscio lucido un puntino verde da LED
  scene.add(new THREE.HemisphereLight(0xc8f06e, 0x101018, 0.22));
  const fill = new THREE.DirectionalLight(0x5b9cf6, 0.3);
  fill.position.set(2.2, 0.5, 2.2);
  scene.add(fill);
  // in asse con la luce chiave: cosi' il riflesso sulla ghiera si fonde con
  // quello della sfera invece di leggersi come una pallina bianca a se'
  const cavity = new THREE.PointLight(0x86b4ff, 0.45, 3.4);
  cavity.position.set(-0.7, 0.9, 1.5);
  scene.add(cavity);

  // ============================
  // TESTO DENTRO IL TRIANGOLO
  // ============================
  // Le UV del triangolo coprono il quadrato circoscritto: questi sono i tre
  // vertici in pixel sulla texture, rientrati di poco per non toccare il bordo.
  const APEX_Y = 10, BASE_Y = 378, HALF_BASE = 216;

  function halfWidthAt(y) {
    if (y <= APEX_Y) return 0;
    if (y >= BASE_Y) return HALF_BASE;
    return (y - APEX_Y) / (BASE_Y - APEX_Y) * HALF_BASE;
  }

  // sotto il baricentro: piu' in basso il triangolo e' piu' largo, quindi il
  // testo ci sta piu' grande
  const CENTER_Y = 282;

  // Il testo va mandato a capo prima di iniziare a scriverlo: altrimenti a
  // meta' typewriter le righe si riflowano sotto gli occhi.
  function layout(text) {
    const words = text.split(' ');
    for (let size = 48; size >= 18; size -= 2) {
      tctx.font = '500 ' + size + 'px "JetBrains Mono", monospace';
      const lh = size * 1.14;
      for (let n = 1; n <= 4; n++) {
        const lines = [];
        let w = 0, ok = true;
        for (let k = 0; k < n; k++) {
          const y = CENTER_Y + (k - (n - 1) / 2) * lh;
          const maxW = halfWidthAt(y - size * 0.68) * 2 * 0.94;
          let line = '';
          while (w < words.length) {
            const next = line ? line + ' ' + words[w] : words[w];
            if (tctx.measureText(next).width > maxW && line) break;
            if (tctx.measureText(next).width > maxW && !line) { ok = false; break; }
            line = next; w++;
          }
          if (!ok || !line) { ok = false; break; }
          lines.push({ text: line, y: y, width: tctx.measureText(line).width });
        }
        if (ok && w >= words.length) return { size: size, lines: lines };
      }
    }
    return null;
  }

  function paintFace(box, revealed, cursor) {
    tctx.clearRect(0, 0, TEX, TEX);

    tctx.beginPath();
    tctx.moveTo(256, APEX_Y);
    tctx.lineTo(472, BASE_Y);
    tctx.lineTo(40, BASE_Y);
    tctx.closePath();

    const body = tctx.createLinearGradient(0, APEX_Y, 0, BASE_Y);
    body.addColorStop(0, '#2a3d5e');
    body.addColorStop(1, '#131d31');
    tctx.fillStyle = body;
    tctx.fill();
    tctx.lineJoin = 'round';
    tctx.strokeStyle = 'rgba(240,236,221,0.16)';
    tctx.lineWidth = 6;
    tctx.stroke();
    tctx.strokeStyle = 'rgba(91,156,246,0.30)';
    tctx.lineWidth = 2;
    tctx.stroke();

    if (!box) { faceTex.needsUpdate = true; return; }

    tctx.font = '500 ' + box.size + 'px "JetBrains Mono", monospace';
    tctx.textAlign = 'left';
    tctx.textBaseline = 'middle';
    tctx.shadowColor = 'rgba(126,172,255,0.5)';
    tctx.shadowBlur = 14;

    let seen = 0;
    for (let i = 0; i < box.lines.length; i++) {
      const line = box.lines[i];
      const take = Math.max(0, Math.min(line.text.length, revealed - seen));
      // Le righe stanno nella posizione finale anche mentre si scrivono:
      // partono da sinistra, non si ricentrano a ogni carattere.
      const x = 256 - line.width / 2;
      if (take > 0) {
        const shown = line.text.slice(0, take);
        tctx.fillStyle = '#f0ecdd';
        tctx.fillText(shown, x, line.y);
        if (cursor && take < line.text.length) {
          tctx.shadowBlur = 0;
          tctx.fillStyle = '#c8f06e';
          tctx.fillRect(x + tctx.measureText(shown).width + 2, line.y - box.size * 0.42, box.size * 0.5, box.size * 0.78);
          tctx.shadowBlur = 14;
        }
      }
      seen += line.text.length + 1; // +1: lo spazio sostituito dall'a capo
    }

    tctx.shadowBlur = 0;
    faceTex.needsUpdate = true;
  }

  paintFace(null, 0, false);

  // ============================
  // STATO + ANIMAZIONE
  // ============================
  const SHAKE_MS = 1150, TURN_MS = 640, RISE_MS = 520, SINK_MS = 560;
  const TYPE_MIN = 28, TYPE_JITTER = 45;

  const EIGHT = Math.PI;        // mezzo giro: il lato "8" davanti, la finestra dietro

  let state = 'idle';           // idle | shaking | turning | rising | typing | shown | sinking
  let phaseStart = 0;
  let box = null, revealed = 0, revealTimer = null, onDone = null;
  let risen = 0, murkOpacity = 1;   // risen: 0 = affondata, 1 = sotto il vetro
  let spin = EIGHT;                 // EIGHT = si vede l'8, 0 = si vede la finestra
  let dragX = 0, dragY = 0, dragging = false, lastX = 0, lastY = 0;
  let pressT = 0, pressX = 0, pressY = 0, moved = 0;
  let shakeX = 0, shakeY = 0, shakeRX = 0, shakeRY = 0, shakeRZ = 0;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInCubic(t) { return t * t * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function placeFace(p, float) {
    face.position.set(0, SUNK_Y * (1 - p) + float, SUNK_Z + (FACE_Z - SUNK_Z) * p);
    face.rotation.x = 0.6 * (1 - p);
  }

  function clearReveal() {
    if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
  }

  function typeOut() {
    if (!box) { finish(); return; }
    const total = box.lines.reduce(function (n, l) { return n + l.text.length + 1; }, -1);
    if (revealed >= total) { paintFace(box, revealed, false); finish(); return; }
    revealed++;
    paintFace(box, revealed, true);
    revealTimer = setTimeout(typeOut, TYPE_MIN + Math.random() * TYPE_JITTER);
  }

  function finish() {
    clearReveal();
    state = 'shown';
    const cb = onDone; onDone = null;
    if (cb) cb();
  }

  const presenter = {
    mirrorToSr: true,
    hasAnswer: false,
    run: function (answer, opts, done) {
      clearReveal();
      this.hasAnswer = true;
      onDone = done;
      box = layout(answer);
      revealed = 0;

      if (opts.reduceMotion) {
        paintFace(box, 9999, false);
        spin = 0; risen = 1; murkOpacity = 0.18;
        finish();
        return;
      }

      paintFace(null, 0, false);
      spin = EIGHT; risen = 0; murkOpacity = 1;
      state = 'shaking';
      phaseStart = performance.now();
    },
    reset: function () {
      clearReveal();
      this.hasAnswer = false;
      onDone = null;
      box = null; revealed = 0;
      if (reduceMotion.matches) {
        paintFace(null, 0, false);
        spin = EIGHT; risen = 0; murkOpacity = 1;
        state = 'idle';
        return;
      }
      state = 'sinking';
      phaseStart = performance.now();
    }
  };

  // ---- trascinamento: stessa affordance del cubo, ma la finestra deve
  //      restare di fronte, quindi la rotazione e' limitata e rientra da sola ----
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; moved = 0;
    lastX = pressX = e.clientX; lastY = pressY = e.clientY;
    pressT = performance.now();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dragX += (e.clientX - lastX) * 0.008;
    dragY += (e.clientY - lastY) * 0.008;
    // stretta: oltre i ~18 gradi la finestra gira via e il triangolo si taglia
    dragX = Math.max(-0.32, Math.min(0.32, dragX));
    dragY = Math.max(-0.24, Math.min(0.24, dragY));
    moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });
  function release(e) {
    if (!dragging) return;
    dragging = false;
    const tap = moved < 6 && (performance.now() - pressT) < 500
      && Math.abs(e.clientX - pressX) < 6 && Math.abs(e.clientY - pressY) < 6;
    if (tap) api.ask();
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function () { dragging = false; });

  // ============================
  // LOOP
  // ============================
  (function render(now) {
    requestAnimationFrame(render);
    now = now || performance.now();
    const still = reduceMotion.matches;

    shakeX = shakeY = shakeRX = shakeRY = shakeRZ = 0;

    if (state === 'shaking') {
      const t = (now - phaseStart) / SHAKE_MS;
      if (t >= 1) {
        state = 'turning';
        phaseStart = now;
      } else {
        const env = Math.sin(Math.PI * t);
        shakeX = (Math.sin(now * 0.047) * 0.055 + (Math.random() - 0.5) * 0.028) * env;
        shakeY = (Math.sin(now * 0.061 + 1.3) * 0.045 + (Math.random() - 0.5) * 0.028) * env;
        shakeRZ = Math.sin(now * 0.039) * 0.10 * env;
        shakeRY = Math.sin(now * 0.052 + 0.7) * 0.13 * env;
        shakeRX = Math.sin(now * 0.033 + 2.1) * 0.06 * env;
      }
    } else if (state === 'turning') {
      // mezzo giro: l'8 va via, la finestra arriva davanti ancora torbida
      const t = Math.min((now - phaseStart) / TURN_MS, 1);
      spin = EIGHT * (1 - easeInOutCubic(t));
      if (t >= 1) { state = 'rising'; phaseStart = now; }
    } else if (state === 'rising') {
      const t = Math.min((now - phaseStart) / RISE_MS, 1);
      const e = easeOutCubic(t);
      risen = e;
      murkOpacity = 1 - 0.82 * e;
      if (t >= 1) { state = 'typing'; typeOut(); }
    } else if (state === 'sinking') {
      // la faccia riaffonda mentre la palla si rigira sull'8
      const t = Math.min((now - phaseStart) / SINK_MS, 1);
      const e = easeInCubic(t);
      risen = 1 - e;
      murkOpacity = 0.18 + 0.82 * e;
      spin = EIGHT * easeInOutCubic(t);
      if (t >= 1) { state = 'idle'; paintFace(null, 0, false); }
    }

    // galleggiamento: la faccia resta sospesa nel liquido, non incollata
    const afloat = !still && (state === 'typing' || state === 'shown');
    placeFace(risen, afloat ? Math.sin(now * 0.0018) * 0.012 : 0);
    murk.material.opacity = murkOpacity;

    if (!dragging) { dragX *= 0.985; dragY *= 0.985; }
    const idle = still ? 0 : Math.sin(now * 0.0004) * 0.055;

    ball.position.x = shakeX;
    ball.position.y = shakeY;
    ball.rotation.y = spin + dragX + idle + shakeRY;
    ball.rotation.x = dragY + shakeRX;
    ball.rotation.z = shakeRZ;

    renderer.render(scene, camera);
  })();

  // il font arriva da Google Fonts: se e' in ritardo rimisuro il testo
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      drawBadge();
      if (state === 'shown' && box) {
        const text = box.lines.map(function (l) { return l.text; }).join(' ');
        box = layout(text);
        paintFace(box, 9999, false);
      }
    });
  }

  api.attach(presenter);
}

window.initEightBall = initEightBall;
// caricato dinamicamente da js/eightball.js, cioe' a DOM gia' pronto
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEightBall);
else initEightBall();
