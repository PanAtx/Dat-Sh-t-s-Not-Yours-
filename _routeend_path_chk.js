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
// Build a worker group mock that mirrors the real one: a `visible` flag plus a
// `traverse` that visits the (mock) meshes. updateRouteEnd forces each mesh visible
// during the on-stage phases, so the meshes are exposed for assertions.
function mkWorkerGroup(){
  const meshes = [{ isMesh: true, visible: true }];
  const group = { visible: true, position: { set(){} }, rotation: { set(){} }, meshes };
  group.traverse = function(fn){ meshes.forEach(fn); };
  return group;
}
function mkWorld(p0, truck, hopperLoad){
  const H = { bursts: 0, finished: 0 }; // compactor observations
  return {
    state: 'play', carried: null, p: p0, truck: truck,
    worker: { group: mkWorkerGroup() },
    wparts: { armL: { rotation: { set(){} } }, armR: { rotation: { set(){} } }, legL: { rotation: { set(){} } }, legR: { rotation: { set(){} } } },
    g: null, GZ: 0.01,
    routeEnd: null,
    hopperLoad: hopperLoad || 0,
    H: H,
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
    // Hopper-compactor state (the route-end CYCLE beat reads/writes these globals,
    // exactly like the browser closure): updateHopperTrash() runs the countdown and
    // finishHopperCycle() flips hopperCycling off once the load is cycled.
    hopperLoad: world.hopperLoad,
    hopperCycling: false,
    hopperCycleT: 0,
    HOPPER_CYCLE_DUR: 0.75,
    hopperAimX: () => 0,
    hopperWorldY: () => 0,
    spawnHopperBurst: (x, y, k) => { world.H.bursts++; },
    updateCreatures: world.updateCreatures, updateBonuses: world.updateBonuses,
    updatePowerups: world.updatePowerups, updateFlyingCans: world.updateFlyingCans,
    updateFlyingBags: world.updateFlyingBags, updateFlyingBaskets: world.updateFlyingBaskets,
    updateDustParticles: world.updateDustParticles, updateStarParticles: world.updateStarParticles,
    updateBlocks: world.updateBlocks, updateFootprints: world.updateFootprints, updateHUD: world.updateHUD,
    clamp: world.clamp, camera: world.camera, finishRouteEnd: world.finishRouteEnd,
    WORKER_GENDER: 'male',
    // THE DRIVE-OFF'S OWN DEPS (it routes the mirrored axis, throws confetti and drives
    // the rig out): inert mocks on the weekday scenarios, overridable per test world.
    routeDir: world.routeDir || function () { return 1; },
    startConfetti: world.startConfetti || function () { world.H.confetti = (world.H.confetti || 0) + 1; },
    confettiCannon: world.confettiCannon || function () { world.H.cannon = (world.H.cannon || 0) + 1; },
    updateTruck: world.updateTruck || function () {},
    truckMeshYaw: world.truckMeshYaw || function () { return 0; },
    positionCamera: world.positionCamera || function () {},
    blinkHazardLights: world.blinkHazardLights || function () {},
    routeComplete: world.routeComplete || function () { world.H.completed = (world.H.completed || 0) + 1; },
    updateDroppedSlices: world.updateDroppedSlices || function () {},
    updateFlecks: world.updateFlecks || function () {},
    // THE MIDNIGHT DRIVE-OFF GATE (startRouteEnd's night branch): supplied as plain
    // globals; on the weekday scenarios isNightShift stays UNDEFINED and the gate skips.
    isNightShift: world.isNightShift,
    bossShovelTargetable: world.bossShovelTargetable || function () { return false; },
    reclaimStolenGargoyle: world.reclaimStolenGargoyle || function () { world.H.reclaims = (world.H.reclaims || 0) + 1; },
    bossGargoyle: world.bossGargoyle || null,
    workerMaxY: () => 8.0, // Flatbush cap — index.html's workerMaxY() (Manhattan levels cap at 5.0)
    workerMaxY: () => 8.0, // Flatbush cap — index.html's workerMaxY() (Manhattan levels cap at 5.0)
    // THE DRIVE-OFF'S CAMERA MATH (the rig rolls out when its rear clears the screen edge)
    CAM_PIVOT_WORKER: true, CAM_Y: -6, camFollow: 0, CAM_LANE_FOLLOW: 1, CAM_PAN_MAX: 3,
    CAM_ANGLE_OFFSET: 0,
    RE_CHEER: grabConst('RE_CHEER'), RE_WALK_SP: grabConst('RE_WALK_SP'),
    RE_DRIVE_SP: grabConst('RE_DRIVE_SP'), RE_DRIVE_MAX: grabConst('RE_DRIVE_MAX'),
    Math: Math
  };
  // Closure-based (NOT `this`-based): Node's vm global proxy does not let `this` reads
  // see host-set properties, so the fakes read/write ctx directly.
  ctx.finishHopperCycle = function(){ ctx.hopperCycling = false; ctx.hopperLoad = 0; world.H.finished++; };
  ctx.updateHopperTrash = function(dt){
    if (ctx.hopperCycling){
      ctx.hopperCycleT -= dt;
      if (ctx.hopperCycleT <= 0) ctx.finishHopperCycle();
    }
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('startRouteEnd') + '\n' + extractFn('updateRouteEnd'), ctx);
  return { ctx, startRouteEnd: ctx.startRouteEnd, updateRouteEnd: ctx.updateRouteEnd };
}
// run the whole cinematic (cheer -> walk -> [cycle] -> board -> drive) and report
// the walk (plus the compactor CYCLE beat when the hopper carries a load)
function simWalk(p0, truck, hopperLoad){
  const w = mkWorld(p0, truck, hopperLoad);
  const { ctx, startRouteEnd, updateRouteEnd } = harness(w);
  startRouteEnd();
  const pts0 = ctx.routeEnd.pts.slice();
  let clipped = false, firstClipT = -1, minClear = Infinity;
  let sawCycle = false, sawCycling = false, cycleX = 0, cycleY = 0;
  const dt = 0.05;
  for (let i = 0; i < 900; i++){           // up to 45s of cinematic
    if (!ctx.routeEnd || ctx.routeEnd.phase === 'board' || ctx.routeEnd.phase === 'drive') break;
    updateRouteEnd(dt);
    if (ctx.routeEnd && ctx.routeEnd.phase === 'cycle'){
      sawCycle = true; cycleX = ctx.p.wx; cycleY = ctx.p.wy;
    }
    if (ctx.hopperCycling) sawCycling = true;
    if (ctx.routeEnd && ctx.routeEnd.phase === 'walk'){
      if (inBody(ctx.p.wx, ctx.p.wy, truck) && !clipped){ clipped = true; firstClipT = i * dt; }
      const clear = clearance(ctx.p.wx, ctx.p.wy, truck);
      if (clear < minClear) minClear = clear;
    }
  }
  const door = pts0[pts0.length - 1];
  const reached = ctx.routeEnd && ctx.routeEnd.phase === 'board' && Math.hypot(ctx.p.wx - door.x, ctx.p.wy - door.y) < 0.4;
  return { clipped, firstClipT, minClear, reached, pts: pts0, phase: ctx.routeEnd ? ctx.routeEnd.phase : 'gone', walkT: ctx.routeEnd ? ctx.routeEnd.walkT : 0,
           sawCycle, sawCycling, cycleX, cycleY, bursts: w.H.bursts, finished: w.H.finished,
           cyclingLeft: !!ctx.hopperCycling };
}

// 1) route-end trigger, curb side (wy = 0.6)
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck);
  check('route-end (curb side): worker never clips the truck body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u, clipT=' + r.firstClipT);
  check('route-end (curb side): reaches the cab door', r.reached, 'phase=' + r.phase);
  check('route-end (curb side): walk completes within the 12s safety window', r.reached && r.walkT < 12, 'walkT=' + r.walkT.toFixed(2) + 's');
  check('route-end (curb side): 2-leg path, the FAR-SIDE entry waypoint leads (the RT-mirrored drive-off law: the rig leaves from the end it faces, and the entry beat stands 0.8u clear of the front face)', r.pts.length === 2 && r.pts[0].x > r.pts[1].x, JSON.stringify(r.pts.map(q => q.x.toFixed(1))));
  check('route-end (curb side): entry waypoint stands 0.8u off the FRONT face, fully clear of the hopper and the body', Math.abs(r.pts[0].x - (truck.wx + boxL + 0.8)) < 1e-6, 'x=' + r.pts[0].x.toFixed(2) + ' front=' + (truck.wx + boxL).toFixed(2));
  check('route-end (curb side): door waypoint is beside the cab', Math.abs(r.pts[1].x - (truck.wx + cabOff * 0.55)) < 1e-6 && Math.abs(r.pts[1].y - (TRUCK_CY + boxW + 0.8)) < 1e-6, JSON.stringify(r.pts[1]));
  check('route-end (curb side): door stays OUTSIDE the body (0.8u off the panel)', r.pts[1].y > TRUCK_CY + boxW + 0.79, 'y=' + r.pts[1].y.toFixed(2) + ' panel=' + (TRUCK_CY + boxW).toFixed(2));
}
// 2) route-end trigger, road side (wy = -9.0)
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: -9.0, facing: 0, phase: 0 }, truck);
  check('route-end (road side): worker never clips the truck body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('route-end (road side): reaches the cab door', r.reached, 'phase=' + r.phase);
  check('route-end (road side): 2-leg path, the FAR-SIDE entry waypoint leads (same mirrored-axis law on the road side)', r.pts.length === 2 && r.pts[0].x > r.pts[1].x, JSON.stringify(r.pts.map(q => q.x.toFixed(1))));
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
// 5b) NEW GLB truck (boxL 6.197, measured cabDoorOff = tMaxX - 1.0 = 5.197):
//     the worker must walk FURTHER than the legacy cabOff*0.55 stop point and still
//     reach the door without clipping the body.
{
  const gL = 6.197;
  const tg = { wx: 654.5, boxL: gL, boxW: 2.25, cabOff: gL + 1.6, cabDoorOff: gL - 1.0, hopperOff: -gL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, tg);
  check('GLB truck: worker never clips the body', !r.clipped, 'minClear=' + r.minClear.toFixed(3) + 'u');
  check('GLB truck: reaches the cab door', r.reached, 'phase=' + r.phase);
  check('GLB truck: door waypoint at the measured cab door (front face - 1.0u)', Math.abs(r.pts[1].x - (tg.wx + gL - 1.0)) < 1e-6, 'x=' + r.pts[1].x.toFixed(3) + ' expect=' + (tg.wx + gL - 1.0).toFixed(3));
  check('GLB truck: door is FURTHER forward than the legacy cabOff*0.55 stop', r.pts[1].x > tg.wx + (gL + 1.6) * 0.55, 'door=' + r.pts[1].x.toFixed(3) + ' vs legacy=' + (tg.wx + (gL + 1.6) * 0.55).toFixed(3));
  const roadSide = simWalk({ wx: 656, wy: -9.0, facing: 0, phase: 0 }, tg);
  check('GLB truck (road side): never clips the body', !roadSide.clipped, 'minClear=' + roadSide.minClear.toFixed(3) + 'u');
  check('GLB truck (road side): reaches the cab door', roadSide.reached, 'phase=' + roadSide.phase);
}
// 6) worker frozen INVISIBLE by the "RUN IT UP!" blink when the level completes:
//    updatePlayer stops running in the 'routeend' state, so the last blink frame's
//    per-mesh .visible value is frozen. If that frame was the "off" phase the worker
//    would stay invisible for the whole celebration. updateRouteEnd must force every
//    mesh visible during the on-stage (cheer + walk) phases, and still let the board
//    phase hide the group once he steps into the cab.
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const w = mkWorld({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck);
  // Freeze the worker exactly as a bad blink frame would leave him: every mesh AND
  // the group hidden.
  w.worker.group.visible = false;
  w.worker.group.meshes.forEach(m => { m.visible = false; });
  const { ctx, startRouteEnd, updateRouteEnd } = harness(w);
  startRouteEnd();
  const dt = 0.05;
  let sawStageVisible = false, stageMeshVisible = true, groupStageVisible = true;
  let boardHidGroup = false;
  for (let i = 0; i < 600; i++){
    const ph = ctx.routeEnd && ctx.routeEnd.phase;
    if (!ctx.routeEnd || ph === 'drive') break;
    updateRouteEnd(dt);
    const after = ctx.routeEnd && ctx.routeEnd.phase;
    if (after === 'cheer' || after === 'walk'){
      sawStageVisible = true;
      if (!w.worker.group.meshes.every(m => m.visible)) stageMeshVisible = false;
      if (!w.worker.group.visible) groupStageVisible = false;
    }
    // The board phase hides the group (g.visible=false) in the SAME frame it hands
    // off to 'drive', so observe the hide at the board->drive transition.
    if (after === 'drive' && w.worker.group.visible === false) boardHidGroup = true;
  }
  check('route-end: frozen-invisible worker is re-shown on stage', sawStageVisible && stageMeshVisible && groupStageVisible,
        'cheer/walk saw=' + sawStageVisible + ' meshVisible=' + stageMeshVisible + ' groupVisible=' + groupStageVisible);
  check('route-end: board phase still hides the group once he is in the cab', boardHidGroup);
}

// 7) THE COMPACTOR CYCLE: at the hopper the day's garbage gets cycled INTO the truck
//    (the pile's shrink/fade) before he walks on to the cab.
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const r = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck, 3);
  check('compactor cycle: he STOPS at the hopper (the cycle phase runs)', r.sawCycle, 'end-phase=' + r.phase);
  check('compactor cycle: the compactor kicks in (burst + hopperCycling)', r.bursts > 0 && r.sawCycling, 'bursts=' + r.bursts + ' cycling=' + r.sawCycling);
  check('compactor cycle: the day load is cycled INTO the truck (finishHopperCycle ran, nothing left)', r.finished === 1 && !r.cyclingLeft, 'finished=' + r.finished + ' left=' + r.cyclingLeft);
  check('compactor cycle: he stands by the hopper while it cycles (no drift)', Math.abs(r.cycleX - r.pts[0].x) < 0.5 && Math.abs(r.cycleY - r.pts[0].y) < 0.5,
        'at=(' + r.cycleX.toFixed(2) + ',' + r.cycleY.toFixed(2) + ') hopper=(' + r.pts[0].x.toFixed(2) + ',' + r.pts[0].y.toFixed(2) + ')');
  check('compactor cycle: after the cycle he reaches the cab door, never clipping', r.reached && !r.clipped, 'phase=' + r.phase + ' minClear=' + r.minClear.toFixed(2) + 'u');
  const r2 = simWalk({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck, 0);
  check('compactor cycle: an EMPTY hopper skips the beat (straight to the cab)', !r2.sawCycle && r2.reached, 'phase=' + r2.phase);
}

// 8) THE MIDNIGHT DRIVE-OFF GATE (boss-stage crash: "Cannot read properties of null
//    (reading 't')" at updateRouteEnd). The night's hard gate must NEVER arm the
//    cinematic state without building its sequencer: a blocked clock-out leaves the
//    shift in "play", and a frame that finds the flag up with no sequencer steps aside.
{
  const truck = { wx: 654.5, boxL, boxW, cabOff, hopperOff: -boxL + 1.6, g: null, hidden: 0 };
  const w = mkWorld({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck);
  w.routeDir = () => -1;                      // the dead-end street: the drive-off runs REVERSED
  w.isNightShift = () => true;                // MIDNIGHT
  w.bossShovelTargetable = () => true;        // THE BEAST IS STILL STANDING in the grave yard
  const gate = harness(w);
  gate.startRouteEnd();
  check('midnight gate: a drive-off trigger with the beast standing leaves the shift EXACTLY where it was — state stays "play", the sequencer stays unarmed (null), and the treasure pay-out still fires',
    gate.ctx.state === 'play' && gate.ctx.routeEnd === null && w.H.reclaims === 1,
    'state=' + gate.ctx.state + ' routeEnd=' + gate.ctx.routeEnd + ' claims=' + w.H.reclaims);
  let threw = false;
  try { gate.updateRouteEnd(1 / 60); gate.updateRouteEnd(1 / 60); } catch (e) { threw = true; }
  check('midnight gate: a "routeend" frame that finds no sequencer is a GUARDED NO-OP — updateRouteEnd never dereferences a null routeEnd (the exact boss-stage crash path)',
    !threw && gate.ctx.state === 'play' && gate.ctx.routeEnd === null, threw ? 'threw' : 'no-op');
  // THE SAME TRIGGER AFTER THE WIN: beast in the hopper, gargoyle in hand — the gate opens
  w.bossShovelTargetable = () => false;
  const win = harness(w);
  win.ctx.finishRouteEnd = function () { win.ctx.routeEnd = null; win.finishCount = (win.finishCount || 0) + 1; };
  win.startRouteEnd();
  check('midnight gate: once the beast is banished and the Gargoyle is taken the SAME trigger clocks out for real — state flips, the sequencer is BUILT, and the cinematic can run to the cab',
    win.ctx.state === 'routeend' && !!win.ctx.routeEnd && win.ctx.routeEnd.phase === 'cheer',
    'phase=' + (win.ctx.routeEnd && win.ctx.routeEnd.phase));
  let dthrew = false, sawDrive = false, lastPhase = '';
  try {
    for (let i = 0; i < 2000 && win.ctx.routeEnd; i++) {
      if (win.ctx.routeEnd.phase === 'drive') sawDrive = true;
      lastPhase = win.ctx.routeEnd.phase;
      win.updateRouteEnd(0.05);
    }
  } catch (e) { dthrew = true; lastPhase += ' THREW ' + e.message; }
  check('midnight gate: the cleared-night cinematic drives out clean (cheer -> walk -> board -> drive, never a null deref, the rig ends with ONE finishRouteEnd and the sequencer disarmed)',
    !dthrew && sawDrive && win.finishCount === 1 && win.ctx.routeEnd === null,
    'finishes=' + win.finishCount + ' drive=' + sawDrive + ' last=' + lastPhase);
  // the weekday street NEVER sees the gate (isNightShift absent) — scenario 1's contract
  const wd = harness(mkWorld({ wx: 656, wy: 0.6, facing: 0, phase: 0 }, truck));
  wd.startRouteEnd();
  check('midnight gate is a NIGHT branch: on a weekday street the gate variables being absent changes NOTHING — the drive-off arms on the spot',
    wd.ctx.state === 'routeend' && !!wd.ctx.routeEnd && wd.ctx.routeEnd.phase === 'cheer');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

