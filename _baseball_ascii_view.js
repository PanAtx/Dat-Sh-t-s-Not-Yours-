// _baseball_ascii_view.js — eyeball the stitching: ASCII-project the REAL makeBaseball()'s ONE
// closed, smooth figure-eight seam loop from index.html (the border the two leather panels
// share), in the polar view (the 8 + the two EQUAL panels shaded a/b), the front view the
// camera sees, and the side view. Numbers (tilt, stitches, gaps, panel split) are PARSED from
// the model, not typed in by hand.
const fs = require("fs");
const THREE = require("./three_r128.min.js");
const src = fs.readFileSync("index.html", "utf8");
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
const factory = new Function("THREE", "M", "SPH", fnSrc + "\nreturn makeBaseball();");
const core = factory(THREE,
  (c) => new THREE.MeshLambertMaterial({ color: c }),
  (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m)).userData.core;
const R = Number((fnSrc.match(/const R\s*=\s*([\d.]+)/) || [])[1]); // the ball radius the model runs
const TILT = Number(fnSrc.match(/const SEAM_TILT = ([\d.]+)/)[1]); // the seam's climb toward the poles
const STEPS_C = Number(fnSrc.match(/const STEPS = (\d+)/)[1]); // the loop's control points
const DASHES = Number(fnSrc.match(/const DASHES = (\d+)/)[1]); // the stitch count
const DASH_LEN = Number(fnSrc.match(/new THREE\.BoxGeometry\(([\d.]+)/)[1]); // how long a stitch is
const W = 70,
  H = 34;
function seamCurve() {
  const pts = [];
  for (let i = 0; i < STEPS_C; i++) {
    const lng = (i / STEPS_C) * Math.PI * 2;
    const lat = TILT * Math.sin(lng);
    const rr = Math.cos(lat) * R * 1.004;
    pts.push(new THREE.Vector3(rr * Math.cos(lng), rr * Math.sin(lng), Math.sin(lat) * R * 1.004));
  }
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}
const A = seamCurve();
// THE classic baseball view looks along the axis through the two EYE TIPS (the loop's two
// rounded tips, at latitude +TILT az 90 and its antipode). Looking down that axis, the seam
// reads as the figure 8 / infinite loop of the panels' shared border.
const EYE_DIR = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT)).normalize();
const EYE_U = new THREE.Vector3(1, 0, 0);
const EYE_V = new THREE.Vector3().crossVectors(EYE_DIR, EYE_U).normalize();
let NOCULL = false;
function render(viewAxis, label, nocull, panels) {
  NOCULL = !!nocull;
  const grid = [];
  for (let r = 0; r < H; r++) grid.push(new Array(W).fill(" "));
  function pos(p) {
    // screen (u,v) + depth d; culled views keep only the near side
    let u, v, d;
    if (viewAxis === "eye") {
      u = p.dot(EYE_U);
      v = p.dot(EYE_V);
      d = p.dot(EYE_DIR);
    } else if (viewAxis === "x") {
      u = p.y;
      v = p.z;
      d = p.x;
    } else if (viewAxis === "y") {
      u = -p.x;
      v = p.z;
      d = p.y;
    } else {
      u = p.x;
      v = p.y;
      d = p.z;
    }
    if (!NOCULL && d < -0.01) return null;
    const c = Math.round((W / 2 - 1) * (1 + u / R));
    const r = Math.round((H / 2 - 1) * (1 - v / R));
    if (c < 0 || c >= W || r < 0 || r >= H) return null;
    return { r, c };
  }
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const u = ((c - (W / 2 - 1)) / (W / 2 - 1)) * R;
      const v = ((H / 2 - 1 - r) / (H / 2 - 1)) * R;
      if (u * u + v * v > R * R * 0.99 && u * u + v * v < R * R * 1.06) {
        const d = Math.sqrt(R * R - u * u - v * v);
        if (NOCULL || d > -0.01) grid[r][c] = ".";
      }
    }
  // shade the TWO leather panels the seam separates (only meaningful in the polar view)
  if (panels) {
    for (let r = 0; r < H; r++)
      for (let c = 0; c < W; c++) {
        const u = ((c - (W / 2 - 1)) / (W / 2 - 1)) * R;
        const v = ((H / 2 - 1 - r) / (H / 2 - 1)) * R;
        if (u * u + v * v < R * R * 0.99 && grid[r][c] === " ") {
          const d = Math.sqrt(R * R - u * u - v * v); // the point on the visible side
          const az = Math.atan2(v, u);
          grid[r][c] = d / R > Math.sin(TILT) * Math.sin(az) ? "a" : "b";
        }
      }
  }
  for (let i = 0; i <= 2000; i++) {
    const q = pos(A.getPointAt(i / 2000));
    if (q) grid[q.r][q.c] = "#"; // the seam draws OVER the panel shading — it is their border
  }
  for (const ch of core.children) {
    if (!ch.geometry || ch.geometry.type !== "BoxGeometry") continue;
    const q = pos(ch.position.clone());
    if (q) grid[q.r][q.c] = "*";
  }
  console.log(label + "\n" + grid.map((row) => row.join("")).join("\n") + "\n");
}
render("eye", "FIGURE-8 VIEW (looking along the axis through the two eye tips — the shape of the seam):", true, false);
render("z", "Polar view (down the pole axis — the FIGURE 8 and the TWO EQUAL panels shaded a / b):", true, true);
render("x", "FRONT VIEW (the ball as the camera sees it, near side only):", false, false);
render("y", "SIDE VIEW (near side only):", false, false);
console.log("# = the ONE seam loop (the panels' shared border), * = cross-stitch dash, a/b = the two leather panels, . = ball edge");

// ---- the numbers the model runs ----
let lobesMin = Infinity;
for (let i = 0; i < 200; i++)
  for (let j = i + 12; j < 200; j++) {
    if (j >= 188 && i < 12) continue; // the loop closes at t=0/1
    lobesMin = Math.min(lobesMin, A.getPointAt(i / 200).distanceTo(A.getPointAt(j / 200)));
  }
let spMin = Infinity,
  spMax = 0;
for (let i = 0; i < DASHES; i++) {
  const s = A.getPointAt(i / DASHES).distanceTo(A.getPointAt((i + 1) / DASHES));
  spMin = Math.min(spMin, s);
  spMax = Math.max(spMax, s);
}
let north = 0;
const FS = 4000;
for (let i = 1; i <= FS; i++) {
  const y = 1 - (2 * (i - 0.5)) / FS;
  const r = Math.sqrt(1 - y * y);
  const phi = i * 2.3999632;
  const th = Math.atan2(Math.sin(phi) * r, Math.cos(phi) * r);
  if (y > Math.sin(TILT) * Math.sin(th)) north++;
}
console.log("tilt " + ((TILT * 180) / Math.PI).toFixed(1) + " deg · " + DASHES + " stitches · neighbour gap " + (spMin - DASH_LEN).toFixed(4) + "u (spacing " + spMin.toFixed(4) + ".." + spMax.toFixed(4) + ") · lobe gap " + lobesMin.toFixed(4) + "u · panel split " + ((north / FS) * 100).toFixed(1) + "% / " + (100 - (north / FS) * 100).toFixed(1) + "%");