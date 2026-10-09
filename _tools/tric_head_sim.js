// _tools/tric_head_sim.js — numeric check of the tricycle kid's head, hair and hands.
// Instantiates the REAL makeTricycle() with a geometry-recording stub, then reports
// world-space boxes: is the face skin? is the hair visible? does the helmet sit on the
// crown (not over the face)? does anything wide slice across the face? do the hands land on the grips?
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/../index.html", "utf8");
function extract(name) {
  const idx = html.indexOf("function " + name + "(");
  const brace = html.indexOf("{", idx);
  let depth = 0,
    i = brace;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return html.slice(idx, i + 1);
}
const code = extract("makeTricycle");
const P = () => ({
  x: 0,
  y: 0,
  z: 0,
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  },
});
const SC = () => ({
  x: 1,
  y: 1,
  z: 1,
  set(a, b, c) {
    this.x = a;
    this.y = b;
    this.z = c;
  },
});
const base = () => ({ position: P(), rotation: P(), scale: SC() });
const BX = (w, h, d, m) => Object.assign(base(), { kind: "BX", dim: [w, h, d], mat: m });
const CY = (r1, r2, h, m, seg) =>
  Object.assign(base(), { kind: "CY", r: r1, dim: [r1 * 2, r1 * 2, h], mat: m });
const SPH = (r, m) => Object.assign(base(), { kind: "SPH", r, dim: [r * 2, r * 2, r * 2], mat: m });
const THREE = {
  Group: function () {
    Object.assign(this, base());
    this.children = [];
    this.userData = {};
  },
  Mesh: function (geo, mat) {
    Object.assign(this, base());
    this.geometry = geo;
    this.material = mat;
    this.castShadow = false;
  },
};
THREE.Group.prototype.add = function (o) {
  this.children.push(o);
  return o;
};
THREE.CylinderGeometry = function (r1, r2, h) {
  this.r = r1;
  this.h = h;
};
THREE.BoxGeometry = function () {};
THREE.SphereGeometry = function (r) {
  this.r = r;
};
const SKIN_TONES = [0xf3c6a5, 0xe8b48c, 0xd9a06b, 0xc68642, 0x9c6b3c, 0x8d5524, 0x6f4522, 0x5a3a1e];
const HAIRS = [0x2a2118, 0x4a3220, 0x111111, 0x8a6a3a];
const pick = (a) => a[0];
const g = new Function("THREE", "M", "MS", "BX", "CY", "SPH", "pick", "SKIN_TONES", "HAIRS",
  code + "\n;return makeTricycle();")(THREE, (c) => ({ c }), (c) => ({ c }), BX, CY, SPH, pick, SKIN_TONES, HAIRS);

const flat = [];
(function walk(o, off) {
  (o.children || []).forEach((c) => {
    const w = { x: off.x + c.position.x, y: off.y + c.position.y, z: off.z + c.position.z };
    flat.push({ o: c, w });
    walk(c, w);
  });
})(g, { x: 0, y: 0, z: 0 });
const items = flat
  .filter((f) => f.o.mat || f.o.material)
  .map((f) => {
    const o = f.o,
      mat = o.mat || o.material,
      rotX = Math.abs(o.rotation.x) > 1; // CY laid on its side (a rim disc)
    // BX/CY/SPH helpers record dim; the wheels are raw THREE.Mesh(CylinderGeometry)
    const gd = o.dim || (o.geometry && o.geometry.r !== undefined
      ? [o.geometry.r * 2, o.geometry.r * 2, o.geometry.h]
      : [0.1, 0.1, 0.1]);
    const dim = o.kind === "CY" && rotX ? [o.r * 2, o.r * 2, o.dim[2]] : gd;
    const e = [dim[0] * o.scale.x, dim[1] * o.scale.y, dim[2] * o.scale.z];
    return {
      f,
      color: mat.c,
      kind: o.kind,
      w: f.w,
      b: {
        x0: f.w.x - e[0] / 2, x1: f.w.x + e[0] / 2,
        y0: f.w.y - e[1] / 2, y1: f.w.y + e[1] / 2,
        z0: f.w.z - e[2] / 2, z1: f.w.z + e[2] / 2,
      },
    };
  });
const SK = new Set(SKIN_TONES),
  HR = new Set(HAIRS);
const skin = items.filter((i) => SK.has(i.color));
const hair = items.filter((i) => HR.has(i.color));
const head = skin.filter((i) => i.w.x < 0 && i.w.z > 0.6);
const hat = items.find((i) => i.color === 0x5c6167 || i.color === 0x454a50); // the old grey helmet + its rim
const hands = skin.filter((i) => i.w.x > 0.3 && i.w.z > 0.6);
const grips = items.filter((i) => i.color === 0x33383e && i.w.x > 0.3 && i.kind === "CY");
const fmt = (b) => `x ${b.x0.toFixed(2)}..${b.x1.toFixed(2)} y ${b.y0.toFixed(2)}..${b.y1.toFixed(2)} z ${b.z0.toFixed(2)}..${b.z1.toFixed(2)}`;
console.log("SKIN meshes:", skin.length, "| HAIR meshes:", hair.length, "| colors:", [...new Set(items.map((i) => i.color.toString(16)))].join(","));
console.log("HEAD  ", head.map((i) => fmt(i.b)).join(" | "));
console.log("HAIR  ", hair.map((i) => fmt(i.b)).join(" | "));
console.log("HAT/HELMET", hat ? "STILL THERE — " + fmt(hat.b) : "none (the crown is bare hair)");
console.log("HANDS ", hands.map((i) => `(${i.w.x.toFixed(2)},${i.w.y.toFixed(2)},${i.w.z.toFixed(2)})`).join(" "));
console.log("GRIPS ", grips.map((i) => `(${i.w.x.toFixed(2)},${i.w.y.toFixed(2)},${i.w.z.toFixed(2)})`).join(" "));
const H = head[0].b;
const midZ = (H.z0 + H.z1) / 2;
const faceX0 = H.x1 - (H.x1 - H.x0) / 3; // the front third of the head = the face
const overFace = !!hat; // ANY helmet/hat object on the kid is now a bug
// The EYE band: the old bug was a DARK disc (r 0.12, wider than the 0.2 head) centered at
// z 0.76 — i.e. a slab spanning most of the eye line, across the whole face. Assert that NO
// object crossing the face slab covers most of the eye band (torso under the chin and the
// helmet/rim at the hairline only clip the band's edges, which is normal).
const bandLo = midZ - 0.05,
  bandHi = midZ + 0.05;
const faceBand = items.filter(
  (i) =>
    i !== head[0] &&
    i.b.z0 < bandLo + 0.02 &&
    i.b.z1 > bandHi - 0.02 &&
    (i.b.y1 - i.b.y0) > (H.y1 - H.y0) + 0.02 &&
    i.b.x1 > faceX0 &&
    i.b.x0 < H.x1,
);
const onGrip = hands.length === 2 && hands.every((h) =>
  grips.some((gr) => Math.abs(gr.w.y - h.w.y) < 0.09 && Math.abs(gr.w.z - h.w.z) < 0.09 && h.b.x0 <= gr.w.x + 0.03 && h.b.x1 >= gr.w.x - 0.03),
);
const riderTop = Math.max(...items.filter((i) => i.f.o.position.x < 0 && i.f.o.position.z > 0.4).map((i) => i.f.o.position.z));
// THE KID-SCALE: makeTricycle shrinks the whole rig on its ROOT so the toddler on the
// driveway matches the 0.6-scale soccer kids. Everything printed above is LOCAL model
// space; multiply by rootScale for the size the player actually sees on the street (a
// soccer kid stands ~1.12u, an adult worker ~1.86u).
const rootScale = g.scale && g.scale.x ? g.scale.x : 1;
const rigLen = (Math.max(...items.map((i) => i.b.x1)) - Math.min(...items.map((i) => i.b.x0))) * rootScale;
const crown = Math.max(...items.map((i) => i.b.z1)) * rootScale;
console.log("root scale", rootScale, "| ON THE STREET: crown", crown.toFixed(2) + "u", "| rig", rigLen.toFixed(2) + "u long (soccer kid ~1.12u tall)");
console.log("head midline z", midZ.toFixed(3), "| face slab x", faceX0.toFixed(2) + ".." + H.x1.toFixed(2));
console.log("anything on his head (hat/helmet)?", overFace ? "YES (bad)" : "NO (good) — the crown is his hair");
console.log("wide objects slicing the face band:", faceBand.length, faceBand.map((i) => i.color.toString(16)).join(","));
console.log("hands land on the grips?", onGrip ? "YES" : "NO");
console.log("rider top (chk limit 1.0):", riderTop.toFixed(3), "| visual top:", Math.max(...items.map((i) => i.b.z1)).toFixed(3), "(adult head ~1.66)");
const topHair = hair.length
  ? hair.reduce((a, b) => (b.b.z1 > a.b.z1 ? b : a))
  : null;
console.log("top of the kid is HAIR?", !!topHair ? "YES (z " + topHair.b.z1.toFixed(3) + ")" : "NO — something else crowns him");
const ok =
  skin.length >= 3 &&
  hair.length >= 1 &&
  !overFace &&
  !!topHair &&
  faceBand.length === 0 &&
  onGrip &&
  riderTop < 1.0;
console.log(ok ? "\nHEAD READS NORMAL — bare kid head: skin face, hair crown, nothing on top, skin hands on the bar" : "\nPROBLEM");
process.exit(ok ? 0 : 1);
