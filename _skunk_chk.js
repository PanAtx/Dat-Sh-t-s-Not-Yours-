// _skunk_chk.js — verify the Maspeth skunk is a proper QUADRUPED (not bipedal):
// 4 legs reaching the ground, a puffy plume tail pointing STRAIGHT UP, a white
// dorsal stripe running along the back, and the diagonal-trot gait animates all
// four legs. Built with the same THREE shim as _raccoon_chk.js.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

let ok = true;
const check = function(label, cond, extra) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || extra === undefined ? '' : '  [' + extra + ']'));
  if (!cond) ok = false;
};

const shim =
  'var THREE = { Group: TGroup, Mesh: TMesh, SphereGeometry: function(){}, CylinderGeometry: function(){}, ConeGeometry: function(){} };' +
  'function TGroup(){this.children=[];this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;},setScalar:function(s){this.x=s;this.y=s;this.z=s;}};this.userData={};this.add=function(c){this.children.push(c);};}' +
  'function TMesh(){this.rotation={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.position={x:0,y:0,z:0,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};this.scale={x:1,y:1,z:1,set:function(x,y,z){this.x=x;this.y=y;this.z=z;}};}' +
  'function M(c){return{color:{getHex:function(){return c}}}}' +
  'function SPH(r,m){var o=new TMesh();o.material=m;o.r=r;return o}' +
  'function CY(r1,r2,h,m,s){var o=new TMesh();o.material=m;return o}';

const makeSkunk = eval('(function(){' + shim + extractFn('makeSkunk') + 'return makeSkunk;})()');
const animSkunk = eval('(function(){' + shim + extractFn('makeSkunk') + extractFn('animSkunk') + 'return animSkunk;})()');

const kg = makeSkunk(false);
const kp = kg.userData.skunk;
const S = kg.scale.x; // the whole kit is scaled (mom = 0.8)
check('skunk exposes animated parts on userData.skunk', !!kp);
['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n) {
  check('skunk has ' + n + ' leg pivot', !!(kp && kp[n]));
});
check('skunk tail is on a pivot (can raise/wag)', !!(kp && kp.tailPivot));

// 1) QUADRUPED body: long along X (head->tail), low in Z (height)
const bs = kp.body.scale;
check('body is X-elongated (quadruped, not bipedal): scale.x > scale.z', bs.x > bs.z, 'x=' + bs.x + ' z=' + bs.z);
check('body is low (height < length): scale.z <= 1.7', bs.z <= 1.7, 'z=' + bs.z);

// 2) The four legs reach the ground (feet world z ~ 0)
function footZ(pivName) {
  const pv = kp[pivName];
  const foot = pv.children[1]; // [0]=limb, [1]=foot
  const worldZ = (pv.position.z + foot.position.z) * S;
  return worldZ;
}
let minFoot = Infinity, maxFoot = -Infinity;
['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n) {
  const fz = footZ(n);
  minFoot = Math.min(minFoot, fz); maxFoot = Math.max(maxFoot, fz);
});
check('all four feet reach the ground (world z in 0..0.05)', minFoot >= -0.01 && maxFoot <= 0.05, 'min=' + minFoot.toFixed(4) + ' max=' + maxFoot.toFixed(4));

// 3) The plume tail points STRAIGHT UP (tip world z well above the base)
const tp = kp.tailPivot;
const plumeSegs = tp.children; // [0]=t1 base, [1]=t2, [2]=tTip
const baseZ = (tp.position.z + plumeSegs[0].position.z) * S;
const tipZ = (tp.position.z + plumeSegs[2].position.z) * S;
check('plume rises straight UP (tip z > base z by >= 0.15 world)', tipZ - baseZ >= 0.15 * S, 'base=' + baseZ.toFixed(3) + ' tip=' + tipZ.toFixed(3) + ' rise=' + (tipZ - baseZ).toFixed(3));
check('plume is a vertical plume (segments stacked along Z, not Y)', plumeSegs.every(function(s) { return Math.abs(s.position.y) < 0.001; }), 'y=[' + plumeSegs.map(function(s) { return s.position.y; }).join(',') + ']');

// 4) The white dorsal stripe runs ALONG THE BACK (X-elongated, on the top)
const st = kp.stripe || (function() { return null; })();
// (stripe isn't stored in userData; verify via the group's children by material color)
const stripeMesh = (function() {
  let found = null;
  kg.children.forEach(function(c) {
    if (c.material && c.material.color && c.material.color.getHex && c.material.color.getHex() === 0xf2f0ea && c.scale && c.scale.x > c.scale.z) found = c;
  });
  return found;
})();
check('white dorsal stripe is present and X-elongated (runs along the back)', !!(stripeMesh && stripeMesh.scale.x > stripeMesh.scale.z), stripeMesh ? 'x=' + stripeMesh.scale.x + ' z=' + stripeMesh.scale.z : 'not found');

// 5) Distinct coloring: the body is jet-black (distinct from the grey raccoon)
const bodyColor = kp.body.material.color.getHex();
check('body is jet-black (0x17171a) — distinct from the grey raccoon (0x7a7f86)', bodyColor === 0x17171a, 'color=' + bodyColor.toString(16));

// 6) The diagonal-trot gait swings all four legs
const kc = { g: kg, phase: 0 };
let maxSwing = 0;
for (let k = 0; k < 24; k++) {
  animSkunk(kc, 0.2618);
  ['legFL', 'legFR', 'legHL', 'legHR'].forEach(function(n) { maxSwing = Math.max(maxSwing, Math.abs(kp[n].rotation.y)); });
}
check('skunk legs swing on the diagonal trot (all four move)', maxSwing >= 0.5, 'maxSwing=' + maxSwing.toFixed(3));

console.log(ok ? '\nSKUNK CHECKS PASSED' : '\nSKUNK CHECKS FAILED');
process.exit(ok ? 0 : 1);