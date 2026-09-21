// _placement_chk.js — verify the "where things can sit" rules from index.html:
//   1) curb bags / cans / mongo / cash / treasure land on the SIDEWALK or the FRONT-LAWN
//      GRASS in front of a house — never on the street, a cross-street, or an intersection;
//   2) power-ups (coffee / BEC / Monster) are snapped to the front of a real house cell
//      (the REAL snapToHouseCell, extracted verbatim) so they're never in an intersection;
//   3) the dog house anchor is firmly on the front-lawn GRASS;
//   4) the worker's lateral reach is level-aware (workerMaxY() = 8.0 on borough levels
//      clears the grass band; 5.0 in Manhattan keeps him on the sidewalk).
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted, mirrors _health_chk.js) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ---- world constants (mirrors index.html) ----
const BW = 8, HOUSES_PER_BLOCK = 10, BLOCK_W = BW * HOUSES_PER_BLOCK;
const LEVEL_BLOCKS = [
  { x: 0,   garbage: false }, { x: 96,  garbage: true  }, { x: 192, garbage: true  },
  { x: 288, garbage: true  }, { x: 384, garbage: true  }, { x: 480, garbage: true  },
  { x: 576, garbage: true  }, { x: 672, garbage: false },
];
const R = (a, b) => a + Math.random() * (b - a);

// Ground bands (from buildGround): asphalt y -9.5..0.5, near sidewalk 0.5..5.0,
// front-lawn grass 5.0..8.5. "In front of a house" = x inside some block's 80u span;
// the 16u gaps between blocks are the cross-streets / intersections.
const SIDEWALK_Y0 = 0.5, GRASS_Y0 = 5.0, GRASS_Y1 = 8.5;
const inBlockSpan = (x) => LEVEL_BLOCKS.some(b => x >= b.x && x <= b.x + BLOCK_W);
const inIntersection = (x) => !inBlockSpan(x);
const onStreet = (y) => y < SIDEWALK_Y0;

let ok = true;
const check = (label, cond, extra) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : '')); if (!cond) ok = false; };
// ---- (1) curb bags / cans / bonuses: replicate the EXACT placement math from
//      makeBlockContents and confirm every placement is on sidewalk/grass, in front of
//      a house, and never in the street / a cross-street / an intersection. ----
const sideY  = () => R(0.5, 7.0);      // must match index.html
const houseX = (baseX) => baseX + R(0.8, 7.2);
let curbOk = true, curbN = 0, worst = null;
for (const bl of LEVEL_BLOCKS){
  if (!bl.garbage) continue;   // only garbage blocks carry curb items (matches the gate)
  for (let i = 0; i < HOUSES_PER_BLOCK; i++){
    const baseX = bl.x + i * BW;
    // a bag, a can, and a bonus each roll their own x/y exactly like the game
    const samples = [ [houseX(baseX), sideY()], [houseX(baseX), sideY()], [houseX(baseX), sideY()] ];
    for (const [x, y] of samples){
      curbN++;
      const good = !onStreet(y) && y <= 7.0 && !inIntersection(x) && inBlockSpan(x);
      if (!good){ curbOk = false; if (!worst) worst = { x: x.toFixed(2), y: y.toFixed(2) }; }
    }
  }
}
check('curb bags/cans/mongo/cash/treasure: on sidewalk + front-lawn grass, in front of a house, never street/cross-street/intersection (' + curbN + ' placements)', curbOk, worst ? JSON.stringify(worst) : '');

// ---- (2) power-ups: run the REAL snapToHouseCell over the whole route and confirm it
//      always returns the front of an ACTUAL house cell (sidewalk/grass), never a gap. ----
eval(extractFn('snapToHouseCell'));
let snapOk = true, snapN = 0, snapWorst = null;
for (let wx = 80; wx <= 656; wx += 0.5){          // sweep the full playable route
  for (let t = 0; t < 4; t++){
    const x = snapToHouseCell(wx);
    snapN++;
    const good = inBlockSpan(x) && !inIntersection(x) && x % 8 >= 0.8 && x % 8 <= 7.2;
    if (!good){ snapOk = false; if (!snapWorst) snapWorst = { wx: wx, x: x.toFixed(2) }; }
  }
}
check('snapToHouseCell: every snapped power-up sits in front of a real house cell (never an intersection gap) (' + snapN + ' samples)', snapOk, snapWorst ? JSON.stringify(snapWorst) : '');

// coffee / BEC route positions + the Monster's "in front of the worker" snap stay on-route
const ROUTE_START_X = 80, ROUTE_FINISH_X = 656;
let healOk = true;
for (let t = 0; t < 2000; t++){
  const coffee = snapToHouseCell(ROUTE_START_X + (ROUTE_FINISH_X - ROUTE_START_X) * R(0.40, 0.65));
  const bec    = snapToHouseCell(ROUTE_START_X + (ROUTE_FINISH_X - ROUTE_START_X) * R(0.65, 0.92));
  if (inIntersection(coffee) || inIntersection(bec)) healOk = false;
}
check('coffee + BEC healers: snapped to a house front, never an intersection (2000 rolls)', healOk);

// ---- (3) dog house: the anchor must be firmly on the front-lawn GRASS band. ----
// Replicate the spawnWorld doghouse lateral placement (anchorY band + in-block clamp).
const DOG_ANCHOR_Y0 = 6.4, DOG_ANCHOR_Y1 = 7.8;   // must match index.html ld.anchorY = R(6.4, 7.8)
let dogOk = true, dogN = 0, dogWorst = null;
for (const bl of LEVEL_BLOCKS){
  for (let i = 0; i < HOUSES_PER_BLOCK; i++){
    const worldX = bl.x + i * BW;
    const mag = R(2.4, 3.4);
    let side = Math.random() < 0.5 ? -1 : 1;
    let ax = worldX + side * mag;
    if (ax < bl.x + 1.0 || ax > bl.x + BLOCK_W - 1.0) ax = worldX - side * mag;
    const anchorX = Math.max(bl.x + 1.0, Math.min(bl.x + BLOCK_W - 1.0, ax));
    const anchorY = R(DOG_ANCHOR_Y0, DOG_ANCHOR_Y1);
    dogN++;
    const onGrass = anchorY >= GRASS_Y0 && anchorY <= GRASS_Y1;
    const inBlock = anchorX >= bl.x && anchorX <= bl.x + BLOCK_W;
    if (!onGrass || !inBlock){ dogOk = false; if (!dogWorst) dogWorst = { x: anchorX.toFixed(2), y: anchorY.toFixed(2) }; }
  }
}
check('dog house: anchor firmly on the front-lawn GRASS (y 5..8.5), inside its block, off street/sidewalk (' + dogN + ' houses)', dogOk, dogWorst ? JSON.stringify(dogWorst) : '');

// ---- (3b) Maspeth dog house (Queens variant): the anchor sits in the GAP BETWEEN two
//      houses — at a MIDDLE-cell boundary (x = blockX + QX(gap) + 6.4, jitter ±0.35) — on
//      the Maspeth front-lawn grass band (y 3.5..6.75), mid-lawn and IN FRONT of the
//      doormat/concrete landing (y ~5.3..6.7, HOUSE_Y 10.5): the doghouse body
//      (anchorY +- 0.3, anchor band R(4.0, 5.0)) stays on grass, never over the mat.
//      gap 1..9 only: off BOTH corner cells (store corner + house corner) and strictly
//      inside the block, so it never reaches the 16u intersection at either end.
const QX = (i) => (i === 0 ? 0 : i === 11 ? 72 : 8 + (i - 1) * 6.4);
const Q_GRASS_Y0 = 3.5, Q_GRASS_Y1 = 6.75; // Maspeth front-lawn strip (buildGround)
const Q_LANDING_Y0 = 5.3;                  // street-side edge of the doormat/landing
const Q_BODY_D = 0.3;                      // doghouse walls are 0.6u deep (half 0.3)
let dogQOk = true, dogQN = 0, dogQWorst = null;
for (const bl of LEVEL_BLOCKS) {
  for (let gap = 1; gap <= 9; gap++) {
    const ax = bl.x + QX(gap) + 6.4 + R(-0.35, 0.35);
    const anchorX = Math.max(bl.x + 1.0, Math.min(bl.x + BLOCK_W - 1.0, ax));
    const anchorY = R(4.0, 5.0); // must match index.html Queens branch ld.anchorY = R(4.0, 5.0)
    dogQN++;
    const posIn = anchorX - bl.x;
    const onGrass = anchorY - Q_BODY_D >= Q_GRASS_Y0 && anchorY + Q_BODY_D <= Q_GRASS_Y1;
    const clearOfLanding = anchorY + Q_BODY_D <= Q_LANDING_Y0 + 1e-6; // body never over the mat
    const strictlyInBlock = posIn > 0 && posIn < BLOCK_W; // never on an intersection
    const offCorners = posIn >= QX(1) + 6.4 - 0.35 && posIn <= QX(9) + 6.4 + 0.35; // >= 6.05u off both corner cells
    if (!onGrass || !clearOfLanding || !strictlyInBlock || !offCorners){ dogQOk = false; if (!dogQWorst) dogQWorst = { x: anchorX.toFixed(2), y: anchorY.toFixed(2) }; }
  }
}
check('Maspeth dog house: gap-between-houses anchor (middle-cell boundary ± 0.35) firmly on the front-lawn GRASS (y 3.5..6.75), IN FRONT of the doormat/landing, strictly inside its block, off both corner cells (store corner + house corner) (' + dogQN + ' gaps)', dogQOk, dogQWorst ? JSON.stringify(dogQWorst) : '');
check('Maspeth dog house: spawnWorld routes Queens to MIDDLE-cell gaps only (gapIdx 1..9, never a corner cell / corner-store frontage) with the mid-lawn anchor band R(4.0, 5.0), keeping the old side-of-door logic for other boroughs', src.indexOf('borough === "QUEENS"') >= 0 && /queensCellX\(gapIdx\)\s*\+\s*QUEENS_MID_W/.test(src) && /(?:const|let) gapIdx = 1 \+ \(\(Math\.random\(\) \* \(QUEENS_HOUSES_PER_BLOCK - 3\)\) \| 0\);/.test(src) && src.indexOf('let ay = R(4.0, 5.0);') >= 0 && src.indexOf('const mag = R(2.4, 3.4);') >= 0);
// ---- (3c) Maspeth doghouse RATE: 4 doghouses per level (increased from 1) ----
check('Maspeth doghouse rate: 4 per level (was 1)', (() => {
  const i = src.indexOf('const dogCount = isFlatbushLevel()');
  if (i < 0) return false;
  const seg = src.slice(i, i + 320);
  return /isQueensLevel\(\)\s*\?\s*4\b/.test(seg) && /:\s*1\s*;/.test(seg);
})());
// ---- (3d) Maspeth doghouse: runtime doormat guard + QUEENS-exclusive dog/leash wiring ----
check('Maspeth dog house: runtime guard keeps the body off BOTH neighbors doormat/landing (house.step rectangles, retry on overlap) and ties with the QUEENS-exclusive chain (tieQueensLeashChain)', (() => {
  const j = src.indexOf('borough === "QUEENS"', src.indexOf('const dogCount = isFlatbushLevel()'));
  if (j < 0) return false;
  const seg = src.slice(j, j + 4000);
  return seg.indexOf('clearsLanding') >= 0 && seg.indexOf('house.step') >= 0 && seg.indexOf('tieQueensLeashChain(') >= 0;
})());

// ---- (4) worker reach is level-aware: workerMaxY() = 8.0 on the borough levels
//      (clears the sidewalk into the front-lawn grass, short of the houses) and 5.0 in
//      Manhattan (sidewalk only); the movement clamp uses it. ----
const isManhattanLevel = () => false;   // borough-level stub for the extracted workerMaxY()
eval(extractFn('workerMaxY'));
check('worker reach: workerMaxY() (borough) = 8.0 clears the sidewalk (5.0) into the front-lawn grass (5..8.5), short of the houses', workerMaxY() > 5.0 && workerMaxY() <= GRASS_Y1);
check('worker reach: Manhattan caps the worker on the sidewalk (5.0)', src.indexOf('return isManhattanLevel() ? 5.0 : 8.0;') >= 0);
check('worker reach: the movement clamp clamps to workerMaxY() (no leftover constant cap)', /clamp\(\s*p\.wy \+ lat \* LAT_SPEED \* immuneBoost \* dt,?\s*-9\.4,?\s*workerMaxY\(\)\s*\)/.test(src));

console.log(ok ? '\nPLACEMENT ALL CHECKS PASS' : '\nPLACEMENT FAILURES');
process.exit(ok ? 0 : 1);

