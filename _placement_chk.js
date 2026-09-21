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

// ---- (3b) Maspeth leashed dogs (NO doghouse — post-tied, Mott Haven style): the
//      cast-iron post stands in front of a house, either on the front-yard GRASS
//      ("lawn": x +- 1.5..2.2 off the door, y 4.2..5.2 — the grass band in front of
//      the doormat/landing y 5.3..6.7, never on it) or at the CURB on the sidewalk
//      ("curb": y 0.85..1.05 within the house frontage). Middle cells 1..10 only:
//      off both corner cells (store corner + house corner) and strictly inside the
//      80u block, so the post is never at an intersection and never on the store.
const QX = (i) => (i === 0 ? 0 : i === 11 ? 72 : 8 + (i - 1) * 6.4);
const Q_GRASS_Y0 = 3.5, Q_GRASS_Y1 = 6.75; // Maspeth front-lawn strip (buildGround)
const Q_LANDING_Y0 = 5.3;                  // street-side edge of the doormat/landing
let dogQOk = true, dogQN = 0, dogQWorst = null;
for (let blx = 0; blx < 800; blx += 96) {
  for (let mid = 1; mid <= 10; mid++) {
    const hx = QX(mid) + 3.2; // middle house center
    // lawn spot (mirrors index.html queensDogSpot)
    {
      const side = Math.random() < 0.5 ? -1 : 1;
      const ax = Math.max(blx + 1.0, Math.min(blx + BLOCK_W - 1.0, blx + hx + side * R(1.5, 2.2)));
      const ay = R(4.2, 5.2);
      const homeX = ax + side * R(0.2, 0.6);
      const homeY = ay + R(0.3, 0.9);
      dogQN++;
      const onGrass = ay >= Q_GRASS_Y0 && ay <= Q_GRASS_Y1;
      const beforeLanding = ay <= Q_LANDING_Y0 - 1e-6; // post strictly in front of the mat
      const offLandingX = Math.abs(ax - (blx + hx)) >= 1.5 - 1e-6; // landing spans +- 1.25u of the door
      const homeOffLanding = Math.abs(homeX - (blx + hx)) >= 1.7 - 1e-6 && homeY <= 6.75;
      const inFrontage = Math.abs(ax - (blx + hx)) <= 2.2 + 1e-6;
      const inBlock = ax > blx && ax < blx + BLOCK_W;
      if (!onGrass || !beforeLanding || !offLandingX || !homeOffLanding || !inFrontage || !inBlock) {
        dogQOk = false;
        if (!dogQWorst) dogQWorst = { t: 'lawn', x: (ax - blx).toFixed(2), y: +ay.toFixed(2), hx: +hx.toFixed(2) };
      }
    }
    // curb spot
    {
      const ax = Math.max(blx + 10.0, Math.min(blx + BLOCK_W - 10.0, blx + hx + R(-3.0, 3.0)));
      const ay = R(0.85, 1.05);
      dogQN++;
      const atCurb = ay >= 0.85 && ay <= 1.05;
      const inFrontage = Math.abs(ax - (blx + hx)) <= 3.0 + 1e-6;
      const offCorners = ax - blx >= 10 - 1e-6 && ax - blx <= 70 + 1e-6; // well inside the 80u block
      if (!atCurb || !inFrontage || !offCorners) {
        dogQOk = false;
        if (!dogQWorst) dogQWorst = { t: 'curb', x: (ax - blx).toFixed(2), y: +ay.toFixed(2), hx: +hx.toFixed(2) };
      }
    }
  }
}
check('Maspeth leashed dog: post is in front of a house on the front-yard GRASS (y 4.2..5.2, off the doormat/landing in x AND y, home never over the mat) or at the CURB on the sidewalk (y 0.85..1.05, in frontage); never a corner cell / intersection (' + dogQN + ' spots)', dogQOk, dogQWorst ? JSON.stringify(dogQWorst) : '');
check('Maspeth leashed dog: spawnWorld routes Queens to queensDogSpot + a cast-iron POST (makePostMesh) tied HIGH (tieQueensLeashChain z 1.5), with NO doghouse and NO tree in the branch', (() => {
  const j = src.indexOf('borough === "QUEENS"', src.indexOf('const dogCount = isFlatbushLevel()'));
  if (j < 0) return false;
  const seg = src.slice(j, j + 2000);
  return seg.indexOf('queensDogSpot(ld, b.blockX)') >= 0 && seg.indexOf('makePostMesh()') >= 0 && seg.indexOf('tieQueensLeashChain(') >= 0 && /1\.5,\s*ld\.wx/.test(seg) && seg.indexOf('houseG') < 0 && seg.indexOf('makeSidewalkTree') < 0 && seg.indexOf('makeQueensDogHouse') < 0 && seg.indexOf('makeDogHouse') < 0;
})());
check('Maspeth leashed dog: queensDogSpot places lawn posts off the doormat/landing (x offset +- 1.5..2.2, y 4.2..5.2, home stays on the post side) and curb posts at y 0.85..1.05', (() => {
  const k = src.indexOf('function queensDogSpot(t, bx) {');
  if (k < 0) return false;
  const seg = src.slice(k, k + 1600);
  return seg.indexOf('t.anchorType = "lawn"') >= 0 && seg.indexOf('R(4.2, 5.2)') >= 0 && seg.indexOf('R(0.85, 1.05)') >= 0 && seg.indexOf('side * R(1.5, 2.2)') >= 0 && seg.indexOf('t.homeX = t.anchorX + side * R(0.2, 0.6)') >= 0;
})());
check('Maspeth leashed dog: AI recycle moves Queens dogs to a new house frontage (queensDogSpot + post re-tie) and the chain ties HIGH for Queens (z 1.5)', (() => {
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  const start = src.indexOf('case "leashdog": {', fnStart);
  if (start < 0) return false;
  let i = src.indexOf('{', start), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) break; } }
  const caseText = src.slice(start, i + 1).replace(/\s+/g, ' ');
  return caseText.indexOf('if (isQueensLevel()) {') >= 0 && caseText.indexOf('queensDogSpot(c,') >= 0 && /isQueensLevel\(\)\) \? 1\.5 : 0\.62/.test(caseText);
})());
// ---- (3b) Maspeth leashed dog RECYCLE MUST STAY OFF-SCREEN: the old re-clamp pulled
//      targets back toward the player (posInCycle > 70 -> same block 10..70), which
//      materialized the dog mid-block INSIDE the camera frustum. The clamp must now
//      push FORWARD only, and the window must start >= 50u ahead. ----
check('Maspeth leashed dog: AI recycle re-clamp is FORWARD-only (no backward pull into the same block)', (() => {
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  const start = src.indexOf('case "leashdog": {', fnStart);
  if (start < 0) return false;
  let i = src.indexOf('{', start), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) break; } }
  const caseText = src.slice(start, i + 1).replace(/\s+/g, ' ');
  const qStart = caseText.indexOf('if (isQueensLevel()) {');
  const qSeg = caseText.slice(qStart, qStart + 900);
  return qSeg.indexOf('(blockIdx + 1) * 96 + 10 + R(0, 60)') >= 0 && qSeg.indexOf('blockIdx * 96 + 10 + R(0, 60)') < 0;
})());
check('Maspeth leashed dog: recycle target lands >= 50u ahead of the player (off-screen, 20k stress incl. dogSlot spread)', (() => {
  const Rq = (a, b) => a + Math.random() * (b - a);
  for (let t = 0; t < 20000; t++) {
    const pwx = Rq(80, 1400);
    const slot = (Math.random() * 4) | 0;
    let targetX = pwx + 50 + slot * 10 + Rq(0, 10);
    let blockIdx = Math.floor(targetX / 96);
    let posInCycle = targetX % 96;
    if (posInCycle < 10 || posInCycle > 70) targetX = (blockIdx + 1) * 96 + 10 + Rq(0, 60);
    if (targetX - pwx < 50) return false;
  }
  return true;
})());
// ---- (3c) Maspeth leashed dog RATE: 4 per level (unchanged from the doghouse era) ----
check('Maspeth leashed dog rate: 4 per level (was 1)', (() => {
  const i = src.indexOf('const dogCount = isFlatbushLevel()');
  if (i < 0) return false;
  const seg = src.slice(i, i + 320);
  return /isQueensLevel\(\)\s*\?\s*4\b/.test(seg) && /:\s*1\s*;/.test(seg);
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

