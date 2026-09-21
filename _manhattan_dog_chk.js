// _manhattan_dog_chk.js — verify the Manhattan-specific leashed-dog mechanics:
//   - the dog is leashed to a REAL visible curb-side fixture: a sidewalk tree
//     (makeSidewalkTree) or a cast-iron fence post (makePostMesh) standing upright
//     at the curb (y 0.85..1.05), with the doghouse hidden. (Hydrants are curb
//     hazards only - they no longer double as dog anchors.)
//   - the leashdog AI clamps the dog to the sidewalk (wy >= 0.85) so it never
//     steps onto the asphalt, while it can still lunge out to the curb where the
//     worker walks.
//   - the bite pipeline (damage / knockback / stun / blood / speech) still fires
//     under the Manhattan clamp, and right after a bite the dog settles for ~4s
//     (c.calmCd): it drops its aggro, trots back to its home spot, and only
//     re-aggros once the calm-down has run out.
//   - off-screen recycling re-anchors the dog to a fresh sidewalk fixture ahead
//     of the route instead of the old lawn.
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

// ---- model builders: run the REAL functions from index.html ----
function extractFn(name){
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const M = (c, opt) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {}));
const MS = (c, opt) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
eval(extractFn('makeHydrantMesh'));
eval(extractFn('makePostMesh'));
eval(extractFn('makeSidewalkTree'));

// The two anchor fixtures build without throwing and use their own material schemes.
const hydrant = makeHydrantMesh();
const post = makePostMesh();
const tree = makeSidewalkTree();
const matSet = g => { const s = new Set(); g.traverse(ch => { if (ch.material && ch.material.color) s.add(ch.material.color.getHex()); }); return s; };
const hMats = matSet(hydrant), pMats = matSet(post), tMats = matSet(tree);
check('makeHydrantMesh builds a Group without throwing', hydrant.children.length > 5, 'children=' + hydrant.children.length);
check('hydrant fixture: black iron body + steel dome + weathered caps (curb hazard only)',
  hMats.has(0x1d2125) && hMats.has(0x9ba0a6) && hMats.has(0x7e848a) && hMats.has(0x34393f), [...hMats].map(x => '0x' + x.toString(16)).join(','));
check('makePostMesh builds a Group without throwing', post.children.length >= 4, 'children=' + post.children.length);
check('post fixture: dark iron shaft + weathered cap, distinct from the hydrant/tree',
  pMats.has(0x23272c) && pMats.has(0x3b4147) && !pMats.has(0x1d2125) && !pMats.has(0x4a3520), [...pMats].map(x => '0x' + x.toString(16)).join(','));
check('post fixture stands ~1.6u tall (chain tie-off height)', (() => { let top = 0; post.traverse(ch => { if (ch.position && ch.position.z > top) top = ch.position.z; }); return top > 1.4 && top < 1.8; })(), 'topZ=' + (() => { let top = 0; post.traverse(ch => { if (ch.position && ch.position.z > top) top = ch.position.z; }); return top; })());
// The post's cylinders must STAND UPRIGHT: a bare CylinderGeometry runs along local Y,
// but world-up here is +Z (camera.up = (0,0,1)), so every cylinder needs a ~90-degree
// rotation.x or the whole post lies flat on the sidewalk. Verify at runtime on the real
// build (the local three exposes geometry.type === 'CylinderGeometry').
check('post fixture cylinders stand upright on the world-up (+Z) axis (rotation.x ~ PI/2)', (() => {
  let nCyl = 0, nUp = 0;
  post.traverse(ch => {
    if (ch.geometry && ch.geometry.type === 'CylinderGeometry'){
      nCyl++;
      const rx = ch.rotation.x;
      if (Math.abs(Math.abs(rx) - Math.PI / 2) < 0.01) nUp++;
    }
  });
  return nCyl >= 4 && nCyl === nUp;
})(), (() => { let nCyl = 0; post.traverse(ch => { if (ch.geometry && ch.geometry.type === 'CylinderGeometry') nCyl++; }); return 'cylinders=' + nCyl; })());
check('tree fixture: brown trunk + leafy green canopy',
  tMats.has(0x4a3520) && [...tMats].some(c => (c & 0xff) < 80 && ((c >> 8) & 0xff) > 60 && ((c >> 16) & 0xff) < 80), [...tMats].map(x => '0x' + x.toString(16)).join(','));

// ---- extract the REAL leashdog case body (brace-counted) from updateCreatures ----
function extractLeashDogCase(){
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf('case "leashdog": {', fnStart);
  if (start < 0) throw new Error('leashdog case not found in updateCreatures');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);   // "case 'leashdog':{ ... break; }"
}
const caseText = extractLeashDogCase();

// ---- run the extracted case with Manhattan on/off, mirroring index.html's scope ----
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0.3;
// The extracted case body now reads the dog's collar height from stepTopAt (flat
// ground -> GZ, so the collar sits at 0.62). new Function bodies resolve free vars
// against the GLOBAL scope, so expose a flat-ground stepTopAt here.
global.stepTopAt = () => GZ;
const dynamicGroup = { add(){} };
const Voice = { say(){} };
const p = { wx: 0, wy: 2.5, invuln: 0, immuneT: 0, bloodSteps: 0 };
// Mirrors index.html's tieLeashChain(): it orients the chunky chain bar as a RIGID 3D
// segment from the dog's collar (dx, dy, dz) up to the fixture tie-off (ax, ay, az).
// The stub recomputes the same scale + midpoint so tests can assert the chain TILTS:
// on Manhattan the anchor sits at the post/tree collar (az 1.5) and the dog collar at
// dz 0.62 (so the dog end attaches to the neck instead of floating in the air).
const leashCalls = [];
function tieLeashChain(chain, ax, ay, az, dx, dy, dz){
  const cx2 = ax - dx, cy2 = ay - dy, dz2 = az - dz;
  chain.scale.x = Math.max(0.02, Math.sqrt(cx2 * cx2 + cy2 * cy2 + dz2 * dz2));
  chain.position.set(dx + cx2 / 2, dy + cy2 / 2, (az + dz) / 2);
  leashCalls.push({ ax: ax, ay: ay, az: az, dx: dx, dy: dy, dz: dz });
}
function makeManhattanDog(ax, ay, homeOffY){
  const position = { x: ax, y: ay, z: 0, set: function(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } };
  const anchorObj = { position: position, parent: dynamicGroup };
  const c = {
    type: 'leashdog',
    anchorX: ax, anchorY: ay,
    homeX: ax + 0.4, homeY: ay - (homeOffY || 1.0),
    wx: ax + 0.4, wy: ay - (homeOffY || 1.0),
    agro: 0, barkCd: 0, bark: 0, biteCd: 0, chainR: 3.0, phase: 0,
    anchorObj: anchorObj,
    chain: { scale: { x: 1 }, position: { x: 0, y: 0, z: 0, set: function(x, y, z){ this.x = x; this.y = y; this.z = z; return this; } }, rotation: { z: 0 } },
    houseG: { visible: false, position: { set(){} }, parent: dynamicGroup },
    g: { rotation: { z: 0 } },
  };
  c.g.position = { set(){} };
  return c;
}
function runLeashDogCase(c, manhattan, rec){
  rec = rec || {}; rec.lines = rec.lines || [];
  const state = 'play';
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const workerMaxY = () => 5.0;   // Manhattan cap (mirrors index.html workerMaxY)
  const WORKER_GENDER = 'male';
  const HP_HIT_HAZARD = 5;        // mirrors index.html
  const hurtNPC = (amt) => { rec.hurt = (rec.hurt || 0) + 1; rec.dmg = (rec.dmg || 0) + (amt || 0); };
  const doStun = () => { rec.stun = (rec.stun || 0) + 1; };
  const dropBloodSplatter = () => { rec.blood = (rec.blood || 0) + 1; };
  const VoiceRec = { say: function(line){ rec.lines.push(line); } };
  function makeHydrantMesh(){ return { position: { set(){} }, parent: null }; }
  function makePostMesh(){ return { position: { set(){} }, parent: null }; }
  const BLOCK_W = 80;             // mirrors index.html (10 houses x 8u)
  const fn = new Function('c', 'p', 'dt', 'R', 'GZ', 'dynamicGroup', 'isFlatbushLevel', 'Voice', 'flatbushDriveways',
    'state', 'clamp', 'workerMaxY', 'hurtNPC', 'doStun', 'dropBloodSplatter', 'WORKER_GENDER', 'HP_HIT_HAZARD',
    'isManhattanLevel', 'creatureMaxY', 'makeHydrantMesh', 'makePostMesh', 'tieLeashChain', 'BLOCK_W',
    'isBronxLevel', 'dogStopY', 'isQueensLevel', // Bronx + Queens feature globals (injected false here — non-Bronx/Queens tests)
    'const tx = c.wx - p.wx;\nswitch (c.type){' + caseText + '}');
  return fn(c, p, 0.016, R, GZ, dynamicGroup, () => false, VoiceRec, [],
    state, clamp, workerMaxY, hurtNPC, doStun, dropBloodSplatter, WORKER_GENDER, HP_HIT_HAZARD,
    () => manhattan, () => 4.8, makeHydrantMesh, makePostMesh, tieLeashChain, BLOCK_W,
    () => false, () => Infinity, () => false);
}

// ---- 1) Street boundary: an aggro'd Manhattan dog NEVER steps onto the asphalt ----
// The worker stands OUT in the street (wy = -2.0, asphalt); the dog chases, but both
// the movement target and its position are clamped to wy >= 0.85, so it waits at the
// curb line instead of crossing into the street (and the worker is now out of
// mouth-range, so no bite).
{
  const c = makeManhattanDog(2, 2.6);          // home ~= (2.4, 1.6), on the walk
  p.wx = 2.6; p.wy = -2.0; p.invuln = 999;     // i-framed so the walk is pure movement
  p.immuneT = 999; p.bloodSteps = 0;
  let minWy = Infinity;
  for (let t = 0; t < 600; t++){
    runLeashDogCase(c, true);
    if (c.wy < minWy) minWy = c.wy;
  }
  check('Manhattan dog never enters the street (wy >= 0.85 across 600 frames, worker on asphalt)',
    minWy >= 0.85 - 1e-9, 'minWy=' + minWy.toFixed(4));
  check('clamped dog halts at the curb line (stays on the walk, wy in [0.85, 1.3])',
    c.wy >= 0.85 - 1e-9 && c.wy <= 1.3 && Math.abs(c.wx - 2.6) < 0.5, 'dog=(' + c.wx.toFixed(2) + ',' + c.wy.toFixed(2) + ')');
}

// ---- 2) Bite pipeline works under the Manhattan clamp: a worker lingering at the
// curb gets bitten per cooldown - damage, stun, knockback, blood, speech ----
{
  const c = makeManhattanDog(2, 2.6);
  p.wx = 2.6; p.wy = 1.0;
  p.invuln = 0; p.immuneT = 0; p.bloodSteps = 0;
  const rec = {};
  let minWy = Infinity, minPD = Infinity;
  for (let t = 0; t < 400; t++){
    runLeashDogCase(c, true, rec);
    if (c.wy < minWy) minWy = c.wy;
    minPD = Math.min(minPD, Math.hypot(p.wx - c.wx, p.wy - c.wy));
  }
  const biteLine = rec.lines.indexOf('Ow! He bit me!') >= 0 && rec.lines.indexOf('GRRR! GRRR!') >= 0;
  check('Manhattan dog REACHES the worker at the curb (min distance < 0.85) and bites',
    rec.hurt >= 1 && rec.dmg === rec.hurt * 5 && rec.stun >= 1 && minPD < 0.85,
    'hurt=' + rec.hurt + ' stun=' + rec.stun + ' minPD=' + minPD.toFixed(3));
  check('bite splatters blood and starts the worker bleeding (bloodSteps = 12)',
    rec.blood >= 1 && p.bloodSteps === 12, 'blood=' + rec.blood + ' bloodSteps=' + p.bloodSteps);
  check('bite makes the worker + dog speak', biteLine, JSON.stringify(rec.lines.slice(0, 4)));
  check('dog stays off the asphalt during the whole bite sequence (wy >= 0.85)', minWy >= 0.85 - 1e-9, 'minWy=' + minWy.toFixed(4));
  check('bite respects i-frames on Manhattan too (invuln absorbs it)', (() => {
    const d = makeManhattanDog(2, 2.6);
    const pp = { wx: 2.6, wy: 1.0, invuln: 999, immuneT: 999, bloodSteps: 0 };
    const fn2 = new Function('c', 'p', 'dt', 'R', 'GZ', 'dynamicGroup', 'isFlatbushLevel', 'Voice', 'flatbushDriveways',
      'state', 'clamp', 'workerMaxY', 'hurtNPC', 'doStun', 'dropBloodSplatter', 'WORKER_GENDER', 'HP_HIT_HAZARD',
      'isManhattanLevel', 'creatureMaxY', 'makeHydrantMesh', 'makePostMesh', 'tieLeashChain',
      'isBronxLevel', 'dogStopY', // Bronx feature globals (injected false/Infinity here — non-Bronx tests)
      'const tx = c.wx - p.wx;\nswitch (c.type){' + caseText + '}');
    let bites = 0, blood = 0;
    const lines = [];
    for (let t = 0; t < 400; t++){
      fn2(d, pp, 0.016, R, GZ, dynamicGroup, () => false, { say(l){ lines.push(l); } }, [],
        'play', (v, lo, hi) => Math.min(hi, Math.max(lo, v)), () => 5.0,
        (a) => { bites++; }, () => {}, () => { blood++; }, 'male', 5,
        () => true, () => 4.8, () => ({ position: { set(){} }, parent: null }), () => ({ position: { set(){} }, parent: null }), tieLeashChain,
        () => false, () => Infinity);
    }
    return bites === 0 && blood === 0 && pp.bloodSteps === 0 && lines.indexOf('Ow! He bit me!') < 0;
  })());
}

// ---- 2b) Post-bite calm-down (c.calmCd): the bite resets the dog's aggression ----
// Three focused checks: (a) a bite fires the ~4s calm window (calmCd>0 + aggro dropped),
// (b) while calmed the dog ignores the worker (won't re-lunge) and holds at its home
// spot, (c) once the calm expires the dog re-aggros and moves back toward the worker.
// ---- (a) a bite fires the calm window ----
{
  const c = makeManhattanDog(2, 2.6);          // home ~= (2.4, 1.6), on the walk
  p.wx = 3.5; p.wy = 1.2; p.invuln = 0; p.immuneT = 0; p.bloodSteps = 0;
  const rec = {};
  let calmSeen = false;
  for (let t = 0; t < 140; t++){
    runLeashDogCase(c, true, rec);
    if (c.calmCd > 0 && c.agro === 0) calmSeen = true;
  }
  check('a bite fires the post-bite calm window (calmCd > 0 with aggro dropped to 0)',
    (rec.hurt || 0) >= 1 && calmSeen, 'bites=' + rec.hurt + ' calmSeen=' + calmSeen);
}
// ---- (b) while calmed the dog ignores the worker and holds at home ----
{
  const c = makeManhattanDog(2, 2.6);
  c.calmCd = 3.0; c.agro = 0;                   // start mid-calm (as right after a bite)
  p.wx = 3.5; p.wy = 1.2; p.invuln = 999; p.immuneT = 999;   // worker in aggro range, i-framed
  let lunged = false, calmHeld = true;
  for (let t = 0; t < 120; t++){                // 120 frames * 0.016 = ~1.9s of the 4s calm
    runLeashDogCase(c, true, {});
    if (c.agro > 0) lunged = true;               // calmed dog must NOT re-aggro
    if (Math.hypot(c.wx - c.homeX, c.wy - c.homeY) > 0.6) calmHeld = false;  // must hold near home
  }
  check('while calmed the dog ignores the worker (no re-aggro) and holds near its home spot',
    !lunged && calmHeld, 'lunged=' + lunged + ' dog=(' + c.wx.toFixed(2) + ',' + c.wy.toFixed(2) + ') home=(' + c.homeX + ',' + c.homeY + ')');
}
// ---- (c) once the calm expires the dog re-aggros and moves toward the worker ----
{
  const c = makeManhattanDog(2, 2.6);
  c.calmCd = 0; c.agro = 0;
  p.wx = 3.5; p.wy = 1.2; p.invuln = 999; p.immuneT = 999;
  const d0 = Math.hypot(c.wx - p.wx, c.wy - p.wy);
  for (let t = 0; t < 80; t++) runLeashDogCase(c, true, {});
  const d1 = Math.hypot(c.wx - p.wx, c.wy - p.wy);
  check('after the calm-down the dog re-aggros and moves back toward the worker',
    c.agro > 0 && d1 < d0 - 0.3, 'agro=' + c.agro.toFixed(2) + ' dWorker ' + d0.toFixed(2) + ' -> ' + d1.toFixed(2));
}

// ---- 3) Off-screen recycling: Manhattan dog re-anchors to a SIDEWALK fixture ----
{
  const c = makeManhattanDog(10, 2.4);
  p.wx = c.wx + 70;                            // worker far AHEAD -> tx < -55
  runLeashDogCase(c, true);
  const axInFront = c.anchorX > p.wx + 49 && c.anchorX <= p.wx + 217; // 50u min (off-screen), forward-only re-clamp
  const anchorOnWalk = c.anchorY >= 0.85 && c.anchorY <= 1.05;
  const fixtureFollows = c.anchorObj.position && c.anchorObj.position.x === c.anchorX && c.anchorObj.position.y === c.anchorY;
  check('Manhattan recycle: anchor jumps ahead of the route AT THE CURB (y 0.85..1.05)',
    axInFront && anchorOnWalk && c.wy >= 0.85,
    'anchor=(' + c.anchorX.toFixed(1) + ',' + c.anchorY.toFixed(2) + ') p.wx=' + p.wx.toFixed(1) + ' wy=' + c.wy.toFixed(2));
  check('Manhattan recycle: the fixture (anchorObj) moves with the anchor', fixtureFollows,
    'obj=(' + c.anchorObj.position.x.toFixed(1) + ',' + c.anchorObj.position.y.toFixed(2) + ')');
}
{
  // a dog that somehow has no fixture gets a fresh fence POST mesh on recycle
  const c = makeManhattanDog(10, 2.4);
  c.anchorObj = null;
  p.wx = c.wx + 70;
  runLeashDogCase(c, true);
  check('Manhattan recycle: missing fixture falls back to a fresh makePostMesh()',
    !!c.anchorObj && c.anchorObj.parent !== undefined, 'anchorObj=' + (c.anchorObj ? 'created' : 'null'));
}

// ---- 3b) The chain TILTS to the dog's collar: on Manhattan the anchor end sits at
// the post/tree collar (z 1.5) and the dog end at the collar (z 0.62); on the ground
// doghouse levels both ends sit level at the stake top / collar (z 0.62). Proves
// tieLeashChain gets the right tie-off + collar heights (the dog end no longer floats
// in the air at feet level, and no longer dips below the dog). ----
{
  leashCalls.length = 0;
  const c = makeManhattanDog(2, 2.6);
  p.wx = 2.6; p.wy = -2.0; p.invuln = 999; p.immuneT = 999;
  runLeashDogCase(c, true);                        // Manhattan ON
  const man = leashCalls[leashCalls.length - 1];
  check('Manhattan chain ties HIGH: anchor at post collar z 1.5, dog end at collar z 0.62 (tilted, not floating)',
    man && man.az === 1.5 && man.dz === 0.62 && c.chain.position.z === (1.5 + 0.62) / 2,
    'az=' + (man && man.az) + ' dz=' + (man && man.dz) + ' chain.z=' + (c.chain.position && c.chain.position.z));

  leashCalls.length = 0;
  const c2 = makeManhattanDog(2, 7.6);
  p.wx = 2.6; p.wy = -2.0; p.invuln = 999; p.immuneT = 999;
  runLeashDogCase(c2, false);                      // Manhattan OFF -> ground doghouse
  const grnd = leashCalls[leashCalls.length - 1];
  check('ground chain ties at the stake top / collar (both ends z 0.62, level bar)',
    grnd && grnd.az === 0.62 && grnd.dz === 0.62,
    'az=' + (grnd && grnd.az) + ' dz=' + (grnd && grnd.dz));
}

// ---- 4) Regression: non-Manhattan leashdog has NO street clamp (lawn dog unchanged) ----
{
  const c = makeManhattanDog(10, 7.6);         // lawn home ~= (10.4, 6.6)
  p.wx = 11.5; p.wy = 7.8; p.invuln = 999; p.immuneT = 999;
  let reached = false;
  for (let t = 0; t < 600; t++){
    runLeashDogCase(c, false);                  // Manhattan OFF
    if (c.wy > 7.2){ reached = true; break; }
  }
  check('non-Manhattan leashdog is NOT street-clamped (dog still follows on the lawn)', reached,
    'wy=' + c.wy.toFixed(2));
}

// ---- 5) Source-level checks on the real placement + AI code ----
const manBlock = src.slice(src.indexOf('if (isManhattanLevel()) {', src.indexOf('const dogCount = isFlatbushLevel()')),
                            src.indexOf('} else if (isFlatbushLevel()) {'));
check('spawnWorld (Manhattan): anchor is a real fixture - tree OR fence post',
  manBlock.indexOf('makeSidewalkTree()') >= 0 && manBlock.indexOf('makePostMesh()') >= 0);
check('spawnWorld (Manhattan): fixture placed AT THE CURB (y 0.85..1.05) at the anchor',
  manBlock.indexOf('R(0.85, 1.05)') >= 0 && manBlock.indexOf('ld.anchorObj.position.set(ld.anchorX, ld.anchorY') >= 0 &&
  manBlock.indexOf('dynamicGroup.add(ld.anchorObj)') >= 0);
check('spawnWorld (Manhattan): home is set INWARD on the walk from the curb anchor (0.85..creatureMaxY)',
  manBlock.indexOf('clamp(ld.anchorY + R(0.6, 1.4), 0.85, creatureMaxY())') >= 0);
check('spawnWorld (Manhattan): doghouse hidden, chain still tied to the anchor',
  manBlock.indexOf('ld.houseG.visible = false') >= 0 && /tieLeashChain\(\s*ld\.chain,\s*ld\.anchorX,\s*ld\.anchorY,\s*1\.5/.test(manBlock));
check('spawnWorld (Manhattan): chain ties to the TOP of the fixture (post collar, z 1.5) and tilts to the dog collar (z 0.62)',
  /tieLeashChain\(\s*ld\.chain,\s*ld\.anchorX,\s*ld\.anchorY,\s*1\.5,\s*ld\.wx,\s*ld\.wy,\s*0\.62/.test(manBlock));
check('AI case: per-frame chain ties at the dog COLLAR - Manhattan/Bronx tilts from the post collar (z 1.5) down to the collar, ground ties at the stake top (z 0.62)',
  /tieLeashChain\(\s*c\.chain,\s*c\.anchorX,\s*c\.anchorY,\s*\(?isManhattanLevel\(\)\s*\|\|\s*isBronxLevel\(\)\s*\|\|\s*isQueensLevel\(\)\)?\s*\?\s*1\.5\s*:\s*0\.62,\s*dogSwayX,\s*dogSwayY,\s*dogCollarZ\s*,?\s*\)/.test(caseText));
check('AI case: the dog collar z TRACKS THE GROUND via stepTopAt (0.62 on flat ground, follows a raised lip)',
  /const dogCollarZ = stepTopAt\(c\.wx, c\.wy\) \+ \(0\.62 - GZ\)/.test(caseText));
check('AI case: the leash SWAYS - a damped chainLean spring nudges the dog end along the leash axis as the dog moves (bowing lead)',
  /c\.chainLean\s*=\s*\(c\.chainLean\s*\|\|\s*0\)\s*\+\s*\(targetLean\s*-\s*\(c\.chainLean\s*\|\|\s*0\)\)\s*\*\s*Math\.min\(1,\s*dt\s*\*\s*6\)/.test(caseText) &&
  /const dogSwayX = c\.wx - uax \* c\.chainLean;/.test(caseText) &&
  /const targetLean\s*=\s*clamp\(\s*\(dVx\s*\*\s*perpX\s*\+\s*dVy\s*\*\s*perpY\)\s*\*\s*0\.12,\s*-0\.35,\s*0\.35/.test(caseText));
check('AI case: Manhattan/Bronx target clamp (gy) and position clamp (c.wy) to >= 0.85',
  (caseText.indexOf('if (isManhattanLevel()) gy = Math.max(0.85, gy);') >= 0 ||
   caseText.indexOf('if (isManhattanLevel()) {') >= 0 ||
   caseText.indexOf('if (isManhattanLevel() || isBronxLevel())') >= 0) &&
  caseText.indexOf('gy = Math.max(0.85, gy);') >= 0 &&
  caseText.indexOf('c.wy = Math.max(0.85, c.wy);') >= 0);
check('AI case: bite trigger (dWorker < 0.85 + i-frame guards) is intact',
  /dWorker\s*<\s*0\.85\s*&&\s*p\.invuln\s*<=\s*0\s*&&\s*p\.immuneT\s*<=\s*0/.test(caseText));
check('AI case: bite still deals damage + stun + blood splatter + bleeding trail (large pitbull = hurtNPC(8, "pitbull"), regular = hurtNPC(HP_HIT_HAZARD, "dog"))',
  caseText.indexOf('hurtNPC(HP_HIT_HAZARD, "dog")') >= 0 && caseText.indexOf('hurtNPC(8, "pitbull")') >= 0 && caseText.indexOf('doStun(0.5, "hit");') >= 0 &&
  caseText.indexOf('dropBloodSplatter(p.wx, p.wy);') >= 0 && caseText.indexOf('p.bloodSteps = 12;') >= 0);
check('AI case: a bite resets aggression and fires the ~4s calm-down (c.calmCd)',
  /c\.calmCd\s*=\s*4\.0/.test(caseText) && /c\.calmCd\s*=\s*c\.calmCd\s*>\s*0\s*\?\s*Math\.max\(0,\s*c\.calmCd\s*-\s*dt\)\s*:\s*0/.test(caseText));
check('AI case: a calmed dog does NOT re-aggro and does NOT target the worker',
  /if \(dWorker\s*<\s*6\.5\s*&&\s*c\.calmCd\s*<=\s*0\)\s*c\.agro\s*=\s*Math\.max/.test(caseText) &&
  /if \(c\.agro\s*>\s*0\s*&&\s*c\.calmCd\s*<=\s*0\)\s*\{/.test(caseText));
check('AI case: Manhattan recycle re-anchors AT THE CURB (R(0.85, 1.05)) with a fence post',
  caseText.indexOf('c.anchorY = R(0.85, 1.05);') >= 0 && caseText.indexOf('c.anchorObj = makePostMesh();') >= 0);
// After recycling, the chain must tie to the NEW anchor/dog positions (not the old ones)
// to prevent the leash from stretching across the screen when the dog recycles off-screen.
check('AI case: chain tie runs AFTER recycling (ties to updated anchor/dog position)',
  (() => {
    const recycleEnd = caseText.lastIndexOf('c.agro = 0;');
    if (recycleEnd < 0) return false;
    const afterRecycle = caseText.slice(recycleEnd);
    return afterRecycle.indexOf('tieLeashChain') >= 0;
  })());
check('addHydrant now delegates to makeHydrantMesh (refactor)',
  (() => { const hz = src.slice(src.indexOf('function addHydrant(b, wx, wy) {'), src.indexOf('function addManhole'));
    return hz.indexOf('makeHydrantMesh()') >= 0 && hz.indexOf('b.hazards.push') >= 0; })());

console.log(ok ? '\nMANHATTAN DOG CHECKS PASSED' : '\nMANHATTAN DOG CHECKS FAILED');
process.exit(ok ? 0 : 1);
check('hydrant and tree are distinct fixtures (not the same model)', !tMats.has(0x1d2125));