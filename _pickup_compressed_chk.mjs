// _pickup_compressed_chk.mjs - verify the COMPRESSED pickup models
//   sweet_bread_roll_game_ready__2k_pbr-compressed.glb (BAGEL)
//   red_bull_energy_drink_can-compressed.glb (RED BULL)
// decode through the project's LOCAL GLTFLoader + DRACOLoader (three r128) in Node,
// with the decoder served from the LOCAL ./draco/ folder (exactly what index.html does).
// When the UNCOMPRESSED originals still exist on disk, the native bounding boxes are
// compared against them (Draco quantization must stay within tolerance); the final
// game-space sizes are always checked against the baked BEC_SCALE / MONSTER_SCALE.
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

// ---- Loaders exactly like index.html's makeGltfLoader() ----
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

// Scales are parsed from index.html so the check always mirrors the live constants.
function getScale(html, re) {
  const m = html.match(re);
  if (!m) return null;
  return m[2] !== undefined ? parseFloat(m[1]) / parseFloat(m[2]) : parseFloat(m[1]);
}

const JOBS = [
  {
    name: 'BEC (bacon-egg-cheese)',
    file: 'bec-compressed.glb',
    orig: 'bec.glb',
    dim: 'x',
    target: 1.1,
    scaleRe: /const BEC_SCALE = ([\d.]+)\s*\/\s*([\d.]+)/,
  },
  {
    name: 'RED BULL',
    file: 'red_bull_energy_drink_can-compressed.glb',
    orig: 'red_bull_energy_drink_can.glb',
    dim: 'y',
    target: 0.8,
    scaleRe: /const MONSTER_SCALE = ([\d.]+)\s*\/\s*([\d.]+)/,
  },
  {
    name: 'CAR',
    file: 'car-compressed.glb',
    orig: 'car.glb',
    dim: 'y',
    target: 4.665 * 1.0116,
    scaleRe: /const CAR_SCALE = ([\d.]+)/,
    expectMatName: 'Lights', // index.html gives the "Lights" material its headlight glow
  },
  {
    name: 'COFFEE CUP',
    file: 'coffee_shop_cup-compressed.glb',
    orig: 'coffee_shop_cup.glb',
    dim: 'y',
    target: 0.65,
    scaleRe: /const COFFEE_SCALE = ([\d.]+)\s*\/\s*([\d.]+)/,
  },
];
const HTML = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');

for (const j of JOBS) {
  console.log('\n== ' + j.name + ': ' + j.file + ' ==');
  if (!has(j.file)) { check('compressed file exists', false); continue; }
  let c = null, threw = null;
  try { c = await loadModel(j.file); } catch (e) { threw = e; }
  console.warn = ow; console.error = oe;
  if (threw) { console.error(j.name + ' THREW:', threw && threw.message); ok = false; continue; }
  console.warn = ow; console.error = oe;
  console.log('bytes=' + c.bytes, 'meshes=' + c.meshes, 'verts=' + c.verts,
    'texturedMeshes=' + c.textured, 'warns=' + warns.length, 'errs=' + errs.length);
  warns.slice(0, 5).forEach(w => console.log('  W:', w));
  errs.slice(0, 5).forEach(e => console.log('  E:', e));
  check('decodes (non-empty scene)', c.meshes > 0 && c.verts > 0);
  if (j.expectMatName) {
    let found = false;
    c.gltf.scene.traverse(o => { if (o.isMesh && o.material && o.material.name === j.expectMatName) found = true; });
    check('material named "' + j.expectMatName + '" preserved (index.html depends on it)', found);
  }
  console.log('  native size :', c.size.x.toFixed(5), c.size.y.toFixed(5), c.size.z.toFixed(5),
    '| minY =', c.box.min.y.toFixed(5), '| texturedMeshes =', c.textured);
  const scale = getScale(HTML, j.scaleRe);
  check('scale constant found in index.html', scale !== null);
  if (scale !== null) {
    const finalMain = c.size[j.dim] * scale;
    console.log('  final ' + j.dim + ' =', finalMain.toFixed(4), '(target ' + j.target.toFixed(4) + ')');
    check('final ' + j.dim + ' within 4% of target ' + j.target.toFixed(4), Math.abs(finalMain - j.target) / j.target < 0.04);
  }
  if (has(j.orig)) {
    const u = await loadModel(j.orig);
    console.log('  original  :', u.size.x.toFixed(5), u.size.y.toFixed(5), u.size.z.toFixed(5),
      '| minY =', u.box.min.y.toFixed(5), '| texturedMeshes =', u.textured);
    check('native X within 3% of original', relDiff(c.size.x, u.size.x) < 0.03);
    check('native Y within 3% of original', relDiff(c.size.y, u.size.y) < 0.03);
    check('native Z within 3% of original', relDiff(c.size.z, u.size.z) < 0.03);
    check('native base (y-min) within 3% of original', relDiff(c.box.min.y, u.box.min.y) < 0.03);
    check('texture mesh count unchanged by compression', c.textured === u.textured);
  } else {
    console.log('  (original not on disk - skipping box comparison)');
  }
}

// ---------------- index.html wiring ----------------
console.log('\n== index.html wiring ==');
const html = HTML;
check('BEC loader loads bec-compressed.glb via makeGltfLoader (Draco)',
  /async function loadBecGltf\(\)[\s\S]{0,900}?makeGltfLoader\(\)\.load\(/.test(html) &&
  /loadBecGltf[\s\S]{0,1200}?"bec-compressed\.glb"/.test(html));
check('BEC loader tames the metallic PBR (metalness 0.15)',
  /async function loadBecGltf\(\)[\s\S]{0,1800}?m\.metalness = 0\.15/.test(html));
check('red bull loader uses makeGltfLoader (Draco) + compressed file',
  /async function loadMonsterGltf\(\)[\s\S]{0,900}?makeGltfLoader\(\)\.load\(/.test(html) &&
  /loadMonsterGltf[\s\S]{0,1200}?"red_bull_energy_drink_can-compressed\.glb"/.test(html));
check('car loader uses makeGltfLoader (Draco) + compressed file',
  /async function loadCarGltf\(\)[\s\S]{0,900}?makeGltfLoader\(\)\.load\(/.test(html) &&
  /loadCarGltf[\s\S]{0,1200}?"car-compressed\.glb"/.test(html));
check('coffee loader uses makeGltfLoader (Draco) + compressed file',
  /async function loadCoffeeGltf\(\)[\s\S]{0,900}?makeGltfLoader\(\)\.load\(/.test(html) &&
  /loadCoffeeGltf[\s\S]{0,1200}?"coffee_shop_cup-compressed\.glb"/.test(html));
for (const j of JOBS) {
  const sz = has(j.file) ? fs.statSync(path.join(DIR, j.file)).size : -1;
  if (sz > 0) check('PRELOAD has ' + j.name + ' compressed size (' + sz + ')',
    new RegExp('url: "' + j.file.replace(/\./g, '\\.') + '",\\s*size: ' + sz).test(html));
}
check('PRELOAD labels the BEC pickup "BEC"', /url: "bec-compressed\.glb",[\s\S]{0,80}?label: "BEC"/.test(html));
check('old bagel glb (plain + compressed) fully gone', !/sweet_bread_roll_game_ready__2k_pbr(-compressed)?\.glb/.test(html));
check('old red bull glb fully gone', !/"red_bull_energy_drink_can\.glb"/.test(html));
check('old car glb fully gone', !/"car\.glb"/.test(html));
check('old coffee cup glb fully gone', !/"coffee_shop_cup\.glb"/.test(html));
check('plain bec.glb never referenced', html.indexOf('"bec.glb"') < 0);

// index.html inline scripts still parse
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

console.log('\n' + (ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(ok ? 0 : 1);
