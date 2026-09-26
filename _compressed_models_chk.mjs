// _compressed_models_chk.mjs - verify the COMPRESSED models
//   nyc_truck-compressed.glb + nyc_can-compressed.glb (Draco + WebP, glTF-Transform v4)
// decode through the project's LOCAL GLTFLoader + DRACOLoader (three r128) in Node,
// with the decoder served from the LOCAL ./draco/ folder (exactly what index.html now does).
// Then compares the native-space bounding boxes against the UNCOMPRESSED originals to prove
// the baked constants (TRUCK_SCALE, CAN_GLB_SCALE) are still valid. Read-only.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { pathToFileURL } from 'url';
const DIR = import.meta.dirname;

const THREE = (await import(pathToFileURL(path.join(DIR, '_three128.js')).href)).default;
global.THREE = THREE;
global.self = global;
global.window = global;

// ---------- Browser shims (Blob, worker, XHR) ----------
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
    setAttribute(){}, style:{}, width:0, height:0,
    _listeners:{},
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    set src(v){ this._src = v;
      const fire = (type) => {
        (this._listeners[type] || []).slice().forEach(f => f({ type }));
        const prop = type === 'load' ? this.onload : this.onerror;
        if (typeof prop === 'function') prop({ type });
      };
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src(){ return this._src; }
  };
  return el;
};
global.Image = class { constructor() { return fakeEl(); } };
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

// XHR shim: serve the LOCAL ./draco/ decoder files from disk (index.html uses decoderPath './draco/'),
// everything else -> immediate error (we never want to hit the network here).
global.XMLHttpRequest = class {
  constructor() { this._listeners = {}; }
  open(method, url) { this._url = url; }
  setRequestHeader() {}
  abort() {}
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn.bind(this)); }
  send() {
    const self = this;
    const base = String(this._url || '').split('/').pop();
    const local = {
      'draco_decoder.js': 'draco/draco_decoder.js',
      'draco_wasm_wrapper.js': 'draco/draco_wasm_wrapper.js',
      'draco_decoder.wasm': 'draco/draco_decoder.wasm',
    }[base];
    if (!local) {
      setTimeout(() => (this._listeners['error'] || []).forEach(f => f({ type: 'error', target: this, detail: 'blocked ' + this._url })), 0);
      return;
    }
    try {
      const buf = fs.readFileSync(path.join(DIR, local));
      this.status = 200;
      this.response = this.responseType === 'arraybuffer'
        ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        : buf.toString('utf8');
      (this._listeners['progress'] || []).forEach(f => f({ type: 'progress', target: this, lengthComputable: false }));
      (this._listeners['load'] || []).forEach(f => f({ type: 'load', target: this }));
    } catch (e) {
      (this._listeners['error'] || []).forEach(f => f({ type: 'error', target: this }));
    }
  }
};
global.Worker = class { constructor() { throw new Error('Worker should not be constructed (_getWorker is patched)'); } };

(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(DIR, 'DRACOLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined') { console.error('FAILED to load local GLTFLoader'); process.exit(1); }
if (typeof THREE.DRACOLoader === 'undefined') { console.error('FAILED to load local DRACOLoader'); process.exit(1); }

const warns = [], errs = [];
const ow = console.warn, oe = console.error;
console.warn = (...a) => warns.push(a.join(' '));
console.error = (...a) => errs.push(a.join(' '));

// ---- Loaders exactly like index.html's new makeGltfLoader() ----
function makeGltfLoader() {
  const gltfLoader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('./draco/'); // XHR shim serves ./draco/ from disk
  gltfLoader.setDRACOLoader(dracoLoader);
  return { gltfLoader, dracoLoader };
}

// Node has no Web Worker runtime for blob: URLs: patch DRACOLoader._getWorker to run the
// REAL worker decode code (captured from the blob _initDecoder builds) on the main thread.
function patchDracoMainThread(dracoLoader) {
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
}

async function loadModel(file) {
  const { gltfLoader, dracoLoader } = makeGltfLoader();
  patchDracoMainThread(dracoLoader);
  const buf = fs.readFileSync(path.join(DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
  const scene = gltf.scene;
  scene.updateMatrixWorld(true, true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  let meshes = 0, verts = 0, textured = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    meshes++;
    verts += o.geometry.attributes.position.count;
    const m = o.material;
    if (m && (m.map || m.normalMap || m.roughnessMap || m.metalnessMap)) textured++;
  });
  return { gltf, box, size, meshes, verts, textured, bytes: buf.length };
}

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };
const relDiff = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
const has = (f) => { try { fs.accessSync(path.join(DIR, f)); return true; } catch (e) { return false; } };
// ---------------- TRUCK ----------------
console.log('\n== nyc_truck-compressed.glb (vs nyc_truck.glb) ==');
const t0 = performance.now();
let cTruck = null, threw = null;
try { cTruck = await loadModel('nyc_truck-compressed.glb'); } catch (e) { threw = e; }
console.warn = ow; console.error = oe;
if (threw) { console.error('COMPRESSED TRUCK THREW:', threw && threw.message); process.exit(1); }
console.log('decoded in', Math.round(performance.now() - t0), 'ms  bytes=' + cTruck.bytes,
  'meshes=' + cTruck.meshes, 'verts=' + cTruck.verts, 'texturedMeshes=' + cTruck.textured,
  'warns=' + warns.length, 'errs=' + errs.length);
warns.slice(0, 5).forEach(w => console.log('  W:', w));
errs.slice(0, 5).forEach(e => console.log('  E:', e));
check('compressed truck decodes (non-empty scene)', cTruck.meshes > 0 && cTruck.verts > 0);
check('webp textures attached to meshes', cTruck.textured >= 1);

if (has('nyc_truck.glb')) {
  const uTruck = await loadModel('nyc_truck.glb');
  console.log('  native size uncompressed :', uTruck.size.x.toFixed(4), uTruck.size.y.toFixed(4), uTruck.size.z.toFixed(4));
  console.log('  native size compressed  :', cTruck.size.x.toFixed(4), cTruck.size.y.toFixed(4), cTruck.size.z.toFixed(4));
  check('native length within 3% of original', relDiff(cTruck.size.x, uTruck.size.x) < 0.03);
  check('native width  within 3% of original', relDiff(cTruck.size.z, uTruck.size.z) < 0.03);
  check('native height within 3% of original', relDiff(cTruck.size.y, uTruck.size.y) < 0.03);
  check('native base (y-min) matches original', relDiff(cTruck.box.min.y, uTruck.box.min.y) < 0.03);
} else {
  console.log('  (original nyc_truck.glb not on disk - skipping box comparison)');
}
const truckLen = cTruck.size.x; // native X = length

// TRUCK_SCALE is baked in index.html for a native length of 1.8648 -> final 12.39
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const tsMatch = html.match(/const TRUCK_SCALE = ([0-9.]+)/);
check('TRUCK_SCALE found in index.html', !!tsMatch);
if (tsMatch) {
  const TRUCK_SCALE = parseFloat(tsMatch[1]);
  const finalLen = truckLen * TRUCK_SCALE;
  console.log('  final truck length =', finalLen.toFixed(3), '(target 12.39)');
  check('final truck length within 4% of 12.39', Math.abs(finalLen - 12.39) / 12.39 < 0.04);
}

// ---------------- CAN ----------------
console.log('\n== nyc_can-compressed.glb (vs nyc_can.glb) ==');
let cCan = null, threw2 = null;
try { cCan = await loadModel('nyc_can-compressed.glb'); } catch (e) { threw2 = e; }
console.warn = ow; console.error = oe;
if (threw2) { console.error('COMPRESSED CAN THREW:', threw2 && threw2.message); process.exit(1); }
console.warn = ow; console.error = oe;
console.log('bytes=' + cCan.bytes, 'meshes=' + cCan.meshes, 'verts=' + cCan.verts,
  'texturedMeshes=' + cCan.textured, 'warns=' + warns.length, 'errs=' + errs.length);
warns.slice(0, 5).forEach(w => console.log('  W:', w));
errs.slice(0, 5).forEach(e => console.log('  E:', e));
check('compressed can decodes (non-empty scene)', cCan.meshes > 0 && cCan.verts > 0);
check('webp textures attached to meshes', cCan.textured >= 1);

if (has('nyc_can.glb')) {
  const uCan = await loadModel('nyc_can.glb');
  console.log('  native size uncompressed :', uCan.size.x.toFixed(4), uCan.size.y.toFixed(4), uCan.size.z.toFixed(4));
  console.log('  native size compressed  :', cCan.size.x.toFixed(4), cCan.size.y.toFixed(4), cCan.size.z.toFixed(4));
  console.log('  native minY compressed   :', cCan.box.min.y.toFixed(4), '(uncompressed', uCan.box.min.y.toFixed(4) + ')');
  check('native height within 3% of original', relDiff(cCan.size.y, uCan.size.y) < 0.03);
  check('native width  within 3% of original', relDiff(cCan.size.x, uCan.size.x) < 0.03);
  check('native depth  within 3% of original', relDiff(cCan.size.z, uCan.size.z) < 0.03);
  check('native base (y-min) matches original', relDiff(cCan.box.min.y, uCan.box.min.y) < 0.03);
} else {
  console.log('  (original nyc_can.glb not on disk - skipping box comparison)');
}

const CAN_GLB_SCALE = 1.2411 / 1.9035; // baked constant in index.html
const finalCanH = cCan.size.y * CAN_GLB_SCALE;
console.log('  final can height =', finalCanH.toFixed(4), '(target ~1.24)');
check('final can height within 4% of 1.24', Math.abs(finalCanH - 1.24) / 1.24 < 0.04);

// ---------------- index.html wiring ----------------
console.log('\n== index.html wiring ==');
check('loadTruckGltf loads nyc_truck-compressed.glb', html.includes('getModelUrl("nyc_truck-compressed.glb")'));
check('loadCanGltf loads nyc_can-compressed.glb', html.includes('getModelUrl("nyc_can-compressed.glb")'));
check('loadCanGltf brightens the dark baseColor texture (tint lift m.color.multiplyScalar(1.6))',
  /async function loadCanGltf\(\)[\s\S]{0,2400}?m\.color\.multiplyScalar\(1\.6\)/.test(html));
check('makeGltfLoader attaches local DRACOLoader (./draco/)',
  /function makeGltfLoader\(\)[\s\S]{0,600}?setDecoderPath\("\.\/draco\/"\)/.test(html));
check('PRELOAD has truck compressed size', html.includes('url: "nyc_truck-compressed.glb", size: 10280012'));
check('PRELOAD has can compressed size', html.includes('url: "nyc_can-compressed.glb", size: 3181560'));
check('old nyc_truck.glb no longer loaded/preloaded', !/getModelUrl\("nyc_truck\.glb"\)/.test(html) && !/url: "nyc_truck\.glb"/.test(html));
check('old nyc_can.glb no longer loaded/preloaded', !/getModelUrl\("nyc_can\.glb"\)/.test(html) && !/url: "nyc_can\.glb"/.test(html));

// index.html inline scripts still parse
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

console.log('\n' + (ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(ok ? 0 : 1);


