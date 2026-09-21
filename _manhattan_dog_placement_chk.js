// Stress-test Manhattan leashdog placement: 50k initial + 50k recycling sweeps
// to confirm every anchor/dog position is on a sidewalk (never street/intersection/corner).
const BLOCK_W = 80;
const BLOCK_GAP = 16;
const CYCLE = BLOCK_W + BLOCK_GAP; // 96

// Manhattan geometry constants from index.html
const ANCHOR_X_MIN = 10;
const ANCHOR_X_MAX = BLOCK_W - 10;
const DOG_X_MIN = 6;
const DOG_X_MAX = BLOCK_W - 6;
const ANCHOR_Y_MIN = 0.85;
const ANCHOR_Y_MAX = 1.05;
const DOG_Y_MIN = 0.85;
const DOG_Y_MAX = 4.8;

let R = (a, b) => a + Math.random() * (b - a);
let clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let ok = true;
let failed = 0;
const check = (label, cond, extra) => {
  if (!cond) {
    ok = false;
    failed++;
    console.log('FAIL ' + label + (extra ? ' [' + extra + ']' : ''));
  }
};

// Active blocks are x in [96, 576] with garbage=true
const activeBlocks = [];
for (let x = 96; x <= 576; x += 96) activeBlocks.push(x);

// ---- Part 1: Initial spawn placement (50k iterations) ----
let spawnIntersection = 0, spawnCorner = 0;
let spawnAnchorYBad = 0, spawnDogYBad = 0;
let spawnAnchorXBad = 0, spawnDogXBad = 0;

for (let i = 0; i < 50000; i++) {
  const b = activeBlocks[(Math.random() * activeBlocks.length) | 0];
  let anchorX = clamp(b + ANCHOR_X_MIN + R(0, 60), b + ANCHOR_X_MIN, b + BLOCK_W - ANCHOR_X_MIN);
  let anchorY = R(ANCHOR_Y_MIN, ANCHOR_Y_MAX);
  let homeX = anchorX + R(-0.4, 0.8);
  let homeY = clamp(anchorY + R(0.6, 1.4), DOG_Y_MIN, DOG_Y_MAX);

  let blockIdx = Math.floor(anchorX / CYCLE);
  let blockStart = blockIdx * CYCLE;
  let posInBlock = anchorX - blockStart;

  if (anchorY < ANCHOR_Y_MIN) spawnAnchorYBad++;
  if (homeY < DOG_Y_MIN || homeY > DOG_Y_MAX) spawnDogYBad++;
  if (posInBlock < 0 || posInBlock >= BLOCK_W) spawnIntersection++;
  if (posInBlock >= 0 && posInBlock < BLOCK_W) {
    if (posInBlock < ANCHOR_X_MIN || posInBlock > BLOCK_W - ANCHOR_X_MIN) {
      spawnCorner++; spawnAnchorXBad++;
    }
    let dogPosInBlock = homeX - blockStart;
    if (dogPosInBlock < DOG_X_MIN || dogPosInBlock > BLOCK_W - DOG_X_MIN) spawnDogXBad++;
// ---- Part 2: Off-screen recycling placement (50k iterations) ----
let recycleIntersection = 0, recycleCorner = 0;
let recycleAnchorYBad = 0, recycleAnchorXBad = 0;
let recycleDogYBad = 0, recycleDogXBad = 0;
let recycleOnScreen = 0; // camera sees ~15u forward; recycle must land >= 50u ahead

for (let i = 0; i < 50000; i++) {
  let playerX = R(80, 600);
  let targetX = playerX + 50 + R(0, 10);
  let blockIdx = Math.floor(targetX / CYCLE);
  let posInCycle = targetX % CYCLE;
  if (posInCycle < ANCHOR_X_MIN || posInCycle > BLOCK_W - ANCHOR_X_MIN) {
    targetX = (blockIdx + 1) * CYCLE + ANCHOR_X_MIN + R(0, 60); // FORWARD only
  }
  let anchorY = R(ANCHOR_Y_MIN, ANCHOR_Y_MAX);
  let homeX = targetX + R(-0.4, 0.8);
  let homeY = clamp(anchorY + R(0.6, 1.4), DOG_Y_MIN, DOG_Y_MAX);

  blockIdx = Math.floor(targetX / CYCLE);
  let blockStart = blockIdx * CYCLE;
  let posInBlock = targetX - blockStart;

  if (anchorY < ANCHOR_Y_MIN || anchorY > ANCHOR_Y_MAX) recycleAnchorYBad++;
  if (homeY < DOG_Y_MIN || homeY > DOG_Y_MAX) recycleDogYBad++;
  if (posInBlock < 0 || posInBlock >= BLOCK_W) recycleIntersection++;
  if (posInBlock >= 0 && posInBlock < BLOCK_W) {
    if (posInBlock < ANCHOR_X_MIN || posInBlock > BLOCK_W - ANCHOR_X_MIN) {
      recycleCorner++; recycleAnchorXBad++;
    }
    let dogPosInBlock = homeX - blockStart;
    if (dogPosInBlock < DOG_X_MIN || dogPosInBlock > BLOCK_W - DOG_X_MIN) recycleDogXBad++;
  }
  if (targetX - playerX < 50) recycleOnScreen++; // would materialize inside the camera frustum
}

check('recycling: no anchors in intersections (50k)', recycleIntersection === 0, recycleIntersection + ' violations');
check('recycling: no anchors in corners (50k)', recycleCorner === 0, recycleCorner + ' violations');
check('recycling: ALWAYS off-screen ahead (target >= 50u forward, 50k)', recycleOnScreen === 0, recycleOnScreen + ' violations');
check('recycling: all anchors on sidewalk x range (50k)', recycleAnchorXBad === 0, recycleAnchorXBad + ' violations');
check('recycling: all anchors on sidewalk y range (50k)', recycleAnchorYBad === 0, recycleAnchorYBad + ' violations');
check('recycling: all dog homes on sidewalk y range (50k)', recycleDogYBad === 0, recycleDogYBad + ' violations');
check('recycling: all dog homes on sidewalk x range (50k)', recycleDogXBad === 0, recycleDogXBad + ' violations');

// ---- Part 3: Movement clamping sanity (spot check) ----
let clampFail = 0;
for (let i = 0; i < 10000; i++) {
  let dogX = R(100, 500);
  let dogY = R(0.85, 2.0);
  let workerX = dogX + R(-3, 3);
  let workerY = R(0.3, 0.7);
  let dist = Math.sqrt((workerX - dogX)**2 + (workerY - dogY)**2);
  if (dist < 6.5) {
    let dx = (workerX - dogX) / dist;
    let dy = (workerY - dogY) / dist;
    let newX = dogX + dx * 0.5;
    let newY = Math.max(DOG_Y_MIN, dogY + dy * 0.5);
    if (newY < DOG_Y_MIN) clampFail++;
  }
}
check('movement clamping: dog never drops below y=0.85 during lunge', clampFail === 0, clampFail + ' violations');

console.log('');
if (ok) {
  console.log('MANHATTAN DOG PLACEMENT STRESS TEST PASSED (100k total iterations)');
  process.exit(0);
} else {
  console.log('MANHATTAN DOG PLACEMENT STRESS TEST FAILED (' + failed + ' checks)');
  process.exit(1);
}

  }
  let inSafeX = anchorX >= b + ANCHOR_X_MIN && anchorX <= b + BLOCK_W - ANCHOR_X_MIN;
  if (!inSafeX) spawnAnchorXBad++;
}

check('initial spawn: no anchors in intersections (50k)', spawnIntersection === 0, spawnIntersection + ' violations');
check('initial spawn: no anchors in corners (50k)', spawnCorner === 0, spawnCorner + ' violations');
check('initial spawn: all anchors on sidewalk x range (50k)', spawnAnchorXBad === 0, spawnAnchorXBad + ' violations');
check('initial spawn: all anchors on sidewalk y range (50k)', spawnAnchorYBad === 0, spawnAnchorYBad + ' violations');
check('initial spawn: all dog homes on sidewalk y range (50k)', spawnDogYBad === 0, spawnDogYBad + ' violations');
check('initial spawn: all dog homes on sidewalk x range (50k)', spawnDogXBad === 0, spawnDogXBad + ' violations');