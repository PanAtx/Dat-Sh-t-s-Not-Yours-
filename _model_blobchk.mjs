// Validates the offline MODEL cache end-to-end with the REAL truck.fbx and the REAL local
// FBXLoader.js + r128 three: it proves that the EXACT loadFbxTemplates() from index.html,
// fed a BLOB URL produced by the cache (getModelUrl), still parses truck.fbx and extracts
// the three asset groups. This exercises the NEW code path (loader.load(blobUrl) -> FileLoader
// XHR -> parse), which the older .parse() tests did not cover.
//   - the cache is pre-seeded with truck.fbx
//   - fetch is made to REJECT (simulating offline / dropped connection)
//   - the FileLoader is stubbed to serve bytes from a blob-URL -> bytes map (what the browser
//     XHR does for a blob URL)
//   - loadFbxTemplates() must succeed ENTIRELY from the cache, with 0 network fetches
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

// ---- browser globals the FBXLoader needs, set up BEFORE it loads ----
// Track every blob URL the cache code (and the FBXLoader's embedded textures) create,
// so the XHR stub can serve their bytes (what the browser XHR does for a blob: URL).
let _blobSeq = 0;
const blobToBlob = new Map();
global.URL.createObjectURL = (blob) => { const u = 'blob:mock/' + (++_blobSeq); blobToBlob.set(u, blob); return u; };
global.URL.revokeObjectURL = () => {};
let textureBlobLoads = 0;
// Fake Image: FBXLoader loads embedded textures via `new Image(); img.src = blobUrl;`
global.Image = class {
  set src(v){
    this._src = v;
    if (v.indexOf('blob:') === 0) textureBlobLoads++;
    const fire = (type) => (this._l[type] || []).slice().forEach(f => f({ type }));
    setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
  }
  get src(){ return this._src; }
  addEventListener(t, f){ (this._l = this._l || {})[t] = (this._l[t] || []).concat(f); }
  removeEventListener(){}
};

// Fake XHR: THREE.FileLoader.load(url) -> resolves the bytes the browser would get for `url`.
// For a blob: URL it serves the bytes of the blob that URL was created from (cached model bytes,
// or an embedded-texture blob). For any other URL it fails (only blob URLs are expected here).
let loadGotUrl = null;
let loadGotIsBlob = false;
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

(0, eval)(fs.readFileSync(path.join(DIR, 'FBXLoader.js'), 'utf8'));
if (typeof THREE.FBXLoader === 'undefined'){ console.error('FAILED: local FBXLoader.js did not define THREE.FBXLoader'); process.exit(1); }
// r128 CDN build has LoaderUtils.decodeText; the local build may not -> polyfill for the harness only.
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
// The FBX helper block: from 'const TRUCK_SCALE' to the GLTF pipeline marker. This range
// already CONTAINS the MODEL_CACHE block (getModelUrl/_modelGetCache/_modelCache) because it
// was inserted just above loadFbxTemplates, so we do not append it again.
const start = html.indexOf('const TRUCK_SCALE');
const end = html.indexOf('// ==================== GLTF 3D TRAFFIC CAR PIPELINE', start);
if (start < 0 || end < 0){ console.error('FAIL: could not locate FBX helper block'); process.exit(1); }
const fbxHelperCode = html.slice(start, end);
if (fbxHelperCode.indexOf('function getModelUrl(') < 0){ console.error('FAIL: MODEL_CACHE block not inside FBX helper range'); process.exit(1); }

// ---- the real truck.fbx bytes, pre-seeded into the cache ----
const truckBytes = fs.readFileSync(path.join(DIR, 'truck.fbx'));
const cacheStore = new Map();
let netFetches = 0;

global.caches = { open: async () => ({
  match: async (url) => { const v = cacheStore.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { cacheStore.set(url, await resp.blob()); },
  keys: async () => [...cacheStore.keys()],
}) };
// Pre-seed the cache with truck.fbx (as a first visit would have done).
cacheStore.set('truck.fbx', new Blob([truckBytes]));
// fetch REJECTS: the connection is down, so only the cache can serve the model.
global.fetch = async () => { netFetches++; throw new Error('offline (simulated)'); };

const { loadFbxTemplates, _modelGetCache, FBX_TPL: innerTPL } = new Function('THREE', 'fetch', 'URL', 'caches', 'Response', 'Blob',
  fbxHelperCode + '\nreturn { loadFbxTemplates: loadFbxTemplates, _modelGetCache: _modelGetCache, FBX_TPL: FBX_TPL };')(
  THREE, global.fetch, global.URL, global.caches, Response, Blob);

(async () => {
  const t0 = Date.now();
  await loadFbxTemplates();
  // innerTPL is the FBX_TPL that loadFbxTemplates() actually populated (declared inside the
  // extracted code), not the outer placeholder.
  const ok = !!innerTPL.truck && !!innerTPL.can && !!innerTPL.bag;
  const det = innerTPL.truck && innerTPL.truck.orient ? innerTPL.truck.orient.determinant() : null;
  console.log('  FBX_TPL populated: truck=' + !!innerTPL.truck + ' can=' + !!innerTPL.can + ' bag=' + !!innerTPL.bag);
  console.log('  truck.orient determinant = ' + (det === null ? 'n/a' : det.toFixed(4)));
  console.log('  loader received URL: ' + loadGotUrl + ' (blob=' + loadGotIsBlob + ')');
  console.log('  network fetches (fetch always rejected): ' + netFetches);
  console.log('  embedded texture blob loads (FBXLoader internal): ' + textureBlobLoads);
  const passed = ok && loadGotIsBlob && netFetches === 0 && det !== null && Math.abs(det - 1) < 1e-6;
  console.log('\nBLOB-URL FBX LOAD ' + (passed ? 'ALL CHECKS PASS' : 'FAILED') + ' in ' + (Date.now() - t0) + 'ms');
  process.exit(passed ? 0 : 1);
})().catch(e => { console.error('BLOB-URL FBX LOAD FAILED:', e && e.stack ? e.stack : e); process.exit(1); });