#!/usr/bin/env node
/* ============================================================================
   THE PAINT LAW + THE STORAGE LEASE (v1.0.563)
   ----------------------------------------------------------------------------
   Two mobile-paint items from the audit, both proven by EXECUTING the real code:
     1) THE PAINT LAW (sw.js): a navigation request is served STALE-WHILE-REVALIDATE -
        the cached shell answers the launch immediately, and the network copy is fetched
        behind it and stored for the NEXT launch. The whole sw.js runs in a vm sandbox
        with a mock Cache API / fetch, and the suite FIRES its fetch handlers: a cached
        navigate resolves to the cached page (the network never gates first paint), the
        revalidation fetch still ran and its bytes were put() into the cache, a cache
        miss with a dead network falls back to ./index.html, the models / radio stay
        pass-through, and a shell asset is served cache-first.
     2) THE STORAGE LEASE (index.html): the shell + models + radio caches ask the
        browser to make this origin's storage permanent (a lease a phone under pressure
        honours; best-effort storage is what re-downloads a player's street on cellular
        after an eviction). requestStoragePersist() runs ONCE at boot, never blocks,
        tolerates a browser with no Storage API at all (iOS), and the perf line reports
        the lease.
   Run: node _paint_store_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const sw = fs.readFileSync('sw.js', 'utf8').replace(/\r\n/g, '\n');
const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (got !== undefined ? '  [' + got + ']' : '')); }
};

// ---------------------------------------------------------------- THE WORKER
function makeWorker(o) {
  o = o || {};
  const handlers = {};
  const log = { puts: [], fetches: [], cached: o.cached === undefined ? true : o.cached, networkOk: o.networkOk === undefined ? true : o.networkOk };
  const RES = (tag) => ({ ok: true, tag, clone() { return this; }, headers: { get() { return 'text/html'; } } });
  const CACHED = RES('CACHED-PAGE');
  const NET = RES('NETWORK-PAGE');
  const listeners = [];
  const ctx = {
    self: {
      addEventListener(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
      registration: { scope: '/' },
      location: { origin: 'https://example.test', href: 'https://example.test/sw.js' }, // a worker's self.location
      skipWaiting() { log.skip = true; },
    },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) },
    caches: {
      // A cache that answers './index.html' is the PRECACHED shell (the install always puts it
      // there); the navigate-URL presence is what the test toggles with log.cached.
      match: (req) => Promise.resolve(log.cached || req === './index.html' ? CACHED : null),
      open: () => Promise.resolve({ put: (req, res) => { log.puts.push(res && res.tag); return Promise.resolve(); } }),
      delete: () => Promise.resolve(false),
      keys: () => Promise.resolve([]),
      has: () => Promise.resolve(false),
    },
    Cache: class {},
    Response: function (body, opts) { return { ok: true, body, headers: { get() { return 'text/html'; } }, clone() { return this; }, tag: 'CTOR' }; },
    Request: function (url, o) { return Object.assign({ url, headers: { get() { return 'text/html'; } } }, o || {}); },
    URL: URL,
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    setTimeout, clearTimeout, Promise,
    fetch: (req) => {
      log.fetches.push(req && req.url ? req.url : String(req));
      return log.networkOk
        ? Promise.resolve(NET)
        : Promise.reject(new Error('no network (mock)'));
    },
    location: { origin: 'https://example.test' },
    console: { log() {}, warn() {} },
  };
  vm.runInNewContext(sw, ctx); // the worker script, exactly as the browser runs it
  const fire = (evName, ev) => (handlers[evName] || []).forEach((fn) => fn(ev));
  return { ctx, fire, handlers, log, CACHED, NET, listeners };
}
(async () => {
console.log('');
console.log('[1] THE PAINT LAW: a cached shell paints the launch, the network never gates it');
{
  const w = makeWorker({ cached: true, networkOk: true });
  check('sw.js carries the STALE-WHILE-REVALIDATE law for navigation (cache FIRST, revalidate behind)',
    sw.includes("if (req.mode === 'navigate')") &&
      sw.includes('if (hit) return hit; // paint NOW') &&
      sw.includes('caches.match(req).then(function (hit)') &&
      !sw.includes('NETWORK-FIRST so we always get'));
  check('the law is documented as a version-safe update rule (the cache name carries APP_VERSION)',
    sw.includes("var CACHE_NAME = 'dsnboy-shell-v") && sw.includes('THE PAINT LAW'));
  let responded = null;
  const ev = { request: { url: 'https://example.test/', mode: 'navigate', method: 'GET', headers: { get() { return 'text/html'; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', ev);
  check('a cached navigation gets an answer the worker RESPONDS with (no network wait)',
    responded !== null);
  const out = await (responded);
  check('THE ANSWER IS THE CACHED PAGE (the 2.8 MB index.html never blocks first paint on a phone)',
    out === w.CACHED, out && out.tag);
}
{
  const w = makeWorker({ cached: true, networkOk: true });
  let responded = null;
  const ev = { request: { url: 'https://example.test/', mode: 'navigate', method: 'GET', headers: { get() { return 'text/html'; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', ev);
  await (responded);
  await (new Promise((r) => setTimeout(r, 30)));
  check('AND THE NETWORK IS STILL FETCHED BEHIND THE PAINT (the revalidation ran)',
    w.log.fetches.length >= 1, 'fetches=' + w.log.fetches.length);
  check('AND THE FRESH BYTES ARE PUT AWAY FOR THE NEXT LAUNCH (the cache is never left stale forever)',
    w.log.puts.indexOf('NETWORK-PAGE') >= 0, 'puts=' + JSON.stringify(w.log.puts));
}
{
  const w = makeWorker({ cached: false, networkOk: true });
  let responded = null;
  const ev = { request: { url: 'https://example.test/', mode: 'navigate', method: 'GET', headers: { get() { return 'text/html'; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', ev);
  const out = await (responded);
  check('a cache MISS (a fresh install, a right-after-deploy launch) goes to the network as always',
    out === w.NET, out && out.tag);
}
{
  const w = makeWorker({ cached: false, networkOk: false });
  let responded = null;
  const ev = { request: { url: 'https://example.test/', mode: 'navigate', method: 'GET', headers: { get() { return 'text/html'; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', ev);
  const out = await (responded);
  check('offline with no cache falls back to the precached ./index.html - the offline law is intact',
    out === w.CACHED, 'fallback=' + (out && out.tag));
}
{
  const w = makeWorker({ cached: false, networkOk: false });
  let responded = null;
  const mp3 = { request: { url: 'https://example.test/music/01.mp3', mode: 'cors', method: 'GET', headers: { get() { return ''; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', mp3);
  check('the radio .mp3 stays PASS-THROUGH (the game owns dsnboy-radio-v1; the worker does not cache music)',
    responded === null);
  responded = null;
  const glb = { request: { url: 'https://example.test/nyc_truck-compressed.glb', mode: 'cors', method: 'GET', headers: { get() { return ''; } } }, respondWith: (p) => { responded = p; } };
  w.fire('fetch', glb);
  check('the 3D models stay PASS-THROUGH too (the byte-accurate gate owns dsnboy-models-v1)',
    responded === null);
}
console.log('');
console.log('[2] SHELL ASSETS (the cache-first rule the LAUNCH depends on, run live)');
{
  const w = makeWorker({ cached: true, networkOk: true });
  let responded = null;
  w.fire('fetch', { request: { url: 'https://example.test/three_r128.min.js', mode: 'cors', method: 'GET', headers: { get() { return 'text/javascript'; } } }, respondWith: (p) => { responded = p; } });
  const out = await (responded);
  check('a shell script is answered from the CACHE first (three.js costs the launch nothing on a phone)',
    out === w.CACHED, out && out.tag);
  const w2 = makeWorker({ cached: false, networkOk: true });
  let r2 = null;
  w2.fire('fetch', { request: { url: 'https://example.test/three_r128.min.js', mode: 'cors', method: 'GET', headers: { get() { return 'text/javascript'; } } }, respondWith: (p) => { r2 = p; } });
  const out2 = await (r2);
  check('a shell script the cache does not have yet goes to the network and is stored (a fresh install fills up)',
    out2 === w2.NET, 'res=' + (out2 && out2.tag));
  await (new Promise((r) => setTimeout(r, 30)));
  check('and the fill-in PUT it in the versioned shell cache',
    w2.log.puts.indexOf('NETWORK-PAGE') >= 0, 'puts=' + JSON.stringify(w2.log.puts));
}
console.log('');
console.log('[3] THE STORAGE LEASE (index.html asks the browser to keep the caches)');
{
  const A = html.indexOf('var _storagePersist = -1;');
  const B = html.indexOf('// ==================== THE RENDER GOVERNOR');
  const leaseSrc = html.slice(A, B);
  if (!leaseSrc.includes('function requestStoragePersist')) throw new Error('the storage lease block was not found');
  check('the lease is declared with a THREE-state readout (unknown / refused / granted)',
    /var _storagePersist = -1; \/\/ -1 unknown, 0 refused, 1 granted/.test(html) &&
      /_storagePersist === 1 \? "lease" : _storagePersist === 0 \? "best-effort" : "lease\?"/.test(html));
  check('it ASKS for persistence (navigator.storage.persist) and reads the answer (persisted())',
    /if \(typeof st\.persist === "function"\)/.test(html) &&
      /Promise\.resolve\(st\.persist\(\)\)/.test(html) &&
      /if \(typeof st\.persisted === "function"\)/.test(html));
  check('a browser WITHOUT the Storage API is tolerated (iOS has no persist()): the helper returns false, nothing throws',
    /const st = typeof navigator !== "undefined" && navigator\.storage;/.test(html) &&
      /if \(!st\) return false;/.test(html) &&
      /\} catch \(e\) \{\s*\r?\n\s*return false;\s*\r?\n\s*\}/.test(html));
  check('it runs ONCE at boot, next to the perf HUD wiring, and blocks nothing',
    (html.match(/requestStoragePersist\(\);/g) || []).length === 1 &&
      html.includes('requestStoragePersist(); // THE STORAGE PERSIST LEASE'));
  check('the perf line REPORTS the lease (a player can see whether the caches are kept)',
    html.includes('r.tier + " " + storagePersistLabel()'));
  // RUN IT: the promise paths (granted, refused, no API at all)
  const run = (nav) => {
    const ctx = { navigator: nav, Promise };
    vm.runInNewContext(leaseSrc + '\nrequestStoragePersist();', ctx);
    return ctx;
  };
  const granted = run({ storage: { persist: () => Promise.resolve(true), persisted: () => Promise.resolve(true) } });
  await (new Promise((r) => setTimeout(r, 20)));
  const refused = run({ storage: { persist: () => Promise.resolve(false), persisted: () => Promise.resolve(false) } });
  const none = run({});
  const noFn = run({ storage: {} });
  await (new Promise((r) => setTimeout(r, 20)));
  check('granted => the readout says "lease"; refused => "best-effort"; no API at all => "lease?" and no crash',
    vm.runInContext('_storagePersist', granted) === 1 &&
      vm.runInContext('_storagePersist', refused) === 0 &&
      vm.runInContext('_storagePersist', none) === -1 &&
      vm.runInContext('_storagePersist', noFn) === -1,
    'granted=' + vm.runInContext('_storagePersist', granted) +
      ' refused=' + vm.runInContext('_storagePersist', refused) +
      ' none=' + vm.runInContext('_storagePersist', none));
  check('the lease text never claims a dialog (no user prompt is needed, and none is asked for)',
    !/showPersistPrompt|requestPersistPrompt/.test(html));
}
console.log('');
console.log(fail === 0 ? 'PAINT + STORE CHECKS: ALL ' + pass + ' PASSED' : 'PAINT + STORE CHECKS FAILED (' + fail + ')');
process.exit(fail ? 1 : 0);
})();




