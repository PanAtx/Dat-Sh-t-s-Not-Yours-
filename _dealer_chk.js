// _dealer_chk.js — validate the Bronx stoop drug dealer in index.html
// 1) roster entry, model builders, spawn rules (Bronx-only, 2, different blocks)
// 2) RUNTIME: runs the REAL updateCreatures "dealer" case body with shims and
//    verifies the head sweep, the punch (damage/stun/effects/lines/knockback),
//    the 3.5s punch cooldown, and the sales pitch cadence.
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

console.log("[1] roster + model builders");
const baseIdx = html.indexOf("const BASE_NPC_COUNTS = {");
const baseSrc = html.slice(baseIdx, html.indexOf("};", baseIdx));
check(
  "dealer is in BASE_NPC_COUNTS at 0 (spawned separately, like crazy)",
  /dealer:\s*0,/.test(baseSrc),
);
check("makeDealer() builder exists", html.indexOf("function makeDealer(") >= 0);
check("makeDealerStash() builder exists", html.indexOf("function makeDealerStash(") >= 0);
const dealerSrc = extractFn("makeDealer");
check(
  "dealer head on its own pivot (userData.head)",
  dealerSrc.indexOf("g.userData.head = headPivot") >= 0,
);
check(
  "dealer right arm on a punch pivot (userData.punchArm)",
  dealerSrc.indexOf("g.userData.punchArm = armR") >= 0,
);
check(
  "dealer is burly (wider torso 0.48 than makePerson 0.3)",
  dealerSrc.indexOf("BX(0.48, 0.7, 0.82, hoodie)") >= 0,
);
const stashSrc = extractFn("makeDealerStash");
check(
  "stash has weed bag + pill bag + loose pills + cash",
  /weed/.test(stashSrc) &&
    /pillBag/.test(stashSrc) &&
    /pillM/.test(stashSrc) &&
    /cash/.test(stashSrc),
);

console.log("[2] spawn rules");
const spawnIdx = html.indexOf("// Bronx drug dealers: exactly TWO");
const spawnEnd = html.indexOf("// Manhattan Pizza Rat");
const spawnBlock = html.slice(spawnIdx, spawnEnd);
check(
  "dealer spawn is gated to Bronx levels",
  spawnBlock.indexOf("if (isBronxLevel()) {") >= 0,
);
check("exactly 2 dealers per level", /for \(let dI = 0; dI < 2; dI\+\+\)/.test(spawnBlock));
check(
  "deals pick 2 DISTINCT active blocks (shuffle 1..5, take 2)",
  /dealerBlockIdx = \[1, 2, 3, 4, 5\]/.test(spawnBlock) &&
    spawnBlock.indexOf("LEVEL_BLOCKS[dealerBlockIdx[dI]]") >= 0,
);
check(
  "dealer stands on the bottom stoop step (y 5.6, z 0.47)",
  spawnBlock.indexOf("dl.wy = 5.6") >= 0 &&
    spawnBlock.indexOf("dl.baseZ = 0.47") >= 0,
);
check(
  "dealer is offset to one side of the stoop center",
  spawnBlock.indexOf("stoopX + side * 0.45") >= 0,
);
check(
  "stoop center derived from house x + 1.6",
  spawnBlock.indexOf("const stoopX = houseX + 1.6;") >= 0,
);
check(
  "stash table sits beside the dealer on the stoop",
  spawnBlock.indexOf("stash.position.set(stoopX - side * 0.6, 5.62, dl.baseZ)") >= 0,
);

console.log("[3] wiring");
check(
  "addCreature has case \"dealer\"",
  /case "dealer":/.test(
    html.slice(html.indexOf("function addCreature("), html.indexOf("function updateCreatures(")),
  ),
);
check(
  "dealer faces the street like the hooker",
  /if \(type === "dealer"\) c\.g\.rotation\.z = -Math\.PI \/ 2;/.test(html),
);
check("updateCreatures has a dealer case", html.indexOf('case "dealer": {') >= 0);
check(
  "collideCreatures gives the dealer a solid radius",
  /c\.type === "dealer"\) rad = 1\.0;/.test(html),
);
check("bubble CSS for dealer speaker", /bub-dealer \{/.test(html));
check(
  "spawnBubble maps dealer speaker",
  /speaker === "dealer"\) cls = "bubble bub-dealer";/.test(html),
);
console.log("[4] RUNTIME: real dealer case body");
const caseIdx = html.indexOf('case "dealer": {');
const caseEnd = html.indexOf("case \"skater\": {", caseIdx);
const caseText = html.slice(caseIdx, caseEnd);
check("dealer case is well-formed before the skater case", caseIdx >= 0 && caseEnd > caseIdx);
check(
  "dealer punch cites the 'dealer' write-up offense (licensed community enterprise, not a hazard)",
  caseText.indexOf('hurtNPC(HP_HIT_HAZARD, "dealer")') >= 0,
);

const group = () => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } });
function makeC() {
  return {
    type: "dealer",
    wx: 100,
    wy: 5.6,
    g: group(),
    head: group(),
    punchArm: group(),
    baseZ: 0.47,
    sp: 0,
    attackCd: 0,
    punchT: 0,
    headT: 0,
    talkCd: 0,
  };
}
function makeP(x, y) {
  return { wx: x, wy: y, invuln: 0, immuneT: 0, bloodSteps: 0 };
}
const voices = [];
const rec = { hurt: 0, dmg: 0, stun: 0, blood: 0, dust: 0 };
const Voice = { say: (t) => voices.push(t) };
const hurtNPC = (a, cause) => {
  rec.hurt++;
  rec.dmg += a;
  rec.cause = cause;
};
const doStun = () => rec.stun++;
const dropBloodSplatter = () => rec.blood++;
const spawnDustEffect = () => rec.dust++;
const state = "play";
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const GZ = 0.3;
const HP_HIT_HAZARD = 5;
const WORKER_GENDER = "male";
const workerMaxY = () => 8.0;

function runCase(c, p, dt) {
  const fn = new Function(
    "c",
    "p",
    "dt",
    "state",
    "R",
    "pick",
    "clamp",
    "GZ",
    "Voice",
    "hurtNPC",
    "doStun",
    "dropBloodSplatter",
    "spawnDustEffect",
    "workerMaxY",
    "HP_HIT_HAZARD",
    "WORKER_GENDER",
    "switch (c.type) { " + caseText + " }",
  );
  fn(c, p, dt, state, R, pick, clamp, GZ, Voice, hurtNPC, doStun, dropBloodSplatter, spawnDustEffect, workerMaxY, HP_HIT_HAZARD, WORKER_GENDER);
}

// (a) idle: head sweeps suspiciously, body never moves
let c = makeC();
let p = makeP(110, 2.0);
const wx0 = c.wx,
  wy0 = c.wy;
let sawSweep = false;
for (let f = 0; f < 40; f++) {
  runCase(c, p, 0.016);
  if (Math.abs(c.head.rotation.z) > 0.05) sawSweep = true;
}
check("idle head sweep is suspicious (rotates over time)", sawSweep);
check("dealer never moves (static on the stoop)", c.wx === wx0 && c.wy === wy0);

// (b) head locks onto a close worker (dW < 9): worker at +X -> yaw ~ +PI/2
c = makeC();
p = makeP(108, 5.6);
for (let f = 0; f < 60; f++) runCase(c, p, 0.1);
check(
  "head locks onto the worker when he's close (yaw ~ PI/2 for +X worker)",
  Math.abs(c.head.rotation.z - Math.PI / 2) < 0.15,
);

// (c) punch: damage + stun + blood + dust + both lines + knockback
c = makeC();
c.talkCd = 5; // suppress sales line so we isolate the punch speech
p = makeP(100.5, 4.2); // dW ~ 1.49 < 2.2
const dist0 = Math.hypot(p.wx - c.wx, p.wy - c.wy);
runCase(c, p, 0.016);
check("punch deals 5 HP (HP_HIT_HAZARD) exactly once", rec.hurt === 1 && rec.dmg === 5);
check("punch stuns the worker", rec.stun === 1);
check("punch leaves a blood splatter + blood steps", rec.blood === 1 && p.bloodSteps === 10);
check("punch kicks up dust", rec.dust === 1);
const punchLines = [
  "Stay away from my stash!",
  "I know you undercover!",
  "You messing with me?!",
];
check("dealer yells one of his 3 punch lines", punchLines.some((l) => voices.includes(l)));
check("worker reacts with 'Ow! Damn drug dealers!'", voices.includes("Ow! Damn drug dealers!"));
const dist1 = Math.hypot(p.wx - c.wx, p.wy - c.wy);
check("worker is knocked BACK away from the dealer", dist1 > dist0 + 0.5);
check("punch arm extended during the swing (rotation.y < 0)", c.punchArm.rotation.y < 0);
check("punch cooldown set to 3.5s", c.attackCd > 3.4 && c.attackCd <= 3.5);
check("punch records the 'dealer' offense cause for the write-up", rec.cause === 'dealer');

// (d) no double punch while the cooldown runs
p = makeP(100.5, 4.2);
runCase(c, p, 0.016);
runCase(c, p, 0.016);
check("no second punch while cooldown is active", rec.hurt === 1);
c.attackCd = 0; // cooldown expires -> can punch again
runCase(c, p, 0.016);
check("punches again once the cooldown expires", rec.hurt === 2);

// (e) sales pitch: fires within 11, then not again until the cooldown lapses
voices.length = 0;
c = makeC();
p = makeP(106, 3.0); // dW ~ 6.5: in sales range, out of punch range
runCase(c, p, 0.016);
const sales = [
  "Get yo weed here!",
  "Weed half price today",
  "You look like you smoke!",
  "Don't play with me",
  "If you see the police, warn a brother!",
];
check("sales pitch fires when the worker is in range", sales.some((l) => voices.includes(l)));
voices.length = 0;
runCase(c, p, 0.016);
check("sales pitch is on a cooldown (no instant repeat)", voices.length === 0);
c.talkCd = 0;
runCase(c, p, 0.016);
check("sales pitch can fire again after the cooldown", voices.length === 1);

console.log(`\nDEALER RESULT: ${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);