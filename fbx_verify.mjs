// Definitive test: run the EXACT FBX helper block from index.html (not a copy) against truck.fbx.
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
if (start < 0 || end < 0) { console.error('FAILED to locate FBX block in index.html'); process.exit(1); }
const code = html.slice(start, end);

const test = `
  const buf = fs.readFileSync('truck.fbx');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const root = new FBXLoader().parse(ab, '');
  const truck = fbxFind(root, /garbageTruck_geo_grp/i);
  const can   = fbxFind(root, /garbageBin_geo_grp/i);
  const bag   = fbxFind(root, /truck_trash_grp/i) || fbxFind(root, /trash_bag_side_ply$/i);
  if (!truck || !can || !bag) throw new Error('asset groups not found');
  FBX_TPL.truck = fbxExtract(truck); FBX_TPL.truck.orient = orientTruck(FBX_TPL.truck);
  FBX_TPL.can   = fbxExtract(can);   FBX_TPL.can.orient   = orientCan(FBX_TPL.can);
  FBX_TPL.bag   = fbxExtract(bag);   FBX_TPL.bag.orient   = defaultOrient(FBX_TPL.bag);
  function rep(label, tpl, scale){
    const g = fbxInstance(tpl, scale); const bb = new THREE.Box3().setFromObject(g); const s = bb.getSize(new THREE.Vector3());
    const bad = [bb.min.x,bb.min.y,bb.min.z,bb.max.x,bb.max.y,bb.max.z].some(v=>!isFinite(v));
    console.log(label.padEnd(7) + ' L/W/H = [' + s.x.toFixed(2)+', '+s.y.toFixed(2)+', '+s.z.toFixed(2) + ']  grounded min.z=' + bb.min.z.toFixed(3) + (bad?'  NON-FINITE!':'  OK'));
    return { g, bb, s };
  }
  console.log('orient dets: truck=' + FBX_TPL.truck.orient.determinant().toFixed(2) + ' can=' + FBX_TPL.can.orient.determinant().toFixed(2) + ' bag=' + FBX_TPL.bag.orient.determinant().toFixed(2));
  const T = rep('TRUCK', FBX_TPL.truck, TRUCK_SCALE);
  const C = rep('CAN',   FBX_TPL.can,   CAN_SCALE);
  const B = rep('BAG',   FBX_TPL.bag,   BAG_SCALE);
  const bb = T.bb; const boxL = (bb.max.x-bb.min.x)/2, boxW=(bb.max.y-bb.min.y)/2;
  const comp = fbxFind(T.g, /compactor/i); const hopperOff = new THREE.Box3().setFromObject(comp).getCenter(new THREE.Vector3()).x;
  const fw = new THREE.Box3().setFromObject(fbxFind(T.g, /wheel_front/i)).getCenter(new THREE.Vector3());
  console.log('TRUCK boxL=' + boxL.toFixed(2) + ' boxW=' + boxW.toFixed(2) + ' hopperOff=' + hopperOff.toFixed(2) + ' cabOff=' + (boxL+1.6).toFixed(2) + ' frontWheelX=' + fw.x.toFixed(2));
  const ok = T.bb.min.z>=-1e-3 && C.bb.min.z>=-1e-3 && B.bb.min.z>=-1e-3 && T.s.x > T.s.z && hopperOff < 0 && fw.x > 0 &&
             Math.abs(FBX_TPL.truck.orient.determinant()-1) < 1e-6 && Math.abs(FBX_TPL.can.orient.determinant()-1) < 1e-6 && Math.abs(FBX_TPL.bag.orient.determinant()-1) < 1e-6;
  console.log('\\nEXACT-INDEX.HTML-CODE ALL CHECKS PASS: ' + ok);
  if (!ok) process.exit(2);
`;
eval(code + '\n' + test);