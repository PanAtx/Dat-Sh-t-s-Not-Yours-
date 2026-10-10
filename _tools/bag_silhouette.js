// _tools/bag_silhouette.js - ASCII elevation of the REAL makeBag() (X-Z plane), built from the
// transformed vertices of every mesh, so the whole loaded bag can be eyeballed for free:
// bottom-heavy body on a crushed base -> pleated neck -> knot band -> the loose grab flap.
// Every vertex is projected onto the slice plane (the bag is built from too few of them for a
// thin cross-section to draw an outline), so what you read is the SILHOUETTE itself.
//   node _tools/bag_silhouette.js [normal|heavy|maggot|piss]
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
eval(extractFn("LA")); // a surface of revolution: the flap, and anything else ever lathed
eval(extractFn("slump")); // the loaded, bottom-heavy silhouette
eval(extractFn("stuff")); // ...and the garbage pressing it out
eval(extractFn("pleat")); // the folds the tie leaves in the neck
eval(extractFn("fray")); // the knicked-off edge of the ears
eval(extractFn("curl")); // ...and the bend that hangs a long ear over at its loose end
eval(extractFn("twist")); // ...and the spin that winds the gathered film into a rope
eval(extractFn("crinkle"));
eval(extractFn("tieTop")); // the ONE tied top every bag and hopper lump shares
eval(extractFn("makeBag"));

const type = process.argv[2] || "normal";
const HEAVY = type === "heavy";
const ZLO = -0.04,
  ZHI = HEAVY ? 1.6 : 1.25, // the whole bag: pavement to the tip of the tallest ear
  XLO = HEAVY ? -0.62 : -0.5,
  XHI = -XLO,
  ROWS = 40,
  COLS = 61;
const g = makeBag(type);
// Spin the bag so the grab pair's own plane IS the slice plane: the cross-section then shows
// the two ears for what they are — each one two faces of one strip of film, splayed apart —
// with its partner, roughly opposite, clipped by the same plane.
const grab = g.children.find((c) => c.isGroup === true);
if (grab) g.rotation.z = -grab.rotation.z;
g.updateMatrixWorld(true);
const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(" "));
// One glyph per family of parts, so the section says what it is looking at:
// # = the film of the body/neck, * = the knot band, @ = the loose grab flap,
// + = the taut patch stretched over a hard corner.
const glyph = (o) =>
  o.geometry.type === "TorusGeometry"
    ? "*"
    : o.geometry.type === "LatheGeometry"
      ? "@"
      : o.parent && o.parent.type === "Mesh"
        ? "+"
        : "#";
const v = new THREE.Vector3();
g.traverse((o) => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  const p = o.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    const r = Math.round(((ZHI - v.z) / (ZHI - ZLO)) * (ROWS - 1));
    const c = Math.round(((v.x - XLO) / (XHI - XLO)) * (COLS - 1));
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (grid[r][c] === "@" && o.geometry.type !== "LatheGeometry") continue; // flap draws last
    grid[r][c] = glyph(o);
  }
});
console.log(
  type +
    ": x " + XLO + ".." + XHI + "  z " + ZLO + " (pavement) .. " + ZHI +
    " (top)   # = film, * = knot, @ = grab flap, + = taut patch",
);
grid.forEach((row) => console.log("  |" + row.join("") + "|"));

// ---- TOP VIEW (X-Y): the honest way to see that the flap is a FAN of film standing loose
// out of one knot, and that the neck below it is pleated all the way round.
const TLO = -0.4, THI = 0.4, TCOLS = 61, TROWS = 31;
const top = Array.from({ length: TROWS }, () => new Array(TCOLS).fill(" "));
const tl = new THREE.Vector3();
g.traverse((o) => {
  if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
  const p = o.geometry.attributes.position;
  const isFlap = o.geometry.type === "LatheGeometry";
  for (let i = 0; i < p.count; i++) {
    tl.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    if (tl.z < (HEAVY ? 1.0 : 0.78)) continue; // the TOP only: knot + flap above the shoulder
    const r = Math.round(((THI - tl.y) / (THI - TLO)) * (TROWS - 1));
    const c = Math.round(((tl.x - TLO) / (THI - TLO)) * (TCOLS - 1));
    if (r < 0 || r >= TROWS || c < 0 || c >= TCOLS) continue;
    if (!isFlap && top[r][c] === "@") continue; // the flap draws over the knot
    top[r][c] = isFlap ? "@" : glyph(o);
  }
});
console.log("  top view of the tie (x/y -0.4..0.4) - @ = the loose flap, * = the knot, gaps = pleats");
top.forEach((row) => console.log("  |" + row.join("") + "|"));
