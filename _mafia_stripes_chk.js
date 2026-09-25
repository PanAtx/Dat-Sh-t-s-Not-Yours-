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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
