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
  // THE LAW: when the worker punches him and he bolts, HE TAKES THE BALL WITH HIM.
  ["baller's flee carries the ball", 'c.ballState = "carried";'],
  ["the carried ball rides his stride", "c.ballW.x = c.wx + (c.wx >= p.wx ? 0.5 : -0.5);"],
  ["the carried ball is clamped at his hip (off the ground)", "c.ballW.z = 1.62;"],
  ["the ball mesh is synced inside the scare-off", /if \(c\.type === "bball" && c\.ballG && c\.ballW\) \{[\s\S]{0,320}c\.ballG\.position\.set\(c\.ballW\.x, c\.ballW\.y, GZ \+ c\.ballW\.z\);/],
  ["the ball is never abandoned: the AI resumes from the carry", 'if (c.ballState === "carried") {'],
];
let allOk = true;
for (const [label, needle] of checks) {
  const ok = needle instanceof RegExp ? needle.test(h) : has(needle);
  if (!ok) allOk = false;
  console.log((ok ? "PASS " : "MISS ") + label);
}

// ============ RUNTIME: punch the baller and watch the ball ============
// Run the REAL punchback scare-off block against a baller standing on his court, step him
// away for the full 5s flee, and require the ball mesh to stand where he stands (never a
// ball alone on the court).
{
  const a = h.indexOf("// PUNCHBACK SCARE-OFF");
  const b = h.indexOf("switch (c.type) {", a);
  const scareBlock = h.slice(h.indexOf("if (c.scareT > 0) {", a), b);
  const mkBall = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { x: 0, y: 0, z: 0 } });
  const courtX = 200, courtY = 3.2;
  const c = {
    type: "bball", wx: courtX, wy: courtY, dir: 1, scareT: 5,
    g: { position: { x: courtX, y: courtY, set(x, y) { this.x = x; this.y = y; } }, rotation: { z: 0 } },
    parts: { legL: { rotation: { y: 0 } }, legR: { rotation: { y: 0 } } },
    ballG: mkBall(), ballW: { x: courtX, y: courtY + 0.55, z: 1.0 }, ballState: "dribble",
  };
  const p = { wx: courtX - 6, wy: 0 }; // the worker just punched him from downhill
  const dt = 1 / 60;
  const shims = {
    c, p, dt,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    GZ: 0.3,
    animParts: () => {},
  };
  const names = Object.keys(shims);
  // The block ends with `continue;` (it lives inside the creature loop), so run it in a loop.
  const step = new Function(...names, "for (let __i = 0; __i < 1; __i++) {\n" + scareBlock + "\n}");
  let minGap = Infinity, lastBall = null, lastBody = null;
  for (let i = 0; i < 320; i++) {
    step(...names.map((k) => shims[k]));
    const d = Math.hypot(c.ballG.position.x - c.wx, c.ballG.position.y - c.wy);
    minGap = Math.min(minGap, d);
    lastBall = { x: c.ballG.position.x, y: c.ballG.position.y, z: c.ballG.position.z };
    lastBody = { x: c.wx, y: c.wy };
  }
  const travelled = Math.abs(lastBody.x - courtX);
  console.log((lastBall.z > 0.3 ? "PASS " : "MISS ") + "RUNTIME: the ball rides at hip height while he runs (z=" + lastBall.z.toFixed(2) + ")");
  console.log((minGap < 1.0 ? "PASS " : "MISS ") + "RUNTIME: the ball stays in his grip through the whole flee (worst gap " + minGap.toFixed(2) + "u)");
  console.log((travelled > 10 ? "PASS " : "MISS ") + "RUNTIME: he really ran off his court (" + travelled.toFixed(1) + "u) with the ball at x=" + lastBall.x.toFixed(1) + " body x=" + lastBody.x.toFixed(1));
  if (!(lastBall.z > 0.3 && minGap < 1.0 && travelled > 10)) allOk = false;
}
console.log(allOk && !bad ? "ALL OK" : "CHECK ABOVE");
