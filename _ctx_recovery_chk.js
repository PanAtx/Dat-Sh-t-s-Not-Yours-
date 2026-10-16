#!/usr/bin/env node
/* ============================================================================
   THE GPU SAFETY NET (v1.0.561) - CONTEXT LOSS, RESTORE, BACKGROUNDING
   ----------------------------------------------------------------------------
   Runs index.html's GPU SAFETY NET block live in a vm sandbox (the same slice the page runs,
   with the canvas / THREE / DOM mocked) and proves:
     1) webglcontextlost is PREVENTED (the browser only offers a restore when asked), the loop
        flag goes up, the mid-shift street AUTO-PAUSES, and the #gpuLost card shows.
     2) webglcontextrestored REBUILDS the renderer on the SAME canvas, re-applies the retro
        buffer + the shadow rows, drops the dead shadow map so three rebuilds it at the
        player's SHADOW_SIZE, re-deploys the TIER LADDER, wipes the governor's clocks (frames
        from a dead context are not evidence), hides the card and clears the flag.
     3) the LOOP gates on the flag (no sim, no draw, no verdicts with no context) - once.
     4) a backgrounded phone comes back to a PAUSED street, and a throttled tab can never
        borrow a lever (the governor's cadence + the ledger's samples are drained).
     5) the card ships hidden, tells the player what happened, and offers the way back.
   Run: node _ctx_recovery_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('var _ctxLost = 0');
const b = src.indexOf('function wireGpuSafetyNet()');
const endMark = '\n      }\n';
const c = src.indexOf(endMark, src.indexOf('return true;', b));
if (a < 0 || b < 0 || c < 0) throw new Error('GPU safety net block not found');
const block = src.slice(a, c + endMark.length);
if (!block.includes('webglcontextrestored')) throw new Error('the restore handler is not in the block');

let pass = 0, fail = 0;
const check = (n, ok, got) => {
  if (ok) { pass++; console.log('PASS  ' + n); }
  else { fail++; console.log('FAIL  ' + n + (got !== undefined ? '  [' + got + ']' : '')); }
};

const els = {};
const made = []; // every element the block creates itself (the #gpuLost card is created on demand)
const mkEl = (id) => (els[id] = els[id] || { id, className: 'hidden', textContent: '', innerHTML: '', _ls: [], addEventListener(ev, fn) { this._ls.push([ev, fn]); }, appendChild() {}, classList: { add(k) { if (this.className.indexOf(k) < 0) this.className += ' ' + k; }, remove(k) { this.className = this.className.replace(k, '').trim(); }, contains(k) { return this.className.indexOf(k) >= 0; } }, });
['paused', 'btnPause', 'vpad'].forEach(mkEl);

// THE CANVAS: an event target the wiring attaches to, so the suite can FIRE the events.
function makeCanvas() {
  return {
    _ls: {},
    addEventListener(ev, fn) { (this._ls[ev] = this._ls[ev] || []).push(fn); },
    fire(ev, arg) { (this._ls[ev] || []).forEach((f) => f(arg || {})); return (this._ls[ev] || []).length; },
  };
}

function makeWorld(o) {
  o = o || {};
  const canvas = makeCanvas();
  const log = { renderSizes: 0, govAdopts: 0, pauses: 0, disposes: 0, made: 0, shadowDrops: 0, perfDrains: 0 };
  let renderer = { domElement: canvas, shadowMap: { enabled: true, type: 0 }, dispose() { log.disposes++; } };
  const ctx = {
    $: (id) => els[id] || made.filter((e) => e.id === id)[0], // the page's $() IS getElementById: an appended card must be findable by id
    document: {
      createElement: () => {
        const el = { id: '', className: '', textContent: '', innerHTML: '', _ls: [], addEventListener(ev, fn) { this._ls.push([ev, fn]); }, appendChild() {} };
        made.push(el);
        return el;
      },
      body: { appendChild() {} },
      addEventListener(ev, fn) { (this._ls = this._ls || {})[ev] = fn; },
      hidden: false,
    },
    window: { location: { reload() { log.reloads = (log.reloads || 0) + 1; } } },
    location: { search: '', reload() { log.reloads = (log.reloads || 0) + 1; } },
    THREE: {
      PCFSoftShadowMap: 2,
      WebGLRenderer: function (p) {
        log.made++;
        log.lastParams = p;
        return { domElement: p && p.canvas ? p.canvas : makeCanvas(), shadowMap: { enabled: false, type: 0 }, dispose() { log.disposes++; } };
      },
    },
    renderer,
    dirLight: { shadow: { mapSize: { set() { log.mapSizes = (log.mapSizes || 0) + 1; } }, map: { dispose() { log.shadowDrops++; } } } },
    SHADOW_SIZE: o.shadow === undefined ? 2048 : o.shadow,
    applyRenderSize() { log.renderSizes++; },
    govAdoptSettings() { log.govAdopts++; },
    perfTakeMedian() { log.perfDrains++; return 0; },
    togglePause() { log.pauses++; ctx.paused = !ctx.paused; },
    state: o.state || 'play',
    paused: !!o.paused,
    _govPrevNow: 1234, _govHi: 7, _govOk: 9, // dirty clocks, to prove they are wiped
  };
  vm.runInNewContext(block, ctx);
  const q = (code) => vm.runInContext(code, ctx);
  q('wireGpuSafetyNet();'); // the boot call index.html makes right after initThree()
  return { ctx, q, canvas, log, card: () => made.filter((e) => e.id === 'gpuLost')[0] };
}
const vm = require('vm');
console.log('');
console.log('[1] THE LOST CONTEXT IS PREVENTED, NAMED AND GATED');
{
  const w = makeWorld({ state: 'play' });
  check('wireGpuSafetyNet attaches the lost + restored handlers on the canvas (the wiring runs at boot)',
    w.canvas.fire('webglcontextrestored', {}) === 1 &&
      w.canvas.fire('webglcontextlost', { preventDefault() { w.log.prevented = true; } }) === 1,
    'handlers=' + Object.keys(w.canvas._ls).join(","));
  check('webglcontextlost PREVENTS THE DEFAULT - the ask that makes the browser fire "restored" at all',
    w.log.prevented === true);
  check('the loop flag goes UP and the loss is counted',
    w.q('_ctxLost') === 1 && w.q('_ctxLosses') === 1, 'ctxLost=' + w.q('_ctxLost') + ' losses=' + w.q('_ctxLosses'));
  check('a live shift AUTO-PAUSES the moment the canvas is taken (the score is not thrown away)',
    w.log.pauses === 1 && w.ctx.paused === true, 'pauses=' + w.log.pauses + ' paused=' + w.ctx.paused);
  check('the #gpuLost card is SHOWN, names what happened and offers the way back',
    w.card().className === '' && /THE STREET LOST ITS GPU/.test(w.card().innerHTML) &&
      /iOS frees GPU memory/.test(w.card().innerHTML) && /REBUILD/.test(w.card().innerHTML),
    w.card().className + ' | ' + (w.card().innerHTML || '').slice(0, 28));
  w.card()._ls.forEach((pair) => { if (pair[0] === "click") pair[1](); });
  check('tapping REBUILD reloads straight back onto the street (the recovery path the card promises)',
    w.log.reloads >= 1, 'reload calls=' + (w.log.reloads || 0));
}
console.log('');
console.log('[2] THE RESTORED CONTEXT GETS A RENDERER, NOT A RELOAD');
{
  const w = makeWorld({ state: 'play', shadow: 1024 });
  w.canvas.fire('webglcontextlost', { preventDefault() {} });
  const before = w.log.made;
  w.q('state = "menu"; paused = false;'); // a menu screen restoring: no pause churn expected
  w.canvas.fire('webglcontextrestored', {});
  check('the restore builds a NEW WebGLRenderer on the SAME canvas (the street graph is plain JS - three re-uploads it)',
    w.log.made === before + 1 && w.log.lastParams && w.log.lastParams.canvas === w.canvas,
    'builds=' + w.log.made + ' reused canvas=' + (w.log.lastParams && w.log.lastParams.canvas === w.canvas));
  check('the old renderer is disposed first (no second GL object alive on the page)',
    w.log.disposes >= 1, 'disposes=' + w.log.disposes);
  check('the retro buffer law (applyRenderSize) re-applies to the fresh context',
    w.log.renderSizes >= 1, 'sizes=' + w.log.renderSizes);
  check('the shadow rows re-apply on the new context - the player LO pick, map size set, dead shadow map dropped',
    w.q('renderer.shadowMap.enabled') === true && w.log.mapSizes >= 1 && w.log.shadowDrops === 1 &&
      w.q('renderer.shadowMap.type') === 2,
    'enabled=' + w.q('renderer.shadowMap.enabled') + ' set=' + w.log.mapSizes + ' dropped=' + w.log.shadowDrops);
  check('THE TIER LADDER RE-DEPLOYS (govAdoptSettings on the new context)',
    w.log.govAdopts >= 1, 'adopts=' + w.log.govAdopts);
  check('the governor clocks are WIPED - frames drawn on a dead context are not evidence about this one',
    w.q('_govPrevNow') === 0 && w.q('_govHi') === 0 && w.q('_govOk') === 0 && w.log.perfDrains >= 1,
    'prev=' + w.q('_govPrevNow') + ' hi=' + w.q('_govHi') + ' ok=' + w.q('_govOk'));
  check('the flag clears and the card hides again - the street is live, no banner left behind',
    w.q('_ctxLost') === 0 && w.card().className === 'hidden' && w.q('_ctxRebuilds') === 1,
    'ctxLost=' + w.q('_ctxLost') + ' card=' + w.card().className);
}
{
  const w = makeWorld({});
  w.canvas.fire('webglcontextrestored', {});
  check('a "restored" with nothing lost rebuilds NOTHING (no renderer churn on a healthy page)',
    w.log.made === 0, 'builds=' + w.log.made);
}
{
  const dark = makeWorld({ shadow: 0 });
  dark.canvas.fire('webglcontextlost', { preventDefault() {} });
  dark.canvas.fire('webglcontextrestored', {});
  check('a player holding the shadow LEVER out (SHADOW_SIZE 0) restores with the shadow pass OFF - the tier, not the default',
    dark.q('renderer.shadowMap.enabled') === false, 'enabled=' + dark.q('renderer.shadowMap.enabled'));
}
console.log('');
console.log('[3] THE LOOP + THE TAB (the gates in the page text, on the real code)');
{
  const loopA = src.indexOf('function loop(now) {');
  const seg = src.slice(loopA, loopA + 900);
  check('the loop gates on the flag (no sim, no draw, no verdicts) - exactly once, straight after the rAF re-arm',
    (src.match(/if \(_ctxLost\) return;/g) || []).length === 1 &&
      seg.indexOf('requestAnimationFrame(loop);') < seg.indexOf('if (_ctxLost) return;'),
    'gates=' + (src.match(/if \(_ctxLost\) return;/g) || []).length);
  check('the net is wired at boot, right where the renderer is built',
    src.includes('initThree();\n      wireGpuSafetyNet();'));
  check('the card ships hidden (nothing on screen until a loss) and its CSS is in the page',
    src.includes('#gpuLost {') && src.includes('#gpuLost.hidden {') && src.includes('#gpuLostBtn {'));
  check('THE BACKGROUND-TAB LAW: a hidden mid-shift phone pauses, and the visible side wipes the governor clocks + drains the ledger',
    block.includes('document.addEventListener("visibilitychange"') &&
      block.includes('typeof state !== "undefined" && state === "play" && !paused && typeof togglePause === "function"') &&
      block.includes('_govPrevNow = 0;') && block.includes('perfTakeMedian()'));
  const w = makeWorld({ state: 'play' });
  w.ctx.document.hidden = true;
  w.ctx.document._ls.visibilitychange();
  check('hidden mid-shift => PAUSED street (returning to a runaway truck in the app switcher is the bug this kills)',
    w.log.pauses === 1 && w.ctx.paused === true, 'pauses=' + w.log.pauses);
  w.ctx.document.hidden = false;
  w.q('_govPrevNow = 999; _govHi = 5; _govOk = 5;');
  w.ctx.document._ls.visibilitychange();
  check('coming back: the governor resets and the stale draw samples are drained (no loan from a throttled tab)',
    w.q('_govPrevNow') === 0 && w.q('_govHi') === 0 && w.q('_govOk') === 0 && w.log.perfDrains >= 1);
  const idle = makeWorld({ state: 'menu' });
  idle.ctx.document.hidden = true;
  idle.ctx.document._ls.visibilitychange();
  check('a MENU tab going away pauses nothing (there is no shift to protect)',
    idle.log.pauses === 0);
}
console.log('');
console.log(fail === 0 ? 'GPU SAFETY NET CHECKS: ALL ' + pass + ' PASSED' : 'GPU SAFETY NET CHECKS FAILED (' + fail + ')');
process.exit(fail ? 1 : 0);


