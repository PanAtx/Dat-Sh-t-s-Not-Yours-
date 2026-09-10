// End-to-end simulation of the SFX radio lifecycle using the EXACT code from index.html:
// scan (listing + manifest union, deduped) -> play -> ended -> 2s -> next track,
// a single pending-advance slot (an event flood must advance exactly ONCE), and a
// full shuffled rotation (every track airs exactly once before any repeats).
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// --- extract the SFX radio fragment (from 'radioEl: null' through the end of radioSkip) ---
const start = html.indexOf('radioEl: null');
if (start < 0) throw new Error('radio state line not found');
const skipPos = html.indexOf('radioSkip(){', start);
if (skipPos < 0) throw new Error('radioSkip not found');
const end = html.indexOf('\n};', skipPos);
if (end < 0) throw new Error('end of SFX object not found');
const sfxCode = html.slice(start, end);

// --- fakes: fetch serves BOTH a directory listing and a manifest (with one duplicate) ---
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const listing = '<html><body><pre>' + FILES.map(f => '<li><a href="' + encodeURIComponent(f) + '">' + f + '</a>').join('\n') + '</pre></body></html>';

// --- fake Cache API + URL.createObjectURL so the real offline-cache code path is exercised ---
const cacheStore = new Map();
const blobToPath = new Map();  // blob:mock/N -> the music/ path it was created for
const createdBlobs = [];       // every blob URL ever created
const revokedBlobs = new Set();
let _blobSeq = 0;
global.caches = { open: async () => ({
  match: async url => { const v = cacheStore.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { cacheStore.set(url, await resp.blob()); },
  keys: async () => [...cacheStore.keys()],
}) };
global.URL = global.URL || {};
global.URL.createObjectURL = (blob, path) => { const u = 'blob:mock/' + (++_blobSeq); blobToPath.set(u, path || null); createdBlobs.push(u); return u; };
global.URL.revokeObjectURL = (u) => { revokedBlobs.add(u); };
function pathOf(p){
  if (!p) return null;
  let u = p;
  if (u.indexOf('blob:') === 0) u = blobToPath.get(u) || '';
  return decodeURIComponent(u.replace('music/', ''));
}

let mp3NetFetches = 0; // how many times an mp3 was actually pulled over the "network"
global.fetch = async (url) => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES.concat(FILES[0]) }; // dup entry
  if (url.indexOf('music/') === 0) { mp3NetFetches++; return { ok: true, blob: async () => new Blob(['fake-mp3']) }; } // serve the mp3 so it gets cached
  return { ok: false };
};
const played = [];
global.Audio = class {
  constructor(){ this.volume = 0; this.src = ''; this.handlers = {}; }
  addEventListener(ev, fn){ (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  play(){ played.push(this.src); return Promise.resolve(); }
  fire(ev){ (this.handlers[ev] || []).forEach(fn => fn()); }
};

const SFX = new Function('return {' + sfxCode + '};')();
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Poll until cond() is truthy or the timeout elapses. In a real browser the
// Cache/Blob APIs are warm and resolve in <1ms, but on first use in Node they
// trigger a one-time Web-Platform init (~200ms), so a fixed short sleep is not
// enough to let the first track finish resolving.
const waitUntil = (cond, timeoutMs) => new Promise(resolve => {
  const t0 = Date.now();
  const tick = () => {
    let ok = false;
    try { ok = !!cond(); } catch (e) {}
    if (ok) return resolve(true);
    if (Date.now() - t0 >= timeoutMs) return resolve(false);
    setTimeout(tick, 5);
  };
  tick();
});

(async () => {
  const t0 = Date.now();
  SFX.radioStart();
  // The first resolve triggers a one-time Web-Platform init (Response/Blob) that
  // is slow in Node but sub-millisecond in a real browser, so poll instead of a
  // fixed short sleep.
  await waitUntil(() => played.length >= 1, 3000);
  if (played.length !== 1) { console.log('FAIL: first track not started', played); process.exit(1); }
  console.log('track 1:', pathOf(played[0]));
  const N = SFX.radioList.length;
  if (N !== FILES.length) { console.log('FAIL: playlist not the full set', N, 'vs', FILES.length); process.exit(1); }
  console.log('playlist size (deduped union of listing + manifest):', N);
  const netAfterFirst = mp3NetFetches;
  if (netAfterFirst !== 1) { console.log('FAIL: first track should hit the network exactly once (download+cache), got', netAfterFirst); process.exit(1); }
  console.log('first track downloaded from network and stored in cache (OK)');

  // --- single pending-advance slot: an error/error/ended flood must advance exactly ONCE ---
  SFX.radioEl.fire('error');
  SFX.radioEl.fire('error');
  SFX.radioEl.fire('ended');
  await sleep(2050);
  if (played.length !== 2) { console.log('FAIL: event flood caused a double-advance', played); process.exit(1); }
  console.log('event flood (error x2 + ended) -> exactly 1 advance (OK)');

  // --- SKIP cancels any pending advance and plays immediately ---
  SFX.radioEl.fire('ended'); // pending 2s advance
  await sleep(400);
  SFX.radioSkip();
  await sleep(20); // radioNext is async: let the cache/blob resolution settle
  if (played.length !== 3) { console.log('FAIL: skip did not advance immediately', played); process.exit(1); }
  await sleep(2050);
  if (played.length !== 3) { console.log('FAIL: cancelled 2s timer still fired', played); process.exit(1); }
  console.log('SKIP immediate + cancelled stale timer (OK)');

  // --- full bag: every track airs exactly once before any song repeats ---
  let guard = 0;
  while (played.length < N && guard++ < 2 * N){ SFX.radioEl.fire('ended'); await sleep(2050); }
  const names = played.map(pathOf);
  const set = new Set(names);
  const ok = played.length === N && set.size === N
    && SFX.radioList.every(n => set.has(n));
  console.log('full rotation:', played.length + '/' + N + ' unique tracks, order:', played.length + ' songs');
  if (!ok) { console.log('E2E RADIO FAILED'); process.exit(1); }

  // --- offline-cache proof: every track is now in the cache, and a second full
  //     pass serves ALL songs from cache with ZERO network fetches ---
  const cached = await SFX._radioGetCache().then(c => c.keys());
  const cachedSet = new Set([...cached].map(u => decodeURIComponent(u.replace('music/', ''))));
  if (cachedSet.size !== N) { console.log('FAIL: cache should hold all', N, 'tracks, holds', cachedSet.size); process.exit(1); }
  console.log('cache holds all', N, 'tracks (OK)');
  const netBeforePass2 = mp3NetFetches;
  SFX.radioBag = [];               // force a fresh shuffle
  SFX.radioEl.fire('ended');
  let guard2 = 0;
  const startCount = played.length;
  while (played.length < startCount + N && guard2++ < 2 * N){ SFX.radioEl.fire('ended'); await sleep(2050); }
  if (played.length !== startCount + N) { console.log('FAIL: second rotation incomplete', played.length, 'vs', startCount + N); process.exit(1); }
  if (mp3NetFetches !== netBeforePass2) { console.log('FAIL: second rotation hit the network', mp3NetFetches - netBeforePass2, 'times (should be 0)'); process.exit(1); }
  console.log('second full rotation served 100% from cache, 0 network fetches (OK)');

  console.log(ok ? 'E2E RADIO OK (full unique rotation, single-advance slot, offline cache) in ' + (Date.now() - t0) + 'ms' : 'E2E RADIO FAILED');
  process.exit(ok ? 0 : 1);
})();
