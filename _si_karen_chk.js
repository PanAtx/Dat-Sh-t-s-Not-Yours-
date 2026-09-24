// _si_karen_chk.js — verify the Staten Island (New Dorp, day 5) KAREN NPC in
// index.html — the annoying female version of the Maspeth nosy homeowner:
//   - KAREN_QUESTIONS / KAREN_COMPLAINTS / KAREN_BYE line pools
//   - addCreature case "karen" (makePerson with the classic Karen DRESS, FEMALE
//     gender, unique per-block outfit, same follow fields as the homeowner)
//   - spawn: ONE PER ODD-NUMBERED SI BLOCK (1, 3, 5, 7 — x 0, 192, 384, 576),
//     unique dress color, STAYS ON HER BLOCK (bx+4 / bx+76), SI-gated only
//   - AI: shadows the worker 3-4 houses, arms flapping to the sides, ALWAYS
//     faces the worker in 3D (atan2), cycles questions/complaints every
//     2.4-3.6s, rests (hands at chest), CLOSING RANT when you leave, never
//     crosses the street
//   - bump: arcade-bump gate (very minor 1HP), "CONCERNED CITIZEN" line,
//     collision radius 0.85, flying-can hittable
//   - WRITTEN UP!: "Failed to obligate a disgruntled homeowner"
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

// ================= 1. THE LINE POOLS =================
const countLines = (i) => {
  const j = src.indexOf("];", i);
  return src.slice(i, j).split("\n").filter((l) => l.trim().startsWith('"')).length;
};
check(
  "KAREN_QUESTIONS: 12+ 'expert' trash questions (incl. the electronics one)",
  (() => {
    const i = src.indexOf("const KAREN_QUESTIONS = [");
    if (i < 0) return false;
    return (
      countLines(i) >= 12 &&
      src.slice(i, i + 1400).indexOf("electronics") >= 0
    );
  })()
);
check(
  "KAREN_COMPLAINTS: 12+ berates (poor job, calling the boss, lazy)",
  (() => {
    const i = src.indexOf("const KAREN_COMPLAINTS = [");
    if (i < 0) return false;
    const seg = src.slice(i, i + 1400);
    return (
      countLines(i) >= 12 &&
      seg.indexOf("POOR JOB") >= 0 &&
      seg.indexOf("boss") >= 0 &&
      seg.indexOf("LAZY") >= 0
    );
  })()
);
check(
  "KAREN_BYE: the closing rant (fires when the worker leaves her block)",
  (() => {
    const i = src.indexOf("const KAREN_BYE = [");
    return i >= 0 && countLines(i) >= 2;
  })()
);
check(
  "KAREN_OUTFITS: a unique-dress palette + per-level queue",
  (() => {
    const i = src.indexOf("const KAREN_OUTFITS = [");
    if (i < 0) return false;
    const hex = src
      .slice(i, src.indexOf("];", i))
      .split("\n").filter((l) => /^\s*0x/.test(l)).length;
    return hex >= 4 && src.indexOf("let karenOutfitQueue = [];") >= 0;
  })()
);

// ================= 2. addCreature: THE KAREN =================
const addSec = (() => {
  const u = src.indexOf("function addCreature(");
  const i = src.indexOf('case "karen":', u);
  if (i < 0) return "";
  return src.slice(i, i + 1500);
})();
check(
  'addCreature has case "karen" (makePerson, KAREN DRESS, unique per-block outfit, follow fields)',
  addSec.indexOf("makePerson(") >= 0 &&
    addSec.indexOf("skirt: true") >= 0 &&
    addSec.indexOf("c.outfit != null ? c.outfit : pick(KAREN_OUTFITS)") >= 0 &&
    addSec.indexOf("c.followMax = R(24, 32)") >= 0 &&
    addSec.indexOf("c.bye = false") >= 0
);
check(
  "karen is FEMALE (the female gender list)",
  /type === "lady"[\s\S]{0,200}?type === "karen"[\s\S]{0,200}?"female"/.test(src)
);

// ================= 3. SPAWN: ONE PER ODD-NUMBERED SI BLOCK =================
const spawnSec = (() => {
  const i = src.indexOf("The Staten Island KARENS (New Dorp, day 5)");
  if (i < 0) return "";
  return src.slice(i, i + 1500);
})();
check(
  "spawn: ONE PER ODD-NUMBERED BLOCK (blocks 1, 3, 5, 7 — the (i + 1) % 2 === 1 filter)",
  spawnSec.indexOf("LEVEL_BLOCKS.filter((b, i) => (i + 1) % 2 === 1)") >= 0 &&
    spawnSec.indexOf('addCreature("karen", {') >= 0
);
check(
  "spawn: each Karen wears a UNIQUE dress from the shuffled KAREN_OUTFITS queue",
  spawnSec.indexOf("outfit: karenOutfitQueue[i % karenOutfitQueue.length]") >= 0 &&
    spawnSec.indexOf("KAREN_OUTFITS.slice().sort(") >= 0
);
check(
  "spawn: each Karen is clamped to her block (blockMinX = bx + 4, blockMaxX = bx + 76)",
  spawnSec.indexOf("k.blockMinX = bx + 4") >= 0 &&
    spawnSec.indexOf("k.blockMaxX = bx + 76") >= 0
);
check(
  "spawn: inside the Staten Island gate (isStatenIslandLevel)",
  src.lastIndexOf("if (isStatenIslandLevel())", src.indexOf("The Staten Island KARENS")) >
    0 &&
    src.lastIndexOf(
      "if (isStatenIslandLevel())",
      src.indexOf("The Staten Island KARENS"),
    ) < src.indexOf("The Staten Island KARENS")
);
check(
  "spawn: EXACTLY ONE Karen spawn site (Staten Island only — no other borough gets her)",
  (() => {
    let c = 0,
      i = 0;
    while ((i = src.indexOf('addCreature("karen"', i)) >= 0) {
      c++;
      i += 1;
    }
    return c === 1;
  })()
);
check(
  "spawn: the odd blocks are x 0 / 192 / 384 / 576 (blocks 1, 3, 5, 7 of LEVEL_BLOCKS)",
  (() => {
    const m = src.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
    if (!m) return false;
    const blocks = eval("[" + m[1] + "]");
    const odd = blocks.filter((b, i) => (i + 1) % 2 === 1);
    return (
      odd.length === 4 &&
      odd[0].x === 0 &&
      odd[1].x === 192 &&
      odd[2].x === 384 &&
      odd[3].x === 576
    );
  })()
);

// ================= 4. AI: SHE FOLLOWS, SHE SHADOWS, SHE STAYS ON HER BLOCK =====
const aiSec = (() => {
  const u = src.indexOf("function updateCreatures(");
  const i = src.indexOf('case "karen":', u);
  if (i < 0) return "";
  return src.slice(i, i + 6000);
})();
check(
  'AI: the karen is her OWN case in updateCreatures (no per-frame rebuild)',
  /case "karen": \{/.test(aiSec) && aiSec.indexOf("makePerson") < 0
);
check(
  "AI: follows straight at the worker (2.6 follow-walk, 2.2u gap)",
  aiSec.indexOf("const ksp = 2.6") >= 0 && aiSec.indexOf("kdist > 2.2") >= 0
);
check(
  "AI: ALWAYS faces the worker in 3D (atan2) + arms flapping to the sides",
  aiSec.indexOf("c.g.rotation.z = Math.atan2(kdy, kdx)") >= 0 &&
    aiSec.indexOf("c.parts.armL.rotation.x = flap") >= 0 &&
    aiSec.indexOf("c.parts.armR.rotation.x = -flap") >= 0
);
check(
  "AI: cycles KAREN_QUESTIONS 50% / KAREN_COMPLAINTS 50% every 2.4-3.6s (earshot 26u)",
  aiSec.indexOf("pick(KAREN_QUESTIONS)") >= 0 &&
    aiSec.indexOf("pick(KAREN_COMPLAINTS)") >= 0 &&
    aiSec.indexOf("c.askCd = R(2.4, 3.6)") >= 0 &&
    aiSec.indexOf("kdist < 26") >= 0
);
check(
  "AI: rests after 3-4 houses (24-32u) — hands at chest, chest out",
  aiSec.indexOf("c.followMax = R(24, 32)") >= 0 &&
    aiSec.indexOf("c.cool = R(5, 8)") >= 0 &&
    aiSec.indexOf("c.parts.armL.rotation.y = -1.9") >= 0
);
check(
  "AI: CLOSING RANT — KAREN_BYE when the worker crosses the far edge of her block",
  aiSec.indexOf("p.wx > c.blockMaxX + 2") >= 0 &&
    aiSec.indexOf("pick(KAREN_BYE)") >= 0 &&
    aiSec.indexOf("c.bye = true") >= 0
);
check(
  "AI: STAYS ON HER BLOCK — x clamped to blockMinX..blockMaxX (never crosses the street)",
  aiSec.indexOf("c.wx = clamp(c.wx, c.blockMinX, c.blockMaxX)") >= 0
);

// ================= 5. BUMP: A CIVILIAN (A VERY ANNOYING ONE) =================
check(
  "collision radius: karen rad 0.85",
  /c\.type === "karen"\) rad = 0\.85/.test(src)
);
check(
  "bump: karen is in the ARCADE BUMP gate (very minor 1HP, tagged to her for the write-up)",
  (() => {
    const i = src.indexOf("ARCADE BUMP: touching a walking civilian");
    if (i < 0) return false;
    const seg = src.slice(Math.max(0, i - 450), i + 2200);
    return (
      seg.indexOf('c.type === "karen"') >= 0 &&
      seg.indexOf("hurtNPC(HP_HIT_BUMPER, c.type)") >= 0
    );
  })()
);
check(
  'bump: her own line ("CONCERNED CITIZEN")',
  (() => {
    const i = src.indexOf(
      'c.type === "karen")',
      src.indexOf("ARCADE BUMP: touching a walking civilian"),
    );
    return i >= 0 && src.slice(i, i + 400).indexOf("CONCERNED CITIZEN") >= 0;
  })()
);
check(
  "flying cans: karen is a hittable civilian",
  /function checkFlyingCanNpcHit[\s\S]{0,700}c\.type === "karen" \|\|/.test(src)
);

// ================= 6. WRITTEN UP! =================
check(
  "WRITTEN UP!: karen has her own offense line — 'Failed to obligate a disgruntled homeowner'",
  (() => {
    const i = src.indexOf("const WRITEUP_REASONS = {");
    const seg = src.slice(i, i + 700);
    return (
      seg.indexOf("karen: [") >= 0 &&
      seg.indexOf("Failed to obligate a disgruntled homeowner") >= 0
    );
  })()
);

console.log(pass ? "\nSI KAREN CHECKS PASSED" : "\nSTATEN ISLAND KAREN: FAILURES ABOVE");
process.exit(pass ? 0 : 1);
