// _squirrel_chk.js — verify the rebuilt squirrel: darker grey coat, four little
// legs on pivots (FL/FR/HL/HR), and the scurry animation swinging the legs in
// diagonal pairs (FL+HR vs FR+HL) with tail + head life.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx);
  let d = 0, i = b;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(idx, i);
}

// Bare-bones THREE shim so makeSquirrel runs in Node
function TGroup() {
  this.children = [];
  this.rotation = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
  this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
  this.scale = { x: 1, y: 1, z: 1, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; }, setScalar: function (s) { this.x = s; this.y = s; this.z = s; } };
  this.userData = {};
  this.add = function (c) { this.children.push(c); };
}
function TMesh() {
  this.rotation = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
  this.position = { x: 0, y: 0, z: 0, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
  this.scale = { x: 1, y: 1, z: 1, set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } };
}
const shim = 'var THREE = { Group: TGroup, Mesh: TMesh, SphereGeometry: function(){}, CylinderGeometry: function(){}, ConeGeometry: function(){} };' +
  'function TGroup(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function TMesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' +
  'function M(c){return{color:{getHex:function(){return c}}}}' +
  'function SPH(r,m){var o=new TMesh();o.material=m;o.r=r;return o}' +
  'function CY(r1,r2,h,m,s){var o=new TMesh();o.material=m;return o}';

const makeSquirrel = eval('(function(){' + shim + extractFn('makeSquirrel') + 'return makeSquirrel;})()');
const animSquirrel = eval('(function(){' + shim + extractFn('makeSquirrel') + extractFn('animSquirrel') + 'return animSquirrel;})()');

// --- build the model -------------------------------------------------------
const g = makeSquirrel();
const parts = g.userData.squirrel;
check('squirrel exposes animated parts on userData.squirrel', !!parts, 'squirrel=' + (parts ? 'yes' : 'no'));
const legNames = ['legFL', 'legFR', 'legHL', 'legHR'];
check('four little legs exposed (front + back pair)', legNames.every((n) => parts && parts[n] && parts[n].children.length >= 2), 'legs=' + legNames.map((n) => (parts && parts[n] ? n + ':' + parts[n].children.length : n + ':MISSING')).join(' '));
check('each leg has a limb + a foot mesh', legNames.every((n) => parts && parts[n].children.length === 2));
check('tail and head ride on pivots', !!(parts && parts.tailPivot && parts.headPivot));
check('carries a high-poly acorn (nut + cap + stem) between the front paws', parts && parts.acorn && parts.acorn.children.length === 3, 'acorn=' + (parts && parts.acorn ? parts.acorn.children.length + ' parts' : 'MISSING'));
check('acorn is COMICALLY big (nut r >= 0.08 — the old size was 0.034)', parts && parts.acorn && parts.acorn.children[0].r >= 0.08, 'nutR=' + (parts && parts.acorn ? parts.acorn.children[0].r : 'n/a'));
const haunches = (g.children || []).filter((o) => o.material && o.material.color && o.material.color.getHex() === 0x5f646b && o.r <= 0.05);
check('thighs are slimmer & flatter (2 haunches, r <= 0.045, y-scale <= 0.65 — no fat balls)', haunches.length === 2 && haunches.every((h) => h.r <= 0.045 && h.scale.y <= 0.65), 'haunches=' + haunches.length + (haunches[0] ? ' r=' + haunches[0].r + ' sy=' + haunches[0].scale.y : ''));
const feet = ['legFL', 'legFR', 'legHL', 'legHR'].map((n) => (parts && parts[n] ? parts[n].children[1] : null));
check('feet are shorter & smaller (4 feet, r <= 0.024, x-scale <= 1.0)', feet.length === 4 && feet.every((f) => f && f.r <= 0.024 && f.scale.x <= 1.0), 'feet=' + feet.length + (feet[0] ? ' r=' + feet[0].r + ' sx=' + feet[0].scale.x : ''));
check('acorn sits in front of the chest, level between the paws', parts && parts.acorn && parts.acorn.position.x > 0.09 && parts.acorn.position.y === 0, 'pos=' + (parts && parts.acorn ? JSON.stringify([parts.acorn.position.x, parts.acorn.position.y, parts.acorn.position.z]) : 'n/a'));
check('tail plume kept (3 banded segments)', parts && parts.tailPivot.children.length === 3, 'segs=' + (parts ? parts.tailPivot.children.length : 0));
check('head assembly kept (head, muzzle, nose, 2 eyes, 2 ears, 2 ear in-sides)', parts && parts.headPivot.children.length === 9, 'children=' + (parts ? parts.headPivot.children.length : 0));

// --- colour: must be a DARKER grey than the old 0x8b8f96 / 0xb7bac0 -------
const usedColors = new Set();
(function walk(o) {
  if (o.material && o.material.color && typeof o.material.color.getHex === 'function') usedColors.add(o.material.color.getHex());
  (o.children || []).forEach(walk);
})(g);
check('dark ash-grey coat in use (0x5f646b)', usedColors.has(0x5f646b), 'colors=' + [...usedColors].map((c) => '0x' + c.toString(16)).join(' '));
check('old light-grey coat gone (0x8b8f96)', !usedColors.has(0x8b8f96));
check('old light-grey accent gone (0xb7bac0)', !usedColors.has(0xb7bac0));
check('leg/foot material is the dark tone (0x27292e)', usedColors.has(0x27292e));
check('acorn colors in use (nut 0xc79b5f, cap 0x5d3f22, stem 0x3c2814)', usedColors.has(0xc79b5f) && usedColors.has(0x5d3f22) && usedColors.has(0x3c2814));

// --- animation: diagonal-pair trot, tail flick, head bob --------------------
const c = { phase: 0, g: makeSquirrel() };
let maxSwing = 0,
  sawTailFlick = false,
  sawHeadBob = false,
  diagonalBroken = false,
  antiphaseBroken = false;
for (let i = 0; i < 240; i++) {
  animSquirrel(c, (Math.PI * 2) / 240); // one full cycle in 240 steps
  const p = c.g.userData.squirrel;
  maxSwing = Math.max(maxSwing, Math.abs(p.legFL.rotation.y));
  if (Math.abs(p.tailPivot.rotation.x) > 0.1) sawTailFlick = true;
  if (Math.abs(p.headPivot.rotation.y) > 0.03) sawHeadBob = true;
  if (Math.abs(p.legFL.rotation.y - p.legHR.rotation.y) > 1e-9) diagonalBroken = true;
  if (Math.abs(p.legFL.rotation.y + p.legFR.rotation.y) > 1e-9) antiphaseBroken = true;
  if (Math.abs(p.legHL.rotation.y + p.legHR.rotation.y) > 1e-9) antiphaseBroken = true;
}
check('legs actually swing while scurrying (max |rotation.y| >= 0.7)', maxSwing >= 0.7, 'maxSwing=' + maxSwing.toFixed(3));
check('gait is diagonal-pair (FL+HR in phase, FR+HL antiphase)', !diagonalBroken && !antiphaseBroken);
check('tail flicks during the run', sawTailFlick);
check('head bobs with the stride', sawHeadBob);

// --- behavior: drive the REAL case "squirrel" block through a full pause cycle ------
function extractCase(label) {
  const idx = src.indexOf(label);
  if (idx < 0) throw new Error('case block not found: ' + label);
  const b = src.indexOf('{', idx);
  let d = 0,
    i = b;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return src.slice(idx, i);
}
const sqCase = extractCase('case "squirrel": {');
const stepSquirrel = eval(
  '(function(){' +
    shim +
    'function R(a,b){return a + (b-a)*0.5;}' +
    'var GZ = 0, p = { wx: 0 }, tx = 0, c = null;' +
    extractFn('animSquirrel') +
    'return function(dt, cc, txv){ c = cc; tx = txv; p.wx = txv; ' +
    '(function(){ switch("squirrel") { ' +
    sqCase +
    ' } })(); return c; };})()'
);
const DT = 1 / 60;
const sqC = { phase: 0, g: makeSquirrel(), sp: 3, dir: 1, flee: 0, pauseT: 0, pauseIn: 0.2, wx: 0, wy: 0, hop: 0, settle: 0 };
const sqParts = sqC.g.userData.squirrel;
for (let i = 0; i < 200 && !(sqC.pauseT > 0); i++) stepSquirrel(DT, sqC, 10);
check('pause cycle: freeze arms itself (2-3s hold)', sqC.pauseT > 0 && (sqC.pauseDur || 0) >= 2 && (sqC.pauseDur || 0) <= 3, 'pauseT=' + sqC.pauseT + ' dur=' + sqC.pauseDur);
sqC.hop = 0.22; // stopped mid-hop — the freeze must bring it back to the ground
let sawSquash = false,
  minAcornZ = Infinity,
  maxGlance = 0,
  midZ = null,
  guard = 0;
while (sqC.pauseT > 0 && guard++ < 600) {
  stepSquirrel(DT, sqC, -10); // worker is BEHIND the squirrel (tx < 0) -> look-back glance
  if ((sqC.settle || 0) > 0.2 && sqC.g.scale.z < 0.95) sawSquash = true;
  minAcornZ = Math.min(minAcornZ, sqParts.acorn.position.z);
  maxGlance = Math.max(maxGlance, Math.abs(sqParts.headPivot.rotation.z));
  if (midZ === null && sqC.pauseT > 0 && sqC.pauseT < (sqC.pauseDur || 2.5) / 2) midZ = sqC.g.position.z; // mid-hold: must be grounded
}
check('freeze lasts the full 2-3 seconds', sqC.pauseT <= 0 && sqC.pauseDur >= 2 && sqC.pauseDur <= 3, 'dur=' + sqC.pauseDur);
check('settle squash-and-stretch plays while it lands (body squishes below 0.95)', sawSquash);
check('rests ON the ground during the hold (no float)', midZ !== null && midZ < 0.01, 'midZ=' + midZ);
check('acorn is set down on the street during the hold (z <= 0.15)', minAcornZ <= 0.15, 'minZ=' + minAcornZ.toFixed(3));
check('head glances back at the worker during the hold (> 1.5 rad)', maxGlance > 1.5, 'glance=' + maxGlance.toFixed(2));
check('darts off in the OTHER direction after the pause', sqC.dir === -1, 'dir=' + sqC.dir);
check('model flips to face the new travel direction (rotation.z = PI)', sqC.g.rotation.z === Math.PI, 'rotZ=' + sqC.g.rotation.z);
check('acorn is reclaimed between the paws after the pause', sqParts.acorn.position.z === 0.24 && sqParts.acorn.position.x === 0.13, 'pos=[' + sqParts.acorn.position.x + ',' + sqParts.acorn.position.z + ']');
check('head is reset forward after the pause', sqParts.headPivot.rotation.z === 0, 'rotZ=' + sqParts.headPivot.rotation.z);
stepSquirrel(DT, sqC, -10); // one step of the fresh dash — running state must stay clean
check('running state keeps the acorn cradled and the head forward', sqParts.acorn.position.z === 0.24 && sqParts.headPivot.rotation.z === 0 && sqC.g.scale.z === 1);

console.log(ok ? '\nSQUIRREL CHECKS PASSED' : '\nSQUIRREL CHECKS FAILED');
process.exit(ok ? 0 : 1);