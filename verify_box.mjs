// Verify the NEW buildTruck() collision-measurement code (exact lines from index.html)
// runs against truck.fbx and produces sane 3D body bounds.
import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
global.THREE = THREE;
function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0 }; }
global.window = { URL: { createObjectURL: () => 'data:image/png;base64,iVBORw0KGgo=' } };
global.document = { createElementNS: fakeEl, createElement: fakeEl };

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('function loadFbxTemplates', start);
if (start < 0 || end < 0) { console.error('FBX block not found'); process.exit(1); }
const code = html.slice(start, end);

// the exact new measurement block, copied verbatim from the edited buildTruck()
const measure = `
  const g = fbxInstance(FBX_TPL.truck, TRUCK_SCALE);
  let tMaxX = 0, tMinX = 0, tStreet = 0;
  const _v = new THREE.Vector3();
  g.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++){
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (_v.x > tMaxX) tMaxX = _v.x;
      if (_v.x < tMinX) tMinX = _v.x;
      if (_v.z < 1.6){ const ay = Math.abs(_v.y); if (ay > tStreet) tStreet = ay; }
    }
  });
  const boxL = Math.max(tMaxX, Math.abs(tMinX), 4.0);
  const boxW = tStreet > 0.5 ? tStreet : 2.9;
  const hopperOff = -boxL + 1.6;
  const cabOff = boxL + 1.6;
`;

const test = `
  const buf = fs.readFileSync('truck.fbx');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const root = new FBXLoader().parse(ab, '');
  const truck = fbxFind(root, /garbageTruck_geo_grp/i);
  FBX_TPL.truck = fbxExtract(truck); FBX_TPL.truck.orient = orientTruck(FBX_TPL.truck);
  ` + measure + `
  console.log('boxL     =', boxL.toFixed(3), ' (x extent: front +' + tMaxX.toFixed(2) + ', rear ' + tMinX.toFixed(2) + ')');
  console.log('boxW     =', boxW.toFixed(3), ' (street-height body half-width)');
  console.log('truck Y  =', (-4.5 - boxW).toFixed(2), '..', (-4.5 + boxW).toFixed(2));
  console.log('hopperOff=', hopperOff.toFixed(2), ' cabOff =', cabOff.toFixed(2));
  // expected invariants
  const ok = boxL > 4 && boxL < 8 && boxW > 1.5 && boxW < 2.8 && boxW < 2.93;
  console.log('INTEGRITY OK:', ok);
  if (!ok) process.exit(1);
`;
eval(code + '\n' + test);
