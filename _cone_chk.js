// _cone_chk.js — verify the knockable roadwork traffic cone.
//   * builds cleanly (base plate + tip-able body: cone + two reflective stripes + tip)
//   * the two white stripes are a glossy, EMISSIVE reflective material (not flat Lambert)
//   * the base plate stays on the ground; only the body topples (limited dip, no deep sink)
//   * a worker bumping an upright cone topples it AWAY from the worker with a spring wobble
//     that settles near CONE_TOPPLE (no negative runaway, bounded overshoot)
//   * immune workers walk right through (no knock); wiring is present in index.html
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- three r128 (same cached copy as the other checks) ---
const T = path.join(__dirname, '_three128.js');
if (!fs.existsSync(T)) {
  console.log('downloading three r128 build...');
  execSync('curl -L -o _three128.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', {
    cwd: __dirname,
    stdio: 'inherit',
  });
}
const THREE = require(T);

// --- game-side helpers (copied verbatim from index.html) ---
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
function M(c, opt) {
  return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {}));
}
function MS(c, opt) {
  return new THREE.MeshStandardMaterial(
    Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {}),
  );
}
function BX(w, h, d, m) {
  const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  q.castShadow = true;
  return q;
}
function CY(r1, r2, h, m, s) {
  const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m);
  q.castShadow = true;
  return q;
}

// --- extract the REAL cone functions verbatim from index.html (brace-counted) ---
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name) {
  const s = src.indexOf('function ' + name + '(');
  if (s < 0) throw new Error(name + ' not found');
  let i = s,
    depth = 0,
    started = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
      started = true;
    } else if (ch === '}') {
      depth--;
      if (started && depth === 0) {
        i++;
        break;
      }
    }
  }
  return src.slice(s, i);
}

// --- game state the cone code references (minimal but faithful) ---
const p = { wx: 0, wy: 0, invuln: 0, immuneT: 0, stunT: 0 };
const blocks = [];
const sfxLog = [];
const GZ = 0;
const WORKER_GENDER = 'male';
let state = 'play';
const SFX = {
  playConeKnock() {
    sfxLog.push('knock');
  },
  playStun() {},
  playTripSound() {},
};
const Voice = { say() {} };
const CONE_TOPPLE = 1.35; // must match index.html
const CONE_KNOCK_R = 0.85;

// Build the REAL cone functions in one factory so their internal references
// (coneFallAxis, CONE_TOPPLE, game state) all resolve in a single scope.
const C = new Function(
  'THREE',
  'M',
  'MS',
  'BX',
  'CY',
  'R',
  'pick',
  'CONE_TOPPLE',
  'CONE_KNOCK_R',
  'p',
  'blocks',
  'SFX',
  'Voice',
  'state',
  'WORKER_GENDER',
  extract('makeTrafficCone') +
    '\n' +
    extract('coneFallAxis') +
    '\n' +
    extract('registerCone') +
    '\n' +
    extract('updateConeProps') +
    '\n;return { makeTrafficCone: makeTrafficCone, coneFallAxis: coneFallAxis, registerCone: registerCone, updateConeProps: updateConeProps };'
)(THREE, M, MS, BX, CY, R, pick, CONE_TOPPLE, CONE_KNOCK_R, p, blocks, SFX, Voice, state, WORKER_GENDER);
const makeTrafficCone = C.makeTrafficCone;
const coneFallAxis = C.coneFallAxis;
const registerCone = C.registerCone;
const updateConeProps = C.updateConeProps;

let ok = true;
const check = (label, cond, info) => {
  console.log(
    '  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || info === undefined ? '' : '  [' + info + ']'),
  );
  if (!cond) ok = false;
};


console.log('makeTrafficCone — geometry & materials:');
const rc = makeTrafficCone();
rc.updateMatrixWorld(true);
const body = rc.userData.body;
check('cone returns a THREE.Group', !!rc.isGroup || rc.type === 'Group');
check('has a tip-able body subgroup (userData.body)', !!body);

let meshes = 0,
  baseMeshes = 0,
  bodyMeshes = 0,
  nonFinite = 0;
rc.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  let inBody = false,
    n = o;
  while (n) {
    if (n === body) inBody = true;
    n = n.parent;
  }
  if (inBody) bodyMeshes++;
  else baseMeshes++;
  const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
  if (pos)
    for (let i = 0; i < pos.count; i++) {
      if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i))) nonFinite++;
    }
});
check('builds several meshes (base + body parts)', meshes >= 5, String(meshes));
check('base plate lives OUTSIDE the body (stays grounded)', baseMeshes >= 2, String(baseMeshes));
check('body has cone + 2 stripes + tip', bodyMeshes >= 4, String(bodyMeshes));
check('no non-finite geometry', nonFinite === 0, String(nonFinite));

let stripeStandard = 0;
body.traverse((o) => {
  if (!o.isMesh) return;
  const m = o.material;
  if (m && m.isMeshStandardMaterial && (m.emissiveIntensity || 0) > 0 && (m.metalness || 0) > 0)
    stripeStandard++;
});
check('two glossy, EMISSIVE reflective stripe materials', stripeStandard >= 2, String(stripeStandard));

function minWorldZ(group) {
  group.updateMatrixWorld(true);
  let mn = Infinity;
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z < mn) mn = v.z;
    }
  });
  return mn;
}
const upMinZ = minWorldZ(rc);
check('upright cone: base grounded (min z >= -1e-4)', upMinZ >= -1e-4, upMinZ.toFixed(4));

const demo = makeTrafficCone();
const cc = { axisA: 0.7, tilt: 0, tiltVel: 0, body: demo.userData.body };
cc.body.quaternion.setFromAxisAngle(coneFallAxis(cc), CONE_TOPPLE);
const knockedMinZ = minWorldZ(demo);
check('knocked cone: dip is limited (min z >= -0.30)', knockedMinZ >= -0.30, knockedMinZ.toFixed(4));
let baseMinZ = Infinity;
demo.children
  .filter((o) => o.isMesh)
  .forEach((o) => {
    o.updateMatrixWorld(true);
    const pos = o.geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z < baseMinZ) baseMinZ = v.z;
    }
  });
check('base plate stays grounded even when knocked (>= -1e-4)', baseMinZ >= -1e-4, baseMinZ.toFixed(4));

console.log('registerCone — pre-fallen variation:');
const bb = { cones: [] };
const rc2 = makeTrafficCone();
const pre = registerCone(bb, rc2, 3, 2, true);
check('registers on b.cones', bb.cones.length === 1 && bb.cones[0] === pre);
check(
  'pre-fallen cone starts knocked at CONE_TOPPLE',
  pre.state === 'knocked' && Math.abs(pre.tilt - CONE_TOPPLE) < 1e-9,
  pre.state + ' ' + pre.tilt,
);


console.log('updateConeProps — bump topples the cone AWAY from the worker:');
const bUp = { cones: [] };
const rcUp = makeTrafficCone();
const up = registerCone(bUp, rcUp, 5, 0, false);
blocks.length = 0;
blocks.push(bUp);
p.wx = 5 - CONE_KNOCK_R + 0.05; // 0.8 inside the 0.85 knock radius
p.wy = 0;
p.immuneT = 0;
p.invuln = 0;
sfxLog.length = 0;
updateConeProps(1 / 60);
check('bump triggers the topple (state -> knocked)', up.state === 'knocked', up.state);
check('SFX.playConeKnock fired', sfxLog.indexOf('knock') >= 0, JSON.stringify(sfxLog));
const away = Math.cos(up.axisA) * (up.wx - p.wx) + Math.sin(up.axisA) * (up.wy - p.wy);
check('cone falls AWAY from the worker', away > 0, 'away=' + away.toFixed(3));

console.log('updateConeProps — spring settle (worker steps out of range):');
p.wx = 5 - 10;
p.wy = 0;
let maxTilt = -Infinity,
  minTilt = Infinity;
for (let i = 0; i < 600; i++) {
  updateConeProps(1 / 60); // ~10s of settling
  if (up.tilt > maxTilt) maxTilt = up.tilt;
  if (up.tilt < minTilt) minTilt = up.tilt;
}
check('spring settles near CONE_TOPPLE', Math.abs(up.tilt - CONE_TOPPLE) < 0.12, 'settled=' + up.tilt.toFixed(4));
check('no negative runaway (min tilt >= -0.2)', minTilt >= -0.2, minTilt.toFixed(4));
check('bounded overshoot (max tilt <= 1.8)', maxTilt <= 1.8, maxTilt.toFixed(4));

console.log('updateConeProps — immune workers walk right through:');
const bImm = { cones: [] };
const rcImm = makeTrafficCone();
const imm = registerCone(bImm, rcImm, 5, 0, false);
blocks.length = 0;
blocks.push(bImm);
p.wx = 5 - CONE_KNOCK_R + 0.05;
p.wy = 0;
p.immuneT = 5; // monster buff active
updateConeProps(1 / 60);
check('immune: cone stays upright (no knock)', imm.state === 'up', imm.state);
p.immuneT = 0;

console.log('wiring (index.html source):');
check('updateConeProps(dt) called in the play loop', /updateConeProps\(dt\)/.test(src));
check('SFX.playConeKnock defined', /playConeKnock\(\)\s*\{/.test(src));
const _hzIdx = src.indexOf('b.hazards = [];');
const _cnIdx = src.indexOf('b.cones = [];');
check(
  'b.cones reset in makeBlockContents',
  _hzIdx >= 0 && _cnIdx >= 0 && _cnIdx - _hzIdx < 60,
  'hz=' + _hzIdx + ' cn=' + _cnIdx,
);
check('addPothole spawns cone(s) via makeTrafficCone + registerCone', /makeTrafficCone\(\)/.test(src) && /registerCone\(b, rc, wx \+ cs\.lx, wy \+ cs\.ly, cs\.fallen\)/.test(src));

console.log(ok ? '\nTRAFFIC CONE CHECKS PASSED' : '\nTRAFFIC CONE CHECKS FAILED');
process.exit(ok ? 0 : 1);
