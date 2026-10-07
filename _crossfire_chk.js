const fs = require("fs");
const src = fs.readFileSync("index.html", "utf8");
function extractFn(name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error(name + " not found");
  let brace = src.indexOf("{", idx);
  let depth = 0,
    i = brace;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}

// Minimal game-scope stubs the helper touches.
const state = "play";
const creatures = [];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R = (a, b) => a + (b - a) * 0.5;
const picked = [];
const pick = (a) => a[0];
const animParts = (c) => {};
const Voice = { say: (...a) => picked.push(a[0]) };
let ok = true;
const check = (label, cond) => {
  console.log("  " + (cond ? "PASS" : "FAIL") + "  " + label);
  if (!cond) ok = false;
};

// Put a cop on the left and a robber on the right, both on the sidewalk band.
const cop = { type: "cop", wx: 100, wy: 2.5 };
const robber = { type: "robber", wx: 120, wy: 3.0 };
creatures.push(cop, robber);

const runner = new Function(
  "state",
  "creatures",
  "clamp",
  "R",
  "pick",
  "animParts",
  "Voice",
  extractFn("npcCrossfireFlee") + "\n;return npcCrossfireFlee;",
);
const flee = runner(state, creatures, clamp, R, pick, animParts, Voice);
const dt = 1 / 60;

// (1) A walker dead-between the two muzzles -> IN the crossfire -> flees (returns true)
let inFire = { type: "ped", wx: 110, wy: 2.8, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
const startX = inFire.wx,
  startY = inFire.wy;
let r1 = flee(inFire, dt, { wx: 110 });
check("walker between the cop and robber IS detected as in the crossfire", r1 === true);
check("in-fire walker actually MOVES (flees)", Math.hypot(inFire.wx - startX, inFire.wy - startY) > 1e-6);
check("in-fire walker raises its arms (panic)", inFire.parts.armL.rotation.y !== 0 && Math.abs(inFire.parts.armL.rotation.y) > 1);

// (2) A walker far OFF the firing line (big perpendicular distance) -> NOT in the fire
let off = { type: "ped", wx: 110, wy: 99, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
check("walker far off the line is NOT flagged as in the crossfire", flee(off, dt, { wx: 110 }) === false);

// (3) A walker BEYOND the robber (t>1) -> not between them -> no fire
let beyond = { type: "ped", wx: 130, wy: 3.0, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
check("walker beyond the robber (not between) is NOT flagged", flee(beyond, dt, { wx: 130 }) === false);

// (4) No robber present -> no crossfire at all
creatures.length = 0;
creatures.push(cop);
let lonely = { type: "ped", wx: 110, wy: 2.8, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
check("with only the cop (no robber) there is no crossfire", flee(lonely, dt, { wx: 110 }) === false);

// (5) Out-of-play state -> never flees
creatures.length = 0;
creatures.push(cop, robber);
let paused = { type: "ped", wx: 110, wy: 2.8, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
const fleePaused = new Function("state", "creatures", "clamp", "R", "pick", "animParts", "Voice", extractFn("npcCrossfireFlee") + "\n;return npcCrossfireFlee;")("over", creatures, clamp, R, pick, animParts, Voice);
check("not in 'play' state -> never flees", fleePaused(paused, dt, { wx: 110 }) === false);

// (6) Flee direction is AWAY from the midpoint (110,2.75): a walker left of center flees left
let leftOfMid = { type: "ped", wx: 105, wy: 2.75, dir: 1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
let beforeL = leftOfMid.wx;
flee(leftOfMid, dt, { wx: 105 });
check("a walker left of the midpoint flees LEFT (away from the fire)", leftOfMid.wx < beforeL);
let rightOfMid = { type: "ped", wx: 115, wy: 2.75, dir: -1, phase: 0, parts: { armL: { rotation: {} }, armR: { rotation: {} } }, g: { rotation: { z: 0 } } };
let beforeR = rightOfMid.wx;
flee(rightOfMid, dt, { wx: 115 });
check("a walker right of the midpoint flees RIGHT (away from the fire)", rightOfMid.wx > beforeR);

console.log("\n" + (ok ? "CROSSFIRE FLEE CHECKS PASSED" : "CROSSFIRE FLEE CHECKS FAILED"));
process.exit(ok ? 0 : 1);
