// _bronx_dog_chk.js — verify the Bronx-exclusive leashed-dog feature against the
// REAL leashdog AI case extracted from index.html, for all three boroughs:
//   - Bronx spawns ONE leashed dog per active block (bronxDogBlocks.length), each tied to a
//     real sidewalk fixture — a post at the curb OR at the foot of that block's stoop (NO
//     doghouse). It climbs the steps toward the building wall and stops there (never enters),
//     clamped by the same building-wall stop line as the worker; off-screen it recycles to a
//     free active block. Routed through the leashdog AI (sidewalk clamp, bite) like Manhattan.
//   - Manhattan unchanged; Flatbush unchanged.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.THREE = require(path.join(__dirname, '_three128.js'));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!cond) ok = false; };

// ---- inline scripts still parse ----
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- faithful-copy checks ----
function extractFn(name){
  const s = src.indexOf('function ' + name + '(');
  if (s < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (d===0) break; } }
  return src.slice(s, i+1);
}
function braceOpen(base, rel){
  const o = src.indexOf('{', base + rel);
  let i = o, d = 0;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (d===0) break; } }
  return { body: src.slice(o+1, i), end: i };
}
const origDog = extractFn('makeHighPolyDog');
const bronxDog = extractFn('makeBronxLeashDog');
check('makeBronxLeashDog exists', !!bronxDog);
check('makeBronxLeashDog accepts dogSize and dogCoat parameters', bronxDog.indexOf('function makeBronxLeashDog(dogSize, dogCoat)') >= 0);
const origChain = extractFn('tieLeashChain');
const bronxChain = extractFn('tieBronxLeashChain');
check('tieBronxLeashChain is a faithful rename of tieLeashChain', bronxChain.replace('function tieBronxLeashChain(','function tieLeashChain(') === origChain);

// ---- Bronx build wiring (no doghouse) ----
const addCaseStart = src.indexOf('case "leashdog": {');
const addCase = (() => {
  const s = src.indexOf('case "leashdog": {');
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (d===0) break; } }
  return src.slice(s, i+1);
})();
check('addCreature leashdog: Bronx uses makeBronxLeashDog with size/coat params', addCase.indexOf('if (isBronxLevel())') >= 0 && addCase.indexOf('makeBronxLeashDog(c.dogSize, c.dogCoat)') >= 0);
check('addCreature leashdog: Bronx sets houseG = null (no doghouse)', addCase.indexOf('c.houseG = null; // no doghouse on the Bronx') >= 0);
const bronxBuild = braceOpen(addCaseStart, addCase.indexOf('if (isBronxLevel())'));
check('addCreature leashdog: Bronx true-branch uses makeBronxLeashDog and NOT makeDogHouse', bronxBuild.body.indexOf('makeBronxLeashDog') >= 0 && bronxBuild.body.indexOf('makeDogHouse') < 0, 'hasModel=' + (bronxBuild.body.indexOf('makeBronxLeashDog')>=0) + ' hasHouse=' + (bronxBuild.body.indexOf('makeDogHouse')>=0));

// ---- Bronx placement branch ----
const spawnWorldStart = src.indexOf('function spawnWorld()');
const spawnWorld = src.slice(spawnWorldStart);
check('spawnWorld has an isBronxLevel() placement branch', spawnWorld.indexOf('} else if (isBronxLevel()) {') >= 0);
check('Bronx placement uses tieBronxLeashChain', spawnWorld.indexOf('tieBronxLeashChain(') >= 0);
const bronxPlace = braceOpen(spawnWorldStart, spawnWorld.indexOf('} else if (isBronxLevel()) {'));
check('Bronx placement uses tieBronxLeashChain and builds NO houseG', bronxPlace.body.indexOf('tieBronxLeashChain') >= 0 && bronxPlace.body.indexOf('houseG') < 0, 'hasChain=' + (bronxPlace.body.indexOf('tieBronxLeashChain')>=0) + ' hasHouseG=' + (bronxPlace.body.indexOf('houseG')>=0));

// ---- extract the REAL leashdog AI case body (double-quote + space) ----
function extractLeashDogCase(){
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf('case "leashdog": {', fnStart);
  if (start < 0) throw new Error('leashdog case not found in updateCreatures');
  let i = src.indexOf('{', start), d = 0;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (d===0) break; } }
  return src.slice(start, i+1);
}
const caseText = extractLeashDogCase();
check('AI case routes Bronx through the Manhattan path', /if \(c\.wx - p\.wx < -55 && !isFlatbushLevel\(\)\) \{\s*if \(isManhattanLevel\(\) \|\| isBronxLevel\(\)/.test(caseText));
check('AI case clamps Bronx movement target to wy>=0.85', /isManhattanLevel\(\) \|\| isBronxLevel\(\)\)\s*\{\s*gy = Math\.max\(0\.85, gy\)/.test(caseText));
check('AI case ties Bronx chain HIGH (z 1.5) like Manhattan', /isManhattanLevel\(\) \|\| isBronxLevel\(\) \?\s*1\.5\s*:\s*0\.62/.test(caseText));

// ---- BRONX: one dog per active block + curb/stoop placement + wall-stop climb ----
check('Bronx spawns ONE leashed dog per active block', /dogCount\s*=\s*isFlatbushLevel\(\)\s*\?\s*3\s*:\s*isBronxLevel\(\)\s*\?\s*bronxDogBlocks\.length/.test(spawnWorld));
check('Bronx placement offers a stoop anchor (bronxStairHouse + anchorType "stoop")', bronxPlace.body.indexOf('bronxStairHouse') >= 0 && bronxPlace.body.indexOf('"stoop"') >= 0);
check('Bronx placement offers a curb anchor (anchorType "curb")', bronxPlace.body.indexOf('"curb"') >= 0);
check('Bronx movement clamps the dog to the building wall stop line (dogStopY)', /if \(isBronxLevel\(\)\) gy = Math\.min\(gy, dogStopY\(gx\)\)/.test(caseText));

// ---- harness: run the real case with toggleable levels (global scope) ----
const GZ = 0.3;
global.stepTopAt = () => GZ;
global.BLOCK_W = 96;
const dynamicGroup = { add(){}, remove(){} };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const workerMaxY = () => 5.0;
const R = (a,b) => a + Math.random()*(b-a);
global.R = R; global.GZ = GZ; global.dynamicGroup = dynamicGroup; global.clamp = clamp; global.workerMaxY = workerMaxY;
const rec = { lines: [] };
const p = { wx:0, wy:2.5, invuln:0, immuneT:0, bloodSteps:0 };
global.p = p;
global.WORKER_GENDER = 'male'; global.HP_HIT_HAZARD = 5; global.creatureMaxY = () => 7.5;
global.makeHydrantMesh = function(){ return { position:{set(){}}, parent:null }; };
global.makePostMesh = function(){ return { position:{set(){}}, parent:null }; };
global.tieLeashChain = function(){ /* geometry not exercised here */ };
global.flatbushDriveways = [];
// ---- BRONX harness globals for per-block / stoop / wall-stop behavior ----
global.bronxDogBlocks = [ { x: 360, garbage: true } ];
global.bronxStairHouse = () => null; // no stoop in these tests → curb placement
global.freeBronxDogBlock = () => global.bronxDogBlocks[0]; // free block ahead of player
global.dogStopY = () => Infinity; // default: open sidewalk (only the stoop test overrides)
global.hurtNPC = (amt) => { rec.hurt = (rec.hurt||0)+1; rec.dmg = (rec.dmg||0)+(amt||0); };
global.doStun = () => { rec.stun = (rec.stun||0)+1; };
global.dropBloodSplatter = () => { rec.blood = (rec.blood||0)+1; };
global.dt = 0.016;
global.state = 'play';
global.Voice = { say: function(l){ rec.lines.push(l); } };
const wrap = 'switch(c.type){' + caseText + '}';
function runLeashDogCase(c, lvl){
  global.c = c;
  global.isFlatbushLevel = () => !!lvl.flatbush;
  global.isManhattanLevel = () => !!lvl.manhattan;
  global.DOG_PALETTES = { yellow: { fur: 0xdbc480, ear: 0xc4a84e, nose: 0x14100e, tag: 0xc0c0c0 }, darkbrown: { fur: 0x4a2c18, ear: 0x3a2010, nose: 0x14100e, tag: 0xc0c0c0 }, husky: { fur: 0xe0e4e8, ear: 0x888888, nose: 0x14100e, tag: 0xc0c0c0 }, spotted: { fur: 0xf0f0f0, spot: 0x141414, ear: 0xe0e0e0, nose: 0x14100e, tag: 0xc0c0c0 } };
global.isBronxLevel = () => !!lvl.bronx;
  rec.hurt=0; rec.dmg=0; rec.stun=0; rec.blood=0; rec.lines=[];
  vm.runInThisContext(wrap, { filename: 'leashdog-case' });
}

// ---- helpers ----
function makeDog(anchorX, anchorY, withHouse){
  const c = {
    type:'leashdog', anchorX:anchorX, anchorY:anchorY,
    homeX:anchorX, homeY:anchorY - 0.6, wx:anchorX, wy:anchorY - 0.6,
    agro:0, barkCd:0, bark:0, chainR:3.0, phase:0, biteCd:0, calmCd:0,
    g:{ rotation:{z:0}, position:{set(){}} },
    chain:{ scale:{x:1}, position:{set(){}}, rotation:{z:0} },
    houseG: withHouse ? { position:{set(){}}, parent: dynamicGroup } : null,
  };
  return c;
}

// ---- Manhattan regression guards (unchanged behavior) ----
{
  let manOk=true, det='';
  for (let t=0;t<300;t++){
    const c = makeDog(200, 1.0, true);
    p.wx = 300; p.wy = 2.5;
    runLeashDogCase(c, {manhattan:true, flatbush:false, bronx:false});
    if (!(c.anchorX > p.wx + 40)){ manOk=false; det='anchorX='+c.anchorX+' p.wx='+p.wx; break; }
  }
  check('MANHATTAN: leashdog recycles AHEAD of player (unchanged)', manOk, det);
}
{
  let manOk=true, det='';
  for (let t=0;t<200;t++){
    const c = makeDog(100, 1.0, true);
    p.wx = 100; p.wy = 2.5;
    runLeashDogCase(c, {manhattan:true, flatbush:false, bronx:false});
    if (!(c.wy >= 0.85 - 1e-9)){ manOk=false; det='wy='+c.wy; break; }
  }
  check('MANHATTAN: movement clamps wy to walk surface (>=0.85)', manOk, det);
}
{
  const c = makeDog(100, 1.0, true);
  p.wx=c.wx+0.5; p.wy=c.wy+0.3; p.invuln=0; p.immuneT=0; p.bloodSteps=0;
  runLeashDogCase(c, {manhattan:true, flatbush:false, bronx:false});
  check('MANHATTAN: bite fires when worker lingers in range', rec.hurt===1 && rec.dmg===5 && rec.stun===1 && rec.blood>=1, 'hurt='+rec.hurt+' dmg='+rec.dmg+' stun='+rec.stun+' blood='+rec.blood);
  check('MANHATTAN: bite makes worker + dog speak', rec.lines.indexOf('Ow! He bit me!')>=0 && rec.lines.indexOf('GRRR! GRRR!')>=0, JSON.stringify(rec.lines));
}

// ---- Flatbush regression guard (unchanged) ----
{
  let fbOk=true, det='';
  for (let t=0;t<2000;t++){
    const ax=200, ay=6.5;
    const c = makeDog(ax, ay, true);
    p.wx=c.wx+70;
    runLeashDogCase(c, {flatbush:true, manhattan:false, bronx:false});
    if (!(Math.abs(c.anchorX-ax)<1e-9 && Math.abs(c.anchorY-ay)<1e-9)){ fbOk=false; det='anchor=('+c.anchorX+','+c.anchorY+') expected=('+ax+','+ay+')'; break; }
    if (c.houseG.parent !== dynamicGroup){ fbOk=false; det='houseG.parent='+c.houseG.parent; break; }
  }
  check('FLATBUSH: leashdog stays STATIC off-screen (no teleport, house intact)', fbOk, det);
}

// ---- Bronx: parity with Manhattan on the shared AI, but NO doghouse ----
{
  let brOk=true, det='';
  for (let t=0;t<300;t++){
    const c = makeDog(200, 1.0, false);
    p.wx = 300; p.wy = 2.5;
    runLeashDogCase(c, {bronx:true, manhattan:false, flatbush:false});
    if (!(c.anchorX > p.wx + 40)){ brOk=false; det='anchorX='+c.anchorX+' p.wx='+p.wx; break; }
    if (typeof c.blockMaxX !== 'number'){ brOk=false; det='blockMaxX='+c.blockMaxX; break; }
  }
  check('BRONX: leashdog recycles AHEAD of player (shared Manhattan path)', brOk, det);
}
{
  let brOk=true, det='';
  for (let t=0;t<200;t++){
    const c = makeDog(100, 1.0, false);
    p.wx = 100; p.wy = 2.5;
    runLeashDogCase(c, {bronx:true, manhattan:false, flatbush:false});
    if (!(c.wy >= 0.85 - 1e-9)){ brOk=false; det='wy='+c.wy; break; }
  }
  check('BRONX: movement clamps wy to walk surface (>=0.85, like Manhattan)', brOk, det);
}
{
  // A stoop dog whose home is ABOVE the wall-stop line must be pulled down to it — it climbs
  // toward the door but never enters the building. dogStopY stub overridden to a wall line.
  global.dogStopY = () => 6.95;
  let brOk = true, det = '';
  for (let t = 0; t < 120; t++) {
    const c = makeDog(100, 8.5, false); // home well above the stop line
    c.anchorType = 'stoop';
    c.blockMinX = 96 + 6; c.blockMaxX = 96 + 96 - 6;
    p.wx = 100; p.wy = 2.5;
    runLeashDogCase(c, { bronx: true, manhattan: false, flatbush: false });
    if (!(c.wy > 0.85 - 1e-9 && c.wy <= 6.95 + 1e-9)) { brOk = false; det = 'wy=' + c.wy; break; }
  }
  check('BRONX: stoop dog halts AT the wall-stop line (climbs but never enters)', brOk, det);
  global.dogStopY = () => Infinity; // restore default
}
{
  const c = makeDog(100, 1.0, false);
  p.wx=c.wx+0.5; p.wy=c.wy+0.3; p.invuln=0; p.immuneT=0; p.bloodSteps=0;
  runLeashDogCase(c, {bronx:true, manhattan:false, flatbush:false});
  check('BRONX: bite fires when worker lingers in range (like Manhattan)', rec.hurt===1 && rec.dmg===5 && rec.stun===1 && rec.blood>=1, 'hurt='+rec.hurt+' dmg='+rec.dmg+' stun='+rec.stun+' blood='+rec.blood);
  check('BRONX: bite makes worker + dog speak (like Manhattan)', rec.lines.indexOf('Ow! He bit me!')>=0 && rec.lines.indexOf('GRRR! GRRR!')>=0, JSON.stringify(rec.lines));
}

console.log(ok ? '\nBRONX DOG CHECKS PASSED' : '\nBRONX DOG CHECKS FAILED');
process.exit(ok ? 0 : 1);
