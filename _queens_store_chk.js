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
    /isQueens &&[\s\S]*?\(i === 0 \|\| i === HOUSES_PER_BLOCK - 1\)[\s\S]*?\(i === 0\) === QUEENS_STORE_CORNERS\[blkIdx\]/.test(
      html,
    ),
  ],
  [
    'Maspeth corner store anchors to the block OUTER edge (isLeft => left corner, else right)',
    /if \(isQueensStore\) \{[\s\S]*?const halfW = QUEENS_STORE_W \/ 2;[\s\S]*?hg\.position\.x = storeOptions\.isLeft \? halfW : BW - halfW;/.test(
      html,
    ),
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
    'Maspeth concrete front-lawn apron is QUEENS_STORE_W wide, 0.35 thick, at the store corner',
    /groundStrip\(QUEENS_STORE_W, 3\.5, 0\.35, 6\.75, apron, cx\);/.test(html),
  ],
  [
    'Maspeth concrete park patch behind the store (QUEENS_STORE_W wide, full park band)',
    /groundStrip\(QUEENS_STORE_W, 15\.5, 0\.35, 16\.25, apron, cx\);/.test(html),
  ],
  [
    'Maspeth concrete corners track the FROZEN store corner (left = block start, right = block end)',
    /QUEENS_STORE_CORNERS\[bi\][\s\S]*?bl\.x \+ halfStore[\s\S]*?bl\.x \+ \(HOUSES_PER_BLOCK - 1\) \* BW \+ \(BW - halfStore\)/.test(
      html,
    ),
  ],
  [
    'buildGround freezes the corner choice too (concrete matches the store across restarts)',
    /QUEENS_STORE_CORNERS === null\)[\s\S]*?QUEENS_STORE_CORNERS = pickQueensStoreCorners\(\);/.test(
      html,
    ) &&
      (html.match(/QUEENS_STORE_CORNERS = pickQueensStoreCorners\(\);/g) || [])
        .length >= 2,
  ],
  // --- trees: no tree in front of a store ---
  [
    'no tree spawns in front of a store (store cells are tree-free)',
    /!mailboxAt\(b\.blockX, houseIdx\) &&[\s\S]*?!\(storeOptions && storeOptions\.isStore\)/.test(
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