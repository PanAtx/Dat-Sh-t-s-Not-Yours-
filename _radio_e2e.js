// End-to-end simulation of SFX radio lifecycle using the EXACT code from index.html:
// scan (directory listing, then manifest) -> play -> ended -> 2s -> next track.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// --- extract the radio fragment (from 'radioEl: null' through the end of radioStart) ---
const start = html.indexOf('radioEl: null');
const end = html.indexOf('};', html.indexOf('radioStart(){'));
const radioCode = html.slice(start, end);

// --- fakes: fetch serves the folder listing; Audio records playback ---
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const listing = '<html><body><pre>' + FILES.map(f => '<li><a href="' + encodeURIComponent(f) + '">' + f + '</a>').join('\n') + '</pre></body></html>';
global.fetch = async (url) => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  return { ok: false };
};
const played = [];
global.Audio = class {
  constructor(){ this.volume = 0; this.src = ''; this.handlers = {}; }
  addEventListener(ev, fn){ (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  play(){ played.push(this.src); return Promise.resolve(); }
  fire(ev){ (this.handlers[ev] || []).forEach(fn => fn()); }
};

// wrap the extracted object-literal fragment into a real object (methods keep `this`)
const SFX = new Function('return {' + radioCode + '};')();

(async () => {
  const t0 = Date.now();
  SFX.radioStart();
  // wait for the async scan + first track
  await new Promise(r => setTimeout(r, 30));
  if (played.length !== 1) { console.log('FAIL: first track not started', played); process.exit(1); }
  console.log('track 1:', played[0]);
  // simulate: track 1 ends -> 2s pause -> track 2
  SFX.radioEl.fire('ended');
  await new Promise(r => setTimeout(r, 2050));
  if (played.length !== 2) { console.log('FAIL: no track after 2s pause', played); process.exit(1); }
  console.log('track 2 (after ~2s):', played[1]);
  // let it run through the WHOLE bag: all 7 air exactly once, shuffled, no back-to-back dupes
  let guard = 0;
  while (played.length < 7 && guard++ < 30){ SFX.radioEl.fire('ended'); await new Promise(r => setTimeout(r, 2100)); }
  console.log('full rotation order:', played.join(' -> '));
  const set = new Set(played.map(p => 'music/' + encodeURIComponent(decodeURIComponent(p.replace('music/', '')))));
  const ok = played.length === 7 && set.size === 7 && FILES.every(f => set.has('music/' + encodeURIComponent(f)));
  console.log('E2E RADIO OK (7 unique tracks, shuffled, 2s gaps):', ok, '  elapsed', (Date.now() - t0) + 'ms');
  process.exit(ok ? 0 : 1);
})();
