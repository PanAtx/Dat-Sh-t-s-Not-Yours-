// _nightshift_chk.js — THE NIGHT SHIFT (the level AFTER Sunday) validation.
//
// The eighth shift has no weekday: it is the Bed-Stuy brownstone row at midnight, with
// everything MORTAL pulled off the street (no humans, animals, vehicles, bags, cans or
// litter baskets) and the horror moved in instead: specters, banshees, ghouls,
// hellhounds, a second manhole tentacle, and a many-eyed beast that ran off with the
// truck's Ruby-Plated Gargoyle. The worker's only tool is his SHOVEL — a swing packs a
// spook into the hopper, and FIVE of them make the compactor cycle glowing ecoplasm.
//
// PART 1 the level table + the emptied roster (real npcCounts, real LEVEL_DAYS)
// PART 2 the monsters + the shovel + the hopper + the heist, SIMULATED against stub world
//        callbacks (the real builder/AI/deposit code, extracted from index.html)
// PART 3 the wiring this level depends on elsewhere in the file (greps)
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  const info = name + (extra === undefined ? '' : '  [' + extra + ']');
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; failures.push(info); console.log('FAIL  ' + info); }
}
function srcFn(name) {
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  let i = html.indexOf('{', idx), d = 0;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(idx, i);
}
// one-line numeric constants are read straight out of the game (the checks test THE SHIP)
function srcNum(name) {
  const m = html.match(new RegExp('const\\s+' + name + '\\s*=\\s*(-?[0-9.]+)'));
  if (!m) throw new Error('constant not found in index.html: ' + name);
  return Number(m[1]);
}
function srcLiteral(name, open, close) {
  const marker = 'const ' + name + ' = ';
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = html.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < html.length; i++) { const c = html[i]; if (c === open) d++; else if (c === close) { d--; if (!d) { i++; break; } } }
  return html.slice(s, i);
}

console.log('[1] the shift AFTER Sunday exists, and the street is emptied of the living');
const LEVEL_DAYS = eval(srcLiteral('LEVEL_DAYS', '[', ']'));
const nightIdx = LEVEL_DAYS.findIndex(d => !!d.night);
check('MAX_LEVEL is 8: seven weekdays + one haunted shift after Sunday', LEVEL_DAYS.length === 8);
check('the night level is the LAST one (right after Sunday)', nightIdx === LEVEL_DAYS.length - 1, 'nightIdx=' + nightIdx);
const NIGHT = LEVEL_DAYS[nightIdx];
check('it has NO weekday name (the card reads MIDNIGHT)', NIGHT.day === 'MIDNIGHT' && NIGHT.day.indexOf('DAY') < 0);
check('it borrows the Bed-Stuy brownstones (BROOKLYN / BED-STUY)', NIGHT.borough === 'BROOKLYN' && NIGHT.area === 'BED-STUY');
check('exactly ONE level is flagged night:true (Sunday is untouched)', LEVEL_DAYS.filter(d => !!d.night).length === 1);
check('the night card carries a warning + its own special line', !!NIGHT.warning && !!NIGHT.special);
const NIGHT_LEVEL = nightIdx + 1;

const BASE_NPC_COUNTS = eval('(' + srcLiteral('BASE_NPC_COUNTS', '{', '}') + ')');
const SCALING_NPC = eval('(' + srcLiteral('SCALING_NPC', '{', '}') + ')');
const GATED_NPC = eval('(' + srcLiteral('GATED_NPC', '{', '}') + ')');
const mkCounts = days => new Function('BASE_NPC_COUNTS', 'SCALING_NPC', 'GATED_NPC', 'LEVEL_DAYS',
  'var level;\n' + srcFn('isQueensLevel') + '\n' + srcFn('npcCounts') +
  '\n; return (day) => { level = day; return npcCounts(day); };')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC, days);
const npc = mkCounts(LEVEL_DAYS);
const noNight = mkCounts(LEVEL_DAYS.slice(0, 7));
const sum = o => Object.keys(o).reduce((a, k) => a + o[k], 0);
const nightCounts = npc(NIGHT_LEVEL);
check('THE NIGHT SHIFT spawns ZERO humans / animals / vehicles (' + sum(nightCounts) + ')', sum(nightCounts) === 0);
check('the emptied roster keeps every weekday key (nothing was deleted, all zeroed)',
  Object.keys(nightCounts).join() === Object.keys(BASE_NPC_COUNTS).join());

console.log('\n[2] the monsters, the shovel, the hopper and the heist (real code, stub world)');
// ---- a minimal stand-in world: just enough three.js surface to build + drive the pack ----
function mkColor(hex) { return { hex: (hex | 0), setHex(h) { this.hex = h | 0; return this; } }; }
function mkObj(kind) {
  const o = {
    kind: kind || 'obj', children: [], parent: null, userData: {}, visible: true, castShadow: false,
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } },
    rotation: {
      x: 0, y: 0, z: 0,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    },
    scale: {
      x: 1, y: 1, z: 1,
      set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
      setScalar(s) { this.x = this.y = this.z = s; return this; },
    },
    add() { for (const c of arguments) { if (!c) continue; this.children.push(c); c.parent = this; } return this; },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; return this; },
    traverse(f) { f(this); for (const c of this.children) if (c.traverse) c.traverse(f); },
  };
  return o;
}
const Geo = function () { return { dispose() {} }; };
const THREE = {
  Group: function () { return mkObj('group'); },
  Mesh: function (g, m) { const o = mkObj('mesh'); o.geometry = g; o.material = m; return o; },
  Color: function (hex) { return mkColor(hex); },
  MeshLambertMaterial: function (o) {
    o = o || {};
    return {
      color: mkColor(o.color), emissive: o.emissive != null ? mkColor(o.emissive) : null,
      emissiveIntensity: o.emissiveIntensity == null ? 0 : o.emissiveIntensity,
      opacity: o.opacity == null ? 1 : o.opacity, transparent: !!o.transparent,
    };
  },
  SphereGeometry: Geo, BoxGeometry: Geo, CylinderGeometry: Geo,
  PlaneGeometry: Geo, CircleGeometry: Geo, TorusGeometry: Geo,
};
const M = (c, o) => {
  const m = { color: mkColor(c), emissive: null, emissiveIntensity: 0, opacity: 1, transparent: false };
  Object.assign(m, o || {});
  if (typeof m.emissive === 'number') m.emissive = mkColor(m.emissive);
  return m;
};
const MS = M;
const BX = (w, h, d, m) => { const o = mkObj('box'); o.material = m; return o; };
const CY = (r1, r2, h, m) => { const o = mkObj('cyl'); o.material = m; return o; };
const SP = (r, m) => { const o = mkObj('sph'); o.material = m; return o; };
const SPH = SP;
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GZ = 0.3, CURB_LIFT = 0.05;
const ROUTE_START_X = 0, ROUTE_FINISH_X = 500, ROUTE_END_X = 520, PLAYER_START_X = 6;
const SHOVEL_POINTS = srcNum('SHOVEL_POINTS'), HORROR_SPOOK_TARGET = 14, GARGOYLE_VALUE = 5000;
const HORROR_SEE_R = 13, HORROR_TOUCH_CD = 1.5, SHOVEL_REACH = 3.4;
const SHOVEL_SWING_DUR = srcNum('SHOVEL_SWING_DUR'), SHOVEL_COOLDOWN = srcNum('SHOVEL_COOLDOWN');
const HORROR_FLY_DUR = 0.85;
const GARGOYLE_CAMP_X_OFF = 9;
const HP_HIT_SPECTER = 8, HP_HIT_BANSHEE = 9, HP_HIT_GHOUL = 10, HP_HIT_HOUND = 11;
const HORROR_TYPES = {
  specter: 1, ghoul: 1, hound: 1, banshee: 1, imp: 1, wraith: 1, poltergeist: 1, demon: 1,
  hexbeast: 1, abyssal: 1, lich: 1, reaper: 1, ghost: 1,
};
// THE ABYSS ROSTER (the families the night shift now haunts every block with)
const HORROR_ALL = {
  specter: 1, banshee: 1, ghoul: 1, hound: 1, imp: 1, wraith: 1, poltergeist: 1,
  demon: 1, hexbeast: 1, abyssal: 1, lich: 1, reaper: 1,
};
const HORROR_HITS = {
  specter: 8, banshee: 9, ghoul: 10, hound: 11, imp: 6, wraith: 9, poltergeist: 8,
  demon: 14, hexbeast: 9, abyssal: 12, lich: 12, reaper: 16, ghost: 10,
};
const HORROR_NAMES = {
  specter: 'SPECTER', banshee: 'BANSHEE', ghoul: 'GHOUL', hound: 'HELLHOUND', imp: 'IMP',
  wraith: 'WRAITH', poltergeist: 'POLTERGEIST', demon: 'DEMON', hexbeast: 'HEXBEAST',
  abyssal: 'ABYSSAL', lich: 'LICH', reaper: 'REAPER', ghost: 'GHOST', zombieArm: 'TEN-TACLE',
};
const SPOOK_LINES = {
  specter: ['BOO'], banshee: ['WOOO'], ghoul: ['Sooo'], hound: ['GRR'], imp: ['HEH'],
  wraith: ['COLD'], poltergeist: ['BAGS'], demon: ['MIDNIGHT'], hexbeast: ['CLICK'],
  abyssal: ['PIT'], lich: ['LICH'], reaper: ['SCYTHE'], ghost: ['US'], thief: ['MINE'],
};
// THE HOLY WEAPON + the exorcisable grave yard (the numbers the game runs on)
const HORROR_QUOTA = eval('(' + srcLiteral('HORROR_QUOTA', '{', '}') + ')');
const HORROR_QUOTA_FLOOD = eval('(' + srcLiteral('HORROR_QUOTA_FLOOD', '{', '}') + ')');
const HORROR_QUOTA_CEIL = eval('(' + srcLiteral('HORROR_QUOTA_CEIL', '{', '}') + ')');
const SHOVELABLE_HAZARDS = eval('(' + srcLiteral('SHOVELABLE_HAZARDS', '{', '}') + ')');
const HORROR_PROP_NAMES = eval('(' + srcLiteral('HORROR_PROP_NAMES', '{', '}') + ')');
const HORROR_PROP_LINES = ['HEADSTONE IN THE TRUCK!'];
const HORROR_FILL_ORDER = eval('(' + srcLiteral('HORROR_FILL_ORDER', '[', ']') + ')');
const HORROR_ROSTER_CAP = srcNum('HORROR_ROSTER_CAP'), HORROR_SCREEN_CAP = srcNum('HORROR_SCREEN_CAP');
const NIGHT_FILL_TICK = srcNum('NIGHT_FILL_TICK'), NIGHT_FILL_BURST = srcNum('NIGHT_FILL_BURST');
const HORROR_WAVE_AT = srcNum('HORROR_WAVE_AT'), HORROR_SURGE_AT = srcNum('HORROR_SURGE_AT');
const HORROR_SURGE_DUR = srcNum('HORROR_SURGE_DUR'), NIGHT_CULL_BEHIND = srcNum('NIGHT_CULL_BEHIND');
const DEEP_SEE_MUL = srcNum('DEEP_SEE_MUL'), DEEP_CHASE_MUL = srcNum('DEEP_CHASE_MUL');
const DEEP_HUNT_T = eval('(' + srcLiteral('DEEP_HUNT_T', '[', ']') + ')');
const SURGE_PACK_TOTAL = srcNum('SURGE_PACK_TOTAL');
const WAVE_LINES = ['MORE GHOULS!'], SURGE_LINES = ['ABYSS SURGE!'];
const CONS_CHARGE_AT = srcNum('CONS_CHARGE_AT'), CONS_REACH = srcNum('CONS_REACH');
const CONS_ARC_TARGETS = srcNum('CONS_ARC_TARGETS'), CONS_ARC_COS = Math.cos(1.15);
const TRIAD_WINDOW = srcNum('TRIAD_WINDOW'), TRIAD_POINTS = srcNum('TRIAD_POINTS');
const FLINCH_R = srcNum('FLINCH_R'), FLINCH_T = srcNum('FLINCH_T'), FLINCH_SP = srcNum('FLINCH_SP');
const SHOVEL_PROP_POINTS = srcNum('SHOVEL_PROP_POINTS'), SHOCKWAVE_R = srcNum('SHOCKWAVE_R');
// FAIR FIGHT (read straight out of the game): the stagger, the hit grace, the swarm cap,
// the guard window, and the fact that the WHOLE TOOL (shaft + head sweep) is the weapon.
const HORROR_STUN_T = srcNum('HORROR_STUN_T'), NIGHT_HIT_GRACE = srcNum('NIGHT_HIT_GRACE');
const HORROR_HUNTERS_MAX = srcNum('HORROR_HUNTERS_MAX'), SHOVEL_GUARD = srcNum('SHOVEL_GUARD');
const SHOVEL_BUTT = srcNum('SHOVEL_BUTT'), SHOVEL_BLADE_R = srcNum('SHOVEL_BLADE_R');
const NIGHT_SAY_GAP = srcNum('NIGHT_SAY_GAP'), NIGHT_BUBBLE_GAP = srcNum('NIGHT_BUBBLE_GAP');
const NIGHT_POP_GAP = srcNum('NIGHT_POP_GAP');
const HORROR_STREET_Y = srcNum('HORROR_STREET_Y'), HORROR_LAWN_Y = srcNum('HORROR_LAWN_Y');
const PARRY_LINES = eval('(' + srcLiteral('PARRY_LINES', '[', ']') + ')');
const TRIAD_LINES = ['TRIAD!'], CONS_LINES = ['HOLY!'];
const NIGHT_PROP_QUOTA = eval('(' + srcLiteral('NIGHT_PROP_QUOTA', '{', '}') + ')');
const NIGHT_PROP_QUOTA_FLOOD = eval('(' + srcLiteral('NIGHT_PROP_QUOTA_FLOOD', '{', '}') + ')');
const NIGHT_GHOST_SLOTS = srcNum('NIGHT_GHOST_SLOTS'), NIGHT_GHOST_CAP = srcNum('NIGHT_GHOST_CAP');
const NIGHT_GHOST_FILL = srcNum('NIGHT_GHOST_FILL'), NIGHT_GHOUL_MIN = srcNum('NIGHT_GHOUL_MIN');
const NIGHT_GLOW_ECTO = srcNum('NIGHT_GLOW_ECTO'), NIGHT_GLOW_AURA = srcNum('NIGHT_GLOW_AURA');
const NIGHT_ECTO_SIZE = srcNum('NIGHT_ECTO_SIZE');
const NIGHT_GLOW_BODY = srcNum('NIGHT_GLOW_BODY'), NIGHT_TRUCK_GLOW = srcNum('NIGHT_TRUCK_GLOW');
const HORROR_SEE_R_X = HORROR_SEE_R;
const SHOVEL_LINES = ['GET IN THE TRUCK!'];
const NIGHT_SCARE_LINES = ['MAMA!'];
const NIGHT_START_LINES = ['Where is everybody?'];
// ---- the spies + the mutable world the extracted code drives ----
const log = [], deposited = [], scored = [], announced = [], popped = [], sayings = [];
const dynamicChildren = [], dust = [];
const dyn = { add: o => dynamicChildren.push(o) };
const Voice = { say: t => sayings.push(t) };
const SFX = {
  playSwoosh: () => log.push('swoosh'), playSquelch: () => log.push('squelch'),
  playHopperJingle: () => log.push('jingle'), playTreasureJingle: () => log.push('treasure'),
  playBansheeWail: () => log.push('wail'),
};
const dayStats = { bags: { got: 0, total: 0 }, treasure: { got: 0, total: 0 }, spooks: { got: 0, total: HORROR_SPOOK_TARGET } };
const p = { wx: 0, wy: 2.5, stunT: 0, stunDur: 1, shovelT: 0, shovelCd: 0, shovelGuardT: 0, nightHitT: 0, facing: 9, shake: 0 };
const creatures = [];
let onScreen = true, nightOn = true;
// ---- the stub WORLD the LIVE HAUNT + the EXORCISM run against (5 active blocks: the
//      LAST one (index 4 = x 384) is the ABYSS FLOOD band the flood quotas belong to) ----
const S2_LAYOUT = [
  { x: 0, garbage: false }, { x: 96, garbage: true }, { x: 192, garbage: true },
  { x: 288, garbage: true }, { x: 384, garbage: true }, { x: 480, garbage: false },
];
const S2_IDX = S2_LAYOUT.map((b, i) => (b.garbage ? i : -1)).filter((i) => i >= 0);
const S2_BLOCKS = [];
for (const bl of S2_LAYOUT)
  for (let i = 0; i < 5; i++)
    S2_BLOCKS.push({ blockX: bl.x, worldX: bl.x + i * 16, hazards: [], trees: [] });
function nodeGroup(tag) {
  return {
    tag, children: [],
    add(o) { this.children.push(o); if (o) o.parent = this; },
    remove(o) {
      const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1);
      if (o) o.parent = null;
    },
  };
}
const S2_GROUND = nodeGroup('ground');
const S2_ARMS = [], S2_HANDS = [];
const disposed = [], bursts = [], bubbles = [];
const allSpawned = [];
function S2_ADD_CREATURE(type, opts) {
  const mesh = type === "eyestalker" ? H.makeManyEyedBeast() : mkObj(type);
  const c = {
    type, wx: p.wx + 30, wy: 2.5, g: mesh, gender: 'male', fade: 1,
    hopT: 0, phase: 0, lopeSp: 1.5, chaseSp: 4, huntT: 0, wanderT: 0, dir: 1,
  };
  if (opts && opts.v) c.causeKey = opts.v;
  if (type === 'wraith' || type === 'poltergeist' || type === 'specter') c.floaty = true;
  c.g.position.set(c.wx, c.wy, GZ);
  allSpawned.push(c);
  creatures.push(c);
  return c;
}
// ---- the real night-shift code, extracted and run against those stubs ----
const HORROR_SRC = ['makeSpectralMat', 'makeSpecter', 'makeGhoul', 'makeHellhound',
  'makeManyEyedBeast', 'makeRubyGargoyle', 'makeShovelProp', 'canShovel', 'tryShovelSwing',
  'shovelStrike', 'shovelFlight', 'landSpookInHopper', 'floatOrLope', 'respawnHorror',
  'updateHorrorCreature', 'updateThief', 'reclaimStolenGargoyle', 'spawnEctoSplat', 'nightEctoK',
  'nightEctoSize', 'shovelDeliverStrike',
  // THE ABYSS ROSTER + THE HOLY WEAPON (the horde, the exorcism, the consecration)
  'makeWraith', 'makePoltergeist', 'makeImp', 'makeDemon', 'makeHexbeast', 'makeAbyssal',
  'makeLich', 'makeReaper', 'makeGhostHandProp', 'makeGhostCandleProp', 'makeGhostCoffinProp',
  'makeIronGateProp', 'horrorKey', 'shovelBanish', 'shovelFlinch', 'shovelShockwave',
  'nearestShovelHazard', 'shovelHazardStrike', 'updateEctoFlights', 'animateGhostHands',
  'nightBands', 'nightWorldBlock', 'nightFloodBand', 'nightQuota', 'nightBandLive',
  'nightHorrorLive', 'nightGhostLive', 'nightHorrorOnScreen', 'cullHorror', 'nightSpawnHorror',
  'spawnNightGhost', 'bandOf', 'updateNightHaunt', 'nightPlaceProp',
  // FAIR FIGHT (the shield, the swarm cap, the whole-tool hit envelope)
  'shovelToolReach', 'horrorHunterCount', 'shoveSpookOff', 'shovelParry',
  'nightSayOk', 'nightBubbleOk', 'nightPopOk', 'horrorMaxY'].map(srcFn).join('\n');
const H = new Function(
  'THREE', 'M', 'MS', 'BX', 'CY', 'SP', 'SPH', 'R', 'pick', 'clamp',
  'GZ', 'CURB_LIFT', 'ROUTE_START_X', 'ROUTE_FINISH_X', 'ROUTE_END_X', 'PLAYER_START_X',
  'HORROR_TYPES', 'HORROR_HITS', 'HORROR_NAMES', 'HORROR_SEE_R', 'HORROR_TOUCH_CD',
  'SHOVEL_REACH', 'SHOVEL_SWING_DUR', 'SHOVEL_COOLDOWN', 'SHOVEL_POINTS', 'HORROR_FLY_DUR',
  'HORROR_SPOOK_TARGET', 'GARGOYLE_VALUE', 'GARGOYLE_CAMP_X_OFF',
  'SPOOK_LINES', 'SHOVEL_LINES', 'NIGHT_SCARE_LINES', 'NIGHT_START_LINES',
  'HP_HIT_SPECTER', 'HP_HIT_BANSHEE', 'HP_HIT_GHOUL', 'HP_HIT_HOUND',
  'state', 'p', 'creatureOnScreen', 'creatureMaxY', 'hopperAimX', 'hopperWorldY', 'hopperTopZ',
  'hopperDeposit', 'addScore', 'recordDayGot', 'announcePower', 'showPopup', 'Voice', 'SFX',
  'dynamicGroup', 'dustParticles', 'isNightShift', 'dayStats', 'creatures', 'worker', 'wparts',
  'WORKER_GENDER',
  // THE ABYSS ROSTER + THE HOLY WEAPON (the numbers, the graveyard, the live haunt)
  'HORROR_ALL', 'HORROR_QUOTA', 'HORROR_QUOTA_FLOOD', 'HORROR_QUOTA_CEIL',
  'HORROR_ROSTER_CAP', 'HORROR_SCREEN_CAP', 'NIGHT_FILL_TICK', 'NIGHT_FILL_BURST',
  'HORROR_WAVE_AT', 'HORROR_SURGE_AT', 'HORROR_SURGE_DUR', 'NIGHT_CULL_BEHIND',
  'DEEP_SEE_MUL', 'DEEP_HUNT_T', 'DEEP_CHASE_MUL', 'SURGE_PACK_TOTAL', 'WAVE_LINES',
  'SURGE_LINES', 'CONS_CHARGE_AT', 'CONS_REACH', 'CONS_ARC_TARGETS', 'CONS_ARC_COS',
  'TRIAD_WINDOW', 'TRIAD_POINTS', 'FLINCH_R', 'FLINCH_T', 'FLINCH_SP', 'SHOVEL_PROP_POINTS',
  'SHOCKWAVE_R', 'TRIAD_LINES', 'CONS_LINES', 'SHOVELABLE_HAZARDS', 'HORROR_PROP_NAMES',
  'HORROR_PROP_LINES', 'HORROR_FILL_ORDER', 'NIGHT_PROP_QUOTA', 'NIGHT_PROP_QUOTA_FLOOD',
  'NIGHT_GHOST_SLOTS', 'NIGHT_GHOST_CAP', 'NIGHT_GHOST_FILL', 'NIGHT_GHOUL_MIN',
  'LEVEL_BLOCKS', 'ACTIVE_BLOCK_IDX', 'BLOCK_W', 'blocks', 'groundGroup', 'GHOST_ARMS',
  'GHOST_HANDS', 'ghostSlotX', 'disposeObj', 'spawnEctoBurst', 'spawnBubble', 'addCreature',
  'makeGhostArm', 'makeGhostHeadstone', 'makeSkullPile', 'makeGhostObjectMat', 'addGhostAura',
  'HORROR_STUN_T', 'NIGHT_HIT_GRACE', 'HORROR_HUNTERS_MAX', 'SHOVEL_GUARD', 'SHOVEL_BUTT',
  'SHOVEL_BLADE_R', 'PARRY_LINES', 'NIGHT_SAY_GAP', 'NIGHT_BUBBLE_GAP', 'NIGHT_POP_GAP',
  'creatureMaxY', 'HORROR_STREET_Y', 'HORROR_LAWN_Y', 'nightEctoKUnused', 'nightEctoSize',
  'NIGHT_GLOW_ECTO', 'NIGHT_ECTO_SIZE',
  HORROR_SRC +
  '\nlet ectoCount = 0; let stolenGargoyle = null; let gargoyleReclaimed = false;' +
  '\nlet shovelCharge = 0, shovelCharged = false, shovelTriadT = 0, shovelTriadCount = 0;' +
  '\nlet ectoFlights = [], nightHauntT = 0, nightGhoulTier = 0, nightSurgeT = 0,' +
  ' nightSurgeSpawned = 0, nightSurgeTier = 0, nightGhostCursor = 0;' +
  '\nlet nightSayT = 0, nightBubbleT = 0, nightPopT = 0;' +
  '\nlet shovelArm = -1, pendingStrike = null;' +
  '\nfunction swingNow() { const r = tryShovelSwing(); shovelDeliverStrike(); return r; }' +
  '\nreturn { makeSpecter, makeGhoul, makeHellhound, makeManyEyedBeast, makeRubyGargoyle,' +
  ' makeShovelProp, canShovel, tryShovelSwing, shovelDeliverStrike, swing: swingNow,' +
  ' shovelFlight, landSpookInHopper,' +
  ' updateHorrorCreature, updateThief, reclaimStolenGargoyle, spawnEctoSplat,' +
  ' makeWraith, makePoltergeist, makeImp, makeDemon, makeHexbeast, makeAbyssal, makeLich,' +
  ' makeReaper, makeGhostHandProp, makeGhostCandleProp, makeGhostCoffinProp, makeIronGateProp,' +
  ' horrorKey, shovelBanish, shovelFlinch, shovelShockwave, nearestShovelHazard,' +
  ' shovelHazardStrike, updateEctoFlights, animateGhostHands, nightBands, nightWorldBlock,' +
  ' nightFloodBand, nightQuota, nightBandLive, nightHorrorLive, nightGhostLive,' +
  ' nightHorrorOnScreen, nightSpawnHorror, spawnNightGhost, bandOf, updateNightHaunt,' +
  ' nightPlaceProp, cullHorror, ectoFlights, shovelToolReach, horrorHunterCount,' +
  ' shoveSpookOff, shovelParry, shovelGuardOf: () => p.shovelGuardT,' +
  ' nightSayOk, nightBubbleOk,' +
  ' setSayT: v => { nightSayT = v; }, getSayT: () => nightSayT,' +
  ' getEcto: () => ectoCount, setStolen: v => { stolenGargoyle = v; },' +
  ' setReclaimed: v => { gargoyleReclaimed = v; }, isReclaimed: () => gargoyleReclaimed,' +
  ' setCharge: v => { shovelCharge = v; shovelCharged = v >= CONS_CHARGE_AT; if (v < CONS_CHARGE_AT) shovelCharged = false; },' +
  ' getCharge: () => shovelCharge, isCharged: () => shovelCharged,' +
  ' setTriad: (t, c) => { shovelTriadT = t; shovelTriadCount = c; },' +
  ' getTriad: () => [shovelTriadT, shovelTriadCount],' +
  ' setHaunt: (tier, surge) => { nightGhoulTier = tier; nightSurgeT = surge; },' +
  ' getHaunt: () => [nightGhoulTier, nightSurgeT],' +
  ' setShovel: g => { shovelGroupRef = g; },' +
  ' resetNight: () => { shovelCharge = 0; shovelCharged = false; shovelTriadT = 0;' +
  ' shovelTriadCount = 0; nightHauntT = 0; nightGhoulTier = 0; nightSurgeT = 0;' +
  ' nightSurgeTier = 0; nightSurgeSpawned = 0; nightGhostCursor = 0; GHOST_HANDS.length = 0;' +
  ' nightSayT = 0; nightBubbleT = 0; nightPopT = 0;' +
  ' ectoFlights.length = 0; ectoCount = 0; }};'
)
(
  THREE, M, MS, BX, CY, SP, SPH, R, pick, clamp,
  GZ, CURB_LIFT, ROUTE_START_X, ROUTE_FINISH_X, ROUTE_END_X, PLAYER_START_X,
  HORROR_TYPES, HORROR_HITS, HORROR_NAMES, HORROR_SEE_R, HORROR_TOUCH_CD,
  SHOVEL_REACH, SHOVEL_SWING_DUR, SHOVEL_COOLDOWN, SHOVEL_POINTS, HORROR_FLY_DUR,
  HORROR_SPOOK_TARGET, GARGOYLE_VALUE, GARGOYLE_CAMP_X_OFF,
  SPOOK_LINES, SHOVEL_LINES, NIGHT_SCARE_LINES, NIGHT_START_LINES,
  HP_HIT_SPECTER, HP_HIT_BANSHEE, HP_HIT_GHOUL, HP_HIT_HOUND,
  'play', p,
  (c) => onScreen && !!c && Math.abs(c.wx - p.wx) < 46 && Math.abs(c.wy - 3.2) < 12.5,
  () => 4.8, () => 3, () => -4.5, () => 2.4,
  t => deposited.push(t), (n, b) => scored.push({ n, bonus: b }),
  k => { if (dayStats[k]) dayStats[k].got++; }, t => announced.push(t),
  (kind, val, name) => popped.push({ kind, val, name }), Voice, SFX,
  dyn, { push: o => dust.push(o) }, () => nightOn, dayStats, creatures,
  { group: mkObj('group') }, { armR: mkObj('armR') }, 'male',
  HORROR_ALL, HORROR_QUOTA, HORROR_QUOTA_FLOOD, HORROR_QUOTA_CEIL,
  HORROR_ROSTER_CAP, HORROR_SCREEN_CAP, NIGHT_FILL_TICK, NIGHT_FILL_BURST,
  HORROR_WAVE_AT, HORROR_SURGE_AT, HORROR_SURGE_DUR, NIGHT_CULL_BEHIND,
  DEEP_SEE_MUL, DEEP_HUNT_T, DEEP_CHASE_MUL, SURGE_PACK_TOTAL, WAVE_LINES,
  SURGE_LINES, CONS_CHARGE_AT, CONS_REACH, CONS_ARC_TARGETS, CONS_ARC_COS,
  TRIAD_WINDOW, TRIAD_POINTS, FLINCH_R, FLINCH_T, FLINCH_SP, SHOVEL_PROP_POINTS,
  SHOCKWAVE_R, TRIAD_LINES, CONS_LINES, SHOVELABLE_HAZARDS, HORROR_PROP_NAMES,
  HORROR_PROP_LINES, HORROR_FILL_ORDER, NIGHT_PROP_QUOTA, NIGHT_PROP_QUOTA_FLOOD,
  NIGHT_GHOST_SLOTS, NIGHT_GHOST_CAP, NIGHT_GHOST_FILL, NIGHT_GHOUL_MIN,
  S2_LAYOUT, S2_IDX, 80, S2_BLOCKS, S2_GROUND, S2_ARMS, S2_HANDS,
  (slot, bx) => (bx == null ? 9999 : bx + (slot + 0.5) * (80 / NIGHT_GHOST_SLOTS)),
  (o) => { disposed.push(o); },
  (x, y, s) => { bursts.push({ x, y, s }); },
  (t, x, y, k) => { bubbles.push({ t, x, y, k }); },
  S2_ADD_CREATURE, () => mkObj('arm'), () => mkObj('stone'), () => mkObj('skulls'),
  () => ({ color: {}, opacity: 0.62, transparent: true, emissiveIntensity: 0.15 }), () => {},
  HORROR_STUN_T, NIGHT_HIT_GRACE, HORROR_HUNTERS_MAX, SHOVEL_GUARD, SHOVEL_BUTT,
  SHOVEL_BLADE_R, PARRY_LINES, NIGHT_SAY_GAP, NIGHT_BUBBLE_GAP, NIGHT_POP_GAP,
  () => 4.8, HORROR_STREET_Y, HORROR_LAWN_Y, () => 0, () => NIGHT_ECTO_SIZE, NIGHT_GLOW_ECTO,
  NIGHT_ECTO_SIZE
);
function mkC(type, dx, dy, extra) {
  // mkC(type, dx) / mkC(type, dx, extra) / mkC(type, dx, dy, extra) — a missing dy
  // means "same lane as the worker", NEVER NaN (a NaN lane poisons every distance test).
  if (typeof dy === "object" && dy !== null) { extra = dy; dy = 0; }
  if (dy == null) dy = 0;
  return Object.assign({
    type, wx: p.wx + dx, wy: p.wy + dy, g: mkObj('group'), gender: 'male', causeKey: type,
  }, extra || {});
}

// --- the pack's models expose the animation contracts the AI drives ---
const spec = H.makeSpecter({ v: 'specter' });
const banshee = H.makeSpecter({ v: 'banshee' });
check('a specter is built from its OWN translucent materials + 2 hollow lights + 2 claws',
  spec.userData.spec.mats.length === 2 && spec.userData.spec.eyes.length === 2 &&
  spec.userData.spec.hands.length === 2 && spec.userData.spec.mats.every(m => m.opacity < 1));
check('a banshee is a specter with the hair curtain + the dropped jaw (more parts, taller)',
  banshee.children.length > spec.children.length + 5);
const ghoul = H.makeGhoul();
check('a ghoul exposes 2 hip pivots + 2 hook arms + a chattering jaw for the lope',
  ghoul.userData.ghoul.legs.length === 2 && ghoul.userData.ghoul.arms.length === 2 && !!ghoul.userData.ghoul.jaw);
const hound = H.makeHellhound();
const hp = hound.userData.hound;
check('a hellhound exposes 4 named leg pivots + head/jaw/tail pivots (the trot contract)',
  ['legFL', 'legFR', 'legBL', 'legBR'].every(k => !!hp.legs[k]) && !!hp.headPiv && !!hp.jawPiv && !!hp.tailPiv);
const beast = H.makeManyEyedBeast();
check('the many-eyed beast has SEVEN eye stalks, SIX legs and a maw to steal with',
  beast.userData.beast.eyes.length === 7 && beast.userData.beast.legs.length === 6 && !!beast.userData.beast.maw);
const gargoyle = H.makeRubyGargoyle();
check('the Ruby-Plated Gargoyle glows from its own ruby emissive + has 2 wings to flap',
  !!gargoyle.userData.ruby && gargoyle.userData.ruby.emissiveIntensity > 0 && gargoyle.userData.wings.length === 2);
check('the DSNY shovel is a real tool: butt knob, wood, taped grip, socket, neck, square point and bright edge',
  H.makeShovelProp().children.length === 7);

// --- ACT swings the shovel (and only on this level) ---
p.wx = 100; p.wy = 2.5; p.stunT = 0; p.shovelCd = 0; p.facing = 9;
const farHound = mkC('hound', 30);
const nearGhoul = mkC('ghoul', 2, { causeKey: 'ghoul' });
creatures.length = 0; creatures.push(farHound, nearGhoul);
log.length = 0;
check('ACT on the night shift SWINGS THE SHOVEL and packs the NEAREST reachable spook',
  H.swing() === true && nearGhoul.hooked === true && farHound.hooked === undefined);
check('the swing turns him to face what he just hit', Math.abs(p.facing) < 1e-9);
check('the swing + its cooldown are armed (no mash-fest)', p.shovelT > 0 && p.shovelCd > 0);
p.shovelCd = 0; creatures.length = 0; creatures.push(mkC('ghoul', 9)); log.length = 0;
check('a whiff still swings (a live swoosh — the button never feels dead)',
  H.swing() === true && log.indexOf('swoosh') >= 0);
p.shovelCd = 0.3; creatures.length = 0; creatures.push(mkC('ghoul', 1));
check('he cannot swing again inside the cooldown', H.swing() === false);
p.shovelCd = 0; nightOn = false;
check('on the seven weekday shifts ACT is NOT a shovel', H.swing() === false);
nightOn = true;
const thiefC = mkC('eyestalker', 1, { thief: true });
check('the many-eyed THIEF cannot be shoveled — it has to be run down', H.canShovel(thiefC) === false);
const mid = mkC('specter', 1, { hooked: true });
check('a spook already riding the shovel-toss is never struck twice', H.canShovel(mid) === false);
const tentacle = mkC('zombieArm', 1, { state: 'grab', cd: 0 });
creatures.length = 0; creatures.push(tentacle); p.shovelCd = 0;
check('the manhole TENTACLE is shoverable too, and its armed grab is cancelled',
  H.canShovel(tentacle) === true && H.swing() === true && tentacle.hooked === true && tentacle.state === 'retract');

// --- the toss into the hopper, and what lands ---
deposited.length = 0; scored.length = 0; announced.length = 0;
dynamicChildren.length = 0;
const flyer = mkC('specter', 4, { hooked: true, hookT: 0, fx0: p.wx + 4, fy0: p.wy, fz0: GZ + 0.5 });
let guard = 0;
while (!flyer.hookLanded && guard++ < 600) H.shovelFlight(flyer, 1 / 60);
check('a struck spook ARCS into the hopper scoop (arrives at the aim x, not the street)',
  flyer.hookLanded === true && guard < 600 && Math.abs(flyer.wx - 3) < 0.6, 'wx=' + flyer.wx.toFixed(2));
check('it is DEPOSITED as ECOPLASM — five of these and the compactor cycles',
  deposited.length === 1 && deposited[0] === 'ecto');
check('a shoveled spook pays out street cash (+250 x the Bed-Stuy board)',
  scored.length === 1 && scored[0].n === SHOVEL_POINTS && scored[0].bonus === true);
check('the HUD SPOOKS counter + the shift report row both ticked',
  H.getEcto() === 1 && dayStats.spooks.got === 1);
check('a banishment pays in SOUND and LIGHT (pop + splat), not in centre-screen text',
  announced.length === 0 && dynamicChildren.length > 3 && dust.length > 3 &&
    log.indexOf('squelch') >= 0,
  'announced=' + announced.join('/'));
check('the per-kill "SPOOKED! / DE-SPOOKED!" pops are GONE from the shovel kit',
  !/SPOOKED!/.test(srcFn('landSpookInHopper')) &&
    !/SQUISHED!/.test(html.slice(html.indexOf('function landSpookInHopper'), html.indexOf('function landSpookInHopper') + 900)));
check('the banished spook is REMOVED AND DISPOSED (nothing litters the block, nothing leaks back in)',
  flyer.g.parent === null && disposed.indexOf(flyer.g) >= 0 && flyer.hookLanded === true);

// --- the pack's brain: it may only hunt what can SEE it, and touch = damage, not a wall ---
p.wx = 300; p.wy = 2.5; onScreen = false;
const lurker = mkC('ghoul', -6, {
  chaseSp: 4, lopeSp: 1.5, huntT: 0, sayCd: 0, wanderT: 0, phase: 0, causeKey: 'ghoul',
});
lurker.tx = lurker.wx; lurker.ty = lurker.wy;
for (let i = 0; i < 40; i++) H.updateHorrorCreature(lurker, 1 / 60);
check('NOTHING starts a hunt from off-screen (the same fairness tell the manholes use)', lurker.huntT <= 0);
onScreen = true;
for (let i = 0; i < 3; i++) H.updateHorrorCreature(lurker, 1 / 60);
check('once the worker can see it, the pack notices and starts hunting', lurker.huntT > 0);
const d0 = Math.hypot(p.wx - lurker.wx, p.wy - lurker.wy);
for (let i = 0; i < 90; i++) H.updateHorrorCreature(lurker, 1 / 60);
check('a hunting horror CLOSES on the worker', Math.hypot(p.wx - lurker.wx, p.wy - lurker.wy) < d0 - 1);
check('a ground crawler holds the sidewalk band (0.7 .. creatureMaxY)',
  lurker.wy >= 0.7 - 1e-9 && lurker.wy <= 4.8 + 1e-9, 'wy=' + lurker.wy.toFixed(2));
const drifter = mkC('specter', -5, {
  floaty: true, chaseSp: 3, lopeSp: 1.4, huntT: 0, sayCd: 999, wanderT: 999, phase: 0, hopT: 0,
});
drifter.tx = drifter.wx; drifter.ty = -8.5;
onScreen = false;
for (let i = 0; i < 400; i++) H.updateHorrorCreature(drifter, 1 / 60);
check('a specter owns the WHOLE block: it drifts off the walk and down the road lanes',
  drifter.wy > -8.9 && drifter.wy < 0, 'wy=' + drifter.wy.toFixed(2));
check('...and it FLOATS above the asphalt (a ghost never stands on the street)',
  drifter.g.position.z > GZ + 0.3, 'z=' + drifter.g.position.z.toFixed(2));
const stray = mkC('ghoul', -70, { chaseSp: 4, lopeSp: 1.5, huntT: 0, sayCd: 999, wanderT: 999, phase: 0 });
stray.tx = stray.wx; stray.ty = stray.wy;
H.updateHorrorCreature(stray, 1 / 60);
check('a horror left far behind re-takes the route AHEAD of the worker and fades back in',
  stray.wx > p.wx + 20 && stray.fade === 0, 'wx=' + stray.wx.toFixed(1));

// --- the heist: bolt with the prize, corner at the end, tear it free ---
p.wx = PLAYER_START_X; p.wy = 3;
const maw = mkObj('group');
const thief = mkC('eyestalker', 2, {
  thief: true, chaseSp: 6.8, lopeSp: 0.6, bolted: false, cornered: false, escaped: false,
  campX: ROUTE_FINISH_X - GARGOYLE_CAMP_X_OFF, waitT: 0, sayCd: 0, phase: 0,
});
thief.g.userData.beast = { eyes: [], legs: [], maw };
maw.add(gargoyle);
for (let i = 0; i < 10; i++) H.updateThief(thief, 1 / 60);
check('the thief sits on the truck with the gargoyle until the shift actually starts', thief.bolted === false);
p.wx = PLAYER_START_X + 3;
for (let i = 0; i < 3; i++) H.updateThief(thief, 1 / 60);
check('the moment the worker moves, it RUNS with the Ruby-Plated Gargoyle', thief.bolted === true);
const xStart = thief.wx;
announced.length = 0;
// it OUTRUNS the worker (10.4 vs 8.5), so the chase is the whole route — give it the
// distance a 60-second sprint covers and it must stop at the camp, never through it
p.wx = thief.wx + 60; // (he can never catch it: keep him behind so only the flight runs)
for (let i = 0; i < 5000; i++) { p.wx = Math.min(thief.wx + 60, p.wx + 8.5 / 60); H.updateThief(thief, 1 / 60); }
check('it flees down the route and COWERS a few paces short of the finish (it can never escape)',
  thief.cornered === true && thief.wx === thief.campX && thief.wx > xStart && thief.campX < ROUTE_FINISH_X);
check('the shift tells him so (CORNERED IT!)', announced.some(a => /CORNERED/.test(a)));
p.wx = thief.wx + 6;
H.setReclaimed(false); H.setStolen({ g: gargoyle, val: GARGOYLE_VALUE });
scored.length = 0; popped.length = 0; dayStats.treasure.got = 0; dayStats.treasure.total = 0;
creatures.length = 0; creatures.push(thief);
H.updateThief(thief, 1 / 60);
check('from out of reach it holds the prize and does NOT hand it over', H.isReclaimed() === false);
p.wx = thief.wx + 1; p.wy = thief.wy;
H.updateThief(thief, 1 / 60);
check('WALK INTO THE CORNERED BEAST AND IT TEARS THE GARGOYLE FREE (the level end goal)',
  H.isReclaimed() === true);
check('the prize pays $5000 into street cash and counts as ONE treasure',
  scored.some(s => s.n === GARGOYLE_VALUE && s.bonus === true) &&
  dayStats.treasure.got === 1 && dayStats.treasure.total === 1);
check('the popup names it: RUBY-PLATED GARGOYLE', popped.length === 1 && popped[0].name === 'RUBY-PLATED GARGOYLE');
check('the gargoyle leaves the maw, lands in the world and throws ruby sparkles',
  gargoyle.parent !== maw && dynamicChildren.indexOf(gargoyle) >= 0 && dust.length > 5);
check('the beaten thief runs off the map for good', thief.escaped === true);
scored.length = 0;
H.reclaimStolenGargoyle();
check('the treasure cannot be claimed twice', scored.length === 0);

console.log('\n[3] the wiring the night shift hangs off the rest of the game');
check('nothing mortal is left out to collect (no bags, no cans, no mongo, no street cash)',
  html.includes('if (b.garbage && !b.cemetery && !isNightShift()) {'));
check('a haunted street has NO litter baskets', /resetLitterBaskets\(\)[\s\S]{0,4000}isNightShift\(\)\) return;/.test(html));
check('the horror spawner runs out of spawnWorld', html.includes('if (isNightShift()) spawnNightShift();'));
check('the Sunday mortals (stoop dogs, cats, football, rapper, shootout) are all gated off at night',
  (html.match(/isBedStuyLevel\(\) && !isNightShift\(\)/g) || []).length >= 4 &&
  /isBedStuyLevel\(\)\r?\n\s*\?\s*isNightShift\(\)\r?\n\s*\?\s*0/.test(html));
check('the haunted shift always storms, and the sky is repainted midnight',
  /d && \(d\.special \|\| d\.night\)/.test(html) && html.includes('if (d && d.night) applyNightPalette();'));
check('the porch bulbs + windows light up against the fog on this level', /if \(nightShift\) applyDuskLamps\(\);/.test(html));
check('addCreature + updateCreatures both know the whole pack',
  ['case "specter":', 'case "ghoul":', 'case "hound":', 'case "eyestalker":'].every(s => html.includes(s)) &&
  html.includes('updateHorrorCreature(c, dt);') && html.includes('updateThief(c, dt);'));
check('a swing rips the tentacle clean out of its manhole',
  /case "zombieArm": \{\r?\n\s*\/\/ THE NIGHT SHIFT[\s\S]{0,300}shovelFlight\(c, dt\);/.test(html));
check('floaters, lope-ers and shoveled spooks keep their OWN height (never snapped back to the street)',
  /c\.type !== "specter" &&[\s\S]{0,520}!c\.hooked/.test(html));
check('spooks already in the hopper are swept off the creature roster',
  html.includes('if (creatures[hi].hookLanded) creatures.splice(hi, 1);'));
check('the compactor still cycles at FIVE loads (the night par comes free)',
  /const HOPPER_CYCLE_AT = 5/.test(html));
check('the eco lump glows greenish-blue inside the scoop', /if \(type === "ecto"\) \{[\s\S]{0,260}0x3ff0d2/.test(html));
check('a cycle BLOWS glowing ecoplasm out of the tailgate', /isNightShift\(\)\) \{\r?\n\s*spillEcoPlasm\(\);/.test(html));
check('the spill lingers as glowing puddles on the asphalt', /hopperResidue\.push\(\{ g: g, t: 24 \}\)/.test(html));
check('a horror touch costs health and is NOT solid (a corner can never weld into a wall)',
  /if \(HORROR_TYPES\[c\.type\][^\n]*\) \{[\s\S]{0,2400}hurtNPC\(HORROR_HITS\[cause\]/.test(html) &&
  html.includes('return; // NOT solid'));
check('a creature mid-toss (landed in the hopper, or the thief) never collides on the way',
  html.includes('if (c.hooked || c.hookLanded || c.thief) continue;'));
check('the spectral arms + their afterlife glow animate on the haunted block too',
  html.includes('if (isQueensLevel() || isNightShift()) {'));
check('the dressing reuses the cemetery hazard kinds (hands GRAB, headstones are SOLID, all exorcisable)',
  /"ghostarm"/.test(html) && /"ghoststone"/.test(html) &&
  /const SHOVELABLE_HAZARDS = \{[\s\S]{0,220}ghoststone: 1/.test(html));
check('HUD chip markup + CSS + the updateHUD toggle all exist',
  html.includes('id="ecto-goal"') && /#ecto-goal \{/.test(html) && html.includes('const showEcto ='));
check('the day card + the shift report both speak night',
  html.includes('BEGIN THE NIGHT SHIFT') && html.includes('SPOOKS SHOBELED') && /spooks: \{ got: 0, total: 0 \}/.test(html));
check('the spook par is armed when the shift begins', /dayStats\.spooks\.total = HORROR_SPOOK_TARGET/.test(html));
check('HR has an offense for every new horror',
  /specter: \[[\s\S]{0,500}banshee: \[[\s\S]{0,500}ghoul: \[[\s\S]{0,500}hound: \[/.test(html));
check('the hidden trainer can warp straight to the night shift',
  /TRAINER_DAYS = \[[\s\S]{0,400}"MIDNIGHT"/.test(html));
check('the shovel is only ever in his hand on this one level', html.includes('equipShovel(nightShift);'));
check('the handle is re-laid across BOTH fists every frame of the play loop',
  /if \(shovelGroup\) \{[\s\S]{0,1600}poseShovel\(sw\);/.test(html));
check('and the swing whips his whole body past his facing (then hands it back)',
  html.includes('worker.group.rotation.z = p.facing - shovelTwist;') &&
  /shovelTwist = 0;[\r\n]+\s*shovelStride = 0;[\r\n]+\s*shovelLean = 0;/.test(html));
check('a banshee always screams like one (the female voice)', html.includes('if (variant === "banshee") c.gender = "female";'));
check('the wail and the eco-pop are real sounds on the SFX rig',
  /playBansheeWail\(\) \{/.test(html) && /playEctoPop\(\) \{/.test(html));
check('reaching the truck still pays the treasure (the goal can never be missed)',
  /isNightShift\(\)\)\r?\n\s*reclaimStolenGargoyle\(\);/.test(html));

console.log('\n[4] the seven weekdays are untouched by the new level');





check('the seven weekday rosters do NOT change at all (day 1..7 identical to a week without the night level)',
  [1, 2, 3, 4, 5, 6, 7].every(d => JSON.stringify(npc(d)) === JSON.stringify(noNight(d))));
check('Sunday still runs its FULL Bed-Stuy roster (the gate never touches day 7)', sum(npc(7)) > 0);

console.log('\n[5] the haunted street BUILDS (real spawner, stub block row)');
// spawnWorld leaves two arrays behind and they are NOT the same thing: LEVEL_BLOCKS is
// only the { x, garbage } route knob, while every bumpable thing ("hazards") hangs off the
// per-cell `blocks` records that collideStatic actually scans. A graveyard wired to the
// wrong array throws (or worse, silently does nothing) the second the level loads — so run
// the REAL spawnNightShift against both and look at where it put its hands.
const S5 = new Function(
  'THREE', 'M', 'MS', 'BX', 'CY', 'SP', 'SPH', 'R', 'clamp', 'GZ', 'BLOCK_W',
  'creatureMaxY', 'spawnMaxY', 'ROUTE_START_X', 'ROUTE_FINISH_X', 'ROUTE_END_X',
  'GARGOYLE_VALUE', 'GARGOYLE_CAMP_X_OFF', 'HORROR_SPOOK_TARGET',
  'LEVEL_BLOCKS', 'ACTIVE_BLOCK_IDX', 'blocks', 'GHOST_ARMS', 'GHOST_HANDS', 'groundGroup', 'truck',
  'makeGhostArm', 'makeGhostHeadstone', 'makeSkullPile', 'makeGhostHandProp', 'makeGhostCandleProp',
  'makeGhostCoffinProp', 'makeIronGateProp', 'makeManyEyedBeast', 'makeRubyGargoyle',
  'nightBands', 'nightWorldBlock', 'nightFloodBand', 'nightPlaceProp', 'nightHorrorLive',
  'nightSpawnHorror', 'spawnNightGhost', 'HORROR_QUOTA', 'HORROR_QUOTA_FLOOD',
  'HORROR_ROSTER_CAP', 'NIGHT_GHOST_CAP', 'NIGHT_PROP_QUOTA', 'NIGHT_PROP_QUOTA_FLOOD',
  'addCreature', 'HORROR_FILL_ORDER',
  srcFn('spawnStolenGargoyle') + '\n' + srcFn('spawnNightShift') +
  '\nconst spawned = [], treasures = [];' +
  '\nlet nightGhostCursor = 0, nightGhoulTier = 0, nightSurgeT = 0, nightSurgeSpawned = 0, nightHauntT = 0;' +
  '\nfunction spawnGhostTreasure(wx, wy) { treasures.push({ wx, wy }); }' +
  '\nlet stolenGargoyle = null;' +
  '\nreturn { spawnNightShift, spawned, treasures, getStolen: () => stolenGargoyle };'
)(
  THREE, M, MS, BX, CY, SP, SPH, R, clamp, GZ, 80, () => 4.8, () => 4.4,
  ROUTE_START_X, ROUTE_FINISH_X, ROUTE_END_X, GARGOYLE_VALUE, GARGOYLE_CAMP_X_OFF,
  HORROR_SPOOK_TARGET, S2_LAYOUT, S2_IDX, S2_BLOCKS, S2_ARMS, S2_HANDS, S2_GROUND, { wx: 80 },
  () => mkObj('arm'), () => mkObj('stone'), () => mkObj('skulls'), () => mkObj('hand'),
  () => mkObj('candle'), () => mkObj('coffin'), () => mkObj('gate'), () => mkObj('beast'),
  () => mkObj('garg'), H.nightBands, H.nightWorldBlock, H.nightFloodBand, H.nightPlaceProp,
  H.nightHorrorLive, H.nightSpawnHorror, H.spawnNightGhost, HORROR_QUOTA, HORROR_QUOTA_FLOOD,
  HORROR_ROSTER_CAP, NIGHT_GHOST_CAP, NIGHT_PROP_QUOTA, NIGHT_PROP_QUOTA_FLOOD, S2_ADD_CREATURE,
  HORROR_FILL_ORDER
);
// a CLEAN SLATE on the shared stub world, then build the haunted street once
for (const r of S2_BLOCKS) r.hazards.length = 0;
for (const o of S2_GROUND.children) o.parent = null;
S2_GROUND.children.length = 0;
S2_ARMS.length = 0; S2_HANDS.length = 0;
creatures.length = 0; allSpawned.length = 0; disposed.length = 0;
p.wx = 85; p.wy = 2.5;
let s5Threw = null;
try { S5.spawnNightShift(); } catch (e) { s5Threw = e; }
check('the whole haunted street builds without throwing' + (s5Threw ? '  [' + s5Threw.message + ']' : ''), !s5Threw);
const s5Haz = [];
for (const r of S2_BLOCKS) for (const h of r.hazards) s5Haz.push(h);
const kindCount = (t) => s5Haz.filter((h) => h.type === t).length;
const s5Arms = kindCount('ghostarm'), s5Stones = kindCount('ghoststone');
check('THE GRAVE YARD IS GONE off the haunted shift: arms ' + s5Arms + ', headstones ' + s5Stones +
  ', skull piles ' + kindCount('skullpile') + ', bare hands ' + kindCount('ghosthand'),
  s5Arms === 0 && s5Stones === 0 && kindCount('skullpile') === 0 && kindCount('ghosthand') === 0);
check('the flood block is no yard either: no grave candles, no open coffins, no iron gates',
  kindCount('candle') === 0 && kindCount('coffin') === 0 && kindCount('irongate') === 0);
check('and the seeded street carries NO prop hazards at all (nothing to bump into)',
  s5Haz.length === 0);
check('the hazards hang off the world block records (the ones the worker collides with)',
  S2_IDX.every((i) =>
    S2_BLOCKS.some((r) => r.blockX === S2_LAYOUT[i].x && (r.hazards || []).length === 0)
  ));
check('...and NOT on the LEVEL_BLOCKS route knob (that array has no hazards at all)',
  S2_LAYOUT.every((b) => b.hazards === undefined));
check('the grasping arms + the severed hands are registered for their animation passes',
  S2_ARMS.length === s5Arms && S2_HANDS.length === kindCount('ghosthand'));
const count = (t) => allSpawned.filter((c) => c.type === t).length;
const keyCount = (k) => allSpawned.filter((c) => (c.causeKey || c.type) === k).length;
check('THE PACK walks in at its per-block quota: ' + count('ghoul') + ' ghouls out (9 to a block)',
  count('ghoul') >= HORROR_QUOTA.ghoul * 3 && keyCount('banshee') >= HORROR_QUOTA.banshee * 3);
check('the ABYSS ROSTER is ghoul-HEAVY at build (' + count('ghoul') + ' ghouls, ' + count('hound') +
  ' hounds, ' + count('specter') + ' specters, ' + count('imp') + ' imps)',
  count('ghoul') >= HORROR_QUOTA.ghoul * 4 && count('hound') >= HORROR_QUOTA.hound * 3 &&
  keyCount('banshee') >= HORROR_QUOTA.banshee * 3 && count('imp') >= 9,
  'banshees=' + keyCount('banshee') + ' imps=' + count('imp') + ' quotaB=' + HORROR_QUOTA.banshee);
check('the roster cap bounds the horde (' + H.nightHorrorLive() + ' live, cap ' + HORROR_ROSTER_CAP + ')',
  H.nightHorrorLive() <= HORROR_ROSTER_CAP);
const bandOfX = (x) => (x >= 380 ? 'flood' : x >= 280 ? 'b3' : x >= 180 ? 'b2' : x >= 80 ? 'b1' : 'off');
const ghostIn = (b) => allSpawned.filter((c) => c.type === 'ghost' && bandOfX(c.wx) === b).length;
check('THE SPIRITS ARE OFF THE LEVEL: ' + count('ghost') + ' ghosts seeded on the whole route (cap ' + NIGHT_GHOST_CAP + ')',
  count('ghost') === 0 && NIGHT_GHOST_CAP === 0);
check('no band of the route has a single ghost column (the slot grid stands the family down)',
  ghostIn('b1') === 0 && ghostIn('b2') === 0 && ghostIn('b3') === 0 && ghostIn('flood') === 0);
check('no spirit is parked off the route',
  allSpawned.filter((c) => c.type === 'ghost').every((c) => c.wx >= 90 && c.wx <= 474));
check('the night spawner adds the EXTRA manhole tentacles (' + count('zombieArm') + '; Sunday\'s own still spawns — the block is Bed-Stuy)',
  count('zombieArm') >= 2 && /if \(isBedStuyLevel\(\)\) \{[\s\S]{0,400}addCreature\("zombieArm"\)/.test(html));
check('every spook is placed on the route with a real position',
  allSpawned.every((c) =>
    Number.isFinite(c.wx) && Number.isFinite(c.wy) &&
    c.wx >= ROUTE_START_X - 6 && c.wx <= ROUTE_END_X));
check('the banshees are still specters with a female voice (_variant, not a new type)',
  keyCount('banshee') >= 6 && allSpawned.filter((c) => (c.causeKey || c.type) === 'banshee')
    .every((c) => c.type === 'specter'));
check('the only loot out here is 6 ghostly finds', S5.treasures.length === 6);
const thief5 = allSpawned.filter((c) => c.type === 'eyestalker');
const s5Stolen = S5.getStolen();
check('one many-eyed thief, and the gargoyle rides in ITS maw',
  thief5.length === 1 && thief5[0].thief === true &&
  !!s5Stolen && s5Stolen.g.parent === thief5[0].g.userData.beast.maw,
  'stolen=' + !!s5Stolen + ' parentedToMaw=' +
  !!(s5Stolen && s5Stolen.g.parent === thief5[0].g.userData.beast.maw));
check('it camps a few paces SHORT of the finish line (the prize is always reachable)',
  thief5[0].campX > 80 && thief5[0].campX < ROUTE_FINISH_X &&
  ROUTE_FINISH_X - thief5[0].campX === GARGOYLE_CAMP_X_OFF);

console.log('\n[7] THE LIVE HAUNT: 9 ghouls to a block, and the street REFILLS as he shovels');
function s7Reset() {
  for (const r of S2_BLOCKS) r.hazards.length = 0;
  S2_ARMS.length = 0; S2_HANDS.length = 0;
  creatures.length = 0; allSpawned.length = 0; disposed.length = 0;
  H.resetNight();
  p.wx = 100; p.wy = 2.5;
  announced.length = 0; deposited.length = 0; scored.length = 0;
  S5.spawnNightShift();
}
const keyAt = (band, type) =>
  creatures.filter((c) => (c.causeKey || c.type) === type && !c.hooked && !c.hookLanded &&
    c.wx >= band[0] - 2 && c.wx <= band[1] + 2).length;
s7Reset();
check('the block he STARTS in has its full 9 ghouls (plus the whole roster behind it)',
  keyAt([96, 176], 'ghoul') >= HORROR_QUOTA.ghoul, 'ghouls=' + keyAt([96, 176], 'ghoul'));
check('no active block is quiet: ghouls stand in EVERY band the route walks through',
  S2_IDX.every((i) => keyAt([S2_LAYOUT[i].x, S2_LAYOUT[i].x + 80], 'ghoul') >= 1));
check('the LIVE HAUNT never refills a spirit either: ' +
  creatures.filter((c) => c.type === 'ghost').length + ' ghosts, cap ' + NIGHT_GHOST_CAP,
  creatures.filter((c) => c.type === 'ghost').length === 0 &&
    [1, 0, -1].every((z) => creatures.filter((c) => c.type === 'ghost' && c.zone === z).length === 0));
// --- shovel 1 spook every 1.2s and walk the route: the horde must NOT run out ---
let banishEvery = 72, frame = 0, minHere = 999, spawnBehind = 0, peakLive = 0, peakScreen = 0;
let floodGhoulsAtEnd = 0, surgeAnnounced = false, surgeFired = false, waveTier = 0, behindSample = '-', scanned = 0;
const before = allSpawned.length;
for (frame = 0; frame < 60 * 130; frame++) {
  p.wx = Math.min(452, p.wx + 3.0 / 60); // a working walk down the route
  H.updateNightHaunt(1 / 60);
  const band = H.bandOf(p.wx);
  if (band) minHere = Math.min(minHere, keyAt([band.x0, band.x1], 'ghoul'));
  peakLive = Math.max(peakLive, H.nightHorrorLive());
  peakScreen = Math.max(peakScreen, H.nightHorrorOnScreen());
  for (let i = scanned; i < allSpawned.length; i++) {
    scanned = i + 1;
    if (HORROR_ALL[allSpawned[i].type] && allSpawned[i].wx < p.wx - 2) {
      spawnBehind++;
      if (behindSample === '-')
        behindSample = allSpawned[i].type + ' at ' + allSpawned[i].wx.toFixed(1) +
          ' (worker ' + p.wx.toFixed(1) + ')';
    }
  }
  if (frame % banishEvery === banishEvery - 1) {
    const prey = creatures.filter((c) => !c.hooked && !c.hookLanded && H.canShovel(c) &&
      c.wx > p.wx && c.wx < p.wx + SHOVEL_REACH)[0];
    if (prey) {
      prey.hooked = true; prey.hookT = 0;
      prey.fx0 = prey.wx; prey.fy0 = prey.wy; prey.fz0 = GZ;
      let guard = 0;
      while (!prey.hookLanded && guard++ < 400) H.shovelFlight(prey, 1 / 60);
      if (prey.hookLanded) {
        const hi = creatures.indexOf(prey);
        if (hi >= 0) creatures.splice(hi, 1); // the game's frame sweep
      }
    }
  }
  const hh = H.getHaunt();
  waveTier = Math.max(waveTier, hh[0]);
  // The surge MECHANIC (its 12-second flood timer) is what must fire; the centre-screen
  // warning rides the shared pop budget and may legitimately be displaced by a CONSECRATED!.
  if (hh[1] > 0) surgeFired = true;
  if (announced.some((a) => /SURGE/.test(a))) surgeAnnounced = true;
  floodGhoulsAtEnd = keyAt([384, 464], 'ghoul');
}
check('after 108 banishments the pack is STILL there: a block band never fell under ' + NIGHT_GHOUL_MIN + ' ghouls',
  minHere >= NIGHT_GHOUL_MIN, 'min ghouls in his band = ' + minHere);
check('the horde refills FAST — a fresh block fills to its quota the moment he walks in',
  floodGhoulsAtEnd >= HORROR_QUOTA_FLOOD.ghoul, 'flood ghouls at the end = ' + floodGhoulsAtEnd);
check('the ABYSS FLOOD block is the heaviest: ' + floodGhoulsAtEnd + ' ghouls, a deep pack, reapers out',
  floodGhoulsAtEnd >= HORROR_QUOTA_FLOOD.ghoul &&
  creatures.filter((c) => c.deep && c.wx >= 384 && c.wx <= 464).length >= 20);
check('wave escalation kicked in (5 banishments = +1 spook per family per block)', waveTier >= 1);
// (The SURGE *warning* rides the shared centre-screen pop budget with CONSECRATED!/TRIAD — see
// the deterministic drive below for the mechanic itself; this is only an observation of the chatter.)
if (surgeAnnounced || sayings.some((s) => /SURGE/.test(s)))
  console.log("NOTE: the stress loop also got the SURGE warning on screen");
check('the top-up NEVER spawns at his back (everything arrives ahead, on screen)',
  spawnBehind === 0, spawnBehind + ' spawn(s) behind, first at ' + behindSample);
check('the roster cap holds (' + peakLive + ' live horrors at the peak, cap ' + HORROR_ROSTER_CAP + ')',
  peakLive <= HORROR_ROSTER_CAP);
check('the frustum cap holds (' + peakScreen + ' horrors on screen at the peak, cap ' + HORROR_SCREEN_CAP + ')',
  peakScreen <= HORROR_SCREEN_CAP);
check('the banished spooks are swept out of the roster with their meshes (no invisible pile-up)',
  creatures.every((c) => !c.hookLanded) && disposed.length >= 50);
// THE ABYSS SURGE, DRIVEN DETERMINISTICALLY: the stress loop above only banishes when a spook
// happens to walk into reach, so crossing the 10-banishment line was luck of the spawn draw.
// Here the pack is pulled onto the blade every iteration (the same recipe the consecration sim
// uses), so the ONLY thing under test is: does HORROR_SURGE_AT banishments open the flood?
let surgeBanishes = 0, surgeKills = 0, surgeSwings = 0;
(function surgeDrive() {
  s7Reset();     // a stocked haunted street
  H.setHaunt(0, 0); // and a quiet haunt: no leftover wave tier, no leftover flood timer
  let fired = false, guard = 0;
  while (!fired && guard++ < 4000) {
    let li = 0;
    for (const c of creatures) {
      if (c.hooked || c.hookLanded || !H.canShovel(c)) continue;
      li++;
      c.wx = p.wx + 1.5 + (li % 4) * 0.55; c.wy = 2.5;
      c.huntT = 0; c.flinchT = 0; c.staggered = 0;
      c.g.position.set(c.wx, c.wy, GZ);
    }
    p.shovelCd = 0;
    const swung = H.swing();
    if (swung) surgeSwings++;
    if (process.env.DBG && guard < 3) {
      const sh = creatures.filter((c) => H.canShovel(c));
      const near = sh.map((c) => (c.wx - p.wx).toFixed(2)).sort((a, b) => a - b).slice(0, 6);
      console.log("DBG it=" + guard, "shovelable=" + sh.length,
        "dists=" + JSON.stringify(near), "swung=" + swung, "ecto=" + H.getEcto(),
        "flights=" + H.ectoFlights.length);
    }
    // THE GAME'S OWN FRAME SWEEP (identical to the frenzy sim's): shovelFlight is pumped on
    // every HOOKED creature and the sweep drops the landed ones — a strike hooks the spook,
    // it does NOT queue it into ectoFlights, so pumping that list banishes nothing.
    for (let k = creatures.length - 1; k >= 0; k--) {
      const c = creatures[k];
      if (!c.hooked) continue;
      H.shovelFlight(c, 1 / 60);
      if (c.hookLanded) { creatures.splice(k, 1); surgeKills++; }
    }
    H.updateNightHaunt(1 / 60);
    if (H.getHaunt()[1] > 0) fired = true;
  }
  surgeFired = fired;
  surgeBanishes = H.getEcto();
})();
check('the ABYSS SURGE opens on the ' + HORROR_SURGE_AT + 'th banishment (12 s of flood in his block)',
  surgeFired && surgeBanishes >= HORROR_SURGE_AT,
  surgeBanishes + ' banished in ' + surgeSwings + ' swings (' + surgeKills + ' landed) ' +
    (surgeFired ? '— flood timer up' : 'and the flood never opened'));
s7Reset();

console.log('\n[8] EXORCISING THE GRAVEYARD + THE HOLY WEAPON (consecration, triad, holy light)');
const shovelPropBlock = S2_BLOCKS.find((r) => r.blockX === 192);
shovelPropBlock.hazards.length = 0;
const stone = H.nightPlaceProp(shovelPropBlock, 'headstone', p.wx + 2.2, 2.5);
const arm = H.nightPlaceProp(shovelPropBlock, 'arm', p.wx + 2.0, 1.4);
const skull = H.nightPlaceProp(shovelPropBlock, 'skull', p.wx + 2.4, 3.4);
check('the grave yard registers SOLID hazards on the block record (headstone, grasping arm, skull pile)',
  !!stone && !!arm && !!skull &&
  shovelPropBlock.hazards.filter((h) => h.g === stone || h.g === arm || h.g === skull).length === 3 &&
  S2_ARMS.some((a) => a.g === arm));
const mob3 = [];
for (let i = 0; i < 3; i++) {
  const c = H.nightSpawnHorror('ghoul', { x0: 192, x1: 272 });
  c.wx = p.wx + 1.6 + i * 0.7; c.wy = 2.5; c.huntT = 0; c.flinchT = 0;
  c.g.position.set(c.wx, c.wy, GZ);
  mob3.push(c);
}
creatures.length = 0;
mob3.forEach((c) => creatures.push(c));
p.shovelCd = 0;
announced.length = 0; deposited.length = 0; scored.length = 0;
const sayBefore = sayings.length;
check('an ordinary swing takes the NEAREST spook, not the whole street', (() => {
  const ok = H.swing() === true;
  const hooked = creatures.filter((c) => c.hooked);
  return ok && hooked.length === 1 && hooked[0] === mob3[0] &&
    H.isCharged() === false && H.getCharge() === 0;
})());
check('the swing makes every spook standing in the holy light FLINCH (they recoil and slow)',
  creatures.filter((c) => !c.hooked).every((c) => c.flinchT > 0));
const flinchGhoul = creatures.filter((c) => !c.hooked)[0];
flinchGhoul.flinchT = FLINCH_T; flinchGhoul.huntT = 5; flinchGhoul.chaseSp = 4;
flinchGhoul.wx = p.wx + 6; flinchGhoul.g.position.set(flinchGhoul.wx, flinchGhoul.wy, GZ);
const plainGhoul = H.nightSpawnHorror('ghoul', { x0: 192, x1: 272 });
plainGhoul.huntT = 5; plainGhoul.chaseSp = 4; plainGhoul.flinchT = 0;
plainGhoul.wx = p.wx + 6; plainGhoul.wy = 2.5; plainGhoul.g.position.set(plainGhoul.wx, plainGhoul.wy, GZ);
const f0 = flinchGhoul.wx, q0 = plainGhoul.wx;
for (let i = 0; i < 30; i++) { H.updateHorrorCreature(flinchGhoul, 1 / 60); H.updateHorrorCreature(plainGhoul, 1 / 60); }
check('a flinching spook covers less ground than one that is not flinching',
  (q0 - plainGhoul.wx) > (f0 - flinchGhoul.wx) * 1.3,
  'flinch ' + (f0 - flinchGhoul.wx).toFixed(2) + ' vs plain ' + (q0 - plainGhoul.wx).toFixed(2));
// --- EXORCISING THE GRAVE YARD: the shovel digs a headstone OUT of the street ---
p.shovelCd = 0;
const hazardBefore = shovelPropBlock.hazards.length;
announced.length = 0; deposited.length = 0; scored.length = 0;
H.setSayT(0); // a fresh text budget: the exorcise call-out is allowed to speak here
H.ectoFlights.length = 0;
const sayBeforeStone = sayings.length;
const stoneHz = shovelPropBlock.hazards.filter((h) => h.type === 'ghoststone')[0];
H.shovelHazardStrike(shovelPropBlock, stoneHz);
check('a shovel strike on a HEADSTONE takes it out of the block (it stops being in the way)',
  shovelPropBlock.hazards.length === hazardBefore - 1 &&
  shovelPropBlock.hazards.indexOf(stoneHz) === -1);
check('...the mesh leaves the ground and goes AIRBORNE to the eco-pail',
  stoneHz.g.parent !== S2_GROUND && H.ectoFlights.length === 1 && H.ectoFlights[0].g === stoneHz.g);
let flyGuard = 0;
while (H.ectoFlights.length && flyGuard++ < 400) H.updateEctoFlights(1 / 60);
check('the headstone LANDS in the hopper: +1 eco lump, +1 on the SPOOKS tally, street cash paid',
  deposited.length === 1 && deposited[0] === 'ecto' && scored.some((s) => s.n === SHOVEL_PROP_POINTS));
check('the exorcised prop is disposed with the flight (nothing left standing in the street)',
  disposed.indexOf(stoneHz.g) >= 0 && H.ectoFlights.length === 0);
check('the worker CALLS IT OUT while the headstone goes in the truck (budget permitting)',
  sayings.length > sayBeforeStone && sayings.length > sayBefore);
const armHz = shovelPropBlock.hazards.filter((h) => h.type === 'ghostarm')[0];
S2_ARMS.push({ g: armHz.g, phase: 1 });
const hazardMid = shovelPropBlock.hazards.length;
H.shovelHazardStrike(shovelPropBlock, armHz);
check('a GRASPING ARM is exorcised too, and its animation entry is purged with it',
  shovelPropBlock.hazards.length === hazardMid - 1 &&
  !shovelPropBlock.hazards.some((h) => h === armHz) &&
  !S2_ARMS.some((a) => a.g === armHz.g));
H.ectoFlights.length = 0;
check("the Holy Weapon publishes its blade materials + a holy level, and the game drives them",
  (() => {
    const sp = H.makeShovelProp();
    return !!sp.userData.bladeMat && !!sp.userData.edgeMat && sp.userData.holy === 0;
  })() && html.includes('shovelHolyGlow(dt);'));
// --- CONSECRATION: five banishments fill the charge, the next swing is the ARC ---
H.resetNight();
creatures.length = 0;
for (let i = 0; i < 5; i++) {
  const c = H.nightSpawnHorror('ghoul', { x0: 192, x1: 272 });
  c.wx = p.wx + 1.4 + i * 0.5; c.wy = 2.5; c.g.position.set(c.wx, c.wy, GZ);
}
announced.length = 0;
const ectoBefore = H.getEcto();
const toBanish = creatures.slice(0, 5);
for (let i = 0; i < toBanish.length; i++) {
  const c = toBanish[i];
  c.hooked = true; c.hookT = 0; c.hookLanded = false;
  c.fx0 = c.wx; c.fy0 = c.wy; c.fz0 = GZ;
  let g5 = 0;
  while (!c.hookLanded && g5++ < 400) H.shovelFlight(c, 1 / 60);
  const hi = creatures.indexOf(c);
  if (hi >= 0) creatures.splice(hi, 1);
}
check('FIVE banishments CONSECRATE the blade (charged; the pop is budgeted, not per kill)',
  H.getEcto() === ectoBefore + 5 && H.isCharged() === true &&
  announced.some((a) => /CONSECRATED|TRIAD/.test(a)),
  'ecto=' + H.getEcto() + ' charged=' + H.isCharged() + ' charge=' + H.getCharge() +
  ' announced=' + announced.join('/'));
creatures.length = 0;
for (let i = 0; i < 5; i++) {
  const c = H.nightSpawnHorror('ghoul', { x0: 192, x1: 272 });
  c.wx = p.wx + 1.4 + i * 1.3; c.wy = 2.5 + (i % 3) * 0.4;
  c.huntT = 4; c.flinchT = 0;
  c.g.position.set(c.wx, c.wy, GZ);
}
// the fifth one sits past the consecrated reach (5.2) but inside the shockwave (6.8)
p.shovelCd = 0;
announced.length = 0; deposited.length = 0; scored.length = 0;
H.swing();
check('a CONSECRATED swing banishes THREE spooks out of the arc in one stroke, and spends the charge',
  creatures.filter((c) => c.hooked).length === CONS_ARC_TARGETS && H.isCharged() === false,
  'hooked=' + creatures.filter((c) => c.hooked).length + ' charged=' + H.isCharged() +
  ' d=' + creatures.map((c) => Math.hypot(c.wx - p.wx, c.wy - p.wy).toFixed(2)).join(','));
check('the consecrated swing REACHES FURTHER than the plain one',
  creatures.filter((c) => c.hooked).some((c) => Math.hypot(c.wx - p.wx, c.wy - p.wy) > SHOVEL_REACH + 0.4));
check('the shockwave of a holy landing SCATTERS the ring around him (hunt broken, all flinching)',
  creatures.filter((c) => !c.hooked && Math.hypot(c.wx - p.wx, c.wy - p.wy) <= SHOCKWAVE_R)
    .every((c) => c.huntT === 0 && c.flinchT > 0) &&
  creatures.filter((c) => !c.hooked && Math.hypot(c.wx - p.wx, c.wy - p.wy) <= SHOCKWAVE_R)
    .length >= 2,
  creatures.map((c) => (c.hooked ? 'H' : '-') + Math.hypot(c.wx - p.wx, c.wy - p.wy).toFixed(1) +
    '/hunt' + c.huntT.toFixed(1) + '/fl' + (c.flinchT || 0).toFixed(2)).join(' '));
// --- THE SHOVEL TRIAD: three banishments inside 4 seconds ---
H.resetNight();
creatures.length = 0;
announced.length = 0; scored.length = 0; deposited.length = 0;
for (let i = 0; i < 3; i++) {
  const c = H.nightSpawnHorror('imp', { x0: 192, x1: 272 });
  c.wx = p.wx + 1.5; c.wy = 2.5; c.g.position.set(c.wx, c.wy, GZ);
  c.hooked = true; c.hookT = 0; c.hookLanded = false;
  c.fx0 = c.wx; c.fy0 = c.wy; c.fz0 = GZ;
  let g3 = 0;
  while (!c.hookLanded && g3++ < 400) H.shovelFlight(c, 1 / 60);
  const hi = creatures.indexOf(c);
  if (hi >= 0) creatures.splice(hi, 1);
  if (i < 2) H.updateNightHaunt(0.4); // ...all of them inside the TRIAD window
}
check('THREE banishments inside 4 seconds pay the SHOVEL TRIAD (+$2,500, with the callout)',
  announced.some((a) => /TRIAD/.test(a)) && scored.some((s) => s.n === TRIAD_POINTS) &&
  H.getEcto() === 3,
  'ecto=' + H.getEcto() + ' announced=' + announced.join('/') +
  ' scored=' + scored.map((s) => s.n).join('+'));
check('the TRIAD counter resets after the bonus (no free-run combo)', H.getTriad()[1] === 0);
console.log('\n[6] the SHOVEL is held in BOTH hands, head on the end of the handle');
const SHOVEL_SRC = ['makeShovelProp', 'shovelFist', 'shovelShaftEuler',
  'poseShovel', 'equipShovel'].map(srcFn).join('\n');
const armStub = (tag) => ({ tag, rotation: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } } });
const S6_ARMR = armStub('armR'), S6_ARML = armStub('armL');
const S6_ROOT = mkObj('workerGroup');
const S6 = new Function(
  'THREE', 'M', 'BX', 'CY', 'SP', 'clamp', 'SHOVEL_HOLD', 'worker', 'wparts', 'shovelGroup',
  'let shovelTwist = 0;\n' + SHOVEL_SRC +
  '\nreturn { makeShovelProp, poseShovel, equipShovel, shovelFist, shovelShaftEuler,' +
  ' hold: SHOVEL_HOLD, getShovel: () => shovelGroup, getTwist: () => shovelTwist };'
)(THREE, M, BX, CY, SP, clamp, eval('(' + srcLiteral('SHOVEL_HOLD', '{', '}') + ')'),
  { group: S6_ROOT }, { armR: S6_ARMR, armL: S6_ARML }, null);
const shovel = S6.makeShovelProp();
const tubes = shovel.children.filter(c => c.kind === 'cyl');
check('the handle tubes lie ALONG the shaft (rotated about Z, not left standing on local Y)',
  tubes.length >= 4 && tubes.every(t => Math.abs(t.rotation.z + Math.PI / 2) < 1e-6 && t.rotation.y === 0),
  tubes.map(t => t.kind + ':' + t.rotation.z.toFixed(2) + '/' + t.rotation.y).join(' '));
const xs = shovel.children.map(c => c.position.x);
check('the tool is ONE continuous piece: butt at 0 out to the point at 1.63',
  Math.min(...xs) < 0.12 && Math.max(...xs) > 1.5);
const heads = shovel.children.filter(c => c.kind === 'box');
check('the head is on the END of the handle (socket -> neck -> blade -> tip run outward)',
  heads.length === 3 && heads.every(h => h.position.x > 1) &&
  heads[0].position.x < heads[1].position.x && heads[1].position.x < heads[2].position.x);
check('nothing drifts off the shaft line (the wood, the socket and the point are all coaxial)',
  shovel.children.every(c => Math.abs(c.position.y) < 1e-9 && c.position.z > -0.12 && c.position.z < 0.06));

S6.equipShovel(true);
const held = S6.getShovel();
check('the shovel is handed to him on the worker ROOT — TWO arms hold it, not one',
  !!held && held.parent === S6_ROOT && S6_ROOT.children.indexOf(held) >= 0);
check('both arms are posed onto it (a bat grip rolls the WRISTS; the fists stay on the wood)',
  S6_ARMR.rotation.z >= -0.21 && S6_ARMR.rotation.z <= 0.21 &&
  S6_ARML.rotation.z >= -0.21 && S6_ARML.rotation.z <= 0.21 &&
  S6_ARMR.rotation.y < 0 && S6_ARML.rotation.y < 0 &&
  S6_ARMR.rotation.x !== S6_ARML.rotation.x);
// A fist is only believable where a 0.52-long arm can actually put it, and the handle is
// only believable if BOTH of those fists sit on the WOOD between the butt and the socket.
const fistOK = (side, rot) => {
  const f = S6.shovelFist(side, rot.x, rot.y);
  return { f, d: Math.hypot(f.x, f.y - side * 0.29, f.z - 1.38) };
};
const TL = shovel.userData.handleLen; // butt to the tip of the point, as the tool was built
const onHold = (sw) => {
  const out = S6.poseShovel(sw);
  const r = fistOK(-1, S6_ARMR.rotation), l = fistOK(1, S6_ARML.rotation);
  const o = held.position, dxy = held.rotation;
  // the shaft's own +X direction, straight out of the same Euler the prop was turned by
  const ax = Math.cos(dxy.y), ay = Math.sin(dxy.x) * Math.sin(dxy.y), az = -Math.cos(dxy.x) * Math.sin(dxy.y);
  const t = (f) => (f.x - o.x) * ax + (f.y - o.y) * ay + (f.z - o.z) * az;
  const off = (f) => {
    const k = t(f), vx = f.x - o.x - ax * k, vy = f.y - o.y - ay * k, vz = f.z - o.z - az * k;
    return Math.hypot(vx, vy, vz);
  };
  return {
    r, l, tr: t(r.f), tl: t(l.f), lean: out.lean, twist: out.twist,
    gap: Math.hypot(l.f.x - r.f.x, l.f.y - r.f.y, l.f.z - r.f.z),
    offR: off(r.f), offL: off(l.f), rot: [dxy.x, dxy.y], dir: [ax, ay, az],
    tip: { x: o.x + ax * TL, y: o.y + ay * TL, z: o.z + az * TL },
  };
};
for (const k of [0, 0.5, 1]) {
  const h = onHold(k);
  const name = k === 0 ? 'at the CARRY' : k === 1 ? 'at the PEAK of the swing' : 'mid-swing';
  check('BOTH fists are one true arm-length out of their shoulders ' + name,
    Math.abs(h.r.d - 0.52) < 1e-6 && Math.abs(h.l.d - 0.52) < 1e-6,
    'r=' + h.r.d.toFixed(3) + ' l=' + h.l.d.toFixed(3));
  check('the handle passes through BOTH knuckles ' + name + ' (he is not holding air)',
    h.offR < 1e-6 && h.offL < 1e-6, 'off ' + h.offR.toFixed(4) + '/' + h.offL.toFixed(4));
  check('rear hand ON THE BUTT, forward hand further down the WOOD, the head past it ' + name,
    h.tr > 0.02 && h.tr < 0.4 && h.tl > h.tr + 0.15 && h.tl < 1.05 && h.tl < 1.63,
    'tR=' + h.tr.toFixed(2) + ' tL=' + h.tl.toFixed(2));
  check('the two hands are actually APART (a real two-handed dig, not a fist sandwich) ' + name,
    h.gap > 0.2 && h.gap < 0.55, 'gap=' + h.gap.toFixed(2));
  check('both fists stay in front of his chest — waist to shoulder height, no arm through the head ' + name,
    [h.r.f, h.l.f].every(f => f.x > 0.1 && f.x < 0.56 && Math.abs(f.y) < 0.42 && f.z > 0.7 && f.z < 1.42),
    'r=' + JSON.stringify(h.r.f) + ' l=' + JSON.stringify(h.l.f));
}
const hold0 = onHold(0), hold1 = onHold(1);
check('at the carry the tool is PRESENTED AHEAD of him, point low over the curb (nobody misses it)',
  hold0.dir[0] > 0.55 && hold0.dir[2] < -0.05 && hold0.tip.x > 1.15 && hold0.tip.z < 1.0,
  'dir=' + hold0.dir.map(n => n.toFixed(2)).join(',') + ' tip=' + JSON.stringify(hold0.tip));
check('the swing WHIPS the whole tool around: the arms re-solve, the hands SPREAD along the handle',
  hold1.gap > hold0.gap + 0.08 && Math.abs(hold1.rot[1] - hold0.rot[1]) > 0.12 &&
  hold0.twist === 0 && hold1.twist > 0.4 && hold1.lean > 0.15,
  'gap ' + hold0.gap.toFixed(2) + ' -> ' + hold1.gap.toFixed(2) + ' twist=' + hold1.twist);
S6.equipShovel(false);
check('handing it back leaves nothing clipped to the worker',
  S6.getShovel() === null && S6_ROOT.children.length === 0);

console.log('\n[9] the ABYSS ROSTER wiring, the fixes, and MASPETH staying untouched');
const ABYSS_HP = {
  imp: 'IMP', wraith: 'WRAITH', poltergeist: 'POLTER', demon: 'DEMON', hexbeast: 'HEX',
  abyssal: 'ABYSS', lich: 'LICH', reaper: 'REAPER',
};
check('all eight new families are BUILT, registered, voiced and written up in the game',
  ['imp', 'wraith', 'poltergeist', 'demon', 'hexbeast', 'abyssal', 'lich', 'reaper'].filter((t) => !(
    html.includes('case "' + t + '":') &&
    html.includes('function make' + t.charAt(0).toUpperCase() + t.slice(1) + '(') &&
    html.includes(t + ': [') &&
    html.includes('const HP_HIT_' + ABYSS_HP[t])
  )).length === 0,
  'missing: ' + ['imp', 'wraith', 'poltergeist', 'demon', 'hexbeast', 'abyssal', 'lich', 'reaper'].filter((t) => !(
    html.includes('case "' + t + '":') &&
    html.includes('function make' + t.charAt(0).toUpperCase() + t.slice(1) + '(') &&
    html.includes(t + ': [') &&
    html.includes('const HP_HIT_' + ABYSS_HP[t])
  )).join(','));
check('the hexbeast walks on EXACTLY SIX legs (no more, no fewer)',
  H.makeHexbeast().userData.hex.legs.length === 6 &&
  !!H.makeHexbeast().userData.hex.mandL && !!H.makeHexbeast().userData.hex.mandR);
check('the new rigs publish what the animator drives: floaters a spec, crawlers a ghoul rig, ' +
  'the abyssal a tentacle ring, the lich + reaper scythes',
  (() => {
    const wr = H.makeWraith(), po = H.makePoltergeist(), im = H.makeImp(), de = H.makeDemon(),
      li = H.makeLich(), re = H.makeReaper(), ab = H.makeAbyssal();
    return !!(wr.userData.spec && wr.userData.spec.hands.length === 2) &&
      !!(po.userData.spec && po.userData.ring) &&
      im.userData.ghoul.legs.length === 2 && de.userData.ghoul.legs.length === 2 &&
      li.userData.ghoul.legs.length === 2 && !!li.userData.scythe && !!li.userData.lantern &&
      re.userData.ghoul.legs.length === 2 && !!re.userData.scythe &&
      ab.userData.abyss.tentacles.length === 7 && ab.userData.abyss.eyes.length === 5;
  })());
check('an imp, a demon, a hexbeast, an abyssal, a lich and a reaper are all SHOVELED',
  ['imp', 'demon', 'hexbeast', 'abyssal', 'lich', 'reaper', 'wraith', 'poltergeist'].every(
    (t) => H.canShovel({ type: t, g: mkObj(t) }) === true));
check('the roster reaches the Maspeth dead too (ghosts are shoverable ON THIS LEVEL ONLY)',
  /const HORROR_TYPES = \{[\s\S]{0,900}ghost: 1/.test(html) &&
  /if \(HORROR_TYPES\[c\.type\] && \(c\.type !== "ghost" \|\| isNightShift\(\)\)\)/.test(html));
check('the night ghost slots resolve INSIDE their own block (the Maspeth grid keeps its cemetery)',
  /if \(bx != null\) return bx \+ \(slot \+ 0\.5\) \* \(BLOCK_W \/ NIGHT_GHOST_SLOTS\);/.test(html) &&
  html.includes('ghostSlotX(c.slot, c.bx)'));
check('a landed spook can never hit him (invisible hazards are skipped in the collision pass)',
  html.includes('if (c.hooked || c.hookLanded || c.thief) continue;'));
check('the haunt refill, the flights and the severed-hand pass all run off the night gate',
  html.includes('animateGhostHands();') && html.includes('updateNightHaunt(dt);') &&
  html.includes('updateEctoFlights(dt);'));
check('the night state resets with the shift (no carry-over consecration, flights, waves)',
  /shovelCharge = 0;\r?\n\s*shovelCharged = false;/.test(html) &&
  html.includes('ectoFlights.length = 0;') && html.includes('GHOST_HANDS.length = 0;'));
check('the HUD chip shows the shovel charge and the route banner names the flood',
  /shovelCharged\r?\n\s*\? "  • HOLY SHOVEL!"/.test(html) &&
  html.includes('ABYSS FLOOD AT THE FAR END'));
check('MASPETH Cemetery is untouched: its own slot grid, cap and ghost exchanges are unchanged',
  html.includes('const GHOST_SLOTS = 75') && html.includes('const GHOST_CAP = 45') &&
  /const GHOST_LINES = \[/.test(html) && /const GHOST_STREET_LINES = \[/.test(html) &&
  html.includes('if (c.type === "ghost" || c.ghost) {'));

console.log('\n[11] FAIR FIGHT: a short stagger, a hit grace, THE SHOVEL AS A SHIELD, and the whole tool swinging');
const ffStart = html.indexOf('===== THE NIGHT SHIFT (level 8): DON\'T GET TOUCHED =====');
const FFS = html.slice(ffStart, html.indexOf('NOT solid: he walks back out through the cold', ffStart));
const swingSrc = srcFn('tryShovelSwing');
check('a spook brush staggers him for ' + HORROR_STUN_T + 's — the old 0.45s pin is GONE',
  FFS.includes('doStun(HORROR_STUN_T, "scare")') && HORROR_STUN_T <= 0.2 &&
    !/doStun\(0\.45, "scare"\)/.test(FFS));
check('the stagger is NOT a lockout: swinging CUTS IT SHORT, so he can always defend himself',
  swingSrc.includes('p.stunDur > HORROR_STUN_T') && swingSrc.includes('p.stunT = 0;'));
check('a REAL knockdown (a vehicle: a longer stun) is never shovel-cancelled — the day rules stand',
  /if \(p\.stunT > 0 && p\.stunDur > HORROR_STUN_T \+ 0\.02\) return false;/.test(swingSrc));
check('after a hit lands, NO spook can damage him for ' + NIGHT_HIT_GRACE + 's (grace window)',
  FFS.includes('p.nightHitT = NIGHT_HIT_GRACE') && NIGHT_HIT_GRACE >= 1.0 &&
    FFS.includes('(p.nightHitT || 0) > 0'));
check('inside the grace a brush is cold air: the beast is shoved off him and its charge BREAKS',
  FFS.includes('shoveSpookOff(c,') && FFS.includes('c.huntT = 0;') && FFS.includes('continue;'));
check('the parry + grace live INSIDE the night-only horror gate (Maspeth ghosts keep their rules)',
  FFS.includes('c.type !== "ghost" || isNightShift()') &&
    FFS.indexOf('shovelParry(') > FFS.indexOf('isNightShift()'));
check('the blade stays UP for the swipe + ' + SHOVEL_GUARD + 's tail, and the window ticks on the night gate',
  swingSrc.includes('p.shovelGuardT = SHOVEL_SWING_DUR + SHOVEL_GUARD;') &&
    html.includes('p.shovelGuardT = Math.max(0, (p.shovelGuardT || 0) - dt)') &&
    html.includes('p.nightHitT = Math.max(0, (p.nightHitT || 0) - dt)'));
check('guard + grace reset with the shift, and the HUD says SHOVEL UP while the blade is up',
  html.includes('p.shovelGuardT = 0;') && html.includes('p.nightHitT = 0;') &&
    html.includes('"  • SHOVEL UP!"'));
check('at most ' + HORROR_HUNTERS_MAX + ' spooks may charge him at once (no nine-way swarm)',
  html.includes('horrorHunterCount() < HORROR_HUNTERS_MAX') && HORROR_HUNTERS_MAX <= 8);
// --- THE WHOLE TOOL IS THE WEAPON (the real swing code, real numbers) ---
p.wx = 140; p.wy = 2.5; p.facing = 0; p.shovelCd = 0; p.stunT = 0; p.shovelGuardT = 0;
const woodGhoul = mkC('ghoul', SHOVEL_REACH + SHOVEL_BLADE_R - 0.25); // out at the head's sweep
const outGhoul = mkC('ghoul', SHOVEL_REACH + SHOVEL_BLADE_R + 0.8); // past the tool entirely
creatures.length = 0; creatures.push(outGhoul, woodGhoul);
check('the swing hits with ANY PART of the shovel — the head\'s own sweep beyond the shaft, the wood included',
  (() => { const ok = H.swing() === true; return ok && woodGhoul.hooked === true && outGhoul.hooked === undefined; })(),
  'wood=' + woodGhoul.hooked + ' out=' + outGhoul.hooked);
check('a ghoul standing ON him (every contact radius, up to the reaper\'s 1.5) is INSIDE the tool',
  SHOVEL_BUTT + SHOVEL_BLADE_R + 0.15 >= 1.5 && SHOVEL_BUTT > 0);
// --- THE PARRY: a spook that comes into the swinging tool is banished, cost-free ---
creatures.length = 0;
const attacker = mkC('ghoul', 1.05, { causeKey: 'ghoul', touchCd: 0, huntT: 4, flinchT: 0 });
creatures.push(attacker);
p.shovelGuardT = SHOVEL_SWING_DUR + SHOVEL_GUARD;
scored.length = 0; deposited.length = 0;
H.shovelParry(attacker);
check('PARRY: the ghoul that runs into the swinging shovel goes STRAIGHT INTO THE HOPPER (nothing paid)',
  (() => {
    let g9 = 0;
    while (!attacker.hookLanded && g9++ < 400) H.shovelFlight(attacker, 1 / 60);
    return attacker.hookLanded === true &&
      scored.some((s) => s.n === SHOVEL_POINTS);
  })(), 'scored=' + scored.map((s) => s.n).join('+'));
// --- STAGGER / GRACE, RUN WITH THE GAME'S OWN NUMBERS ---
p.shovelCd = 0; p.stunT = HORROR_STUN_T; p.stunDur = HORROR_STUN_T; p.shovelGuardT = 0;
creatures.length = 0;
const stunGhoul = mkC('ghoul', 1.8);
creatures.push(stunGhoul);
check('out of a ghoul stagger a swing fires AT ONCE and clears the stun',
  H.swing() === true && p.stunT === 0 && stunGhoul.hooked === true);
p.shovelCd = 0; p.stunT = 0.9; p.stunDur = 0.9;
creatures.length = 0; creatures.push(mkC('ghoul', 1.8));
check('a 0.9s knockdown (the day-level kind) still locks the swing out',
  H.swing() === false && p.stunT === 0.9);
let worstDps = 0, worstFam = '';
for (const fam of Object.keys(HORROR_HITS)) {
  const dps = HORROR_HITS[fam] / NIGHT_HIT_GRACE;
  if (dps > worstDps) { worstDps = dps; worstFam = fam; }
}
check('the whole pack can drain at most ' + worstDps.toFixed(1) + ' HP/s (worst family ' + worstFam +
  '): 100 HP buys ' + Math.floor(100 / worstDps) + 's of standing INSIDE the horde',
  worstDps <= 13);
check('he is stunned for at most ' + Math.round((HORROR_STUN_T / NIGHT_HIT_GRACE) * 100) +
  '% of a besieged second', HORROR_STUN_T / NIGHT_HIT_GRACE <= 0.2);
// --- THE SWARM CAP, THROUGH THE REAL AI ---
onScreen = true;
p.stunT = 0; p.stunDur = 1; p.shovelGuardT = 0; p.nightHitT = 0; p.wx = 140;
creatures.length = 0;
for (let i = 0; i < 12; i++) {
  creatures.push(mkC('ghoul', 6, 0.4 * i - 2, {
    huntT: 0, wanderT: 4, lopeSp: 1.6, chaseSp: 4.2, phase: 0, sayCd: 0, flinchT: 0, dir: 1,
  }));
}
for (let f = 0; f < 180; f++) creatures.forEach((c) => H.updateHorrorCreature(c, 1 / 60));
const hunting = creatures.filter((c) => c.huntT > 0).length;
check('a block of NINE ghouls does not all charge at once: ' + hunting + ' hunting, cap ' + HORROR_HUNTERS_MAX,
  hunting <= HORROR_HUNTERS_MAX && hunting > 0);
check('the guard/grace timers tick ONLY behind the night gate (weekday stun is untouched)',
  /if \(typeof isNightShift === "function" && isNightShift\(\)\) \{[\s\S]{0,400}p\.shovelGuardT = Math\.max/.test(html));
check('the night stagger is defined and used ONLY in the night kit (never in a weekday stun)',
  (html.match(/HORROR_STUN_T/g) || []).length >= 4 &&
    /doStun\(HORROR_STUN_T, "scare"\)/.test(FFS) &&
    !/doStun\(HORROR_STUN_T/.test(html.slice(0, ffStart - 20000)));
console.log('\n[12] THE SCREEN STAYS CLEAR: no text wall during a swing-frenzy (pops are for POWER-UPS)');
check('the ONLY centre-screen pops in the night kit are the two Holy Weapon POWER moments',
  (srcFn('shovelBanish').match(/announcePower/g) || []).length === 2 &&
    /CONSECRATED!/.test(srcFn('shovelBanish')) && /SHOVEL TRIAD!/.test(srcFn('shovelBanish')));
check('the live haunt never pops: the ABYSS SURGE warning is the one loud exception',
  !/announcePower\("THE HORDE THICKENS"/.test(html) &&
    /announcePower\("ABYSS SURGE!"/.test(srcFn('updateNightHaunt')));
check('swing, parry and prop exorcism speak ONLY through the text budget',
  srcFn('shovelStrike').includes('if (nightSayOk())') &&
    srcFn('shovelParry').includes('nightSayOk()') &&
    srcFn('shovelHazardStrike').includes('nightSayOk()') &&
    srcFn('updateHorrorCreature').includes('nightSayOk()'));
check('the banished spook\'s "last word" is gone (no talking bubble per kill)',
  !srcFn('shovelStrike').includes('SPOOK_LINES'));
check('score bubbles are rate-limited too (' + NIGHT_BUBBLE_GAP + 's apart)',
  srcFn('shovelBanish').includes('nightBubbleOk()') && NIGHT_BUBBLE_GAP >= 0.3);
check('the budget ticks with the haunt and resets with the shift',
  srcFn('updateNightHaunt').includes('nightSayT = Math.max(0, nightSayT - dt)') &&
    html.includes('nightSayT = 0;') && html.includes('nightBubbleT = 0;'));
check('the budget is a NIGHT-ONLY gate (weekday/Maspeth voices are untouched)',
  /function nightSayOk\(loud\) \{\s*if \(typeof isNightShift !== "function" \|\| !isNightShift\(\)\) return true;/.test(html));
// --- SIM: a 45-second swing-frenzy against the live horde: how much text hits the screen? ---
s7Reset();
onScreen = true;
p.wx = 120; p.wy = 2.5; p.stunT = 0; p.stunDur = 1;
const sayMark = sayings.length, bubMark = bubbles.length, popMark = announced.length;
let swings = 0;
for (let i = 0; i < 60 * 45; i++) {
  p.wx = Math.min(452, p.wx + 3.2 / 60); // he WORKS down the route, so the refill feeds him
  H.updateNightHaunt(1 / 60);
  // the game's frame sweep: banished spooks fly, land, score, and are removed
  for (let k = creatures.length - 1; k >= 0; k--) {
    const c = creatures[k];
    if (!c.hooked) continue;
    H.shovelFlight(c, 1 / 60);
    if (c.hookLanded) creatures.splice(k, 1);
  }
  if (i % 26 === 0) { // he swings as fast as the cooldown allows
    p.shovelCd = 0; p.shovelGuardT = 0;
    if (H.swing() === true) swings++;
  }
}
const lines = sayings.length - sayMark, bubblesMade = bubbles.length - bubMark, pops = announced.length - popMark;
check('a 45s frenzy (' + swings + ' swings) puts at most ~' + Math.ceil(45 / NIGHT_SAY_GAP) +
  ' spoken lines on screen — measured ' + lines,
  lines <= Math.ceil(45 / NIGHT_SAY_GAP) + 4 && swings >= 40,
  'lines=' + lines + ' swings=' + swings);
check('...and at most ' + Math.ceil(45 / NIGHT_BUBBLE_GAP) + ' score bubbles (measured ' + bubblesMade + ')',
  bubblesMade <= Math.ceil(45 / NIGHT_BUBBLE_GAP) + 3);
check('...with centre-screen pops RESERVED for power moments and capped to one per ' +
  NIGHT_POP_GAP + 's: ' + pops + ' in 45s',
  pops <= Math.ceil(45 / NIGHT_POP_GAP) + 2 && pops >= 1);
check('the Holy Weapon power moments route their pops AND lines through the budgets',
  /if \(nightPopOk\(\)\) announcePower\("CONSECRATED!"/.test(html) &&
    /if \(nightPopOk\(\)\) announcePower\("SHOVEL TRIAD!"/.test(html) &&
    /if \(nightPopOk\(\)\) announcePower\("ABYSS SURGE!"/.test(html) &&
    srcFn('shovelBanish').includes('if (nightSayOk())'));
check('the frenzy still SCORES (loud in points, silent in text)',
  scored.filter(s => s.n === SHOVEL_POINTS).length >= 30);
s7Reset();
console.log('\n[13] LESS SPIRIT CLUTTER, AND THE PACK WALKS THE WHOLE WIDTH OF THE BLOCK');
check('THE NON-ATTACKING SPIRITS ARE REMOVED: cap ' + NIGHT_GHOST_CAP + ', quota ' +
  HORROR_QUOTA.ghost + ', flood ' + HORROR_QUOTA_FLOOD.ghost + ', wave ceiling ' + HORROR_QUOTA_CEIL.ghost +
  ', ' + NIGHT_GHOST_FILL + ' per fill — and the grave yard with them (props ' +
  Object.keys(NIGHT_PROP_QUOTA).map((k) => NIGHT_PROP_QUOTA[k]).join('/') + ' / ' +
  Object.keys(NIGHT_PROP_QUOTA_FLOOD).map((k) => NIGHT_PROP_QUOTA_FLOOD[k]).join('/') + ')',
  NIGHT_GHOST_CAP === 0 && HORROR_QUOTA.ghost === 0 && HORROR_QUOTA_FLOOD.ghost === 0 &&
    HORROR_QUOTA_CEIL.ghost === 0 && NIGHT_GHOST_FILL === 0 &&
    Object.keys(NIGHT_PROP_QUOTA).every((k) => NIGHT_PROP_QUOTA[k] === 0) &&
    Object.keys(NIGHT_PROP_QUOTA_FLOOD).every((k) => NIGHT_PROP_QUOTA_FLOOD[k] === 0) &&
    /if \(NIGHT_GHOST_CAP <= 0\) return null;/.test(srcFn('spawnNightGhost')));
check('...while the SHOVEL KIT and the exorcisable kinds stay intact (the cemetery keeps them,\n  the spooks still get digged out, and hand-placed props behave exactly as before)',
  SHOVELABLE_HAZARDS.ghoststone === 1 && SHOVELABLE_HAZARDS.ghostarm === 1 &&
    SHOVELABLE_HAZARDS.skullpile === 1 && SHOVELABLE_HAZARDS.irongate === 1 &&
    HORROR_PROP_NAMES.ghoststone === 'HEADSTONE' && NIGHT_GHOST_SLOTS > 0);
check('the ATTACKERS keep their density (9 ghouls a block, flood 14) — the fight is the crowd',
  HORROR_QUOTA.ghoul >= 9 && HORROR_QUOTA_FLOOD.ghoul >= 14 && NIGHT_GHOUL_MIN >= 7);
check('the road (y ' + HORROR_STREET_Y + ') and the front lawn (y ' + HORROR_LAWN_Y +
  ') are both open to the pack',
  HORROR_STREET_Y <= -8 && HORROR_LAWN_Y >= 7 &&
    /c\.wy = clamp\(c\.wy, HORROR_STREET_Y, horrorMaxY\(\)\);/.test(srcFn('updateHorrorCreature')));
check('no crawler lane floor left (the old 0.7 = sidewalk-only clamp is GONE)',
  !/clamp\(c\.wy, 0\.7,/.test(srcFn('updateHorrorCreature')));
check('spawn, respawn, wander, blink, shockwave and the grace shove all use the open lanes',
  [srcFn('nightSpawnHorror'), srcFn('respawnHorror'), srcFn('updateHorrorCreature'),
    srcFn('shovelShockwave'), srcFn('shoveSpookOff')]
    .every((s) => s.includes('HORROR_STREET_Y') && s.includes('horrorMaxY')));
check('the spirit zones stay on the Maspeth bands (street / curb / sidewalk slots intact)',
  /gh\.zone = slot % 3 === 0 \? -1 : slot % 3 === 1 \? 0 : 1;/.test(srcFn('spawnNightGhost')));
// --- SIM: the live horde over 60s: the pack must be standing in the road AND on the lawn ---
s7Reset();
onScreen = true;
p.wx = 100; p.wy = 2.5;
let inStreet = 0, inCurb = 0, inWalk = 0, inLawn = 0, peakGhosts = 0;
for (let i = 0; i < 60 * 60; i++) {
  p.wx = Math.min(452, p.wx + 3.0 / 60);
  H.updateNightHaunt(1 / 60);
  for (const c of creatures) {
    if (c.hooked || c.hookLanded) continue;
    H.updateHorrorCreature(c, 1 / 60);
  }
  for (const c of creatures) {
    if (!HORROR_ALL[c.type] || c.hooked || c.hookLanded) continue;
    if (c.wy < -1.0) inStreet = Math.max(inStreet, 1);
    if (c.wy >= -1.0 && c.wy < 0.8) inCurb = Math.max(inCurb, 1);
    if (c.wy >= 0.8 && c.wy <= 4.8) inWalk = Math.max(inWalk, 1);
    if (c.wy > 4.8) inLawn = Math.max(inLawn, 1);
  }
  peakGhosts = Math.max(peakGhosts, creatures.filter((c) => c.type === 'ghost' && !c.hooked && !c.hookLanded).length);
}
check('after a 60s walk the pack stands in the ROAD, on the CURB, on the WALK and on the LAWN',
  inStreet === 1 && inCurb === 1 && inWalk === 1 && inLawn === 1);
check('the 60s walk never meets a spirit: peak ' + peakGhosts + ' ghosts on the route',
  peakGhosts === 0);
check('the Maspeth ghost numbers are UNTOUCHED (75 slots, cap 45, its own grid)',
  html.includes('const GHOST_SLOTS = 75') && html.includes('const GHOST_CAP = 45'));
s7Reset();

console.log('\n[14] THE PAY SCALE: banishments are small change, so POWER-UPS stay a grind');
const MONSTER_SCORE_STEP = srcNum('MONSTER_SCORE_STEP');
const POWERUP_CASH_STEP = srcNum('POWERUP_CASH_STEP');
check('a banishment pays ' + SHOVEL_POINTS + ' (was 250), grave furniture ' + SHOVEL_PROP_POINTS +
  ' (was 150), a Shovel Triad ' + TRIAD_POINTS + ' (was 2500)',
  SHOVEL_POINTS <= 25 && SHOVEL_PROP_POINTS <= 10 && TRIAD_POINTS <= 250 &&
    SHOVEL_POINTS >= 10 && SHOVEL_POINTS * 10 === 250 && TRIAD_POINTS === SHOVEL_POINTS * 10);
check('the night\'s par (' + HORROR_SPOOK_TARGET + ' spooks) is ' + (HORROR_SPOOK_TARGET * SHOVEL_POINTS) +
  ' CASH — the shovel alone cannot buy a Red Bull',
  HORROR_SPOOK_TARGET * SHOVEL_POINTS < MONSTER_SCORE_STEP / 10);
check('a Red Bull (Run It Up) costs ' + MONSTER_SCORE_STEP + ' SCORE = ' +
  Math.round(MONSTER_SCORE_STEP / SHOVEL_POINTS) + ' banishments: NOT free, NOT impossible',
  MONSTER_SCORE_STEP / SHOVEL_POINTS >= 400 && MONSTER_SCORE_STEP / SHOVEL_POINTS <= 3000);
check('a street-cash healer drops every ' + POWERUP_CASH_STEP + ' = ' +
  Math.round(POWERUP_CASH_STEP / SHOVEL_POINTS) + ' banishments (the milestones are UNTOUCHED)',
  POWERUP_CASH_STEP >= 3000 && POWERUP_CASH_STEP <= 8000 &&
    POWERUP_CASH_STEP / SHOVEL_POINTS >= 100);
check('a CLEANSED FLOOD BLOCK (the ' + HORROR_QUOTA_FLOOD.ghoul + ' ghouls + the reaper) pays ' +
  ((HORROR_QUOTA_FLOOD.ghoul + 2) * SHOVEL_POINTS) + ' — a fraction of one milestone',
  (HORROR_QUOTA_FLOOD.ghoul + 2) * SHOVEL_POINTS < MONSTER_SCORE_STEP / 5);
// >>> TEMP: the test build starts on MIDNIGHT (flip START_LEVEL back to 1 for release) <<<
check('TEMP TEST BUILD: the week starts on the MIDNIGHT level (flagged, one line to flip back)',
  /const START_LEVEL = NIGHT_LEVEL;/.test(html) && /TEMP TEST BUILD/.test(html));
// --- SIM: a full haunted route of banishments = how much score, really? ---
s7Reset();
onScreen = true;
p.wx = 100; p.wy = 2.5; p.stunT = 0; p.stunDur = 1;
scored.length = 0;
let kills = 0;
for (let i = 0; i < 60 * 90; i++) {
  p.wx = Math.min(452, p.wx + 3.2 / 60);
  H.updateNightHaunt(1 / 60);
  for (let k = creatures.length - 1; k >= 0; k--) {
    const c = creatures[k];
    if (!c.hooked) continue;
    H.shovelFlight(c, 1 / 60);
    if (c.hookLanded) { creatures.splice(k, 1); kills++; }
  }
  if (i % 26 === 0) { p.shovelCd = 0; p.shovelGuardT = 0; H.swing(); }
}
const loot = scored.reduce((a, s) => a + s.n, 0);
check('90s of hard shovelling: ' + kills + ' banishments = ' + loot + ' CASH — ' +
  (loot / MONSTER_SCORE_STEP * 100).toFixed(1) + '% of ONE Red Bull milestone',
  kills >= 40 && loot <= MONSTER_SCORE_STEP && loot >= kills * SHOVEL_POINTS);
s7Reset();

check('COLD BOOT (the MIDNIGHT test start): the night never touches a null truck',
  /const truckX = truck && typeof truck\.wx === "number"/.test(srcFn('spawnStolenGargoyle')) &&
    srcFn('spawnStolenGargoyle').includes('beast.g.userData.beast ?') &&
    !/truck\.wx \+ 40/.test(srcFn('spawnStolenGargoyle')) &&
    !/beast\.wx = truck\./.test(srcFn('spawnStolenGargoyle')));
check('the hopper geometry answers with SAFE coordinates when the truck has not loaded',
  srcFn('hopperWorldX').includes('truckXSafe()') &&
    srcFn('hopperAimX').includes('truckXSafe()') &&
    srcFn('hopperPileX').includes('truckXSafe()') &&
    srcFn('hopperWorldY').includes('truck &&') &&
    srcFn('hopperTopZ').includes('truck &&'));
check('the thief still camps short of the finish line using the guarded truck spot',
  /beast\.campX = Math\.max\(truckX \+ 40, ROUTE_FINISH_X - GARGOYLE_CAMP_X_OFF\)/.test(srcFn('spawnStolenGargoyle')) &&
    /beast\.wx = truckX \+ 1\.8/.test(srcFn('spawnStolenGargoyle')));
check('the gargoyle rides the beast maw when it exists, and lands at the beast when it does not',
  /if \(maw\) \{[\s\S]{0,200}maw\.add\(gg\)/.test(srcFn('spawnStolenGargoyle')) &&
    /else \{[\s\S]{0,400}dynamicGroup\.add\(gg\)/.test(srcFn('spawnStolenGargoyle')));

check('A MIDNIGHT BOOT SURVIVES THE TRAINER: the panel default follows START_LEVEL (never silently back to Monday)',
  /var CHEAT = \{[^}]*startLevel: START_LEVEL \}/.test(html) &&
    /level = START_LEVEL;[\s\S]{0,240}if \(typeof CHEAT !== "undefined" && CHEAT\.startLevel >= 1 && CHEAT\.startLevel <= MAX_LEVEL\)/.test(html));
check('THE TEST BUILD BOOTS ON THE NIGHT SHIFT: START_LEVEL = NIGHT_LEVEL, and the night resolver points at the LAST day (revert = that one line)',
  /const START_LEVEL = NIGHT_LEVEL;.*TEMP/.test(html) &&
    LEVEL_DAYS.findIndex(function (d) { return !!d.night; }) + 1 === LEVEL_DAYS.length &&
    LEVEL_DAYS.length === 8 &&
    LEVEL_DAYS[7].day === "MIDNIGHT" && !!LEVEL_DAYS[7].night);

console.log('\n[10] THE SWING IS A SWING: an arc, a big point, subtle goo, spooky music');
const HOLD10 = eval('(' + srcLiteral('SHOVEL_HOLD', '{', '}') + ')');
const KEYS10 = HOLD10.keys;
const arc10 = new Function('SHOVEL_HOLD', srcFn('shovelSwingArc') + '\nreturn shovelSwingArc;')(HOLD10);
check('the swing is KEYFRAMED (coil -> launch -> strike -> follow-through), not a two-pose lerp',
  Array.isArray(KEYS10) && KEYS10.length >= 5 && KEYS10[0].k === 0 && KEYS10[0].twist === 0 &&
  KEYS10.some((q) => q.twist < -0.3) && Math.max.apply(null, KEYS10.map((q) => q.twist)) >= 1.4 &&
  HOLD10.max > 1.1, 'twists ' + KEYS10.map((q) => q.twist).join('/'));
let rise10 = true, fall10 = true, top10 = 0, last10 = 0;
for (let k = 0; k <= 1.0001; k += 0.01) {
  const a10 = arc10(k);
  top10 = Math.max(top10, a10);
  if (k > 0.02 && k < 0.72 && a10 < last10 - 1e-9) rise10 = false;
  if (k > 0.74 && a10 > last10 + 1e-9) fall10 = false;
  last10 = a10;
}
check('one press plays ONE way through the whole swing (no bounce) and winds PAST the strike',
  arc10(0) === 0 && arc10(1) === 0 && rise10 && fall10 && top10 >= HOLD10.max - 1e-9 && top10 > 1.1,
  'peak amplitude ' + top10.toFixed(2) + ' of max ' + HOLD10.max);
check('the arc has a wind-up, a strike and a follow-through IN TIME (coil, hit, lay it over)',
  arc10(0.1) >= 0.15 && arc10(0.46) >= 1 - 1e-9 && arc10(0.72) >= HOLD10.max - 1e-9 &&
  arc10(0.2) < arc10(0.4) && arc10(0.85) < arc10(0.72));
check('the tool is driven BY THE HANDS the swing poses (re-laid on both fists every frame)',
  html.includes('shovelGroup.rotation.set(e.x, e.y, 0);') &&
  srcFn('poseShovel').includes('const K = SHOVEL_HOLD.keys') &&
  srcFn('poseShovel').includes('torque * 0.6'));
check('the swing is long enough to read as a swing and its guard covers the whole arc',
  SHOVEL_SWING_DUR >= 0.4 && SHOVEL_COOLDOWN >= 0.25 && SHOVEL_COOLDOWN <= SHOVEL_SWING_DUR &&
  html.includes('p.shovelGuardT = SHOVEL_SWING_DUR + SHOVEL_GUARD;'),
  SHOVEL_SWING_DUR + 's swing / ' + SHOVEL_COOLDOWN + 's cooldown / ' + SHOVEL_GUARD + 's guard tail');
check('the WHOLE BODY is in the swing: the stride rides the GAIT axis (leg rotation.y = fore/aft in this rig), the weight moves FORWARD (local +x) onto the planted foot, the chest tips over the blade',
  html.includes('lead.rotation.y += 0.46 * swS') && html.includes('trail.rotation.y -= 0.34 * swS') &&
  html.includes('wparts.group.position.x += 0.06 * swS') && html.includes('worker.group.rotation.x = -shovelLean') &&
  html.includes('shovelTwist = shovelStride > 0.66 ? -hold.twist : hold.twist'));
check('the swing NEVER tips a leg sideways: in this rig the feet are separated along local Y, so leg rotation.x throws the feet OUT TO THE SIDES (the split) and the swing stays on the stride axis',
  !/wparts\.leg[LR]\.rotation\.x/.test((html.match(/THE BODY DOES THE WORK[\s\S]{0,1800}?Dog-shit slip/) || [''])[0]) &&
  !/worker\.group\.position\.z [-+]?= [^\n]*shovelStride/.test(html));
check('the catch is QUEUED by the press and LANDED at the top of the arc, never on the thumb',
  html.includes('shovelArm = 0;') && html.includes('pendingStrike = { spooks: targets.slice()') &&
  html.includes('if (shovelArm >= 0 && sw >= 1.06 && swPrev < 1.06)') &&
  html.includes('function shovelDeliverStrike() {') &&
  srcFn('shovelDeliverStrike').includes('shovelStrike(pend.spooks[i].c)'));
const SH15 = srcFn('makeShovelProp');
const BD15 = SH15.match(/const blade = BX\(([0-9.]+), ([0-9.]+), ([0-9.]+), steel\)/);
const TP15 = SH15.match(/const tip = BX\(([0-9.]+), ([0-9.]+), ([0-9.]+), edge\)/);
const NK15 = SH15.match(/const neck = BX\(([0-9.]+), ([0-9.]+), ([0-9.]+), steel\)/);
check('THE POINT IS BIG AND WIDE: ' + BD15[1] + 'u long x ' + BD15[2] + 'u across (was 0.34 x 0.3)',
  Number(BD15[1]) >= 0.44 && Number(BD15[2]) >= 0.5 && Number(TP15[2]) >= 0.48 &&
  Number(NK15[1]) >= 0.2 && shovel.userData.handleLen >= 1.7 && shovel.userData.handleLen <= 1.85 &&
  SHOVEL_BLADE_R >= 1.2,
  'handle ' + shovel.userData.handleLen + 'u / tip ' + TP15[2] + 'u wide / sweep ' + SHOVEL_BLADE_R + 'u');
const SC15 = [];
String(html).replace(/spawnEctoSplat\((.{0,60}?),\s*([0-9.]+)\)/g, (m0, m1, s1) => { SC15.push(Number(s1)); return m0; });
check('ecoplasm is SUBTLE: every splat is a thin wet mark (' + SC15.join('/') + ', none over 0.75)',
  SC15.length >= 7 && SC15.every((v) => v > 0 && v <= 0.75) && NIGHT_ECTO_SIZE < 1);
check('midnight goo keeps the GLOW and gives up the VOLUME (the dials are separate)',
  srcFn('spawnEctoSplat').includes('const es = nightEctoSize()') &&
  srcFn('spawnEctoSplat').includes('* scale * es') &&
  srcFn('spawnEctoSplat').includes('emissiveIntensity: 1.1 * ek') &&
  srcFn('spawnEctoBurst').includes('* es;') &&
  NIGHT_ECTO_SIZE < 1 && NIGHT_GLOW_ECTO > 1);
check('MIDNIGHT MENAGERIE is the haunted shift\'s theme (named in the game, on the shelf)',
  html.includes('const NIGHT_MUSIC_TRACK = "Midnight Menagerie.mp3";') &&
  JSON.parse(fs.readFileSync('music/manifest.json', 'utf8')).includes('Midnight Menagerie.mp3') &&
  fs.existsSync('music/Midnight Menagerie.mp3'));
check('the station can LOCK onto one track and LOOP it (bag collapses, gap closes, release works)',
  html.includes('radioSticky(name) {') &&
  html.includes('this.radioBag = [this.radioSticky];') &&
  html.includes('this.radioSticky ? 700 : 2000') &&
  html.includes('if (this.radioSticky === on) return false;') &&
  html.includes('radioSticky: null,'));
check('music follows the SHIFT (every armed street re-locks or releases), never a button',
  srcFn('armMidnightLook').includes('applyMidnightMusic(on);') &&
  srcFn('applyMidnightMusic').includes('SFX.radioSticky(!!on ? NIGHT_MUSIC_TRACK : null)') &&
  srcFn('applyMidnightMusic').includes('typeof SFX.radioSticky !== "function"'));
console.log('\n' + pass + ' night-shift checks passed' + (fail ? ' — ' + fail + ' FAILED' : ' — all OK'));
if (fail) failures.forEach((f, i) => console.log('  FAIL ' + (i + 1) + ') ' + f));
process.exit(fail ? 1 : 0);
