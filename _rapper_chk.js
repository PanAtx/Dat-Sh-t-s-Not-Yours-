// _rapper_chk.js — Bed-Stuy ASPIRING RAPPER / MIXTAPE HUSTLER: model + AI + touch damage.
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1].trim());
const big = blocks.reduce((a, b) => (b.length > a.length ? b : a), "");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("PASS - " + m); } else { fail++; console.log("FAIL - " + m); } }

// ---------- THREE + helper stubs (same recipe as _football_chk.js) ----------
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

// ---------- build the model with the REAL makePerson + makeRapper ----------
function sliceBetween(src, startRe, endRe) {
  const s = src.search(startRe);
  if (s < 0) return null;
  const e = src.slice(s).search(endRe);
  return e < 0 ? null : src.slice(s, s + e);
}
const mpSrc = sliceBetween(big, /function makePerson\(/, /function makeMafiaGuy\(\)/);
const rapSrc = sliceBetween(big, /function makeRapper\(\)/, /function makeFootballPlayer\(\)/);
ok(!!mpSrc && !!rapSrc, "extracted makePerson + makeRapper from index.html");
let model = null, modelErr = null;
try {
  const buildModel = new Function("THREE", "M", "MS", "BX", "SP", "pick", "R", "GZ", "SKIN_TONES", "MATT_COLORS", "HAIR_TONES", "PANTS", "SHIRT", mpSrc + "\n" + rapSrc + "\nreturn makeRapper();");
  model = buildModel(THREE, M, MS, BX, SP, pick, R, GZ, SKIN_TONES, MATT_COLORS, HAIR_TONES, PANTS, SHIRT);
} catch (e) { modelErr = e; }
ok(!modelErr, "makeRapper() builds without error" + (modelErr ? " (" + modelErr.message + ")" : ""));
if (model) {
  const parts = model.g.userData.parts;
  ok(!!parts && parts.upper && parts.armL && parts.armR && parts.legL && parts.legR, "model exposes parts pivots (upper/armL/armR/legL/legR)");
  const hat = model.g.userData.hat;
  ok(!!hat, "g.userData.hat handle exists");
  ok(hat && hat.children.length === 6, "bucket hat = crown+brim+band+shade+2 lenses (got " + (hat ? hat.children.length : 0) + ")");
  ok(!!hat && hat.children.some((c) => c.material && c.material._hex === 0x0c0c0e), "sunglasses bar is dark on the face");
  const chain = model.g.userData.chain;
  ok(!!chain && chain.material && chain.material.metalness >= 0.9, "gold chain is metallic (metalness " + (chain && chain.material ? chain.material.metalness : 0) + ")");
  const tape = model.g.userData.tape;
  ok(!!tape, "g.userData.tape handle exists");
  ok(!!tape && tape.children.length === 3, "mixtape = jewel case + cover label + spine (got " + (tape ? tape.children.length : 0) + ")");
  ok(!!parts && !!tape && parts.armR.children.includes(tape), "the mixtape rides in the RIGHT (pushy) hand");
}

// ---------- AI state machine: extract case "rapper" + the RAP_* consts ----------
const cs = big.indexOf('case "rapper": {');
const cp = big.indexOf('case "cop":', cs); // the cop/robber case ends the rapper block now
ok(cs > 0 && cp > cs, 'found the updateCreatures case "rapper" block');
let inner = big.slice(cs, cp);
inner = inner.slice(inner.indexOf("{") + 1, inner.lastIndexOf("}"));
inner = inner.replace(/break;\s*$/, "").trim();
const mConst = big.match(/const HP_HIT_RAPPER[\s\S]*?const RAP_LINES = \[[\s\S]*?\];/);
ok(!!mConst, "extracted the RAP consts + RAP_LINES");
const constsSrc = mConst ? mConst[0] : "";
const C = new Function(constsSrc + " return {HP_HIT_RAPPER, RAP_HIT_CD, RAP_STUN, RAP_PATROL_SP, RAP_WY_MIN, RAP_WY_MAX, RAP_LINES, RAP_PITCH_LINES, RAP_WORKER_LINES, RAP_THREAT_LINES, RAP_ADVANCE_SP, RAP_HOLD, RAP_THROW_RANGE, RAP_THROW_WIND};")();
ok(C.RAP_LINES.length === 14, "14 verbatim verses stored (got " + C.RAP_LINES.length + ")");
ok(C.RAP_LINES[0] === "South Bronx grit, nineteen eighty-six\nWhite truck rollin', we get our daily kicks.", "verse 1 is verbatim");
ok(C.RAP_LINES.every((l) => l.indexOf("\n") > 0), "every verse is a two-line couplet");
ok(C.RAP_THREAT_LINES && C.RAP_THREAT_LINES.length >= 4, "a pool of worker-directed THREAT lines exists (got " + (C.RAP_THREAT_LINES ? C.RAP_THREAT_LINES.length : 0) + ")");

// ---- extract the mixtape projectile functions (makeTapeMesh / throwTape / updateRapperTapes) ----
const projStart = big.indexOf("function makeTapeMesh()");
const projEnd = big.indexOf("// A big, tall dunker: a red basketball jersey");
ok(projStart > 0 && projEnd > projStart, "extracted the mixtape projectile functions");
const projSrc = big.slice(projStart, projEnd);

const aCalls = { hurt: [], stun: 0, dust: 0 };
const Voice = { calls: [], say() { this.calls.push(Array.from(arguments)); } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dynamicGroup = { add() {}, remove() {} };
const SFX = { playTossSound() {}, playHitSound() {} };
const CY = (a, b, c2, m) => new THREE.Mesh(new THREE.CylinderGeometry(a, b, c2), m);
const runner = new Function(
  "Voice", "pick", "R", "clamp", "hurtNPC", "doStun", "spawnDustEffect", "animParts", "dynamicGroup", "SFX", "THREE", "M", "BX", "CY", "GZ",
  constsSrc + "\n" + projSrc + "\nlet state='play';let p=null;\nreturn function(c,pp,dt,st){ state=st; p=pp;\n" + inner + "\n};",
)(Voice, (a) => a[0], () => 0.5, clamp, (d, t) => aCalls.hurt.push({ d: d, t: t }), () => aCalls.stun++, () => aCalls.dust++, () => {}, dynamicGroup, SFX, THREE, M, BX, CY, GZ);

function fresh(wx) {
  return { type: "rapper", rapCd: 0, sayCd: 0, rapIdx: 0, dir: 1, homeX: 120, homeY: 2.0, blockMinX: 102, blockMaxX: 172, wx: wx || 120, wy: 2.0, phase: 0, gender: "male", thrown: [], throwCd: 3, throwT: 0, throwReleased: false, alt: false, g: { position: vec(0, 0, 0), rotation: vec(0, 0, 0) }, parts: { upper: { rotation: vec(0, 0, 0) }, armL: { rotation: vec(0, 0, 0) }, armR: { rotation: vec(0, 0, 0) } } };
}
const sayRapper = (arr) => Voice.calls.some((c) => c[6] === "rapper" && arr.indexOf(c[0]) >= 0);

// --- OFF-BLOCK: worker on a DIFFERENT block -> SILENT lazy lope, no bubbles, no throws ---
Voice.calls.length = 0;
let c = fresh(120);
let P = { wx: 300, wy: 2.0 }; // well outside his block [102,172]
let minWx = 999, maxWx = -999, minY = 999, maxY = -999, maxThrown = 0;
for (let i = 0; i < 200; i++) {
  runner(c, P, 0.1, "play");
  minWx = Math.min(minWx, c.wx); maxWx = Math.max(maxWx, c.wx); minY = Math.min(minY, c.wy); maxY = Math.max(maxY, c.wy);
  maxThrown = Math.max(maxThrown, c.thrown.length);
}
ok(Voice.calls.length === 0, "OFF-BLOCK: no lyrics/threats when the worker is on a DIFFERENT block");
ok(maxThrown === 0, "OFF-BLOCK: he never hurls a mixtape from far away");
ok(minWx >= 101.9 && maxWx <= 172.1, "OFF-BLOCK: he still paces inside his ONE block [102,172] (min " + minWx.toFixed(2) + ", max " + maxWx.toFixed(2) + ")");
ok(minY >= 0.89 && maxY <= 4.51, "OFF-BLOCK: wy stayed on the sidewalk band [0.9,4.5] (min " + minY.toFixed(2) + ", max " + maxY.toFixed(2) + ")");

// --- ON-BLOCK: worker on HIS block -> raps VERSES with a THREAT wedged between every bar ---
Voice.calls.length = 0;
c = fresh(120);
P = { wx: 120, wy: 2.0 }; // dead center of his block
let sawVerse = false, sawThreat = false, idxAdvanced = false, prevIdx = 0;
for (let i = 0; i < 60; i++) {
  runner(c, P, 0.1, "play");
  if (sayRapper(C.RAP_LINES)) sawVerse = true;
  if (sayRapper(C.RAP_THREAT_LINES)) sawThreat = true;
  if (c.rapIdx !== prevIdx) idxAdvanced = true;
  prevIdx = c.rapIdx;
}
ok(sawVerse, "ON-BLOCK: he raps a verbatim VERSE");
ok(sawThreat, "ON-BLOCK: he wedges a THREAT (aimed at the worker) between the bars");
ok(sawVerse && sawThreat, "ON-BLOCK: verses and threats INTERLEAVE (both fire)");
ok(idxAdvanced, "ON-BLOCK: the mixtape advances to the next verse");
ok(c.wx >= 101.9 && c.wx <= 172.1, "ON-BLOCK: he stays inside his block while working the crowd");

// --- THROW: a mixtape flies in and lands on the worker (HP_HIT_RAPPER, type rapper) ---
aCalls.hurt.length = 0; aCalls.stun = 0; aCalls.dust = 0;
Voice.calls.length = 0;
c = fresh(118);
c.wx = 118; c.throwCd = 0; c.throwT = 0; c.throwReleased = false;
P = { wx: 122, wy: 2.0 }; // on-block, ~4 away, inside RAP_THROW_RANGE
let maxThrown2 = 0, armedThrowCd = 0;
for (let i = 0; i < 120; i++) {
  const before = c.thrown.length;
  runner(c, P, 0.1, "play");
  maxThrown2 = Math.max(maxThrown2, c.thrown.length);
  if (c.thrown.length > before) armedThrowCd = c.throwCd;
}
ok(maxThrown2 >= 1, "ON-BLOCK: he hurls a mixtape (a projectile spawns in c.thrown)");
ok(sayRapper(C.RAP_PITCH_LINES), "ON-BLOCK: he PITCHES the worker to BUY the tape right before hurling it");
ok(armedThrowCd > 0, "he arms a throw cooldown right after pitching (no spray-and-pray spam)");
ok(aCalls.hurt.length >= 1 && aCalls.hurt[0].d === C.HP_HIT_RAPPER && aCalls.hurt[0].t === "rapper", "the thrown mixtape lands on the worker and deals HP_HIT_RAPPER=" + C.HP_HIT_RAPPER + " (type rapper)");
ok(aCalls.stun >= 1 && aCalls.dust >= 1, "the tape hit stuns + dusts the worker");

// ---------- COLLIDE: touching him hurts the WORKER (ghost-style, cooldown-gated) ----------
const csR = big.indexOf('if (c.type === "rapper") {');
const cg = big.indexOf('if (c.type === "ghost" || c.ghost) {', csR);
ok(csR > 0 && cg > csR, "found the collideCreatures rapper touch-damage branch");
const cBranch = big.slice(csR, cg).trim();
const cCalls = { hurt: [], stun: 0, dust: 0 };
const cVoice = { calls: [], say() { this.calls.push(Array.from(arguments)); } };
const cRunner = new Function(
  "Voice", "pick", "R", "clamp", "hurtNPC", "doStun", "spawnDustEffect", "workerMaxY", "WORKER_GENDER",
  "const HP_HIT_RAPPER=" + C.HP_HIT_RAPPER + ",RAP_HIT_CD=" + C.RAP_HIT_CD + ",RAP_STUN=" + C.RAP_STUN + ";" +
  "const RAP_PITCH_LINES=" + JSON.stringify(C.RAP_PITCH_LINES) + ",RAP_WORKER_LINES=" + JSON.stringify(C.RAP_WORKER_LINES) + ";" +
  "return function(c,p,dx,dy,d2){ " + cBranch + " };"
)(cVoice, (a) => a[0], () => 0.5, clamp, (d, t) => cCalls.hurt.push({ d: d, t: t }), () => cCalls.stun++, () => cCalls.dust++, () => 4.8, WORKER_GENDER);
let tc = fresh(120); tc.wx = 120.5; tc.wy = 2.0;
let tp = { wx: 120, wy: 2.0 };
const dx = 120.5 - 120, dy = 0, d2 = dx * dx + dy * dy; // creature - worker
cRunner(tc, tp, dx, dy, d2);
ok(cCalls.hurt.length === 1 && cCalls.hurt[0].d === C.HP_HIT_RAPPER && cCalls.hurt[0].t === "rapper", "touching the rapper deals HP_HIT_RAPPER=" + C.HP_HIT_RAPPER + " (type rapper) to the worker");
ok(tc.rapCd === C.RAP_HIT_CD, "the shove re-arms rapCd to " + C.RAP_HIT_CD + " (no per-frame drain)");
ok(cCalls.stun === 1 && cCalls.dust >= 1, "the shove stuns + dusts");
ok(cVoice.calls.some((c) => c[6] === "rapper"), "he raps a pitch line on the shove");
ok(cVoice.calls.some((c) => c[6] === "worker"), "the worker blurts a reaction line");
cCalls.hurt.length = 0;
cRunner(tc, tp, dx, dy, d2);
ok(cCalls.hurt.length === 0, "a second instant touch is blocked by the rapCd cooldown");

// ---------- wiring / gating / write-up / block-avoidance ----------
ok(big.indexOf('rapper: ["Failed to avoid an American Idol"],') > 0, 'WRITEUP_REASONS.rapper = "Failed to avoid an American Idol"');
ok(big.indexOf('case "rapper":') > 0 && big.indexOf("c.data = makeRapper();") > 0, "addCreature has the rapper case -> makeRapper()");
ok(big.indexOf("c.hat = c.data.g.userData.hat;") > 0 && big.indexOf("c.tape = c.data.g.userData.tape;") > 0, "addCreature stores the hat + tape handles");
ok(big.indexOf("rapper: 0, // Bed-Stuy-only") > 0, "BASE_NPC_COUNTS.rapper = 0 (spawns exactly one separately)");
ok(big.indexOf("rapper: 1, // Bed-Stuy rapper") > 0, "AVOID_TYPES.rapper = 1 (the crowd routes around him)");
ok(big.indexOf('else if (c.type === "rapper") rad = 1.1;') > 0, "collideCreatures gives him a radius (1.1, not a wall)");
ok(big.indexOf('else if (speaker === "rapper") cls = "bubble bub-rapper";') > 0 && html.indexOf(".bubble.bub-rapper {") > 0, "speech bubble: bub-rapper class + CSS");
ok(html.indexOf("white-space: pre-line;") > 0, "bub-rapper CSS wraps verses (pre-line) so the line-breaks");
ok(/if \(isBedStuyLevel\(\)\) \{[\s\S]{0,700}addCreature\("rapper"\);/.test(big), "spawnWorld gates the rapper on isBedStuyLevel()");
ok(big.indexOf("rp.blockMinX = rpBlock.x + 6.0;") > 0 && big.indexOf("rp.blockMaxX = rpBlock.x + BLOCK_W - 6.0;") > 0, "spawn sets his ONE-block bounds (blockMinX/blockMaxX)");
ok(big.indexOf('creatures.find((x) => x.type === "football")') > 0 && big.indexOf("fbBlockX") > 0, "spawn looks up the football player's block to AVOID it");
ok(big.indexOf("if (fbC && LEVEL_BLOCKS[rpIdx].x === fbBlockX) rpIdx = 1 + (rpIdx % 5);") > 0, "spawn forces a DIFFERENT block than the football player's");
ok(big.indexOf("if (c.rapCd > 0) c.rapCd -= dt;") > 0, "the rapCd cooldown is decremented in updateCreatures");
ok(big.indexOf('type === "rapper" // the Bed-Stuy aspiring rapper (male voice)') > 0, "gender: the rapper is male (male voice)");

console.log("");
if (fail === 0) console.log("ASPIRING RAPPER: ALL " + pass + " CHECKS PASS");
else { console.log(pass + " passed, " + fail + " FAILED"); process.exit(1); }
