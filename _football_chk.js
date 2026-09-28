// _football_chk.js — Bed-Stuy high-school FOOTBALL PLAYER: model + state machine.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
const big = blocks.reduce((a, b) => (b.length > a.length ? b : a), "");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("PASS - " + m); } else { fail++; console.log("FAIL - " + m); } }

// ---------- THREE + helper stubs (same recipe as _newnpc_chk.js) ----------
function vec(x, y, z) { return { x: x, y: y, z: z, set(a, b, c2) { this.x = a; this.y = b; this.z = c2; return this; } }; }
function OBJ() { this.position = vec(0, 0, 0); this.rotation = vec(0, 0, 0); this.scale = vec(1, 1, 1); this.children = []; this.userData = {}; }
OBJ.prototype.add = function (c) { this.children.push(c); return this; };
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
const WORKER_GENDER = "male";

// ---------- build the model with the REAL makePerson + makeFootballPlayer ----------
function sliceBetween(src, startRe, endRe) {
  const s = src.search(startRe);
  if (s < 0) return null;
  const e = src.slice(s).search(endRe);
  return e < 0 ? null : src.slice(s, s + e);
}
const mpSrc = sliceBetween(big, /function makePerson\(/, /function makeMafiaGuy\(\)/);
const fbSrc = sliceBetween(big, /function makeFootballPlayer\(\)/, /function makeHooker\(\)/);
ok(!!mpSrc && !!fbSrc, "extracted makePerson + makeFootballPlayer from index.html");
let model = null, modelErr = null;
try {
  const buildModel = new Function("THREE", "M", "MS", "BX", "SP", "pick", "R", "GZ", "SKIN_TONES", "MATT_COLORS", "HAIR_TONES", "PANTS", "SHIRT", mpSrc + "\n" + fbSrc + "\nreturn makeFootballPlayer();");
  model = buildModel(THREE, M, MS, BX, SP, pick, R, GZ, SKIN_TONES, MATT_COLORS, HAIR_TONES, PANTS, SHIRT);
} catch (e) { modelErr = e; }
ok(!modelErr, "makeFootballPlayer() builds without error" + (modelErr ? " (" + modelErr.message + ")" : ""));
if (model) {
  const parts = model.g.userData.parts;
  ok(!!parts && parts.upper && parts.armL && parts.armR && parts.legL && parts.legR, "model exposes parts pivots (upper/armL/armR/legL/legR)");
  ok(model.g.scale.x > 1 && model.g.scale.y > 1.2 && model.g.scale.z > 1.1, "linebacker scale is broad + tall (" + model.g.scale.x + "," + model.g.scale.y + "," + model.g.scale.z + ")");
  const helmet = model.g.userData.helmet;
  ok(!!helmet, "g.userData.helmet handle exists");
  ok(helmet && helmet.children.length === 13, "helmet has 13 pieces (got " + (helmet ? helmet.children.length : 0) + ")");
  const steel = helmet ? helmet.children.filter((c) => c.material && c.material.metalness >= 0.8).length : 0;
  ok(steel === 5, "5 steel facemask pieces (3 bars + center bar + throat) got " + steel);
  const face = helmet ? helmet.children.find((c) => c.material && SKIN_TONES.includes(c.material._hex)) : null;
  ok(!!face, "helmet has a skin face panel showing through the opening");
  const ball = model.g.userData.ball;
  ok(!!ball, "g.userData.ball handle exists");
  ok(ball && ball.children.length === 4, "ball = prolate oval + lace + 2 end bands (got " + (ball ? ball.children.length : 0) + ")");
  const oval = ball ? ball.children[0] : null;
  ok(!!oval && oval.scale.x > 1.4, "ball is prolate (oval scale.x " + (oval ? oval.scale.x : 0) + ")");
  ok(ball && parts.armL.children.includes(ball), "ball rides under the left arm (dance raises it overhead)");
}

// ---------- state machine: extract the case "football" body + the FOOTBALL consts ----------
const cs = big.indexOf('case "football": {');
const cp = big.indexOf('case "', cs + 6); // bound by the NEXT case after football (robust to cases inserted between them)
ok(cs > 0 && cp > cs, 'found the updateCreatures case "football" block');
let inner = big.slice(cs, cp);
inner = inner.slice(inner.indexOf("{") + 1, inner.lastIndexOf("}"));
inner = inner.replace(/break;\s*$/, "").trim();
const mConst = big.match(/const HP_HIT_FOOTBALL[\s\S]*?const FOOTBALL_LINES = \[[\s\S]*?\];/);
ok(!!mConst, "extracted the FOOTBALL consts");
const constsSrc = mConst ? mConst[0] : "";

const calls = { hurt: [], stun: 0, dust: 0, blood: 0 };
const Voice = { calls: [], say() { this.calls.push(Array.from(arguments)); } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hurtNPC = (d, t) => calls.hurt.push({ d: d, t: t });
const step = new Function(
  "Voice", "pick", "R", "clamp", "hurtNPC", "doStun", "spawnDustEffect", "dropBloodSplatter", "animParts", "workerMaxY", "GZ", "WORKER_GENDER",
  constsSrc + "\nreturn function(c,p,dt,state){ " + inner + " };",
);
const runner = step(Voice, (a) => a[0], () => 0.5, clamp, hurtNPC, () => calls.stun++, () => calls.dust++, () => calls.blood++, () => {}, () => 4.8, GZ, WORKER_GENDER);

function fresh() {
  return {
    type: "football", mode: "set", setT: 0.05, hutT: 0, hiked: false, chargeT: 0, aimX: 0, aimY: 0, danceT: 0, danceSpin: 0, hopZ: 0, sayCd: 99,
    homeX: 120, homeY: 2.0, blockMinX: 102, blockMaxX: 172, wx: 120, wy: 2.0, phase: 0, g: { position: vec(0, 0, 0), rotation: vec(0, 0, 0) },
    parts: { upper: { rotation: vec(0, 0, 0) }, armL: { rotation: vec(0, 0, 0) }, armR: { rotation: vec(0, 0, 0) } },
  };
}
const p0 = () => ({ wx: 125, wy: 2.0, bloodSteps: 0 });
const say = (line) => Voice.calls.some((c) => c[0] === line);

// --- happy path: set -> hut (Hut) -> hut (HIKE) -> charge -> TACKLE -> dance -> return -> set ---
let c = fresh();
let P = p0();
let minWx = 999, maxWx = -999, minY = 999, maxY = -999, sawHut = false, sawHike = false, sawMeniscus = false, sawDance = false, sawSet3 = false, sawHop = false;
let spinChanged = false, prevDanceRz = null;
for (let i = 0; i < 400; i++) {
  runner(c, P, 0.1, "play");
  minWx = Math.min(minWx, c.wx); maxWx = Math.max(maxWx, c.wx); minY = Math.min(minY, c.wy); maxY = Math.max(maxY, c.wy);
  if (say("Hut... hut...")) sawHut = true;
  if (say("HIKE!")) { if (sawHut) sawHike = true; }
  if (say("Ow! My meniscus!")) sawMeniscus = true;
  if (c.mode === "dance") { sawDance = true; if (c.hopZ > 0.05) sawHop = true; }
  if (c.mode === "dance") { if (prevDanceRz !== null && Math.abs(c.g.rotation.z - prevDanceRz) > 0.01) spinChanged = true; prevDanceRz = c.g.rotation.z; }
  if (c.mode === "set" && c.setT === 3.0) sawSet3 = true;
}
ok(sawHut, '"Hut... hut..." is barked');
ok(sawHike, '"HIKE!" fires AFTER "Hut... hut..." (the tell then the snap)');
ok(sawMeniscus, 'a tackle says "Ow! My meniscus!"');
ok(calls.hurt.length > 0 && calls.hurt[0].d === 10 && calls.hurt[0].t === "football", "tackle deals HP_HIT_FOOTBALL=10 of type football (got " + JSON.stringify(calls.hurt[0]) + ")");
ok(sawDance, "he breaks into the touchdown dance after a tackle");
ok(sawHop && spinChanged, "dance has hops + full spins");
ok(sawSet3, "after the dance he trots home and re-sets with the 3-second count");
ok(calls.dust > 0 && calls.blood > 0 && calls.stun > 0, "tackle triggers dust + blood + stun");
ok(P.bloodSteps === 10, "tackle sets the worker's bloodSteps");
ok(minWx >= 101.9 && maxWx <= 172.1, "wx stayed inside his block [102,172] (min " + minWx.toFixed(2) + ", max " + maxWx.toFixed(2) + ")");
ok(minY >= 0.89 && maxY <= 4.51, "wy stayed on the sidewalk band [0.9,4.5] (min " + minY.toFixed(2) + ", max " + maxY.toFixed(2) + ")");

// --- whiff path: no damage when the charge comes up empty ---
Voice.calls.length = 0; calls.hurt.length = 0;
let wc = fresh(); wc.mode = "charge"; wc.chargeT = 1.5; wc.aimX = 125.6; wc.aimY = 2.0; wc.wx = 110; wc.wy = 2.0; wc.sayCd = 0;
let wp = p0();
runner(wc, wp, 0.1, "play");
ok(wc.mode === "return", "a whiff (charge over, no contact) goes back to the line");
ok(calls.hurt.length === 0, "a whiff deals NO damage");
ok(wp.bloodSteps === 0, "a whiff leaves the worker unmarked");
ok(Voice.calls.some((x) => { const t = (x[0] || "").toLowerCase(); return t.indexOf("practice") >= 0 || t.indexOf("slower") >= 0 || t.indexOf("flag") >= 0; }), "a whiff fires a griping line");

// --- interrupted route: he stops attacking and trots home ---
let ic = fresh(); ic.mode = "charge"; ic.chargeT = 0; ic.aimX = 125.6; ic.aimY = 2.0; ic.wx = 118; ic.wy = 2.0;
let ip = p0();
runner(ic, ip, 0.1, "route");
ok(ic.mode === "return", "when the route is done he drops the tackle and trots home");

// ---------- wiring / gating / write-up ----------
ok(big.indexOf('teeball: ["Dereliction of Tee-Ball Duty"],') > 0 && big.indexOf('football: ["Unnecessary Roughness. Fifteen-yard penalty."]') > 0, 'WRITEUP_REASONS.football = "Unnecessary Roughness. Fifteen-yard penalty."');
ok(big.indexOf('case "football":') > 0 && big.indexOf("c.data = makeFootballPlayer();") > 0, "addCreature has the football case -> makeFootballPlayer()");
ok(big.indexOf("c.helmet = c.data.g.userData.helmet;") > 0 && big.indexOf("c.ballMesh = c.data.g.userData.ball;") > 0, "addCreature stores the helmet + ball handles");
ok(/if \(isBedStuyLevel\(\)\) \{[\s\S]{0,400}addCreature\("football"\);/.test(big), "spawnWorld gates the football player on isBedStuyLevel()");
ok(big.indexOf("fb.blockMinX = fbBlock.x + 6.0;") > 0 && big.indexOf("fb.blockMaxX = fbBlock.x + BLOCK_W - 6.0;") > 0, "spawn sets his ONE-block bounds (blockMinX/blockMaxX)");
ok(big.indexOf("scholar: 0, // Flatbush-only") > 0 && big.indexOf("football: 0, // Bed-Stuy-only") > 0, "BASE_NPC_COUNTS.football = 0 (spawns exactly one separately)");
ok(big.indexOf('else if (c.type === "football") rad = 1.2;') > 0, "collideCreatures gives him a solid radius (1.2)");
ok(big.indexOf('if (c.type === "football") {') > 0, "collideCreatures has the football push-out branch");
ok(big.indexOf('else if (speaker === "football") cls = "bubble bub-football";') > 0 && html.indexOf(".bubble.bub-football {") > 0, "speech bubble: bub-football class + CSS color");

console.log("");
if (fail === 0) console.log("FOOTBALL PLAYER: ALL " + pass + " CHECKS PASS");
else { console.log(pass + " passed, " + fail + " FAILED"); process.exit(1); }