// _panhandler_chk.js — validate the Bronx corner-store panhandler in index.html
// 1) roster entry + model builder (thin, hungry, cup in hand, stink wisps)
// 2) spawn rules (Bronx-only, 2, different blocks, in front of the store)
// 3) wiring: addCreature, begging lines, worker bias, collision shove, write-up, bubble
// 4) RUNTIME: runs the REAL updateCreatures "panhandler" case body with shims
// 5) RUNTIME: runs the REAL collideCreatures panhandler branch (shove, both
//    "Man, you stink!" lines, very minor damage, cooldown, knockback both ways)
// 6) jacker (the jackhammer guy): collision line + minor damage +
//    "Delaying city progress." write-up reason
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

function extractFn(name) {
  const idx = html.indexOf("function " + name + "(");
  if (idx < 0) throw new Error("function not found: " + name);
  const b = html.indexOf("{", idx);
  let d = 0,
    i = b;
  for (; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return html.slice(idx, i);
}
// Extract an if-branch like `if (c.type === "panhandler") { ... }` via brace matching
function extractIfBlock(openText) {
  const idx = html.indexOf(openText);
  if (idx < 0) return null;
  const b = html.indexOf("{", idx);
  let d = 0,
    i = b;
  for (; i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return html.slice(idx, i);
}
let pass = 0,
  fail = 0;
function check(n, cond) {
  if (cond) {
    pass++;
    console.log("  ok   " + n);
  } else {
    fail++;
    console.error("  FAIL " + n);
  }
}

console.log("[1] roster + model builder");
const baseIdx = html.indexOf("const BASE_NPC_COUNTS = {");
const baseSrc = html.slice(baseIdx, html.indexOf("};", baseIdx));
check(
  "panhandler is in BASE_NPC_COUNTS at 0 (spawned separately, like dealer)",
  /panhandler:\s*0,/.test(baseSrc),
);
check("makePanhandler() builder exists", html.indexOf("function makePanhandler(") >= 0);
const phSrc = extractFn("makePanhandler");
check("panhandler is THIN (torso 0.30 vs dealer 0.48)", phSrc.indexOf("BX(0.3, 0.64, 0.76, shirt)") >= 0);
check("scrawny legs (0.12 wide, longer than a ped's 0.58)", phSrc.indexOf("BX(0.12, 0.15, 0.74, pants)") >= 0);
check("begging cup in the extended hand (red cup)", phSrc.indexOf("BX(0.15, 0.15, 0.18, M(0x8a2b22))") >= 0 && phSrc.indexOf("armR.add(cup)") >= 0);
check("hunched forward (torso lean + head pitch)", phSrc.indexOf("torso.rotation.y = 0.22") >= 0 && phSrc.indexOf("headPivot.rotation.y = 0.55") >= 0);
check("stink: translucent green wisps on userData", phSrc.indexOf("transparent: true") >= 0 && phSrc.indexOf("g.userData.stink = stink") >= 0);
check("hungry face: sunken eyes + matted hair", phSrc.indexOf("eyeM") >= 0 && phSrc.indexOf("hairM") >= 0);
check("legs/arms on pivots for the animParts shuffle", phSrc.indexOf("g.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR }") >= 0);

console.log("[2] spawn rules");
const spawnIdx = html.indexOf("// Bronx panhandlers: exactly TWO");
const spawnEnd = html.indexOf("// Manhattan Pizza Rat");
const spawnBlock = html.slice(spawnIdx, spawnEnd);
check("spawn block found (after the dealer block)", spawnIdx >= 0 && spawnEnd > spawnIdx);
check(
  "panhandler spawn is gated to Bronx levels",
  spawnBlock.indexOf("if (isBronxLevel()) {") >= 0,
);
check("exactly 2 panhandlers per level", /for \(let phI = 0; phI < 2; phI\+\+\)/.test(spawnBlock));
check(
  "picks 2 DISTINCT active blocks (shuffle 1..5, take 2)",
  /phBlockIdx = \[1, 2, 3, 4, 5\]/.test(spawnBlock) &&
    spawnBlock.indexOf("LEVEL_BLOCKS[phBlockIdx[phI]]") >= 0,
);
check(
  "stands in front of the block's corner store (house 0 or 9)",
  spawnBlock.indexOf("Math.random() < 0.5 ? 0 : 9") >= 0 &&
    spawnBlock.indexOf("storeI === 0 ? 1 : -1") >= 0,
);
check("home spot is on the sidewalk in front of the storefront", spawnBlock.indexOf("ph.homeY = R(3.6, 4.6)") >= 0);
check("never leaves his corner (bounded wander radius)", spawnBlock.indexOf("ph.wanderR = R(4.5, 6.5)") >= 0);

console.log("[3] wiring");
check(
  "addCreature has case \"panhandler\"",
  /case "panhandler":/.test(
    html.slice(html.indexOf("function addCreature("), html.indexOf("function updateCreatures(")),
  ),
);
const addCase = html.slice(html.indexOf('case "panhandler":'), html.indexOf('case "skater":', html.indexOf('case "panhandler":')));
check("panhandler moves on a fast hungry hustle (1.0-1.5)", addCase.indexOf("c.sp = R(1.0, 1.5)") >= 0);
check("panhandler speaks as a man", addCase.indexOf('c.gender = "male"') >= 0);
check("updateCreatures has a panhandler case", html.indexOf('case "panhandler": {') >= 0);
const caseIdx = html.indexOf('case "panhandler": {');
const caseEnd = html.indexOf('case "skater": {', caseIdx);
const caseText = html.slice(caseIdx, caseEnd);
check("update case is well-formed before the skater case", caseIdx >= 0 && caseEnd > caseIdx);
const LINES = ["I need money", "You got the time?", "I need a drink.", "Got any drugs?", "I'm hungry, can I have $50?"];
LINES.forEach((l) =>
  check("begging line in the update case: " + JSON.stringify(l), caseText.indexOf(JSON.stringify(l)) >= 0),
);
check("the sanitation worker is his favorite mark", caseText.indexOf('mark = "worker"') >= 0 && caseText.indexOf("dW < 4 || Math.random() < 0.6") >= 0);
check("he also bothers passersby (ped/lady/yeller/hooker/dogwalker)", caseText.indexOf('o.type !== "ped"') >= 0 && caseText.indexOf('o.type !== "dogwalker"') >= 0);
check("begging voice uses the 'panhandler' speaker type", caseText.indexOf('"panhandler",') >= 0);
check(
  "collideCreatures gives the panhandler a solid radius",
  /c\.type === "panhandler"\) rad = 0\.85;/.test(html),
);
check("very minor damage constant (1 HP, lighter than any hazard)", /const HP_HIT_PANHANDLER = 1;/.test(html));
const branch = extractIfBlock('if (c.type === "panhandler") {');
check("collision branch exists in collideCreatures", !!branch && branch.indexOf('c.type === "panhandler"') >= 0);
if (branch) {
  check("panhandler says 'Man, you stink!' on a bump", branch.indexOf('"Man, you stink!"') >= 0);
  check("worker fires back with 'Man, you stink!'", branch.split('"Man, you stink!"').length - 1 === 2);
  check("the smell does very minor damage, cause 'panhandler'", branch.indexOf('hurtNPC(HP_HIT_PANHANDLER, "panhandler")') >= 0);
  check("he pushes back (worker shoved away AND he is shoved back)", branch.indexOf("p.wx += nx * 1.0") >= 0 && branch.indexOf("c.wx -= nx * 0.5") >= 0);
  check("shove-vent has a cooldown (3s)", branch.indexOf("c.stinkCd = 3.0") >= 0);
}
check("write-up entry exists for the panhandler cause", /panhandler:\s*\[/.test(html) && html.indexOf('"Failure to provide care to citizen."') >= 0);
check("bubble CSS for the panhandler speaker", /bub-panhandler \{/.test(html));
check(
  "spawnBubble maps the panhandler speaker",
  /speaker === "panhandler"\)\s*el\.className = "bubble bub-panhandler";/.test(html),
);
// The real write-up stamp for this cause
const wrS = html.indexOf("const WRITEUP_REASONS = {");
const wrE = html.indexOf("};", wrS);
const REASONS = eval(html.slice(wrS, wrE + 1).replace("const ", ""));
check(
  "WRITEUP_REASONS.panhandler carries the care-to-citizen line",
  REASONS.panhandler && REASONS.panhandler.indexOf("Failure to provide care to citizen.") >= 0,
);
const writeupReason = new Function("WRITEUP_REASONS", extractFn("writeupReason") + "\n;return writeupReason;")(REASONS);
check(
  "writeupReason('panhandler') stamps the EXACT line",
  writeupReason("panhandler") === "Failure to provide care to citizen.",
);

console.log("[4] RUNTIME: real updateCreatures panhandler case");
const animParts = new Function("return " + extractFn("animParts"))();
const voices = [];
const Voice = { say: (t, v1, v2, wx, wy, g, type) => voices.push({ t, g, type }) };
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GZ = 0.3;
const state = "play";
const creatures = [];
const _runCase = new Function(
  "c",
  "p",
  "dt",
  "state",
  "creatures",
  "R",
  "pick",
  "clamp",
  "Voice",
  "GZ",
  "animParts",
  "switch (c.type) { " + caseText + " }",
);
const runCase = (c, p, dt) =>
  _runCase(c, p, dt, state, creatures, R, pick, clamp, Voice, GZ, animParts);
const rot = () => ({ x: 0, y: 0, z: 0 });
function makePH() {
  const part = () => ({ rotation: rot() });
  const bz = [2.05, 2.24, 2.4],
    bx = [0.28, 0.44, 0.6];
  return {
    type: "panhandler",
    wx: 100,
    wy: 4.0,
    phase: 0,
    sp: 0.7,
    mode: "wander",
    mark: null,
    asked: false,
    decideCd: 0,
    stinkCd: 0,
    homeX: 100,
    homeY: 4.0,
    wanderR: 5,
    tgtX: 100,
    tgtY: 4.0,
    gender: "male",
    g: {
      position: { x: 100, y: 4, z: 0 },
      rotation: rot(),
      userData: { stink: bz.map((z, i) => ({ position: { x: bx[i], y: 0, z: z }, userData: { bx: bx[i], bz: z } })) },
    },
    parts: { legL: part(), legR: part(), armL: part(), armR: part() },
  };
}
// (a) worker far away -> he wanders his own corner
let c = makePH();
let p = { wx: 1000, wy: 2 };
let moved = 0;
for (let f = 0; f < 200; f++) {
  runCase(c, p, 0.1);
  moved = Math.max(moved, Math.hypot(c.wx - 100, c.wy - 4));
}
check("wander: stays near his store corner (homeX ± wanderR + margin)", Math.abs(c.wx - c.homeX) <= c.wanderR + 1.2);
check("wander: stays on the sidewalk (y clamped 1.0..4.7)", c.wy >= 1.0 && c.wy <= 4.7);
check("wander: he actually shuffles around (moves over time)", moved > 0.5);
// (b) worker close -> he bothers the worker and begs with one of his lines
voices.length = 0;
c = makePH();
p = { wx: 103, wy: 4.0 }; // dW = 3 < 4: the worker is GUARANTEED to be his mark
runCase(c, p, 0.016);
const beg = voices.find((v) => v.type === "panhandler");
check("bother: the worker is his mark when he's close", c.mark === "worker");
check("bother: he begs with one of his 5 lines", !!beg && LINES.includes(beg.t));
check("bother: the line is voiced as the panhandler (male)", !!beg && beg.g === "male");
check("bother: marks himself done + arms a re-decide cooldown", c.asked === true && c.decideCd > 0);
check("cup pose re-applied (begging arm extended forward)", c.parts.armR.rotation.y < -0.8);
const w0 = c.g.userData.stink.map((w) => w.position.z);
runCase(c, p, 0.2);
const w1 = c.g.userData.stink.map((w) => w.position.z);
check("stink wisps bob above his head as he shuffles", w1.some((z, i) => Math.abs(z - w0[i]) > 0.001));
// (c) passersby get bothered too
voices.length = 0;
c = makePH();
p = { wx: 500, wy: 2 }; // worker far away
const buddy = { type: "ped", wx: 102, wy: 4.0 };
creatures.push(buddy);
runCase(c, p, 0.016);
check("bother: passersby are bothered too (nearest ped marked)", c.mark === buddy);
check(
  "bother: he begs the passerby with one of his lines",
  voices.some((v) => v.type === "panhandler" && LINES.includes(v.t)),
);
creatures.length = 0;

console.log("[5] RUNTIME: real collideCreatures panhandler branch");
const rec = { hurt: 0, dmg: 0, cause: null, dust: 0, stuns: [] };
const hurtNPC = (a, cause) => {
  rec.hurt++;
  rec.dmg += a;
  rec.cause = cause;
};
const spawnDustEffect = () => rec.dust++;
const doStun = (d, t) => rec.stuns.push({ d, t });
const HP_HIT_PANHANDLER = 1;
const WORKER_GENDER = "male";
const workerMaxY = () => 4.8;
const runBump = new Function(
  "c",
  "p",
  "dx",
  "dy",
  "d2",
  "rad",
  "clamp",
  "workerMaxY",
  "Voice",
  "hurtNPC",
  "spawnDustEffect",
  "doStun",
  "HP_HIT_PANHANDLER",
  "WORKER_GENDER",
  branch,
);
let c2 = { type: "panhandler", wx: 100, wy: 4, stinkCd: 0, gender: "male" };
let p2 = { wx: 100.8, wy: 4 };
const d2 = 0.64,
  dx = -0.8,
  dy = 0,
  rad = 0.85;
voices.length = 0;
runBump(c2, p2, dx, dy, d2, rad, clamp, workerMaxY, Voice, hurtNPC, spawnDustEffect, doStun, HP_HIT_PANHANDLER, WORKER_GENDER);
check("bump: panhandler says 'Man, you stink!'", voices.some((v) => v.t === "Man, you stink!" && v.type === "panhandler"));
check("bump: worker fires back 'Man, you stink!'", voices.some((v) => v.t === "Man, you stink!" && v.type === "worker"));
check("bump: the smell does VERY MINOR damage (exactly 1 HP)", rec.hurt === 1 && rec.dmg === 1);
check("bump: the offense is recorded as the panhandler", rec.cause === "panhandler");
check("bump: the worker is shoved away from him", p2.wx > 100.8 + 0.9);
check("bump: he is pushed back too (the push-back)", c2.wx < 100 - 0.4);
check("bump: a light trip on the shove ('trip', not a full hit)", rec.stuns.length === 1 && rec.stuns[0].t === "trip");
check("bump: shove-vent cooldown armed (~3s)", c2.stinkCd > 2.9);
runBump(c2, p2, dx, dy, d2, rad, clamp, workerMaxY, Voice, hurtNPC, spawnDustEffect, doStun, HP_HIT_PANHANDLER, WORKER_GENDER);
check("bump: no second stink-dump while the cooldown runs", rec.hurt === 1);
c2.stinkCd = 0;
runBump(c2, p2, dx, dy, d2, rad, clamp, workerMaxY, Voice, hurtNPC, spawnDustEffect, doStun, HP_HIT_PANHANDLER, WORKER_GENDER);
check("bump: stinks again once the cooldown lapses", rec.hurt === 2);

console.log("[6] jacker (the jackhammer guy) collision");
check(
  "HP_HIT_JACKER is MINOR damage (2, above the stink's 1, far below a vehicle's 8)",
  html.indexOf("const HP_HIT_JACKER = 2;") >= 0,
);
// (arcade pass) the jacker now leads its own sub-branch: `if (c.type === "jacker") {`
const jackerBranch = extractIfBlock('if (c.type === "jacker") {');
check("jacker bump branch exists in the solid-guy collision block", !!jackerBranch);
check(
  "jacker says 'Don't mess with city progress!'",
  jackerBranch && jackerBranch.indexOf("Don't mess with city progress!") >= 0,
);
check(
  "jacker bump does minor damage tagged to the jacker",
  jackerBranch && jackerBranch.indexOf('hurtNPC(HP_HIT_JACKER, "jacker")') >= 0,
);
check(
  "write-up reason 'Delaying city progress.' is mapped to the jacker",
  /jacker:\s*\[\s*"Delaying city progress\."/.test(html),
);
// RUNTIME: run the REAL branch body with shims (same harness style as [5])
const recJ = { hurt: 0, dmg: 0, cause: null };
const hurtJ = (a, cause) => {
  recJ.hurt++;
  recJ.dmg += a;
  recJ.cause = cause;
};
const HP_HIT_JACKER = 2;
const jBody = jackerBranch.replace(/^\}\s*else if/, "if");
const runJacker = new Function(
  "c",
  "p",
  "Voice",
  "hurtNPC",
  "HP_HIT_JACKER",
  "WORKER_GENDER",
  jBody,
);
voices.length = 0;
const cj = { type: "jacker", wx: 55, wy: 3.5, gender: "male" };
const pj = { wx: 55.8, wy: 3.5 };
runJacker(cj, pj, Voice, hurtJ, HP_HIT_JACKER, "male");
check(
  "jacker bump: he says 'Don't mess with city progress!'",
  voices.some((v) => v.t === "Don't mess with city progress!" && v.type === "jacker"),
);
check(
  "jacker bump: the worker fires back the same line",
  voices.some((v) => v.t === "Don't mess with city progress!" && v.type === "worker"),
);
check(
  "jacker bump: MINOR damage (exactly 2 HP, not a vehicle hit)",
  recJ.hurt === 1 && recJ.dmg === 2,
);
check(
  "jacker bump: the offense is recorded as the jacker (feeds the write-up stamp)",
  recJ.cause === "jacker",
);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);