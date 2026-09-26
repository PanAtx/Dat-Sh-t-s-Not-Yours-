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

// ---- probe: print every material's PBR params on the can ----
const FILE = process.argv[2] || 'nyc_can-compressed.glb';
const { gltfLoader, dracoLoader } = makeGltfLoader();
patchDracoMainThread(dracoLoader);
const buf = fs.readFileSync(path.join(DIR, FILE));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
console.log('== ' + FILE + ' ==');
const seen = new Set();
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  mats.forEach((m) => {
    if (!m || seen.has(m.uuid)) return;
    seen.add(m.uuid);
    const c = m.color;
    const hex = '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    console.log('  material ' + (m.type || '?') +
      '  color=' + hex + '  (luminance ' + lum.toFixed(3) + ')' +
      '  metalness=' + m.metalness + '  roughness=' + m.roughness +
      (m.map ? '  [baseColorMap]' : '') +
      (m.normalMap ? '  [normalMap]' : '') +
      (m.metalnessMap ? '  [metalnessMap]' : '') +
      (m.roughnessMap ? '  [roughnessMap]' : '') +
      '  envMap=' + (m.envMap ? 'yes' : 'no'));
    if (m.map && m.map.image && m.map.image.data) {
      try {
        const d = m.map.image.data, n = d.length / 4;
        let sum = 0;
        const step = Math.max(1, Math.floor(n / 20000));
        let cnt = 0;
        for (let p = 0; p < n; p += step) {
          const j = p * 4;
          sum += 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
          cnt++;
        }
        console.log('     -> baseColorMap avg luminance ≈ ' + (sum / cnt / 255).toFixed(3) + ' (0=black, 1=white)');
      } catch (e) {}
    }
  });
});
console.log('done');
