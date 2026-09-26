// _mafia_stripes_chk.js — verify the mafia guy's Adidas stripes sit RIGHT ON the
// clothing: each stripe is half-embedded in the limb, protrudes at most ~5mm,
// and all three of a set lie on the same outer-face plane (spaced across the
// face width, not stacked off the surface).
const fs = require("fs");
const h = fs.readFileSync(__dirname + "/index.html", "utf8");

function extract(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error("marker not found: " + marker);
  const j = src.indexOf("{", i);
  let depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, k + 1);
    }
  }
  throw new Error("unbalanced braces for " + marker);
}
const pSrc = extract(h, "function makePerson");
const mSrc = extract(h, "function makeMafiaGuy");

// ---- Headless THREE / helper stubs ----
class Group {
  constructor() {
    this.children = [];
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0, set() {} };
    this.scale = { x: 1, y: 1, z: 1, set() {} };
    this.userData = {};
  }
  add(c) { this.children.push(c); }
}
class BoxGeometry { constructor(w, h, d) { this.size = [w, h, d]; } }
class CylinderGeometry { constructor(...a) { this.args = a; } }
class SphereGeometry { constructor(...a) { this.args = a; } }
class ConeGeometry { constructor(...a) { this.args = a; } }
const matColor = (c) => ({ value: c, set(v) { this.value = v; }, getHex() { return this.value; } });
class MeshLambertMaterial { constructor(o) { Object.assign(this, o || {}); } }
class MeshStandardMaterial { constructor(o) { Object.assign(this, o || {}); } }
class Mesh {
  constructor(geo, mat) {
    this.geometry = geo; this.material = mat;
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.rotation = { x: 0, y: 0, z: 0, set() {} };
    this.castShadow = false;
  }
}
const THREE = { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, MeshLambertMaterial, MeshStandardMaterial, DoubleSide: 2 };
const M = (c, o) => ({ color: matColor(c), ...(o || {}) });
const MS = (c, o) => ({ color: matColor(c), metalness: 0.9, roughness: 0.25, ...(o || {}) });
const BX = (w, h, d, m) => new Mesh(new BoxGeometry(w, h, d), m);
const CY = (a, b, hh, m, s) => new Mesh(new CylinderGeometry(a, b, hh, s || 10), m);
const SP = (r, m, s) => new Mesh(new SphereGeometry(r, s || 8, s || 6), m);
const SKIN_TONES = [0xf3d1a5], SHIRTS = [0x2a6fd0], PANTS = [0x2f3640], HAIRS = [0x2a2118];
const pick = (a) => a[0];
const R = (a, b) => a;

const makeMafiaGuy = new Function(
  "THREE", "M", "MS", "BX", "CY", "SP", "SKIN_TONES", "SHIRTS", "PANTS", "HAIRS", "pick", "R",
  pSrc + "\n" + mSrc + "\nreturn makeMafiaGuy;"
)(THREE, M, MS, BX, CY, SP, SKIN_TONES, SHIRTS, PANTS, HAIRS, pick, R);

const d = makeMafiaGuy();
let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log("  ok  " + name + (detail ? "  (" + detail + ")" : "")); }
  else { fail++; console.log(" FAIL " + name + (detail ? "  (" + detail + ")" : "")); }
};

// For each limb pivot: the limb box = child with the largest Z extent; stripes =
// white (0xf2f2f2) boxes with the thin 0.014 x 0.01 cross-section.
const limbs = { armL: d.armL, armR: d.armR, legL: d.legL, legR: d.legR };
for (const [name, pv] of Object.entries(limbs)) {
  const limb = pv.children.filter((c) => c.geometry && c.geometry.size)
    .sort((a, b) => b.geometry.size[2] - a.geometry.size[2])[0];
  const L = limb.geometry.size; // [w, h, d] in the pivot-local frame
  const faceY = L[1] / 2;
  const stripes = pv.children.filter(
    (c) => c.geometry && c.geometry.size && Math.abs(c.geometry.size[0] - 0.014) < 1e-9
      && Math.abs(c.geometry.size[1] - 0.01) < 1e-9
  );
  check(name + ": exactly 3 white stripes", stripes.length === 3, String(stripes.length));
  let embedded = true, hugging = true, onPlane = true, withinX = true, withinZ = true;
  const yOuters = [];
  for (const st of stripes) {
    const S = st.geometry.size;
    const yOut = Math.abs(st.position.y) + S[1] / 2;
    const yIn = Math.abs(st.position.y) - S[1] / 2;
    yOuters.push(yOut);
    if (yIn >= faceY - 1e-9) embedded = false;                 // must be anchored into the fabric
    if (yOut > faceY + 0.006) hugging = false;                 // must not stick out past ~5mm
    if (Math.abs(Math.abs(st.position.y) - faceY) > 1e-9) onPlane = false; // centered exactly ON the face
    if (Math.abs(st.position.x) + S[0] / 2 > L[0] / 2) withinX = false;    // inside the face width
    if (Math.abs(st.position.z - limb.position.z) + S[2] / 2 > L[2] / 2) withinZ = false;
  }
  const spread = Math.max(...yOuters) - Math.min(...yOuters);
  check(name + ": stripes anchored INTO the fabric (no floating)", embedded);
  check(name + ": stripes hugging the surface (<=5mm proud)", hugging,
    "max proud = " + (Math.max(...yOuters) - faceY).toFixed(4));
  check(name + ": all 3 on the same outer-face plane (spaced across X)", onPlane && spread < 1e-9,
    "outer-face spread = " + spread.toFixed(6));
  check(name + ": stripes inside the limb face (X and Z)", withinX && withinZ);
}

// ---- The rest of the tracksuit kit: collar/hem trim + slung bat ----
const upper = d.g.userData.parts.upper;
const torso = upper.children.filter((c) => c.geometry && c.geometry.size)
  .sort((a, b) => b.geometry.size[2] - a.geometry.size[2])[0];
const T = torso.geometry.size;
const bands = upper.children.filter(
  (c) => c.geometry && c.geometry.size
    && Math.abs(c.geometry.size[0] - 0.21) < 1e-9
    && Math.abs(c.geometry.size[1] - 0.59) < 1e-9
    && Math.abs(c.geometry.size[2] - 0.02) < 1e-9
);
check("collar + hem: exactly 2 white trim bands", bands.length === 2, String(bands.length));
let bandFlush = true;
for (const b of bands) {
  const S = b.geometry.size;
  const px = Math.abs(b.position.x) + S[0] / 2 - T[0] / 2;
  const py = Math.abs(b.position.y) + S[1] / 2 - T[1] / 2;
  if (px > 0.006 || py > 0.006 || px < -0.01 || py < -0.01) bandFlush = false;
}
check("collar + hem: flush on the jacket (<=5mm proud, embedded)", bandFlush);
const bandZ = bands.map((b) => b.position.z).sort((a, b) => a - b);
check(
  "collar + hem: one at the neck, one at the waist (straddling torso center)",
  bandZ.length === 2 && bandZ[0] < torso.position.z && bandZ[1] > torso.position.z,
  bandZ.map((z) => z.toFixed(2)).join(" / ") + " (center " + torso.position.z.toFixed(2) + ")"
);
const bat = d.armR.children.find((c) => c.geometry && c.geometry.args);
check("slung bat: tapered cylinder in the RIGHT hand", !!bat);
if (bat) {
  const A = bat.geometry.args; // [r1, r2, h, segs]
  check("bat: tapered (barrel > handle)", A[1] > A[0], A[0] + " -> " + A[1]);
  check(
    "bat: axis along the arm (rot.x ~ 90deg)",
    Math.abs(Math.abs(bat.rotation.x) - Math.PI / 2) < 1e-6,
    bat.rotation.x.toFixed(4)
  );
  const hand = d.armR.children.find(
    (c) => c.geometry && c.geometry.size && Math.abs(c.geometry.size[2] - 0.12) < 1e-9
  );
  if (hand) {
    const batTop = bat.position.z + A[2] / 2;
    const batBottom = bat.position.z - A[2] / 2;
    const wrist = hand.position.z + hand.geometry.size[2] / 2;
    const fist = hand.position.z - hand.geometry.size[2] / 2;
    check(
      "bat: spans from the wrist past the fist",
      batTop >= wrist - 1e-6 && batBottom <= fist,
      "bat " + batBottom.toFixed(2) + ".." + batTop.toFixed(2) + " vs hand " + fist.toFixed(2) + ".." + wrist.toFixed(2)
    );
    const lowest = upper.position.z + d.armR.position.z + Math.min(batBottom, 0);
    check("bat: stays clear of the ground", lowest > 0.1, lowest.toFixed(3));
  }
  const grip = d.armR.children.find(
    (c) => c.geometry && c.geometry.size && Math.abs(c.geometry.size[0] - 0.036) < 1e-9
  );
  check("bat grip: white band near the handle", !!grip);
}

// ---- Bat swing on bump: trigger + animation ----
console.log("\n--- bat swing (bump trigger + animation) ---");
const collideI = h.indexOf("function collideCreatures() {");
const mafiaBumpI = h.indexOf('if (c.type === "mafia") {', collideI);
const mafiaBump = h.slice(mafiaBumpI, mafiaBumpI + 2800);
check(
  "bump branch: turns to face the worker before swinging (atan2(-dy, -dx))",
  mafiaBump.indexOf("c.g.rotation.z = Math.atan2(-dy, -dx)") >= 0
);
check(
  "bump branch: arms the swing (c.swinging = true; c.swingT = 0)",
  mafiaBump.indexOf("c.swinging = true;") >= 0 && mafiaBump.indexOf("c.swingT = 0;") >= 0
);
check(
  "solid: overlap is resolved EVERY frame, OUTSIDE the hit cooldown (worker can't walk through him)",
  mafiaBump.indexOf("const pen = rad - md;") >= 0 &&
    mafiaBump.indexOf("const pen = rad - md;") < mafiaBump.indexOf("if (c.attackCd <= 0") &&
    mafiaBump.indexOf("p.wx += mnx * pen;") >= 0
);
check(
  "bump branch: NO hit on the bump itself (blow deferred to the smash frame)",
  mafiaBump.indexOf("hurtNPC(HP_HIT_MAFIA") === -1 &&
    mafiaBump.indexOf("SFX.playHurtSound") === -1 &&
    mafiaBump.indexOf("p.wx += mnx * 0.5;") === -1 &&
    mafiaBump.indexOf("c.swingHitDone = false;") >= 0
);
check(
  "every bump is a hit: cooldown is one full swing (0.9s), no 1.6s dead window",
  h.indexOf("const MAFIA_BUMP_CD = 0.9;") >= 0
);
check(
  "cooldown TICKS down in the mafia update case (the 'only hits once' bug)",
  (() => {
    const mafiaCaseI = h.lastIndexOf('case "mafia": {'); // the update case (2nd of the two)
    const seg = h.slice(mafiaCaseI, mafiaCaseI + 3000);
    return (
      mafiaCaseI > 0 &&
      seg.indexOf("c.attackCd = c.attackCd > 0 ? c.attackCd - dt : 0;") >= 0 &&
      seg.indexOf("c.attackCd = c.attackCd > 0 ? c.attackCd - dt : 0;") <
        seg.indexOf('if (c.mode === "guard")')
    );
  })()
);
const swingI = h.indexOf("BAT SWING (armed in collideCreatures");
const swingSrc = h.slice(swingI, swingI + 4200);
check(
  "walk cycle: arms are pinned while the swing owns them",
  h.slice(swingI - 900, swingI).indexOf("if (!c.swinging)") >= 0
);
check(
  "swing driver: over-hand windup 2.2 -> smash 5.0 -> settle 2*pi, resets the flag",
  swingSrc.indexOf("ang = 2.2 * u * (2 - u)") >= 0 &&
    swingSrc.indexOf("ang = 2.2 + 2.8 * ss((t - 0.3) / 0.18)") >= 0 &&
    swingSrc.indexOf("ang = 5.0 + 1.2831853 * ss((t - 0.48) / 0.37)") >= 0 &&
    swingSrc.indexOf("c.swinging = false") >= 0
);
check(
  "swing driver: drives the bat arm + a torso twist",
  swingSrc.indexOf("c.parts.armR.rotation.y = ang") >= 0 &&
    swingSrc.indexOf("-Math.sin(ang) * 0.3") >= 0
);
check(
  "impact: the blow lands on the first frame past the smash (t >= 0.48), delivered once",
  swingSrc.indexOf("if (!c.swingHitDone && t >= 0.48)") >= 0 &&
    swingSrc.indexOf("c.swingHitDone = true;") >= 0
);
check(
  "impact: re-checks range + i-frames + play state before SFX / damage / stun / yelps",
  swingSrc.indexOf("iD <= 2.2 && p.invuln <= 0 && p.immuneT <= 0 && state === \"play\"") >= 0 &&
    swingSrc.indexOf("SFX.playHurtSound();") >= 0 &&
    swingSrc.indexOf("hurtNPC(HP_HIT_MAFIA, \"mafia\");") >= 0 &&
    swingSrc.indexOf("doStun(0.5, \"hit\");") >= 0 &&
    swingSrc.indexOf("MAFIA_WORKER_LINES") >= 0
);
check(
  "impact: the blow shoves the worker PAST the solid push-out (direction measured at impact)",
  swingSrc.indexOf("p.wx += inx * 0.5;") >= 0 &&
    swingSrc.indexOf("clamp(p.wy + iny * 0.35, -9.4, workerMaxY())") >= 0
);
// Replay the phase math exactly as written — boundaries must be continuous
const ss2 = (u) => u * u * (3 - 2 * u);
const b1 = 2.2 * 1 * (2 - 1); // phase 1 at u=1
const b2a = 2.2 + 2.8 * ss2(0),
  b2b = 2.2 + 2.8 * ss2(1); // phase 2 at u=0 / u=1
const b3a = 5.0 + 1.2831853 * ss2(0),
  b3b = 5.0 + 1.2831853 * ss2(1); // phase 3 at u=0 / u=1
check(
  "swing math: phase boundaries are continuous",
  Math.abs(b1 - b2a) < 1e-9 && Math.abs(b2b - b3a) < 1e-9,
  [b1, b2a, b2b, b3a, b3b].map((v) => v.toFixed(2)).join(" / ")
);
check(
  "swing math: OVER-HAND arc — cock up-behind (2.2), smash over the top (5.0), settle at rest (2*pi)",
  Math.abs(b1 - 2.2) < 1e-9 &&
    Math.abs(b2b - 5.0) < 1e-9 &&
    Math.abs(b3b - 2 * Math.PI) < 1e-6
);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
