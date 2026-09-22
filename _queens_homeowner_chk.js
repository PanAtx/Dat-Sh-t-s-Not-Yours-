// _queens_homeowner_chk.js — verify the Maspeth (Queens) nosy HOMEOWNER NPC +
// no-breakers-on-Queens in index.html:
//   - no breakers spawn on Queens (npcCounts gate)
//   - HOMEOWNER_QUESTIONS: exactly 32 stupid questions
//   - addCreature case "homeowner" (makePerson, MIXED gender, follow fields)
//   - AI: follows the worker ~2.2u gap, WAVES both arms (armL/armR rotation.x),
//     asks questions every 2.4-3.6s, rests after 3-4 houses (24-32u)
//   - bump: arcade-bump gate (very minor 1HP), "MY property!" line, write-up lines,
//     collision radius, flying-can hittable
//   - spawn: ONE per Queens level, just ahead of the worker's start
'use strict';
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// 1) all inline scripts still parse
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,
  n = 0,
  ok = true;
while ((m = re.exec(src))) {
  n++;
  try {
    new vm.Script(m[1], { filename: "inline" + n + ".js" });
  } catch (e) {
    ok = false;
    console.log("SYNTAX FAIL script #" + n + ": " + e.message);
  }
}
console.log(
  "inline scripts checked: " + n + (ok ? " — ALL SYNTAX OK" : " — SYNTAX ERRORS"),
);

let pass = ok;
const check = (name, c, e) => {
  console.log((c ? "PASS" : "FAIL") + "  " + name + (c ? "" : "  [" + e + "]"));
  if (!c) pass = false;
};

// ================= 1. NO BREAKERS ON QUEENS =================
check(
  "npcCounts: breakers zeroed on Queens (isQueensLevel gate)",
  /if\s*\(isQueensLevel\(\)\s*&&\s*t\s*===\s*"breaker"\s*\)\s*base\s*=\s*0\s*;/.test(src)
);
check(
  "npcCounts: the day-2 (Bronx) breaker gate is untouched",
  /if\s*\(day\s*===\s*2\s*&&\s*t\s*===\s*"breaker"\s*\)\s*base\s*=\s*0\s*;/.test(src)
);

// ================= 2. THE 32 STUPID QUESTIONS =================
const qSec = (() => {
  const i = src.indexOf("const HOMEOWNER_QUESTIONS = [");
  if (i < 0) return "";
  return src.slice(i, src.indexOf("];", i));
})();
const qLines = qSec.split("\n").map((l) => l.trim()).filter((l) => l.startsWith('"'));
check("HOMEOWNER_QUESTIONS has EXACTLY 32 questions", qLines.length === 32, "count=" + qLines.length);
check(
  "questions cover the required topics (days, dead rat, how much, coming back, what kind)",
  qSec.indexOf("dead rat") >= 0 &&
    qSec.toLowerCase().indexOf("how much trash") >= 0 &&
    qSec.indexOf("coming again") >= 0 &&
    qSec.indexOf("Tuesday") >= 0 &&
    qSec.indexOf("mattress") >= 0
);
check(
  "every question is a question (contains ?)",
  qLines.every((l) => l.indexOf("?") >= 0)
);

// ================= 3. addCreature WIRING =================
const addSec = (() => {
  const i = src.indexOf('case "homeowner":');
  if (i < 0) return "";
  return src.slice(i, i + 900);
})();
check(
  'addCreature: case "homeowner" builds a makePerson (male-or-female, MIXED voice)',
  addSec.indexOf("makePerson(") >= 0 &&
    addSec.indexOf("skin: pick(POLISH_SKIN)") < 0 // not the caucasian-forced polish look
);
check(
  "homeowner is NOT force-male or force-female (falls to MIXED)",
  !/type === "homeowner"/.test(
    src.slice(src.indexOf("const MIXED ="), src.indexOf("switch (type) {"))
  )
);
check(
  "addCreature seeds the follow state (followed, followMax 24-32u, askCd, cool, waveT)",
  addSec.indexOf("c.followed = 0") >= 0 &&
    addSec.indexOf("c.followMax = R(24, 32)") >= 0 &&
    addSec.indexOf("c.askCd = 0.8") >= 0 &&
    addSec.indexOf("c.cool = 0") >= 0 &&
    addSec.indexOf("c.waveT") >= 0
);

// ================= 4. AI (updateCreatures) =================
const aiSec = (() => {
  const u = src.indexOf("function updateCreatures(");
  const i = src.indexOf('case "homeowner":', u);
  if (i < 0) return "";
  return src.slice(i, i + 2400);
})();
check(
  "AI: case \"homeowner\" exists (its own case, no per-frame rebuild)",
  aiSec.length > 0 && aiSec.indexOf("makePerson") < 0 && aiSec.indexOf("break;") >= 0
);
check(
  "AI: follows the worker (2.2u gap, keeps pace on the sidewalk 1.2..4.4)",
  aiSec.indexOf("hdist > 2.2") >= 0 &&
    aiSec.indexOf("clamp(c.wy + (hdy / hdist)") >= 0 &&
    aiSec.indexOf("1.2, 4.4") >= 0
);
check(
  "AI: WAVES both arms while following (armL + armR rotation.x oscillation)",
  aiSec.indexOf("c.parts.armL.rotation.x = 1.35 + Math.sin(c.waveT * 7)") >= 0 &&
    aiSec.indexOf("c.parts.armR.rotation.x") >= 0
);
check(
  "AI: drops a random question every 2.4-3.6s while in earshot (<26u)",
  aiSec.indexOf("pick(HOMEOWNER_QUESTIONS)") >= 0 &&
    aiSec.indexOf("hdist < 26") >= 0 &&
    aiSec.indexOf("R(2.4, 3.6)") >= 0
);
check(
  "AI: rests after 3-4 houses (followMax reached -> cool 5-8s, then follows again)",
  aiSec.indexOf("c.followed >= c.followMax") >= 0 &&
    aiSec.indexOf("c.cool = R(5, 8)") >= 0
);

// ================= 5. BUMP = MINOR DAMAGE =================
check(
  "bump GATE includes homeowner (arcade-bump, very minor 1HP nick)",
  src.indexOf('c.type === "homeowner" ||') >= 0 &&
    src.indexOf("HP_HIT_BUMPER = 1") >= 0
);
check('bump line: "Hey! Watch it — this is MY property!"', src.indexOf('"Hey! Watch it — this is MY property!"') >= 0);
check("collision radius: homeowner rad 0.85", /c\.type === "homeowner"\) rad = 0\.85/.test(src));
check(
  "flying cans: homeowner is a hittable civilian",
  /function checkFlyingCanNpcHit[\s\S]{0,700}c\.type === "homeowner" \|\|/.test(src)
);
check(
  "WRITTEN UP!: homeowner has its own offense lines",
  (() => {
    const i = src.indexOf("const WRITEUP_REASONS = {");
    const seg = src.slice(i, i + 600);
    return seg.indexOf("homeowner: [") >= 0 && seg.indexOf("trash schedule") >= 0;
  })()
);

// ================= 6. SPAWN: ONE PER QUEENS LEVEL =================
const spawnSec = (() => {
  const i = src.indexOf("The nosy homeowner: ONE per Maspeth level");
  if (i < 0) return "";
  return src.slice(i, i + 400);
})();
check(
  "spawn: one homeowner per Queens level, just ahead of the worker's start",
  spawnSec.indexOf('addCreature("homeowner")') >= 0 &&
    spawnSec.indexOf("PLAYER_START_X + R(20, 40)") >= 0
);
check(
  "spawn: inside the Queens gate (same block as the polish ladies/boy)",
  src.lastIndexOf("if (isQueensLevel())", src.indexOf("The nosy homeowner")) > 0 &&
    src.lastIndexOf("if (isQueensLevel())", src.indexOf("The nosy homeowner")) <
      src.indexOf("The nosy homeowner")
);

console.log(pass ? "HOMEOWNER CHECKS PASSED" : "QUEENS HOMEOWNER: FAILURES ABOVE");