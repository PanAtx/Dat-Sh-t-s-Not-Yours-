// Verifies the PWA round-2 additions in index.html / manifest.json / icon set:
//  (1) manifest.json ships a real PNG icon set (any + maskable, 192/512/1024) and
//      every icon exists on disk as a valid PNG of the right size;
//  (2) the <head> favicon + apple-touch-icon point at the new PNGs;
//  (3) the SFX radio fragment exposes radioGetList() + radioCacheTrack() (no 12MB
//      cap) and radioCacheTrack stores then short-circuits on a re-fetch;
//  (4) preloadRadioCache() (the "TRUE OFFLINE" gate phase) downloads EVERY track
//      with a per-track checklist, drives the bar to 100%, and THROWS on a 404;
//  (5) updateCacheBadge() counts models AND music -> "OFFLINE READY" only when
//      both are fully cached, else "CACHING n/N";
//  (6) the beforeinstallprompt / appinstalled / offline / online wiring, the
//      INSTALL GAME button, and the iOS fullscreen nudge are all present.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let pass = true;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));

// ---- (1) manifest icons ----
const man = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const icons = man.icons || [];
check('manifest declares 5 icons', icons.length === 5);
check('all manifest icons are image/png', icons.every(i => i.type === 'image/png'));
check('manifest has any + maskable purposes', icons.some(i => i.purpose === 'any') && icons.some(i => i.purpose === 'maskable'));
for (const want of ['192x192', '512x512', '1024x1024']) check('manifest has an ' + want + ' icon', icons.some(i => i.sizes === want));
function pngInfo(p){
  const b = fs.readFileSync(p);
  const magic = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  if (!magic) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
for (const ic of icons){
  if (!fs.existsSync(ic.src)) { check('icon file exists: ' + ic.src, false); continue; }
  const info = pngInfo(ic.src);
  check('icon is a valid PNG ' + ic.src, !!info);
  if (info){
    const [w, h] = ic.sizes.split('x').map(Number);
    check('icon ' + ic.src + ' is ' + ic.sizes + ' (got ' + info.w + 'x' + info.h + ')', info.w === w && info.h === h);
  }
}
check('apple-touch-icon.png is a valid 180x180 PNG', JSON.stringify(pngInfo('apple-touch-icon.png')) === JSON.stringify({ w: 180, h: 180 }));

// ---- (2) head links ----
check('favicon -> icon-192.png (PNG)', /<link rel="icon" type="image\/png" href="icon-192\.png">/.test(html));
check('apple-touch-icon -> apple-touch-icon.png', /<link rel="apple-touch-icon" href="apple-touch-icon\.png">/.test(html));

// ---- (3) SFX radio helpers - extracted verbatim, run against fake Cache/fetch ----
const start = html.indexOf('radioEl: null');
const skipPos = html.indexOf('radioSkip(){', start);
const end = html.indexOf('\n};', skipPos);
const sfxCode = html.slice(start, end);
check('SFX fragment now includes radioGetList()', sfxCode.indexOf('radioGetList()') >= 0);
check('SFX fragment now includes radioCacheTrack()', sfxCode.indexOf('radioCacheTrack(') >= 0);

const radioStore = new Map();
let netMp3 = 0;
global.caches = { open: async () => ({
  match: async url => (radioStore.has(url) ? new Response('x') : null),
  put: async (url) => { radioStore.set(url, 1); },
  keys: async () => [...radioStore.keys()],
}) };
global.fetch = async url => {
  if (url === 'music/') return { ok: false };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  if (url.indexOf('music/') === 0){ netMp3++; return { ok: true, headers: { get: () => '1000' }, blob: async () => new Blob(['fake-mp3']) }; }
  return { ok: false };
};
const SFX = new Function('return {' + sfxCode + '};')();

// ---- (4) preloadRadioCache - extracted verbatim, run against the real SFX ----

(async () => {
  // (3) radioGetList returns the rotation; radioCacheTrack stores then no-ops
  const list = await SFX.radioGetList();
  check('radioGetList returns the full rotation (' + FILES.length + ')', list.length === FILES.length);
  const first = FILES[0];
  const r1 = await SFX.radioCacheTrack(first);
  check('radioCacheTrack first pass stores the track', r1 === 'stored' && netMp3 === 1);
  const r2 = await SFX.radioCacheTrack(first);
  check('radioCacheTrack re-pass is a cache hit (0 extra fetches)', r2 === 'cached' && netMp3 === 1);

  // (4) run the REAL preloadRadioCache: cold cache -> every track downloaded
  radioStore.clear(); netMp3 = 0;
  SFX.radioList = [];   // force radioGetList to re-scan
  const rowCalls = [];
  const preloadRadio = new Function('SFX', 'ldSetLabel', 'ldSetPct', 'ldBuildRadioList', 'ldRow',
    prCode + '\nreturn preloadRadioCache;')(SFX, () => {}, p => { rowCalls.push(p); }, () => {}, (u, c, t) => rowCalls.push({ u, c, t }));
  await preloadRadio();
  check('preloadRadioCache downloaded every track (' + FILES.length + ')', netMp3 === FILES.length && radioStore.size === FILES.length);
  check('preloadRadioCache drove the bar to 100%', rowCalls.some(x => x === 100));
  const doneRows = rowCalls.filter(x => x && x.c === 'done').length;
  check('preloadRadioCache marked every track done', doneRows === FILES.length);
  // second run: everything cached -> zero network
  const before = netMp3;
  await preloadRadio();
  check('second preloadRadioCache pass is a no-op (0 fetches)', netMp3 === before);
  // failure: one track 404s -> the gate THROWS (so RETRY appears)
  radioStore.clear(); netMp3 = 0; SFX.radioList = [];
  const badName = FILES[3];
  const realFetch = global.fetch;
  global.fetch = async url => { if (url === 'music/' + encodeURIComponent(badName)) return { ok: false, status: 404 }; return realFetch(url); };
  let threw = false;
  try { await preloadRadio(); } catch (e) { threw = /failed to cache/.test(e.message); }
  check('preloadRadioCache THROWS when a track 404s (RETRY path)', threw);
  global.fetch = realFetch;

  // (5) badge counts models + music
  global.document = {};   // the badge functions guard on typeof document; provide a stub
  const bS = html.indexOf('function cacheBadgeSet');
  const bE = html.indexOf('// Phase 1: stream every asset');
  const badgeCode = html.slice(bS, bE);
  const PA = [
    { url: 'truck.fbx', size: 1, label: 'A' }, { url: 'car.glb', size: 1, label: 'B' },
    { url: 'litterReduced2.glb', size: 1, label: 'C' }, { url: 'coffee_shop_cup.glb', size: 1, label: 'D' },
    { url: 'sweet.glb', size: 1, label: 'E' }, { url: 'red_bull.glb', size: 1, label: 'F' },
    { url: 'dsnylogo.jpg', size: 1, label: 'G' }, { url: 'explicit_logo.webp', size: 1, label: 'H' },
  ];
  const modelStore = new Map(); PA.forEach(a => modelStore.set(a.url, 1));
  const radioStore2 = new Map(); FILES.forEach(n => radioStore2.set('music/' + encodeURIComponent(n), 1));
  global.caches = { open: async (name) => (name === 'dsnboy-models-v1'
    ? { match: async u => (modelStore.has(u) ? new Response('x') : null), keys: async () => [...modelStore.keys()] }
    : { match: async u => (radioStore2.has(u) ? new Response('x') : null), keys: async () => [...radioStore2.keys()] }) };
  const el = { textContent: '', _c: new Set(['hidden']), classList: { add(c){ el._c.add(c); }, remove(...cs){ cs.forEach(c => el._c.delete(c)); }, toggle(c, f){ f ? el._c.add(c) : el._c.delete(c); } } };
  const $ = id => (id === 'cachebadge' ? el : null);
  const badge = new Function('$', '_modelGetCache', 'PRELOAD_ASSETS', '_modelMemCache', 'SFX', 'caches',
    badgeCode + '\nreturn { updateCacheBadge };')($, async () => ({ match: async u => (modelStore.has(u) ? new Response('x') : null) }), PA, {}, { radioList: FILES }, global.caches);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  badge.updateCacheBadge(); await sleep(20);
  check('badge says OFFLINE READY when all models + music cached', el.textContent === 'OFFLINE READY' && el._c.has('ready'));
  radioStore2.delete('music/' + encodeURIComponent(FILES[0]));
  el.textContent = ''; el._c = new Set(['hidden']);
  badge.updateCacheBadge(); await sleep(20);
  check('badge says CACHING n/N when a track is missing', /^CACHING \d+\/\d+$/.test(el.textContent) && el._c.has('caching'));

  // (6) install / connection / iOS wiring
  check('beforeinstallprompt handler wired', html.indexOf("window.addEventListener('beforeinstallprompt'") >= 0);
  check('appinstalled handler wired', html.indexOf("window.addEventListener('appinstalled'") >= 0);
  check('offline/online badge handlers wired', html.indexOf("window.addEventListener('offline'") >= 0 && html.indexOf("window.addEventListener('online'") >= 0);
  check('offline pings the badge red', /cacheBadgeSet\('OFFLINE', 'offline'\)/.test(html));
  check('INSTALL GAME button exists in HTML', html.indexOf('id="btnInstall"') >= 0);
  check('INSTALL GAME button is wired in JS', html.indexOf("const btn = $('btnInstall')") >= 0);
  check('iOS fullscreen nudge element exists', html.indexOf('id="iosfs"') >= 0);
  check('iOS nudge is dismissed via a close control', html.indexOf("const x = $('iosfs-x')") >= 0);
  check('_isIos + _isStandalone helpers defined', html.indexOf('function _isIos()') >= 0 && html.indexOf('function _isStandalone()') >= 0);
  check('refreshInstallUi is called when the menu is revealed', /state = 'menu';[\s\S]{0,120}?refreshInstallUi\(\);/.test(html));
  check('refreshInstallUi is called on QUIT (back to menu)', /radioMode\(\);[^\n]*dock the NOW PLAYING bar back into the menu[\s\S]{0,60}?refreshInstallUi\(\);/.test(html));
  check('#cachebadge.offline CSS rule present', /#cachebadge\.offline/.test(html));
  check('#btnInstall CSS rule present', /#btnInstall \{/.test(html));
  check('#iosfs CSS rule present', /#iosfs \{/.test(html));

  console.log(pass ? '\nPWA ROUND-2 ALL CHECKS PASS' : '\nPWA ROUND-2 CHECKS FAILED');
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('PWA ROUND-2 FAILED:', e && e.stack ? e.stack : e); process.exit(1); });

const prs = html.indexOf('async function preloadRadioCache(){');
const pre = html.indexOf('// Per-track checklist', prs);
const prCode = html.slice(prs, pre);
check('preloadRadioCache is defined in index.html', prs >= 0 && prCode.indexOf('radioGetList()') >= 0);
check('preloadRadioCache is wired into the gate (after models)', /await buildModelTemplates\(\);[\s\S]{0,300}?await preloadRadioCache\(\);/.test(html));
