// _night_packs_chk.js — THE MIDNIGHT BLOCK PACKS + THE HELLHOUND'S TAIL.
// [1] the hellhound tail: mounted on the RUMP, arcing BACK and UP, no Y-axis spin;
// [2] the seven new families: built, rig-contracted, registered, animated, shovelable;
// [3] the per-block packs: a DIFFERENT attacking set on every block of the dead end;
// [3b] the packs POPULATE: a simulated fill pass, band by band;
// [4] the shipped pack untouched: the weekday street, the quotas, the fill order, Maspeth.
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
function srcLiteral(name, open, close) {
  const idx = html.indexOf('const ' + name + ' = ');
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = html.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < html.length; i++) { const c = html[i]; if (c === open) d++; else if (c === close) { d--; if (!d) { i++; break; } } }
  return html.slice(s, i);
}
function srcNum(name) {
  const m = html.match(new RegExp('const\\s+' + name + '\\s*=\\s*(-?[0-9.]+)'));
  if (!m) throw new Error('constant not found: ' + name);
  return Number(m[1]);
}
function mkObj(kind) {
  return {
    kind: kind, children: [], parent: null, userData: {}, visible: true,
    castShadow: false, receiveShadow: false, material: null, geometry: null, r: 0, h: 0,
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } },
    rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } },
    scale: { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, setScalar(v) { this.x = this.y = this.z = v; return this; } },
    add() { for (const c of arguments) { if (c) { this.children.push(c); c.parent = this; } } return this; },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; return this; },
    traverse(f) { f(this); for (const c of this.children) c.traverse && c.traverse(f); },
  };
}
const GEO = function (kind) { return function (a, b, c, d, e) { return { kind: kind, a: a, b: b, c: c, d: d, e: e, dispose: function () {} }; }; };
const THREE = {
  Group: function () { return mkObj('group'); },
  Mesh: function (g, m) { const o = mkObj('mesh'); o.geometry = g; o.material = m; if (g && g.kind === 'sph') o.r = g.a; return o; },
  Color: function () { return { setHex: function () { return this; }, getHex: function () { return 0; } }; },
  MeshLambertMaterial: function (o) { return Object.assign({ color: (o && o.color) | 0, opacity: 1, transparent: false }, o || {}); },
  MeshStandardMaterial: function (o) { return Object.assign({ opacity: 1, transparent: false }, o || {}); },
  MeshBasicMaterial: function (o) { return Object.assign({ opacity: 1, transparent: false }, o || {}); },
  PlaneGeometry: GEO('plane'), BoxGeometry: GEO('box'), CircleGeometry: GEO('circle'),
  CylinderGeometry: GEO('cyl'), SphereGeometry: GEO('sph'), ShapeGeometry: GEO('shape'),
  TorusGeometry: GEO('torus'), RingGeometry: GEO('ring'), ConeGeometry: GEO('cone'), DoubleSide: 2,
  Shape: function () { return { moveTo: function () {}, lineTo: function () {}, absarc: function () {}, quadraticCurveTo: function () {}, closePath: function () {} }; },
  CanvasTexture: null,
};
const M = function (c, o) { return Object.assign({ color: c, clone: function () { return Object.assign({}, this); } }, o || {}); };
const MS = M;
const BX = (w, h, d, m) => { const o = mkObj('box'); o.dim = [w, h, d]; o.material = m; return o; };
const CY = (r1, r2, h, m, s) => { const o = mkObj('cyl'); o.r = r1; o.h = h; o.material = m; return o; };
const SP = (r, m, s) => { const o = mkObj('sph'); o.r = r; o.material = m; return o; };
const SPH = (r, m, a, b) => { const o = mkObj('sph'); o.r = r; o.material = m; return o; };
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[(Math.random() * a.length) | 0];
const GZ = 0.3, BLOCK_W = 80, IW = 16;
function makeOf(name) {
  // run a REAL builder out of the game against the mock THREE
  const fn = new Function('THREE', 'M', 'MS', 'BX', 'CY', 'SP', 'SPH', 'R', 'clamp', 'pick', 'GZ', 'opts',
    srcFn(name) + '\nreturn ' + name + ';');
  return fn(THREE, M, MS, BX, CY, SP, SPH, R, clamp, pick, GZ, null);
}
function deepCount(o) {
  // every mesh/group hanging off the model, all the way down (the builders parent most of
  // their parts under the waist pivot, so a top-level child count says nothing)
  let n = 0;
  const seen = [];
  (function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 9 || seen.indexOf(node) >= 0) return;
    seen.push(node);
    if (node.position || node.children) n++;
    if (Array.isArray(node.children)) for (const c of node.children) walk(c, depth + 1);
  })(o, 0);
  return n;
}
function collect(o) {
  const out = [];
  (function walk(node, depth) {
    if (!node || typeof node !== 'object' || depth > 9) return;
    if (node.rotation && node.position) out.push(node);
    if (Array.isArray(node.children)) for (const c of node.children) walk(c, depth + 1);
  })(o, 0);
  return out;
}
console.log('[1] THE HELLHOUND — the tail is mounted on the rump and carried UP AND BACK');
const hound = makeOf('makeHellhound')();
const hp = hound.userData.hound;
check('the hellhound publishes its rig contract (4 leg pivots + head/jaw/tail pivots)',
  !!hp && ['legFL', 'legFR', 'legBL', 'legBR'].every((k) => !!hp.legs[k]) && !!hp.headPiv && !!hp.jawPiv && !!hp.tailPiv);
const rearHipX = Math.min(hp.legs.legBR.position.x, hp.legs.legBL.position.x);
check('the tail pivot sits at the RUMP, behind the rear hip line',
  hp.tailPiv.position.x < rearHipX && hp.tailPiv.position.x < -0.3,
  'tailX=' + hp.tailPiv.position.x + ' rearHipX=' + rearHipX);
const segs = hp.tailPiv.children.slice();
check('the tail is a chain of segments (a whip), not one raw cylinder', segs.length >= 4, 'segs=' + segs.length);
let monoBack = true, monoUp = true;
for (let i = 1; i < segs.length - 1; i++) {
  if (!(segs[i].position.x < segs[i - 1].position.x)) monoBack = false;
  if (!(segs[i].position.z > segs[i - 1].position.z)) monoUp = false;
}
check('the chain arcs BACK (-X) the whole way out of the rump', monoBack);
check('the chain arcs UP (+Z) the whole way: the whip is CARRIED HIGH', monoUp);
const tipSeg = segs[segs.length - 1];
const tipX = hp.tailPiv.position.x + tipSeg.position.x;
const tipZ = hp.tailPiv.position.z + tipSeg.position.z;
check('the tip stands BEHIND the body and well ABOVE the tail base',
  tipX < rearHipX - 0.2 && tipZ > hp.tailPiv.position.z + 0.15,
  'tip=' + tipX.toFixed(2) + '/' + tipZ.toFixed(2) + ' baseZ=' + hp.tailPiv.position.z.toFixed(2));
check('no tail part is a cylinder spun about its own axis (the old rotation.y bug)',
  segs.every((s) => s.kind !== 'cyl' || Math.abs(s.rotation.y) < 1e-6),
  segs.map((s) => s.kind + ':ry=' + s.rotation.y).join(' '));
let sawPitch = false, sawYaw = false;
for (let i = 0; i < 90; i++) {
  hp.tailPiv.rotation.x = -0.22 + Math.sin(i * 0.11 * 9) * 0.42;
  hp.tailPiv.rotation.y = Math.sin(i * 0.11 * 4.5) * 0.34;
  if (Math.abs(hp.tailPiv.rotation.x + 0.22) > 0.2) sawPitch = true;
  if (Math.abs(hp.tailPiv.rotation.y) > 0.15) sawYaw = true;
}
check('the lash pitches around the resting carry and swings side to side',
  sawPitch && sawYaw && /hp\.tailPiv\.rotation\.x = -0\.22 \+/.test(html) &&
  /hp\.tailPiv\.rotation\.y = Math\.sin/.test(html));
check('the resting tail angle is stated the same way in the builder and the lash',
  /tailPiv\.rotation\.x = -0\.22/.test(srcFn('makeHellhound')));

console.log('\n[2] THE FAMILY ROSTER — built, rig-contracted, registered, animated');
const FAMS = [
  { type: 'gremlin', fn: 'makeGremlin', rig: 'ghoul' },
  { type: 'goblin', fn: 'makeGoblin', rig: 'ghoul' },
  { type: 'devil', fn: 'makeDevil', rig: 'ghoul' },
  { type: 'fangspider', fn: 'makeFangspider', rig: 'spider' },
  { type: 'eyecrawler', fn: 'makeEyecrawler', rig: 'hex' },
  { type: 'skeleton', fn: 'makeSkeleton', rig: 'ghoul' },
  { type: 'pitfiend', fn: 'makePitfiend', rig: 'ghoul' },
  { type: 'grubsquat', fn: 'makeGrubsquat', rig: 'hex' },
  { type: 'ratking', fn: 'makeRatking', rig: 'hound' },
  { type: 'lanternfang', fn: 'makeLanternfang', rig: 'ghoul' },
  { type: 'goulra', fn: 'makeGoulra', rig: 'ghoul' },
];
const ADD_SRC = srcFn('addCreature');
const UPD_SRC = srcFn('updateCreatures');
const FLOAT_SRC = srcFn('floatOrLope');
const WR_SRC = html.slice(html.indexOf('const WRITEUP_REASONS = {'));
const MODELS = {};
for (const f of FAMS) {
  MODELS[f.type] = makeOf(f.fn)();
  const rig = MODELS[f.type].userData[f.rig];
  const rigOk = f.rig === 'ghoul'
    ? rig && rig.legs.length === 2 && rig.arms.length === 2 && rig.waist && rig.jaw
    : f.rig === 'hex'
      ? rig && rig.legs.length === 6 && rig.jaw && rig.mandL && rig.mandR
      : f.rig === 'hound'
        ? rig && rig.legs && ['legFL', 'legFR', 'legBL', 'legBR'].every((k) => !!rig.legs[k]) &&
          rig.headPiv && rig.jawPiv && rig.tailPiv
        : rig && rig.legs.length === 8 && rig.fangs.length === 2;
  check('makeX builds a full model on the ' + f.rig + ' rig (' + f.type + ')',
    rigOk && deepCount(MODELS[f.type]) > 14, 'parts=' + deepCount(MODELS[f.type]));
  check(f.type + ' is in the shovelable roster (HORROR_TYPES + HORROR_ALL)',
    new RegExp('\\b' + f.type + ': 1').test(srcLiteral('HORROR_TYPES', '{', '}')) &&
    new RegExp('\\b' + f.type + ': 1').test(srcLiteral('HORROR_ALL', '{', '}')));
  check(f.type + ' has its own touch cost, HUD name, chatter lines and write-up offense',
    new RegExp('\\b' + f.type + ': HP_HIT_').test(srcLiteral('HORROR_HITS', '{', '}')) &&
    new RegExp('\\b' + f.type + ': "').test(srcLiteral('HORROR_NAMES', '{', '}')) &&
    new RegExp('\\b' + f.type + ': \\[').test(srcLiteral('SPOOK_LINES', '{', '}')) &&
    new RegExp('\\b' + f.type + ': \\[').test(WR_SRC));
  const ci = ADD_SRC.indexOf('case "' + f.type + '":');
  check('addCreature builds ' + f.type + ' from its builder at its own speeds',
    ci >= 0 && ADD_SRC.slice(ci, ci + 460).includes(f.fn + '()') &&
    ADD_SRC.slice(ci, ci + 460).includes('chaseSp') && ADD_SRC.slice(ci, ci + 460).includes('lopeSp'));
  const ui = UPD_SRC.indexOf('case "' + f.type + '":');
  check('updateCreatures runs ' + f.type + ' through the shared horror brain',
    ui >= 0 && UPD_SRC.slice(ui, ui + 900).includes('updateHorrorCreature(c, dt)'));
}
check('the four NEW block-own kinds are on the street (' + FAMS.length + ' kinds built)',
  FAMS.slice(7).every((f) => MODELS[f.type] && deepCount(MODELS[f.type]) > 14));
check('the fanged spider has its own EIGHT-leg gait branch (and its fangs strike)',
  /const spd = c\.g\.userData\.spider;/.test(FLOAT_SRC) && /spd\.legs\[li\]\.rotation\.y/.test(FLOAT_SRC) &&
  /fangs\[fi\]\.rotation\.x/.test(FLOAT_SRC));
check('the pitfiend brings its brine ring (the tent rig branch) into floatOrLope',
  /const tn = c\.g\.userData\.tent;/.test(FLOAT_SRC) && /tn\.tentacles\[ti\]/.test(FLOAT_SRC) &&
  /ti \* 0\.9/.test(FLOAT_SRC) && /hunting \? 5\.5 : 2\.3/.test(FLOAT_SRC));
check('the eye stalks pulse on the shared eye contract (floatOrLope)',
  /const ec = c\.g\.userData\.eyes;/.test(FLOAT_SRC));
check('the quadruped gait runs on the RIG CONTRACT, so the rat king trots like a hound',
  /const hp = c\.g\.userData\.hound;/.test(FLOAT_SRC) && /hp\.legs\.legFL\.rotation\.y/.test(FLOAT_SRC));
check('the lanternfang swings its jar on the lope (userData.lamp drives it)',
  /c\.g\.userData\.lamp/.test(FLOAT_SRC) && /lp\.rotation\.z = Math\.sin/.test(FLOAT_SRC));
check('the spider returns before the ghoul fallback (eight legs, not two arms)',
  FLOAT_SRC.indexOf('userData.spider') < FLOAT_SRC.indexOf('userData.ghoul'));

// ============ GROUND STANCE: the multi-eyed spider-walkers walk THE STREET ============
function rigStance(root) {
  // the lowest point hanging off the leg pivots (FEET included, in the model's own frame),
  // the hip height, and how far the feet reach out to the sides
  const rig = root.userData.spider || root.userData.hex || root.userData.hound || root.userData.ghoul;
  if (!rig) return null;
  const pivots = Array.isArray(rig.legs) ? rig.legs : Object.values(rig.legs || {});
  let lo = Infinity, hipZ = 0, reach = 0;
  pivots.forEach(function (hip) {
    hipZ = Math.max(hipZ, hip.position.z);
    reach = Math.max(reach, Math.abs(hip.position.y) + Math.abs(hip.rotation.x || 0) * 0.35);
    (function walk(node, z, depth) {
      if (!node || depth > 7) return;
      const cz = z + (node.position ? node.position.z : 0);
      const dip = node.r ? node.r * (node.scale ? node.scale.z : 1) : (node.dim ? node.dim[2] / 2 : 0);
      if (cz - dip < lo) lo = cz - dip;
      (node.children || []).forEach((c) => walk(c, cz, depth + 1));
    })(hip, 0, 0);
  });
  return { lo: lo, hipZ: hipZ, reach: reach, legs: pivots.length };
}
for (const g of ['fangspider', 'eyecrawler']) {
  const st = rigStance(MODELS[g]);
  check(g + ' stands ON THE ASPHALT: the lowest foot lands at z ' + (st ? st.lo.toFixed(2) : '?') +
    ' (the street floor is z 0 — nothing buried, nothing flying)',
    !!st && st.legs >= 6 && st.lo > -0.16 && st.lo < 0.2,
    'feetZ=' + (st ? st.lo.toFixed(3) : '?') + ' legs=' + (st ? st.legs : 0));
  check(g + ' is a WIDE-STANCE crawler: feet reach out past the body, hips low (' +
    (st ? st.hipZ.toFixed(2) : '?') + ')', !!st && st.reach >= 0.22 && st.hipZ <= 0.55,
    'reach=' + (st ? st.reach.toFixed(2) : '?') + ' hipZ=' + (st ? st.hipZ.toFixed(2) : '?'));
}
check('the spider carries its sac ON the legs, not up in the air (body centre under 0.6)',
  MODELS.fangspider.userData.spider.body.position.z < 0.6,
  'bodyZ=' + MODELS.fangspider.userData.spider.body.position.z.toFixed(2));
const eyeTopZ = (() => {
  let top = 0;
  (function walk(n, z, d) {
    if (!n || d > 7) return;
    const cz = z + (n.position ? n.position.z : 0);
    if (cz > top) top = cz;
    (n.children || []).forEach((c) => walk(c, cz, d + 1));
  })(MODELS.eyecrawler, 0, 0);
  return top;
})();
check('the eye crawler keeps its stalk crown LOW over the shell (top under 1.0)',
  eyeTopZ < 1.0, 'topZ=' + eyeTopZ.toFixed(2));
check('the spider gait ROCKS on planted feet — no hopping up off the street',
  /c\.g\.position\.z = GZ \+ Math\.abs\(Math\.sin\(c\.phase \* 10\)\) \* 0\.014/.test(FLOAT_SRC));
check('the six-leg crawlers keep their bob under 0.02 (a ground crawl, not a leap)',
  /c\.g\.position\.z = GZ \+ Math\.abs\(Math\.sin\(c\.phase \* 9\)\) \* \(hunting \? 0\.018 : 0\.008\)/.test(FLOAT_SRC));
for (const g of ['grubsquat', 'ratking', 'lanternfang', 'goulra']) {
  const st = rigStance(MODELS[g]);
  check('the new ' + g + ' is built to stand on the street (feet at z ' + (st ? st.lo.toFixed(2) : '?') + ')',
    !!st && st.lo > -0.2 && st.lo < 0.25, 'feetZ=' + (st ? st.lo.toFixed(3) : '?'));
}
console.log('\n[3] ONE HORDE PER BLOCK — no creature of one block stands on another');
const NIGHT_BEAT_TOP_X = srcNum('NIGHT_BEAT_TOP_X'), NIGHT_BEAT_VERMIN_X = srcNum('NIGHT_BEAT_VERMIN_X');
const NIGHT_BEAT_DIGGER_X = srcNum('NIGHT_BEAT_DIGGER_X'), NIGHT_BEAT_GRAVE_X = srcNum('NIGHT_BEAT_GRAVE_X');
const NIGHT_BLOCKS = eval('(' + srcLiteral('NIGHT_BLOCKS', '[', ']') + ')');
const HORROR_FILL_ORDER = eval('(' + srcLiteral('HORROR_FILL_ORDER', '[', ']') + ')');
const LEVEL_BLOCKS = eval('(' + srcLiteral('LEVEL_BLOCKS', '[', ']') + ')');
const HORROR_QUOTA = eval('(' + srcLiteral('HORROR_QUOTA', '{', '}') + ')');
const HORROR_ALL = eval('(' + srcLiteral('HORROR_ALL', '{', '}') + ')');
const HORROR_QUOTA_CEIL = eval('(' + srcLiteral('HORROR_QUOTA_CEIL', '{', '}') + ')');
const NIGHT_PACK_SLACK = srcNum('NIGHT_PACK_SLACK');
const HORROR_ROSTER_CAP = srcNum('HORROR_ROSTER_CAP'), HORROR_SCREEN_CAP = srcNum('HORROR_SCREEN_CAP');
const ACTIVE_XS = LEVEL_BLOCKS.filter((b) => b.garbage).map((b) => b.x);
const ADD_NIGHT_SRC = srcFn('spawnNightShift');
const HAUNT_SRC = srcFn('updateNightHaunt');
// THE GAME'S OWN HELPERS, extracted and wired (no re-implementation in the harness)
const packFn = new Function('NIGHT_BLOCKS', 'BLOCK_W', 'IW',
  srcFn('nightBlockPack') + '\nreturn nightBlockPack;')(NIGHT_BLOCKS, BLOCK_W, IW);
const bandPackFn = new Function('nightBlockPack',
  srcFn('nightBandPack') + '\nreturn nightBandPack;')(packFn);
const famFn = new Function('nightBandPack', 'HORROR_ALL',
  srcFn('nightBlockFamilies') + '\nreturn nightBlockFamilies;')(bandPackFn, HORROR_ALL);
let nightGhoulTier = 0;
const blockQuotaFn = new Function('nightGhoulTier', 'nightBandPack', 'HORROR_QUOTA_CEIL', 'NIGHT_PACK_ESCALATE',
  srcFn('nightBlockQuota') + '\nreturn nightBlockQuota;');
const blockQuota = (type, band) =>
  blockQuotaFn(nightGhoulTier, bandPackFn, HORROR_QUOTA_CEIL, true)(type, band);
const orderFn = new Function('nightBlockFamilies', 'nightBlockQuota',
  srcFn('nightBlockOrder') + '\nreturn nightBlockOrder;')(famFn, blockQuota);
const ownsFn = new Function('nightBlockPack', 'nightBandPack',
  srcFn('nightBlockOwns') + '\nreturn nightBlockOwns;')(packFn, bandPackFn);
const blockOfFn = new Function('NIGHT_BLOCKS',
  srcFn('nightBlockOf') + '\nreturn nightBlockOf;')(NIGHT_BLOCKS);
const bandOfX = (x) => ({ x0: x, x1: x + BLOCK_W });
check('the block beats are laid out up the dead-end street (' + ACTIVE_XS.slice().sort((a, b) => b - a).join(' / ') + ')',
  ACTIVE_XS.length >= 4 && NIGHT_BEAT_TOP_X === 384 && NIGHT_BEAT_VERMIN_X === 288 &&
  NIGHT_BEAT_DIGGER_X === 192 && NIGHT_BEAT_GRAVE_X === 96);
check('EVERY active block has a pack of its own, and every pack is a full horde',
  ACTIVE_XS.every((x) => famFn(bandOfX(x)).length >= 4),
  ACTIVE_XS.map((x) => x + '=' + famFn(bandOfX(x)).length).join(' '));
// THE EXCLUSIVITY TEST: not one family may appear in two blocks.
const blockFams = ACTIVE_XS.map((x) => famFn(bandOfX(x)).slice().sort());
const seenFams = {};
let doubleBooked = [];
blockFams.forEach((fams) => fams.forEach((f) => {
  seenFams[f] = (seenFams[f] || 0) + 1;
  if (seenFams[f] > 1 && doubleBooked.indexOf(f) < 0) doubleBooked.push(f);
}));
check('NO FAMILY IS REUSED: not one creature stands on two blocks (' +
  Object.keys(seenFams).length + ' families, ' + blockFams.map((f) => f.length).join('/') + ' per block)',
  doubleBooked.length === 0, doubleBooked.length ? 'shared: ' + doubleBooked.join(',') : 'all disjoint');
check('each family resolves to exactly ONE home block (nightBlockOf answers for every family)',
  Object.keys(seenFams).every((f) => {
    const e = blockOfFn(f);
    return !!e && famFn(bandOfX(e.x)).indexOf(f) >= 0 &&
      ACTIVE_XS.filter((x) => famFn(bandOfX(x)).indexOf(f) >= 0).length === 1;
  }));
check('the four beats run FOUR DIFFERENT hordes (nobody shares a set, nobody shares a family)',
  new Set(blockFams.map((f) => f.join(','))).size === blockFams.length);
check('THE FOG GANG keeps the spirits and nothing else',
  ['specter', 'wraith', 'poltergeist', 'banshee'].every((f) => famFn(bandOfX(384)).indexOf(f) >= 0) &&
  !['ghoul', 'fangspider', 'grubsquat', 'pitfiend'].some((f) => famFn(bandOfX(384)).indexOf(f) >= 0));
check('THE VERMIN keeps the crawling things (the squat, the gremlins, the spiders, the rat king)',
  ['grubsquat', 'gremlin', 'fangspider', 'ratking'].every((f) => famFn(bandOfX(288)).indexOf(f) >= 0) &&
  !['ghoul', 'specter', 'reaper', 'pitfiend'].some((f) => famFn(bandOfX(288)).indexOf(f) >= 0));
check('THE DIGGERS keep the ghouls, the red-eyed dead, the hounds and the lanternfangs',
  ['ghoul', 'skeleton', 'goblin', 'hound', 'lanternfang'].every((f) => famFn(bandOfX(192)).indexOf(f) >= 0) &&
  !['fangspider', 'ratking', 'goulra', 'specter'].some((f) => famFn(bandOfX(192)).indexOf(f) >= 0));
check('THE GRAVE WATCH (the flood block) keeps the heavy end, incl. the nine-eyed goulra',
  ['pitfiend', 'demon', 'devil', 'eyecrawler', 'goulra', 'lich', 'reaper'].every((f) => famFn(bandOfX(96)).indexOf(f) >= 0));
check('the flood block runs its OWN table (heavier than its plain block table) and the street stays capped; THE GRAVE WATCH BILL WAS CUT to 20 — at or below the opening blocks, because the last fight is the beast',
  (() => {
    const floodTotal = famFn(bandOfX(96)).reduce((s, f) => s + blockQuota(f, { x0: 96, x1: 176, flood: true }), 0);
    const others = ACTIVE_XS.filter((x) => x !== 96).map((x) =>
      famFn(bandOfX(x)).reduce((s, f) => s + blockQuota(f, bandOfX(x)), 0));
    const e = NIGHT_BLOCKS.filter((x) => x.x === 96)[0];
    const packTotal = Object.keys(e.pack).reduce((s, k) => s + e.pack[k], 0);
    return floodTotal === 20 && floodTotal > packTotal &&
      floodTotal <= Math.max.apply(null, others) && others.every((n) => n >= 18);
  })(),
  'flood=' + famFn(bandOfX(96)).reduce((s, f) => s + blockQuota(f, { x0: 96, x1: 176, flood: true }), 0) +
  ' others=' + ACTIVE_XS.filter((x) => x !== 96).map((x) =>
    famFn(bandOfX(x)).reduce((s, f) => s + blockQuota(f, bandOfX(x)), 0)).join('/'));
check('the flood table is at least the block table on every family it lists',
  (() => {
    const e = NIGHT_BLOCKS.filter((x) => x.x === 96)[0];
    return !!e.flood && Object.keys(e.flood).every((k) => e.flood[k] >= e.pack[k]);
  })());
check('a family the block does not list has ZERO quota there (the exclusivity is arithmetic)',
  ACTIVE_XS.every((x) => Object.keys(HORROR_ALL).every((f) =>
    famFn(bandOfX(x)).indexOf(f) >= 0 || blockQuota(f, bandOfX(x)) === 0)));
check('the whole street stays INSIDE the roster cap at base quota',
  ACTIVE_XS.reduce((s, x) => s + famFn(bandOfX(x)).reduce((q, f) =>
    q + blockQuota(f, x === 96 ? { x0: 96, x1: 176, flood: true } : bandOfX(x)), 0), 0) <= HORROR_ROSTER_CAP,
  'base=' + ACTIVE_XS.reduce((s, x) => s + famFn(bandOfX(x)).reduce((q, f) =>
    q + blockQuota(f, x === 96 ? { x0: 96, x1: 176, flood: true } : bandOfX(x)), 0), 0) + ' cap=' + HORROR_ROSTER_CAP);
check('THE SPAWN GATE IS ARMED: nightBlockOwns answers the band and the FAMILY key (a cosmetic variant never vetoes the animal)',
  /nightBlockOwns\(type, band\)/.test(srcFn('nightSpawnHorror')) &&
    !/nightBlockOwns\(variant/.test(srcFn('nightSpawnHorror')));
check('THE GATE REFUSES A FOREIGN FAMILY: a ghoul asked for on the vermin block is refused',
  ownsFn('ghoul', bandOfX(288)) === false && ownsFn('gremlin', bandOfX(288)) === true &&
  ownsFn('ghoul', bandOfX(192)) === true && ownsFn('banshee', bandOfX(384)) === true &&
  ownsFn('grubsquat', bandOfX(192)) === false && ownsFn('goulra', bandOfX(288)) === false);
check('every spook records its HOME band at birth (the block it works)',
  /c\.home = \{ x0: band\.x0, x1: band\.x1, i: band\.i \}/.test(srcFn('nightSpawnHorror')));
check('a block spook re-enters the fog OUT OF ITS OWN BLOCK (no import from a neighbour)',
  /isNightShift\(\) && c\.home/.test(srcFn('horrorRespawnX')) &&
  /nightBlockBandXs\(c\.home\)/.test(srcFn('horrorRespawnX')));
check('its wander lanes are drawn inside its own block too (the work box)',
  /horrorWorkLimits\(c\)/.test(srcFn('updateHorrorCreature')) &&
  /c\.home \? c\.home\.x0 \+ R\(-6, BLOCK_W \+ 6\)/.test(srcFn('updateHorrorCreature')) &&
  /c\.wx = clamp\(c\.wx, WK\.lo, WK\.hi\)/.test(srcFn('updateHorrorCreature')));
check('the work box is the block band + slack on Midnight and the shipped full route by day',
  /isNightShift\(\) && c && c\.home/.test(srcFn('horrorWorkLimits')) &&
  /return \{ lo: creatureLimitMinX\(\), hi: creatureLimitMaxX\(\) \}/.test(srcFn('horrorWorkLimits')));
check('the opening fill seeds EACH BLOCK with ITS OWN pack (no shared per-band pass left)',
  /nightBlockFamilies\(band\)/.test(ADD_NIGHT_SRC) && /nightBlockQuota\(key, band\)/.test(ADD_NIGHT_SRC) &&
  !/nightFillKeys/.test(ADD_NIGHT_SRC));
check('the haunt top-up fills the band with ITS OWN order and quota',
  /nightBlockOrder\(band, surge\)/.test(HAUNT_SRC) && /nightBlockQuota\(type, band\)/.test(HAUNT_SRC));
check('the surge hits HIS block with the block\u2019s own heavies (no shipped shock pack)',
  !/HORROR_FILL_ORDER/.test(srcFn('nightBlockOrder')) &&
  /fams\.slice\(0, 3\)/.test(srcFn('nightBlockOrder')) &&
  /fams\.concat\(heavy, heavy\)/.test(srcFn('nightBlockOrder')));
check('the fill order of a band is ITS OWN families, heaviest first',
  (() => {
    const band = bandOfX(192);
    const o = orderFn(band, false);
    const q = o.map((f) => blockQuota(f, band));
    return o.length === famFn(band).length && q.every((v, i) => i === 0 || v <= q[i - 1]) &&
      q[0] === Math.max.apply(null, q);
  })());
check('every surge entry is a family of the band it is filling (a surge never imports)',
  ACTIVE_XS.every((x) => {
    const band = x === 96 ? { x0: 96, x1: 176, flood: true } : bandOfX(x);
    return orderFn(band, true).every((f) => ownsFn(f, band) === true);
  }));
check('a band with no entry of its own still lands on a pack (no block can ever be quiet)',
  ACTIVE_XS.concat([24, 700, 0]).every((x) => famFn({ x0: x, x1: x + BLOCK_W }).length >= 4));
// THE FILL SIMULATION: run the seed the way the game seeds it, and watch what stands where.
(function simulateFill() {
  const byBand = {};
  const live = { n: 0 };
  for (const x of ACTIVE_XS) {
    const band = x === 96 ? { x0: 96, x1: 176, flood: true } : bandOfX(x);
    for (const f of orderFn(band, false)) {
      const want = blockQuota(f, band);
      for (let i = 0; i < want; i++) {
        if (live.n >= HORROR_ROSTER_CAP) break;
        live.n++;
        (byBand[x] = byBand[x] || []).push(f);
      }
    }
  }
  const counts = ACTIVE_XS.map((x) => (byBand[x] || []).length);
  check('a full seed leaves every block POPULATED (' + counts.join(' / ') + ' spooks)',
    counts.every((n) => n >= 18), counts.join('/'));
  check('the seeded street sits at or under the roster cap (' + live.n + ' live)',
    live.n <= HORROR_ROSTER_CAP);
  check('after the seed, not one block shows a creature another block shows',
    (() => {
      const setOf = ACTIVE_XS.map((x) => new Set(byBand[x] || []));
      for (let i = 0; i < setOf.length; i++)
        for (let j = i + 1; j < setOf.length; j++)
          if ([...setOf[i]].some((f) => setOf[j].has(f))) return false;
      return setOf.every((s) => s.size >= 4);
    })(),
    ACTIVE_XS.map((x) => (byBand[x] || []).length + ':' + new Set(byBand[x] || []).size).join(' '));
  check('THE GRAVE WATCH carries a real seeded horde (' + (byBand[96] || []).length + ' animals standing) — every family of its pack on the ground — AND IT IS NOW THE LIGHTEST BLOCK ON THE STREET: no block seeds fewer than it, and its bill is the cut 20, not the old 30-animal farm',
    (byBand[96] || []).length === 20 &&
      new Set(byBand[96]).size >= 4 &&
      ACTIVE_XS.filter((x) => x !== 96).every((x) => (byBand[96] || []).length <= (byBand[x] || []).length));
  check('the wave tier raises a block\u2019s OWN families and never hands it a stranger',
    (() => {
      nightGhoulTier = 4;
      const band = bandOfX(192);
      const before = famFn(band).slice().join(',');
      const pack = NIGHT_BLOCKS.filter((e) => e.x === 192)[0].pack;
      const raised = famFn(band).every((f) => blockQuota(f, band) >= pack[f]);
      nightGhoulTier = 0;
      return raised && famFn(band).slice().join(',') === before;
    })());
  check('the ghoul ceiling still binds its own block',
    (() => {
      nightGhoulTier = 6;
      const v = blockQuota('ghoul', bandOfX(192));
      nightGhoulTier = 0;
      return v <= HORROR_QUOTA_CEIL.ghoul;
    })(),
    (() => { nightGhoulTier = 6; const v = blockQuota('ghoul', bandOfX(192)); nightGhoulTier = 0; return 'tier6=' + v; })());
  check('A CLEARED BLOCK IS A BLOCK THAT OPENS: the ward gate is a per-block test — its own live animals, the pack it SENT out, and the pack the shovel PAID for',
    /if \(nightGateLive\(band\) > 0\) continue;/.test(srcFn('nightGateCheck')) &&
      /if \(led\.sent < nightGateLoad\(band\)\) continue;/.test(srcFn('nightGateCheck')) &&
      /if \(led\.yield < nightGateLoad\(band\)\) continue;/.test(srcFn('nightGateCheck')) &&
      /nightGateOpenLedger\(led\);/.test(srcFn('nightGateCheck')) &&
      /const NIGHT_PACK_ESCALATE = true/.test(html));
  check('AND NOTHING LEAVES THE STREET UNACCOUNTED, ONCE PER ANIMAL: the fog pays, the shovel pays, and an animal is settled ONE time',
    /if \(nightGateOn\(\)\) nightGateCredit\(c\);/.test(srcFn('cullHorror')) &&
      /if \(spook\) nightGateCredit\(spook\);/.test(srcFn('shovelBanish')) &&
      /if \(c\.gatePaid\) return;/.test(srcFn('nightGateCredit')) &&
      /ledS\.sent\+\+/.test(srcFn('nightSpawnHorror')) &&
      /sent: 0,/.test(srcFn('nightGateLedger')) &&
      /Math\.max\(0, debt - Math\.min\(led\.yield, debt\)\)/.test(srcFn('nightGateLeft')) &&
      /left: nightGateLeft\(band\)/.test(srcFn('nightGateProgress')));
  check('AND THE WARD DROP LIGHTS THE "GO!" ARROW (the flash is the night\u2019s own cue, and the ward code fires it on the fall)',
    /nightGoFlash\(led\);/.test(srcFn('nightGateOpenLedger')) &&
      /const NIGHT_GO_FLASH =[\s\d.]+;/.test(html) &&
      /typeof isNightShift !== "function" \|\| !isNightShift\(\)\) return;/.test(srcFn('nightGoFlash')));
})();
console.log('\n[4] the shipped street is untouched, and the pack animals MOVE');
check('HORROR_QUOTA / HORROR_QUOTA_FLOOD / HORROR_FILL_ORDER are the shipped tables',
  /ghoul: 9, hound: 3, specter: 4, banshee: 2, imp: 3, wraith: 2/.test(srcLiteral('HORROR_QUOTA', '{', '}')) &&
  /ghoul: 14, hound: 5, specter: 3, banshee: 3, imp: 5, wraith: 3/.test(srcLiteral('HORROR_QUOTA_FLOOD', '{', '}')) &&
  /"ghoul", "ghoul", "imp", "hound", "specter", "banshee", "wraith"/.test(srcLiteral('HORROR_FILL_ORDER', '[', ']')));
check('the haunt top-up is still bounded by the roster cap and the screen cap',
  /nightHorrorLive\(\) >= HORROR_ROSTER_CAP/.test(HAUNT_SRC) &&
  /nightHorrorOnScreen\(\) >= HORROR_SCREEN_CAP/.test(HAUNT_SRC));
check('the haunt only ever runs on the night shift (the seven weekdays never see a pack)',
  /isNightShift\(\)/.test(HAUNT_SRC));
check('the block exclusivity is Midnight-only (the gate never arms on a weekday)',
  /typeof isNightShift === "function" &&/.test(srcFn('nightSpawnHorror')) &&
  /isNightShift\(\) &&/.test(srcFn('nightSpawnHorror')) &&
  /!nightBlockOwns\(type, band\)/.test(srcFn('nightSpawnHorror')));
check('the dead-end layout knobs are all still in force (one cross-street, cemetery last, fence wall)',
  /const NIGHT_XS = \[464\]/.test(html) && /const NIGHT_CEMETERY_BLOCK_IDX = 0/.test(html) &&
  /const NIGHT_FENCE_Y = 8\.3/.test(html) && /const NIGHT_TOP_BLOCK_X = 384/.test(html));
check('Maspeth keeps its own plaque name (Mount Mongo); the dead end says St Basuras',
  /const NIGHT_CEMETERY_NAME = "St Basuras Cemetery"/.test(html) && /Mount Mongo Cemetery/.test(html));
const floatFn = new Function('THREE', 'M', 'BX', 'CY', 'SP', 'SPH', 'GZ', 'c', 'dt', 'hunting',
  srcFn('floatOrLope') + '\nreturn floatOrLope;')(THREE, M, BX, CY, SP, SPH, GZ);
for (const f of FAMS) {
  const c = { type: f.type, g: MODELS[f.type], phase: 1.1, hopT: 0.4, wx: 100, wy: 2.4, floaty: false };
  const snap = () => JSON.stringify(collect(c.g).map((o) => [o.rotation.x, o.rotation.y, o.rotation.z, o.position.z, o.scale.x]));
  const start = snap();
  for (let i = 0; i < 14; i++) floatFn(c, 1 / 60, i % 2 === 0);
  check(f.type + ' animates on its rig (parts move under floatOrLope)', snap() !== start);
  check(f.type + ' keeps itself on/above the asphalt (the GZ floor)', c.g.position.z >= GZ - 0.06,
    'z=' + c.g.position.z.toFixed(3));
}
check('the hound-rigged RAT KING gallops on diagonal leg pairs and lashes its tail',
  (() => {
    const c = { type: 'ratking', g: MODELS.ratking, phase: 0.9, wx: 100, wy: 2.4, floaty: false };
    const rig = MODELS.ratking.userData.hound;
    let lashed = 0;
    for (let i = 0; i < 40; i++) {
      floatFn(c, 1 / 60, true);
      if (Math.abs(rig.tailPiv.rotation.y) > 0.15) lashed++;
    }
    return lashed > 8 && rig.legs.legFL.rotation.y === rig.legs.legBR.rotation.y &&
      rig.legs.legFL.rotation.y === -rig.legs.legFR.rotation.y;
  })());
check('the spider plants its feet and rocks on them (legs swing fore-and-aft, body stays down)',
  (() => {
    const c = { type: 'fangspider', g: MODELS.fangspider, phase: 0.7, wx: 100, wy: 2.4, floaty: false };
    const rig = MODELS.fangspider.userData.spider;
    let swing = 0, airMax = 0;
    for (let i = 0; i < 60; i++) {
      floatFn(c, 1 / 60, true);
      if (Math.max.apply(null, rig.legs.map((l) => Math.abs(l.rotation.y))) > 0.3) swing++;
      airMax = Math.max(airMax, c.g.position.z - GZ);
    }
    return swing > 20 && airMax <= 0.02;
  })(),
  'maxAir=' + (() => {
    const c = { type: 'fangspider', g: MODELS.fangspider, phase: 0.7, wx: 100, wy: 2.4, floaty: false };
    let airMax = 0;
    for (let i = 0; i < 60; i++) { floatFn(c, 1 / 60, true); airMax = Math.max(airMax, c.g.position.z - GZ); }
    return airMax.toFixed(3);
  })());
check('the six-leg crawlers (eye crawler, grave-squat) stay ground-bound on their tripod gait',
  (() => {
    let worst = 0;
    for (const t of ['eyecrawler', 'grubsquat']) {
      const c = { type: t, g: MODELS[t], phase: 0.5, wx: 100, wy: 2.4, floaty: false };
      for (let i = 0; i < 60; i++) {
        floatFn(c, 1 / 60, true);
        worst = Math.max(worst, c.g.position.z - GZ);
      }
    }
    return worst <= 0.02;
  })());
// 14) NESTING GUARD — every builder and every block-pack helper must be declared at
// TOP-LEVEL brace depth. A family inserted INSIDE another function parses fine, passes
// every regex-based check in this file, and then throws "makeX is not defined" the moment
// the game builds it: makeRatking landed inside makeGrubsquat and makeLanternfang deeper
// still, so addCreature("lanternfang") threw during spawnNightShift and the ENTIRE
// start-game transition died with a green test suite. Strip strings/comments, walk the
// braces, and read the depth on each declaration line.
const STRIPPED = (() => {
  const S = html;
  let out = '', i = 0;
  while (i < S.length) {
    const c = S[i], two = S.substr(i, 2);
    if (two === '//') { while (i < S.length && S[i] !== '\n') i++; continue; }
    if (two === '/*') { const e = S.indexOf('*/', i); i = e < 0 ? S.length : e + 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < S.length) { if (S[i] === '\\') { i += 2; continue; } if (S[i] === q) { i++; break; } i++; }
      out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
})();
(() => {
  const lines = STRIPPED.split('\n');
  const want = ['makeGrubsquat', 'makeRatking', 'makeLanternfang', 'makeGoulra', 'makeFangspider', 'makeEyecrawler', 'makePitfiend', 'makeWraith', 'makeSpecter', 'nightBandPack', 'nightBlockOf', 'nightBlockOwns', 'nightBlockQuota', 'nightBlockFamilies', 'nightBlockOrder', 'horrorWorkLimits', 'horrorRespawnX', 'nightSpawnHorror', 'addCreature', 'updateHorrorCreature', 'spawnNightShift', 'advanceGame',
    // THE SPECTRAL BLOCK WARDS (the same nesting tripwire covers the gate system)
    'nightGateOn', 'nightBlockName', 'nightGateX', 'nightGateWall', 'nightGateSurgeAdd', 'nightGateBaseLoad', 'nightGateLedger', 'nightGateLedgerOf', 'nightGateBandOf', 'nightGateLoad', 'nightGateLive', 'nightGateLeft', 'nightGateRoom', 'nightGateClosedAt', 'nightGateHolds', 'nightGateFloorX', 'nightGateDebt', 'nightGateFrontLedger', 'nightGateSay', 'nightGateYieldOf', 'nightGateCredit', 'nightGateStanding', 'nightGateOpenLedger', 'nightGoFlash', 'nightGoTick', 'nightGateCheck', 'nightGateAnimate', 'nightGateProgress', 'nightGateHudText', 'makeSpectralWard', 'nightGateClear', 'buildNightGates', 'nightGateCount', 'nightBlockBandXs', 'shovelBanish', 'landSpookInHopper', 'updateNightHaunt', 'updatePlayer'];
  const depthOf = {};
  let depth = 0;
  for (let k = 0; k < lines.length; k++) {
    want.forEach((nm) => { if (new RegExp('function ' + nm + '\\(').test(lines[k])) depthOf[nm] = depth; });
    for (let j = 0; j < lines[k].length; j++) {
      if (lines[k][j] === '{') depth++;
      else if (lines[k][j] === '}') depth--;
    }
  }
  want.forEach((nm) => check(`${nm} is declared at TOP-LEVEL scope (brace depth 0, never nested in another function): depth=${depthOf[nm] === undefined ? 'MISSING' : depthOf[nm]}`, depthOf[nm] === 0));
  check(`the inline game script closes balanced (final brace depth 0): ${depth}`, depth === 0);
})();

console.log('\n' + pass + ' block-pack checks passed, ' + fail + ' failed');
if (fail) { console.log(failures.map((f, i) => '  FAIL ' + (i + 1) + ') ' + f).join('\n')); process.exit(1); }
