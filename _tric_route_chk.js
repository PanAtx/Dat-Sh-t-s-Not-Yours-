// _tric_route_chk.js — "WHERE DID THE TRICYCLE KID GO?" regression check (Wednesday / Flatbush).
//   PART 1 runs the REAL driveway-tricycle spawn block extracted from spawnWorld against the
//     REAL street layout (LEVEL_BLOCKS / BW / HOUSES_PER_BLOCK / ROUTE_START_X / ROUTE_FINISH_X
//     parsed out of index.html), thousands of shifts deep:
//       * every kid parks on a driveway the worker ACTUALLY WALKS PAST (never Block 1 behind the
//         start barrier, never Block 6 past the finish line),
//       * the three kids are DEALT OUT SPREAD ACROSS THE ROUTE (never bunched on one block),
//       * no two kids ever share a driveway, and every corridor driveway gets used,
//       * the parked kid sits on the WALK EDGE (visible + reachable from the sidewalk), not
//         back at the driveway gate,
//       * a degenerate layout with no driveway in the corridor still spawns 3 kids (no NaN).
//   PART 2 runs the REAL case "tric" body (the isDrivewayTric branch of updateCreatures):
//       * a worker walking the sidewalk gets reached (he bumps) — the kid cannot be walked past,
//       * a worker hugging the CURB gets reached too (the old home at wy 4.3 + the driveway-lane
//         clamp made a curb-lane worker literally untouchable),
//       * the kid YOLLS BEFORE CONTACT (the tell), and the tell never spams,
//       * a parked kid is never a frozen statue (he sways), and a chase never enters the street.
// Run: node _tric_route_chk.js
"use strict";
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!cond) ok = false;
};
const numOf = (name) => {
  // the declaration may sit in a shared const list ("const NB = 18, BW = 8;"), so match the
  // name anywhere on its declaration line rather than requiring a leading "const".
  const m = src.match(new RegExp("^(?:[ \\t]*const[ \\t]*|[ \\t]+)[^;{}\\n]*?\\b" + name + "\\b\\s*=\\s*([-\\d.]+);", "m"));
  if (!m) throw new Error("const " + name + " not found in index.html");
  return Number(m[1]);
};

// ---- the real street layout, read out of index.html ----
const BW = numOf("BW");
const HOUSES_PER_BLOCK = numOf("HOUSES_PER_BLOCK");
const HOUSE_ROW_X = numOf("HOUSE_ROW_X");
const ROUTE_START_X = numOf("ROUTE_START_X");
const ROUTE_FINISH_X = numOf("ROUTE_FINISH_X");
const DRIVETR_CHAIN_R = numOf("DRIVETR_CHAIN_R");
const DRIVETR_AGGRO_DIST = numOf("DRIVETR_AGGRO_DIST");
const DRIVETR_LATERAL = numOf("DRIVETR_LATERAL");
const LEVEL_BLOCKS = [
  ...src.matchAll(/\{\s*x:\s*(-?\d+),\s*garbage:\s*(true|false)\s*\}/g),
].map((m) => ({ x: Number(m[1]), garbage: m[2] === "true" }));
check("parsed the street layout (" + LEVEL_BLOCKS.length + " blocks)", LEVEL_BLOCKS.length >= 4,
  LEVEL_BLOCKS.map((b) => b.x).join(","));

// Flatbush driveways, exactly the way spawnWorld collects them: house i sits at
// blockX + i*BW + HOUSE_ROW_X and the driveway is one cell further on (b.worldX + BW).
function collectDriveways() {
  const out = [];
  for (const b of LEVEL_BLOCKS) {
    for (let i = 0; i < HOUSES_PER_BLOCK - 1; i++) {
      out.push(b.x + HOUSE_ROW_X + BW * (i + 1));
    }
  }
  return out;
}
const ALL_DRIVES = collectDriveways();
const IN_ROUTE = ALL_DRIVES.filter((x) => x > ROUTE_START_X && x < ROUTE_FINISH_X);
const DEAD = ALL_DRIVES.filter((x) => x <= ROUTE_START_X || x >= ROUTE_FINISH_X);
check("the layout really has driveways the worker never walks past (the old dead drops)",
  DEAD.length > 0, DEAD.length + " of " + ALL_DRIVES.length + " outside x " + ROUTE_START_X + ".." + ROUTE_FINISH_X);
check("the serviced stretch really has driveways to choose from", IN_ROUTE.length >= 3,
  IN_ROUTE.length + " candidates");


// ---- PART 1: run the REAL spawner block ----
function extractSpawnBlock() {
  const anchor = src.indexOf('const dt = addCreature("tric");');
  if (anchor < 0) throw new Error("driveway tricycle spawn not found");
  const start = src.lastIndexOf("if (isFlatbushLevel()) {", anchor);
  if (start < 0) throw new Error("enclosing isFlatbushLevel block not found");
  let i = src.indexOf("{", start),
    depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(start, i + 1);
}
const spawnBlock = extractSpawnBlock();
const makeSpawner = new Function(
  "flatbushDriveways",
  "addCreature",
  "isFlatbushLevel",
  "ROUTE_START_X",
  "ROUTE_FINISH_X",
  "DRIVETR_CHAIN_R",
  "GZ",
  spawnBlock,
);
function oneShift(pool) {
  const spawned = [];
  const list = pool.slice();
  // the doghouse loop runs FIRST and splices 3 driveways off the pool
  for (let d = 0; d < 3 && list.length > 0; d++) {
    list.splice((Math.random() * list.length) | 0, 1);
  }
  makeSpawner(list, () => {
    const c = { g: { position: { set() {} }, rotation: {} } };
    spawned.push(c);
    return c;
  }, () => true, ROUTE_START_X, ROUTE_FINISH_X, DRIVETR_CHAIN_R, 0.3);
  return { spawned, left: list };
}
{
  const RUNS = 4000;
  let not3 = 0, onDead = 0, dupe = 0, bunched = 0, NaNPos = 0, farBehindWalk = 0, laneTrap = 0;
  let firstKidMaxFrac = 0, worstTailGap = 0, minGap = Infinity;
  const used = new Map(IN_ROUTE.map((x) => [x, 0]));
  for (let n = 0; n < RUNS; n++) {
    const { spawned } = oneShift(ALL_DRIVES);
    if (spawned.length !== 3) {
      not3++;
      continue;
    }
    const xs = spawned.map((c) => c.homeX).sort((a, b) => a - b);
    if (xs.some((x) => !isFinite(x)) || spawned.some((c) => !isFinite(c.wy))) NaNPos++;
    for (const c of spawned) {
      if (c.homeX <= ROUTE_START_X || c.homeX >= ROUTE_FINISH_X) onDead++;
      if (used.has(c.homeX)) used.set(c.homeX, used.get(c.homeX) + 1);
      // he must sit on the walk edge (inside the sidewalk band), not back at the gate
      if (!(c.homeY > 0.8 && c.homeY <= 5.0)) farBehindWalk++;
      // and his driveway lane must reach a worker standing in the CURB lane (wy 0.8)
      if (DRIVETR_LATERAL + (c.homeY - 0.8) >= DRIVETR_AGGRO_DIST) laneTrap++;
    }
    if (new Set(xs).size !== 3) dupe++;
    for (let i = 1; i < 3; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
    const span = ROUTE_FINISH_X - ROUTE_START_X;
    const thirds = new Set(
      spawned.map((c) => Math.floor(((c.homeX - ROUTE_START_X) / span) * 3)),
    );
    if (thirds.size !== 3) bunched++;
    firstKidMaxFrac = Math.max(firstKidMaxFrac, (xs[0] - ROUTE_START_X) / span);
    worstTailGap = Math.max(worstTailGap, (ROUTE_FINISH_X - xs[2]) / span);
  }
  check("always spawns exactly 3 driveway kids (" + RUNS + " shifts)", not3 === 0, not3 + " violations");
  check("NO kid ever parks outside the walked route (block 1 / block 6 dead drops)",
    onDead === 0, onDead + " violations");
  check("no two kids ever share a driveway", dupe === 0, dupe + " violations");
  check("the three kids cover a route third each (never bunched on one block)", bunched === 0,
    bunched + " bunched shifts");
  check("the closest two kids are still a driveway apart", minGap >= BW, "min gap " + minGap.toFixed(1) + "u");
  check("a kid waits in the OPENING stretch of every shift", firstKidMaxFrac <= 0.34,
    "worst first kid at " + (firstKidMaxFrac * 100).toFixed(0) + "% of the route");
  check("a kid covers the CLOSING stretch too", worstTailGap <= 0.34,
    "best last kid at " + ((1 - worstTailGap) * 100).toFixed(0) + "% of the route");
  check("every driveway on the route gets its turn (nothing is never-rolled)",
    [...used.values()].every((n) => n > 0),
    "least-used " + Math.min(...used.values()) + "x/" + RUNS);
  check("kid parks on the walk edge, inside the sidewalk band (0.8 < wy <= 5.0)",
    farBehindWalk === 0, farBehindWalk + " violations");
  check("the kid's driveway lane reaches a worker in the curb lane (no clamp trap)",
    laneTrap === 0, laneTrap + " violations");
  check("spawn positions are always finite", NaNPos === 0, NaNPos + " violations");
}
check("the spawner keys its candidates off the ROUTE bounds",
  /ROUTE_START_X/.test(spawnBlock) && /ROUTE_FINISH_X/.test(spawnBlock));
{
  // a layout with no driveway inside the corridor must STILL spawn 3 kids (no splice(-1) hole)
  const { spawned } = oneShift(DEAD.length ? DEAD : [ROUTE_START_X - 20]);
  check("layout fallback: still 3 kids when the corridor has no driveway",
    spawned.length === 3 && spawned.every((c) => isFinite(c.homeX)),
    spawned.length + " kids");
  const empty = oneShift([]);
  check("layout fallback: no driveways at all -> zero kids, no crash", empty.spawned.length === 0);
}

// ---- PART 2: run the REAL driveway-tricycle AI (case "tric" in updateCreatures) ----
const fnStart = src.indexOf("function updateCreatures(dt) {");
if (fnStart < 0) throw new Error("updateCreatures not found");
const caseStart = src.indexOf('case "tric": {', fnStart);
if (caseStart < 0) throw new Error('case "tric" not found in updateCreatures');
let ci = src.indexOf("{", caseStart),
  cdepth = 0;
for (; ci < src.length; ci++) {
  if (src[ci] === "{") cdepth++;
  else if (src[ci] === "}") {
    cdepth--;
    if (cdepth === 0) break;
  }
}
const tricCase = src.slice(caseStart, ci + 1);
// ---- the REAL gait the AI animates the rider with, extracted the same way (NOT a stub) ----
// Part 2 exists to prove the kid drives the trike with his LEGS while both fists stay welded
// to the handlebar, so it has to run the game's own animation — a stub could hide an arm swing.
function extractFn(name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error("function " + name + " not found in index.html");
  let i = src.indexOf("{", idx),
    depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}
check("the trike rider has his OWN legs-only gait instead of the pedestrian walk cycle",
  /function animTricPedal/.test(src));
check("the driveway-trike AI animates the rider with animTricPedal and never with animParts",
  /animTricPedal\(/.test(tricCase) && !/animParts\(/.test(tricCase));
const animTricPedal = new Function("return " + extractFn("animTricPedal"))();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const consts = {};
for (const n of ["DRIVETR_CHAIN_R", "DRIVETR_AGGRO_DIST", "DRIVETR_AGGRO_DUR", "DRIVETR_ATK_SP",
  "DRIVETR_HOME_SP", "DRIVETR_HIT_DIST", "DRIVETR_HIT_CD", "DRIVETR_BACKOFF_T",
  "DRIVETR_LATERAL", "HP_HIT_DRIVETRIC"]) consts[n] = numOf(n);
const makeRunner = (deps) => {
  const fn = new Function(
    "c", "dt", "tx", "state", "p", "clamp", "workerMaxY", "hurtNPC", "doStun", "Voice",
    "WORKER_GENDER", ...Object.keys(consts), "animTricPedal", "animParts",
    "switch (c.type){" + tricCase + "}",
  );
  return (c, dt) =>
    fn(c, dt, c.wx - deps.p.wx, deps.state, deps.p, clamp, () => 8.0, deps.hurtNPC,
      deps.doStun, deps.Voice, "male", ...Object.values(consts),
      // the game's real legs-only gait by default (a test may swap in a call-counting stub)
      deps.animTricPedal || animTricPedal,
      (cc, dphase) => { cc.phase += dphase; });
};
const homeY = Number((spawnBlock.match(/dt\.homeY = ([-\d.]+);/) || [])[1]);
check("the spawner parks the kid on the driveway apron at the walk edge",
  isFinite(homeY) && homeY > 0.8 && homeY <= 5.0 && DRIVETR_LATERAL + (homeY - 0.8) < DRIVETR_AGGRO_DIST,
  "homeY=" + homeY);
// A limb pivot, as far as the animation cares about it: it just writes rotation.y.
const limb = () => ({ rotation: { x: 0, y: 0, z: 0 } });
function makeKid(x, y) {
  return {
    type: "tric", isDrivewayTric: true, gender: "male",
    homeX: x, homeY: y, wx: x, wy: y, state: "idle", hitCd: 0, chainR: DRIVETR_CHAIN_R,
    phase: 0, g: { rotation: { z: -Math.PI / 2, x: 0 }, position: { set() {} } },
    parts: { legL: limb(), legR: limb(), armL: limb(), armR: limb() },
  };
}
// A worker walks a straight lane past the driveway at a stroll, 24u of pavement.
function walkLane(laneY, homeX = 10) {
  const voices = [];
  const hits = [];
  const wp = { wx: homeX - 14, wy: laneY, invuln: 0, immuneT: 0 };
  const deps = {
    state: "play", p: wp,
    hurtNPC: (a) => hits.push(a), doStun() {},
    // the recorded distance is kid -> WORKER at the moment the line is said (the tell has to
    // fire well before DRIVETR_HIT_DIST, otherwise it is not a warning, it is a "thank you").
    Voice: { say: (txt, d, pitch, x, y, g, who) => voices.push({ txt, who, d: Math.hypot(x - wp.wx, y - wp.wy) }) },
  };
  const run = makeRunner(deps);
  const c = makeKid(homeX, homeY);
  let minWy = 99, toldBeforeHit = false, tellDist = Infinity;
  // the rider's limb sweep, frame by frame: legs must WORK, arms must sit STILL
  let maxArm = 0, maxLeg = 0;
  for (let f = 0; f < 60 * 8; f++) {
    const before = hits.length;
    run(c, 1 / 60);
    maxArm = Math.max(
      maxArm,
      Math.abs(c.parts.armL.rotation.y),
      Math.abs(c.parts.armR.rotation.y),
    );
    maxLeg = Math.max(maxLeg, Math.abs(c.parts.legL.rotation.y));
    deps.p.wx += 3.5 / 60; // the worker keeps walking down the sidewalk
    minWy = Math.min(minWy, c.wy);
    if (hits.length > before) {
      const tellAt = voices.findIndex((v) => v.who === "kid" && v.txt !== "Stranger Danger!");
      const bumpAt = voices.findIndex((v) => v.txt === "Stranger Danger!");
      if (tellAt >= 0 && (bumpAt < 0 || tellAt < bumpAt)) {
        toldBeforeHit = true;
        tellDist = Math.min(tellDist, voices[tellAt].d);
      }
    }
  }
  return { voices, hits, c, minWy, toldBeforeHit, tellDist, maxArm, maxLeg };
}
{
  const walk = walkLane(1.2); // the normal sidewalk lane
  check("a worker walking the SIDEWALK gets reached — the kid cannot be walked past",
    walk.hits.length > 0, "bumps=" + walk.hits.length);
  // PEDALS, NOT WINDMILL: the kid steers with his hands welded to the grips and drives the
  // trike with his legs. animParts (the pedestrian walk gait) also whips armL/armR around,
  // which made the rider look like he was rowing the thing with his arms.
  check("the rider WORKS THE PEDALS (his legs actually crank while he moves)",
    walk.maxLeg > 0.15, "max leg sweep " + walk.maxLeg.toFixed(2) + " rad");
  check("HIS HANDS STAY ON THE HANDLEBAR (armL/armR never move, not one frame)",
    walk.maxArm === 0, "max arm sweep " + walk.maxArm.toFixed(4) + " rad");
  check("the kid YELLS BEFORE CONTACT (the approach tell)", walk.toldBeforeHit,
    "tell at ~" + (isFinite(walk.tellDist) ? walk.tellDist.toFixed(1) : "?") + "u out");
  check("the tell is a real WARNING (well outside bump range, inside aggro range)",
    isFinite(walk.tellDist) && walk.tellDist >= consts.DRIVETR_HIT_DIST + 1 &&
      walk.tellDist <= consts.DRIVETR_AGGRO_DIST + 0.1,
    "told at " + walk.tellDist.toFixed(2) + "u (bump " + consts.DRIVETR_HIT_DIST + "u / aggro " +
      consts.DRIVETR_AGGRO_DIST + "u)");
  const curb = walkLane(0.95); // hugging the curb — the lane the old build could never touch
  check("a worker hugging the CURB gets reached too (no leash/lateral clamp trap)",
    curb.hits.length > 0, "bumps=" + curb.hits.length);
  check("a chase never crosses into the street (wy >= 0.8)",
    walk.minWy >= 0.8 - 1e-9 && curb.minWy >= 0.8 - 1e-9,
    "min wy " + Math.min(walk.minWy, curb.minWy).toFixed(2));
}
{
  // parked with nobody around: he must FIDGET (never a frozen prop), but stay parked
  const deps = {
    state: "play", p: { wx: -400, wy: 2, invuln: 0, immuneT: 0 },
    hurtNPC() {}, doStun() {}, Voice: { say() {} },
  };
  const run = makeRunner(deps);
  const c = makeKid(10, homeY);
  const xs = [];
  for (let f = 0; f < 60 * 4; f++) {
    run(c, 1 / 60);
    xs.push(c.g.rotation.x);
  }
  const set = new Set(xs.map((v) => v.toFixed(3)));
  const fidget = xs.filter((v) => Math.abs(v) > 0.02).length;
  check("a parked kid is never a statue (he sways where he sits)", fidget >= 60,
    "swaying frames " + fidget + "/" + xs.length);
  check("the parked kid never drifts off his driveway",
    Math.hypot(c.wx - c.homeX, c.wy - c.homeY) < 0.05,
    "drift " + Math.hypot(c.wx - c.homeX, c.wy - c.homeY).toFixed(3));
  check("the sway is a fidget, not a flip",
    Math.max(...set) <= 0.2 && Math.min(...set) >= -0.2,
    "range " + Math.min(...set).toFixed(2) + ".." + Math.max(...set).toFixed(2));
}
{
  // the tell rides a cooldown: a worker loitering in range is not deafened
  const voices = [];
  const deps = {
    state: "play", p: { wx: 11, wy: 1.4, invuln: 999, immuneT: 0 },
    hurtNPC() {}, doStun() {}, Voice: { say: (t, d, p2, x, y, g, who) => voices.push({ txt: t, who }) },
  };
  const run = makeRunner(deps);
  const c = makeKid(10, homeY);
  for (let f = 0; f < 60 * 30; f++) run(c, 1 / 60); // 30s of tantrums
  const tells = voices.filter((v) => v.who === "kid" && v.txt !== "Stranger Danger!").length;
  check("the approach tell rides a cooldown (at least one, never more than 5 in 30s)",
    tells > 0 && tells <= 5, "yells=" + tells);
}
console.log(ok ? "\nTRICYCLE ROUTE CHECKS PASSED" : "\nTRICYCLE ROUTE CHECKS FAILED");
process.exit(ok ? 0 : 1);
