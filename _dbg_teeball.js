const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
const anchor = src.indexOf("The Staten Island TEE-BALL CATCH KIDS (New Dorp, day 5)");
for (const n of [4200, 5200, 6200]) {
  console.log("spawn slice", n, "owner idx:", src.slice(anchor, anchor + n).indexOf("owner: tKids[1]"));
}
const ccStart = src.indexOf("function collideCreatures()");
const j = src.indexOf('c.type === "teeball")', ccStart);
console.log("radius snippet:", JSON.stringify(src.slice(j - 30, j + 60)));
// ---- debug scenario (b) ----
const R = (a, b) => a + Math.random() * (b - a);
function extractCase() {
  const fnStart = src.indexOf("function updateCreatures(dt) {");
  const start = src.indexOf('case "teeball": {', fnStart);
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
function makeTeam() {
  const mkKid = (wx) => ({ type: "teeball", wx: wx, wy: 3, dir: 1, sp: 4, kidCd: 0, ballCd: 0, phase: 0, parts: { upper: { position: { z: 0.62 } } }, g: { rotation: { z: 0 } } });
  const kids = [mkKid(100), mkKid(120), mkKid(140)];
  const ball = { wx: 120, wy: 3, z: 0.55, vz: 0, vx: 0, vy: 0, tx: 120, ty: 3, flying: false };
  const ballG = { position: { x: 0, y: 0, z: 0, set() {} }, userData: { core: { rotation: { y: 0 } } } };
  const team = { kids, leader: kids[0], ball, ballG, minX: 90, maxX: 150, midX: 120, owner: kids[1], receiver: null, lastThrower: null, throwT: 0.6, catchLockT: 0, workerThrowCd: 0 };
  for (const k of kids) k.team = team;
  return team;
}
const voice = [];
const Voice = { say(t, g, p2, x, y, gd, sp, st) { voice.push({ t, sp }); } };
const hits = [];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const runCase = new Function(
  "c", "dt", "R", "GZ", "state", "p", "blocks",
  "TEEBALL_WORKER_RANGE", "TEEBALL_WORKER_THROW_CD", "TEEBALL_PICKUP", "TEEBALL_R",
  "hurtNPC", "doStun", "clamp", "Voice", "animParts", "WORKER_GENDER", "HP_HIT_TEEBALL",
  "switch (c.type) {" + teeballCase + "}"
);
const animParts = (c, dp) => { c.phase += dp; };
let T = makeTeam();
const p = { wx: T.kids[1].wx + 4, wy: 3 };
let sawThrow = false;
for (let t = 0; t < 300; t++) {
  const before = T.ball.flying;
  runCase(T.leader, 0.016, R, 0.3, "play", p, [], 10, 3.5, 2.2, 0.16, (a, c2) => hits.push([a, c2]), () => {}, clamp, Voice, animParts, "male", 3);
  if (T.ball.flying) sawThrow = true;
  if (sawThrow && t < 80)
    console.log(
      "t=" + t,
      "before=" + before,
      "after=" + T.ball.flying,
      "owner=" + (T.owner ? "Y" : "n"),
      "recv=" + (T.receiver ? "Y" : "n"),
      "B=" + T.ball.wx.toFixed(2) + "," + T.ball.wy.toFixed(2),
      "z=" + T.ball.z.toFixed(3),
      "vx=" + T.ball.vx.toFixed(2),
      "tx=" + T.ball.tx.toFixed(2),
      "lock=" + T.catchLockT.toFixed(2),
      "k1=" + T.kids[1].wx.toFixed(2),
      "hit=" + hits.length,
      "voice=" + voice.map((v) => v.t).join("|")
    );
  if (hits.length > 0 || t > 80) break;
}
console.log("voice:", JSON.stringify(voice), "hits:", JSON.stringify(hits));

// ---- warm sim: find the frame where a kid's wy jumps off the sidewalk ----
T = makeTeam();
p.wx = 999; // far away, pure catch play
let frames = 0;
while (frames < 6000) {
  try {
    runCase(T.leader, 0.016, R, 0.3, "play", p, [], 10, 3.5, 2.2, 0.16, (a, c2) => hits.push([a, c2]), () => {}, clamp, Voice, animParts, "male", 3);
  } catch (e) { console.log("THREW at frame", frames, e.message); break; }
  frames++;
  const badKid = T.kids.find((k) => k.wy > 5.0 || k.wy < 0.8);
  if (badKid) {
    console.log(
      "JUMP at frame", frames,
      "| kid wy", badKid.wy.toFixed(2),
      "| ball wy", T.ball.wy.toFixed(2),
      "| owner", T.owner ? T.owner.wy.toFixed(2) : "null",
      "| recv", T.receiver ? T.receiver.wy.toFixed(2) : "null",
      "| kid isRecv", badKid === T.receiver,
      "| ball flying", T.ball.flying,
      "| kid wx", badKid.wx.toFixed(2),
    );
    break;
  }
}
console.log("warm sim frames:", frames, "max kid wy:", Math.max(...T.kids.map((k) => k.wy)).toFixed(2));
