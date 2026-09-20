// _dotpos.js — exact 3D position of the orange dot row on the truck's +Y side
// (the circles visible next to the "sanitation" banner). For each dot center
// UV, finds the containing triangle in body 0_0/0_1 and interpolates the exact
// world (group-local) position + normal.
'use strict';
const fs = require('fs');
const path = require('path');
const THREE = require('./three_r128.min.js');
global.THREE = THREE;
global.window = global;
global.self = global;
global.document = { createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {} }) };
global.Image = function () { return global.document.createElementNS('', 'img'); };
global.fetch = async (url) => new Response(Buffer.alloc(0));
require('./FBXLoader.js');
for (const L of [THREE.TextureLoader, THREE.CubeTextureLoader, THREE.FBXLoader]) {
  if (L && !L.prototype.loadAsync) L.prototype.loadAsync = function () {};
}

const TRUCK_SCALE = 0.4394;
function rotFromUpFront(up, front) {
  up = up.clone().normalize();
  front = front ? front.clone() : new THREE.Vector3();
  if (front.lengthSq() > 1e-10) front.addScaledVector(up, -up.dot(front));
  if (front.lengthSq() < 1e-10) {
    const a = Math.abs(up.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    front.crossVectors(up, a);
  }
  front.normalize();
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  return new THREE.Matrix4().set(
    front.x, front.y, front.z, 0,
    right.x, right.y, right.z, 0,
    up.x, up.y, up.z, 0,
    0, 0, 0, 1,
  );
}
function defaultOrient(tpl) {
  tpl.updateWorldMatrix(true, true);
  const s = new THREE.Box3().setFromObject(tpl).getSize(new THREE.Vector3());
  const up = new THREE.Vector3();
  up.setComponent([s.x, s.y, s.z].indexOf(Math.max(s.x, s.y, s.z)), 1);
  return rotFromUpFront(up, null);
}
function orientTruck(tpl) {
  const wheels = [];
  tpl.updateWorldMatrix(true, true);
  tpl.traverse((o) => {
    if (o.isMesh && o.name && /wheel/i.test(o.name)) wheels.push(o);
  });
  if (wheels.length) {
    const box = new THREE.Box3();
    wheels.forEach((w) => {
      w.updateWorldMatrix(true, true);
      box.union(new THREE.Box3().setFromObject(w));
    });
    const sp = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
    const up = new THREE.Vector3();
    up.setComponent(sp.indexOf(Math.min(...sp)), 1);
    let F = new THREE.Vector3(),
      R = new THREE.Vector3(),
      nf = 0,
      nr = 0;
    wheels.forEach((w) => {
      const c = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
      if (/front/i.test(w.name)) {
        F.add(c);
        nf++;
      } else if (/rear/i.test(w.name)) {
        R.add(c);
        nr++;
      }
    });
    if (nf) F.multiplyScalar(1 / nf);
    if (nr) R.multiplyScalar(1 / nr);
    return rotFromUpFront(up, nf && nr ? F.sub(R) : null);
  }
  return defaultOrient(tpl);
}
function fbxInstance(tpl, scale) {
  const c = tpl.clone();
  const rotGrp = new THREE.Group();
  rotGrp.quaternion.setFromRotationMatrix(tpl.orient || new THREE.Matrix4());
  rotGrp.scale.setScalar(scale);
  rotGrp.add(c);
  const holder = new THREE.Group();
  holder.add(rotGrp);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(rotGrp);
  const ctr = box.getCenter(new THREE.Vector3());
  rotGrp.position.set(-ctr.x, -ctr.y, -box.min.z);
  holder.updateWorldMatrix(true, true);
  return holder;
}

const fbx = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
const scene = new THREE.FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), '');
scene.updateWorldMatrix(true, true);
scene.orient = orientTruck(scene);
const g = fbxInstance(scene, TRUCK_SCALE);
g.updateWorldMatrix(true, true);

const bodyMeshes = [];
g.traverse((o) => {
  if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bodyMeshes.push(o);
});

// dot centers in texture pixels (from _find_uv / pixel inspection), 2048x2048
const DOTS = [
  [1132, 598],
  [1282, 598],
  [1433, 598],
  [1580, 598],
];
const BANNER = [1300, 574];

function uvToWorld(U, V) {
  for (const bm of bodyMeshes) {
    const pos = bm.geometry.attributes.position,
      uv = bm.geometry.attributes.uv;
    const M = bm.matrixWorld;
    for (let t = 0; t < pos.count / 3; t++) {
      const i = t * 3;
      const ua = uv.getX(i),
        va = uv.getY(i),
        ub = uv.getX(i + 1),
        vb = uv.getY(i + 1),
        uc = uv.getX(i + 2),
        vc = uv.getY(i + 2);
      const v1x = ub - ua,
        v1y = vb - va,
        v2x = uc - ua,
        v2y = vc - va;
      const det = v1x * v2y - v1y * v2x;
      if (Math.abs(det) < 1e-12) continue;
      const w = (v2y * (U - ua) - v2x * (V - va)) / det;
      const x = (v1x * (V - va) - v1y * (U - ua)) / det;
      if (w < -1e-5 || x < -1e-5 || w + x > 1 + 1e-5) continue;
      const A = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(M);
      const B = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(M);
      const C = new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(M);
      const P = A.clone().addScaledVector(B.clone().sub(A), w).addScaledVector(C.clone().sub(A), x);
      const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
      return { p: P, n, mesh: bm.name, tri: t };
    }
  }
  return null;
}

console.log('DOT POSITIONS (group-local; +Z up, +X truck front, +Y = side with banner):');
DOTS.forEach((d, i) => {
  const U = d[0] / 2048,
    V = 1 - d[1] / 2048;
  const r = uvToWorld(U, V);
  console.log(
    'dot' + (i + 1) + ' tex=(' + d[0] + ',' + d[1] + ') -> ' + (r ? 'pos=(' + r.p.x.toFixed(3) + ',' + r.p.y.toFixed(3) + ',' + r.p.z.toFixed(3) + ') n=(' + r.n.x.toFixed(2) + ',' + r.n.y.toFixed(2) + ',' + r.n.z.toFixed(2) + ') ' + r.mesh + ' tri' + r.tri : 'NO HIT'),
  );
});
{
  const U = BANNER[0] / 2048,
    V = 1 - BANNER[1] / 2048;
  const r = uvToWorld(U, V);
  console.log('banner center -> ' + (r ? 'pos=(' + r.p.x.toFixed(3) + ',' + r.p.y.toFixed(3) + ',' + r.p.z.toFixed(3) + ') n=(' + r.n.x.toFixed(2) + ',' + r.n.y.toFixed(2) + ',' + r.n.z.toFixed(2) + ')' : 'NO HIT'));
}

