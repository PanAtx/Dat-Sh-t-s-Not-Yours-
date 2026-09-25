// _nyc_can_chk.mjs - verify the REAL makeCan() GLB branch with the actual nyc_can.glb
// via the project's local GLTFLoader (three r128): populates CAN_TPL exactly like
// loadCanGltf(), then runs makeCan() (extracted verbatim from index.html) and confirms:
//   - it builds a non-empty model
//   - it stands upright on the sidewalk (base at local z=0, no negative z)
//   - its height matches the old truck.fbx bin (~1.24u) and its footprint is sane
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const DIR = path.join(import.meta.dirname);
const THREE = (await import(pathToFileURL(path.join(DIR, '_three128.js')).href)).default;
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:,';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute(){}, style:{}, width:0, height:0,
    _listeners:{},
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    set src(v){ this._src = v;
      const fire = (type) => (this._listeners[type] || []).slice().forEach(f => f({ type }));
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src(){ return this._src; }
  };
  return el;
};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED to load local GLTFLoader'); process.exit(1); }
const warns = [], errs = [];
const ow = console.warn, oe = console.error;
console.warn = (...a) => warns.push(a.join(' '));
console.error = (...a) => errs.push(a.join(' '));
const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync(path.join(DIR, 'nyc_can.glb'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try {
  gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
} catch (e) { threw = e; }
console.warn = ow; console.error = oe;
if (threw){ console.error('THREW:', threw && threw.message); process.exit(1); }
if (!gltf){ process.exit(2); }
// ---- populate CAN_TPL exactly like loadCanGltf() ----
const model = gltf.scene;
model.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(model);
model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const CAN_TPL = { template: model, minY: box.min.y };
console.log('CAN_TPL populated: minY =', CAN_TPL.minY.toFixed(4));

// ---- extract the REAL makeCan from index.html (brace-counted) ----
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
function extractFn(name){
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function ' + name + ' not found');
  let i = html.indexOf('{', idx), depth = 0;
  for (; i < html.length; i++){
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(idx, i + 1);
}
function R(a, b){ return a + Math.random() * (b - a); }
const makeCan = new Function('THREE', 'CAN_TPL', 'CAN_GLB_SCALE', 'FBX_TPL', 'CAN_SCALE', 'R',
  extractFn('makeCan') + '\nreturn makeCan;')(
  THREE, CAN_TPL, 1.2411 / 1.9035, { can: null }, 0.325, R);

// ---- assertions ----
let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };
const g = makeCan(true);
check('makeCan() (nyc_can.glb branch) builds a non-empty model', !!(g && Array.isArray(g.children) && g.children.length > 0));
check('userData.lid is null (no separate lid animation)', g.userData.lid === null);
g.updateMatrixWorld(true);
const bb = new THREE.Box3().setFromObject(g);
const sz = bb.getSize(new THREE.Vector3());
console.log('  instance size x/y/z = ' + sz.x.toFixed(3) + '/' + sz.y.toFixed(3) + '/' + sz.z.toFixed(3));
check('can is grounded (min z >= -0.01)', bb.min.z >= -0.01);
check('can height ~1.24u (old FBX bin was 1.241u)', Math.abs(sz.z - 1.2411) < 0.05);
check('can footprint sane (x 0.3..1.0, y 0.4..1.3)', sz.x > 0.3 && sz.x < 1.0 && sz.y > 0.4 && sz.y < 1.3);
let meshCount = 0, shadowed = 0;
g.traverse((o) => { if (o.isMesh) { meshCount++; if (o.castShadow) shadowed++; } });
check('all meshes cast shadows (' + shadowed + '/' + meshCount + ')', meshCount > 0 && shadowed === meshCount);
console.log(ok ? '\nNYC CAN GLB ALL CHECKS PASS' : '\nNYC CAN GLB CHECKS FAILED');
process.exit(ok ? 0 : 1);