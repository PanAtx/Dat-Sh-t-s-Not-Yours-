// Verifies the "Please Wait, Getting Assets" pre-game gate in index.html:
//  (1) the #loading screen exists and #menu is hidden by default,
//  (2) PRELOAD_ASSETS covers all 6 models + both title images,
//  (3) getModelUrl streams byte-level progress via onProgress,
//  (4) the REAL preloadAssetsToCache fills the cache and drives the bar to 100%,
//      and a second run is 100% cache (0 new network hits),
//  (5) buildTruck() THROWS when the FBX template is missing, so the ugly
//      procedural box truck can never be what the player sees.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let pass = true;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };

// ---- (1) HTML: loading screen + hidden menu ----
check('#loading modal exists', /<div id="loading" class="modal">/.test(html));
check('loading has bar + pct + label', ['ldbar-fill', 'ld-pct', 'ld-label'].every(id => html.indexOf('id="' + id + '"') >= 0));
check('loading has RETRY button', html.indexOf('id="btnRetry"') >= 0);
check('#menu is hidden by default', /<div id="menu" class="modal hidden">/.test(html));
check('#loading z-index 30 (above #menu 20)', /#loading \{ z-index:30/.test(html));

// ---- (2) PRELOAD_ASSETS covers the 6 models + 2 title images ----
const paS = html.indexOf('const PRELOAD_ASSETS');
const paE = html.indexOf('const PRELOAD_TOTAL', paS);
const paBlock = html.slice(paS, paE);
const need = ['truck.fbx', 'car.glb', 'litterReduced2.glb', 'coffee_shop_cup.glb',
  'sweet_bread_roll_game_ready__2k_pbr.glb', 'red_bull_energy_drink_can.glb', 'dsnylogo.jpg', 'explicit_logo.webp'];
for (const u of need) check('PRELOAD_ASSETS includes ' + u, paBlock.indexOf("'" + u + "'") >= 0);

// ---- (3) getModelUrl streaming support ----
check('getModelUrl(url, onProgress) signature', /async function getModelUrl\(url, onProgress\)/.test(html));
check('reads content-length header', html.indexOf("get('content-length')") >= 0);
check('streams via body.getReader', html.indexOf('body.getReader') >= 0);

// ---- (5) buildTruck throws when the FBX template is missing ----
const btS = html.indexOf('function buildTruck(){');
const btE = html.indexOf('\nfunction ', btS + 10);
const btCode = html.slice(btS, btE > 0 ? btE : btS + 4000);
let threw = false;
try { new Function('FBX_TPL', btCode + '\nreturn buildTruck;')({ truck: null })(); }
catch (e) { threw = /FBX truck model not loaded yet/.test(e.message); }
check('buildTruck THROWS when FBX template missing (no procedural truck)', threw);

// ---- boot no longer builds the procedural truck at top level ----
const bootS = html.indexOf('// ==================== BOOT ====================');
const boot = html.slice(bootS);
check('boot no longer calls truck = buildTruck()', boot.indexOf('truck = buildTruck()') < 0);
check('boot kicks off preloadAssets()', /preloadAssets\(\);/.test(boot));
const rtS = html.indexOf('function rebuildTruckFromFbx(){');
const rtE = html.indexOf('\nfunction ', rtS + 10);
check('rebuildTruckFromFbx is null-safe (truck ? truck.wx)', /truck \? truck\.wx/.test(html.slice(rtS, rtE > 0 ? rtE : rtS + 1200)));

// ---- (4) behavior: streaming progress + full cache fill via the REAL preloadAssetsToCache ----
(async () => {
  const SIZES = { 'truck.fbx': 17874592, 'sweet_bread_roll_game_ready__2k_pbr.glb': 3752076,
    'red_bull_energy_drink_can.glb': 2989592, 'litterReduced2.glb': 335980, 'car.glb': 186248,
    'coffee_shop_cup.glb': 144300, 'dsnylogo.jpg': 1290338, 'explicit_logo.webp': 20448 };
  const store = new Map();
  global.caches = { open: async () => ({
    match: async (u) => { const v = store.get(u); if (!v) return null; return new Response(v); },
    put: async (u, r) => { store.set(u, await r.blob()); },
    keys: async () => [...store.keys()],
  }) };
  let netHits = 0;
  global.fetch = async (url) => {
    if (SIZES[url] === undefined) return { ok: false };
    netHits++;
    const total = SIZES[url];
    const data = new Uint8Array(total);
    return { ok: true, headers: { get: (h) => h.toLowerCase() === 'content-length' ? String(total) : null },
      body: { getReader: () => { let done = false; return { read: async () => { if (done) return { done: true }; done = true; return { done: false, value: data }; } }; } } };
  };
  const b = html.indexOf('// ---MODEL_CACHE_BEGIN---');
  const e = html.indexOf('// ---MODEL_CACHE_END---');
  const mc = html.slice(b, e + '// ---MODEL_CACHE_END---'.length);
  const MC = new Function('caches', 'fetch', 'URL', 'Response', mc + '\nreturn { getModelUrl: getModelUrl, _modelGetCache: _modelGetCache, _modelMemCache: _modelMemCache };')(global.caches, global.fetch, global.URL, Response);
  global.URL.createObjectURL = () => 'blob:x';
  global.URL.revokeObjectURL = () => {};

  // streaming progress on the big truck.fbx
  let calls = 0, monotonic = true, lastR = 0, sawCL = false, finalR = 0;
  const res = await MC.getModelUrl('truck.fbx', (r, t) => { calls++; if (r < lastR) monotonic = false; lastR = r; finalR = r; if (t === SIZES['truck.fbx']) sawCL = true; });
  check('onProgress called while downloading', calls >= 1);
  check('onProgress received-bytes monotonic non-decreasing', monotonic);
  check('onProgress reported the true total (content-length)', sawCL);
  check('final progress = full byte count', finalR === SIZES['truck.fbx']);
  check('cold load returns blob URL (not cache)', res.url.indexOf('blob:') === 0 && !res.fromCache);
  // Regression guard: a real Response has NO .size property, so the gate must rely on
  // getModelUrl's reported size (from the Blob) + cached flag, not cache.match().size.
  check('cold load reports cached:true (persisted)', res.cached === true);
  check('cold load reports the true byte size from the Blob', res.size === SIZES['truck.fbx']);

  // run the REAL preloadAssetsToCache extracted from index.html
  const f1 = html.indexOf('async function preloadAssetsToCache(){');
  const f2 = html.indexOf('async function buildModelTemplates(){', f1);
  const pcCode = html.slice(f1, f2);
  const PRELOAD_ASSETS = Object.keys(SIZES).map(u => ({ url: u, size: SIZES[u], label: u }));
  const PRELOAD_TOTAL = PRELOAD_ASSETS.reduce((a, x) => a + x.size, 0);
  let pcts = [];
  const rowCalls = [];   // records the per-asset checklist updates (ldRow)
  const preload = new Function('caches', 'fetch', 'URL', 'Response', 'PRELOAD_ASSETS', 'PRELOAD_TOTAL', 'getModelUrl', '_modelGetCache', '_modelMemCache', 'ldSetLabel', 'ldSetPct', 'ldSetFill', 'ldRow',
    pcCode + '\nreturn preloadAssetsToCache;')(global.caches, global.fetch, global.URL, Response, PRELOAD_ASSETS, PRELOAD_TOTAL, MC.getModelUrl, MC._modelGetCache, MC._modelMemCache, () => {}, (p) => { pcts.push(p); }, () => {}, (url, cls, text) => { rowCalls.push({ url, cls, text }); });
  await preload();
  check('preload drives the bar to 100%', pcts.length > 0 && pcts[pcts.length - 1] === 100);
  check('all 8 assets are in the cache after preload', store.size === 8);
  // Per-asset checklist: every asset was marked done + CACHED (the real persisted path)
  check('every asset row updated to done/CACHED', PRELOAD_ASSETS.every(a => rowCalls.some(c => c.url === a.url && c.cls === 'done' && c.text === 'CACHED')));
  const before = netHits;
  await preload();
  check('second preload is 100% cache (0 new network hits)', netHits === before);

  console.log(pass ? '\nPRELOAD GATE ALL CHECKS PASS' : '\nPRELOAD GATE CHECKS FAILED');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('PRELOAD GATE FAILED:', e && e.stack ? e.stack : e); process.exit(1); });