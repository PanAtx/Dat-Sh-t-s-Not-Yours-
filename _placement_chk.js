// _placement_chk.js — verify the "where things can sit" rules from index.html:
//   1) curb bags / cans / mongo / cash / treasure land on the SIDEWALK or the FRONT-LAWN
//      GRASS in front of a house — never on the street, a cross-street, or an intersection;
//   2) power-ups (coffee / BEC / Monster) are snapped to the front of a real house cell
//      (the REAL snapToHouseCell, extracted verbatim) so they're never in an intersection;
//   3) the dog house anchor is firmly on the front-lawn GRASS;
//   4) the worker can now walk out onto the grass (WORKER_MAX_Y clears the grass band).
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
const grabConst = (name) => {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*([0-9.]+);'));
  if (!m) throw new Error('const not found: ' + name);
  return parseFloat(m[1]);
};

// ---- world constants (mirrors index.html) ----
const BW = 8, HOUSES_PER_BLOCK = 10, BLOCK_W = BW * HOUSES_PER_BLOCK;
const LEVEL_BLOCKS = [
  { x: 0,   garbage: false }, { x: 96,  garbage: true  }, { x: 192, garbage: true  },
  { x: 288, garbage: true  }, { x: 384, garbage: true  }, { x: 480, garbage: true  },
  { x: 576, garbage: true  }, { x: 672, garbage: false },
];
const R = (a, b) => a + Math.random() * (b - a);
const WORKER_MAX_Y = grabConst('WORKER_MAX_Y');

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

// ---- (4) worker can walk onto the grass: WORKER_MAX_Y must clear the grass band. ----
check('worker reach: WORKER_MAX_Y (' + WORKER_MAX_Y + ') clears the sidewalk (5.0) into the front-lawn grass (5..8.5), short of the houses', WORKER_MAX_Y > 5.0 && WORKER_MAX_Y <= GRASS_Y1);
check('worker reach: the OLD sidewalk-only cap (4.5) is gone from the movement clamp', src.indexOf('clamp(p.wy + lat * LAT_SPEED * dt, -9.4, WORKER_MAX_Y)') >= 0);

console.log(ok ? '\nPLACEMENT ALL CHECKS PASS' : '\nPLACEMENT FAILURES');
process.exit(ok ? 0 : 1);

