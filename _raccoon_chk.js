// _raccoon_chk.js — verify that bumping a raccoon scares the sanitation worker:
// the worker screams "Rabies!" and trips (stun), while a squirrel bump gets the
// worker's snarky "Gimme that nut, squirrel!" and the rat still yells "Eeek!".
// Also verifies the raccoon's four leg pivots + the scurry gait animation.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted, works for one- and multi-line fns) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ---- mutable game state the extracted functions close over ----
let state = 'play';
const p = { wx: 88, wy: 2.5, stunT: 0, invuln: 0, immuneT: 0, facing: 0 };
const creatures = [];
let carry = 'none', carried = null;
let drops = 0;
function dropCarried(){ drops++; carry = 'none'; carried = null; }
const voice = [];
const Voice = { say(text, gap, pitch, bx, by, gender){ voice.push({ text: text, pitch: pitch, bx: bx, by: by, gender: gender }); } };
const WORKER_GENDER = 'male';
const sfx = [];
const SFX = { playStun(){ sfx.push('stun'); }, playTripSound(){ sfx.push('trip'); } };
function hurtNPC(amount){ throw new Error('raccoon should NOT drain health, got hurtNPC(' + amount + ')'); }

// ---- pull the REAL functions out of index.html (eval at module scope so they stay) ----
eval(extractFn('doStun'));
eval(extractFn('collideCreatures'));

// ---- assertion helper ----
let ok = true;
const check = function(label, cond, extra){
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || extra === undefined ? '' : '  [' + extra + ']'));
  if (!cond) ok = false;
};
const reset = function(){
  state = 'play';
  p.wx = 88; p.wy = 2.5; p.stunT = 0; p.invuln = 0; p.immuneT = 0;
  creatures.length = 0; carry = 'none'; carried = null; drops = 0; voice.length = 0;
};
const nearCreature = function(type, wx, wy){
  const c = { type: type, wx: wx, wy: wy, vcd: 0, g: { rotation: { z: 0 } }, flee: 0, dir: 1 };
  creatures.push(c);
  return c;
};

// ===== 1) bumping a RACCOON scares the worker: he screams "Rabies!" and trips =====
reset();
const rac = nearCreature('raccoon', p.wx + 0.3, p.wy); // inside the raccoon's 1.0 radius
collideCreatures();
const racLine = voice.find(function(v){ return v.text === 'Rabies!'; });
check('raccoon bump -> worker says "Rabies!"', !!racLine);
check('raccoon "Rabies!" is spoken BY the worker (gender = WORKER_GENDER)', racLine && racLine.gender === WORKER_GENDER, JSON.stringify(racLine || null));
check('raccoon "Rabies!" is a SCREAM (pitch 1.5, same as the rat\'s "Eeek!")', racLine && racLine.pitch === 1.5, racLine ? 'pitch=' + racLine.pitch : 'no line');
check('raccoon "Rabies!" is located at the WORKER, not the raccoon', racLine && Math.abs(racLine.bx - p.wx) < 1e-9 && Math.abs(racLine.by - p.wy) < 1e-9, racLine ? JSON.stringify({ bx: racLine.bx, by: racLine.by }) : 'no line');
check('raccoon bump -> worker trips (stunned > 0)', p.stunT > 0, 'stunT=' + p.stunT);
check('raccoon scare stun is a real trip (>= 0.5s)', p.stunT >= 0.5, 'stunT=' + p.stunT);
check('raccoon flees from the worker', rac.flee > 0, 'flee=' + rac.flee);
check('racing the raccoon does NOT drain worker health', true); // hurtNPC() would have thrown

// ===== 2) the squirrel bump gets the worker's snarky nut line (but no "Rabies!") =====
reset();
const sq = nearCreature('squirrel', p.wx + 0.3, p.wy);
collideCreatures();
const sqLine = voice.find(function(v){ return v.text === 'Gimme that nut, squirrel!'; });
check('squirrel bump -> worker snarks "Gimme that nut, squirrel!"', !!sqLine, JSON.stringify(voice));
check('squirrel snark is spoken BY the worker (gender = WORKER_GENDER)', sqLine && sqLine.gender === WORKER_GENDER, JSON.stringify(sqLine || null));
check('squirrel snark is located at the WORKER, not the squirrel', sqLine && Math.abs(sqLine.bx - p.wx) < 1e-9 && Math.abs(sqLine.by - p.wy) < 1e-9, sqLine ? JSON.stringify({ bx: sqLine.bx, by: sqLine.by }) : 'no line');
check('squirrel bump -> worker trips (stunned > 0)', p.stunT > 0, 'stunT=' + p.stunT);
check('squirrel still flees', sq.flee > 0, 'flee=' + sq.flee);

// ===== 3) the rat still yells "Eeek!" (regression) =====
reset();
const rat = nearCreature('rat', p.wx + 0.3, p.wy);
collideCreatures();
check('rat bump -> worker yells "Eeek!"', voice.length === 1 && voice[0].text === 'Eeek!', JSON.stringify(voice));
check('rat bump -> worker trips', p.stunT > 0, 'stunT=' + p.stunT);

// ===== 4) a raccoon far away does nothing =====
reset();
nearCreature('raccoon', p.wx + 50, p.wy);
collideCreatures();
check('raccoon out of range -> no line, no stun', voice.length === 0 && p.stunT === 0);

// ===== 5) RACCOON MODEL — four leg pivots + a real scurry gait =====
// (previously the legs were static stubs: animParts() guarded on c.parts,
//  which the raccoon never had, so his legs never moved)
const shim =
  'var THREE = { Group: TGroup, Mesh: TMesh, SphereGeometry: function(){}, CylinderGeometry: function(){}, ConeGeometry: function(){} };' +
  'function TGroup(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function TMesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' +
  'function M(c){return{color:{getHex:function(){return c}}}}' +
  'function SPH(r,m){var o=new TMesh();o.material=m;o.r=r;return o}' +
  'function CY(r1,r2,h,m,s){var o=new TMesh();o.material=m;return o}';

const makeRaccoon = eval('(function(){' + shim + extractFn('makeRaccoon') + 'return makeRaccoon;})()');
const animRaccoon = eval('(function(){' + shim + extractFn('makeRaccoon') + extractFn('animRaccoon') + 'return animRaccoon;})()');

const rg = makeRaccoon();
const rp = rg.userData.raccoon;
check('raccoon exposes animated parts on userData.raccoon', !!rp, 'raccoon=' + (rp ? 'yes' : 'no'));
['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n){
  check('raccoon has ' + n + ' leg pivot', !!(rp && rp[n]));
});
check('raccoon tail is on a pivot (can wag)', !!(rp && rp.tailPivot));
['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n){
  const pv = rp && rp[n];
  const leg = pv && pv.children && pv.children[0];
  check(n + ' pivot has a leg mesh hanging below the hip', !!(leg && leg.position.z < -0.05), leg ? 'z=' + leg.position.z : 'no child mesh');
});

// scurrying must actually swing the legs + wag the tail
const rc = { g: rg, phase: 0 };
let maxSwing = 0, maxWag = 0;
for (let k = 0; k < 24; k++) {
  animRaccoon(rc, 0.2618); // step through a full stride
  ['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n){ maxSwing = Math.max(maxSwing, Math.abs(rp[n].rotation.y)); });
  maxWag = Math.max(maxWag, Math.abs(rp.tailPivot.rotation.z));
}
check('raccoon legs swing when he scurries', maxSwing >= 0.5, 'maxSwing=' + maxSwing.toFixed(3));
check('raccoon tail wags when he scurries', maxWag >= 0.1, 'maxWag=' + maxWag.toFixed(3));

// diagonal-pair gait: at a quarter stride, FL+HR positive, FR+HL negative
rc.phase = 0;
animRaccoon(rc, Math.PI / 2);
const sFL = rp.legFL.rotation.y;
check('gait: FL swings +0.7 at a quarter stride', Math.abs(sFL - 0.7) < 1e-9, 'FL=' + sFL);
check('gait: HR in phase with FL (diagonal pair)', Math.abs(rp.legHR.rotation.y - sFL) < 1e-9, 'HR=' + rp.legHR.rotation.y);
check('gait: FR anti-phase with FL', Math.abs(rp.legFR.rotation.y + sFL) < 1e-9, 'FR=' + rp.legFR.rotation.y);
check('gait: HL anti-phase with FL', Math.abs(rp.legHL.rotation.y + sFL) < 1e-9, 'HL=' + rp.legHL.rotation.y);

// guard: a creature whose model lacks the parts must not throw
check('animRaccoon tolerates a model without parts', (function(){
  try { animRaccoon({ g: { userData: {} }, phase: 0 }, 0.5); return true; }
  catch (e) { return false; }
})());

console.log(ok ? '\nRACCOON ALL CHECKS PASS' : '\nRACCOON FAILURES');
process.exit(ok ? 0 : 1);
