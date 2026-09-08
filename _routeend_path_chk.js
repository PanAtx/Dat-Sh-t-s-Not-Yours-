// _routeend_path_chk.js — validate the level-complete "walk around the truck" path:
// the worker must reach the cab door WITHOUT ever clipping the truck body.
// Extracts startRouteEnd() + updateRouteEnd() verbatim from index.html and
// simulates the walk phase against the truck's collision box.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name){
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = html.indexOf('{', idx); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(idx, i);
}
let pass = 0, fail = 0;
function check(n, cond, extra){ if (cond){ pass++; console.log('  ok   ' + n + (extra ? '  [' + extra + ']' : '')); } else { fail++; console.error('  FAIL ' + n + (extra ? '  [' + extra + ']' : '')); } }
function grabConst(name){
  const m = html.match(new RegExp('const ' + name + '\\s*=\\s*([0-9.]+);'));
  if (!m) throw new Error('const not found: ' + name);
  return parseFloat(m[1]);
}

// ---- truck collision box (matches updatePlayer's worker-vs-truck push) ----
const TRUCK_CY = -4.5, WR = 0.45;   // truck centerline y, worker collision radius
function inBody(wx, wy, truck){
  const cx = Math.min(Math.max(wx, truck.wx - truck.boxL), truck.wx + truck.boxL);
  const cy = Math.min(Math.max(wy, TRUCK_CY - truck.boxW), TRUCK_CY + truck.boxW);
  const dx = wx - cx, dy = wy - cy;
  return dx * dx + dy * dy < WR * WR;
}
function clearance(wx, wy, truck){
  const cx = Math.min(Math.max(wx, truck.wx - truck.boxL), truck.wx + truck.boxL);
  const cy = Math.min(Math.max(wy, TRUCK_CY - truck.boxW), TRUCK_CY + truck.boxW);
  return Math.hypot(wx - cx, wy - cy) - WR;   // > 0 = fully outside the body
}

// ---- scenario: worker finishes at Intersection 7, truck parked behind him ----
const ROUTE_FINISH_X = 656, boxL = 5.6, boxW = 2.25, cabOff = boxL + 1.6;
function mkWorld(p0, truck){
  return {
    state: 'play', carried: null, p: p0, truck: truck,
    worker: { group: { visible: true, position: { set(){} }, rotation: { set(){} } } },
    wparts: { armL: { rotation: { set(){} } }, armR: { rotation: { set(){} } }, legL: { rotation: { set(){} } }, legR: { rotation: { set(){} } } },
    g: null, GZ: 0.01,
    routeEnd: null,
    dropCarried(){}, Voice: { say(){} },
    updateCreatures(){}, updateBonuses(){}, updatePowerups(){}, updateFlyingCans(){},
    updateFlyingBags(){}, updateFlyingBaskets(){}, updateDustParticles(){},
    updateStarParticles(){}, updateBlocks(){}, updateFootprints(){}, updateHopperTrash(){},
    updateHUD(){},
    clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); },
    camera: { right: 12 },
    finishRouteEnd(){ this.routeEnd = null; this.finished = true; }
  };
}
function harness(world){
  // Run the two functions inside a vm context so that `routeEnd` (and the other
  // game globals) are REAL shared globals, exactly as in the browser. startRouteEnd
  // reassigns the global `routeEnd`, and updateRouteEnd must see that reassignment.
  const vm = require('vm');
  const ctx = {
    state: world.state, carried: world.carried, p: world.p, truck: world.truck,
    worker: world.worker, wparts: world.wparts, GZ: world.GZ,
    routeEnd: null,
    dropCarried: world.dropCarried, Voice: world.Voice,
    updateCreatures: world.updateCreatures, updateBonuses: world.updateBonuses,
    updatePowerups: world.updatePowerups, updateFlyingCans: world.updateFlyingCans,
    updateFlyingBags: world.updateFlyingBags, updateFlyingBaskets: world.updateFlyingBaskets,
    updateDustParticles: world.updateDustParticles, updateStarParticles: world.updateStarParticles,
    updateBlocks: world.updateBlocks, updateFootprints: world.updateFootprints,
    updateHopperTrash: world.updateHopperTrash, updateHUD: world.updateHUD,
    clamp: world.clamp, camera: world.camera, finishRouteEnd: world.finishRouteEnd,
    WORKER_GENDER: 'male',
    RE_CHEER: grabConst('RE_CHEER'), RE_WALK_SP: grabConst('RE_WALK_SP'),
    RE_DRIVE_SP: grabConst('RE_DRIVE_SP'), RE_DRIVE_MAX: grabConst('RE_DRIVE_MAX'),
    Math: Math
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('startRouteEnd') + '\n' + extractFn('updateRouteEnd'), ctx);
  return { ctx, startRouteEnd: ctx.startRouteEnd, updateRouteEnd: ctx.updateRouteEnd };
}
// run the whole cinematic (cheer -> walk -> board -> drive) and report the walk
function simWalk(p0, truck){
  const w = mkWorld(p0, truck);
  const { ctx, startRouteEnd, updateRouteEnd } = harness(w);
  startRouteEnd();
  const pts0 = ctx.routeEnd.pts.slice();
  let clipped = false, firstClipT = -1, minClear = Infinity;
  const dt = 0.05;
  for (let i = 0; i < 600; i++){           // up to 30s of cinematic
    if (!ctx.routeEnd || ctx.routeEnd.phase === 'board' || ctx.routeEnd.phase === 'drive') break;
    updateRouteEnd(dt);
    if (ctx.routeEnd && ctx.routeEnd.phase === 'walk'){
      if (inBody(ctx.p.wx, ctx.p.wy, truck) && !clipped){ clipped = true; firstClipT = i * dt; }
      const clear = clearance(ctx.p.wx, ctx.p.wy, truck);
      if (clear < minClear) minClear = clear;
    }
  }
  const door = pts0[pts0.length - 1];
  const reached = ctx.routeEnd && ctx.routeEnd.phase === 'board' && Math.hypot(ctx.p.wx - door.x, ctx.p.wy - door.y) < 0.4;
  return { clipped, firstClipT, minClear, reached, pts: pts0, phase: ctx.routeEnd ? ctx.routeEnd.phase : 'gone', walkT: ctx.routeEnd ? ctx.routeEnd.walkT : 0 };
}

// 1) route-end trigger, curb side (wy = 0.6)
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck);
  check('route-end (curb side): worker never clips the truck body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u, clipT=' + r.firstClipT);
  check('route-end (curb side): reaches the cab door', r.reached, 'phase=' + r.phase);
  check('route-end (curb side): walk completes within the 12s safety window', r.reached && r.walkT < 12, 'walkT=' + r.walkT.toFixed(2) + 's');
  check('route-end (curb side): 2-leg path, rear waypoint first', r.pts.length === 2 && r.pts[0].x < r.pts[1].x, JSON.stringify(r.pts.map(q => q.x.toFixed(1))));
  check('route-end (curb side): rear waypoint is BEHIND the hopper', r.pts[0].x <= truck.wx - boxL - 0.7, 'x=' + r.pts[0].x.toFixed(2) + ' vs rear=' + (truck.wx - boxL).toFixed(2));
  check('route-end (curb side): door waypoint is beside the cab', Math.abs(r.pts[1].x - (truck.wx + cabOff * 0.55)) < 1e-6 && Math.abs(r.pts[1].y - (TRUCK_CY + boxW + 0.8)) < 1e-6, JSON.stringify(r.pts[1]));
  check('route-end (curb side): door stays OUTSIDE the body (0.8u off the panel)', r.pts[1].y > TRUCK_CY + boxW + 0.79, 'y=' + r.pts[1].y.toFixed(2) + ' panel=' + (TRUCK_CY + boxW).toFixed(2));
}
// 2) route-end trigger, road side (wy = -9.0)
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: -9.0, facing: 0, phase: 0 }, truck);
  check('route-end (road side): worker never clips the truck body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('route-end (road side): reaches the cab door', r.reached, 'phase=' + r.phase);
  check('route-end (road side): 2-leg path, rear waypoint first', r.pts.length === 2 && r.pts[0].x < r.pts[1].x, JSON.stringify(r.pts.map(q => q.x.toFixed(1))));
  check('route-end (road side): path runs on the ROAD side of the truck', r.pts.every(q => q.y < TRUCK_CY - boxW + 0.01), JSON.stringify(r.pts.map(q => q.y.toFixed(2))));
}
// 3) test-mode L mid-route, on the curb side
{
  const truck = { wx: 400, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 402, wy: 1.2, facing: 0, phase: 0 }, truck);
  check('test-mode L (mid-route, curb side): never clips the body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('test-mode L (mid-route, curb side): reaches the cab door', r.reached, 'phase=' + r.phase);
}
// 4) test-mode L in front of the cab: direct line, no rear waypoint
{
  const truck = { wx: 400, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const cabX = truck.wx + cabOff * 0.55;
  const r = simWalk({ wx: cabX + 2.0, wy: 0.8, facing: 0, phase: 0 }, truck);
  check('test-mode L (ahead of cab): direct path, skips the rear waypoint', r.pts.length === 1, 'pts=' + r.pts.length);
  check('test-mode L (ahead of cab): never clips the body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('test-mode L (ahead of cab): reaches the cab door', r.reached, 'phase=' + r.phase);
}
// 5) procedural-fallback truck dimensions (boxL 4.0 / boxW 1.9)
{
  const t2 = { wx: 654.5, boxL: 4.0, boxW: 1.9, cabOff: 4.0 + 1.6, hopperOff: -4.3, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, t2);
  check('procedural fallback truck: never clips the body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('procedural fallback truck: reaches the cab door', r.reached, 'phase=' + r.phase);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

