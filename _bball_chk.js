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
  ["const HP_HIT_BBALL", "const HP_HIT_BBALL = 15"],
  ["BBALL_LINES", "const BBALL_LINES = ["],
  ["makeBasketballGuy", "function makeBasketballGuy()"],
  ["makeBasketballMesh", "function makeBasketballMesh()"],
  ["makeHoop", "function makeHoop()"],
  ["case bball (addCreature)", 'case "bball": {'],
  ["bball spawn call", 'addCreature("bball")'],
  ["bball state machine", 'c.ballState === "dribble"'],
  ["bball out state", 'c.ballState === "out"'],
  ["ball mesh sync", "c.ballG.position.set(c.ballW.x, c.ballW.y, GZ + c.ballW.z)"],
  ["hurtNPC bball", 'hurtNPC(HP_HIT_BBALL, "bball")'],
  ["write-up Bricklaying", '"Bricklaying while on duty"'],
  ["bball no-bump skip", 'if (c.type === "bball") continue;'],
  ["hoop spawn", "const hoop = makeHoop()"],
];
let allOk = true;
for (const [label, needle] of checks) {
  const ok = has(needle);
  if (!ok) allOk = false;
  console.log((ok ? "PASS " : "MISS ") + label);
}
console.log(allOk && !bad ? "ALL OK" : "CHECK ABOVE");
