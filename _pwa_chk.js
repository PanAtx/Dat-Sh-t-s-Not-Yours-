// Verifies the PWA + offline wiring in index.html / sw.js / manifest.json:
//  (1) manifest.json exists, is valid JSON, and carries the OFFICIAL title
//      "Dat Sh!t's Not Yours!" (so the home-screen entry is named correctly);
//  (2) the SW precaches the shell INCLUDING manifest.json, and its activate
//      handler only deletes stale SHELL caches - the game's model + radio
//      caches (dsnboy-models-v1 / dsnboy-radio-v1) must survive re-activation;
//  (3) index.html links the manifest, sets theme-color, and the <title> is the
//      official title (not "DSNYBoy" and not the apostrophe-less "Sh!ts");
//  (4) the SFX radio fragment (extracted VERBATIM from index.html, exactly like
//      _radio_e2e.js) exposes radioWarm(): it pre-caches the missing rotation
//      tracks into the radio cache, skips already-cached ones (0 network
//      fetches), and aborts the moment the station comes on air.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const checks = [];
function check(name, ok){ checks.push(ok); console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); }

// ---- (1) manifest.json ----
let man = null;
try { man = JSON.parse(fs.readFileSync('manifest.json', 'utf8')); } catch (e) {}
check('manifest.json exists and parses', !!man);
if (man){
  check('official title "Dat Sh!t\'s Not Yours!"', man.name === "Dat Sh!t's Not Yours!");
  check('start_url ./ + fullscreen landscape', man.start_url === './' && man.display === 'fullscreen' && man.orientation === 'landscape');
  check('theme_color matches the game background #0a0d12', man.theme_color === '#0a0d12');
  check('icons reference an existing file', Array.isArray(man.icons) && man.icons.length > 0 && fs.existsSync(man.icons[0].src));
}

// ---- (2) service worker ----
check('SW precaches manifest.json', /SHELL/.test(sw) && sw.indexOf('./manifest.json') >= 0);
check('SW activate keeps game caches (filters dsnboy-shell-v*)', sw.indexOf("k.indexOf('dsnboy-shell-v') === 0") >= 0);
check('SW activate no longer wipes every cache', !/filter\(function \(k\) \{ return k !== CACHE_NAME; \}\)/.test(sw));
check('SW still passes .mp3 / music/ through to the radio cache', sw.indexOf('mp3)$/i') >= 0 && sw.indexOf('/music/') >= 0);

// ---- (3) index.html head ----
check('head links the manifest', /<link rel="manifest" href="manifest\.js?on">/.test(html));
check('head sets theme-color #0a0d12', /<meta name="theme-color" content="#0a0d12">/.test(html));
check('head has a favicon + apple-touch-icon', /<link rel="icon"[^>]*>/.test(html) && /<link rel="apple-touch-icon"[^>]*>/.test(html));
check('<title> is the official title', /<title>Dat Sh!t's Not Yours!<\/title>/.test(html));
check('no apostrophe-less "Sh!ts" title left', html.indexOf('Sh!ts') < 0);
check('offline-music background download is hooked into the menu reveal', /refreshInstallUi\(\);[\s\S]{0,200}?radioBackgroundDownload\(\);/.test(html));

// ---- (4) radioWarm() - extracted verbatim, run against fake Cache/fetch ----
const start = html.indexOf('radioEl: null');
if (start < 0) throw new Error('radio state line not found');
const skipPos = html.indexOf('radioSkip(){', start);
const end = html.indexOf('\n};', skipPos);
if (skipPos < 0 || end < 0) throw new Error('SFX radio fragment not found');
const sfxCode = html.slice(start, end);
check('SFX fragment now includes radioWarm()', sfxCode.indexOf('radioWarm()') >= 0);

const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const store = new Map();
FILES.slice(0, 3).forEach(n => store.set('music/' + encodeURIComponent(n), 'seeded')); // 3 tracks pre-cached
let netFetches = 0;
global.caches = { open: async () => ({
  match: async url => { const v = store.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { store.set(url, 'stored'); },
}) };
global.fetch = async url => {
  if (url === 'music/') return { ok: false };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  if (url.indexOf('music/') === 0){ netFetches++; return { ok: true, headers: { get: () => String(1000 * 1024) }, blob: async () => new Blob(['fake-mp3']) }; }
  return { ok: false };
};
const SFX = new Function('return {' + sfxCode + '};')();
(async () => {
  // warm pass #1: 3 seeded tracks skipped, the rest pulled from the "network"
  await SFX.radioWarm();
  const expectedNet = FILES.length - 3;
  check('radioWarm cached the ' + expectedNet + ' missing tracks (0 fetches for the seeded ones)', netFetches === expectedNet);
  check('radioWarm stored every rotation track in the radio cache', store.size === FILES.length);
  // warm pass #2: everything is cached now -> zero network activity
  const before = netFetches;
  await SFX.radioWarm();
  check('second warm pass is a no-op (0 network fetches)', netFetches === before);
  // abort: the station comes on air -> the warm pass stops immediately
  netFetches = 0;
  SFX.radioEl = {}; // truthy = on air
  store.clear();
  await SFX.radioWarm();
  check('radioWarm aborts the instant the station is on air', netFetches === 0 && store.size === 0);
  SFX.radioEl = null;
  // idempotent: while a pass is in flight, every caller gets the SAME promise
  // and no extra fetch is issued. Hold one blob resolution open so the first
  // pass is still running when the second call comes in.
  SFX.radioEl = null;
  let releaseSlow = null;
  const slowFlag = { v: false };
  global.fetch = async url => {
    if (url === 'music/') return { ok: false };
    if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
    if (url.indexOf('music/') === 0){
      netFetches++;
      const blob = slowFlag.v ? new Promise(res => { releaseSlow = () => res(new Blob(['fake-mp3'])); }) : Promise.resolve(new Blob(['fake-mp3']));
      return { ok: true, headers: { get: () => String(1000 * 1024) }, blob: async () => blob };
    }
    return { ok: false };
  };
  store.clear();
  netFetches = 0;
  slowFlag.v = true;
  const p1 = SFX.radioWarm();
  await new Promise(r => setTimeout(r, 50)); // let the first fetch start, hold it on the slow blob
  const netInFlight = netFetches;
  const p2 = SFX.radioWarm();
  check('overlapping radioWarm() calls share one in-flight run', p2 === p1 && p1 !== undefined);
  check('the second call issued no extra fetch', netFetches === netInFlight);
  releaseSlow();
  await p1;
  slowFlag.v = false;

  const ok = checks.every(Boolean);
  console.log(ok ? 'PWA + RADIO WARM OK (' + checks.length + ' checks)' : 'PWA CHECKS FAILED');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });