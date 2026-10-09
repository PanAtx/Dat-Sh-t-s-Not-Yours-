// _soccer_kick_chk.js — "GOLAZO!" regression check.
// The sanitation worker with FREE HANDS can kick the soccer kids' ball: the Act
// button boots it down the block on the kids' own shot physics, the worker yells
// "Golazo!", the nearest kid screams "That's not fair!", and the boot pays
// +5 STREET CASH through the prank pipeline (awardPrankPoints -> addStreetCash,
// never the score). PART 1 checks the wiring in the source; PART 2 EXTRACTS the
// real tryKickSoccerBall/kickSoccerBall out of index.html and drives them.
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
let fails = 0;
const check = (name, ok, extra) => {
  console.log((ok ? "  ok  " : "  FAIL") + " " + name + (ok || !extra ? "" : " :: " + extra));
  if (!ok) fails++;
};

// ---- PART 1: source wiring ----
console.log("[1] source wiring");
check(
  "tryKickSoccerBall + kickSoccerBall are defined",
  html.indexOf("function tryKickSoccerBall()") >= 0 && html.indexOf("function kickSoccerBall(T)") >= 0
);
const ti = html.indexOf("function tryInteract()");
const tiBody = html.slice(ti, html.indexOf('carry === "bag"', ti));
const ratAt = tiBody.indexOf("tryKickRat()) return");
const soccerAt = tiBody.indexOf("typeof tryKickSoccerBall");
check(
  "tryInteract kicks the ball right after the rat kick, before the dump handling",
  ratAt >= 0 && soccerAt > ratAt
);
check(
  "the ball kick is gated on FREE hands (carry === none)",
  /carry === "none" &&\s*typeof tryKickSoccerBall === "function"/.test(html)
);
check('worker yells "Golazo!" (worker voice)', /"Golazo!"[\s\S]{0,120}WORKER_GENDER/.test(html));
check('a kid screams "That\'s not fair!" (kid voice)', /"That's not fair!"[\s\S]{0,200}"kid"/.test(html));
check(
  "the boot pays +5 STREET CASH via awardPrankPoints at the worker spot",
  /function kickSoccerBall\(T\)[\s\S]{0,2500}?awardPrankPoints\(5, p\.wx, p\.wy\)/.test(html)
);
check(
  "per-team boot cooldown ticks in the soccer team tick (beside workerKickCd)",
  /T\.workerKickCd = Math\.max\(0, T\.workerKickCd - dt\);[\s\S]{0,200}?T\.kickBallCd = Math\.max\(0, \(T\.kickBallCd \|\| 0\) - dt\)/.test(html)
);

check(
  "the boot STRIPS the dribbler (T.owner = null) and arms a re-grab beat",
  /function kickSoccerBall\(T\)[\s\S]{0,2000}?T\.owner = null;[\s\S]{0,200}?T\.grabCd = 0\.7/.test(html)
);

// ---- PART 2: run the REAL extracted functions ----
console.log("[2] behavior (extracted tryKickSoccerBall/kickSoccerBall)");
const startMark = "const SOCBALL_KICK_RANGE";
const s0 = html.indexOf(startMark);
const s1 = s0 >= 0 ? html.indexOf("function tryInteract(", s0) : -1;
check("kick block extractable from index.html", s0 >= 0 && s1 > s0);
if (fails) {
  console.log(fails + " FAILED");
  process.exit(1);
}
const code = html.slice(s0, s1);
const factory = new Function(
  "stubs",
  `const { p, creatures, Voice, awardPrankPoints, R, clamp, dist, WORKER_GENDER, SOCCER_SHOT_VZ } = stubs;
   let state = "play", carry = "none";
   ${code}
   return { tryKickSoccerBall, kickSoccerBall,
     setState: (s) => (state = s), setCarry: (c) => (carry = c) };`
);

function makeWorld() {
  const kids = [
    { wx: 6, wy: 3, gender: "male" }, // dribbler, nearest the worker
    { wx: 2, wy: 3, gender: "female" },
    { wx: 9, wy: 4, gender: "male" }, // nearest the landing point
  ];
  const B = { wx: 7.2, wy: 3, z: 0, vz: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  const T = {
    ball: B, kids, owner: kids[0], grabCd: 0, celebrateT: 0,
    minX: 0, maxX: 20, receiver: null, lastKicker: null,
  };
  const p = { wx: 6, wy: 3, stunT: 0, facing: 9, kickT: 0 };
  const creatures = [{ type: "soccer", ball: B, team: T, wx: 6, wy: 3, gender: "male" }];
  const said = [], cash = [];
  const api = factory({
    p, creatures,
    Voice: { say: (line, r, pt, x, y, g, type) => said.push({ line, x, y, type }) },
    awardPrankPoints: (n) => cash.push(n),
    R: (a, b) => (a + b) / 2,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    dist: (x, y) => Math.hypot(x - p.wx, y - p.wy),
    WORKER_GENDER: "male",
    SOCCER_SHOT_VZ: 4.4,
  });
  return { api, T, B, kids, p, said, cash };
}

// a clean boot
{
  const w = makeWorld();
  const ok = w.api.tryKickSoccerBall();
  check("ball at his feet + free hands -> the kick lands (returns true)", ok === true);
  check("ball LOSES its dribbler (owner cleared, receiver sent, re-grab beat)",
    w.T.owner === null && w.T.kids.includes(w.T.receiver) && w.T.grabCd === 0.7);
  check("ball launched on the shot lob with a target down-block on the sidewalk",
    w.B.vz === 4.4 && w.B.tx > w.B.wx && w.B.tx <= 21 && w.B.ty >= 1.2 && w.B.ty <= 4.6);
  check("the worker snaps to the ball and throws the leg-whip pose",
    Math.abs(w.p.facing) < 0.001 && w.p.kickT === 0.3);
  const gol = w.said.find((s) => s.line === "Golazo!");
  const fair = w.said.find((s) => s.line === "That's not fair!");
  check('worker says "Golazo!" at his own spot', !!gol && gol.x === 6 && gol.type === "worker");
  check('kid screams "That\'s not fair!" at the nearest kid (the dribbler, male voice)',
    !!fair && fair.x === 6 && fair.type === "kid");
  check("boot pays exactly +5 (street cash pipeline, worker spot)",
    w.cash.length === 1 && w.cash[0] === 5);
  const again = w.api.tryKickSoccerBall();
  check("the cooldown blocks an instant second boot (no cash spam)", again === false);
}

// the gates
{
  const w = makeWorld();
  w.api.setCarry("bag");
  check("hands FULL (bag) -> no kick", w.api.tryKickSoccerBall() === false);
}
{
  const w = makeWorld();
  w.api.setState("cutscene");
  check("not during play -> no kick", w.api.tryKickSoccerBall() === false);
}
{
  const w = makeWorld();
  w.B.wx = 12; // far down the block
  check("ball out of range -> no kick (Act falls through)", w.api.tryKickSoccerBall() === false);
}
{
  const w = makeWorld();
  w.B.z = 1.5; // in the air
  check("airborne ball -> no volley, only ground balls get booted", w.api.tryKickSoccerBall() === false);
}
{
  const w = makeWorld();
  w.T.celebrateT = 1.2; // victory hops, ball in the net
  check("ball in the net during the GOOOOAL hops -> no kick", w.api.tryKickSoccerBall() === false);
}

console.log(fails ? `\nSOCCER KICK: ${fails} FAILED` : "\nSOCCER KICK: ALL PASSED");
process.exit(fails ? 1 : 0);

