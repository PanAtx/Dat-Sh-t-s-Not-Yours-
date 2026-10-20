// Extract the REAL bar code from index.html and paint fills in a stub DOM.
const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
function extract(name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error(name + " not found");
  let d = 0, i = src.indexOf("{", idx);
  for (; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}" && --d === 0) break;
  }
  return src.slice(idx, i + 1);
}
const fns = ["cashStepNow", "scoreStepNow", "setStartMilestones", "updatePowerProgress"].map(extract).join("\n");

function paint(opts) {
  const els = {
    "pw-heal-bar": { style: {} }, "pw-bull-bar": { style: {} },
    "pw-heal-fill": { style: {} }, "pw-bull-fill": { style: {} },
  };
  const fn = new Function(
    "$", "clamp", "state", "BONUS", "isNightShift", "layoutGoalStrip",
    "POWERUP_CASH_STEP", "MONSTER_SCORE_STEP",
    "NIGHT_POWERUP_CASH_STEP", "NIGHT_MONSTER_SCORE_STEP",
    "bonusTally", "score", "healerSpanBase", "monsterSpanBase",
    "var pwBarsShown = false;\n" +
    fns +
    "\nsetStartMilestones();" +
    "\nbonusTally = " + opts.cash + "; score = " + opts.score + ";" +
    "\nupdatePowerProgress();" +
    "\nreturn {heal: $(\"pw-heal-fill\").style.width, bull: $(\"pw-bull-fill\").style.width, hd: $(\"pw-heal-bar\").style.display, bd: $(\"pw-bull-bar\").style.display};"
  );
  return fn((id) => els[id], (v, a, b) => Math.max(a, Math.min(b, v)), "play", null,
    () => opts.night, () => {}, 5000, 30000, 5000, 120000, 0, 0, 0, 0);
}
const cases = [
  ["W 0/0",       { cash: 0,      score: 0,      night: false }, "0.0%", "0.0%"],
  ["W 2250/1500", { cash: 2250,   score: 1500,   night: false }, "45.0%", "5.0%"],
  ["W 2999/0",    { cash: 2999,   score: 0,      night: false }, "60.0%", "0.0%"], // 59.98 -> toFixed(1)
  ["W 3000 roll", { cash: 3000,   score: 0,      night: false }, "60.0%", "0.0%"],
  ["M 20000/30k", { cash: 20000,  score: 30000,  night: true },  "0.0%", "25.0%"],
  ["M 4999/0",    { cash: 4999,   score: 0,      night: true },  "100.0%", "0.0%"], // 4,999 of 5,000 = 99.98 -> toFixed(1)
  ["M 5000 roll", { cash: 5000,   score: 0,      night: true },  "0.0%", "0.0%"],
  ["M 120001/0",  { cash: 120001, score: 120001, night: true },  "0.0%", "0.0%"], // span rolls, tiny fractions
];
let ok = true;
for (const [name, o, eh, eb] of cases) {
  const r = paint(o);
  const g = (s) => Math.abs(parseFloat(s) - parseFloat(s === eh ? eh : eb)) < 1e-9;
  const pass = r.heal === eh && r.bull === eb;
  if (!pass) ok = false;
  console.log((pass ? "PASS " : "FAIL "), name, "heal:", r.heal, "bull:", r.bull, " disp:", JSON.stringify(r.hd), JSON.stringify(r.bd));
  if (r.hd !== "" || r.bd !== "") { ok = false; console.log("  FAIL: bars not shown in play state"); }
}
const off = paint({ cash: 1, score: 1, night: false });
console.log("display in play:", JSON.stringify(off.hd), JSON.stringify(off.bd));
console.log(ok ? "BARSIM PASS" : "BARSIM FAIL");
process.exit(ok ? 0 : 1);