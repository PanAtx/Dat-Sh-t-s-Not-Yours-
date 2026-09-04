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
global.fetch = async (url) => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES.concat(FILES[0]) }; // dup entry
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

(async () => {
  const t0 = Date.now();
  SFX.radioStart();
  await new Promise(r => setTimeout(r, 30));
  if (played.length !== 1) { console.log('FAIL: first track not started', played); process.exit(1); }
  console.log('track 1:', played[0]);
  const N = SFX.radioList.length;
  if (N !== FILES.length) { console.log('FAIL: playlist not the full set', N, 'vs', FILES.length); process.exit(1); }
  console.log('playlist size (deduped union of listing + manifest):', N);

  // --- single pending-advance slot: an error/error/ended flood must advance exactly ONCE ---
  SFX.radioEl.fire('error');
  SFX.radioEl.fire('error');
  SFX.radioEl.fire('ended');
  await new Promise(r => setTimeout(r, 2050));
  if (played.length !== 2) { console.log('FAIL: event flood caused a double-advance', played); process.exit(1); }
  console.log('event flood (error x2 + ended) -> exactly 1 advance (OK)');

  // --- SKIP cancels any pending advance and plays immediately ---
  SFX.radioEl.fire('ended'); // pending 2s advance
  await new Promise(r => setTimeout(r, 400));
  SFX.radioSkip();
  if (played.length !== 3) { console.log('FAIL: skip did not advance immediately', played); process.exit(1); }
  await new Promise(r => setTimeout(r, 2050));
  if (played.length !== 3) { console.log('FAIL: cancelled 2s timer still fired', played); process.exit(1); }
  console.log('SKIP immediate + cancelled stale timer (OK)');

  // --- full bag: every track airs exactly once before any song repeats ---
  let guard = 0;
  while (played.length < N && guard++ < 2 * N){ SFX.radioEl.fire('ended'); await new Promise(r => setTimeout(r, 2050)); }
  const set = new Set(played);
  const ok = played.length === N && set.size === N
    && SFX.radioList.every(n => set.has('music/' + encodeURIComponent(n)));
  console.log('full rotation:', played.length + '/' + N + ' unique tracks, order:', played.length + ' songs');
  console.log(ok ? 'E2E RADIO OK (full unique rotation, single-advance slot) in ' + (Date.now() - t0) + 'ms' : 'E2E RADIO FAILED');
  process.exit(ok ? 0 : 1);
})();
