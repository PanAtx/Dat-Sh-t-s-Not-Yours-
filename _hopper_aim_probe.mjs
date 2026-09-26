// Probe nyc_truck-compressed.glb in GAME space (exact index.html orient/scale chain):
// front/rear extents, the game's current hopper aim (hopperOff), and the rear
// hopper bucket's x-extent so the bag toss can be centered on the scoop.
import fs from 'fs';
import path from 'path';
const DIR = import.meta.dirname;
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
const partsMap = new Map();
let blobSeq = 0;
const RealBlob = global.Blob;
global.Blob = class extends RealBlob {
  constructor(parts, opts) {
    super(parts, opts);
    const flat = (parts || []).flatMap(p => Array.isArray(p) ? p : [p]);
    this._blobId = 'blob:' + (++blobSeq);
    partsMap.set(this._blobId, flat.map(p => typeof p === 'string' ? p : Buffer.from(p).toString('utf8')).join(''));
  }
};
global.URL = global.URL || {};
global.URL.createObjectURL = (b) => (b && b._blobId) || 'blob:0';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute() {}, style: {}, width: 0, height: 0,
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    set src(v) { this._src = v;
      const fire = (type) => { (this._listeners[type] || []).slice().forEach(f => f({ type }));
        const prop = type === 'load' ? this.onload : this.onerror;
        if (typeof prop === 'function') prop({ type }); };
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src() { return this._src; }
  };
  return el;
};
global.Image = class { constructor() { return fakeEl(); } };
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
global.XMLHttpRequest = class {
  constructor() { this._listeners = {}; }
  open(method, url) { this._url = url; }
  setRequestHeader() {}
  abort() {}
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn.bind(this)); }
  send() {
    const base = String(this._url || '').split('/').pop();
    const local = {
      'draco_decoder.js': 'draco/draco_decoder.js',
      'draco_wasm_wrapper.js': 'draco/draco_wasm_wrapper.js',
      'draco_decoder.wasm': 'draco/draco_decoder.wasm',
    }[base];
    if (!local) { setTimeout(() => (this._listeners['error'] || []).forEach(f => f({ type: 'error' })), 0); return; }
    try {
      const buf2 = fs.readFileSync(path.join(DIR, local));
      this.status = 200;
      this.response = this.responseType === 'arraybuffer'
        ? buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength) : buf2.toString('utf8');
      (this._listeners['load'] || []).forEach(f => f({ type: 'load', target: this }));
    } catch (e) { (this._listeners['error'] || []).forEach(f => f({ type: 'error' })); }
  }
};
global.Worker = class { constructor() { throw new Error('Worker should not be constructed (_getWorker is patched)'); } };
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(DIR, 'DRACOLoader.js'), 'utf8'));
const gltfLoader = new THREE.GLTFLoader();
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('./draco/');
gltfLoader.setDRACOLoader(dracoLoader);
(function patchDracoMainThread(dracoLoader) {
  let dracoModule = null, dracoHelpers = null;
  const ensureDraco = dracoLoader._initDecoder().then(() => {
    const code = partsMap.get(dracoLoader.workerSourceURL);
    if (typeof code !== 'string') throw new Error('worker source not captured');
    const run = new Function('process', 'require', 'module', 'exports', 'window',
      code + '\n;return { decodeGeometry, decodeIndex, decodeAttribute, getDracoDataType, DracoDecoderModule };');
    const helpers = run(undefined, undefined, undefined, undefined, globalThis);
    return new Promise((res) => helpers.DracoDecoderModule({ wasmBinary: dracoLoader.decoderConfig.wasmBinary, onModuleLoaded: res }))
      .then(m => { dracoModule = m; dracoHelpers = helpers; });
  });
  dracoLoader._getWorker = function (taskID, taskCost) {
    return ensureDraco.then(() => ({
      _callbacks: {}, _taskCosts: { [taskID]: taskCost }, _taskLoad: taskCost,
      postMessage(msg) {
        if (msg.type !== 'decode') return;
        const draco = dracoModule;
        const decoder = new draco.Decoder();
        const buf3 = new draco.DecoderBuffer();
        buf3.Init(new Int8Array(msg.buffer), msg.buffer.byteLength);
        let geometry = null, err = null;
        try { geometry = dracoHelpers.decodeGeometry(draco, decoder, buf3, msg.taskConfig); }
        catch (e) { err = e; }
        finally { draco.destroy(buf3); draco.destroy(decoder); }
        if (err) { this._callbacks[msg.id].reject({ type: 'error', id: msg.id, error: err.message }); return; }
        this._callbacks[msg.id].resolve({ type: 'decode', id: msg.id, geometry });
      }
    }));
  };
})(dracoLoader);
const buf = fs.readFileSync(path.join(DIR, 'nyc_truck-compressed.glb'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
const g = gltf.scene;
g.updateWorldMatrix(true, true);
console.log('parsed OK');

// ---- run the EXACT index.html orient/scale helpers (verbatim slice) ----
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('async function loadTruckGltf', start);
if (start < 0 || end < 0) { console.error('FAILED to locate FBX block'); process.exit(1); }
const ctx = {};
new Function('THREE', 'global', html.slice(start, end) + `
;global.ctx = { TRUCK_SCALE, orientTruck, fbxInstance, defaultOrient, rotFromUpFront };
`)(THREE, globalThis);
const { TRUCK_SCALE, fbxInstance } = globalThis.ctx;
console.log('TRUCK_SCALE =', TRUCK_SCALE);

// instance exactly like the game does
const g2 = fbxInstance(g, TRUCK_SCALE);
g2.updateMatrixWorld(true);
let tMaxX = 0, tMinX = 0, tStreet = 0;
const _v = new THREE.Vector3();
g2.traverse((o) => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (_v.x > tMaxX) tMaxX = _v.x;
    if (_v.x < tMinX) tMinX = _v.x;
    if (_v.z < 1.6) { const ay = Math.abs(_v.y); if (ay > tStreet) tStreet = ay; }
  }
});
const boxL = Math.max(tMaxX, Math.abs(tMinX), 4.0);
const hopperOff = -boxL + 1.6;
console.log('\n=== GAME-SPACE TRUCK (exact fbxInstance chain) ===');
console.log('tMaxX (front)  =', tMaxX.toFixed(3));
console.log('tMinX (rear)   =', tMinX.toFixed(3));
console.log('boxL           =', boxL.toFixed(3), '| rear-limited:', Math.abs(tMinX) >= tMaxX);
console.log('CURRENT aim hopperOff =', hopperOff.toFixed(3),
  '-> offset from rear face =', (hopperOff - tMinX).toFixed(3) + 'u forward');
console.log('=> bag absorbs', (hopperOff - tMinX).toFixed(2) + 'u IN FRONT of the rear face');

// ---- per-mesh boxes near the rear (find the hopper bucket) ----
console.log('\n=== MESHES IN THE REAR HALF ===');
g2.traverse((o) => {
  if (!o.isMesh) return;
  o.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(new THREE.Vector3());
  const s = b.getSize(new THREE.Vector3());
  if (c.x > tMinX / 2 || s.x < 0.05) return;
  console.log((o.name || '(anon)').padEnd(40).slice(0, 40),
    'x=[' + b.min.x.toFixed(2) + '..' + b.max.x.toFixed(2) + ']',
    'y=[' + b.min.y.toFixed(2) + '..' + b.max.y.toFixed(2) + ']',
    'z=[' + b.min.z.toFixed(2) + '..' + b.max.z.toFixed(2) + ']',
    'ctrX=' + c.x.toFixed(2));
});

// ---- vertex density along x from the rear face (bucket footprint) ----
console.log('\n=== VERTEX DENSITY, x slices of 0.25u from the rear face ===');
const counts = {};
g2.traverse((o) => {
  if (!o.isMesh || !o.geometry.attributes.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    const d = _v.x - tMinX;
    if (d < -0.25 || d > 3.5) continue;
    const k = Math.round(d * 4) / 4;
    counts[k] = (counts[k] || 0) + 1;
  }
});
let maxc = 0;
for (const k in counts) maxc = Math.max(maxc, counts[k]);
for (let d = 0; d <= 3.25; d += 0.25) {
  const k = Math.round(d * 4) / 4;
  const n = counts[k] || 0;
  console.log('  x=' + (tMinX + d).toFixed(2) + ' (+' + d.toFixed(2) + '): ' + '#'.repeat(Math.max(1, Math.round((n / maxc) * 40))) + '  (' + n + ')');
}

// ---- TOP profile (z>2.5): the bucket mouth is the wide open region at the rear ----
console.log('\n=== TOP (z>2.5) y-WIDTH per x slice (bucket mouth vs compactor roof) ===');
const top = {};
g2.traverse((o) => {
  if (!o.isMesh || !o.geometry.attributes.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (_v.z < 2.5) continue;
    const d = _v.x - tMinX;
    if (d < -0.25 || d > 3.5) continue;
    const k = Math.round(d * 4) / 4;
    if (!top[k]) top[k] = { miny: 1e9, maxy: -1e9, n: 0 };
    if (_v.y < top[k].miny) top[k].miny = _v.y;
    if (_v.y > top[k].maxy) top[k].maxy = _v.y;
    top[k].n++;
  }
});
for (let d = 0; d <= 3.25; d += 0.25) {
  const t = top[Math.round(d * 4) / 4];
  if (t) console.log('  x=' + (tMinX + d).toFixed(2) + ' (+' + d.toFixed(2) + '): width ' + (t.maxy - t.miny).toFixed(2) + '  y=[' + t.miny.toFixed(2) + '..' + t.maxy.toFixed(2) + ']  n=' + t.n);
  else console.log('  x=' + (tMinX + d).toFixed(2) + ' (+' + d.toFixed(2) + '): (none)');
}
console.log('\nCURRENT aim x = ' + hopperOff.toFixed(3) + ' (rear face = ' + tMinX.toFixed(3) + ')');

// ---- the BUCKET FLOOR: near-horizontal surface around z=1.0 (the scoop interior) ----
console.log('\n=== FLOOR CANDIDATES (0.55 < z < 1.45), x distribution ===');
const floor = {};
g2.traverse((o) => {
  if (!o.isMesh || !o.geometry.attributes.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
    if (_v.z < 0.55 || _v.z > 1.45) continue;
    const d = _v.x - tMinX;
    if (d < -0.5 || d > 4) continue;
    const k = Math.round(d * 4) / 4;
    if (!floor[k]) floor[k] = { miny: 1e9, maxy: -1e9, minz: 9, maxz: -9, n: 0 };
    floor[k].miny = Math.min(floor[k].miny, _v.y);
    floor[k].maxy = Math.max(floor[k].maxy, _v.y);
    floor[k].minz = Math.min(floor[k].minz, _v.z);
    floor[k].maxz = Math.max(floor[k].maxz, _v.z);
    floor[k].n++;
  }
});
for (let d = -0.25; d <= 3.75; d += 0.25) {
  const f = floor[Math.round(d * 4) / 4];
  if (!f) { console.log('  x=' + (tMinX + d).toFixed(2) + ' (+' + d.toFixed(2) + '): (none)'); continue; }
  console.log('  x=' + (tMinX + d).toFixed(2) + ' (+' + d.toFixed(2) + '): n=' + f.n,
    'y=[' + f.miny.toFixed(2) + '..' + f.maxy.toFixed(2) + ']',
    'z=[' + f.minz.toFixed(2) + '..' + f.maxz.toFixed(2) + ']');
}



g.updateWorldMatrix(true, true);
console.log('parsed OK, meshes:', g.children.length);
