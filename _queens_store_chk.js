// _queens_store_chk.js — validate the Maspeth (QUEENS, level 4) corner stores:
// 1) all inline scripts in index.html still parse,
// 2) a Maspeth store name pool exists with 32 unique funny Polish/Irish names,
//    covering bakeries / kielbasa & pierogi / delis with lotto / pizza / florist /
//    Irish imports / real estate / pharmacy / laundromats,
// 3) makeQueensStore uses the Flatbush-style two-story shell + the Manhattan storefront,
// 4) exactly ONE store per block at a RANDOM corner that is frozen for the session
//    (stable across level restarts — module-level QUEENS_STORE_CORNERS, set once),
// 5) the pool + storefront are wired in gated on borough === "QUEENS",
// 6) makeBlockContents dispatches Maspeth stores to makeQueensStore.
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

// Pull the Maspeth pool literal for the per-name / per-category checks.
const poolMatch = html.match(/const MASPETH_STORE_NAMES = \[([\s\S]*?)\];/);
const poolText = (poolMatch && poolMatch[1]) || '';
const poolNames = poolText
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('"'));

const checks = [
  ['Maspeth store name pool exists', /const MASPETH_STORE_NAMES = \[/.test(html)],
  ['Maspeth pool has exactly 32 names', poolNames.length === 32],
  [
    'every Maspeth store name is unique (32 different names)',
    new Set(poolNames).size === poolNames.length && poolNames.length === 32,
  ],
  // --- requested store-type coverage (each category appears in the pool) ---
  ['Polish bakery present', /PIEKARNIA|BREAD|BAKERY/i.test(poolText)],
  ['Polish kielbasa & pierogi present', /PIEROGI|KIJBASA|KIELBASA/i.test(poolText)],
  ['corner deli present', /DELI/i.test(poolText)],
  ['deli with lotto / lottery present', /LOTTO|LOTTERY/i.test(poolText)],
  ['pizza place present', /PIZZA|PIEZZA/i.test(poolText)],
  ['florist present', /FLORIST|FLOWER/i.test(poolText)],
  ['Irish imports present', /IRISH|SHAMROCK|DUBLIN/i.test(poolText)],
  ['real estate agent present', /REALTY|REAL ESTATE|OWN THE CORNER/i.test(poolText)],
  ['pharmacy present', /PHARMACY|DRUG/i.test(poolText)],
  ['laundromat present', /LAUND|WASH & FOLD/i.test(poolText)],
  // --- builder ---
  ['Maspeth corner store width = 6.5u (copied from Flatbush)', /const QUEENS_STORE_W = 6\.5;/.test(html)],
  [
    'makeQueensStore uses the two-story shell (w QUEENS_STORE_W, d 4.8, h 5.4)',
    /function makeQueensStore\(storeOptions\) \{[\s\S]*?const w = QUEENS_STORE_W,[\s\S]*?d = 4\.8,[\s\S]*?h = 5\.4;/.test(
      html,
    ),
  ],
  [
    'makeQueensStore reuses the Flatbush residential palette',
    /function makeQueensStore[\s\S]*?0x8a5a3b[\s\S]*?0xb08954[\s\S]*?0x4a6a5a/.test(
      html,
    ),
  ],
  [
    'makeQueensStore keeps the Manhattan storefront (door + mat + sign)',
    /function makeQueensStore\(storeOptions\) \{[\s\S]*?const doorX = storeOptions\.isLeft \? -2\.6 : 2\.6;[\s\S]*?const mat = BX\(1\.0, 0\.4, 0\.04, M\(0x555555\)\);[\s\S]*?signPlane/.test(
      html,
    ),
  ],
  [
    'makeQueensStore has a thin buildingFront stop line',
    /function makeQueensStore[\s\S]*?g\.userData\.buildingFront = \{[\s\S]*?hd: 0,[\s\S]*?\};/.test(
      html,
    ),
  ],
  [
    'makeQueensStore exposes the mat as a step under the door (top 0.33)',
    /function makeQueensStore[\s\S]*?g\.userData\.step = \{[\s\S]*?cx: doorX,[\s\S]*?top: 0\.33,[\s\S]*?\};/.test(
      html,
    ),
  ],
  // --- placement: ONE store per block at a random, session-frozen corner ---
  [
    'Maspeth store corner choice is a module-level variable (persists across restarts)',
    /let QUEENS_STORE_CORNERS = null;/.test(html),
  ],
  [
    'pickQueensStoreCorners() generates one random corner per block',
    /function pickQueensStoreCorners\(\) \{[\s\S]*?for \(let b = 0; b < LEVEL_BLOCKS\.length; b\+\+\)[\s\S]*?Math\.random\(\) < 0\.5;/.test(
      html,
    ),
  ],
  [
    'corner choice is frozen once per session (only set when null)',
    /if \(isQueens && QUEENS_STORE_CORNERS === null\)[\s\S]*?QUEENS_STORE_CORNERS = pickQueensStoreCorners\(\);/.test(
      html,
    ),
  ],
  [
    'exactly ONE Maspeth store per block: only the frozen corner becomes a store',
    /isQueens &&[\s\S]*?\(i === 0 \|\| i === housesN - 1\)[\s\S]*?\(i === 0\) === QUEENS_STORE_CORNERS\[blkIdx\]/.test(
      html,
    ),
  ],
  [
    'Maspeth store corner is the block END (housesN-1), not the 10-house last index',
    /const housesN = isQueens \? QUEENS_HOUSES_PER_BLOCK : HOUSES_PER_BLOCK;[\s\S]*?\(i === 0 \|\| i === housesN - 1\)/.test(
      html,
    ),
  ],
  [
    'Maspeth corner store anchors to the block OUTER edge (isLeft => left corner, else right)',
    /if \(isQueensStore\) \{[\s\S]*?const halfW = QUEENS_STORE_W \/ 2;[\s\S]*?hg\.position\.x = storeOptions\.isLeft \? halfW : BW - halfW;/.test(
      html,
    ),
  ],
  // --- denser Maspeth street: 12 buildings per 80u block ---
  [
    'Maspeth packs 12 buildings per block (2x 8u corner cells + 10x 6.4u middle cells)',
    /const QUEENS_HOUSES_PER_BLOCK = 12;[\s\S]*?const QUEENS_MID_W = \(BLOCK_W - 2 \* BW\) \/ \(QUEENS_HOUSES_PER_BLOCK - 2\);/.test(
      html,
    ),
  ],
  [
    'Maspeth cells tile the full 80u block (x + width lands exactly on the block edge)',
    (function () {
      const mW = html.match(/function queensCellW\(i\) \{[\s\S]*?\n\s*\}/);
      const mX = html.match(/function queensCellX\(i\) \{[\s\S]*?\n\s*\}/);
      if (!mW || !mX) return false;
      const scope =
        'const BW = 8, BLOCK_W = 80, QUEENS_HOUSES_PER_BLOCK = 12, QUEENS_MID_W = (BLOCK_W - 2 * BW) / (QUEENS_HOUSES_PER_BLOCK - 2);\n' +
        mW[0] +
        '\n' +
        mX[0] +
        '\n';
      const f = new Function(
        scope +
          'for (let i = 0; i < QUEENS_HOUSES_PER_BLOCK; i++) { const w = queensCellW(i), x = queensCellX(i); if (!(w > 0 && x >= 0 && x + w <= BLOCK_W + 1e-9)) return false; } return queensCellX(QUEENS_HOUSES_PER_BLOCK - 1) + queensCellW(QUEENS_HOUSES_PER_BLOCK - 1) === BLOCK_W && queensCellW(0) === 8 && queensCellW(11) === 8 && QUEENS_MID_W === 6.4;',
      );
      return f();
    })(),
  ],
  [
    'Maspeth houses sit at their own cell centers (6.4u middle cells -> tighter rows)',
    /hg\.position\.x = isQueensBlock \? cellW \/ 2 : 4\.0;/.test(html),
  ],
  // --- wiring (Queens only) ---
  [
    'Maspeth pool wired into spawnWorld, gated on borough QUEENS',
    /else if \(borough === "QUEENS"\) \{[\s\S]*?shuffleStoreNames\(MASPETH_STORE_NAMES\)/.test(
      html,
    ),
  ],
  [
    'makeBlockContents builds Maspeth stores with makeQueensStore',
    /else if \(borough === "QUEENS"\) hg = makeQueensStore\(storeOptions\);/.test(
      html,
    ),
  ],
  [
    'Maspeth store dispatch is borough-gated on QUEENS (not any other borough)',
    /const isQueensStore =[\s\S]*?borough === "QUEENS";/.test(html),
  ],
  // --- ground: green lawns/park, concrete ONLY at the store corners ---
  [
    'Maspeth ground path is borough-gated on QUEENS with green lawns + green park',
    /else if \([\s\S]*?borough === "QUEENS"[^;]*\)[\s\S]*?groundStrip\(GW, 3\.5, 0\.3, 6\.75, 0x4d7a3a, GCX\); \/\/ front lawns \(grass\)[\s\S]*?groundStrip\(GW, 15\.5, 0\.3, 16\.25, 0x35522c, GCX\); \/\/ park beyond blocks \(grass\)/.test(
      html,
    ),
  ],
  [
    'Maspeth concrete front-lawn apron is the FULL store cell (apronW = BW = 8u), 0.35 thick',
    /const apronW = BW;/.test(html) &&
      /groundStrip\(apronW, 3\.5, 0\.35, 6\.75, apron, apronCx\);/.test(html),
  ],
  [
    'Maspeth concrete park patch is BW + IW wide (24u) reaching the intersection edge',
    /const parkW = BW \+ IW;/.test(html) &&
      /groundStrip\(parkW, 15\.5, 0\.35, 16\.25, apron, parkCx\);/.test(html),
  ],
  [
    'Maspeth apron tracks the FROZEN store cell (left = first cell center, right = last cell center)',
    /const apronCx = isLeft[\s\S]*?bl\.x \+ BW \/ 2[\s\S]*?bl\.x \+ \(HOUSES_PER_BLOCK - 1\) \* BW \+ BW \/ 2/.test(
      html,
    ),
  ],
  [
    'Maspeth park patch wraps the corner (left: bl.x - IW, right: bl.x + BLOCK_W + IW)',
    /const parkCx = isLeft[\s\S]*?bl\.x - IW \+ parkW \/ 2[\s\S]*?bl\.x \+ BLOCK_W \+ IW - parkW \/ 2/.test(
      html,
    ),
  ],
  [
    'Maspeth caps every intersection front-lawn + park band with concrete (Flatbush-style, no green corner patch)',
    (() => {
      const i = html.indexOf('Maspeth path: green lawns/park');
      return (
        i >= 0 &&
        /for \(const xInt of LEVEL_XS\) \{\s*groundStrip\(IW, 3\.5, 0\.35, 6\.75, apron, xInt \+ IW \/ 2\);[\s\S]*?groundStrip\(30, 15\.5, 0\.35, 16\.25, apron, xInt \+ IW \/ 2\);/.test(
          html.slice(i),
        )
      );
    })(),
  ],
  [
    'buildGround freezes the corner choice too (concrete matches the store across restarts)',
    /QUEENS_STORE_CORNERS === null\)[\s\S]*?QUEENS_STORE_CORNERS = pickQueensStoreCorners\(\);/.test(
      html,
    ) &&
      (html.match(/QUEENS_STORE_CORNERS = pickQueensStoreCorners\(\);/g) || [])
        .length >= 2,
  ],
  // --- trees: no tree in front of a store, sidewalk placement, corner properties tree-free ---
  [
    'no tree spawns in front of a store (store cells are tree-free)',
    /!mailboxAt\(\s*b\.blockX,\s*houseIdx,[\s\S]*?\) &&[\s\S]*?!\(storeOptions && storeOptions\.isStore\)/.test(
      html,
    ),
  ],
  [
    'Maspeth trees are SIDEWALK trees near the curb (not on the front lawn)',
    /const isSidewalkTree =[\s\S]*?borough === "THE BRONX" \|\|[\s\S]*?isQueensBlock;[\s\S]*?const t = isSidewalkTree \? makeSidewalkTree\(\) : makeTree\(\);[\s\S]*?ty = isSidewalkTree \? R\(0\.8, 1\.8\) : R\(6, 7\.5\);/.test(
      html,
    ),
  ],
  [
    'Maspeth corner properties are tree-free (both block corners: store corner AND house corner)',
    /!\(storeOptions && storeOptions\.isStore\) &&[\s\S]*?!\([\s\S]*?isQueensBlock &&[\s\S]*?houseIdx === 0 \|\| houseIdx === QUEENS_HOUSES_PER_BLOCK - 1/.test(
      html,
    ),
  ],
  // --- ensure we did NOT touch the Flatbush two-corner logic ---
  [
    'Flatbush still gets stores on BOTH corners (i === 0 || last) unchanged',
    /isFlatbush\)[\s\S]*?\(i === 0 \|\| i === HOUSES_PER_BLOCK - 1\)/.test(html),
  ],
];
let all = ok;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!pass) all = false;
}
console.log(
  all ? '\nQUEENS (MASPETH) STORES: ALL CHECKS PASS' : '\nQUEENS (MASPETH) STORES: FAILURES FOUND',
);
process.exit(all ? 0 : 1);