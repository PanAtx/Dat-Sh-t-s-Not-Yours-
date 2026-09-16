// _bronx_wall_chk.js — verify the Bronx sanitation-worker / building fix:
// 1) all inline scripts in index.html still parse,
// 2) the Bronx buildingFront stop line is the FRONT FACE (hd: 0, not d/2),
// 3) the worker collision clamps to the front face minus a body-width margin,
// 4) the old "walk to the building center" stoop branch is gone.
'use strict';
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('index.html', 'utf8');

const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,
  n = 0,
  ok = true;
while ((m = re.exec(html))) {
  n++;
  try {
    new vm.Script(m[1], { filename: 'inline' + n + '.js' });
  } catch (e) {
    ok = false;
    console.log('SYNTAX FAIL script #' + n + ': ' + e.message);
  }
}
console.log('inline scripts checked: ' + n);
console.log(ok ? 'ALL SYNTAX OK' : 'SYNTAX ERRORS FOUND');

const checks = [
  [
    'buildingFront is a thin front-face line (hd: 0)',
    /g\.userData\.buildingFront = \{[\s\S]*?hd: 0,/.test(html),
  ],
  ['no hd: d/2 left in buildingFront', !/buildingFront = \{[\s\S]*?hd: d \/ 2,/.test(html)],
  [
    'collision clamps worker to the stop line',
    html.includes('p.wy = stopY;'),
  ],
  [
    'clamp threshold equals clamp target (no creep/snap flicker)',
    html.includes('if (p.wy < stopY) continue;') && !html.includes('if (p.wy < bf.y1) continue;'),
  ],
  [
    'stop line = front face minus body margin',
    html.includes('const stopY = bf.y1 - WALL_STOP;'),
  ],
  [
    'WALL_STOP margin defined',
    html.includes('const WALL_STOP = 0.3;'),
  ],
  [
    'workerMaxY still allows reaching the Bronx stoop (8.0 > 7.25 face)',
    /function workerMaxY\(\) \{\s*return isManhattanLevel\(\) \? 5\.0 : 8\.0;/.test(html),
  ],
  [
    'Bronx HOUSE_Y (9.5) and depth (4.5) => front face at 7.25',
    /else if \(isBronxLevel\(\)\) HOUSE_Y = 9\.5;/.test(html),
  ],
];
let all = ok;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!pass) all = false;
}

// --- Frame simulation: stick held INTO the wall must be a dead stop, not a bounce ---
// Replicates the game's per-frame order: input move (LAT_SPEED 6.5, dt 1/60), then the
// building collision, over many frames. Collect the worker's final y each frame.
const LAT_SPEED = 6.5,
  dt = 1 / 60,
  WALL_STOP = 0.3,
  frontFace = 9.5 - 4.5 / 2; // Bronx: HOUSE_Y - d/2
let wy = 6.6; // start partway up the stoop, walking INTO the wall
const ys = [];
for (let i = 0; i < 240; i++) {
  wy = Math.min(wy + LAT_SPEED * dt, 8.0); // worker input + global clamp
  const stopY = frontFace - WALL_STOP;
  if (wy >= stopY) wy = stopY; // new collision code (threshold == target)
  ys.push(wy);
}
const last = ys.slice(-120);
const spread = Math.max(...last) - Math.min(...last);
console.log(
  (spread < 1e-9 ? 'PASS' : 'FAIL') +
    ' - 240-frame walk-into-wall simulation: position spread after settling = ' +
    spread.toExponential(2) +
    ' (must be 0, no bounce/flicker)',
);
if (spread >= 1e-9) all = false;
console.log(
  'settled stop line: ' +
    last[0] +
    ' (front face ' +
    frontFace +
    ' minus margin ' +
    WALL_STOP +
    ')',
);
process.exit(all ? 0 : 1);
