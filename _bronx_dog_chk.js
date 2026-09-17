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

// ---- Stoop placement: post + dog BESIDE the stoop (never in the middle of it) ----
check('SPAWN stoop: post offsets LEFT/RIGHT by the stoop half-width + margin (outside the steps)', bronxPlace.body.indexOf('stairX + side * (stairHw + 0.7)') >= 0);
check('SPAWN stoop: dog home stays on the SAME side as the post (beside the steps)', bronxPlace.body.indexOf('ld.homeX = ld.anchorX + side * R(0.3, 0.9)') >= 0);
check('RECYCLE stoop: post offsets LEFT/RIGHT by the stoop half-width + margin (outside the steps)', caseText.indexOf('stairX + c._side * (stairHw + 0.7)') >= 0);
check('RECYCLE stoop: dog home stays on the SAME side as the post (beside the steps)', caseText.indexOf('c.homeX = c.anchorX + c._side * R(0.3, 0.9)') >= 0);
check('RECYCLE stoop: post no longer anchors at the exact stoop center', caseText.indexOf('c.anchorX = (stair[0].x0 + stair[0].x1) / 2;') < 0);
check('RECYCLE: homeX shared pick is skipped for stoop dogs (kept on their side)', caseText.indexOf('if (c.anchorType !== "stoop") c.homeX = c.anchorX + R(-0.4, 0.8);') >= 0);
check('npcRoadRules accepts a maxWy escape-lane cap', extractFn('npcRoadRules').indexOf('function npcRoadRules(c, dt, maxWy)') >= 0 && extractFn('npcRoadRules').indexOf('maxWy !== undefined ? maxWy : 7.8') >= 0);
{
  // ped case source: walkers stay on street/curb/sidewalk — capped at y 5.0 on stoop boroughs
  const updStart = src.indexOf('function updateCreatures(dt) {');
  const pedCaseStart = src.indexOf('case "ped":', updStart);
  let pi = src.indexOf('{', pedCaseStart), pd = 0;
  for (; pi < src.length; pi++) { if (src[pi] === '{') pd++; else if (src[pi] === '}') { pd--; if (pd === 0) break; } }
  const pedCase = src.slice(pedCaseStart, pi + 1);
  check('PED: escape steering is capped at the sidewalk end (Manhattan/Bronx: y 5.0)', pedCase.indexOf('isManhattanLevel() || isBronxLevel() ? 5.0 : 7.8') >= 0 && pedCase.indexOf('npcRoadRules(c, dt, pedTop)') >= 0);
  check('PED: hard clamp keeps walkers off the stoop (wy <= pedTop)', pedCase.indexOf('c.wy = Math.min(c.wy, pedTop)') >= 0);
  check('PED: Bronx floor clamp unchanged (wy >= 0.75)', pedCase.indexOf('if (isBronxLevel()) c.wy = Math.max(c.wy, 0.75);') >= 0);
}

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
// ---- Runtime: Bronx recycle WITH a real stoop — post + dog must land BESIDE the steps ----
{
  // Real Bronx stoop geometry for the first stoop house of block 360:
  // house center 372, stoop offset +1.6, half-width 1.0 -> steps x 372.6..374.6, y 5.45..7.25.
  const ST = {
    blockX: 360,
    stairs: [
      { x0: 372.6, x1: 374.6, y0: 5.45, y1: 5.75, top: 0.317 },
      { x0: 372.6, x1: 374.6, y0: 6.95, y1: 7.25, top: 1.32 },
    ],
  };
  global.bronxStairHouse = (blockX) => (blockX === 360 ? ST : null);
  const inStoop = (x, y) =>
    x >= 372.6 - 0.25 && x <= 374.6 + 0.25 && y >= 5.45 - 0.25 && y <= 7.25 + 0.25;
  let okT = true, det = '', sawStoop = 0;
  for (let t = 0; t < 400; t++) {
    const c = makeDog(200, 1.0, false); // far behind the player -> recycles to the next block
    p.wx = 300; p.wy = 2.5;
    runLeashDogCase(c, { bronx: true, manhattan: false, flatbush: false });
    if (c.anchorType === 'stoop') sawStoop++;
    if (inStoop(c.anchorX, c.anchorY)) { okT = false; det = 'post=(' + c.anchorX.toFixed(2) + ',' + c.anchorY.toFixed(2) + ')'; break; }
    if (inStoop(c.homeX, c.homeY)) { okT = false; det = 'home=(' + c.homeX.toFixed(2) + ',' + c.homeY.toFixed(2) + ')'; break; }
    if (inStoop(c.wx, c.wy)) { okT = false; det = 'dog=(' + c.wx.toFixed(2) + ',' + c.wy.toFixed(2) + ')'; break; }
  }
  check('BRONX: stoop post + dog land BESIDE the steps, never in the middle of the stoop (' + sawStoop + '/400 stoop placements)', okT && sawStoop > 50, det);
  global.bronxStairHouse = () => null; // restore default (curb placement for the other tests)
}
// ---- Runtime: Bronx pedestrian dodging traffic stays on street/curb/sidewalk (never the stoop) ----
{
  // Real npcRoadRules from index.html + a deterministic closing car on the street.
  vm.runInThisContext(extractFn('npcRoadRules') + '\n;global.npcRoadRules = npcRoadRules;');
  global.creatures = [];
  global.findClosingVehicle = () => ({ v: { wy: 1.0, curSp: 12 } }); // closing car, street lane
  global.npcLaneFree = () => true;
  global.animParts = () => {};
  // Sanity: WITHOUT the maxWy cap the escape steering reaches y 5.5 — right onto the stoop.
  const probe = { wy: 4.0 };
  npcRoadRules(probe, 0.016);
  check('PED scenario: uncapped escape steering would reach 5.5 (onto the stoop)', Math.abs(probe.yieldLane - 5.5) < 1e-9, 'yieldLane=' + probe.yieldLane);
  // Now run the REAL ped case (Bronx) — the walker must stay within 0.75..5.0 every frame.
  const updStart = src.indexOf('function updateCreatures(dt) {');
  const pedCaseStart = src.indexOf('case "ped":', updStart);
  let pi = src.indexOf('{', pedCaseStart), pd = 0;
  for (; pi < src.length; pi++) { if (src[pi] === '{') pd++; else if (src[pi] === '}') { pd--; if (pd === 0) break; } }
  const pedWrap = 'switch(c.type){' + src.slice(pedCaseStart, pi + 1) + '}';
  global.isManhattanLevel = () => false;
  global.isBronxLevel = () => true;
  let pedOk = true, det = '', lane = null;
  for (let t = 0; t < 600; t++) {
    const c = { type: 'ped', wx: 0, wy: 4.0, sp: 1.5, cd: 999, g: { rotation: { z: 0 } } };
    global.c = c; p.wx = 0; p.wy = 2.5;
    global.tx = c.wx - p.wx; // updateCreatures computes tx per creature before the switch
    vm.runInThisContext(pedWrap, { filename: 'ped-case' });
    if (c.yieldLane !== undefined) lane = c.yieldLane;
    if (!(c.wy >= 0.75 - 1e-9 && c.wy <= 5.0 + 1e-9)) { pedOk = false; det = 'wy=' + c.wy.toFixed(3); break; }
  }
  check('BRONX ped: walker stays on street/curb/sidewalk (0.75 <= wy <= 5.0) while dodging traffic', pedOk && lane !== null && lane <= 5.0 + 1e-9, det + ' lane=' + lane);
}
{
  const c = makeDog(100, 1.0, false);
  p.wx=c.wx+0.5; p.wy=c.wy+0.3; p.invuln=0; p.immuneT=0; p.bloodSteps=0;
  runLeashDogCase(c, {bronx:true, manhattan:false, flatbush:false});
  check('BRONX: bite fires when worker lingers in range (like Manhattan)', rec.hurt===1 && rec.dmg===5 && rec.stun===1 && rec.blood>=1, 'hurt='+rec.hurt+' dmg='+rec.dmg+' stun='+rec.stun+' blood='+rec.blood);
  check('BRONX: bite makes worker + dog speak (like Manhattan)', rec.lines.indexOf('Ow! He bit me!')>=0 && rec.lines.indexOf('GRRR! GRRR!')>=0, JSON.stringify(rec.lines));
}

// ---- LARGE mean pitbull (Bronx leashdogs, 30%): 8 dmg + "Ow! I almost lost a finger!" ----
check('AI bite has the large-dog branch (8 dmg + finger line)', /c\.dogSize === 'large'/.test(caseText) && caseText.indexOf('hurtNPC(8)') >= 0 && caseText.indexOf('Ow! I almost lost a finger!') >= 0);
check('hydrant "hit" hazard no longer references undefined c (dog dmg lives in the leashdog bite, not collideStatic)', extractFn('collideStatic').indexOf('c.dogSize') < 0);
{
  const c = makeDog(100, 1.0, false);
  c.dogSize = 'large'; // large mean pitbull
  p.wx=c.wx+0.5; p.wy=c.wy+0.3; p.invuln=0; p.immuneT=0; p.bloodSteps=0;
  runLeashDogCase(c, {bronx:true, manhattan:false, flatbush:false});
  check('BRONX: LARGE pitbull bite deals 8 dmg (medium deals 5)', rec.hurt===1 && rec.dmg===8 && rec.stun===1 && rec.blood>=1, 'hurt='+rec.hurt+' dmg='+rec.dmg+' stun='+rec.stun+' blood='+rec.blood);
  check('BRONX: LARGE pitbull bite makes worker say "Ow! I almost lost a finger!" (not "He bit me")', rec.lines.indexOf('Ow! I almost lost a finger!')>=0 && rec.lines.indexOf('Ow! He bit me!')<0 && rec.lines.indexOf('GRRR! GRRR!')>=0, JSON.stringify(rec.lines));
}
// ---- makeBronxLeashDog model: large uses the DOG_PALETTES coat + scale-up; medium keeps the pick ----
{
  const M = (c) => ({ color: c });
  const MS = (c) => ({ color: c });
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const SPH = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
  const CY = (r1, r2, h, m) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 8), m);
  const DOG_PALETTES = {
    yellow: { fur: 0xdcb45e, light: 0xf5e6c0, furD: 0xb89040 },
    darkbrown: { fur: 0x4a3020, light: 0x8a6a50, furD: 0x2a1810 },
    husky: { fur: 0xdcdce2, light: 0xfafafc, furD: 0x8f95a3 },
    spotted: { fur: 0xf2f0ec, light: 0xfaf8f4, furD: 0x222226 },
  };
  const ctx = { THREE: global.THREE, M, MS, SPH, CY, DOG_PALETTES, pick };
  vm.createContext(ctx);
  vm.runInContext(extractFn('makeBronxLeashDog'), ctx);
  const allMats = (g) => { const out = []; (function walk(n) { (n.children || []).forEach(ch => { if (ch.material) out.push(ch.material.color); walk(ch); }); })(g); return out; };
  const big = ctx.makeBronxLeashDog('large', 'husky');
  const bigMats = allMats(big);
  check('BRONX: makeBronxLeashDog("large","husky") paints the full husky palette (fur/furD/light)', bigMats.indexOf(0xdcdce2) >= 0 && bigMats.indexOf(0x8f95a3) >= 0 && bigMats.indexOf(0xfafafc) >= 0, JSON.stringify(bigMats.map(c => '0x' + c.toString(16))));
  check('BRONX: makeBronxLeashDog("large",...) scales the dog up 1.35/1.4/1.35', big.scale.x === 1.35 && big.scale.y === 1.4 && big.scale.z === 1.35, JSON.stringify([big.scale.x, big.scale.y, big.scale.z]));
  const med = ctx.makeBronxLeashDog('medium', null);
  const medColors = allMats(med);
  check('BRONX: medium dog keeps the brown/tan pick (no palette coat, scale 1:1)', medColors.indexOf(0xdcdce2) < 0 && medColors.indexOf(0xf2f0ec) < 0 && medColors.indexOf(0x4a3020) < 0 && medColors.indexOf(0xdcb45e) < 0 && med.scale.x === 1, JSON.stringify(medColors.map(c => '0x' + c.toString(16))));
}
check('addCreature Bronx: 30% large + random DOG_PALETTES coat', addCase.indexOf("Math.random() < 0.3") >= 0 && addCase.indexOf('Object.keys(DOG_PALETTES)') >= 0);

console.log(ok ? '\nBRONX DOG CHECKS PASSED' : '\nBRONX DOG CHECKS FAILED');
process.exit(ok ? 0 : 1);
