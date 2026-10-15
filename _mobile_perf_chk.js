#!/usr/bin/env node
/* ============================================================================
   THE MOBILE BUDGET SUITE (v1.0.540)
   ----------------------------------------------------------------------------
   Proves the three mobile laws the Midnight challenge work is built on:
     1) THE LOW PROFILE — a coarse-pointer, low-memory FIRST RUN self-picks
        320P / LO shadows / 30 fps, seals its keys, tells the player, and a
        CHOSEN key always wins (the auto pass runs once, ever).
     2) THE RENDER GOVERNOR — sustained slow verdicts step RENDER_H one rung down
        (720 -> 540 -> 320; 320P is the phone floor, 240P is menu-only; one recovery
        ever); the tick runs ONLY inside a live shift; consts stay declared once.
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
  src.indexOf('let _govMsSum'),
  src.indexOf('function mobileGovernorTick'),
);
const govTick = extractFn(src, 'mobileGovernorTick');
if (govConsts.length < 200 || !govTick.includes('GOV_HI_VERDICTS')) throw new Error('governor block not found');
function makeGov(startH, opt) {
  opt = opt || {};
  const make = new Function(
    'RES_CYCLE', 'startH', 'stateIn', 'pausedIn', 'renderer', 'applyRenderSize', 'setResLabel',
    'var state = stateIn, paused = pausedIn, RENDER_H = startH;' + govConsts + govTick +
    '\nvar _feed = 0; return {' +
    ' feed(ms){ _feed += ms; mobileGovernorTick(_feed); },' +
    ' getH(){ return RENDER_H; }, drops(){ return _govDrops; } };',
  );
  const st = { applied: 0 };
  const api = make(
    [540, 720, 0, 320, 240], startH,
    opt.state || 'play', !!opt.paused,
    { __r: 1 },
    () => { st.applied++; },
    () => {},
  );
  return { api, st };
}
{
  const g = makeGov(540);
  for (let i = 0; i < 75; i++) g.api.feed(40); // 40ms frames: a drop needs 5 verdicts = 60 frames
  check('sustained slow frames (40ms) step 540P DOWN exactly one rung, and applyRenderSize ran',
    g.api.getH() === 320 && g.api.drops() === 1 && g.st.applied === 1,
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops() + ' applied=' + g.st.applied);
}
{
  const g = makeGov(320);
  for (let i = 0; i < 120; i++) g.api.feed(40); // 10 slow verdicts at the floor: nothing left to drop
  check('at the phone floor 320P the governor NEVER steps to 240P (ATARI stays a menu-only choice)',
    g.api.getH() === 320 && g.api.drops() === 0 && g.st.applied === 0,
    'RENDER_H=' + g.api.getH() + ' drops=' + g.api.drops());
}
{
  const nat = makeGov(0); // NATIVE
  for (let i = 0; i < 400; i++) nat.api.feed(40); // two rungs (720 -> 540 -> 320), then the lockouts hold
  check('a NATIVE buffer that cannot keep up steps DOWN (720 -> 540 -> 320) and stops at the floor',
    nat.api.drops() === 2 && nat.api.getH() === 320,
    'RENDER_H=' + nat.api.getH() + ' drops=' + nat.api.drops());
}
{
  const m = makeGov(540, { state: 'menu' });
  for (let i = 0; i < 300; i++) m.api.feed(80); // a 12fps menu frame stream
  check('the governor is FROZEN outside a live shift (menu frames never touch the buffer)',
    m.api.getH() === 540 && m.api.drops() === 0);
  const pz = makeGov(540, { paused: true });
  for (let i = 0; i < 300; i++) pz.api.feed(80);
  check('a PAUSED shift does not feed the governor either (the stamp is not a stress test)',
    pz.api.getH() === 540 && pz.api.drops() === 0);
}
{
  const g = makeGov(720);
  for (let i = 0; i < 75; i++) g.api.feed(30); // one drop 720 -> 540 (5 verdicts = 60 frames)
  for (let i = 0; i < 900; i++) g.api.feed(10); // 9s of clean frames: 40 verdicts, past the 15-verdict lockout
  check('sustained clean frames recover a one-notch drop back UP (720), once-only by law',
    g.api.getH() === 720 && g.api.drops() === 0,
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
  check("RECOVERY LAW: a recovery walks back UP the ladder via GOV_LADDER[rung - 1] (540 -> 720), once, off the single drop",
    gov.includes("GOV_LADDER[rung - 1]") && gov.includes("_govDrops === 1") && gov.includes("rung > 0"));
  check("CADENCE LAW: the hysteresis counts 12-frame VERDICTS - drop ~2 s, recovery ~8 s, lockout ~5 s (seconds, not minutes)",
    num("GOV_WINDOW") >= 8 && num("GOV_HI_VERDICTS") <= 8 && num("GOV_OK_VERDICTS") <= 60 && num("GOV_LOCK") <= 20,
    'HI=' + num('GOV_HI_VERDICTS') + ' OK=' + num('GOV_OK_VERDICTS') + ' LOCK=' + num('GOV_LOCK') + ' WINDOW=' + num('GOV_WINDOW'));
  const atari = makeGov(240);
  for (let i = 0; i < 200; i++) atari.api.feed(40);
  check("a 240P (ATARI) start is NEVER rewritten by the governor - a hand-picked buffer is the player choice, not a target",
    atari.api.getH() === 240 && atari.api.drops() === 0 && atari.st.applied === 0,
    'RENDER_H=' + atari.api.getH() + ' drops=' + atari.api.drops());
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

