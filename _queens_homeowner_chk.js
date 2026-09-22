// _queens_homeowner_chk.js — verify the Maspeth (Queens) nosy HOMEOWNER NPC +
// no-breakers-on-Queens in index.html:
//   - no breakers spawn on Queens (npcCounts gate)
//   - HOMEOWNER_QUESTIONS: exactly 32 stupid questions
//   - addCreature case "homeowner" (makePerson, MIXED gender, follow fields,
//     unique per-block outfit)
//   - AI: follows the worker ~2.2u gap, WAVES BOTH ARMS TO THE SIDES (left left,
//     right right, alternating rotation.y), asks questions every 2.4-3.6s,
//     rests after 3-4 houses (24-32u), STAYS ON ITS BLOCK (blockMinX/blockMaxX),
//     USED-CAR-SALESMAN mannerisms (sales patter, pitch lean, point gesture,
//     hands-on-hips rest, feet always moving)
//   - bump: arcade-bump gate (very minor 1HP), "MY property!" line, write-up lines,
//     collision radius, flying-can hittable
//   - spawn: ONE PER ACTIVE BLOCK, each with a unique outfit color
//   - speech bubbles: clamped on-screen, comic tail pointing at the speaker,
//     pop-scale in animation (bursts have no tail)
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
  return src.slice(i, i + 1200);
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
  "addCreature seeds the follow state (followed, followMax 24-32u, askCd, cool, waveT, pointT)",
  addSec.indexOf("c.followed = 0") >= 0 &&
    addSec.indexOf("c.followMax = R(24, 32)") >= 0 &&
    addSec.indexOf("c.askCd = 0.8") >= 0 &&
    addSec.indexOf("c.cool = 0") >= 0 &&
    addSec.indexOf("c.waveT") >= 0 &&
    addSec.indexOf("c.pointT = 0") >= 0
);
check(
  "addCreature: unique per-block outfit (c.outfit feeds the shirt, fallback SHIRTS)",
  addSec.indexOf("c.outfit != null ? c.outfit : pick(SHIRTS)") >= 0
);
check(
  "HOMEOWNER_OUTFITS palette exists with 8 distinct outfit colors",
  (() => {
    const i = src.indexOf("const HOMEOWNER_OUTFITS = [");
    if (i < 0) return false;
    const seg = src.slice(i, src.indexOf("];", i));
    const colors = seg.match(/0x[0-9a-f]{6}/gi) || [];
    return colors.length >= 8 && new Set(colors.map((c) => c.toLowerCase())).size === colors.length;
  })(),
  "palette too small or duplicate colors"
);

// ================= 4. AI (updateCreatures) =================
const aiSec = (() => {
  const u = src.indexOf("function updateCreatures(");
  const i = src.indexOf('case "homeowner":', u);
  if (i < 0) return "";
  return src.slice(i, i + 4720);
})();
check(
  "AI: case \"homeowner\" exists (its own case, no per-frame rebuild)",
  aiSec.length > 0 && aiSec.indexOf("makePerson") < 0 && aiSec.indexOf("break;") >= 0
);
check(
  "AI: follows the worker (2.2u gap, keeps pace on the sidewalk 1.2..4.4)",
  aiSec.indexOf("hdist > 2.2") >= 0 &&
    aiSec.indexOf("clamp(c.wy + mvy * hsp * dt, 1.2, 4.4)") >= 0 &&
    aiSec.indexOf("1.2, 4.4") >= 0
);
check(
  "AI: WAVES BOTH ARMS TO THE SIDES — left arm left, right arm right, alternating (rotation.y)",
  aiSec.indexOf("c.parts.armL.rotation.y = -(1.0 + Math.sin(c.waveT * 6) * 0.55)") >= 0 &&
    aiSec.indexOf("1.0 + Math.sin(c.waveT * 6 + Math.PI) * 0.55") >= 0
);
check(
  "AI: wave is NOT the old arm-across-the-body rotation.x flap",
  aiSec.indexOf("c.parts.armL.rotation.x = 1.35") < 0
);
check(
  "AI: STAYS ON ITS BLOCK (x clamped to blockMinX..blockMaxX, never crosses the street)",
  aiSec.indexOf("c.wx = clamp(c.wx, c.blockMinX, c.blockMaxX)") >= 0
);
check(
  "AI: rest drift has the FEET moving (animParts while drifting, no sliding)",
  aiSec.indexOf("animParts(c, 0.8 * dt * 2.4)") >= 0
);
check(
  "AI: TURNS to walk where he's going (x-first movement, face travel direction)",
  aiSec.indexOf("Math.abs(hdx) < 1.6") >= 0 &&
    aiSec.indexOf("c.g.rotation.z = mvx >= 0 ? 0 : Math.PI") >= 0
);
check(
  "AI: salesman mannerisms (pitch lean/nod, point gesture, hands-on-hips rest)",
  aiSec.indexOf("c.parts.upper.rotation.y = 0.14 + Math.sin(c.waveT * 6) * 0.06") >= 0 &&
    aiSec.indexOf("c.parts.armR.rotation.x = -1.25") >= 0 &&
    aiSec.indexOf("c.parts.armL.rotation.y = -2.7") >= 0 &&
    aiSec.indexOf("c.parts.armR.rotation.y = 2.7") >= 0
);
check(
  "AI: speech is 60% trash questions / 40% used-car-salesman patter",
  aiSec.indexOf("Math.random() < 0.6") >= 0 &&
    aiSec.indexOf("pick(HOMEOWNER_SALES)") >= 0
);
check(
  "HOMEOWNER_SALES pool: 16+ salesman lines (buddy/sir pitches)",
  (() => {
    const i = src.indexOf("const HOMEOWNER_SALES = [");
    if (i < 0) return false;
    const seg = src.slice(i, src.indexOf("];", i));
    const lines = seg.split("\n").map((l) => l.trim()).filter((l) => l.startsWith('"'));
    return (
      lines.length >= 16 &&
      seg.toLowerCase().indexOf("buddy") >= 0 &&
      seg.toLowerCase().indexOf("sir") >= 0
    );
  })(),
  "pool too small or missing buddy/sir"
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

// ================= 6. SPAWN: ONE PER ACTIVE BLOCK, UNIQUE OUTFITS =================
const spawnSec = (() => {
  const i = src.indexOf("The nosy homeowners: ONE PER ACTIVE BLOCK");
  if (i < 0) return "";
  return src.slice(i, i + 1400);
})();
check(
  "spawn: one homeowner PER ACTIVE BLOCK (filter active blocks x 96..576)",
  spawnSec.indexOf('addCreature("homeowner", {') >= 0 &&
    spawnSec.indexOf("b.garbage === true && b.x >= 96 && b.x <= 576") >= 0 &&
    spawnSec.indexOf("bx + R(20, 60)") >= 0
);
check(
  "spawn: each block gets a UNIQUE outfit from the shuffled queue",
  spawnSec.indexOf("outfit: homeownerOutfitQueue[i % homeownerOutfitQueue.length]") >= 0 &&
    spawnSec.indexOf("HOMEOWNER_OUTFITS.slice().sort(") >= 0
);
check(
  "spawn: each homeowner is clamped to its block (blockMinX = bx + 4, blockMaxX = bx + 76)",
  spawnSec.indexOf("ho.blockMinX = bx + 4") >= 0 &&
    spawnSec.indexOf("ho.blockMaxX = bx + 76") >= 0
);
check(
  "spawn: inside the Queens gate (same block as the polish ladies/boy)",
  src.lastIndexOf("if (isQueensLevel())", src.indexOf("The nosy homeowners")) > 0 &&
    src.lastIndexOf("if (isQueensLevel())", src.indexOf("The nosy homeowners")) <
      src.indexOf("The nosy homeowners")
);

// ================= 7. SPEECH BUBBLES: ON SCREEN + TAIL + POP =================
check(
  "bubbles: updateBubbles clamps the rendered box into the viewport (top/bottom/left/right)",
  (() => {
    const i = src.indexOf("function updateBubbles(");
    if (i < 0) return false;
    const seg = src.slice(i, i + 2200);
    return (
      seg.indexOf("getBoundingClientRect()") >= 0 &&
      seg.indexOf("innerHeight - m") >= 0 &&
      seg.indexOf("innerWidth - m") >= 0 &&
      seg.indexOf("r.top < m") >= 0
    );
  })()
);
check(
  "bubbles: comic tail pointing at the speaker (.bubble::after triangle)",
  (() => {
    const i = src.indexOf(".bubble::after");
    if (i < 0) return false;
    const seg = src.slice(i, i + 400);
    return (
      seg.indexOf("border-top: 10px solid #14141a") >= 0 &&
      src.indexOf(".bub-burst::after") >= 0 &&
      src.slice(src.indexOf(".bub-burst::after"), src.indexOf(".bub-burst::after") + 120)
        .indexOf("display: none") >= 0
    );
  })()
);
check(
  "bubbles: pop-scale in animation (@keyframes bubblePop with scale overshoot)",
  (() => {
    const i = src.indexOf("@keyframes bubblePop");
    if (i < 0) return false;
    const seg = src.slice(i, i + 400);
    return (
      seg.indexOf("scale(0)") >= 0 &&
      seg.indexOf("scale(1.1)") >= 0 &&
      seg.indexOf("scale(1)") >= 0
    );
  })()
);

console.log(pass ? "HOMEOWNER CHECKS PASSED" : "QUEENS HOMEOWNER: FAILURES ABOVE");