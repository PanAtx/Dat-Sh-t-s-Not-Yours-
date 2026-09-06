// Verify litterReduced2.glb decodes through the project's LOCAL GLTFLoader +
// DRACOLoader (three r128), emulating the browser Worker environment in Node.
// Read-only: does NOT modify any project files.
import fs from 'fs';
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;

// ---------- Browser shims (Blob parts, worker, XHR) ----------
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
const fakeEl = () => ({ setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' });
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

// fetch-based XMLHttpRequest (THREE.FileLoader uses XHR + addEventListener)
global.XMLHttpRequest = class {
  constructor() { this._listeners = {}; }
  open(method, url) { this._url = url; }
  setRequestHeader() {}
  abort() {}
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn.bind(this)); }
  send() {
    const self = this;
    fetch(this._url).then(async r => {
      if (!r.ok) { self.status = r.status; (self._listeners['error'] || []).forEach(f => f({ type: 'error', target: self })); return; }
      self.status = 200;
      self.response = self.responseType === 'arraybuffer' ? await r.arrayBuffer() : await r.text();
      (self._listeners['progress'] || []).forEach(f => f({ type: 'progress', target: self, lengthComputable: false }));
      (self._listeners['load'] || []).forEach(f => f({ type: 'load', target: self }));
    }).catch(e => { (self._listeners['error'] || []).forEach(f => f(e)); });
  }
};

// Node has no Web Worker runtime for blob: URLs. The draco decoder library
// (wasm) loads fine on the main thread, and the worker's decode helpers are
// plain functions, so we patch DRACOLoader._getWorker to run the REAL worker
// decode code (extracted from the blob DRACOLoader builds) on the main thread.
global.Worker = class {
  constructor(url) { throw new Error('Worker should not be constructed (_getWorker is patched)'); }
};

(0, eval)(fs.readFileSync('GLTFLoader.js','utf8'));
(0, eval)(fs.readFileSync('DRACOLoader.js','utf8'));
if (typeof THREE.GLTFLoader === 'undefined') { console.error('FAILED to load local GLTFLoader'); process.exit(1); }
if (typeof THREE.DRACOLoader === 'undefined') { console.error('FAILED to load local DRACOLoader'); process.exit(1); }

const warns = [], errs = [];
const ow = console.warn, oe = console.error;
console.warn = (...a) => warns.push(a.join(' '));
console.error = (...a) => errs.push(a.join(' '));

const t0 = performance.now();
const gltfLoader = new THREE.GLTFLoader();
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
gltfLoader.setDRACOLoader(dracoLoader);

// Patch DRACOLoader to decode on the main thread (Node has no worker runtime).
// Executes the REAL worker decode code captured from the blob _initDecoder builds.
let dracoModule = null;
let dracoHelpers = null;
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
    _callbacks: {},
    _taskCosts: { [taskID]: taskCost },
    _taskLoad: taskCost,
    postMessage(msg) {
      if (msg.type !== 'decode') return;
      const draco = dracoModule;
      const decoder = new draco.Decoder();
      const buf = new draco.DecoderBuffer();
      buf.Init(new Int8Array(msg.buffer), msg.buffer.byteLength);
      let geometry = null, err = null;
      try { geometry = dracoHelpers.decodeGeometry(draco, decoder, buf, msg.taskConfig); }
      catch (e) { err = e; }
      finally { draco.destroy(buf); draco.destroy(decoder); }
      if (err) { this._callbacks[msg.id].reject({ type: 'error', id: msg.id, error: err.message }); return; }
      this._callbacks[msg.id].resolve({ type: 'decode', id: msg.id, geometry });
    }
  }));
};

const buf = fs.readFileSync('litterReduced2.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try {
  gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
} catch (e) { threw = e; }
const loadMs = Math.round(performance.now() - t0);
console.warn = ow; console.error = oe;
if (threw) { console.error('DECODE THREW:', threw && threw.message); process.exit(1); }
console.log('Draco decode OK in', loadMs, 'ms (incl. decoder library fetch)  warns=' + warns.length + ' errs=' + errs.length);
warns.slice(0, 5).forEach(w => console.log('  W:', w));
errs.slice(0, 5).forEach(e => console.log('  E:', e));

// ---- Scene checks (mirror index.html logic) ----
const model = gltf.scene;
model.updateMatrixWorld(true);
console.log('scene children BEFORE cleanup:', model.children.map(c => c.name || c.type));
const stray = model.getObjectByName('Cube');
if (stray && stray.parent) stray.parent.remove(stray);
console.log('stray Cube removed:', !!stray, '| children AFTER:', model.children.map(c => c.name || c.type));

model.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(model);
const sz = new THREE.Vector3();
box.getSize(sz);
console.log('SIZE   :', sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3));
console.log('MIN    :', box.min.x.toFixed(3), box.min.y.toFixed(3), box.min.z.toFixed(3));
console.log('MAX    :', box.max.x.toFixed(3), box.max.y.toFixed(3), box.max.z.toFixed(3));
const sizeOK = Math.abs(sz.x - 120) < 0.01 && Math.abs(sz.y - 120) < 0.01 && Math.abs(sz.z - 168) < 0.01;
const baseOK = box.min.z >= -0.01 && box.max.z > 160;
console.log('SIZE MATCHES 120x120x168:', sizeOK, '| BASE AT z=0 (Z-up):', baseOK);

// Material pipeline exactly as index.html applies it
let meshCount = 0, vertTotal = 0;
model.traverse(o => {
  if (!o.isMesh) return;
  o.castShadow = true; o.receiveShadow = true;
  if (o.material) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      m.metalness = 0.0; m.roughness = 0.75; m.side = THREE.DoubleSide;
      m.color.setHex(0x12401d);
      m.emissive.setHex(0x12401d);
      m.emissiveIntensity = 0.45;
    });
  }
  meshCount++;
  vertTotal += o.geometry.attributes.position ? o.geometry.attributes.position.count : 0;
});
console.log('meshes:', meshCount, '| total vertices:', vertTotal);

// Clone pipeline (14 instances like placeLitterBasket)
const LITTERBASKET_SCALE = 0.93 / 168;
const g = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const c = model.clone(true);
  c.scale.setScalar(LITTERBASKET_SCALE);
  g.add(c);
}
console.log('clone(true) x14 OK:', g.children.length,
  '| clone shares geometry:', g.children[0].children[0].geometry === model.children[0].geometry);
const cloneBox = new THREE.Box3().setFromObject(g.children[0]);
const csz = new THREE.Vector3();
cloneBox.getSize(csz);
console.log('cloned basket world size (native 120x120x168 -> 0.664x0.664x0.930):', csz.x.toFixed(3), csz.y.toFixed(3), csz.z.toFixed(3));

console.log('RESULT:', (sizeOK && baseOK && vertTotal > 0) ? 'PASS' : 'FAIL');
process.exit((sizeOK && baseOK && vertTotal > 0) ? 0 : 2);
