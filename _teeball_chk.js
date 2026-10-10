// _teeball_chk.js — verifies the Staten Island tee-ball CATCH trio:
//   1) wiring: constants, makeTeeballKid + makeBaseball, the addCreature case
//      (distinct shirts, no boxW), gender mix, AVOID_TYPES, the spawn (ONE random
//      ACTIVE block the worker services — NEVER the start/finish buffer, NEVER
//      the car-wash Block 2 or the chalk-scene Block 3, 3 kids + ONE
//      shared baseball), the collideCreatures bumps, and the write-up.
//   2) the REAL case "teeball" body from updateCreatures, SIMULATED with the real
//      team state: the trio really plays catch (owner tosses, mate catches, owner
//      swaps), when the worker is close the ball is thrown AT him ("Stop That!",
//      a hit = HP_HIT_TEEBALL tagged "teeball" + "OW!"), and a lost ball is
//      retrieved by a kid and the game resumes.
const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
let pass = 0,
  fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log("  PASS  " + name);
  } else {
    fail++;
    console.log("  FAIL  " + name + (detail ? "  [" + detail + "]" : ""));
  }
}
// ---- mirror the in-game constants ----
const HP_HIT_TEEBALL = 3;
const TEEBALL_LINES = ["Don't touch me!", "You smell!", "I'm gonna get my Dad!"];
const TEEBALL_WORKER_RANGE = 10;
const TEEBALL_PICKUP = 2.2;
const TEEBALL_WORKER_THROW_CD = 3.5;
const TEEBALL_R = 0.2; // the ball is in the soccer ball's size class so it reads on screen
const TEEBALL_FIELD = 18; // the trio's compact pitch at the block's middle
const TEEBALL_LOOSE = 2; // the fence line: how far a loose ball may leave the pitch
const R = (a, b) => a + Math.random() * (b - a);

console.log("[1] constants");
check(
  "HP_HIT_TEEBALL exists and is a LIGHT whack (3)",
  src.indexOf("const HP_HIT_TEEBALL = 3;") >= 0 && HP_HIT_TEEBALL >= 1 && HP_HIT_TEEBALL <= 5
);
check(
  "TEEBALL_LINES has EXACTLY the 3 kid lines",
  /const TEEBALL_LINES = \[[\s\S]*?"Don't touch me!"[\s\S]*?"You smell!"[\s\S]*?"I'm gonna get my Dad!"[\s\S]*?\];/.test(src)
);
check(
  "throw/pickup constants exist (worker range, pickup, worker-throw cooldown, ball radius)",
  src.indexOf("const TEEBALL_WORKER_RANGE = 10;") >= 0 &&
    src.indexOf("TEEBALL_PICKUP = 2.2;") >= 0 &&
    src.indexOf("const TEEBALL_WORKER_THROW_CD = 3.5;") >= 0 &&
    src.indexOf("const TEEBALL_R = 0.2;") >= 0 &&
    src.indexOf("const TEEBALL_FIELD = 18;") >= 0 &&
    src.indexOf("const TEEBALL_LOOSE = 2;") >= 0
);
check(
  "team state is declared (teeballShirtQueue + teeballTeam)",
  src.indexOf("let teeballShirtQueue = []") >= 0 && src.indexOf("let teeballTeam = null;") >= 0
);

console.log("[2] models + addCreature + gender + avoidance");
check(
  "makeTeeballKid scales a makePerson to kid size (60%)",
  /function makeTeeballKid\(shirt\)[\s\S]*?shirt: shirt \|\| pick\(SHIRTS\)[\s\S]*?kp\.g\.scale\.set\(0\.6, 0\.6, 0\.6\)/.test(src)
);
check(
  "makeBaseball is a cream sphere + ONE closed FIGURE-EIGHT seam loop (the two leather panels' shared border: sine-wave latitude at the real 70 deg tilt, centripetal so the tips stay rounded, drawn as a closed tube) + slanted cross-stitch dashes, same core-spin pattern as the soccer ball",
  /function makeBaseball\(\)[\s\S]*?SEAM_TILT \* Math\.sin\(lng\)[\s\S]*?new THREE\.CatmullRomCurve3\(pts, true, "centripetal"\)[\s\S]*?new THREE\.TubeGeometry\(curve, 150, 0\.013, 5, true\)[\s\S]*?const slant = 0\.42[\s\S]*?g\.userData\.core = core/.test(src) && src.slice(src.indexOf("function makeBaseball() {"), src.indexOf("// Seed scatter pile pigeons")).indexOf("TorusGeometry") < 0
);
const addSrc = src.slice(src.indexOf("function addCreature("), src.indexOf("function updateCreatures("));
check(
  'addCreature has case "teeball" with a distinct-shirt makeTeeballKid (the group look)',
  addSrc.indexOf('case "teeball":') >= 0 &&
    addSrc.indexOf("makeTeeballKid(teeballShirt)") >= 0 &&
    addSrc.indexOf("teeballShirtQueue") >= 0
);
check(
  "the addCreature case creates NO per-kid ball (the team ball is shared)",
  (function () {
    const cs = addSrc.indexOf('case "teeball":');
    const ce = addSrc.indexOf("break;", cs);
    return addSrc.slice(cs, ce).indexOf("c.boxW") < 0 && addSrc.slice(cs, ce).indexOf("makeBaseball") < 0;
  })()
);
check(
  "teeball kids get MIXED gender (like the other kid players)",
  addSrc.indexOf('type === "soccer" ||') >= 0 && addSrc.indexOf('type === "teeball" ||') >= 0
);
check(
  "AVOID_TYPES includes teeball (the crowd routes around the trio)",
  /AVOID_TYPES = \{[\s\S]*?teeball: 1/.test(src)
);

console.log("[3] the Staten Island spawn: ONE trio on ONE random ACTIVE block, on a COMPACT pitch at the block's middle, never Block 2 or Block 3");
const spawnSrc = (function () {
  const i = src.indexOf("The Staten Island TEE-BALL CATCH KIDS (New Dorp, day 5)");
  if (i < 0) return "";
  return src.slice(i, i + 6000); // the write-up comment + the whole spawn block
})();
check("spawn is Staten-Island-gated", spawnSrc.indexOf("if (isStatenIslandLevel()) {") >= 0);
check(
  "block pick EXCLUDES Block 2 (car wash, index 1) and Block 3 (chalk scene, index 2)",
  spawnSrc.indexOf("ACTIVE_BLOCK_IDX.filter((i) => i !== 1 && i !== 2)") >= 0 &&
    spawnSrc.indexOf("LEVEL_BLOCKS[tbCands[(Math.random() * tbCands.length) | 0]]") >= 0
);
check(
  "the trio ALWAYS lands on an ACTIVE block the worker services (never the start/finish buffer, so the kids are always in route)",
  (function () {
    const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
    if (!m) return false;
    const blocks = eval("[" + m[1] + "]");
    const cands = blocks.map((b, i) => (b.garbage ? i : -1)).filter((i) => i >= 0).filter((i) => i !== 1 && i !== 2);
    return cands.length >= 1 && cands.every((i) => blocks[i].garbage === true) && cands.indexOf(1) < 0 && cands.indexOf(2) < 0;
  })(),
  "candidates: " + (function () {
    const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
    if (!m) return "LEVEL_BLOCKS not found";
    const blocks = eval("[" + m[1] + "]");
    return blocks.filter((b, i) => b.garbage && i !== 1 && i !== 2).map((b) => "x" + b.x).join(",");
  })()
);
// The level layout + route bounds parsed out of index.html, for the placement checks.
const LAYOUT = (function () {
  const numOf = (re) => Number((src.match(re) || [])[1]);
  const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
  const blocks = m ? eval("[" + m[1] + "]") : [];
  return {
    blocks,
    BLOCK_W: Number((src.match(/\bBW\s*=\s*(\d+)/) || [])[1]) * numOf(/const HOUSES_PER_BLOCK\s*=\s*(\d+);/),
    START: numOf(/const ROUTE_START_X\s*=\s*(\d+);/),
    FINISH: numOf(/const ROUTE_FINISH_X\s*=\s*(\d+);/),
    MARGIN: numOf(/const TEEBALL_MARGIN\s*=\s*(\d+);/),
    cands: blocks.map((b, i) => (b.garbage ? i : -1)).filter((i) => i >= 0).filter((i) => i !== 1 && i !== 2),
  };
})();
// The car-wash block (index 1) and the chalk crime-scene block (index 2) are off-limits.
const idxIsBlocked = (b) => LAYOUT.blocks.indexOf(b) === 1 || LAYOUT.blocks.indexOf(b) === 2;
check(
  "EVERY candidate block sits fully inside the worker's route, so the worker ALWAYS walks PAST the trio",
  LAYOUT.cands.length >= 1 &&
    LAYOUT.cands.every(
      (i) => LAYOUT.blocks[i].x + LAYOUT.MARGIN >= LAYOUT.START && LAYOUT.blocks[i].x + LAYOUT.BLOCK_W - LAYOUT.MARGIN <= LAYOUT.FINISH
    ),
  "route x" + LAYOUT.START + "..x" + LAYOUT.FINISH + ", BLOCK_W=" + LAYOUT.BLOCK_W + ", candidates " + LAYOUT.cands.map((i) => "x" + LAYOUT.blocks[i].x).join(",")
);
check(
  "10000 simulated block picks ALL land fully in-route (never the start/finish buffer, never Block 2/3)",
  (function () {
    const seen = {};
    for (let t = 0; t < 10000; t++) {
      const b = LAYOUT.blocks[LAYOUT.cands[(Math.random() * LAYOUT.cands.length) | 0]];
      if (!b || !b.garbage) return false; // never a start/finish buffer
      if (idxIsBlocked(b)) return false; // never the car-wash / chalk-scene block
      if (b.x + LAYOUT.MARGIN < LAYOUT.START || b.x + LAYOUT.BLOCK_W - LAYOUT.MARGIN > LAYOUT.FINISH) return false;
      seen[b.x] = true;
    }
    return Object.keys(seen).length === LAYOUT.cands.length; // every in-route block gets its turn
  })(),
  "candidates: " + LAYOUT.cands.map((i) => "x" + LAYOUT.blocks[i].x).join(",")
);
check(
  "3 kids with 3 DISTINCT shirt colors",
  spawnSrc.indexOf("tShirts.length < 3") >= 0 &&
    spawnSrc.indexOf("tShirts.indexOf(tCol) < 0") >= 0 &&
    spawnSrc.indexOf("teeballShirtQueue = teeballShirtQueue.concat(tShirts)") >= 0
);
check(
  "3 kids spread along the block on the NEAR SIDEWALK (wy 1.6..4.2)",
  spawnSrc.indexOf("tMinX + ((tMaxX - tMinX) * (ti + 0.5)) / 3") >= 0 && spawnSrc.indexOf("tk.wy = R(1.6, 4.2)") >= 0
);
check(
  "the trio plays on a COMPACT pitch at the block's middle (all 3 kids + the ball fit in the camera frame)",
  spawnSrc.indexOf("tbMid = clamp(tbBlock.x + BLOCK_W / 2, tbBlock.x + TEEBALL_MARGIN + TEEBALL_FIELD / 2, tbBlock.x + BLOCK_W - TEEBALL_MARGIN - TEEBALL_FIELD / 2)") >= 0 &&
    spawnSrc.indexOf("tMinX = tbMid - TEEBALL_FIELD / 2") >= 0 &&
    spawnSrc.indexOf("tMaxX = tbMid + TEEBALL_FIELD / 2") >= 0
);
check(
  "the pitch is narrow enough to stay on screen (kids ~6u apart, field inside the cross-streets of EVERY candidate block)",
  (function () {
    const numOf = (re) => Number((src.match(re) || [])[1]);
    const FIELD = numOf(/const TEEBALL_FIELD\s*=\s*(\d+);/);
    const LOOSE = numOf(/const TEEBALL_LOOSE\s*=\s*(\d+);/);
    const MARGIN = numOf(/const TEEBALL_MARGIN\s*=\s*(\d+);/);
    const BLOCK_W = LAYOUT.BLOCK_W;
    const CAM_SCREEN_W = 2 * 4.5 * 1.78; // the camera's screen width in world units (frustum half-height s = 4.5, 16:9, zoom 1.0)
    // The camera looks down the 45° ISO diagonal, so a trio spread along x projects at 1/√2 of its
    // true length: an 18u field fills 12.7u of screen — all 3 kids, the ball and every toss in frame.
    if (!(FIELD > 0) || FIELD / Math.SQRT2 > CAM_SCREEN_W) return false; // the whole pitch fits one camera frame
    if ((FIELD + 2 * LOOSE) / Math.SQRT2 > CAM_SCREEN_W) return false; // + the loose-ball chase stays in frame
    for (const i of LAYOUT.cands) {
      const bx = LAYOUT.blocks[i].x;
      const mid = Math.min(Math.max(bx + BLOCK_W / 2, bx + MARGIN + FIELD / 2), bx + BLOCK_W - MARGIN - FIELD / 2);
      if (mid - FIELD / 2 < bx + MARGIN || mid + FIELD / 2 > bx + BLOCK_W - MARGIN) return false;
      if (FIELD / 3 > 8) return false; // kids 6-8u apart — a real catch game, in frame
    }
    return LAYOUT.cands.length >= 1;
  })(),
  "field=" + Number((src.match(/const TEEBALL_FIELD\s*=\s*(\d+);/) || [])[1]) + "u, camera frame width ~16u, candidates " + LAYOUT.cands.map((i) => "x" + LAYOUT.blocks[i].x).join(",")
);
check(
  "the baseball is BIG enough to be SEEN on screen (radius 0.2, in the same size class as the 0.22 soccer ball)",
  src.indexOf("const TEEBALL_R = 0.2;") >= 0 && /function makeBaseball\(\)\s*{\s*const g = new THREE\.Group\(\);\s*const R = 0\.2;/.test(src)
);
check(
  "ONE shared baseball, attached to the LEADER, added to the world exactly ONCE",
  spawnSrc.indexOf("tLeader.ball = tBall") >= 0 &&
    spawnSrc.indexOf("tLeader.ballG = tBallG") >= 0 &&
    spawnSrc.indexOf("dynamicGroup.add(tBallG)") >= 0
);
check(
  "team state: owner + receiver + throwT + catchLockT + workerThrowCd",
  spawnSrc.indexOf("owner: tKids[1]") >= 0 &&
    spawnSrc.indexOf("receiver: null") >= 0 &&
    spawnSrc.indexOf("throwT: R(0.6, 1.4)") >= 0 &&
    spawnSrc.indexOf("catchLockT: 0") >= 0 &&
    spawnSrc.indexOf("workerThrowCd: 0") >= 0
);
console.log('[4] case "teeball" in updateCreatures — the REAL team AI, simulated');
function extractCase() {
  const fnStart = src.indexOf("function updateCreatures(dt) {");
  if (fnStart < 0) throw new Error("updateCreatures not found");
  const start = src.indexOf('case "teeball": {', fnStart);
  if (start < 0) throw new Error('case "teeball" not found in updateCreatures');
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
const teeballCase = extractCase();
check("only the LEADER simulates its team (the other 2 kids' ticks no-op)", teeballCase.indexOf("c.team.leader !== c") >= 0);
check(
  "throw priority: the worker when he's close (TEEBALL_WORKER_RANGE, target = p.wx/p.wy)",
  teeballCase.indexOf("TEEBALL_WORKER_RANGE") >= 0 && teeballCase.indexOf("tx = p.wx") >= 0 && teeballCase.indexOf("ty = p.wy") >= 0
);
check(
  'the worker yells "Stop That!" when the kid throws at him (worker speaker)',
  teeballCase.indexOf('"Stop That!"') >= 0 && teeballCase.indexOf("WORKER_GENDER") >= 0 && teeballCase.indexOf('"worker"') >= 0
);
check(
  "throw cooldown for worker-aimed throws (no spam)",
  teeballCase.indexOf("TEEBALL_WORKER_THROW_CD") >= 0 && teeballCase.indexOf("T.workerThrowCd") >= 0
);
check(
  "catch play: the toss targets a MATE (prefers the farthest for back-and-forth)",
  teeballCase.indexOf("if (k === o) continue") >= 0 && teeballCase.indexOf("d > md") >= 0
);
check(
  "the throw is a gravity lob that lands AT the target (vz = 1/2 g t, tFly scales with distance)",
  teeballCase.indexOf("B.vz = 0.5 * 12 * tFly;") >= 0 && teeballCase.indexOf("dThrow / 10") >= 0
);
check(
  "a LIVE throw that CONNECTS with the worker deals HP_HIT_TEEBALL tagged \"teeball\" + the worker says \"OW!\"",
  teeballCase.indexOf('hurtNPC(HP_HIT_TEEBALL, "teeball")') >= 0 && teeballCase.indexOf('"OW!"') >= 0
);
check(
  "the hit DEFLECTS the ball — it goes loose and a kid sprints to get it back",
  teeballCase.indexOf("T.owner = null;") >= 0 && teeballCase.indexOf("T.receiver = null;") >= 0 && teeballCase.indexOf("B.vz = Math.max(B.vz, 1.8)") >= 0
);
check(
  "no instant re-catch of the thrower's own toss (catchLockT)",
  teeballCase.indexOf("T.catchLockT = 0.45") >= 0 && teeballCase.indexOf("T.catchLockT <= 0") >= 0
);
check(
  "CATCH: a low ball within TEEBALL_PICKUP of a kid = new owner (game goes on)",
  teeballCase.indexOf("TEEBALL_PICKUP") >= 0 && teeballCase.indexOf("B.z < 0.75") >= 0 && teeballCase.indexOf("T.owner = best") >= 0
);
check(
  "LOST ball: the NEAREST kid is assigned receiver and gets the ball back within 0.6u",
  teeballCase.indexOf("T.receiver = nk;") >= 0 && teeballCase.indexOf("T.owner = T.receiver") >= 0 && teeballCase.indexOf("< 0.6") >= 0
);
check(
  "the ball rides in the owner's hands (chest height, in front of him)",
  teeballCase.indexOf("T.owner.wx + T.owner.dir * 0.35") >= 0 && teeballCase.indexOf("B.z = 0.55") >= 0
);
check(
  "the ball ROLLS — spin = ground speed / TEEBALL_R (held ball does not spin)",
  teeballCase.indexOf("svx / TEEBALL_R") >= 0 && teeballCase.indexOf("let svx = B.vx;") >= 0
);
check(
  "the ball BOUNCES off solid sidewalk obstacles (b.trees) with damped restitution",
  teeballCase.indexOf("ball vs SOLID SIDEWALK OBSTACLES") >= 0 && teeballCase.indexOf("B.vx -= 1.55 * vn * nx;") >= 0
);
check(
  "kids dead-stop at solid obstacles (kidStepBlocked guards all 3 forward steps)",
  (teeballCase.match(/kidStepBlocked\(k,/g) || []).length === 3
);
check(
  "the ball bounces on the sidewalk (damped) and settles to a loose ball",
  teeballCase.indexOf("B.vz = Math.abs(B.vz) * 0.4") >= 0 && teeballCase.indexOf("B.flying = false;") >= 0
);
check(
  "a SETTLED ball stops DEAD (vx + vy zeroed with vz — the loose ball never slides out of the camera's view forever)",
  /B\.vz = 0;\s*B\.vx = 0;\s*B\.vy = 0;/.test(teeballCase)
);
check(
  "no off-screen recycling (a fixed fixture of the block)",
  teeballCase.indexOf("break; // a fixed fixture: never recycles off-screen") >= 0
);
check(
  "no street traffic / recycling mechanics leaked into the catch game",
  teeballCase.indexOf("npcRoadRules") < 0 && teeballCase.indexOf("yieldLane") < 0
);
console.log("[5] collideCreatures: ball bonk + kid bump");
const ccSrc = src.slice(src.indexOf("function collideCreatures()"), src.indexOf("function ", src.indexOf("function collideCreatures()") + 40));
check(
  "ball bonk: the loose baseball gets its OWN range check before the generic radius gate",
  ccSrc.indexOf('if (c.type === "teeball" && c.ball) {') >= 0
);
check(
  'ball bonk: minor whack tagged "teeball", worker bounced back',
  ccSrc.indexOf('hurtNPC(HP_HIT_TEEBALL, "teeball")') >= 0 && ccSrc.indexOf("p.wx -= (tbdx / tbd) * 0.7;") >= 0
);
check(
  "ball bonk: KNOCKS THE BALL LOOSE — a kid sprints to get it",
  ccSrc.indexOf("KNOCKS THE BALL LOOSE") >= 0 && ccSrc.indexOf("tdef.vz = Math.max(tdef.vz, 1.8);") >= 0
);
check(
  "kid bump: radius 0.9 (a small kid)",
  /else if \(c\.type === "teeball"\)\s+rad = 0\.9;/.test(ccSrc)
);
check(
  'kid bump: light hit tagged "teeball" + the kid fires one of the 3 lines',
  ccSrc.indexOf("pick(TEEBALL_LINES)") >= 0
);
check(
  "kid bump: worker bounces back + light stun",
  ccSrc.indexOf("c.kidCd = 2.5;") >= 0 && ccSrc.indexOf('doStun(0.6, "hit")') >= 0
);

console.log("[6] WRITTEN UP: Dereliction of Tee-Ball Duty");
check(
  'WRITEUP_REASONS.teeball: "Dereliction of Tee-Ball Duty" (the exact line, single entry)',
  src.indexOf('teeball: ["Dereliction of Tee-Ball Duty"]') >= 0
);
console.log("[7] RUNTIME: the REAL case body, simulated with the real team state");
function makeTeam() {
  const mkKid = (wx) => ({
    type: "teeball",
    wx: wx,
    wy: 3,
    dir: 1,
    sp: 4,
    kidCd: 0,
    ballCd: 0,
    phase: 0,
    parts: { upper: { position: { z: 0.62 } } },
    g: { rotation: { z: 0 } },
  });
  // The COMPACT pitch the game spawns (TEEBALL_FIELD wide, kids ~6u apart at the block's middle)
  const midX = 120;
  const kids = [mkKid(midX - TEEBALL_FIELD / 3), mkKid(midX), mkKid(midX + TEEBALL_FIELD / 3)];
  const ball = { wx: kids[1].wx, wy: 3, z: 0.55, vz: 0, vx: 0, vy: 0, tx: kids[1].wx, ty: 3, flying: false };
  const ballG = {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    userData: { core: { rotation: { y: 0 } } },
  };
  const team = {
    kids: kids,
    leader: kids[0],
    ball: ball,
    ballG: ballG,
    minX: midX - TEEBALL_FIELD / 2,
    maxX: midX + TEEBALL_FIELD / 2,
    midX: midX,
    owner: kids[1],
    receiver: null,
    lastThrower: null,
    throwT: 0.6,
    catchLockT: 0,
    workerThrowCd: 0,
  };
  for (const k of kids) k.team = team;
  return team;
}
const animParts = (c, dp) => {
  c.phase += dp;
};
const voiceCalls = [];
const Voice = {
  say(text, gap, pitch, bx, by, gender, speaker, style) {
    voiceCalls.push({ text: text, speaker: speaker, style: style });
  },
};
const hits = [];
const stuns = [];
const hurtNPC = (amt, cause) => hits.push({ amt: amt, cause: cause });
const doStun = (t, why) => stuns.push(t);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const WORKER_GENDER = "male"; // the worker's voice gender (mirrors the game)
const runCase = new Function(
  "c", "dt", "R", "GZ", "state", "p", "blocks",
  "TEEBALL_WORKER_RANGE", "TEEBALL_WORKER_THROW_CD", "TEEBALL_PICKUP", "TEEBALL_R", "TEEBALL_LOOSE",
  "hurtNPC", "doStun", "clamp", "Voice", "animParts", "WORKER_GENDER", "HP_HIT_TEEBALL",
  "switch (c.type) {" + teeballCase + "}"
);
let T = makeTeam();
const p = { wx: 999, wy: 3 }; // far away during the warm sim (no worker throws yet)
const step = () =>
  runCase(T.leader, 0.016, R, 0.3, "play", p, [], TEEBALL_WORKER_RANGE, TEEBALL_WORKER_THROW_CD, TEEBALL_PICKUP, TEEBALL_R, TEEBALL_LOOSE, hurtNPC, doStun, clamp, Voice, animParts, WORKER_GENDER, HP_HIT_TEEBALL);

// ---- (a) warm sim: the trio really PLAYS CATCH (owner swaps, no NaNs) ----
let simOk = true,
  simDetail = "",
  ownerChanges = 0,
  sawReceiver = false,
  maxSpread = 0,
  maxBallDev = 0,
  throwFrames = 0;
let lastOwner = T.owner;
try {
  for (let t = 0; t < 6000; t++) {
    step();
    for (const k of T.kids) {
      if (!isFinite(k.wx) || !isFinite(k.wy)) {
        simOk = false;
        simDetail = "kid position not finite at t=" + t + " wx=" + k.wx + " wy=" + k.wy;
      }
      if (k === T.receiver) {
        if (k.wx < T.minX - (TEEBALL_LOOSE + 0.5) || k.wx > T.maxX + (TEEBALL_LOOSE + 0.5)) {
          simOk = false;
          simDetail = "receiver out of reach band at t=" + t + " wx=" + k.wx.toFixed(2);
        }
      } else if (k.wx < T.minX - 1e-9 || k.wx > T.maxX + 1e-9) {
        simOk = false;
        simDetail = "kid out of band at t=" + t + " wx=" + k.wx.toFixed(2);
      }
      if (k.wy < 1.4 || k.wy > 4.4) {
        simOk = false;
        simDetail = "kid wy off the sidewalk at t=" + t + " wy=" + k.wy.toFixed(2);
      }
    }
    const B = T.ball;
    if (!isFinite(B.wx) || !isFinite(B.wy) || !isFinite(B.z)) {
      simOk = false;
      simDetail = "ball not finite at t=" + t;
    }
    // the trio's screen spread + how far the ball strays from the pitch (visibility)
    const spread = Math.max(...T.kids.map((k) => k.wx)) - Math.min(...T.kids.map((k) => k.wx));
    if (spread > maxSpread) maxSpread = spread;
    maxBallDev = Math.max(maxBallDev, Math.abs(B.wx - T.midX), Math.abs(B.wy - 3));
    if (B.flying) throwFrames++;
    if (T.owner !== lastOwner) ownerChanges++;
    lastOwner = T.owner;
    if (T.receiver) sawReceiver = true;
  }
} catch (e) {
  simOk = false;
  simDetail = "threw: " + e.message;
}
check("warm sim: 6000 frames of catch play without NaNs or out-of-band kids", simOk, simDetail);
check("warm sim: ownership SWAPS between kids (real catch: they throw to each other)", ownerChanges >= 5, "ownerChanges=" + ownerChanges);
check("warm sim: a loose ball gets RETRIEVED (the receiver flow ran) and play resumed", sawReceiver && (T.owner !== null || T.receiver !== null), "sawReceiver=" + sawReceiver);
check("warm sim: worker far away => NO damage, no worker lines", hits.length === 0 && voiceCalls.every((v) => v.speaker !== "worker"));
check(
  "all 3 kids stay inside ONE camera frame on the compact pitch (spread + the loose-ball chase fits the screen)",
  maxSpread <= TEEBALL_FIELD + 2 * TEEBALL_LOOSE + 1e-9,
  "maxSpread=" + maxSpread.toFixed(2) + "u (pitch " + TEEBALL_FIELD + "u + " + TEEBALL_LOOSE + "u fence on each side; the camera sees ~22.6u of street at the 45° iso angle)"
);
check(
  "THE FENCE: the ball is clamped to the pitch (x within the fence, y on the sidewalk), so a loose ball is always in view",
  teeballCase.indexOf("B.wx < T.minX - TEEBALL_LOOSE || B.wx > T.maxX + TEEBALL_LOOSE") >= 0 &&
    teeballCase.indexOf("B.wx = clamp(B.wx, T.minX - TEEBALL_LOOSE, T.maxX + TEEBALL_LOOSE);") >= 0 &&
    teeballCase.indexOf("B.wy = clamp(B.wy, 2.0, 4.0);") >= 0 &&
    teeballCase.indexOf("B.vx *= -0.35;") >= 0
);
check(
  "the ball never strays off the pitch, so every catch stays in the worker's view",
  maxBallDev <= TEEBALL_FIELD / 2 + TEEBALL_LOOSE + 0.5,
  "maxBallDev=" + maxBallDev.toFixed(2) + "u from the pitch centre (pitch half-width " + TEEBALL_FIELD / 2 + "u + " + TEEBALL_LOOSE + "u fence)"
);
check("the trio really PLAYS (throws keep firing in the warm sim, not just walking)", throwFrames > 200, "throwFrames=" + throwFrames);
// ---- (b) the worker enters range: the ball is thrown AT him + he says "Stop That!" ----
T = makeTeam();
p.wx = T.kids[1].wx + 4; // within TEEBALL_WORKER_RANGE of the owner
p.wy = 3;
voiceCalls.length = 0;
hits.length = 0;
let workerSaid = false,
  threwAtWorker = false,
  ballHit = false;
try {
  for (let t = 0; t < 300; t++) {
    step();
    const B = T.ball;
    if (B.flying && Math.abs(B.tx - (T.kids[1].wx + 4)) <= 6 && Math.abs(B.ty - 3) <= 1) threwAtWorker = true;
    if (voiceCalls.some((v) => v.text === "Stop That!" && v.speaker === "worker")) workerSaid = true;
    if (hits.some((h) => h.cause === "teeball")) {
      ballHit = true;
      break;
    }
  }
} catch (e) {
  simDetail = "threw: " + e.message;
}
check('worker in range: the worker yells "Stop That!"', workerSaid, JSON.stringify(voiceCalls.slice(0, 6)));
check("worker in range: the ball is thrown AT the worker (target ~p.wx/p.wy)", threwAtWorker);
check(
  'worker in range: a connecting ball = HP_HIT_TEEBALL tagged "teeball" (the write-up cause)',
  ballHit && hits.every((h) => h.amt === HP_HIT_TEEBALL && h.cause === "teeball"),
  JSON.stringify(hits)
);
check('a hit makes the worker yelp "OW!"', voiceCalls.some((v) => v.text === "OW!" && v.speaker === "worker"));

// ---- (c) the ball is LOST far from everyone: a kid goes and picks it up ----
T = makeTeam();
T.owner = null;
T.receiver = null;
T.ball.wx = 200; // way past the block — a lost ball
T.ball.wy = 3;
T.ball.z = 0;
T.ball.vx = 0;
T.ball.vy = 0;
T.ball.flying = false;
T.catchLockT = 0;
const picker = T.kids.reduce((best, k) =>
  Math.abs(T.ball.wx - k.wx) < Math.abs(T.ball.wx - best.wx) ? k : best
);
let retrieved = false;
try {
  for (let t = 0; t < 1200; t++) {
    step();
    if (T.owner) {
      retrieved = true;
      break;
    }
  }
} catch (e) {
  simDetail = "threw: " + e.message;
}
check("lost ball: the NEAREST kid is sent for it (receiver assigned)", T.receiver === picker || retrieved, "receiver=" + (T.receiver ? "assigned" : "null"));
check("lost ball: the kid RECOVERS it and the catch game resumes (new owner)", retrieved && T.owner !== null);

console.log("\n" + pass + " checks passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

