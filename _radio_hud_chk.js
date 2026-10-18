// Harness: runs the EXACT radio (SFX methods) + RADIO HUD code from index.html.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const swSrc = fs.readFileSync('sw.js', 'utf8');

// extract SFX radio methods (radioEl... through end of the SFX object) — bounded by
// BRACE-COUNTING (string/comment-aware) because Prettier indented the closing "}"
const sfxObj = html.indexOf('const SFX = {');
if (sfxObj < 0) throw new Error('SFX object not found');
function matchBrace(text, openIdx){
  let depth = 0, i = openIdx, q = null;
  for (; i < text.length; i++){
    const c = text[i];
    if (q){
      if (c === '\\') i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '/' && text[i + 1] === '/'){ i += 2; while (i < text.length && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*'){ i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) return i; }
  }
  return -1;
}
const s = html.indexOf('radioEl: null');
if (s < 0) throw new Error('radio state line not found');
const e = matchBrace(html, sfxObj);
if (e < 0) throw new Error('SFX object end not found');
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
  children: [], parentNode: null,
  appendChild: function(c){ this.children.push(c); if (c) c.parentNode = this; return c; },
  addEventListener: function(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); },
  fire: function(ev){ (this._h[ev] || []).forEach(fn => fn()); } };
  let _html = '';
  // emulate the real DOM: setting innerHTML reparents the text so textContent reflects it
  Object.defineProperty(el, 'innerHTML', {
    get(){ return _html; },
    set(v){ _html = String(v || ''); el.textContent = _html.replace(/<[^>]*>/g, ''); } });
  return el; }
const els = { 'radio': fakeEl(), 'radio-title': fakeEl(), 'btnMute': fakeEl(), 'btnSkip': fakeEl(), 'btnMusic': fakeEl() };
const $ = id => els[id];
const FILES = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
const LO_FILES = JSON.parse(fs.readFileSync('music/lo/manifest.json', 'utf8'));
const mkListing = files => '<html><pre>' + files.map(f => '<li><a href="' + encodeURIComponent(f) + '">' + f + '</a>').join('\n') + '</pre></html>';
const listing = mkListing(FILES);
global.fetch = async url => {
  if (url === 'music/') return { ok: true, text: async () => listing };
  if (url === 'music/manifest.json') return { ok: true, json: async () => FILES };
  if (url === 'music/lo/') return { ok: true, text: async () => mkListing(LO_FILES) };
  if (url === 'music/lo/manifest.json') return { ok: true, json: async () => LO_FILES };
  return { ok: false }; };
const played = [];
global.Audio = class { addEventListener(ev, fn){ (this._h = this._h || {})[ev] = (this._h[ev] || []).concat(fn); }
  play(){ played.push(this.src); return Promise.resolve(); }
  fire(ev){ (this._h[ev] || []).forEach(fn => fn()); } };

// THE TIER MODULE + THE RADIO + HUD, run together exactly as the page runs them: the tier module
// (MUSIC_QUAL / musicDir() / the RADIO row) comes first, then the SFX radio methods, then the HUD
// wiring. A mock localStorage carries the persisted row.
const tierSrc = html.slice(html.indexOf('const MUSIC_QUALS'), html.indexOf('// ==================== PROCEDURAL AUDIO'));
if (!tierSrc.includes('function musicDir()')) throw new Error('the radio tier module was not found');
const store = {};
const hLS = { getItem: k => (store[k] === undefined ? null : store[k]), setItem: (k, v) => { store[k] = String(v); } };
const TIER_BODY = tierSrc + 'const SFX = {' + methods + '};' + '\n' + hud +
  '\nreturn { SFX, radioSetTitle, radioToggleMute, radioMode, musicDir, musicManifestUrl, radioCacheNameFor, btnMusic: $("btnMusic"), get tier() { return MUSIC_QUAL; }, get cacheName() { return SFX.radioCacheName; } };';
// combine real code: SFX radio methods object + HUD wiring
const out = new Function('$', 'localStorage', 'MOBILE_LOW_PROFILE', TIER_BODY)($, hLS, false);
// AN ISOLATED HARNESS for the tier tests: its own mocks, its own device profile / persisted row.
function makeTierHarness(o) {
  o = o || {};
  const hEls = { 'radio': fakeEl(), 'radio-title': fakeEl(), 'btnMute': fakeEl(), 'btnSkip': fakeEl(), 'btnMusic': fakeEl() };
  const h$ = id => hEls[id];
  const hStore = {};
  const hLocalStorage = {
    getItem: k => (hStore[k] === undefined ? null : hStore[k]),
    setItem: (k, v) => { hStore[k] = String(v); },
  };
  if (o.stored) hStore.dsnysweep_music = o.stored;
  const hPlayed = [];
  const Audio = class { addEventListener(ev, fn){ (this._h = this._h || {})[ev] = (this._h[ev] || []).concat(fn); }
    play(){ hPlayed.push(this.src); return Promise.resolve(); }
    fire(ev){ (this._h[ev] || []).forEach(fn => fn()); } };
  const run = new Function('$', 'localStorage', 'MOBILE_LOW_PROFILE', 'Audio', TIER_BODY)(h$, hLocalStorage, !!o.lowProfile, Audio);
  return { run, hEls, hStore, hPlayed };
}
let pass = true;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + n); if (!c) pass = false; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unenc = p => decodeURIComponent(String(p).replace('music/lo/', '').replace('music/', ''));

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
  await sleep(20); // radioNext is async: let the src resolution settle
  check('skip -> 2nd track plays IMMEDIATELY', played.length === 2);
  check('skipped track differs from first', unenc(played[1]) !== t1);
  check('title updated to 2nd song', els['radio-title'].textContent === norm(unenc(played[1])));

  // --- SKIP during the 2s between-song gap: still instant ---
  out.SFX.radioEl.fire('ended');
  await sleep(400);
  check('no auto-next yet during the 2s gap', played.length === 2);
  out.SFX.radioSkip();
  await sleep(20); // radioNext is async: let the src resolution settle
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

  // --- start-screen music player: SAME widget, docked below START SHIFT (where the hi-score was) ---
  check('radioMode() wiring exists', typeof out.radioMode === 'function');
  const dock = els['menu-bottom'] = fakeEl();
  global.state = 'menu';
  out.radioMode();
  check('on the menu the widget DOCKS into the menu bar (below START SHIFT)', els['radio'].parentNode === dock && els['radio'].classList.has('in-menu'));
  out.radioMode();
  check('re-docking is idempotent (no double append)', els['radio'].parentNode === dock && dock.children.length === 1);
  global.state = 'play';
  out.radioMode();
  check('in play the in-menu class is cleared (back to the top-center HUD slot)', !els['radio'].classList.has('in-menu'));
  check('tapping the widget to start music is wired (click handler on #radio)', (els['radio']._h['click'] || []).length >= 1);
  let clickThrew = false;
  try { (els['radio']._h['click'] || [])[0]({ target: { closest: function(){ return null; } } }); } catch (e) { clickThrew = true; }
  check('tapping the widget body is safe and idempotent (no throw, no double-start)', !clickThrew && played.length === 3);

  // --- docked widget: in-game size, visible title, whole bar tappable, pinned to frame bottom ---
  check('menu button styling is scoped to #btnStart (no .menu-bottom button leak onto MUTE/SKIP)', !/\.menu-bottom\s*button/.test(html) && /#btnStart\s*\{/.test(html));
  check('panel button styling is scoped to #btnStart/#btnRestart (radio buttons keep .radio-btn size)', !/\.panel\s*button/.test(html) && /#btnStart,\s*#btnRestart/.test(html));
  check('whole widget bar is a tap target (#radio pointer-events:auto)', /#radio\s*\{[^}]*pointer-events:\s*auto/.test(html));
  check('title has an explicit line-height (dock inherits line-height:0 from .menu-logo-wrap)', /#radio-title\s*\{[^}]*line-height/.test(html));
  check('menu bar pinned to the very bottom of the logo frame', /\.menu-bottom\s*\{[^}]*bottom:\s*0/.test(html));
  let titleThrew = false;
  try { (els['radio']._h['click'] || [])[0]({ target: els['radio-title'] }); } catch (e) { titleThrew = true; }
  check('tapping the song title area tunes in (not just the analyzer)', !titleThrew && played.length === 3);
  let btnThrew = false;
  const btnTarget = { closest: function(sel){ return sel === 'button' ? els['btnMute'] : null; } };
  try { (els['radio']._h['click'] || [])[0]({ target: btnTarget }); } catch (e) { btnThrew = true; }
  check('tapping MUTE is excluded from the tune-in handler (no throw)', !btnThrew && played.length === 3);

  // --- THE RADIO DATA TIER (v1.0.564): the row, the default, the folder and the cache ---
  check('the RADIO row is on the settings page and NAMES the tier + its rate',
    /<button id="btnMusic">/.test(html) && /^HI 128K$/.test(els.btnMusic.textContent));
  check('the station reads the tier folder (HI = music/) and its manifest',
    out.musicDir() === 'music/' && out.musicManifestUrl() === 'music/manifest.json' && out.tier === 'hi');
  check('the HI tier keeps its own cache name, and the LO tier gets its OWN (a switch never re-fetches or evicts the other)',
    out.cacheName === 'dsnboy-radio-v2' && out.radioCacheNameFor('lo') === 'dsnboy-radio-lo-v1');
  {
    const L = makeTierHarness({ lowProfile: true });
    check('a small-device first run boots the station on the LO tier (music/lo/, 48k, its own cache)',
      L.run.tier === 'lo' && L.run.musicDir() === 'music/lo/' && L.run.musicManifestUrl() === 'music/lo/manifest.json' &&
        L.run.cacheName === 'dsnboy-radio-lo-v1' && /^LO 48K$/.test(L.hEls.btnMusic.textContent));
    const click = (L.hEls.btnMusic._h.click || [])[0];
    click();
    check('the row flips LO -> HI, stores its pick under dsnysweep_music, and re-labels the rate',
      L.run.tier === 'hi' && L.hStore.dsnysweep_music === 'hi' && /^HI 128K$/.test(L.hEls.btnMusic.textContent));
    check('the flip asks the station to hop folders (radioRestartTier is the switch, not a reload)',
      typeof L.run.SFX.radioRestartTier === 'function');
    const click2 = (L.hEls.btnMusic._h.click || [])[0];
    click2();
    check('and flipping back is symmetrical (HI -> LO, the key follows, the label follows)',
      L.run.tier === 'lo' && L.hStore.dsnysweep_music === 'lo' && /^LO 48K$/.test(L.hEls.btnMusic.textContent));
    const P = makeTierHarness({ lowProfile: true, stored: 'hi' });
    check('a player who CHOSE HI on a small phone keeps HI (the stored row outranks the profile default)',
      P.run.tier === 'hi' && P.run.musicDir() === 'music/');
    const PL = makeTierHarness({ lowProfile: false, stored: 'lo' });
    check('a player who CHOSE LO on a strong device gets LO (the row is the law in both directions)',
      PL.run.tier === 'lo' && PL.run.musicDir() === 'music/lo/');
  }
  {
    // THE LO FOLDER, ON DISK: the same names, the real files, the half the bytes.
    const hi = FILES, lo = LO_FILES;
    check('the LO manifest carries EXACTLY the rotation names (one playlist, never a forked set)',
      JSON.stringify(lo) === JSON.stringify(hi), lo.length + ' vs ' + hi.length);
    let short = 0, fat = 0, nights = 0;
    hi.forEach((n) => {
      const a = fs.statSync('music/' + n).size;
      const lp = 'music/lo/' + n;
      if (!fs.existsSync(lp)) { short++; return; }
      const b = fs.statSync(lp).size;
      if (b > a * 0.68) fat++; // 48k against the ~183k VBR sources: a file that did not shrink means it was not re-encoded
    });
    const nbStart = html.indexOf('const NIGHT_MUSIC_TRACKS = [');
    const nightBlock = html.slice(nbStart, html.indexOf('];', nbStart));
    const NIGHTS = [...nightBlock.matchAll(/"([^"]+\.mp3)"/g)].map((m) => m[1]);
    // The array names the theme by IDENTIFIER (NIGHT_MUSIC_TRACK), so resolve it from its own line.
    const THEME = (html.match(/const NIGHT_MUSIC_TRACK = "([^"]+\.mp3)"/) || [])[1];
    if (THEME && NIGHTS.indexOf(THEME) < 0) NIGHTS.push(THEME);
    NIGHTS.forEach((n) => { if (fs.existsSync('music/lo/' + n)) nights++; });
    check('every rotation track EXISTS in music/lo/ (0 missing) and every one came out smaller than its source',
      short === 0 && fat === 0, 'missing=' + short + ' not-shrunk=' + fat);
    check('the night set the page locks for MIDNIGHT is complete in the LO tier (a LO phone plays the haunted shift with its music)',
      NIGHTS.length >= 4 && nights === NIGHTS.length, 'night tracks in lo: ' + nights + '/' + NIGHTS.length);
  }
  check('THE SERVICE WORKER KNOWS BOTH TIERS: the LO manifest is precached and served cache-first',
    swSrc.includes("'./music/lo/manifest.json'") && swSrc.includes('MANIFEST_KEY'));
  check('no radio path hard-codes the HI folder any more (scan / manifest / src / cache / identity checks all route through the tier)',
    !/fetch\("music\//.test(html) && !/const url = "music\//.test(html) &&
      !/radioCacheName: "dsnboy-radio-v\d"/.test(html));
  check('the trainer menu track is NOT part of the rotation folder (it stays a root file, in its own cache)',
    html.includes('TRAINER_TRACK: "Romeo Knight - Beat To The Pulp [Remastered].mp3"') &&
      !html.includes('music/Romeo Knight - Beat To The Pulp [Remastered].mp3'));

  console.log(pass ? '\nALL RADIO HUD TESTS PASSED' : '\nSOME TESTS FAILED');
  process.exit(pass ? 0 : 1);
})();