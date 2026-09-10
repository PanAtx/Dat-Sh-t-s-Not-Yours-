// End-to-end simulation of the offline MODEL cache using the EXACT code from index.html:
// extract the MODEL_CACHE block (getModelUrl + _modelGetCache), then prove that
//   (1) a first load downloads every model from the "network" and stores it in the cache,
//   (2) a second load serves ALL models from cache with ZERO network fetches,
//   (3) a real loader (loadCarGltf) routes its file through the cache (blob URL),
// so the 3D assets keep working on poor or dropped connections.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// --- the six model files the game loads (filenames must match the loaders) ---
const MODELS = {
  'truck.fbx': 'fake-truck-fbx-bytes',
  'car.glb': 'fake-car-glb-bytes',
  'litterReduced2.glb': 'fake-litter-glb-bytes',
  'red_bull_energy_drink_can.glb': 'fake-redbull-glb-bytes',
  'coffee_shop_cup.glb': 'fake-coffee-glb-bytes',
  'sweet_bread_roll_game_ready__2k_pbr.glb': 'fake-bec-glb-bytes',
};

// --- static check: every loader in index.html routes its file through getModelUrl ---
const loaderFns = ['loadFbxTemplates', 'loadCarGltf', 'loadLitterbasketGltf', 'loadCoffeeGltf', 'loadBecGltf', 'loadMonsterGltf'];
for (const fn of loaderFns) {
  const i = html.indexOf('function ' + fn + '()');
  const j = html.indexOf('function ', i + 10);
  const body = html.slice(i, j > 0 ? j : i + 4000);
  if (body.indexOf('getModelUrl(') < 0) { console.error('FAIL: ' + fn + ' does not use getModelUrl'); process.exit(1); }
}
for (const name of Object.keys(MODELS)) {
  if (html.indexOf("getModelUrl('" + name + "')") < 0) { console.error('FAIL: no loader calls getModelUrl(\'' + name + '\')'); process.exit(1); }
}
console.log('all 6 loaders route through getModelUrl (OK)');

// --- extract the EXACT MODEL_CACHE block from index.html ---
const begin = html.indexOf('// ---MODEL_CACHE_BEGIN---');
const end = html.indexOf('// ---MODEL_CACHE_END---');
if (begin < 0 || end < 0) { console.error('FAIL: MODEL_CACHE block not found in index.html'); process.exit(1); }
const modelCacheCode = html.slice(begin, end + '// ---MODEL_CACHE_END---'.length);

// --- fake Cache API + URL.createObjectURL + fetch so the real cache code path runs ---
const cacheStore = new Map();
let _blobSeq = 0;
global.caches = { open: async () => ({
  match: async (url) => { const v = cacheStore.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { cacheStore.set(url, await resp.blob()); },
  keys: async () => [...cacheStore.keys()],
}) };
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'blob:mock/' + (++_blobSeq);
global.URL.revokeObjectURL = () => {};
let netFetches = 0;
global.fetch = async (url) => {
  if (MODELS[url] !== undefined) { netFetches++; return { ok: true, blob: async () => new Blob([MODELS[url]]) }; }
  return { ok: false };
};
const MC = new Function('caches', 'fetch', 'URL', 'Response',
  modelCacheCode + '\nreturn { getModelUrl: getModelUrl, _modelGetCache: _modelGetCache };')(
  global.caches, global.fetch, global.URL, Response);
const names = Object.keys(MODELS);
const t0 = Date.now();
(async () => {
  // --- first load: each model hits the network exactly once and is stored in cache ---
  for (const name of names) {
    const res = await MC.getModelUrl(name);
    if (res.url.indexOf('blob:') !== 0) { console.error('FAIL: first load should return a blob URL for ' + name, res.url); process.exit(1); }
    if (res.fromCache) { console.error('FAIL: first load should NOT be from cache: ' + name); process.exit(1); }
  }
  if (netFetches !== names.length) { console.error('FAIL: expected ' + names.length + ' network fetches on first load, got', netFetches); process.exit(1); }
  console.log('first load: all', names.length, 'models downloaded from network and stored in cache (OK)');

  // --- cache holds all six models ---
  const cached = await MC._modelGetCache().then(c => c.keys());
  if (cached.length !== names.length) { console.error('FAIL: cache should hold all', names.length, 'models, holds', cached.length); process.exit(1); }
  console.log('cache holds all', names.length, 'models (OK)');

  // --- second load: every model served 100% from cache with ZERO network fetches ---
  const before = netFetches;
  for (const name of names) {
    const res = await MC.getModelUrl(name);
    if (res.url.indexOf('blob:') !== 0) { console.error('FAIL: second load should return a blob URL for ' + name); process.exit(1); }
    if (!res.fromCache) { console.error('FAIL: second load should be from cache: ' + name); process.exit(1); }
  }
  if (netFetches !== before) { console.error('FAIL: second load hit the network', netFetches - before, 'times (should be 0)'); process.exit(1); }
  console.log('second load: all', names.length, 'models served 100% from cache, 0 network fetches (OK)');

  // --- a real loader (loadCarGltf) routes its file through the cache ---
  const carStart = html.indexOf('async function loadCarGltf(){');
  const carEnd = html.indexOf('function makeCarGltf(', carStart);
  if (carStart < 0 || carEnd < 0) { console.error('FAIL: could not locate loadCarGltf in index.html'); process.exit(1); }
  const carCode = html.slice(carStart, carEnd);
  let gltfLoadUrl = null;
  const THREE = { GLTFLoader: class { load(url, onLoad) { gltfLoadUrl = url; onLoad({ scene: { traverse: () => {} } }); } } };
  const loadCarGltf = new Function('THREE', 'getModelUrl', 'rebuildCarsFromGltf', 'CAR_TPL',
    carCode + '\nreturn loadCarGltf;')(THREE, MC.getModelUrl, () => {}, null);
  await loadCarGltf();
  if (!gltfLoadUrl || gltfLoadUrl.indexOf('blob:') !== 0) { console.error('FAIL: loadCarGltf should load from a blob URL (cache), got', gltfLoadUrl); process.exit(1); }
  console.log('loadCarGltf routed through the cache: loader received a blob URL (OK)');

  console.log('E2E MODEL CACHE OK (first-load downloads+stores, second-load 100% cache, 0 network) in ' + (Date.now() - t0) + 'ms');
  process.exit(0);
})().catch(e => { console.error('E2E MODEL CACHE FAILED:', e && e.stack ? e.stack : e); process.exit(1); });