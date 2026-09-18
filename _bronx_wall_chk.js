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
  // --- Bronx storefront wiring ---
  ['Bronx store name pool exists', /const BRONX_STORE_NAMES = \[/.test(html)],
  [
    'Bronx store pool has at least 16 names (8 blocks x 2)',
    ((html.match(/const BRONX_STORE_NAMES = \[([\s\S]*?)\];/) || [])[1] || '')
      .split('\n')
      .filter((l) => l.trim().startsWith('"')).length >= 16,
  ],
  [
    'makeBronxStore uses the Bronx row-house shell (w 8, d 4.5, h 5.5)',
    /function makeBronxStore\(storeOptions\) \{[\s\S]*?const w = 8\.0,[\s\S]*?d = 4\.5,[\s\S]*?h = 5\.5;/.test(
      html,
    ),
  ],
  [
    'makeBronxStore keeps the Manhattan storefront (door + mat + sign)',
    /function makeBronxStore\(storeOptions\) \{[\s\S]*?const doorX = storeOptions\.isLeft \? -2\.6 : 2\.6;[\s\S]*?const mat = BX\(1\.0, 0\.4, 0\.04, M\(0x555555\)\);[\s\S]*?signPlane/.test(
      html,
    ),
  ],
  [
    'store rule covers MANHATTAN, THE BRONX, and (area-gated) Flatbush',
    html.includes('borough === "MANHATTAN"') &&
      html.includes('borough === "THE BRONX"') &&
      html.includes('area === "FLATBUSH"'),
  ],
  [
    'Bronx storefront pool wired into spawnWorld',
    /else if \(borough === "THE BRONX"\) \{[\s\S]*?shuffleStoreNames\(BRONX_STORE_NAMES\)/.test(
      html,
    ),
  ],
  [
    'makeBlockContents builds Bronx stores with makeBronxStore',
    /borough === "THE BRONX"[\s\S]*?makeBronxStore\(storeOptions\)[\s\S]*?makeBrownstone\(storeOptions\)/.test(
      html,
    ),
  ],
  [
    'makeBronxStore has a thin buildingFront stop line',
    /function makeBronxStore[\s\S]*?g\.userData\.buildingFront = \{[\s\S]*?hd: 0,[\s\S]*?\};/.test(
      html,
    ),
  ],
  [
    'makeBronxStore stop line sits at the kick-plate face (0.4 proud of wall)',
    /function makeBronxStore[\s\S]*?buildingFront = \{[\s\S]*?cy: -d \/ 2 - 0\.4,/.test(
      html,
    ),
  ],
  [
    'makeBronxStore exposes the mat as a step under the door (top 0.33)',
    /function makeBronxStore[\s\S]*?g\.userData\.step = \{[\s\S]*?cx: doorX,[\s\S]*?top: 0\.33,[\s\S]*?\};/.test(
      html,
    ),
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

// --- Storefront simulation: stick held INTO a Bronx storefront must be a dead stop,
// the worker must land ON the mat (lift to 0.33), and his body must clear the
// kick-plate face (the nearest protruding storefront face) ---
const kickFace = 9.5 - 4.5 / 2 - 0.4; // 6.85 — Bronx storefront kick-plate outer face
let swy = 6.2; // start on the sidewalk, walking INTO the storefront
const sstop = kickFace - WALL_STOP; // 6.55
const sy = [];
for (let i = 0; i < 240; i++) {
  swy = Math.min(swy + LAT_SPEED * dt, 8.0);
  if (swy >= sstop) swy = sstop;
  sy.push(swy);
}
const sspread = Math.max(...sy.slice(-120)) - Math.min(...sy.slice(-120));
// mat step region from makeBronxStore: cy = 9.5-2.25-0.5 = 6.75, hd 0.5 => 6.25..7.25
const onMat = sstop >= 6.25 && sstop <= 7.25;
// worst-case body half-width in front of the worker (0.28, facing sideways)
const bodyFront = sstop + 0.28;
const clears = bodyFront < kickFace - 1e-9;
console.log(
  (sspread < 1e-9 ? 'PASS' : 'FAIL') +
    ' - 240-frame storefront walk-in: no bounce/flicker (spread ' +
    sspread.toExponential(2) +
    ')',
);
console.log(
  (onMat ? 'PASS' : 'FAIL') +
    ' - worker stop line (' +
    sstop +
    ') lands inside the mat step region (6.25..7.25) => feet lift to mat top 0.33',
);
console.log(
  (clears ? 'PASS' : 'FAIL') +
    ' - body front (' +
    bodyFront +
    ') stays clear of the kick-plate face (' +
    kickFace +
    ')',
);
if (sspread >= 1e-9 || !onMat || !clears) all = false;
process.exit(all ? 0 : 1);
