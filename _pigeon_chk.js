// _pigeon_chk.js — the sidewalk PIGEON flocks. They peck seed on the sidewalk,
// re-land NEAR the worker after being scared off (not stranded far behind the
// route), and scaring one off pays +10 STREET CASH (same payout as the
// squirrel chase). Syntax + static wiring touchpoints (carthomeless style).
const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
const m = [...h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
let bad = 0;
m.forEach((s, i) => {
  try {
    new Function(s[1]);
  } catch (e) {
    bad++;
    console.log("script " + i + ": " + e.message);
  }
});
console.log(bad ? "SYNTAX FAIL" : "SYNTAX OK (" + m.length + " scripts)");
const has = (s) => h.includes(s);
const checks = [
  ["flock count (Manhattan 3, else 2)", 'const flockCount = borough === "MANHATTAN" ? 3 : 2;'],
  ["flock size 2-4 birds", "const flock = 2 + ((Math.random() * 3) | 0);"],
  ["flock seeded ahead of the worker", "const fpx = p.wx + R(-15, 45),"],
  ["seed scatter pile per flock", "makeSeedScatter()"],
  ["spawn call", 'addCreature("pigeon")'],
  ["case pigeon", 'case "pigeon":'],
  ["scare trigger: proximity window", "Math.abs(c.wy - p.wy) < 2.5"],
  ["scare: take flight 1.1s", "c.flyT = 1.1;"],
  ["scare: 'scram birds!' yell kept", '"scram birds!"'],
  ["hide time 3-6s", "c.returnT = R(3, 6);"],
  ["re-land RELATIVE to the worker (6-20u off, either side)", "c.wx = p.wx + (Math.random() < 0.5 ? -1 : 1) * R(6, 20);"],
  ["re-land on the sidewalk band", "c.wy = R(1.5, 4.4); // re-land on the concrete"],
  // de-affiliation guard: the old ABSOLUTE re-land (c.wx = R(-45, 60)) stranded
  // every bird far behind the worker's route and made the flocks vanish.
  ["old absolute re-land is GONE", !h.includes("c.wx = R(-45, 60);")],
];
// The +10 payout must sit INSIDE the state === "play" proximity branch of the
// pigeon case (no street cash during cutscenes / write-ups), right after the
// scatter trigger and before the "scram birds!" Voice.say.
const pc = h.slice(h.indexOf('case "pigeon": {'), h.indexOf('case "bluejay": {'));
const trig = pc.indexOf("Math.abs(c.wy - p.wy) < 2.5");
const pay = pc.indexOf("awardPrankPoints(10, p.wx, p.wy);");
const say = pc.indexOf('"scram birds!"');
checks.push(
  ["payout inside the play-gated scare branch", trig >= 0 && pay > trig && pay - trig < 700 && say > pay],
  // the payout flows through the SAME street-cash pipeline as the squirrel chase
  // (awardPrankPoints -> addStreetCash; never the score).
  ["payout via awardPrankPoints(10, ...)", "awardPrankPoints(10, p.wx, p.wy);"],
  ["awardPrankPoints still pays street cash", "function awardPrankPoints(n, wx, wy)"],
  ["pigeon keeps its z-exemption (never clamped to GZ slab)", 'c.type !== "pigeon"']
);
let allOk = !bad;
for (const [label, needle] of checks) {
  const ok = typeof needle === "boolean" ? needle : has(needle);
  if (!ok) allOk = false;
  console.log((ok ? "PASS " : "MISS ") + label);
}
console.log(allOk ? "\nPIGEON CHECK PASSED" : "\nPIGEON CHECK FAILED");
process.exit(allOk ? 0 : 1);