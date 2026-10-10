// _tools/bag_probe.js — probe the "folded, pleated and frayed" invariants directly, so a
// failing check can be read as numbers instead of guesswork.
const fs = require("fs");
const path = require("path");
const THREE = require(path.join(__dirname, "..", "_three128.js"));
const src = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function extractFn(name) {
  const s = src.indexOf("function " + name + "(");
  let i = src.indexOf("{", s),
    d = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") {
      d--;
      if (!d) break;
    }
  }
  return src.slice(s, i + 1);
}
const M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const MS = (c, o) =>
  new THREE.MeshStandardMaterial(
    Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, o || {}),
  );
const CY = (r1, r2, h, m, s, hs) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) => new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const R = (a, b) => a + Math.random() * (b - a);
eval(["LA", "crinkle", "slump", "stuff", "pleat", "fray", "curl", "twist", "tieTop", "makeBag"].map((n) => extractFn(n)).join("\n"));
const g = makeBag(process.argv[2] || "normal");
g.updateMatrixWorld(true);
const ms = [];
g.traverse((o) => o.isMesh && ms.push(o));
// A dump of what the top is made of, in the bag's own scaled units, so the harnesses' numbers
// can be read against the shape instead of guessed.
const k = g.scale.x;
ms.forEach((m) => {
  const b = new THREE.Box3().setFromObject(m);
  console.log(
    "  " +
      m.geometry.type.padEnd(16) +
      JSON.stringify(m.geometry.parameters || {}).slice(0, 46).padEnd(48) +
      " z " +
      b.min.z.toFixed(3) +
      ".." +
      b.max.z.toFixed(3) +
      "  x " +
      b.min.x.toFixed(2) +
      ".." +
      b.max.x.toFixed(2),
  );
});
const body = ms.find((m) => m.geometry.type === "SphereGeometry" && m.geometry.parameters.radius === 0.4);

const a = body.geometry.attributes.position;
let hi = 0,
  lo = 1e9;
for (let i = 0; i < a.count; i++) {
  const r = Math.hypot(a.getX(i), a.getY(i));
  hi = Math.max(hi, r);
  lo = Math.min(lo, r);
}
const flap = ms.find((m) => m.geometry.type === "LatheGeometry");
const p = flap.geometry.parameters.points;
const fa = flap.geometry.attributes.position;
const seen = new Set();
for (let i = 0; i < fa.count; i++) seen.add(Math.round(Math.hypot(fa.getX(i), fa.getZ(i)) * 1e4));
const neck = ms.find(
  (m) =>
    m.geometry.type === "CylinderGeometry" &&
    m.geometry.parameters.radiusTop < 0.1 &&
    m.geometry.parameters.radiusBottom >= 0.12,
).geometry.attributes.position;
const fold = (flo, fhi) => {
  const rs = [];
  for (let i = 0; i < neck.count; i++) {
    const y = neck.getY(i);
    if (y < flo || y > fhi) continue;
    const r = Math.hypot(neck.getX(i), neck.getZ(i));
    if (r > 0.02) rs.push(r);
  }
  return (Math.max(...rs) - Math.min(...rs)) / Math.max(...rs);
};
console.log(
  "hi " + hi.toFixed(4) +
    " hi-lo " + (hi - lo).toFixed(4) +
    " p.length " + p.length +
    " seen " + seen.size +
    " foldTop " + fold(0.09, 0.12).toFixed(4) +
    " foldBot " + fold(-0.12, -0.09).toFixed(4),
);
console.log(
  "PASS:",
  hi <= 0.4001 && hi - lo > 0.02 && seen.size > p.length * 2 && fold(0.09, 0.12) > fold(-0.12, -0.09),
);

// THE SPUN ROPE: every ring of the barrel is rotated about the axis by an angle keyed to its
// height, so the TOP ring sits 2.9 turns (0.9 of a turn, mod one) round from the BOTTOM ring.
// The vertex rows run in the same column order at every height, so column i of the bottom ring
// pairs with column i of the top ring and the angle each one moved by IS the spin.
const probe = new THREE.CylinderGeometry(0.055, 0.065, 0.07, 16, 10),
  pa = probe.attributes.position;
const row = (y) => {
  const idx = [];
  for (let i = 0; i < pa.count; i++)
    if (Math.abs(pa.getY(i) - y) < 1e-6 && Math.hypot(pa.getX(i), pa.getZ(i)) > 0.02) idx.push(i);
  return idx;
},
  ang = (i) => Math.atan2(pa.getZ(i), pa.getX(i));
const rowLo = row(-0.035),
  aLo = rowLo.map(ang);
twist(probe, 2.9);
const rowHi = row(0.035),
  spin = [];
for (let i = 0; i < Math.min(rowLo.length, rowHi.length); i++) {
  let d = ang(rowHi[i]) - aLo[i];
  while (d < 0) d += Math.PI * 2;
  while (d >= Math.PI * 2) d -= Math.PI * 2;
  spin.push(d);
}
const want = (2.9 * Math.PI * 2) % (Math.PI * 2),
  allSame = spin.every((d) => Math.abs(d - spin[0]) < 1e-6);
console.log(
  "spin test: every column moved " +
    spin[0].toFixed(2) +
    " rad (" +
    spin.length +
    " columns, spread " +
    (Math.max(...spin) - Math.min(...spin)).toFixed(4) +
    "); 2.9 turns says " +
    want.toFixed(2) +
    " mod one turn",
);
console.log("SPUN:", allSame && Math.abs(spin[0] - want) < 0.02);





