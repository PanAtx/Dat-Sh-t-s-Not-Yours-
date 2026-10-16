// _shovel_compressed_probe.mjs — decode a shovel .glb through the game's OWN
// local loaders (GLTFLoader + DRACOLoader with the ./draco/ decoder), exactly
// like _compressed_models_chk.mjs, and print the NATIVE-SPACE bounding box +
// triangle count. Used to prove shovelcompressed.glb preserves the extents the
// pose math is baked to: length 1.903u along Y (-0.952..+0.951), X half-width
// ~0.285 (the D-loop is the widest part), Z spread ~0.046+.
//   node _shovel_compressed_probe.mjs <file.glb>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const DIR = import.meta.dirname;
const GLB = process.argv[2] || 'shovelcompressed.glb';

const THREE = (await import(pathToFileURL(path.join(DIR, 'three_r128.min.js')).href)).default;
global.THREE = THREE;
global.self = global;
global.window = global;

// ---------- Browser shims (Blob, Image/document, XHR) — same as the check harnesses ----------
const partsMap = new Map();
let blobSeq = 0;
const RealBlob = global.Blob;
global.Blob = class extends RealBlob {
  constructor(parts, opts) {
    super(parts, opts);
    const flat = (parts || []).flatMap((p) => (Array.isArray(p) ? p : [p]));
    this._blobId = 'blob:' + ++blobSeq;
    partsMap.set(this._blobId, flat.map((p) => (typeof p === 'string' ? p : Buffer.from(p).toString('utf8'))).join(''));
  }
};
global.URL = global.URL || {};
global.URL.createObjectURL = (b) => (b && b._blobId) || 'blob:0';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute() {}, style: {}, width: 0, height: 0, _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    set src(v) {
      this._src = v;
      const fire = (type) => {
        (this._listeners[type] || []).slice().forEach((f) => f({ type }));
        const prop = type === 'load' ? this.onload : this.onerror;
        if (typeof prop === 'function') prop({ type });
      };
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src() { return this._src; },
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
    if (!local) {
      setTimeout(() => (this._listeners['error'] || []).forEach((f) => f({ type: 'error', target: this, detail: 'blocked ' + this._url })), 0);
      return;
    }
    const buf2 = fs.readFileSync(path.join(DIR, local));
    this.status = 200;
    this.response = this.responseType === 'arraybuffer'
      ? buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength)
      : buf2.toString('utf8');
    (this._listeners['progress'] || []).forEach((f) => f({ type: 'progress', target: this, lengthComputable: false }));
    (this._listeners['load'] || []).forEach((f) => f({ type: 'load', target: this }));
  }
};
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(DIR, 'DRACOLoader.js'), 'utf8'));

function makeGltfLoader() {
  const gltfLoader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('./draco/'); // XHR shim serves ./draco/ from disk
  gltfLoader.setDRACOLoader(dracoLoader);
  return { gltfLoader, dracoLoader };
}

// Node has no Web Worker runtime: run the REAL worker decode code on the main thread.
function patchDracoMainThread(dracoLoader) {
  let dracoModule = null, dracoHelpers = null;
  const ensureDraco = dracoLoader._initDecoder().then(() => {
    const code = partsMap.get(dracoLoader.workerSourceURL);
    if (typeof code !== 'string') throw new Error('worker source not captured');
    const run = new Function('process', 'require', 'module', 'exports', 'window',
      code + '\n;return { decodeGeometry, decodeIndex, decodeAttribute, getDracoDataType, DracoDecoderModule };');
    const helpers = run(undefined, undefined, undefined, undefined, globalThis);
    return new Promise((res) => helpers.DracoDecoderModule({ wasmBinary: dracoLoader.decoderConfig.wasmBinary, onModuleLoaded: res }))
      .then((m) => { dracoModule = m; dracoHelpers = helpers; });
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
        const buf3 = new draco.DecoderBuffer();
        buf3.Init(new Int8Array(msg.buffer), msg.buffer.byteLength);
        let geometry = null, err = null;
        try { geometry = dracoHelpers.decodeGeometry(draco, decoder, buf3, msg.taskConfig); }
        catch (e) { err = e; }
        finally { draco.destroy(buf3); draco.destroy(decoder); }
        if (err) { this._callbacks[msg.id].reject({ type: 'error', id: msg.id, error: err.message }); return; }
        this._callbacks[msg.id].resolve({ type: 'decode', id: msg.id, geometry });
      },
    }));
  };
}

const { gltfLoader, dracoLoader } = makeGltfLoader();
patchDracoMainThread(dracoLoader);
const buf = fs.readFileSync(path.join(DIR, GLB));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => gltfLoader.parse(ab, '', res, rej));
const scene = gltf.scene;
scene.updateMatrixWorld(true, true);
const box = new THREE.Box3().setFromObject(scene);
let meshes = 0, verts = 0, tris = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const g = o.geometry;
  verts += g.attributes.position.count;
  tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
});
const f = (n) => n.toFixed(4);
console.log(`file=${GLB} bytes=${buf.length} meshes=${meshes} verts=${verts} tris=${Math.round(tris)}`);
console.log(`bbox X ${f(box.min.x)} .. ${f(box.max.x)} (half ${f((box.max.x - box.min.x) / 2)})`);
console.log(`bbox Y ${f(box.min.y)} .. ${f(box.max.y)} (length ${f(box.max.y - box.min.y)})`);
console.log(`bbox Z ${f(box.min.z)} .. ${f(box.max.z)} (spread ${f(box.max.z - box.min.z)})`);

