// _flatbush_store_chk.js — validate the Flatbush (BROOKLYN, area FLATBUSH) corner stores:
// 1) all inline scripts in index.html still parse,
// 2) a Flatbush store name pool exists with ~32 unique funny Jewish-neighborhood names,
//    covering bagels / kosher delis / produce / hats / thrift / kids / kosher Chinese
//    / dry cleaners / bakeries / a West Indian mini-market / a laundromat,
// 3) makeFlatbushStore uses the Flatbush two-story shell + the Manhattan storefront,
// 4) the pool + storefront are wired in gated on area === "FLATBUSH" (Bed-Stuy stays plain),
// 5) makeBlockContents dispatches Flatbush stores to makeFlatbushStore.
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

// Pull the Flatbush pool literal for the per-name / per-category checks.
const poolMatch = html.match(/const FLATBUSH_STORE_NAMES = \[([\s\S]*?)\];/);
const poolText = (poolMatch && poolMatch[1]) || '';
const poolNames = poolText
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('"'));

const checks = [
  ['Flatbush store name pool exists', /const FLATBUSH_STORE_NAMES = \[/.test(html)],
  [
    'Flatbush pool has ~32 names (>= 30, plenty for 8 blocks x 2 corners)',
    poolNames.length >= 30 && poolNames.length <= 40,
  ],
  [
    'every Flatbush store name is unique (32 different names)',
    poolNames.length >= 30 && new Set(poolNames).size === poolNames.length,
  ],
  // --- requested store-type coverage (each category appears in the pool) ---
  ['bagel store present', /BAGEL/i.test(poolText)],
  ['kosher deli present', /KOSHER DELI/i.test(poolText)],
  ['produce / vegetable stand present', /PRODUCE|VEGETABLE/i.test(poolText)],
  ['hat store present', /HAT/i.test(poolText)],
  ['bargain / thrift store present', /THRIFT|BARGAIN/i.test(poolText)],
  ['children clothing store present', /KIDS|CHILDREN/i.test(poolText)],
  ['kosher Chinese restaurant present', /KOSHER CHINESE/i.test(poolText)],
  ['dry cleaner / tailor present', /DRY CLEAN|TAILOR/i.test(poolText)],
  ['kosher bakery / bread present', /BAKER|BREAD/i.test(poolText)],
  [
    'West Indian / Caribbean mini-market present',
    /MINI-MARKET|MINI-MART/i.test(poolText),
  ],
  ['laundromat present', /LAUND/i.test(poolText)],
  // --- builder ---
  [
    'Flatbush corner store width = 8u cell minus half a full driveway (3.0 / 2 = 1.5) => 6.5u',
    /const FLATBUSH_STORE_W = 6\.5;/.test(html),
  ],
  [
    'makeFlatbushStore uses the Flatbush two-story shell (w FLATBUSH_STORE_W, d 4.8, h 5.4)',
    /function makeFlatbushStore\(storeOptions\) \{[\s\S]*?const w = FLATBUSH_STORE_W,[\s\S]*?d = 4\.8,[\s\S]*?h = 5\.4;/.test(
      html,
    ),
  ],
  [
    'makeFlatbushStore reuses the Flatbush residential palette',
    /function makeFlatbushStore[\s\S]*?0x8a5a3b[\s\S]*?0xb08954[\s\S]*?0x4a6a5a/.test(
      html,
    ),
  ],
  [
    'makeFlatbushStore keeps the Manhattan storefront (door + mat + sign)',
    /function makeFlatbushStore\(storeOptions\) \{[\s\S]*?const doorX = storeOptions\.isLeft \? -2\.6 : 2\.6;[\s\S]*?const mat = BX\(1\.0, 0\.4, 0\.04, M\(0x555555\)\);[\s\S]*?signPlane/.test(
      html,
    ),
  ],
  [
    'makeFlatbushStore has a thin buildingFront stop line',
    /function makeFlatbushStore[\s\S]*?g\.userData\.buildingFront = \{[\s\S]*?hd: 0,[\s\S]*?\};/.test(
      html,
    ),
  ],
  [
    'makeFlatbushStore stop line sits at the kick-plate face (0.4 proud of wall)',
    /function makeFlatbushStore[\s\S]*?buildingFront = \{[\s\S]*?cy: -d \/ 2 - 0\.4,/.test(
      html,
    ),
  ],
  [
    'makeFlatbushStore exposes the mat as a step under the door (top 0.33)',
    /function makeFlatbushStore[\s\S]*?g\.userData\.step = \{[\s\S]*?cx: doorX,[\s\S]*?top: 0\.33,[\s\S]*?\};/.test(
      html,
    ),
  ],
  // --- placement: corner stores must clear the driveway ---
  [
    'Flatbush corner store anchors to the block OUTER edge (isLeft => left corner, else right corner)',
    /if \(isFlatbushStore\) \{[\s\S]*?const halfW = FLATBUSH_STORE_W \/ 2;[\s\S]*?hg\.position\.x = storeOptions\.isLeft \? halfW : BW - halfW;/.test(
      html,
    ),
  ],
  [
    'makeBlockContents tracks the store\'s actual x in houseX (not a hardcoded 4.0)',
    /const houseX = baseX \+ hg\.position\.x;/.test(html),
  ],
  [
    'Flatbush store placement is area-gated on FLATBUSH (Bed-Stuy stays plain)',
    /const isFlatbushStore =[\s\S]*?borough === "BROOKLYN" &&[\s\S]*?LEVEL_DAYS\[level - 1\]\.area === "FLATBUSH";/.test(
      html,
    ),
  ],
  // --- wiring (Flatbush only, Bed-Stuy stays plain) ---
  [
    'Flatbush pool wired into spawnWorld, gated on area FLATBUSH',
    /else if \(borough === "BROOKLYN" && area === "FLATBUSH"\) \{[\s\S]*?shuffleStoreNames\(FLATBUSH_STORE_NAMES\)/.test(
      html,
    ),
  ],
  [
    'storefront condition is area-gated (Flatbush, not any BROOKLYN borough)',
    /const isFlatbush = borough === "BROOKLYN" && area === "FLATBUSH";/.test(html),
  ],
  [
    'Bed-Stuy (SUNDAY) has NO unconditional BROOKLYN store pool',
    !/else if \(borough === "BROOKLYN"\) \{[\s\S]*?shuffleStoreNames/.test(html),
  ],
  [
    'makeBlockContents builds Flatbush stores with makeFlatbushStore',
    /storeArea === "FLATBUSH"[\s\S]*?makeFlatbushStore\(storeOptions\)/.test(html),
  ],
  // --- ground: Flatbush houses keep green lawns, corner stores get concrete aprons, back park concrete ---
  [
    'Flatbush front lawns are green (residential houses), gated on area FLATBUSH',
    /area === "FLATBUSH"[\s\S]*?groundStrip\(GW, 3\.5, 0\.3, 6\.75, 0x4d7a3a/.test(
      html,
    ),
  ],
  [
    'Flatbush back park is concrete (no grass), gated on area FLATBUSH',
    /area === "FLATBUSH"[\s\S]*?groundStrip\(GW, 15\.5, 0\.3, 16\.25, 0x8d949c/.test(
      html,
    ),
  ],
  [
    'Flatbush corner-store aprons are concrete (left + right per block), gated on area FLATBUSH',
    /area === "FLATBUSH"[\s\S]*?const halfStore = FLATBUSH_STORE_W \/ 2;[\s\S]*?groundStrip\(FLATBUSH_STORE_W, 3\.5, 0\.35, 6\.75, apron, bl\.x \+ halfStore\);[\s\S]*?bl\.x \+ \(HOUSES_PER_BLOCK - 1\) \* BW \+ \(BW - halfStore\)/.test(
      html,
    ),
  ],
  [
    'Flatbush intersection corner patches are concrete in the front-lawn band (no green patch by the corner stores), one per intersection, gated on area FLATBUSH',
    /area === "FLATBUSH"[\s\S]*?for \(const xInt of LEVEL_XS\) \{[\s\S]*?groundStrip\(IW, 3\.5, 0\.35, 6\.75, apron, xInt \+ IW \/ 2\);/.test(
      html,
    ),
  ],
  [
    'Flatbush house front lawns stay green (full-width grass strip under the concrete caps)',
    /area === "FLATBUSH"[\s\S]*?groundStrip\(GW, 3\.5, 0\.3, 6\.75, 0x4d7a3a, GCX\); \/\/ front lawns \(grass\)/.test(
      html,
    ),
  ],
];
let all = ok;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!pass) all = false;
}
console.log(
  all ? '\nFLATBUSH STORES: ALL CHECKS PASS' : '\nFLATBUSH STORES: FAILURES FOUND',
);
process.exit(all ? 0 : 1);