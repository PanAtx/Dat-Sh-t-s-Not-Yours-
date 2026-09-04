// Runtime proof: executes the ACTUAL makeSkater + addCreature + updateCreatures
// code from index.html in Node and steps the sim forward in time. If the code is
// correct, the board MUST spin (kickflip) and the rider MUST leave the ground.
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');

function fnSrc(name){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++){
    if (src[k] === '{') depth++;
    else if (src[k] === '}'){ depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces: ' + name);
}

// ---- minimal world stubs (only what the skater path touches) ----
function P3(){ this.x = 0; this.y = 0; this.z = 0; }
P3.prototype.set = function(x, y, z){ this.x = x; this.y = y; this.z = z; return this; };
class Group {
  constructor(){ this.children = []; this.position = new P3(); this.rotation = { x: 0, y: 0, z: 0 }; this.userData = {}; this.material = null; }
  add(o){ this.children.push(o); }
}
class Mesh extends Group { constructor(g, m){ super(); this.geometry = g; this.material = m; } }
global.THREE = { Group, Mesh,
  BoxGeometry: class { constructor(w, h, d){ this.w = w; this.h = h; this.d = d; } },
  CylinderGeometry: class { constructor(a, b, h){ this.h = h; } },
  SphereGeometry: class {}, SphereBufferGeometry: class {} };
const M = (c, o) => Object.assign({ color: c }, o || {});
const MS = (c, o) => M(c, o);
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[(Math.random() * a.length) | 0];
const SKIN_TONES = [0xf3d1a5], SHIRTS = [0x2a6fd0], HAIRS = [0x222222], PANTS = [0x2f3640];
const BX = (w, h, d, mat) => new Mesh(new THREE.BoxGeometry(w, h, d), mat);
const CY = (rt, rb, h, mat, seg) => new Mesh(new THREE.CylinderGeometry(rt, rb, h), mat);
const SP = (r, mat, seg) => new Mesh(new THREE.SphereGeometry(r), mat);
const SPH = (r, mat, ws, hs) => new Mesh(new THREE.SphereBufferGeometry(r), mat);
const GZ = 0.3;
const dynamicGroup = new Group();
const creatures = [];
const p = { wx: 0, wy: 0, invuln: 0, stunT: 0 };
const state = 'play';
const Voice = { say(){} };
const npcRoadRules = () => 0, animParts = () => {}, spawnGravelBits = () => {}, spawnDustEffect = () => {};
const separateVehicles = () => {}, resolveTruckCollisions = () => {};

// ---- execute the REAL functions from index.html ----
eval(fnSrc('makeSkater') + '\n' + fnSrc('addCreature') + '\n' + fnSrc('updateCreatures'));

const sk = addCreature('skater');
let pass = true; const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };
check('skater creature exists with a board + limbs', !!sk && !!sk.board && !!sk.parts);

let boardLift = 0, riderLift = 0, riderDip = 0, flipFrames = 0, armSwing = 0;
const FRAMES = 480; // 8 simulated seconds @ 60fps
for (let f = 0; f < FRAMES; f++){
  updateCreatures(1 / 60);
  boardLift = Math.max(boardLift, sk.board.position.z);
  riderLift = Math.max(riderLift, sk.g.position.z);
  riderDip = Math.min(riderDip, sk.g.position.z);
  if (sk.board.rotation.x > 0.2) flipFrames++;
  armSwing = Math.max(armSwing, Math.abs(sk.parts.armL.rotation.z));
}
check('board FLIPS end-over-end across many frames: ' + flipFrames + '/' + FRAMES, flipFrames > FRAMES * 0.2);
check('board lifts off his feet: max z ' + boardLift.toFixed(2) + ' (expect ~0.94)', boardLift >= 0.9);
check('rider LAUNCHES: peak z ' + riderLift.toFixed(2) + ' (GZ=' + GZ + ')', riderLift >= GZ + 0.45);
check('rider CROUCHES first: dip z ' + riderDip.toFixed(2) + ' (below GZ)', riderDip < GZ - 0.1);
check('arms swing for balance: ' + armSwing.toFixed(2), armSwing >= 0.5);
console.log(pass ? '\nSKATER RUNTIME ANIMATION PROVEN (real game code)' : '\nSKATER RUNTIME ANIMATION BROKEN');
process.exit(pass ? 0 : 1);