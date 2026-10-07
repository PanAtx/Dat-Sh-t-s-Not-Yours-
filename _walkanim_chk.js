// _walkanim_chk.js — verify the cop/robber WALK CYCLE drives the legs/arms/bob.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
const big = blocks.reduce((a, b) => (b.length > a.length ? b : a), "");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("PASS - " + m); } else { fail++; console.log("FAIL - " + m); } }

function extractFn(name) {
  const start = big.indexOf("function " + name + "(");
  if (start < 0) return null;
  let i = big.indexOf("{", start), depth = 0;
  for (let j = i; j < big.length; j++) {
    if (big[j] === "{") depth++;
    else if (big[j] === "}") { depth--; if (depth === 0) return big.slice(start, j + 1); }
  }
  return null;
}
function numConst(n) { const m = big.match(new RegExp("const " + n + " = ([0-9.]+);")); return m ? parseFloat(m[1]) : null; }
function lineArray(n) { const m = big.match(new RegExp("const " + n + " = \\[[\\s\\S]*?\\];")); if (!m) return null; const qs = m[0].match(/"([^"]*)"/g); return qs ? qs.map((s) => s.slice(1, -1)) : null; }

const GZ = -0.015;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (a) => a[(Math.random() * a.length) | 0];
const R = (a, b) => a + Math.random() * (b - a);
const Voice = { say() {} };
const dynamicGroup = { add() {}, remove() {} };
const THREE = {
  MeshLambertMaterial: (o) => o,
  // minimal Group so code paths that build leaf puffs / muzzle flashes don't throw under node
  Group: function () {
    return {
      position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, set() { return this; } },
      add() { return this; },
      remove() { return this; },
      children: [],
      userData: {},
    };
  },
};
const BX = () => ({ position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } }, rotation: { x: 0, y: 0, z: 0 } });
const MS = (c, o) => o || {};
const M = (c) => ({});
let state = "play";
let p = null;
const dustParticles = [];
const SFX = { playGunshot() {} };

const constsSrc =
  "const GUN_MISS_MIN=" + numConst("GUN_MISS_MIN") + ";const GUN_MISS_MAX=" + numConst("GUN_MISS_MAX") + ";" +
  "const GUN_SHOT_SP=" + numConst("GUN_SHOT_SP") + ";const GUN_SHOT_LIFE=1.5;const GUN_SHOT_Z=" + numConst("GUN_SHOT_Z") + ";" +
  "const GUN_HURT_R=" + numConst("GUN_HURT_R") + ";const GUN_STUN=0.55;const GUN_AIM_T=" + numConst("GUN_AIM_T") + ";" +
  "const GUN_TURN_CD_MIN=" + numConst("GUN_TURN_CD_MIN") + ";const GUN_TURN_CD_MAX=" + numConst("GUN_TURN_CD_MAX") + ";" +
  "const GUN_CHASE_SP=" + numConst("GUN_CHASE_SP") + ";const GUN_RETREAT_SP=" + numConst("GUN_RETREAT_SP") + ";" +
  "const GUN_RUN_SP=" + numConst("GUN_RUN_SP") + ";const GUN_RUN_STEP_MIN=" + numConst("GUN_RUN_STEP_MIN") + ";const GUN_DUCK_T=" + numConst("GUN_DUCK_T") + ";" +
  "const GUN_CHASE_GAP=6;const GUN_EDGE_PAD=5;const GUN_AGGRO_R=" + numConst("GUN_AGGRO_R") + ";" +
  "const HP_HIT_BULLET=" + numConst("HP_HIT_BULLET") + ";" +
  "const COP_SHOUT_LINES=" + JSON.stringify(lineArray("COP_SHOUT_LINES")) + ";" +
  "const ROBBER_LINES=" + JSON.stringify(lineArray("ROBBER_LINES")) + ";" +
  "const BULLET_HIT_LINES=" + JSON.stringify(lineArray("BULLET_HIT_LINES")) + ";" +
  "const PLAYER_SPEED=8.5;" +
  "function bedStuyCoverSpots(blockX){ return [ {wx:92,wy:1.2,kind:'hydrant'},{wx:98,wy:3.4,kind:'tree'},{wx:104,wy:2.0,kind:'can'},{wx:110,wy:3.8,kind:'tree'},{wx:116,wy:1.6,kind:'hydrant'},{wx:122,wy:3.2,kind:'can'},{wx:128,wy:2.4,kind:'tree'} ]; }";

const runner = new Function(
  "Voice", "pick", "R", "clamp", "hurtNPC", "doStun", "spawnDustEffect", "dropBloodSplatter", "workerMaxY", "WORKER_GENDER", "dynamicGroup", "BX", "MS", "M", "THREE", "dustParticles", "SFX", "GZ",
  constsSrc + "\n" + extractFn("fireGun") + "\n" + extractFn("updateGunshots") + "\n" + extractFn("addCoverScorch") + "\n" + extractFn("spawnLeafPuff") + "\n" + extractFn("gunNextCoverSpot") + "\n" + extractFn("gunStepToward") + "\n" + extractFn("gunfightAI") +
  "\nreturn function(c, pp, dt, st){ state=st; p=pp; gunfightAI(c, dt, p); };",
)(Voice, pick, R, clamp, () => {}, () => {}, () => {}, () => {}, () => 4.5, "male", dynamicGroup, BX, MS, M, THREE, dustParticles, SFX, GZ);

function partsMock() {
  const knee = () => ({ rotation: { x: 0, y: 0, z: 0 } });
  const pv = () => ({ rotation: { x: 0, y: 0, z: 0 }, userData: { knee: knee() } });
  return { legL: pv(), legR: pv(), armL: pv(), armR: pv(), upper: { rotation: { x: 0, y: 0, z: 0 } } };
}
function shooter(tag, wx, wy, side) {
  return {
    type: tag, gunTag: tag, side, wx, wy, homeX: wx, homeY: wy, coverX: wx, coverY: wy,
    blockMinX: wx - 30, blockMaxX: wx + 30, sp: 0, mode: "cover", gunCd: 0.5, aimT: 0, shots: [],
    flashT: 0, touchCd: 0, sayCd: 9, phase: 1, gender: "male", foe: null, duel: null, duckT: 0, coverCd: 999,
    parts: partsMock(), flash: { visible: false }, g: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
  };
}
const cop = shooter("cop", 100, 1.5, -1);
const rob = shooter("robber", 112, 2.5, 1);
cop.foe = rob; rob.foe = cop;
const duel = { turn: "cop" }; cop.duel = duel; rob.duel = duel;
p = { wx: 106, wy: 2.0, bloodSteps: 0 };

// Run 700 ticks; the cop chases (moves), so his legs should PUMP (opposite swing) + body bob.
let sawPump = false, sawOpposite = false, sawBob = false;
for (let i = 0; i < 700; i++) {
  runner(cop, p, 0.05, "play");
  runner(rob, p, 0.05, "play");
  const ll = cop.parts.legL.rotation.x, lr = cop.parts.legR.rotation.x;
  if (Math.abs(ll) > 0.15 || Math.abs(lr) > 0.15) sawPump = true;
  if (ll * lr < -0.02) sawOpposite = true; // legs swing in opposite directions = a real stride
  if (Math.abs(cop.g.position.z - GZ) > 0.005) sawBob = true; // body lifted off GZ = a stride hop
}
ok(sawPump, "the cop's LEGS pump (rotation.x > 0.15) while he walks up the block");
ok(sawOpposite, "the cop's legs swing in OPPOSITE directions (legL vs legR) - a real stride, not a slide");
ok(sawBob, "the cop's BODY bobs off GZ while walking (feet read as stepping)");

// Robber off-arm should swing for balance while he retreats.
let robArm = false;
for (let i = 0; i < 300; i++) { runner(rob, p, 0.05, "play"); if (Math.abs(rob.parts.armL.rotation.y) > 0.1) robArm = true; }
ok(robArm, "the robber's OFF-ARM swings for balance while he retreats");

// A SETTLED shooter (no movement) should CROUCH (bent knees), not stand flat.
const c2 = shooter("cop", 100, 1.5, -1);
c2._pwx = 100; c2._pwy = 1.5; // already settled at this spot -> sf = 0 -> crouch
p = { wx: 106, wy: 2.0, bloodSteps: 0 };
for (let i = 0; i < 40; i++) runner(c2, p, 0.05, "play");
ok(c2.parts.legL.rotation.y > 0.4 && c2.parts.legR.rotation.y > 0.8, "a SETTLED shooter KNEELS: the legs FOLD FORWARD (legL.rotation.y " + c2.parts.legL.rotation.y.toFixed(2) + " > 0.4, legR.rotation.y " + c2.parts.legR.rotation.y.toFixed(2) + " > 0.8) into a brace, not a sideways split");
ok(c2.parts.legL.userData.knee.rotation.y < -0.5 && c2.parts.legR.userData.knee.rotation.y < -0.8, "a SETTLED shooter BENDS BOTH KNEES (legL.knee.y " + c2.parts.legL.userData.knee.rotation.y.toFixed(2) + ", legR.knee.y " + c2.parts.legR.userData.knee.rotation.y.toFixed(2) + ") - a real knee fold, not a rigid plank");
ok(c2.parts.upper.rotation.x < 0.2 && c2.parts.upper.rotation.y < 0.15, "a settled shooter's TORSO is STRAIGHT (upper.x " + c2.parts.upper.rotation.x.toFixed(2) + ", upper.y " + c2.parts.upper.rotation.y.toFixed(2) + ") - no forward lean / sideways tip (the old \"about to tip over\")");
ok(c2.g.position.z < GZ - 0.1, "a settled shooter sits LOW in the kneeling brace (z " + c2.g.position.z.toFixed(2) + " < GZ " + GZ + " - the body is lower to the ground)");

console.log("\n" + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);