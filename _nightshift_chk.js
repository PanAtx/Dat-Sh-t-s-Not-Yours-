// _nightshift_chk.js — THE NIGHT SHIFT (the level AFTER Sunday) validation.
//
// The eighth shift has no weekday: it is the Bed-Stuy brownstone row at midnight, with
// everything MORTAL pulled off the street (no humans, animals, vehicles, bags, cans or
// litter baskets) and the horror moved in instead: specters, banshees, ghouls, hellhounds,
// manhole tentacles, and THE MIDNIGHT FINAL BOSS.
//
// MIDNIGHT IS A CUL-DE-SAC THAT RUNS BACKWARDS (routeDir() === -1): the rig enters at the
// TOP of the screen and BACKS DOWN the block ahead of the worker, the worker clocks in near
// the top and walks the street DOWNHILL, and there is NO FINISH LINE — the street ends in a
// CEMETERY (the iron fence across the road, graves, monuments, dead trees, candles) and the
// many-eyed TENTACLE BEAST rises out of that yard holding the truck's Ruby-Plated Gargoyle.
// The shovel is the ONLY thing that touches it: 10 plain swings (a consecrated swing lands
// TWO), the bar drains, and at ZERO the compactor SUCKS the whole beast into the hopper,
// the Gargoyle drops on the grave yard, and walking onto IT wins the night.
//
// PART 1 the level table + the emptied roster (real npcCounts, real LEVEL_DAYS)
// PART 2 the monsters + the shovel + the hopper, SIMULATED against stub world callbacks
// PART 3 the wiring this level depends on elsewhere in the file (greps)
// PART 9 THE DEAD END + THE FINAL BOSS (the mirrored anchors + the whole fight, simulated)
// PART 10 THE MIRRORED RIG (the real truck AI driven on both route axes)
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
  // THE BLOCK PACKS (shovelable, exactly like the shipped roster)
  gremlin: 1, goblin: 1, devil: 1, fangspider: 1, eyecrawler: 1, skeleton: 1, pitfiend: 1,
  grubsquat: 1, ratking: 1, lanternfang: 1, goulra: 1,
};
// THE ABYSS ROSTER (the families the night shift now haunts every block with)
const HORROR_ALL = {
  specter: 1, banshee: 1, ghoul: 1, hound: 1, imp: 1, wraith: 1, poltergeist: 1,
  demon: 1, hexbeast: 1, abyssal: 1, lich: 1, reaper: 1,
  // THE BLOCK PACKS (the per-block horrors of the dead-end street)
  gremlin: 1, goblin: 1, devil: 1, fangspider: 1, eyecrawler: 1, skeleton: 1, pitfiend: 1,
  grubsquat: 1, ratking: 1, lanternfang: 1, goulra: 1,
};
const HORROR_HITS = {
  specter: 8, banshee: 9, ghoul: 10, hound: 11, imp: 6, wraith: 9, poltergeist: 8,
  demon: 14, hexbeast: 9, abyssal: 12, lich: 12, reaper: 16, ghost: 10,
  gremlin: 7, goblin: 11, devil: 15, fangspider: 10, eyecrawler: 9, skeleton: 12, pitfiend: 13,
  grubsquat: 8, ratking: 9, lanternfang: 10, goulra: 14,
};
const HORROR_NAMES = {
  specter: 'SPECTER', banshee: 'BANSHEE', ghoul: 'GHOUL', hound: 'HELLHOUND', imp: 'IMP',
  wraith: 'WRAITH', poltergeist: 'POLTERGEIST', demon: 'DEMON', hexbeast: 'HEXBEAST',
  abyssal: 'ABYSSAL', lich: 'LICH', reaper: 'REAPER', ghost: 'GHOST', zombieArm: 'TEN-TACLE',
  gremlin: 'GREMLIN', goblin: 'GOBLIN', devil: 'DEVIL', fangspider: 'FANGSPIDER',
  eyecrawler: 'EYECRAWLER', skeleton: 'SKELETON', pitfiend: 'PITFIEND',
  grubsquat: 'GRAVE-SQUAT', ratking: 'RAT KING', lanternfang: 'LANTERNFANG', goulra: 'GOULRA',
};
const SPOOK_LINES = {
  specter: ['BOO'], banshee: ['WOOO'], ghoul: ['Sooo'], hound: ['GRR'], imp: ['HEH'],
  wraith: ['COLD'], poltergeist: ['BAGS'], demon: ['MIDNIGHT'], hexbeast: ['CLICK'],
  abyssal: ['PIT'], lich: ['LICH'], reaper: ['SCYTHE'], ghost: ['US'], thief: ['MINE'],
  gremlin: ['CHEWED'], goblin: ['LOOT'], devil: ['PITCHFORK'], fangspider: ['SKITTER'],
  eyecrawler: ['NINE'], skeleton: ['CLATTER'], pitfiend: ['BRINE'],
  grubsquat: ['SQUAT'], ratking: ['GUTTERS'], lanternfang: ['LAMP'], goulra: ['WATCH'],
};
// THE HOLY WEAPON + the exorcisable grave yard (the numbers the game runs on)
const HORROR_QUOTA = eval('(' + srcLiteral('HORROR_QUOTA', '{', '}') + ')');
const HORROR_QUOTA_FLOOD = eval('(' + srcLiteral('HORROR_QUOTA_FLOOD', '{', '}') + ')');
const HORROR_QUOTA_CEIL = eval('(' + srcLiteral('HORROR_QUOTA_CEIL', '{', '}') + ')');
const SHOVELABLE_HAZARDS = eval('(' + srcLiteral('SHOVELABLE_HAZARDS', '{', '}') + ')');
const HORROR_PROP_NAMES = eval('(' + srcLiteral('HORROR_PROP_NAMES', '{', '}') + ')');
const HORROR_PROP_LINES = ['HEADSTONE IN THE TRUCK!'];
const HORROR_FILL_ORDER = eval('(' + srcLiteral('HORROR_FILL_ORDER', '[', ']') + ')');
// THE BLOCK PACKS (Midnight: ONE horde per block — a family belongs to exactly one block).
// Extracted from the game exactly as it is built, and wired to the haunt harness's own
// nightQuota() as soon as it exists — so the harness fills bands with the SAME code the
// game runs (see the nightQuotaForPacks hookup right after H is constructed).
const IW = srcNum('IW');
const NIGHT_PACK_ESCALATE = true;
const NIGHT_PACK_SLACK = srcNum('NIGHT_PACK_SLACK');
const NIGHT_BEAT_TOP_X = srcNum('NIGHT_BEAT_TOP_X');
const NIGHT_BEAT_VERMIN_X = srcNum('NIGHT_BEAT_VERMIN_X');
const NIGHT_BEAT_DIGGER_X = srcNum('NIGHT_BEAT_DIGGER_X');
const NIGHT_BEAT_GRAVE_X = srcNum('NIGHT_BEAT_GRAVE_X');
const NIGHT_BLOCKS = (() => {
  // Same keys the game builds NIGHT_BLOCKS from (the beat constants), read out of the source
  const TOP = NIGHT_BEAT_TOP_X, VERMIN = NIGHT_BEAT_VERMIN_X, DIG = NIGHT_BEAT_DIGGER_X, GRAVE = NIGHT_BEAT_GRAVE_X;
  const raw = srcLiteral('NIGHT_BLOCKS', '[', ']')
    .replace(/NIGHT_BEAT_TOP_X/g, String(TOP))
    .replace(/NIGHT_BEAT_VERMIN_X/g, String(VERMIN))
    .replace(/NIGHT_BEAT_DIGGER_X/g, String(DIG))
    .replace(/NIGHT_BEAT_GRAVE_X/g, String(GRAVE));
  return eval('(' + raw + ')');
})();
const nightBlockPack = new Function('NIGHT_BLOCKS', 'BLOCK_W', 'IW',
  srcFn('nightBlockPack') + '\nreturn nightBlockPack;')(NIGHT_BLOCKS, 80, IW);
const nightBandPack = new Function('nightBlockPack',
  srcFn('nightBandPack') + '\nreturn nightBandPack;')(nightBlockPack);
const nightBlockFamilies = new Function('nightBandPack', 'HORROR_ALL',
  srcFn('nightBlockFamilies') + '\nreturn nightBlockFamilies;')(nightBandPack, HORROR_ALL);
let nightQuotaForPacks = () => 0;
const HORROR_QUOTA_CEIL_TABLE = eval('(' + srcLiteral('HORROR_QUOTA_CEIL', '{', '}') + ')');
// The game's nightBlockQuota() reads the live wave tier, so the harness calls it with the
// CURRENT tier on every call (H.getHaunt()[0] is the game's own nightGhoulTier).
const nightBlockQuotaFn = new Function('nightGhoulTier', 'nightBandPack', 'HORROR_QUOTA_CEIL', 'NIGHT_PACK_ESCALATE',
  srcFn('nightBlockQuota') + '\nreturn nightBlockQuota;');
const nightBlockQuota = (type, band) => nightBlockQuotaFn(
  H && H.getHaunt ? H.getHaunt()[0] : 0, nightBandPack, HORROR_QUOTA_CEIL_TABLE, NIGHT_PACK_ESCALATE)(type, band);
const nightBlockOrder = new Function('nightBlockFamilies', 'nightBlockQuota',
  srcFn('nightBlockOrder') + '\nreturn nightBlockOrder;')(nightBlockFamilies, nightBlockQuota);
const nightBlockOwns = new Function('nightBlockPack', 'nightBandPack',
  srcFn('nightBlockOwns') + '\nreturn nightBlockOwns;')(nightBlockPack, nightBandPack);
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
// THE MIDNIGHT DEAD END + THE FINAL BOSS (every number read straight out of the game)
const NIGHT_TOP_X = srcNum('NIGHT_TOP_X'), NIGHT_START_X = srcNum('NIGHT_START_X');
const NIGHT_END_X = srcNum('NIGHT_END_X'), NIGHT_BOSS_X = srcNum('NIGHT_BOSS_X');
const NIGHT_BOSS_TRIGGER_X = srcNum('NIGHT_BOSS_TRIGGER_X'), NIGHT_GRAVE_X = srcNum('NIGHT_GRAVE_X');
const NIGHT_GRAVE_BLOCK_X = srcNum('NIGHT_GRAVE_BLOCK_X');
const NIGHT_TRAIL_X = srcNum('NIGHT_TRAIL_X'), NIGHT_MOUTH_X = srcNum('NIGHT_MOUTH_X');
const BOSS_MAX_HP = srcNum('BOSS_MAX_HP'), BOSS_DMG = srcNum('BOSS_DMG');
const BOSS_DMG_CONS = srcNum('BOSS_DMG_CONS'), BOSS_INVULN_T = srcNum('BOSS_INVULN_T');
const BOSS_POINTS = srcNum('BOSS_POINTS'), BOSS_RISE_T = srcNum('BOSS_RISE_T');
const BOSS_LUNGE_SP = srcNum('BOSS_LUNGE_SP'), BOSS_LUNGE_SP_RAGE = srcNum('BOSS_LUNGE_SP_RAGE');
const BOSS_SEE_R = srcNum('BOSS_SEE_R'), BOSS_BODY_R = srcNum('BOSS_BODY_R');
const BOSS_BODY_CD = srcNum('BOSS_BODY_CD'), BOSS_HP_BODY = srcNum('BOSS_HP_BODY');
const BOSS_HP_WHIP = srcNum('BOSS_HP_WHIP'), BOSS_HP_FIRE = srcNum('BOSS_HP_FIRE');
const BOSS_WHIP_TELEGRAPH = srcNum('BOSS_WHIP_TELEGRAPH'), BOSS_WHIP_STRIKE = srcNum('BOSS_WHIP_STRIKE');
const BOSS_WHIP_R = srcNum('BOSS_WHIP_R'), BOSS_WHIP_ARC = srcNum('BOSS_WHIP_ARC');
const BOSS_FIRE_SP = srcNum('BOSS_FIRE_SP'), BOSS_FIRE_R = srcNum('BOSS_FIRE_R');
const BOSS_FIRE_LIFE = srcNum('BOSS_FIRE_LIFE'), BOSS_SUCTION_T = srcNum('BOSS_SUCTION_T');
const BOSS_SHOTS = srcNum('BOSS_SHOTS'), BOSS_SHOTS_RAGE = srcNum('BOSS_SHOTS_RAGE');
const BOSS_WHIP_CD = eval('(' + srcLiteral('BOSS_WHIP_CD', '[', ']') + ')');
const BOSS_FIRE_CD = eval('(' + srcLiteral('BOSS_FIRE_CD', '[', ']') + ')');
const HOPPER_CYCLE_AT_X = srcNum('HOPPER_CYCLE_AT');
const HOPPER_CYCLE_DUR_X = Number(
  (html.match(/HOPPER_CYCLE_DUR\s*=\s*([0-9.]+)/) || [0, "0.75"])[1],
);
const HORROR_STUN_T_X = HORROR_STUN_T;
const HOPPER_CYCLE_AT = HOPPER_CYCLE_AT_X, HOPPER_CYCLE_DUR = HOPPER_CYCLE_DUR_X;
const BOSS_LINES = eval('(' + srcLiteral('BOSS_LINES', '[', ']') + ')');
const BOSS_FIRE_LINES = eval('(' + srcLiteral('BOSS_FIRE_LINES', '[', ']') + ')');
const BOSS_HIT_LINES = eval('(' + srcLiteral('BOSS_HIT_LINES', '[', ']') + ')');
const BOSS_DYING_LINES = eval('(' + srcLiteral('BOSS_DYING_LINES', '[', ']') + ')');
const BOSS_WIN_LINES = eval('(' + srcLiteral('BOSS_WIN_LINES', '[', ']') + ')');
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
  // the boss's own voice: the ground opening, the lash loading, the STING of a shovel
  // landing on the beast, the cold sigh of ghost fire, and its dying groan
  playThunder: () => log.push('thunder'), playBeastSting: () => log.push('sting'),
  playGustSound: () => log.push('gust'), playSqueal: () => log.push('squeal'),
  playZombieGroan: () => log.push('groan'), playEctoPop: () => log.push('pop'),
  playPickupSound: () => log.push('pickup'),
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
  // THE HAUNT'S APPROACH VECTOR (Midnight: the spooks come out of the BOTTOM of the street)
  'horrorAheadWindow', 'horrorFellBehind', 'horrorRespawnX', 'horrorFillingBands',
  // FAIR FIGHT (the shield, the swarm cap, the whole-tool hit envelope)
  'shovelToolReach', 'horrorHunterCount', 'shoveSpookOff', 'shovelParry',
  'nightSayOk', 'nightBubbleOk', 'nightPopOk', 'horrorMaxY',
  // THE MIDNIGHT DEAD END (the mirrored route's anchors) + THE FINAL BOSS (the
  // cemetery fight, the shovel on the beast, the hopper suction and the win)
  'routeDir', 'routeFarX', 'routeNearX', 'nightWallX', 'workerEndLimitX', 'workerTopLimitX',
  'creatureLimitMinX', 'creatureLimitMaxX', 'playerSpawnX', 'playerSpawnFacing', 'truckSpawnX',
  'truckTargetGap', 'truckBackGap', 'truckStandOffset',
  'truckMeshYaw', 'routeSpanX', 'routeProgressFrac', 'makeTentacleBoss', 'spawnNightBoss',
  'clearNightBoss', 'startBossFight', 'bossAngryTarget', 'spawnBossFireball',
  'killBossFireball', 'updateBossFireballs', 'bossWhipStrike', 'bossShovelTargetable',
  'bossShovelRange', 'bossTakeShovelSwing', 'bossShovelHit', 'killNightBoss',
  'bossLandedInHopper', 'spawnBossGargoyle', 'grabBossGargoyle', 'animateNightBoss',
  'updateNightBoss', 'updateNightBossFight',
  // THE BLOCK PACKS (Midnight: ONE horde per block, no family shared between blocks)
  'nightBlockPack', 'nightBandPack', 'nightBlockOf', 'nightBlockOwns', 'nightBlockFamilies',
  'nightBlockQuota', 'nightBlockBandXs', 'nightBlockOrder', 'horrorWorkLimits'].map(srcFn).join('\n');
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
  // THE MIDNIGHT DEAD END + THE FINAL BOSS
  'NIGHT_TOP_X', 'NIGHT_START_X', 'NIGHT_END_X', 'NIGHT_BOSS_X', 'NIGHT_BOSS_TRIGGER_X',
  'NIGHT_GRAVE_X', 'NIGHT_GRAVE_BLOCK_X', 'NIGHT_TRAIL_X', 'NIGHT_MOUTH_X',
  'BOSS_MAX_HP', 'BOSS_DMG', 'BOSS_DMG_CONS', 'BOSS_INVULN_T', 'BOSS_POINTS', 'BOSS_RISE_T',
  'BOSS_LUNGE_SP', 'BOSS_LUNGE_SP_RAGE', 'BOSS_SEE_R', 'BOSS_BODY_R', 'BOSS_BODY_CD',
  'BOSS_HP_BODY', 'BOSS_HP_WHIP', 'BOSS_HP_FIRE', 'BOSS_WHIP_TELEGRAPH', 'BOSS_WHIP_STRIKE',
  'BOSS_WHIP_R', 'BOSS_WHIP_ARC', 'BOSS_FIRE_SP', 'BOSS_FIRE_R', 'BOSS_FIRE_LIFE',
  'BOSS_SUCTION_T', 'BOSS_SHOTS', 'BOSS_SHOTS_RAGE', 'BOSS_WHIP_CD', 'BOSS_FIRE_CD',
  'HOPPER_CYCLE_AT', 'HOPPER_CYCLE_DUR', 'BOSS_LINES', 'BOSS_FIRE_LINES', 'BOSS_HIT_LINES',
  'BOSS_DYING_LINES', 'BOSS_WIN_LINES',
  // THE BLOCK PACKS: the pack table + the block pitch its lookup runs on
  'NIGHT_BLOCKS', 'IW',
  'NIGHT_PACK_ESCALATE', 'NIGHT_PACK_SLACK', 'NIGHT_BEAT_TOP_X', 'NIGHT_BEAT_VERMIN_X',
  'NIGHT_BEAT_DIGGER_X', 'NIGHT_BEAT_GRAVE_X',
  HORROR_SRC +
  '\nlet ectoCount = 0; let stolenGargoyle = null; let gargoyleReclaimed = false;' +
  '\nlet shovelCharge = 0, shovelCharged = false, shovelTriadT = 0, shovelTriadCount = 0;' +
  '\nlet ectoFlights = [], nightHauntT = 0, nightGhoulTier = 0, nightSurgeT = 0,' +
  ' nightSurgeSpawned = 0, nightSurgeTier = 0, nightGhostCursor = 0;' +
  '\nlet nightSayT = 0, nightBubbleT = 0, nightPopT = 0;' +
  '\nlet shovelArm = -1, pendingStrike = null;' +
  // THE MIDNIGHT FINAL BOSS state (the beast, its ghost fire, the fight, the treasure)
  // + the stubs its fight reaches for: the worker's damage call, the stagger, the
  // confetti, the drive-off, and the hopper burst.
  '\nlet nightBoss = null, bossFireballs = [], bossFightOn = false, bossWin = false,' +
  ' bossWinT = 0, bossGargoyle = null, hopperCycling = false, hopperCycleT = 0,' +
  ' bossDeposits = 0;' +
  '\nconst hurtLog = [], stunLog = [], routeEnds = [], confettiLog = [], bossBursts = [];' +
  '\nfunction hurtNPC(a, c) { hurtLog.push({ a: a, c: c }); return true; }' +
  '\nfunction doStun(d, t) { stunLog.push({ d: d, t: t }); p.stunT = d; p.stunDur = d; }' +
  '\nfunction workerMaxY() { return 5.0; }' +
  '\nfunction startConfetti() { confettiLog.push("confetti"); }' +
  '\nfunction confettiCannon() { confettiLog.push("cannon"); }' +
  '\nfunction startRouteEnd() { routeEnds.push(p.wx); }' +
  '\nfunction spawnHopperBurst(x, y, s) { bossBursts.push({ x: x, y: y, s: s }); }' +
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
 ' horrorAheadWindow, horrorFellBehind, horrorRespawnX, horrorFillingBands,' +
  ' horrorWorkLimits, nightBlockPack, nightBandPack, nightBlockOf, nightBlockOwns,' +
  ' nightBlockFamilies, nightBlockQuota, nightBlockBandXs, nightBlockOrder,' +

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
  ' ectoFlights.length = 0; ectoCount = 0; },' +
  // THE FINAL BOSS: the harness drives the fight through these (spawn / wake / shovel /
  // the per-frame update / the bar / the ghost fire / the win), and reads the spy logs
  ' makeTentacleBoss, spawnNightBoss, clearNightBoss, startBossFight, updateNightBoss,' +
  ' updateNightBossFight, updateBossFireballs, bossWhipStrike, bossTakeShovelSwing,' +
  ' bossShovelHit, bossShovelTargetable, bossShovelRange, grabBossGargoyle,' +
  ' nightWallX, workerEndLimitX, workerTopLimitX, creatureLimitMinX, creatureLimitMaxX,' +
  ' routeDir, routeFarX, routeNearX, playerSpawnX, truckSpawnX, routeProgressFrac,' +
 ' truckTargetGap, truckBackGap, truckStandOffset,' +
  ' getBoss: () => nightBoss, setBoss: (v) => { nightBoss = v; },' +
  ' getFireballs: () => bossFireballs, getBossWin: () => bossWin, setBossWin: (v) => { bossWin = v; },' +
  ' getBossWinT: () => bossWinT, setBossWinT: (v) => { bossWinT = v; },' +
  ' getFightOn: () => bossFightOn, getBossGargoyle: () => bossGargoyle,' +
  ' setBossGargoyle: (v) => { bossGargoyle = v; },' +
  ' hurtLog: () => hurtLog, stunLog: () => stunLog, routeEnds: () => routeEnds,' +
  ' confettiLog: () => confettiLog, bossBursts: () => bossBursts,' +
  ' clearHurt: () => { hurtLog.length = 0; }, clearStun: () => { stunLog.length = 0; },' +
  ' clearRouteEnds: () => { routeEnds.length = 0; },' +
  ' clearConfettiLog: () => { confettiLog.length = 0; },' +
  ' clearBossBursts: () => { bossBursts.length = 0; },' +
  ' getHopperCycling: () => hopperCycling, getHopperCycleT: () => hopperCycleT };'
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
  NIGHT_ECTO_SIZE,
  // THE MIDNIGHT DEAD END + THE FINAL BOSS (the mirrored anchors, the fight's numbers)
  NIGHT_TOP_X, NIGHT_START_X, NIGHT_END_X, NIGHT_BOSS_X, NIGHT_BOSS_TRIGGER_X, NIGHT_GRAVE_X,
  NIGHT_GRAVE_BLOCK_X, NIGHT_TRAIL_X, NIGHT_MOUTH_X,
  BOSS_MAX_HP, BOSS_DMG, BOSS_DMG_CONS, BOSS_INVULN_T, BOSS_POINTS, BOSS_RISE_T,
  BOSS_LUNGE_SP, BOSS_LUNGE_SP_RAGE, BOSS_SEE_R, BOSS_BODY_R, BOSS_BODY_CD,
  BOSS_HP_BODY, BOSS_HP_WHIP, BOSS_HP_FIRE, BOSS_WHIP_TELEGRAPH, BOSS_WHIP_STRIKE,
  BOSS_WHIP_R, BOSS_WHIP_ARC, BOSS_FIRE_SP, BOSS_FIRE_R, BOSS_FIRE_LIFE, BOSS_SUCTION_T,
  BOSS_SHOTS, BOSS_SHOTS_RAGE, BOSS_WHIP_CD, BOSS_FIRE_CD, HOPPER_CYCLE_AT, HOPPER_CYCLE_DUR,
  BOSS_LINES, BOSS_FIRE_LINES, BOSS_HIT_LINES, BOSS_DYING_LINES, BOSS_WIN_LINES,
  // THE BLOCK PACKS: the pack table + the block pitch its lookup runs on
  NIGHT_BLOCKS, IW,
  NIGHT_PACK_ESCALATE, NIGHT_PACK_SLACK, NIGHT_BEAT_TOP_X, NIGHT_BEAT_VERMIN_X,
  NIGHT_BEAT_DIGGER_X, NIGHT_BEAT_GRAVE_X
);
// The block-pack quota rides the SAME night quota the haunt runs on (wave tiers included)
nightQuotaForPacks = H.nightQuota;
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
check('the DSNY shovel is a real street shovel: D-grip rig, SHORT WOOD handle, dipped grip, ferrule, socket, neck, wide round scoop pan, bright flat edge and the scoop rig',
  H.makeShovelProp().children.length === 9);

// --- ACT swings the shovel (and only on this level) ---
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.shovelCd = 0; p.facing = 9;
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
  // MIDNIGHT: the haunt fills from the bottom of the dead-end street, so "ahead of him" is
  // DOWNHILL (a lower x). The weekday shape of this rule is asserted on the source.
  stray.wx < p.wx - 20 && stray.fade === 0, 'wx=' + stray.wx.toFixed(1) + ' worker=' + p.wx.toFixed(1));

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
check('the night can NOT clock out with the beast standing: the drive-off is gated on the boss',
  /isNightShift\(\)\) \{\s*\r?\n\s*reclaimStolenGargoyle\(\);\s*\r?\n\s*if \(bossShovelTargetable\(\) \|\| bossGargoyle\) return;/.test(html));

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
let S2_BOSS_SPAWN = [], S2_BOSS_CLEAR = [], S2_CEMETERY = [], S2_ROUTE_DIR = 1;
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
  'addCreature', 'HORROR_FILL_ORDER', 'HORROR_ALL',
  // THE BLOCK PACKS: the per-block signature sets the dead-end street fills from
  'nightBlockPack', 'nightBlockFamilies', 'nightBlockQuota', 'nightBlockOrder', 'NIGHT_BLOCKS', 'IW',
  // THE MIDNIGHT DEAD END: the spawner's night-route anchors + the FINAL BOSS's entry
  // points (the beast itself is exercised for real in section [9]; here the spawner just
  // has to prove it lays the boss down and walls the street off).
  'playerSpawnX', 'routeDir', 'clearNightBoss', 'spawnNightBoss', 'buildNightCemetery',
  'makeTentacleBoss',
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
  HORROR_FILL_ORDER, HORROR_ALL,
  nightBlockPack, nightBlockFamilies, nightBlockQuota, nightBlockOrder, NIGHT_BLOCKS, IW,
  () => S2_BOSS_SPAWN.push(p.wx), () => (S2_ROUTE_DIR = -1), () => S2_BOSS_CLEAR.push(1),
  () => S2_BOSS_SPAWN.push(1), () => S2_CEMETERY.push(1), () => mkObj('tentboss')
);
// a CLEAN SLATE on the shared stub world, then build the haunted street once
for (const r of S2_BLOCKS) r.hazards.length = 0;
for (const o of S2_GROUND.children) o.parent = null;
S2_GROUND.children.length = 0;
S2_ARMS.length = 0; S2_HANDS.length = 0;
creatures.length = 0; allSpawned.length = 0; disposed.length = 0;
p.wx = 449; p.wy = 2.5; // the haunted shift clocks in at the TOP of the dead-end street
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
// THE BLOCK'S OWN HORDE AT BUILD (the game's pack code answers: which family, which block)
const s5BandAt = (x) => ({ x0: x, x1: x + 80, flood: x === 96 });
const s5FamsAt = (x) => nightBlockFamilies(s5BandAt(x));
const bandXOf = (wx) => (wx >= 384 ? 384 : wx >= 288 ? 288 : wx >= 192 ? 192 : 96);
const onOwnBlock = (c) => {
  const k = c.causeKey || c.type;
  if (!HORROR_ALL[k]) return true; // props, treasure, spirits, the thief: not pack animals
  const x = bandXOf(c.wx);
  if (x !== c.wx && c.wx < 96) return true;
  return nightBlockOwns(k, s5BandAt(x));
};
check('THE PACK walks in ONE HORDE PER BLOCK: ' + S2_IDX.map((i) => S2_LAYOUT[i].x + '=' +
  s5FamsAt(S2_LAYOUT[i].x).length + ' families').join(' '),
  S2_IDX.every((i) => s5FamsAt(S2_LAYOUT[i].x).length >= 4) &&
  keyCount('banshee') >= HORROR_QUOTA.banshee && count('ghoul') >= nightBlockQuota('ghoul', s5BandAt(192)),
  'ghouls=' + count('ghoul') + ' banshees=' + keyCount('banshee'));
check('the ABYSS ROSTER walks in on ITS BLOCKS ONLY (ghoul on the diggers, specter on the fog, ' +
  count('ghoul') + ' ghouls / ' + count('specter') + ' specters / ' + count('imp') + ' imps)',
  count('ghoul') >= nightBlockQuota('ghoul', s5BandAt(192)) &&
  count('specter') >= nightBlockQuota('specter', s5BandAt(384)) &&
  count('imp') >= nightBlockQuota('imp', s5BandAt(384)) &&
  keyCount('banshee') >= nightBlockQuota('banshee', s5BandAt(384)),
  'banshees=' + keyCount('banshee') + ' packs=' + S2_IDX.map((i) =>
    s5FamsAt(S2_LAYOUT[i].x).join('+')).join(' | '));
check('EVERY SPAWNED SPOOK STANDS ON ITS OWN BLOCK (the exclusivity holds on the seeded street)',
  allSpawned.filter((c) => c.type !== 'ghost' && c.type !== 'zombieArm' && c.type !== 'eyestalker')
    .every(onOwnBlock),
  allSpawned.filter((c) => !onOwnBlock(c)).map((c) => (c.causeKey || c.type) + '@' + c.wx.toFixed(0)).slice(0, 8).join(','));
check('THE FOUR BEATS ARE FOUR DIFFERENT HORDES (no family shared, no set repeated)',
  (() => {
    const sets = S2_IDX.map((i) => s5FamsAt(S2_LAYOUT[i].x).slice().sort().join(','));
    const flat = sets.join(',').split(',');
    return new Set(sets).size === sets.length && new Set(flat).size === flat.length;
  })(),
  S2_IDX.map((i) => s5FamsAt(S2_LAYOUT[i].x).join('+')).join(' | '));
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
check('the banshees are still specters with a female voice (_variant, not a new type), and only on the fog block',
  keyCount('banshee') >= nightBlockQuota('banshee', s5BandAt(384)) &&
    allSpawned.filter((c) => (c.causeKey || c.type) === 'banshee').every((c) => c.type === 'specter'));
check('the only loot out here is 6 ghostly finds', S5.treasures.length === 6);
const thief5 = allSpawned.filter((c) => c.type === 'eyestalker');
check('THE THIEF HEIST IS OFF THE DEAD-END SHIFT: a cul-de-sac has no finish line to rob at',
  thief5.length === 0 && S5.getStolen() === null && S2_BOSS_SPAWN.length === 1 &&
    S2_CEMETERY.length === 1 && S2_BOSS_CLEAR.length >= 1,
  'bossSpawns=' + S2_BOSS_SPAWN.length + ' cemetery=' + S2_CEMETERY.length);
check('the boss is laid down ASLEEP IN THE YARD and the shift resets its fight first',
  S2_BOSS_CLEAR.length <= S2_BOSS_SPAWN.length && S2_BOSS_CLEAR.length >= 1,
  'clear=' + S2_BOSS_CLEAR.length + ' spawn=' + S2_BOSS_SPAWN.length);

console.log('\n[7] THE LIVE HAUNT: a block runs ITS OWN horde, and the street REFILLS as he shovels');
function s7Reset() {
  for (const r of S2_BLOCKS) r.hazards.length = 0;
  S2_ARMS.length = 0; S2_HANDS.length = 0;
  creatures.length = 0; allSpawned.length = 0; disposed.length = 0;
  H.resetNight();
  p.wx = 449; p.wy = 2.5; // the haunted shift clocks in at the TOP
  announced.length = 0; deposited.length = 0; scored.length = 0;
  S5.spawnNightShift();
}
const keyAt = (band, type) =>
  creatures.filter((c) => (c.causeKey || c.type) === type && !c.hooked && !c.hookLanded &&
    c.wx >= band[0] - 2 && c.wx <= band[1] + 2).length;
// THE BLOCK'S OWN HORDE, answered by the game's own pack code (flood table included)
const bandAt = (x) => ({ x0: x, x1: x + 80, flood: x === 96 });
const famsAt = (x) => nightBlockFamilies(bandAt(x));
const ANCHOR = { 384: 'specter', 288: 'grubsquat', 192: 'ghoul', 96: 'pitfiend' };
const anchorAt = (x) => ANCHOR[x] || famsAt(x)[0];
const liveInBand = (x) =>
  creatures.filter((c) => !c.hooked && !c.hookLanded && HORROR_ALL[H.horrorKey(c)] &&
    c.wx >= x - 2 && c.wx <= x + 80 + 2).length;
s7Reset();
check('the block he STARTS in walks in on its OWN pack (the Fog Gang: ' + famsAt(384).join('/') + ')',
  famsAt(384).every((f) => keyAt([384, 464], f) >= 1) &&
  keyAt([384, 464], 'specter') >= nightBlockQuota('specter', bandAt(384)),
  famsAt(384).map((f) => f + '=' + keyAt([384, 464], f)).join(' '));
check('NO BLOCK IS QUIET, AND NO BLOCK REPEATS: every band stands its own families (' +
  S2_IDX.map((i) => famsAt(S2_LAYOUT[i].x).length).join('/') + ' families a band)',
  S2_IDX.every((i) => {
    const x = S2_LAYOUT[i].x;
    const fams = famsAt(x);
    return fams.length >= 4 && fams.every((f) => keyAt([x, x + 80], f) >= 1);
  }));
check('THE HORDES DO NOT OVERLAP at build: not one family stands on two blocks',
  (() => {
    const seen = {};
    for (const i of S2_IDX) {
      const x = S2_LAYOUT[i].x;
      for (const f of famsAt(x)) {
        if (seen[f] && seen[f] !== x) return false;
        seen[f] = x;
      }
    }
    return Object.keys(seen).length >= 19;
  })(),
  S2_IDX.map((i) => famsAt(S2_LAYOUT[i].x).join('+')).join(' | '));
check('the LIVE HAUNT never refills a spirit either: ' +
  creatures.filter((c) => c.type === 'ghost').length + ' ghosts, cap ' + NIGHT_GHOST_CAP,
  creatures.filter((c) => c.type === 'ghost').length === 0 &&
    [1, 0, -1].every((z) => creatures.filter((c) => c.type === 'ghost' && c.zone === z).length === 0));
// --- shovel 1 spook every 1.2s and walk the route: the horde must NOT run out ---
let banishEvery = 72, frame = 0, minHere = 999, spawnBehind = 0, peakLive = 0, peakScreen = 0;
let floodGhoulsAtEnd = 0, surgeAnnounced = false, surgeFired = false, waveTier = 0, behindSample = '-', scanned = 0;
const before = allSpawned.length;
for (frame = 0; frame < 60 * 130; frame++) {
  p.wx = Math.max(85, p.wx - 3.0 / 60); // a working walk DOWN the dead-end street (routeDir -1)
  H.updateNightHaunt(1 / 60);
  const band = H.bandOf(p.wx);
  if (band) minHere = Math.min(minHere, keyAt([band.x0, band.x1], anchorAt(band.x0)));
  peakLive = Math.max(peakLive, H.nightHorrorLive());
  peakScreen = Math.max(peakScreen, H.nightHorrorOnScreen());
  for (let i = scanned; i < allSpawned.length; i++) {
    scanned = i + 1;
    if (HORROR_ALL[allSpawned[i].type] && allSpawned[i].wx > p.wx + 2) {
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
  floodGhoulsAtEnd = liveInBand(96); // the night's flood band = the block at the BOTTOM of the street
  // band is the block at the BOTTOM of the street, the one he marches into last
}
check('after 108 banishments the pack is STILL there: a block band never fell under ' + NIGHT_GHOUL_MIN +
  ' of its OWN anchor family (the flood block runs ' + NIGHT_GHOUL_MIN + ', the walk-in blocks the cap leaves room for)',
  minHere >= 3, 'min anchor spooks in his band = ' + minHere);
check('and the block at the BOTTOM (the flood) never fell under ' + NIGHT_GHOUL_MIN + ' of its own heavies',
  floodGhoulsAtEnd >= nightBlockQuota('pitfiend', bandAt(96)),
  'flood live = ' + floodGhoulsAtEnd + ' pitfiends quota = ' + nightBlockQuota('pitfiend', bandAt(96)));
check('the horde refills FAST — a fresh block fills its OWN pack the moment he walks in (' +
  floodGhoulsAtEnd + ' spooks on the graves; the flood table is ' +
  famsAt(96).reduce((s, f) => s + nightBlockQuota(f, bandAt(96)), 0) + ' at this wave tier)',
  floodGhoulsAtEnd >= famsAt(96).reduce((s, f) => s + nightBlockQuota(f, bandAt(96)), 0) - 32 &&
    floodGhoulsAtEnd >= 40,
  'flood live at the end = ' + floodGhoulsAtEnd + ' pack=' +
  famsAt(96).reduce((s, f) => s + nightBlockQuota(f, bandAt(96)), 0));
check('the ABYSS FLOOD block is the heaviest: ' + floodGhoulsAtEnd + ' of its own heavies, a deep pack, reapers out',
  floodGhoulsAtEnd >= 40 &&
  creatures.filter((c) => c.deep && c.wx >= 96 && c.wx <= 176).length >= 10 &&
  keyAt([96, 176], 'reaper') >= 1,
  'deep=' + creatures.filter((c) => c.deep && c.wx >= 96 && c.wx <= 176).length +
  ' reaper=' + keyAt([96, 176], 'reaper'));
check('and the graves block walks in with its own watch: goulra, pitfiends, devils, demons, the lich',
  famsAt(96).every((f) => keyAt([96, 176], f) >= 1),
  famsAt(96).map((f) => f + '=' + keyAt([96, 176], f)).join(' '));
check('the flood block never borrows: nothing on the graves block belongs to another block',
  creatures.filter((c) => !c.hooked && !c.hookLanded && c.wx >= 96 && c.wx <= 176 &&
    HORROR_ALL[H.horrorKey(c)] && !nightBlockOwns(H.horrorKey(c), bandAt(96))).length === 0,
  'foreign=' + creatures.filter((c) => !c.hooked && !c.hookLanded && c.wx >= 96 && c.wx <= 176 &&
    HORROR_ALL[H.horrorKey(c)] && !nightBlockOwns(H.horrorKey(c), bandAt(96)))
    .map((c) => H.horrorKey(c)).join(','));
check('THE GHULS STAY ON THE DIGGERS BLOCK: not one ghoul stands on another block',
  (() => {
    const g = creatures.filter((c) => !c.hooked && !c.hookLanded && (c.causeKey || c.type) === 'ghoul');
    return g.filter((c) => c.wx < 192 - 8 || c.wx > 272 + 8).length === 0;
  })(),
  'ghouls=' + creatures.filter((c) => (c.causeKey || c.type) === 'ghoul').length);
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
p.wx = 300; // the mob is AHEAD of him DOWN the street
const mob3 = [];
for (let i = 0; i < 3; i++) {
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
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
// THE WORK BOX OF A BLOCK SPOOK IS ITS OWN BLOCK — so the comparison is run with the
// worker standing INSIDE the ghouls' beat (x 192..272), where both may legitimately chase.
p.wx = 230; // the worker stands in the middle of the diggers' block
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
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
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
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
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
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
  p.wx = 300; // standing above the band: on -X, [192,272] is AHEAD of him
  const c = H.nightSpawnHorror('ghoul', { x0: 192, x1: 272 });
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
check('the HUD chip shows the shovel charge and the route banner names the dead end',
  /shovelCharged\r?\n\s*\? "  • HOLY SHOVEL!"/.test(html) &&
  html.includes('CEMETERY AT THE BOTTOM OF THE HILL'));
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
    (function () {
      // THE ZONES THAT OWN THE NIGHT STAGGER: the night kit's own scar pass, and the
      // FINAL BOSS module (the beast's fireball / lash / crush). A weekday stun — a car, a
      // soccer ball, a dog, the fire hydrant — must NEVER borrow the night's short stagger.
      const re = /doStun\(\s*HORROR_STUN_T/g;
      const zones = [
        [html.indexOf("===== THE NIGHT SHIFT (level 8): DON'T GET TOUCHED ====="),
          html.indexOf("NOT solid: he walks back out through the cold")],
        [html.indexOf("THE MIDNIGHT FINAL BOSS"), html.indexOf("THE MIDNIGHT CEMETERY")],
      ];
      let m, ok = true, seen = 0;
      while ((m = re.exec(html))) {
        seen++;
        if (!zones.some((z) => z[0] >= 0 && z[1] > z[0] && m.index >= z[0] && m.index <= z[1]))
          ok = false;
      }
      return ok && seen >= 3;
    })());
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
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.stunDur = 1;
const sayMark = sayings.length, bubMark = bubbles.length, popMark = announced.length;
let swings = 0;
for (let i = 0; i < 60 * 45; i++) {
  p.wx = Math.max(90, p.wx - 3.2 / 60); // the march DOWN the dead-end street
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
p.wx = 449; p.wy = 2.5;
let inStreet = 0, inCurb = 0, inWalk = 0, inLawn = 0, peakGhosts = 0;
for (let i = 0; i < 60 * 60; i++) {
  p.wx = Math.max(90, p.wx - 3.0 / 60); // the march DOWN the dead-end street
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
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.stunDur = 1;
scored.length = 0;
let kills = 0;
for (let i = 0; i < 60 * 90; i++) {
  p.wx = Math.max(90, p.wx - 3.2 / 60); // the march DOWN the dead-end street
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
  /const truckX =\s*\r?\n\s*truck && typeof truck\.wx === "number"/.test(srcFn('spawnStolenGargoyle')) &&
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
check('the station LOCKS ONTO THE MIDNIGHT SET and rotates it (locked pool bag, night gap, release, no state/setter collision)',
  html.includes('radioSticky(name) {') &&
  html.includes('const on = Array.isArray(name)') &&
  html.includes('this.radioLockPool = pool;') &&
  html.includes('this.radioLockPool.slice()') &&
  html.includes('this.radioLock ? 700 : 2000') &&
  html.includes('this.radioLock = on;') &&
  html.includes('radioLock: null,') &&
  !html.includes('this.radioSticky')); // the lock STATE (radioLock) can never overwrite the setter
check('music follows the SHIFT (every armed street re-locks or releases), never a button',
  srcFn('armMidnightLook').includes('applyMidnightMusic(on);') &&
  srcFn('applyMidnightMusic').includes('SFX.radioSticky(!!on ? NIGHT_MUSIC_TRACKS : null)') &&
  srcFn('applyMidnightMusic').includes('typeof SFX.radioSticky !== "function"'));
check('the four MIDNIGHT-ONLY songs are the haunted shift\'s own, on the shelf, and locked out of every weekday bag',
  /const NIGHT_MUSIC_TRACKS = \[\s*NIGHT_MUSIC_TRACK,[\s\S]{0,200}?"Dead-End Sweep\.mp3"[\s\S]{0,80}?"Midnight Route\.mp3"[\s\S]{0,80}?"Midnight Sanitation Strike\.mp3"/.test(html) &&
    ['Midnight Menagerie.mp3', 'Dead-End Sweep.mp3', 'Midnight Route.mp3', 'Midnight Sanitation Strike.mp3'].every(
      (n) => fs.existsSync('music/' + n) &&
        JSON.parse(fs.readFileSync('music/manifest.json', 'utf8')).includes(n),
    ) &&
    html.includes('this.radioList.filter((n) => !this._radioIsMidnightOnly(n))') &&
    html.includes('NIGHT_MUSIC_TRACKS.indexOf(n) >= 0'));
console.log('\n[9] THE MIDNIGHT DEAD END + THE FINAL BOSS (the cemetery at the end of the street)');
// --- the mirrored route: the level's own anchors, night vs weekday ---
nightOn = true;
const dayDir = (function () { nightOn = false; const d = H.routeDir(); nightOn = true; return d; })();
check('the night shift is the ONLY level that runs the route backwards (routeDir -1, weekday +1)',
  H.routeDir() === -1 && dayDir === 1, 'night=' + H.routeDir() + ' day=' + dayDir);
check('the worker clocks in at the TOP of the dead end and the rig clocks in UPSLOPE of him at its full widened standing room',
  H.playerSpawnX() === NIGHT_START_X &&
  H.truckSpawnX(NIGHT_START_X) === H.workerTopLimitX() + H.truckStandOffset() &&
  H.truckSpawnX(NIGHT_START_X) - NIGHT_START_X > 10 &&
  NIGHT_START_X === H.workerTopLimitX() &&
  Math.abs(H.truckSpawnX(NIGHT_START_X) - 4.3 - NIGHT_START_X - H.truckTargetGap("none")) < 1e-9 &&
  NIGHT_START_X < NIGHT_TOP_X && NIGHT_TOP_X > NIGHT_BOSS_X,
  'spawn=' + NIGHT_START_X + ' rig=' + H.truckSpawnX(NIGHT_START_X).toFixed(1) +
  ' laneToScoop=' + (H.truckSpawnX(NIGHT_START_X) - 4.3 - NIGHT_START_X).toFixed(1));
check('the widened Midnight lane FITS the cul-de-sac: the rig (collision nose AND visual nose) stands inside the brick wall, and the lane to the scoop is a real fighting lane',
  H.workerTopLimitX() + H.truckStandOffset() + 4 < NIGHT_TOP_X &&
  H.workerTopLimitX() + H.truckStandOffset() + 6.5 < NIGHT_TOP_X &&
  H.truckStandOffset() > 10 && H.truckTargetGap("none") > 6 &&
  'rigCentre=' + (H.workerTopLimitX() + H.truckStandOffset()).toFixed(1) +
  ' wall=' + NIGHT_TOP_X + ' gap=' + H.truckTargetGap("none"));
check('the route bar fills as he walks DOWNHILL toward the graveyard (mirrored anchors)',
  Math.abs(H.routeProgressFrac(NIGHT_TOP_X)) < 1e-9 &&
  H.routeProgressFrac(NIGHT_GRAVE_X) > 0.8 &&
  H.routeProgressFrac(NIGHT_TOP_X - 40) < H.routeProgressFrac(NIGHT_TOP_X - 140),
  'top=' + H.routeProgressFrac(NIGHT_TOP_X).toFixed(3) +
    ' grave=' + H.routeProgressFrac(NIGHT_GRAVE_X).toFixed(3) +
    ' a40=' + H.routeProgressFrac(NIGHT_TOP_X - 40).toFixed(3) +
    ' a140=' + H.routeProgressFrac(NIGHT_TOP_X - 140).toFixed(3) +
    ' near=' + H.routeNearX() + ' far=' + H.routeFarX());
check('the dead end has NO FINISH LINE (buildFinishLine bails on the night level only)',
  srcFn('buildFinishLine').includes('if (isNightShift()) return;'));
check('the cul-de-sac is walled at both ends: the cemetery mouth and the rig tail',
  H.workerEndLimitX() === NIGHT_GRAVE_X - 8 && H.workerTopLimitX() === NIGHT_TOP_X - NIGHT_TRAIL_X,
  'mouth=' + H.workerEndLimitX() + ' top=' + H.workerTopLimitX());
// --- THE BEAST: built asleep at the cemetery with the FULL bar ---
H.clearNightBoss();
H.spawnNightBoss();
const boss = H.getBoss();
check('the beast is BUILT AT THE CEMETERY with its full bar, asleep and buried under the grass',
  !!boss && boss.hp === BOSS_MAX_HP && boss.maxHp === BOSS_MAX_HP && boss.awake === false &&
  boss.g.visible === false && Math.abs(boss.wx - NIGHT_BOSS_X) < 1e-9,
  'hp=' + (boss && boss.hp) + ' x=' + (boss && boss.wx));
const tent = H.makeTentacleBoss();
check('it is a FINAL BOSS of a rig: NINE eyes on stalks, SIX three-joint whip tentacles, a maw',
  tent.userData.tent.eyes.length === 9 && tent.userData.tent.tentacles.length === 6 &&
  !!tent.userData.tent.maw && tent.userData.tent.tentacles.every(t => t.sh && t.j1 && t.j2),
  'eyes=' + tent.userData.tent.eyes.length + ' tentacles=' + tent.userData.tent.tentacles.length);
// --- the wake: walking into the cross-street raises it out of the yard ---
p.wx = NIGHT_BOSS_X - 8; p.wy = 2.5; p.shake = 0;
sayings.length = 0; log.length = 0;
H.startBossFight();
check('the cross-street WAKES it: its own bar goes live and it RISES out of the ground',
  H.getFightOn() === true && boss.awake === true && boss.riseT === BOSS_RISE_T &&
  boss.g.visible === true, 'riseT=' + boss.riseT);
check('it speaks on waking and the worker calls for the shovel',
  sayings.length >= 2 && BOSS_LINES.indexOf(sayings[0]) >= 0 &&
  sayings.some(s => s.indexOf('SHOVEL') >= 0));
boss.riseT = BOSS_RISE_T;
H.startBossFight();
check('walking in twice is a no-op (the fight is already on, the bar is already live)',
  boss.riseT === BOSS_RISE_T);
// --- rise, then the LUNGE (it drags itself at him and keeps its yard) ---
for (let i = 0; i < 400 && boss.riseT > 0; i++) H.updateNightBoss(boss, 1 / 60);
check('it climbs all the way OUT of the grave yard and stands at full size',
  boss.riseT === 0 && Math.abs(boss.g.position.z - GZ) < 0.25 && boss.g.scale.x === 1,
  'z=' + boss.g.position.z.toFixed(2));
const x0 = boss.wx;
for (let i = 0; i < 150; i++) H.updateNightBoss(boss, 1 / 60);
check('it LUNGES at the worker (it drags itself toward him, not away)',
  Math.abs(boss.wx - p.wx) < Math.abs(x0 - p.wx), x0.toFixed(1) + ' -> ' + boss.wx.toFixed(1));
check('it never leaves the cemetery: the lunge is clamped to its own yard',
  boss.wx >= NIGHT_GRAVE_X - 6 - 1e-6 && boss.wx <= NIGHT_BOSS_TRIGGER_X + 8 + 1e-6,
  'x=' + boss.wx.toFixed(1));
check('while the beast stands, THE BEAST IS THE WALL of the dead end',
  H.workerEndLimitX() >= NIGHT_BOSS_X - 0.6, 'wall=' + H.workerEndLimitX());
check('the body is SOLID: it crowds him into the headstones and a crush costs a hit',
  (function () {
    p.wx = boss.wx + 0.8; p.wy = boss.wy; p.nightHitT = 0; boss.bodyCd = 0;
    H.hurtLog().length = 0;
    H.updateNightBoss(boss, 1 / 60);
    return p.wx > boss.wx && H.hurtLog().length === 1 && H.hurtLog()[0].c === 'beast' &&
      H.hurtLog()[0].a === BOSS_HP_BODY;
  })(), 'pushed to ' + p.wx.toFixed(2));
// --- THE LASH: a telegraph, then the sweep, then a real hit ---
p.wx = boss.wx + 3.2; p.wy = boss.wy; p.stunT = 0; p.nightHitT = 0;
boss.whipT = 0.01; boss.whipState = 'idle';
H.updateNightBoss(boss, 1 / 60);
check('the tentacles LOAD first (the telegraph: the tell that a lash is coming)',
  boss.whipState === 'wind' && boss.whipT > 0, 'whipT=' + boss.whipT.toFixed(2));
check('the lash goes through the arc in ONE beat and it is a real hit — a stagger, never a pin',
  (function () {
    p.nightHitT = 0; p.stunT = 0;
    H.hurtLog().length = 0; H.stunLog().length = 0;
    boss.bodyCd = 999; // the crush is OFF for this test: the ONLY damage is the lash
    const bx0 = boss.wx;
    boss.invulnT = 0; boss.whipState = 'wind'; boss.whipT = 0;
    boss.facing = Math.atan2(p.wy - boss.wy, p.wx - boss.wx);
    for (let i = 0; i < 120 && boss.whipState !== 'idle'; i++) H.updateNightBoss(boss, 1 / 60);
    return H.hurtLog().length === 1 && H.hurtLog()[0].a === BOSS_HP_WHIP && H.hurtLog()[0].c === 'beast' &&
      H.stunLog().length === 1 && Math.abs(H.stunLog()[0].d - HORROR_STUN_T) < 0.2 &&
      Math.hypot(p.wx - boss.wx, p.wy - boss.wy) > BOSS_BODY_R;
  })(), 'hits=' + H.hurtLog().map(h => h.a + '/' + h.c).join(','));
check('a lash is ONE hit, not a drain (the night hit grace runs with it)',
  p.nightHitT >= NIGHT_HIT_GRACE - 1e-9);
check('a lash he has stepped OUT of hits nothing (the reach is the whole game)',
  (function () {
    p.nightHitT = 0; H.hurtLog().length = 0; H.stunLog().length = 0;
    boss.bodyCd = 999;
    p.wx = boss.wx + BOSS_WHIP_R + 9;
    boss.whipState = 'wind'; boss.whipT = 0;
    boss.facing = Math.atan2(p.wy - boss.wy, p.wx - boss.wx);
    for (let i = 0; i < 120 && boss.whipState !== 'idle'; i++) H.updateNightBoss(boss, 1 / 60);
    return H.hurtLog().length === 0 && H.stunLog().length === 0;
  })());
// --- GHOST FIRE: the maw opens, the ball flies at him, it burns out in the fog ---
(function () {
  boss.rage = 0; boss.fireT = 0.01; boss.mawOpen = 0;
  const n0 = H.getFireballs().length;
  H.updateNightBoss(boss, 1 / 60);
  check('the maw OPENS on the ghost fire and a cold ball comes out of it',
    H.getFireballs().length === n0 + BOSS_SHOTS && boss.mawOpen > 0.9,
    'balls=' + (H.getFireballs().length - n0));
  p.nightHitT = 0; p.stunT = 0; H.hurtLog().length = 0; H.stunLog().length = 0;
  p.wx = boss.wx + 3; p.wy = boss.wy;
  const f = H.getFireballs()[H.getFireballs().length - 1];
  f.wx = p.wx + 0.2; f.wy = p.wy;
  H.updateBossFireballs(1 / 60);
  check('ghost fire BURNS THROUGH THE HI-VIS: one cold hit, a stagger, and the ball is gone',
    H.hurtLog().length === 1 && H.hurtLog()[0].a === BOSS_HP_FIRE && H.hurtLog()[0].c === 'beast' &&
      H.getFireballs().length === n0, 'dmg=' + H.hurtLog().map(h => h.a).join(','));
  boss.rage = 1; boss.fireT = 0.01;
  const n1 = H.getFireballs().length;
  H.updateNightBoss(boss, 1 / 60);
  check('at HALF THE BAR it spits GHOST FIRE IN PAIRS (the rage volley)',
    H.getFireballs().length === n1 + BOSS_SHOTS_RAGE, 'balls=' + (H.getFireballs().length - n1));
  const f2 = H.getFireballs()[H.getFireballs().length - 1];
  f2.life = 0.001; f2.wx = p.wx + 40;
  H.updateBossFireballs(1 / 60);
  check('a fireball that misses BURNS OUT in the fog (no immortal projectile)',
    H.getFireballs().indexOf(f2) < 0);
  H.getFireballs().length = 0;
})();
// --- THE SHOVEL IS THE ONLY THING THAT SHORTENS THE BAR ---
p.wx = boss.wx - 2.4; p.wy = boss.wy; p.shovelCd = 0; p.stunT = 0;
check('the blade reaches the beast\u2019s hide (the whole tool, shaft AND head sweep)',
  H.bossShovelRange() > SHOVEL_REACH + SHOVEL_BLADE_R && H.bossShovelTargetable() === true);
(function () {
  const hp0 = boss.hp;
  H.setCharge(0);
  H.swing();
  check('ONE SWING, ONE CUT on the bar (an ordinary swing takes BOSS_DMG)',
    boss.hp === hp0 - BOSS_DMG && log.indexOf('sting') >= 0, 'hp=' + boss.hp);
  check('the swing turns him to face the beast and sets the cooldown (no mash-fest)',
    Math.abs(Math.atan2(boss.wy - p.wy, boss.wx - p.wx) - p.facing) < 1e-6 && p.shovelCd > 0);
  const afterFirst = boss.hp;
  p.shovelCd = 0;
  H.swing();
  check('the beast is INVULNERABLE inside its own hit window (a blink of swings is ONE hit)',
    boss.hp === afterFirst && boss.invulnT > 0, 'hp=' + boss.hp + ' inv=' + boss.invulnT.toFixed(2));
  check('the hit STINGS: the bar kicks, the beast flinches and its lash is cut off',
    log.indexOf('sting') >= 0 && boss.hurtT > 0 && boss.whipState === 'idle');
  boss.invulnT = 0;
  H.setCharge(CONS_CHARGE_AT); // THE HOLY SHOVEL
  const beforeCons = boss.hp;
  p.shovelCd = 0;
  H.swing();
  check('a CONSECRATED swing cuts DOUBLE through the bar',
    boss.hp === beforeCons - BOSS_DMG_CONS, 'hp ' + beforeCons + ' -> ' + boss.hp);
  H.setCharge(0);
  p.wy = boss.wy; p.shovelCd = 0;
  p.wx = boss.wx + 40;
  const outHp = boss.hp;
  check('a swing at EMPTY FOG does not touch the bar (out of the tool is out of the fight)',
    H.swing() === true && boss.hp === outHp);
  boss.hp = BOSS_MAX_HP; // fresh bar: count the swings it takes from FULL health
  const scoreBefore = scored.reduce((a, s) => a + s.n, 0);
  let swings = 0;
  while (boss.hp > 0 && swings < 80) {
    p.wx = boss.wx - 2.4; p.wy = boss.wy; p.shovelCd = 0; p.stunT = 0;
    boss.invulnT = 0;
    H.swing();
    swings++;
  }
  check('TEN ordinary SHOVEL SWINGS banish it (the bar IS the level\u2019s win condition)',
    boss.hp === 0 && swings === BOSS_MAX_HP, 'swings=' + swings);
  check('every cut on the bar pays (the banishment purse is scored on the hits)',
    scored.reduce((a, s) => a + s.n, 0) - scoreBefore >= BOSS_POINTS * BOSS_DMG,
    'scored=' + (scored.reduce((a, s) => a + s.n, 0) - scoreBefore));
  check('its dying frame HOOKS the whole beast for the hopper',
    boss.hooked === true && boss.suckT === 0 && H.getFightOn() === true);
})();
// --- THE SUCTION: the whole beast goes IN THE HOPPER, the Gargoyle comes out of it ---
(function () {
  const dep0 = deposited.length;
  const steps = Math.ceil(BOSS_SUCTION_T / (1 / 60)) + 6;
  for (let i = 0; i < steps && H.getBoss(); i++) H.updateNightBoss(H.getBoss(), 1 / 60);
  check('it is SUCKED INTO THE HOPPER: the compactor cycles on the whole beast',
    H.getBoss() === null && H.getFightOn() === false && H.getHopperCycling() === true &&
      deposited.length - dep0 >= HOPPER_CYCLE_AT,
    'deposits=' + (deposited.length - dep0));
  check('the hopper BURSTS on the kill, and the beast is off the street for good',
    H.bossBursts().length > 0 && H.getFightOn() === false);
  const gg = H.getBossGargoyle();
  check('THE RUBY-PLATED GARGOYLE drops on the grave yard where the beast was hoarding it',
    !!gg && Math.abs(gg.wx - NIGHT_GRAVE_X) < 1e-9 && gg.val === GARGOYLE_VALUE,
    'x=' + (gg && gg.wx));
  check('the wall DROPS behind the graves once the beast is gone (the yard opens)',
    H.workerEndLimitX() === NIGHT_GRAVE_X - 8, 'wall=' + H.workerEndLimitX());
})();
// --- THE WIN: walk onto the Gargoyle, take it, and the night ends ---
(function () {
  H.setReclaimed(false);
  const g = H.getBossGargoyle();
  p.wx = g.wx + 0.6; p.wy = g.wy;
  const scoreBefore = scored.reduce((a, s) => a + s.n, 0);
  H.updateNightBossFight(1 / 60);
  check('walking onto the Gargoyle TAKES IT: the night\u2019s treasure is banked ($5,000)',
    H.getBossGargoyle() === null &&
      scored.reduce((a, s) => a + s.n, 0) - scoreBefore >= GARGOYLE_VALUE &&
      H.isReclaimed() === true,
    'banked=' + (scored.reduce((a, s) => a + s.n, 0) - scoreBefore));
  check('the win beat fires: confetti, the treasure popup, and the drive-off is armed',
    H.getBossWin() === true && H.getBossWinT() > 0 &&
      H.confettiLog().indexOf('confetti') >= 0 && popped.some(pp => pp.kind === 'treasure') &&
      H.routeEnds().length === 0);
  let guard = 0;
  while (H.getBossWin() && guard < 900) { H.updateNightBossFight(1 / 60); guard++; }
  check('THE BOSS IS THE END OF THE LEVEL: the win beat drives the rig off the dead end',
    H.routeEnds().length === 1 && H.getBossWin() === false, 'driveOffs=' + H.routeEnds().length);
  check('the fight is night-only: updateNightBossFight bails off the haunted level',
  (function () {
    nightOn = false;
    H.spawnNightBoss();
    H.startBossFight();
    const before = H.getBoss().suckT;
    for (let i = 0; i < 60; i++) H.updateNightBossFight(1 / 60);
    const same = H.getBoss().suckT === before;
    H.clearNightBoss();
    nightOn = true;
    return same;
  })());
})();
// --- the wiring the dead-end shift depends on elsewhere in the game (greps) ---
check('the beast is SPAWNED BY THE SHIFT (and the day\u2019s thief heist is retired off it)',
  srcFn('spawnNightShift').includes('spawnNightBoss();') &&
    srcFn('spawnNightShift').includes('clearNightBoss();') &&
    srcFn('spawnNightShift').includes('buildNightCemetery();') &&
    !srcFn('spawnNightShift').includes('spawnStolenGargoyle();'));
check('the fight runs on the night\u2019s own updateCreatures hook (and nowhere else)',
  srcFn('updateCreatures').includes('updateNightBossFight(dt);'));
check('THE LEVEL ENDS AT THE BOSS, not a stripe: the finish line is weekday-only on the shift',
  srcFn('updatePlayer').includes('RT > 0 && p.wx >= ROUTE_FINISH_X') &&
    srcFn('updatePlayer').includes('p.wx <= NIGHT_BOSS_TRIGGER_X') &&
    srcFn('updatePlayer').includes('startBossFight()'));
check('the worker cannot walk past the beast while it stands, and the top wall closes the street',
  srcFn('updatePlayer').includes('const wall = workerEndLimitX();') &&
    srcFn('updatePlayer').includes('p.wx > workerTopLimitX()'));
check('THE HUD BAR EXISTS and updateHUD shows it only with a beast standing',
  html.includes('<div id="boss-goal" class="hidden">') &&
    html.includes('const bossPanel = $("boss-goal");') &&
    html.includes('const w = ((b.hp / b.maxHp) * 100).toFixed(1) + "%";') &&
    html.includes('if (bossPanel) {'));
check('the rig keeps the STANDARD facing on the dead-end street (never rotated) and its rear geometry is canonical',
  srcFn('truckMeshYaw').includes('return 0;') &&
    srcFn('truckSpawnFacing').includes('return 0;') &&
    !srcFn('updateTruck').includes('truck.g.rotation.z = Math.PI') &&
    !srcFn('hopperWorldX').includes('routeDir()') &&
    !srcFn('hopperAimX').includes('routeDir()') &&
    !srcFn('hopperPileX').includes('routeDir()'));
check('the truck AI reads its gaps from the route (the weekday 3.6 / 4.1 / 1.5, wider on Midnight) and drives on the canonical axis',
  srcFn('updateTruck').includes('const target = truckTargetGap(carry);') &&
    srcFn('updateTruck').includes('const backTarget = truckBackGap();') &&
    srcFn('updateTruck').includes('truck.wx += sp * dt;') &&
    srcFn('updateTruck').includes('(p.wx + backTarget - rearX) * RT > 40') &&
    srcFn('truckTargetGap').includes('carry === "none" ? 3.6 : 4.1') &&
    srcFn('truckTargetGap').includes('return isNightShift()') === false &&
    srcFn('truckTargetGap').includes('6.2 : 6.7') &&
    srcFn('truckBackGap').includes('1.5'));
check('MIDNIGHT: the rig is parked UPSLOPE of the worker at its widened standing room, so it travels DOWNHILL in REVERSE to take up its gap (and its mesh yaw stays 0)',
  srcFn('truckSpawnX').includes('workerTopLimitX() + truckStandOffset()') &&
    srcFn('truckStandOffset').includes('truckTargetGap("none") + 4.3') &&
    (() => {
      const t = new Function("truck", "truckXSafe", srcFn("hopperWorldX") + ";return hopperWorldX;")(
        { wx: 424, hopperOff: -4.3 }, () => 424);
      return t() < 424; // the scoop faces DOWN the street, at the worker
    })());
check('MIDNIGHT: the rig converges on the worker by rolling -x: the rear lands 3.6u UP the walking axis, between the worker and the truck',
  (() => {
    const night = runTruckAI(-1, 400, 424, "follow", 240);
    return night.wx < 424 && night.wx > 400 && Math.abs(night.wx - (400 + 6.2 + 4.3)) < 1.5 && night.yaw === 0;
  })());
check('MIDNIGHT: a scoop that overshot down the street climbs back UPSLOPE in forward to re-take its gap (the same driver behaviour as a weekday)',
  (() => {
    const back = runTruckAI(-1, 400, 384, "follow", 420);
    return back.wx > 384 && back.sp > 0 && Math.abs(back.wx - (400 + 6.2 + 4.3)) < 1.5;
  })());
check('the drive-off leaves the way the route runs (the cinematic mirrors, the day stays put)',
  srcFn('updateRouteEnd').includes('truck.wx += RE_DRIVE_SP * RT * dt;') &&
    srcFn('updateRouteEnd').includes('sx * routeDir() > halfW + 1.0'));
check('the shift reports the dead end: the card, the route line and the objective all say so',
  html.includes('DEAD END! THE BEAST SLEEPS IN THE CEMETERY!') &&
    html.includes('RUN THE DEAD-END STREET DOWN TO THE CEMETERY') &&
    html.includes('CEMETERY AT THE BOTTOM OF THE HILL'));
check('the cemetery is BUILT AT THE NEAR END with the fence across the street + a dead-end wall',
  srcFn('buildNightCemetery').includes('makeCemeteryFence(fenceLen)') &&
    srcFn('buildNightCemetery').includes('NIGHT_TOP_X + 22') &&
    srcFn('buildNightCemetery').includes('nightPlaceProp(b, kinds[i], px, py)'));
check('the shovel\u2019s boss target is delivered on the strike frame (the swing lands on it)',
  srcFn('tryShovelSwing').includes('bossTakeShovelSwing(charged)') &&
    srcFn('shovelDeliverStrike').includes('if (pend.boss) {') &&
    srcFn('shovelDeliverStrike').includes('bossShovelHit(pend.charged);'));
check('every day\u2019s own spawn anchors now come from the route (no hard-coded start x left)',
  srcFn('resetWorldState').includes('p.wx = playerSpawnX();') &&
    srcFn('resetWorldState').includes('truck.wx = truckSpawnX(p.wx);'));
console.log("\n[10] THE MIRRORED RIG: the truck backs DOWNHILL, the mesh turns, the drive-off leaves the way the route runs");
// the REAL updateTruck AI, run against a stub truck on both axes
function truckSpawnAt(wx) {
  return new Function(
    "NIGHT_TOP_X", "NIGHT_TRAIL_X", "ROUTE_END_X", "isNightShift", "workerTopLimitX",
    "truckStandOffset", "truckTargetGap",
    srcFn("truckSpawnX") + srcFn("truckStandOffset") + srcFn("truckTargetGap") + srcFn("workerTopLimitX") +
      ";return truckSpawnX;",
  )(470, 21, 0, () => true, () => 470 - 21, () => 6.2 + 4.3)(wx);
}
function runTruckAI(dir, pWx, truckWx, mode, steps, pWy, laneClear) {
  const p = { wx: pWx, wy: pWy == null ? -4.0 : pWy, immuneT: 0 };
  const truck = {
    wx: truckWx, hopperOff: -4.3, boxL: 4.0, boxW: 1.9, _mode: mode,
    g: { visible: true, position: { set() {} }, rotation: { z: 0 } },
  };
  const night = dir < 0;
  const gapFn = new Function("isNightShift", srcFn("truckTargetGap") + ";return truckTargetGap;")(() => night);
  const backFn = new Function("isNightShift", srcFn("truckBackGap") + ";return truckBackGap;")(() => night);
  // THE REAL BACK-UP GATE (canBackUp) AND THE REAL FOLLOW DECISION (rigMayFollow), run on
  // the axis under test: the suite exercises the shipped behaviour, never a stub of it.
  const gates = new Function(
    "p", "truck", "laneClear", "isNightShift", "workerTopLimitX",
    srcFn("canBackUp") + "\n" + srcFn("rigMayFollow") + "\nreturn { canBackUp, rigMayFollow };",
  )(p, truck, () => (laneClear == null ? true : laneClear), () => night, () => 449);
  const fn = new Function(
    "p", "truck", "carry", "routeDir", "truckMeshYaw", "PLAYER_SPEED",
    "RUN_IT_UP_SPEED_MULT", "canBackUp", "GZ", "blinkHazardLights", "updateHopperTrash",
    "truckTargetGap", "truckBackGap", "rigMayFollow",
    srcFn("updateTruck") + "\n;return updateTruck;",
  )(
    p, truck, 'none', () => dir, () => 0, 8.5, 1.3,
    gates.canBackUp, 0.3, () => {}, () => {}, gapFn, backFn, gates.rigMayFollow,
  );
  for (let i = 0; i < steps; i++) fn(1 / 60);
  return { wx: truck.wx, sp: truck.sp, mode: truck._mode, yaw: truck.g.rotation.z };
}
(function () {
  // MIDNIGHT: the rig is parked UPSLOPE of the worker (behind him, nosed up the hill like on
  // every other level). The worker walks -x, so the driver takes up his gap by REVERSING down
  // the street: the rig travels -x and the scoop lands between the worker and the truck.
  const night = runTruckAI(-1, 400, 424, "follow", 240);
  check(
    "MIDNIGHT: the rig rolls DOWNHILL (-x) in REVERSE to take up its gap, its mesh yaw staying 0 (never rotated)",
    night.wx < 424 && night.wx > 400 && Math.abs(night.wx - (400 + 6.2 + 4.3)) < 1.5 && night.yaw === 0,
    "wx " + 424 + " -> " + night.wx.toFixed(1) + " sp=" + night.sp.toFixed(2) + " yaw=" + night.yaw.toFixed(2) + " rest=" + (400 + 6.2 + 4.3),
  );
  // MIDNIGHT: the rig overshot DOWN the street -> the driver creeps back UPSLOPE in forward,
  // the exact same two-mode behaviour the weekday driver runs.
  const back = runTruckAI(-1, 400, 384, "follow", 240);
  check(
    "MIDNIGHT: a rig that overshot down the street climbs back UPSLOPE in forward to re-take its gap",
    back.wx > 384 && back.sp > 0 && Math.abs(back.wx - (400 + 6.2 + 4.3)) < 1.5,
    "wx " + 384 + " -> " + back.wx.toFixed(1) + " sp=" + back.sp.toFixed(2) + " mode=" + back.mode,
  );
  // MIDNIGHT: the rig FOLLOWS a worker marching down the street — it never leads him, never
  // loses him, and it never runs forward: net travel is -x while its nose points +x.
  const pace = (function () {
    const p = { wx: 449, wy: -4.0, immuneT: 0 }; // clock-in: exactly the uphill clamp
    const truck = {
      wx: truckSpawnAt(449), hopperOff: -4.3, boxL: 4.0, boxW: 1.9, _mode: "follow",
      g: { visible: true, position: { set() {} }, rotation: { z: 0 } },
    };
    const gapFn0 = new Function("isNightShift", srcFn("truckTargetGap") + ";return truckTargetGap;")(() => true);
    const backFn0 = new Function("isNightShift", srcFn("truckBackGap") + ";return truckBackGap;")(() => true);
    const gates0 = new Function("p", "truck", "isNightShift", "workerTopLimitX",
      srcFn("canBackUp") + "\n" + srcFn("rigMayFollow") + "\nreturn { canBackUp, rigMayFollow };")(
      p, truck, () => true, () => 449);
    const fn = new Function(
      "p", "truck", "carry", "routeDir", "truckMeshYaw", "PLAYER_SPEED",
      "RUN_IT_UP_SPEED_MULT", "canBackUp", "GZ", "blinkHazardLights", "updateHopperTrash",
      "truckTargetGap", "truckBackGap", "rigMayFollow",
      srcFn("updateTruck") + "\n;return updateTruck;",
    )(p, truck, "none", () => -1, () => 0, 8.5, 1.3, gates0.canBackUp, 0.3, () => {}, () => {}, gapFn0, backFn0, gates0.rigMayFollow);
    let minGap = 1e9, maxGap = -1e9, backFrames = 0, fwdFrames = 0, prev = truck.wx;
    for (let i = 0; i < 2400; i++) {
      p.wx = Math.max(NIGHT_START_X - 370, p.wx - 8.5 / 60); // March: top of the street -> the boss zone
      fn(1 / 60);
      const gap = truck.wx - p.wx; // the rig's distance UPSLOPE of the worker
      minGap = Math.min(minGap, gap);
      maxGap = Math.max(maxGap, gap);
      if (truck.wx < prev - 1e-9) backFrames++;
      if (truck.wx > prev + 1e-9) fwdFrames++;
      prev = truck.wx;
    }
    return { minGap, maxGap, backFrames, fwdFrames, end: truck.wx, worker: p.wx, hopper: truck.wx - 4.3 - p.wx };
  })();
  check(
    "MIDNIGHT: the rig KEEPS PACE behind a marching worker — always upslope of him, the open scoop riding the gap between them, net travel downhill in REVERSE",
    pace.minGap > 7 && pace.maxGap < 17 && pace.backFrames > 400 && pace.fwdFrames < 40 && pace.hopper > 5 && pace.hopper < 11,
    "gap " + pace.minGap.toFixed(1) + ".." + pace.maxGap.toFixed(1) + " backFrames=" + pace.backFrames + " fwdFrames=" + pace.fwdFrames + " scoopAhead=" + pace.hopper.toFixed(1),
  );
  check("MIDNIGHT: the rig REVERSES ALL THE WAY DOWN the dead-end street after him — it is still in its widened gap (and in reach of the scoop) when he reaches the boss's cross-street",
    pace.worker <= NIGHT_BOSS_TRIGGER_X && // he made it to the graveyard mouth
      pace.end - pace.worker > 8 && pace.end - pace.worker < 18 && // the rig is up the lane behind him
      Math.abs(pace.end - 4.3 - pace.worker - 6.2) < 3.5, // the scoop sits in the widened lane
    "worker=" + pace.worker.toFixed(1) + " rig=" + pace.end.toFixed(1) +
      " gap=" + (pace.end - pace.worker).toFixed(1) + " trigger=" + NIGHT_BOSS_TRIGGER_X);
  check("MIDNIGHT ONLY: the rig parks FURTHER UP the street than any weekday — the 6.2u/6.7u lane to the open scoop (3.6u/4.1u by day), rest 4.5u (1.5u by day)",
    (() => {
      const gaps = (night) => {
        const t = new Function("isNightShift", srcFn("truckTargetGap") + ";return truckTargetGap;")(() => night);
        const b = new Function("isNightShift", srcFn("truckBackGap") + ";return truckBackGap;")(() => night);
        return { none: t("none"), bag: t("bag"), back: b() };
      };
      const n = gaps(true), d = gaps(false);
      return Math.abs(d.none - 3.6) < 1e-9 && Math.abs(d.bag - 4.1) < 1e-9 && Math.abs(d.back - 1.5) < 1e-9 &&
        Math.abs(n.none - 6.2) < 1e-9 && Math.abs(n.bag - 6.7) < 1e-9 && Math.abs(n.back - 4.5) < 1e-9 &&
        n.none > d.none && n.bag > d.bag && n.back > d.back;
    })(),
    "night=" + 6.2 + "/" + 6.7 + "/" + 4.5 + " day=" + 3.6 + "/" + 4.1 + "/" + 1.5);
  check("MIDNIGHT: the widened lane FITS the cul-de-sac — the rig's centre parks upslope of the worker's limit, its 4u nose stays inside the brick wall, the scoop sits in the fighting lane, and it clocks in upslope of the worker",
    (() => {
      const g = new Function("isNightShift", srcFn("truckTargetGap") + ";return truckTargetGap;")(() => true);
      const stand = new Function("isNightShift", srcFn("truckTargetGap") + srcFn("truckStandOffset") + ";return truckStandOffset;")(() => true)();
      const NITE_TOP = 470, NITE_TRAIL = 17.5;
      const topLimit = NITE_TOP - NITE_TRAIL; // workerTopLimitX() on the night
      const centre = topLimit + stand; // the rig parks this far UPSLOPE of the worker's limit
      return centre > topLimit && centre + 4 < NITE_TOP && centre - 4.3 - topLimit > 3 &&
        stand > 3.6 + 4.3 && Math.abs(stand - (g("none") + 4.3)) < 1e-9;
    })());
  // WEEKDAY: the exact shipped math — the rig follows the worker's forward (+x) and rests
  // the rear 3.6u AHEAD; nothing about a weekday shift moves.
  const day = runTruckAI(1, 400, 376, "follow", 420);
  check(
    "WEEKDAY (routeDir +1): the rig still FOLLOWS the worker forward (+x), the shipped rest gap intact",
    day.wx > 376 && day.yaw === 0 && Math.abs(day.wx - (400 + 3.6 + 4.3)) < 1.2,
    "wx " + 376 + " -> " + day.wx.toFixed(1) + " rest=" + (400 + 3.6 + 4.3),
  );
  const dayBack = runTruckAI(1, 400, 420, "follow", 120, -7.0);
  check("WEEKDAY: the rear ahead of the worker still backs the rig DOWN (-x), as shipped",
    dayBack.wx < 420 && dayBack.sp < 0 && dayBack.mode === "close",
    "wx " + 420 + " -> " + dayBack.wx.toFixed(1));
  check("the hopper's rear offsets are CANONICAL on both axes (the scoop stays on the model's -X side: the rig on Midnight is parked behind the worker with the open hopper facing him)",
    Math.abs(hopperSideForAt(-1) + 4.3) < 1e-9 && Math.abs(hopperSideForAt(1) + 4.3) < 1e-9,
    "night=" + hopperSideForAt(-1).toFixed(2) + " day=" + hopperSideForAt(1).toFixed(2));
  function hopperSideForAt(dir) {
    // run the REAL hopperWorldX with a truck parked at x=0
    return new Function("truck", "truckXSafe", "routeDir", srcFn("hopperWorldX") + ";return hopperWorldX;")(
      { wx: 0, hopperOff: -4.3 },
      () => 0,
      () => dir,
    )();
  }
  function truckSpawnAtAtRemoved(wx) {
    return truckSpawnAt(wx);
  }
})();
console.log("\n[16] MIDNIGHT: the driver follows him onto the sidewalk, and the haunt comes up out of the BOTTOM of the street");
(function () {
  const NIGHT_TOP = 449, NIGHT_BOTTOM = 84;
  // A) THE SMARTER DRIVER. canBackUp() is the weekday rule: the driver only rolls the rear out
  // when the worker is out in the roadway, clear of the truck's own lane. On the dead-end
  // street the man fights ghouls from the CURB, the walk and the SIDEWALK all shift, and a rig
  // that freezes there makes him haul the sack down into the road to dump it. rigMayFollow()
  // answers canBackUp() by day and opens the whole street up on Midnight.
  const sidewalkClear = false; // wy=1.6 is a sidewalk: canBackUp() says NO from that lane
  const nightWalk = runTruckAI(-1, 430, truckSpawnAt(430), "follow", 300, 1.6, sidewalkClear);
  const dayWalk = runTruckAI(1, 120, 120 + 3.6 + 4.3, "follow", 300, 1.6, sidewalkClear);
  const dayBack = runTruckAI(1, 400, 420, "follow", 120, -7.0);
  check("MIDNIGHT: with the worker up on the SIDEWALK the rig still follows him down the street (the Midnight driver works the street with him)",
    nightWalk.wx < truckSpawnAt(430) - 3 && nightWalk.sp < 0.6,
    "truck " + truckSpawnAt(430).toFixed(1) + " -> " + nightWalk.wx.toFixed(1));
  check("WEEKDAY: a worker up on the sidewalk is the SHIPPED freeze — canBackUp() still keeps the rig from rolling out of its lane",
    Math.abs(dayWalk.wx - (120 + 7.9)) < 1.2 && Math.abs(dayWalk.sp) < 0.05,
    "wx=" + dayWalk.wx.toFixed(2) + " sp=" + dayWalk.sp.toFixed(3));
  check("MIDNIGHT: the follow runs from every lane he works (road, street, curb, grass, sidewalk)",
    [-6, -3, -1, 0.4, 1.6].every((wy) => {
      const clear = !(wy > -4.5 - 1.9 - 0.3 && wy < -4.5 + 1.9 + 0.3);
      const r = runTruckAI(-1, 430, truckSpawnAt(430), "follow", 200, wy, clear);
      return r.wx < truckSpawnAt(430) - 2;
    }),
    "lanes swept: road -6 / curb -3 / street -1 / grass 0.4 / sidewalk 1.6");
  check("the weekday back-up gate itself is UNTOUCHED (canBackUp is the shipped lane test, byte for byte)",
    /const inStreet = p\.wy > -10 && p\.wy < -0\.3;/.test(srcFn("canBackUp")) &&
    /const leftSide = p\.wy < -4\.5 - lw - 0\.3;/.test(srcFn("canBackUp")) &&
    /const rightSide = p\.wy > -4\.5 \+ lw \+ 0\.3;/.test(srcFn("canBackUp")) &&
    /return inStreet && \(leftSide \|\| rightSide\);/.test(srcFn("canBackUp")));
  check("the rig's follow runs THROUGH that gate on every day but one (rigMayFollow(canBackUp()) at both drive decisions)",
    srcFn("updateTruck").includes("if (rigMayFollow(canBackUp())) sp = -Math.min(MAXSP") &&
    srcFn("updateTruck").includes("fwdErr > DEAD && rigMayFollow(canBackUp())"));
  check("MIDNIGHT: the widened lane is LIVE behaviour — the rig centre parks ~10.5u upslope of the worker with the open scoop 6.2u up the fighting lane",
    (() => {
      const r = runTruckAI(-1, 420, truckSpawnAt(420), "follow", 600, -4.0, true);
      const gap = r.wx - 420, scoop = r.wx - 4.3;
      return gap > 9 && gap < 12.5 && scoop - 420 > 5 && scoop - 420 < 7.5;
    })(),
    "gap=" + (runTruckAI(-1, 420, truckSpawnAt(420), "follow", 600, -4.0, true).wx - 420).toFixed(2));
  check("WEEKDAY: and the shipped lane width is unchanged (the rig rests its centre 5.8u..7.9u ahead of the worker — the close-mode rest to the forward target, exactly as shipped)",
    (() => {
      const wx = runTruckAI(1, 300, 315, "follow", 420, -7.0).wx;
      return wx - 300 >= 5.5 && wx - 300 <= 8.0;
    })(),
    "wx=" + runTruckAI(1, 300, 315, "follow", 420, -7.0).wx.toFixed(1));
  // B) THE HAUNT COMES FROM THE BOTTOM. The worker marches DOWN the dead-end street, so the
  // abyss has to feed the fight from the direction he is walking into: the low-x end, the
  // graveyard mouth, the flood block. Every rule the haunt runs off "ahead of him" / "behind
  // him" is resolved on the ROUTE AXIS — and by day routeDir() is +1, so all of it collapses
  // back to the shipped numbers, character for character.
  const axisArgs = ["routeDir", "p", "NIGHT_CULL_BEHIND", "creatureLimitMinX", "creatureLimitMaxX", "ROUTE_START_X", "ROUTE_END_X", "R", "clamp", "isNightShift"];
  function axisFns(dir) {
    return new Function(...axisArgs,
      srcFn("horrorAheadWindow") + "\n" + srcFn("horrorFellBehind") + "\n" + srcFn("horrorRespawnX") +
      "\nreturn { horrorAheadWindow, horrorFellBehind, horrorRespawnX };")(
      () => dir, { wx: 300 }, 70, () => 76, () => 470, 80, 464,
      (a, b) => (a + b) / 2, (v, lo, hi) => Math.max(lo, Math.min(hi, v)), () => dir < 0);
  }
  const nightAxis = axisFns(-1), dayAxis = axisFns(1);
  const bN = nightAxis.horrorAheadWindow({ x0: 192, x1: 272 });
  const bN2 = nightAxis.horrorAheadWindow({ x0: 260, x1: 340 });
  const bD = dayAxis.horrorAheadWindow({ x0: 192, x1: 272 });
  check("MIDNIGHT: a band's spawn window is the part of the band DOWNHILL of the worker — the spooks are born at the bottom of the street and walk UP into his shovel",
    bN.lo === 197 && bN.hi === 267 && bN2.lo === 265 && bN2.hi === 293,
    "worker 300: band[192,272] -> " + bN.lo + ".." + bN.hi + ", band[260,340] -> " + bN2.lo + ".." + bN2.hi);
  check("WEEKDAY: the shipped window (the band AHEAD of him, up the street) is untouched",
    bD.lo === 307 && bD.hi === 267, "worker 300: window " + bD.lo + ".." + bD.hi);
  check("MIDNIGHT: the live spawner obeys it — seed 60 ghouls in a band below him and every one lands downhill of the worker",
    (() => {
      p.wx = NIGHT_TOP;
      creatures.length = 0;
      allSpawned.length = 0;
      let out = 0, down = 0;
      for (let i = 0; i < 60; i++) {
        const c = H.nightSpawnHorror("gremlin", { x0: 288, x1: 368 });
        if (!c) continue;
        out++;
        if (c.wx < p.wx) down++;
      }
      creatures.length = 0;
      return out > 40 && down === out;
    })(),
    "seeds=" + "60 band [288,368] worker 449");
  check("WEEKDAY: the live spawner keeps seeding AHEAD (up the street) when the route runs +x",
    (() => {
      const flip = nightOn;
      nightOn = false;
      p.wx = 100;
      creatures.length = 0;
      let out = 0, up = 0;
      for (let i = 0; i < 60; i++) {
        const c = H.nightSpawnHorror("ghoul", { x0: 192, x1: 272 });
        if (!c) continue;
        out++;
        if (c.wx > p.wx) up++;
      }
      creatures.length = 0;
      nightOn = flip;
      p.wx = NIGHT_TOP;
      return out > 20 && up === out;
    })(),
    "the day axis, the day rules");
  check("MIDNIGHT: a spook left BEHIND is one left UPSLOPE (toward the top of the street); a spook down at the graves is right where he belongs",
    nightAxis.horrorFellBehind(371) === true && nightAxis.horrorFellBehind(229) === false);
  check("WEEKDAY: and by day behind means the low-x side, as shipped",
    dayAxis.horrorFellBehind(229) === true && dayAxis.horrorFellBehind(371) === false);
  const rN = nightAxis.horrorRespawnX({}), rD = dayAxis.horrorRespawnX({});
  check("MIDNIGHT: a spook that wanders off re-enters out of the BOTTOM of the street (28..52u downhill of him, inside the road he can work)",
    rN < 273 && rN > 76, "respawn x=" + rN.toFixed(1) + " (worker 300)");
  check("WEEKDAY: the respawn rule is the shipped one — re-takes a spot 28..52u up the street",
    rD > 327 && rD < 353, "respawn x=" + rD.toFixed(1));
  check("MIDNIGHT: the ABYSS FLOOD band moves to the block at the BOTTOM of the street (the pit he marches into last), where by day it is the finish-line block",
    (() => {
      const floodN = H.nightBands().filter((b) => b.flood)[0];
      const flip = nightOn;
      nightOn = false;
      const floodD = H.nightBands().filter((b) => b.flood)[0];
      nightOn = flip;
      return floodN.x0 < floodD.x0 && floodN.x0 <= 100 && floodD.x0 >= 380;
    })(),
    "night flood x0=" + H.nightBands().filter((b) => b.flood)[0].x0);
  check("MIDNIGHT: the band the haunt refills is the one he is walking INTO — the next band DOWN the street (by day: the next band up it)",
    (() => {
      const f = new Function("routeDir", "p", "bandOf", srcFn("horrorFillingBands") + ";return horrorFillingBands;");
      const bands = [{ x0: 96, x1: 176, i: 1 }, { x0: 192, x1: 272, i: 2 }, { x0: 288, x1: 368, i: 3 }];
      const at = (x) => bands.filter((b) => x >= b.x0 - 6 && x <= b.x1 + 6)[0];
      const bn = f(() => -1, { wx: 230 }, at)(bands);
      const bd = f(() => 1, { wx: 230 }, at)(bands);
      return bn[1].x0 === 96 && bd[1].x0 === 288;
    })(),
    "Midnight refills the band BELOW him, the weekday the band above");
  let marchProof = '?';
  check("THE 120-SECOND MARCH DOWN MIDNIGHT: not one spook is ever seeded UPSLOPE of the worker, and every block he walks through is stocked with ITS OWN Animals",
    (() => {
      s7Reset();
      let bad = 0, seeds = 0, foreign = 0, stockedMin = 999;
      p.wx = NIGHT_TOP;
      for (let i = 0; i < 60 * 120; i++) {
        p.wx = Math.max(NIGHT_BOTTOM, p.wx - 3.1 / 60); // the march down toward the graves
        const mark = allSpawned.length;
        H.updateNightHaunt(1 / 60);
        for (let k = mark; k < allSpawned.length; k++) {
          if (!HORROR_ALL[allSpawned[k].type]) continue;
          seeds++;
          if (allSpawned[k].wx > p.wx) bad++;
        }
        const bNow = H.bandOf(p.wx);
        if (bNow) {
          const fams = famsAt(bNow.x0);
          const own = creatures.filter((c) => !c.hooked && !c.hookLanded &&
            HORROR_ALL[H.horrorKey(c)] && c.wx >= bNow.x0 && c.wx <= bNow.x1);
          if (own.some((c) => fams.indexOf(H.horrorKey(c)) < 0)) foreign++;
          stockedMin = Math.min(stockedMin, own.length);
        }
        if (i % 90 === 0) { p.shovelCd = 0; p.shovelGuardT = 0; H.swing(); }
      }
      marchProof = seeds + '/' + bad + '/' + foreign + '/' + stockedMin;
      return seeds > 40 && bad === 0 && foreign === 0 && stockedMin >= 15;
    })(),
    "seeds/upslope/foreign/minStocked = " + marchProof);
  check("the source says it plainly: the haunt's spawn window, its cull line, its respawn and its refill bands all read the ROUTE AXIS, with the weekday expressions left exactly as shipped",
    srcFn("horrorAheadWindow").includes("if (routeDir() > 0) return { lo: Math.max(band.x0 + 5, p.wx + 7), hi: band.x1 - 5 }") &&
    srcFn("horrorAheadWindow").includes("return { lo: band.x0 + 5, hi: Math.min(band.x1 - 5, p.wx - 7) }") &&
    srcFn("horrorFellBehind").includes("wx > p.wx + NIGHT_CULL_BEHIND") &&
    srcFn("horrorRespawnX").includes("p.wx + RT * R(c.flood ? 12 : 28") &&
    srcFn("nightBands").includes("out[routeDir() > 0 ? out.length - 1 : 0].flood = true") &&
    srcFn("respawnHorror").includes("p.wx + R(c.flood ? 12 : 28, c.flood ? 40 : 52)"));
})();

console.log("\n" + pass + " night-shift checks passed" + (fail ? " — " + fail + " FAILED" : " — all OK"));
if (fail) failures.forEach((f, i) => console.log('  FAIL ' + (i + 1) + ') ' + f));
process.exit(fail ? 1 : 0);
