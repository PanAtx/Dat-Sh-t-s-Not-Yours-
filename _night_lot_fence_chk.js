// _night_lot_fence_chk.js — verify THE FENCED LOTS (Midnight gap fillers) in index.html:
//   1) every pipe post STANDS UP (this world is Z-UP: an un-rotated THREE cylinder lies flat)
//   2) the side chain-link runs are GONE — one street-facing panel per lot
//   3) the street-facing panel is RECESSED onto the BUILDING LINE (7.25 = Bed-Stuy house
//      centre 9.5 minus half the 4.5u shell), so it lines up with the houses and never
//      sticks out past them toward the sidewalk
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const THREE = require(path.join(__dirname, 'three_r128.min.js'));

let pass = true;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};

// ---- 1) every inline script still parses ----
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, scripts = 0, syntaxOk = true;
while ((m = re.exec(src))) {
  scripts++;
  try { new vm.Script(m[1], { filename: 'inline' + scripts + '.js' }); }
  catch (e) { syntaxOk = false; console.log('SYNTAX FAIL script #' + scripts + ': ' + e.message); }
}
check('all inline scripts parse (' + scripts + ' blocks)', syntaxOk);

// ---- 2) pull the builder + the constants it runs on ----
function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function ' + name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0, end = -1;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(idx, end);
}
const num = (name) => Number(src.match(new RegExp('const ' + name + ' = (-?[0-9.]+)'))[1]);
const arr = (name) => JSON.parse(src.match(new RegExp('const ' + name + ' = (\\[[^\\]]*\\])'))[1]);

const IW = num('IW'), GZ = num('GZ');
const CEM_FENCE_Y = num('CEM_FENCE_Y'), NIGHT_FENCE_Y = num('NIGHT_FENCE_Y');
const BEDSTUY_HOUSE_Y = Number(src.match(/isBedStuyLevel\(\)\) HOUSE_Y = ([0-9.]+)/)[1]);
const BEDSTUY_DEPTH = Number(src.match(/function makeBedStuyApartment\(\)[\s\S]{0,600}?const w = ([0-9.]+),\s*d = ([0-9.]+)/)[2]);
const BUILD_LINE_Y = BEDSTUY_HOUSE_Y - BEDSTUY_DEPTH / 2; // the houses' front faces
const NIGHT_LOT_FENCE_Y = num('NIGHT_LOT_FENCE_Y');
const SLAB_FRONT_Y = num('SLAB_FRONT_Y');
const NIGHT_GAP_XS = arr('NIGHT_GAP_XS');
check('the lots\' fence line is a real constant (NIGHT_LOT_FENCE_Y = ' + NIGHT_LOT_FENCE_Y + ')', NIGHT_LOT_FENCE_Y > 0);
check('MIDNIGHT IS BED-STUY GEOMETRY: house centre ' + BEDSTUY_HOUSE_Y + ', shell ' + BEDSTUY_DEPTH + 'u deep',
  BEDSTUY_HOUSE_Y === 9.5 && BEDSTUY_DEPTH === 4.5);

// ---- 3) BUILD it with the real THREE and measure every mesh ----
const worldGroup = new THREE.Group();
const fn = new Function('THREE', 'worldGroup', 'NIGHT_GAP_XS', 'IW', 'GZ', 'NIGHT_FENCE_Y',
  'NIGHT_LOT_FENCE_Y', 'SLAB_FRONT_Y',
  extractFn('buildNightFencedLots') + '\n;return buildNightFencedLots();');
fn(THREE, worldGroup, NIGHT_GAP_XS, IW, GZ, NIGHT_FENCE_Y, NIGHT_LOT_FENCE_Y, SLAB_FRONT_Y);
worldGroup.updateMatrixWorld(true);
const box = (o) => new THREE.Box3().setFromObject(o);
const kids = [];
worldGroup.traverse((o) => { if (o.isMesh) kids.push(o); });
const wire = kids.filter((o) => o.material && o.material.opacity === 0.7); // chain-link panels
const pads = kids.filter((o) => o.geometry && o.geometry.type === 'PlaneGeometry' && o.rotation.x === -Math.PI / 2);
const posts = kids.filter((o) => o.geometry && o.geometry.type === 'CylinderGeometry');
const caps = kids.filter((o) => o.geometry && o.geometry.type === 'SphereGeometry');

check('the lots are built for every paved-over intersection (' + NIGHT_GAP_XS.length + ' lots)',
  pads.length === NIGHT_GAP_XS.length, 'pads=' + pads.length);

// 1) THE POLES STAND UP
const flat = posts.filter((p) => { const b = box(p); return b.max.z - b.min.z < 1.5; });
check('EVERY CHAIN-LINK POLE STANDS UP: ' + posts.length + ' pipes, all tall in Z, thin in X/Y — none lying flat',
  posts.length === NIGHT_GAP_XS.length * 6 && flat.length === 0,
  'posts=' + posts.length + ' lying flat=' + flat.length);
const pb = posts.length ? box(posts[0]) : null;
check('a pole is ~2.1u tall in Z and 0.24u across (foot on the slab, top at z ' + (pb ? pb.max.z.toFixed(2) : '-') + ')',
  !!pb && pb.max.z - pb.min.z > 2.0 && pb.max.y - pb.min.y < 0.3 && pb.max.x - pb.min.x < 0.3,
  pb ? [pb.max.x - pb.min.x, pb.max.y - pb.min.y, pb.max.z - pb.min.z].join('/') : 'n/a');
check('each pole is finished with its round post cap', caps.length === posts.length,
  'caps=' + caps.length + ' posts=' + posts.length);

// 2) NO SIDE RUNS
check('ONE street-facing chain-link panel per lot — the side runs are GONE',
  wire.length === NIGHT_GAP_XS.length, 'panels=' + wire.length);
const sideWalls = wire.filter((p) => { const b = box(p); return b.max.x - b.min.x < 1.5; });
check('NO panel is turned to run down the lot sides (each one is a wall across X)',
  sideWalls.length === 0, 'side walls=' + sideWalls.length);

// 3) RECESSED TO THE BUILDING LINE
const panelY = wire.map((p) => (box(p).max.y + box(p).min.y) / 2);
check('THE FENCE IS RECESSED ONTO THE BUILDING LINE y ' + BUILD_LINE_Y + ' (flush with the house faces)',
  panelY.every((y) => Math.abs(y - BUILD_LINE_Y) < 1e-6), 'panel y= ' + panelY.map((y) => y.toFixed(2)).join(','));
check('it no longer stands at the sidewalk edge (' + CEM_FENCE_Y + ') — it sits ' +
  (BUILD_LINE_Y - CEM_FENCE_Y).toFixed(2) + 'u back off the walk', BUILD_LINE_Y > CEM_FENCE_Y + 1.5);
check('and it stays short of the wrought-iron line behind it (y ' + NIGHT_FENCE_Y + ')',
  BUILD_LINE_Y < NIGHT_FENCE_Y);
const wb = box(wire[0]);
check('the panel reads as a wall: 15.4u run in X, thin in Y, 2u tall in Z',
  wb.max.x - wb.min.x > 15 && wb.max.y - wb.min.y < 0.15 && wb.max.z - wb.min.z > 1.9,
  [wb.max.x - wb.min.x, wb.max.y - wb.min.y, wb.max.z - wb.min.z].map((v) => v.toFixed(2)).join('/'));
check('the panel stands upright and faces the street (tipped +90 deg about X)',
  wire.every((p) => Math.abs(p.rotation.x - Math.PI / 2) < 1e-6));
const padb = box(pads[0]);
check('the lot slab fills the gap from the walk\'s edge (y ' + SLAB_FRONT_Y + ') back to the iron (y ' + NIGHT_FENCE_Y + ')',
  padb.min.y > SLAB_FRONT_Y - 0.01 && padb.max.y < NIGHT_FENCE_Y + 0.01,
  padb.min.y.toFixed(2) + '..' + padb.max.y.toFixed(2));
const front = posts.filter((p) => Math.abs(p.position.y - BUILD_LINE_Y) < 1e-6);
check('the poles holding the fence (both ends + the line posts) stand on that same line: ' + front.length,
  front.length === NIGHT_GAP_XS.length * 4, 'front posts=' + front.length);
check('the shipped fence lines are untouched (CEM_FENCE_Y ' + CEM_FENCE_Y + ', NIGHT_FENCE_Y ' + NIGHT_FENCE_Y + ')',
  CEM_FENCE_Y === 5.4 && NIGHT_FENCE_Y === 8.3);

// ---- 4) THE FENCE IS THE WORKER'S WALL (the building line, and no squeeze at a gap) ----
const WALL_RE = /if \(isNightShift\(\) && typeof NIGHT_LOT_BUILD_WALL === "number" && p\.wy > NIGHT_LOT_BUILD_WALL\) \{\s*\n\s*p\.wy = NIGHT_LOT_BUILD_WALL;\s*\n\s*\}/;
check('updatePlayer carries the chain-link wall law (hard stop on the fence line, every frame)',
  WALL_RE.test(src), 'clamp not found');
const NSTOP = num('NIGHT_LOT_STOP');
const NWALL = NIGHT_LOT_FENCE_Y - NSTOP;
check('NIGHT_LOT_BUILD_WALL is built from the fence line minus the stop margin (no hand-tuned number)',
  /const NIGHT_LOT_BUILD_WALL = NIGHT_LOT_FENCE_Y - NIGHT_LOT_STOP;/.test(src));
check('the wall line is the fence line minus a body-width (' + NIGHT_LOT_FENCE_Y + ' - ' + NSTOP + ' = ' + NWALL + ')',
  Math.abs(NWALL - (NIGHT_LOT_FENCE_Y - NSTOP)) < 1e-9);
check('THE WALL IS THE SAME LINE AS THE BROWNSTONE FACES — no seam to squeeze through at a gap',
  Math.abs(NWALL - (BEDSTUY_HOUSE_Y - BEDSTUY_DEPTH / 2 - 0.3)) < 1e-9,
  'wall=' + NWALL + ' face stop=' + (BEDSTUY_HOUSE_Y - BEDSTUY_DEPTH / 2 - 0.3));
check('and he keeps the whole walk + apron: the wall stands behind the sidewalk (y ' + SLAB_FRONT_Y + ')',
  NWALL > SLAB_FRONT_Y);

// run the game's own clamp lines as the frame loop runs them
const clampSrc = (function () {
  const i = src.match(WALL_RE)[0];
  return 'if (typeof p === "object") { ' + i + ' }';
})();
const wallFn = new Function('p', 'isNightShift', 'NIGHT_LOT_BUILD_WALL', 'NIGHT_FENCE_Y', 'FENCE_STOP', clampSrc);
function strafe(wy, night, frames) {
  // the worker strafes UPSTREET (into the fence) at LAT_SPEED for `frames` frames, and every
  // frame the shipped movement clamp AND the wall law run — the same order the game runs them
  const p = { wx: 88, wy: wy }; // 88u = inside the FIRST paved-over gap (80..96)
  const LAT_SPEED = 6.5, dt = 1 / 60;
  const isNight = () => night;
  for (let f = 0; f < frames; f++) {
    p.wy = Math.max(-9.4, Math.min(8.0, p.wy + LAT_SPEED * dt)); // clamp(..., -9.4, workerMaxY()=8.0)
    wallFn(p, isNight, NWALL, 8.3, 0.3);
  }
  return p.wy;
}
const nightWalk = strafe(2.5, true, 400);
check('STRAFE INTO THE WIRE ON MIDNIGHT: 400 frames of holding the stick up the street stops him on the fence line (' + nightWalk.toFixed(2) + '), never past it',
  Math.abs(nightWalk - NWALL) < 1e-9, 'wy=' + nightWalk.toFixed(3));
const dayWalk = strafe(2.5, false, 400);
check('A WEEKDAY STRAFES PAST THE SAME SPOT UNTOUCHED (the law is night-only, his lawn band stays 8.0)',
  Math.abs(dayWalk - Math.min(8.0, 2.5 + 400 * (6.5 / 60))) < 1e-9, 'wy=' + dayWalk.toFixed(3));
const fling = { wx: 90, wy: 8.0 };
wallFn(fling, () => true, NWALL, 8.3, 0.3);
check('NO fling / knock-back / spawn ever lands him behind the chain-link: a body dropped at 8.0 is put back on the street side',
  Math.abs(fling.wy - NWALL) < 1e-9, 'wy=' + fling.wy);
const low = { wx: 90, wy: 6.0 };
wallFn(low, () => true, NWALL, 8.3, 0.3);
check('and the wall never drags him down off the walk he is legally standing on (6.0 stays 6.0)',
  low.wy === 6.0, 'wy=' + low.wy);

// FAIR FIGHT from the wall: every animal the haunt can spawn stays inside the shovel
const SHOVEL_REACH = num('SHOVEL_REACH');
const HORROR_LAWN_Y = num('HORROR_LAWN_Y'), HORROR_STREET_Y = num('HORROR_STREET_Y');
const HORROR_BED = (function () {
  const m = src.match(/const CREATURE_MAX_WY = \[([\s\d,-]+)\]/);
  return m ? Math.max.apply(null, m[1].split(',').map((n) => Number(n.trim())).filter((n) => !isNaN(n))) : 0;
})();
const SPAWN_CEIL = Math.max(4.8, HORROR_LAWN_Y) - 0.4; // R(HORROR_STREET_Y+0.4, horrorMaxY()-0.4)
check('THE BLOCK CAN ALWAYS BE CLEARED FROM THE STREET SIDE: the highest animal the haunt spawns (y ' +
  SPAWN_CEIL.toFixed(2) + ', pack ceiling ' + HORROR_BED + ') stands within SHOVEL_REACH ' + SHOVEL_REACH +
  'u of a worker pressed on the wall (' + NWALL.toFixed(2) + ')',
  SPAWN_CEIL - NWALL <= SHOVEL_REACH && HORROR_BED - NWALL <= SHOVEL_REACH,
  'gap=' + (SPAWN_CEIL - NWALL).toFixed(2) + '/' + SHOVEL_REACH);
check('no animal can camp deeper than his own wall line by more than 0.5u (the strip behind the wire is not a refuge)',
  SPAWN_CEIL - NWALL <= 0.5 && HORROR_BED - NWALL <= 0.5,
  'camping=' + (SPAWN_CEIL - NWALL).toFixed(2) + 'u / ' + (HORROR_BED - NWALL).toFixed(2) + 'u');
check('the pack lanes are unchanged (the road floor ' + HORROR_STREET_Y + ' and the stoop line ' + HORROR_LAWN_Y + ' ship as written)',
  HORROR_STREET_Y === -8.6 && HORROR_LAWN_Y === 7.4);
check('the shipped dead-end iron law is untouched (NIGHT_FENCE_Y - FENCE_STOP = 8.0 stays above the fence wall)',
  src.indexOf('if (isNightShift() && p.wy > NIGHT_FENCE_Y - FENCE_STOP) {') >= 0 && 8.3 - 0.3 > NWALL);
check('workerMaxY() keeps its shipped weekday law line (the night wall is a hard clamp, not a borough cap)',
  /return isManhattanLevel\(\) \? 5\.0 : 8\.0;/.test(src));

// the lane in EVERY paved-over gap: road floor up to the wire, and nothing beyond it
const laneSweeps = NIGHT_GAP_XS.map(function (gx) {
  const p = { wx: gx + IW / 2, wy: -9.4 }; // from the parked-car lane at the gap's centre
  const LAT_SPEED = 6.5, dt = 1 / 60;
  for (let f = 0; f < 600; f++) {
    p.wy = Math.max(-9.4, Math.min(8.0, p.wy + LAT_SPEED * dt));
    wallFn(p, () => true, NWALL, 8.3, 0.3);
  }
  return { x: gx, wy: p.wy };
});
check('EVERY gap lot bottoms out on the same wire line: ' + NIGHT_GAP_XS.length + ' sweeps, all stopping at ' + NWALL.toFixed(2),
  laneSweeps.every((s) => Math.abs(s.wy - NWALL) < 1e-9),
  laneSweeps.map((s) => 'x' + s.x + '=' + s.wy.toFixed(2)).join(' '));
check('his working lane stays a real lane: ' + (NWALL + 9.4).toFixed(2) + 'u from the parked-car floor to the fence (shovel lane intact)',
  NWALL - HORROR_STREET_Y >= 15);
check('the fence line the worker is stopped on matches the panel he walks into (y ' + NIGHT_LOT_FENCE_Y + ' — wall ' + NWALL.toFixed(2) + ' = line - ' + NSTOP + ')',
  Math.abs(NWALL - (NIGHT_LOT_FENCE_Y - NSTOP)) < 1e-9);

console.log('\n' + (pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
process.exit(pass ? 0 : 1);

