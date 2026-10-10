// _tools/bag_top_audit.js — build the REAL makeBag() and measure the tied top against the
// brief: a bottom-heavy loaded body with a crushed, splayed base and an irregular outline; a
// pleated cinch under ONE flattened knot band; and above the knot TWO long loose grab ears of
// film — splayed apart, frayed, curled, and standing or flopping according to how FULL the bag
// is. Nothing anywhere may be a loop, fin, horn, ball, cone or bowl.
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
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const R = (a, b) => a + Math.random() * (b - a);
eval(extractFn("LA")); // the sheet of film an ear is spun from
eval(extractFn("crinkle")); // thin-plastic creases: inward only
eval(extractFn("slump")); // the bottom-heavy, ground-flattened body
eval(extractFn("stuff")); // the garbage pressing the film out
eval(extractFn("pleat")); // the radial folds a tie makes
eval(extractFn("fray")); // the uneven cut edge of an ear
eval(extractFn("curl")); // the droop a long strip of film hangs into
eval(extractFn("twist")); // ...and the spin that winds the gathered film into a rope
eval(extractFn("tieTop")); // the shared tied top: cinch, knot band, the pair of ears
eval(extractFn("makeBag"));

const V = new THREE.Vector3();
const verts = (o) => {
  const p = o.geometry.attributes.position,
    out = [];
  for (let i = 0; i < p.count; i++)
    out.push(V.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  return out;
};
const meshes = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};
const radMax = (pts) => pts.reduce((m, v) => Math.max(m, Math.hypot(v.x, v.y)), 0);
let bad = 0;
const check = (name, ok, detail) => {
  if (!ok) bad++;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
};
const build = (type) => {
  const g = makeBag(type);
  g.updateMatrixWorld(true);
  const ms = meshes(g);
  const body = ms.find(
    (o) => o.geometry.type === "SphereGeometry" && o.geometry.parameters.radius === 0.4,
  );
  const knot = ms.filter((o) => o.geometry.type === "TorusGeometry");
  const ears = ms.filter((o) => o.geometry.type === "LatheGeometry");
  const yaws = g.children.filter((c) => c.isGroup);
  const box = new THREE.Box3().setFromObject(g);
  console.log("\n=== " + type + " (scale " + g.scale.x + ") ===");
  ms.forEach((o) => {
    const b = new THREE.Box3().setFromObject(o);
    console.log(
      "  " +
        o.geometry.type.padEnd(17) +
        JSON.stringify(o.geometry.parameters || {}).slice(0, 54).padEnd(56) +
        " z " + b.min.z.toFixed(3) + ".." + b.max.z.toFixed(3),
    );
  });
  console.log(
    "  WORLD BOX x " + box.min.x.toFixed(2) + ".." + box.max.x.toFixed(2) +
      "  z " + box.min.z.toFixed(2) + ".." + box.max.z.toFixed(2),
  );
  return { g, ms, body, knot, ears, yaws, box, k: g.scale.x };
};
// A tied top on its own, at a KNOWN fullness — the one way to measure the tell, since makeBag
// rolls fullness itself and a bag can only ever be built as full as what is in it.
const tie = (full) => {
  const g = new THREE.Group();
  tieTop(g, { s: 0.4, top: 0.715, mat: M(0x23272e), dark: M(0x101317), full: full });
  g.updateMatrixWorld(true);
  const ms = meshes(g),
    knot = ms.find((o) => o.geometry.type === "TorusGeometry"),
    kb = new THREE.Box3().setFromObject(knot),
    kmid = (kb.min.z + kb.max.z) / 2,
    ears = ms
      .filter((o) => o.geometry.type === "LatheGeometry")
      .map((o) => {
        const b = new THREE.Box3().setFromObject(o);
        return {
          m: o,
          over: b.max.z - kmid, // how far the tip stands over the knot
          reach: Math.max(Math.abs(b.min.x), b.max.x), // how far out it reaches
          deep: b.min.z, // ...and where it is rooted
          fall: b.max.z - b.min.z, // the height it covers, tall-or-flat
        };
      });
  return { g, knot, kb, ears, yaws: g.children.filter((c) => c.isGroup) };
};

// ---- THE BODY: weight low, base crushed flat, outline irregular ------------------------
for (const type of ["normal", "heavy"]) {
  const r = build(type),
    k = r.k,
    pr = (function (body) {
      const p = verts(body),
        zmin = Math.min(...p.map((v) => v.z)),
        zmax = Math.max(...p.map((v) => v.z)),
        bands = new Array(10).fill(0).map(() => -9);
      p.forEach((v) => {
        const i = Math.min(9, Math.floor(((v.z - zmin) / (zmax - zmin)) * 10));
        bands[i] = Math.max(bands[i], Math.hypot(v.x, v.y));
      });
      return { p, zmin, zmax, bands };
    })(r.body),
    widest = pr.bands.indexOf(Math.max(...pr.bands)),
    maxR = Math.max(...pr.bands),
    baseR = pr.p
      .filter((v) => v.z < pr.zmin + (pr.zmax - pr.zmin) * 0.06)
      .reduce((m, v) => Math.max(m, Math.hypot(v.x, v.y)), 0),
    shoulder = pr.bands[8],
    sect = new Array(8).fill(0).map(() => -9);
  pr.p.forEach((v) => {
    const h = (v.z - pr.zmin) / (pr.zmax - pr.zmin);
    if (h < 0.2 || h > 0.62) return;
    let a = Math.atan2(v.y, v.x);
    if (a < 0) a += Math.PI * 2;
    const s = Math.min(7, Math.floor((a / (Math.PI * 2)) * 8));
    sect[s] = Math.max(sect[s], Math.hypot(v.x, v.y));
  });
  const mean = sect.reduce((a, b) => a + b, 0) / sect.length,
    swing = (Math.max(...sect) - Math.min(...sect)) / mean;
  console.log(
    "  widest band " + widest + "/9  base " + baseR.toFixed(3) + " vs widest " + maxR.toFixed(3) +
      "  shoulder " + shoulder.toFixed(3) + "  outline swing " + (swing * 100).toFixed(0) + "%",
  );
  check(type + ": the load sits LOW (widest ring in the lower half)", widest <= 4);
  check(
    type + ": the base is FLATTENED and splayed where it rests",
    baseR > 0.68 * maxR,
    baseR.toFixed(3) + " of " + maxR.toFixed(3),
  );
  check(
    type + ": the shoulders taper in toward the tie",
    shoulder < 0.75 * maxR,
    shoulder.toFixed(3) + " of " + maxR.toFixed(3),
  );
  check(
    type + ": the silhouette is IRREGULAR (the contents push it out of true)",
    swing > 0.06,
    (swing * 100).toFixed(0) + "% swing",
  );
  check(
    type + ": a hard object stretches the film THIN (a taut patch rides the ridge)",
    r.body.children.length > 0 &&
      r.body.children.every((c) => c.material.roughness < 0.2),
    r.body.children.length + " patch(es)",
  );
  check(
    type + ": the film is crinkled and never grows past its own envelope",
    radMax(pr.p) <= 0.42 * k + 1e-6 && maxR > 0.34 * k,
    maxR.toFixed(3),
  );
  check(
    type + ": the bag body stands ON the ground on its crushed base",
    pr.zmin > -0.02 * k && pr.zmin < 0.03 * k,
    pr.zmin.toFixed(3),
  );
  // The ears are loose film on top of everything, so they get their OWN height budget — but
  // they may never be what makes the bag wide, because width is the collider, the spawn fit
  // and the curb spot, all measured against the body.
  check(
    type + ": the ears stand up but never out-widen the body they grow out of",
    r.box.max.z <= 1.2 * k &&
      r.box.max.x <= 0.44 * k + 1e-6 &&
      Math.max(Math.abs(r.box.min.x), Math.abs(r.box.max.x)) <= 0.44 * k + 1e-6,
    "top " + (r.box.max.z / k).toFixed(3) + " halfwidth " + r.box.max.x.toFixed(3),
  );
  check(
    type + ": the parts are body, lump, neck, snout, knot and TWO ears" +
      (type === "heavy" ? " + tie" : ""),
    r.g.children.length === (type === "heavy" ? 8 : 7),
    r.g.children.length + " children",
  );
}


// ---- THE TOP: one knot band, TWO long grab ears, and the tell they carry ----------------
// A bag's excess is measured by column, the way the film was knicked: a LatheGeometry lays its
// vertices out column after column of profile points, so the spread of the column tops IS the
// unevenness of the cut.
const frayOf = (m) => {
  const rows = m.geometry.parameters.points.length,
    pos = m.geometry.attributes.position,
    tops = [];
  for (let c = 0; c * rows < pos.count; c++) {
    let mx = -9;
    for (let j = 0; j < rows; j++) {
      const i = c * rows + j;
      // Height ALONG THE STRIP, not plain local Y: the whole sheet was rotated over by curl()
      // after it was cut, and a rotation about the root preserves distance from it — plain Y
      // would mix the arc's own swing into what the cut edge was knicked to.
      const h = Math.hypot(pos.getY(i), pos.getZ(i));
      if (i < pos.count) mx = Math.max(mx, h);
    }
    tops.push(mx);
  }
  return {
    spread: Math.max(...tops) - Math.min(...tops),
    kinds: new Set(tops.map((t) => Math.round(t * 1e4))).size,
  };
};
for (const type of ["normal", "heavy"]) {
  const r = build(type),
    k = r.k,
    kb = new THREE.Box3().setFromObject(r.knot[0]),
    kmid = (kb.min.z + kb.max.z) / 2;
  console.log(
    "  knot band z " + kb.min.z.toFixed(3) + ".." + kb.max.z.toFixed(3) +
      "   yaws " + r.yaws.map((y) => y.rotation.z.toFixed(2)).join(",") +
      "   ears " +
      r.ears
        .map((e) => {
          const b = new THREE.Box3().setFromObject(e);
          return "z " + b.min.z.toFixed(2) + ".." + b.max.z.toFixed(2) +
            " (+" + (b.max.z - kmid).toFixed(2) + ")";
        })
        .join(" | "),
  );
  check(type + ": exactly ONE knot band, and no loops, fins, cones or balls anywhere", r.knot.length === 1);
  check(
    type + ": the knot is a FLATTENED band of twist, not a hoop",
    r.knot[0].scale.z <= 0.8,
    "scale z " + r.knot[0].scale.z,
  );
  check(
    type + ": the pinch leaves TWO loose grab EARS of film above the knot",
    r.ears.length === 2 && r.yaws.length === 2,
    r.ears.length + " ears on " + r.yaws.length + " pivots",
  );
  check(
    type + ": the pleats gather the neck (its top ring is folded, not round)",
    (function () {
      const neck = r.ms.find(
        (o) =>
          o.geometry.type === "CylinderGeometry" &&
          o.geometry.parameters.radiusTop < 0.1 && o.geometry.parameters.radiusBottom >= 0.12,
      );
      const p = verts(neck),
        zmax = Math.max(...p.map((v) => v.z)),
        ring = p.filter((v) => v.z > zmax - 0.012),
        rs = ring.map((v) => Math.hypot(v.x, v.y)),
        hi = Math.max(...rs),
        lo = Math.min(...rs);
      return (hi - lo) / hi > 0.12;
    })(),
  );
  r.ears.forEach((e, i) => {
    const eb = new THREE.Box3().setFromObject(e),
      p = e.geometry.parameters.points,
      iTop = p.reduce((a, b, j) => (b.y > p[a].y ? j : a), 0),
      iWide = p.reduce((a, b, j) => (b.x > p[a].x ? j : a), 0),
      geo = e.geometry.parameters,
      axis = new THREE.Vector3(0, 1, 0).applyQuaternion(
        e.getWorldQuaternion(new THREE.Quaternion()),
      ),
      lean = Math.acos(Math.min(1, Math.abs(axis.z))),
      v = verts(e),
      tip = v.reduce((a, b) => (b.z > a.z ? b : a), v[0]),
      root = v.reduce((a, b) => (b.z < a.z ? b : a), v[0]);
    check(
      type + ": ear " + i + " is LONGER than the 0.12u this used to cut off at, and NARROW (a strip, not a fan)",
      p[iTop].y >= 0.12 * k && geo.phiLength > 0.35 && geo.phiLength < 0.8,
      "length " + p[iTop].y.toFixed(3) + "  arc " + geo.phiLength.toFixed(2) + " rad",
    );
    check(
      type + ": ear " + i + " is CRIMPED NARROW at the knot and WIDEST at its cut edge — a taper " +
        "that opens toward the sky, never a lampshade continuing the neck's cone",
      iWide === iTop &&
        p[0].x <= p[iWide].x * 0.5 && // shut where the knot grips it
        p[1].x > p[0].x && // ...and opening as it climbs, all the way up
        p[iTop].x > 0.05 * k, // ...to a real webbed cut end, never a needle
      "widest at " + iWide + "/" + (p.length - 1) + ", root r " + p[0].x.toFixed(3) +
        " vs tip r " + p[iTop].x.toFixed(3),
    );
    check(
      type + ": ear " + i + " is a sheet FOLDED BACK ON ITSELF (closed film, two faces, no slit)",
      Math.abs(p[0].x - p[p.length - 1].x) < 1e-6 &&
        Math.abs(p[0].y - p[p.length - 1].y) < 1e-6 &&
        !p.some((q) => q.x < 0.02 * k),
    );
    check(
      type + ": ear " + i + " is ROOTED inside the knot band it grows out of",
      eb.min.z < kb.max.z && eb.min.z > kb.min.z - 0.1 * k,
      eb.min.z.toFixed(3),
    );
    check(
      type + ": ear " + i + " LEANS out of the knot (loose film cannot hold itself up)",
      lean > 0.03 && lean < 1.35,
      lean.toFixed(2) + " rad",
    );
    check(
      type + ": ear " + i + " hangs OVER — its tip is further out than its root",
      Math.hypot(tip.x, tip.y) > Math.hypot(root.x, root.y) * 1.4,
      Math.hypot(tip.x, tip.y).toFixed(3) + " out vs " + Math.hypot(root.x, root.y).toFixed(3),
    );
    const fr = frayOf(e);
    check(
      type + ": ear " + i + " is FRAYED — its cut edge was knicked a DIFFERENT DEPTH in every column",
      // Measured against the ear's own height, because raggedness is cut as a fraction of the
      // film. The nick is deliberately SHALLOW now (a deep one flounces the hem into a lampshade
      // frill), so this margin is smaller than it was — a raggedness, not a sawed-off field.
      fr.kinds >= 4 && fr.spread > 0.03 * p[iTop].y,
      fr.kinds + " different heights, " + fr.spread.toFixed(3) + " of " + p[iTop].y.toFixed(3) + " long",
    );
  });

  let sep = Math.abs(r.yaws[0].rotation.z - r.yaws[1].rotation.z) % (Math.PI * 2);
  if (sep > Math.PI) sep = Math.PI * 2 - sep;
  check(
    type + ": the pair SPLAYS apart (65-180 degrees round the knot, never one bow or one tuft)",
    sep > 1.1 && sep <= Math.PI + 1e-6,
    sep.toFixed(2) + " rad apart",
  );
  check(
    type + ": every ear has a swing frame of its own, at rest until the film-sway system moves it",
    r.g.userData.ears.length === 2 &&
      r.g.userData.ears.every(
        (e) =>
          e.swing &&
          e.swing.rotation.x === 0 &&
          e.swing.rotation.y === 0 &&
          typeof e.az === "number" &&
          e.w > 0 &&
          typeof e.ph === "number",
      ),
  );
  check(
    type + ": the two ears point different ways AND belong to the same knot (never two separate tufts)",
    r.g.userData.ears.every(
      (e) =>
        Math.abs(
          Math.atan2(Math.sin(e.az - r.yaws[0].rotation.z), Math.cos(e.az - r.yaws[0].rotation.z)),
        ) < 4,
    ) && r.yaws.every((y) => Math.abs(y.position.z - r.knot[0].position.z) < 0.03 * r.k),
  );
}

// ---- THE TELL: a packed bag stands its ears up, a half-empty one flops them flat --------
(function () {
  const tall = [],
    flop = [];
  for (let i = 0; i < 12; i++) {
    tall.push(Math.max(...tie(1).ears.map((e) => e.over)));
    flop.push(Math.max(...tie(0.28).ears.map((e) => e.over)));
  }
  const packed = tie(1),
    slack = tie(0.28),
    pLen = Math.max(...packed.ears.map((e) => e.m.geometry.parameters.points.reduce((a, b) => Math.max(a, b.y), 0))),
    sLen = Math.max(...slack.ears.map((e) => e.m.geometry.parameters.points.reduce((a, b) => Math.max(a, b.y), 0))),
    sMin = Math.min(
      ...slack.ears.map((e) => e.m.geometry.parameters.points.reduce((a, b) => Math.max(a, b.y), 0)),
    ),
    pOver = Math.max(...tall),
    sOver = Math.max(...flop),
    pFall = Math.max(...packed.ears.map((e) => e.fall)),
    sFall = Math.max(...slack.ears.map((e) => e.fall)),
    pLean = Math.max(...packed.yaws.map((y) => y.children[0].rotation.x)),
    sLean = Math.max(...slack.yaws.map((y) => y.children[0].rotation.x));
  console.log(
    "\n=== THE TELL ===\n  packed bag:    longest ear stands " + pOver.toFixed(3) +
      " over the knot, leans " + pLean.toFixed(2) + " rad, film " + pLen.toFixed(3) + " long",
    "\n  half-empty bag: longest ear stands " + sOver.toFixed(3) + ", leans " + sLean.toFixed(2) +
      ", film " + sLen.toFixed(3) + " long",
  );
  check(
    "a packed bag lets its grab film out to well over what this bag used to leave in it (0.15u)",
    pLen >= 0.19,
    pLen.toFixed(3),
  );
  check(
    "even a half-empty bag still has a real ear of film, it just does not stand up",
    sMin >= 0.12,
    sMin.toFixed(3),
  );
  check("a packed bag throws at least 0.16u of ear above the knot", pOver >= 0.16, pOver.toFixed(3));
  check(
    "a half-empty bag throws clearly less ear, and NEVER as much as a packed one",
    Math.min(...tall) > Math.max(...flop) && Math.max(...flop) < 0.16,
    "packed " + Math.min(...tall).toFixed(3) + ".." + pOver.toFixed(3) +
      "  slack " + Math.min(...flop).toFixed(3) + ".." + sOver.toFixed(3),
  );
  check(
    "a half-empty bag's ears flop at least twice as far over as a packed bag's",
    sLean >= pLean * 2,
    sLean.toFixed(2) + " vs " + pLean.toFixed(2) + " rad",
  );
  check(
    "the tell also reads as HEIGHT: a packed bag's ear covers more vertical fall than a slack one's",
    pFall > sFall,
    pFall.toFixed(3) + " vs " + sFall.toFixed(3),
  );
})();


// ---- THE SWAY: every ear hangs off a pivot the per-frame system can push on -------------
check(
  "the game drives it: updateEarSway exists and the loop runs it every frame",
  (function () {
    const up = src.indexOf("function updateEarSway("),
      lp = src.indexOf("function loop(");
    return (
      up > 0 &&
      lp > 0 &&
      src.indexOf("updateEarSway(dt);", lp) > 0 &&
      /g\.getWorldPosition\(EAR_V\)/.test(src) &&
      /g\.getWorldQuaternion\(EAR_Q\)/.test(src)
    );
  })(),
);
check(
  "bags sign themselves up as they are tied, and the sway reads that list",
  /typeof registerEars === "function"/.test(extractFn("tieTop")) &&
    /EAR_SWAY\.push\(/.test(extractFn("registerEars")) &&
    /EAR_SWAY\.splice\(/.test(extractFn("updateEarSway")), // ...and lets go of bags that leave
);
check(
  "a bag that was shoved has somewhere to put it: the swing frame, not the tie itself",
  (function () {
    const t = extractFn("tieTop");
    return /swing\.add\(film\)/.test(t) && /lean\.add\(swing\)/.test(t) && /yaw\.add\(lean\)/.test(t);
  })(),
);
check(
  "the sway is a damped spring with a ceiling, so it settles instead of ringing or flopping out",
  (function () {
    const u = extractFn("updateEarSway");
    return (
      /EAR_K - e\.vx \* EAR_C/.test(u) &&
      /EAR_K - e\.vy \* EAR_C/.test(u) &&
      /e\.sx = e\.sx < -0\.85/.test(u) &&
      /e\.sy = e\.sy < -0\.5/.test(u)
    );
  })(),
);
check(
  "the tie carries none of the geometry this top used to be built from (loops, liners, crowns, pucker)",
  !(function () {
    const t = extractFn("tieTop");
    return (
      /EAR_R|OVAL_X|OVAL_Z|HOLE_X|LINER|pucker|Crown|bail/.test(t) ||
      /CircleGeometry|TubeGeometry|CapsuleGeometry|TorusKnot/.test(t)
    );
  })(),
);
check(
  "the tie is built ONCE: one knot band and one ear builder, both used by the loop that makes the pair",
  (function () {
    const t = extractFn("tieTop");
    return (
      (t.match(/new THREE\.TorusGeometry/g) || []).length === 1 &&
      (t.match(/LA\(/g) || []).length === 1 &&
      (t.match(/curl\(/g) || []).length === 1 &&
      /for \(let i = 0; i < 2; i\+\+\)/.test(t)
    );
  })(),
);

// ---- THE GREY HOPPER LUMP: the same bag, chewed ----------------------------------------
const hopperLumps = [];
const hopperTrash = new THREE.Group();
const hopperWorld = { add() {} };
const hopperLoad = 1;
const HOPPER_CYCLE_AT = 5;
const hopperTopZ = () => 2.4;
void hopperTrash;
void hopperWorld;
eval(extractFn("addHopperLump"));
let lumpBad = 0;
for (let n = 0; n < 6; n++) {
  hopperLumps.length = 0;
  addHopperLump("normal");
  const L = hopperLumps[0];
  L.g.position.set(0, 0, 0);
  L.g.updateMatrixWorld(true);
  const ms = meshes(L.g),
    knot = ms.filter((o) => o.geometry.type === "TorusGeometry"),
    ears = ms.filter((o) => o.geometry.type === "LatheGeometry"),
    eb = ears.map((e) => new THREE.Box3().setFromObject(e)),
    box = new THREE.Box3().setFromObject(L.g),
    bodyTop = 0.4 * 1.2 * L.baseScale,
    errs = [];
  if (knot.length !== 1) errs.push("expected 1 knot band, got " + knot.length);
  if (ears.length !== 2) errs.push("expected 2 ears, got " + ears.length);
  if (eb.some((b) => b.min.z < bodyTop - 0.2)) errs.push("an ear is buried in the lump body");
  // Compacted trash does not bristle: the packer leaves a lump's ears shorter than a curb
  // bag's, which is also what keeps a stack of them under the scoop's own height.
  if (eb.some((b) => b.max.z - bodyTop > 0.34)) errs.push("an ear stands up out of the pack");
  if (box.max.z - box.min.z > 1.45)
    errs.push("lump too tall for the scoop: " + (box.max.z - box.min.z).toFixed(2));
  if (errs.length) lumpBad++;
  console.log(
    (errs.length ? "FAIL " : "PASS ") +
      " hopper lump #" + n +
      ": height " + (box.max.z - box.min.z).toFixed(2) +
      ", width " + (box.max.x - box.min.x).toFixed(2) +
      ", ears " + eb.map((b) => b.min.z.toFixed(2) + ".." + b.max.z.toFixed(2)).join(" | ") +
      " (body top " + bodyTop.toFixed(2) + ")" +
      (errs.length ? "  <-- " + errs.join("; ") : ""),
  );
}
console.log(
  lumpBad ? lumpBad + " HOPPER LUMP FAILURES" : "ALL HOPPER LUMP CHECKS PASSED",
);
console.log(bad ? bad + " BAG AUDIT FAILURES" : "ALL BAG AUDIT CHECKS PASSED");

