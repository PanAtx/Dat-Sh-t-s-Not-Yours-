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
check('the dead-end cemetery carries exactly ONE St Basuras plaque (the road fence board is gone)',
  (nightCemSrc.match(/makeCemeterySign\(NIGHT_CEMETERY_NAME\)/g) || []).length === 1);
check('the graveyard is fenced with the Maspeth wrought-iron builders',
  nightCemSrc.indexOf('makeCemeteryFence(BLOCK_W)') >= 0 && nightCemSrc.indexOf('makeCemeteryFence(sideLen)') >= 0);
check('the graveyard fence line is registered as the worker wall (cemFence)',
  nightCemSrc.indexOf('b.cemFence = {') >= 0 && nightCemSrc.indexOf('y: CEM_FENCE_Y') >= 0);
check('the plaque is hung ON THE FENCE LINE at the sidewalk-edge row, over the beast',
  nightCemSrc.indexOf('frontSign.position.set(bx + NIGHT_BOSS_X - NIGHT_SIGN_ON_FENCE_OFF, CEM_FENCE_Y, GZ)') >= 0);
// THE PLAQUE READS FROM THE BOSS RING: the 45deg iso camera (ortho half-width 8 world units)
// shows only +/-$8*$sqrt2 = 11.3u of the street's screen axis around the worker, so a board
// more than that out of the rise point is only readable by walking DOWN to the grave wall.
const NK_BOSS_X = srcNum('NIGHT_BOSS_X');
const NK_SIGN_OFF = srcNum('NIGHT_SIGN_ON_FENCE_OFF');
const SIGN_X = NK_BOSS_X - NK_SIGN_OFF;
const CAM_X_HALF = 8 * Math.SQRT2;
check('the plaque sits inside the camera frame of the fight (no walk down to the grave wall to read it)',
  SIGN_X > NK_BOSS_X - CAM_X_HALF && SIGN_X < NK_BOSS_X + CAM_X_HALF,
  'plaque x=' + SIGN_X + ' boss x=' + NK_BOSS_X + ' screen half=' + CAM_X_HALF.toFixed(1));
check('THE FENCE ACROSS THE ROAD IS CUT SHORT ON ITS LEFT SIDE: it ends ON the fence line it meets',
  (function () {
    const lenM = nightCemSrc.match(/const fenceLen = ([^;]+);/);
    const baseM = nightCemSrc.match(/fence\.position\.set\(NIGHT_FENCE_X, (-?[0-9.]+), GZ\)/);
    if (!lenM || !baseM) return false;
    const farY = parseFloat(baseM[1]) + (CEM_FENCE_Y + 9.6); // the source spells len as CEM_FENCE_Y + 9.6
    return lenM[1].trim() === 'CEM_FENCE_Y + 9.6' && Math.abs(farY - CEM_FENCE_Y) < 1e-9 && farY < CEM_BACK_Y;
  })(), 'road fence y -9.6 -> ' + (-9.6 + CEM_FENCE_Y + 9.6) + ' (fence line ' + CEM_FENCE_Y + ')');
check('the road-end fence carries NO plaque (no board rotated onto the street wall)',
  nightCemSrc.indexOf('sign.rotation.z = -Math.PI / 2') < 0);
// ---- THE BOTTOM BORDER: the fence closes the street, the street stops at the fence ----
const NIGHT_END_X = srcNum('NIGHT_END_X');
const NIGHT_GRAVE_X = srcNum('NIGHT_GRAVE_X');
const NIGHT_FENCE_X = srcNum('NIGHT_FENCE_X');
console.log('\n[5] the bottom border (' + NIGHT_FENCE_X + 'u): the street ends at the fence');
check('the border sits where the asphalt ends and the grass begins (the edge of the yard slab, NIGHT_END_X + 8, and the sealed graves gate)',
  NIGHT_FENCE_X === NIGHT_END_X + 8 && NIGHT_FENCE_X === NIGHT_GRAVE_X - 8,
  'fence=' + NIGHT_FENCE_X + ' yard slab ends ' + (NIGHT_END_X + 8) + ' graves gate ' + (NIGHT_GRAVE_X - 8));
check('the graveyard lawn slab ENDS on the fence line (the grass below it is the cemetery, the street above it is the street)',
  nightCemSrc.indexOf('new THREE.PlaneGeometry(NIGHT_END_X + 8, 19)') >= 0);
check('the worker is walled AT the bottom fence: nightWallX answers the fence line PLUS the standoff, awake AND asleep, so he can never get to the iron',
  srcFn('nightWallX').includes('const fenceLine = NIGHT_FENCE_X + NIGHT_FENCE_STANDOFF') &&
    srcFn('nightWallX').includes('Math.max(fenceLine, NIGHT_END_X + NIGHT_MOUTH_X, yardOpen - NIGHT_BOSS_ROOM_X)') &&
    srcFn('nightWallX').includes('Math.max(NIGHT_GRAVE_X - 8, fenceLine)') &&
    srcNum('NIGHT_FENCE_STANDOFF') >= 1);
check('the street furniture stops at the border: no street lamp below it, no fire hydrant below it',
  srcFn('nightLampClear').includes('NIGHT_FENCE_X + NIGHT_LAMP_CLEAR') &&
    srcFn('addHydrant').includes('wx < NIGHT_FENCE_X'));
check('no curb is poured below the border on Midnight: the curb (both sides) and the road-edge line start AT the fence',
  srcFn('buildGround').includes('Math.max(bl.x - 1.5, nightCurbCut)') &&
    srcFn('buildGround').includes('nightCurbCut != null ? Math.max(bl.x - 1.5, nightCurbCut) : bl.x - 1.5') &&
    srcFn('buildGround').includes('isNightShift() && typeof NIGHT_FENCE_X === "number"'));
check('a weekday level pours the FULL curb on every block (the cut is behind isNightShift + a Node-safe typeof guard)',
  srcFn('buildGround').includes('const cs = curbSpan(bl);') &&
    /const nightCurbCut =\s*\n\s*isNightShift\(\) && typeof NIGHT_FENCE_X === "number" \? NIGHT_FENCE_X : null;/.test(srcFn('buildGround')));
check('the spook band floor never drops below the border (a shoveled spook is always on street the worker can stand on)',
  srcFn('creatureLimitMinX').includes('Math.max(nightWallX(), NIGHT_FENCE_X)'));
check('no street paint below the border: the lane dashes and the sidewalk joint stop at the fence on Midnight, and a weekday lays both on every cell',
  srcFn('makeBlockContents').includes('worldX >= NIGHT_FENCE_X') &&
    srcFn('makeBlockContents').includes('if (!paintOpen(baseX + dash.position.x - 0.7)) continue;') &&
    srcFn('makeBlockContents').includes('if (paintOpen(baseX + joint.position.x)) b.group.add(joint);'));
check('no manhole (and no pothole, hydrant, bottle pile, wrapper or pile) is laid in the graveyard: the whole street-dressing roll is skipped on a grave cell, and the shipped roll text is untouched for every weekday',
  srcFn('makeBlockContents').includes('const graveCell = isNightShift() && !paintOpen(baseX + cellW / 2);') &&
    srcFn('makeBlockContents').includes('if (!graveCell) {') &&
    srcFn('makeBlockContents').includes('else if (hr < 0.68) addManhole(b, hzX(1.5), R(-7.5, -3.5));') &&
    srcFn('makeBlockContents').includes('if (hr < 0.28 && !siClean) addBottles(b, hzX(1), R(1.5, 4.5));'));
check('the manhole tentacle rises out of a manhole ON THE STREET: on Midnight a draw that lands below the border is pushed onto open street',
  srcFn('spawnWorld').includes('if (isNightShift() && za.wx < workerEndLimitX() + 2) za.wx = workerEndLimitX() + 2;'));
check('a flung body keeps its own ground: NO boss contact writes p.wx / p.wy any more (the old bossRingClamp placements are gone), the hard floor helper stays a floor line for the route, and no knock-back carries the +2 leash past the sealed ceiling',
  srcFn('workerEndHardX').includes('isNightShift() ? nightWallX() : workerEndLimitX() - 2') &&
    !/\bbossRingClamp\(/.test(html) &&
    !/p\.wx\s*=/.test(srcFn('updateBossFireballs')) &&
    !/p\.wy\s*=/.test(srcFn('updateBossFireballs')) &&
    !/p\.wx\s*=/.test(srcFn('bossWhipStrike')) &&
    !/p\.wx\s*=/.test(srcFn('updateNightBoss')) &&
    !/workerCeilX\(\) \+ 2/.test(html));
// ---- THE SWEPT BOSS BLOCK (Midnight): the final-boss block carries no haunt ----
// NK_BOSS_X (74u, the rise point) is declared with the border law above; block 0 IS the
// cemetery block, and BLOCK_W is this suite's block width (80u).
const NK_BOSS_FIELD_END_X = srcNum('NIGHT_GRAVE_BLOCK_X') + BLOCK_W; // the boss block's far edge
check('THE BOSS BLOCK IS SWEPT CLEAN: the 21-prop grave scatter on the walk and the asphalt (4 headstones, 3 skull piles, 5 candles, 2 coffins, 2 gate leaves, 2 risen ARMS, 2 severed hands) is gated off behind NIGHT_BOSS_FIELD_SWEPT, and the sweep is the live law (the constant is true)',
  /const NIGHT_BOSS_FIELD_SWEPT = true;/.test(html) &&
    nightCemSrc.includes('if (b && b.hazards && !NIGHT_BOSS_FIELD_SWEPT)') &&
    nightCemSrc.includes('"arm", "arm", "hand", "hand",') &&
    nightCemSrc.includes('nightPlaceProp(b, kinds[i], px, py)'));
check('SWEEP SPANS THE FIGHT, NOT THE CEMETERY: the gated scatter covered x ' + (srcNum('NIGHT_END_X') + 6) + '..' + (srcNum('NIGHT_END_X') + 66) + "u — the boss ring the worker fences the beast in (the rise point " + NK_BOSS_X + "u and the yard strip in front of the iron, from the fence line " + srcNum('NIGHT_FENCE_X') + "u down) — while the graves BEHIND the bottom fence (the 7 headstones, the monuments, the dead trees) stay laid exactly as shipped",
  (() => {
    const sx0 = srcNum('NIGHT_END_X') + 6, sx1 = srcNum('NIGHT_END_X') + 66;
    return sx0 < NIGHT_FENCE_X && sx1 >= NK_BOSS_X && sx1 >= NK_BOSS_FIELD_END_X &&
      nightCemSrc.includes("const px = R(NIGHT_END_X + 6, NIGHT_END_X + 66);") &&
      nightCemSrc.includes("for (let i = 0; i < 7; i++)") &&
      nightCemSrc.includes("makeHeadstone(4)") && nightCemSrc.includes("makeDeadTree()");
  })());
check('THE BEAST IS NOT SWEPT AWAY: the boss is still laid to rest on this block and wakes here — the sweep removes the haunt, never the fight',
  srcFn('spawnNightBoss').includes("g.position.set(NIGHT_BOSS_X, 1.4, GZ - 1.95)") &&
    srcFn('startBossFight').includes("bossFightOn = true") &&
    NK_BOSS_X > NIGHT_FENCE_X && NK_BOSS_X < NK_BOSS_FIELD_END_X);
check('THE OPEN MANHOLE WITH THE BLINKING EYES IS REFUSED ON THE BOSS BLOCK, in the spawner itself: block-precise, night-only, Node-safe — every weekday block keeps its manholes and the shipped hazard roll text is untouched',
  srcFn('addManhole').includes('typeof isNightShift === "function" && isNightShift() && b && b.blockX === 0') &&
    srcFn('addManhole').includes('addLurkingEyes(g)') &&
    srcFn('makeBlockContents').includes('else if (hr < 0.68) addManhole(b, hzX(1.5), R(-7.5, -3.5));'));
check('THE GHOSTLY ARM OUT OF THE SEWER IS A WARD-BLOCK HAUNT: the night draws the tentacle only from the packed blocks above the boss block that stand on open street; weekdays draw from every garbage block',
  srcFn('spawnWorld').includes('const zDraw = isNightShift()') &&
    srcFn('spawnWorld').includes('return b.x >= BLOCK_W && b.x + 8.0 > workerEndLimitX();') &&
    srcFn('spawnWorld').includes('const zb = zDraw[(Math.random() * zDraw.length) | 0];'));
check('NOTHING WAS INVENTED FOR THE BOSS BLOCK: the four ward packs all stand above the swept block, the street keeps its three sewer tentacles, and the spirit cap stays shut',
  (() => {
    const BEATS = {
      NIGHT_BEAT_TOP_X: srcNum('NIGHT_BEAT_TOP_X'),
      NIGHT_BEAT_VERMIN_X: srcNum('NIGHT_BEAT_VERMIN_X'),
      NIGHT_BEAT_DIGGER_X: srcNum('NIGHT_BEAT_DIGGER_X'),
      NIGHT_BEAT_GRAVE_X: srcNum('NIGHT_BEAT_GRAVE_X'),
    };
    const NB = new Function(
      'NIGHT_BEAT_TOP_X', 'NIGHT_BEAT_VERMIN_X', 'NIGHT_BEAT_DIGGER_X', 'NIGHT_BEAT_GRAVE_X',
      'return ' + srcLiteral('NIGHT_BLOCKS', '[', ']')
    )(BEATS.NIGHT_BEAT_TOP_X, BEATS.NIGHT_BEAT_VERMIN_X, BEATS.NIGHT_BEAT_DIGGER_X, BEATS.NIGHT_BEAT_GRAVE_X);
    return NB.length === 4 && NB.every((e) => e.x >= NK_BOSS_FIELD_END_X) &&
      srcNum('NIGHT_GHOST_CAP') === 0 &&
      /const tentacleBands = zBlocks\.slice\(-3\);/.test(html);
  })());
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
// ---- THE GHOST FENCE IS A WALL (the walk-through / stuck-inside law) -------------------
const SEAL_X = srcNum('NIGHT_SEAL_X'), SEAL_STOP = srcNum('NIGHT_SEAL_STOP');
const SEAL_INNER = srcNum('NIGHT_SEAL_INNER'), MESH_DN = srcNum('NIGHT_SEAL_MESH_DOWN');
const FACE = SEAL_X - SEAL_INNER, STAND = FACE - SEAL_STOP;
check("the seal closes on the iron's OWN FACE line and the worker's sealed ceiling is a body-width BELOW it",
  srcFn('sealFaceX').indexOf('NIGHT_SEAL_X - NIGHT_SEAL_INNER') >= 0 &&
    srcFn('sealStandX').indexOf('sealFaceX() - NIGHT_SEAL_STOP') >= 0 &&
    srcFn('workerCeilX').indexOf('Math.min(top, sealStandX())') >= 0 &&
    STAND < FACE && STAND < SEAL_X - MESH_DN, // the standing point is out of the fence mesh
  'face=' + FACE + ' stand=' + STAND + ' mesh face=' + (SEAL_X - MESH_DN));
check("updatePlayer's wall closes on the seal's own history and snaps a body out of the iron, into the fight zone",
  srcFn('updatePlayer').indexOf('nightSeal.prevWx') >= 0 &&
    srcFn('updatePlayer').indexOf('if (prevSeal >= sealFaceX() && p.wx < sealFaceX()) nightSealClose();') >= 0 &&
    srcFn('updatePlayer').indexOf('p.wx = sealStandX();') >= 0);
check("the wall's crossing is measured on the travelled segment (a big frame cannot skip the close) and the pressed-into-iron line teaches the ring",
  srcFn('updateNightSeal').indexOf('nightSeal.prevWx = p.wx;') >= 0 &&
    /THE FIGHT'S IN FRONT OF THE IRON/.test(html) &&
    /IT IS A WALL YOU CAN STAND AGAINST: THE BEAST NEVER COMES THROUGH IT/.test(html));
check("neither beast nor man has a standing point inside the ghost fence: the beast's ceiling is the face minus its body, the man's is the face minus a body-width",
  srcFn('updateNightBoss').indexOf('sealFaceX() - BOSS_BODY_R') >= 0 &&
    STAND < FACE && SEAL_X - SEAL_INNER - srcNum('BOSS_BODY_R') < SEAL_X - MESH_DN);
check("the fence's mesh footprint is measured, not guessed: the ghost pool reaches NIGHT_SEAL_MESH_DOWN down the road from the line and the constants carry that",
  srcFn('makeGhostIronFence').indexOf('BX(2.6, WSPAN + 1.7, 0.04, poolM)') >= 0 &&
    srcFn('makeGhostIronFence').indexOf('pool.position.set(-0.25, MID,') >= 0 &&
    MESH_DN >= 1.3 && MESH_DN <= 1.9 && srcNum('NIGHT_SEAL_MESH_UP') >= 0.9 &&
    srcFn('buildNightSeal').indexOf('g.position.set(NIGHT_SEAL_X, 0, GZ)') >= 0 &&
    SEAL_INNER === MESH_DN, // the wall's face IS the measured mesh edge — one number, no drift
  'mesh down=' + MESH_DN + ' up=' + srcNum('NIGHT_SEAL_MESH_UP'));
check("the wall's bite line IS the ghost fence's own light edge, and the worker's standing point is a single body-width out of it — close enough to use the fence as cover, never inside the mesh",
  Math.abs(FACE - (SEAL_X - MESH_DN)) < 1e-9 && STAND < FACE &&
    FACE - STAND <= SEAL_STOP + 1e-6 &&
    Math.abs(STAND - (FACE - SEAL_STOP)) < 1e-9,
  'face=' + FACE + ' mesh face=' + (SEAL_X - MESH_DN) + ' stand=' + STAND);

console.log('\n' + pass + ' checks passed, ' + fail + ' failed');
if (fail) { console.log(failures.map(function (f) { return ' - ' + f; }).join('\n')); process.exit(1); }


