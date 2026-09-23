// _si_house_chk.js — verify the Staten Island (New Dorp) house builder:
// 1) all inline scripts in index.html still parse,
// 2) HOUSE_TPLS maps "STATEN ISLAND" to makeStatenHouse (not the generic makeHouse),
// 3) both variants build headless and honor the collision contract
//    (userData.step, userData.stairs on the colonial, thin buildingFront stop line),
// 4) every mesh has castShadow = false,
// 5) NO corner stores on the level: the store gate never matches borough
//    "STATEN ISLAND" and the ground path stays the plain green-lawns branch.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (label, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  [' + extra + ']' : ''));
  if (!cond) ok = false;
};

// ---- (1) syntax: parse every inline <script> ----
const scripts = [];
const re = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = re.exec(src)) !== null) scripts.push(m[1]);
let synOk = scripts.length > 0;
for (const s of scripts) {
  try {
    new vm.Script(s);
  } catch (e) {
    synOk = false;
    console.log('  script error: ' + e.message);
  }
}
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- (2) registry wiring ----
check(
  'HOUSE_TPLS: STATEN ISLAND -> makeStatenHouse',
  /"STATEN ISLAND":\s*makeStatenHouse,/.test(src),
);
check(
  'HOUSE_TPLS: no borough left on the generic makeHouse',
  !/:\s*makeHouse,/.test(src),
);
check(
  'isStatenIslandLevel() helper exists and gates on the borough name',
  /function isStatenIslandLevel\(\)\s*\{[\s\S]*?borough === "STATEN ISLAND";/.test(src),
);

// ---- (3) headless build of both variants ----
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let depth = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { depth++; started = true; }
    else if (src[j] === '}') {
      depth--;
      if (started && depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}
const fnSrc = grabFn('makeStatenHouse');
check('makeStatenHouse extracted', !!fnSrc, fnSrc ? fnSrc.length + ' chars' : 'missing');

const M = (color) => ({ color });
const R = (a, b) => a; // deterministic (returns the low bound)
function BX(w, h, d, mat) {
  return {
    _kind: 'box', _ext: [w, h, d], _mat: mat,
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
function CY(r1, r2, h, mat, s) {
  return {
    _kind: 'cyl',
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
function SPH(r, mm) {
  return {
    _kind: 'sph',
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
class Group {
  constructor() {
    this.position = { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
    this.children = [];
    this.userData = {};
    this.isMesh = false;
  }
  add(c) { this.children.push(c); }
  traverse(fn) { fn(this); this.children.forEach((c) => fn(c)); }
}
const THREE = {
  Group,
  MeshLambertMaterial: function (opts) { this.color = opts && opts.color; },
};
const factory = new Function('THREE', 'M', 'BX', 'CY', 'SPH', 'R', fnSrc + '\nreturn makeStatenHouse;');
const makeStatenHouse = factory(THREE, M, BX, CY, SPH, R);

// Force the variant with a scripted Math.random sequence:
// call #1 = body color pick, call #2 = the `Math.random() >= 0.5` variant gate,
// call #3 = porch-light gate (0.9 keeps the light OFF -> no glow branch in Node).
function build(variantIsCottage) {
  const seq = [0.1, variantIsCottage ? 0.9 : 0.1, 0.9];
  let i = 0;
  const realRandom = Math.random;
  Math.random = () => (i < seq.length ? seq[i++] : realRandom());
  try {
    return makeStatenHouse();
  } finally {
    Math.random = realRandom;
  }
}
const allMeshesNoCast = (g) => {
  let bad = 0;
  g.traverse((o) => { if (o.isMesh && o.castShadow !== false) bad++; });
  return bad === 0;
};

const cottage = build(true);
check('cottage: builds a group with children', cottage.children.length > 0, cottage.children.length + ' children');
check('cottage: thin landing step top = 0.36', cottage.userData.step && cottage.userData.step.top === 0.36, JSON.stringify(cottage.userData.step && { top: cottage.userData.step.top, hw: cottage.userData.step.hw }));
check('cottage: NO stairs array (ground-level door)', !cottage.userData.stairs);
check('cottage: thin buildingFront stop line (hd: 0)', cottage.userData.buildingFront && cottage.userData.buildingFront.hd === 0, JSON.stringify(cottage.userData.buildingFront));
check('cottage: no mesh casts a shadow', allMeshesNoCast(cottage));
const W0 = 4.8; // deterministic low bound of R(4.8, 5.4) -> colonial width
const colonial = build(false);
check('colonial: builds a group with children', colonial.children.length > 0, colonial.children.length + ' children');
check('colonial: porch landing step top = 0.3 + 0.7 + 0.06 = 1.06', colonial.userData.step && colonial.userData.step.top === 1.06, JSON.stringify(colonial.userData.step && { top: colonial.userData.step.top }));
check('colonial: exactly 3 walkable step boxes', Array.isArray(colonial.userData.stairs) && colonial.userData.stairs.length === 3, 'got ' + (colonial.userData.stairs ? colonial.userData.stairs.length : 0));
if (Array.isArray(colonial.userData.stairs)) {
  const tops = colonial.userData.stairs.map((s) => s.top);
  check('colonial: stair tops descend toward the sidewalk (1.02 / 0.78 / 0.54)', tops[0] === 1.02 && tops[1] === 0.78 && tops[2] === 0.54, JSON.stringify(tops));
  const hwOk = colonial.userData.stairs.every((s) => Math.abs(s.hw - (W0 * 0.8 * 0.45) / 2 - 0.1) < 1e-6);
  check('colonial: stair hw matches the VISUAL step width (porchW*0.45/2 + 0.1)', hwOk, JSON.stringify(colonial.userData.stairs.map((s) => s.hw)));
}
check('colonial: thin stop line at the porch outer face (hd: 0)', colonial.userData.buildingFront && colonial.userData.buildingFront.hd === 0, JSON.stringify(colonial.userData.buildingFront));
check('colonial: no mesh casts a shadow', allMeshesNoCast(colonial));

// ---- (4) NO corner stores on Staten Island ----
check(
  'spawnWorld: store gate never sets isStore for STATEN ISLAND',
  !/borough === "STATEN ISLAND"[\s\S]{0,300}?isStore: true/.test(src),
);
check('no store name pool for STATEN ISLAND', !/STATEN ISLAND[\s\S]{0,120}?shuffleStoreNames/.test(src));
check(
  'ground path: Staten Island stays on the plain green-lawns branch (no concrete store aprons)',
  /Non-Manhattan path: green lawns/.test(src) &&
    !/STATEN ISLAND[\s\S]{0,120}?groundStrip\(/.test(src),
);
check(
  'spawnMaxY caps Staten Island curb items at the sidewalk zone (5.0)',
  /function spawnMaxY\(\)[\s\S]*?isStatenIslandLevel\(\)\) return 5\.0;/.test(src),
);
check(
  'creatureMaxY keeps Staten Island critters off the porch band (5.0)',
  /function creatureMaxY\(\)[\s\S]*?isStatenIslandLevel\(\)\) return 5\.0;/.test(src),
);

// ---- (5) Flatbush-style driveways + doghouses on Staten Island ----
check(
  'driveway slab gate includes STATEN ISLAND (same 3.0u concrete slab + center line as Flatbush)',
  /\(borough === "BROOKLYN" \|\| borough === "STATEN ISLAND"\)[\s\S]{0,120}?BX\(3\.0, 8\.0, 0\.08, M\(0x9a9a9a\)\)/.test(src),
);
check(
  'driveway collection (flatbushDriveways) runs for Staten Island',
  /flatbushDriveways = \[\];\s*if \(isFlatbushLevel\(\) \|\| isStatenIslandLevel\(\)\)/.test(src),
);
check(
  'Staten Island spawns 3 doghouses (dogCount shares the Flatbush 3)',
  /const dogCount = \(isFlatbushLevel\(\) \|\| isStatenIslandLevel\(\)\)\s*\?\s*3/.test(src),
);
check(
  'doghouse placement branch: Staten Island uses the Flatbush driveway placement (middle of the driveway, near the sidewalk)',
  src.indexOf('} else if (isFlatbushLevel() || isStatenIslandLevel()) {') >= 0,
);
check(
  'leashdog off-screen recycle guard excludes Staten Island (doghouses stay put)',
  /c\.wx\s*-\s*p\.wx\s*<\s*-55\s*&&\s*!isFlatbushLevel\(\)\s*&&\s*!isStatenIslandLevel\(\)/.test(src),
);
check(
  'Staten Island trees are SIDEWALK trees (keeps the driveway band clear of lawn trees)',
  /const isSidewalkTree =[\s\S]{0,300}?borough === "STATEN ISLAND"/.test(src),
);

// ---- (6) Garden flags: small flag planted in the front lawn, mostly US + occasional IE/IT ----
check(
  'flag system: addGardenFlag plants a VERTICAL pole in the lawn (base at z=0.3)',
  /const addGardenFlag = \(fx, fy\) => \{/.test(fnSrc) &&
    /pole\.position\.set\(fx, fy, 0\.3 \+ poleL \/ 2\)/.test(fnSrc),
);
check(
  'flag mix: mostly US (70%), occasional Ireland (15%), occasional Italy (15%)',
  /kindRoll < 0\.7 \? "US" : kindRoll < 0\.85 \? "IE" : "IT"/.test(fnSrc),
);
check(
  'flags spawn on most houses (0.85 gate) in BOTH house variants',
  (fnSrc.match(/if \(Math\.random\(\) < 0\.85\)\s*addGardenFlag\(/g) || []).length === 2,
);
check(
  'flag cloth colors: US red/white/blue + Irish green-white-orange + Italian green-white-red',
  fnSrc.indexOf('M(0xb22234)') >= 0 && fnSrc.indexOf('M(0x3c3b6e)') >= 0 &&
    fnSrc.indexOf('M(0x169b62)') >= 0 && fnSrc.indexOf('M(0xff883e)') >= 0 &&
    fnSrc.indexOf('M(0x009246)') >= 0 && fnSrc.indexOf('M(0xce2b37)') >= 0,
);
check(
  'pole geometry: 1.15u silver garden pole + finial ball, small cloth 0.5 x 0.35 on top',
  /const poleL = 1\.15;/.test(fnSrc) && /CY\(0\.028, 0\.022, poleL, M\(0xc8cdd4\)\)/.test(fnSrc) &&
    /SPH\(0\.04, M\(0xd8dce2\)\)/.test(fnSrc) && /CW = 0\.5,/.test(fnSrc),
);
check(
  'flags sit in the FRONT LAWN beside the walkway (cottage in front of the landing, colonial in front of the stoop)',
  /addGardenFlag\([\s\S]{0,120}?-d \/ 2 - 1\.5/.test(fnSrc) &&
    /addGardenFlag\([\s\S]{0,120}?-d \/ 2 - 2\.7/.test(fnSrc),
);
check(
  'no house-mounted pole left (the old 45-degree eave/peak bracket is gone)',
  !/addFrontFlag/.test(fnSrc) && !/Math\.PI \/ 4/.test(fnSrc),
);

// Deterministic flagged builds (COLONIAL variant): scripted random sequence
// covers body color, variant gate, 6 tulip colors, then the flag's rolls
// (spawn < 0.85, lawn side, kind roll, canton side).
function buildFlagged(kindRoll) {
  const seq = [
    0.1, 0.1, // color, variant gate (0.1 < 0.5 -> colonial)
    0.9, 0.1, 0.2, 0.3, 0.4, 0.5, // 6 tulip colors
    0.1, // < 0.85 -> a flag is spawned
    0.2, // lawn side (left/right of the stoop)
    kindRoll,
    0.2, // canton side (US only)
  ];
  let i = 0;
  const realRandom = Math.random;
  Math.random = () => (i < seq.length ? seq[i++] : realRandom());
  try {
    return makeStatenHouse();
  } finally {
    Math.random = realRandom;
  }
}
const flaggedUS = buildFlagged(0.1);
check('flag: US house records userData.flag.kind = "US"', flaggedUS.userData.flag && flaggedUS.userData.flag.kind === 'US');
// d = 4.2 (R low bound): flag base at (±1.7, -d/2 - 2.7) = (±1.7, -4.8), lawn z=0.3
const poleMesh = flaggedUS.children.find(
  (c) => c._kind === 'cyl' && Math.abs(c.position.z - (0.3 + 1.15 / 2)) < 1e-9,
);
check(
  'flag: garden pole planted in the lawn (cylinder base z=0.3, top at 1.45), beside the stoop',
  !!poleMesh && poleMesh.rotation.x === 0 &&
    Math.abs(Math.abs(poleMesh.position.x) - 1.7) < 1e-9 &&
    Math.abs(poleMesh.position.y + 4.8) < 1e-9,
);
const finMesh = flaggedUS.children.find(
  (c) => c._kind === 'sph' && Math.abs(c.position.z - (0.3 + 1.15 + 0.03)) < 1e-9,
);
check('flag: finial ball at the pole tip (z = 1.48)', !!finMesh);
const afterPole = poleMesh ? flaggedUS.children.slice(flaggedUS.children.indexOf(poleMesh) + 1) : [];
check('flag: US cloth = 3 stripes + canton (4 boxes after the pole)', afterPole.filter((c) => c._kind === 'box').length === 4);
const flaggedIE = buildFlagged(0.75);
check('flag: Ireland house records userData.flag.kind = "IE" (3 tricolor bands)', flaggedIE.userData.flag && flaggedIE.userData.flag.kind === 'IE' && (() => {
  const p = flaggedIE.children.find((c) => c._kind === 'cyl' && Math.abs(c.position.z - (0.3 + 1.15 / 2)) < 1e-9);
  return p && flaggedIE.children.slice(flaggedIE.children.indexOf(p) + 1).filter((c) => c._kind === 'box').length === 3;
})());
const flaggedIT = buildFlagged(0.9);
check('flag: Italy house records userData.flag.kind = "IT" (3 tricolor bands)', flaggedIT.userData.flag && flaggedIT.userData.flag.kind === 'IT' && (() => {
  const p = flaggedIT.children.find((c) => c._kind === 'cyl' && Math.abs(c.position.z - (0.3 + 1.15 / 2)) < 1e-9);
  return p && flaggedIT.children.slice(flaggedIT.children.indexOf(p) + 1).filter((c) => c._kind === 'box').length === 3;
})());

console.log(ok ? '\nSTATEN ISLAND HOUSE CHECKS PASSED' : '\nFAILURES DETECTED');
process.exit(ok ? 0 : 1);