#!/usr/bin/env node
/* ============================================================================
   THE PIXEL LOAN — THE RETURN LAW, RUN ON THE REAL PAGE CODE (v1.0.555)
   ----------------------------------------------------------------------------
   Runs the index.html SETTINGS BLOCK + THE RENDER GOVERNOR exactly as the page
   runs them (same slice, same order, mock DOM / renderer / localStorage) and
   proves the five laws the slow-phone promise rests on:
     1) THE BOOT LAW — the settings labels ask the governor for its loan state
        long before the governor block runs, so the state is var-declared: the
        page boots with no TDZ crash.
     2) THE LOAN LAW — sustained slow frames walk RENDER_H down the ladder to the
        320P floor and then loan the FRAME CAP 60 -> 30.
     3) THE RETURN LAW — a clean stretch hands EVERYTHING back to the player's own
        SETTINGS pick (540P / 60 FPS), and a NATIVE pick comes back as NATIVE: the
        ladder top is not the goal, the settings row is.
     4) THE TELL LAW — the RENDER / FPS rows carry a loan arrow and the PIXEL LOAN
        note names the way back; both clear themselves with the loan.
     5) THE NO-REWRITE LAW — a loan never touches the settings keys: the player's
        pick is what the game restores, and what it boots from next time.
   Run: node _gov_return_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n'); // LF-normalised: the slices below use \n anchors

const a = src.indexOf('const RES_CYCLE = [540, 720, 0, 320, 240];');
// The slice ends on the BOOT label calls (setFpsLabel / setShadowLabel / setScanLabel / applyCrt):
// in the page the label functions are hoisted, so the early setResLabel() call inside the block
// resolves - the slice has to carry them too.
const b = src.indexOf('\n      applyCrt();\n'); // the standalone boot call, not the button handler's
if (a < 0 || b < 0) throw new Error('settings block anchors not found');
const block = src.slice(a, b + '\n      applyCrt();\n'.length);

const els = {};
function mkEl(id) {
  return (els[id] = els[id] || {
    id, textContent: '', className: '', _ls: [],
    addEventListener(ev, fn) { this._ls.push([ev, fn]); },
    appendChild(c) { this.child = c; },
    classList: { add() {}, remove() {}, contains() { return false; } },
  });
}
['btnRes', 'btnFps', 'btnShadow', 'btnCrt', 'settingsBox', 'scanlines', 'vignette', 'govNote', 'autoLowNote'].forEach(mkEl);
els.govNote.className = 'hidden'; // the page builds the note hidden; setGovNote() is the only thing that shows it
const store = {};
const ctx = {
  $: (id) => els[id] || mkEl(id),
  document: { createElement: (t) => ({ id: '', className: '', textContent: '', appendChild() {} }) },
  localStorage: {
    getItem: (k) => (store[k] === undefined ? null : store[k]),
    setItem: (k, v) => { store[k] = String(v); },
  },
  matchMedia: () => ({ matches: false }),
  navigator: { deviceMemory: 8, hardwareConcurrency: 16 },
  innerWidth: 1920, innerHeight: 1080,
  renderer: { setPixelRatio() {}, setSize() {} },
  dirLight: { shadow: { mapSize: { set() {} }, map: null } },
  state: 'play', paused: false,
};
vm.runInNewContext(block, ctx); // the boot, in page order

let pass = 0, fail = 0;
const check = (n, ok, extra) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (extra != null ? '  [' + extra + ']' : '')); };
const q = (expr) => vm.runInContext(expr, ctx);

check('the block boots in page order with no TDZ / ReferenceError', true);
check('the mouse device keeps 540P / 60 FPS and the rows carry NO loan arrow',
  q('RENDER_H') === 540 && q('FPS_CAP') === 60 &&
    els.btnRes.textContent === '540P' && els.btnFps.textContent === '60',
    els.btnRes.textContent + ' | ' + els.btnFps.textContent);
check('the PIXEL LOAN note starts hidden', els.govNote.className === 'hidden');
check('the governor state is visible to the labels (var, not trapped in a TDZ)', q('_govManaged()') === false);

// THE LOAN: 40ms frames inside a live shift
let now = 0;
for (let i = 0; i < 900; i++) { now += 40; q('mobileGovernorTick(' + now + ')'); }
const loanH = q('RENDER_H'), loanF = q('FPS_CAP');
check('the pixels went down to the 320P floor and the frame cap was loaned to 30',
  loanH === 320 && loanF === 30, loanH + '/' + loanF);
check('THE PLAYER IS TOLD: the rows show a loan arrow and the note names the way back',
  els.btnRes.textContent === '320P \u2193' && els.btnFps.textContent === '30 \u2193' &&
    els.govNote.className === '' && /PIXEL LOAN.*320P for 540P.*30 FPS for 60/.test(els.govNote.textContent),
  els.btnRes.textContent + ' | ' + els.btnFps.textContent + ' | ' + els.govNote.textContent.slice(0, 40));
check('the SETTINGS KEYS still hold the player\'s own pick (the loan never persists)',
  store['dsnysweep_render_h'] === undefined && store['dsnysweep_fps'] === undefined,
  JSON.stringify(store));

// THE RETURN: clean frames
for (let i = 0; i < 3000; i++) { now += 10; q('mobileGovernorTick(' + now + ')'); }
check('the loan is GONE: back on the settings pick, 540P / 60 FPS',
  q('RENDER_H') === 540 && q('FPS_CAP') === 60 && q('_govManaged()') === false,
  q('RENDER_H') + '/' + q('FPS_CAP'));
check('the rows lost their arrows and the note hid itself again',
  els.btnRes.textContent === '540P' && els.btnFps.textContent === '60' && els.govNote.className === 'hidden',
  els.btnRes.textContent + ' | ' + els.btnFps.textContent);

// A HAND-PICKED NATIVE buffer returns to NATIVE, not to a ladder rung
ctx.state = 'menu';
q('RENDER_H = 0; FPS_CAP = 60; govAdoptSettings();');
ctx.state = 'play';
for (let i = 0; i < 900; i++) { now += 40; q('mobileGovernorTick(' + now + ')'); }
for (let i = 0; i < 5000; i++) { now += 10; q('mobileGovernorTick(' + now + ')'); }
check('a NATIVE pick gets NATIVE back (the ladder top is not the goal - the SETTINGS pick is)',
  q('RENDER_H') === 0 && q('FPS_CAP') === 60 && els.btnRes.textContent === 'NATIVE',
  q('RENDER_H') + '/' + els.btnRes.textContent);

console.log('');
console.log(fail === 0 ? 'BOOT PROOF: ALL ' + pass + ' PASSED' : 'BOOT PROOF FAILED (' + fail + ')');
process.exit(fail ? 1 : 0);
