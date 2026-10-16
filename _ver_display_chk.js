// THE VERSION NUMBER IS A MAIN-SCREEN-ONLY SIGHT.
//
// Law: the build number shows in ONE place - #app-version, the .menu-version tag pinned
// to the top-left of the logo frame on the main screen - because clicking it is the
// secret TRAINER trigger. The PAUSED overlay, GAME OVER, ROUTE COMPLETE, WEEK COMPLETE
// and the LOADING gate carry NO version number: a shift screen is the street, not a
// build report. (The old .modal-ver footer watermark stamped every panel - removed.)
//
// Static checks on the markup / CSS / boot JS, then the version IIFE is EXECUTED against
// a fake DOM that deliberately contains a .modal-ver element: the proof that the number
// can never leak back into a panel, even if the markup regrows.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
let pass = true;
const check = (name, ok, extra) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  [' + extra + ']'));
  if (!ok) pass = false;
};
const count = (re) => (html.match(re) || []).length;

// ---------- [1] the main screen owns the only version element ----------
const menuVerEls = count(/class="menu-version"/g);
check('exactly ONE .menu-version element in the page', menuVerEls === 1, menuVerEls + ' found');
check('it is id="app-version"', /<div id="app-version" class="menu-version">/.test(html), 'not id=app-version + class=menu-version');
check('it sits inside the #menu panel', html.indexOf('<div id="menu"') < html.indexOf('id="app-version"') && html.indexOf('id="app-version"') < html.indexOf('<div id="paused"'), 'app-version outside #menu');
check('its fallback text is the running APP_VERSION',
  (html.match(/id="app-version"[^>]*>v([\d.]+)</)[1] || '') === (html.match(/const APP_VERSION = '([\d.]+)'/)[1] || ''),
  'fallback HTML disagrees with APP_VERSION');

// ---------- [2] the CSS trigger is intact ----------
const mvCss = (function () { const i = html.indexOf('.menu-version {'); const a = html.indexOf('{', i); let d = 0, j = a; for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) break; } } return html.slice(i, j + 1); })();
check('.menu-version CSS present', mvCss.length > 80, 'rule missing');
check('the version is clickable (the trainer trigger)', /pointer-events:\s*auto/.test(mvCss) && /cursor:\s*pointer/.test(mvCss), 'pointer-events/cursor dropped');
check('the version is wired to openTrainer', /wireTap\(document\.getElementById\("app-version"\),\s*openTrainer\)/.test(html), 'wireTap(app-version, openTrainer) missing');

// ---------- [3] no panel carries a version ----------
check('no .modal-ver element anywhere in the markup', count(/class="modal-ver"/g) === 0, count(/class="modal-ver"/g) + ' element(s) left');
check('no .modal-ver CSS rule left (the watermark is dead)', count(/\.modal-ver\s*\{/g) === 0, count(/\.modal-ver\s*\{/g) + ' rule(s) left');
function region(a, b) { const i = html.indexOf(a); const j = html.indexOf(b, i); return i < 0 || j < 0 ? '' : html.slice(i, j); }
const PANELS = ['#paused', '#over', '#complete', '#week-complete', '#day-intro', '#loading'];
for (const p of PANELS) {
  const open = '<div id="' + p.slice(1) + '"';
  const body = region(open, '</div></div');
  check(p + ' panel carries NO version markup/text',
    body.length > 40 && !/modal-ver|menu-version|APP_VERSION|v\d+\.\d+\.\d+/.test(body),
    body.length ? 'version text found' : 'panel region not found');
}

// ---------- [4] the boot stamp targets ONLY #app-version ----------
check('the version IIFE stamps exactly ["app-version"]', /var vs = \["app-version"\];/.test(html), 'vs list changed');
check('the version IIFE no longer queries .modal-ver', !/querySelectorAll\("\.modal-ver"\)/.test(html), 'it still stamps the panels');
check('#hud-version is the forecast, not a build tag', /id="hud-version">☀ SUNNY · 78°F/.test(html), 'hud-version fallback is not the forecast');
check('nothing writes a version into #hud-version', !/\$\("hud-version"\)\.textContent = t\b/.test(html), 'hud-version is being stamped with the build');

// ---------- [5] LIVE: run the version IIFE against a fake DOM ----------
const iStart = html.indexOf('var t = "v" + APP_VERSION;');
const head = html.lastIndexOf('(function ()', iStart);
let d = 0, end = -1;
for (let j = html.indexOf('{', head); j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) { end = j; break; } } }
const block = html.slice(head, end + 1) + ')();';
const APP_VERSION = (html.match(/const APP_VERSION = '([\d.]+)'/) || [])[1];
const el = (id, cls) => ({ id, cls, textContent: '', get className() { return this.cls; } });
const appVer = el('app-version', 'menu-version');
// a deliberate .modal-ver plant: the IIFE must leave it alone.
const plant = el('plant', 'modal-ver');
const dom = { 'app-version': appVer, plant };
const document = {
  getElementById: (id) => dom[id] || null,
  querySelectorAll: (sel) => (sel === '.modal-ver' ? [plant] : []),
};
let ran = true, err = '';
try { new Function('document', '$', 'APP_VERSION', block)(document, (id) => document.getElementById(id), APP_VERSION); }
catch (e) { ran = false; err = e.message; }
check('the version IIFE runs clean', ran, err);
check('#app-version receives "v" + APP_VERSION', appVer.textContent === 'v' + APP_VERSION, 'got "' + appVer.textContent + '"');
check('a .modal-ver panel element is left untouched (the number cannot leak)', plant.textContent === '', 'plant got "' + plant.textContent + '"');

console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(pass ? 0 : 1);
