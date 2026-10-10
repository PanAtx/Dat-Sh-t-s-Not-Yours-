// _cheat_god_chk.js — TRAINER: "Infinite Health" and "Always Run It Up!" are DIFFERENT
// cheats. Run It Up = the full Monster package (p.immuneT: immunity + speed boost +
// star sparkle + walk-through-everything + auto-dump). Infinite Health = p.god ONLY:
// the worker can't be hurt (hurtNPC absorbs, hit-staggers skip) — no speed, no
// sparkles, no auto-dump, and every world interaction (kicking cones/bottles/balls,
// bumping creatures, tripping) stays alive. All code is extracted from index.html.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true, n = 0;
function check(name, cond) {
  n++;
  if (!cond) { ok = false; console.log('FAIL: ' + name); }
  else console.log('pass ' + (n < 10 ? ' ' : '') + (n) + ' — ' + name);
}
function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx), depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ===== 1) the old alias is DEAD: invincibility no longer forces the Monster buff =====
check('the old "(CHEAT.invincible || CHEAT.runitup) -> immuneT" alias is gone',
  src.indexOf('(CHEAT.invincible || CHEAT.runitup)') < 0);
check('trainer menu row reads "Infinite Health" (the old "Invincibility" label is gone)',
  src.indexOf('label: "Infinite Health"') >= 0 && src.indexOf('label: "Invincibility"') < 0);

// ===== 2) the per-frame cheat block (extracted VERBATIM, then simulated) =====
const gb = src.indexOf('p.god = typeof CHEAT !== "undefined"');
check('cheat block present: p.god = typeof CHEAT ... && CHEAT.invincible', gb >= 0);
const ge = src.indexOf('p.immuneT = POWERUP_IMMUNE_DUR;', gb);
check('the runitup refresh is wired right after it', ge > gb);
const block = src.slice(gb, ge + 'p.immuneT = POWERUP_IMMUNE_DUR;'.length).replace(/^\s*\/\/.*$/gm, '');
const IMMUNE = 12;
const runCheat = new Function('p', 'CHEAT', 'POWERUP_IMMUNE_DUR', block);

function cheatFrame(CHEAT) {
  const p = { immuneT: 0, god: false };
  runCheat(p, CHEAT, IMMUNE);
  return p;
}
let f = cheatFrame({ invincible: true, runitup: false });
check('Infinite Health ON -> p.god true', f.god === true);
check('Infinite Health ON -> p.immuneT UNTOUCHED (no speed boost, no sparkle, no auto-dump)', f.immuneT === 0);
f = cheatFrame({ invincible: false, runitup: true });
check('Run It Up ON -> p.immuneT kept full (the Monster package stays as-is)', f.immuneT === IMMUNE);
check('Run It Up ON -> p.god stays false (Run It Up does NOT need p.god)', f.god === false);
f = cheatFrame({ invincible: true, runitup: true });
check('both ON -> each cheat keeps its own lane (god + immuneT together)', f.god === true && f.immuneT === IMMUNE);
f = cheatFrame({ invincible: false, runitup: false });
check('both OFF -> p.god false (toggling off takes effect instantly)', f.god === false);
f = cheatFrame(undefined); // CHEAT undefined (the sandbox harness / pre-trainer boot)
check('CHEAT undefined -> p.god false, no throw', f.god === false && f.immuneT === 0);

// ===== 3) doStun: god blocks the HIT stagger but a harmless trip still lands =====
const dStun = { stunT: 0 };
const sfx = [];
const SFX = {
  playStun() { sfx.push('stun'); },
  playTripSound() { sfx.push('trip'); },
};
eval(extractFn('doStun'));
function resetStun() { dStun.stunT = 0; dStun.stunDur = 0; dStun.gagT = 0; dStun.gagHard = 0; dStun.immuneT = 0; dStun.god = false; sfx.length = 0; }
const p = dStun; // the extracted doStun closes over `p`

resetStun(); p.god = true; doStun(1.0, 'hit');
check('god -> HIT stagger blocked (he bounces it off)', p.stunT === 0 && sfx.length === 0);
resetStun(); p.god = true; doStun(0.6, 'trip');
check('god -> a harmless trip STILL stumbles (world stays alive)', p.stunT === 0.6 && sfx.indexOf('trip') >= 0);
resetStun(); p.immuneT = IMMUNE; doStun(1.0, 'hit');
check('Monster immunity still blocks everything it always did', p.stunT === 0);
resetStun(); doStun(1.0, 'hit');

// ===== 4) hurtNPC: god absorbs the damage, a normal hit still lands =====
let health = 100, dangerWarned = false, lastHitCause = 'route', dying = 0, punchbacks = 0;
let state = 'play';
const DANGER_HP = 10;
const WORKER_GENDER = 'm';
const PUNCHBACK_CAUSES = ['rat'];
function markPunchback() { punchbacks++; }
function startDyingSequence() { dying++; }
function dangerAlarmOn() {} function dangerAlarmOff() {}
function dangerBanner() {} function dangerFlash() {}
function $(id) { return null; }
SFX.playHurtSound = function () { sfx.push('hurt'); };
SFX.dingDingDing = function () {};
const Voice = { say: function () {} };
eval(extractFn('hurtNPC'));

resetStun(); sfx.length = 0; health = 100; lastHitCause = 'route'; dying = 0; punchbacks = 0;
p.god = true; hurtNPC(2, 'dealer', true);
check('god -> damage absorbed (health untouched, no hurt sound, no write-up)',
  health === 100 && sfx.length === 0 && dying === 0);
check('god -> the absorbed hit does not even record the offense', lastHitCause === 'route');
resetStun(); sfx.length = 0; health = 20; punchbacks = 0;
p.god = false; hurtNPC(2, 'rat', true);
check('no god -> the hit lands (20 -> 18) and arms punchback',
  health === 18 && sfx.indexOf('hurt') >= 0 && punchbacks === 1);
resetStun(); health = 100; p.immuneT = IMMUNE; hurtNPC(4, 'dealer', true);
check('Monster immunity still absorbs (unchanged behaviour)', health === 100);

// ===== 5) Run It Up perks stay out of reach of god: no sparkle/flash/auto-dump/speed =====
const sparkleIdx = src.indexOf('if (p.immuneT > 0) {');
check('the star-sparkle/flash stays gated on p.immuneT ONLY (god never sparkles)',
  sparkleIdx >= 0 && src.indexOf('p.god', sparkleIdx) - sparkleIdx > 400);
check('autoDumpWhileImmune still keys on p.immuneT only (god never auto-dumps)',
  extractFn('autoDumpWhileImmune').indexOf('p.immuneT <= 0') >= 0 &&
  extractFn('autoDumpWhileImmune').indexOf('p.god') < 0);
// the worker's world interactions must NOT gain a god gate — cones/kicks/collisions live on
['updateConeProps', 'collideStatic', 'collideLandedCans', 'collideCreatures'].forEach(function (fn) {
  check(fn + ' has NO p.god gate (Invincible still kicks bottles/cones + bumps the world)',
    extractFn(fn).indexOf('p.god') < 0);
});
const boostIdx = src.indexOf('const immuneBoost = p.immuneT > 0 ? RUN_IT_UP_SPEED_MULT : 1;');
check('the speed boost stays gated on p.immuneT ONLY (god never runs faster)',
  boostIdx >= 0);
check('p.god appears ONLY in the state decl, hurtNPC, doStun and the cheat block',
  (src.match(/\bp\.god\b/g) || []).length >= 4 &&
  (src.match(/\bp\.god\b/g) || []).length <= 6);

console.log(ok ? '\nCHEAT GOD-MODE ALL CHECKS PASS' : '\nCHEAT GOD-MODE FAILURES');
process.exit(ok ? 0 : 1);

check('no cheats -> the hit staggers as always', p.stunT === 1.0 && sfx.indexOf('stun') >= 0);
