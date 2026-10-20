// _radio_ds4_chk.js - THE DUALSHOCK 4 MEDIA-INTERRUPTION LAW.
// iPadOS reports a DualShock 4 as a Bluetooth media REMOTE: its buttons are hardware KEY
// events and media keys INTERRUPT web audio - the station went off air mid-shift and every
// play() was rejected: the OLD code advanced the bag on each rejection, tearing through the
// rotation ("music kept skipping songs as if it couldn't read them"), and a finger tap on
// SKIP "fixed" it (a tap = the user gesture iOS waits for). This suite runs the REAL SFX
// radio fragment and proves the NEW law:
//   1) a play() REJECTION re-cues the SAME song - the bag is never consumed by a block;
//   2) an UNREQUESTED pause while on air (the interruption) blocks the same way;
//   3) radioGestureRecover() brings the CURRENT song back and the playing() event unlocks;
//   4) a pause WE asked for (tier hop / trainer) is NOT treated as an interruption.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const check = (n, c, extra) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (extra ? '  [' + extra + ']' : '')); if (!c) process.exitCode = 1; };

// ---- static: the shipped code carries the new law ----
check('play() rejection routes to _radioBlocked (no skip cascade)',
  /p\.catch\(\(\) => this\._radioBlocked\(\)\)/.test(html));
check('the station watches unrequested pauses (media interruption)',
  /addEventListener\("pause"/.test(html));
check('every player gesture recovers the locked song',
  /\["keydown", "pointerdown", "touchstart"\]\.forEach/.test(html) &&
  /SFX\.radioGestureRecover/.test(html));

// ---- extract the SFX radio fragment + the tier module (same brace-count as _radio_e2e) ----
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
const s = html.indexOf('radioEl: null');
const e = matchBrace(html, sfxObj);
if (sfxObj < 0 || s < 0 || e < 0) { console.log('FAIL: radio fragment not found'); process.exit(1); }
const methods = html.slice(s, e);
const tierSrc = html.slice(html.indexOf('const MUSIC_QUALS'), html.indexOf('// ==================== PROCEDURAL AUDIO'));

// ---- fakes: Cache API, fetch, Audio with a REJECTABLE play() ----
global._bs = 0;
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const listing = '<html><pre>' + FILES.map(f => '<li><a href="' + encodeURIComponent(f) + '">' + f + '</a>').join('\n') + '</pre></html>';
const cacheStore = new Map();
global.caches = { open: async () => ({
  match: async url => { const v = cacheStore.get(url); return v ? new Response(v) : null; },
  put: async (url, resp) => { cacheStore.set(url, await resp.blob()); },
  keys: async () => [...cacheStore.keys()],
}) };
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'blob:mock/' + (++global._bs);
global.URL.revokeObjectURL = () => {};
global.fetch = async (url) => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  if (url.indexOf('music/') === 0) return { ok: true, blob: async () => new Blob(['fake-mp3']) };
  return { ok: false };
};
const played = [];
global.Audio = class {
  constructor() { this.src = ''; this._h = {}; this._reject = false; }
  addEventListener(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); }
  fire(ev) { (this._h[ev] || []).forEach(fn => fn()); }
  play() { played.push({ el: this, src: this.src }); return this._reject ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); }
};
global.NIGHT_MUSIC_TRACK = ''; global.NIGHT_MUSIC_TRACKS = [];
const $ = () => ({ textContent: '', className: '', style: {}, classList: { add() {}, remove() {} }, addEventListener() {} });
const store = {};
const LS = { getItem: k => (store[k] === undefined ? null : store[k]), setItem: (k, v) => { store[k] = String(v); } };
const SFX = new Function('$', 'localStorage', 'MOBILE_LOW_PROFILE',
  tierSrc + 'return {' + methods + '};')($, LS, false);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // --- on air, healthy ---
  SFX.radioStart();
  for (let t = 0; t < 60 && played.length < 1; t++) await sleep(25);
  const el = SFX.radioEl;
  check('first track started', played.length === 1);
  el.fire('playing'); // the song is genuinely on air
  check('the station is not locked while healthy', SFX._radioLock !== true);

  // --- interruption: autoplay lock flips ON, play() rejects, the bag must SURVIVE ---
  el._reject = true;
  const bagBefore = SFX.radioBag.length;
  SFX.radioSkip(); // advance to a new song - its play() gets rejected (locked)
  await sleep(40);
  const cur1 = SFX.radioEl.src; // the CURRENT song, assigned by the skip
  check('the rejection marks the station gesture-locked', SFX._radioLock === true);
  const bagAtBlock = SFX.radioBag.length;
  await sleep(1300); // the requeue timer fires: re-cue the SAME song, never advance
  check('a block never consumes the bag (no skip cascade)', SFX.radioBag.length === bagAtBlock, bagBefore + ' -> ' + bagAtBlock + ' -> ' + SFX.radioBag.length);
  check('the re-queue re-plays the SAME song', SFX.radioEl.src === cur1, cur1 + ' vs ' + SFX.radioEl.src);

  // --- a player gesture brings the CURRENT song back (the "tap fixed it" cure) ---
  el._reject = false; // the gesture is the user activation iOS needs
  SFX.radioGestureRecover();
  await sleep(20);
  el.fire('playing'); // the SAME song is audible again
  check('gesture recovery re-plays the same song', played.filter(p => p.src === cur1).length >= 2, 'attempts on ' + cur1 + ': ' + played.filter(p => p.src === cur1).length);
  check('the song back on air clears the lock', SFX._radioLock === false);

  // --- an UNREQUESTED pause mid-song = interruption = re-cue, no advance ---
  const bagNow = SFX.radioBag.length;
  el.fire('pause'); // iOS media-remote key interrupting live playback
  check('an unrequested pause marks the lock (no bag burn)', SFX._radioLock === true && SFX.radioBag.length === bagNow);
  el.fire('playing');

  // --- a pause WE asked for is NOT an interruption ---
  SFX._radioPlayingByUs = true;
  el.fire('pause');
  check('an intentional pause stays healthy (no lock)', SFX._radioLock === false);

  console.log(process.exitCode ? 'DS4 RADIO CHECK FAILED' : 'DS4 RADIO CHECK: ALL CHECKS PASS');
})();