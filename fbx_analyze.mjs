import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const buf = fs.readFileSync('truck.fbx');
// Node Buffer is backed by a shared pool -> convert to a standalone ArrayBuffer
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// Stub browser globals the loader uses only for embedded images (not needed for geometry)
function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0 }; }
global.window = { URL: { createObjectURL: () => 'data:image/png;base64,iVBORw0KGgo=' } };
global.document = { createElementNS: fakeEl, createElement: fakeEl };
const loader = new FBXLoader();
let obj;
try {
  obj = loader.parse(ab, '');
} catch (e) {
  console.error('PARSE ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
}

// ---- Model -> game axis mapping (verified against part positions) ----
// FBX +X = up   -> game +Z (up)
// FBX +Y = width -> game +Y (lateral, mirrored is fine)
// FBX +Z = length -> game +X (route). Hopper(compactor) is at most-negative Z -> most-negative X (rear).
const axisRot = new THREE.Matrix4().set(
  0, 0,  1, 0,
  0, -1, 0, 0,
  1, 0,  0, 0,
  0, 0,  0, 1
);

function findName(root, re){ let r=null; root.traverse(o=>{ if(o.name && re.test(o.name) && (!r || r.name.length<o.name.length)) r=o; }); return r; }

// Bake a group's FULL world transform into a self-contained clone (preserves any parent/own scales)
function extract(src){
  src.updateWorldMatrix(true, true);
  const world = new THREE.Matrix4().copy(src.matrixWorld);
  const c = src.clone();
  c.position.setFromMatrixPosition(world);
  c.quaternion.setFromRotationMatrix(world);
  c.scale.setFromMatrixScale(world);
  return c;
}

function buildInstance(src, scale){
  const c = extract(src);
  const rotGrp = new THREE.Group();
  rotGrp.quaternion.setFromRotationMatrix(axisRot);
  rotGrp.scale.setScalar(scale);
  rotGrp.add(c);
  const holder = new THREE.Group();
  holder.add(rotGrp);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(rotGrp);
  const ctr = box.getCenter(new THREE.Vector3());
  rotGrp.position.set(-ctr.x, -ctr.y, -box.min.z); // center XY, bottom -> z=0
  holder.updateWorldMatrix(true, true);
  return holder;
}

function partGamePos(holder, re){
  const p = findName(holder, re);
  if (!p) return null;
  const wp = new THREE.Vector3();
  p.getWorldPosition(wp);
  const box = new THREE.Box3().setFromObject(p);
  const pc = box.getCenter(new THREE.Vector3());
  return { center: [pc.x.toFixed(2), pc.y.toFixed(2), pc.z.toFixed(2)], pos: [wp.x.toFixed(2), wp.y.toFixed(2), wp.z.toFixed(2)] };
}

function report(label, src, scale, parts){
  console.log('\n================ ' + label + ' (scale=' + scale + ') ================');
  const holder = buildInstance(src, scale);
  const box = new THREE.Box3().setFromObject(holder);
  const s = box.getSize(new THREE.Vector3());
  console.log('  FINAL holder size(x,y,z) = [' + s.x.toFixed(2) + ', ' + s.y.toFixed(2) + ', ' + s.z.toFixed(2) + ']  (x=route, y=lateral, z=up)');
  console.log('  FINAL min = [' + box.min.x.toFixed(2) + ', ' + box.min.y.toFixed(2) + ', ' + box.min.z.toFixed(2) + ']  max = [' + box.max.x.toFixed(2) + ', ' + box.max.y.toFixed(2) + ', ' + box.max.z.toFixed(2) + ']');
  (parts || []).forEach(([name, re]) => {
    const pos = partGamePos(holder, re);
    console.log('  part ' + name.padEnd(22) + (pos ? '  center=[' + pos.center.join(', ') + ']' : '  NOT FOUND'));
  });
  return holder;
}

const truck = findName(obj, /garbageTruck_geo_grp/i);
const can   = findName(obj, /garbageBin_geo_grp/i);
const bag   = findName(obj, /truck_trash_grp/i);

report('TRUCK', truck, 0.30, [
  ['hopper/compactor(rear)', /compactor_geo_grp|piston_female/i],
  ['front wheel(front)', /wheel_front1/i],
  ['rear wheel(rear)', /wheel_rear1/i],
]);

report('CAN', can, 0.28, [
  ['lid(top)', /bin_lid/i],
  ['base(bottom)', /bin_base/i],
  ['wheel_l', /wheel_l/i],
]);

report('BAG (whole group)', bag, 0.24, [
  ['bag side A', /trash_bag_side_ply$/i],
  ['bag side B', /trash_bag_side_ply1$/i],
  ['trash box', /trash_box/i],
]);

const singleBag = findName(obj, /trash_bag_side_ply$/i);
console.log('\n  single bag part name:', singleBag && singleBag.name);
if (singleBag) report('BAG (single part)', singleBag, 0.22, []);

