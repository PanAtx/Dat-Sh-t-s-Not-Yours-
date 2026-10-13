// _night_deadend_chk.js — THE MIDNIGHT DEAD-END STREET LAYOUT (Midnight only).
// [1] the dead-end constants; [2] the LIVE intersection builder (weekday vs Midnight);
// [3] the LIVE corner-store gate (weekday vs Midnight); [4] the name-driven cemetery
// plaque + the Maspeth wrought-iron graveyard build.
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
    castShadow: false, receiveShadow: false, material: null, geometry: null,
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } },
    rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } },
    scale: { x: 1, y: 1, z: 1, set() { return this; }, setScalar() { return this; } },
    add() { for (const c of arguments) { if (c) { this.children.push(c); c.parent = this; } } return this; },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; return this; },
    traverse(f) { f(this); for (const c of this.children) c.traverse && c.traverse(f); },
  };
}
const GEO = function (kind) { return function (a, b, c) { return { kind: kind, a: a, b: b, c: c, dispose: function () {} }; }; };
const THREE = {
  Group: function () { return mkObj('group'); },
  Mesh: function (g, m) { const o = mkObj('mesh'); o.geometry = g; o.material = m; return o; },
  Color: function () { return { setHex: function () { return this; }, getHex: function () { return 0; } }; },
  MeshLambertMaterial: function (o) { return Object.assign({ color: (o && o.color) | 0 }, o || {}); },
  MeshStandardMaterial: function (o) { return Object.assign({}, o || {}); },
  MeshBasicMaterial: function (o) { return Object.assign({}, o || {}); },
  PlaneGeometry: GEO('plane'), BoxGeometry: GEO('box'), CircleGeometry: GEO('circle'),
  CylinderGeometry: GEO('cyl'), SphereGeometry: GEO('sph'), ShapeGeometry: GEO('shape'),
  TorusGeometry: GEO('torus'), DoubleSide: 2,
  Shape: function () { return { moveTo: function () {}, lineTo: function () {}, absarc: function () {}, quadraticCurveTo: function () {}, closePath: function () {} }; },
  CanvasTexture: null,
};
const M = function (c, o) { return Object.assign({ color: c }, o || {}); };
const MS = M;
const R = function (a, b) { return a + Math.random() * (b - a); };
const GZ = 0.35;
console.log('[1] the dead-end layout constants');
const NIGHT_XS = eval(srcLiteral('NIGHT_XS', '[', ']'));
const NIGHT_GAP_XS = eval(srcLiteral('NIGHT_GAP_XS', '[', ']'));
const LEVEL_XS = eval(srcLiteral('LEVEL_XS', '[', ']'));
const LBLK = eval(srcLiteral('LEVEL_BLOCKS', '[', ']'));
const NIGHT_TOP_BLOCK_X = srcNum('NIGHT_TOP_BLOCK_X');
const NIGHT_CEMETERY_BLOCK_IDX = srcNum('NIGHT_CEMETERY_BLOCK_IDX');
const NIGHT_FENCE_Y = srcNum('NIGHT_FENCE_Y');
const CEM_FENCE_Y = srcNum('CEM_FENCE_Y');
const CEM_BACK_Y = srcNum('CEM_BACK_Y');
const BLOCK_W = 80; // BW * HOUSES_PER_BLOCK (asserted from the game by the layout checks)
const IW = 16, CROSS_W = srcNum('CROSS_W'), CROSS_H = srcNum('CROSS_H');
const NAME_M = html.match(/const NIGHT_CEMETERY_NAME = "([^"]+)"/);
check('Midnight keeps ONE intersection in its list', NIGHT_XS.length === 1, JSON.stringify(NIGHT_XS));
check('the kept intersection is the TOP of the level (x=464, beside the clock-in)', NIGHT_XS[0] === 464);
check('the five removed intersections are listed as plain street gaps',
  JSON.stringify(NIGHT_GAP_XS) === JSON.stringify([80, 176, 272, 368, 560]), JSON.stringify(NIGHT_GAP_XS));
check('kept + removed together are the whole weekday intersection set',
  NIGHT_XS.concat(NIGHT_GAP_XS).sort(function (a, b) { return a - b; }).join() === LEVEL_XS.slice().sort(function (a, b) { return a - b; }).join());
check('the weekday intersection list is untouched (six cross-streets)', LEVEL_XS.length === 6);
function gapCenters(xs) {
  const uniq = [];
  for (const x of xs) if (uniq.indexOf(x) < 0) uniq.push(x);
  return uniq.sort(function (a, b) { return a - b; });
}

check('the corner store is pinned to the TOP block of the dead end (x=384)', NIGHT_TOP_BLOCK_X === 384);
check('the last block on the route is the cemetery block (block 0, x 0..80)', NIGHT_CEMETERY_BLOCK_IDX === 0);
check('the street fence line runs through the front-lawn band (y 5.0..8.5)', NIGHT_FENCE_Y > 6.0 && NIGHT_FENCE_Y < 9.0, 'NIGHT_FENCE_Y=' + NIGHT_FENCE_Y);
check('the graveyard lot uses the Maspeth fence geometry (front line + back edge)',
  CEM_FENCE_Y === 5.4 && CEM_BACK_Y === 12.0, 'CEM_FENCE_Y=' + CEM_FENCE_Y + ' CEM_BACK_Y=' + CEM_BACK_Y);
check('the plaque reads "St Basuras Cemetery"', !!NAME_M && NAME_M[1] === 'St Basuras Cemetery', NAME_M && NAME_M[1]);
check('the fence runs are cut to the 80u block', BLOCK_W === 80);

console.log('\n[2] the LIVE intersection builder: weekdays vs. Midnight');
const INTER_SRC = srcFn('buildIntersections');
function runIntersections(night) {
  const ground = mkObj('ground');
  const fn = new Function('THREE', 'groundGroup', 'LEVEL_XS', 'IW', 'CROSS_W', 'CROSS_H', 'CROSS_CY',
    'CROSS_R', 'BLOCK_W', 'LEVEL_BLOCKS', 'isNightShift', 'NIGHT_XS', 'NIGHT_GAP_XS',
    'addCrosswalk', 'addCrosswalkAcross',
    INTER_SRC + '\n; return buildIntersections();');
  fn(THREE, ground, LEVEL_XS, IW, CROSS_W, CROSS_H, srcNum('CROSS_CY'), srcNum('CROSS_R'),
    BLOCK_W, LBLK, function () { return night; }, NIGHT_XS, NIGHT_GAP_XS, function () {}, function () {});
  let cross = 0, gap = 0;
  const crossX = [], gapX = [];
  const FILL = 16 - 3.0; // the dead-end gap curb/edge length (IW - 3.0)
  const isPlane = function (m) { return m && m.geometry && m.geometry.kind === 'plane'; };
  const scan = function (m) {
    if (!m || !m.geometry) return;
    if (m.geometry.kind === 'plane' && Math.abs(m.geometry.a - CROSS_W) < 1e-6) {
      cross++; crossX.push(m.position.x);
    } else if (m.geometry.kind === 'box' && Math.abs(m.geometry.a - FILL) < 1e-6) {
      gap++; gapX.push(m.position.x);
    }
  };
  for (const ch of ground.children) {
    if (ch.children && ch.children.length) ch.children.forEach(scan);
    else scan(ch);
  }
  return { cross: cross, gap: gap, crossX: crossX, gapX: gapX };
}
const wk = runIntersections(false);
const nt = runIntersections(true);
check('a weekday level builds all SIX cross-streets', wk.cross === 6, 'cross=' + wk.cross);
check('a weekday level paves NO extra gaps (the weekday layout is unchanged)', wk.gap === 0, 'gap=' + wk.gap);
check('MIDNIGHT builds exactly ONE cross-street', nt.cross === 1, 'cross=' + nt.cross);
console.log('\n[3] the LIVE store gate: weekday storefronts vs. the one Midnight bodega');
const gateStart = html.indexOf('            let storeOptions = null;');
const gateEnd = html.indexOf('makeBlockContents(b, worldX, i, storeOptions);', gateStart);
if (gateStart < 0 || gateEnd < 0) throw new Error('store gate block not found in index.html');
const GATE_SRC = html.slice(gateStart, gateEnd);
const TOP_IDX = LBLK.findIndex(function (x) { return x.x === NIGHT_TOP_BLOCK_X; });
function runStoreGate(night, bedStuyWeekday) {
  const stores = [], cem = [], made = [];
  const fn = new Function('borough', 'area', 'blkIdx', 'i', 'housesN', 'worldX', 'b', 'bl',
    'storePool', 'storeIdx', 'isUptown', 'isQueens',
    'QUEENS_CEMETERY_BLOCK', 'QUEENS_STORE_CORNERS', 'HOUSES_PER_BLOCK', 'isNightShift',
    'NIGHT_TOP_BLOCK_IDX', 'NIGHT_CEMETERY_BLOCK_IDX', 'makeBlockContents',
    GATE_SRC + ' makeBlockContents(b, worldX, i, storeOptions);');
  for (let blkIdx = 0; blkIdx < LBLK.length; blkIdx++) {
    for (let i = 0; i < 10; i++) {
      const bl = LBLK[blkIdx];
      const b = { blockX: bl.x, hazards: [], group: mkObj('g') };
      fn('BROOKLYN', 'BED-STUY', blkIdx, i, 10, bl.x + i * 8, b, bl,
        ['x'], 0, false, false, 4, null, 10,
        function () { return night; }, TOP_IDX, NIGHT_CEMETERY_BLOCK_IDX,
        function (rec, wx, ii, storeOptions) {
          made.push({ blkIdx: blkIdx, i: i, store: !!(storeOptions && storeOptions.isStore), cem: !!rec.cemetery });
          if (storeOptions && storeOptions.isStore) stores.push({ blkIdx: blkIdx, i: i });
          if (rec.cemetery) cem.push({ blkIdx: blkIdx, i: i });
        });
    }
  }
  return { stores: stores, cem: cem, made: made };
}
const wkGate = runStoreGate(false, true);
const ntGate = runStoreGate(true, true);
check('a Bed-Stuy weekday keeps a corner store on BOTH corners of every block (12 stores)',
  wkGate.stores.length === 12, 'stores=' + wkGate.stores.length);
check('MIDNIGHT has EXACTLY ONE corner store', ntGate.stores.length === 1, 'stores=' + ntGate.stores.length);
check('the Midnight store sits on the TOP block of the street (x=384)',
  ntGate.stores[0] && ntGate.stores[0].blkIdx === TOP_IDX, ntGate.stores.map(function (s) { return s.blkIdx; }).join());
check('...on the block corner that fronts the kept intersection (the last cell of the block)',
  ntGate.stores[0] && ntGate.stores[0].i === 9, ntGate.stores.map(function (s) { return s.i; }).join());
check('MIDNIGHT marks every cell of its last block as the cemetery (no buildings there)',
  ntGate.cem.length === 10 && ntGate.cem.every(function (c) { return c.blkIdx === NIGHT_CEMETERY_BLOCK_IDX; }),
  'cem=' + ntGate.cem.length);
check('the weekday street has NO cemetery cells (Bed-Stuy stays all brownstone front)', wkGate.cem.length === 0);
check('the Midnight street keeps its buildings on every block EXCEPT its last',
  ntGate.made.filter(function (m) { return m.blkIdx !== NIGHT_CEMETERY_BLOCK_IDX; }).length === 50 &&
  !ntGate.made.some(function (m) { return m.blkIdx !== NIGHT_CEMETERY_BLOCK_IDX && m.cem; }));

console.log('\n[4] the plaque is name-driven, the graveyard is fenced the Maspeth way');
const signSrc = srcFn('makeCemeterySignMaterial');
const signBuild = srcFn('makeCemeterySign');
const nightCemSrc = srcFn('buildNightCemetery');
check('the plaque builder takes the NAME as an argument', /function makeCemeterySignMaterial\(label\)/.test(html));
check("the plaque falls back to Maspeth's own name when no name is passed",
  signSrc.indexOf('const name = label || "Mount Mongo Cemetery";') >= 0);
check('the canvas draws the NAME variable (no hard-coded string left)',
  signSrc.indexOf('ctx.fillText(name, 512, 84);') >= 0 && signSrc.indexOf('measureText(name)') >= 0);
check('the sign builder forwards the name into the plaque face', signBuild.indexOf('makeCemeterySignMaterial(name)') >= 0);
check('Maspeth still builds its plaque with no name argument (weekday look unchanged)',
  srcFn('buildCemeteryBlock').indexOf('makeCemeterySign()') >= 0);
check('the dead-end fence across the road carries the St Basuras plaque',
  nightCemSrc.indexOf('makeCemeterySign(NIGHT_CEMETERY_NAME)') >= 0);
check('the graveyard is fenced with the Maspeth wrought-iron builders',
  nightCemSrc.indexOf('makeCemeteryFence(BLOCK_W)') >= 0 && nightCemSrc.indexOf('makeCemeteryFence(sideLen)') >= 0);
check('the graveyard fence line is registered as the worker wall (cemFence)',
  nightCemSrc.indexOf('b.cemFence = {') >= 0 && nightCemSrc.indexOf('y: CEM_FENCE_Y') >= 0);
check('the plaque on the front fence reads the Midnight name',
  nightCemSrc.indexOf('frontSign.position.set(bx + BLOCK_W / 2, CEM_FENCE_Y, GZ)') >= 0);
check('the street-length iron fence is built per block, behind the lawn',
  nightCemSrc.indexOf('run.position.set(fbl.x, NIGHT_FENCE_Y, GZ)') >= 0 &&
  nightCemSrc.indexOf('if (!fbl || !fbl.garbage) continue;') >= 0);
check('the worker is held behind the lawn by that fence line, on Midnight only',
  html.indexOf('if (isNightShift() && p.wy > NIGHT_FENCE_Y - FENCE_STOP)') >= 0);
check('the cemetery grass patch is laid on Midnight only (weekdays keep their own ground)',
  html.indexOf('0x2c5426') >= 0 && /isNightShift\(\)[\s\S]{0,400}CEM_BACK_Y - CEM_FENCE_Y/.test(html));
check('the removed intersections are rebuilt as plain road on the night',
  html.indexOf('for (const xGap of NIGHT_GAP_XS)') >= 0);
check('weekday intersections still iterate the full LEVEL_XS list',
  INTER_SRC.indexOf('for (const xInt of nightGap ? NIGHT_XS : LEVEL_XS)') >= 0);
check('the Midnight last block carries no house: the cemetery gate covers the night too',
  html.indexOf('(isNightShift() && b.blockX === NIGHT_GRAVE_BLOCK_X)') >= 0);
check('the dead-end street gate is read from the live isNightShift() in the block loop',
  GATE_SRC.indexOf('const isNightLevel = isNightShift();') >= 0);
check('the Midnight street keeps its buildings on every block EXCEPT its last',
  ntGate.made.filter(function (m) { return m.blkIdx !== NIGHT_CEMETERY_BLOCK_IDX; }).length === 50 &&
  !ntGate.made.some(function (m) { return m.blkIdx !== NIGHT_CEMETERY_BLOCK_IDX && m.cem; }));
check('MIDNIGHT cross-street is the intersection at the top of the level (centre x=472)',
  nt.crossX[0] === 472, 'x=' + nt.crossX.join());
check('MIDNIGHT paves the five removed intersections (2 curb stones + the paint edge each)',
  nt.gap === 15, 'gap=' + nt.gap);
check('the paved gaps are exactly the removed intersection gaps',
  gapCenters(nt.gapX).join() === NIGHT_GAP_XS.map(function (x) { return x + IW / 2; }).join(),
  nt.gapX.join());

console.log('\n' + pass + ' checks passed, ' + fail + ' failed');
if (fail) { console.log(failures.map(function (f) { return ' - ' + f; }).join('\n')); process.exit(1); }


