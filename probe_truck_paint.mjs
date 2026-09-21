// probe_truck_paint.mjs — measures the PAINTED truck body in TRUCK-LOCAL space
// (the space applyTruckClip tests against): full extents, street-height
// (z < 1.6) lateral reach, per-z-band reach, and rear-region reach.
// Output drives the clip box in buildTruck.
import fs from 'fs';
import * as THREE_NS from 'three';
import fflate from './fflate.min.js';

function fakeEl() { return { setAttribute() {}, style: {}, addEventListener() {}, removeEventListener() {}, width: 0, height: 0, src: '' }; }
const THREE = Object.assign(Object.create(null), THREE_NS);
if (THREE.LoaderUtils && typeof THREE.LoaderUtils.decodeText !== 'function') {
  THREE.LoaderUtils.decodeText = function (data, start, len) {
    if (typeof data === 'string') return data;
    if (start === undefined) start = 0;
    if (len === undefined) len = data.byteLength;
    const bytes = new Uint8Array(data, start, len);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  };
}
global.THREE = THREE;
global.fflate = fflate;
global.self = global;
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:image/png;base64,';
global.URL.revokeObjectURL = () => {};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

const loaderSrc = fs.readFileSync('FBXLoader.js', 'utf8');
(0, eval)(loaderSrc);
if (typeof THREE.FBXLoader === 'undefined') { console.error('FAILED: FBXLoader missing'); process.exit(1); }

const buf = fs.readFileSync('truck.fbx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const root = new THREE.FBXLoader().parse(ab, '');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('function loadFbxTemplates', start);
let code = html.slice(start, end);
// drop the fetch helpers (they are browser-only and not needed here)
for (const fn of ['function fetchWithTimeout', 'function _modelGetCache', 'function getModelUrl']) {
  const a = code.indexOf(fn);
  if (a >= 0) code = code.slice(0, a);
}
const test = `
const truck = fbxFind(root, /garbageTruck_geo_grp/i);
FBX_TPL.truck = fbxExtract(truck);
FBX_TPL.truck.orient = orientTruck(FBX_TPL.truck);
const g = fbxInstance(FBX_TPL.truck, TRUCK_SCALE);
g.updateMatrixWorld(true);

const _v = new THREE.Vector3();
let tMaxX = 0, tMinX = 0, tStreet = 0; // the SAME numbers buildTruck measures
const bands = [
  { name: 'z<0.5  (chassis/wheels)', z0: -10, z1: 0.5 },
  { name: 'z<1.6  (street-height body)', z0: -10, z1: 1.6 },
  { name: 'z 1.6-3.0 (upper body)', z0: 1.6, z1: 3.0 },
  { name: 'z 3.0-4.5 (roof)', z0: 3.0, z1: 4.5 },
  { name: 'z>4.5  (top)', z0: 4.5, z1: 10 },
];
const rear = { x0: -100, x1: -4.5 };
const bandExt = bands.map((b) => ({ ...b, minY: Infinity, maxY: -Infinity, n: 0 }));
let rearMinY = Infinity, rearMaxY = -Infinity, rearMaxZ = -Infinity, rearN = 0;
let fullMin = new THREE.Vector3(Infinity, Infinity, Infinity);
let fullMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

g.traverse((o) => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (_v.x > tMaxX) tMaxX = _v.x;
    if (_v.x < tMinX) tMinX = _v.x;
    if (_v.z < 1.6) { const ay = Math.abs(_v.y); if (ay > tStreet) tStreet = ay; }
    fullMin.min(_v); fullMax.max(_v);
    for (const b of bandExt) if (_v.z >= b.z0 && _v.z < b.z1) { b.minY = Math.min(b.minY, _v.y); b.maxY = Math.max(b.maxY, _v.y); b.n++; }
    if (_v.x >= rear.x0 && _v.x < rear.x1) { rearMinY = Math.min(rearMinY, _v.y); rearMaxY = Math.max(rearMaxY, _v.y); rearMaxZ = Math.max(rearMaxZ, _v.z); rearN++; }
  }
});

const f = (x) => (isFinite(x) ? x.toFixed(3) : '—');
console.log('=== TRUCK PAINT in truck-local space (g origin = collision center) ===');
console.log('full bb:  x [' + f(fullMin.x) + ' , ' + f(fullMax.x) + ']   y [' + f(fullMin.y) + ' , ' + f(fullMax.y) + ']   z [' + f(fullMin.z) + ' , ' + f(fullMax.z) + ']');
console.log('buildTruck numbers:  tMaxX=' + f(tMaxX) + '  tMinX=' + f(tMinX) + '  tStreet=' + f(tStreet));
console.log('  -> boxL=' + f(Math.max(tMaxX, Math.abs(tMinX), 4.0)) + '  boxW=' + f((tStreet > 0.5 ? tStreet : 2.9) * 0.8) +
  '  boxWStreet=' + f((tStreet > 0.5 ? tStreet : 2.9) * 0.8) + '  boxWCurb=' + f((tStreet > 0.5 ? tStreet : 2.9) * 0.8 * 0.35));
console.log('  -> CURRENT clip box: x [-' + f(Math.max(tMaxX, Math.abs(tMinX), 4.0) + 0.05) + ' , +' + f(Math.max(tMaxX, Math.abs(tMinX), 4.0) + 0.05) +
  ']  y [-' + f((tStreet > 0.5 ? tStreet : 2.9) * 0.8 * 1.25 + 0.05) + ' , +' + f((tStreet > 0.5 ? tStreet : 2.9) * 0.8 * 0.35 * 1.25 + 0.05) + ']');
for (const b of bandExt) console.log(b.name.padEnd(30) + '  y [' + f(b.minY) + ' , ' + f(b.maxY) + ']   (' + b.n + ' verts)');
console.log('x < -4.5 (rear/scoop region)      y [' + f(rearMinY) + ' , ' + f(rearMaxY) + ']   maxZ=' + f(rearMaxZ) + '   (' + rearN + ' verts)');
`;
eval(code + '\n' + test);
