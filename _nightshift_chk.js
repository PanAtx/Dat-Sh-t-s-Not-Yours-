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
// CEMETERY (the iron fence across the road, graves, monuments, dead trees, candles) and the
// SLUG DEMON rises out of that yard holding the truck's Ruby-Plated Gargoyle: a slug the size
// of a car with a toothed grin, TWO tentacle arms that hurl spectral fire off their tips, and
// a heart hanging in a spiked chest cavity. The heart is the ONLY soft spot — the shell cracks
// open on its own beat and a shovel inside that window is the only cut on the bar (10 heart
// strikes; a consecrated swing lands TWO), the fire comes faster and thicker as the bar drains,
// and the beast only leaves its rise point once it has been hit BOSS_FURY_HITS times. Every
// heart strike makes it SCURRY a few paces off the blade (the worker gets room to step clear),
// and at ZERO the body INFLATES AND BURSTS — it never rides into the hopper and it never comes
// back: the cross-street has banished its only Slug Demon. The blast leaves ECTOPLASMIC SLUG
// SLIME on everything it hits (pools on the asphalt and a drape on every prop in the blast —
// NEVER on the worker, who walks out clean-footed with no ring of goop circling his boots),
// the Ruby-Plated Gargoyle lands BESHIDE the worker (near him, never on
// him), and walking onto IT wins the night: he jumps up in celebration, the ghostly cemetery
// fence is gone, he walks to the truck's door and the rig drives off into the shift report.
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
function srcBool(name) {
  const m = html.match(new RegExp('const\\s+' + name + '\\s*=\\s*(true|false)'));
  if (!m) throw new Error('boolean constant not found in index.html: ' + name);
  return m[1] === 'true';
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
check('it is named like every other shift — DAY "MIDNIGHT" + STREET "DEAD END", and NO compound name field',
  NIGHT.name === undefined && NIGHT.place === 'DEAD END');
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
  MeshBasicMaterial: function (o) {
    o = o || {};
    return {
      color: mkColor(o.color), opacity: o.opacity == null ? 1 : o.opacity,
      transparent: !!o.transparent, fog: o.fog !== false,
    };
  },
  PointLight: function (c, i, d) {
    const L = mkObj('light');
    L.color = mkColor(c); L.intensity = i == null ? 1 : i; L.distance = d || 0;
    return L;
  },
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
const SHOVEL_FACE_RULE = srcBool('SHOVEL_FACE_RULE'), SHOVEL_FACE_ARC = srcNum('SHOVEL_FACE_ARC');
// THE HELL NOTES (Midnight's joss-money cash finds): the layout numbers, read from the ship
const NIGHT_HELL_NOTE_PICKS = srcNum('NIGHT_HELL_NOTE_PICKS');
const HELL_NOTE_WALK_Y0 = srcNum('HELL_NOTE_WALK_Y0'), HELL_NOTE_WALK_Y1 = srcNum('HELL_NOTE_WALK_Y1');
const HELL_NOTE_ROAD_Y0 = srcNum('HELL_NOTE_ROAD_Y0'), HELL_NOTE_ROAD_Y1 = srcNum('HELL_NOTE_ROAD_Y1');
// Midnight's own word for the cash tally + the no-birds law + the bat-ready pose key
const NIGHT_CASH_NAME = (html.match(/const NIGHT_CASH_NAME = "([^"]*)"/) || [])[1];
const NIGHT_NO_BIRDS = srcBool('NIGHT_NO_BIRDS');
const SHOVEL_READY_KEY = srcNum('SHOVEL_READY_KEY');
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
// THE SPECTRAL BLOCK WARDS (the block-gate numbers, read straight out of the game)
const NIGHT_BLOCK_GATES = /const NIGHT_BLOCK_GATES = true/.test(html);
const NIGHT_GATE_INSET = srcNum('NIGHT_GATE_INSET'), NIGHT_GATE_ROOM = srcNum('NIGHT_GATE_ROOM');
const NIGHT_GATE_STOP = srcNum('NIGHT_GATE_STOP'), NIGHT_GATE_REACH = srcNum('NIGHT_GATE_REACH');
// THE GHOULS' TOUGHNESS (Midnight): swings per type, the block/wave/surge hardening, the back-off
const GHOUL_HITS = eval('(' + srcLiteral('GHOUL_HITS', '{', '}') + ')');
const NIGHT_WOUND_LINES = eval('(' + srcLiteral('NIGHT_WOUND_LINES', '[', ']') + ')');
const NIGHT_SCURRY_LINES = eval('(' + srcLiteral('NIGHT_SCURRY_LINES', '[', ']') + ')');
const NIGHT_WORKER_ONLY_SPEECH = srcBool('NIGHT_WORKER_ONLY_SPEECH');
const NIGHT_SPEECH_BANNED = srcBool('NIGHT_SPEECH_BANNED');
const NIGHT_SPEECH_ALLOW = eval('(' + srcLiteral('NIGHT_SPEECH_ALLOW', '[', ']') + ')');
const NIGHT_ECTO_PILL = srcBool('NIGHT_ECTO_PILL');
const NIGHT_BOSS_BAR_IN_CHIP_SLOT = srcBool('NIGHT_BOSS_BAR_IN_CHIP_SLOT');
const NIGHT_BLOCK_HARDEN = srcNum('NIGHT_BLOCK_HARDEN'), NIGHT_WAVE_HARDEN = srcNum('NIGHT_WAVE_HARDEN'),
  NIGHT_SURGE_HARDEN = srcNum('NIGHT_SURGE_HARDEN'), GHOUL_HITS_MAX = srcNum('GHOUL_HITS_MAX'),
  NIGHT_BACKOFF_T = srcNum('NIGHT_BACKOFF_T'), NIGHT_BACKOFF_EXTRA = srcNum('NIGHT_BACKOFF_EXTRA'),
  NIGHT_BACKOFF_SP = srcNum('NIGHT_BACKOFF_SP'), NIGHT_WOUND_PUSH = srcNum('NIGHT_WOUND_PUSH'),
  GHOUL_HITS_MIN = srcNum('GHOUL_HITS_MIN'), NIGHT_HP_Z_PROP = srcNum('NIGHT_HP_Z_PROP');
const NIGHT_EXTRA_HITS = eval('(' + srcLiteral('NIGHT_EXTRA_HITS', '{', '}') + ')');
const NIGHT_GATE_FADE = srcNum('NIGHT_GATE_FADE'), NIGHT_GATE_LIFT = srcNum('NIGHT_GATE_LIFT');
const NIGHT_GO_FLASH = srcNum('NIGHT_GO_FLASH');
const NIGHT_GATE_WORK = srcNum('NIGHT_GATE_WORK');
const HORROR_SURGE_LOAD = srcNum('HORROR_SURGE_LOAD');
const HORROR_SURGE_LOAD_TIERS = srcNum('HORROR_SURGE_LOAD_TIERS');
const HORROR_BLOCK_CREATURE_MAX = srcNum('HORROR_BLOCK_CREATURE_MAX');
const NIGHT_GATE_LINES = eval('(' + srcLiteral('NIGHT_GATE_LINES', '[', ']') + ')');
const NIGHT_GATE_OPEN_LINES = eval('(' + srcLiteral('NIGHT_GATE_OPEN_LINES', '[', ']') + ')');
// THE MIDNIGHT DEAD END + THE FINAL BOSS (every number read straight out of the game)
const NIGHT_TOP_X = srcNum('NIGHT_TOP_X'), NIGHT_START_X = srcNum('NIGHT_START_X');
const NIGHT_END_X = srcNum('NIGHT_END_X'), NIGHT_BOSS_X = srcNum('NIGHT_BOSS_X');
const NIGHT_BOSS_TRIGGER_X = srcNum('NIGHT_BOSS_TRIGGER_X'), NIGHT_GRAVE_X = srcNum('NIGHT_GRAVE_X');
const NIGHT_GRAVE_BLOCK_X = srcNum('NIGHT_GRAVE_BLOCK_X');
const NIGHT_FENCE_X = srcNum('NIGHT_FENCE_X'); // THE BOTTOM BORDER: the bottom cemetery fence
const NIGHT_FENCE_STANDOFF = srcNum('NIGHT_FENCE_STANDOFF'); // the respect he keeps off the iron
const NK_FLOOR = NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF; // his actual floor line (39.6)
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
// THE HEART WINDOW + THE FURY RAMP (the slug demon's own numbers, read out of the game)
const BOSS_HEART_TELEGRAPH = srcNum('BOSS_HEART_TELEGRAPH');
const BOSS_HEART_OPEN_T = srcNum('BOSS_HEART_OPEN_T'), BOSS_HEART_OPEN_MIN = srcNum('BOSS_HEART_OPEN_MIN');
const BOSS_HEART_RAGE = srcNum('BOSS_HEART_RAGE'), BOSS_HEART_CD_RAGE = srcNum('BOSS_HEART_CD_RAGE');
const BOSS_HEART_CD = eval('(' + srcLiteral('BOSS_HEART_CD', '[', ']') + ')');
const BOSS_FURY_HITS = srcNum('BOSS_FURY_HITS'), BOSS_FURY_MUL = srcNum('BOSS_FURY_MUL');
const BOSS_FIRE_CD_FLOOR = srcNum('BOSS_FIRE_CD_FLOOR'), BOSS_SHOTS_FURY = srcNum('BOSS_SHOTS_FURY');
const BOSS_ROAM_R = srcNum('BOSS_ROAM_R');
const BOSS_FIRE_TINTS = eval('(' + srcLiteral('BOSS_FIRE_TINTS', '[', ']') + ')');
const BOSS_CRACK_LINES = eval('(' + srcLiteral('BOSS_CRACK_LINES', '[', ']') + ')');
const BOSS_HEART_LINES = eval('(' + srcLiteral('BOSS_HEART_LINES', '[', ']') + ')');
const BOSS_ARMOUR_LINES = eval('(' + srcLiteral('BOSS_ARMOUR_LINES', '[', ']') + ')');
const BOSS_ROAM_LINES = eval('(' + srcLiteral('BOSS_ROAM_LINES', '[', ']') + ')');
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
// THE SCURRY, THE BOOM AND THE SLIME (mirrored straight out of the game's own numbers)
const NK_SCURRY_T = srcNum('BOSS_SCURRY_T'), NK_SCURRY_SP = srcNum('BOSS_SCURRY_SP'), NK_SCURRY_MIN = srcNum('BOSS_SCURRY_MIN');
const NK_BOOM_ROAR = srcNum('BOSS_BOOM_ROAR'), NK_BOOM_R = srcNum('BOSS_BOOM_R'), NK_BOOM_SPLATS = srcNum('BOSS_BOOM_SPLATS');
const NK_BOOM_COAT = srcNum('BOSS_BOOM_COAT'), NK_BOOM_SLIME_KEEP = srcNum('BOSS_BOOM_SLIME_KEEP'), NK_WIN_JUMP_T = srcNum('BOSS_WIN_JUMP_T');
const NK_BOOM_LINES = eval('(' + srcLiteral('BOSS_BOOM_LINES', '[', ']') + ')');
const NK_SLIME_LINES = eval('(' + srcLiteral('BOSS_SLIME_LINES', '[', ']') + ')');
// THE NO-PUSH LAW (mirrored straight out of the game's own radii and lines)
const NK_BRUSH_R = srcNum('BOSS_BRUSH_R');
const NK_GUT_R = srcNum('BOSS_GUT_R');
const NK_BRUSH_LINES = eval('(' + srcLiteral('BOSS_BRUSH_LINES', '[', ']') + ')');
const NK_SCURRY_LINES = eval('(' + srcLiteral('BOSS_SCURRY_LINES', '[', ']') + ')');
const HORROR_SEE_R_X = HORROR_SEE_R;
const SHOVEL_LINES = ['GET IN THE TRUCK!'];
const NIGHT_SCARE_LINES = ['MAMA!'];
const NIGHT_START_LINES = ['Where is everybody?'];
// ---- the spies + the mutable world the extracted code drives ----
const log = [], deposited = [], scored = [], announced = [], popped = [], sayings = [];
const dynamicChildren = [], dust = [];
const NK_WORKER_STUB = { group: mkObj('workerGroup') }; // his own rig: nothing slimy may be added to it
const dyn = {
  add: (o) => { dynamicChildren.push(o); if (o) o.parent = dyn; },
  remove: (o) => { const k = dynamicChildren.indexOf(o); if (k >= 0) dynamicChildren.splice(k, 1); if (o) o.parent = null; },
};
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
  // THE SLUG DEMON: the wet tear of the chest shell, and steel SKIDDING off the armour
  playZombieGrab: () => log.push('tear'), playCanDropSound: () => log.push('clang'),
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
  // Mirrors the shipped addCreature: a night family's case pins its OWN causeKey (wraith ->
  // "wraith"), and only the banshee borrows the variant key — it rides the specter mesh.
  if (opts && opts.v && type === "specter") c.causeKey = opts.v;
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
  'shovelToolReach', 'shovelFacingOK', 'horrorHunterCount', 'shoveSpookOff', 'shovelParry',
  'nightSayOk', 'nightBubbleOk', 'nightPopOk', 'horrorMaxY', 'levelName',
  'nightSpeechOk', 'nightSpeechAllowed', 'cashName', 'nightBirdsBanned',
  // THE MIDNIGHT DEAD END (the mirrored route's anchors) + THE FINAL BOSS (the
  // cemetery fight, the shovel on the beast, the hopper suction and the win)
  'routeDir', 'routeFarX', 'routeNearX', 'nightWallX', 'workerEndLimitX', 'workerEndHardX', 'workerTopLimitX',
  'creatureLimitMinX', 'creatureLimitMaxX', 'playerSpawnX', 'playerSpawnFacing', 'truckSpawnX',
  'truckTargetGap', 'truckBackGap', 'truckStandOffset',
  'truckMeshYaw', 'routeSpanX', 'routeProgressFrac', 'makeTentacleBoss', 'spawnNightBoss',
  'clearNightBoss', 'startBossFight', 'bossAngryTarget', 'spawnBossFireball',
  'killBossFireball', 'updateBossFireballs', 'bossWhipStrike', 'bossShovelTargetable',
  'bossShovelRange', 'bossTakeShovelSwing', 'bossShovelHit', 'killNightBoss',
  'bossBlownUp', 'spawnBossGargoyle', 'grabBossGargoyle', 'animateNightBoss',
  'updateNightBoss', 'updateNightBossFight',
  // THE NO-PUSH LAW HELPERS (the beast never writes the worker's position: the gut is his step's
  // wall, the brush band is the sting, and the HUD reads the band off these two)
  'bossGutDistance', 'bossBrushed',
  // THE SCURRY, THE BOOM AND THE SLIME (the wound's run, the blow-up, the goop it leaves)
  'nightSlimeBlob', 'spawnBossSlime', 'coatInSlime', 'nightSlimeClear',
  // THE SLUG DEMON'S HEART (the window math, the fury ramp, the armour clang, the muzzle)
  'bossFuryOf', 'bossIsFurious', 'bossHeartOpen', 'bossHeartOpenT', 'bossHeartCloseT',
  'bossFireShots', 'bossFireGap', 'bossArmMuzzle', 'bossTakeArmourSwing', 'bossArmourBite',
  // THE BLOCK PACKS (Midnight: ONE horde per block, no family shared between blocks)
  'nightBlockPack', 'nightBandPack', 'nightBlockOf', 'nightBlockOwns', 'nightBlockFamilies',
  'nightBlockQuota', 'nightBlockBandXs', 'nightBlockOrder', 'horrorWorkLimits',
  // THE SPECTRAL BLOCK WARDS (one block, one horde, one wall — ward falls when cleared)
  'nightGateOn', 'nightBlockName', 'nightGateX', 'nightGateSurgeAdd', 'nightGateBaseLoad',
  'nightGateLedger', 'nightGateLedgerOf', 'nightGateBandOf', 'nightGateLoad', 'nightGateLive',
  'nightGateLeft', 'nightGateRoom', 'nightGateClosedAt', 'nightGateFloorX', 'nightGateHolds',
  'nightGateDebt',
  'nightGateWall', 'nightGateFrontLedger', 'nightGateSay', 'nightGateYieldOf', 'nightGateOpenLedger',
  'nightGateCredit', 'nightGateStanding', 'nightGoFlash', 'nightGoTick',
  'nightGateCheck', 'nightGateAnimate', 'nightGateProgress', 'nightGateHudText',
  'nightBlockDepth', 'nightGhoulHits', 'nightGhoulFloorHits', 'nightArmSpook', 'nightWoundShovel',
  'nightShovelableKey', 'nightArmProp', 'nightPlaceProp',
  // THE SPOOK PAYS WHERE IT STOOD (the HELL NOTE a banished spook drops on the ground)
  'hellNoteDropY', 'dropShovelHellNote',
  'makeSpectralWard', 'nightGateClear', 'buildNightGates', 'nightGateCount',
  // SPECTRAL BLOOD (the shovel wound the player can SEE on Midnight)
  'nightBloodArm', 'nightBloodTick', 'nightBloodClear', 'spawnBloodSpray', 'nightBloodMix', 'nightBloodHex',
  'nightTestClockInAtBoss',
  // THE BOSS RING (Midnight): the rig's fence floor + the ghost iron's ceiling
  'nightSealClosed', 'sealFaceX', 'sealStandX', 'workerCeilX', 'truckFenceFloorX', 'makeCemeteryFence',
  'makeGhostIronFence', 'buildNightSeal', 'nightSealClear', 'nightSealArm',
  'nightSealClose', 'nightSealDrop', 'nightSealSay', 'updateNightSeal'].map(srcFn).join('\n');
// THE KILL DROP: the door the note goes through, spied on right here, and the bands it
// must land in — injected into the haunt sandbox exactly like every other number.
const NK_NOTES = [];
const NK_BONUSES = [];
const NK_W0 = srcNum('HELL_NOTE_WALK_Y0'), NK_W1 = srcNum('HELL_NOTE_WALK_Y1');
const NK_R0 = srcNum('HELL_NOTE_ROAD_Y0'), NK_R1 = srcNum('HELL_NOTE_ROAD_Y1');
const NK_CAP = srcNum('NIGHT_KILL_NOTE_CAP');
const NK_ON = /const NIGHT_KILL_NOTE = true/.test(html);
const NK_FACE = srcNum('NIGHT_START_FACING'); // the Midnight clock-in facing (radians)
const NK_WARD_SPAN = srcNum('NIGHT_WARD_SPAN_R'); // the ward curtain's extra reach onto the sidewalk
const NK_WARD_PANELS = srcNum('NIGHT_WARD_PANELS'); // panels laid across the full street
const NK_WARD_SPAN_L = srcNum('NIGHT_WARD_SPAN_L'); // extra reach past the far gutter (screen right)
const NK_STREET_Y = srcNum('HORROR_STREET_Y'); // the parked-car lane / far gutter line
const NK_LAWN_Y = srcNum('HORROR_LAWN_Y'); // the stoop / lawn (building) line
const NK_WARD_BAND = srcNum('NIGHT_WARD_DEATH_BAND'); // how far a panel may lag the fall: the tear sweeps
const NK_BOSS_ROOM_X = srcNum('NIGHT_BOSS_ROOM_X'); // u of bottom strip handed to the worker around the beast
// THE BOSS RING (Midnight): the seal line where the first cemetery fence begins, the body-width
// of respect off the ghost iron, the depth he must reach INSIDE the ring before the iron may
// rise, and the rig's nose + up-street clearance (its fence floor = line + nose + clear)
const NK_SEAL_X = srcNum('NIGHT_SEAL_X');
const NK_SEAL_STOP = srcNum('NIGHT_SEAL_STOP');
const NK_SEAL_INNER = srcNum('NIGHT_SEAL_INNER');
const NK_TRUCK_NOSE = srcNum('NIGHT_TRUCK_NOSE_L');
const NK_TRUCK_CLEAR = srcNum('NIGHT_TRUCK_SEAL_CLEAR');
const NK_WALK_MIN = (html.match(/clamp\(p\.wy[^,]+, (-[0-9.]+), workerMaxY\(\)/) || [0, '-9.4'])[1]; // his absolute lane floor
const NK_BLOOD_C = parseInt((html.match(/const NIGHT_BLOOD_C = (0x[0-9a-f]+)/) || [0, '0xd8233a'])[1], 16);
// THE HEART'S RED BURN (the open heart's BRIGHT RED, the shut heart's dark) — mirrored from the game
const NK_HEART_HOT = parseInt((html.match(/const BOSS_HEART_HOT = (0x[0-9a-f]+)/) || [0, '0xff2200'])[1], 16);
const NK_HEART_DARK = parseInt((html.match(/const BOSS_HEART_DARK = (0x[0-9a-f]+)/) || [0, '0x2a0a08'])[1], 16);
const NK_HEART_EMISS = srcNum('BOSS_HEART_EMISS');
const NK_BLOOD_LITE = parseInt((html.match(/const NIGHT_BLOOD_LITE = (0x[0-9a-f]+)/) || [0, '0xff8a90'])[1], 16);
const NK_BLOOD_TINT = srcNum('NIGHT_BLOOD_TINT');
const NK_BLOOD_AURA = srcNum('NIGHT_BLOOD_AURA');
const NK_BLOOD_SPRAY = srcNum('NIGHT_BLOOD_SPRAY');
const H = new Function(
  'THREE', 'M', 'MS', 'BX', 'CY', 'SP', 'SPH', 'R', 'pick', 'clamp',
  'GZ', 'CURB_LIFT', 'ROUTE_START_X', 'ROUTE_FINISH_X', 'ROUTE_END_X', 'PLAYER_START_X',
  'HORROR_TYPES', 'HORROR_HITS', 'HORROR_NAMES', 'HORROR_SEE_R', 'HORROR_TOUCH_CD',
  'SHOVEL_REACH', 'SHOVEL_SWING_DUR', 'SHOVEL_COOLDOWN', 'SHOVEL_POINTS', 'HORROR_FLY_DUR',
  'HORROR_SPOOK_TARGET', 'GARGOYLE_VALUE', 'GARGOYLE_CAMP_X_OFF',
  'SPOOK_LINES', 'SHOVEL_LINES', 'NIGHT_SCARE_LINES', 'NIGHT_START_LINES',
  'HP_HIT_SPECTER', 'HP_HIT_BANSHEE', 'HP_HIT_GHOUL', 'HP_HIT_HOUND',
  'state', 'p', 'creatureOnScreen', 'creatureMaxY', 'hopperAimX', 'hopperWorldY', 'hopperTopZ',
  'hopperDeposit', 'addScore', 'addScoreFlat', 'recordDayGot', 'announcePower', 'showPopup', 'Voice', 'SFX',
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
  'fxTier', 'fxRate', // THE FX TIER: the harness runs the FULL tier — the suites' numbers are the shipped desktop law
  'SHOVEL_BLADE_R', 'SHOVEL_FACE_RULE', 'SHOVEL_FACE_ARC',
  'NIGHT_CASH_NAME', 'NIGHT_NO_BIRDS', 'SHOVEL_READY_KEY',
  'PARRY_LINES', 'NIGHT_SAY_GAP', 'NIGHT_BUBBLE_GAP', 'NIGHT_POP_GAP',
  'creatureMaxY', 'HORROR_STREET_Y', 'HORROR_LAWN_Y', 'nightEctoKUnused', 'nightEctoSize',
  'NIGHT_GLOW_ECTO', 'NIGHT_ECTO_SIZE',
  // THE MIDNIGHT DEAD END + THE FINAL BOSS
  'NIGHT_TOP_X', 'NIGHT_START_X', 'NIGHT_END_X', 'NIGHT_BOSS_X', 'NIGHT_BOSS_TRIGGER_X',
  'NIGHT_GRAVE_X', 'NIGHT_GRAVE_BLOCK_X', 'NIGHT_TRAIL_X', 'NIGHT_MOUTH_X', 'NIGHT_FENCE_X',
  'NIGHT_FENCE_STANDOFF',
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
  // THE SPECTRAL BLOCK WARDS
  'NIGHT_BLOCK_GATES', 'NIGHT_GATE_INSET', 'NIGHT_GATE_ROOM', 'NIGHT_GATE_STOP',
  'NIGHT_GATE_REACH', 'NIGHT_GATE_FADE', 'NIGHT_GATE_LIFT', 'NIGHT_GATE_WORK', 'HORROR_SURGE_LOAD',
  'HORROR_SURGE_LOAD_TIERS', 'HORROR_BLOCK_CREATURE_MAX', 'NIGHT_GATE_LINES', 'NIGHT_GATE_OPEN_LINES', 'NIGHT_GO_FLASH',
  'GHOUL_HITS', 'NIGHT_WOUND_LINES', 'NIGHT_BLOCK_HARDEN', 'NIGHT_WAVE_HARDEN', 'NIGHT_SURGE_HARDEN',
  'GHOUL_HITS_MAX', 'GHOUL_HITS_MIN', 'NIGHT_BACKOFF_T', 'NIGHT_BACKOFF_EXTRA', 'NIGHT_BACKOFF_SP',
  'NIGHT_WOUND_PUSH', 'NIGHT_EXTRA_HITS', 'NIGHT_HP_Z_PROP', 'NIGHT_SCURRY_LINES',
  // THE SILENT STREET (Midnight): the speech gate's own knobs, injected like the rest
  'NIGHT_SPEECH_BANNED', 'NIGHT_SPEECH_ALLOW',
  // THE KILL DROP: the cash door a banished spook pays through, the live-pickup list it
  // counts against, and the two bands the note is allowed to land in
  'spawnCash', 'bonuses', 'NIGHT_KILL_NOTE', 'NIGHT_KILL_NOTE_CAP',
  'HELL_NOTE_WALK_Y0', 'HELL_NOTE_WALK_Y1', 'HELL_NOTE_ROAD_Y0', 'HELL_NOTE_ROAD_Y1',
  'noteSpy', 'bonusSpy', 'NIGHT_START_FACING',
  'NIGHT_WARD_SPAN_R', 'NIGHT_WARD_PANELS', 'NIGHT_WARD_SPAN_L', 'NIGHT_WARD_DEATH_BAND',
  'NIGHT_BLOOD_C', 'NIGHT_BLOOD_LITE', 'NIGHT_BLOOD_TINT', 'NIGHT_BLOOD_AURA', 'NIGHT_BLOOD_SPRAY',
  'NIGHT_BOSS_ROOM_X', 'NIGHT_TEST_BOSS_START',
  // THE SLUG DEMON'S HEART WINDOW + THE FURY RAMP (injected like every other number)
  'BOSS_HEART_TELEGRAPH', 'BOSS_HEART_OPEN_T', 'BOSS_HEART_OPEN_MIN', 'BOSS_HEART_RAGE',
  'BOSS_HEART_CD', 'BOSS_HEART_CD_RAGE', 'BOSS_FURY_HITS', 'BOSS_FURY_MUL',
  'BOSS_FIRE_CD_FLOOR', 'BOSS_SHOTS_FURY', 'BOSS_ROAM_R', 'BOSS_FIRE_TINTS',
  'BOSS_CRACK_LINES', 'BOSS_HEART_LINES', 'BOSS_ARMOUR_LINES', 'BOSS_ROAM_LINES',
  // THE HEART'S RED BURN (the hittable tell) — injected like every other number
  'BOSS_HEART_HOT', 'BOSS_HEART_DARK', 'BOSS_HEART_EMISS',
  // THE BOSS RING (Midnight): the seal line, the respect off the ghost iron, the rig's nose
  'NIGHT_SEAL_X', 'NIGHT_SEAL_STOP', 'NIGHT_SEAL_INNER', 'NIGHT_TRUCK_NOSE_L',
  'NIGHT_TRUCK_SEAL_CLEAR', 'NIGHT_SEAL_RISE_T', 'NIGHT_SEAL_HOLD_T',
  'NIGHT_SEAL_MESH_DOWN', 'NIGHT_SEAL_MESH_UP', 'NIGHT_SEAL_LINES',
  // THE SCURRY, THE BOOM AND THE SLIME (the wound's run, the blow-up beat, the goop, the hop)
  'BOSS_SCURRY_T', 'BOSS_SCURRY_SP', 'BOSS_SCURRY_MIN', 'BOSS_BOOM_ROAR', 'BOSS_BOOM_R',
  'BOSS_BOOM_SPLATS', 'BOSS_BOOM_COAT', 'BOSS_BOOM_SLIME_KEEP', 'BOSS_WIN_JUMP_T',
  'BOSS_BOOM_LINES', 'BOSS_SLIME_LINES', 'BOSS_SCURRY_LINES',
  // THE NO-PUSH LAW (the sting band, the solid gut, and what he says about touching it)
  'BOSS_BRUSH_R', 'BOSS_GUT_R', 'BOSS_BRUSH_LINES',
  // THE SPECTRAL BLOCK WARDS: the ward ledger lives in the module with the haunt state
  '\nconst nightGates = {};' +
  '\nlet nightGoT = 0, nightGoMsg = "";' +
  HORROR_SRC +
  '\nlet ectoCount = 0; let stolenGargoyle = null; let gargoyleReclaimed = false;' +
  '\nlet shovelCharge = 0, shovelCharged = false, shovelTriadT = 0, shovelTriadCount = 0;' +
  '\nlet ectoFlights = [], nightHauntT = 0, nightGhoulTier = 0, nightSurgeT = 0,' +
  ' nightSurgeSpawned = 0, nightSurgeTier = 0, nightGhostCursor = 0;' +
  '\nlet nightSayT = 0, nightBubbleT = 0, nightPopT = 0;' +
  '\nlet shovelArm = -1, pendingStrike = null;' +
  '\nconst hpBarLog = { clears: 0, frames: 0 };' +
  '\nfunction nightHpBarsClear() { hpBarLog.clears++; }' +
  '\nfunction updateGhoulHpBars() { hpBarLog.frames++; }' +
  // THE MIDNIGHT FINAL BOSS state (the beast, its ghost fire, the fight, the treasure)
  // + the stubs its fight reaches for: the worker's damage call, the stagger, the
  // confetti, the drive-off, and the hopper burst.
  '\nlet nightBoss = null, bossFireballs = [], bossFightOn = false, bossWin = false,' +
  ' bossWinT = 0, bossGargoyle = null, hopperCycling = false, hopperCycleT = 0,' +
  ' bossDeposits = 0;' +
  // THE SCURRY, THE BOOM AND THE SLIME: the goop the burst leaves, and the banished flag
  '\nlet nightBossSlime = [], nightBossBanished = false;' +
  // THE GHOST IRON OF THE BOSS RING: the live ring (armed / closed / tearing down)
  '\nlet nightSeal = null;' +
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
  ' makeShovelProp, canShovel, tryShovelSwing, shovelDeliverStrike, shovelFacingOK, swing: swingNow,' +
  ' cashName, nightBirdsBanned, SHOVEL_READY_KEY, NIGHT_CASH_NAME, NIGHT_NO_BIRDS,' +
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
  ' setSurgeTier: v => { nightSurgeTier = v; }, getSurgeTier: () => nightSurgeTier,' +
  ' getHaunt: () => [nightGhoulTier, nightSurgeT],' +
  ' setShovel: g => { shovelGroupRef = g; },' +
  ' resetNight: () => { shovelCharge = 0; shovelCharged = false; shovelTriadT = 0;' +
  ' shovelTriadCount = 0; nightHauntT = 0; nightGhoulTier = 0; nightSurgeT = 0;' +
  ' nightSurgeTier = 0; nightSurgeSpawned = 0; nightGhostCursor = 0; GHOST_HANDS.length = 0;' +
  ' nightSayT = 0; nightBubbleT = 0; nightPopT = 0;' +
  ' ectoFlights.length = 0; ectoCount = 0; nightGateClear(); },' +
  // THE FINAL BOSS: the harness drives the fight through these (spawn / wake / shovel /
  // the per-frame update / the bar / the ghost fire / the win), and reads the spy logs
  ' makeTentacleBoss, spawnNightBoss, clearNightBoss, startBossFight, updateNightBoss,' +
  ' updateNightBossFight, updateBossFireballs, bossWhipStrike, bossTakeShovelSwing,' +
  ' bossShovelHit, bossShovelTargetable, bossShovelRange, grabBossGargoyle,' +
  ' bossFuryOf, bossIsFurious, bossHeartOpen, bossHeartOpenT, bossHeartCloseT,' +
  ' bossFireShots, bossFireGap, bossArmMuzzle, bossTakeArmourSwing, bossArmourBite,' +
  ' nightWallX, workerEndLimitX, workerTopLimitX, creatureLimitMinX, creatureLimitMaxX,' +
  ' routeDir, routeFarX, routeNearX, playerSpawnX, truckSpawnX, routeProgressFrac,' +
  ' playerSpawnFacing, NIGHT_START_FACING,' +
  ' makeSpectralWard, NIGHT_WARD_SPAN_R, NIGHT_WARD_PANELS,' +
  ' nightBloodArm, nightBloodTick, nightBloodClear, spawnBloodSpray,' +
 ' truckTargetGap, truckBackGap, truckStandOffset,' +
  ' getBoss: () => nightBoss, setBoss: (v) => { nightBoss = v; },' +
  // THE BOSS RING: the rig's fence floor, the ring's ceiling, the live ghost iron
  ' getSeal: () => nightSeal, sealClosed: () => nightSealClosed(),' +
  ' sealFace: () => sealFaceX(), sealStand: () => sealStandX(),' +
  ' ceilX: () => workerCeilX(), truckFloorX: () => truckFenceFloorX(),' +
  ' sealBuild: () => buildNightSeal(), sealArm: () => nightSealArm(),' +
  ' sealClose: () => nightSealClose(), sealDrop: () => nightSealDrop(),' +
  ' sealTick: (dt) => updateNightSeal(dt), sealClear: () => nightSealClear(),' +
  ' creatureMinX: () => creatureLimitMinX(), creatureMaxX: () => creatureLimitMaxX(),' +
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
  ' getBossSlime: () => nightBossSlime, getBanished: () => nightBossBanished,' +
  ' getHopperCycling: () => hopperCycling, getHopperCycleT: () => hopperCycleT,' +
  // THE SPECTRAL BLOCK WARDS: the harness drives the ward system through these
  ' gateOn: () => nightGateOn(), gates: () => nightGates, gateLedger: b => nightGateLedger(b),' +
  ' gateX: b => nightGateX(b), gateLoad: b => nightGateLoad(b), gateBase: b => nightGateBaseLoad(b),' +
  ' gateLive: b => nightGateLive(b), gateLeft: b => nightGateLeft(b), gateRoom: b => nightGateRoom(b),' +
  ' gateFloorX: b => nightGateFloorX(b), gateClosed: b => nightGateClosedAt(b), gateCount: () => nightGateCount(),' +
  ' gateFront: () => nightGateFrontLedger(), gateWall: (a, b) => nightGateWall(a, b), gateProgress: () => nightGateProgress(),' +
  ' gateHud: () => nightGateHudText(), gateBuild: bs => buildNightGates(bs), gateClear: () => nightGateClear(),' +
  ' goFlash: (led) => nightGoFlash(led), goTick: (dt) => nightGoTick(dt),' +
  ' gateCredit: (c) => nightGateCredit(c), gateStanding: b => nightGateStanding(b), gateCrew: b => nightGateLive(b),' +
  ' gateDebt: b => nightGateDebt(b), cull: (c) => cullHorror(c),' +
  // THE KILL DROP (the note a banished spook drops, the band it lands in, the spy lists)
  ' dropNote: (wx, wy) => dropShovelHellNote(wx, wy), dropY: (wy) => hellNoteDropY(wy),' +
  ' dropNotes: () => noteSpy(), dropBonuses: () => bonusSpy(),' +
  ' getGoT: () => nightGoT, setGoT: (v) => { nightGoT = v; }, getGoMsg: () => nightGoMsg,' +
  ' ghHits: (b, k) => nightGhoulHits(b, k), ghFloor: b => nightGhoulFloorHits(b), depth: b => nightBlockDepth(b),' +
  ' armSpook: (c, b) => nightArmSpook(c, b), woundShovel: (c) => nightWoundShovel(c),' +
  ' barLog: () => hpBarLog,' +
  ' gateCheck: dt => nightGateCheck(dt), gateAnimate: dt => nightGateAnimate(dt),' +
  ' gateYield: ref => nightGateYieldOf(ref), gateBandXs: b => nightBlockBandXs(b), gateSurge: b => nightGateSurgeAdd(b),' +
  ' testClockIn: () => nightTestClockInAtBoss() };'
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
  t => deposited.push(t), (n, b) => scored.push({ n, bonus: b }), (v, b) => scored.push({ n: v, bonus: b }),
  k => { if (dayStats[k]) dayStats[k].got++; }, t => announced.push(t),
  (kind, val, name) => popped.push({ kind, val, name }), Voice, SFX,
  dyn, { push: o => dust.push(o) }, () => nightOn, dayStats, creatures,
  NK_WORKER_STUB, { armR: mkObj('armR') }, 'male',
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
  () => 2, (m) => m, // fxTier / fxRate — the harness runs the FULL tier: the suites' numbers are the shipped desktop law
  SHOVEL_BLADE_R, SHOVEL_FACE_RULE, SHOVEL_FACE_ARC,
  NIGHT_CASH_NAME, NIGHT_NO_BIRDS, SHOVEL_READY_KEY,
  PARRY_LINES, NIGHT_SAY_GAP, NIGHT_BUBBLE_GAP, NIGHT_POP_GAP,
  () => 4.8, HORROR_STREET_Y, HORROR_LAWN_Y, () => 0, () => NIGHT_ECTO_SIZE, NIGHT_GLOW_ECTO,
  NIGHT_ECTO_SIZE,
  // THE MIDNIGHT DEAD END + THE FINAL BOSS (the mirrored anchors, the fight's numbers)
  NIGHT_TOP_X, NIGHT_START_X, NIGHT_END_X, NIGHT_BOSS_X, NIGHT_BOSS_TRIGGER_X, NIGHT_GRAVE_X,
  NIGHT_GRAVE_BLOCK_X, NIGHT_TRAIL_X, NIGHT_MOUTH_X, NIGHT_FENCE_X, NIGHT_FENCE_STANDOFF,
  BOSS_MAX_HP, BOSS_DMG, BOSS_DMG_CONS, BOSS_INVULN_T, BOSS_POINTS, BOSS_RISE_T,
  BOSS_LUNGE_SP, BOSS_LUNGE_SP_RAGE, BOSS_SEE_R, BOSS_BODY_R, BOSS_BODY_CD,
  BOSS_HP_BODY, BOSS_HP_WHIP, BOSS_HP_FIRE, BOSS_WHIP_TELEGRAPH, BOSS_WHIP_STRIKE,
  BOSS_WHIP_R, BOSS_WHIP_ARC, BOSS_FIRE_SP, BOSS_FIRE_R, BOSS_FIRE_LIFE, BOSS_SUCTION_T,
  BOSS_SHOTS, BOSS_SHOTS_RAGE, BOSS_WHIP_CD, BOSS_FIRE_CD, HOPPER_CYCLE_AT, HOPPER_CYCLE_DUR,
  BOSS_LINES, BOSS_FIRE_LINES, BOSS_HIT_LINES, BOSS_DYING_LINES, BOSS_WIN_LINES,
  // THE BLOCK PACKS: the pack table + the block pitch its lookup runs on
  NIGHT_BLOCKS, IW,
  NIGHT_PACK_ESCALATE, NIGHT_PACK_SLACK, NIGHT_BEAT_TOP_X, NIGHT_BEAT_VERMIN_X,
  NIGHT_BEAT_DIGGER_X, NIGHT_BEAT_GRAVE_X,
  // THE SPECTRAL BLOCK WARDS
  NIGHT_BLOCK_GATES, NIGHT_GATE_INSET, NIGHT_GATE_ROOM, NIGHT_GATE_STOP, NIGHT_GATE_REACH,
  NIGHT_GATE_FADE, NIGHT_GATE_LIFT, NIGHT_GATE_WORK, HORROR_SURGE_LOAD, HORROR_SURGE_LOAD_TIERS,
  HORROR_BLOCK_CREATURE_MAX,
  NIGHT_GATE_LINES, NIGHT_GATE_OPEN_LINES, NIGHT_GO_FLASH,
  GHOUL_HITS, NIGHT_WOUND_LINES, NIGHT_BLOCK_HARDEN, NIGHT_WAVE_HARDEN, NIGHT_SURGE_HARDEN,
  GHOUL_HITS_MAX, GHOUL_HITS_MIN, NIGHT_BACKOFF_T, NIGHT_BACKOFF_EXTRA, NIGHT_BACKOFF_SP,
  NIGHT_WOUND_PUSH, NIGHT_EXTRA_HITS, NIGHT_HP_Z_PROP, NIGHT_SCURRY_LINES,
  NIGHT_SPEECH_BANNED, NIGHT_SPEECH_ALLOW,
  // THE KILL DROP: the spy door + the counted pickup list + the bands + the list spies
  (wx, wy) => NK_NOTES.push({ wx: wx, wy: wy }), NK_BONUSES, NK_ON, NK_CAP,
  NK_W0, NK_W1, NK_R0, NK_R1, () => NK_NOTES, () => NK_BONUSES, NK_FACE,
  NK_WARD_SPAN, NK_WARD_PANELS, NK_WARD_SPAN_L, NK_WARD_BAND,
  NK_BLOOD_C, NK_BLOOD_LITE, NK_BLOOD_TINT, NK_BLOOD_AURA, NK_BLOOD_SPRAY,
  NK_BOSS_ROOM_X,
  false // NIGHT_TEST_BOSS_START: the suites run the SHIPPED law — the switch is OFF
  // THE SLUG DEMON'S HEART WINDOW + THE FURY RAMP (mirrored straight out of index.html)
  , BOSS_HEART_TELEGRAPH, BOSS_HEART_OPEN_T, BOSS_HEART_OPEN_MIN, BOSS_HEART_RAGE,
    BOSS_HEART_CD, BOSS_HEART_CD_RAGE, BOSS_FURY_HITS, BOSS_FURY_MUL,
    BOSS_FIRE_CD_FLOOR, BOSS_SHOTS_FURY, BOSS_ROAM_R, BOSS_FIRE_TINTS,
    BOSS_CRACK_LINES, BOSS_HEART_LINES, BOSS_ARMOUR_LINES, BOSS_ROAM_LINES,
    // THE HEART'S RED BURN (the names sit in the parameter list at THIS point — the values
    // must ride the same slot)
    NK_HEART_HOT, NK_HEART_DARK, NK_HEART_EMISS,
    NK_SEAL_X, NK_SEAL_STOP, NK_SEAL_INNER, NK_TRUCK_NOSE, NK_TRUCK_CLEAR,
    srcNum('NIGHT_SEAL_RISE_T'),
    srcNum('NIGHT_SEAL_HOLD_T'),
    srcNum('NIGHT_SEAL_MESH_DOWN'), srcNum('NIGHT_SEAL_MESH_UP'),
    ['THE FENCE’S UP — NO WAY BACK UP THE STREET!'],
    // THE SCURRY, THE BOOM AND THE SLIME (the names sit at THIS point of the list, so the
    // values must ride the same slots)
    NK_SCURRY_T, NK_SCURRY_SP, NK_SCURRY_MIN, NK_BOOM_ROAR, NK_BOOM_R, NK_BOOM_SPLATS,
    NK_BOOM_COAT, NK_BOOM_SLIME_KEEP, NK_WIN_JUMP_T,
    NK_BOOM_LINES, NK_SLIME_LINES, NK_SCURRY_LINES,
    // THE NO-PUSH LAW rides the SAME slots as the names above
    NK_BRUSH_R, NK_GUT_R, NK_BRUSH_LINES
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
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.shovelCd = 0; p.facing = 0; // he faces the ghoul he is about to swing at
const farHound = mkC('hound', 30);
const nearGhoul = mkC('ghoul', 2, { causeKey: 'ghoul' });
creatures.length = 0; creatures.push(farHound, nearGhoul);
log.length = 0;
check('ACT on the night shift SWINGS THE SHOVEL and WOUNDS the NEAREST reachable spook — one swing off its own pool, not a banishment (the far one is untouched)',
  H.swing() === true && nearGhoul.hooked !== true && nearGhoul.hp === nearGhoul.hpMax - 1 &&
  farHound.hooked === undefined && (farHound.hp === undefined || farHound.hp === farHound.hpMax));
check('and the wound is a fight: the NEAREST spook goes IN THE HOPPER only after its whole pool of swings is spent',
  (() => {
    const owed = nearGhoul.hp; // what is left of its pool right now
    const used = shovelDown(nearGhoul);
    return used === owed && nearGhoul.hookLanded === true;
  })(), 'pool left=' + nearGhoul.hp + ' landed=' + nearGhoul.hookLanded);
check('the swing NEVER rotates him — he keeps the facing he swung from (no spin-around on the catch)', p.facing === 0);
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
const tShovelable = H.canShovel(tentacle); // MEASURED BEFORE THE BLOWS (a landed spook is gone)
creatures.length = 0; creatures.push(tentacle); p.shovelCd = 0;
let tPool = 0; // THE BLOWS THEMSELVES ARM IT (nightWoundShovel arms at the first contact)
let tSwings = 0, tDuck = false;
while (tSwings < 24 && !tentacle.hooked) {
  p.shovelCd = 0; p.facing = 0;
  if (H.swing() !== true) break;
  tSwings++;
  if (!tPool) tPool = tentacle.hpMax;
  if (tentacle.hp > 0) tDuck = tDuck || (tentacle.state === 'retract' && tentacle.cd > 0);
}
check('the manhole TENTACLE is shoverable too, it takes ' + tPool + ' BLOWS and DUCKS down its manhole between them (the armed grab is cancelled on the killing blow)',
  tShovelable === true && tPool >= GHOUL_HITS_MIN && tSwings === tPool &&
  tDuck && tentacle.hooked === true && tentacle.state === 'retract',
  'pool=' + tPool + ' swings=' + tSwings + ' duck=' + tDuck + ' hp=' + tentacle.hp + ' state=' + tentacle.state + ' cd=' + tentacle.cd);

// --- the toss into the hopper, and what lands ---
deposited.length = 0; scored.length = 0; announced.length = 0;
dynamicChildren.length = 0;
const ectoBase = H.getEcto(), gotBase = dayStats.spooks.got; // measured as a DELTA (the
const flyer = mkC('specter', 4, { hooked: true, hookT: 0, fx0: p.wx + 4, fy0: p.wy, fz0: GZ + 0.5 });
let guard = 0;
while (!flyer.hookLanded && guard++ < 600) H.shovelFlight(flyer, 1 / 60);
check('a struck spook ARCS into the hopper scoop (arrives at the aim x, not the street)',
  flyer.hookLanded === true && guard < 600 && Math.abs(flyer.wx - 3) < 0.6, 'wx=' + flyer.wx.toFixed(2));
check('it is DEPOSITED as ECOPLASM — five of these and the compactor cycles',
  deposited.length === 1 && deposited[0] === 'ecto');
check('a shoveled spook pays out street cash (+' + SHOVEL_POINTS + ' x the Bed-Stuy board)',
  scored.length === 1 && scored[0].n === SHOVEL_POINTS && scored[0].bonus === true);
check('the HUD SPOOKS counter + the shift report row both ticked (one lump, one row, per banishment)',
  H.getEcto() === ectoBase + 1 && dayStats.spooks.got === gotBase + 1,
  'ecto=' + H.getEcto() + ' got=' + dayStats.spooks.got);
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
check('the spill lingers as TINY glowing drops on the asphalt (a scattering of small puddles, never a lake)',
  /const NIGHT_ECO_SPILL_DROPS = (\d+);/.test(html) && Number(RegExp.$1) >= 8 &&
    /const NIGHT_ECO_SPILL_R = \[[\d.]+, [\d.]+\];/.test(html) &&
    Number((html.match(/const NIGHT_ECO_SPILL_R = \[[\d.]+, ([\d.]+)\];/) || [0, 9])[1]) <= 0.4 &&
    /new THREE\.CircleGeometry\(R\(NIGHT_ECO_SPILL_R\[0\], NIGHT_ECO_SPILL_R\[1\]\)/.test(html) &&
    /hopperResidue\.push\(\{ g: g, t: R\(14, 24\) \}\)/.test(html) &&
    !/CircleGeometry\(R\(0\.5, 1\.15\)/.test(html),
  (html.match(/const NIGHT_ECO_SPILL_DROPS = (\d+);/) || [0, '?'])[1] + ' drops');
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
  'nightSpawnHorror', 'spawnNightGhost', 'bandOf', 'HORROR_QUOTA', 'HORROR_QUOTA_FLOOD',
  'HORROR_ROSTER_CAP', 'NIGHT_GHOST_CAP', 'NIGHT_PROP_QUOTA', 'NIGHT_PROP_QUOTA_FLOOD',
  'addCreature', 'HORROR_FILL_ORDER', 'HORROR_ALL',
  // THE BLOCK PACKS: the per-block signature sets the dead-end street fills from
  'nightBlockPack', 'nightBlockFamilies', 'nightBlockQuota', 'nightBlockOrder', 'NIGHT_BLOCKS', 'IW',
  // THE MIDNIGHT DEAD END: the spawner's night-route anchors + the FINAL BOSS's entry
  // points (the beast itself is exercised for real in section [9]; here the spawner just
  // has to prove it lays the boss down and walls the street off).
  'playerSpawnX', 'routeDir', 'clearNightBoss', 'spawnNightBoss', 'buildNightCemetery',
  'makeTentacleBoss',
  // THE HELL NOTES: tonight's street cash, laid by the spawner's own layout code
  'NIGHT_HELL_NOTE_PICKS', 'HELL_NOTE_WALK_Y0', 'HELL_NOTE_WALK_Y1',
  'HELL_NOTE_ROAD_Y0', 'HELL_NOTE_ROAD_Y1',
  // THE SPECTRAL BLOCK WARDS: the spawner lays the curtains through the harness's own ward code
  'buildNightGates', 'nightGateClear',
  srcFn('spawnStolenGargoyle') + '\n' + srcFn('spawnHellNotes') + '\n' + srcFn('spawnNightShift') +
  '\nconst spawned = [], treasures = [], notes = [];' +
  '\nlet nightGhostCursor = 0, nightGhoulTier = 0, nightSurgeT = 0, nightSurgeSpawned = 0, nightHauntT = 0;' +
  '\nfunction spawnGhostTreasure(wx, wy) { treasures.push({ wx, wy }); }' +
  '\nfunction spawnCash(wx, wy) { notes.push({ wx, wy }); }' +
  '\nlet stolenGargoyle = null;' +
  '\nfunction nightHpBarsClear() {}' +
  '\nfunction updateGhoulHpBars() {}' +
  '\nfunction nightArmSpook(c, band) {}' +
  '\nreturn { spawnNightShift, spawned, treasures, notes, getStolen: () => stolenGargoyle };'
)(
  THREE, M, MS, BX, CY, SP, SPH, R, clamp, GZ, 80, () => 4.8, () => 4.4,
  ROUTE_START_X, ROUTE_FINISH_X, ROUTE_END_X, GARGOYLE_VALUE, GARGOYLE_CAMP_X_OFF,
  HORROR_SPOOK_TARGET, S2_LAYOUT, S2_IDX, S2_BLOCKS, S2_ARMS, S2_HANDS, S2_GROUND, { wx: 80 },
  () => mkObj('arm'), () => mkObj('stone'), () => mkObj('skulls'), () => mkObj('hand'),
  () => mkObj('candle'), () => mkObj('coffin'), () => mkObj('gate'), () => mkObj('beast'),
  () => mkObj('garg'), H.nightBands, H.nightWorldBlock, H.nightFloodBand, H.nightPlaceProp,
  H.nightHorrorLive, H.nightSpawnHorror, H.spawnNightGhost, H.bandOf, HORROR_QUOTA, HORROR_QUOTA_FLOOD,
  HORROR_ROSTER_CAP, NIGHT_GHOST_CAP, NIGHT_PROP_QUOTA, NIGHT_PROP_QUOTA_FLOOD, S2_ADD_CREATURE,
  HORROR_FILL_ORDER, HORROR_ALL,
  nightBlockPack, nightBlockFamilies, nightBlockQuota, nightBlockOrder, NIGHT_BLOCKS, IW,
  () => S2_BOSS_SPAWN.push(p.wx), () => (S2_ROUTE_DIR = -1), () => S2_BOSS_CLEAR.push(1),
  () => S2_BOSS_SPAWN.push(1), () => S2_CEMETERY.push(1), () => mkObj('tentboss'),
  NIGHT_HELL_NOTE_PICKS, HELL_NOTE_WALK_Y0, HELL_NOTE_WALK_Y1,
  HELL_NOTE_ROAD_Y0, HELL_NOTE_ROAD_Y1,
  H.gateBuild, H.gateClear
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
check('TONIGHT THE STREET IS PAVED WITH HELL NOTES: the build lays ' + NIGHT_HELL_NOTE_PICKS +
  ' cash finds across the route — half on the sidewalk, half out in the roadway',
  S5.notes.length === NIGHT_HELL_NOTE_PICKS &&
    S5.notes.filter((n) => n.wy >= HELL_NOTE_WALK_Y0 && n.wy <= HELL_NOTE_WALK_Y1).length === NIGHT_HELL_NOTE_PICKS / 2 &&
    S5.notes.filter((n) => n.wy >= HELL_NOTE_ROAD_Y0 && n.wy <= HELL_NOTE_ROAD_Y1).length === NIGHT_HELL_NOTE_PICKS / 2,
  'notes=' + S5.notes.length);
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
const s5BelowWard = allSpawned.filter((c) => c.wx < NIGHT_BEAT_GRAVE_X);
check('THE BOSS BLOCK IS BORN EMPTY: not one of the ' + allSpawned.length + ' things the night spawner seeds stands below the first ward block (' + NIGHT_BEAT_GRAVE_X + 'u) — no sewer arm, no spook, no spirit, no floating find, no hell note. The swept near end is the beast\'s own ring, and the grave furniture it used to carry is gated off in buildNightCemetery (NIGHT_BOSS_FIELD_SWEPT)',
  allSpawned.length > 0 && s5BelowWard.length === 0 && s5Haz.length === 0,
  s5BelowWard.map((c) => (c.causeKey || c.type) + "@" + c.wx.toFixed(0)).slice(0, 6).join(","));
check('the night spawner adds the EXTRA manhole tentacles (' + count('zombieArm') + "; Sunday's own still spawns — the block is Bed-Stuy, and on Midnight its draw is taken ONLY from the blocks above the boss block)",
  count('zombieArm') >= 2 && /if \(isBedStuyLevel\(\)\) \{[\s\S]{0,1400}addCreature\("zombieArm"\)/.test(html) &&
    /const zDraw = isNightShift\(\)[\s\S]{0,260}b\.x >= BLOCK_W && b\.x \+ 8\.0 > workerEndLimitX\(\)/.test(html));
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
// THE WARD WALK: the worker's clamp at a closed curtain, so every march in this file
// walks the street the way the game plays it — held at the light until the block is empty.
function wardClamp() {
  const front = H.gateWall(p.gatePrev == null ? p.wx : p.gatePrev, p.wx);
  p.gatePrev = p.wx; // (mirror of the real clamp: the wall of this frame's travel segment)
  if (front) {
    const line = front.x + NIGHT_GATE_STOP;
    if (p.wx < line) p.wx = line; // snap ON the line = free the moment he presses away
  }
  return front;
}
const living = () => creatures.filter((c) => !c.hooked && !c.hookLanded &&
  HORROR_ALL[H.horrorKey(c)]).length;
// SHOVELED DOWN: the real swing machinery, worked on one spook until its pool is empty,
// then the flight driven to the hopper. With the multi-hit shovel (v1.0.493) a single press
// is only a WOUND, so a test that needs a banish spends the spook's full swings.
function shovelDown(c, cap) {
  let swings = 0;
  const lim = cap || 30;
  while (swings < lim && !c.hooked && !c.hookLanded) {
    c.wx = p.wx + 1.45; c.wy = p.wy; // pull it onto the blade (the surge drive's recipe)
    if (c.g) c.g.position.set(c.wx, c.wy, GZ);
    c.huntT = 0; c.flinchT = 0; c.backoffT = 0; c.touchCd = 0;
    p.shovelCd = 0; p.stunT = 0; p.stunDur = 0;
    p.facing = Math.atan2(c.wy - p.wy, c.wx - p.wx); // he swings at what he is FACING
    H.swing();
    swings++;
  }
  if (c.hooked) {
    let guard = 0;
    while (!c.hookLanded && guard++ < 400) H.shovelFlight(c, 1 / 60);
  }
  return swings;
}
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
  const wardFront = wardClamp(); // the block's ward holds him until its horde is in the hopper
  H.updateNightHaunt(1 / 60);
  if (wardFront) {
    // THE WALL IS STOCKED: sample the fight only while a ward is UP in front of him and
    // that block's bill is still unpaid — the block he is fighting must have animals on it.
    const wb = H.nightBands().filter((b) => wardFront.x >= b.x0 && wardFront.x <= b.x1)[0];
    if (wb && H.gateLeft(wb) > 0)
      minHere = Math.min(minHere, creatures.filter((c) => !c.hooked && !c.hookLanded &&
        HORROR_ALL[H.horrorKey(c)] && c.home && c.home.i === wb.i).length);
  }
  const band = H.bandOf(p.wx);
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
check('THE WARDS KEEP THE FIGHT ALIVE AT THE WALL: the block he is held against never fell under 3 of its OWN animals while its bill was unpaid',
  minHere >= 3, 'min own-horde spooks at the ward = ' + minHere);
check('and the block at the BOTTOM (the flood) is held to its OWN ward bill: its live pack never runs past its load',
  floodGhoulsAtEnd >= 1 && floodGhoulsAtEnd <= H.gateLoad(H.nightBands().filter((b) => b.x0 === 96)[0]),
  'flood live = ' + floodGhoulsAtEnd + ' ward bill = ' + H.gateLoad(H.nightBands().filter((b) => b.x0 === 96)[0]));
check('the horde fills to its ward bill — a block runs the whole load of its OWN pack and no more (' +
  floodGhoulsAtEnd + ' spooks standing on the graves)',
  floodGhoulsAtEnd >= 14 && floodGhoulsAtEnd <= H.gateLoad(H.nightBands().filter((b) => b.x0 === 96)[0]),
  'flood live at the end = ' + floodGhoulsAtEnd + ' ward bill=' +
  H.gateLoad(H.nightBands().filter((b) => b.x0 === 96)[0]));
check('the ABYSS FLOOD block is a deep pack through and through: its reapers are out and the block is fought, not farmed',
  floodGhoulsAtEnd >= 14 &&
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
  creatures.every((c) => !c.hookLanded) && disposed.length >= 12,
  'disposed=' + disposed.length + ' roster=' + creatures.length);
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
    p.shovelCd = 0; p.facing = 0; // the mob is AHEAD of him in +x
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
p.shovelCd = 0; p.facing = 0; // he swings DOWN at the mob laid out in +x
announced.length = 0; deposited.length = 0; scored.length = 0;
const sayBefore = sayings.length;
check('an ordinary swing WOUNDS the NEAREST spook, not the whole street (one swing out of ITS pool; nothing hooked)', (() => {
  const ok = H.swing() === true;
  const hurt = creatures.filter((c) => c.hp < c.hpMax);
  return ok && hurt.length === 1 && hurt[0] === mob3[0] && creatures.every((c) => !c.hooked) &&
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
const stonePool = stoneHz.hpMax;
let stoneWounds = 0;
while (stoneHz.hp > 1 && stoneWounds < stonePool + 3) {
  H.shovelHazardStrike(shovelPropBlock, stoneHz);
  stoneWounds++;
}
check('a HEADSTONE is dug out in BLOWS (' + stonePool + ' swings on its pool): ' + stoneWounds +
  ' wounds landed and it is STILL STANDING in its block',
  stoneWounds === stonePool - 1 && stoneHz.hp === 1 &&
  shovelPropBlock.hazards.length === hazardBefore &&
  shovelPropBlock.hazards.indexOf(stoneHz) >= 0);
H.shovelHazardStrike(shovelPropBlock, stoneHz);
check('...and THE BLOW THAT EMPTIES THE POOL takes it out of the block (it stops being in the way)',
  stoneHz.hp === 0 && shovelPropBlock.hazards.length === hazardBefore - 1 &&
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
const armPool = armHz.hpMax;
let armWounds = 0;
while (armHz.hp > 1 && armWounds < armPool + 3) {
  H.shovelHazardStrike(shovelPropBlock, armHz);
  armWounds++;
}
check('a GRASPING ARM carries its own pool of ' + armPool + ' swings and keeps reaching until the last',
  armWounds === armPool - 1 && armHz.hp === 1 && shovelPropBlock.hazards.length === hazardMid);
H.shovelHazardStrike(shovelPropBlock, armHz);
check('...and on the killing blow it is exorcised, its animation entry purged with it',
  armHz.hp === 0 && shovelPropBlock.hazards.length === hazardMid - 1 &&
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
p.facing = 0; // the ring is laid out in +x from him — he swings INTO it
H.swing();
check('a CONSECRATED swing wounds THREE spooks out of the arc in one stroke, and spends the charge (nothing is banned by one blow any more)',
  creatures.filter((c) => c.hp < c.hpMax).length === CONS_ARC_TARGETS &&
  creatures.every((c) => !c.hooked) && H.isCharged() === false,
  'wounded=' + creatures.filter((c) => c.hp < c.hpMax).length + ' charged=' + H.isCharged() +
  ' d=' + creatures.map((c) => Math.hypot(c.wx - p.wx, c.wy - p.wy).toFixed(2)).join(','));
check('the consecrated swing REACHES FURTHER than the plain one (its wound lands past SHOVEL_REACH)',
  creatures.filter((c) => c.hp < c.hpMax).some((c) => Math.hypot(c.wx - p.wx, c.wy - p.wy) > SHOVEL_REACH + 0.4));
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
  'poseShovel', 'poseShovelReady', 'equipShovel'].map(srcFn).join('\n');
const armStub = (tag) => ({ tag, rotation: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } } });
const S6_ARMR = armStub('armR'), S6_ARML = armStub('armL');
const S6_ROOT = mkObj('workerGroup');
const S6 = new Function(
  'THREE', 'M', 'BX', 'CY', 'SP', 'clamp', 'SHOVEL_HOLD', 'worker', 'wparts', 'shovelGroup',
  'let shovelTwist = 0;\n' + SHOVEL_SRC +
  '\nreturn { makeShovelProp, poseShovel, poseShovelReady, equipShovel, shovelFist, shovelShaftEuler,' +
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
check('the HUD chip shows the shovel charge and the route banner is NAME · STREET like every shift (the night reads "MIDNIGHT · DEAD END": no Bed-Stuy, no cemetery caption)',
  /shovelCharged\r?\n\s*\? "  • HOLY SHOVEL!"/.test(html) &&
    srcFn('resetWorldState').includes('levelName(_d)') &&
    srcFn('resetWorldState').includes('" \\u00b7 " + levelLoc(_d)') &&
    html.includes('place: "DEAD END"') &&
    !html.includes('name: "MIDNIGHT * DEAD END"') &&
    !/CEMETERY AT THE BOTTOM/.test(srcFn('resetWorldState')) &&
    !/BED-STUY · CEMETERY/.test(html));
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
check('the blade stays UP for the swipe + ' + SHOVEL_GUARD + 's tail (FULL tier; the LOW tier widens it by 15% for thumbs), and the window ticks on the night gate',
  swingSrc.includes('p.shovelGuardT = SHOVEL_SWING_DUR + SHOVEL_GUARD + (fxTier() === 1 ? SHOVEL_GUARD * 0.15 : 0);') &&
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
check('the swing hits with ANY PART of the shovel — the head\'s own sweep beyond the shaft, the wood included (the wood WOUNDS; past the tool nothing happens)',
  (() => { const ok = H.swing() === true; return ok && woodGhoul.hp === woodGhoul.hpMax - 1 &&
    woodGhoul.hooked !== true && outGhoul.hp === outGhoul.hpMax && outGhoul.hooked === undefined; })(),
  'wood=' + woodGhoul.hp + '/' + woodGhoul.hpMax + ' out=' + outGhoul.hp + '/' + outGhoul.hpMax);
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
p.facing = 0;
check('out of a ghoul stagger a swing fires AT ONCE, clears the stun and WOUNDS the thing (the defence is not locked out by a brush)',
  H.swing() === true && p.stunT === 0 && stunGhoul.hp === stunGhoul.hpMax - 1 && stunGhoul.hooked !== true);
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
  /if \(typeof isNightShift === "function" && isNightShift\(\)\) \{[\s\S]{0,600}p\.shovelGuardT = Math\.max/.test(html));
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
check('score bubbles run through the night gate (no bubble on Midnight; ' + NIGHT_BUBBLE_GAP + 's apart for any the player names)',
  srcFn('shovelBanish').includes('nightBubbleOk(goBubble, "score")') && NIGHT_BUBBLE_GAP >= 0.3);
check('the budget ticks with the haunt and resets with the shift',
  srcFn('updateNightHaunt').includes('nightSayT = Math.max(0, nightSayT - dt)') &&
    html.includes('nightSayT = 0;') && html.includes('nightBubbleT = 0;'));
check('the budget is a NIGHT-ONLY gate (weekday/Maspeth voices are untouched)',
  /function nightSayOk\(loud\) \{\s*if \(typeof isNightShift !== "function" \|\| !isNightShift\(\)\) return true;/.test(html));
// --- SIM: a 45-second swing-frenzy against the live horde: how much text hits the screen? ---
s7Reset();
onScreen = true;
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.stunDur = 1; p.facing = Math.PI; // marching DOWN, so the horde ahead is IN his arc
const sayMark = sayings.length, bubMark = bubbles.length, popMark = announced.length;
let swings = 0;
for (let i = 0; i < 60 * 45; i++) {
  p.wx = Math.max(90, p.wx - 3.2 / 60); // the march DOWN the dead-end street
  wardClamp(); // held at the block's ward until its horde is in the hopper
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
check('...and NOT ONE score bubble reaches the screen on the silent street (measured ' + bubblesMade +
  ' bubbles in ' + swings + ' swings — the ceiling for any line the player names is ' + Math.ceil(45 / NIGHT_BUBBLE_GAP) + ')',
  bubblesMade === 0 && bubblesMade <= Math.ceil(45 / NIGHT_BUBBLE_GAP) + 3,
  'bubbles=' + bubblesMade);
check('...with centre-screen pops RESERVED for power moments and capped to one per ' +
  NIGHT_POP_GAP + 's: ' + pops + ' in 45s',
  pops <= Math.ceil(45 / NIGHT_POP_GAP) && pops >= 0,
  'pops=' + pops);
check('the Holy Weapon power moments route their pops AND lines through the budgets',
  /if \(nightPopOk\(\)\) announcePower\("CONSECRATED!"/.test(html) &&
    /if \(nightPopOk\(\)\) announcePower\("SHOVEL TRIAD!"/.test(html) &&
    /if \(nightPopOk\(\)\) announcePower\("ABYSS SURGE!"/.test(html) &&
    srcFn('shovelBanish').includes('if (nightSayOk())'));
const frenzyPurse = scored.filter(s => s.n === SHOVEL_POINTS).length;
check('the frenzy still SCORES (loud in points, silent in text): ' + frenzyPurse +
  ' shovel purses banked in ' + swings + ' swings, at least 2 swings per purse',
  frenzyPurse >= 1 && swings >= frenzyPurse * GHOUL_HITS_MIN,
  'shovel scores=' + frenzyPurse + ' swings=' + swings + ' wardsUp=' + H.gateCount() +
  ' yieldTop=' + H.gateLedger(H.nightBands().filter((b) => b.x0 === 384)[0]).yield);
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
check('a banishment pays ' + SHOVEL_POINTS + ' (was 250, then 25), grave furniture ' + SHOVEL_PROP_POINTS +
  ' (was 150), a Shovel Triad ' + TRIAD_POINTS + ' (was 2500)',
  SHOVEL_POINTS === 10 && SHOVEL_PROP_POINTS <= 10 && TRIAD_POINTS <= 250 &&
    SHOVEL_POINTS >= 10 && TRIAD_POINTS === SHOVEL_POINTS * 10);
check('THE SHOVEL IS CHEAP NOW, AND IT STAYS CHEAP: ' + SHOVEL_POINTS + ' a spook is under half the ' +
  'old 25 purse, and a full night of shovel work cannot fill a tenth of one Red Bull milestone',
  SHOVEL_POINTS <= 10 && HORROR_SPOOK_TARGET * SHOVEL_POINTS * 10 < MONSTER_SCORE_STEP);
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
p.wx = 449; p.wy = 2.5; p.stunT = 0; p.stunDur = 1; p.facing = Math.PI; // marching DOWN into the pack
scored.length = 0;
let kills = 0, swingBudget = 0;
for (let i = 0; i < 60 * 90; i++) {
  p.wx = Math.max(90, p.wx - 3.2 / 60); // the march DOWN the dead-end street
  H.updateNightHaunt(1 / 60);
  for (let k = creatures.length - 1; k >= 0; k--) {
    const c = creatures[k];
    if (!c.hooked) continue;
    H.shovelFlight(c, 1 / 60);
    if (c.hookLanded) { creatures.splice(k, 1); kills++; }
  }
  if (i % 26 === 0) { p.shovelCd = 0; p.shovelGuardT = 0; if (H.swing()) swingBudget++; }
}
const loot = scored.reduce((a, s) => a + s.n, 0);
check('90s of hard shovelling: ' + kills + ' banishments = ' + loot + ' CASH — ' +
  (loot / MONSTER_SCORE_STEP * 100).toFixed(1) + '% of ONE Red Bull milestone (the pay is unchanged; the harvest is SLOWER: ' +
  swingBudget + ' swings spent, at least ' + GHOUL_HITS_MIN + ' per kill)',
  kills >= 2 && loot <= MONSTER_SCORE_STEP && loot >= kills * SHOVEL_POINTS &&
  swingBudget >= kills * GHOUL_HITS_MIN,
  'swings=' + swingBudget + ' kills=' + kills);
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
  html.includes('p.shovelGuardT = SHOVEL_SWING_DUR + SHOVEL_GUARD + (fxTier() === 1 ? SHOVEL_GUARD * 0.15 : 0);'),
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
check('the cul-de-sac is walled at both ends: the bottom cemetery fence (standoff included) and the rig tail',
  H.workerEndLimitX() === NK_FLOOR && H.workerTopLimitX() === NIGHT_TOP_X - NIGHT_TRAIL_X,
  'mouth=' + H.workerEndLimitX() + ' top=' + H.workerTopLimitX());
check('HE KEEPS HIS DISTANCE FROM THE IRON (Midnight): the floor of the street is the fence line PLUS the standoff (' +
    NK_FLOOR + 'u from ' + NIGHT_FENCE_X + 'u), it is the same line awake and asleep, the creature band floor never drops below it, and a flung body stops ON the floor (workerEndHardX never subtracts the standoff on the night)',
  NK_FLOOR === NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF && NIGHT_FENCE_STANDOFF >= 1 &&
    H.workerEndLimitX() === NK_FLOOR &&
    H.creatureMinX() >= NK_FLOOR &&
    srcFn('nightWallX').includes('NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF') &&
    srcFn('workerEndHardX').includes('isNightShift() ? nightWallX() : workerEndLimitX() - 2') &&
    // THE NO-PUSH LAW: no boss contact of any kind writes the worker's position any more, and
    // no knock-back has ever carried a body past the sealed ceiling with a +2 leash.
    !/\bbossRingClamp\(/.test(html) &&
    !/p\.wx\s*=/.test(srcFn('updateBossFireballs')) &&
    !/p\.wy\s*=/.test(srcFn('updateBossFireballs')) &&
    !/p\.wx\s*=/.test(srcFn('bossWhipStrike')) &&
    !/p\.wy\s*=/.test(srcFn('bossWhipStrike')) &&
    !/p\.wx\s*=/.test(srcFn('updateNightBoss')) &&
    !/p\.wy\s*=/.test(srcFn('updateNightBoss')) &&
    !/workerCeilX\(\) \+ 2/.test(html),
  'floor=' + NK_FLOOR);
// THE SWEPT BOSS FIELD (Midnight): the final-boss block carries no haunt at all. The block
// the beast is fought on is the near end of the dead-end street (x 0..NIGHT_BEAT_GRAVE_X);
// NIGHT_BLOCKS packs the four wards ABOVE it (96 / 192 / 288 / 384u) and lists nothing at 0u.
const NK_FIELD_X1 = NIGHT_BEAT_GRAVE_X; // 96u — the first packed ward block, the boss ring's far end
const NIGHT_BOSS_FIELD_SWEPT = /const NIGHT_BOSS_FIELD_SWEPT = true/.test(html);
check("THE BOSS FIELD IS SWEPT CLEAN (Midnight): the final-boss block (x 0.." + NK_FIELD_X1 + "u) lays NO ghostly haunt — no spectral headstone, no skull pile, no grave candle, no open coffin, no iron gate leaf, no risen ARM, no severed hand: buildNightCemetery's 21-prop scatter in the fight span (x 36..96u) is gated off by NIGHT_BOSS_FIELD_SWEPT, and the shoverable haunt stays on the ward blocks above (the band props at x >= " + NK_FIELD_X1 + "u) and in the YARD behind the bottom fence, which is the cemetery itself",
  NIGHT_BOSS_FIELD_SWEPT === true &&
    srcFn('buildNightCemetery').includes('if (b && b.hazards && !NIGHT_BOSS_FIELD_SWEPT)') &&
    srcFn('buildNightCemetery').includes('nightPlaceProp(b, kinds[i], px, py)') &&
    NIGHT_BLOCKS.filter((e) => e.x === 0).length === 0 && NK_FIELD_X1 === 96);
check("NO OPEN MANHOLE (and its pair of blinking eyes) is cut into the boss block on Midnight — the refusal lives in addManhole, it is night- and block-precise, every weekday block (and a Node harness with no night flag) cuts them exactly as shipped",
  srcFn('addManhole').includes('typeof isNightShift === "function" && isNightShift() && b && b.blockX === 0') &&
    srcFn('makeBlockContents').includes('else if (hr < 0.68) addManhole(b, hzX(1.5), R(-7.5, -3.5));'));
check("THE MANHOLE TENTACLE IS A WARD-BLOCK HAUNT: the night's draw comes only from the packed blocks above the boss block that stand on open street, so no ghostly arm rises in the boss ring; a weekday Sunday still draws from every garbage block",
  /const zDraw = isNightShift\(\)\s*\?\s*zBlocks\.filter\(function \(b\) \{\s*return b\.x >= BLOCK_W && b\.x \+ 8\.0 > workerEndLimitX\(\);/.test(html) &&
    /const zb = zDraw\[\(Math\.random\(\) \* zDraw\.length\) \| 0\];/.test(html) &&
    /const zBlocks = LEVEL_BLOCKS\.filter\([\s\S]{0,80}b\.garbage === true/.test(html));
check("NOTHING SPOOKY IS BORN ON THE BOSS BLOCK: no block pack is listed at 0u (no pack, no band fill, no respawn there), the haunt's spirit cap is zero, and the ghost face the street knows — the pair of LURKING EYES sunk in an open manhole — is refused on block 0 with the bore itself",
  NIGHT_BLOCKS.filter((e) => e.x === 0).length === 0 &&
    NIGHT_GHOST_CAP === 0 &&
    srcFn('addManhole').includes('addLurkingEyes(g)') &&
    srcFn('addManhole').includes('b.blockX === 0'));
check("THE BOSS STANDS ALONE IN A CLEAR RING at x " + NIGHT_BOSS_X + "u, inside the swept block and short of the ward curtain at " + NK_FIELD_X1 + "u — and the four ward blocks above keep their packs, surge wraiths, floor reinforces, props, spirits, notes and tentacles exactly as shipped",
  NIGHT_BOSS_X < NK_FIELD_X1 && NIGHT_BOSS_X > NIGHT_FENCE_X &&
    NIGHT_BLOCKS.length === 4 &&
    NIGHT_BLOCKS.every((e) => e.x >= NK_FIELD_X1 && Object.keys(e.pack).length > 0));
// --- THE BEAST: built asleep at the cemetery with the FULL bar ---
H.clearNightBoss();
H.spawnNightBoss();
const boss = H.getBoss();
check('the beast is BUILT AT THE CEMETERY with its full bar, asleep and buried under the grass',
  !!boss && boss.hp === BOSS_MAX_HP && boss.maxHp === BOSS_MAX_HP && boss.awake === false &&
  boss.g.visible === false && Math.abs(boss.wx - NIGHT_BOSS_X) < 1e-9,
  'hp=' + (boss && boss.hp) + ' x=' + (boss && boss.wx));
const tent = H.makeTentacleBoss();
const tp = tent.userData.tent;
check('it is a FINAL BOSS of a rig: NINE eyes on stalks, TWO three-joint TENTACLE ARMS with hooked, fire-lit tips, and a MAW',
  tp.eyes.length === 9 && tp.tentacles.length === 2 && !!tp.maw &&
  tp.tentacles.every(t => t.sh && t.j1 && t.j2 && t.tip && t.flame),
  'eyes=' + tp.eyes.length + ' arms=' + tp.tentacles.length);
check('THE GRIN IS SHARP: two rows of needle teeth (the jaws tear open on the ghost fire)',
  tp.teeth.length >= 20 && !!tp.jawT && !!tp.jawB, 'teeth=' + tp.teeth.length);
check('THE HEART IS BUILT IN: a spiked cavity, a beating heart with its own aura and light, and TWO skin flaps to sleet apart',
  !!tp.heart && !!tp.aura && !!tp.light && tp.flaps.length === 2 &&
  tp.flaps.every(f => f.position.y !== 0) && tp.spikes.children.length >= 10,
  'flaps=' + tp.flaps.length + ' spikes=' + tp.spikes.children.length);
check('IT IS A SLUG, BIG AS A CAR: a swollen mantle on a creeping foot, a gut, a dragged tail and dripping slime',
  tp.body.scale.x >= 1.6 && tp.body.scale.y >= 1.1 && !!tp.belly && !!tp.mantle &&
  tp.drips.length >= 6 && tp.tentacles[0].side !== tp.tentacles[1].side,
  'mantle x-scale=' + tp.body.scale.x);
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
// --- rise, then THE STAND (it holds its grave until the heart has been taken a few times) ---
for (let i = 0; i < 400 && boss.riseT > 0; i++) H.updateNightBoss(boss, 1 / 60);
check('it climbs all the way OUT of the grave yard and stands at full size',
  boss.riseT === 0 && Math.abs(boss.g.position.z - GZ) < 0.25 && boss.g.scale.x === 1,
  'z=' + boss.g.position.z.toFixed(2));
const x0 = boss.wx;
for (let i = 0; i < 150; i++) { boss.heartT = 99; H.updateNightBoss(boss, 1 / 60); }
check('it HOLDS ITS GRAVE on the rise point: no strike on the heart yet, no walking (' + BOSS_FURY_HITS + ' strikes arms the run)',
  Math.abs(boss.wx - x0) < 1e-9 && boss.hits === 0 && H.bossIsFurious(boss) === false,
  'x=' + boss.wx.toFixed(2));
boss.hits = BOSS_FURY_HITS; boss.fury = 1; // FURIOUS: the heart has been taken a few times
const x1 = boss.wx;
for (let i = 0; i < 150; i++) { boss.heartT = 99; H.updateNightBoss(boss, 1 / 60); }
check('FURIOUS, it drags itself over the block AT THE WORKER (it runs him, it never runs from him)',
  Math.abs(boss.wx - p.wx) < Math.abs(x1 - p.wx), x1.toFixed(1) + ' -> ' + boss.wx.toFixed(1));
check('it never leaves the cemetery block: the run is clamped to its own ring',
  boss.wx >= NIGHT_GRAVE_X - 6 - 1e-6 && boss.wx <= NIGHT_BOSS_TRIGGER_X + 8 + 1e-6,
  'x=' + boss.wx.toFixed(1));
boss.heartT = 1.4;
check('while the beast stands, THE BOTTOM IS HIS RING — the beast is NOT a wall at its back: his floor is the bottom cemetery fence with the standoff on it (' + NK_FLOOR + 'u), below the beast\'s rise point, so he can walk around under it and fight from any side without leaving the street — and he can never get to the iron',
  Math.abs(H.workerEndLimitX() - Math.max(NK_FLOOR, NIGHT_END_X + NIGHT_MOUTH_X, NIGHT_GRAVE_X - 8 - NK_BOSS_ROOM_X)) < 1e-9 &&
    H.workerEndLimitX() === NK_FLOOR &&
    H.workerEndLimitX() < NIGHT_BOSS_X - 0.6 &&
    H.workerEndLimitX() >= NIGHT_END_X + NIGHT_MOUTH_X &&
    srcFn('nightWallX').includes('NIGHT_BOSS_ROOM_X') &&
    srcFn('nightWallX').includes('NIGHT_FENCE_X'),
  'wall=' + H.workerEndLimitX() + ' fence=' + NIGHT_FENCE_X);
check('THE FENCE IS THE BORDER, NOT THE DECORATION: the iron across the road stands exactly on the worker\'s floor line (nightWallX == the fence x), the creature band floor never drops below it, and the graves gate law is untouched',
  NIGHT_FENCE_X === NIGHT_END_X + 8 &&
    NIGHT_FENCE_X >= NIGHT_GRAVE_X - 8 &&
    srcFn('buildNightCemetery').includes('fence.position.set(NIGHT_FENCE_X, -9.6, GZ)') &&
    srcFn('creatureLimitMinX').includes('Math.max(nightWallX(), NIGHT_FENCE_X)') &&
    srcFn('nightWallX').includes('Math.max(NIGHT_GRAVE_X - 8, fenceLine)'),
  'fence=' + NIGHT_FENCE_X);
check('THE BODY IS SOLID, IT STINGS WITH NO SWING, AND IT NEVER SHOVES: crowding him with its gut, he is bruised on the band and his ground is untouched',
  (function () {
    p.wx = boss.wx + 0.8; p.wy = boss.wy; p.nightHitT = 0; boss.bodyCd = 0;
    const bx = p.wx, by = p.wy;
    H.hurtLog().length = 0;
    H.stunLog().length = 0;
    H.updateNightBoss(boss, 1 / 60);
    return (
      p.wx === bx &&
      p.wy === by &&
      H.hurtLog().length === 1 &&
      H.hurtLog()[0].c === 'beast' &&
      H.hurtLog()[0].a === BOSS_HP_BODY &&
      H.stunLog().length === 1
    );
  })(), 'x=' + p.wx.toFixed(2) + ' hits=' + H.hurtLog().length);
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
// --- THE BEAST'S RING LAW, WALKED LIVE: NO PUSH through any fence, MINOR damage, and a heart
// --- that is HIDDEN in a shut shell and BLAZES BRIGHT RED when the shell opens ---
(function () {
  const b = H.getBoss();
  const tent = b.g && b.g.userData ? b.g.userData.tent : null;
  const quiet = () => { b.whipT = 999; b.fireT = 999; b.heartT = 999; b.bodyCd = 999; b.invulnT = 999; };
  const floor = H.workerEndLimitX(); // the ring's BOTTOM wall: the cemetery fence + standoff
  quiet();
  b.hp = BOSS_MAX_HP; b.hits = 0; b.wx = floor + 2.6; b.wy = 0; b.bodyCd = 0;
  p.wx = floor + 1.0; p.wy = 0; p.gatePrev = floor + 1.0; p.nightHitT = 0; p.stunT = 0;
  H.hurtLog().length = 0;
  H.updateNightBoss(b, 1 / 60);
  const crushX = p.wx, crushY = p.wy;
  const crushHurt = H.hurtLog().length;
  check('THE GHOST FENCE SIDE, DOWNHILL: the body crush crowds him at the bottom fence and he keeps EXACTLY his ground (' + crushX.toFixed(2) + 'u, floor ' + floor + 'u) — the beast never carries a man under the cemetery fence, it only bruises him',
    crushX === floor + 1.0 && crushY === 0 && crushHurt >= 1,
    'x=' + crushX.toFixed(2) + ' floor=' + floor + ' hurt=' + crushHurt);
  // THE GHOST IRON: with the ring sealed, the same crush uphill must leave him ON the sealed ceiling.
  H.sealArm(); p.wx = 74; p.gatePrev = 74; H.sealClose();
  const ceil = H.ceilX();
  b.wx = ceil - 2.6; b.wy = 0; b.bodyCd = 0;
  p.wx = ceil - 1.0; p.wy = 0; p.nightHitT = 0; p.stunT = 0;
  const upX = p.wx, upY = p.wy;
  H.hurtLog().length = 0;
  H.updateNightBoss(b, 1 / 60);
  check('THE GHOST FENCE SIDE, UPHILL: the seal is shut, the beast crowds him AT the ghost iron, and his centre is BYTE-IDENTICAL (' + p.wx.toFixed(2) + 'u, the ceiling ' + ceil + 'u) — the belly may rest on him (' + Math.hypot(p.wx - b.wx, p.wy - b.wy).toFixed(2) + 'uinside the body radius), it bruises him, and it moves him NOWHERE',
    p.wx === upX && p.wy === upY && p.wx <= ceil &&
      H.hurtLog().length === 1 && H.hurtLog()[0].a === BOSS_HP_BODY,
    'x=' + p.wx.toFixed(2) + ' ceil=' + ceil);
  H.sealDrop();
  for (let i = 0; i < 220; i++) H.sealTick(1 / 60);
  H.sealClear();
  // NO SHOVE from the cold fire: the burst stings where he stands and leaves his feet alone.
  quiet();
  b.hp = BOSS_MAX_HP; b.wx = 74; b.wy = 0;
  p.wx = b.wx + 6; p.wy = b.wy; p.nightHitT = 0; p.stunT = 0; // OUT of the crush radius
  const px0 = p.wx, py0 = p.wy;
  H.getFireballs().length = 0;
  b.fireT = 0.01;
  H.updateNightBoss(b, 1 / 60); // one volley
  const fb = H.getFireballs()[H.getFireballs().length - 1];
  fb.wx = p.wx + 0.2; fb.wy = p.wy;
  H.hurtLog().length = 0;
  H.updateBossFireballs(1 / 60);
  check('COLD FIRE IS A MINOR STING AND NEVER A SHOVEL: ' + BOSS_HP_FIRE + ' HP of the 100 pool and a stagger — he stands on EXACTLY the same ground (' + px0.toFixed(2) + ', ' + py0.toFixed(1) + ') after the burst',
    H.hurtLog().length === 1 && H.hurtLog()[0].a === BOSS_HP_FIRE && BOSS_HP_FIRE <= 4 &&
      Math.abs(p.wx - px0) < 1e-9 && Math.abs(p.wy - py0) < 1e-9 && H.stunLog().length >= 1,
    'dmg=' + H.hurtLog().map((h) => h.a).join(',') + ' x=' + p.wx.toFixed(2));
  // THE LASH: a sting, and the same law — no launch down the street.
  b.wx = 74; b.wy = 0; b.whipState = 'wind'; b.whipT = 0; b.fireT = 999; b.heartT = 999;
  p.wx = b.wx + 4.2; p.wy = b.wy + 0.4; p.nightHitT = 0; p.stunT = 0;
  const lx0 = p.wx, ly0 = p.wy;
  H.hurtLog().length = 0;
  b.facing = Math.atan2(p.wy - b.wy, p.wx - b.wx);
  // It holds its rise point for the lash (no fury yet: the run would close the distance).
  b.hits = 0;
  for (let i = 0; i < 160 && b.whipState !== 'idle'; i++) { b.bodyCd = 999; b.fireT = 999; H.updateNightBoss(b, 1 / 60); }
  check('THE TENTACLE LASH STINGS (' + BOSS_HP_WHIP + ' HP) AND DOES NOT THROW HIM: the whole lash moved him ' +
      Math.hypot(p.wx - lx0, p.wy - ly0).toFixed(3) + 'u — no boss hit launches a man through a fence',
    H.hurtLog().length === 1 && H.hurtLog()[0].a === BOSS_HP_WHIP && BOSS_HP_WHIP <= 7 &&
      Math.hypot(p.wx - lx0, p.wy - ly0) < 0.5,
    'dmg=' + H.hurtLog().map((h) => h.a).join(',') + ' moved=' + Math.hypot(p.wx - lx0, p.wy - ly0).toFixed(3));
  check('EVERY BEAST HIT IS MINOR ON THE 100-POINT POOL: fire ' + BOSS_HP_FIRE + ' + crush ' + BOSS_HP_BODY +
      ' + lash ' + BOSS_HP_WHIP + ' = ' + (BOSS_HP_FIRE + BOSS_HP_BODY + BOSS_HP_WHIP) +
      ' — the whole fight takes a fraction of him, not twice his life',
    BOSS_HP_FIRE + BOSS_HP_BODY + BOSS_HP_WHIP <= 20);
  // THE NO-PUSH LAW, WALKED THROUGH THE WHOLE FIGHT: fireball, lash, crush, scurry and the
  // burst — the beast NEVER writes his position, in any of its contacts.
  check('THE BEAST NEVER TOUCHES HIS GROUND, BEAT AFTER BEAT: a volley, a lash, a crush and a scurry all leave p.wx and p.wy EXACTLY where he stood',
    (function () {
      b.hp = BOSS_MAX_HP; b.hits = 0; b.wx = 74; b.wy = 0;
      b.burst = false; b.burstT = 0; b.dead = false; b.hooked = false;
      b.scurryT = 0; b.scurry = false; b.whipState = 'idle';
      p.wx = 78; p.wy = 1.4; p.nightHitT = 0; p.stunT = 0; p.gatePrev = p.wx;
      const gx = p.wx, gy = p.wy;
      H.hurtLog().length = 0; H.stunLog().length = 0;
      for (let i = 0; i < 420; i++) {
        b.bodyCd = 0; b.fireT = 0.01; b.invulnT = 0;
        p.nightHitT = 0;
        H.updateNightBoss(b, 1 / 60);
        H.updateBossFireballs(1 / 60);
        if (p.wx !== gx || p.wy !== gy) return false;
      }
      // and a wound puts it into the scurry — the run never drags him along
      b.hp = BOSS_MAX_HP - 20; b.hits = BOSS_FURY_HITS; b.scurryT = 0;
      for (let i = 0; i < 120; i++) { b.bodyCd = 0; p.nightHitT = 0; H.updateNightBoss(b, 1 / 60); }
      return (
        p.wx === gx &&
        p.wy === gy &&
        H.hurtLog().length >= 1 &&
        H.hurtLog().every((h) => h.c === 'beast')
      );
    })(), 'x=' + p.wx.toFixed(2) + ' hurt=' + H.hurtLog().length);
  check('THE GUT IS SOLID AND THE BAND STINGS: BOSS_GUT_R sits inside BOSS_BRUSH_R, the beast is walled out of the ghost iron by its OWN bulk radius, and touching it is taught out loud (the wake line, the brush line, the card)',
    NK_GUT_R < NK_BRUSH_R &&
      NK_GUT_R > BOSS_BODY_R &&
      srcFn('updateNightBoss').includes('d < BOSS_BRUSH_R') &&
      srcFn('updateNightBoss').includes('sealFaceX() - BOSS_BODY_R') &&
      srcFn('updatePlayer').includes('nightBoss.wx, y - nightBoss.wy) < BOSS_GUT_R') &&
      srcFn('startBossFight').includes('IT NEVER SHOVES YOU. WALK AROUND IT!') &&
      NK_BRUSH_LINES.some((l) => /NEVER SHOVES/.test(l)) &&
      srcFn('updateNightBoss').includes('pick(BOSS_BRUSH_LINES)'),
    'gut=' + NK_GUT_R + ' brush=' + NK_BRUSH_R);
  check('THE HUD PHASE FOR THE GUT EXISTS: IN THE GUT! reads off bossBrushed, and the helper measures the worker against the beast with the shipped radii',
    srcFn('updateHUD').includes('"  IN THE GUT!"') &&
      srcFn('updateHUD').includes('bossBrushed(b)') &&
      srcFn('bossBrushed').includes('BOSS_BRUSH_R') &&
      srcFn('bossGutDistance').includes('Math.hypot(p.wx - b.wx, p.wy - b.wy)'),
  );
  // THE HEART: SHUT = nothing to see; CRACK = a red seam; OPEN = a bright-red blaze to shovel.
  if (tent) {
    b.hp = BOSS_MAX_HP; b.hits = 0; b.heartState = 'shut'; b.heartOpen = 0;
    quiet();
    for (let i = 0; i < 40; i++) { b.heartT = 99; H.updateNightBoss(b, 1 / 60); }
    const shutVis = tent.heart.visible;
    const shutEmit = Math.max.apply(null, tent.heartMats.map((m) => m.emissiveIntensity));
    const shutLight = tent.light.intensity;
    const shutAura = tent.aura.material.opacity; // measured WHILE the shell is shut
    // CRACK on its own clock (the shell cracks, the lids tremble, a first red seam leaks)
    b.heartT = 0.001;
    for (let i = 0; i < 40 && b.heartState === 'shut'; i++) H.updateNightBoss(b, 1 / 60);
    const cracked = b.heartState;
    const crackEmit = Math.max.apply(null, tent.heartMats.map((m) => m.emissiveIntensity));
    // OPEN on the telegraph's own clock, and ride the window with the flaps fully out
    for (let i = 0; i < 200 && b.heartState !== 'open'; i++) H.updateNightBoss(b, 1 / 60);
    for (let i = 0; i < 40; i++) H.updateNightBoss(b, 1 / 60);
    const openEmit = Math.max.apply(null, tent.heartMats.map((m) => m.emissiveIntensity));
    const openColor = tent.heartMats[0].color.hex;
    const openScale = tent.heart.scale.x;
    check('A SHUT SHELL HIDES THE HEART OUTRIGHT: no heart on screen, no burn, no lamp (emissive ' +
        shutEmit.toFixed(2) + ', light ' + shutLight.toFixed(2) + ', aura ' + shutAura.toFixed(2) +
        ') — there is NOTHING on the beast to hit',
      shutVis === false && shutEmit <= 0.1 && shutLight <= 0.1 && shutAura <= 0.05,
      'vis=' + shutVis + ' emit=' + shutEmit.toFixed(2));
    check('THE CRACK TELLS IT FIRST: the seam bleeds a first dim red glow (' + crackEmit.toFixed(2) +
        ') while the lids tremble — the tell that the window is coming',
      cracked === 'crack' && crackEmit > 0.4 && crackEmit < openEmit,
      'state=' + cracked + ' emit=' + crackEmit.toFixed(2));
    check('THE OPEN HEART BLAZES BRIGHT RED — emissive ' + openEmit.toFixed(2) + ' on 0x' +
        NK_HEART_HOT.toString(16) + ', lamp ' + tent.light.intensity.toFixed(2) +
        ': the red burn IS the shovel-it signal, and it grows out of the cavity (' +
        openScale.toFixed(2) + 'u)',
      b.heartState === 'open' && tent.heart.visible === true && openEmit >= 2.5 &&
        openColor === NK_HEART_HOT && tent.light.intensity > 1.5 &&
        tent.aura.material.opacity > 0.3 && openScale > 0.7,
      'emit=' + openEmit.toFixed(2) + ' lamp=' + tent.light.intensity.toFixed(2) +
        ' scale=' + openScale.toFixed(2));
    for (let i = 0; i < 260 && b.heartState === 'open'; i++) { b.heartT = 0; H.updateNightBoss(b, 1 / 60); }
    for (let i = 0; i < 40; i++) { b.heartT = 99; H.updateNightBoss(b, 1 / 60); }
    check('THE SHELL SLIDING BACK KILLS THE LIGHT: the heart is hidden and dark again the frame it is unhittable',
      b.heartState === 'shut' && tent.heart.visible === false &&
        Math.max.apply(null, tent.heartMats.map((m) => m.emissiveIntensity)) <= 0.1,
      'state=' + b.heartState);
  }
  quiet();
  H.getFireballs().length = 0;
  // THE RIDE-OFF OF THIS SECTION: the beast goes back to its rise point on a full, unstruck
  // bar with a shut shell, the seal is cleared, so the shipped tests downstream run on the
  // rig they expect.
  b.wx = NIGHT_BOSS_X; b.wy = 0; b.hp = BOSS_MAX_HP; b.hits = 0; b.rage = 0;
  b.heartState = 'shut'; b.heartOpen = 0; b.heartT = 2.2; b.whipState = 'idle'; b.invulnT = 0;
  b.bodyCd = 0; b.whipT = 1.5; b.fireT = 2.5;
  H.sealClear();
})();
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
// --- GHOST FIRE: the tentacle arm LIFTS, the ball comes off its tip, it burns out in the fog ---
(function () {
  boss.rage = 0; boss.hp = BOSS_MAX_HP; boss.fireT = 0.01; boss.mawOpen = 0; boss.armCharge = 0;
  H.getFireballs().length = 0; // the sweep is COLD before this test: one volley, one ball
  const n0 = H.getFireballs().length;
  H.updateNightBoss(boss, 1 / 60);
  check('the TENTACLE ARM rears up and the maw tears open: a cold ball comes off the hook',
    H.getFireballs().length === n0 + BOSS_SHOTS && boss.mawOpen > 0.9 && boss.armCharge > 0.9,
    'balls=' + (H.getFireballs().length - n0) + ' charge=' + boss.armCharge.toFixed(2));
  check('the fire leaves from the ARM\u2019S HOOK, not out of the body (the muzzle is the tip)',
    (function () {
      const fb = H.getFireballs()[H.getFireballs().length - 1];
      const m1 = H.bossArmMuzzle(boss, 1), m2 = H.bossArmMuzzle(boss, -1);
      const offArm = Math.min(Math.hypot(fb.wx - m1.wx, fb.wy - m1.wy),
                              Math.hypot(fb.wx - m2.wx, fb.wy - m2.wy));
      return offArm < 1.7 && Math.hypot(fb.wx - boss.wx, fb.wy - boss.wy) > 1.0;
    })(), 'spectral fire in ' + BOSS_FIRE_TINTS.length + ' grave-fire colours');
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
  // --- THE FURY RAMP: the weaker the bar, the meaner the fire (bigger AND faster volleys) ---
  boss.hp = Math.ceil(BOSS_MAX_HP / 4); boss.hits = 0; boss.rage = 1; boss.fireT = 0.01;
  const n2 = H.getFireballs().length;
  H.updateNightBoss(boss, 1 / 60);
  check('in the LAST THIRD of the bar it hurls the fire in THREES',
    H.getFireballs().length === n2 + BOSS_SHOTS_FURY, 'balls=' + (H.getFireballs().length - n2));
  H.getFireballs().length = 0;
  boss.hp = BOSS_MAX_HP; // the bar goes back to FULL: the ramp tests below run on mock bars
  const avgGap = (b, n) => { let s = 0; for (let i = 0; i < n; i++) s += H.bossFireGap(b); return s / n; };
  const gapFull = avgGap({ hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, rage: 0 }, 80);
  const gapLast = avgGap({ hp: 1, maxHp: BOSS_MAX_HP, rage: 1 }, 80);
  check('THE GAP BETWEEN VOLLEYS COLLAPSES as it weakens (' + gapFull.toFixed(2) + 's on a full bar \u2192 ' + gapLast.toFixed(2) + 's on its last heart, floor ' + BOSS_FIRE_CD_FLOOR + 's)',
    gapLast < gapFull * 0.6 && gapLast >= BOSS_FIRE_CD_FLOOR - 1e-9);
  check('THE HEART WINDOW SHORTENS AND THE ARMOUR GAP SHRINKS on the last hearts',
    H.bossHeartOpenT({ hp: 1, maxHp: BOSS_MAX_HP }) <
      H.bossHeartOpenT({ hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP }) &&
      H.bossHeartCloseT({ hp: 1, maxHp: BOSS_MAX_HP }) <
      H.bossHeartCloseT({ hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP }));
  // --- THE HEART CYCLE on the live beast: shut -> CRACK (the tell) -> OPEN (the bite) -> shut ---
  boss.heartState = 'shut'; boss.heartT = 0.01;
  H.updateNightBoss(boss, 1 / 60);
  check('the shell CRACKS first — a TELEGRAPH the player can read before the window opens',
    boss.heartState === 'crack' && boss.heartT > 0 && H.bossHeartOpen() === false);
  for (let i = 0; i < 90 && boss.heartState === 'crack'; i++) H.updateNightBoss(boss, 1 / 60);
  check('...then the flaps SLEET APART and the heart is exposed (the ONLY bite window)',
    boss.heartState === 'open' && H.bossHeartOpen() === true &&
      Math.abs(boss.heartT - H.bossHeartOpenT(boss)) < 0.15, 'T=' + boss.heartT.toFixed(2));
  for (let i = 0; i < 260 && boss.heartState === 'open'; i++) H.updateNightBoss(boss, 1 / 60);
  check('the window CLOSES on its own beat (the armour is back up)',
    boss.heartState === 'shut' && H.bossHeartOpen() === false);
  boss.rage = 0;
})();
// --- THE SHOVEL ON THE EXPOSED HEART IS THE ONLY THING THAT SHORTENS THE BAR ---
p.wx = boss.wx - 2.4; p.wy = boss.wy; p.shovelCd = 0; p.stunT = 0; p.facing = 0; // he faces the beast
const exposeHeart = () => { boss.heartState = 'open'; boss.heartT = 2.2; boss.heartOpen = 1; };
const shutHeart = () => { boss.heartState = 'shut'; boss.heartT = 99; boss.heartOpen = 0; };
check('the blade reaches the beast\u2019s hide (the whole tool, shaft AND head sweep)',
  H.bossShovelRange() > SHOVEL_REACH + SHOVEL_BLADE_R && H.bossShovelTargetable() === true);
check('WITH THE SHELL SHUT THERE IS NO TARGET — the heart is the only window the shovel bites',
  (function () {
    shutHeart();
    p.shovelCd = 0;
    const hp0 = boss.hp;
    const swingIn = H.swing();
    const clang = log[log.length - 1] === 'clang' || log.indexOf('clang') >= 0;
    return boss.hp === hp0 && swingIn === true && clang && H.bossHeartOpen() === false;
  })(), 'hp=' + boss.hp);
(function () {
  exposeHeart();
  const hp0 = boss.hp;
  const face0 = p.facing;
  H.setCharge(0);
  p.shovelCd = 0;
  H.swing();
  check('ONE SWING ON THE OPEN HEART, ONE CUT on the bar (an ordinary swing takes BOSS_DMG)',
    boss.hp === hp0 - BOSS_DMG && log.indexOf('sting') >= 0, 'hp=' + boss.hp);
  check('the WOUND SLAMS THE SHELL SHUT: the next opening is the next chance',
    boss.heartState === 'shut' && boss.heartT > 0 && H.bossHeartOpen() === false,
    'heart=' + boss.heartState + ' T=' + (boss.heartT && boss.heartT.toFixed(2)));
  check('a swing on the beast NEVER rotates him (he keeps his facing); the BEAST is what turns into the blow, and the cooldown is set (no mash-fest)',
    p.facing === face0 &&
      Math.abs(((boss.facing || 0) - (face0 + Math.PI)) % (Math.PI * 2)) < 1e-6 &&
      p.shovelCd > 0);
  const afterFirst = boss.hp;
  p.shovelCd = 0;
  H.swing();
  check('the beast is INVULNERABLE inside its own hit window (a blink of swings is ONE hit)',
    boss.hp === afterFirst && boss.invulnT > 0, 'hp=' + boss.hp + ' inv=' + boss.invulnT.toFixed(2));
  check('the hit STINGS: the bar kicks, the beast flinches and its lash is cut off',
    log.indexOf('sting') >= 0 && boss.hurtT > 0 && boss.whipState === 'idle');
  boss.invulnT = 0;
  H.setCharge(CONS_CHARGE_AT); // THE HOLY SHOVEL
  exposeHeart();
  const beforeCons = boss.hp;
  p.shovelCd = 0;
  H.swing();
  check('a CONSECRATED swing on the open heart cuts DOUBLE through the bar',
    boss.hp === beforeCons - BOSS_DMG_CONS, 'hp ' + beforeCons + ' -> ' + boss.hp);
  H.setCharge(0);
  p.wy = boss.wy; p.shovelCd = 0;
  p.wx = boss.wx + 40;
  const outHp = boss.hp;
  check('a swing at EMPTY FOG does not touch the bar (out of the tool is out of the fight)',
    H.swing() === true && boss.hp === outHp);
  boss.hp = BOSS_MAX_HP; // fresh bar: count the heart strikes it takes from FULL health
  boss.hits = 0;
  const scoreBefore = scored.reduce((a, s) => a + s.n, 0);
  let swings = 0, clangs = 0;
  while (boss.hp > 0 && swings < 80) {
    p.wx = boss.wx - 2.4; p.wy = boss.wy; p.shovelCd = 0; p.stunT = 0; p.facing = 0;
    boss.invulnT = 0;
    shutHeart(); // the ARMOUR is up: a swing in this beat is a CLANG, not a cut
    H.swing();
    clangs++;
    if (boss.hp > 0) { exposeHeart(); p.shovelCd = 0; H.swing(); } // ...and this one is the heart
    swings++;
  }
  check('TEN strikes on the EXPOSED HEART banish it (the bar IS the level\u2019s win condition)',
    boss.hp === 0 && swings === BOSS_MAX_HP, 'swings=' + swings);
  check('the swings that missed the window cost the bar NOTHING (10 cuts, ' + clangs + ' clangs)',
    clangs === BOSS_MAX_HP, 'clangs=' + clangs);
  check('every heart strike is COUNTED: the fury ramp rides on it (hits=' + boss.hits + ' of ' + BOSS_MAX_HP + ')',
    boss.hits >= BOSS_MAX_HP - 1);
  check('every cut on the bar pays (the banishment purse is scored on the hits)',
    scored.reduce((a, s) => a + s.n, 0) - scoreBefore >= BOSS_POINTS * BOSS_DMG,
    'scored=' + (scored.reduce((a, s) => a + s.n, 0) - scoreBefore));
  check('its dying frame HOOKS the body for the BLOW-UP (the boom beat is armed on the beast)',
    boss.hooked === true && boss.suckT === 0 && H.getFightOn() === true);
  check('THE BEAST IS BANISHED THE FRAME IT DIES (nightBossBanished: it does not come back)',
    H.getBanished() === true, 'banished=' + H.getBanished());
  check('the boom inflates the body on the spot it died on (fx0/fy0 pin the burst patch)',
    boss.fx0 === boss.wx && boss.fy0 === boss.wy);
})();
// --- THE BLOW-UP: the body bursts, the street is COATED, the Gargoyle lands beside him ---
(function () {
  const dep0 = deposited.length;
  const workerG = H.getBoss() ? H.getBoss().g : null;
  const sl0 = H.getBossSlime().length;
  const steps = Math.ceil(BOSS_SUCTION_T / (1 / 60)) + 12;
  for (let i = 0; i < steps && H.getBoss(); i++) H.updateNightBoss(H.getBoss(), 1 / 60);
  check('IT BLOWS UP ON ITS OWN GRAVES: the body is gone off the street for good',
    H.getBoss() === null && H.getFightOn() === false && (workerG === null || !workerG.parent),
    'mesh=' + (workerG ? (workerG.parent ? 'on street' : 'off street') : 'gone'));
  check('the blast is a geyser — the burst fires the ecto AND the compactor cycles the slime up',
    H.bossBursts().length > 0 && H.getHopperCycling() === true &&
      deposited.length - dep0 >= HOPPER_CYCLE_AT,
    'deposits=' + (deposited.length - dep0));
  const slime = H.getBossSlime();
  const pools = slime.filter(g => g.parent === dyn); // the gobs laid on the asphalt
  const drapes = slime.filter(g => g.parent && g.parent !== dyn); // ...and the films ON things
  check('ECTOPLASMIC SLUG SLIME ON EVERYTHING: the blast floor is paved in pools',
    slime.length - sl0 >= NK_BOOM_SPLATS, 'gobs=' + (slime.length - sl0));
  check('...and the drape is ON the props and the ghost iron — NEVER on the worker',
    drapes.length >= 2 && !slime.some((g) => g.parent === NK_WORKER_STUB.group) &&
      NK_WORKER_STUB.group.children.length === 0 && !!p.slimeT &&
      p.pickleSteps >= NK_BOOM_SLIME_KEEP,
    'drapes=' + drapes.length + ' steps=' + p.pickleSteps +
      ' workerKids=' + NK_WORKER_STUB.group.children.length);
  check('NO ECTOPLASM IS ATTACHED TO HIM: his clean feet walk out, the goop only leaves shoe prints on the asphalt',
    p.slimeT === 1 && NK_WORKER_STUB.group.children.length === 0);
  const gg = H.getBossGargoyle();
  const dg = gg ? Math.hypot(p.wx - gg.wx, p.wy - gg.wy) : -1;
  check('THE RUBY-PLATED GARGOYLE lands BESIDE the worker — near him, and NOT on him',
    !!gg && gg.val === GARGOYLE_VALUE && dg > 2.5 && dg < 8,
    'd=' + dg.toFixed(2) + 'u at x=' + (gg && gg.wx.toFixed(1)) + ' y=' + (gg && gg.wy.toFixed(1)));
  check('...and it is inside the ring he is standing in, on a lane of its own',
    !!gg && gg.wx >= NK_FLOOR + 2 - 1e-9 && gg.wx <= NK_SEAL_X - 2 + 1e-9 &&
      gg.wy >= -9 && gg.wy <= 5 && Math.abs(gg.wy - p.wy) <= 4,
    'x=' + (gg && gg.wx.toFixed(1)) + ' y=' + (gg && gg.wy.toFixed(1)));
  check('THE SLUG DEMON DOES NOT RESPAWN: the banished flag stands after the burst',
    H.getBanished() === true && H.getBoss() === null);
  check('the wall DROPS behind the graves once the beast is gone (the yard opens, and he still keeps the standoff off the iron)',
    H.workerEndLimitX() === NK_FLOOR, 'wall=' + H.workerEndLimitX());
})();
// --- THE WIN: the hop, the ghost fence gone, then he walks to the truck's door ---
check('THE CELEBRATION HOP IS ARMED IN THE GAME: grabBossGargoyle sets p.winJumpT = BOSS_WIN_JUMP_T ' +
  '(updatePlayer hops the worker up, arms over, knees tucked) and drops the ghost iron on the grab',
  srcFn('grabBossGargoyle').includes('p.winJumpT = BOSS_WIN_JUMP_T') &&
    srcFn('grabBossGargoyle').includes('nightSealDrop();') &&
    srcFn('updatePlayer').includes('winHop') &&
    srcFn('updatePlayer').includes('p.winJumpT'));
check('THE WORKER WALKS TO THE TRUCK\u2019S DOOR AND THE RIG DRIVES OFF, THEN THE REPORT SCREEN SHOWS: ' +
  'the win beat hands off to startRouteEnd (cheer -> walk-around to the cab door -> board -> drive), ' +
  'and the drive-off ends the route into the day-end / WEEK COMPLETE menu',
  srcFn('startRouteEnd').includes('phase: "cheer"') &&
    srcFn('startRouteEnd').includes('pts: pts') &&
    srcFn('startRouteEnd').includes('cabX') &&
    srcFn('updateRouteEnd').includes('routeEnd.phase === "board"') &&
    srcFn('updateRouteEnd').includes('"drive"') &&
    srcFn('updateRouteEnd').includes('finishRouteEnd()') &&
    srcFn('finishRouteEnd').includes('routeComplete()') &&
    srcFn('routeComplete').includes('state = "dayend"') &&
    srcFn('routeComplete').includes('"week-complete"'));
check('THE GHOSTLY CEMETERY FENCE COMES DOWN ON THE BANISH (the seal tears, the ring\u2019s ceiling goes)',
  srcFn('nightSealDrop').includes('nightSeal.armed = false') &&
    srcFn('nightSealDrop').includes('nightSeal.drop = NIGHT_GATE_FADE'));
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
  check('THE SHOVEL IS THROWN DOWN OF HIS HANDS ON THE GRAB: tossShovelDown empties his fists, the flight lands flat, and the laid tool goes with the shift',
    srcFn('grabBossGargoyle').includes('tossShovelDown();') &&
      srcFn('tossShovelDown').includes('shovelGroup = null') &&
      srcFn('tossShovelDown').includes('dynamicGroup.add(sh)') &&
      srcFn('updateShovelToss').includes('s.landed = true') &&
      srcFn('clearNightBoss').includes('shovelTossClear()'));
  let guard = 0;
  while (H.getBossWin() && guard < 900) { H.updateNightBossFight(1 / 60); guard++; }
  check('THE BOSS IS THE END OF THE LEVEL: the win beat drives the rig off the dead end',
    H.routeEnds().length === 1 && H.getBossWin() === false, 'driveOffs=' + H.routeEnds().length);
  // THE GATE ORDER (boss-stage crash: "null.t" in updateRouteEnd). The night's drive-off
  // hard gate runs BEFORE the "routeend" state flips, and the cinematic tick guards its
  // own sequencer — a blocked clock-out can never leave the flag up with no object.
  check('THE DRIVE-OFF GATE RUNS BEFORE THE STATE FLIPS: in startRouteEnd, the isNightShift gate (reclaim + beast-standing bail) sits ABOVE the state = "routeend" line — a blocked night drive-off stays a pure no-op',
    (() => {
      const s = srcFn('startRouteEnd');
      const gate = s.indexOf('isNightShift === "function" && isNightShift()');
      const bail = s.indexOf('bossShovelTargetable() || bossGargoyle) return');
      const flip = s.indexOf('state = "routeend"; //'); // THE REAL FLIP LINE (skips the mention in the fix comment)
      return gate >= 0 && bail >= 0 && flip >= 0 && gate < flip && bail < flip;
    })(),
    (() => { const s = srcFn('startRouteEnd'); return 'gate@' + s.indexOf('isNightShift === "function"') + ' flip@' + s.indexOf('state = "routeend"; //'); })());
  check('THE CINEMATIC GUARDS ITS SEQUENCER: updateRouteEnd opens with if (!routeEnd) return; — a frame that finds the flag up and the sequencer gone steps aside instead of dereferencing a null (the exact boss-stage crash path)',
    /^function updateRouteEnd\(dt\) \{\s*(\/\/[^\n]*\n\s*)*if \(!routeEnd\) return;/.test(srcFn('updateRouteEnd')));
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
// --- THE SCURRY: a heart strike makes the beast slip OFF THE BLADE (the worker gets room) ---
(function () {
  // A clean fight, run for real: the beast up, the worker up-hill of it, the heart taken.
  H.clearNightBoss();
  H.resetNight();
  H.spawnNightBoss();
  H.startBossFight();
  const b = H.getBoss();
  for (let i = 0; i < 400 && b.riseT > 0; i++) H.updateNightBoss(b, 1 / 60);
  p.wx = b.wx + 2.4; p.wy = b.wy; p.facing = Math.PI; p.stunT = 0; p.nightHitT = 0; // he stands UP-hill of it, facing down at the beast
  b.invulnT = 0; b.heartState = 'open'; b.heartOpen = 1; b.heartT = 99;
  const wx0 = p.wx, wy0 = p.wy, bx0 = b.wx;
  const d0 = Math.hypot(b.wx - p.wx, b.wy - p.wy);
  H.bossShovelHit(false); // the heart is taken: a wound, not the kill
  b.fireT = 99; b.whipT = 99; b.invulnT = 0; // ...and the beat is measured clean, with no fire
  check('the wound arms the SCURRY: recoil on the beast, the lash cut off, the shell slammed shut',
    b.recoilT > 0 && b.hp === BOSS_MAX_HP - BOSS_DMG && b.whipState === 'idle' && b.heartState === 'shut',
    'recoilT=' + b.recoilT.toFixed(3) + ' hp=' + b.hp);
  check('it flees AWAY from the worker (he stands up-hill of it, so it runs down at its graves)',
    b.recoilDir === -1 && b.wx - bx0 < 0.0001);
  const guardMax = Math.ceil((b.recoilT + 0.05) / (1 / 60));
  for (let i = 0; i < guardMax; i++) H.updateNightBoss(b, 1 / 60);
  const ran = bx0 - b.wx;
  const d1 = Math.hypot(b.wx - p.wx, b.wy - p.wy);
  const surc = srcFn('updateNightBoss');
  const s0 = surc.indexOf('const scurrying = b.recoilT > 0;');
  const s1 = surc.indexOf('if (furious && !scurrying)');
  check('the SCURRY CODE WRITES THE BEAST ONLY — not one worker position is touched (it gives ground, it takes none)',
    s0 > 0 && s1 > s0 && !/p\.(wx|wy)\s*=[^=]/.test(surc.slice(s0, s1)));
  check('it runs the ground off the blade (at least NK_SCURRY_MIN of it, easing out)',
    b.recoilT === 0 && ran >= NK_SCURRY_MIN - 0.25 && ran <= NK_SCURRY_SP * (NK_SCURRY_T + 0.2),
    'ran=' + ran.toFixed(2) + 'u');
  check('THE WORKER KEEPS THE ROOM: the gap between them opened by more than the scurry ran',
    d1 > d0 + 3, 'd ' + d0.toFixed(2) + ' -> ' + d1.toFixed(2));
  check('...and the scurry never puts him through a fence: he stands the ring he stood (floor, iron, lane)',
    p.wx >= H.workerEndLimitX() + 2 - 1e-9 && p.wx <= H.ceilX() && p.wy >= -9.4 && p.wy <= 5,
    'p=' + p.wx.toFixed(2) + ',' + p.wy.toFixed(2) +
      ' ring=' + (H.workerEndLimitX() + 2).toFixed(1) + '..' + H.ceilX().toFixed(1));
  check('...and the run stays INSIDE the ring: over the grave fence floor, under the ghost iron, on its lane',
    b.wx >= NIGHT_GRAVE_X - 6 - 1e-9 && b.wx <= NK_SEAL_X - 2 + 1e-9 &&
      b.wy >= -7.4 - 1e-9 && b.wy <= 6.2 + 1e-9,
    'wx=' + b.wx.toFixed(1) + ' wy=' + b.wy.toFixed(1));
  check('while it scurries it does NOT close on him: the furious run is suspended for the beat',
    srcFn('updateNightBoss').includes('if (furious && !scurrying)'));
  H.clearNightBoss();
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
    srcFn('updatePlayer').includes('p.wx > workerCeilX()'));
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
check('the drive-off leaves the way the RIG ROLLS: by day the cinematic follows routeDir, MIDNIGHT DRIVES UP — nose-forward, up-hill on driveDir 1 — and the off-screen check rides the SAME direction (the day stays put)',
  srcFn('updateRouteEnd').includes('isNightShift() ? 1 : RT') &&
    srcFn('updateRouteEnd').includes('truck.wx += RE_DRIVE_SP * driveDir * dt') &&
    srcFn('updateRouteEnd').includes('sx * driveDir > halfW + 1.0'));
check('the shift is NAMED LIKE EVERY SHIFT AND REPORTED THAT WAY: "MIDNIGHT" over "DEAD END" on the card, the banner and the report — no Bed-Stuy, no cemetery caption on the night',
  html.includes('day: "MIDNIGHT",') &&
    html.includes('place: "DEAD END",') &&
    !html.includes('name: "MIDNIGHT * DEAD END"') &&
    /function levelName\(d\)/.test(html) &&
    /function levelLoc\(d\)/.test(html) &&
    srcFn('levelName').includes('d.name ? d.name : d.day') &&
    srcFn('showDayIntro').includes('$("day-intro-day").textContent = levelName(d);') &&
    srcFn('showDayIntro').includes('$("day-intro-loc").textContent = d.night') &&
    srcFn('showDayIntro').includes('levelLoc(d) + " \\u00b7 " + WEATHERS[weather].label') &&
    srcFn('resetWorldState').includes('levelName(_d)') &&
    srcFn('resetWorldState').includes('" \\u00b7 " + levelLoc(_d)') &&
    srcFn('showDayStats').includes('d.night') &&
    srcFn('showDayStats').includes('levelName(d) + " \\u00b7 " + levelLoc(d)') &&
    srcFn('showDayStats').includes('"SHIFT REPORT \\u2014 " + levelLoc(d)') &&
    html.includes('DEAD END STREET. WHO YOU GONNA CALL?') &&
    html.includes('WAS STOLEN FROM THE SIDE BIN'));
check('THE WEEKDAY CARDS AND BANNERS KEEP THEIR FULL STREET NAMES (DEAD END is the night\u2019s own place line)',
  srcFn('showDayIntro').includes('d.borough + " \\u00b7 " + d.area + " \\u00b7 " + WEATHERS[weather].label') &&
    srcFn('resetWorldState').includes('" \\u00b7 " + levelLoc(_d)') &&
    srcFn('levelLoc').includes('d.borough + " / " + (d.area || "")') &&
    srcFn('showDayStats').includes('levelName(d) + " \\u00b7 " + d.borough') &&
    srcFn('showDayStats').includes('"SHIFT REPORT \\u2014 " + d.borough + " / " + d.area'));
check('THE NIGHT TITLE STILL FITS THE PHONE CARD (it scales down and may break lines)',
  /#day-intro\.night \.day \{[^}]*font-size: clamp\(23px, 6\.2vw, 58px\)/.test(html) &&
    /#day-intro\.night \.day \{[^}]*max-width: 94vw/.test(html) &&
    /#day-intro\.night \.day \{[^}]*overflow-wrap: anywhere/.test(html));
check('THE NIGHT CARD IS ONE SENTENCE — the briefing is the heist hook and NOTHING else, so it sits on top of the BEGIN button inside a fixed-height panel, and the street signs itself on the banner (the day\'s warning), never in the forecast slot',
  (() => {
    const m = html.match(/obj\.innerHTML = d\.night\s*\?\s*"([^"]+)"/);
    const t = m ? m[1] : '';
    return t.length > 0 && t.length <= 340 &&
      !/<br\s*\/>/.test(t) &&
      t.includes('YOUR <b>RUBY-PLATED GARGOYLE</b> WAS STOLEN FROM THE SIDE BIN') &&
      t.includes('THAT\'S WORTH <b>$50,000</b> ON EBAY! GET IT BACK!') &&
      !/SHOVEL OUT/.test(t) &&
      !/TOUCHING THE SLUG DEMON HURTS/.test(t) &&
      !/IT NEVER SHOVES YOU/.test(t) &&
      !/IT GLOWS/.test(t) &&
      !/DEAD END/.test(t) &&
      (html.match(/const LEVEL_DAYS = \[[\s\S]*?\n      \];/) || [''])[0]
        .includes('warning: "DEAD END STREET. WHO YOU GONNA CALL?"') &&
      !/THE BEAST SLEEPS IN THE CEMETERY/.test(html) &&
      !/Dead end street\. Who you gonna call/.test(srcFn('showDayIntro'));
  })(),
  'night objective=' + (((html.match(/obj\.innerHTML = d\.night\s*\?\s*"([^"]+)"/) || [])[1] || '').length) + ' chars');
check('EVERY MODAL CAN SCROLL TO ITS OWN BUTTON (the overlay scrolls; the panel centers by auto margin, so a tall card never eats its control)',
  /\.modal\s*\{[^}]*overflow-y:\s*auto/.test(html) &&
    /\.panel\s*\{[^}]*margin:\s*auto/.test(html));
check('THE SPEECH IS OFF ON THE NIGHT BY THE CONSTANTS (NIGHT_SPEECH_BANNED with an empty allow-list: NOTHING is said)',
  NIGHT_SPEECH_BANNED === true && Array.isArray(NIGHT_SPEECH_ALLOW) && NIGHT_SPEECH_ALLOW.length === 0 &&
    /const NIGHT_SPEECH_BANNED = true;/.test(html) && /const NIGHT_SPEECH_ALLOW = \[\];/.test(html) &&
    NIGHT_BUBBLE_GAP >= 2.0 && NIGHT_SAY_GAP >= 4.0);
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
    "truckTargetGap", "truckBackGap", "rigMayFollow", "isNightShift", "truckFenceFloorX",
    srcFn("updateTruck") + "\n;return updateTruck;",
  )(
    p, truck, 'none', () => dir, () => 0, 8.5, 1.3,
    gates.canBackUp, 0.3, () => {}, () => {}, gapFn, backFn, gates.rigMayFollow,
    () => night, () => (night ? 80 + 4.0 : null),
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
      "truckTargetGap", "truckBackGap", "rigMayFollow", "isNightShift", "truckFenceFloorX",
      srcFn("updateTruck") + "\n;return updateTruck;",
    )(p, truck, "none", () => -1, () => 0, 8.5, 1.3, gates0.canBackUp, 0.3, () => {}, () => {}, gapFn0, backFn0, gates0.rigMayFollow, () => true, () => NK_SEAL_X + NK_TRUCK_NOSE);
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
  let seedProof = '?';
  check("MIDNIGHT: the live spawner obeys it — every seed lands downhill of the worker, in front of the block's ward, and a block NEVER seeds past its own LOAD",
    (() => {
      p.wx = NIGHT_TOP;
      creatures.length = 0;
      allSpawned.length = 0;
      const vb = H.nightBands().filter((b) => b.x0 === 288)[0];
      const vBand = { x0: 288, x1: 368, i: vb.i, cx: vb.cx, flood: false };
      const load = H.gateLedger(vb).load;
      const wardLine = H.gateX(vb) + NIGHT_GATE_ROOM;
      let out = 0, down = 0, floored = 0;
      for (let i = 0; i < 60; i++) {
        const c = H.nightSpawnHorror("gremlin", vBand);
        if (!c) continue;
        out++;
        if (c.wx < p.wx) down++;
        if (c.wx >= wardLine - 1e-9) floored++;
      }
      seedProof = "seeds=" + out + "/" + load + " downhill=" + down + " aheadOfCurtain=" + floored +
        " ward@" + H.gateX(vb) + " worker " + p.wx;
      const done = out === load && down === out && floored === load && out < 60;
      creatures.length = 0;
      return done;
    })(),
    seedProof);
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
  check("THE 120-SECOND MARCH DOWN MIDNIGHT: not one spook is ever seeded UPSLOPE of the worker, every block he is held in is stocked with ITS OWN animals, and the ward keeps him on that block until its bill is paid",
    (() => {
      s7Reset();
      let bad = 0, seeds = 0, foreign = 0, stockedMin = 999, wardFrames = 0, cleared = 0;
      p.wx = NIGHT_TOP;
      for (let i = 0; i < 60 * 120; i++) {
        p.wx = Math.max(NIGHT_BOTTOM, p.wx - 3.1 / 60); // the march down toward the graves
        const front = wardClamp(); // the ward holds him at his block until its load is in
        if (front) wardFrames++;
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
          if (H.gateLeft(bNow) > 0) stockedMin = Math.min(stockedMin, own.length);
        }
        if (i % 90 === 0) { p.shovelCd = 0; p.shovelGuardT = 0; H.swing(); }
      }
      cleared = 4 - H.gateCount();
      marchProof = seeds + '/' + bad + '/' + foreign + '/' + stockedMin +
        ' wardsDown=' + cleared + ' held=' + wardFrames + '/7200';
      // A 120-second march is not enough SHOVEL WORK to empty a block (that is the point of
      // the ward): the run is judged on the fight staying alive at the wall, the seeds never
      // arriving at his back, no foreign families, and the ward holding him on his block.
      return bad === 0 && foreign === 0 && stockedMin >= 8 &&
        wardFrames > 6000 && cleared >= 0 && cleared <= 4;
    })(),
    marchProof);
  check("THE WARD IS THE WHOLE POINT OF THE MARCH: a block's curtain is down only when its own bill is in the hopper and none of its pack is left standing",
    (() => {
      const led = H.gateLedger(H.nightBands().filter((b) => b.x0 === 384)[0]);
      const live = H.gateLive(H.nightBands().filter((b) => b.x0 === 384)[0]);
      return led.open === false
        ? live > 0 || led.yield < led.load
        : led.yield >= led.load && live === 0;
    })(),
    "top block: open=" + H.gateLedger(H.nightBands().filter((b) => b.x0 === 384)[0]).open +
    " yield=" + H.gateLedger(H.nightBands().filter((b) => b.x0 === 384)[0]).yield +
    " live=" + H.gateLive(H.nightBands().filter((b) => b.x0 === 384)[0]));
  check("the source says it plainly: the haunt's spawn window, its cull line, its respawn and its refill bands all read the ROUTE AXIS, with the weekday expressions left exactly as shipped",
    srcFn("horrorAheadWindow").includes("if (routeDir() > 0) return { lo: Math.max(band.x0 + 5, p.wx + 7), hi: band.x1 - 5 }") &&
    srcFn("horrorAheadWindow").includes("return { lo: band.x0 + 5, hi: Math.min(band.x1 - 5, p.wx - 7) }") &&
    srcFn("horrorFellBehind").includes("wx > p.wx + NIGHT_CULL_BEHIND") &&
    srcFn("horrorRespawnX").includes("p.wx + RT * R(c.flood ? 12 : 28") &&
    srcFn("nightBands").includes("out[routeDir() > 0 ? out.length - 1 : 0].flood = true") &&
    srcFn("respawnHorror").includes("p.wx + R(c.flood ? 12 : 28, c.flood ? 40 : 52)"));
})();


console.log("\n[17] THE SPECTRAL BLOCK WARDS: one block, one horde, one wall — the street opens block by block");
(function () {
  s7Reset();
  const bands = H.nightBands();
  const bandOfX = (x) => bands.filter((b) => b.x0 === x)[0];
  const TOPB = bandOfX(384), VERMB = bandOfX(288), DIGB = bandOfX(192), GRAVEB = bandOfX(96);
  const baseOf = (b) => nightBlockFamilies(b).reduce((s, f) => s + nightBlockQuota(f, b), 0);
  const hordes = (b) => creatures.filter((c) => c.home && c.home.i === b.i && !c.hooked &&
    !c.hookLanded && HORROR_ALL[H.horrorKey(c)]);
  const wardMeshes = () => dynamicChildren.filter((o) => o.userData && o.userData.ward &&
    o.parent && o.visible !== false);

  check("the ward system is LIVE on the night shift and the shift lays FOUR curtains",
    H.gateOn() === true && Object.keys(H.gates()).length === 4 &&
    Object.keys(H.gates()).length === bands.length && H.gateCount() === bands.length &&
    wardMeshes().length === bands.length,
    "ledgers=" + Object.keys(H.gates()).length + "[" + Object.keys(H.gates()).join(',') + "]" +
    " meshes=" + wardMeshes().length + " bands=" + bands.length + " dyn=" + dynamicChildren.length);
  check("the block he clocks in on is stocked with its whole load, and nothing over",
    TOPB && hordes(TOPB).length >= H.gateLedger(TOPB).load - 4 &&
    hordes(TOPB).length <= H.gateLedger(TOPB).load &&
    H.gateRoom(TOPB) <= 4,
    "live=" + (TOPB ? hordes(TOPB).length : -1) + " load=" + (TOPB ? H.gateLedger(TOPB).load : -1) +
    " byFamily=" + nightBlockFamilies(TOPB).map((f) => f + '=' + creatures.filter((c) =>
      c.home && c.home.i === TOPB.i && H.horrorKey(c) === f).length).join(' ') +
    " allLive=" + H.nightHorrorLive() + " total=" + creatures.length);
  check("every ward starts UP — nobody walks past a block he has not emptied",
    bands.every((b) => H.gateLedger(b).open === false) &&
    wardMeshes().every((w) => w.visible !== false));
  check("each curtain stands at the LOW EDGE of its own block, and the graves' ward guards the beast's cross-street",
    H.gateX(TOPB) === 384 + NIGHT_GATE_INSET && H.gateX(VERMB) === 288 + NIGHT_GATE_INSET &&
    H.gateX(DIGB) === 192 + NIGHT_GATE_INSET &&
    H.gateX(GRAVEB) === NIGHT_BOSS_TRIGGER_X + 6 &&
    H.gateX(GRAVEB) > NIGHT_BOSS_TRIGGER_X,
    [384, 288, 192, 96].map((x) => H.gateX(bandOfX(x))).join("/"));
  check("THE SET NUMBER OF CREATURES PER BLOCK = that block's own pack table (flood table on the heavy end), AND THE GRAVES' BILL CAME DOWN to 20 — the last ward is a gate, not a 30-animal trench",
    bands.every((b) => H.gateLedger(b).load === baseOf(b)) &&
    H.gateLedger(GRAVEB).load === 20 &&
    [TOPB, VERMB, DIGB].every((b) => H.gateLedger(b).load >= 18),
    [384, 288, 192, 96].map((x) => H.gateLedger(bandOfX(x)).load).join("/"));
  check("THE GRAVES ARE NO LONGER THE HEAVIEST FIGHT ON THE STREET: the bottom block's bill sits AT OR BELOW every opening block's — the last fight is the beast, not a 30-animal trench — and the whole street still fits the roster cap",
    H.gateLedger(GRAVEB).load <= Math.min(H.gateLedger(TOPB).load, H.gateLedger(VERMB).load, H.gateLedger(DIGB).load) &&
    H.gateLedger(GRAVEB).load >= 7 &&
    bands.reduce((s, b) => s + H.gateLedger(b).load, 0) <= HORROR_ROSTER_CAP,
    "grave=" + H.gateLedger(GRAVEB).load + " others=" + [TOPB, VERMB, DIGB].map((b) => H.gateLedger(b).load).join("/") +
      " street=" + bands.reduce((s, b) => s + H.gateLedger(b).load, 0) + " cap=" + HORROR_ROSTER_CAP);
  check("the block's own animals never stand behind its curtain: every ward-bound spook is between the light and the worker",
    bands.every((b) => hordes(b).every((c) => c.wx >= H.gateX(b) + NIGHT_GATE_ROOM - 0.001)),
    "floors " + [384, 288, 192, 96].map((x) => H.gateFloorX(bandOfX(x))).join("/"));
  check("a block spook's WORK BOX stops AT THE CURTAIN (the band box's low edge is the ward, not the band edge)",
    bands.every((b) => Math.abs(H.gateBandXs(b).lo - (H.gateX(b) + NIGHT_GATE_WORK)) < 1e-9) &&
    H.gateBandXs(TOPB).lo > TOPB.x0 && H.gateBandXs(GRAVEB).lo > GRAVEB.x0);
  check("the ward he is walking INTO is the top block's curtain, and the HUD names it with its count",
    H.gateFront() && H.gateFront().x === H.gateX(TOPB) &&
    /^THE FOG GANG · \d+ LEFT$/.test(H.gateHud()) && !/WARD/.test(H.gateHud()) &&
    H.gateProgress().left === H.gateLedger(TOPB).load,
    H.gateHud());
  check("THE FILL BUDGET: not one family ever spawns with its block's load already spoken for",
    bands.every((b) => H.gateRoom(b) >= 0) &&
    bands.every((b) => hordes(b).length + H.gateLedger(b).yield <= H.gateLoad(b)));
})();


console.log("\n[18] THE WARD COMES DOWN: the block empties into the hopper, the light fades, the street opens");
(function () {
  s7Reset();
  const bands = H.nightBands();
  const bandOfX = (x) => bands.filter((b) => b.x0 === x)[0];
  const TOPB = bandOfX(384), VERMB = bandOfX(288), GRAVEB = bandOfX(96);
  const hordes = (b) => creatures.filter((c) => c.home && c.home.i === b.i && !c.hooked &&
    !c.hookLanded && HORROR_ALL[H.horrorKey(c)]);
  const wardOf = (b) => H.gateLedger(b).g;

  // (a) A BLOCK WITH ANIMALS ON IT NEVER OPENS, NO MATTER WHAT IS SHOVELED IN
  const load = H.gateLoad(TOPB);
  const liveTop = hordes(TOPB).length;
  for (let i = 0; i < load; i++) H.gateYield({ i: TOPB.i });
  announced.length = 0;
  H.gateCheck(0.016);
  check("its load alone does not drop a ward: while the block's own horde is standing, the curtain stays UP",
    H.gateLedger(TOPB).open === false && H.gateCount() === 4 &&
    liveTop > 0 && announced.length === 0,
    "live=" + liveTop + " yield=" + H.gateLedger(TOPB).yield + "/" + load);

  // (b) THE BLOCK IS CLEARED: its animals gone AND its load in the hopper -> the ward falls
  hordes(TOPB).slice().forEach((c) => { const k = creatures.indexOf(c); if (k >= 0) creatures.splice(k, 1); });
  H.gateCheck(0.016);
  const openedMsg = announced.filter((t) => /THE FOG GANG IS CLEAR/.test(t)).length;
  check("a cleared block drops its ward: the curtain is out, its load is in the hopper, the street announces it",
    H.gateLedger(TOPB).open === true && H.gateCount() === 3 && openedMsg === 1 &&
    H.gateLedger(TOPB).fade === NIGHT_GATE_FADE,
    announced.join(' | '));

  // (c) THE CURTAIN FADES OUT AND LIFTS OFF THE ASPHALT
  const w = wardOf(TOPB);
  const z0 = w.position.z, o0 = w.userData.ward.mats[0].opacity;
  for (let i = 0; i < Math.ceil((NIGHT_GATE_FADE + 0.1) * 60); i++) H.gateAnimate(1 / 60);
  check("the ward FADES — its light thins, it rises off the street, and it goes out for good",
    w.visible === false && w.position.z > z0 + 1.0 &&
    w.userData.ward.mats[0].opacity < o0 * 0.05 &&
    Math.abs(w.position.z - z0 - NIGHT_GATE_LIFT * NIGHT_GATE_FADE) < 0.06,
    'dz=' + (w.position.z - z0).toFixed(2) + ' op=' + w.userData.ward.mats[0].opacity.toFixed(3));

  // (d) A CLEARED BLOCK IS NEVER FED AGAIN (the fill budget is spent)
  const beforeTop = creatures.length;
  const sp = H.nightSpawnHorror('specter', TOPB, 'specter');
  check("a block whose load is in the hopper stays EMPTY: the haunt never seeds it again",
    sp === null && H.gateRoom(TOPB) === 0 && creatures.length === beforeTop &&
    hordes(TOPB).length === 0);

  // (e) THE NEXT BLOCK'S WARD IS NOW THE WALL IN FRONT OF HIM
  p.wx = 380;
  check("the ward in front of him moves down the street with him: the Fog Gang's curtain is down, the Vermin's is UP",
    H.gateFront() && H.gateFront().x === H.gateX(VERMB) &&
    /^THE VERMIN · \d+ LEFT$/.test(H.gateHud()),
    (H.gateFront() || { x: -1 }).x + ' hud=' + H.gateHud());

  // (f) THE SURGE LOADS THE HEAVY END ONLY (and the whole bill stops at the CAP)
  H.setSurgeTier(HORROR_SURGE_LOAD_TIERS + 3);
  (() => {
    const graveF = H.gateSurge(bandOfX(96));
    const topS = H.gateSurge(bandOfX(384));
    const vermS = H.gateSurge(bandOfX(288));
    const digS = H.gateSurge(bandOfX(192));
    const graveL = H.gateLoad(bandOfX(96));
    const loads = [96, 192, 288, 384].map((x) => H.gateLoad(bandOfX(x)));
    check("each abyss surge adds HORROR_SURGE_LOAD to the flood block's bill, stacking stops at " + HORROR_SURGE_LOAD_TIERS + " surges, and NO BLOCK'S BILL EVER PASSES " + HORROR_BLOCK_CREATURE_MAX + " creatures: the grave ward tops out at EXACTLY the cap, every other block pays 0",
      graveF === HORROR_BLOCK_CREATURE_MAX - 20 &&
      topS === 0 && vermS === 0 && digS === 0 &&
      graveL === HORROR_BLOCK_CREATURE_MAX &&
      loads.every((v) => v <= HORROR_BLOCK_CREATURE_MAX),
      "flood=" + graveL + " top=" + loads[3]);
  })();
  H.setSurgeTier(0);
})();


console.log("\n[19] THE WARD IS A WALL: the worker is held at the light, the graves stay shut, weekdays never see it");
(function () {
  s7Reset();
  const bands = H.nightBands();
  const bandOfX = (x) => bands.filter((b) => b.x0 === x)[0];
  const TOPB = bandOfX(384), VERMB = bandOfX(288), GRAVEB = bandOfX(96);
  const hordes = (b) => creatures.filter((c) => c.home && c.home.i === b.i && !c.hooked &&
    !c.hookLanded && HORROR_ALL[H.horrorKey(c)]);

  // (g) THE WORKER'S CLAMP AT A CLOSED CURTAIN (the real updatePlayer snippet, in a harness)
  const clampStart = html.indexOf('// === THE SPECTRAL WARD (Midnight)');
  const Trig = html.indexOf("if (RT < 0 && state === \"play\" && !bossFightOn && !nightBossBanished && p.wx <= NIGHT_BOSS_TRIGGER_X)");
  // The extraction is the WARD clamp only — it ends at the slug's solid-gut step-cancel, which
  // is the beast's own law (it runs on the boss, not on a ward) and belongs to no ward harness.
  const GutStart = html.indexOf("// === THE SLUG DEMON'S GUT IS A SOLID WALL");
  const clampSrc = html.slice(clampStart, Math.min(GutStart < 0 ? Trig : GutStart, Trig));
  const runClamp = new Function('isNightShift', 'NIGHT_BLOCK_GATES', 'state', 'bossFightOn', 'dt', 'p',
    'nightGateFrontLedger', 'nightGateWall', 'NIGHT_GATE_REACH', 'NIGHT_GATE_STOP', 'pick', 'NIGHT_GATE_LINES',
    'nightGateSay', 'spawnEctoBurst', clampSrc);
  const sayLog = [];
  p.wx = 289.2; p.gateT = 0; p.shake = 0;
  runClamp(() => true, true, 'play', false, 1 / 60, p, () => ({ x: 290 }), () => ({ x: 290 }),
    NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], (l) => sayLog.push(l), () => {});
  check("a closed ward is a SOLID WALL: his centre stops a body-width off the light, he says it, the world shudders",
    clampStart > 0 && Math.abs(p.wx - (290 + NIGHT_GATE_STOP)) < 1e-9 && sayLog.length === 1 &&
    p.shake >= 0.4 && p.gateT > 0 && /THE SPECTRAL WARD/.test(clampSrc),
    'wx=' + p.wx.toFixed(3) + ' say=' + sayLog.join('/'));
  p.wx = 300; p.gateT = 5;
  runClamp(() => true, true, 'play', false, 1 / 60, p, () => ({ x: 290 }), () => ({ x: 290 }),
    NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], () => {}, () => {});
  check("a ward only bites AT the curtain: working his own block is untouched, no line fires far from the light",
    p.wx === 300 && sayLog.length === 1);
  p.wx = 281.0; p.gateT = 5;
  runClamp(() => true, true, 'play', false, 1 / 60, p, () => null, () => null,
    NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], () => {}, () => {});
  check("when the ward is down there is NO wall: he walks through the light's line into the next block",
    p.wx === 281.0 && sayLog.length === 1);
  check("THE WARD CLAMP RUNS BEFORE THE GRAVES' TRIGGER: an unemptied block can never wake the beast",
    clampStart > 0 && Trig > clampStart && html.lastIndexOf('function updatePlayer', clampStart) < clampStart);
  check("the flood ward stands a full cross-street above the trigger, so the Grave Watch is fought before the beast",
    H.gateX(GRAVEB) - NIGHT_BOSS_TRIGGER_X === 6 && H.gateClosed(GRAVEB) === true &&
    (() => {
      p.wx = H.gateX(GRAVEB) - 0.1; // he walks DOWN THROUGH the curtain's line
      p.gateT = 5;
      runClamp(() => true, true, 'play', false, 1 / 60, p, () => ({ x: H.gateX(GRAVEB) }), () => ({ x: H.gateX(GRAVEB) }),
        NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], () => {}, () => {});
      return p.wx === H.gateX(GRAVEB) + NIGHT_GATE_STOP && p.wx > NIGHT_BOSS_TRIGGER_X;
    })(),
    'ward=' + H.gateX(GRAVEB) + ' trigger=' + NIGHT_BOSS_TRIGGER_X + ' held=' + p.wx.toFixed(2));

  // (h) THE STREET OPENS IN ORDER, BLOCK BY BLOCK, top to graves
  const order = [];
  p.wx = NIGHT_START_X; // he starts the sweep at the top of the street, like clock-in
  for (let guard = 0; guard < 40; guard++) {
    const front = H.gateFront();
    if (!front) break;
    const b = bands.filter((x) => x.i === front.i)[0];
    hordes(b).slice().forEach((c) => { const k = creatures.indexOf(c); if (k >= 0) creatures.splice(k, 1); });
    const led = H.gateLedger(b);
    let fill = 0;
    while (led.yield < H.gateLoad(b) && fill++ < 200) H.gateYield({ i: b.i });
    H.gateCheck(0.016);
    order.push(b.x0 + ':' + (led.open ? 'open' : 'shut'));
    p.wx = led.x - 6; // he walks through the fallen light into the next block
  }
  check("the whole street opens BLOCK BY BLOCK from the block he clocked in on down to the graves",
    order.length === 4 && order.join(' ') === '384:open 288:open 192:open 96:open' &&
    H.gateCount() === 0 && /THE GRAVES · 0 LEFT/.test(H.gateHud()),
    order.join(' '));

  // (i) WEEKDAYS: no ward logic runs at all — no ledger, no front wall, no curtain, and
  //     the block box is the shipped band + slack (the old street, byte for byte)
  const nightWas = nightOn;
  nightOn = false;
  const dayBands = H.nightBands();
  check("the seven weekdays never see a ward: no ledger, no curtain, no front wall, no HUD line, and the band box is the shipped band + slack",
    H.gateOn() === false && H.gateLedger(dayBands[0]) === null && H.gateFront() === null &&
    H.gateHud() === '' && H.gateLive(dayBands[0]) === 0 &&
    H.gateRoom(dayBands[0]) === 0 &&
    dayBands.every((b) => Math.abs(H.gateBandXs(b).lo - (b.x0 - NIGHT_PACK_SLACK)) < 1e-9));
  nightOn = nightWas;

  // (j) THE WARDS RESET WITH THE SHIFT
  s7Reset();
  check("a fresh shift re-lays the street with all FOUR wards UP and nothing stale left in the world",
    H.gateCount() === 4 && Object.keys(H.gates()).length === 4 &&
    dynamicChildren.filter((o) => o.userData && o.userData.ward && o.visible !== false).length === 4);
})();

console.log("\n[20] THE WARD LETS GO: pinned at the light, never trapped — press away and he walks");
(function () {
  s7Reset();
  const bands = H.nightBands();
  const bandOfX = (x) => bands.filter((b) => b.x0 === x)[0];
  const TOPB = bandOfX(384), VERMB = bandOfX(288);
  const WARDX = H.gateX(VERMB);                 // 290 — the Vermin curtain
  const LINE = WARDX + NIGHT_GATE_STOP;         // his centre's line: fire threshold AND snap value
  const says = [];
  const atWard = () => ({ x: WARDX, i: VERMB.i });

  // the REAL clamp, extracted from updatePlayer (v1.0.491: fire on crossing, snap ON the line)
  const w0 = html.indexOf('// === THE SPECTRAL WARD (Midnight)');
  const w1 = html.indexOf('if (RT < 0 && state === "play" && !bossFightOn && !nightBossBanished && p.wx <= NIGHT_BOSS_TRIGGER_X)');
  // The ward clamp ends where the slug's solid-gut step-cancel begins: that block is the beast's
  // law (it reads the boss), and it belongs to no ward harness.
  const wGut = html.indexOf("// === THE SLUG DEMON'S GUT IS A SOLID WALL");
  const wardSrc = html.slice(w0, wGut < 0 ? w1 : Math.min(wGut, w1));
  const wall = new Function('isNightShift', 'NIGHT_BLOCK_GATES', 'state', 'bossFightOn', 'dt', 'p',
    'nightGateFrontLedger', 'nightGateWall', 'NIGHT_GATE_REACH', 'NIGHT_GATE_STOP', 'pick', 'NIGHT_GATE_LINES',
    'nightGateSay', 'spawnEctoBurst', wardSrc);
  const frame = (getFront) => wall(() => true, true, 'play', false, 1 / 60, p, getFront, getFront,
    NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], (l) => says.push(l), () => {});
  const walk = (dx, dy, n, getFront) => {
    for (let k = 0; k < n; k++) { p.wx += dx; p.wy += dy; frame(getFront); }
  };

  // (a) THE WALL: crossing the line catches him and holds him exactly on it
  p.wx = WARDX + 1.5; p.wy = 3; p.gateT = 0; p.shake = 0; says.length = 0;
  walk(-1.6, 0, 1, atWard);
  check("[20a] the curtain catches him the FIRST frame his centre crosses its line — a body-width off the light",
    p.wx === LINE, 'wx=' + p.wx.toFixed(4) + ' line=' + LINE.toFixed(4));
  const pinned = p.wx;
  walk(-0.7, 0, 90, atWard); // holding the stick INTO the wall for 1.5s
  check("[20a] holding the stick into the ward is a STABLE dead stop: zero drift over 90 frames",
    p.wx === pinned, 'wx=' + p.wx.toFixed(6) + ' pin=' + pinned.toFixed(6));
  check("[20a] and he only talks about it once per ~2s (no line spam from a pinned worker)",
    says.length === 1, says.length + " lines");

  // (b) THE SLIDE: sideways is free — the axis the wall owns is the only one it touches
  p.wy = 3;
  walk(0, 0.5, 20, atWard);
  check("[20b] he SLIDES along the wall: 20 side steps move his cross-street axis and never yank his centre",
    p.wx === pinned && Math.abs(p.wy - 13) < 1e-9, 'wx=' + p.wx.toFixed(4) + ' wy=' + p.wy.toFixed(2));

  // (c) THE ESCAPE — the reported bug: pressing AWAY must free him instantly
  p.gateT = 0;
  walk(0.6, 0, 1, atWard);
  check("[20c] THE WALL LETS GO: one push uphill and he is OFF the line on the very next frame",
    p.wx > pinned, 'wx=' + p.wx.toFixed(4) + ' pin=' + pinned.toFixed(4));
  const free0 = p.wx;
  walk(0.6, 0, 80, atWard); // keep walking up the street, away from the curtain
  check("[20c] walking away from a closed ward is FREE travel: 80 frames move him the full 48 units, the clamp never re-bites",
    Math.abs(p.wx - (free0 + 48)) < 1e-9, 'wx=' + p.wx.toFixed(3) + ' from=' + free0.toFixed(3));
  // (d) THE WALL IS BUILT THE SAFE WAY: it catches the CROSSING (so no speed can tunnel
  //     it), it snaps ON the line, and it has no snap pocket (a window above the snap
  //     point) and no long tail (the old 4-unit strip behind the light that yanked him).
  check("THE CLAMP CATCHES THE CROSSING: it looks the wall up on the SEGMENT his center travelled this frame (nightGateWall(previous center, new center)), so no walk, sprint, dash, knockback or throw can go through a closed ward",
    /nightGateWall\(p\.gatePrev == null \? p\.wx : p\.gatePrev, p\.wx\)/.test(wardSrc) &&
    /const wardStop = ward\.x \+ NIGHT_GATE_STOP;/.test(wardSrc) &&
    /if \(p\.wx < wardStop\)/.test(wardSrc) &&
    /p\.gatePrev = p\.wx;/.test(wardSrc),
    wardSrc.replace(/\s+/g, ' ').slice(wardSrc.indexOf('const ward ='), wardSrc.indexOf('const ward =') + 132));
  check("THE CLAMP HAS NO SNAP POCKET AND NO LONG TAIL (the two ways a wall traps a worker: a window wider than its snap pins him inside it; a tail across the block teleports him)",
    wardSrc.indexOf('p.wx > ward.x + ') < 0 && wardSrc.indexOf('ward.x - 4') < 0 &&
    /p\.wx = wardStop;/.test(wardSrc) && wardSrc.indexOf('if (p.wx < wardStop) {') >= 0 &&
    wardSrc.indexOf('NIGHT_GATE_REACH') < 0,
    'pocket=' + (wardSrc.indexOf('p.wx > ward.x + ') >= 0) + ' tail=' + (wardSrc.indexOf('ward.x - 4') >= 0));
  check("THE WALL LIVES INSIDE THE WARD GUARD, so an open street (no front curtain) can never throw: 300 frames with a null ward, no exception, no move",
    (() => {
      p.wx = 300; p.gateT = 0;
      try { for (let k = 0; k < 300; k++) frame(() => null); } catch (e) { return 'throws: ' + e.message; }
      return p.wx === 300;
    })(),
    'wx=' + p.wx.toFixed(3));

  // (e) NO SPEED TUNNELS THE CURTAIN, and the wall never yanks a worker across the block:
  //     every stride that ends below the line is caught ON the line, and standing deep in
  //     the block below (only reachable after the ward fell) leaves him exactly where he is.
  const tunnel = (step) => {
    p.wx = WARDX + 6; p.gateT = 0; p.gatePrev = WARDX + 6; p.gatePrevWard = VERMB.i;
    for (let k = 0; k < 80; k++) { p.wx -= step; frame(atWard); }
    return p.wx; // the stride that crossed the line must have stopped ON the line
  };
  const caught = [0.18, 0.34, 0.6, 1.2, 3.0, 9.0, 30].map((s) => Math.abs(tunnel(s) - LINE) < 1e-9);
  check("NOT ONE STRIDE TUNNELS THE WARD: walking (0.18), sprinting (0.34), a frame at top speed (0.6), a dash (1.2), a shove (3.0), a knockback (9.0) and a 30-unit throw all stop ON the light line",
    caught.every(Boolean), caught.map((c, i) => [0.18, 0.34, 0.6, 1.2, 3.0, 9.0, 30][i] + '=' + (c ? 'caught' : 'TUNNELED')).join(' '));
  const realWall = (a, b) => H.gateWall(a, b); // the game's own segment lookup
  p.wx = WARDX - 4; p.gateT = 0; p.gatePrev = WARDX - 4; // placed deep, history deep: never crossed
  frame(realWall);
  check("[20e] the wall is a WALL, not a tow rope: a center deep in the block below a closed curtain (that did not cross it this frame) is left exactly where it stands — no cross-block yank",
    p.wx === WARDX - 4, 'wx=' + p.wx.toFixed(4));
  p.wx = WARDX - 4; p.gateT = 0; p.gatePrev = WARDX + 1; // a throw from above the line, through the curtain
  frame(realWall);
  check("the crossing test is what owns the ward: a throw that PASSES the curtain's line is pulled back onto it — nobody rides through a closed ward",
    p.wx === LINE, 'wx=' + p.wx.toFixed(4));
  p.wx = WARDX - 0.3; p.gateT = 0; p.gatePrev = null; p.gatePrevWard = -99;
  frame(atWard);
  check("[20e] the near side of the light is his limit: a center inside the curtain's strip is put back on the line, a body-width off the light",
    p.wx === LINE, 'wx=' + p.wx.toFixed(4) + ' line=' + LINE.toFixed(4));
  p.gateT = 0; p.gatePrev = LINE; p.gatePrevWard = VERMB.i;
  walk(0.6, 0, 2, atWard);
  check("[20e] and from the line he is free to walk back up the street (the ward is a wall, not a cage)",
    p.wx > LINE, 'wx=' + p.wx.toFixed(4));

  // (f) EVERY CURTAIN IS A WALL HE CAN LEAVE, tested where the game puts him: standing on
  //     the block ABOVE the curtain. For each of the FOUR wards: the wards above him are
  //     down (so he is standing on this block), he marches down onto the curtain (the wall
  //     catches him), pushes uphill (he frees himself), presses back in (same line).
  const topFirst = bands.slice().sort((a, b) => b.x0 - a.x0);
  const atCurtain = (band) => {
    s7Reset();
    for (const b of topFirst) { // open every curtain ABOVE the one under test
      if (b.i === band.i) break;
      const led = H.gateLedger(b);
      led.open = true; led.fade = 1;
    }
    const line = H.gateX(band) + NIGHT_GATE_STOP;
    p.wx = H.gateX(band) + 1.6; p.wy = 4; p.gateT = 0; says.length = 0;
    p.gatePrev = p.wx; p.gatePrevWard = band.i; // the frame the shift started him on this block
    let caught = false;
    for (let j = 0; j < 12 && !caught; j++) { // march DOWN onto the curtain
      p.wx -= 0.6;
      frame(realWall);
      if (Math.abs(p.wx - line) < 1e-9) caught = true;
    }
    if (!caught) return null;
    const pin = p.wx;
    for (let j = 0; j < 12; j++) { p.wx += 0.6; frame(realWall); } // push AWAY
    const away = p.wx - pin;
    for (let j = 0; j < 24; j++) { p.wx -= 0.6; frame(realWall); } // press BACK in
    return { away, back: Math.abs(p.wx - pin), line, pin };
  };
  const runs = topFirst.map((b) => ({ x: H.gateX(b), r: atCurtain(b) }));
  check("ALL FOUR CURTAINS stand on their block's low edge, catch him on their line, and SET HIM FREE the moment he pushes uphill: 12 frames away = the FULL 7.2 units (the reported trap: pinned, only sideways left)",
    runs.length === 4 && runs.every((o) => o.r && Math.abs(o.r.away - 7.2) < 1e-9),
    runs.map((o) => "ward " + o.x + " -> " + (o.r ? "escape " + o.r.away.toFixed(2) : "never caught")).join('; '));
  check("and pressing back into a curtain returns him to the EXACT same line every block: a stable wall, no teleport, no drift",
    runs.every((o) => o.r && o.r.back < 1e-9),
    runs.map((o) => (o.r ? o.r.back.toFixed(6) : 'n/a')).join('/'));
  check("no ward fell for walking: at every block he probed, the curtain was still UP when he left it",
    runs.every((o) => o.r !== null));
  s7Reset();

  // (f2) WITH THE WARDS DOWN, the same march is pure free travel — the walls live only in
  //      the closed ledgers, so the cleared street can be run end to end.
  bands.forEach((b) => { const led = H.gateLedger(b); led.open = true; led.fade = 1; });
  p.wx = 400; p.gateT = 0; says.length = 0;
  for (let k = 0; k < 300; k++) { p.wx -= 0.6; frame(realWall); }
  check("an opened street runs END TO END at full stride: 300 frames of walking down = 180 units, no wall, no line",
    H.gateFront() === null && Math.abs(p.wx - (400 - 180)) < 1e-9 && says.length === 0,
    'wx=' + p.wx.toFixed(3) + ' front=' + (H.gateFront() ? H.gateFront().x : 'none') + ' says=' + says.length);
  s7Reset();

  // (g) WEEKDAYS: the clamp is inert, the street stays the old street
  const nightWas = nightOn;
  nightOn = false;
  p.wx = 300; p.gateT = 0; says.length = 0;
  const frameDay = () => wall(() => nightOn, true, 'play', false, 1 / 60, p, atWard, atWard,
    NIGHT_GATE_REACH, NIGHT_GATE_STOP, (a) => a[0], ['WARD'], (l) => says.push(l), () => {});
  for (let k = 0; k < 60; k++) { p.wx -= 0.6; frameDay(); }
  check("no weekday is walled: 60 frames walking straight THROUGH every curtain's line move him the full 36 units and the clamp never fires",
    Math.abs(p.wx - 264) < 1e-9 && says.length === 0, 'wx=' + p.wx.toFixed(3) + ' says=' + says.length);
  nightOn = nightWas;

})();

console.log("\n[21] THE GHOULS TAKE A BEATING: per-type toughness, a street that hardens block by block, and the back-off");
(function () {
  s7Reset();
  const bands = H.nightBands();
  const bandOfX = (x) => bands.filter((b) => b.x0 === x)[0];
  const TOPB = bandOfX(384), VERMB = bandOfX(288), DIGB = bandOfX(192), GRAVEB = bandOfX(96);
  const fams = (b) => nightBlockFamilies(b);
  // A FRESH SPOOK ON A BLOCK, ARMED BY THE GAME'S OWN SPAWNER. The ward gives a block ONE
  // set load and s7Reset walks the street in with that load ALREADY STANDING, so the spawner
  // (rightly) refuses to add one more. A fight test clears its block first — the block's
  // animals off the roster, its ledger back to zero — and lets the shipped nightSpawnHorror
  // arm the thing for real: family pool, ward budget and the block-exclusivity gate included.
  function freeBlock(band) {
    for (let i = creatures.length - 1; i >= 0; i--) {
      const c = creatures[i];
      if (c && c.home && c.home.i === band.i) creatures.splice(i, 1);
    }
    const led = H.gateLedger(band);
    if (led) led.yield = 0;
  }
  function spookOn(type, band) {
    freeBlock(band);
    const c = H.nightSpawnHorror(type, { x0: band.x0, x1: band.x1, i: band.i });
    if (c) { c.huntT = 0; c.flinchT = 0; c.backoffT = 0; c.touchCd = 0; }
    return c;
  }
  // THE FAMILY THE BLOCK FIGHTS HARDEST (a probe must ride a pool with ROOM under the cap).
  const hardestFam = (b) => fams(b).reduce((a, f) => (H.ghHits(b, f) > H.ghHits(b, a) ? f : a), fams(b)[0]);
  let probeLog = '';

  // (a) the toughness table
  check('NO SHOVELED THING ON THIS STREET DIES IN A RUSH: every family takes at least ' + GHOUL_HITS_MIN +
    ' blows, the vermin ' + GHOUL_HITS_MIN + ', the grave watch 5+, the reaper ' + GHOUL_HITS.reaper,
    Object.keys(GHOUL_HITS).every((k) => GHOUL_HITS[k] >= GHOUL_HITS_MIN) &&
    Object.keys(HORROR_ALL).every((k) => GHOUL_HITS[k] >= GHOUL_HITS_MIN) &&
    Object.keys(NIGHT_EXTRA_HITS).every((k) => NIGHT_EXTRA_HITS[k] >= 2) &&
    GHOUL_HITS.imp === GHOUL_HITS_MIN && GHOUL_HITS.ghoul === 4 && GHOUL_HITS.reaper === 7 &&
    GHOUL_HITS.goulra >= 5 && GHOUL_HITS_MIN >= 3);
  check('THE FLOOR AND THE CEILING BOTH HOLD on every block, every family, the tentacles and the grave furniture included',
    (() => {
      let lo = 99, hi = 0, seen = 0;
      for (let b = 0; b < bands.length; b++) {
        const fam = fams(bands[b]).concat(Object.keys(NIGHT_EXTRA_HITS));
        for (let f = 0; f < fam.length; f++) {
          const v = H.ghHits(bands[b], fam[f]);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          seen++;
        }
      }
      return lo >= GHOUL_HITS_MIN && hi <= GHOUL_HITS_MAX && seen > 20;
    })(), 'range ' + (function () { let lo = 99, hi = 0; for (let b = 0; b < bands.length; b++) { const fam = fams(bands[b]).concat(Object.keys(NIGHT_EXTRA_HITS)); for (let f = 0; f < fam.length; f++) { const v = H.ghHits(bands[b], fam[f]); if (v < lo) lo = v; if (v > hi) hi = v; } } return lo + '..' + hi; })() + ' over ' + (function () { let n = 0; for (let b = 0; b < bands.length; b++) n += fams(bands[b]).length + Object.keys(NIGHT_EXTRA_HITS).length; return n; })() + ' block-family pools');
  check("DIFFERENT TYPES ON THE SAME BLOCK take DIFFERENT beatings (a mixed fight, not a uniform one)",
    (() => {
      const hits = fams(DIGB).map((k) => H.ghHits(DIGB, k));
      return Math.max.apply(null, hits) > Math.min.apply(null, hits);
    })(), fams(DIGB).map((k) => k + '=' + H.ghHits(DIGB, k)).join(' '));
  check("THE HARDENING RUNS DOWN THE STREET: family by family, each block toward the graves needs MORE swings than the block above it",
    (() => {
      const probe = fams(DIGB)[0];
      const seq = [TOPB, VERMB, DIGB, GRAVEB].map((b) => H.ghHits(b, probe));
      return seq.every((v, i) => i === 0 || v > seq[i - 1]);
    })(),
    'depth ' + [384, 288, 192, 96].map((x) => H.depth(bandOfX(x))).join('/') + ' ' +
    fams(DIGB)[0] + ' ' + [384, 288, 192, 96].map((x) => H.ghHits(bandOfX(x), fams(DIGB)[0])).join('/'));
  check("the block he clocked in on is the SOFTEST end of the street and the Grave Watch the hardest thing on it",
    H.depth(TOPB) === 0 && H.depth(GRAVEB) === bands.length - 1 &&
    fams(TOPB).every((f) => H.ghHits(TOPB, f) <= H.ghHits(GRAVEB, f)) &&
    fams(GRAVEB).some((f) => H.ghHits(GRAVEB, f) > H.ghHits(TOPB, f)),
    'topFloor=' + H.ghFloor(TOPB) + ' gravesFloor=' + H.ghFloor(GRAVEB));
  check("THE WAVE TIERS HARDEN THE PACK (5 banishments = a tier = +1 swing on every animal)",
    (() => {
      const b0 = H.ghHits(DIGB, 'skeleton');
      H.setHaunt(3, 0);
      const b3 = H.ghHits(DIGB, 'skeleton');
      H.setHaunt(0, 0);
      return b3 === b0 + 3 * NIGHT_WAVE_HARDEN;
    })());
  check("EVERY ABYSS SURGE HARDENES IT AGAIN (+1 swing per surge the pit has opened), and NOTHING on the street ever takes more than " + GHOUL_HITS_MAX + " swings",
    (() => {
      // THE SURGE PROBE rides a family WITH ROOM UNDER THE CEILING: the Diggers' skeleton is
      // 4 + 2 = 6 swings, so a surge is an honest +1. The Grave Watch reaper (7 + 3 = 10) is
      // the CEILING PROOF — it arrives AT the cap and every tier the pit opens keeps it there.
      // NOTHING on any block, of any family, at MAX wave and MAX surge, ever takes 10 blows.
      const s0 = H.ghHits(DIGB, 'skeleton');
      H.setSurgeTier(1);
      const s1 = H.ghHits(DIGB, 'skeleton');
      H.setSurgeTier(2);
      const s2 = H.ghHits(DIGB, 'skeleton');
      H.setSurgeTier(0);
      const r0 = H.ghHits(GRAVEB, 'reaper');
      const i0 = H.ghHits(TOPB, 'imp');
      H.setHaunt(6, 0); H.setSurgeTier(HORROR_SURGE_LOAD_TIERS + 4);
      let hardest = 0, atCap = 0;
      for (let b = 0; b < bands.length; b++) {
        const fam = fams(bands[b]);
        for (let f = 0; f < fam.length; f++) {
          const v = H.ghHits(bands[b], fam[f]);
          if (v > hardest) hardest = v;
          if (v >= GHOUL_HITS_MAX) atCap++;
        }
      }
      const floorAtMax = H.ghHits(TOPB, 'imp');
      H.setHaunt(0, 0); H.setSurgeTier(0);
      probeLog = 'digging skeleton ' + s0 + ' -> ' + s1 + ' -> ' + s2 +
        ' · grave reaper ' + r0 + ' -> cap ' + hardest +
        ' · top imp ' + i0 + '/' + floorAtMax + ' · ceiling ' + GHOUL_HITS_MAX;
      return s1 === s0 + NIGHT_SURGE_HARDEN && s2 === s0 + 2 * NIGHT_SURGE_HARDEN &&
        hardest === GHOUL_HITS_MAX && r0 === GHOUL_HITS_MAX && atCap > 0 &&
        floorAtMax >= GHOUL_HITS_MIN;
    })(),
    probeLog);

  // (b) THE LIVE EXCHANGE: the pool is spent blow by blow, and the banishment is the LAST blow
  p.wx = 300; p.wy = 2.5; p.stunT = 0; p.shovelCd = 0;
  const c1 = spookOn('skeleton', DIGB);
  c1.wx = p.wx + 1.4; c1.wy = p.wy; c1.huntT = 4; c1.flinchT = 0; c1.backoffT = 0;
  c1.g.position.set(c1.wx, c1.wy, GZ);
  creatures.length = 0; creatures.push(c1); // ONE ON ONE: the blade answers THIS spook
  const pool = c1.hpMax;
  const near0 = Math.hypot(c1.wx - p.wx, c1.wy - p.wy);
  const firstWound = H.woundShovel(c1);
  const near1 = Math.hypot(c1.wx - p.wx, c1.wy - p.wy);
  const snap = { hp: c1.hp, hunt: c1.huntT, cd: c1.touchCd, back: c1.backoffT, flinch: c1.flinchT, dist: near1 };
  // THE MIDDLE OF THE POOL: the wound runs the thing down to its LAST swing.
  let wounded = 1;
  while (c1.hp > 1 && wounded < pool + 5) {
    c1.wx = p.wx + 1.45; c1.wy = p.wy; c1.huntT = 0; c1.flinchT = 0; c1.backoffT = 0; c1.touchCd = 0;
    c1.g.position.set(c1.wx, c1.wy, GZ);
    if (H.woundShovel(c1) === true) wounded++;
  }
  // THE LAST BLOW THROUGH THE SHIPPED MACHINERY: the strike, the hook, the flight, the scoop.
  const killBlow = shovelDown(c1, pool + 5);
  check("A SPOOK IS SHOVELED ONLY WHEN ITS POOL IS EMPTY: " + pool + " swings on a skeleton — " + (pool - 1) + " of them are WOUNDS and the last one is the banishment",
    firstWound === true && wounded === pool - 1 && killBlow === 1 && c1.hp === 0 &&
    c1.hookLanded === true && c1.hooked === false,
    'pool=' + pool + ' wounds=' + wounded + ' banishing blow=' + killBlow + ' hp=' + c1.hp);
  check("THE FIRST BLOW BUMPS IT OFF: knocked a body-and-a-half back off him, hunt BROKEN, its bite locked out, retreat timer running",
    snap.hp === pool - 1 && snap.dist > near0 + NIGHT_WOUND_PUSH * 0.5 && snap.hunt === 0 &&
    snap.cd >= NIGHT_BACKOFF_T && snap.back >= NIGHT_BACKOFF_T && snap.flinch > 0,
    'dist ' + near0.toFixed(2) + '->' + snap.dist.toFixed(2) + ' hunt=' + snap.hunt +
    ' cd=' + snap.cd.toFixed(2) + ' backoff=' + snap.back.toFixed(2));
  check("THE KILLING BLOW DOES NOT SEND IT WALKING OFF (it goes IN THE TRUCK): the back-off is cleared with the empty pool",
    c1.backoffT === 0 && c1.hp === 0);
  // (c) THE BACK-OFF RUNS THE RING through the real haunt AI
  const c2 = spookOn('skeleton', DIGB);
  c2.wx = p.wx + 3; c2.wy = p.wy; c2.huntT = 0; c2.flinchT = 0;
  c2.g.position.set(c2.wx, c2.wy, GZ);
  H.woundShovel(c2);
  const d0 = Math.hypot(c2.wx - p.wx, c2.wy - p.wy);
  for (let i = 0; i < 60; i++) { c2.g.position.set(c2.wx, c2.wy, GZ); H.updateHorrorCreature(c2, 1 / 60); }
  const d1 = Math.hypot(c2.wx - p.wx, c2.wy - p.wy);
  check("THE WOUNDED ONE LEAVES THE RING: 1s of the real haunt AI walks it FURTHER OFF than it was (" +
    d0.toFixed(2) + " -> " + d1.toFixed(2) + "), so its pack takes the gap and he fights them one at a time",
    d1 > d0 + 2.2 && c2.huntT === 0 && c2.hp === c2.hpMax - 1);
  const c3 = spookOn('skeleton', DIGB);
  c3.wx = p.wx + 1.2; c3.wy = p.wy; c3.touchCd = 0; c3.huntT = 4;
  c3.g.position.set(c3.wx, c3.wy, GZ);
  H.woundShovel(c3);
  check("...and a backing-off spook cannot bite him on the way out: its brush is locked out while its retreat runs",
    c3.backoffT > 0 && c3.touchCd >= c3.backoffT &&
    /if \(\(c\.backoffT \|\| 0\) > 0\) \{[\s\S]{0,260}c\.touchCd = HORROR_TOUCH_CD;[\s\S]{0,60}continue;/.test(html));

  // (d) THE BAR OVER ITS HEAD — the shipped DOM code, run against a DOM mock
  const NIGHT_HP_Z = srcNum('NIGHT_HP_Z'), NIGHT_HP_Z_FLOAT = srcNum('NIGHT_HP_Z_FLOAT');
  const mkEl = (tag) => ({
    tag: tag, className: '', textContent: '', children: [], parentNode: null,
    style: { display: 'none', left: '', top: '', width: '' },
    classList: {
      _s: {},
      toggle(c, on) { if (on) this._s[c] = true; else delete this._s[c]; },
      has(c) { return !!this._s[c]; },
    },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parentNode = null; return c; },
  });
  const doc = {
    created: 0, removed: 0,
    createElement(t) { doc.created++; return mkEl(t); },
    body: {
      children: [],
      appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parentNode = null; doc.removed++; return c; },
    },
  };
  const w2s = (wx) => (wx > 370 ? null : { x: 100 + (wx - 300), y: 220 });
  const barPool = [];
  const BAR = new Function('document', 'worldToScreen', 'creatures', 'state', 'isNightShift', 'GZ',
    'NIGHT_HP_Z', 'NIGHT_HP_Z_FLOAT', 'NIGHT_HP_Z_PROP', 'HORROR_ROSTER_CAP', 'ghoulHpBarPool',
    'blocks', 'SHOVELABLE_HAZARDS', 'nightArmProp', 'clamp',
    srcFn('nightHpBarRec') + '\n' + srcFn('nightArmProp') + '\n' + srcFn('updateGhoulHpBars') +
    '\n' + srcFn('nightHpBarsClear') +
    '\n;return { upd: updateGhoulHpBars, clear: nightHpBarsClear, arm: nightArmProp };')(
      doc, w2s, creatures, 'play', () => nightOn, GZ, NIGHT_HP_Z, NIGHT_HP_Z_FLOAT, NIGHT_HP_Z_PROP,
      HORROR_ROSTER_CAP, barPool, S2_BLOCKS, SHOVELABLE_HAZARDS,
      (hz) => { hz.hpMax = NIGHT_EXTRA_HITS[hz.type] || 3; hz.hp = hz.hpMax; hz.woundT = 0; },
      clamp);
  s7Reset();
  creatures.length = 0;
  freeBlock(DIGB); // the block's whole ward load is free to seed
  const barC = [];
  for (let i = 0; i < 6; i++) {
    const c = H.nightSpawnHorror('skeleton', { x0: DIGB.x0, x1: DIGB.x1, i: DIGB.i });
    c.wx = 300 + i * 2; c.wy = 2.5; c.fade = 0; c.g.position.set(c.wx, c.wy, GZ);
    barC.push(c);
  }
  barC[0].hp = barC[0].hpMax;
  barC[1].hp = Math.max(1, barC[1].hpMax - 1);
  barC[2].hp = 1; // the last swing: BLOOD RED
  barC[3].fade = 1; // it is materializing out of the fog: its bar fades IN with it
  barC[4].hooked = true; // riding the toss: no bar
  barC[5].wx = 400; barC[5].g.position.set(400, 2.5, GZ); // off screen: no bar
  // THE GRAVE FURNITURE ON THE SAME BLOCK wears the same bar (the blade can dig it out).
  const digBlock = S2_BLOCKS.filter((r) => r.blockX === 192)[0];
  digBlock.hazards.length = 0;
  H.nightPlaceProp(digBlock, 'headstone', 210, 2.5);
  H.nightPlaceProp(digBlock, 'coffin', 220, 2.5);
  BAR.upd();
  const shown = barPool.filter((r) => r.el.style.display === 'block');
  const bare = barC.length - 2; // 6 spooks: one riding the toss, one off the screen
  check('THERE IS A TINY HEALTH BAR OVER EVERYTHING THE SHOVEL CAN HIT on this level - every spook, the tentacles and the grave furniture, ON screen (' + shown.length + ' bars for ' + barC.length + ' spooks + 2 props; a spook riding the toss and an off-screen one go bare)',
    shown.length === bare + 2 && barPool.length === bare + 2,
    'shown=' + shown.length + ' pool=' + barPool.length);
  check('the FADING-IN SPOOK wears its bar too (it fades in with the mesh — NO spook on the block is bare)',
    (() => {
      const fading = barPool[3]; // roster order: barC[0..3] are the four standing on screen
      return !!fading && fading.el.style.display === 'block' &&
        fading.t === barC[3].hp + '/' + barC[3].hpMax &&
        Number(fading.el.style.opacity) > 0.3 && Number(fading.el.style.opacity) < 1;
    })(), 'opacity=' + ((barPool[3] || { el: { style: { opacity: '-' } } }).el.style.opacity));
  check('the HEADSTONE and the COFFIN wear one as well, on THEIR block\u2019s hardened pools',
    (() => {
      const stone = digBlock.hazards.filter((h) => h.type === 'ghoststone')[0];
      const coffin = digBlock.hazards.filter((h) => h.type === 'coffin')[0];
      return !!stone && !!coffin && !!stone.hpMax && !!coffin.hpMax &&
        stone.hpMax >= GHOUL_HITS_MIN && coffin.hpMax > stone.hpMax &&
        barPool.some((r) => r.el.style.display === 'block' && r.t === stone.hp + '/' + stone.hpMax) &&
        barPool.some((r) => r.el.style.display === 'block' && r.t === coffin.hp + '/' + coffin.hpMax);
    })(),
    digBlock.hazards.map((h) => h.type + ' ' + h.hp + '/' + h.hpMax).join('·'));
  check('the bar FILLS AS THE POOL DRAINS and counts the swings on its face: ' +
    barC.slice(0, 3).map((c) => c.hp + '/' + c.hpMax).join(' · '),
    (() => {
      const byC = barPool.slice(0, 3).map((r) => ({ w: r.fill.style.width, t: r.num.textContent }));
      return byC[0].w === '100%' && byC[0].t === barC[0].hp + '/' + barC[0].hpMax &&
        byC[2].t === '1/' + barC[2].hpMax && parseInt(byC[2].w, 10) < 40;
    })(), barPool.map((r) => r.fill.style.width + ' ' + r.num.textContent).join(' | '));
  check('the bar CHANGES COLOUR as it goes (green full, amber mid, BLOOD RED on the last swing)',
    (() => {
      BAR.upd();
      const cls = barPool.map((r) => (r.el.classList.has('low') ? 'low' : r.el.classList.has('mid') ? 'mid' : 'full'));
      return cls.indexOf('full') >= 0 && cls.indexOf('low') >= 0;
    })(), barPool.map((r) => r.num.textContent + '=' + (r.el.classList.has('low') ? 'low' : r.el.classList.has('mid') ? 'mid' : 'full')).join(' '));
  check('the bars ride the ROSTER with an element POOL (no per-frame alloc): more passes create nothing new',
    (() => { const c0 = doc.created; BAR.upd(); BAR.upd(); return doc.created === c0 && barPool.length === barC.length - 2 + 2; })());
  nightOn = false; BAR.upd(); nightOn = true;
  check('the weekdays never get a bar: with the SAME roster on a weekday shift, every element goes hidden',
    barPool.every((r) => r.el.style.display === 'none'));
  check('THE SHIFT RESET CLEARS THE BARS (nothing is stranded on screen when the roster goes)',
    (() => { const n = barPool.length; BAR.clear(); return barPool.length === 0 && doc.removed >= n; })());
  check('the bars ride the frame (the night block of the loop drives them, with its dt) and they are styled in CSS',
    html.includes('updateGhoulHpBars(dt);') && /\.ghp \{/.test(html) && /\.ghp-fill \{/.test(html) &&
      html.includes('nightHpBarsClear();') && /\.ghp\.low/.test(html));
  digBlock.hazards.length = 0;

  // (d2) THE FIRST BLOCK, WHOLE: the block he clocked in on is NOTED — every animal the blade
  //      can catch on it carries a pool, and every one of them wears its bar on screen.
  const bFirst = bandOfX(384);
  const firstFams = fams(bFirst);
  const blockRoster = [];
  let blockSeeds = 0;
  (() => {
    freeBlock(bFirst);
    for (let i = 0; i < 14; i++) {
      const c = H.nightSpawnHorror(firstFams[i % firstFams.length], bFirst);
      if (!c) continue;
      blockSeeds++;
      c.wx = 300 + (i % 7) * 3; c.wy = 2.5; c.fade = 0; // inside the MOCK camera's frustum
      c.g.position.set(c.wx, c.wy, GZ);
      blockRoster.push(c);
    }
  })();
  const zaFirst = mkC('zombieArm', 1, { state: 'idle', cd: 0 });
  zaFirst.wx = 345; zaFirst.wy = -5.5; zaFirst.fade = 0;
  zaFirst.g.position.set(zaFirst.wx, zaFirst.wy, GZ);
  H.armSpook(zaFirst, bFirst);
  blockRoster.push(zaFirst);
  creatures.length = 0;
  creatures.push.apply(creatures, blockRoster);
  const firstPropsBlock = S2_BLOCKS.filter((r) => r.blockX === 192)[0];
  firstPropsBlock.hazards.length = 0;
  H.nightPlaceProp(firstPropsBlock, 'gate', 352, 2.5);
  H.nightPlaceProp(firstPropsBlock, 'candle', 356, 2.5);
  BAR.clear();
  BAR.upd();
  const firstBars = barPool.filter((r) => r.el.style.display === 'block');
  const expectedBars = blockRoster.length + 2; // every animal, the tentacle, and both props
  check('THE FIRST BLOCK IS NOTED END TO END: ' + blockSeeds + ' animals, the manhole tentacle and ' +
    firstPropsBlock.hazards.length + ' pieces of grave furniture — ' + firstBars.length +
    ' bars for ' + expectedBars + ' shoveled things (NO animal on his own block is bare)',
    firstBars.length === expectedBars && blockRoster.every((c) => c.hpMax >= GHOUL_HITS_MIN) &&
      firstPropsBlock.hazards.every((h) => h.hpMax >= 2),
    'bars=' + firstBars.length + ' of ' + expectedBars);
  const firstPools = blockRoster.filter((c) => c.type !== 'zombieArm')
    .map((c) => (c.causeKey || c.type) + '=' + c.hpMax);
  check('THE PRICE ON THE FIRST BLOCK is the SOFTEST on the street and it is never one swing: ' +
    firstPools.slice(0, 6).join(' ') + ' (the ward reads ' + H.ghFloor(bFirst) + ' swings each)',
    firstPools.every((s) => Number(s.split('=')[1]) >= GHOUL_HITS_MIN) &&
      H.ghFloor(bFirst) >= GHOUL_HITS_MIN && H.ghFloor(bFirst) <= GHOUL_HITS_MAX,
    firstPools.join(' '));
  firstPropsBlock.hazards.length = 0;
  creatures.length = 0;
  BAR.clear();

  // (d3) THREE QUICK SWINGS DO NOT WIN A FIGHT: the swing cadence against the scurry and the pool
  const CADENCE = SHOVEL_SWING_DUR + SHOVEL_COOLDOWN;
  const poolFirst = H.ghHits(bFirst, firstFams[0]);
  check('THE SCURRY OUTRUNS THE CADENCE: a wounded animal is off the tool and running for at least ' +
    Math.floor(NIGHT_BACKOFF_T / CADENCE) + ' swing cycles on the softest block (push ' +
    NIGHT_WOUND_PUSH.toFixed(1) + 'u at ' + NIGHT_BACKOFF_SP.toFixed(1) + 'u/s, retreat ' +
    NIGHT_BACKOFF_T.toFixed(2) + 's + ' + NIGHT_BACKOFF_EXTRA.toFixed(2) + 's per swing left, cadence ' +
    CADENCE.toFixed(2) + 's)',
    NIGHT_WOUND_PUSH >= SHOVEL_REACH - SHOVEL_REACH * 0.4 &&
      NIGHT_BACKOFF_T >= 2 * CADENCE && NIGHT_BACKOFF_SP > 3.2 &&
      poolFirst >= GHOUL_HITS_MIN && GHOUL_HITS_MIN >= 3);
  check('A BANISHMENT TAKES THE WHOLE POOL AND A SCURRY PER BLOW: ' + poolFirst +
    ' swings, ' + (poolFirst - 1) + ' scurries, no fewer than ' +
    (CADENCE * poolFirst + NIGHT_BACKOFF_T * (poolFirst - 1)).toFixed(2) +
    's from the first swing to the hopper on the softest animal on the street',
    (() => {
      const softest = Math.min.apply(null, fams(bFirst).map((f) => H.ghHits(bFirst, f)));
      const minTime = CADENCE * softest + NIGHT_BACKOFF_T * (softest - 1);
      return softest >= GHOUL_HITS_MIN && minTime >= 3 * CADENCE + NIGHT_BACKOFF_T * 2;
    })(), 'softest=' + fams(bFirst).map((f) => f + '=' + H.ghHits(bFirst, f)).join(' '));

  // (e) THE WARD BILL IS PAID BY BANISHMENTS, NEVER BY HITS
  s7Reset();
  p.wx = 449; p.wy = 2.5; p.stunT = 0; p.facing = 0; // the paid spook is laid out in +x
  const bTop = bandOfX(384);
  const topFam = hardestFam(bTop); // the SOFTEST block's TOUGHEST family: the clearest bill
  const sp = spookOn(topFam, bTop);
  sp.wx = p.wx + 1.5; sp.wy = p.wy; sp.huntT = 0; sp.flinchT = 0; sp.backoffT = 0;
  sp.g.position.set(sp.wx, sp.wy, GZ);
  const led = H.gateLedger(bTop);
  const y0 = led.yield;
  const topPool = sp.hpMax;
  // THE WOUNDS: every blow of the pool BUT the last. The block's ledger must NOT move.
  let wounds = 0;
  while (sp.hp > 1 && wounds < topPool + 5) {
    sp.wx = p.wx + 1.45; sp.wy = p.wy; sp.huntT = 0; sp.flinchT = 0; sp.backoffT = 0;
    sp.g.position.set(sp.wx, sp.wy, GZ);
    if (H.woundShovel(sp) === true) wounds++;
  }
  const yieldAfterWounds = led.yield;
  // THE KILLING BLOW: the shipped strike, hook, flight and hopper — THIS landing pays.
  const lastBlow = shovelDown(sp, topPool + 5);
  let g8 = 0;
  while (sp.hooked && !sp.hookLanded && g8++ < 400) H.shovelFlight(sp, 1 / 60);
  check("HITS DON'T COUNT TOWARD THE BLOCK'S BILL: " + wounds + " wounds paid " +
    (yieldAfterWounds - y0) + " to the ward ledger; the emptied pool paid exactly ONE (the ward still opens on banishments)",
    wounds === topPool - 1 && yieldAfterWounds === y0 && led.yield === y0 + 1 &&
    lastBlow === 1 && sp.hookLanded === true && sp.hp === 0 && led.open !== true,
    'fam=' + topFam + ' pool=' + topPool + ' wounds=' + wounds + ' yield=' + led.yield + ' base=' + y0);

  // (f) THE WEEKDAYS: the shovel is untouched — no pool, no wound, no back-off, no bar
  const nightWas = nightOn;
  nightOn = false;
  const dayC = mkC('ghost', 2);
  const stood = H.woundShovel(dayC);
  nightOn = nightWas;
  check("THE SEVEN WEEKDAYS NEVER SEE ANY OF THIS: no pool, no wound, no back-off — the shipped street plays byte for byte as it shipped",
    stood === false && dayC.hp === undefined && dayC.hpMax === undefined && !dayC.backoffT);
  check("THE WOUND GATE SITS BEHIND THE NIGHT SWITCH AND THE NIGHT ROSTER (a weekday ghost, the tentacle and every prop keep the shipped instant strike)",
    /if \(nightWoundShovel\(c\)\) return;/.test(srcFn('shovelStrike')) &&
    /if \(typeof isNightShift !== "function" \|\| !isNightShift\(\)\) return false;/.test(srcFn('nightWoundShovel')) &&
    /if \(!HORROR_ALL\[key\] && !NIGHT_EXTRA_HITS\[key\]\) return false;/.test(srcFn('nightWoundShovel')) &&
    /if \(typeof isNightShift === "function" && isNightShift\(\)\) \{[\s\S]{0,900}if \(hz\.hp > 0\) \{/.test(srcFn('shovelHazardStrike')) &&
    /nightArmProp\(b\.hazards\[b\.hazards\.length - 1\]\);/.test(srcFn('nightPlaceProp')) &&
    /SHOVELABLE_HAZARDS\[hz\.type\]/.test(srcFn('updateGhoulHpBars')));
  check('THE CHIP IS TERSE (name + creatures left) and every night spook is ARMED AT BIRTH',
    srcFn('nightGateHudText').includes('" LEFT";') && srcFn('nightGateHudText').includes('pr.left') &&
    !/"[^"]*WARD UP"/.test(srcFn('nightGateHudText')) &&
    /nightArmSpook\(c, band\);/.test(srcFn('nightSpawnHorror')) &&
    /nightArmSpook\(za, zaBand\);/.test(html) &&
    /const GHOUL_HITS = \{/.test(html) && /reaper: 7,/.test(html) &&
    /const GHOUL_HITS_MIN = 3;/.test(html) && /zombieArm: 4,/.test(html) &&
    /const NIGHT_EXTRA_HITS = \{/.test(html),
    'hud=' + srcFn('nightGateHudText').includes('" LEFT";') + '/' + srcFn('nightGateHudText').includes('pr.left') +
    '/' + !/WARD UP/.test(srcFn('nightGateHudText')) + ' spawn=' + /nightArmSpook\(c, band\);/.test(srcFn('nightSpawnHorror')) +
    ' za=' + /nightArmSpook\(za, zaBand\);/.test(html) + ' reaper=' + /reaper: 7,/.test(html) +
    ' min=' + /const GHOUL_HITS_MIN = 3;/.test(html) + ' za4=' + /zombieArm: 4,/.test(html) +
    ' extra=' + /const NIGHT_EXTRA_HITS = \{/.test(html));


})();

console.log("\n[23] THE QUIET STREET: THE CHIP SAYS THE BLOCK AND THE COUNT, NOT ONE SPEECH BUBBLE ON MIDNIGHT, AND THE BEAST'S BAR IS A FINAL-BLOCK BAR IN THE CHIP'S SLOT");
(function () {
  // (a) THE BLOCK CHIP: name + creatures left, and nothing else — every ward on the street
  s7Reset();
  const bands23 = H.nightBands();
  const chipOf = (b) => H.gateHud();
  const chipA = chipOf(bands23[0]);
  check('THE CHIP IS THE BLOCK AND THE COUNT, NOTHING ELSE: "' + chipA + '" has no ward flag, no swings price, no x/y tally',
    /^[A-Z '’]+ · \d+ LEFT$/.test(chipA) && !/WARD|SWING|\(\d+\/\d+\)/.test(chipA), chipA);
  bands23.forEach((b) => {
    const led = H.gateLedger(b);
    led.yield = led.load; // this block is in the hopper
    led.open = true;
  });
  bands23.forEach(() => H.gateCheck(1 / 60));
  check('...and the cleared street keeps the SAME SHAPE of line: "' + H.gateHud() + '"',
    /^THE GRAVES · 0 LEFT$/.test(H.gateHud()), H.gateHud());
  s7Reset();

  // (b) THE SPOOKS COUNTER IS OFF THE STREET: the pill is switched off at the constant, the
  //     markup + the ecoplasm skin + the shift report's tally all stay exactly as shipped
  check('THE "SPOOKS n / 14" PILL IS OFF THE MIDNIGHT HUD (NIGHT_ECTO_PILL = false): updateHUD can never light it',
    /const NIGHT_ECTO_PILL = false;/.test(html) &&
      /const showEcto =\s*NIGHT_ECTO_PILL && isNightShift\(\)/.test(srcFn('updateHUD')) &&
      html.includes('id="ecto-count-text"') && html.includes('SPOOKS SHOBELED'));

  // (c) THE HAUNTED STREET IS SILENT — not ONE speech bubble, for anyone, until the player
  //     names the lines he wants. The gate under test is the GAME'S OWN source, compiled in
  //     a state box and run against the day (Monday) and the night (Midnight).
  const nightBox23 = (allow) => new Function(
    'isNightShift', 'NIGHT_SPEECH_BANNED', 'NIGHT_SPEECH_ALLOW', 'NIGHT_BUBBLE_GAP',
    'let nightBubbleT = 0; const box = { bubbles: [] };' +
    srcFn('nightSpeechAllowed') + srcFn('nightSpeechOk') + srcFn('nightBubbleOk') +
    'function spawnBubble(t, sp) { box.bubbles.push(sp); }' +
    'box.speak = (t, sp) => { if (nightSpeechOk(sp, t)) spawnBubble(t, sp); };' +
    'box.bubble = (t, sp) => { if (nightBubbleOk(t, sp)) spawnBubble(t, sp); };' +
    'return box;')(
      () => nightOn, NIGHT_SPEECH_BANNED, allow, NIGHT_BUBBLE_GAP);
  const speakAll23 = (box) => {
    box.bubbles.length = 0;
    box.speak("IT RUNS!", "worker");
    box.speak("GLURRRK", "ghost");
    box.speak("GET OUT OF MY STREET", "rat");
    box.speak("THE MOUTH IS OPEN", "boss");
    box.bubble("+10 GHOUND", "score");
    box.bubble("POW!", "worker");
    return box.bubbles.slice();
  };
  nightOn = true;
  const silent23 = nightBox23(NIGHT_SPEECH_ALLOW);
  const nightBub = speakAll23(silent23);
  check("ON MIDNIGHT NO SPEECH BUBBLE GOES ON SCREEN AT ALL — worker, spook, rat, beast, score and POW! all read " + nightBub.length,
    nightBub.length === 0, nightBub.join("+") || "no bubbles at all");
  nightOn = false;
  const dayBub = speakAll23(nightBox23(NIGHT_SPEECH_ALLOW));
  nightOn = true;
  check("...and the SEVEN WEEKDAYS keep every bubble exactly as shipped (the same six lines bubble the worker, the spook, the rat, the beast, the score and the POW!)",
    dayBub.length === 6 && dayBub.includes("ghost") && dayBub.includes("rat") && dayBub.includes("score"),
    dayBub.join("+"));
  // THE WHITELIST IS THE PLAYER'S DOOR: name the lines (or speakers) and exactly those come back
  const named23 = nightBox23(["boss", "THE MOUTH IS OPEN"]);
  const namedBub = speakAll23(named23);
  check("NIGHT_SPEECH_ALLOW IS THE INSTRUCTION HOOK — naming \"boss\" and \"THE MOUTH IS OPEN\" brings back " +
    namedBub.join("+") + ' and nothing else ("*" opens the whole street)',
    namedBub.length === 1 && namedBub[0] === "boss", namedBub.join("+"));
  const star23 = speakAll23(nightBox23(["*"])).length;
  check('...and the wildcard "*" is honored for the day the player wants every line back: ' + star23 +
    ' of 6 bubbles on the night (the rest is the NIGHT_BUBBLE_GAP budget, which only ever bites lines he named)',
    star23 >= 5 && star23 <= 6, 'star=' + star23);
  check("the gate is ONE function the whole voice system runs through (nightSpeechOk), wired into Voice.say AND into spawnBubble itself",
    /function nightSpeechOk\(speaker, text\)/.test(html) &&
      html.includes("!nightSpeechOk(speaker, text)") &&
      /function nightBubbleOk\(text, speaker\)/.test(html) &&
      /if \(\r?\n\s*typeof nightBubbleOk === "function" &&\r?\n\s*typeof isNightShift === "function" &&\r?\n\s*isNightShift\(\) &&\r?\n\s*!nightBubbleOk\(text, speaker\)\r?\n\s*\)\r?\n\s*return;/.test(srcFn('spawnBubble')) &&
      /const NIGHT_SPEECH_BANNED = true;/.test(html) &&
      /const NIGHT_SPEECH_ALLOW = \[\];/.test(html) &&
      /const NIGHT_WORKER_ONLY_SPEECH = true;/.test(html));

  // (d) THE BEAST'S BAR: asleep = NO bar; awake = the bar IN THE CHIP'S SLOT (not top-center,
  //     not behind the radio), and the block's name steps aside for it
  check('A SLEEPING BEAST HAS NO BAR: updateHUD lights it only once the beast is AWAKE',
    /const showBoss =\s*isNightShift\(\) &&\s*!!b &&\s*b\.awake === true &&\s*b\.hp > 0/.test(srcFn('updateHUD')) &&
      html.includes('const NIGHT_BOSS_BAR_IN_CHIP_SLOT = true;'));
  const bossCss = (html.match(/#boss-goal \{[\s\S]{0,520}?\}/) || [''])[0];
  const radioCss = (html.match(/#radio \{[\s\S]{0,900}?\}/) || [''])[0];
  check("THE BAR SITS IN THE BLOCK CHIP SLOT, NOT TOP-CENTER: the ward chip\u2019s top/left, z-12, while the MUSIC PLAYER alone keeps the top-centre slot",
    /top: calc\(186px/.test(bossCss) && /left: calc\(20px/.test(bossCss) && !/left: 50%/.test(bossCss) &&
      /z-index: 12/.test(bossCss) && !/transform: translateX/.test(bossCss) &&
      /top: calc\(14px/.test(radioCss) && /left: 50%/.test(radioCss) &&
      /transform: translateX\(-50%\)/.test(radioCss),
    'boss[' + /top: calc\(186px/.test(bossCss) + /left: calc\(20px/.test(bossCss) +
    '!50=' + !/left: 50%/.test(bossCss) + ' z12=' + /z-index: 12/.test(bossCss) +
    ' noTr=' + !/transform: translateX/.test(bossCss) + '] radio[' + /top: calc\(14px/.test(radioCss) +
    ' /' + /left: 50%/.test(radioCss) + ' /' + /transform: translateX\(-50%\)/.test(radioCss) + ']');
check('...and on the phones it lands on the CHIP\\u2019S mobile slot (146px, the left column) — clear of the Music Player',
    /#boss-goal \{\s*width: min\(78vw, 300px\);\s*top: calc\(146px \+ env\(safe-area-inset-top, 0px\)\);\s*left: calc\(12px \+ env\(safe-area-inset-left, 0px\)\);/.test(html));
  check('WHILE THE BEAST IS UP, THE BLOCK NAME STEPS ASIDE: the ward chip is hidden in the very slot the bar takes',
    /NIGHT_BOSS_BAR_IN_CHIP_SLOT && nightBoss && nightBoss\.awake && nightBoss\.hp > 0/.test(srcFn('updateHUD')));
})();

console.log('\n[27] THE COUNT IS THE TRUTH: ONE SETTLEMENT PER ANIMAL, THE CHIP COUNTS WHAT STANDS, AND THE WALL FALLS ON THE FRAME THE BLOCK GOES EMPTY');
(function () {
  const bAt = (x) => H.nightBands().filter((b) => b.x0 === x)[0];
  const seedIn = (band, cap) => {
    const fams = H.nightBlockFamilies(band);
    const room = Math.min(H.gateRoom(band), cap);
    for (let i = 0; i < room; i++) {
      const c = H.nightSpawnHorror(fams[i % fams.length], band);
      if (!c) continue;
      c.wx = band.x0 + 8 + (i % 7) * 10; c.wy = 2.5; c.fade = 0; c.huntT = 3;
      c.g.position.set(c.wx, c.wy, GZ);
    }
  };
  const crew = (band) => creatures.filter((c) => c.home && c.home.i === band.i && !c.hookLanded);
  const landOne = (c) => {
    c.hooked = true; c.hookT = 0; c.hookLanded = false;
    c.fx0 = c.wx; c.fy0 = c.wy; c.fz0 = GZ;
    let g = 0;
    while (!c.hookLanded && g++ < 400) H.shovelFlight(c, 1 / 60);
    return c;
  };
  // (a) NO DOUBLE SETTLEMENT: the shovel pays an animal, and the fog sweep cannot pay it again
  s7Reset();
  const B1 = bAt(288), L1 = H.gateLedger(B1);
  p.wx = 330; seedIn(B1, 4);
  const one = landOne(crew(B1)[0]);
  const y1 = L1.yield;
  H.cull(one); // the sweep that used to double-count it (its x is on the truck, behind him)
  check('AN ANIMAL IS SETTLED ONE TIME: the shovel paid ' + y1 + ' for it and the fog sweep that follows settles ' +
      (L1.yield - y1) + ' more (gatePaid=' + one.gatePaid + ')',
    L1.yield === y1 && one.gatePaid === true, 'yield=' + L1.yield + ' after=' + y1);
  // (b) THE CHIP AND THE STREET AGREE (the invariant behind "0 left ⇒ wall down"): the animals
  //     standing on the beat are exactly the pack the block put out minus the pack settled.
  s7Reset();
  const B2 = bAt(192), L2 = H.gateLedger(B2), load2 = H.gateLoad(B2);
  p.wx = 250; seedIn(B2, 30);
  const standing = crew(B2).length;
  const settle2 = Math.min(standing - 1, load2);
  for (let i = 0; i < settle2; i++) { H.gateCredit(crew(B2)[0]); H.cull(crew(B2)[0]); }
  H.gateCheck(1 / 60);
  check('THE CHIP AND THE STREET AGREE: "' + (L2.name + " · " + H.gateLeft(B2) + " LEFT") +
      '" for ' + crew(B2).length + ' standing, sent=' + L2.sent + ', settled=' + L2.yield +
      ' — the number LEFT IS the animals on the beat, so 0 LEFT can only be read on an empty block',
    L2.sent - L2.yield === crew(B2).length && H.gateLeft(B2) === Math.max(0, Math.max(load2, L2.sent) - L2.yield) &&
      L2.open === false && H.gateLive(B2) > 0 && H.gateLeft(B2) > 0,
    'left=' + H.gateLeft(B2) + ' live=' + H.gateLive(B2) + ' sent=' + L2.sent + ' yield=' + L2.yield + ' open=' + L2.open);
  // (c) THE WALL FALLS THE FRAME THE LAST ONE GOES IN THE TRUCK — no extra creature needed
  s7Reset();
  const B3 = bAt(288), L3 = H.gateLedger(B3), load3 = H.gateLoad(B3);
  p.wx = 330;
  let sweep = 0, lastLeft = 0;
  while (L3.open === false && sweep++ < 40) {
    seedIn(B3, 12);
    const list = crew(B3);
    if (!list.length) { H.gateCheck(1 / 60); continue; }
    list.forEach(landOne);
    list.forEach((c) => { const k = creatures.indexOf(c); if (k >= 0) creatures.splice(k, 1); });
    lastLeft = H.gateLeft(B3);
    H.gateCheck(1 / 60);
  }
  check('THE WARD COMES DOWN ON THE FRAME THE BLOCK GOES EMPTY: sent=' + L3.sent + ', paid=' + L3.yield +
      '/' + load3 + ', standing=' + H.gateLive(B3) + ', chip read ' + lastLeft + ' LEFT on the last sweep',
    L3.open === true && H.gateLive(B3) === 0 && H.gateLeft(B3) === 0 &&
      L3.sent >= load3 && L3.yield >= load3 && L3.yield === L3.sent,
    'open=' + L3.open + ' yield=' + L3.yield + '/' + load3 + ' sent=' + L3.sent);
  check('...AND THE GO! ARROW LIT ON THAT FRAME: "' + H.getGoMsg() + '" at ' + H.getGoT().toFixed(2) + 's',
    H.getGoT() > 0 && /WALL IS DOWN!/.test(H.getGoMsg()));
  // (d) THE FOG TAKES ANIMALS BACK AND PAYS FOR THEM — the room formula is exact, the block
  //     closes in exactly `load` settlements, never more, never fewer
  s7Reset();
  const B4 = bAt(288), L4 = H.gateLedger(B4), load4 = H.gateLoad(B4);
  p.wx = 330; seedIn(B4, 12);
  const full4 = crew(B4).length;
  const roomFull4 = H.gateRoom(B4);
  const taken4 = crew(B4).slice(0, 4);
  taken4.forEach((c) => H.cull(c));
  const room4 = H.gateRoom(B4);
  const live4 = crew(B4).length;
  // settle the rest with the shovel and the ward must fall at EXACTLY `load` settlements
  const list4 = crew(B4).slice();
  list4.forEach(landOne);
  H.gateCheck(1 / 60);
  const openWithFullPay = L4.open;
  list4.forEach((c) => { const k = creatures.indexOf(c); if (k >= 0) creatures.splice(k, 1); });
  const leftAfter = H.gateLeft(B4);
  const liveAfter = H.gateLive(B4);
  H.gateCheck(1 / 60);
  check('THE FOG PAYS WHAT IT TAKES, AND THE BLOCK CLOSES IN EXACTLY ITS LOAD (' + load4 + '): full ' +
      full4 + ' standing → room ' + roomFull4 + '; ' + taken4.length + ' taken back → ' + live4 +
      ' standing, room ' + room4 + ', settled ' + L4.yield + '; the rest in the truck → settled ' +
      L4.yield + ', standing ' + liveAfter + ', left ' + leftAfter + ' → ward ' + (L4.open ? "DOWN" : "up"),
    roomFull4 === 0 && live4 === full4 - taken4.length && room4 === Math.max(0, load4 - L4.yield - live4) &&
      L4.yield === load4 && (openWithFullPay || liveAfter === 0) && L4.open === true && liveAfter === 0 && leftAfter === 0 &&
      /Math\.max\(0, load - Math\.min\(led\.yield, load\) - nightGateLive\(band\)\)/.test(srcFn('nightGateRoom')),
    'yield=' + L4.yield + '/' + load4 + ' live=' + liveAfter + ' left=' + leftAfter + ' open=' + L4.open + ' room=' + room4);
  // (e) THE CHIP AND THE WALL RUN ONE FORMULA (no second arithmetic in the HUD)
  check('ONE ACCOUNT, TWO VOICES: the HUD tally, the chip, the spawn cap and the wall all read the same book',
    /left: nightGateLeft\(band\)/.test(srcFn('nightGateProgress')) &&
      /const debt = nightGateDebt\(band\);/.test(srcFn('nightGateLeft')) &&
      /Math\.max\(0, debt - Math\.min\(led\.yield, debt\)\)/.test(srcFn('nightGateLeft')) &&
      /function nightGateStanding\(band\)/.test(html) &&
      /if \(led\.yield < nightGateLoad\(band\)\) continue;/.test(srcFn('nightGateCheck')) &&
      /if \(led\.sent < nightGateLoad\(band\)\) continue;/.test(srcFn('nightGateCheck')));
  s7Reset();
})();

console.log('\n[26] NO WALL OVER AN EMPTY BLOCK: THE WARD\u2019S DEBT IS WHAT THE BLOCK SENT OUT, AND THE FOG PAYS IT TOO (the walk-back-up stall)');
(function () {
  s7Reset();
  const bands26 = H.nightBands();
  const bAt = (x) => bands26.filter((b) => b.x0 === x)[0];
  const DIG26 = bAt(192), VER26 = bAt(288);
  const load26 = H.gateLoad(DIG26);
  const fams26 = H.nightBlockFamilies(DIG26);
  const led26 = H.gateLedger(DIG26);
  const seedIn = (band, fams, cap) => {
    const room = Math.min(H.gateRoom(band), cap);
    for (let i = 0; i < room; i++) {
      const c = H.nightSpawnHorror(fams[i % fams.length], band);
      if (!c) continue;
      c.wx = band.x0 + 6 + (i % 8) * 9; c.wy = 2.5; c.fade = 0; c.huntT = 3;
      c.g.position.set(c.wx, c.wy, GZ);
    }
  };
  const shovelCrew = (band, count) => {
    let killed = 0;
    creatures.slice().forEach((c) => {
      if (killed >= count) return;
      if (!c.home || c.home.i !== band.i) return;
      c.hooked = true; c.hookT = 0; c.hookLanded = false;
      c.fx0 = c.wx; c.fy0 = c.wy; c.fz0 = GZ;
      let g = 0;
      while (!c.hookLanded && g++ < 400) H.shovelFlight(c, 1 / 60);
      const hi = creatures.indexOf(c);
      if (hi >= 0) creatures.splice(hi, 1);
      killed++;
    });
    return killed;
  };
  const info = (tag) =>
    tag + '[sent=' + led26.sent + ' yield=' + led26.yield + '/' + load26 +
    ' live=' + H.gateLive(DIG26) + ' left=' + H.gateLeft(DIG26) +
    ' open=' + led26.open + ' goT=' + H.getGoT().toFixed(2) + ']';
  const log26 = [];
  // (a) THE BLOCK IS EMPTIED THE NORMAL WAY, AND THE BLOCK KEEPS BOOK OF WHAT IT SENT
  p.wx = 250;
  let guard = 0;
  while (!led26.open && guard++ < 12) { seedIn(DIG26, fams26, 12); shovelCrew(DIG26, 99); H.gateCheck(1 / 60); }
  log26.push(info('shoveled in the block'));
  check('THE BLOCK PUTS ITS PACK ON THE BEAT AND THE SHOVEL PAYS FOR IT: sent=' + led26.sent +
      ' of ' + load26 + ', every account settled, the ward is DOWN in ' + guard + ' sweeps',
    led26.open === true && led26.sent >= load26 && led26.yield >= led26.sent &&
      H.gateLive(DIG26) === 0 && H.gateLeft(DIG26) === 0,
    info('a'));
  check('...AND THE GO! ARROW LIT WITH IT: "' + H.getGoMsg() + '" at ' + H.getGoT().toFixed(2) + 's',
    H.getGoT() > 0 && /WALL IS DOWN!/.test(H.getGoMsg()));
  // (b) THE REPORTED STALL: an animal the fog takes back while he walks UP the street
  //     used to leave the block owing a spook it can never pay — the wall stood over an
  //     empty block forever. The fog-taken animal now settles the account.
  s7Reset();
  const led27 = H.gateLedger(VER26);
  const fams27 = H.nightBlockFamilies(VER26);
  const load27 = H.gateLoad(VER26);
  p.wx = 330; // standing in the VERMIN block
  seedIn(VER26, fams27, 12);
  const crew27 = creatures.filter((c) => c.home && c.home.i === VER26.i);
  const taken = crew27.slice(0, Math.min(3, crew27.length));
  const y0 = led27.yield;
  taken.forEach((c) => H.cull(c)); // the fog takes them back (the walk-up cull)
  log26.push(info('fog took ' + taken.length));
  check('THE FOG PAYS THE BLOCK TOO: ' + taken.length +
      ' animal(s) taken back while he was walking up the street settle ' +
      (led27.yield - y0) + ' of the debt (yield ' + led27.yield + '/' + load27 + ')',
      led27.yield === y0 + taken.length, info('b'));
  // (c) THE FULL WALK-BACK SCENARIO: clear a block, walk UP two blocks, let the street
  //     run — the cleared block must NOT be standing with a wall over an empty street
  s7Reset();
  const led28 = H.gateLedger(DIG26);
  p.wx = 250; seedIn(DIG26, fams26, 12); shovelCrew(DIG26, 99);
  const sent28 = led28.sent, yield28 = led28.yield;
  p.wx = 330; // he walks back UP into the VERMIN block
  for (let i = 0; i < 60 * 30; i++) H.updateNightHaunt(1 / 60); // 30s of the street running above it
  log26.push(info('30s up the street'));
  check('A BLOCK HE CLEARED IS NOT LEFT WEARING ITS WALL: after walking back up the street for 30s (sent ' +
      sent28 + ', shoveled ' + yield28 + '), its block is empty (' + H.gateLive(DIG26) +
      ' standing) and the ward is DOWN',
    H.gateLive(DIG26) === 0 && led28.open === true,
    info('c'));
  // (d) THE CHIP TELLS THE TRUTH ON A PAID-UP BLOCK: nothing standing, nothing owed
  check('THE CHIP SAYS THE TRUTH ON A PAID-UP BLOCK: ' + led28.name + " · " + H.gateLeft(DIG26) +
      " LEFT, ward down, nothing standing (the chip he is standing in — " + H.gateHud() + " — is the NEXT ward owed)",
    H.gateLeft(DIG26) === 0 && led28.open === true && H.gateLive(DIG26) === 0 &&
      /^[A-Z ’]+ · \d+ LEFT$/.test(H.gateHud()),
    H.gateHud());
  s7Reset();
  console.log('  DIAG ' + log26.join('  ·  '));
})();

console.log('\n[25] THE "GO!" ARROW: THE WARD COMES DOWN AND THE STREET SAYS IT — THE 16-BIT WAY-OUT CUE AT THE DEAD CENTRE OF THE SCREEN');
(function () {
  s7Reset();
  // the arrow now arms for the panel sweep PLUS the flash: the wall tears for
  // NIGHT_GATE_FADE seconds, then "GO!" burns for NIGHT_GO_FLASH
  const GO_ARM = NIGHT_GO_FLASH + NIGHT_GATE_FADE;
  const bands25 = H.nightBands();
  const cleared = bands25[0];
  const crew25 = creatures.filter((c) => c.home && c.home.i === cleared.i && !c.hooked && !c.hookLanded && HORROR_ALL[H.horrorKey(c)]);
  const load25 = H.gateLoad(cleared);
  // (a) THE WARD DROP LIGHTS THE ARROW: the block's horde gone + its load in the hopper,
  //     the ward falls, and the arrow takes the screen with the block's name on it
  for (let i = 0; i < load25; i++) H.gateYield({ i: cleared.i });
  crew25.slice().forEach((c) => { const k = creatures.indexOf(c); if (k >= 0) creatures.splice(k, 1); });
  H.setGoT(0);
  const opened25 = H.gateCheck(0.016);
  check('THE WARD FALLS AND THE ARROW LIGHTS WITH IT: ' + opened25 + ' ward down, the clock at ' + H.getGoT().toFixed(2) + 's, the line "' + H.getGoMsg() + '"',
    opened25 >= 1 && H.gateLedger(cleared).open === true &&
      Math.abs(H.getGoT() - GO_ARM) < 1e-9 &&
      /^[A-Z ’ ]+ WALL IS DOWN!$/.test(H.getGoMsg()),
    'open=' + H.gateLedger(cleared).open + ' opened=' + opened25 + ' t=' + H.getGoT() + ' msg=' + H.getGoMsg());
  // (b) IT RUNS ON ITS OWN CLOCK: it burns NIGHT_GO_FLASH seconds and goes out by itself
  let frames = 0;
  while (H.getGoT() > 0 && frames++ < 6000) H.goTick(1 / 60);
  check('THE ARROW BURNS FOR EXACTLY ITS FLASH (sweep time + flash) AND GOES OUT ON ITS OWN CLOCK (' +
    (frames / 60).toFixed(2) + 's of frames for a ' + GO_ARM + 's arm)',
    H.getGoT() === 0 && Math.abs(frames / 60 - GO_ARM) < 0.05,
    'frames=' + frames + ' t=' + H.getGoT());
  // (c) A NEW WARD DROP RE-LIGHTS IT, AND THE SHIFT RESET KILLS IT
  H.setGoT(0.4);
  H.goFlash({ name: "THE GRAVES", x: 96 });
  check('A NEW WARD DROP RE-LIGHTS IT AT FULL FLASH', Math.abs(H.getGoT() - GO_ARM) < 1e-9 && /^THE GRAVES WALL IS DOWN!$/.test(H.getGoMsg()));
  H.gateClear();
  check('...AND THE SHIFT RESET TAKES IT OFF THE STREET (no arrow standing over a fresh street)',
    H.getGoT() === 0 && H.getGoMsg() === "");
  // (d) THE WEEKDAYS NEVER SEE IT — the ward's own flash code, run against a day shift and
  //     against the night, in a state box the harness can read
  (() => {
    const st = { t: 0, msg: "" };
    const flash = new Function('NIGHT_GO_FLASH', 'st', 'isNightShift', 'NIGHT_GATE_FADE',
      srcFn('nightGoFlash')
        .replace(/\bnightGoT\b/g, 'st.t')
        .replace(/\bnightGoMsg\b/g, 'st.msg') +
      '\n;nightGoFlash({ name: "MANHATTAN" });');
    flash(NIGHT_GO_FLASH, st, () => false, NIGHT_GATE_FADE);
    const dayT = st.t, dayMsg = st.msg;
    flash(NIGHT_GO_FLASH, st, () => true, NIGHT_GATE_FADE);
    check('THE WEEKDAYS NEVER SEE IT: the same call on a day shift lights 0s and says nothing; on the night it lights ' + st.t + 's',
      dayT === 0 && dayMsg === "" && Math.abs(st.t - GO_ARM) < 1e-9 &&
      st.msg === "MANHATTAN WALL IS DOWN!");
  })();
  // (e) THE MARKUP + THE SKIN: a red chunky arrow pointing BOTTOM-LEFT with GO! in it,
  //     the block's line above it, slams in, blinks, nudges toward the way out
  check('THE MARKUP IS ON THE SCREEN: the panel, the line and the arrow',
    html.includes('id="night-go" class="hidden"') && html.includes('id="night-go-msg"') &&
      html.includes('id="night-go-arrow">GO!<'));
  const goCss = (html.match(/#night-go \{[\s\S]{0,900}?\}/) || [''])[0];
  const goRules = html.match(/#night-go \{[^}]*\}/g) || [];
  const goArrow = (html.match(/#night-go-arrow \{[\s\S]{0,1600}?\}/) || [''])[0];
  check('IT STANDS AT THE DEAD CENTRE OF THE SCREEN (full-viewport panel, flex-centred, taps pass through it) and goes hidden with the panel',
    /position: fixed/.test(goCss) && /inset: 0/.test(goCss) &&
      /align-items: center/.test(goCss) && /justify-content: center/.test(goCss) &&
      /pointer-events: none/.test(goCss) && /z-index: 26/.test(goCss) &&
      !/bottom: calc/.test(goCss) && !/left: calc/.test(goCss) &&
      /#night-go\.hidden \{\s*display: none;/.test(html),
    'inset=' + /inset: 0/.test(goCss) + ' hcentre=' + /justify-content: center/.test(goCss) +
      ' corner=' + /bottom: calc/.test(goCss));
  check('THE ARROW IS A RED 16-BIT CHUNK POINTING BOTTOM-LEFT: down-pointing clip-path, rotated onto the way out, GO! lettering',
    /clip-path: polygon\(\s*50% 100%,/.test(goArrow) && /transform: rotate\(40deg\)/.test(goArrow) &&
      /background: #ff3b4a/.test(goArrow) && /"Bangers"/.test(goArrow));
  check("THE ARROW IS BIG ENOUGH THAT \"GO!\" CANNOT BE CLIPPED: the block is a full 108px square and the clip-path STEMS are wide enough to hold the lettering (the stem spans 26%..74% of it)",
    /#night-go-arrow \{[^}]*width: 108px[^}]*height: 108px/.test(goArrow) &&
      (goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[1] === '26' &&
      (goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[2] === '74' &&
      (() => { // THE MEASURED FIT: 30px Bangers lettering, ~0.42em per glyph + spacing
        const fs = Number((goArrow.match(/font-size: (\d+)px/) || [])[1] || 0);
        const ls = Number((goArrow.match(/letter-spacing: ([\d.]+)px/) || [])[1] || 0);
        const stemPx = 108 * (Number((goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[2]) -
          Number((goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[1])) / 100;
        const wordPx = fs * 0.42 * 3 + ls * 2; // "GO!" = 3 glyphs + 2 gaps
        return fs === 30 && stemPx > wordPx;
      })(),
    goArrow.match(/font-size: (\d+)px/)[1] + 'px in a ' +
      ((goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[2] - (goArrow.match(/(\d+)% 0, (\d+)% 0/) || [])[1]) + '% stem');
  check('IT SLAMS IN, THE LINE BLINKS, THE ARROW NUDGES TOWARD THE EXIT, AND ITS LAST SECOND FLICKERS OUT',
    /animation: goSlam 0\.3s/.test(goCss) && /@keyframes goSlam/.test(html) &&
      /animation: goBlink 0\.72s/.test(html) && /@keyframes goBlink/.test(html) &&
      /animation: goNudge 0\.52s/.test(goArrow) && /@keyframes goNudge/.test(html) &&
      /#night-go\.go-out \{/.test(html) && /@keyframes goOut/.test(html));
  check('THE PHONES GET THE SAME CENTRE, NOT A CORNER: the small-screen block moves nothing (no bottom/left), and the arrow SHRINKS TO THE PHONE SIZE (74px / GO! 24px) WITHOUT EVER GOING BELOW the legible floor of its own lettering',
    goRules.length >= 2 &&
      goRules.every((r) => !/bottom:/.test(r) && !/left:/.test(r)) &&
      (html.match(/#night-go-arrow \{[^}]*\}/g) || []).some((r) => /width: 74px/.test(r) && /font-size: 24px/.test(r)) &&
      (() => {
        const m = (html.match(/#night-go-arrow \{[^}]*\}/g) || []).slice(-1)[0];
        const fs = Number((m.match(/font-size: (\d+)px/) || [])[1]);
      const stemPct = Number((m.match(/(\d+)% 0, (\d+)% 0/) || [])[2]) - 26 || 48; // the clip-path is inherited from the desktop rule (26%..74%)
        return fs === 24 && 74 * 0.48 > fs * 0.42 * 3 + 2; // stem wider than the word on the phone
      })() &&
      /#night-go-msg \{[^}]*max-width: 58vw/.test(html),
    'rules=' + goRules.length + ' corners=' + goRules.filter((r) => /bottom:|left:/.test(r)).length);
  // (f) ONLY THE NIGHT HUD LIGHTS IT, AND THE HUD RIDES ITS CLOCK (never on a weekday,
  //     never when the flash is out, never on the win screen)
  check('THE HUD DRIVES IT OFF THE CLOCK AND THE SHIFT, AND NOTHING ELSE',
    /const showGo =\s*isNightShift\(\) && NIGHT_BLOCK_GATES && nightGoT > 0 && state === "play";/.test(srcFn('updateHUD')) &&
      /goPanel\.classList\.toggle\("hidden", !showGo\)/.test(srcFn('updateHUD')) &&
      /goPanel\.classList\.toggle\("go-out", nightGoT <= 1\.0\)/.test(srcFn('updateHUD')));
  check('THE FRAME TICKS IT (the night block of the loop) AND THE WARD CODE LIGHTS IT (nightGateOpenLedger)',
    html.includes('nightGoTick(dt);') && /nightGoFlash\(led\);/.test(srcFn('nightGateOpenLedger')) &&
      /nightGoT = 0;/.test(srcFn('nightGateClear')) && /const NIGHT_GO_FLASH = /.test(html));
})();

console.log('\n[24] THE SCREEN QUIET LAW: the centre text is the PICKUP, and the red POW! is the WORKER\u2019S OWN PAIN');
const NIGHT_CENTRE_POPS = eval('(' + srcLiteral('NIGHT_CENTRE_POPS', '[', ']') + ')');
const POP_LIST = 'POWER UP! | RUN IT UP!';
check('THE CENTRE SCREEN ON MIDNIGHT IS THE PICKUP\u2019S \u2014 the only two words allowed are "POWER UP!" and "RUN IT UP!"',
  Array.isArray(NIGHT_CENTRE_POPS) && NIGHT_CENTRE_POPS.slice().sort().join(' | ') === POP_LIST.split(' | ').sort().join(' | '),
  JSON.stringify(NIGHT_CENTRE_POPS));
check('THE GATE SITS INSIDE announcePower ITSELF, and it ONLY bites on the night',
  /typeof isNightShift === "function" &&\s*isNightShift\(\) &&\s*NIGHT_CENTRE_POPS\.indexOf\(text\) < 0\s*\)\s*\n?\s*return;/.test(srcFn('announcePower')));
(() => {
  const popWith = (night, text) => {
    let appended = 0;
    const el = () => ({
      style: {}, className: '', textContent: '', parentNode: null,
      set className(v) { this.c = v; }, set textContent(v) { this.t = v; },
    });
    const D = {
      querySelectorAll: () => [],
      createElement: el,
      body: {
        appendChild(c) { appended++; c.parentNode = this; },
        removeChild(c) { if (c) c.parentNode = null; },
      },
    };
    new Function('document', 'setTimeout', 'isNightShift', 'NIGHT_CENTRE_POPS', 'text',
      srcFn('announcePower') + '\n;announcePower(text, "pop-power");')(
      D, (f) => (typeof f === 'function' ? f() : 0), () => night, NIGHT_CENTRE_POPS, text);
    return appended;
  };
  const shout = ['CONSECRATED!', 'SHOVEL TRIAD!', 'ABYSS SURGE!', 'THE BEAST IS UP!',
    'THE SLUG DEMON!', 'THE HEART IS OPEN!', 'THE BEAST IS LOOSE ON THE BLOCK!',
    'THE BEAST IS ANGRY!', 'THE BEAST IS BURSTING!', 'SLIME EVERYWHERE!',
    'RUBY-PLATED GARGOYLE! TAKE IT!', 'MIDNIGHT CLEARED!', 'THE FOG GANG IS CLEAR \u2014 THE WARD FALLS!'];
  check('ON MIDNIGHT the battle\u2019s big words are GONE from the centre of the screen (points, sound and meters still land): ' +
    shout.map((t) => t.split('!')[0] + '\u2192' + popWith(true, t)).join(' \u00b7 '),
    shout.every((t) => popWith(true, t) === 0),
    shout.map((t) => popWith(true, t)).join('/'));
  check('...and the two PICKUPS still flood the centre of the night screen',
    popWith(true, 'POWER UP!') === 1 && popWith(true, 'RUN IT UP!') === 1,
    popWith(true, 'POWER UP!') + '/' + popWith(true, 'RUN IT UP!'));
  check('THE WEEKDAYS keep the big text for everything (the same shouts, day shift)',
    shout.every((t) => popWith(false, t) === 1));
})();
check('THE WARD DROP\u2019S SHOUT IS A SHORT WORKER LINE NOW (it fits on the screen): ' + NIGHT_GATE_OPEN_LINES.join(' / '),
  NIGHT_GATE_OPEN_LINES.slice().sort().join(' | ') === ['THE BLOCK IS CLEAR!', 'THE WARD IS DOWN!', 'THE LIGHT BROKE!', 'ON TO THE NEXT BLOCK!', 'THE LAST ONE \u2014 SHOVELED!'].sort().join(' | ') &&
    NIGHT_GATE_OPEN_LINES.every((l) => l.length <= 26),
  NIGHT_GATE_OPEN_LINES.map((l) => l.length).join('/'));
check('THE BUBBLE WRAPS: a long line breaks onto more lines INSIDE the bubble instead of running off the screen',
  /\.bubble \{[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere;[\s\S]*?max-width: min\(62vw, 330px\);[\s\S]*?text-align: center;/.test(
    html.slice(html.indexOf('.bubble {'), html.indexOf('@keyframes bubblePop'))));
check('THE RED JAGGED POW! BURST IS THE WORKER\u2019S PAIN MARK ALONE \u2014 ward talk, consecration, triad, scurry and scares wear plain bubbles',
  !/"burst"/.test(srcFn('nightGateSay')) && !/"burst"/.test(srcFn('shovelBanish')) &&
    !/pick\(NIGHT_SCURRY_LINES\),[\s\S]{0,150}"burst"/.test(html) &&
    !/pick\(NIGHT_SCARE_LINES\),[\s\S]{0,150}"burst"/.test(html) &&
    !/ALL GHOSTS[\s\S]{0,200}"burst"/.test(html));
check('THE PUNCHBACK KEEPS ITS "POW!" AT THE FIST \u2014 as a plain worker line, never in the red burst skin',
  !/spawnBubble\("POW!",\s*fx,\s*fy,\s*"worker",\s*"burst"\)/.test(html) &&
    /Voice\.say\("POW!", 1\.1, 1\.2, fx, fy, WORKER_GENDER, "worker"\)/.test(html));
check('...while the hits the worker ACTUALLY TAKES keep their red burst (bullet graze, shootout shove, gator, zombie arm)',
  /Voice\.say\(pick\(BULLET_HIT_LINES\)[\s\S]{0,140}"burst"/.test(html) &&
    /Voice\.say\(pick\(SHOOTOUT_TOUCH_WORKER_LINES\)[\s\S]{0,190}"burst"/.test(html) &&
    /Voice\.say\(pick\(GATOR_WORKER_LINES\)[\s\S]{0,140}"burst"/.test(html) &&
    /Voice\.say\(pick\(ZOMBIE_WORKER_LINES\)[\s\S]{0,140}"burst"/.test(html));
check('the burst SKIN, the OW! auto-burst rule and the BEAST MODE marker are untouched',
  /\.bubble\.bub-burst \{/.test(html) && /style === "burst" \|\|/.test(html) &&
    /speaker === "worker" && \/\^ow\/i\.test\(String\(text\)\.trim\(\)\)/.test(html) &&
    /spawnBubble\("BEAST MODE!", p\.wx, p\.wy, "worker", "burst"\)/.test(html));

console.log("[28] THE FACING LAW: the shovel bites only what he FACES, and a swing never rotates him");
// (a) THE ROTATION IS GONE — the swing code never assigns his facing
check('the swing code carries NO facing snap at all — p.facing is never assigned by a shovel swing',
  srcFn('tryShovelSwing').indexOf('p.facing') < 0 &&
    srcFn('bossTakeShovelSwing').indexOf('p.facing =') < 0);
check('the rule is live: a front arc of ' + SHOVEL_FACE_ARC + '° — ±' + SHOVEL_FACE_ARC / 2 +
  '° around his facing — and the beast must be inside it to be cut; the stance marker key sits past the swing\'s own amplitude (' + SHOVEL_READY_KEY + ') so it never rides the swing',
  SHOVEL_FACE_RULE === true && SHOVEL_FACE_ARC > 90 && SHOVEL_FACE_ARC <= 270 &&
    SHOVEL_READY_KEY > 1.22 &&
    srcFn('bossTakeShovelSwing').includes('if (!shovelFacingOK(b.wx, b.wy)) return false;'));
check('THE FACING LAW runs on the grave furniture too (a headstone behind him is not on the swing)',
  srcFn('nearestShovelHazard').includes('!shovelFacingOK(hz.wx, hz.wy)'));
const ff28Start = html.indexOf('THE SHOVEL IS BETWEEN HIM AND THE TEETH');
const FFS28 = ff28Start >= 0 ? html.slice(ff28Start, ff28Start + 2600) : "";
check('THE PARRY IS DIRECTIONAL TOO: the blade defends only the side he is facing — a ghoul that comes in on his back takes its BITE (the facing law is a HARDER night, on purpose)',
  FFS28.includes('shovelFacingOK(c.wx, c.wy)') &&
    FFS28.indexOf('shovelFacingOK(c.wx, c.wy)') < FFS28.indexOf('shovelParry(') &&
    FFS28.includes('(p.nightHitT || 0) > 0'));
// (b) RUN IT: one ghoul in front, one at his back
nightOn = true; H.setCharge(0); H.clearNightBoss();
p.wx = 300; p.wy = 2.5; p.stunT = 0; p.stunDur = 0; p.shovelCd = 0; p.shovelGuardT = 0;
p.facing = 0; // dead east, standing still
const faceBefore = p.facing;
const frontGhoul = mkC('ghoul', 2.2);
const backGhoul = mkC('ghoul', -2.2);
creatures.length = 0; creatures.push(frontGhoul, backGhoul);
const faceLawSwing = H.swing();
check('THE SWING WOUNDS THE GHOUL HE FACES AND TOUCHES NOTHING AT HIS BACK — a clean wound on the front one, nothing on the back one',
  faceLawSwing === true && frontGhoul.hp === frontGhoul.hpMax - 1 &&
    backGhoul.hp === backGhoul.hpMax && backGhoul.hooked !== true && frontGhoul.hooked !== true,
  'front=' + frontGhoul.hp + '/' + frontGhoul.hpMax + ' back=' + backGhoul.hp + '/' + backGhoul.hpMax);
check('HE KEEPS HIS FACING — the swing does not drag him around, point him, or spin him on the catch',
  p.facing === faceBefore);
// (c) the back ghoul is answerable ONLY once he turns to it (the blade knocks a pack back,
// so the sim lays each ghoul on the blade before the swing that is meant to land on it)
function facePlace(c, dx) {
  c.wx = p.wx + dx; c.wy = p.wy; c.huntT = 0; c.flinchT = 0; c.backoffT = 0; c.touchCd = 0;
  if (c.g) c.g.position.set(c.wx, c.wy, GZ);
}
p.shovelCd = 0; p.shovelGuardT = 0; p.facing = Math.PI;
facePlace(backGhoul, -2.2); facePlace(frontGhoul, 2.2); // west = in front of him now, east = behind
const frontHpAfterB = frontGhoul.hp; // (b) already spent one swing on the front ghoul
const faceSwing2 = H.swing();
check('TURNING ON THE GHOUL AT HIS BACK is what makes the shovel land on it (the fight punishes a blind back)',
  faceSwing2 === true && backGhoul.hp === backGhoul.hpMax - 1 && frontGhoul.hp === frontHpAfterB,
  'front=' + frontGhoul.hp + '/' + frontHpAfterB + ' back=' + backGhoul.hp + '/' + backGhoul.hpMax);
check('and the ghoul he USED to face is now OUTSIDE his arc at blade distance — the same swing that bit it a moment ago cannot reach around',
  (() => {
    p.shovelCd = 0; p.shovelGuardT = 0; p.facing = Math.PI;
    facePlace(frontGhoul, 2.2); // IN RANGE, but straight BEHIND him
    const hpF = frontGhoul.hp;
    H.swing();
    return frontGhoul.hp === hpF && Math.hypot(frontGhoul.wx - p.wx, frontGhoul.wy - p.wy) <= SHOVEL_REACH + SHOVEL_BLADE_R;
  })());
// (d) the shape of the arc, measured with the game's own law
p.wx = 300; p.wy = 2.5; p.facing = 0;
check('THE ARC, AS THE GAME COMPUTES IT: 100° off his facing is ON the swing, 130° off is NOT',
  H.shovelFacingOK(300 + Math.cos(1.745) * 2.5, 2.5 + Math.sin(1.745) * 2.5) === true &&
    H.shovelFacingOK(300 + Math.cos(2.27) * 2.5, 2.5 + Math.sin(2.27) * 2.5) === false);
check('a ghoul standing straight behind him (180° off) is OUTSIDE the tool entirely',
  H.shovelFacingOK(298, 2.5) === false);

console.log("[29] MIDNIGHT: HELL NOTES, THE BAT-READY SHOVEL, and NOTHING WITH WINGS ON THE DEAD STREET");
nightOn = true;
check('THE MIDNIGHT WORD: the cash tally is HELL NOTES, and it reaches every surface — the HUD line (bonus-label), the pickup pill, the reward popup, the shift report',
  NIGHT_CASH_NAME === "HELL NOTES" && H.cashName() === "HELL NOTES" &&
    html.includes('<span id="bonus-label">STREET CASH</span>') &&
    srcFn('updateHUD').includes('cashLbl.textContent !== wantCash') &&
    html.includes('cash: { text: cashName() + "!", cls: "pop-cash" }') &&
    html.includes('const kindLabel = kind === "cash" ? cashName() : meta.label;') &&
    html.includes('statRow(cashName(), s.cash.got, s.cash.total, true, idx++)'),
  'name=' + JSON.stringify(NIGHT_CASH_NAME) + ' H=' + JSON.stringify(H.cashName && H.cashName()));
nightOn = false;
check('the seven weekdays keep STREET CASH everywhere (HUD, popup, pill, report)',
  H.cashName() === "STREET CASH");
nightOn = true;
// THE BAT-READY SHOVEL (sampled off the game's own pose rig, with the tool IN HIS HANDS)
S6.equipShovel(true);
const batHeld = S6.getShovel();
const tipOf = () => {
  // the SAME Euler math the renderer multiplies: the tool's own +X (its blade direction)
  // runs to (cos y, sin x sin y, -cos x sin y); the head sits ~1.7u out from the fists.
  const ex = batHeld.rotation.x, ey = batHeld.rotation.y;
  const uy = Math.sin(ex) * Math.sin(ey), uz = -Math.cos(ex) * Math.sin(ey);
  return {
    az: uz, // > 0 = the blade points UP
    y: batHeld.position.y + 1.7 * uy, // the blade tip's side (y+ = HIS LEFT, y- = HIS RIGHT)
    z: batHeld.position.z + 1.7 * uz, // the blade tip's height
  };
};
// where each glove actually lands in the rig, from the arm angles the stance set on them
const fist = (side, ex, ey) => ({
  x: -0.52 * Math.sin(ey),
  y: side * 0.29 + 0.52 * Math.sin(ex) * Math.cos(ey),
  z: 1.38 - 0.52 * Math.cos(ex) * Math.cos(ey),
});
S6.poseShovel(0);
const dipTip = tipOf();
const batOut = S6.poseShovelReady();
const batTip = tipOf();
const batArms = { rx: S6_ARMR.rotation.x, ry: S6_ARMR.rotation.y, lx: S6_ARML.rotation.x, ly: S6_ARML.rotation.y };
const rfist = fist(-1, batArms.rx, batArms.ry), lfist = fist(1, batArms.lx, batArms.ly);
// the nearest the shaft (the line through both fists, extended to the blade) comes to his
// skull: the head is drawn at (0, 0, 1.8) with a 0.24u radius
const batClear = () => {
  const ax = lfist.x - rfist.x, ay = lfist.y - rfist.y, az = lfist.z - rfist.z;
  const bx = 0 - rfist.x, by = 0 - rfist.y, bz = 1.8 - rfist.z;
  const aa = ax * ax + ay * ay + az * az;
  const t = aa > 1e-9 ? (ax * bx + ay * by + az * bz) / aa : 0;
  return Math.hypot(ax * t - bx, ay * t - by, az * t - bz);
};
S6.poseShovel(0.3); // the coil pose the old stance rode (the LEFT-shoulder, lefty carry)
const coilTip = tipOf();
const SHOVEL_HOLD30 = S6.hold;
function SH15bKeys() {
  const K = SHOVEL_HOLD30 && SHOVEL_HOLD30.keys, Rd = SHOVEL_HOLD30 && SHOVEL_HOLD30.ready;
  if (!K || K.length !== 5 || SHOVEL_HOLD30.max !== 1.22 || !Rd) return false;
  return Rd.r.length === 2 && Rd.l.length === 2 && SHOVEL_READY_KEY > 1.22;
}
check('the stance is a pose of its own (SHOVEL_HOLD.ready, solved by poseShovelReady) — the swing curve keeps its five keys and its 1.22 top amplitude, so NO swing frame ever samples the stance, and the stance marker rides past the swing (key ' + SHOVEL_READY_KEY + ')',
  SH15bKeys() && !!batOut && batOut.twist === 0 && batOut.lean === 0 &&
    html.includes('if (shovelArm >= 0 && sw >= 1.06 && swPrev < 1.06)'));
check('HE CARRIES IT AS A RIGHT-HANDED HITTER: BOTH fists on his RIGHT side, the right hand LOW on the knob at his hip and the left hand crossed above it on the shaft — the plate grip, with the hands 0.41u apart along the handle',
  rfist.y < -0.02 && lfist.y < -0.02 && rfist.z < lfist.z && rfist.x > -0.05 && lfist.x > 0.2 &&
    Math.hypot(lfist.x - rfist.x, lfist.y - rfist.y, lfist.z - rfist.z) < 0.52,
  'right fist y ' + rfist.y.toFixed(2) + ' z ' + rfist.z.toFixed(2) + ' | left fist y ' + lfist.y.toFixed(2) + ' z ' + lfist.z.toFixed(2));
check('THE SHOVEL IS ON HIS RIGHT SIDE AND COCKED UP LIKE A BAT OVER THE RIGHT SHOULDER — the blade flipped from HIS LEFT (the old lefty carry, what looked wrong) to his RIGHT side, at a STEEPER angle than the old carry had',
  coilTip.y > 0.3 && batTip.y < -0.03 && batTip.az > coilTip.az && batTip.az > 0.6,
  'blade side ' + coilTip.y.toFixed(2) + ' (LEFT) -> ' + batTip.y.toFixed(2) + ' (RIGHT), rise ' + coilTip.az.toFixed(2) + ' -> ' + batTip.az.toFixed(2));
check('HELD LIKE A BASEBALL BAT, NOT DRAGGED AT THE GROUND: the blade finishes in the air above the shoulder line with its tip OVER his head height (his shipped walking carry aims it at the asphalt)',
  batTip.z > 1.95 && batTip.az > 0.6 && dipTip.az < -0.3 && dipTip.z < 1.8,
  'blade rise ' + batTip.az.toFixed(2) + ', tip z ' + batTip.z.toFixed(2) + ' (head top ~1.95), tip on his right at y ' + batTip.y.toFixed(2) + '; walking carry rise ' + dipTip.az.toFixed(2) + ' tip z ' + dipTip.z.toFixed(2));
check('BOTH FISTS STAY ON THE WOOD IN THE STANCE, each a true 0.52u arm out of its own shoulder, and the shaft CLEARS HIS HEAD — the nearest it comes to his skull (r 0.24) is ' + batClear().toFixed(2) + 'u',
  Math.hypot(rfist.x, rfist.y + 0.29, rfist.z - 1.38) > 0.5 &&
    Math.hypot(lfist.x, lfist.y - 0.29, lfist.z - 1.38) > 0.5 &&
    Math.hypot(rfist.x, rfist.y + 0.29, rfist.z - 1.38) < 0.54 &&
    Math.hypot(lfist.x, lfist.y - 0.29, lfist.z - 1.38) < 0.54 &&
    batClear() > 0.3, 'closest shaft-to-skull distance ' + batClear().toFixed(3));
check('THE PLAY LOOP RUNS IT: no swing = the right-handed ready pose; the moment a swing is live the curve takes the tool back, and the stance adds no twist and no lean (he stands square to where he faces)',
  html.includes('const batUp = !(p.shovelT > 0);') &&
    html.includes('const hold = batUp ? poseShovelReady() : poseShovel(sw);') &&
    html.includes('shovelTwist = 0; // the stance is SQUARE: no twist, no lean over the blade'));
// NO BIRDS
check('NO BIRDS ON MIDNIGHT: the pigeon flocks are seeded at zero, the seed-birds never come in, and the blue jay and her nest never exist',
  NIGHT_NO_BIRDS === true && H.nightBirdsBanned() === true &&
    html.includes('const flockCount = nightBirdsBanned()') &&
    srcFn('spawnSeedBirds').includes('if (nightBirdsBanned()) return;') &&
    html.includes('if (isStatenIslandLevel() && !nightBirdsBanned()) {'));
nightOn = false;
check('the seven weekdays keep every bird they have (flocks, seed pigeons, the Staten Island jay)',
  H.nightBirdsBanned() === false);
nightOn = true;

console.log("[30] THE HELL NOTES: Midnight pays in Chinese joss money, laid on the walk and in the road");
// (a) THE WIRING IN THE SHIP
check("Midnight's cash find is JOSS PAPER, and the seven weekdays keep the American bill (one switch, at the source of every cash find)",
  srcFn('makeCashPickup').includes('? makeHellNote()') &&
    srcFn('makeCashPickup').includes(': makeCash();') &&
    srcFn('spawnCash').includes('const g = makeCashPickup();') &&
    srcFn('spawnBonus').includes('g = makeCashPickup(); // Midnight: a pair of HELL NOTES, not American paper'));
check('the night lays its notes at the source of the haunted street (spawnNightShift runs spawnHellNotes on the bands)',
  srcFn('spawnNightShift').includes('spawnHellNotes(bands)'));
check('the notes run the SAME payout pipeline as street cash — $100 per find into the cash tally, which is what feeds the healer power-ups',
  srcFn('spawnCash').includes('val: 100,') && srcFn('spawnCash').includes('type: "cash",') &&
    html.includes('const POWERUP_CASH_STEP = 5000') &&
    /if \(state === "play" && bonusTally >= healerNextAt\)[\s\S]{0,140}spawnHealerNearPlayer\(\)/.test(html));
// (b) THE MODEL, BUILT BY THE GAME'S OWN CODE
const HN30 = new Function('THREE', 'M', 'BX', 'R', 'isNightShift', 'makeCash',
  srcFn('makeHellNote') + '\n' + srcFn('makeCashPickup') +
  '\nreturn { makeHellNote, makeCashPickup };')(
  THREE, M, BX, R, () => nightOn, () => mkObj('usaBills'));
nightOn = true;
const note = HN30.makeHellNote();
const note1 = note.children[0];
const parts = note1.children.map((c) => (c.material && c.material.color ? c.material.color.hex : -1));
check('THE HELL NOTE is joss money, not USA paper: gold-yellow ceremonial paper, a red block frame, a round vermilion seal, the spirit-bank plate, a column of square ink characters, the big value character and the gilt fold',
  note.children.length === 2 && note.userData.hellNote.notes === 2 &&
    note1.children.length >= 11 &&
    parts.indexOf(0xf2c94c) === 0 && // the paper is joss gold, first part of the note
    parts.filter((p) => p === 0xba2b1e).length >= 5 && // the printed red frame + plate
    parts.indexOf(0xc33a22) >= 0 && // the vermilion seal
    parts.filter((p) => p === 0x231d18).length >= 4, // the ink characters
  'note1 parts=' + note1.children.length + ' colors=' + JSON.stringify(parts.map(p => p.toString(16))));
check('the note carries the same footprint as a cash find (a wide flat paper note, two of them fanned), so pickup, flight, hopper and payout all read it as cash',
  note1.children[0].position.z === 0.01 && note.children[1].position.z > note.children[0].position.z &&
    Math.abs(note.children[0].position.x) <= 0.06 && Math.abs(note.children[1].position.y) <= 0.06);
check('midnight cash picks the JOSS model, weekday cash keeps the American bill',
  !!HN30.makeCashPickup().userData.hellNote &&
    (nightOn = false, HN30.makeCashPickup().userData.hellNote === undefined) && (nightOn = true, true));
// (c) THE PLACEMENT: the game's own laying-out code, run on tonight's bands
const NIGHT_HELL_NOTE_PICKS30 = srcNum('NIGHT_HELL_NOTE_PICKS');
const W0 = srcNum('HELL_NOTE_WALK_Y0'), W1 = srcNum('HELL_NOTE_WALK_Y1');
const RD0 = srcNum('HELL_NOTE_ROAD_Y0'), RD1 = srcNum('HELL_NOTE_ROAD_Y1');
check('the bands of the layout are real: a sidewalk spread and a roadway spread (the walk ' + W0 + '..' + W1 + ', the road ' + RD0 + '..' + RD1 + '), and a per-night count of ' + NIGHT_HELL_NOTE_PICKS30,
  NIGHT_HELL_NOTE_PICKS30 >= 8 && W0 > 1 && W1 <= 5 && RD0 < -1 && RD1 < 0);
const laid30 = [];
const spawnHellNotes30 = new Function('R', 'BLOCK_W', 'NIGHT_HELL_NOTE_PICKS',
  'HELL_NOTE_WALK_Y0', 'HELL_NOTE_WALK_Y1', 'HELL_NOTE_ROAD_Y0', 'HELL_NOTE_ROAD_Y1', 'spawnCash',
  srcFn('spawnHellNotes') + '\nreturn spawnHellNotes;')(
  R, 80, NIGHT_HELL_NOTE_PICKS30, W0, W1, RD0, RD1, (wx, wy) => laid30.push({ wx: wx, wy: wy }));
const bands30 = [{ x0: 384 }, { x0: 288 }, { x0: 192 }, { x0: 96 }];
let laidN = 0;
for (let run = 0; run < 8; run++) {
  laid30.length = 0;
  laidN = spawnHellNotes30(bands30);
  if (!laid30.every((l) => bands30.some((b) => l.wx >= b.x0 + 8 && l.wx <= b.x0 + 72))) laidN = -1;
  const onWalk = laid30.filter((l) => l.wy >= W0 && l.wy <= W1).length;
  const inRoad = laid30.filter((l) => l.wy >= RD0 && l.wy <= RD1).length;
  if (onWalk + inRoad !== laid30.length || onWalk === 0 || inRoad === 0) laidN = -1;
  if (run === 0) var walkN = onWalk, roadN = inRoad, totalN = laid30.length;
}
check('TONIGHT THE STREET PAYS: ' + totalN + ' HELL NOTES laid down — ' + walkN + ' on the sidewalk and ' + roadN +
  ' out in the roadway, every one inside a block of the haunted route, on every run of the roll',
  laidN === NIGHT_HELL_NOTE_PICKS30 && totalN === NIGHT_HELL_NOTE_PICKS30 &&
    walkN === NIGHT_HELL_NOTE_PICKS30 / 2 && roadN === NIGHT_HELL_NOTE_PICKS30 / 2,
  'laid=' + totalN + ' walk=' + walkN + ' road=' + roadN);
check('an empty route lays nothing (no crash, no notes in the fog)', spawnHellNotes30([]) === 0);

console.log("\n[31] THE SPOOK PAYS WHERE IT STOOD: a shoveled creature drops a HELL NOTE on the ground");
// (a) THE WIRING IN THE SHIP
check('the drop is wired at the moment the spook lands in the hopper (landSpookInHopper) — the banishment itself lays the note down',
  srcFn('landSpookInHopper').includes('dropShovelHellNote(') && NK_ON === true && NK_CAP >= 4);
check('the note goes in through the ONE cash door the street already uses (spawnCash -> makeCashPickup -> $100 "cash" bonus), so a kill-drop is an ordinary collectible find, and the door itself is untouched',
  srcFn('dropShovelHellNote').includes('spawnCash(') &&
    srcFn('spawnCash').includes('const g = makeCashPickup();') &&
    srcFn('spawnCash').includes('val: 100,') && srcFn('spawnCash').includes('type: "cash",'));
check('the drop is NIGHT-ONLY and kill-ONLY: the wound path (a blow that leaves the spook walking) and the weekday shovel code never touch it, the boss fight pays through its own gargoyle path, and the parry route pays the same way a strike does (through the landing)',
  srcFn('nightWoundShovel').includes('dropShovelHellNote') === false &&
    srcFn('bossTakeShovelSwing').includes('dropShovelHellNote') === false &&
    srcFn('shovelStrike').includes('dropShovelHellNote') === false &&
    srcFn('shovelParry').includes('shovelStrike(c)') &&
    srcFn('dropShovelHellNote').includes('isNightShift()'));
// (b) THE DROP ITSELF: the game's own functions, running on the night
nightOn = true;
NK_NOTES.length = 0;
const payRoad = H.dropNote(300, -3.5), payWalk = H.dropNote(320, 2.5), payCurb = H.dropNote(340, 0.6),
  payFar = H.dropNote(360, 9), payDeep = H.dropNote(380, -9);
check('EVERY BANISHED SPOOK PAYS: one NOTE per kill, dropped where the spook stood — roadway kill, sidewalk kill, curb-strip kill, a spook killed out past the curb or past the road all drop, and the sandbox saw 5 kills, 5 notes',
  NK_NOTES.length === 5 && [payRoad, payWalk, payCurb, payFar, payDeep].every(Boolean),
  'notes=' + NK_NOTES.length);
check('AND THE NOTE ALWAYS LANDS WHERE HE CAN WALK TO IT: every drop is inside the sidewalk band ' + NK_W0 + '..' + NK_W1 + ' or the roadway band ' + NK_R0 + '..' + NK_R1 + ' — the curb strip and out-of-bounds kills get CLAMPED to the nearest band, never left in no-man\u0027s-land',
  NK_NOTES.every((n) => (n.wy >= NK_W0 && n.wy <= NK_W1) || (n.wy >= NK_R0 && n.wy <= NK_R1)) &&
    NK_NOTES.every((n) => Math.abs(n.wy) > 1.0),
  'drops=' + NK_NOTES.map((n) => n.wy.toFixed(2)).join(','));
nightOn = false;
const nkBefore = NK_NOTES.length;
const nkWk = H.dropNote(300, 2.5);
check('THE SEVEN WEEKDAYS PAY IN NOTHING: the kill-drop is gated to the haunted street (no notes on a weekday shift, no crash)',
  nkWk === false && NK_NOTES.length === nkBefore);
nightOn = true;
for (let i = 0; i < NK_CAP; i++) NK_BONUSES.push({ type: 'cash', wx: 0, wy: 0 });
const nkBefore2 = NK_NOTES.length;
const nkCapped = H.dropNote(300, 2.5);
check('NO CASH BLIZZARD: with ' + NK_CAP + ' pickups already lying on the street, a kill drops nothing (the street stays legible, the pile stays worth walking to)',
  nkCapped === false && NK_NOTES.length === nkBefore2);
NK_BONUSES.length = 0;
// (c) THE FULL KILL, START TO FINISH: strike, arc, land — and the note on the ground
const nkEcto0 = H.getEcto(), nkNotes0 = NK_NOTES.length;
const nkPaid = mkC('specter', 4, { hooked: true, hookT: 0, fx0: p.wx + 5, fy0: 3.0, fz0: GZ + 0.5 });
let nkP = 0;
while (!nkPaid.hookLanded && nkP++ < 600) H.shovelFlight(nkPaid, 1 / 60);
check('A SPOOK SHOVELED INTO THE HOPPER DROPS EXACTLY ONE HELL NOTE ON THE SPOT IT STOOD — one note, at the strike point, and the eco/score payout is unchanged',
  nkPaid.hookLanded === true && H.getEcto() === nkEcto0 + 1 &&
    NK_NOTES.length === nkNotes0 + 1 &&
    Math.abs(NK_NOTES[NK_NOTES.length - 1].wx - (p.wx + 5)) <= 0.71 &&
    NK_NOTES[NK_NOTES.length - 1].wy >= NK_W0 && NK_NOTES[NK_NOTES.length - 1].wy <= NK_W1,
  'notes=' + (NK_NOTES.length - nkNotes0) + ' at ' + (NK_NOTES[NK_NOTES.length - 1] || {}).wx);
const nkWound = mkC('ghoul', 3, { fx0: p.wx + 3, fy0: 2.2 });
const nkHits = H.ghHits(900, 'ghoul');
const nkNotesA = H.dropNotes().length;
creatures.length = 0; creatures.push(nkWound);
let nkSwings = 0, nkWoundPaid = false, nkKilled = false;
while (nkSwings < 40 && !nkWound.hookLanded) {
  p.shovelCd = 0; p.facing = 0;
  // the wound knocks it back and it walks off — stand it back in front of the blade
  nkWound.wx = p.wx + 3; nkWound.wy = 2.2;
  if (nkWound.g) nkWound.g.position.set(nkWound.wx, nkWound.wy, GZ);
  if (H.swing() !== true) break;
  nkSwings++;
  if (H.dropNotes().length > nkNotesA) nkWoundPaid = true; // a wound paid out: the bug we are hunting
  if (nkWound.hooked) {
    let g = 0;
    while (!nkWound.hookLanded && g++ < 600) H.shovelFlight(nkWound, 1 / 60);
    nkKilled = true;
  }
}
check('A WOUND PAYS NOTHING: ' + nkSwings + ' BLOWS on one ghoul (' + nkHits + ' in its pool), ZERO notes for the wounds — the single note lands when the last blow puts it in the scoop, every banishment paid exactly once',
  nkSwings === nkHits && nkKilled === true && nkWound.hookLanded === true &&
    nkWoundPaid === false && H.dropNotes().length === nkNotesA + 1,
  'swings=' + nkSwings + ' hits=' + nkHits + ' killed=' + nkKilled + ' notes=' + (H.dropNotes().length - nkNotesA));
// (d) THE PAYCHAIN: the note is street cash, and street cash is what buys the healers
check('THE KILL NOTE FEEDS THE SAME ECONOMY AS THE STREET\u0027S OWN NOTES — banked HELL NOTES drive the coffee / BEC drops on the same cash step',
  /const POWERUP_CASH_STEP = (\d+)/.test(html) &&
    html.includes('if (state === "play" && bonusTally >= healerNextAt)') &&
    srcFn('cashName').includes('NIGHT_CASH_NAME') && NIGHT_CASH_NAME === 'HELL NOTES');
check('THE NOTE IS MADE OF THE SAME JOSS PAPER as the ones laid at clock-in (the pickup swap is one door: makeCashPickup), so the kill drop and the street spread look identical',
  srcFn('makeCashPickup').includes('? makeHellNote()'));

console.log("\n[32] THE CLOCK-IN LOOK: at Midnight he faces DOWN the street and to the LEFT");
nightOn = true;
const faceNight = H.playerSpawnFacing();
nightOn = false;
const faceDay = H.playerSpawnFacing();
nightOn = true;
check('HE CLOCK IN FACING DOWN-AND-LEFT: the night spawn facing is ' + NK_FACE + ' rad — downhill (' + Math.cos(NK_FACE).toFixed(2) + ' on the route axis) tilted to the LEFT (' + Math.sin(NK_FACE).toFixed(2) + ' on the lane axis), toward the sidewalk side, NOT up at the truck',
  faceNight === NK_FACE && Math.cos(NK_FACE) < -0.7 && Math.sin(NK_FACE) > 0.3,
  'facing=' + NK_FACE + ' vector=(' + Math.cos(NK_FACE).toFixed(2) + ',' + Math.sin(NK_FACE).toFixed(2) + ')');
check('...and the flip is exact: the dead-end route runs DOWNHILL (routeDir ' + H.routeDir() + '), so he now clock-ins facing THE WAY THE SHIFT RUNS — the EXACT 180° opposite of the up-and-right face (5.6616) he clocked in with before',
  H.routeDir() < 0 && Math.cos(NK_FACE) * H.routeDir() > 0.7 &&
    Math.abs(NK_FACE - (Math.PI - 0.62)) < 0.01 &&
    Math.abs(NK_FACE - (5.6616 - Math.PI)) < 0.02);
check('the seven weekdays clock in facing UP the street exactly as shipped (the night face is the tilt alone)',
  faceDay === 0 && Math.cos(faceDay) === 1);
check('THE SPAWN CODE WEARS IT: the shift reset hands his facing to the worker and the rig draws him from that facing (the shovel twist rides on top of it, never replacing it)',
  srcFn('resetWorldState').includes('p.facing = playerSpawnFacing();') &&
    html.includes('worker.group.rotation.z = p.facing - shovelTwist;') &&
    html.includes('p.facing = playerSpawnFacing(); // ...and he clocks in facing DOWN the street, tilted to the left'));
const RWS32 = srcFn('resetWorldState').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
check('AND NOTHING ERASES IT ANYMORE: the start routine that sets his clock-in facing used to END with a hard zero snap that silently overwrote the night face on EVERY start (the reason the level kept opening facing the wrong way). The reset now assigns his facing exactly twice, both from the spawn source, and carries NO hardcoded zero',
  RWS32.indexOf('p.facing = 0;') < 0 &&
    RWS32.split('p.facing =').length - 1 === 2 &&
    RWS32.split('p.facing =').every((chunk, i) => i === 0 || chunk.trim().indexOf('playerSpawnFacing();') === 0) &&
    RWS32.indexOf('p.wx = playerSpawnX();') < RWS32.indexOf('p.facing = playerSpawnFacing();'));
check('the facing law, the bat-ready stance and the shovel kit all read p.facing from the same source — the clock-in number is the ONLY number the swing aims by',
  srcFn('shovelFacingOK').includes('p.facing') &&
    srcFn('nearestShovelHazard').includes('shovelFacingOK(hz.wx, hz.wy)') &&
    srcFn('tryShovelSwing').indexOf('p.facing =') < 0 &&
    html.includes('const hold = batUp ? poseShovelReady() : poseShovel(sw);'));
// THE SHOVEL LAW AIMED WITH HIM: standing at the clock-in facing, the front arc is the
// down-and-left half of the street
p.wx = 449; p.wy = 2.5; p.facing = faceNight;
const aheadDownLeft = H.shovelFacingOK(p.wx + Math.cos(faceNight) * 3, p.wy + Math.sin(faceNight) * 3);
const deadBehind = H.shovelFacingOK(p.wx - Math.cos(faceNight) * 3, p.wy - Math.sin(faceNight) * 3);
const squareRight = H.shovelFacingOK(p.wx, p.wy - 5);
check('THE FIRST SWING IS AIMED WHERE HE IS LOOKING: at the clock-in facing the shovel bites a spook straight down-and-left of him, NOT one standing behind him at the truck end, and NOT one out on his right in the roadway (the 210° facing law rides the same number)',
  aheadDownLeft === true && deadBehind === false && squareRight === false,
  'ahead=' + aheadDownLeft + ' behind=' + deadBehind + ' right=' + squareRight);
p.facing = 0;

console.log("\n[33] THE CURTAIN SPANS THE WHOLE STREET: from the building line on the screen's left to the far edge of the screen's right");
// THE GAME'S OWN WARD BUILDER, measured against tonight's BUILDING LINES. The suite's THREE
// mock keeps positions (not box dims), so the panel/bead POSITIONS carry the measurement and
// the source carries the rail / core / glow lengths that ride with them.
const w33 = H.makeSpectralWard();
const wSrc33 = srcFn('makeSpectralWard');
const wPanels = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - 2.0) < 1e-9);
const wRails = w33.children.filter((c) => c.kind === 'box' && (Math.abs(c.position.z - (0.3 + 3.4 * 0.82)) < 1e-9 || Math.abs(c.position.z - (0.3 + 0.42)) < 1e-9));
const wBeads = w33.children.filter((c) => c.kind === 'sph');
const wGlow = w33.children.filter((c) => c.kind === 'light');
const wLo = Math.min(...wPanels.map((c) => c.position.y)) - 0.45; // panel half-width
const wHi = Math.max(...wPanels.map((c) => c.position.y)) + 0.45;
const wMid = -8.5 + NK_WARD_SPAN - NK_WARD_SPAN_L + ((NK_WARD_PANELS - 1) * 1.45) / 2;
// THE WARD'S OWN RECORD + THE GAME'S OWN FALLING LOOP, extracted and run live
const wRec33 = w33.userData.ward;
const an33 = srcFn('nightGateAnimate');
const sweep33 = (an33.match(/if \(ward\.panels && ward\.panels\.length > 1\) \{[\s\S]*?\n            \}/) || [''])[0];
const runSweep33 = new Function('ward', 'kk', 'NIGHT_WARD_DEATH_BAND', sweep33);
const fadeAll33 = (kk) => {
  for (let m = 0; m < wRec33.mats.length; m++) wRec33.mats[m].opacity = wRec33.base[m] * kk * 0.9;
  runSweep33(wRec33, kk, NK_WARD_BAND);
};
const zTop = 0.3 + 3.4; // GZ + H: the panels' own top edge
const wLintel = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (zTop + 0.62)) < 1e-9);
const wCord = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (zTop + 0.3)) < 1e-9);
const wFringe = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (zTop - 0.18)) < 1e-9);
const wBleed = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (0.3 - 0.35 + 0.04)) < 1e-9);
const wPool = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (0.3 - 0.35 + 0.02)) < 1e-9);
const wHaze = w33.children.filter((c) => c.kind === 'box' && Math.abs(c.position.z - (0.3 + 3.4 * 0.24)) < 1e-9);
const wLintZ = wLintel.length ? wLintel[0].position.z : -1;
const wPanTop = zTop; // the panels stand 0.3..3.7 in model z
const wBleedZ = wBleed.length ? wBleed[0].position.z : 99;
const wPoolZ = wPool.length ? wPool[0].position.z : 99;
check('THE CURTAIN IS BUILT FOR THE FULL STREET: ' + NK_WARD_PANELS + ' panels (was 12) spanning ' + NK_WARD_SPAN + 'u onto the stoop line and ' + NK_WARD_SPAN_L + 'u past the far gutter — the built curtain lays ' + wLo.toFixed(2) + ' .. ' + wHi.toFixed(2) + ' across the lane',
  NK_WARD_PANELS >= 17 && NK_WARD_SPAN >= 1.5 && NK_WARD_SPAN_L >= 3 &&
    wPanels.length === NK_WARD_PANELS && wBeads.length === NK_WARD_PANELS &&
    wRails.length === 2 && wGlow.length === 1 &&
    wHi - wLo >= (NK_WARD_PANELS - 1) * 1.45,
  'panels=' + wPanels.length + ' span=' + wLo.toFixed(2) + '..' + wHi.toFixed(2));
check('IT RUNS THE FULL LENGTH, BUILDING LINE TO BUILDING LINE: past the roadway\'s far gutter on the RIGHT of the screen (' + wLo.toFixed(2) + ', the parked-car lane sits at ' + NK_STREET_Y + ') and past the stoop / lawn line on the LEFT (' + wHi.toFixed(2) + ', the lawn line sits at ' + NK_LAWN_Y + ') — the light is off-screen at BOTH edges, so the street is completely blocked',
  wLo <= NK_STREET_Y - 2 && wHi >= NK_LAWN_Y + 5.5,
  'wall covers ' + wLo.toFixed(2) + ' .. ' + wHi.toFixed(2) + ' (far gutter ' + NK_STREET_Y + ', stoop line ' + NK_LAWN_Y + ')');
check('AND IT OVERRUNS HIS OWN WALKING LIMIT ON THE RIGHT: the wall runs past the lane floor he can ever stand on (his clamp floor is ' + NK_WALK_MIN + 'u), and past every living thing\'s lane (HORROR_STREET_Y ' + NK_STREET_Y + ') — ' + (Math.abs(wLo) - Math.abs(+NK_WALK_MIN)).toFixed(2) + 'u of light beyond the farthest he can walk, so the wall can never be reached around',
  wLo <= +NK_WALK_MIN - 1.0 && wLo <= NK_STREET_Y - 2 &&
    /clamp\(p\.wy[^,]+, -9\.4, workerMaxY\(\)/.test(html),
  'wall end ' + wLo.toFixed(2) + ' vs floor ' + NK_WALK_MIN + ' vs ghoul lane ' + NK_STREET_Y);
check('THE TOP IS SEALED — PAVEMENT TO SKY: a lintel arch spans the whole run above the panels with a sagging cord under it and 4 fringe hems hanging off the top (lintel at z ' + wLintZ.toFixed(2) + ' over the panel tops at z ' + wPanTop.toFixed(2) + '), so the block reads as a wall, not a waist-high picket line',
  wLintel.length === 1 && wCord.length === 1 && wFringe.length === 4 &&
    wLintZ > wPanTop && wLintZ > 0.3 + 3.4 + 0.2 && wLintZ < 0.3 + 3.4 + 1.2 &&
    Math.abs(wLintel[0].position.y - wMid) < 1e-9 &&
    Math.abs(wCord[0].position.y - wMid) < 1e-9 &&
    /THE SEALED TOP/.test(wSrc33) &&
    /lintel\.position\.set\(0, MID, GZ \+ H \+ 0\.62\)/.test(wSrc33) &&
    wRec33.lint != null && wRec33.cord != null && wRec33.fringe.length === 4 &&
    wRec33.mats.indexOf(wRec33.lint) >= 0 && wRec33.mats.indexOf(wRec33.cord) >= 0 &&
    wRec33.fringe.every((f) => wRec33.mats.indexOf(f) >= 0));
check('THE WALL BLEEDS ONTO THE PAVEMENT: a bright contact line at its base, a wide glow strip soaked across the lanes and 2 haze sheets standing in the road — laid flat at the walk-slab height (' + wBleedZ.toFixed(2) + ' / ' + wPoolZ.toFixed(2) + ', the slab top is 0.35 proud), all riding the curtain\'s own opacity in ward.mats',
  wBleed.length === 1 && wPool.length === 1 && wHaze.length === 2 &&
    wBleedZ < 0.3 && wPoolZ < 0.3 && wBleedZ > 0.3 - 0.35 - 0.2 &&
    Math.abs(wBleed[0].position.y - wMid) < 1e-9 && Math.abs(wPool[0].position.y - wMid) < 1e-9 &&
    wRec33.bleed != null && wRec33.pool != null && wRec33.haze.length === 2 &&
    [wRec33.bleed, wRec33.pool].concat(wRec33.haze).every((f) => wRec33.mats.indexOf(f) >= 0) &&
    /THE BLEED ONTO THE PAVEMENT/.test(wSrc33) &&
    wSrc33.indexOf('depthWrite: false') >= 0);
check('THE DEATH SWEEP IS WIRED, GUTTER-FIRST: ward.panels registers EXACTLY the panel mats (the same objects as the head of ward.mats, in lane order from the far gutter), and the falling loop lags every panel by up to NIGHT_WARD_DEATH_BAND (' + NK_WARD_BAND + ') of the fall along its lane slot — panel 0 (the RIGHT edge of the screen) tears first, the last panel dies last',
  wRec33.panels.length === NK_WARD_PANELS &&
    wRec33.panels.every((m, i) => wRec33.mats[i] === m) &&
    wSrc33.indexOf('ward.panels.push(m)') >= 0 &&
    /if \(ward\.panels && ward\.panels\.length > 1\) \{/.test(an33) &&
    /const WARD_W = NIGHT_WARD_DEATH_BAND;/.test(an33) &&
    /const W_slot = 1 - m \/ \(ward\.panels\.length - 1\)/.test(an33) &&
    /Math\.min\(1, Math\.max\(0, \(kk - W_slot \* WARD_W\) \/ \(1 - WARD_W\)\)\)/.test(an33) &&
    /ward\.panels\[m\]\.opacity = ward\.base\[m\] \* kk \* 0\.9 \* W_k;/.test(an33) &&
    /ward\.mats\[m\]\.opacity = ward\.base\[m\] \* kk \* 0\.9;/.test(an33));
check('EVERY PART OF THE CURTAIN REACHES WITH IT: the binding rails, the core wisp, the lantern beads and the glow are all hung on the full panel run (WSPAN-derived lengths, a glow radius grown to reach both ends, every part centred on the run\'s middle at ' + wMid.toFixed(2) + ') — one wall, not a picket line with a tail',
  /BX\(0\.14, WSPAN \+ 1\.5, 0\.16/.test(wSrc33) &&
    /CY\(WID \* 0\.4, WID \* 0\.4, WSPAN \+ 1\.3/.test(wSrc33) &&
    /WSPAN = \(NP - 1\) \* 1\.45/.test(wSrc33) &&
    /MID = P0 \+ WSPAN \/ 2/.test(wSrc33) &&
    /const P0 = -8\.5 \+ SPAN - SPANL/.test(wSrc33) &&
    /PointLight\(0x36f2cf, 0\.55, WSPAN \/ 2 \+ 4\)/.test(wSrc33) &&
    /panel\.position\.set\(0, P0 \+ k \* 1\.45/.test(wSrc33) &&
    /bead\.position\.set\(0, P0 \+ 0\.1 \+ k \* 1\.45/.test(wSrc33) &&
    Math.abs(wRails[0].position.y - wMid) < 1e-9 &&
    Math.abs(wRails[1].position.y - wMid) < 1e-9 &&
    Math.abs(wGlow[0].position.y - wMid) < 1e-9 &&
    wGlow[0].distance >= wMid - wLo + 3 && wGlow[0].distance >= wHi - wMid + 3);
fadeAll33(0.25);
const ops33 = wRec33.panels.map((m) => m.opacity);
const lit33 = wRec33.panels[NK_WARD_PANELS - 1].opacity;
const mono33 = ops33.every((v, i) => i === 0 || v >= ops33[i - 1] - 1e-12);
fadeAll33(1);
const noStagger33 = wRec33.panels.every((m, i) => Math.abs(m.opacity - wRec33.base[i] * 0.9) < 1e-12);
fadeAll33(0);
const allDark33 = wRec33.mats.every((m) => m.opacity === 0);
check('THE SWEEP REALLY RUNS (the game\'s own falling loop applied to the game\'s own ward): a quarter into the fall the gutter end is ALREADY OUT (panel 0 opacity ' + ops33[0].toFixed(3) + ') while the stoop end still burns (' + lit33.toFixed(3) + '), darkness advances MONOTONIC panel by panel, at the top of the fall nothing is staggered, and at the bottom every part of the ward is fully out',
  sweep33.length > 40 && ops33[0] === 0 &&
    lit33 > wRec33.base[0] * 0.9 * 0.25 * 0.5 && mono33 === true &&
    noStagger33 === true && allDark33 === true,
  'kk=0.25 first=' + ops33[0].toFixed(3) + ' last=' + lit33.toFixed(3) + ' mono=' + mono33 +
    ' full=' + noStagger33 + ' dark=' + allDark33);
check('THE LINT, CORD, FRINGE, BLEED, POOL AND HAZE DIE WITH THE CURTAIN AND NEVER STAGGER: the sweep touches ONLY ward.panels, so every other part rides the plain full-curtain fade',
  [wRec33.lint, wRec33.cord, wRec33.bleed, wRec33.pool].concat(wRec33.haze, wRec33.fringe)
    .every((m) => wRec33.panels.indexOf(m) < 0) &&
    sweep33.indexOf('ward.mats') < 0 && /ward\.panels\[m\]\.opacity/.test(sweep33));
check('THE ARROW WAITS FOR THE LAST PANEL: the GO! flash is armed for NIGHT_GO_FLASH + NIGHT_GATE_FADE = ' + (NIGHT_GO_FLASH + NIGHT_GATE_FADE).toFixed(2) + 's (the tear finishes, then the red way-out arrow burns) and NO setter arms the flash without the sweep time',
  /nightGoT = NIGHT_GO_FLASH \+ NIGHT_GATE_FADE;/.test(srcFn('nightGoFlash')) &&
    (html.match(/nightGoT = NIGHT_GO_FLASH;/g) || []).length === 0 &&
    (html.match(/nightGoT = NIGHT_GO_FLASH \+ NIGHT_GATE_FADE/g) || []).length >= 1 &&
    NIGHT_GO_FLASH === 3.4 && NIGHT_GATE_FADE === 1.15);
check('THE GAMEPLAY LINE IS UNTOUCHED: the ward stands, stops and works exactly on its shipped numbers (the same x line, the 0.34 stop, the 2.5 birth room, the 0.35 work box) — only the LIGHT got wider, never the wall',
  NIGHT_GATE_INSET === 2 && NIGHT_GATE_STOP === 0.34 && NIGHT_GATE_ROOM === 2.5 &&
    NIGHT_GATE_WORK === 0.35 &&
    srcFn('buildNightGates').includes('g.position.set(led.x, 0, GZ)') &&
    srcFn('nightGateWall').length > 0 && srcFn('nightGateOn').includes('isNightShift'));

console.log("\n[34] SPECTRAL BLOOD: a shovel wound GLOWS RED while the creature scurries away");
(function () {
  nightOn = true;
  p.wx = 449; p.wy = 2.5; p.shovelT = 0; p.shovelCd = 0; p.stunT = 0; p.facing = 0; // the ghoul stands in front of him, in the 210-degree bite arc
  const bands34 = H.nightBands();
  const HOME34 = bands34.filter((b) => b.x0 === 384)[0];
  const bScore = (h) => ((h >> 16) & 255) - (((h >> 8) & 255) + (h & 255)) / 2; // how RED a color is
  const gh = mkC("ghoul", 3, { home: HOME34 });
  gh.g = H.makeGhoul(); gh.g.position.set(gh.wx, gh.wy, 0.3); // the REAL rig: the blood tints its own skins
  creatures.length = 0; creatures.push(gh);
  const dynBefore = dynamicChildren.length;
  p.shovelCd = 0;
  H.swing(); // THE BLOW
  const armed34 = {
    t: gh.bloodT, dur: gh.bloodDur, bleed: gh.bloodBleed, back: gh.backoffT,
    parts: (gh.bloodParts || []).length, aura: !!gh.bloodAura, hp: gh.hp, max: gh.hpMax,
  };
  H.updateHorrorCreature(gh, 1 / 60);
  const parts34 = gh.bloodParts || [];
  const lifts34 = parts34.map((mm) => bScore(mm.color.hex) - bScore(mm.__bcHex));
  const aura34 = gh.bloodAura || { g: {}, mat: {} };
  const added34 = dynamicChildren.slice(dynBefore);
  const splats34 = added34.filter((o) => o.children && o.children[0] && o.children[0].material);
  const redSplats34 = splats34.filter((o) => bScore(o.children[0].material.color.hex) > 90).length;
  check("THE WOUND BURNS RED THE INSTANT THE BLADE LANDS: bloodT armed with the scurry window (" + armed34.t.toFixed(2) + "s over the " + armed34.back.toFixed(2) + "s back-off, floor HORROR_STUN_T " + HORROR_STUN_T + "), the creature's own skins (" + armed34.parts + " materials) collected and tinted toward the blood red 0x" + NK_BLOOD_C.toString(16) + " — every one measurably redder than its base colors, and it is a WOUND, not a banishment (hp spent, no hook)",
    armed34.parts >= 5 && armed34.bleed === 1 && armed34.t === armed34.dur &&
      armed34.t >= HORROR_STUN_T && armed34.t <= armed34.back &&
      lifts34.length === armed34.parts && lifts34.every((v) => v > 25) &&
      armed34.hp < armed34.max && gh.hooked !== true &&
      srcFn("nightBloodArm").includes("bloodParts") && /---- SPECTRAL BLOOD/.test(html),
    "bloodT=" + armed34.t.toFixed(2) + " back=" + armed34.back.toFixed(2) +
      " parts=" + armed34.parts + " minLift=" + Math.min.apply(null, lifts34).toFixed(1));
  check("THE AURA STANDS ON THE CREATURE: a red glow shell riding the creature's OWN group (transparent, no depth write — the ghost-skin law), visible and lit while it runs, colored exactly the blood red and swelled past its rest size",
    armed34.aura && aura34.g.parent === gh.g && aura34.g.visible === true &&
      aura34.mat.transparent === true && aura34.mat.depthWrite !== true &&
      aura34.mat.color.hex === NK_BLOOD_C && aura34.mat.opacity > 0 &&
      aura34.g.scale.x > 1,
    "aura op=" + aura34.mat.opacity.toFixed(3) + " scale=" + aura34.g.scale.x.toFixed(2));
  check("THE BLOW THROWS SPECTRAL BLOOD: the hit sprays red droplets at the spot it landed (blood red + the light salmon fleck, glowing), the ordinary ecoplasm splash stays green — the player SEES the hit; no additive-blending trick anywhere in the blood kit",
    redSplats34 >= NK_BLOOD_SPRAY && splats34.length >= redSplats34 &&
      splats34.some((o) => bScore(o.children[0].material.color.hex) < 90) &&
      srcFn("spawnBloodSpray").includes("NIGHT_BLOOD_C") &&
      srcFn("spawnEctoSplat").includes("bloodHex") &&
      srcFn("nightBloodArm").indexOf("AdditiveBlending") < 0 &&
      srcFn("nightBloodTick").indexOf("AdditiveBlending") < 0);
  // THE RUN: tick the scurry out frame by frame, then verify the dry-up
  let frames34 = 0;
  while (gh.backoffT > 0 && frames34++ < 1200) H.updateHorrorCreature(gh, 1 / 60);
  const clean34 =
    gh.bloodT === 0 && gh.bloodBleed === 0 &&
    (gh.bloodParts || []).every((mm) => mm.color.hex === mm.__bcHex) &&
    (!gh.bloodAura || (gh.bloodAura.g.visible === false && gh.bloodAura.mat.opacity === 0));
  // redness still on NEAR THE END of a fresh window (the glow reads for the whole run)
  p.shovelCd = 0; p.stunT = 0;
  const g2 = mkC("ghoul", 3, { home: HOME34 });
  g2.g = H.makeGhoul(); g2.g.position.set(g2.wx, g2.wy, 0.3);
  creatures.length = 0; creatures.push(g2);
  H.swing();
  H.updateHorrorCreature(g2, 1 / 60);
  const half34 = Math.max(1, Math.round((g2.bloodT - g2.bloodDur * 0.25) / (1 / 60)));
  for (let i = 0; i < half34 && g2.bloodT > 0; i++) H.updateHorrorCreature(g2, 1 / 60);
  const late34 = (g2.bloodParts || []).length > 0 &&
    (g2.bloodParts || []).every((mm) => bScore(mm.color.hex) > bScore(mm.__bcHex));
  const fading34 = g2.bloodT > 0 && g2.bloodT < g2.bloodDur;
  check("IT GLOWS WHILE IT SCURRIES AND DRIES UP AS IT GETS AWAY: the full scurry window runs (" + frames34 + " frames of real flee), the tint is STILL red a quarter from the end of a fresh window, and the frame the scurry is over every material sits on its own base color, bloodBleed is 0, bloodT is 0 and the aura is off and invisible",
    frames34 > 5 && late34 && fading34 && clean34,
    "frames=" + frames34 + " lateRed=" + late34 + " fading=" + fading34 + " restored=" + clean34);
  // THE KILLING BLOW: no wound-light rides a thing already in the air
  p.shovelCd = 0; p.stunT = 0;
  const kd = mkC("ghoul", 3, { home: HOME34 });
  kd.g = H.makeGhoul(); kd.g.position.set(kd.wx, kd.wy, 0.3);
  creatures.length = 0; creatures.push(kd);
  let kills34 = 0;
  // THE SUITE'S OWN KILL RECIPE: pull it onto the blade, clear the scurry, swing — until
  // the pool is spent and the thing is packed into the hopper
  kills34 = shovelDown(kd);
  check("THE LAST BLOW CLEARS IT ON THE SPOT: on the swing that empties the pool the wound-light is zeroed (bloodT 0, bleed 0, skins restored, aura off) — the glow belongs to the SCURRY, never to the banishment flight",
    (kd.hooked === true || kd.hookLanded === true) && kd.bloodT === 0 && kd.bloodBleed === 0 &&
      (kd.bloodParts || []).every((mm) => mm.color.hex === mm.__bcHex) &&
      (!kd.bloodAura || kd.bloodAura.g.visible === false) &&
      srcFn("nightWoundShovel").includes("nightBloodClear(c);"),
    "swings=" + kills34 + " inTruck=" + (kd.hooked === true || kd.hookLanded === true) + " bloodT=" + kd.bloodT);
  check("IT IS MIDNIGHT-ONLY LAW: the wound path (and with it the blood) sits behind isNightShift, the tick runs only INSIDE the Midnight back-off block, and every exit from the street clears the wound-light (strike flight, fog cull, fog respawn)",
    srcFn("nightWoundShovel").includes("isNightShift") &&
      /nightBloodTick\(c, dt\)/.test(srcFn("updateHorrorCreature")) &&
      srcFn("updateHorrorCreature").indexOf("nightBloodTick(c, dt);") >
        srcFn("updateHorrorCreature").indexOf("if (backing) {") &&
      srcFn("cullHorror").includes("nightBloodClear(c);") &&
      srcFn("respawnHorror").includes("nightBloodClear(c);") &&
      srcFn("shovelStrike").includes("nightBloodClear(c);"));
})();

console.log("\n[35] THE LAST BLOCK IS A FIGHT, NOT A FARM: the grave ward's bill is cut, and the bottom strip is the worker's ring");
(function () {
  nightOn = true;
  s7Reset();
  const bands35 = H.nightBands();
  const grave35 = bands35.filter((b) => b.x0 === NIGHT_BEAT_GRAVE_X)[0];
  const others35 = bands35.filter((b) => b.x0 !== NIGHT_BEAT_GRAVE_X);
  const street35 = bands35.reduce((s, b) => s + H.gateLedger(b).load, 0);
  check("THE GRAVE WARD KEEPS ITS CUT: its flood bill is 20 shovelfuls where it used to be 30, it is NO LONGER THE HEAVIEST WARD ON THE STREET (the vermin ward out-seeds it), and the whole street fits the roster cap (" + street35 + " / " + HORROR_ROSTER_CAP + ")",
    !!grave35 && H.gateLedger(grave35).load === 20 &&
      others35.some((b) => H.gateLedger(b).load > 20) &&
      street35 <= HORROR_ROSTER_CAP &&
      /THE BILL COMES DOWN/.test(srcFn('nightBlockPack')) === false &&
      NIGHT_BLOCKS.filter((e) => e.x === NIGHT_BEAT_GRAVE_X)[0].flood.reaper === 1,
    "grave=" + (grave35 ? H.gateLedger(grave35).load : -1) +
      " others=" + others35.map((b) => H.gateLedger(b).load).join("/") + " street=" + street35);
  check("THE SURGE STACKS ON THE FLOOD BLOCK'S CUT BASE — AND THE BILL STOPS AT THE LAW'S " + HORROR_BLOCK_CREATURE_MAX + " CREATURES (the block only takes on the room left under the cap; more surges past that add NOTHING)",
    grave35 && (() => {
      H.setSurgeTier(0);
      const base35 = H.gateLoad(grave35) === 20;
      H.setSurgeTier(HORROR_SURGE_LOAD_TIERS);
      const full35 = H.gateLoad(grave35) === HORROR_BLOCK_CREATURE_MAX &&
        H.gateSurge(grave35) === HORROR_BLOCK_CREATURE_MAX - 20;
      H.setSurgeTier(HORROR_SURGE_LOAD_TIERS + 9);
      const hard35 = H.gateLoad(grave35) === HORROR_BLOCK_CREATURE_MAX; // more surges, same wall
      H.setSurgeTier(0);
      return base35 && full35 && hard35;
    })());
  // THE RING, WALKED LIVE: with the beast awake, how far down-and-left does the street let him go?
  H.clearNightBoss(); H.spawnNightBoss();
  const boss35 = H.getBoss();
  p.wx = 200; p.wy = 2.5; p.stunT = 0;
  H.startBossFight();
  boss35.riseT = 0;
  const wall35 = H.workerEndLimitX();
  let walk35 = 200, steps35 = 0;
  while (steps35++ < 4000) {
    const w = H.workerEndLimitX(); // THE LIVE LINE: a lookup every frame, not a constant
    walk35 = Math.max(w, walk35 - 0.2);
    if (Math.abs(walk35 - w) < 1e-9) break; // standing on the floor, face to face with it
  }
  check("WITH THE BEAST AWAKE HE WALKS THE WHOLE BOTTOM STRIP: his floor is the bottom cemetery fence with the standoff on it at " + wall35 + "u — " + (NIGHT_BOSS_X - wall35).toFixed(0) + "u BELOW the beast's rise point (" + NIGHT_BOSS_X + "u), " + NIGHT_FENCE_STANDOFF + "u UP-street of the iron (" + NIGHT_FENCE_X + "u), so he can circle under the monster and swing at it from below; walking him down the street live lands him exactly on that floor (" + walk35.toFixed(2) + "u after " + steps35 + " steps) and NEVER TO THE IRON",
    boss35.awake === true && boss35.hooked !== true &&
      Math.abs(walk35 - wall35) < 1e-9 && wall35 === NK_FLOOR &&
      NIGHT_BOSS_X - wall35 >= 30 &&
      Math.abs(wall35 - NIGHT_FENCE_X - NIGHT_FENCE_STANDOFF) < 1e-9 &&
      Math.abs(wall35 - (NIGHT_GRAVE_X - 8) - NIGHT_FENCE_STANDOFF) < 1e-9,
    "wall=" + wall35 + " walk=" + walk35.toFixed(2) + " steps=" + steps35);
  check("THE STREET DOES NOT GROW FOR IT — no new blocks scroll: the ring lives inside the SAME anchors (near end " + H.routeNearX() + ", far end " + H.routeFarX() + ", uphill wall " + H.workerTopLimitX() + "), his floor never drops past the cemetery mouth, and the grave ward still stands above him",
    H.routeNearX() === NIGHT_END_X && H.routeFarX() === NIGHT_TOP_X &&
      H.workerTopLimitX() === NIGHT_TOP_X - NIGHT_TRAIL_X &&
      wall35 >= NIGHT_END_X + NIGHT_MOUTH_X &&
      grave35 && H.gateX(grave35) > wall35);
  H.clearNightBoss();
  check("WHEN THE BEAST IS DOWN THE GATE STANDS AS SHIPPED (" + NK_FLOOR + "u, the graves gate " + (NIGHT_GRAVE_X - 8) + "u plus the standoff): the ring is the fight's opening, not a loosening of the sealed end — the awake floor is never further up the street than the asleep floor, and BOTH keep him off the iron",
    Math.abs(H.workerEndLimitX() - NK_FLOOR) < 1e-9 &&
      Math.abs(H.workerEndLimitX() - (NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF)) < 1e-9 &&
      H.workerEndLimitX() >= wall35);
})();

// ---- THE GHOST IRON, WALKED LIVE: the rig parks at the line, the fence shuts behind him ----
(function () {
  H.clearNightBoss(); H.sealClear();
  const ringFloor = NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF; // the bottom fence: his shipped floor
  p.wx = 200; p.wy = 2.5; p.stunT = 0;
  H.spawnNightBoss();
  H.startBossFight(); // the wake arms the seal line
  const seal0 = H.getSeal();
  check("THE WAKE ARMS THE SEAL LINE AND LEAVES THE STREET OPEN ABOVE IT (the ring shuts on the crossing, not on the wake)",
    H.ceilX() === H.workerTopLimitX() && H.sealClosed() === false && !!seal0,
    "ceil=" + H.ceilX() + " armed=" + (seal0 ? seal0.armed : "none"));
  // Walk him down the dead-end street on the shipped walls: floor lookup every frame,
  // the crossing closes the iron exactly where updatePlayer's clamp runs it.
  let x36 = 200, steps36 = 0, closedAt36 = null, ceilAt36 = null;
  const ringInner = NK_SEAL_X - NK_SEAL_INNER; // the depth he must REACH before the iron may rise
  while (steps36++ < 4000) {
    const wall = H.workerEndLimitX();
    const prev = x36;
    x36 = Math.max(wall, x36 - 0.5); // he may never go below the bottom fence
    if (prev >= ringInner && x36 < ringInner && H.sealClose()) {
      closedAt36 = x36;
      ceilAt36 = H.ceilX();
    }
    x36 = Math.min(x36, H.ceilX()); // ...and after the close he has a new ceiling
    if (x36 <= wall + 1e-9) break; // he is standing on the floor of the ring
  }
  check("HE WALKS INTO THE GRAVE RING AND THE GHOST IRON SHUTS BEHIND HIM at the iron's FACE (" +
      H.sealFace() + "u = the fence line " + NK_SEAL_X + "u minus the " + NK_SEAL_INNER +
      "u its light reaches down the road) — the wall closes on the crossing frame at " + closedAt36 +
      "u, his sealed ceiling (" + ceilAt36 + "u) sits BEHIND him, and a body never stands inside the fence's own mesh",
    closedAt36 != null && closedAt36 <= ringInner + 0.5 &&
      NK_SEAL_X - closedAt36 >= NK_SEAL_INNER &&
      Math.abs(ceilAt36 - H.sealStand()) < 1e-9 &&
      Math.abs(ceilAt36 - (NK_SEAL_X - NK_SEAL_INNER - NK_SEAL_STOP)) < 1e-9 &&
      ceilAt36 < ringInner && // the standing point is DOWN the road of the wall: never in the mesh
      H.sealClosed() === true,
    "cross=" + closedAt36 + " ceil=" + ceilAt36 + " inner=" + ringInner);
  // Press him UP the street from deep in the ring: the iron stops him on the line, every frame,
  // and he is never yanked across it (the sealed ceiling is a wall, not a tow rope).
  let up36 = 45, press36 = 0, pastIron = false;
  while (press36++ < 3000) {
    const ceil36 = H.ceilX();
    up36 = Math.min(ceil36, up36 + 0.5);
    if (up36 > ceil36 + 1e-9) pastIron = true; // he got ABOVE the ghost iron: it is not a wall
    if (up36 >= ceil36 - 1e-9) break;
  }
  check("THE FENCE IS A SOLID WALL FROM INSIDE THE RING: pressing up the street from " + 45 + "u stops him on the ghost iron at " +
      up36.toFixed(2) + "u — a body-width below its face, inside the fight zone — and he never gets past it (" + press36 + " frames of walking)",
    pastIron === false && Math.abs(up36 - H.sealStand()) < 1e-9 &&
      up36 < NK_SEAL_X - NK_SEAL_INNER && // he is never standing in the wall's own footprint
      H.sealClosed() === true,
    "at=" + up36.toFixed(2) + " steps=" + press36);
  check("THE RING HE IS SHUT INTO IS THE BEAST'S OWN YARD: " + (up36 - ringFloor).toFixed(1) +
      "u of street between the bottom fence (" + ringFloor + "u) and the ghost iron (" + up36.toFixed(1) + "u), the rise point " +
      NIGHT_BOSS_X + "u and the graves gate " + (NIGHT_GRAVE_X - 8) + "u inside it, the rig parked UP-street of the iron at " + H.truckFloorX() + "u (centre), scoop at " +
      (H.truckFloorX() - 4.3).toFixed(1) + "u — " + (H.truckFloorX() + 4.0 - NK_SEAL_X).toFixed(1) + "u of nose and " +
      (H.truckFloorX() - 4.3 - NK_SEAL_X).toFixed(1) + "u of hopper CLEAR of the fence line, and " +
      (H.truckFloorX() - 4.0 - up36).toFixed(1) + "u between his sealed ceiling and the rig's collision box",
    up36 - ringFloor > 20 && NIGHT_BOSS_X > ringFloor && NIGHT_BOSS_X < NK_SEAL_X &&
      NIGHT_GRAVE_X - 8 >= NIGHT_END_X && NIGHT_GRAVE_X - 8 < NK_SEAL_X &&
      H.truckFloorX() === NK_SEAL_X + NK_TRUCK_NOSE + NK_TRUCK_CLEAR &&
      H.truckFloorX() - 4.0 > up36 + 1 && H.truckFloorX() - 4.3 > NK_SEAL_X + 1 &&
      H.truckFloorX() > up36 &&
      H.truckFloorX() + 4 < H.workerTopLimitX() + H.truckStandOffset() + 20);
  for (let i = 0; i < 60; i++) H.sealTick(1 / 60); // the iron finishes its rise
  const sealMesh = H.getSeal();
  check("THEIRON STANDS IN FRAME: it is visible, risen on the line, and its light is lit",
    sealMesh.g.visible === true && sealMesh.rise === 1 && Math.abs(sealMesh.g.position.z - GZ) < 1e-9,
    "rise=" + sealMesh.rise + " z=" + sealMesh.g.position.z.toFixed(2));
  H.setBoss(null);
  H.sealDrop(); // the banish opens the street
  check("BANISHED, THE IRON TEARS DOWN AND THE WHOLE STREET IS HIS AGAIN (the drive-off gate never gets a sealed street)",
    (function () {
      let faded = false;
      for (let i = 0; i < Math.ceil((NIGHT_GATE_FADE + 0.2) * 60); i++) {
        H.sealTick(1 / 60);
        if (sealMesh.g.visible === false) faded = true;
      }
      return faded && H.sealClosed() === false && H.ceilX() === H.workerTopLimitX() &&
        Math.abs(sealMesh.g.position.z - GZ) < 1e-9;
    })(),
    "visible=" + sealMesh.g.visible + " ceil=" + H.ceilX());
  H.clearNightBoss();
  check("AND THE SHIFT CLEARS IT: no live ring, no mesh left standing on the line",
    H.getSeal() === null);
})();

console.log("\n[36] THE PLAYTEST DOORWAY: the switch is DARK in the code (no URL needed) — Midnight clocks in at the final boss, wards stamped clear — and the whole doorway is ONE line that flips back");
(function () {
  nightOn = true;
  s7Reset();
  // (a) THE SWITCH IS A SINGLE VALUE IN THE BUILD, and every doorway branch keys off it
  const spawnDoor = (flag) =>
    new Function('isNightShift', 'NIGHT_TEST_BOSS_START', 'NIGHT_BOSS_TRIGGER_X', 'NIGHT_START_X', 'PLAYER_START_X',
      srcFn('playerSpawnX') + '\nreturn playerSpawnX();')(() => true, flag, NIGHT_BOSS_TRIGGER_X, NIGHT_START_X, PLAYER_START_X);
  const doorOn = spawnDoor(true), doorOff = spawnDoor(false);
  check("THE SWITCH IS DARK RIGHT NOW — THE SHIPPED LAW, SWITCH OFF: index.html carries the hard-coded line const NIGHT_TEST_BOSS_START = true (no URL, no window flag involved). To clock in AT THE FINAL BOSS the value flips to true — one line, and nothing in the code keys off anything else",
    /const NIGHT_TEST_BOSS_START = false;/.test(html) &&
      !/window\.NIGHT_TEST_BOSS_START/.test(html) &&
      srcFn('playerSpawnX').includes('NIGHT_TEST_BOSS_START') &&
      srcFn('spawnNightShift').includes('nightTestClockInAtBoss'));
  check("REVERT PROOF, RUN LIVE BOTH WAYS FROM THE GAME'S OWN playerSpawnX: the value OFF (the state the suites' harnesses inject, and the revert state) answers the shipped clock-in at the TOP of the street — " + doorOff + "u, " + (doorOff - NIGHT_BOSS_TRIGGER_X) + "u uphill of the waking line; the value ON opens the doorway — " + doorOn + "u, between the ward line (118u) and the cross-street (112u) that wakes the beast",
    doorOff === NIGHT_START_X && doorOff > NIGHT_BOSS_TRIGGER_X &&
      doorOn === NIGHT_BOSS_TRIGGER_X + 3 &&
      doorOn < NIGHT_BOSS_TRIGGER_X + 6 && doorOn > NIGHT_BOSS_TRIGGER_X);
  check("THE SPAWNER WIRES IT: spawnNightShift ends with the stamp running behind a typeof-guarded look at the switch (a world that never declared it — every suite, any harness — simply never touches the branch), through its own helper nightTestClockInAtBoss",
    /typeof NIGHT_TEST_BOSS_START !== "undefined" && NIGHT_TEST_BOSS_START\)\s*\r?\n\s*nightTestClockInAtBoss\(\);/.test(srcFn('spawnNightShift')) &&
      /function nightTestClockInAtBoss\(\)/.test(html) &&
      srcFn('spawnNightShift').indexOf('nightTestClockInAtBoss();') <
        srcFn('spawnNightShift').indexOf('console.log('));
  // (b) LIVE THE SCAFFOLD RUNS: the fully-built haunted street, stamped the playtest way
  const bands36 = H.nightBands();
  const flood36 = bands36.filter((b) => b.flood)[0];
  H.setBoss(null);
  H.spawnNightBoss(); // the playtest build lays the beast down asleep in the yard (as spawnNightShift does)
  const seeded36 = creatures.filter((c) => c.home && HORROR_ALL[H.horrorKey(c)]).length;
  const closed36 = bands36.filter((b) => H.gateClosed(b) === true).length;
  H.testClockIn();
  const left36 = creatures.filter((c) => c.home && HORROR_ALL[H.horrorKey(c)]).length;
  const wards36 = dynamicChildren.filter((o) => o.userData && o.userData.ward).length;
  check("THE STREET IS STAMPED CLEARED: all " + closed36 + " sealed wards (of " + bands36.length + ", with " + seeded36 + " seeded spooks on the beat) come out OPEN — each ledger paid to its own lock-in bill (sent = yield = load) and the fog sweep empties the roster to " + left36 + " left",
    closed36 === bands36.length && seeded36 > 0 &&
      bands36.every((b) => H.gateClosed(b) === false) &&
      bands36.every((b) => {
        const led = H.gateLedger(b);
        return led.open === true && led.sent === led.load && led.yield === led.load;
      }) && left36 === 0,
    'seeded=' + seeded36 + ' closedBefore=' + closed36 + ' left=' + left36);
  check("THE LIGHT IS DOWN AND THE ARROW IS DARK: not a curtain mesh left on the street (" + wards36 + "), the GO! clock zeroed, and the worker stands the doorway — wx " + p.wx.toFixed(1) + "u on the " + p.wy.toFixed(1) + "u cemetery lane, facing the same downhill way he always clocks in with",
    wards36 === 0 && p.wx === NIGHT_BOSS_TRIGGER_X + 3 && p.wy === 2.5 &&
      p.facing === NK_FACE && H.getGoT() === 0);
  check("THE BEAST IS LAID, ASLEEP, RIGHT IN FRONT OF HIM: the scaffold does NOT wake it — the fight starts the way it always starts, by walking into the cross-street (trigger " + NIGHT_BOSS_TRIGGER_X + "u, he stands " + p.wx + "u, the beast rises at " + NIGHT_BOSS_X + "u)",
    H.getBoss() !== null && H.getBoss().awake === false &&
      H.getFightOn() === false && p.wx > NIGHT_BOSS_TRIGGER_X &&
      p.wx - NIGHT_BOSS_TRIGGER_X === 3);
  check("THE STAMP IS NOT A LOOSENING: the doorway sits under the shipped geometry — the grave ward line stays at trigger+6 (" + (NIGHT_BOSS_TRIGGER_X + 6) + "u, and the stamp opens it rather than moving it: gateX = " + H.gateX(flood36) + "u), the sealed end rules answer the same anchors (near " + H.routeNearX() + ", far " + H.routeFarX() + ", gate-asleep floor " + (NIGHT_GRAVE_X - 8) + "u) — the street never grew for the playtest",
    H.gateX(flood36) === NIGHT_BOSS_TRIGGER_X + 6 &&
      H.gateClosed(flood36) === false &&
      H.routeNearX() === NIGHT_END_X && H.routeFarX() === NIGHT_TOP_X &&
      Math.abs(H.workerEndLimitX() - NK_FLOOR) < 1e-9);
})();

console.log("\n[37] THE HEART STRIKE PAYS 2000 FLAT - the night purse, never double-timed");
(function () {
  check("the purse is exactly 2000 a heart strike (BOSS_POINTS === 2000)", BOSS_POINTS === 2000, "BOSS_POINTS=" + BOSS_POINTS);
  const hit37 = srcFn("bossShovelHit");
  check("the banishment pays through addScoreFlat(BOSS_POINTS, true) - a FLAT purse", hit37.includes("addScoreFlat(BOSS_POINTS, true)") && !hit37.includes("addScore(BOSS_POINTS"));
  check("addScore keeps the street double: it delegates addScoreFlat(n * scoreMultiplier(), isBonus)", srcFn("addScore").includes("addScoreFlat(n * scoreMultiplier(), isBonus)"));
  const af37 = srcFn("addScoreFlat");
  check("addScoreFlat pays the number it is handed - no scoreMultiplier() inside the flat path", !af37.includes("scoreMultiplier("));
  check("the flat path keeps every ledger: score, dayScore, weekScore, bonusTally, the healer milestone and the 30k Monster step", af37.includes("score += v") && af37.includes("dayScore += v") && af37.includes("weekScore += v") && af37.includes("bonusTally += v") && af37.includes("checkHealerMilestone()") && af37.includes("monsterNextAt += MONSTER_SCORE_STEP"));
  check("the flat payer is EXACTLY one site in the shipped game (definition + addScore delegate + boss strike)", (html.match(/addScoreFlat\(/g) || []).length === 3);
  check("weekday money is untouched: the gargoyle keeps its 5000 purse through the multiplying addScore", GARGOYLE_VALUE === 5000 && srcFn("reclaimStolenGargoyle").includes("addScore(val, true)"));
  check("POWERUP_CASH_STEP is still the shipped 5000 - the healer milestone step never moved", srcNum("POWERUP_CASH_STEP") === 5000);
  check("the night bar math: 10 plain strikes x 2000 = 20000 for the whole fight (BOSS_MAX_HP x BOSS_POINTS x BOSS_DMG)", BOSS_MAX_HP * BOSS_POINTS * BOSS_DMG === 20000, "bar pays " + BOSS_MAX_HP * BOSS_POINTS * BOSS_DMG);
})();

console.log("\n" + pass + " night-shift checks passed" + (fail ? " — " + fail + " FAILED" : " — all OK"));


if (fail) failures.forEach((f, i) => console.log('  FAIL ' + (i + 1) + ') ' + f));
process.exit(fail ? 1 : 0);
