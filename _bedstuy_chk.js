// _bedstuy_chk.js — validate Bed-Stuy (BROOKLYN, level 7, Sunday) is its OWN level:
//   1) inline scripts parse,
//   2) isBedStuyLevel() gates on BROOKLYN + BED-STUY; isFlatbushLevel() is FLATBUSH-ONLY,
//   3) makeBedStuyApartment = its own Mott-Haven-style brownstone row house (no porch/lawn),
//   4) makeBedStuyStore = its own storefront (Mott Haven shell + Manhattan storefront + sign),
//   5) BEDSTUY_STORE_NAMES = 32 unique names (chinese / fried chicken / bodega / phone),
//   6) wired in: pool gated on area BED-STUY, residential -> makeBedStuyApartment,
//      corner stores -> makeBedStuyStore,
//   7) geometry: HOUSE_Y 9.5, concrete no-lawn ground, spawn/creature cap 4.8,
//   8) storm debris (debris box + wood pile) + 2x "double time" scoring preserved,
//   9) Bed-Stuy does NOT inherit Flatbush tricycles / soccer / the 3-doghouse count.
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

// Extract a top-level function body by name (brace-balanced).
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) return '';
  const open = html.indexOf('{', start);
  let depth = 0,
    i = open;
  for (; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  return html.slice(start, i);
}

const checks = [];
const add = (name, pass, detail) => checks.push([name, !!pass, detail || '']);

// ---- 2) identity helpers ----
add(
  'isBedStuyLevel() exists and gates on BROOKLYN + BED-STUY',
  /function isBedStuyLevel\(\)[\s\S]*?borough === "BROOKLYN"[\s\S]*?area === "BED-STUY"/.test(
    html,
  ),
);
add(
  'isFlatbushLevel() is FLATBUSH-ONLY (borough BROOKLYN + area FLATBUSH)',
  /function isFlatbushLevel\(\)[\s\S]*?borough === "BROOKLYN"[\s\S]*?area === "FLATBUSH"/.test(
    html,
  ),
);

// ---- 3) makeBedStuyApartment (own brownstone row house) ----
const apt = extract('makeBedStuyApartment');
add('makeBedStuyApartment exists', apt.length > 100);
add(
  'Bed-Stuy row house: full 8u cell, Mott Haven footprint (w 8, d 4.5, h 5.5)',
  /const w = 8\.0/.test(apt) && /d = 4\.5/.test(apt) && /h = 5\.5/.test(apt),
);
add(
  'Bed-Stuy row house: 6-step row-house stoop (makeRowHouseStoop d, 6, 0.17, 0.3)',
  apt.indexOf('makeRowHouseStoop(d, 6, 0.17, 0.3)') >= 0,
);
add(
  'Bed-Stuy row house: exposes step + stairs + buildingFront (worker stops at door)',
  apt.indexOf('g.userData.step = {') >= 0 &&
    apt.indexOf('g.userData.stairs = []') >= 0 &&
    apt.indexOf('g.userData.buildingFront = {') >= 0,
);
add(
  'Bed-Stuy row house: NO front porch / NO lawn (not the Flatbush porch house)',
  apt.indexOf('makeFlatbushHouse') < 0 && apt.indexOf('porch') < 0,
);
add(
  'Bed-Stuy row house: thin buildingFront stop line (hd: 0) so the worker can walk up the stoop',
  /buildingFront = \{[\s\S]*?hd: 0/.test(apt),
);

// ---- 4) makeBedStuyStore (own storefront) ----
const store = extract('makeBedStuyStore');
add('makeBedStuyStore exists', store.length > 100);
add(
  'Bed-Stuy store: Mott Haven shell (w 8, d 4.5, h 5.5) + Manhattan storefront (kickplate+window+door+mat+sign)',
  /const w = 8\.0/.test(store) &&
    store.indexOf('kickplate') >= 0 &&
    store.indexOf('winGlass') >= 0 &&
    store.indexOf('doorGlass') >= 0 &&
    store.indexOf('makeStoreSignMaterial') >= 0,
);
add(
  'Bed-Stuy store: thin buildingFront stop line + mat step (top 0.33)',
  store.indexOf('buildingFront') >= 0 && /top: 0\.33/.test(store),
);

// ---- 5) name pool ----
const poolMatch = html.match(/const BEDSTUY_STORE_NAMES = \[([\s\S]*?)\];/);
const poolText = (poolMatch && poolMatch[1]) || '';
const poolNames = poolText
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('"'));
add('Bed-Stuy store name pool exists', poolMatch !== null);
add('Bed-Stuy pool has ~32 names (>= 30)', poolNames.length >= 30, 'got ' + poolNames.length);
add(
  'Bed-Stuy pool: every name is unique (' +
    new Set(poolNames).size +
    ' of ' +
    poolNames.length +
    ')',
  new Set(poolNames).size === poolNames.length,
);
add(
  'Bed-Stuy pool: chinese restaurants present',
  /CHOW|CHINESE|DUMPLING|NOODLE|WOK|SZECHUAN|DIM SUM/i.test(poolText),
);
add(
  'Bed-Stuy pool: fried chicken spots present',
  /CHICKEN|CLUCK|WINGS|COOP/i.test(poolText),
);
add('Bed-Stuy pool: bodegas present', /BODEGA/i.test(poolText));
add(
  'Bed-Stuy pool: phone shops present',
  /PHONE|iSPY|DIAL TONE|MOBILE|FLIGHT MODE/i.test(poolText),
);

// ---- 6) wiring in spawnWorld / makeBlockContents ----
add(
  'Bed-Stuy pool wired into spawnWorld, gated on area BED-STUY',
  /shuffleStoreNames\(BEDSTUY_STORE_NAMES\)/.test(html) &&
    /area === "BED-STUY"[\s\S]*?BEDSTUY_STORE_NAMES/.test(html),
);
add(
  'makeBlockContents: Bed-Stuy corner stores dispatch to makeBedStuyStore',
  /storeArea === "BED-STUY"[\s\S]*?makeBedStuyStore\(storeOptions\)/.test(html),
);
add(
  'makeBlockContents: Bed-Stuy residential houses use makeBedStuyApartment (not the Flatbush porch house)',
  /isBedStuyLevel\(\)\s*\?\s*makeBedStuyApartment/.test(html),
);

// ---- 7) geometry ----
add(
  'Bed-Stuy HOUSE_Y = 9.5 (Mott Haven setback, no porch)',
  /isBedStuyLevel\(\)\)\s*HOUSE_Y = 9\.5/.test(html),
);
add(
  'Bed-Stuy ground: concrete no-lawn apron (shares the Mott Haven branch)',
  /isBronxLevel\(\) \|\| isBedStuyLevel\(\)/.test(html) &&
    /-> Bronx\/Bed-Stuy path: no lawns/.test(html),
);
add(
  'Bed-Stuy spawnMaxY capped at 4.8 (sidewalk only)',
  /function spawnMaxY\(\)[\s\S]*?isBedStuyLevel\(\)\)\s*return 4\.8/.test(html),
);
add(
  'Bed-Stuy creatureMaxY capped at 4.8 (sidewalk only)',
  /function creatureMaxY\(\)[\s\S]*?isBedStuyLevel\(\)\)\s*return 4\.8/.test(html),
);

// ---- 8) storm debris + double scoring ----
add(
  'Bed-Stuy: debris box + wood pile exist on the kind:"bag" pipeline',
  html.indexOf('stormbox') >= 0 &&
    html.indexOf('woodpile') >= 0 &&
    /rollBagType[\s\S]*?isBedStuyLevel/.test(html),
);
add(
  'Bed-Stuy: double-time scoring (scoreMultiplier = isBedStuyLevel() ? 2 : 1, used by addScore)',
  /function scoreMultiplier\(\)[\s\S]*?isBedStuyLevel\(\) \? 2 : 1/.test(html) &&
    /addScore\(/.test(html),
);

// ---- 9) does NOT inherit Flatbush identity ----
add(
  'Bed-Stuy does NOT inherit Flatbush tricycle driveway kids (gate is isFlatbushLevel)',
  /if \(isFlatbushLevel\(\)\) \{[\s\S]*?dt\.isDrivewayTric/.test(html),
);
add(
  'Bed-Stuy does NOT inherit Flatbush soccer teams (gate is isFlatbushLevel)',
  /if \(isFlatbushLevel\(\)\) \{[\s\S]*?SOCCER/.test(html),
);
add(
  'Bed-Stuy does NOT inherit the Flatbush 3-doghouse count (no flatbushDriveways on its dog path)',
  !/isBedStuyLevel\(\)[\s\S]{0,80}flatbushDriveways/.test(html),
);

// ---- 9b) Bed-Stuy street dogs: post-tied stoop dogs (Mott Haven / Bronx style), NO doghouse ----
{
  const buildCase = (function () {
    const s = html.indexOf('case "leashdog": {');
    const open = html.indexOf('{', s);
    let d = 0,
      i = open;
    for (; i < html.length; i++) {
      const c = html[i];
      if (c === '{') d++;
      else if (c === '}') {
        d--;
        if (d === 0) {
          i++;
          break;
        }
      }
    }
    return html.slice(s, i);
  })();
  add(
    'Bed-Stuy leashdog builder: makeBronxLeashDog (post-tied), NO makeDogHouse',
    buildCase.indexOf('if (isBedStuyLevel())') >= 0 &&
      buildCase.indexOf('dg = makeBronxLeashDog(c.dogSize, c.dogCoat);') >= 0 &&
      /if \(isBedStuyLevel\(\)\)[\s\S]*?c\.houseG = null/.test(buildCase),
  );
  const dogCount = html.slice(
    html.indexOf('const dogCount = (isFlatbushLevel() || isStatenIslandLevel())'),
    html.indexOf('const dogCount = (isFlatbushLevel() || isStatenIslandLevel())') + 600,
  );
  const bsClause = dogCount.slice(dogCount.indexOf('isBedStuyLevel()'));
  add(
    'Bed-Stuy dogCount: one post-tied stoop dog per active block (bronxDogBlocks.length, not ? 3)',
    dogCount.indexOf('isBedStuyLevel()') >= 0 &&
      bsClause.indexOf('bronxDogBlocks.length') >= 0 &&
      bsClause.indexOf(' ? 3') < 0,
  );
  add(
    'Bed-Stuy placement + AI route through the Bronx post-tied path (not the generic doghouse)',
    html.indexOf('} else if (isBronxLevel() || isBedStuyLevel()) {') >= 0 &&
      /if \(isBronxLevel\(\) \|\| isBedStuyLevel\(\)\) \{/.test(html) &&
      html.indexOf('isManhattanLevel() || isBronxLevel() || isBedStuyLevel()') >= 0,
  );
}

let all = ok;
for (const [name, pass, detail] of checks) {
  console.log(
    (pass ? 'PASS' : 'FAIL') +
      ' - ' +
      name +
      (detail && !pass ? '  [' + detail + ']' : ''),
  );
  if (!pass) all = false;
}
console.log('\n' + (all ? 'BED-STUY LEVEL: ALL CHECKS PASS' : 'BED-STUY LEVEL: FAILURES FOUND'));
process.exitCode = all ? 0 : 1;