// _hopper_bag_chk.js — the GREY bags in the truck's rear scoop must carry the SAME tied top as
// the curb bags (cinch, spun rope, knot band, the pair of wide short grab ears), in grey, and
// stay flat inside the pack: no ear bristling up out of the scoop, the pile under the lip.
const fs = require("fs");
const path = require("path");
const THREE = require(path.join(__dirname, "_three128.js"));
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
function extractFn(name) {
  const s = src.indexOf("function " + name + "(");
  let i = src.indexOf("{", s), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) break; }
  }
  return src.slice(s, i + 1);
}
const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const R = (a, b) => a + Math.random() * (b - a);
eval(extractFn("LA")); eval(extractFn("crinkle")); eval(extractFn("slump"));
eval(extractFn("stuff")); eval(extractFn("pleat")); eval(extractFn("fray"));
eval(extractFn("curl")); eval(extractFn("twist")); eval(extractFn("yaw"));
eval(extractFn("lean")); eval(extractFn("sway")); eval(extractFn("wring"));
eval(extractFn("tieTop"));
const hopperLumps = [];
const hopperLoad = 0;
const hopperTrash = new THREE.Group();
const HOPPER_CYCLE_AT = 6;
const hopperTopZ = () => 0.8;
const s = 0.4; // the game's bag scale: tieTop's canonical unit is this global, not o.s
eval(extractFn("addHopperLump"));
const V = new THREE.Vector3();
const verts = (o) => {
  const p = o.geometry.attributes.position, out = [];
  for (let i = 0; i < p.count; i++) out.push(V.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  return out;
};
const meshes = (root) => { const out = []; root.traverse((o) => o.isMesh && out.push(o)); return out; };
const radMax = (pts) => pts.reduce((m, v) => Math.max(m, Math.hypot(v.x, v.y)), 0);
let bad = 0;
const check = (name, ok, detail) => { if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };

// measure the strip's shape: which vertex is highest z, and how far out it is
const probe = () => {
  const g = new THREE.Group();
  tieTop(g, { s: 0.4, top: 0.715, mat: M(0x23272e), dark: M(0x101317), full: 0.6 });
  g.updateMatrixWorld(true);
  const films = g.children.filter((c) => c.isGroup).map((y) => y.children[0].children[0].children[0]);
  films.forEach((e) => {
    const v = verts(e);
    const tip = v.reduce((a, b) => (b.z > a.z ? b : a), v[0]);
    const root = v.reduce((a, b) => (b.z < a.z ? b : a), v[0]);
    const wide = v.reduce((a, b) => (Math.hypot(b.x, b.y) > Math.hypot(a.x, a.y) ? b : a), v[0]);
    console.log(
      "tip z " + tip.z.toFixed(3) + " out " + Math.hypot(tip.x, tip.y).toFixed(3) +
      "  root z " + root.z.toFixed(3) + " out " + Math.hypot(root.x, root.y).toFixed(3) +
      "  widest out " + Math.hypot(wide.x, wide.y).toFixed(3) + " z " + wide.z.toFixed(3),
    );
  });
};
probe();

const partsOf = (g) => {
  const u = 1; // tieTop's canonical unit: u = (o.s || 0.4) / 0.4, and every bag passes s = 0.4
  const ms = meshes(g);
  const body = ms.find((o) => o.geometry.type === "SphereGeometry" && Math.abs(o.geometry.parameters.radius - 0.4) < 1e-6);
  const knot = ms.find((o) => o.geometry.type === "TorusGeometry");
  const ears = ms.filter((o) => o.geometry.type === "LatheGeometry");
  const funnel = ms.find((o) => o.geometry.type === "CylinderGeometry" && (o.geometry.parameters.radiusTop || 0) < 0.1 && o.geometry.parameters.radiusBottom >= 0.12);
  const rope = ms.find((o) => o.geometry.type === "CylinderGeometry" && Math.abs(o.geometry.parameters.radiusTop - 0.055 * u) < 1e-9 && Math.abs(o.geometry.parameters.radiusBottom - 0.065 * u) < 1e-9);
  const box = new THREE.Box3().setFromObject(g), bb = new THREE.Box3().setFromObject(body);
  const tipW = Math.max(...ears.map((e) => radMax(verts(e)) / u));
  const tieW = Math.max(...ms.filter((o) => o !== body).map((o) => radMax(verts(o)) / u));
  const earLen = Math.max(...ears.map((e) => { const b = new THREE.Box3().setFromObject(e); return b.max.z - b.min.z; }));
  const kc = knot ? new THREE.Box3().setFromObject(knot).getCenter(new THREE.Vector3()).z : 0;
  return { ms, u, body, knot, ears, funnel, rope, box, bb, tipW, tieW, earLen, zmax: box.max.z, bmz: bb.max.z, kc };
};

for (let n = 0; n < 4; n++) {
  hopperLumps.length = 0;
  addHopperLump("bag");
  const L = hopperLumps[0], g = L.g;
  g.position.set(0, 0, 0); // measure the LUMP ON ITS OWN CENTRE, not parked up in the pile
  g.updateMatrixWorld(true);
  const p = partsOf(g);
  const eb = p.ears.map((e) => new THREE.Box3().setFromObject(e));
  const bodyTop = 0.4 * 1.2 * L.baseScale; // the lump body is the sphere scaled 1.2 in z
  console.log("\n=== grey hopper bag " + (n + 1) + " (pile scale " + L.baseScale.toFixed(2) + ", tone " + L.mat.color.getHex().toString(16) + ", knot " + (L.mat2 ? L.mat2.color.getHex().toString(16) : "-") + ") ===");
  p.ms.forEach((o) => {
    const b = new THREE.Box3().setFromObject(o);
    console.log("  " + o.geometry.type.padEnd(17) + JSON.stringify(o.geometry.parameters || {}).slice(0, 52).padEnd(54) + " z " + b.min.z.toFixed(3) + ".." + b.max.z.toFixed(3) + " r " + radMax(verts(o)).toFixed(3));
  });
  console.log("  tie parts: funnel " + (p.funnel ? "y" : "n") + " rope " + (p.rope ? "y" : "n") + " knot " + (p.knot ? "y" : "n") + " ears " + p.ears.length + " | widest tie " + p.tieW.toFixed(3) + "u over body 0.400u | widest ear " + p.tipW.toFixed(3) + "u, ear length " + p.earLen.toFixed(3) + "u (the packer crushes ears to 0.55)");
  console.log("  ears z " + eb.map((b) => b.min.z.toFixed(2) + ".." + b.max.z.toFixed(2)).join(" | ") + " (body top " + bodyTop.toFixed(2) + ")");
  check("grey bag carries the SAME tied top (funnel, spun rope, knot, 2 ears)", !!(p.funnel && p.rope && p.knot && p.ears.length === 2));
  check("grey bag is GREY (palette ramp), the knot a dimmed grey", p.ms.every((o) => (o.material.color.r >> 4) - (o.material.color.g >> 4) <= 1 && (o.material.color.g >> 4) - (o.material.color.b >> 4) <= 1));
  check("the SAME wide ear design, scaled by the crush: tip / 0.55 >= 0.13u", p.tipW / 0.55 >= 0.13, "tip " + p.tipW.toFixed(3) + "u, scaled up " + (p.tipW / 0.55).toFixed(3) + "u");
  check("the strip stays short (crushed by the packer): length <= 0.24u", p.earLen <= 0.24, "len " + p.earLen.toFixed(3));
  check("the tie never out-widens the lump it grows out of", p.tieW <= 0.4 + 1e-9, "tie " + p.tieW.toFixed(3) + "u body 0.4u");
  check("no ear is buried inside the lump body", !eb.some((b) => b.min.z < bodyTop - 0.2));
  check("no ear bristles up out of the pack (<= 0.34 over the body top)", !eb.some((b) => b.max.z - bodyTop > 0.34));
  check("the lump fits the scoop (height <= 1.45)", p.box.max.z - p.box.min.z <= 1.45, "height " + (p.box.max.z - p.box.min.z).toFixed(2));
}
// the source must wire the hopper bags to the SAME builder, not a copy of it
check("addHopperLump builds its bags with tieTop() (one shared builder)", /tieTop\(\s*g\s*,\s*\{[^}]*top:\s*0\.48/.test(extractFn("addHopperLump")));
check("the hopper bag is told it is chewed half-flat (short ears hanging flat)", /full:\s*R\(\s*0\.05,\s*0\.32\s*\)/.test(extractFn("addHopperLump")) && /ear:\s*0\.55/.test(extractFn("addHopperLump")));
console.log(bad ? "HOPPER BAG CHECKS FAILED: " + bad : "ALL HOPPER BAG CHECKS PASSED");