// _baseball_stitch_chk.js — the STATEN ISLAND baseball stitching check.
// Verifies makeBaseball() in index.html draws the REAL baseball seam: the TWO leather panels
// that wrap a real ball share ONE border — a single closed, smooth FIGURE-EIGHT loop
// (latitude = SEAM_TILT * sin(azimuth), centripetal, so the eye tips are ROUNDED turns that
// NEVER form a point and the two lobes NEVER touch each other), and that loop cuts the ball
// into TWO EXACTLY EQUAL panels. 24 slanted cross-stitch dashes ride it with a clear gap
// between every pair — NOT a spiral, NOT a band round the middle, NOT a pinched 8.
const fs = require("fs");
const THREE = require("./three_r128.min.js");
const src = fs.readFileSync("index.html", "utf8");
let pass = 0,
  fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log("  PASS  " + name);
  } else {
    fail++;
    console.log("  FAIL  " + name + (detail ? "  [" + detail + "]" : ""));
  }
}
// ---- pull the REAL makeBaseball source out of index.html and RUN it ----
const fnStart = src.indexOf("function makeBaseball() {");
let depth = 0,
  fnEnd = -1;
for (let i = fnStart; i < src.length; i++) {
  const ch = src[i];
  if (ch === "/" && src[i + 1] === "/") {
    i = src.indexOf("\n", i);
    continue;
  }
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) {
      fnEnd = i;
      break;
    }
  }
}
const fnSrc = src.slice(fnStart, fnEnd + 1);
check("makeBaseball is found in index.html", fnStart >= 0);
check("NO band round the middle (no torus arcs left in the ball)", fnSrc.indexOf("TorusGeometry") < 0);
check("exactly ONE seam curve, not a stack of arcs", (fnSrc.match(/new THREE\.TubeGeometry/g) || []).length === 1);
check("the seam is a CLOSED loop (CatmullRom closed = true)", /new THREE\.CatmullRomCurve3\(pts, true, "centripetal"\)/.test(fnSrc));
check("latitude rides a sine wave on the azimuth (the smooth 8 shape)", /const SEAM_TILT = 1\.2217;[\s\S]*?const lat = SEAM_TILT \* Math\.sin\(lng\)/.test(fnSrc));
check("the seam tube is drawn as a closed ring hugging the surface", /new THREE\.TubeGeometry\(curve, 150, 0\.013, 5, true\)/.test(fnSrc));
check("the seam carries slanted cross-stitch dashes", /const slant = 0\.42/.test(fnSrc) && /new THREE\.BoxGeometry\(0\.032, 0\.009, 0\.0075\)/.test(fnSrc));
check("the loop is built CENTRIPETAL, so the tips can never cusp into a point", /"centripetal"/.test(fnSrc));
const R = Number((fnSrc.match(/const R\s*=\s*([\d.]+)/) || [])[1]);
check("the ball is sized to be SEEN on screen (R = 0.2, the soccer ball's size class) + the core-spin pattern", R === 0.2 && /core\.position\.z = R/.test(fnSrc) && /g\.userData\.core = core/.test(fnSrc), "R=" + R);

const ballFactory = new Function("THREE", "M", "SPH", fnSrc + "\nreturn makeBaseball();");
const core = ballFactory(THREE,
  (c) => new THREE.MeshLambertMaterial({ color: c }),
  (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m)).userData.core;
check("the cream sphere is in the core group", core.children.some((c) => c.geometry && c.geometry.type === "SphereGeometry"));
const seams = core.children.filter((c) => c.geometry && c.geometry.type === "TubeGeometry");
const dashes = core.children.filter((c) => c.geometry && c.geometry.type === "BoxGeometry");
check("exactly ONE seam tube (the figure-eight loop)", seams.length === 1, "got " + seams.length);
check("24 cross-stitch dashes around the loop", dashes.length === 24, "got " + dashes.length);
check("seam tube geometry builds clean (no NaN vertices)", seams[0].geometry.getAttribute("position").array.every((v) => Number.isFinite(v)));

// ---- the seam GEOMETRY itself (same math the game runs, R parsed above) ----
const SEAM_R = R * 1.004;
const TILT = Number(fnSrc.match(/const SEAM_TILT = ([\d.]+)/)[1]); // the seam's climb toward the poles
const STEPS_C = Number(fnSrc.match(/const STEPS = (\d+)/)[1]); // seamCurve's control points
const DASHES = Number(fnSrc.match(/const DASHES = (\d+)/)[1]); // the stitch count
const DASH_LEN = Number(fnSrc.match(/new THREE\.BoxGeometry\(([\d.]+)/)[1]); // how long a stitch is
check("the tilt is the real ball's ~70 deg climb toward each pole", Math.abs(TILT - 1.2217) < 0.02, "tilt=" + ((TILT * 180) / Math.PI).toFixed(1) + " deg");
check("the stitch count leaves a clear gap between every pair of neighbours", DASHES === 24, "DASHES=" + DASHES);
function seamCurve() {
  const pts = [];
  for (let i = 0; i < STEPS_C; i++) {
    const lng = (i / STEPS_C) * Math.PI * 2;
    const lat = TILT * Math.sin(lng);
    const rr = Math.cos(lat) * SEAM_R;
    pts.push(new THREE.Vector3(rr * Math.cos(lng), rr * Math.sin(lng), Math.sin(lat) * SEAM_R));
  }
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}
const c = seamCurve();
check("the seam is a CLOSED loop — it winds around and connects back to itself", c.closed === true && c.getPointAt(0).distanceTo(c.getPointAt(1)) < 1e-6);

// ONE full turn of azimuth (a loop, not a spiral), riding a sine wave in latitude
let wraps = 0,
  prevLng = null,
  surfMax = 0,
  surfMin = Infinity,
  zmax = -9,
  zmin = 9;
const N = 400;
for (let i = 0; i <= N; i++) {
  const p = c.getPointAt(i / N);
  const lng = Math.atan2(p.y, p.x);
  if (prevLng !== null) {
    let d = lng - prevLng;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    wraps += d;
  }
  prevLng = lng;
  const r = p.length();
  surfMax = Math.max(surfMax, r);
  surfMin = Math.min(surfMin, r);
  zmax = Math.max(zmax, p.z);
  zmin = Math.min(zmin, p.z);
}
check("the seam makes EXACTLY ONE full turn around the ball — a loop, not a spiral", Math.abs(Math.abs(wraps) - 2 * Math.PI) < 0.3, "turns=" + (wraps / (2 * Math.PI)).toFixed(2));
check("the seam hugs the ball skin the whole way (never inside, never floating)", surfMin > R * 0.99 && surfMax < R * 1.02, "r " + surfMin.toFixed(4) + ".." + surfMax.toFixed(4));
check("the seam climbs toward BOTH poles (the two eye tips bulge up and down)", zmax > 0.9 * SEAM_R && zmin < -0.9 * SEAM_R, "z " + zmin.toFixed(4) + ".." + zmax.toFixed(4));

// the POLAR view of the loop is the classic figure 8: the projected radius pinches twice
// (the two eye tips) and swells twice (the equator crossings). Sampling lands EXACTLY on the
// loop's own t = i/120 points, so every pinch and swell is a strict local extremum.
const N2 = 120;
const rhoArr = [],
  zArr = [];
let rhoMax = -9,
  rhoMin = 9;
for (let i = 0; i < N2; i++) {
  const p = c.getPointAt(i / N2);
  const rho = Math.sqrt(p.x * p.x + p.y * p.y);
  rhoArr.push(rho);
  zArr.push(p.z);
  rhoMax = Math.max(rhoMax, rho);
  rhoMin = Math.min(rhoMin, rho);
}
let pinches = 0,
  swells = 0,
  equator = 0;
for (let i = 0; i < N2; i++) {
  const a = rhoArr[(i - 1 + N2) % N2],
    b = rhoArr[i],
    d = rhoArr[(i + 1) % N2];
  if (b < a && b < d) pinches++;
  if (b > a && b > d) swells++;
  const z = zArr[i],
    zn = zArr[(i + 1) % N2];
  if (Math.abs(z) < 1e-9 && z * zn <= 0) equator++; // the loop crosses the equator here
}
check("the polar view of the seam is a FIGURE 8: 2 pinches + 2 swell lobes", pinches === 2 && swells === 2, "pinches=" + pinches + " swells=" + swells);
check("the loop crosses the ball's equator exactly 2 times (the two eye tips)", equator === 2, "equator crossings=" + equator);
// THE TIPS MUST NOT FORM A POINT: at the real 70 deg tilt the eye tips stop at 0.34*R, so the
// pinch is a ROUNDED turn. The old 83 deg tilt drove them to 0.14*R — a near-point.
check("the eye tips are ROUNDED turns, never a point (pinch radius > 0.25*R)", rhoMin / rhoMax > 0.25 && rhoMin / rhoMax < 0.45, "rho " + rhoMin.toFixed(4) + ".." + rhoMax.toFixed(4) + " ratio " + (rhoMin / rhoMax).toFixed(3));
// THE TWO LOBES NEVER TOUCH: the closest approach of any two far-apart points on the loop
let lobesMin = Infinity;
for (let i = 0; i < 200; i++) {
  for (let j = i + 12; j < 200; j++) {
    if (j >= 188 && i < 12) continue; // the loop closes at t=0/1 — those are neighbours
    const d = c.getPointAt(i / 200).distanceTo(c.getPointAt(j / 200));
    if (d < lobesMin) lobesMin = d;
  }
}
check("the two lobes NEVER touch each other (closest approach > 0.05u)", lobesMin > 0.05, "closest approach " + lobesMin.toFixed(4) + "u");
// THE SEAM SPLITS THE BALL INTO TWO EXACTLY EQUAL PANELS — a uniform (Fibonacci lattice)
// sphere sample classified by which side of the seam it falls on must split 50/50.
let north = 0;
const FS = 4000;
for (let i = 1; i <= FS; i++) {
  const y = 1 - (2 * (i - 0.5)) / FS; // uniform in latitude
  const r = Math.sqrt(1 - y * y);
  const phi = i * 2.3999632; // golden angle
  const th = Math.atan2(Math.sin(phi) * r, Math.cos(phi) * r);
  if (y > Math.sin(TILT) * Math.sin(th)) north++;
}
check("the seam separates the ball into TWO EXACTLY EQUAL panels (the leather pieces)", Math.abs(north / FS - 0.5) < 0.012, "panel split " + ((north / FS) * 100).toFixed(1) + "%");
// seam LENGTH: the loop swings up toward the poles, so it is LONGER than a plain circle
const L = c.getLength();
check(
  "the seam is longer than a plain circle because the 8 climbs toward the poles",
  L / (2 * Math.PI * R) > 1.0 && L / (2 * Math.PI * R) < 1.15,
  "ratio=" + (L / (2 * Math.PI * R)).toFixed(2),
);
// the stitches sit ON the loop, on the skin, lying flat, slanted across the seam
function nearestT(p) {
  let best = 0,
    bd = Infinity;
  for (let i = 0; i <= 400; i++) {
    const d = c.getPointAt(i / 400).distanceTo(p);
    if (d < bd) {
      bd = d;
      best = i / 400;
    }
  }
  return { t: best, d: bd };
}
let onCurve = 0,
  onSkin = 0,
  flat = 0,
  slanted = 0;
for (const dsh of dashes) {
  const near = nearestT(dsh.position);
  if (near.d < 0.01) onCurve++;
  const r = dsh.position.length();
  if (r > R * 0.99 && r < R * 1.04) onSkin++;
  const tan = c.getTangentAt(near.t).normalize();
  const basis = new THREE.Matrix4().makeRotationFromQuaternion(dsh.quaternion);
  const thin = new THREE.Vector3(0, 1, 0).applyMatrix4(basis).normalize();
  const longAxis = new THREE.Vector3(1, 0, 0).applyMatrix4(basis).normalize();
  if (Math.abs(thin.dot(tan)) < 0.25) flat++;
  const sA = Math.abs(longAxis.dot(tan));
  if (sA > 0.3 && sA < 0.6) slanted++;
}
check("every stitch dash sits on the seam loop", onCurve === dashes.length, onCurve + "/" + dashes.length);
check("every stitch dash stays on the ball skin", onSkin === dashes.length, onSkin + "/" + dashes.length);
check("every stitch lies flat against the ball (thin axis not edge-on)", flat === dashes.length, flat + "/" + dashes.length);
check("every stitch runs ACROSS the seam at a ~24 deg slant (real stitches)", slanted === dashes.length, slanted + "/" + dashes.length);

let prev = null,
  spMin = Infinity,
  spMax = 0;
for (let i = 0; i < DASHES; i++) {
  const p = c.getPointAt(i / DASHES);
  const q = c.getPointAt((i + 1) / DASHES);
  const s = p.distanceTo(q);
  spMin = Math.min(spMin, s);
  spMax = Math.max(spMax, s);
}
check("stitches are evenly spaced around the 8 loop (no clumps)", spMax / spMin < 2.0, "spacing " + spMin.toFixed(4) + ".." + spMax.toFixed(4));
// STITCHES NEVER TOUCH EACH OTHER: the spacing (loop length / DASHES) minus how long a
// stitch is must leave a clear gap on every pair of neighbours, and the stitches on the
// tight eye tips must clear the OTHER lobe's stitches too.
check("NEIGHBOURING stitches never touch (clear gap > 0.015u everywhere)", spMin - DASH_LEN > 0.015, "gap " + (spMin - DASH_LEN).toFixed(4) + "u (spacing " + spMin.toFixed(4) + " - stitch " + DASH_LEN + ")");
check("stitches on one lobe never touch the other lobe's stitches", lobesMin - DASH_LEN > 0.02, "gap " + (lobesMin - DASH_LEN).toFixed(4) + "u");

console.log("\n" + pass + " checks passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

