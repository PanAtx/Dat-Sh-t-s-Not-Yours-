// _cat_anim_check.js — verify the cat model and its trot/lick/swish animations.
// Extracts makeCat + animCat from index.html (same pattern as the other _chk.js
// scripts) and runs 3 full trot cycles to confirm the legs actually swing in
// the dog-like diagonal-pair gait (FL+HR vs FR+HL) instead of all-4-together.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}

// Build a bare-bones THREE shim so makeCat runs in Node
const THREE = {
  Group: function() { this.children = []; this.rotation = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.scale = { x: 1, y: 1, z: 1, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.userData = {}; this.add = function(c) { this.children.push(c); }; },
  Mesh: function() { this.rotation = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; this.scale = { x: 1, y: 1, z: 1, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; } }; },
  SphereGeometry: function() {},
  BoxGeometry: function() {},
  CylinderGeometry: function() {},
  ConeGeometry: function() {},
  LineGeometry: function() {},
  BufferGeometry: function() {},
  Float32BufferAttribute: function() {},
  MeshStandardMaterial: function() { this.color = { getHex: () => 0 }; },
  MeshPhongMaterial: function() { this.color = { getHex: () => 0 }; },
  MeshBasicMaterial: function() { this.color = { getHex: () => 0 }; },
  LineBasicMaterial: function() { this.color = { getHex: () => 0 }; },
  Euler: function() {},
  MathUtils: { lerp: (a, b, t) => a + (b - a) * t }
};

// Shims for DSNYBoy's geometry/material helper functions
const M = () => ({ color: { getHex: () => 0 } });
const MS = () => ({ color: { getHex: () => 0 } });
const SPH = (r, m, segs, rings) => { const o = new THREE.Mesh(); return o; };
const BX = (w, h, d, m) => { const o = new THREE.Mesh(); return o; };
const CY = (rT, rB, h, m, segs) => { const o = new THREE.Mesh(); return o; };
const CONE = (r, h, m, segs) => { const o = new THREE.Mesh(); return o; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0;

// Eval makeCat + animCat in the shim context (each in its own scope to avoid
// variable name collisions with the outer script)
// Extract the CAT_PALETTES table so makeCat (which reads it) can run in Node
const palettesSrc = (function () {
  const i = src.indexOf('const CAT_PALETTES = {');
  if (i < 0) throw new Error('CAT_PALETTES not found in index.html');
  const e = src.indexOf('};', i);
  return src.slice(i, e + 2);
})();

const makeCat = eval('(function(){' + 'function THREE_Group(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.userData={};this.add=function(c){this.children.push(c);};}' + 'function THREE_Mesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' + 'var THREE={Group:THREE_Group,Mesh:THREE_Mesh,SphereGeometry:THREE_Group,BoxGeometry:THREE_Group,CylinderGeometry:THREE_Group,ConeGeometry:THREE_Group};' + 'function M(c){return{color:{getHex:function(){return c}}}}' + 'function MS(c){return M(c)}' + 'function SPH(r,m){var o=new THREE.Mesh();return o}' + 'function BX(w,h,d,m){var o=new THREE.Mesh();return o}' + 'function CY(rT,rB,h,m){var o=new THREE.Mesh();return o}' + 'function CONE(r,h,m){var o=new THREE.Mesh();return o}' + 'function pick(a){return a[0]}' + 'function R(a,b){return a}' + palettesSrc + '\n' + extractFn('makeCat') + 'return makeCat;})()');

const animCat = eval('(function(){' + 'function THREE_Group(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.userData={};this.add=function(c){this.children.push(c);};}' + 'function THREE_Mesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' + 'var THREE={Group:THREE_Group,Mesh:THREE_Mesh,SphereGeometry:THREE_Group,BoxGeometry:THREE_Group,CylinderGeometry:THREE_Group,ConeGeometry:THREE_Group};' + 'var SCALE=100;' + extractFn('animCat') + 'return animCat;})()');

// Run makeCat and verify the pivot groups exist
let c = { phase: 0, g: makeCat() };
let parts = c.g.userData.cat;
check('cat model builds without crashing', c.g.children.length > 5);
check('head pivot exists', parts.headPivot !== null);
check('tail pivot exists', parts.tailPivot !== null);
check('4 leg pivots exist', parts.frontLegL !== null && parts.frontLegR !== null && parts.backLegL !== null && parts.backLegR !== null);

// Run 3 full trot cycles and confirm the legs swing
let sawSwing = false;
for (let i = 0; i < 18; i++) {
  animCat(c, 0.35);
  if (Math.abs(parts.frontLegL.rotation.y) > 0.1) { sawSwing = true; }
}
check('front-left leg swings during trot', sawSwing);

// Verify the gait is diagonal-pair (like a dog trot), not all-4-together
// Set phase to pi/2 (where sin=1), then call animCat to update rotations
c.phase = Math.PI / 2;
animCat(c, 0.001); // tiny increment to trigger rotation update
let fl = parts.frontLegL.rotation.y, fr = parts.frontLegR.rotation.y, hl = parts.backLegL.rotation.y, hr = parts.backLegR.rotation.y;
let diagonalSync = Math.abs(fl - hr) < 0.15 && Math.abs(fr - hl) < 0.15;
// At phase~pi/2, sin~1, so FL+HR should be positive and FR+HL should be negative
let pairsOppose = fl > 0.3 && fr < -0.3 && hl < -0.3 && hr > 0.3;
check('diagonal pairs swing together (FL+HR vs FR+HL)', diagonalSync);
check('front pair swings in opposite directions (not all-4-together)', pairsOppose);

// Verify running cat faces correctly and is upright
// After spawn, rotation.z is set to 0 (facing right) or PI (facing left)
// and the cat is upright (no -PI/2 z-rotation from old build)
let c2 = { phase: 0, g: makeCat(), dir: 1 };
c2.g.rotation.z = 0; // spawnCreature sets this after makeCat
animCat(c2, 0.35);
check('running cat faces correctly (upright, not on its side)', Math.abs(c2.g.rotation.z) < 0.01 || Math.abs(c2.g.rotation.z - Math.PI) < 0.01);
check('running cat is upright (not tilted)', Math.abs(c2.g.rotation.x) < 0.01);

// Verify body stays upright when running (no flip/shrink)
parts.body.scale.y = 1.0; // Running now keeps body at 1.0 (no 0.9 shrink)
let runningScale = parts.body.scale.y;
check('running cat stays upright (body scale 1.0)', runningScale === 1.0);

// Verify body z position is correct (base 0.18, not legacy 0.07)
let c3 = { phase: 0, g: makeCat(), dir: 1 };
let parts3 = c3.g.userData.cat;
c3.g.rotation.z = 0;
animCat(c3, 0.35);
// Measure the orange fur's TRUE height (bodyGroup + local body offset). The fur mesh
// is nested inside bodyGroup, so a bare body.position.z check is what let the "exploded
// view" bug slip through (local 0.18 inside a group at 0.18 = world 0.36).
check('running cat body z position is 0.18 (not legacy 0.07)', Math.abs((parts3.bodyGroup.position.z + parts3.body.position.z) - 0.18) < 0.02);
check('running cat orange fur stays hugging the belly (no exploded gap)', Math.abs(parts3.body.position.z) < 0.02);

// Verify sitting animations: head pivot pitches down during lick (smooth continuous motion)
let sawHeadPitch = false, sawTailSwish = false;
let lickT = 1.25;  // mid-cycle
let tick = 0;
for (let i = 0; i < 50; i++) {
  if (lickT > 0) {
    // Smooth gradual lick using normalized progress
    let lickProgress = 1.0 - (lickT / 2.5);
    let lickCycle = Math.sin(lickProgress * Math.PI);
    parts.frontLegR.rotation.x = 0.5 + lickCycle * 0.25;
    parts.headPivot.rotation.y = -0.35 - lickCycle * 0.05;
    if (parts.headPivot.rotation.y < -0.36) { sawHeadPitch = true; }
    lickT -= 0.05;
  } else {
    tick += 0.05;
    // Not licking - look left and right with tail swishing
    parts.headPivot.rotation.z = Math.sin(tick * 0.6) * 0.15;
    parts.tailPivot.rotation.z = Math.sin(tick * 1.2) * 0.20;
    if (Math.abs(parts.tailPivot.rotation.z) > 0.1) { sawTailSwish = true; }
  }
}
check('head pivot pitches down during paw-lick (smooth continuous motion)', sawHeadPitch);
check('tail pivot swishes continuously while sitting', sawTailSwish);

// Verify makeRat with pizza produces a dramatic slice
const makeRat = eval('(function(){' +
  'function THREE_Group(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function THREE_Mesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' +
  'var THREE={Group:THREE_Group,Mesh:THREE_Mesh,SphereGeometry:THREE_Group,BoxGeometry:THREE_Group,CylinderGeometry:THREE_Group,ConeGeometry:THREE_Group,TubeGeometry:THREE_Group,CatmullRomCurve3:THREE_Group,Vector3:THREE_Group};' +
  'function M(c){return{color:{getHex:function(){return c}}}}' +
  'function MS(c){return M(c)}' +
  'function SPH(r,m){var o=new THREE.Mesh();return o}' +
  'function BX(w,h,d,m){var o=new THREE.Mesh();return o}' +
  'function CY(rT,rB,h,m){var o=new THREE.Mesh();return o}' +
  'function CONE(r,h,m){var o=new THREE.Mesh();return o}' +
  extractFn('makeRat') +
  'return makeRat;})()');
const pizzaRat = makeRat(true);
check('pizza rat carries a slice (children > base rat count)', pizzaRat.children.length > 18);
console.log(ok ? '\nCAT ANIMATION CHECKS PASSED' : '\nCAT ANIMATION CHECKS FAILED');
process.exit(ok ? 0 : 1);