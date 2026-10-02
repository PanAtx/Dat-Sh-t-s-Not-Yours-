// _overtime_storewall_chk.js — the OVERTIME (BONUS) store row must be a CONTINUOUS wall:
// the worker must not be able to slip BEHIND the storefronts through the gaps between
// stores or over a store's side. The old bug: the worker "disappeared" behind a store and
// teleported back to the front (the front-wall clamp yanking him out of the building).
//
// Root cause: each overtime store is visually scaled to fill the cell (7.8u of 8u), but its
// buildingFront collision box was still the UNSCALED 6.5u (hw = w/2). That left a ~0.75u
// dead-zone on each store's side and a ~1.5u gap between neighbours with NO wall, so the
// worker walked through those into the +y (behind) side. Fix: widen each BONUS store's
// front wall to its FULL cell so the storefronts tile into one continuous wall (front,
// sides and seams all block him; the 16u cross-street gaps between blocks stay open).
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const num = (re, dflt) => { const m = html.match(re); return m ? parseFloat(m[1]) : dflt; };
const FLATBUSH_STORE_W = num(/const FLATBUSH_STORE_W = ([\d.]+);/, 6.5); // unscaled store body width

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

// --- (1) static: the BONUS branch widens the store front wall to the FULL cell --------
check(
  'overtime (BONUS) widens each store front wall to its full cell (baseX .. baseX+cellW)',
  /if \(BONUS && b\.buildingFront\) \{[\s\S]*?b\.buildingFront\.x0 = baseX;[\s\S]*?b\.buildingFront\.x1 = baseX \+ cellW;/.test(html),
);
check(
  'the widening is GATED on BONUS (normal levels keep their per-store footprint)',
  /if \(BONUS && b\.buildingFront\)/.test(html),
);

// --- (2) behavioral: with the widened footprint the worker can't slip behind ---------
// Mirror the game's buildingFront clamp (WALL_STOP = 0.3) and feed it the footprints the
// game actually builds: the OLD unscaled footprint vs the NEW full-cell footprint.
const WALL_STOP = 0.3;
const frontFaceY = 5.1; // ~ HOUSE_Y(7.9) + cy(-2.8)  — the storefront face the worker stops in front of
const stopY = frontFaceY - WALL_STOP;
const SIDE_STOP = 0.3; // body-width off the store's side face
const SIDE_REACH = 1.5; // near-edge band that is walled
function clampWorker(p, blocks) {
  // (1) BONUS block-edge SIDE WALLS — run BEFORE the front clamp: clamp X, never touch Y.
  for (const b of blocks) {
    if ((b.bonusSideLeft == null && b.bonusSideRight == null) || !b.buildingFront) continue;
    const sStop = b.buildingFront.y1 - WALL_STOP;
    if (p.wy < sStop) continue;
    if (b.bonusSideLeft != null && p.wx > b.bonusSideLeft - SIDE_STOP && p.wx < b.bonusSideLeft + SIDE_REACH)
      p.wx = b.bonusSideLeft - SIDE_STOP;
    if (b.bonusSideRight != null && p.wx < b.bonusSideRight + SIDE_STOP && p.wx > b.bonusSideRight - SIDE_REACH)
      p.wx = b.bonusSideRight + SIDE_STOP;
  }
  // (2) building-front wall: clamp Y (hard stop at the face).
  for (const b of blocks) {
    const bf = b.buildingFront;
    if (p.wx < bf.x0 || p.wx > bf.x1) continue;
    if (p.wy < bf.y1 - WALL_STOP) continue;
    p.wy = bf.y1 - WALL_STOP;
  }
}
// two adjacent overtime stores: cell 0 = [0,8], cell 1 = [8,16]. Store centers at 4 and 12.
const hw = FLATBUSH_STORE_W / 2; // 3.25 — the unscaled half-width that built the OLD footprint
const oldBlocks = [
  { buildingFront: { x0: 4 - hw, x1: 4 + hw, y1: frontFaceY } },   // [0.75, 7.25]
  { buildingFront: { x0: 12 - hw, x1: 12 + hw, y1: frontFaceY } }, // [8.75, 15.25]
];
const newBlocks = [
  { buildingFront: { x0: 0, x1: 8, y1: frontFaceY } },   // full cell 0
  { buildingFront: { x0: 8, x1: 16, y1: frontFaceY } },  // full cell 1
];
const behindY = frontFaceY + 1.0; // worker pushed behind the storefront
const run = (x, blocks) => { const p = { wx: x, wy: behindY }; clampWorker(p, blocks); return p.wy; };

// the seam between the two stores (x=8): dead air in the OLD footprint, walled in the NEW
check('reproduces the bug: OLD unscaled footprint let the worker slip behind at the seam (x=8)', run(8, oldBlocks) > stopY, 'wy=' + run(8, oldBlocks));
check('fix: NEW full-cell footprint CLAMPS the worker to the front at the seam (x=8)', run(8, newBlocks) <= stopY + 1e-6, 'wy=' + run(8, newBlocks));
// a "side" dead-zone (x=7.6): over store 0's visual side but outside its OLD collision
check('fix: the side dead-zone (x=7.6) is also walled by the full-cell footprint', run(7.6, newBlocks) <= stopY + 1e-6, 'wy=' + run(7.6, newBlocks));
// a worker already in front (below the stop line) is left alone — no over-clamping
const inFront = { wx: 4, wy: 3.0 }; clampWorker(inFront, newBlocks);
check('no over-clamp: a worker already in front of the store keeps his y', inFront.wy === 3.0, 'wy=' + inFront.wy);

// --- (3) static: BONUS marks the block's outer edges as solid SIDE WALLS ----------
check(
  'overtime (BONUS) marks each block left edge as a side wall (houseIdx 0 -> bonusSideLeft = baseX)',
  /if \(houseIdx === 0\) b\.bonusSideLeft = baseX;/.test(html),
);
check(
  'overtime (BONUS) marks each block right edge as a side wall (last cell -> bonusSideRight = baseX+cellW)',
  /if \(houseIdx === HOUSES_PER_BLOCK - 1\) b\.bonusSideRight = baseX \+ cellW;/.test(html),
);
// --- (4) behavioral: hitting a store's SIDE stops him IN X (no y-teleport) --------
// Block's left edge is at x=0 (cell 0's baseX); the cross-street is x<0. The worker is in
// the cross-street at HIGH y (behind the front face) and strafes into the block's edge.
const newBlocksWithSides = [
  { buildingFront: { x0: 0, x1: 8, y1: frontFaceY }, bonusSideLeft: 0 }, // cell 0, left edge = block boundary
  { buildingFront: { x0: 8, x1: 16, y1: frontFaceY } }, // cell 1 (interior seam, no side wall)
];
const highY = frontFaceY + 1.5; // worker well behind the storefront face, in the cross-street band
// left edge: worker just inside cell 0 (x=0.5) strafing toward the store's side
const leftP = { wx: 0.5, wy: highY }; clampWorker(leftP, newBlocksWithSides);
check('side approach (left edge): worker is HELD IN X at the block edge (x -> edge - body-width)', leftP.wx === -SIDE_STOP, 'wx=' + leftP.wx);
check('side approach (left edge): worker y is UNTOUCHED (no teleport to the front face)', leftP.wy === highY, 'wy=' + leftP.wy);
// right edge: worker just inside the last cell (x=15.5) strafing into the block's right side
const rightEdge = 16; // cell 1 (x [8,16]) is the block's right edge
const newBlocksRightEdge = [
  { buildingFront: { x0: 0, x1: 8, y1: frontFaceY } },
  { buildingFront: { x0: 8, x1: 16, y1: frontFaceY }, bonusSideRight: 16 },
];
const rightP = { wx: 15.5, wy: highY }; clampWorker(rightP, newBlocksRightEdge);
check('side approach (right edge): worker is HELD IN X at the block edge (x -> edge + body-width)', rightP.wx === rightEdge + SIDE_STOP, 'wx=' + rightP.wx);
check('side approach (right edge): worker y is UNTOUCHED (no teleport to the front face)', rightP.wy === highY, 'wy=' + rightP.wy);
// a worker deep in the cross-street (well outside the SIDE_REACH band) stays free — no clamp
const deepStreet = { wx: -6, wy: highY }; clampWorker(deepStreet, newBlocksWithSides);
check('cross-street (deep, outside SIDE_REACH): worker is NOT clamped while strafing the gap', deepStreet.wx === -6 && deepStreet.wy === highY, 'wx=' + deepStreet.wx + ' wy=' + deepStreet.wy);
// a worker approaching the FRONT face from the street (low y) is NOT caught by the side wall
const frontApproach = { wx: 4, wy: frontFaceY + 0.2 }; clampWorker(frontApproach, newBlocksWithSides);
check('front approach (from the street, low y): side wall does not block him, front clamp still applies', Math.abs(frontApproach.wy - stopY) < 1e-6, 'wy=' + frontApproach.wy);

console.log('\nOVERTIME STORE WALL: ' + (ok ? 'ALL CHECKS PASS' : 'FAILURES FOUND'));
process.exit(ok ? 0 : 1);
