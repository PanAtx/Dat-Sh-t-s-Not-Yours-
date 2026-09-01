// Browser-equivalent test: use the EXACT local FBXLoader.js (r128) + local fflate.min.js that the
// browser loads, then run the EXACT index.html FBX block against truck.fbx.
import fs from 'fs';
import * as THREE_NS from 'three';
import fflate from './fflate.min.js';

function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' }; }
// THREE namespace is frozen -> make a mutable copy so FBXLoader can attach THREE.FBXLoader to it.
const THREE = Object.assign(Object.create(null), THREE_NS);
// r185 three drops LoaderUtils.decodeText (present in r128, which the browser uses) -> polyfill for the harness only.
if (THREE.LoaderUtils && typeof THREE.LoaderUtils.decodeText !== 'function'){
  THREE.LoaderUtils.decodeText = function ( data, start, len ) {
    if (typeof data === 'string') return data;
    if (start === undefined) start = 0;
    if (len === undefined) len = data.byteLength - start;
    const bytes = new Uint8Array(data, start, len);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  };
}
global.THREE = THREE;
global.fflate = fflate;
global.self = global;
global.Blob = class { constructor(parts, opts){ this.parts = parts; this.opts = opts; } };
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:image/png;base64,iVBORw0KGgo=';
global.URL.revokeObjectURL = () => {};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

// Load the LOCAL browser FBXLoader.js (defines THREE.FBXLoader)
const loaderSrc = fs.readFileSync('FBXLoader.js', 'utf8');
(0, eval)(loaderSrc);
if (typeof THREE.FBXLoader === 'undefined'){ console.error('FAILED: local FBXLoader.js did not define THREE.FBXLoader'); process.exit(1); }
console.log('Local FBXLoader.js loaded OK -> THREE.FBXLoader', typeof THREE.FBXLoader);

// Parse the FBX with the EXACT local loader
const buf = fs.readFileSync('truck.fbx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const root = new THREE.FBXLoader().parse(ab, '');
console.log('FBX parsed OK via local r128 loader; root children:', root.children.length);

// Run the EXACT index.html FBX helper block + extraction (direct eval -> sees mutable THREE above)
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('function loadFbxTemplates', start);
const code = html.slice(start, end);
const test = `
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
  const comp = fbxFind(T.g, /compactor/i); const hopperOff = new THREE.Box3().setFromObject(comp).getCenter(new THREE.Vector3()).x;
  const fw = new THREE.Box3().setFromObject(fbxFind(T.g, /wheel_front/i)).getCenter(new THREE.Vector3());
  const ok = T.bb.min.z>=-1e-3 && C.bb.min.z>=-1e-3 && B.bb.min.z>=-1e-3 && T.s.x > T.s.z && hopperOff < 0 && fw.x > 0 &&
             Math.abs(FBX_TPL.truck.orient.determinant()-1) < 1e-6 && Math.abs(FBX_TPL.can.orient.determinant()-1) < 1e-6 && Math.abs(FBX_TPL.bag.orient.determinant()-1) < 1e-6;
  console.log('LOCAL-LOADER (browser-equivalent) ALL CHECKS PASS: ' + ok);
  if (!ok) process.exit(2);
`;
eval(code + '\n' + test);