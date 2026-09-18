// _scholar_chk.js — validate the Flatbush-only observant Jewish scholar in index.html
// 1) roster entry + model builder (black hat/coat/pants/shoes, white shirt, white
//    beard + payot, Talmud under the arm, CAUCASIAN skin only, animParts pivots)
// 2) spawn rules (Flatbush/Brooklyn ONLY, 2, on the sidewalk, spread along the route)
// 3) wiring (addCreature case, updateCreatures case, collide radius, bubble CSS,
//    spawnBubble speaker mapping)
// 4) the 9 "wise sayings" + the minor damage constant + the write-up reason
// 5) RUNTIME: runs the REAL collideCreatures "scholar" bump branch - the scholar
//    drops a saying, the worker says "Sorry, I didn't see you!", minor damage is
//    tagged to the scholar, the cooldown holds, and the worker is pushed back.
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
// Extract a top-level `if (...) { ... }` block by brace-counting from its opening brace.
function extractIfBlock(marker) {
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error("block not found: " + marker);
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
function extractObject(name) {
  const start = html.indexOf(name + " = {");
  if (start < 0) throw new Error("object not found: " + name);
  const b = html.indexOf("{", start);
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
  return html.slice(b, i);
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
  "scholar is in BASE_NPC_COUNTS at 0 (spawned separately, Flatbush-only)",
  /scholar:\s*0,/.test(baseSrc),
);
check("makeScholar() builder exists", html.indexOf("function makeScholar(") >= 0);
const s = extractFn("makeScholar");
check(
  "black hat (dark hatM material + brim + crown)",
  /hatM = M\(0x1[0-9a-f]{5}\)/.test(s) && /brim/.test(s) && /crown/.test(s),
);
check("black coat", /coatM = M\(0x1[0-9a-f]{5}\)/.test(s));
check("white shirt", /shirtM = M\(0xf[0-9a-f]{5}\)/.test(s));
check("black pants", /pantsM = M\(0x[01][0-9a-f]{5}\)/.test(s));
check("black shoes", /shoeM = M\(0x0[0-9a-f]{5}\)/.test(s));
check("grey beard + side payot (mid-grey, distinct from the near-white shirt)", /beardM = M\(0x[789a][0-9a-f]{5}\)/.test(s) && /payot/.test(s));
check(
  "a Talmud book under the arm (cover + cream pages)",
  /bookCover/.test(s) && /pagesM/.test(s) && /book/.test(s) && /pages/.test(s),
);
check(
  "CAUCASIAN skin only (a fixed hex, and NOT pick(SKIN_TONES))",
  s.indexOf("const skin = M(0x") >= 0 && s.indexOf("pick(SKIN_TONES)") < 0,
);
check("head on its own pivot (userData.head)", s.indexOf("g.userData.head = headPivot") >= 0);
check(
  "legs/arms on pivots for the animParts walk (userData.parts)",
  /g\.userData\.parts = \{ legL: legL, legR: legR, armL: armL, armR: armR \}/.test(s),
);
console.log("[2] spawn rules");
const spawnIdx = html.indexOf("// Brooklyn / Flatbush: an observant Orthodox Jewish scholar");
check("Flatbush scholar spawn block found", spawnIdx >= 0);
const spawnBlock = html.slice(spawnIdx, html.indexOf("// Crazy homeless guy", spawnIdx));
check(
  "scholar spawn is gated to Flatbush (Brooklyn) levels ONLY",
  spawnBlock.indexOf("if (isFlatbushLevel()) {") >= 0,
);
check(
  "scholar is NOT gated to any other borough",
  spawnBlock.indexOf("isManhattanLevel") < 0 && spawnBlock.indexOf("isBronxLevel") < 0,
);
check("exactly 2 scholars per Flatbush level", /for \(let sI = 0; sI < 2; sI\+\+\)/.test(spawnBlock));
check(
  "scholar stands on the sidewalk (wy in the 1.2..4.2 band)",
  spawnBlock.indexOf("sc.wy = R(1.2, 4.2)") >= 0,
);
check(
  "scholar spread along the Flatbush route (wx = p.wx + R(15, 90))",
  spawnBlock.indexOf("sc.wx = p.wx + R(15, 90)") >= 0,
);

console.log("[3] wiring");
const addCreatureSrc = html.slice(html.indexOf("function addCreature("), html.indexOf("function updateCreatures("));
const schCaseStart = addCreatureSrc.indexOf('case "scholar":');
check('addCreature has case "scholar"', schCaseStart >= 0);
const schCase = addCreatureSrc.slice(schCaseStart, addCreatureSrc.indexOf('case "skater":', schCaseStart));
check("scholar built from makeScholar()", schCase.indexOf("c.data = makeScholar()") >= 0);
check("scholar speaks as a man (male)", schCase.indexOf('c.gender = "male"') >= 0);
check("scholar has a slow, dignified stroll (sp ~0.7-1.0)", schCase.indexOf("c.sp = R(0.7, 1.0)") >= 0);
check('updateCreatures has a "scholar" case', html.indexOf('case "scholar": {') >= 0);
check(
  "scholar is BI-DIRECTIONAL at spawn (c.dir = random ±1, walks his own way)",
  schCase.indexOf("c.dir = Math.random() < 0.5 ? -1 : 1") >= 0,
);
check(
  "scholar update case walks in EITHER direction + animates (and keeps to the sidewalk)",
  (function () {
    const uc = html.slice(
      html.indexOf('case "scholar": {'),
      html.indexOf('case "ped":', html.indexOf('case "scholar": {')),
    );
    return (
      uc.indexOf("c.wx += c.dir * c.sp * dt") >= 0 &&
      uc.indexOf("c.dir >= 0 ? 0 : Math.PI") >= 0 &&
      (uc.match(/c\.dir = Math\.random\(\) < 0\.5 \? -1 : 1; \/\/ re-pick a direction on recycle/g) || []).length === 2 &&
      uc.indexOf("animParts(") >= 0
    );
  })(),
);
check("collideCreatures gives the scholar a solid radius", /c\.type === "scholar"\) rad = 0\.85;/.test(html));
check("bubble CSS for the scholar speaker", /bub-scholar \{/.test(html));
check(
  "spawnBubble maps the scholar speaker",
  /speaker === "scholar"\) cls = "bubble bub-scholar";/.test(html),
);
console.log("[4] wise sayings + damage + write-up");
check(
  "HP_HIT_SCHOLAR is MINOR damage (2, like the jacker, far below a vehicle's 8)",
  html.indexOf("const HP_HIT_SCHOLAR = 2;") >= 0,
);
const sayIdx = html.indexOf("const SCHOLAR_SAYINGS = [");
const saySrc = html.slice(sayIdx, html.indexOf("];", sayIdx));
const EXPECTED_SAYINGS = [
  "Hak mir nisht keyn tshaynik",
  "A klug tsu der kolir",
  "Red tsum lomp",
  "Men tor nisht vern tsu zat",
  "A shvester fun a bokser",
  "Tsufil iz ungezunt",
  "Zol vaksn tsibeles in zayn boykh",
  "Der mentsh trakht un got lakht",
  "Shvarts un finster",
];
EXPECTED_SAYINGS.forEach((ln) =>
  check('wise saying present: ' + JSON.stringify(ln), saySrc.indexOf('"' + ln + '"') >= 0),
);
const REASONS = eval("(" + extractObject("const WRITEUP_REASONS") + ")");
check(
  "WRITEUP_REASONS.scholar carries the observant-citizen line",
  REASONS.scholar && REASONS.scholar.indexOf("Failure to respect observant citizen") >= 0,
);
const writeupReason = new Function(
  "WRITEUP_REASONS",
  extractFn("writeupReason") + "\n;return writeupReason;",
)(REASONS);
check(
  "writeupReason('scholar') stamps the EXACT line",
  writeupReason("scholar") === "Failure to respect observant citizen",
);

console.log("[5] RUNTIME: real collideCreatures scholar bump branch");
const bumpSrc = extractIfBlock('if (c.type === "scholar") {');
check(
  "bump branch exists in collideCreatures and damages as the scholar",
  !!bumpSrc && /hurtNPC\(HP_HIT_SCHOLAR, "scholar"/.test(bumpSrc),
);
const voices = [];
const Voice = {
  say: (t, gap, pitch, bx, by, gender, speaker) => voices.push({ t: t, speaker: speaker }),
};
const rec = { hurt: 0, dmg: 0, cause: null };
function hurtNPC(amt, cause) {
  rec.hurt++;
  rec.dmg += amt;
  rec.cause = cause;
}
let dust = 0;
function spawnDustEffect() {
  dust++;
}
function workerMaxY() {
  return 8.0;
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R = (a, b) => a + 0.5 * (b - a);
const pick = (arr) => arr[0];
const WORKER_GENDER = "male";
const HP_HIT_SCHOLAR = 2;
const runBump = new Function(
  "c",
  "p",
  "d2",
  "dx",
  "dy",
  "rad",
  "Voice",
  "pick",
  "SCHOLAR_SAYINGS",
  "R",
  "WORKER_GENDER",
  "hurtNPC",
  "HP_HIT_SCHOLAR",
  "spawnDustEffect",
  "workerMaxY",
  "clamp",
  bumpSrc,
);
function freshC() {
  return { type: "scholar", wx: 50, wy: 3.0, gender: "male", sayCd: 0 };
}
function freshP() {
  return { wx: 50.5, wy: 3.0 };
}
function run(c, p) {
  const dx = c.wx - p.wx,
    dy = c.wy - p.wy;
  const d2 = dx * dx + dy * dy;
  runBump(
    c, p, d2, dx, dy, 0.85, Voice, pick, EXPECTED_SAYINGS, R, WORKER_GENDER,
    hurtNPC, HP_HIT_SCHOLAR, spawnDustEffect, workerMaxY, clamp,
  );
}
function dist() {
  return Math.hypot(c.wx - p.wx, c.wy - p.wy);
}

// (a) first bump: a saying + the apology + minor damage + push-back + cooldown
let c = freshC(),
  p = freshP();
const dist0 = dist();
run(c, p);
check(
  "scholar drops one of his 9 wise sayings",
  voices.some((v) => v.speaker === "scholar" && EXPECTED_SAYINGS.indexOf(v.t) >= 0),
);
check(
  "worker apologizes with 'Sorry, I didn't see you!'",
  voices.some((v) => v.speaker === "worker" && v.t === "Sorry, I didn't see you!"),
);
check("the bump does MINOR damage (exactly 2 HP, not a vehicle hit)", rec.hurt === 1 && rec.dmg === 2);
check("the offense is recorded as the scholar (feeds the write-up stamp)", rec.cause === "scholar");
check("the worker is pushed BACK away from the scholar (solid)", dist() > dist0 + 0.05);
check("dust kicked up on the bump", dust === 1);
check("saying cooldown armed (~2.5s)", c.sayCd > 2.4);

// (b) no repeat while the cooldown runs
voices.length = 0;
rec.hurt = 0;
rec.dmg = 0;
p = freshP();
run(c, p);
check("no second saying / damage while the cooldown runs", voices.length === 0 && rec.hurt === 0);

// (c) says again once the cooldown lapses
voices.length = 0;
rec.hurt = 0;
rec.dmg = 0;
c.sayCd = 0;
p = freshP();
run(c, p);
check(
  "scholar says again once the cooldown lapses",
  voices.some((v) => v.speaker === "scholar" && EXPECTED_SAYINGS.indexOf(v.t) >= 0) && rec.hurt === 1,
);

console.log("\nSCHOLAR RESULT: " + pass + " ok, " + fail + " FAIL");
process.exit(fail ? 1 : 0);


