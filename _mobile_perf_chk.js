#!/usr/bin/env node
/* ============================================================================
   THE MOBILE BUDGET SUITE (v1.0.540)
   ----------------------------------------------------------------------------
   Proves the three mobile laws the Midnight challenge work is built on:
     1) THE LOW PROFILE — a coarse-pointer, low-memory FIRST RUN self-picks
        320P / LO shadows / 30 fps, seals its keys, tells the player, and a
        CHOSEN key always wins (the auto pass runs once, ever).
     2) THE RENDER GOVERNOR — sustained slow verdicts step RENDER_H one rung down
        the biggest-first ladder (720 -> 540 -> 320; 320P is the phone floor, 240P is
        menu-only) and, once the pixels bottom out, loan the FRAME CAP 60 -> 30. A clean
        stretch HANDS IT ALL BACK: the cap first, then every rung, up to the NATIVE pick —
        REPEATABLY, and only ever as far as what the SETTINGS PAGE says. The governor is a
        temporary loan of pixels: it never writes a settings key, and a menu press
        re-baselines the target. The tick runs ONLY inside a live shift; consts stay
        declared once.
     3) THE FX TIER — the boss's slime rates and the rebound's knit storm run
        at ~half on LOW; the heart window and the shovel's parry tail widen
        15% on LOW and stay byte-identical on FULL (the desktop law the night
        suites assert); the governor is the ONLY new per-frame loop cost.
   The profile block and the governor run LIVE in vm sandboxes, like the
   layout suites run the street.
   Run: node _mobile_perf_chk.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  const ok = !!cond;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '  [' + extra + ']' : ''));
  ok ? pass++ : fail++;
}
function extractFn(text, name) {
  const i = text.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (i < 0) throw new Error('function not found: ' + name);
  let depth = 0, j = text.indexOf('{', i);
  for (; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (depth === 0) break; }
  }
  return text.slice(i, j + 1);
}

console.log('[1] THE LOW PROFILE — detection law, defaults, seal');
{
  check('the detection exists with the mobile signals (coarse pointer, deviceMemory, cores)',
    src.includes('matchMedia("(pointer: coarse)")') &&
      src.includes('navigator.deviceMemory') && src.includes('navigator.hardwareConcurrency'));
  check('a CHOSEN key always wins (every stored key is checked before the auto picks)',
    src.includes('!(parseInt(localStorage.getItem(PROFILE_KEYS.res), 10) >= 0)') &&
      src.includes('!(parseInt(localStorage.getItem(PROFILE_KEYS.shadow), 10) >= 0)') &&
      src.includes('!(parseInt(localStorage.getItem(PROFILE_KEYS.fps), 10) >= 0)'));
  check('the verdict is sealed once (the profile key exits the auto pass forever)',
    src.includes('!localStorage.getItem(PROFILE_KEYS.profile)') &&
      src.includes('localStorage.setItem(PROFILE_KEYS.profile, "low")'));
  check('the LOW defaults are the phone trio: 320 / 1024 / 30',
    src.includes(': MOBILE_LOW_PROFILE ? 320 : 540') &&
      src.includes(': MOBILE_LOW_PROFILE ? 1024 : 2048') &&
      src.includes(': MOBILE_LOW_PROFILE ? 30 : 60'));
  check('the stored-key reads stay SINGLE (no duplicated settings state)',
    (src.match(/RES_CYCLE\.includes\(_storedRes\)/g) || []).length === 1 &&
      (src.match(/SHADOW_SIZES\.includes\(_storedShadow\)/g) || []).length === 1 &&
      (src.match(/FPS_CAPS\.includes\(_storedFps\)/g) || []).length === 1);
  check('the player is TOLD on the settings page why the phone self-picked',
    src.includes('SMALL DEVICE MODE') && src.includes('$("settingsBox").appendChild'));
  check('the settings consts stay declared EXACTLY once (no duplicate state)',
    (src.match(/const RES_CYCLE/g) || []).length === 1 &&
      (src.match(/const FPS_CAPS/g) || []).length === 1 &&
      (src.match(/const SHADOW_SIZES/g) || []).length === 1 &&
      (src.match(/let MOBILE_LOW_PROFILE/g) || []).length === 1);
}

function mkStore() {
  return {
    _m: {},
    getItem(k) { return this._m[k] === undefined ? null : this._m[k]; },
    setItem(k, v) { this._m[k] = String(v); },
  };
}
function runProfile(store, globals) {
  const s0 = src.indexOf('// ==================== THE MOBILE PROFILE');
  const s1 = src.indexOf('function applyRenderSize()');
  const i0 = src.indexOf('const SHADOW_SIZES');
  const i1 = src.indexOf('function applyShadowQuality');
  const i2 = src.indexOf('const FPS_CAPS');
  const i3 = src.indexOf('let lastRenderT');
  if (s0 < 0 || s1 < 0 || i0 < 0 || i2 < 0) throw new Error('profile block anchors not found');
  const RES_CYCLE_SRC = "const RES_CYCLE = [540, 720, 0, 320, 240];\n";
  const code =
    RES_CYCLE_SRC + src.slice(s0, s1) + '\n' + src.slice(i0, i1) + '\n' + src.slice(i2, src.indexOf('// ==================== THE RENDER GOVERNOR')) +
    '\nreturn { MOBILE_LOW_PROFILE, RENDER_H, SHADOW_SIZE, FPS_CAP };';
  const ctx = Object.assign({ localStorage: store }, globals);
  return vm.runInNewContext("var __profile = (function () {" + code + "})(); __profile;", ctx);
}
console.log('');
console.log('[2] THE PROFILE BLOCK, RUN LIVE (mock device, mock localStorage)');
{
  const store = mkStore();
  const out = runProfile(store, {
    matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }),
    navigator: { deviceMemory: 4, hardwareConcurrency: 4 },
  });
  check('a coarse-pointer 4GB/4-core FIRST RUN self-picks 320 / 1024 / 30',
    out.MOBILE_LOW_PROFILE === true && out.RENDER_H === 320 && out.SHADOW_SIZE === 1024 && out.FPS_CAP === 30,
    out.RENDER_H + '/' + out.SHADOW_SIZE + '/' + out.FPS_CAP);
  check('the verdict seals itself into the keys + the profile stamp',
    store._m['dsnysweep_render_h'] === '320' && store._m['dsnysweep_shadow'] === '1024' &&
      store._m['dsnysweep_fps'] === '30' && store._m['dsnysweep_profile'] === 'low',
    JSON.stringify(store._m));
  const store2 = mkStore();
  store2.setItem('dsnysweep_render_h', '720'); // the player chose 720P
  const out2 = runProfile(store2, {
    matchMedia: () => ({ matches: true }),
    navigator: { deviceMemory: 4, hardwareConcurrency: 4 },
  });
  check('a CHOSEN 720P wins on the very same small phone (no key is rewritten, nothing is sealed)',
    out2.MOBILE_LOW_PROFILE === false && out2.RENDER_H === 720 && out2.SHADOW_SIZE === 2048 &&
      out2.FPS_CAP === 60 && store2._m['dsnysweep_render_h'] === '720' &&
      store2.getItem('dsnysweep_profile') === null,
    out2.RENDER_H + '/' + out2.SHADOW_SIZE + '/' + out2.FPS_CAP);
  const out3 = runProfile(mkStore(), {
    matchMedia: () => ({ matches: false }), // a mouse device
    navigator: { deviceMemory: 8, hardwareConcurrency: 16 },
  });
  check('a mouse device with a beefy spec keeps the shipped 540 / 2048 / 60',
    out3.MOBILE_LOW_PROFILE === false && out3.RENDER_H === 540 && out3.SHADOW_SIZE === 2048 && out3.FPS_CAP === 60);
}

console.log('');
console.log('[3] THE GOVERNOR, RUN LIVE (driven frame times, mock renderer)');
const govConsts = src.slice(
  src.indexOf('var _govMsSum'),
  src.indexOf('function mobileGovernorTick'),
);
const govTick = extractFn(src, 'mobileGovernorTick');
if (govConsts.length < 200 || !govTick.includes('GOV_HI_VERDICTS')) throw new Error('governor block not found');
function makeGov(startH, opt) {
  opt = opt || {};
  // THE GOVERNOR SANDBOX: a mock renderer plus the SETTINGS values the loan is measured against.
  // opt.fps is what the player's FPS row says; adopt(h, f) IS the menu press (the RENDER / FPS
  // buttons), which re-baselines the target exactly the way index.html wires govAdoptSettings.
  const make = new Function(
    'RES_CYCLE', 'startH', 'startFps', 'stateIn', 'pausedIn', 'renderer',
    'applyRenderSize', 'setResLabel', 'setFpsLabel',
    'var state = stateIn, paused = pausedIn, RENDER_H = startH, FPS_CAP = startFps;' +
      govConsts + govTick +
      '\nvar _feed = 0; return {' +
      ' feed(ms){ _feed += ms; mobileGovernorTick(_feed); },' +
      ' getH(){ return RENDER_H; }, drops(){ return _govDrops; },' +
      ' getFps(){ return FPS_CAP; }, fpsDrops(){ return _govFpsDrops; },' +
      ' natLoan(){ return _govNatDropped; }, managed(){ return _govManaged(); },' +
      ' targetH(){ return _govTargetRes; }, targetFps(){ return _govTargetFps; },' +
      ' adopt(h, f){ RENDER_H = h; FPS_CAP = f; govAdoptSettings(); } };',
  );
  const st = { applied: 0, fpsLabelled: 0 };
  const api = make(
    [540, 720, 0, 320, 240], startH, opt.fps === undefined ? 60 : opt.fps,
    opt.state || 'play', !!opt.paused,
    { __r: 1 },
    () => { st.applied++; },
    () => {},
    () => { st.fpsLabelled++; },
  );
  return { api, st };
}
// THE VERDICT ARITHMETIC the tests below are timed against: a VERDICT is 12 frames, a loan step
// costs 5 slow verdicts then a 15-verdict lockout, and a climb step costs 40 clean verdicts then
// the same lockout. So ~2 s of rough frames lends a rung, ~8 s of clean frames hands one back.
const SLOW = 40, CLEAN = 10;
function feed(g, ms, n) { for (let i = 0; i < n; i++) g.api.feed(ms); }
{
  const g = makeGov(540);
  feed(g, SLOW, 75); // a drop needs 5 verdicts = 60 frames
  check('sustained slow frames (40ms) step 540P DOWN exactly one rung, and applyRenderSize ran',
    g.api.getH() === 320 && g.api.drops() === 1 && g.st.applied === 1,
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops() + ' applied=' + g.st.applied);
  check('the SETTINGS rows are never rewritten by a loan - the governor owns live state only',
    g.api.targetH() === 540 && g.api.targetFps() === 60,
    'target=' + g.api.targetH() + '/' + g.api.targetFps());
}
{
  const g = makeGov(320);
  feed(g, SLOW, 120); // 10 slow verdicts at the floor
  check('at the phone floor 320P the governor NEVER steps to 240P (ATARI stays a menu-only choice)',
    g.api.getH() === 320 && g.api.drops() === 0 && g.st.applied === 0,
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops());
  check('THE FLOOR TAKES THE FRAME CAP, NOT MORE PIXELS: at 320P a slow row loans the cap 60 -> 30' +
    ' (fxTier() halves the boss storm) while the buffer stays exactly where the player put it',
    g.api.getFps() === 30 && g.api.fpsDrops() === 1 && g.api.managed(),
    'FPS_CAP=' + g.api.getFps());
}
{
  const nat = makeGov(0); // the SETTINGS pick is NATIVE
  feed(nat, SLOW, 820); // v5 ->720P, v24 ->540P, v44 ->320P, v64 -> the frame-cap loan
  check('a NATIVE buffer that cannot keep up walks DOWN the whole ladder (720 -> 540 -> 320)' +
    ' and then borrows the frame cap as well',
    nat.api.getH() === 320 && nat.api.drops() === 2 && nat.api.natLoan() === 1 &&
      nat.api.getFps() === 30 && nat.api.fpsDrops() === 1,
    'RENDER_H=' + nat.api.getH() + ' drops=' + nat.api.drops() + ' fps=' + nat.api.getFps());
  feed(nat, CLEAN, 4200); // the full climb: cap, 320 -> 540 -> 720, then NATIVE
  check('THE RETURN LAW: a clean stretch climbs the WHOLE way back - the frame cap, every rung,' +
    ' and the NATIVE pick itself (no half-recovery, no "once ever")',
    nat.api.getH() === 0 && nat.api.getFps() === 60 && nat.api.drops() === 0 &&
      nat.api.natLoan() === 0 && nat.api.fpsDrops() === 0 && !nat.api.managed(),
    'RENDER_H=' + nat.api.getH() + ' fps=' + nat.api.getFps() + ' managed=' + nat.api.managed());
}
{
  const g = makeGov(540); // 540P / 60 FPS picked in SETTINGS
  feed(g, SLOW, 820); // -> 320P (v5), -> 30 FPS (v24)
  const deep = g.api.getH() === 320 && g.api.getFps() === 30;
  feed(g, CLEAN, 2000); // the cap back, then 320 -> 540
  check('THE CLAMP: recovery stops AT the settings pick - a 540P player never climbs to 720P / NATIVE',
    deep && g.api.getH() === 540 && g.api.getFps() === 60 && !g.api.managed(),
    'RENDER_H=' + g.api.getH() + ' fps=' + g.api.getFps());
}
{
  const g = makeGov(540, { fps: 30 }); // the player CHOSE the 30 fps cap
  feed(g, SLOW, 820);
  check('a CHOSEN 30 FPS cap is never loaned any lower - the governor lends, it does not punish',
    g.api.getH() === 320 && g.api.getFps() === 30 && g.api.fpsDrops() === 0 && g.st.applied === 1,
    'RENDER_H=' + g.api.getH() + ' fps=' + g.api.getFps());
}
{
  const g = makeGov(720);
  feed(g, SLOW, 75); // loan 1: 720 -> 540
  feed(g, CLEAN, 2000); // ... and the FULL return to the 720P pick
  const first = g.api.getH() === 720 && g.api.drops() === 0 && !g.api.managed() && g.st.applied === 2;
  feed(g, SLOW, 820); // the going gets rough AGAIN in the same shift: 540 -> 320 -> the cap
  const loaned2 = g.api.drops() === 2 && g.api.getFps() === 30;
  feed(g, CLEAN, 4200); // ... and the WHOLE loan is handed back a second time
  check('THE CYCLE IS REPEATABLE: loan, return, loan, return - the old "one recovery ever" law is gone' +
    ' (2 rungs out + the cap, then 2 rungs + the cap back: six buffer resizes)',
    first && loaned2 && g.api.getH() === 720 && g.api.getFps() === 60 &&
      g.api.drops() === 0 && !g.api.managed() && g.st.applied === 6,
    'applied=' + g.st.applied + ' RENDER_H=' + g.api.getH() + ' fps=' + g.api.getFps());
}
{
  const g = makeGov(540);
  feed(g, SLOW, 820); // 320P + the 30 FPS loan
  const wasLoaned = g.api.getH() === 320 && g.api.getFps() === 30;
  g.api.adopt(720, 60); // THE PLAYER PRESSES RENDER / FPS on the settings page
  check('A MENU PRESS RE-BASELINES THE GOVERNOR: the new pick becomes the target and every loaned' +
    ' rung / cap is handed straight back (the player always outranks the governor)',
    wasLoaned && g.api.targetH() === 720 && g.api.targetFps() === 60 && g.api.getH() === 720 &&
      g.api.getFps() === 60 && g.api.drops() === 0 && g.api.fpsDrops() === 0 && !g.api.managed(),
    'target=' + g.api.targetH() + '/' + g.api.targetFps() + ' live=' + g.api.getH() + '/' + g.api.getFps());
  feed(g, CLEAN, 1200);
  check('the re-baselined governor then climbs NOTHING past the new pick (720P stays 720P)',
    g.api.getH() === 720 && g.api.getFps() === 60 && !g.api.managed(),
    'RENDER_H=' + g.api.getH());
  feed(g, SLOW, 820); // and it re-arms against the new target
  check('the ladder re-arms under the new target: 720P -> 540P -> 320P -> the cap',
    g.api.getH() === 320 && g.api.drops() === 2 && g.api.getFps() === 30,
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops() + ' fps=' + g.api.getFps());
}
{
  const m = makeGov(540, { state: 'menu' });
  feed(m, 80, 300); // a 12fps menu frame stream
  check('the governor is FROZEN outside a live shift (menu frames never touch the buffer)',
    m.api.getH() === 540 && m.api.drops() === 0 && m.api.getFps() === 60);
  const pz = makeGov(540, { paused: true });
  feed(pz, 80, 300);
  check('a PAUSED shift does not feed the governor either (the stamp is not a stress test)',
    pz.api.getH() === 540 && pz.api.drops() === 0 && pz.api.getFps() === 60);
}
{
  const g = makeGov(720);
  feed(g, SLOW, 75); // one drop 720 -> 540 (5 verdicts = 60 frames)
  feed(g, CLEAN, 900); // 9s of clean frames: 40 verdicts, past the 15-verdict lockout
  check('sustained clean frames recover a one-notch drop back UP (720) and stay there',
    g.api.getH() === 720 && g.api.drops() === 0 && g.api.getFps() === 60 && !g.api.managed(),
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops());
}

console.log("");
console.log("[3b] THE GOVERNOR LAW - the shape of the hysteresis, not only its verdicts");
{
  const gov = govConsts + govTick;
  const num = (k) => parseFloat(gov.split(k + " = ")[1]);
  check("LADDER LAW: the ladder is exactly [720, 540, 320] - biggest-first and explicit, never 240 and never the RES_CYCLE press order",
    gov.includes("GOV_LADDER = [720, 540, 320];") && !gov.includes("RES_CYCLE"));
  check("NO FILTER STEPPING: no RES_CYCLE.filter stepping remains - the drop walks GOV_LADDER[rung + 1], one rung down",
    gov.includes("GOV_LADDER[rung + 1]") && gov.includes(".indexOf(h === 0 ? 720 : h)"));
  check("FLOOR LAW: 320P is the phone floor - the drop is bounded by the ladder top, so the 540 default buffer can step down",
    !gov.includes("_govBottom") && !gov.includes("Math.min(540") && gov.includes("GOV_LADDER.length - 1") && gov.includes("rung < top"));
  check("RECOVERY LAW (the new one): a climb walks back UP the ladder via GOV_LADDER[rung - 1]" +
    " (320 -> 540 -> 720) all the way to the SETTINGS pick - repeatable, never the old one-notch 'once ever'",
    gov.includes("GOV_LADDER[rung - 1]") && gov.includes("rung > 0 && _govDrops > 0") &&
      gov.includes("_govTargetRes") && !gov.includes("_govDrops === 1"));
  check("SETTINGS-TARGET LAW: the loan is measured against _govTargetRes / _govTargetFps, the frame cap" +
    " lends through GOV_FPS_LADDER, and the governor NEVER touches localStorage",
    gov.includes("_govTargetFps") && gov.includes("GOV_FPS_LADDER[1]") &&
      gov.includes("_govFpsDrops") && !gov.includes("localStorage"));
  check("NATIVE LAW: a NATIVE pick sits ABOVE the top rung - it is given up LAST on the way down" +
    " and restored as itself on the way back (RENDER_H = _govTargetRes)",
    gov.includes("_govNatDropped = 1") && gov.includes("RENDER_H = _govTargetRes"));
  check("TARGET-ADOPTION LAW: a menu press runs govAdoptSettings() in BOTH settings handlers, so the" +
    " player's pick is always the return address",
    gov.includes("function govAdoptSettings()") &&
      (src.match(/govAdoptSettings\(\);/g) || []).length === 2);
  check("NO-REWRITE LAW: the loan is live state only - no setItem, and the settings rows mark it with" +
    " a down arrow instead of storing it",
    !gov.includes("setItem") && src.includes('_govLoanRes() ? name + " \\u2193" : name') &&
      src.includes('_govLoanFps() ? " \\u2193" : ""'));
  check("THE PIXEL LOAN NOTE LAW: the player is told on the settings page what is on loan and that it comes back",
    src.includes('id = "govNote"') && src.includes("PIXEL LOAN") && src.includes("#govNote"));
  check("TDZ LAW: the governor state is var-declared, so the boot-time settings labels can ask its loan" +
    " state before the block runs without crashing the boot",
    gov.includes("var _govMsSum") && !src.includes("let _govMsSum"));
  check("CADENCE LAW: the hysteresis counts 12-frame VERDICTS - drop ~2 s, recovery ~8 s, lockout ~5 s (seconds, not minutes)",
    num("GOV_WINDOW") >= 8 && num("GOV_HI_VERDICTS") <= 8 && num("GOV_OK_VERDICTS") <= 60 && num("GOV_LOCK") <= 20,
    'HI=' + num('GOV_HI_VERDICTS') + ' OK=' + num('GOV_OK_VERDICTS') + ' LOCK=' + num('GOV_LOCK') + ' WINDOW=' + num('GOV_WINDOW'));
  const atari = makeGov(240);
  feed(atari, SLOW, 200);
  check("a 240P (ATARI) start is NEVER rewritten by the governor - a hand-picked buffer is the player choice, not a target",
    atari.api.getH() === 240 && atari.api.drops() === 0 && atari.st.applied === 0,
    'RENDER_H=' + atari.api.getH() + ' drops=' + atari.api.drops());
  check("an ATARI buffer still lends its FRAME CAP (the pixels are the player's, the frame time is the governor's)",
    atari.api.getFps() === 30 && atari.api.fpsDrops() === 1 && atari.api.getH() === 240,
    'FPS_CAP=' + atari.api.getFps());
  feed(atari, CLEAN, 1200);
  check("and an ATARI start climbs back to the player's chosen cap, staying on ATARI 2600",
    atari.api.getFps() === 60 && atari.api.getH() === 240 && !atari.api.managed(),
    'FPS_CAP=' + atari.api.getFps() + ' RENDER_H=' + atari.api.getH());
}


console.log('');
console.log('[4] THE FX TIER — what costs what, per tier');
{
  check('fxTier is ONE rule (LOW profile OR the 30fps cap) and fxRate is the ONLY multiplier',
    /function fxTier\(\)\s*\{[^}]*MOBILE_LOW_PROFILE \|\| FPS_CAP === 30[^}]*\}/.test(src) &&
      /function fxRate\(m\)\s*\{[^}]*fxTier\(\) === 1 \? m \* 0\.55 : m[^}]*\}/.test(src));
  check("the boss's slime/storm rates are ALL tiered (boom sheets, boom burst, knit sheets, knit burst, rise, scurry wake)",
    (src.match(/dt \* fxRate\(/g) || []).length >= 6 &&
      !src.includes('if (Math.random() < dt * 18) {') &&
      !src.includes('if (Math.random() < dt * (7 + k * 26)) {'),
    'fxRate sites=' + (src.match(/dt \* fxRate\(/g) || []).length);
  check("the blow-up's persistent pools stay FULL-scale on LOW (26 pools: the level's signature, one-time)",
    src.includes('const BOSS_BOOM_SPLATS = 26'));
  check('the heart window widens for thumbs ONLY on LOW (+15%) and the FULL law stays byte-exact',
    src.includes('BOSS_HEART_OPEN_T * (1 - BOSS_HEART_RAGE * bossFuryOf(b)) * (fxTier() === 1 ? 1.15 : 1)'));
  check('every shovel guard site (swing + boss shovel + boss armour) carries the tiered tail',
    (src.match(/p\.shovelGuardT = SHOVEL_SWING_DUR \+ SHOVEL_GUARD \+ \(fxTier\(\) === 1 \? SHOVEL_GUARD \* 0\.15 : 0\);/g) || []).length === 3);
  const bossRegion = src.slice(src.indexOf('function updateNightBoss('), src.indexOf('function updateNightBossFight'));
  check('no weekday system touches fxRate — the tier spends itself on the night boss region only',
    (src.match(/fxRate\(/g) || []).length === (bossRegion.match(/fxRate\(/g) || []).length + 1); // +1 = the fxRate definition itself
  const loopSrc = src.slice(src.indexOf('function loop(now) {'), src.indexOf('function rebuildTruckFromFbx'));
  check('the governor call lives in the main loop AFTER the dt clamp (it measures rendered frames)',
    loopSrc.includes('if (dt > 0.05) dt = 0.05;') &&
      loopSrc.indexOf('mobileGovernorTick(now);') > loopSrc.indexOf('if (dt > 0.05) dt = 0.05;'));
  check('the governor is the ONLY per-frame addition to the loop (one call site, one definition)',
    loopSrc.includes('mobileGovernorTick(now);') &&
      (src.match(/mobileGovernorTick\(now\);/g) || []).length === 1 &&
      (src.match(/function mobileGovernorTick\(/g) || []).length === 1);
}

console.log('');
console.log(fail === 0 ? 'MOBILE PERF CHECKS: ALL ' + pass + ' PASSED' : 'MOBILE PERF CHECKS FAILED (' + fail + ' failed)');
process.exit(fail ? 1 : 0);

