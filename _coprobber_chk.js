// _coprobber_chk.js — Bed-Stuy SHOOTOUT (NYPD cop vs masked robber): models + AI + bullets + write-up.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
const big = blocks.reduce((a, b) => (b.length > a.length ? b : a), "");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("PASS - " + m); } else { fail++; console.log("FAIL - " + m); } }

// ---------- THREE + helper stubs (same recipe as _rapper_chk.js) ----------
function vec(x, y, z) { return { x: x, y: y, z: z, set(a, b, c2) { this.x = a; this.y = b; this.z = c2; return this; } }; }
function OBJ() { this.position = vec(0, 0, 0); this.rotation = vec(0, 0, 0); this.scale = vec(1, 1, 1); this.children = []; this.userData = {}; }
OBJ.prototype.add = function (c) { this.children.push(c); return this; };
OBJ.prototype.remove = function (c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; };
const THREE = { Group: OBJ, Object3D: OBJ };
THREE.Mesh = function (g, m) { const o = new OBJ(); o.geometry = g; o.material = m; return o; };
THREE.BoxGeometry = THREE.SphereGeometry = THREE.CircleGeometry = THREE.TorusGeometry = THREE.CylinderGeometry = THREE.PlaneGeometry = THREE.ConeGeometry = function () { return {}; };
const _col = (h) => ({ v: h, set(v) { this.v = v; return this; } });
const M = (c) => ({ _hex: c, color: _col(c) });
const MS = (c, o) => Object.assign({ _hex: c, color: _col(c) }, o);
const pick = (a) => a[(Math.random() * a.length) | 0];
const R = (a, b) => a + Math.random() * (b - a);
const GZ = -0.015;
const SKIN_TONES = [0xf7d6b8, 0xe9b48f, 0xc98a5e, 0x9c6a44, 0x5c3a26];
const MATT_COLORS = [["#555", 0.9, 0.5], ["#8a4a1f", 0.75, 0.4], ["#333", 0.9, 0.3], ["#6b3f2a", 0.8, 0.4], ["#444", 0.85, 0.5]];
const HAIR_TONES = [0x2a1d12, 0x14100c, 0x3a2a1a];
const PANTS = [0x2a2e4a, 0x3a3f2f, 0x4a2e2a, 0x555555, 0x1f2a2e];
const SHIRT = [0x5a2a2a, 0x2a5a52, 0x556633, 0x777777, 0x333333, 0x9b8f5f, 0x222222];
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const SP = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
const CY = (a, b, c2, m) => new THREE.Mesh(new THREE.CylinderGeometry(a, b, c2), m);
const WORKER_GENDER = "male";

// ---------- build the models with the REAL makePerson + makeCopOfficer + makeMaskedRobber ----------
function sliceBetween(src, startRe, endRe) {
  const s = src.search(startRe);
  if (s < 0) return null;
  const e = src.slice(s).search(endRe);
  return e < 0 ? null : src.slice(s, s + e);
}
const mpSrc = sliceBetween(big, /function makePerson\(/, /function makeMafiaGuy\(\)/);
const copSrc = sliceBetween(big, /function addKnees\(/, /function makeHooker\(\)/);
ok(!!mpSrc && !!copSrc, "extracted makePerson + makeCopOfficer + makeMaskedRobber from index.html");
let built = null, modelErr = null;
try {
  const buildModels = new Function("THREE", "M", "MS", "BX", "SP", "CY", "pick", "R", "GZ", "SKIN_TONES", "MATT_COLORS", "HAIR_TONES", "PANTS", "SHIRT", mpSrc + "\n" + copSrc + "\nreturn { cop: makeCopOfficer(), rob: makeMaskedRobber() };");
  built = buildModels(THREE, M, MS, BX, SP, CY, pick, R, GZ, SKIN_TONES, MATT_COLORS, HAIR_TONES, PANTS, SHIRT);
} catch (e) { modelErr = e; }
ok(!modelErr, "makeCopOfficer() + makeMaskedRobber() build without error" + (modelErr ? " (" + modelErr.message + ")" : ""));
if (built) {
  const cop = built.cop, rob = built.rob;
  ok(!!cop.g.userData.parts && cop.g.userData.parts.upper && cop.g.userData.parts.armR, "cop model exposes parts pivots");
  ok(!!cop.g.userData.gun, "cop has a gun handle (revolver)");
  ok(!!cop.g.userData.flash && cop.g.userData.flash.visible === false, "cop muzzle flash starts hidden");
  ok(!!cop.g.userData.cap && cop.g.userData.cap.children.length === 3, "patrol cap = crown+brim+gold shield (got " + (cop.g.userData.cap ? cop.g.userData.cap.children.length : 0) + ")");
  ok(!!cop.g.userData.badge, "silver chest badge exists");
  ok(!!rob.g.userData.mask, "robber has a ski-mask handle");
  ok(!!rob.g.userData.mask && rob.g.userData.mask.children.length >= 4, "ski mask = balaclava+eye slot+2 eyes (got " + (rob.g.userData.mask ? rob.g.userData.mask.children.length : 0) + ")");
  ok(!!rob.g.userData.sack && rob.g.userData.sack.children.length === 3, "loot sack = bag+$ patch+strap (got " + (rob.g.userData.sack ? rob.g.userData.sack.children.length : 0) + ")");
  ok(!!rob.g.userData.gun, "robber has a gun handle (pistol)");
  ok(!!rob.g.userData.flash && rob.g.userData.flash.visible === false, "robber muzzle flash starts hidden");
}

// ---------- constants + dialogue pools ----------
function numConst(name) {
  const m = big.match(new RegExp("const " + name + " = ([0-9.]+);"));
  return m ? parseFloat(m[1]) : null;
}
function lineArray(name) {
  const m = big.match(new RegExp("const " + name + " = \\[[\\s\\S]*?\\];"));
  if (!m) return null;
  const qs = m[0].match(/"([^"]*)"/g);
  return qs ? qs.map((s) => s.slice(1, -1)) : null;
}
const C = {
  HP_BULLET: numConst("HP_HIT_BULLET"),
  HP_TOUCH: numConst("HP_HIT_SHOOTOUT_TOUCH"),
  MISS_MIN: numConst("GUN_MISS_MIN"),
  MISS_MAX: numConst("GUN_MISS_MAX"),
  GUN_SP: numConst("GUN_SHOT_SP"),
  HURT_R: numConst("GUN_HURT_R"),
  AIM_T: numConst("GUN_AIM_T"),
  AGGRO: numConst("GUN_AGGRO_R"),
  CHASE: numConst("GUN_CHASE_SP"),
  RETREAT: numConst("GUN_RETREAT_SP"),
  RUN_SP: numConst("GUN_RUN_SP"),
  RUN_STEP: numConst("GUN_RUN_STEP_MIN"),
  DUCK_T: numConst("GUN_DUCK_T"),
  SHOT_Z: numConst("GUN_SHOT_Z"),
  TURN_MIN: numConst("GUN_TURN_CD_MIN"),
  TURN_MAX: numConst("GUN_TURN_CD_MAX"),
  COP: lineArray("COP_SHOUT_LINES"),
  ROB: lineArray("ROBBER_LINES"),
  BULLET: lineArray("BULLET_HIT_LINES"),
  TOUCH_COP: lineArray("SHOOTOUT_TOUCH_COP_LINES"),
  TOUCH_ROB: lineArray("SHOOTOUT_TOUCH_ROBBER_LINES"),
};
ok(C.HP_BULLET === 18, "bullet graze = 18 HP (the big damage)");
ok(C.HP_TOUCH === 3, "touching a crouching cop/crook = 3 HP (minor)");
ok(C.MISS_MIN >= 1.5 && C.MISS_MAX > C.MISS_MIN, "guaranteed-miss offset constants exist (" + C.MISS_MIN + "-" + C.MISS_MAX + ")");
ok(C.HP_BULLET > C.HP_TOUCH, "bullet graze is the BIG damage, touch is minor");
ok(!!C.COP && C.COP.length >= 4, "cop shout pool exists (got " + (C.COP ? C.COP.length : 0) + ")");
ok(!!C.ROB && C.ROB.length >= 4, "robber shout pool exists (got " + (C.ROB ? C.ROB.length : 0) + ")");
ok(!!C.BULLET && C.BULLET.indexOf("That bullet grazed me!") >= 0 && C.BULLET.indexOf("Ow! It hit my ear!") >= 0, "bullet graze lines include \"That bullet grazed me!\" + \"Ow! It hit my ear!\"");
ok(!!C.TOUCH_COP && C.TOUCH_COP.length >= 2 && !!C.TOUCH_ROB && C.TOUCH_ROB.length >= 2, "touch \"stand back\" line pools exist (cop + robber)");

// ---------- extract the duel functions (fireGun / updateGunshots / gunfightAI) ----------
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
const fireSrc = extractFn("fireGun");
const shotsSrc = extractFn("updateGunshots");
const aiSrc = extractFn("gunfightAI");
ok(!!fireSrc && !!shotsSrc && !!aiSrc, "extracted fireGun + updateGunshots + gunfightAI from index.html");
const spotSrc = extractFn("gunNextCoverSpot") + "\n" + extractFn("gunStepToward");
ok(!!extractFn("gunNextCoverSpot") && !!extractFn("gunStepToward"), "extracted gunNextCoverSpot + gunStepToward from index.html");
const scorchSrc = extractFn("addCoverScorch") + "\n" + extractFn("spawnLeafPuff");
ok(!!scorchSrc, "extracted addCoverScorch + spawnLeafPuff from index.html");

// ---- runtime harness ----
const aCalls = { hurt: [], stun: 0, dust: 0, blood: 0 };
const Voice = { calls: [], say() { this.calls.push(Array.from(arguments)); } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dynamicGroup = { add() {}, remove() {} };
let shotCount = 0;
const SFX = { playGunshot() { shotCount++; } };
const dustParticles = [];
THREE.MeshLambertMaterial = function (o) { return o; };
let state = "play";
let p = null;
const constsSrc =
  "const GUN_MISS_MIN=" + C.MISS_MIN + ";const GUN_MISS_MAX=" + C.MISS_MAX + ";" +
  "const GUN_SHOT_SP=" + C.GUN_SP + ";const GUN_SHOT_LIFE=1.5;const GUN_SHOT_Z=" + C.SHOT_Z + ";" +
  "const GUN_HURT_R=" + C.HURT_R + ";const GUN_STUN=0.55;const GUN_AIM_T=" + C.AIM_T + ";" +
  "const GUN_TURN_CD_MIN=" + C.TURN_MIN + ";const GUN_TURN_CD_MAX=" + C.TURN_MAX + ";" +
  "const GUN_CHASE_SP=" + C.CHASE + ";const GUN_RETREAT_SP=" + C.RETREAT + ";" +
  "const GUN_RUN_SP=" + C.RUN_SP + ";const GUN_RUN_STEP_MIN=" + C.RUN_STEP + ";const GUN_DUCK_T=" + C.DUCK_T + ";" +
  "const GUN_CHASE_GAP=6;const GUN_EDGE_PAD=5;const GUN_AGGRO_R=" + C.AGGRO + ";" +
  "const HP_HIT_BULLET=" + C.HP_BULLET + ";" +
  "const COP_SHOUT_LINES=" + JSON.stringify(C.COP) + ";" +
  "const ROBBER_LINES=" + JSON.stringify(C.ROB) + ";" +
  "const BULLET_HIT_LINES=" + JSON.stringify(C.BULLET) + ";" +
  "const PLAYER_SPEED=8.5;" +
  "function bedStuyCoverSpots(blockX){ return [ {wx:92,wy:1.2,kind:'hydrant'},{wx:98,wy:3.4,kind:'tree'},{wx:104,wy:2.0,kind:'can'},{wx:110,wy:3.8,kind:'tree'},{wx:116,wy:1.6,kind:'hydrant'},{wx:122,wy:3.2,kind:'can'},{wx:128,wy:2.4,kind:'tree'} ]; }";
const runner = new Function(
  "Voice", "pick", "R", "clamp", "hurtNPC", "doStun", "spawnDustEffect", "dropBloodSplatter", "workerMaxY", "WORKER_GENDER", "dynamicGroup", "BX", "MS", "M", "THREE", "dustParticles", "SFX", "GZ",
  constsSrc + "\n" + fireSrc + "\n" + shotsSrc + "\n" + scorchSrc + "\n" + spotSrc + "\n" + aiSrc + "\nreturn function(c, pp, dt, st){ state=st; p=pp; gunfightAI(c, dt, p); };",
)(Voice, pick, R, clamp, (d, t, s) => aCalls.hurt.push({ d: d, t: t }), (t) => aCalls.stun++, () => aCalls.dust++, () => aCalls.blood++, () => 4.5, WORKER_GENDER, dynamicGroup, BX, MS, M, THREE, dustParticles, SFX, GZ);

function shooter(tag, wx, wy, side) {
  return {
    type: tag, gunTag: tag, side: side, wx: wx, wy: wy, homeX: wx, homeY: wy,
    coverX: wx, coverY: wy, blockMinX: wx - 30, blockMaxX: wx + 30,
    sp: 0, mode: "cover", gunCd: 0.5, aimT: 0, shots: [], flashT: 0, touchCd: 0,
    sayCd: 9, phase: 1, gender: "male", foe: null, duel: null,
    duckT: 0, coverCd: 999,
    g: { position: vec(0, 0, 0), rotation: vec(0, 0, 0) }, parts: null,
    flash: { visible: false },
  };
}
const copC = shooter("cop", 100, 1.5, -1);
const robC = shooter("robber", 112, 2.5, 1);
copC.foe = robC; robC.foe = copC;
const duel = { turn: "cop" };
copC.duel = duel; robC.duel = duel;

// ---- THE DUEL: worker in the lane -> strict turn alternation, both keep firing ----
p = { wx: 106, wy: 2.0, bloodSteps: 0 };
let fireLog = [];
function tick(c) {
  const was = duel.turn;
  runner(c, p, 0.05, "play");
  if (duel.turn !== was) fireLog.push(was); // `was` just fired
}
let minCopWx = 999, maxCopWx = -999, minCopWy = 999, maxCopWy = -999;
for (let i = 0; i < 700; i++) {
  tick(copC); tick(robC);
  minCopWx = Math.min(minCopWx, copC.wx); maxCopWx = Math.max(maxCopWx, copC.wx);
  minCopWy = Math.min(minCopWy, copC.wy); maxCopWy = Math.max(maxCopWy, copC.wy);
}
ok(fireLog.length >= 6, "the duel is ALIVE: " + fireLog.length + " shots in 35s of simulated time");
ok(fireLog.indexOf("cop") >= 0 && fireLog.indexOf("robber") >= 0, "BOTH the cop and the robber fire");
let alternating = true;
for (let i = 1; i < fireLog.length; i++) if (fireLog[i] === fireLog[i - 1]) { alternating = false; break; }
ok(alternating, "turn-taking: the shots STRICTLY ALTERNATE cop/robber (" + fireLog.slice(0, 8).join(">") + ")");
ok(minCopWx >= 79.9 && maxCopWx <= 130.1, "the cop never leaves his block (min " + minCopWx.toFixed(2) + ", max " + maxCopWx.toFixed(2) + ")");
ok(minCopWy >= 0.89 && maxCopWy <= 4.41, "the cop stays on the sidewalk band (min " + minCopWy.toFixed(2) + ", max " + maxCopWy.toFixed(2) + ")");

// ---- THE GUARANTEED MISS: bullets can ONLY hit the worker, never the foe ----
ok(shotsSrc.indexOf("foe") < 0, "structural: updateGunshots never references the foe (NPCs are unhittable by each other)");
ok(/p\.wx/.test(shotsSrc) && /p\.wy/.test(shotsSrc), "structural: the only bullet hit-test is against the worker");
ok(fireSrc.indexOf("GUN_MISS_MIN") >= 0 && fireSrc.indexOf("dir * miss") >= 0, "fireGun aims PAST the foe by the GUN_MISS lateral offset");
ok(fireSrc.indexOf('c.duel.turn = c.gunTag === "cop" ? "robber" : "cop"') >= 0, "fireGun hands the turn to the foe after every shot");
ok(C.SHOT_Z === 1.32, "bullets leave at shoulder height (1.32) - the raised gun hand, not the chest");
ok(fireSrc.indexOf("Math.cos(theta) * 0.55") >= 0, "fireGun spawns the tracer at the MUZZLE (0.55u in front of the body, facing the foe)");
ok(aiSrc.indexOf("gunNextCoverSpot(c)") >= 0 && spotSrc.indexOf("Math.abs(dy) * 1.5") >= 0, "COVER-HUNT: a settled shooter picks a NEW fixture and the score BIASES toward a SIDE move (dy) - so it reads as hopping to the side for cover, not drifting in a line");
ok(aiSrc.indexOf("gunStepToward(c, dt)") >= 0 && aiSrc.indexOf("PLAYER_SPEED") >= 0 && spotSrc.indexOf("c.gunSp") >= 0, "WORKER-PACE: they walk to cover at the worker's pace (PLAYER_SPEED), wobbling via c.gunSp - sometimes slower, sometimes faster");
ok(aiSrc.indexOf("Math.min(1, dt * 7)") < 0 && aiSrc.indexOf("foe.homeX =") < 0, "NO TELEPORT: the old fast exponential lerp (dt*7) and the edge-snap (foe.homeX=) are gone");
ok(aiSrc.indexOf("-0.5 + bob * 0.06") >= 0 && aiSrc.indexOf("if (c.gun) c.gun.rotation.y = 0.5") >= 0, "the ready hand stays in FRONT of the body (no gun dangling behind the back) and the barrel points forward");
ok(aiSrc.indexOf("-0.35 - 1.0 * u") >= 0 && aiSrc.indexOf("c.gun.rotation.y = 0.35 + 1.0 * u") >= 0, "when AIMING, the gun arm swings OUT FORWARD (hand in front of the chest) and the gun is counter-rotated so the barrel stays pointed at the target");

// ---- THE COP'S BULLETS CANNOT HURT THE WORKER: the tracer passes straight through ----
aCalls.hurt.length = 0;
Voice.calls.length = 0;
copC.shots.push({ g: { position: { set() {} } }, wx: p.wx, wy: p.wy, vx: 26, vy: 0, life: 1.5, hit: false });
runner(copC, p, 0.016, "play");
ok(aCalls.hurt.length === 0, "the COP's bullet passes through the worker with NO damage (he can never hurt the worker)");
ok(!Voice.calls.find((c) => c[6] === "worker" && C.BULLET.indexOf(c[0]) >= 0), "no worker graze yelp from a cop bullet (the worker isn't hit)");

// ---- THE ROBBER'S BULLET STILL GRAZES: 18 HP, ONE hit per bullet, blames the robber ----
aCalls.hurt.length = 0;
Voice.calls.length = 0;
robC.shots.push({ g: { position: { set() {} } }, wx: p.wx, wy: p.wy, vx: 26, vy: 0, life: 1.5, hit: false });
runner(robC, p, 0.016, "play");
ok(aCalls.hurt.length === 1 && aCalls.hurt[0].d === 18 && aCalls.hurt[0].t === "robber", "a ROBBER graze deals the BIG 18 HP damage and blames the robber (the shooter)");
runner(robC, p, 0.016, "play");
ok(aCalls.hurt.length === 1, "one graze per bullet (no per-frame drain)");
let workerLine = Voice.calls.find((c) => c[6] === "worker" && C.BULLET.indexOf(c[0]) >= 0);
ok(!!workerLine, "the worker yells a graze line from a ROBBER bullet (\"That bullet grazed me!\" / \"Ow! It hit my ear!\")");
ok(shotsSrc.indexOf("c.gunTag !== \"cop\"") >= 0, "structural: updateGunshots skips worker damage when the shooter is the cop (c.gunTag !== \"cop\")");


// ---- REAL GUNFIGHT: both keep DYNAMICALLY moving to (side) cover at worker pace, on-block ----
const copMoved = Math.abs(copC.wx - 100) > 0.5 || Math.abs(copC.wy - 1.5) > 0.5;
const robMoved = Math.abs(robC.wx - 112) > 0.5 || Math.abs(robC.wy - 2.5) > 0.5;
ok(copMoved, "the cop is DYNAMIC: he moved to a new (side) cover spot (now wx " + copC.wx.toFixed(1) + ", wy " + copC.wy.toFixed(1) + ")");
ok(robMoved, "the robber is DYNAMIC: he moved to a new (side) cover spot (now wx " + robC.wx.toFixed(1) + ", wy " + robC.wy.toFixed(1) + ")");
ok(copC.wx >= 70 && copC.wx <= 130 && robC.wx >= 82 && robC.wx <= 142, "both stayed on their block while re-hunting cover (no drift out, no teleport)");

// ---- MUZZLE ORIGIN: the bullet leaves the raised hand, not the chest ----
const cop3 = shooter("cop", 100, 1.5, -1);
const rob3 = shooter("robber", 114, 2.5, 1);
cop3.foe = rob3; rob3.foe = cop3;
const duel3 = { turn: "cop" };
cop3.duel = duel3; rob3.duel = duel3;
cop3.g.rotation.z = 0; // facing +X, straight at the robber
cop3.mode = "aim"; cop3.aimT = 0.01; cop3.gunCd = 0;
p = { wx: 106, wy: 2.0, bloodSteps: 0 };
runner(cop3, p, 0.05, "play");
ok(cop3.shots.length === 1, "the aim windup fires a shot");
const tr = cop3.shots[0];
ok(tr && Math.abs(tr.wx - 100.55) < 0.12, "the bullet leaves the MUZZLE (wx " + (tr ? tr.wx.toFixed(2) : "?") + " ~= 100.55, not the chest)");
ok(tr && Math.abs(tr.g.position.z - (GZ + 1.32)) < 0.01, "the bullet leaves at shoulder height (z " + (tr ? tr.g.position.z.toFixed(2) : "?") + ")");
// ---- OFF-BLOCK: worker far away -> the duel is SILENT (no shots, no bubbles) ----
Voice.calls.length = 0; shotCount = 0;
aCalls.hurt.length = 0;
const cop2 = shooter("cop", 100, 1.5, -1);
const rob2 = shooter("robber", 112, 2.5, 1);
cop2.foe = rob2; rob2.foe = copC ? rob2 : rob2;
cop2.foe = rob2; rob2.foe = cop2;
const duel2 = { turn: "cop" };
cop2.duel = duel2; rob2.duel = duel2;
p = { wx: 300, wy: 2.0, bloodSteps: 0 }; // well away from their block
for (let i = 0; i < 300; i++) {
  const a = duel2.turn, b = duel2.turn;
  runner(cop2, p, 0.05, "play");
  runner(rob2, p, 0.05, "play");
}
ok(shotCount === 0, "OFF-BLOCK: the duel is silent when the worker is on a DIFFERENT block");
ok(Voice.calls.length === 0, "OFF-BLOCK: no shouts/taunts from across the level");


// ---- COVER TAKES THE BULLETS: a tracer passing the fixture leaves a scorch (+ leaf puff for trees) ----
const leafBefore = dustParticles.length;
const cop4 = shooter("cop", 100, 1.5, -1);
cop4.coverKind = "tree";
cop4.coverMarks = 0;
cop4.coverX = 110; cop4.coverY = 2.0; // his fixture
const rob4 = shooter("robber", 122, 2.5, 1);
cop4.foe = rob4; rob4.foe = cop4;
const duel4 = { turn: "cop" };
cop4.duel = duel4; rob4.duel = duel4;
p = { wx: 106, wy: 2.0, bloodSteps: 0 };
cop4.shots.push({ g: { position: { x: 0, y: 0, z: 0, set(a, b, c2) { this.x = a; this.y = b; this.z = c2; } } }, wx: 108, wy: 2.0, vx: 26, vy: 0, life: 1.5, hit: false, coverHit: false });
runner(cop4, p, 0.05, "play");
runner(cop4, p, 0.05, "play");
ok(cop4.coverMarks === 1, "a tracer passing his fixture leaves ONE scorch mark (got " + cop4.coverMarks + ")");
ok(dustParticles.length > leafBefore, "a tree fixture shakes a green leaf puff");
cop4.coverMarks = 8;
cop4.shots.push({ g: { position: { x: 0, y: 0, z: 0, set(a, b, c2) { this.x = a; this.y = b; this.z = c2; } } }, wx: 108, wy: 2.0, vx: 26, vy: 0, life: 1.5, hit: false, coverHit: false });
runner(cop4, p, 0.05, "play");
runner(cop4, p, 0.05, "play");
ok(cop4.coverMarks === 8, "scorch marks cap at 8 per fixture (no infinite decals)");
// ---------- static wiring checks ----------
ok(html.indexOf(".bubble.bub-cop {") >= 0 && html.indexOf(".bubble.bub-robber {") >= 0, "CSS: bub-cop + bub-robber bubble styles exist");
ok(html.indexOf("playGunshot() {") >= 0 && html.indexOf('this.tone("sine", 110, 38, 0.4, 1.0)') >= 0, "the gunshot is a BANG: deep sine THUMP 110->38Hz, not a pop");
ok(html.indexOf('this.noise(0.5, "lowpass", 180, 0.55, 0.01)') >= 0, "the BANG has a long low rumble tail");
ok(html.indexOf('this.tone("square", 900, 120, 0.1, 0.5)') < 0, "the old poppy 900Hz report is gone");
ok(/cop: 0,/.test(html) && /robber: 0,/.test(html), "BASE_NPC_COUNTS: cop + robber start at 0 (Bed-Stuy-only spawn)");
ok(/cop: 1,/.test(html) && /robber: 1,/.test(html), "AVOID_TYPES: the crowd routes around both shooters");
ok(html.indexOf('case "cop":') >= 0 && html.indexOf('case "robber": {') >= 0, "addCreature: cop + robber cases exist");
ok(html.indexOf("function bedStuyCoverSpots(blockX)") >= 0, "bedStuyCoverSpots helper exists (trees + USPS boxes + hydrants + curb cans)");
ok(html.indexOf('b.hazards[j].type === "hit"') >= 0, "cover spots include the hydrants (hazards \"hit\")");
ok(html.indexOf('b.trees[j].wx') >= 0, "cover spots include the sidewalk trees / USPS boxes");

// ---- the Bed-Stuy spawn: gated, one block, NOT the football/rapper block ----
const spawnStart = html.indexOf("// Bed-Stuy (Sunday, day 7) SHOOTOUT: ONE NYPD officer");
const spawnEnd = html.indexOf("Manhattan Pizza Rat", spawnStart);
const spawnSrc = spawnStart > 0 && spawnEnd > spawnStart ? html.slice(spawnStart, spawnEnd) : "";
ok(!!spawnSrc, "spawnWorld: the shootout spawn block exists");
ok(spawnSrc.indexOf("if (isBedStuyLevel())") >= 0, "spawn is gated to Bed-Stuy levels ONLY");
ok(spawnSrc.indexOf('creatures.find((x) => x.type === "football")') >= 0 && spawnSrc.indexOf('creatures.find((x) => x.type === "rapper")') >= 0, "the duel block excludes the football player's AND the rapper's block");
ok(spawnSrc.indexOf("bedStuyCoverSpots(LEVEL_BLOCKS[bi].x)") >= 0, "they hide behind two street fixtures on one block");
ok(spawnSrc.indexOf("GUN_MIN_GAP") >= 0 && spawnSrc.indexOf("GUN_MAX_GAP") >= 0, "the two cover spots must be 8-26u apart");
ok(spawnSrc.indexOf('addCreature("cop")') >= 0 && spawnSrc.indexOf('addCreature("robber")') >= 0, "exactly one cop + one robber are spawned");
ok(spawnSrc.indexOf("const duel = { turn: \"cop\" }") >= 0, "a shared duel token hands the turns");
ok(spawnSrc.indexOf("{ c: cop, spot: west }") >= 0 && spawnSrc.indexOf("{ c: rob, spot: east }") >= 0, "the cop starts at the WEST end of the block, the robber AHEAD of him");
ok(shotsSrc.indexOf("d.coverHit") >= 0 && shotsSrc.indexOf("addCoverScorch(c)") >= 0, "bullets passing the fixture leave a scorch mark (one per bullet)");
ok(html.indexOf("function spawnLeafPuff(wx, wy)") >= 0, "spawnLeafPuff exists (tree leaf puffs)");
ok(spawnSrc.indexOf("s.c.coverKind = s.spot.kind") >= 0, "the spawn records which fixture each shooter hides behind");

// ---- updateCreatures + collideCreatures ----
ok(html.indexOf("gunfightAI(c, dt, p);") >= 0, "updateCreatures routes cop/robber into gunfightAI");
ok(html.indexOf('else if (c.type === "cop" || c.type === "robber") rad = 0.95;') >= 0, "collideCreatures: the shooters are SOLID (rad 0.95, not walls)");
const colStart = html.indexOf("// ===== BED-STUY SHOOTOUT: touching a crouching cop/crook =====");
const colEnd = html.indexOf("if (c.type === \"ghost\" || c.ghost) {", colStart);
const colSrc = colStart > 0 && colEnd > colStart ? html.slice(colStart, colEnd) : "";
ok(!!colSrc, "collideCreatures: the cop/robber touch branch exists");
ok(colSrc.indexOf("hurtNPC(HP_HIT_SHOOTOUT_TOUCH, c.type, true)") >= 0, "touch deals the MINOR 3 HP damage");
ok(colSrc.indexOf("c.touchCd = GUN_TOUCH_CD;") >= 0, "touch damage is on a per-NPC cooldown (no frame drain)");
ok(colSrc.indexOf("if (c.type !== \"cop\")") >= 0, "structural: the cop's touch is guarded (no worker damage) while the robber's shove still deals it");
ok(colSrc.indexOf("SHOOTOUT_TOUCH_COP_LINES") >= 0 && colSrc.indexOf("SHOOTOUT_TOUCH_ROBBER_LINES") >= 0, "a \"stand back\" line comes from the shooter on touch");

// ---- write-up + bubbles ----
ok(html.indexOf('cop: ["Interfering with NYPD duty"') >= 0, "WRITEUP_REASONS: the cop blames \"Interfering with NYPD duty\" (+3 more)");
ok(html.indexOf('robber: ["Aiding and Abetting a Felony (Allegedly)"') >= 0, "WRITEUP_REASONS: the robber has his own funny blame lines");
ok(html.indexOf('else if (speaker === "cop") cls = "bubble bub-cop";') >= 0 && html.indexOf('else if (speaker === "robber") cls = "bubble bub-robber";') >= 0, "spawnBubble maps the cop + robber speakers to their bubbles");

// ---- the write-up blame must match the bullet/touch tags ----
ok(html.indexOf('hurtNPC(HP_HIT_BULLET, c.gunTag)') >= 0, "a graze write-up blames the SHOOTER (gunTag)");

console.log("\n" + pass + " checks passed, " + fail + " failed.");
if (fail > 0) process.exit(1);
