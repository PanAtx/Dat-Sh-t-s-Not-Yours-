// End-to-end simulation of the SFX radio lifecycle using the EXACT code from index.html:
// scan (listing + manifest union, deduped) -> play -> ended -> 2s -> next track,
// a single pending-advance slot (an event flood must advance exactly ONCE), and a
// full shuffled rotation (every track airs exactly once before any repeats).
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// --- extract the SFX radio fragment from 'radioEl: null' to the end of the SFX object, using
//     BRACE COUNTING that is string/comment-aware (the shipped file is Prettier-formatted, so a
//     plain indexOf('};') lands on the wrong brace) ---
const start = html.indexOf('radioEl: null');
if (start < 0) throw new Error('radio state line not found');
function matchBrace(text, openIdx) {
  let depth = 0, i = openIdx, q = null;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '/' && text[i + 1] === '/') { i += 2; while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
const sfxObj = html.indexOf('const SFX = {');
if (sfxObj < 0) throw new Error('SFX object not found');
const end = matchBrace(html, sfxObj);
if (end < 0) throw new Error('end of SFX object not found');
const sfxCode = html.slice(start, end);
if (sfxCode.indexOf('radioSkip') < 0) throw new Error('radioSkip not in the fragment');


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

// the MIDNIGHT-ONLY SET, taken from the shipped constants (never hardcoded in the harness)
const nightBlockM = html.match(/const NIGHT_MUSIC_TRACKS = (\[[\s\S]*?\]);/);
const themeM = html.match(/const NIGHT_MUSIC_TRACK = "([^"]+)"/);
if (!nightBlockM || !themeM) { console.log('FAIL: NIGHT_MUSIC_TRACKS not found in index.html'); process.exit(1); }
const NIGHT = new Function('const NIGHT_MUSIC_TRACK = ' + JSON.stringify(themeM[1]) + '; return ' + nightBlockM[1] + ';')();
if (!Array.isArray(NIGHT) || NIGHT.length < 2) { console.log('FAIL: the night set is not a list of tracks', NIGHT); process.exit(1); }
// the radio fragment resolves NIGHT_MUSIC_TRACKS off the global scope, exactly as the game does
global.NIGHT_MUSIC_TRACK = themeM[1];
global.NIGHT_MUSIC_TRACKS = NIGHT;
console.log('midnight-only set (' + NIGHT.length + '):', NIGHT.join(' | '));

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

  // --- WEEKDAY ROTATION: every weekday song airs exactly once, and NO midnight song ever
  //     appears (the night set is locked out of the weekday bag by construction) ---
  const WEEK_N = N - NIGHT.length;
  let guard = 0;
  // the 2s gap path is proven above by the event-flood check; fill the rotation with SKIP (instant)
  while (new Set(played.map(pathOf)).size < WEEK_N && guard++ < 4 * N) { SFX.radioSkip(); await sleep(30); }
  const names = played.map(pathOf);
  const set = new Set(names);
  const nightLeaked = names.filter(n => NIGHT.indexOf(n) >= 0);
  const weekOk = set.size === WEEK_N && nightLeaked.length === 0 &&
    SFX.radioList.filter(n => NIGHT.indexOf(n) < 0).every(n => set.has(n));
  console.log('weekday rotation:', set.size + '/' + WEEK_N + ' unique songs, midnight songs aired:', nightLeaked.length);
  if (!weekOk) { console.log('E2E RADIO FAILED (weekday rotation)', nightLeaked); process.exit(1); }

  // --- riding the SKIP button through a second weekday pass must STILL never surface a night song
  let guardB = 0;
  const beforeB = played.length;
  while (played.length < beforeB + WEEK_N && guardB++ < 4 * N) { SFX.radioSkip(); await sleep(30); }
  const leakB = played.slice(beforeB).map(pathOf).filter(n => NIGHT.indexOf(n) >= 0);
  console.log('second weekday pass on SKIP:', new Set(played.slice(beforeB).map(pathOf)).size, 'unique, midnight leaks:', leakB.length);
  if (leakB.length) { console.log('E2E RADIO FAILED (a midnight song reached a weekday shift)', leakB); process.exit(1); }

  // --- THE HAUNTED SHIFT: lock onto the night set and the station rotates THAT set only.
  //     The snapshot is taken BEFORE the lock fires, because radioSticky() itself plays the
  //     first locked song straight away. ---
  const nightStart = played.length;
  SFX.radioSticky(NIGHT);
  await sleep(60);
  let guard2 = 0;
  while (played.length < nightStart + NIGHT.length && guard2++ < 4 * NIGHT.length) { SFX.radioSkip(); await sleep(30); }
  const nightAired = played.slice(nightStart).map(pathOf);

  const nightSet = new Set(nightAired);
  const nightOk = nightAired.length === NIGHT.length && nightSet.size === NIGHT.length &&
    NIGHT.every(n => nightSet.has(n));
  console.log('night shift:', nightAired.length + '/' + NIGHT.length + ' unique midnight songs:', nightAired.join(' | '));
  if (!nightOk) { console.log('E2E RADIO FAILED (the night bag did not rotate the full midnight set)', nightAired); process.exit(1); }

  // --- RELEASE: a weekday street hands the station back and the midnight songs go silent ---
  SFX.radioSticky(null);
  await sleep(40);
  const relStart = played.length;
  SFX.radioSkip();
  await sleep(30);
  const relSong = pathOf(played[played.length - 1]);
  if (played.length === relStart || NIGHT.indexOf(relSong) >= 0) { console.log('E2E RADIO FAILED (release did not return to a weekday song)', relSong); process.exit(1); }
  console.log('release -> back on a weekday song:', relSong);

  // --- OFFLINE CACHE PROOF: the whole shelf (weekday + midnight) is cached, and a later
  //     weekday rotation touches the network ZERO times ---
  const cached = await SFX._radioGetCache().then(c => c.keys());
  const cachedSet = new Set([...cached].map(u => decodeURIComponent(u.replace('music/', ''))));
  if (cachedSet.size !== N) { console.log('FAIL: cache should hold all', N, 'tracks, holds', cachedSet.size); process.exit(1); }
  console.log('cache holds all', N, 'tracks (OK)');
  const netBefore = mp3NetFetches;
  SFX.radioBag = [];                 // force a fresh shuffle
  SFX.radioEl.fire('ended');
  const startCount = played.length;
  let guard3 = 0;
  while (new Set(played.slice(startCount).map(pathOf)).size < WEEK_N && guard3++ < 4 * N) { SFX.radioSkip(); await sleep(30); }
  if (mp3NetFetches !== netBefore) { console.log('FAIL: cached rotation hit the network', mp3NetFetches - netBefore, 'times (should be 0)'); process.exit(1); }
  console.log('a later weekday rotation served 100% from cache, 0 network fetches (OK)');

  console.log('E2E RADIO OK (weekdays exclude the midnight set, the night shift rotates its own set, release works, offline cache clean) in ' + (Date.now() - t0) + 'ms');
  process.exit(0);
})();
