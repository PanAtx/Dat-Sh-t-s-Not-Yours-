// _health_chk.js — verify the new health / power-up system extracted verbatim from
// index.html: worker health drains on NPC/hazard hits (absorbed while i-framed or
// immune), 0 health ends the shift, coffee + BEC restore health, a Monster grants
// a few seconds of immunity, and spawn counts scale up with the level (route).
const fs = require('fs');
const path = require('path');
global.THREE = require(path.join(__dirname, '_three128.js'));

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted, works for one- and multi-line fns) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
function getNumConst(name){
  const m = src.match(new RegExp('const ' + name + ' = (\\d+);'));
  if (!m) throw new Error('const ' + name + ' not found in index.html');
  return parseInt(m[1], 10);
}

// ---- THREE primitive helpers (mirror index.html) ----
const THREE = global.THREE;
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s){ const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0.3, CURB_LIFT = 0.06, BLOCK_W = 80;
const LEVEL_BLOCKS = [
  { x: 0, garbage: false }, { x: 96, garbage: true }, { x: 192, garbage: true },
  { x: 288, garbage: true }, { x: 384, garbage: true }, { x: 480, garbage: true },
  { x: 576, garbage: true }, { x: 672, garbage: false }
];

// ---- constants under test (read straight from the game so we never drift) ----
const POWERUP_HEAL_COFFEE = getNumConst('POWERUP_HEAL_COFFEE');
const POWERUP_HEAL_BEC = getNumConst('POWERUP_HEAL_BEC');
const POWERUP_IMMUNE_DUR = getNumConst('POWERUP_IMMUNE_DUR');
const HP_HIT_VEHICLE = getNumConst('HP_HIT_VEHICLE');
const HP_HIT_HAZARD = getNumConst('HP_HIT_HAZARD');

// ---- mutable game state (the extracted functions close over these) ----
let health = 100, maxHealth = 100;
let state = 'play';
const p = { wx: 88, wy: 2.5, stunT: 0, invuln: 0, immuneT: 0 };
const dist = (x, y) => Math.hypot(x - p.wx, y - p.wy);
const powerups = [];
const starParticles = [];
const dynamicGroup = { add(){}, remove(){} };
function disposeObj(){}
// carry / delivery state that the touch-to-dump + delivery routines read (the test page
// scope doesn't have a live truck route, so we supply these)
let carry = 'none', carried = null;
const blocks = [];
const litterBaskets = [];

// ---- DOM / SFX / Voice / gameOver fakes ----
const domEls = {};
function $(id){
  if (!domEls[id]) domEls[id] = { id: id, style: {}, classList: { add(){}, remove(){}, toggle(){} } };
  return domEls[id];
}
const popups = [];
global.document = {
  querySelectorAll: function(){ return []; },
  createElement: function(tag){ const el = { tagName: tag, className: '', textContent: '', parentNode: null, style: {} }; popups.push(el); return el; },
  body: { appendChild: function(el){ el.parentNode = { removeChild: function(){} }; } }
};
const sfx = [];
const SFX = {
  playHurtSound(){ sfx.push('hurt'); },
  playPowerUpSound(){ sfx.push('power'); },
  playRunItUpSound(){ sfx.push('run'); },
  playGameOver(){}
};
const voice = [];
const Voice = { say(t){ voice.push(t); } };
const WORKER_GENDER = 'male';
const gameOverCalls = [];
function gameOver(reason){ gameOverCalls.push(reason); }

// ---- pull the REAL functions out of index.html (eval at module scope so they stay) ----
eval(extractFn('heal'));
eval(extractFn('hurtNPC'));
eval(extractFn('announcePower'));
eval(extractFn('makeHalo'));
eval(extractFn('makeCoffee'));
eval(extractFn('makeBEC'));
eval(extractFn('makeMonster'));
eval(extractFn('spawnPowerup'));
eval(extractFn('powerupCounts'));
eval(extractFn('spawnPowerups'));
eval(extractFn('consumePowerup'));
eval(extractFn('updatePowerups'));
eval(extractFn('spawnStars'));
eval(extractFn('updateStarParticles'));

// ---- assertion helper ----
let ok = true;
const check = function(label, cond){ console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };
const reset = function(){
  health = 100; maxHealth = 100; state = 'play';
  p.invuln = 0; p.immuneT = 0; p.stunT = 0; p.wx = 88; p.wy = 2.5;
  powerups.length = 0; starParticles.length = 0;
  sfx.length = 0; voice.length = 0; popups.length = 0; gameOverCalls.length = 0;
};
const lastPopup = function(){ return popups.length ? popups[popups.length - 1] : null; };

// ===== 1) 3D power-up models build without throwing and are non-empty =====
let built = true, bd = '';
[['makeCoffee', makeCoffee], ['makeBEC', makeBEC], ['makeMonster', makeMonster]].forEach(function(pair){
  try { const grp = pair[1](); if (!grp || !Array.isArray(grp.children) || grp.children.length === 0){ built = false; bd += pair[0] + ' empty; '; } }
  catch (e){ built = false; bd += pair[0] + ' threw: ' + e.message + '; '; }
});
check('coffee / BEC sandwich / Monster can each build a non-empty 3D model' + (bd ? '  [' + bd + ']' : ''), built);

// ===== 1b) orientation: UPRIGHT (not lying on their side) + coffee lost its lid/straw =====
const partZs = function(grp){ const zs = []; grp.traverse(function(o){ if (o.isMesh && o.position) zs.push(o.position.z); }); return zs; };
const span = function(zs){ return zs.length ? Math.max.apply(null, zs) - Math.min.apply(null, zs) : 0; };
const maxZ = function(zs){ return zs.length ? Math.max.apply(null, zs) : 0; };
const cz = partZs(makeCoffee());
check('coffee cup stands upright (z-span ' + span(cz).toFixed(2) + ' > 0.25, base near the sidewalk)', span(cz) > 0.25 && Math.min.apply(null, cz) < 0.15);
const bz = partZs(makeBEC());
check('BEC sandwich sits flat & upright (z-span ' + span(bz).toFixed(2) + ' > 0.15, base near 0)', span(bz) > 0.15 && Math.min.apply(null, bz) < 0.1);
const mz = partZs(makeMonster());
check('Monster can stands upright (tallest part ' + maxZ(mz).toFixed(2) + ' > 0.5)', maxZ(mz) > 0.5);
const ccol = (function(){ const s = new Set(); makeCoffee().traverse(function(o){ if (o.isMesh && o.material && o.material.color) s.add(o.material.color.getHex()); }); return s; })();
check('coffee cup has NO lid (0xdfe3e6) and NO straw (0x2a2a2a) left', !ccol.has(0xdfe3e6) && !ccol.has(0x2a2a2a));
check('coffee cup still shows the dark coffee surface (0x3a2415)', ccol.has(0x3a2415));

// ===== 1c) coffee/BEC carry a GREEN ground-halo (the model itself is NOT tinted green) =====
reset();
const findHalo = function(grp){ let h = null; grp.traverse(function(o){ if (o.userData && o.userData.halo) h = o; }); return h; };
const tinted = function(grp){ let t = false; grp.traverse(function(o){ if (o.isMesh && !(o.userData && o.userData.halo) && o.material && o.material.emissive && o.material.emissive.g > 0.5) t = true; }); return t; };
const cG = makeCoffee(), cH = findHalo(cG);
check('coffee has a GREEN halo ring', !!(cH && cH.material.color.getHex() === 0x2bff72));
check('coffee model is NOT tinted green (halo only, natural colors kept)', !tinted(cG));
const bG = makeBEC(), bH = findHalo(bG);
check('BEC sandwich also has a GREEN halo ring', !!(bH && bH.material.color.getHex() === 0x2bff72));
check('BEC model is NOT tinted green (halo only, natural colors kept)', !tinted(bG));
check('Monster can has NO halo (it is not a healer)', !findHalo(makeMonster()));
// the halo actually PULSES over time, and the model STAYS un-tinted after animating
powerups.length = 0;
const pG = makeCoffee(), pH = findHalo(pG);
powerups.push({ g: pG, wx: p.wx + 40, wy: p.wy, type: 'coffee', t: 0, halo: pH, baseScale: 1.4 });
const opA = pH.material.opacity;
updatePowerups(1 / 60);
check('coffee halo pulses (opacity animates over time)', Math.abs(pH.material.opacity - opA) > 0.001);
check('coffee model STILL not tinted green after animating (halo only)', !tinted(pG));
powerups.length = 0;

// ===== 2) heal() adds health and caps at maxHealth =====
reset();
heal(20); check('heal(20) from a full pool stays capped at ' + maxHealth, health === maxHealth);
health = 50; heal(POWERUP_HEAL_BEC); check('heal(BEC ' + POWERUP_HEAL_BEC + ') from 50 -> ' + (50 + POWERUP_HEAL_BEC), health === 50 + POWERUP_HEAL_BEC);
health = 95; heal(50); check('heal clamps at maxHealth', health === maxHealth);

// ===== 3) hurtNPC() drains health on a normal hit =====
reset();
hurtNPC(HP_HIT_VEHICLE); check('vehicle hit drains ' + HP_HIT_VEHICLE + ' HP -> ' + (100 - HP_HIT_VEHICLE), health === 100 - HP_HIT_VEHICLE);
check('hit plays the hurt SFX', sfx.indexOf('hurt') >= 0);

// ===== 4) hurtNPC() is absorbed while i-framed (invuln) =====
reset();
p.invuln = 1.0;
hurtNPC(HP_HIT_VEHICLE); check('invulnerable (i-frames) -> NO health loss', health === 100);

// ===== 5) hurtNPC() is absorbed while immune (Monster) =====
reset();
p.immuneT = POWERUP_IMMUNE_DUR;
hurtNPC(HP_HIT_VEHICLE); check('immune (Monster) -> NO health loss', health === 100);

// ===== 6) running health out ends the shift (reason: health) =====
reset();
health = 5; p.invuln = 0; p.immuneT = 0;
hurtNPC(HP_HIT_VEHICLE);
check('health clamps at 0 (does not go negative)', health === 0);
check('health hits 0 -> gameOver called with reason "health"', gameOverCalls.length === 1 && gameOverCalls[0] === 'health');

// ===== 7) coffee restores a little health + POWER UP! + "I needed that!" =====
reset();
const before = health;
consumePowerup({ type: 'coffee', wx: p.wx, wy: p.wy });
check('coffee restores ' + POWERUP_HEAL_COFFEE + ' HP', health === Math.min(maxHealth, before + POWERUP_HEAL_COFFEE));
check('coffee plays the power-up SFX', sfx.indexOf('power') >= 0);
check('coffee says "I needed that!"', voice.indexOf('I needed that!') >= 0);
let pp = lastPopup();
check('coffee shows an animated "POWER UP!" callout (pop-power)', !!pp && pp.textContent === 'POWER UP!' && pp.className.indexOf('pop-power') >= 0);

// ===== 8) BEC sandwich restores more health + POWER UP! + "I needed that!" =====
reset();
const b8 = health;
consumePowerup({ type: 'bec', wx: p.wx, wy: p.wy });
check('BEC sandwich restores ' + POWERUP_HEAL_BEC + ' HP', health === Math.min(maxHealth, b8 + POWERUP_HEAL_BEC));
check('BEC sandwich says "I needed that!"', voice.indexOf('I needed that!') >= 0);
let pp8 = lastPopup();
check('BEC shows an animated "POWER UP!" callout', !!pp8 && pp8.textContent === 'POWER UP!' && pp8.className.indexOf('pop-power') >= 0);

// ===== 9) Monster grants immunity + RUN IT UP! + star burst =====
reset();
consumePowerup({ type: 'monster', wx: p.wx, wy: p.wy });
check('Monster grants ' + POWERUP_IMMUNE_DUR + 's of immunity', p.immuneT === POWERUP_IMMUNE_DUR);
check('Monster plays the "Run It Up" SFX', sfx.indexOf('run') >= 0);
check('Monster says a "run it up" hype line', voice.join(' ').toLowerCase().indexOf('run it up') >= 0);
check('Monster spawns a burst of colorful stars', starParticles.length >= 20);
let pp9 = lastPopup();
check('Monster shows an animated "RUN IT UP!" callout (pop-power-run)', !!pp9 && pp9.textContent === 'RUN IT UP!' && pp9.className.indexOf('pop-power-run') >= 0);

// ===== 10) star burst particles update + expire cleanly =====
reset();
spawnStars(10, 10, 12);
const starCount = starParticles.length;
for (let f = 0; f < 60; f++) updateStarParticles(1 / 30);
check('star burst updates without throwing and expires over time', starCount > 0 && starParticles.length === 0);

// ===== 11) spawn counts scale UP with the level (route) =====
const c0 = powerupCounts(0), c3 = powerupCounts(3), c7 = powerupCounts(7);
const tot = function(c){ return c.coffee + c.bec + c.monster; };
check('spawn counts: level 1 (' + tot(c0) + ') <= level 4 (' + tot(c3) + ') <= level 8 (' + tot(c7) + ')', tot(c0) <= tot(c3) && tot(c3) <= tot(c7));
check('every level spawns at least one of each pickup type (coffee/BEC/Monster)', c0.coffee >= 1 && c0.bec >= 1 && c0.monster >= 1);
check('later levels spawn MORE pickups than the first level', tot(c7) > tot(c0));

// ===== 12) spawnPowerups() places exactly the right number, valid types + models =====
reset();
spawnPowerups(3);
const expected = tot(powerupCounts(3));
check('spawnPowerups(level 3) places ' + expected + ' pickups (got ' + powerups.length + ')', powerups.length === expected);
check('all pickups are valid types with a 3D model on the near sidewalk', powerups.every(function(b){ return (b.type === 'coffee' || b.type === 'bec' || b.type === 'monster') && b.g && b.g.children.length > 0 && b.wy >= 0.6 && b.wy <= 4.8; }));

// ===== 13) updatePowerups() consumes on contact + cleans up items driven past =====
reset();
powerups.push({ type: 'coffee', wx: p.wx + 0.5, wy: p.wy + 0.5, t: 0, g: { parent: dynamicGroup, position: { set(){} }, rotation: { y: 0 }, children: [{ }] } });
const hBefore = health;
updatePowerups(1 / 30);
check('walking into a coffee consumes it and heals', powerups.length === 0 && health === Math.min(maxHealth, hBefore + POWERUP_HEAL_COFFEE));
reset();
powerups.push({ type: 'bec', wx: p.wx - 20, wy: 2, t: 0, g: { parent: dynamicGroup, position: { set(){} }, rotation: { y: 0 }, children: [{ }] } });
updatePowerups(1 / 30);
check('a pickup well behind the worker is recycled out of the world', powerups.length === 0);

// ===== 14) balance tuning: fair damage, generous healers, long Monster rush =====
check('NPC hits are kept light & fair (vehicle ' + HP_HIT_VEHICLE + ', hazard ' + HP_HIT_HAZARD + ' <= 10)', HP_HIT_VEHICLE <= 10 && HP_HIT_HAZARD <= 10);
check('a hazard nick is no worse than a vehicle run-over', HP_HIT_HAZARD <= HP_HIT_VEHICLE);
check('Monster immunity is now a long rush (>= 10s, was 4s): ' + POWERUP_IMMUNE_DUR + 's', POWERUP_IMMUNE_DUR >= 10);
check('coffee & BEC are now scarce (no longer more common than the Monster)', powerupCounts(0).coffee <= powerupCounts(0).monster && powerupCounts(0).bec <= powerupCounts(0).monster);
check('coffee/BEC spawn rate reduced (1 of each on the first level, was 3): ' + powerupCounts(0).coffee + '/' + powerupCounts(0).bec, powerupCounts(0).coffee <= 1 && powerupCounts(0).bec <= 1);

SFX.playTossSound = function(){ sfx.push('toss'); };
SFX.playStun = function(){ sfx.push('stun'); };
SFX.playTripSound = function(){ sfx.push('trip'); };
// ===== 15) Monster = TRUE invincibility: no stumble / trip while immune =====
eval(extractFn('doStun'));
reset(); p.immuneT = POWERUP_IMMUNE_DUR; doStun(1.0, 'hit');
check('immune -> doStun is blocked (no stumble / trip)', p.stunT === 0);
reset(); doStun(1.0, 'trip');
check('not immune -> doStun still stuns the worker', p.stunT > 0);

// ===== 16) Monster = touch-to-dump: touching a bag / full can / full basket empties it =====
const dumpRec = { bag: 0, can: 0, basket: 0, stars: 0, voice: [] };
function tossBag(b){ dumpRec.bag++; }          // mock the real delivery routines
function dumpCan(){ dumpRec.can++; }
function dumpLitterBasket(){ dumpRec.basket++; }
eval(extractFn('autoDumpWhileImmune'));
const setWorld = function(bags, can, baskets){
  blocks.length = 0; blocks.push({ house: { bags: bags || [], can: can || null } });
  litterBaskets.length = 0; (baskets || []).forEach(function(b){ litterBaskets.push(b); });
};
const resetDump = function(){ dumpRec.bag = 0; dumpRec.can = 0; dumpRec.basket = 0; dumpRec.stars = 0; dumpRec.voice.length = 0; };

// 16a) immune + touching a curb BAG -> auto-dumped
reset(); resetDump(); carry = 'none'; carried = null; p.immuneT = POWERUP_IMMUNE_DUR;
setWorld([{ kind: 'bag', state: 'curb', wx: p.wx + 0.5, wy: p.wy, h: {}, g: { parent: null } }], null, []);
autoDumpWhileImmune();
check('touching a curb BAG while immune auto-dumps it', dumpRec.bag === 1);
check('auto-dump spawns a star burst + a hype line', starParticles.length >= 12 && voice.join(' ').toLowerCase().indexOf('dump') >= 0);

// 16b) immune + touching a full CAN -> auto-dumped
reset(); resetDump(); carry = 'none'; carried = null; p.immuneT = POWERUP_IMMUNE_DUR;
setWorld([], { kind: 'can', state: 'curb', wx: p.wx - 0.5, wy: p.wy, h: {}, home: { wx: p.wx, wy: p.wy }, g: { parent: null } }, []);
autoDumpWhileImmune();
check('touching a full CAN while immune auto-dumps it', dumpRec.can === 1);

// 16c) immune + touching a full LITTER BASKET -> auto-dumped
reset(); resetDump(); carry = 'none'; carried = null; p.immuneT = POWERUP_IMMUNE_DUR;
setWorld([], null, [{ kind: 'litterbasket', state: 'placed', wx: p.wx + 0.5, wy: p.wy, hx: p.wx, hy: p.wy, g: { parent: null }, trash: null }]);
autoDumpWhileImmune();
check('touching a full LITTER BASKET while immune auto-dumps it', dumpRec.basket === 1);

// 16d) NOT immune -> touching does nothing (normal pick-up / carry flow still applies)
reset(); resetDump(); carry = 'none'; carried = null; p.immuneT = 0;
setWorld([{ kind: 'bag', state: 'curb', wx: p.wx + 0.5, wy: p.wy, h: {}, g: { parent: null } }], null, []);
autoDumpWhileImmune();
check('not immune -> touching does NOT auto-dump', dumpRec.bag === 0 && dumpRec.can === 0 && dumpRec.basket === 0);

// 16e) immune but nothing in reach -> no dump
reset(); resetDump(); carry = 'none'; carried = null; p.immuneT = POWERUP_IMMUNE_DUR;
setWorld([{ kind: 'bag', state: 'curb', wx: p.wx + 50, wy: p.wy, h: {}, g: { parent: null } }], null, []);
autoDumpWhileImmune();
check('immune but nothing in reach -> nothing dumped', dumpRec.bag === 0);

// 16f) immune + already carrying -> dumps the touched item AND keeps the held item
reset(); resetDump();
const held = { kind: 'bag', state: 'carried', wx: 999, wy: 999, g: { parent: null } };
carry = 'bag'; carried = held; p.immuneT = POWERUP_IMMUNE_DUR;
setWorld([{ kind: 'bag', state: 'curb', wx: p.wx + 0.5, wy: p.wy, h: {}, g: { parent: null } }], null, []);
autoDumpWhileImmune();
check('immune + carrying -> dumps the touched bag and KEEPS the held item', dumpRec.bag === 1 && carried === held && carry === 'bag');

console.log(ok ? '\nHEALTH ALL CHECKS PASS' : '\nHEALTH FAILURES');
process.exit(ok ? 0 : 1);