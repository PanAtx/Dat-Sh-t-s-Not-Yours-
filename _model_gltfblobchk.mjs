// Validates the offline MODEL cache for the GLTF path (5 of the 6 models are .glb) with the
// REAL car.glb and the REAL local GLTFLoader.js + r128 three: it proves the EXACT
// loadCarGltf() from index.html, fed a BLOB URL produced by the cache (getModelUrl), still
// parses car.glb and builds CAR_TPL. This exercises the NEW code path
// (loader.load(blobUrl) -> FileLoader XHR -> parse) for the GLTF loaders.
//   - the cache is pre-seeded with car.glb
//   - fetch is made to REJECT (simulating offline / dropped connection)
//   - the FileLoader is stubbed to serve bytes from a blob-URL -> blob map (browser XHR behavior)
//   - loadCarGltf() must succeed ENTIRELY from the cache, with 0 network fetches
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
function fakeEl(){ return { setAttribute(){}, style:{}, width:0, height:0, addEventListener(){}, removeEventListener(){} }; }
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

// ---- browser globals set up BEFORE the GLTFLoader loads ----
let _blobSeq = 0;
const blobToBlob = new Map();
global.URL.createObjectURL = (blob) => { const u = 'blob:mock/' + (++_blobSeq); blobToBlob.set(u, blob); return u; };
global.URL.revokeObjectURL = () => {};
let loadGotUrl = null;
let loadGotIsBlob = false;
// Fake XHR: THREE.FileLoader.load(url) -> resolves the bytes the browser would get for `url`.
THREE.FileLoader = class {
  setPath(){ return this; }
  setResponseType(){ return this; }
  setRequestHeader(){ return this; }
  setWithCredentials(){ return this; }
  load(url, onLoad, onProgress, onError){
    if (url.indexOf('blob:') === 0) { loadGotUrl = url; loadGotIsBlob = true; }
    const blob = blobToBlob.get(url);
    if (!blob){ setTimeout(() => onError && onError(new Error('XHR: no bytes for ' + url)), 0); return; }
    blob.arrayBuffer().then((bytes) => setTimeout(() => onLoad(bytes), 0), (e) => setTimeout(() => onError && onError(e), 0));
  }
};
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED: local GLTFLoader.js did not define THREE.GLTFLoader'); process.exit(1); }
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

const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
// Extract loadCarGltf verbatim (it references getModelUrl, CAR_TPL, rebuildCarsFromGltf).
const cs = html.indexOf('async function loadCarGltf(){');
const ce = html.indexOf('function makeCarGltf(', cs);
if (cs < 0 || ce < 0){ console.error('FAIL: could not locate loadCarGltf'); process.exit(1); }
const carCode = html.slice(cs, ce);

// ---- the real car.glb bytes, pre-seeded into the cache ----
const carBytes = fs.readFileSync(path.join(DIR, 'car.glb'));
const cacheStore = new Map();
cacheStore.set('car.glb', new Blob([carBytes]));
let netFetches = 0;
global.caches = { open: async () => ({
  match: async (url) => { const v = cacheStore.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { cacheStore.set(url, await resp.blob()); },
  keys: async () => [...cacheStore.keys()],
}) };
global.fetch = async () => { netFetches++; throw new Error('offline (simulated)'); };

// The MODEL_CACHE block (getModelUrl) is defined in the page scope; extract + define it.
const mb = html.indexOf('// ---MODEL_CACHE_BEGIN---');
const me = html.indexOf('// ---MODEL_CACHE_END---');
const modelCacheCode = html.slice(mb, me + '// ---MODEL_CACHE_END---'.length);
const getModelUrl = new Function('fetch', 'URL', 'caches', 'Response',
  modelCacheCode + '\nreturn getModelUrl;')(global.fetch, global.URL, global.caches, Response);

// Run loadCarGltf in a self-contained function. loadCarGltf assigns `CAR_TPL = {...}` to a
// binding declared in the same scope, so we declare it here and RETURN the template once the
// load resolves (a plain outer variable would be shadowed by the closure).
let rebuildCalled = false;
const runLoadCar = new Function('THREE', 'getModelUrl', 'rebuildCarsFromGltf',
  'let CAR_TPL = null;\n' + carCode +
  '\nreturn loadCarGltf().then(() => CAR_TPL);');

(async () => {
  const t0 = Date.now();
  const CAR_TPL = await runLoadCar(THREE, getModelUrl, () => { rebuildCalled = true; });
  const ok = !!(CAR_TPL && CAR_TPL.template);
  let meshCount = 0;
  if (CAR_TPL && CAR_TPL.template) CAR_TPL.template.traverse(o => { if (o.isMesh) meshCount++; });
  console.log('  CAR_TPL built: ' + ok + ' (meshes=' + meshCount + ')');
  console.log('  rebuildCarsFromGltf called: ' + rebuildCalled);
  console.log('  loader received URL: ' + loadGotUrl + ' (blob=' + loadGotIsBlob + ')');
  console.log('  network fetches (fetch always rejected): ' + netFetches);
  const passed = ok && loadGotIsBlob && netFetches === 0 && meshCount > 0;
  console.log('\nBLOB-URL GLTF LOAD ' + (passed ? 'ALL CHECKS PASS' : 'FAILED') + ' in ' + (Date.now() - t0) + 'ms');
  process.exit(passed ? 0 : 1);
})().catch(e => { console.error('BLOB-URL GLTF LOAD FAILED:', e && e.stack ? e.stack : e); process.exit(1); });