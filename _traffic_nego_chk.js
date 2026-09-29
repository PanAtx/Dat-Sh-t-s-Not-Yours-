// _traffic_nego_chk.js - the "traffic talk" check: extracts the REAL negotiation
// module from index.html and runs it headless. Asserts:
//   1. follow model: a car brakes to match a slow leader (honest queue), free run on a
//      wide gap, full stop behind a stopped leader,
//   2. the no-crawl floor does NOT override a real queue,
//   3. forced pass: car + bike in ONE lane -> the car passes, the bike pops the curb
//      (and later returns), nobody is up on the sidewalk,
//   4. knot: two machines spawned INSIDE each other separate within 2s and both keep
//      moving - the street jams, it never locks,
//   5. car bodies never cross the curb line, rider shoulders stay on the walk band.
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const html = readFileSync(path.join(import.meta.dirname, "index.html"), "utf8").replace(/\r\n/g, "\n");

// ---- extract the real module (A+B+C+D block) + the body-aware clamp ------------
const startIdx = html.indexOf("const NEGO_EDGE_CURB = 0.5;");
const endMarker = 'if (typeof v._homeLane === "number") v._homeLane += dyv;\n      }';
const endIdx = html.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error("FAIL: could not extract the negotiation module from index.html");
  process.exit(1);
}
let src = html.slice(startIdx, endIdx + endMarker.length);
const clampIdx = html.indexOf("function clampRoadVehicle(v) {");
src += "\n" + html.slice(clampIdx, html.indexOf("\n      }", clampIdx) + 8);

// ---- sandbox with the world the module expects ----------------------------------
let truck = { active: true, wx: 100, wy: -4.5, boxW: 2.4, boxWCurb: 2.4, boxWStreet: 2.4, boxL: 16 };
const ctx = {
  Math,
  truck,
  creatureMaxY: () => 6,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  // Voice intentionally absent: negoTalk guards with typeof
};
vm.createContext(ctx);
vm.runInContext(src + "\nthis.T = { negotiateTraffic, negoFollowSp, negoFloorSp, separateVehicles, clampRoadVehicle, negoLanes, negoWalkLanes, negoHW, negoHL };", ctx);
const T = ctx.T;

let failures = 0;
function ok(name, cond, extra) {
  console.log((cond ? "  [ok] " : "  [FAIL] ") + name + (extra ? " -- " + extra : ""));
  if (!cond) failures++;
}

function mk(type, wx, wy, sp, extra) {
  const dims = { car: [2.38, 5.9], moto: [0.7, 2.4], ebike: [0.5, 2.2], bike: [0.5, 2.2] }[type];
  const v = { type, wx, wy, sp, curSp: sp, boxW: dims[0], boxL: dims[1] };
  if (extra) Object.assign(v, extra);
  return v;
}

// one simulated frame with the REAL negotiation + follow + separation + clamp
function frame(vehicles, dt) {
  T.negotiateTraffic(vehicles, dt);
  for (const v of vehicles) {
    const free = v.sp;
    const want = T.negoFollowSp(v, free, vehicles);
    v.curSp += (want - v.curSp) * 8 * dt;
    if (v.curSp < 0) v.curSp = 0;
    v.wx += v.curSp * dt;
    if (v._negoLane !== undefined) v.wy += (v._negoLane - v.wy) * 3 * dt;
    T.clampRoadVehicle(v);
  }
  T.separateVehicles(vehicles, dt);
}
function overlap(vehicles) {
  let worst = { pen: 0, pair: null };
  for (let i = 0; i < vehicles.length; i++)
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i], b = vehicles[j];
      const penY = T.negoHW(a) + T.negoHW(b) - Math.abs(a.wy - b.wy);
      const penX = T.negoHL(a) + T.negoHL(b) - Math.abs(a.wx - b.wx);
      if (penY > 0 && penX > 0) {
        const p = Math.min(penY, penX);
        if (p > worst.pen) worst = { pen: p, pair: [a.type, b.type] };
      }
    }
  return worst;
}
const carLegal = (v) => v.wy + T.negoHW(v) <= 0.55; // whole body below the curb
const onWalk = (v) => v._negoWalk && v._negoShoulder > 0;

// ----------------------------------------------------------- 1. follow model ----
console.log("follow model (honest queue):");
{
  const leader = mk("bike", 10, -1, 12, { curSp: 12 });
  const car = mk("car", -1.1, -1, 30, { curSp: 30 }); // 3u gap behind the bike (HL 2.2 + 5.9)
  const tight = T.negoFollowSp(car, 30, [car, leader]);
  ok("car behind a 12 u/s bike at 3u gap brakes hard", tight <= 3, "got " + tight.toFixed(2));
  leader.wx = 61.9; // 60u gap
  const wide = T.negoFollowSp(car, 30, [car, leader]);
  ok("car with a 60u gap runs free", wide >= 29, "got " + wide.toFixed(2));
  const stopped = mk("car", 10.02, -1, 0, { curSp: 0 });
  const me = mk("car", -1.78, -1, 20, { curSp: 20 }); // 0.02u gap behind the stopped car
  const stop = T.negoFollowSp(me, 20, [me, stopped]);
  ok("car behind a stopped car stops", stop <= 0.5, "got " + stop.toFixed(2));
  ok("no-crawl floor does not override a real queue", T.negoFloorSp(me, 0, 8.5) < 2, "got " + T.negoFloorSp(me, 0, 8.5).toFixed(2));
  ok("no-crawl floor applies on a clear lane", T.negoFloorSp(leader, 2, 8.5) >= 8.5, "got " + T.negoFloorSp(leader, 2, 8.5).toFixed(2));
}

// --------------------------------------- 2. forced pass: curb lane fully loaded --
console.log("forced pass (car boxed into the curb lane, 3 riders ahead):");
{
  const outer = mk("car", 20, -8.21, 30); // occupies the only other car lane
  const car = mk("car", -30, -0.77, 30);
  const a = mk("bike", 0, -0.77, 12);
  const b = mk("bike", -6, 0.13, 11);
  const c3 = mk("ebike", -12, -1.61, 14);
  const vs = [outer, car, a, b, c3];
  let passed = false, shouldered = false, minCarSp = 99, maxPen = 0, curbViol = 0, knotFrames = 0;
  const dt = 1 / 60;
  for (let f = 0; f < 60 * 25; f++) {
    frame(vs, dt);
    if (car.wx - a.wx > 10) passed = true;
    if (a._negoWalk || b._negoWalk || c3._negoWalk) shouldered = true;
    if (car.curSp < minCarSp) minCarSp = car.curSp;
    const w = overlap(vs);
    if (w.pen > maxPen) maxPen = w.pen;
    if (w.pen > 0.35) knotFrames++;
    if (!carLegal(car) || !carLegal(outer)) curbViol++;
  }
  ok("the car passes the riders", passed, "dx=" + (car.wx - a.wx).toFixed(1));
  ok("a rider pops the curb to let it past", shouldered);
  ok("the car queued honestly (slowed to the riders)", minCarSp < 15, "min speed=" + minCarSp.toFixed(1));
  ok("no sustained major overlap (knot)", knotFrames < 30, "knot frames=" + knotFrames);
  ok("peak overlap stays small", maxPen < 0.6, "peak=" + maxPen.toFixed(2));
  ok("car bodies never cross the curb", curbViol === 0, "violations=" + curbViol);
}

// ------------------------------------------------------------- 3. the knot -------
console.log("knot resolution (spawned inside each other):");
{
  const bike = mk("bike", 0, -0.77, 12);
  const car = mk("car", 3, -0.9, 30); // overlapping the bike at spawn
  const moto = mk("moto", 1, -1.5, 18);
  let clearedAt = -1, knotFrames = 0, curbViol = 0;
  const startX = [bike.wx, car.wx, moto.wx];
  const dt = 1 / 60;
  for (let f = 0; f < 60 * 20; f++) {
    frame([bike, car, moto], dt);
    const w = overlap([bike, car, moto]);
    if (w.pen > 0.35) knotFrames++;
    if (clearedAt < 0 && w.pen <= 0.01) clearedAt = f;
    if (!carLegal(car)) curbViol++;
    if (!carLegal(moto) && !onWalk(moto)) curbViol++;
  }
  ok("overlap resolves", clearedAt >= 0, "cleared at frame " + clearedAt);
  ok("overlap is only temporary (<2s)", clearedAt < 120, "frame " + clearedAt);
  ok("no sustained knot", knotFrames < 60, "knot frames=" + knotFrames);
  ok("everyone keeps moving", bike.wx - startX[0] > 40 && car.wx - startX[1] > 40 && moto.wx - startX[2] > 40,
    "dx=" + (bike.wx - startX[0]).toFixed(0) + "/" + (car.wx - startX[1]).toFixed(0) + "/" + (moto.wx - startX[2]).toFixed(0));
  ok("car body never crosses the curb", curbViol === 0, "violations=" + curbViol);
}

// ------------------------------------------------------ 4. busy street, 20s -----
console.log("busy street (3 bikes, e-bike, moto, 2 cars, 20s):");
{
  const vs = [
    mk("car", -60, -0.77, 30),
    mk("car", -90, -8.21, 28),
    mk("moto", -10, -1.61, 18),
    mk("bike", 0, -0.77, 12),
    mk("bike", -6, 0.13, 11),
    mk("ebike", -14, -1.61, 14),
  ];
  const startX = vs.map((v) => v.wx);
  let curbViol = 0, knotFrames = 0, maxPen = 0;
  const dt = 1 / 60;
  for (let f = 0; f < 60 * 20; f++) {
    frame(vs, dt);
    const w = overlap(vs);
    if (w.pen > maxPen) maxPen = w.pen;
    if (w.pen > 0.35) knotFrames++;
    for (const v of vs) if ((v.type === "car" || v.type === "moto") && !onWalk(v) && !carLegal(v)) curbViol++;
  }
  const progressed = vs.every((v, i) => v.wx - startX[i] > 60);
  ok("every machine keeps moving (no lock-up)", progressed, vs.map((v, i) => (v.wx - startX[i]).toFixed(0)).join("/"));
  ok("no sustained knot", knotFrames < 60, "knot frames=" + knotFrames);
  ok("peak overlap stays small", maxPen < 0.8, "peak=" + maxPen.toFixed(2));
  ok("car/moto bodies never cross the curb", curbViol === 0, "violations=" + curbViol);
}

console.log(failures ? "\nFAIL: " + failures + " assertion(s) failed" : "\nALL TRAFFIC NEGOTIATION CHECKS PASSED");
process.exit(failures ? 1 : 0);

