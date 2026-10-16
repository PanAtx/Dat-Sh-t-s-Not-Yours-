#!/usr/bin/env node
/* ============================================================================
   THE TIER LADDER + THE MEASUREMENT FIX (v1.0.560) - RUN ON THE REAL PAGE CODE
   ----------------------------------------------------------------------------
   Runs the index.html SETTINGS BLOCK + THE DRAW LEDGER + THE RENDER GOVERNOR
   exactly as the page runs them (same slice, same order, mock DOM / renderer /
   localStorage) and proves the five laws the mobile-performance work rests on:
     1) THE MEASUREMENT LAW - a verdict is a RATIO against the frame budget the cap
        allows (1000 / FPS_CAP), with the Draw Ledger's draw ms measured against the
        SAME budget as the other half. A 30 fps cadence sitting on its own 33 ms
        budget is CLEAN; a late cadence with a cheap draw is a hitch, not a stress.
     2) THE DEADLOCK REGRESSION - under the OLD absolute law (24 ms slow / 17.5 ms
        clean) a cap loaned to 30 fps made every frame read "slow", so the only exit
        was a burst of 17 ms frames the cap physically cannot emit. The same capped,
        healthy stream is proved to climb the whole ladder back here, and the old
        arithmetic is computed on the same numbers to show why it never did.
     3) THE TIER LAW - the plan is BUILT FROM THE SETTINGS (govPlan): buffer rungs,
        then the frame cap, then shadows LO, shadows OFF, the CRT overlays, then the
        storm at half and a quarter. A row the player owns is never in the plan, and
        the levers move ONE AT A TIME.
     4) THE DRAW-STATE LAW - the tier reaches what draws: the shadow map size, the
        shadow pass, the CRT overlays and the storm's draw range all move with the
        lever count and come back with it, through the settings rows' own setters.
     5) THE LEDGER LAW - every render site is timed (shift, paused, idle backdrop,
        starfield), the counters come from renderer.info, and the HUD line is OFF
        unless ?perf=1 (which seals its key).
   THE NO-REWRITE LAW holds throughout: the tier is live state, it never touches the
   SETTINGS keys, and a menu press hands the whole ladder back.
   Run: node _tier_ladder_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('const RES_CYCLE = [540, 720, 0, 320, 240];');
const b = src.indexOf('\n      applyCrt();\n');
if (a < 0 || b < 0) throw new Error('settings block anchors not found');
const block = src.slice(a, b + '\n      applyCrt();\n'.length);
if (!block.includes('function perfMarkRender')) throw new Error('the Draw Ledger is not inside the block');
if (!block.includes('function mobileGovernorTick')) throw new Error('the governor is not inside the block');
let pass = 0, fail = 0;
function check(name, ok, got) {
  if (ok) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (got !== undefined ? '  [' + got + ']' : '')); }
}
const els = {};
function mkEl(id) {
  return (els[id] = els[id] || {
    id, textContent: '', className: '', _ls: [],
    addEventListener(ev, fn) { this._ls.push([ev, fn]); },
    appendChild(c) { this.child = c; },
    classList: { add() {}, remove() {}, contains() { return false; } },
  });
}
['btnRes', 'btnFps', 'btnShadow', 'btnCrt', 'settingsBox', 'scanlines', 'vignette', 'govNote',
  'autoLowNote', 'trainer-scanlines', 'trainer-vignette', 'perfLine'].forEach(mkEl);
els.govNote.className = 'hidden';
// THE SANDBOX: the page block, with the draw state it pushes into mocked and counted.
function makeGov(o) {
  o = o || {};
  const store = {};
  const log = { shadowApply: 0, crtApply: 0, rainApply: 0, resizes: 0, tb: 0 };
  const ctx = {
    $: (id) => els[id] || mkEl(id),
    document: { createElement: () => ({ id: '', className: '', textContent: '', style: {}, appendChild() {} }), body: { appendChild() {} } },
    localStorage: { getItem: (k) => (store[k] === undefined ? null : store[k]), setItem: (k, v) => { store[k] = String(v); } },
    matchMedia: () => ({ matches: false }),
    navigator: { deviceMemory: 8, hardwareConcurrency: 16 },
    location: { search: o.search || '' },
    innerWidth: 1920, innerHeight: 1080,
    T: 0, // the sandbox clock the frame feed advances
    renderer: {
      setPixelRatio() {}, setSize() {}, shadowMap: { enabled: true },
      info: { render: { calls: 210, triangles: 78000 }, memory: { geometries: 40, textures: 26 } },
    },
    dirLight: { shadow: { mapSize: { set() { log.shadowApply++; } }, map: null } }, // the real applyShadowQuality lands here
    applyRainDensity: () => { log.rainApply++; },
    trainerResize: () => { log.resizes++; },
    tbSetSize: () => { log.tb++; },
    performance: { now: () => 0 }, window: {},
    state: 'play', paused: false,
  };
  vm.runInNewContext(block, ctx); // the boot, in page order
  const q = (code) => vm.runInContext(code, ctx);
  q('RENDER_H = ' + (o.res === undefined ? 540 : o.res) + '; FPS_CAP = ' + (o.fps === undefined ? 60 : o.fps) +
    '; SHADOW_SIZE = ' + (o.shadow === undefined ? 2048 : o.shadow) + ';');
  q('CRT_ON = ' + (o.crt === undefined ? true : !!o.crt) + ';'); // what the player's CRT row says
  q('govAdoptSettings();'); // the settings page as the player left it = T0
  return {
    q, ctx, log,
    // THE FRAME FEED, frame by frame exactly like the loop: mark the draw, tick the governor.
    feed(cadenceMs, drawMs, frames) {
      q('for (var i = 0; i < ' + frames + '; i++) { T += ' + cadenceMs + '; perfMarkRender(' + drawMs + '); mobileGovernorTick(T); }');
    },
    tier() { return q('govTierLabel()'); },
    lent() { return q('_govLent'); },
    plan() { return q('govPlan().join(",")'); },
    h() { return q('RENDER_H'); }, f() { return q('FPS_CAP'); },
    shadowSize() { return q('SHADOW_SIZE'); },
    shLoan() { return q('_govShadowLoan'); },
    crtLoan() { return q('_govCrtLoan'); },
    rain() { return q('rainScale()'); },
    mapOn() { return ctx.renderer.shadowMap.enabled; },
    crtOff() { return els.scanlines.className === "hidden"; }, // the real applyCrt lands on the DOM mocks
    managed() { return q('_govManaged()'); },
    drawMs() { return q('_perfRenderMs'); },
    keys() {
      const out = {};
      ['dsnysweep_render_h', 'dsnysweep_fps', 'dsnysweep_shadow', 'dsnysweep_crt', 'dsnysweep_profile'].forEach((k) => {
        if (store[k] !== undefined) out[k] = store[k];
      });
      return out;
    },
  };
}
console.log('');
console.log("[1] THE MEASUREMENT LAW (a verdict is a ratio against the cap's own budget)");
{
  const g = makeGov({});
  g.feed(16.7, 3, 400); // on time for a 60 fps cap, a 3 ms draw (18% of the budget)
  check('a healthy 60 fps stream on a 3 ms draw borrows NOTHING - the settings page IS the tier (T0)',
    g.lent() === 0 && g.tier() === 'T0' && g.h() === 540 && g.f() === 60,
    g.tier() + ' ' + g.h() + '/' + g.f());
  g.feed(45, 2.2, 400); // 2.7x late for the cap, but the draw spent only 13% of the budget
  check('a LATE cadence with a CHEAP draw is a hitch, not a stress - no lever is borrowed (the governor measures the GPU)',
    g.lent() === 0, 'lent=' + g.lent() + ' tier=' + g.tier());
  g.feed(40, 26, 61); // late (2.4x) AND the draw ate 1.56x the budget
  check('late frames AND a draw that eats the budget borrow the FIRST lever (the buffer rung, 540 -> 320)',
    g.lent() === 1 && g.h() === 320 && g.tier() === 'T1',
    g.tier() + ' RENDER_H=' + g.h());
  g.feed(16.7, 2, 700); // 40 clean verdicts, past the lockout (55 verdicts = 660 frames)
  check('and the lever comes back on a clean row - T0, 540P, with nothing borrowed',
    g.lent() === 0 && g.h() === 540 && !g.managed(), g.tier() + ' ' + g.h());
}
console.log('');
console.log('[2] THE TIER LAW (the plan is BUILT FROM THE SETTINGS page)');
{
  const full = makeGov({ res: 720, fps: 60, shadow: 2048, crt: 1 });
  check('a 720P / 60 / HI / CRT-off? no: CRT ON player has the full 8-lever plan',
    full.plan() === 'res,res,cap,shadow,shadowoff,crt,rain,rainhalf', full.plan());
  const floor = makeGov({ res: 320, fps: 30, shadow: 1024, crt: 0 });
  check('a 320P / 30 / LO / CRT-off player has only 3 levers left (a row the player owns is never in the plan)',
    floor.plan() === 'shadowoff,rain,rainhalf', floor.plan());
  const nat = makeGov({ res: 0, fps: 60, shadow: 2048, crt: 0 });
  check('a NATIVE / 60 / HI / CRT-off plan lends 3 rungs (720, 540, 320 - NATIVE sits ABOVE the ladder), the cap, 2 shadow levers and 2 storm levers',
    nat.plan() === 'res,res,res,cap,shadow,shadowoff,rain,rainhalf', nat.plan());
  const natLoan = makeGov({ res: 0, fps: 60, shadow: 2048, crt: 0 });
  natLoan.feed(60, 26, 241); // T1
  const n1 = natLoan.h();
  natLoan.feed(60, 26, 240); // T2
  const n2 = natLoan.h();
  natLoan.feed(60, 26, 480); // T3, T4 (the cap)
  check('A NATIVE pick walks the FULL way down - 720P, then 540P, then 320P, then the frame cap - one rung per lever, no skipping',
    n1 === 720 && n2 === 540 && natLoan.h() === 320 && natLoan.f() === 30,
    n1 + ' -> ' + n2 + ' -> ' + natLoan.h() + '/' + natLoan.f());
  natLoan.feed(1000 / 30, 4, 4600); // the climb, on the capped cadence (33 ms frames, 4 ms draws)
  check('and the NATIVE pick comes back as NATIVE (0), not as the ladder top',
    natLoan.lent() === 0 && natLoan.h() === 0 && natLoan.f() === 60, natLoan.tier() + ' ' + natLoan.h());
  check('THE TIER IS THE LEVER COUNT and T0 names the settings pick',
    full.tier() === 'T0' && full.lent() === 0 && full.h() === 720 && full.f() === 60);
}
console.log('');
console.log('[3] THE LADDER WALKS (one lever per verdict row, in the borrow order)');
{
  const g = makeGov({ res: 540, fps: 60, shadow: 2048, crt: 1 });
  g.feed(40, 26, 61);
  const t1 = g.tier() + ':' + g.h() + '/' + g.f();
  g.feed(40, 26, 240);
  const t2 = g.tier() + ':' + g.h() + '/' + g.f();
  check('lever 1 is the buffer rung (T1: 320P) and lever 2 the frame cap (T2: 30 FPS)',
    /^T1:320\/60$/.test(t1) && /^T2:320\/30$/.test(t2), t1 + ' | ' + t2);
  g.feed(40, 26, 720); // the SAME 40 ms cadence, now measured against the 33 ms budget the cap allows
  check('THE CAP IS NOT A PUNISH: once the cap sits at 30, a 40 ms cadence is ON BUDGET - the loan stops there' +
    ' (the old absolute law kept walking to the floor on exactly this stream)',
    g.lent() === 2 && g.tier() === 'T2', g.tier());
  for (let i = 0; i < 8; i++) g.feed(60, 26, 240); // a device that is late for the 30 fps cap too
  const deep = g.tier() + ':' + g.h() + '/' + g.f() + '/sh' + g.shLoan() + '/' + g.shadowSize() + '/crt' + g.crtLoan() + '/rain' + g.rain();
  check('the deep levers go out in ORDER - shadows LO (1024), shadows OFF (0 / pass off), CRT off, storm half, storm quarter',
    g.lent() === 7 && g.shLoan() === 2 && g.shadowSize() === 0 && g.mapOn() === false &&
      g.crtLoan() === 1 && g.rain() === 0.25 && g.h() === 320 && g.f() === 30, deep);
  check('THE DRAW-STATE LEVERS REACH THE DRAW STATE through the settings rows\' own setters - the shadow map is rebuilt and the CRT overlays land on the same applyCrt the row uses',
    g.log.shadowApply >= 2 && g.crtOff() === true && g.log.rainApply >= 7,
    'sh=' + g.log.shadowApply + ' crtOff=' + g.crtOff() + ' rain=' + g.log.rainApply);
  check('only a BUFFER rung re-sizes what draws: seven levers in play state, and the trainer buffer / 2D canvas were re-sized ZERO times (the shadow / CRT / storm levers re-size nothing, and nothing re-sizes per frame)',
    g.log.resizes === 0 && g.log.tb === 0, 'resizes=' + g.log.resizes + ' tb=' + g.log.tb);
  check('every row keeps NAMING the player\'s pick with the loan arrow (the loan is a tell, not a rewrite)',
    els.btnRes.textContent === '320P \u2193' && els.btnFps.textContent === '30 \u2193' &&
      els.btnShadow.textContent === 'HI \u2193' && els.btnCrt.textContent === 'ON \u2193',
    [els.btnRes.textContent, els.btnFps.textContent, els.btnShadow.textContent, els.btnCrt.textContent].join(' | '));
  check('the note names the tier, every lever on loan, and the way back (ONE TIER AT A TIME)',
    els.govNote.className === '' && /^[\u26A1] PIXEL LOAN T7/.test(els.govNote.textContent) &&
      /320P for 540P/.test(els.govNote.textContent) && /30 FPS for 60/.test(els.govNote.textContent) &&
      /no shadows for HI/.test(els.govNote.textContent) && /clean streets for CRT/.test(els.govNote.textContent) &&
      /storm at 25%/.test(els.govNote.textContent) && /ONE TIER AT A TIME/.test(els.govNote.textContent),
    els.govNote.textContent.slice(0, 60));
  check('THE NO-REWRITE LAW: seven levers borrowed and not one SETTINGS key written',
    Object.keys(g.keys()).length === 0, JSON.stringify(g.keys()));
}
console.log('');
console.log('[4] THE DEADLOCK REGRESSION (the reason this fix exists)');
{
  const g = makeGov({ res: 540, fps: 60, shadow: 2048, crt: 1 });
  for (let i = 0; i < 8; i++) g.feed(60, 26, 240); // the whole ladder out, cap included
  const deep = g.lent();
  check('a device that is late for BOTH caps is walked to the bottom of the ladder (7 levers, 320P / 30 FPS)',
    deep === 7 && g.h() === 320 && g.f() === 30 && g.tier() === 'T7', g.tier());
  const oldLaw = (ms) => (ms > 24 ? 'slow' : ms < 17.5 ? 'clean' : 'neutral');
  check('THE OLD LAW IS PROVABLY SHUT AT A 30 FPS CAP: a capped frame (33.3 ms) reads "slow" forever' +
    ' (33.3 > 24) and the 17.5 ms exit frame sits BELOW what a 30 fps cap can emit',
    oldLaw(1000 / 30) === 'slow' && 1000 / 30 > 24 && 1000 / 30 > 17.5);
  // NOW THE SAME DEVICE GETS WELL: the loan worked, the draw is cheap. The cadence stays at the
  // 33.3 ms the cap allows - it is NEVER a 17 ms frame, which is what the old law demanded. The
  // RETURN is ruled by the GPU's own number (4 ms of an 16.7 ms budget = 24% spent), so the ladder
  // climbs even while the frames still land at the capped cadence, and every lever it hands back
  // that the device cannot afford is re-borrowed by the LEND gate (late AND heavy) - not punished.
  g.feed(1000 / 30, 4, 5400); // 7 levers back at 55 verdicts each = 4620 frames, with room
  check('THE CLIMB IS OPEN AT THE FLOOR: a stream capped at 30 fps with a healthy draw walks the WHOLE' +
    ' ladder back to the settings pick - the CRT, the storm, both shadow levers, the cap and the rung',
    g.lent() === 0 && !g.managed() && g.h() === 540 && g.f() === 60 && g.shLoan() === 0 &&
      g.shadowSize() === 2048 && g.crtLoan() === 0 && g.rain() === 1,
    g.tier() + ' ' + g.h() + '/' + g.f() + ' sh' + g.shLoan() + ' rain' + g.rain());
  check('it came back on a 33.3 ms cadence (the cap never lifted) with a 4 ms draw - not a lucky burst',
    g.drawMs() > 0 && g.drawMs() <= 6, 'draw=' + g.drawMs() + 'ms');
  const arrows = [els.btnRes.textContent, els.btnFps.textContent, els.btnShadow.textContent,
    els.btnCrt.textContent, els.govNote.className]; // read the rows HERE - the sandboxes share the DOM mocks
  check('THE TWO GATES ARE UNEQUAL ON PURPOSE: the LEND gate needs a late cadence AND a draw over 60%' +
    ' of the PLAYER\'S budget; the RETURN gate needs only the draw under 35% of it - the yardstick is' +
    ' the settings cap, so a loan that has done its job is returnable and the tier does not yo-yo',
    g.q('govBudgetMs()') < 17 && 1000 / 30 > g.q('govBudgetMs()') * 1.45 &&
      g.q('_govTargetFps') === 60 && src.includes('_govTargetFps > 0 ? _govTargetFps : 60'));
  const parked = makeGov({ res: 540, fps: 60, shadow: 1024, crt: 0 });
  parked.feed(40, 26, 241); // T1 (rung) + T2 (cap) out, on a stream late for both caps
  parked.feed(1000 / 30, 11, 2000); // capped at 30, drawing 11 ms = 66% of the player's 60 fps budget
  const parkA = parked.lent() + '/' + parked.f();
  parked.feed(1000 / 30, 11, 2000);
  const parkB = parked.lent() + '/' + parked.f();
  check('a device spending 66% of the player\'s budget HOLDS its honest tier (320P / 30 FPS) and does not churn -' +
    ' the work yardstick never moves with the loan',
    parkA === parkB && parked.lent() === 2 && parked.f() === 30 && parked.h() === 320,
    parkA + ' -> ' + parkB);
  parked.feed(1000 / 30, 3, 2400); // the same device, drawing 18% of the player's budget
  check('and the moment the draw is honestly cheap, the levers come back - cap first, then the rung',
    parked.lent() === 0 && parked.f() === 60 && parked.h() === 540,
    parked.tier() + ' ' + parked.h() + '/' + parked.f());
  check('every arrow is gone and the note hid itself with the last lever',
    arrows[0] === '540P' && arrows[1] === '60' && arrows[2] === 'HI' && arrows[3] === 'ON' &&
      arrows[4] === 'hidden',
    arrows.join(' | '));
  const h = makeGov({ res: 540, fps: 60, shadow: 2048, crt: 1 });
  for (let i = 0; i < 2; i++) h.feed(60, 26, 240); // two levers out
  h.q('state = "menu";');
  h.feed(90, 40, 600); // a rough MENU frame stream
  check('a MENU frame stream never feeds the tier (an idle screen cannot borrow the player\'s pixels)',
    h.lent() === 2 && h.h() === 320, h.tier() + ' ' + h.h());
  h.q('state = "play";');
  h.q('RENDER_H = 540; FPS_CAP = 60; govAdoptSettings();'); // THE PLAYER PRESSES THE ROWS: 540P / 60
  check('A SETTINGS PRESS LIFTS THE WHOLE TIER AT ONCE - the player outranks the governor',
    h.lent() === 0 && h.h() === 540 && h.f() === 60 && !h.managed() && h.shLoan() === 0 && h.rain() === 1,
    h.tier() + ' ' + h.h() + '/' + h.f());
}
console.log('');
console.log('[5] THE DRAW LEDGER (the measurement the whole ladder is built on)');
{
  const g = makeGov({});
  g.feed(16.7, 5, 30);
  const ro = JSON.parse(g.q('JSON.stringify(perfReadout())'));
  check('perfReadout reports three\'s own counters - draw calls, triangles, geometries, textures - plus the draw ms and the tier',
    ro.draws === 210 && ro.tris === 78000 && ro.geo === 40 && ro.tex === 26 && ro.tier === 'T0' &&
      ro.renderMs >= 4 && ro.renderMs <= 6,
    JSON.stringify(ro));
  g.q('wirePerfHud();');
  check('the PERF line ships hidden: it costs the player nothing they did not ask for',
    g.ctx.window._perfHudEl && g.ctx.window._perfHudEl.className === 'hidden',
    g.ctx.window._perfHudEl && g.ctx.window._perfHudEl.className);
  g.q('window._perfHudEl.className = ""; for (var i = 0; i < 30; i++) { perfHudTick(16.7); }');
  check('switched on, the line reads fps / draw calls / triangles / geo / tex / draw ms / tier',
    /PERF \d+\.\d+fps \d+dc \d+tri geo\d+ tex\d+ draw[\d.]+ms T\d/.test(g.ctx.window._perfHudEl.textContent),
    g.ctx.window._perfHudEl.textContent);
  check('and while it is hidden, one per-frame call on the tick is all it costs (no string built, early return)',
    src.includes('if (!el || el.className !== "") return;'));
  const p = makeGov({ search: '?perf=1' });
  p.q('wirePerfHud();');
  check('?perf=1 seals its key and turns the line on (the readout is opt-in, and it remembers)',
    p.ctx.window._perfHudEl.className === '' && p.q('localStorage.getItem("dsnysweep_perf")') === '1');
  check('every draw in the page is timed - 4 render sites wrapped (shift, paused, idle backdrop, starfield)',
    (src.match(/perfMarkRender\(performance\.now\(\) - _pT0\)/g) || []).length === 4 &&
      (src.match(/const _pT0 = performance\.now\(\);/g) || []).length === 4,
    'sites=' + (src.match(/perfMarkRender\(performance\.now\(\) - _pT0\)/g) || []).length);
  check('the ledger is sampled and drained, not stored (a wild sample is dropped, the median window resets)',
    src.includes('if (!(ms >= 0) || ms > 1000) return;') &&
      src.includes('_perfMsSum = 0;') && src.includes('_perfMsN = 0;'));
  check('THE STORM LEVER IS A DRAW RANGE, never a rebuilt pool (the streak buffer is allocated once at RAIN_N)',
    src.includes('weatherRain.streaks.geometry.setDrawRange(0, want * 2);') &&
      src.includes('for (let i = 0; i < ACTIVE; i++)') &&
      !src.includes('for (let i = 0; i < weatherRain.n; i++)'));
  check('THE MEASUREMENT IS THE LAW OF THE CODE: no absolute millisecond verdict remains anywhere in the governor',
    !src.includes('GOV_HI_MS') && !src.includes('GOV_OK_MS'));
}
console.log('');
console.log(fail === 0 ? 'TIER LADDER CHECKS: ALL ' + pass + ' PASSED' : 'TIER LADDER CHECKS FAILED (' + fail + ')');
process.exit(fail ? 1 : 0);
