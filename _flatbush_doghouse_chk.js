// _flatbush_doghouse_chk.js — verify the Brooklyn/Flatbush doghouse fix:
//   spawnWorld places exactly 3 leashdogs on fixed driveways, and the
//   off-screen recycling in updateCreatures must NOT teleport them down the
//   route (the bug: dogs kept recycling, so 7+ houses showed up). This runs the
//   REAL leashdog case body extracted verbatim from index.html and walks the
//   player past each dog to prove the Flatbush houses stay put while other
//   levels still recycle normally.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.THREE = require(path.join(__dirname, '_three128.js'));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

// (a) inline scripts still parse
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- helpers (mirror index.html) ----
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0.3;
const dynamicGroup = { add(){}, remove(){} };
const Voice = { say(){} };
const p = { wx: 0, wy: 2.5 };

// ---- extract the REAL leashdog case body (brace-counted) from updateCreatures ----
// NOTE: there are TWO `case 'leashdog':{` in index.html - one in the spawner
// (calls makeHighPolyDog/makeDogHouse, not stubbed here) and the one in
// updateCreatures that does the off-screen recycling. We must anchor to the
// updateCreatures definition so indexOf lands on the recycle case.
function extractLeashDogCase(){
  const fnStart = src.indexOf('function updateCreatures(dt){');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf("case 'leashdog':{", fnStart);
  if (start < 0) throw new Error('leashdog case not found in updateCreatures');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);   // "case 'leashdog':{ ... break; }"
}
const caseText = extractLeashDogCase();
// Wrap the exact case body in a switch so its `break;` is valid, and expose the same
// free variables updateCreatures gives it. tx is recomputed exactly like updateCreatures.
function runLeashDogCase(c, flatbush, flatbushDriveways){
  const fn = new Function('c', 'p', 'dt', 'R', 'GZ', 'dynamicGroup', 'isFlatbushLevel', 'Voice', 'flatbushDriveways',
    'const tx = c.wx - p.wx;\nswitch (c.type){' + caseText + '}');
  return fn(c, p, 0.016, R, GZ, dynamicGroup, () => flatbush, Voice, flatbushDriveways);
}
// Build a leashdog at a FIXED driveway spawn (mirrors spawnWorld's Flatbush placement).
function makeFlatbushDog(anchorX, anchorY){
  const houseG = { position: { set(){ } }, parent: dynamicGroup };
  const c = {
    type: 'leashdog',
    anchorX: anchorX, anchorY: anchorY,
    homeX: anchorX, homeY: anchorY - 0.6,
    wx: anchorX, wy: anchorY - 0.6,
    agro: 0, barkCd: 0, bark: 0, chainR: 3.0, phase: 0,
    g: { rotation: { z: 0 } },
    chain: { scale: { x: 1 }, position: { set(){ } }, rotation: { z: 0 } },
    houseG: houseG,
  };
  c.g.position = { set(){ } };
  return c;
}

// ---- 1) Flatbush: exactly 3 dogs spawn ----
check('Flatbush spawns 3 leashdogs (dogCount)', /dogCount\s*=\s*isFlatbushLevel\(\)\s*\?\s*3\s*:\s*1/.test(src));

// ---- 2) Flatbush: off-screen dog does NOT get teleported (stays on its driveway) ----
let flatbushOk = true; let detail = '';
for (let t = 0; t < 2000; t++){
  const ax = 200, ay = 6.5;                       // a fixed driveway spawn, mid-route
  const c = makeFlatbushDog(ax, ay);
  p.wx = c.wx + 70;                               // worker far AHEAD -> tx = c.wx - p.wx < -55
  const before = { ax: c.anchorX, ay: c.anchorY, hx: c.houseG.position ? undefined : undefined };
  runLeashDogCase(c, true, []);                   // flatbush = true
  const sameAnchor = Math.abs(c.anchorX - ax) < 1e-9 && Math.abs(c.anchorY - ay) < 1e-9;
  const sameHouse  = c.houseG.parent === dynamicGroup;
  if (!(sameAnchor && sameHouse)){ flatbushOk = false; detail = 'anchor=(' + c.anchorX + ',' + c.anchorY + ') expected=(' + ax + ',' + ay + ')'; break; }
}
check('Flatbush leashdog stays STATIC off-screen (no teleport, house never removed) across 2000 trials', flatbushOk, detail);

// ---- 3) Other levels: recycling still works (anchor moves ahead of the player) ----
let otherOk = true; let otherDetail = '';
for (let t = 0; t < 500; t++){
  const c = makeFlatbushDog(10, 7.6);             // some spawn far BEHIND where the player now is
  p.wx = c.wx + 70;                               // tx < -55 -> should recycle
  runLeashDogCase(c, false, []);                  // flatbush = false
  if (!(c.anchorX > p.wx + 40)){ otherOk = false; otherDetail = 'anchorX=' + c.anchorX + ' p.wx=' + p.wx; break; }
}
check('non-Flatbush leashdog still recycles ahead of the player (regression guard)', otherOk, otherDetail);

// ---- 4) The old Flatbush teleport branch is gone from updateCreatures ----
check('updateCreatures no longer references flatbushDriveways', caseText.indexOf('flatbushDriveways') < 0);
check('leashdog recycle guard now excludes Flatbush', /tx\s*<\s*-55\s*&&\s*!isFlatbushLevel\(\)/.test(caseText));

console.log(ok ? '\nFLATBUSH DOGHOUSE CHECKS PASSED' : '\nFLATBUSH DOGHOUSE CHECKS FAILED');
process.exit(ok ? 0 : 1);
