// THE OFFLINE COVERAGE CHECK ("the player can play this game with the internet off").
// ------------------------------------------------------------------------------
// A stale/missing cache entry is invisible until somebody plays offline, so this suite makes
// the offline contract explicit:
//   (1) every 3D model the game loads through getModelUrl() is in the asset gate's
//       PRELOAD_ASSETS list (an asset only fetched on its FIRST USE is never downloaded on a
//       visit that doesn't use it - that is how the Midnight shovel slipped through);
//   (2) every local image the page pulls by URL (<img> art + TextureLoader decals) is covered
//       by the gate (the game's model cache) AND by the service-worker shell precache;
//   (3) every MP3 on disk is in music/manifest.json (the rotation list the offline download
//       walks) - the four midnight-only songs included;
//   (4) the TRAINER MENU's dedicated root-level track is wired into its own cache
//       (dsnboy-trainer-v1), is pulled by the download loop, is counted by the OFFLINE READY
//       badge, and is served from the cache when the network is off (real behaviour test);
//   (5) the shell precaches what the page needs to BOOT offline: three.js (CDN + the local
//       fallback), the GLTF/Draco loaders, the draco wasm, the webfonts (CSS + woff2 binaries),
//       the UI art and the radio track list.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let pass = true;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };
const block = (from, to) => { const s = html.indexOf(from); const e = html.indexOf(to, s); return s < 0 || e < 0 ? '' : html.slice(s, e); };
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

(async () => {
  // ---- (1) every model the game loads is in the asset gate ----
  const paBlock = block('const PRELOAD_ASSETS', 'const PRELOAD_TOTAL');
  check('PRELOAD_ASSETS block found', paBlock.length > 100);
  const modelUrls = [...new Set([...html.matchAll(/getModelUrl\(\s*"([^"]+)"/g)].map(m => m[1]))];
  check('found the model loader calls', modelUrls.length >= 8);
  for (const u of modelUrls) check('gate caches model ' + u, paBlock.includes('"' + u + '"'));
  for (const u of modelUrls) check('model file on disk ' + u, fs.existsSync(path.join(process.cwd(), u)));

  // ---- (2) every local image pulled by URL is cached by the gate AND the shell ----
  const imgRefs = [...new Set([
    ...[...html.matchAll(/TextureLoader\(\)\.load\(\s*(?:offlineImgUrl\("[^"]+"\)\s*\|\|\s*)?"([^"]+\.(?:png|jpg|jpeg|webp))"/g)].map(m => m[1]),
    ...[...html.matchAll(/<img[^>]*\ssrc="([^"]+\.(?:png|jpg|jpeg|webp))"/g)].map(m => m[1]),
  ])];
  check('found the url-loaded images (decals + <img> art)', imgRefs.length >= 4);
  const shellUrls = [...new Set([...sw.matchAll(/['"]\.\/([^'"]+)['"]/g)].map(m => m[1]))];
  for (const u of imgRefs) {
    check('gate caches image ' + u, paBlock.includes('"' + u + '"'));
    check('shell precaches image ' + u, shellUrls.includes(u));
    check('image file on disk ' + u, fs.existsSync(path.join(process.cwd(), u)));
  }
  check('TextureLoader decals prefer the cached bytes', /offlineImgUrl\("kestgak\.png"\)/.test(html) && /offlineImgUrl\("chalkoutline\.png"\)/.test(html));

  // ---- (3) every MP3 on disk is on the rotation list the offline download walks ----
  const musicDir = path.join(process.cwd(), 'music');
  const onDisk = fs.readdirSync(musicDir).filter(f => /\.mp3$/i.test(f)).sort();
  const manifest = JSON.parse(fs.readFileSync(path.join(musicDir, 'manifest.json'), 'utf8'));
  check('every mp3 in music/ is listed in music/manifest.json', onDisk.every(f => manifest.includes(f)));
  check('every manifest entry exists on disk', manifest.every(f => fs.existsSync(path.join(musicDir, f))));
  const nightRaw = ((html.match(/NIGHT_MUSIC_TRACKS = \[([\s\S]*?)\]/) || [])[1] || '').match(/"([^"]+\.mp3)"/g) || [];
  const nightMain = (html.match(/NIGHT_MUSIC_TRACK = "([^"]+\.mp3)"/) || [])[1] || ''; // the lead night theme, declared on its own
  const night = [...new Set([...nightRaw.map(s => s.replace(/"/g, '')), nightMain])];
  check('midnight-only set found (4 songs)', night.length >= 4);
  for (const n of night) check('midnight track is in the rotation list ' + n, manifest.includes(n));
  const bg = block('async function radioBackgroundDownload', 'function refreshRadioSkipUi');
  check('radioBackgroundDownload() caches the WHOLE rotation', bg.includes('rc.radioCacheTrack(name)'));
  check('radioBackgroundDownload() caches the trainer track', bg.includes('rc.trainerCacheTrack()'));

  // ---- (4) THE TRAINER TRACK (a root-level mp3: never in the rotation, never radio-cached) ----
  const trainer = (html.match(/TRAINER_TRACK:\s*"([^"]+)"/) || [])[1] || '';
  check('trainer track constant found', /\.mp3$/i.test(trainer));
  check('trainer track file exists at the repo root', fs.existsSync(path.join(process.cwd(), trainer)));
  check('trainer track is NOT in the rotation (so it needs its own cache)', !manifest.includes(trainer));
  check('its own cache store is declared', /trainerCacheName:\s*"dsnboy-trainer-v1"/.test(html));
  check('cache + store + resolve helpers exist', /async trainerCacheTrack\(\)/.test(html) && /async _trainerGetCache\(\)/.test(html) && /async _trainerResolveSrc\(\)/.test(html));
  check('the hard gate pulls it too (preloadRadioCache)', block('async function preloadRadioCache', 'function ldBuildRadioList').includes('rc.trainerCacheTrack()'));
  check('the OFFLINE READY badge counts it', block('async function _radioCacheStats', 'function updateCacheBadge').includes('trainerCacheName'));
  check('boot warms it (SFX.trainerWarm() in preloadAssets)', block('async function preloadAssets()', '$("btnRetry")').includes('SFX.trainerWarm()'));
  check('trainerPlay() no longer hard-wires the raw network URL', !/el\.src = encodeURI\(this\.TRAINERS?_TRACK\)/.test(html));

  // ---- BEHAVIOUR: the REAL trainer cache code, online then offline ----
  const store = new Map();
  const cachesFake = { open: async (name) => ({
    match: async (u) => (store.has(name + '|' + u) ? new Response(store.get(name + '|' + u)) : null),
    put: async (u, r) => { store.set(name + '|' + u, await r.blob()); },
    keys: async () => [...store.keys()].filter(k => k.startsWith(name + '|')).map(k => ({ url: k.slice(name.length + 1) })),
  }) };
  const net = { mp3: 0, online: true };
  const fetchFake = async (u) => {
    if (/\.mp3$/i.test(u)) {
      if (!net.online) throw new Error('offline');
      net.mp3++;
      return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array(4096)]) };
    }
    return { ok: false, status: 404 };
  };
  global.AbortController = class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } };
  global.window = {}; // SFX.ensure() probes window.AudioContext: absent here, so it returns early
  global.Audio = class { // the <audio> element the trainer track plays through
    constructor() { this.paused = true; this.currentTime = 0; this.src = ''; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener() {}
  };
  const mkUrl = () => ({ createObjectURL: () => 'blob:mock/' + (++mkUrl.n), revokeObjectURL: () => {} });
  mkUrl.n = 0;
  // Only the trainer/radio slice of SFX is exercised: from TRAINER_TRACK to the end of the
  // object literal (the same string-slice + brace-match trick _radio_e2e.js uses).
  const sfxStart = html.indexOf('const SFX = {');
  const sfxEnd = matchBrace(html, sfxStart + 'const SFX = '.length);
  const fragStart = html.indexOf('TRAINER_TRACK:', sfxStart);
  const sfxObj = html.slice(fragStart, sfxEnd);
  const build = (nav) => new Function('caches', 'fetch', 'URL', 'Response', 'navigator',
    'return ({' + sfxObj + '});')(cachesFake, fetchFake, mkUrl(), Response, nav);
  const SFXt = build({ onLine: true });
  const first = await SFXt.trainerCacheTrack();
  check('first trainerCacheTrack() stores the bytes', first === 'stored' && store.size === 1);
  const second = await SFXt.trainerCacheTrack();
  check('second trainerCacheTrack() is a pure cache hit', second === 'cached');
  const warm = await SFXt.trainerWarm();
  check('trainerWarm() pre-points <audio>.src at the cached bytes',
    warm === true && SFXt.trainerSrcSet.indexOf('blob:') === 0 && !!SFXt.trainerEl);
  const playAt = SFXt.trainerSrcSet;
  SFXt.trainerPlay();
  check('trainerPlay() plays the warm blob src (no re-resolve)', SFXt.trainerSrcSet === playAt && SFXt.trainerEl.src === playAt);
  net.online = false;
  const SFXo = build({ onLine: false });
  const srcOff = await SFXo._trainerResolveSrc();
  check('OFFLINE: the cached trainer track resolves to a blob URL', srcOff.src.indexOf('blob:') === 0 && srcOff.fromCache === true);
  check('OFFLINE: the trainer mp3 never touched the network again', net.mp3 === 1);
  const offWarm = await SFXo.trainerWarm();
  check('OFFLINE: trainerWarm() succeeds straight from the cache', offWarm === true && SFXo.trainerSrcSet.indexOf('blob:') === 0);

  // ---- (5) the shell can boot the page offline ----
  check('shell precaches the three.js CDN build', sw.includes("'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'"));
  check('shell precaches the LOCAL three.js fallback', shellUrls.includes('three_r128.min.js'));
  check('index.html falls back to the local three.js', html.includes('three_r128.min.js') && /typeof THREE === "undefined"/.test(html));
  for (const u of ['GLTFLoader.js', 'DRACOLoader.js', 'draco/draco_decoder.wasm', 'draco/draco_wasm_wrapper.js',
    'draco/draco_decoder.js', 'manifest.json', 'music/manifest.json', 'index.html', 'dsnylogo3.jpg', 'explicit_logo.webp', 'mmongo.jpg'])
    check('shell precaches ' + u, shellUrls.includes(u));
  check('shell precaches the PWA icon set', ['icon-192.png', 'icon-512.png', 'dsnyicon.png'].every(u => shellUrls.includes(u)));
  check('webfont CSS is precached via FONT_CSS + the install hook', /var FONT_CSS/.test(sw) && /precacheFonts\(cache\)/.test(sw));
  check('precacheFonts walks the gstatic font binaries out of the CSS', sw.includes('fonts.gstatic.com') && sw.includes('precacheFonts'));
  check('woff2 responses are storable (CACHEABLE font types)', /'font\/woff2'/.test(sw));
  check('the game owns three Cache stores (models / radio / trainer)',
    html.includes('"dsnboy-models-v1"') && html.includes('"dsnboy-radio-v1"') && html.includes('"dsnboy-trainer-v1"'));

  console.log(pass ? '\nOFFLINE COVERAGE ALL CHECKS PASS' : '\nOFFLINE COVERAGE CHECKS FAILED');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('OFFLINE COVERAGE FAILED:', e && e.stack ? e.stack : e); process.exit(1); });


  check('the <img> art is repointed at the cache', /applyOfflineImages\(\);/.test(html) && /function applyOfflineImages\(\)/.test(html));
