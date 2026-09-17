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
  'function SPH(r,m){var o=new TMesh();o.material=m;return o}' +
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

console.log(ok ? '\nSQUIRREL CHECKS PASSED' : '\nSQUIRREL CHECKS FAILED');
process.exit(ok ? 0 : 1);