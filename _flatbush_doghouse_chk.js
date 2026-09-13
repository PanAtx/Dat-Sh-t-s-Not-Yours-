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
const p = { wx: 0, wy: 2.5, invuln: 0, immuneT: 0, bloodSteps: 0 };

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
// The case body now ALSO runs the BITE logic, so it references extra free vars
// (state / clamp / workerMaxY / hurtNPC / doStun / dropBloodSplatter / WORKER_GENDER /
// HP_HIT_HAZARD); we supply them here, and `rec` lets a test record whether a bite
// actually fired (hurt / stun / blood / speech).
function runLeashDogCase(c, flatbush, flatbushDriveways, rec){
  rec = rec || {}; rec.lines = rec.lines || [];
  const state = 'play';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const workerMaxY = () => 5.0;      // Flatbush cap (mirrors index.html workerMaxY)
  const WORKER_GENDER = 'male';
  const HP_HIT_HAZARD = 5;           // mirrors index.html
  const hurtNPC = (amt) => { rec.hurt = (rec.hurt || 0) + 1; rec.dmg = (rec.dmg || 0) + (amt || 0); };
  const doStun = () => { rec.stun = (rec.stun || 0) + 1; };
  const dropBloodSplatter = () => { rec.blood = (rec.blood || 0) + 1; };
  const VoiceRec = { say: function(line){ rec.lines.push(line); } };
  const fn = new Function('c', 'p', 'dt', 'R', 'GZ', 'dynamicGroup', 'isFlatbushLevel', 'Voice', 'flatbushDriveways',
    'state', 'clamp', 'workerMaxY', 'hurtNPC', 'doStun', 'dropBloodSplatter', 'WORKER_GENDER', 'HP_HIT_HAZARD',
    'const tx = c.wx - p.wx;\nswitch (c.type){' + caseText + '}');
  return fn(c, p, 0.016, R, GZ, dynamicGroup, () => flatbush, VoiceRec, flatbushDriveways,
    state, clamp, workerMaxY, hurtNPC, doStun, dropBloodSplatter, WORKER_GENDER, HP_HIT_HAZARD);
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

// ---- 5) BITE: a leashed dog that the worker lingers in range of (dWorker < 0.85)
// latches on: it damages (HP_HIT_HAZARD), stuns, knocks the worker back away from the
// dog, makes both characters speak, splatters blood, and sets the worker bleeding
// (p.bloodSteps). i-frames / Monster immunity absorb the bite entirely. ----
// 5a) In range and not i-framed -> a bite fires exactly once.
{
  const c = makeFlatbushDog(100, 6.5);           // home (100, 5.9)
  p.wx = c.wx + 0.5; p.wy = c.wy + 0.3;          // dWorker ~= 0.58 < 0.85
  p.invuln = 0; p.immuneT = 0; p.bloodSteps = 0;
  const rec = {};
  const beforeX = p.wx, beforeY = p.wy;
  runLeashDogCase(c, true, [], rec);
  const knockedAway = Math.hypot(p.wx - beforeX, p.wy - beforeY) > 0.5;
  check('leashdog BITE fires when worker lingers in range (<0.85)', rec.hurt === 1 && rec.dmg === 5 && rec.stun === 1,
    'hurt=' + (rec.hurt || 0) + ' dmg=' + (rec.dmg || 0) + ' stun=' + (rec.stun || 0));
  check('bite knocks the worker back AWAY from the dog', knockedAway,
    'moved ' + Math.hypot(p.wx - beforeX, p.wy - beforeY).toFixed(2) + ' from the dog');
  check('bite splatters blood and starts the worker bleeding', rec.blood >= 1 && p.bloodSteps === 12,
    'blood=' + (rec.blood || 0) + ' bloodSteps=' + p.bloodSteps);
  check('bite makes the worker + dog speak', rec.lines.indexOf('Ow! He bit me!') >= 0 && rec.lines.indexOf('GRRR! GRRR!') >= 0,
    JSON.stringify(rec.lines));
}
// 5b) Same range but i-framed -> the bite is absorbed (no damage / stun / blood / speech).
{
  const c = makeFlatbushDog(100, 6.5);
  p.wx = c.wx + 0.5; p.wy = c.wy + 0.3;
  p.invuln = 1; p.immuneT = 0; p.bloodSteps = 0;
  const rec = {};
  runLeashDogCase(c, true, [], rec);
  const noBiteLines = rec.lines.indexOf('Ow! He bit me!') < 0 && rec.lines.indexOf('GRRR! GRRR!') < 0;
  check('bite is ABSORBED while i-framed (no damage / stun / blood / bite-speech)',
    !rec.hurt && !rec.stun && !rec.blood && noBiteLines && p.bloodSteps === 0,
    'hurt=' + (rec.hurt || 0) + ' stun=' + (rec.stun || 0) + ' blood=' + (rec.blood || 0) + ' lines=' + JSON.stringify(rec.lines));
}
// 5c) After a bite, biteCd is set (>0) so the dog cannot re-bite until the cooldown lapses.
{
  const c = makeFlatbushDog(100, 6.5);
  p.wx = c.wx + 0.5; p.wy = c.wy + 0.3;
  p.invuln = 0; p.immuneT = 0; p.bloodSteps = 0;
  const rec = {};
  runLeashDogCase(c, true, [], rec);     // the bite fires
  check('bite sets a cooldown (biteCd > 0) so it cannot immediately re-fire', c.biteCd > 0,
    'biteCd=' + c.biteCd.toFixed(2));
}

console.log(ok ? '\nFLATBUSH DOGHOUSE CHECKS PASSED' : '\nFLATBUSH DOGHOUSE CHECKS FAILED');
process.exit(ok ? 0 : 1);
