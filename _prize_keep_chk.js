// _prize_keep_chk.js — PRIZE PERSISTENCE: the prizes the worker earns never evaporate.
//
// The bug this suite hunts: a street-cash bill, a joss HELL NOTE, a mongo haul, a treasure,
// a coffee, a BEC or a Monster can used to be DELETED the moment the worker walked 14 units
// past it ("clean up bonuses the player has driven well past"). Sliding off the back of the
// screen is not collecting it — the player watched a prize land and could never bank it.
// Worse, on the backwards Midnight route (routeDir() === -1) that same low-x test ate the
// notes lying AHEAD of him, before he ever reached them.
//
// The law under test: a pickup lives on the street for the whole shift and comes back into
// view when he walks back for it; it is retired ONLY on ground outside his own walk bounds
// (behind the Intersection-1 barrier by day, above the cul-de-sac ceiling on the night
// shift), resolved on the ROUTE AXIS. The roster ceiling is the memory guard, and it lets go
// of the prize FURTHEST BEHIND the worker — never the one he is walking back toward.
//
// The suite runs the game's REAL updateBonuses / updatePowerups against a stub world.
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(n, c, e) {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (e && !c ? '  [' + e + ']' : ''));
  if (c) pass++; else fail++;
}
function extractFn(name) {
  const idx = h.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = h.indexOf('{', idx), depth = 0, i = brace;
  for (; i < h.length; i++) {
    if (h[i] === '{') depth++;
    else if (h[i] === '}') { depth--; if (depth === 0) break; }
  }
  return h.slice(idx, i + 1);
}
function numOf(name) {
  const m = h.match(new RegExp('const ' + name + ' = (\\d+(?:\\.\\d+)?);'));
  if (!m) throw new Error('const ' + name + ' not found in index.html');
  return parseFloat(m[1]);
}

// ============ 1) THE SHIP: the two 14-unit deletions are GONE ============
const ub = extractFn('updateBonuses'), up = extractFn('updatePowerups');
check('updateBonuses no longer deletes a find the worker walked 14 units past',
  ub.indexOf('p.wx - 14') < 0);
check('updatePowerups no longer deletes a power-up the worker walked 14 units past',
  up.indexOf('p.wx - 14') < 0);
check('both pickup loops retire through the shared route-axis law (pickupGoneForGood + retirePickup)',
  /if \(pickupGoneForGood\(b\.wx\)\) \{\s*retirePickup\(b\);\s*bonuses\.splice\(i, 1\);/.test(ub) &&
  /if \(pickupGoneForGood\(b\.wx\)\) \{\s*retirePickup\(b\);\s*powerups\.splice\(i, 1\);/.test(up));
check('both lists run the roster ceiling once per frame (the memory guard that replaced the delete)',
  ub.indexOf('trimPickupRoster(bonuses);') >= 0 && up.indexOf('trimPickupRoster(powerups);') >= 0);
check('the pickable-proximity doors are untouched by the fix (the 1.8u walk-over on finds, the 1.8u on power-ups)',
  /if \(state === "play" && !b\.fence && dist\(b\.wx, b\.wy\) < 1\.8\) \{/.test(ub) &&
  /if \(state === "play" && dist\(b\.wx, b\.wy\) < 1\.8\) \{/.test(up));
check('the worker really CAN walk back down the street (S / down moves him -X at 0.75x — the deleted prize was reachable by design)',
  /p\.wx \+= f \* PLAYER_SPEED \* \(f < 0 \? 0\.75 : 1\)/.test(h));
check('the kill-note budget grew with persistence (was 12, now ' + numOf('NIGHT_KILL_NOTE_CAP') + ' — left-behind notes no longer evaporate, so they keep eating the cap)',
  numOf('NIGHT_KILL_NOTE_CAP') >= 12);
check('the picklists still clear wholesale on a new shift (resetWorldState), so persistence never leaks a prize across shifts',
  h.indexOf('bonuses.length = 0;') >= 0 && h.indexOf('powerups.length = 0;') >= 0);

// ============ THE STUB WORLD (the extracted functions close over these) ============
const GZ = 0.3, CASH_LIFT = 0.12, CURB_LIFT = 0.06;
const ROUTE_START_X = numOf('ROUTE_START_X');          // 80: the barrier he can never walk behind by day
const ROUTE_FINISH_X = numOf('ROUTE_FINISH_X');
const NIGHT_TOP_X = numOf('NIGHT_TOP_X'), NIGHT_TRAIL_X = numOf('NIGHT_TRAIL_X');
const NK_CEIL_X = NIGHT_TOP_X - NIGHT_TRAIL_X;         // 449: his uphill ceiling on the dead-end shift
const MAX_LIVE_PICKUPS = numOf('MAX_LIVE_PICKUPS');
const PICKUP_CULL_GRACE = numOf('PICKUP_CULL_GRACE');
const BONUS_CASH_MULT = numOf('BONUS_CASH_MULT'), BONUS_CASH_GOAL = numOf('BONUS_CASH_GOAL');

let route = 1;                                         // 1 = the seven weekdays + OVERTIME, -1 = MIDNIGHT
function routeDir() { return route; }
function isNightShift() { return route < 0; }
function workerCeilX() { return route < 0 ? NK_CEIL_X : ROUTE_FINISH_X; }
let BONUS = false, bonusCashGoalMet = false, cashTally = 0;
const p = { wx: 200, wy: 2.5, stunT: 0 };
let state = 'play';
const bonuses = [], powerups = [];
const dist = (x, y) => Math.hypot(x - p.wx, y - p.wy);
const dynamicGroup = { add() {}, remove() {} };
const disposed = [];
function disposeObj(o) { disposed.push(o); }
const banked = [];
function addScore(n) { banked.push({ v: n, flat: false }); cashTally += n; }
function addScoreFlat(v) { banked.push({ v: v, flat: true }); cashTally += v; }
function scoreMultiplier() { return 1; }
function overtimeCashEarned() { return 0; }
const flies = [];
function flyPickupToCounter(kind, val) { flies.push({ kind: kind, val: val }); }
const SFX = { playTreasureJingle() {}, playMoneySound() {}, playKaChing() {}, playPickupSound() {}, bonusWin() {} };
const consumed = [];
function consumePowerup(b) { consumed.push(b.type); }

eval(extractFn('retirePickup'));
eval(extractFn('pickupGoneForGood'));
eval(extractFn('pickupBehindDist'));
eval(extractFn('trimPickupRoster'));
eval(extractFn('updateBonuses'));
eval(extractFn('updatePowerups'));

function mesh() {
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { z: 0 }, scale: { x: 1, setScalar() {} }, userData: {},
    parent: dynamicGroup, traverse() {},
  };
}
function addBonus(wx, wy, extra) {
  const o = Object.assign({ g: mesh(), wx: wx, wy: wy, val: 100, type: 'cash', voice: 'Street cash!', t: 0, lift: CASH_LIFT }, extra || {});
  bonuses.push(o); return o;
}
function addPower(wx, wy, type) {
  const o = { g: mesh(), wx: wx, wy: wy, type: type || 'coffee', t: 0, halo: null, ghostly: false };
  powerups.push(o); return o;
}
function reset(mode) {
  route = mode || 1;
  bonuses.length = 0; powerups.length = 0;
  banked.length = 0; consumed.length = 0; flies.length = 0; disposed.length = 0;
  cashTally = 0; state = 'play'; p.wy = 2.5;
}

// ============ 2) DAY AXIS: a bill left behind the screen SURVIVES, walking back BANKS it ============
reset(1);
p.wx = 200;
addBonus(170, 2.5);                                     // 30u behind him — clean off the back of the screen
addPower(180, 2.5, 'coffee');
for (let i = 0; i < 120; i++) { updateBonuses(1 / 60); updatePowerups(1 / 60); } // 2 seconds of walking away
check('a STREET CASH bill 30 units behind the worker is still lying on the street after 2s of walking away',
  bonuses.length === 1 && bonuses[0].wx === 170, 'bonuses=' + bonuses.length);
check('a COFFEE 20 units behind the worker is still lying on the street after 2s of walking away',
  powerups.length === 1 && powerups[0].wx === 180, 'powerups=' + powerups.length);
p.wx = 170.6;                                            // he turns around and walks back to it
updateBonuses(1 / 60);
check('walking back over the bill banks it into street cash (the prize is there when he returns)',
  bonuses.length === 0 && cashTally === 100 && banked.length === 1 && banked[0].v === 100,
  'cashTally=' + cashTally + ' banked=' + banked.length);
p.wx = 180.6;
updatePowerups(1 / 60);
check('walking back over the coffee picks it up (the healer is there when he returns)',
  powerups.length === 0 && consumed.length === 1 && consumed[0] === 'coffee');

// ============ 3) MIDNIGHT AXIS: AHEAD is downhill — those notes stop evaporating ============
reset(-1);
p.wx = 300;                                              // he walks DOWN the dead-end street, toward -X
const ahead = addBonus(265, 2.5);                        // 15u AHEAD of him: the old p.wx - 14 test deleted it
const uphill = addBonus(330, 2.5);                       // 30u BEHIND him (up the street) — must also survive
addPower(270, 2.0, 'monster');                            // a Red Bull laid ahead on the route
for (let i = 0; i < 120; i++) { updateBonuses(1 / 60); updatePowerups(1 / 60); }
check('MIDNIGHT: a HELL NOTE lying 15 units AHEAD of the worker survives (the backwards route used to eat it before he reached it)',
  bonuses.indexOf(ahead) >= 0, 'live=' + bonuses.length);
check('MIDNIGHT: a HELL NOTE 30 units upstreet behind him survives too',
  bonuses.indexOf(uphill) >= 0);
check('MIDNIGHT: a Monster can laid ahead on the route survives',
  powerups.length === 1 && powerups[0].wx === 270);
p.wx = 330;                                              // he walks back upslope for the note he passed
updateBonuses(1 / 60);
check('MIDNIGHT: walking back upslope banks the note at its FACE VALUE ($100 flat — never the street double)',
  bonuses.indexOf(uphill) < 0 && bonuses.length === 1 &&
  banked.length === 1 && banked[0].v === 100 && banked[0].flat === true,
  'banked=' + JSON.stringify(banked));
p.wx = 265.5;                                            // ...and back down for the note that was ahead
updateBonuses(1 / 60);
check('MIDNIGHT: the note that was lying ahead of him is still collectible on the spot it landed',
  bonuses.length === 0 && cashTally === 200, 'cashTally=' + cashTally);


// ============ 4) ONLY GROUND HE CAN NEVER STAND ON IS RETIRED ============
reset(1);
p.wx = 200;
addBonus(ROUTE_START_X - 20, 2.5);                        // x 60: behind the Intersection-1 barrier
addBonus(ROUTE_START_X + 40, 2.5);                        // x 120: on his stretch of the street
updateBonuses(1 / 60);
check('a find past the DAY walk barrier (x ' + (ROUTE_START_X - 20) + ' < ' + ROUTE_START_X + ' - ' + PICKUP_CULL_GRACE + ' grace) is retired — dead ground by design',
  bonuses.length === 1 && bonuses[0].wx === ROUTE_START_X + 40, 'live=' + bonuses.length);
check('a retired find is un-parented + disposed (no orphan mesh left in the dynamic group)',
  disposed.length === 1);
reset(-1);
p.wx = 300;
addPower(NK_CEIL_X + 15, 2.5, 'bec');                     // above the cul-de-sac ceiling: he can never stand there
addPower(NK_CEIL_X - 12, 2.5, 'bec');                     // under it: reachable ground
updatePowerups(1 / 60);
check('MIDNIGHT: only a power-up above his uphill ceiling (' + NK_CEIL_X + ') is retired; everything under it keeps its spot',
  powerups.length === 1 && powerups[0].wx === NK_CEIL_X - 12, 'live=' + powerups.length);
check('MIDNIGHT: the retired power-up is un-parented + disposed too', disposed.length === 1);

// ============ 5) THE ROSTER CEILING: bounded world, releases the prize FURTHEST BEHIND ============
reset(1);
p.wx = 300;
for (let i = 0; i < MAX_LIVE_PICKUPS + 6; i++) addBonus(90 + i * 3, 9.0, { type: 'treasure' }); // 6.5u off his lane: nothing banks
for (let i = 0; i < 12; i++) updateBonuses(1 / 60);
check('the roster ceiling bounds the street at MAX_LIVE_PICKUPS = ' + MAX_LIVE_PICKUPS + ' live finds',
  bonuses.length === MAX_LIVE_PICKUPS, 'live=' + bonuses.length);
let minWx = Infinity;
for (const b of bonuses) minWx = Math.min(minWx, b.wx);
check('the ceiling releases the prize FURTHEST BEHIND the worker (the low-x tail he is walking away from), never the finds around him',
  minWx === 108 && bonuses.some((b) => b.wx === 435) && bonuses.some((b) => Math.abs(b.wx - p.wx) < 6),
  'minWx=' + minWx);
check('the ceiling is a hard bound, not a slow leak (a roster 40 deep over the cap converges back to it)',
  (() => {
    reset(1); p.wx = 300;
    for (let i = 0; i < MAX_LIVE_PICKUPS + 40; i++) addBonus(120 + i, 9.0, { type: 'mongo' });
    for (let i = 0; i < 60; i++) updateBonuses(1 / 60);
    return bonuses.length === MAX_LIVE_PICKUPS;
  })(),
  'live=' + bonuses.length);

// ============ 6) NO DOUBLE-BANK: persistence is not a money printer ============
reset(1);
p.wx = 200;
addBonus(100, 2.5);
let banks = 0;
for (let i = 0; i < 90; i++) { updateBonuses(1 / 60); banks += banked.length; }
check('a bill he has NOT touched banks exactly nothing while it lies left behind (90 frames, 0 payouts)',
  banks === 0 && bonuses.length === 1, 'banks=' + banks);
p.wx = 100.5;
updateBonuses(1 / 60); updateBonuses(1 / 60); updateBonuses(1 / 60);
check('...and it banks exactly ONCE when he walks over it — collected, spliced out, never picked up twice',
  bonuses.length === 0 && banked.length === 1 && cashTally === 100,
  'banked=' + banked.length + ' cashTally=' + cashTally);

console.log('\n' + (fail === 0 ? 'ALL ' + pass + ' PRIZE PERSISTENCE CHECKS PASSED' : fail + ' of ' + (pass + fail) + ' CHECKS FAILED'));
process.exit(fail ? 1 : 0);

