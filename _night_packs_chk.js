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
console.log('\n[2] THE SEVEN NEW FAMILIES — built, rigged, registered');
const FAMS = [
  { type: 'gremlin', fn: 'makeGremlin', rig: 'ghoul' },
  { type: 'goblin', fn: 'makeGoblin', rig: 'ghoul' },
  { type: 'devil', fn: 'makeDevil', rig: 'ghoul' },
  { type: 'fangspider', fn: 'makeFangspider', rig: 'spider' },
  { type: 'eyecrawler', fn: 'makeEyecrawler', rig: 'hex' },
  { type: 'skeleton', fn: 'makeSkeleton', rig: 'ghoul' },
  { type: 'pitfiend', fn: 'makePitfiend', rig: 'ghoul' },
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
    ci >= 0 && ADD_SRC.slice(ci, ci + 420).includes(f.fn + '()') &&
    ADD_SRC.slice(ci, ci + 420).includes('chaseSp') && ADD_SRC.slice(ci, ci + 420).includes('lopeSp'));
  const ui = UPD_SRC.indexOf('case "' + f.type + '":');
  check('updateCreatures runs ' + f.type + ' through the shared horror brain',
    ui >= 0 && UPD_SRC.slice(ui, ui + 640).includes('updateHorrorCreature(c, dt)'));
}
check('the fanged spider has its own EIGHT-leg gait branch (and its fangs strike)',
  /const spd = c\.g\.userData\.spider;/.test(FLOAT_SRC) && /spd\.legs\[li\]\.rotation\.y/.test(FLOAT_SRC) &&
  /fangs\[fi\]\.rotation\.x/.test(FLOAT_SRC));
check('the pitfiend brings its brine ring (the tent rig branch) into floatOrLope',
  /const tn = c\.g\.userData\.tent;/.test(FLOAT_SRC) && /tn\.tentacles\[ti\]/.test(FLOAT_SRC) &&
  /ti \* 0\.9/.test(FLOAT_SRC) && /hunting \? 5\.5 : 2\.3/.test(FLOAT_SRC));
check('the eye stalks pulse on the shared eye contract (floatOrLope)',
  /const ec = c\.g\.userData\.eyes;/.test(FLOAT_SRC));
check('the spider returns before the ghoul fallback (eight legs, not two arms)',
  FLOAT_SRC.indexOf('userData.spider') < FLOAT_SRC.indexOf('userData.ghoul'));
console.log('\n[3] THE PER-BLOCK PACKS — a different attacking set on every block');
const NIGHT_BLOCKS = eval('(' + srcLiteral('NIGHT_BLOCKS', '[', ']') + ')');
const HORROR_FILL_ORDER = eval('(' + srcLiteral('HORROR_FILL_ORDER', '[', ']') + ')');
const LEVEL_BLOCKS = eval('(' + srcLiteral('LEVEL_BLOCKS', '[', ']') + ')');
const HORROR_QUOTA = eval('(' + srcLiteral('HORROR_QUOTA', '{', '}') + ')');
const HORROR_QUOTA_FLOOD = eval('(' + srcLiteral('HORROR_QUOTA_FLOOD', '{', '}') + ')');
const HORROR_ALL = eval('(' + srcLiteral('HORROR_ALL', '{', '}') + ')');
const ACTIVE_XS = LEVEL_BLOCKS.filter((b) => b.garbage).map((b) => b.x);
const packFn = new Function('NIGHT_BLOCKS', 'BLOCK_W', 'IW',
  srcFn('nightBlockPack') + '\nreturn nightBlockPack;')(NIGHT_BLOCKS, BLOCK_W, IW);
const famFn = new Function('nightBlockPack', 'HORROR_ALL',
  srcFn('nightBlockFamilies') + '\nreturn nightBlockFamilies;')(packFn, HORROR_ALL);
const orderFn = new Function('nightBlockFamilies', 'HORROR_FILL_ORDER',
  srcFn('nightBlockOrder') + '\nreturn nightBlockOrder;')(famFn, HORROR_FILL_ORDER);
const blockQuota = new Function('nightBlockPack', 'nightQuota', 'HORROR_QUOTA_CEIL',
  srcFn('nightBlockQuota') + '\nreturn nightBlockQuota;')(
  packFn, (t, flood) => (flood ? HORROR_QUOTA_FLOOD : HORROR_QUOTA)[t] || 0,
  eval('(' + srcLiteral('HORROR_QUOTA_CEIL', '{', '}') + ')'));
check('every ACTIVE block of the dead-end street has a pack of its own',
  ACTIVE_XS.every((x) => !!packFn({ x0: x, x1: x + BLOCK_W })),
  ACTIVE_XS.map((x) => x + '->' + (packFn({ x0: x }) || {}).name).join(' '));
check('NIGHT_BLOCKS covers only blocks that are on the route (' + ACTIVE_XS.join(',') + ')',
  NIGHT_BLOCKS.every((p) => ACTIVE_XS.indexOf(p.x) >= 0), NIGHT_BLOCKS.map((p) => p.x).join(','));
check('one signature pack per ACTIVE block (' + NIGHT_BLOCKS.length + ' packs over ' + ACTIVE_XS.length + ' blocks)',
  NIGHT_BLOCKS.length === ACTIVE_XS.length);
const famSets = NIGHT_BLOCKS.map((p) => famFn({ x0: p.x }).slice().sort().join(','));
check('no two blocks share the same attacking set (' + new Set(famSets).size + ' distinct sets)',
  new Set(famSets).size === famSets.length, famSets.join(' | '));
const packFams = new Set(NIGHT_BLOCKS.reduce((a, p) => a.concat(famFn({ x0: p.x })), []));
check('the seven new horrors are all live on the street',
  ['gremlin', 'goblin', 'devil', 'fangspider', 'eyecrawler', 'skeleton', 'pitfiend'].every((f) => packFams.has(f)),
  [...packFams].join(' '));
check('a pack family is always a known horror (it counts against the caps and the flinch)',
  [...packFams].every((f) => new RegExp('\\b' + f + ': 1').test(srcLiteral('HORROR_ALL', '{', '}'))));
check('every block pack family has its addCreature case (a banshee rides the specter variant)',
  [...packFams].every((f) => f === 'banshee'
    ? /case "specter":/.test(ADD_SRC) && /"banshee"/.test(ADD_SRC)
    : new RegExp('case "' + f + '":').test(ADD_SRC)),
  [...packFams].filter((f) => !new RegExp('case "' + f + '":').test(ADD_SRC)).join(','));
check('a block pack only ADDS to the shipped quota (the shipped density never moves)',
  NIGHT_BLOCKS.every((p) => famFn({ x0: p.x }).every((f) => blockQuota(f, { x0: p.x }) >= (HORROR_QUOTA[f] || 0))));
check('the flood block (the top of the graves, x96) runs the heavy end: devils, skeletons, pitfiends',
  (() => {
    const hit = NIGHT_BLOCKS.filter((p) => ['devil', 'skeleton', 'pitfiend'].every((f) => famFn({ x0: p.x }).indexOf(f) >= 0));
    return hit.length === 1 && hit[0].x === 96;
  })(), NIGHT_BLOCKS.map((p) => p.x + '=' + famFn({ x0: p.x }).join('/')).join('  '));
check('the per-block fill order keeps the SHIPPED order first, then appends the block pack',
  NIGHT_BLOCKS.every((p) => {
    const o = orderFn({ x0: p.x }, false);
    const fams = famFn({ x0: p.x });
    return o.slice(0, HORROR_FILL_ORDER.length).join(',') === HORROR_FILL_ORDER.join(',') &&
      o.length === HORROR_FILL_ORDER.length + fams.length &&
      fams.every((f, i) => o[HORROR_FILL_ORDER.length + i] === f);
  }));
check('the ABYSS SURGE keeps its shipped shock pack (ghoul, ghoul, demon, hound) on the block order',
  /HORROR_FILL_ORDER\.concat\(\["ghoul", "ghoul", "demon", "hound"\], fams\)/.test(srcFn('nightBlockOrder')));
check('a band with no entry of its own still lands on a pack (no block can ever be quiet)',
  ACTIVE_XS.concat([24, 700, 0]).every((x) => famFn({ x0: x }).length >= 2));
const cap = srcNum('HORROR_ROSTER_CAP');
let packAdd = 0;
for (const x of ACTIVE_XS) {
  const band = { x0: x, x1: x + BLOCK_W, flood: false };
  for (const f of famFn(band)) packAdd += blockQuota(f, band) - (HORROR_QUOTA[f] || 0);
}
check('the whole-street pack load stays under the roster cap (' + packAdd + ' ADDED horrors, cap ' + cap + ')',
  packAdd > 0 && packAdd < cap);
check('the block packs are reached ONLY from the night haunt and the night opening fill',
  (() => {
    const callers = html.split(/\r?\n/).filter((l) =>
      /nightBlock(Quota|Order|Families)\(/.test(l) && !/function nightBlock/.test(l) && !/^\s*\/\//.test(l));
    return callers.length >= 4;
  })());
console.log('\n[3b] the packs POPULATE: a fill pass, band by band (shipped quotas + the packs)');
(function fillSim() {
  const live = [];
  const floodX = ACTIVE_XS[0]; // on the dead-end shift the FLOOD is the band at the graves
  for (const x of ACTIVE_XS) {
    const band = { x0: x, x1: x + BLOCK_W, cx: x + BLOCK_W / 2, flood: x === floodX };
    const q = band.flood ? HORROR_QUOTA_FLOOD : HORROR_QUOTA;
    for (const key of famFn(band)) {
      const shipped = q[key] || 0;
      const total = blockQuota(key, band);
      for (let i = 0; i < total - shipped; i++) live.push({ type: key, band: x, pack: true });
      for (let i = 0; i < shipped; i++) live.push({ type: key, band: x, pack: false });
    }
  }
  const byBand = {};
  for (const c of live) (byBand[c.band] = byBand[c.band] || new Set()).add(c.type);
  const sets = ACTIVE_XS.map((x) => [...(byBand[x] || new Set())].sort().join(','));
  check('every block ends up haunted by its OWN pack (' + ACTIVE_XS.length + ' bands, ' + live.length + ' horrors)',
    ACTIVE_XS.every((x) => (byBand[x] || new Set()).size >= 3),
    ACTIVE_XS.map((x) => x + '=' + (byBand[x] || new Set()).size).join(' '));
  check('no block haunts with the same family set as another (' + sets.map((s) => s.split(',').length).join('/') + ' families)',
    new Set(sets).size === sets.length);
  check('the flood block (the graves) is the heaviest band (' + (byBand[floodX] || new Set()).size + ' families)',
    ACTIVE_XS.every((x) => (byBand[x] || new Set()).size <= (byBand[floodX] || new Set()).size));
  check('the flood block carries the heavy end of the roster (devils, skeletons, pitfiends)',
    ['devil', 'skeleton', 'pitfiend'].every((f) => (byBand[floodX] || new Set()).has(f)));
  check('the blocks between the clock-in and the graves run the NEW middle-end families',
    ACTIVE_XS.filter((x) => x !== floodX && x !== 384).every((x) =>
      ['gremlin', 'goblin', 'fangspider', 'eyecrawler'].some((f) => (byBand[x] || new Set()).has(f))));
})();
console.log('\n[4] the shipped street is untouched, and the pack animals MOVE');
check('HORROR_QUOTA / HORROR_QUOTA_FLOOD / HORROR_FILL_ORDER are the shipped tables',
  /ghoul: 9, hound: 3, specter: 4, banshee: 2, imp: 3, wraith: 2/.test(srcLiteral('HORROR_QUOTA', '{', '}')) &&
  /ghoul: 14, hound: 5, specter: 3, banshee: 3, imp: 5, wraith: 3/.test(srcLiteral('HORROR_QUOTA_FLOOD', '{', '}')) &&
  /"ghoul", "ghoul", "imp", "hound", "specter", "banshee", "wraith"/.test(srcLiteral('HORROR_FILL_ORDER', '[', ']')));
check('the opening fill still runs the shipped key-major pass (family by family across every band)',
  /for \(let ki = 0; ki < nightFillKeys\.length; ki\+\+\) \{[\s\S]{0,140}for \(let k = 0; k < bands\.length; k\+\+\)/.test(srcFn('spawnNightShift')));
check('the block packs are laid ON TOP of that pass (nightBlockFamilies in the same builder)',
  /nightBlockFamilies\(band\)/.test(srcFn('spawnNightShift')));
check('the haunt top-up is still bounded by the roster cap and the screen cap',
  /nightHorrorLive\(\) >= HORROR_ROSTER_CAP/.test(srcFn('updateNightHaunt')) &&
  /nightHorrorOnScreen\(\) >= HORROR_SCREEN_CAP/.test(srcFn('updateNightHaunt')));
check('the haunt only ever runs on the night shift (the seven weekdays never see a pack)',
  /isNightShift\(\)/.test(srcFn('updateNightHaunt')));
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
  for (let i = 0; i < 14; i++) floatFn(c, 1 / 60, i % 2 === 0);
  const moved = snap() !== JSON.stringify(collect(c.g).map(() => 0));
  check(f.type + ' animates on the shared lope (parts move under floatOrLope)', moved);
  check(f.type + ' keeps itself above the asphalt (the GZ floor)', c.g.position.z >= GZ - 0.06, 'z=' + c.g.position.z.toFixed(3));
}
console.log('\n' + pass + ' block-pack checks passed, ' + fail + ' failed');
if (fail) { console.log(failures.map((f, i) => '  FAIL ' + (i + 1) + ') ' + f).join('\n')); process.exit(1); }
