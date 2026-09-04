// Harness: runs the EXACT radio (SFX methods) + RADIO HUD code from index.html.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// extract SFX radio methods (radioEl... through radioSkip)
const s = html.indexOf('radioEl: null');
const e = html.indexOf('};', html.indexOf('radioSkip(){'));
const methods = html.slice(s, e);
// extract the HUD block
const h0 = html.indexOf('const radioBox');
const h1 = html.indexOf('// ==================== END RADIO HUD ====================');
const hud = html.slice(h0, h1);

// ---- fakes ----
function fakeClass(){ const set = new Set(); return {
  add: c => set.add(c), remove: c => set.delete(c),
  toggle: (c, f) => { if (f === undefined){ set.has(c) ? set.delete(c) : set.add(c); } else if (f) set.add(c); else set.delete(c); },
  has: c => set.has(c) }; }
function fakeEl(){ const el = { style:{}, textContent:'', volume:1, src:'', _h:{},
  scrollWidth: 999, clientWidth: 168, // pretend the (fixed) box is too small -> ticker engages
  classList: fakeClass(),
  addEventListener: function(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); },
  fire: function(ev){ (this._h[ev] || []).forEach(fn => fn()); } };
  let _html = '';
  // emulate the real DOM: setting innerHTML reparents the text so textContent reflects it
  Object.defineProperty(el, 'innerHTML', {
    get(){ return _html; },
    set(v){ _html = String(v || ''); el.textContent = _html.replace(/<[^>]*>/g, ''); } });
  return el; }
const els = { 'radio': fakeEl(), 'radio-title': fakeEl(), 'btnMute': fakeEl(), 'btnSkip': fakeEl() };
const $ = id => els[id];
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const listing = '<html><pre>' + FILES.map(f => '<li><a href="' + encodeURIComponent(f) + '">' + f + '</a>').join('\n') + '</pre></html>';
global.fetch = async url => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  return { ok: false }; };
const played = [];
global.Audio = class { addEventListener(ev, fn){ (this._h = this._h || {})[ev] = (this._h[ev] || []).concat(fn); }
  play(){ played.push(this.src); return Promise.resolve(); }
  fire(ev){ (this._h[ev] || []).forEach(fn => fn()); } };

// combine real code: SFX radio methods object + HUD wiring
const out = new Function('$', 'const SFX = {' + methods + '};' + '\n' + hud + '\nreturn { SFX, radioSetTitle, radioToggleMute };')($);
let pass = true;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unenc = p => decodeURIComponent(p.replace('music/', ''));

(async () => {
  // --- start the station ---
  out.SFX.radioStart();
  await sleep(30);
  check('first track started', played.length === 1);
  const t1 = unenc(played[0]);
  const norm = n => n.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  check('title shows first song (no .mp3)', els['radio-title'].textContent === norm(t1));
  check('widget lit (on class)', els['radio'].classList.has('on'));
  check('fixed-size ticker: wide title engages tick class', els['radio'].classList.has('tick'));

  // --- SKIP: next track immediately, title follows ---
  out.SFX.radioSkip();
  check('skip -> 2nd track plays IMMEDIATELY', played.length === 2);
  check('skipped track differs from first', unenc(played[1]) !== t1);
  check('title updated to 2nd song', els['radio-title'].textContent === norm(unenc(played[1])));

  // --- SKIP during the 2s between-song gap: still instant ---
  out.SFX.radioEl.fire('ended');
  await sleep(400);
  check('no auto-next yet during the 2s gap', played.length === 2);
  out.SFX.radioSkip();
  check('skip during gap -> 3rd track plays instantly', played.length === 3);
  check('title updated to 3rd song', els['radio-title'].textContent === norm(unenc(played[2])));

  // --- MUTE / UNMUTE ---
  out.radioToggleMute();
  check('mute -> volume 0', out.SFX.radioEl.volume === 0);
  check('mute -> widget dimmed (muted class)', els['radio'].classList.has('muted'));
  check('mute -> MUTE button state (off class)', els['btnMute'].classList.has('off'));
  out.radioToggleMute();
  check('unmute -> volume back to 0.9', out.SFX.radioEl.volume === 0.9);
  check('unmute -> classes cleared', !els['radio'].classList.has('muted') && !els['btnMute'].classList.has('off'));

  // --- title text cleanup rules ---
  out.radioSetTitle('south_bronx_hauler.mp3');
  check('underscores become spaces', els['radio-title'].textContent === 'south bronx hauler');
  out.radioSetTitle('White Cab Pushin\'');
  check('plain name passes through', els['radio-title'].textContent === 'White Cab Pushin\'');
  out.radioSetTitle('');
  check('empty falls back to ON AIR', els['radio-title'].textContent === 'ON AIR');

  console.log(pass ? '\nALL RADIO HUD TESTS PASSED' : '\nSOME TESTS FAILED');
  process.exit(pass ? 0 : 1);
})();