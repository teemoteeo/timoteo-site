// Genera images/dots/deathstar-dots.json: la Morte Nera di js/ships-sw.js come nuvola di puntini
// (stile DotPlanet di POLENTA). Punti campionati sui triangoli in proporzione all'area, spinti
// un filo fuori lungo la normale (cosi' non lottano col riempimento scuro), raggio normalizzato a 1.
// Uso: node tools/deathstar-dots.js [N]
const fs = require('fs'), path = require('path');
const S = require('../js/ships-sw.js');
const N = +process.argv[2] || 45000;
const m = S.mesh('deathstar'), R = 9;
const dark = S.PALETTE && Object.keys(S.PALETTE);

// aree cumulative per il campionamento
const area = new Float64Array(m.n); let tot = 0;
for (let i = 0; i < m.n; i++) {
  const p = m.p.subarray(i * 9, i * 9 + 9);
  const a = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], b = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
  tot += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2;
  area[i] = tot;
}
let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
const tone = f => 0.72 + ((f * 2654435761) % 997) / 997 * 0.28;   // ogni pannello un tono, come TONE in ships-sw

const out = [], dish = [0, 0, 0];
for (let k = 0; k < N; k++) {
  const r = rnd() * tot; let lo = 0, hi = m.n - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (area[mid] < r) lo = mid + 1; else hi = mid; }
  const i = lo, p = m.p.subarray(i * 9, i * 9 + 9);
  let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
  const q = [0, 1, 2].map(c => p[c] + (p[3 + c] - p[c]) * u + (p[6 + c] - p[c]) * v + m.nr[i * 3 + c] * 0.03);
  const col = dark[m.fc[m.f[i]]], fl = m.fl[i];
  let w = col === 'hullDark' ? 0.42 : tone(m.f[i]);
  if (fl & 2) w *= 0.5;                       // DARK: trincea e interno della parabola
  const lit = col === 'window' ? 1 : 0;
  const x = q[0] / R, y = q[1] / R, z = q[2] / R;
  if (Math.hypot(x, y, z) < 0.96) { dish[0] += x; dish[1] += y; dish[2] += z; }
  out.push([+x.toFixed(3), +y.toFixed(3), +z.toFixed(3), +w.toFixed(2), lit]);
}
const l = Math.hypot(...dish), axis = dish.map(c => +(c / l).toFixed(4));
console.assert(l > 0, 'parabola non trovata');
fs.writeFileSync(path.join(__dirname, '../images/dots/deathstar-dots.json'), JSON.stringify({ axis, cut: +Math.cos(0.3).toFixed(4), dots: out }));
console.log(out.length, 'punti, asse parabola', axis);
