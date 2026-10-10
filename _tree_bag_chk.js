// _tree_bag_chk.js — tree silhouette + heavy-bag readability checks.
//   - makeTree (lawn tree): NO lollipop anymore — tall tapered trunk + a flat-shaded,
//     lopsided crown (icosahedron + 2 offset lobes), nothing casts a shadow.
//   - makeSidewalkTree (the trees standing next to curb bags): SAME 2.0u trunk height (the
//     leash chain ties off at z 1.5, the blue jay nest sits in the crown), but a flared
//     root, a dirt tree-pit, a faceted egg-shaped crown and a third leaf clump (the crown
//     normals are recomputed, because PolyhedronGeometry's own normals are spherical).
//   - HEAVY (green) bags read as PLASTIC, not foliage: deep cool bio-waste green, dull
//     heavy-duty MeshStandardMaterial and a light twist-tie a tree never has.
//   - THE TIED TOP on every bag: film gathered into a pleated neck, a tight flattened knot
//     band, and TWO long "garbageman grab" ears of excess above it — crinkled, frayed,
//     splayed strips of film that curl over at the loose end, standing nearly straight up on
//     a bag packed hard and flopping flat on a half-empty one (the fullness tell), and never
//     a pair of loops, a horn, a bowl or a squashed ball.
//   - The BODY is loaded and bottom-heavy: weight low, base crushed flat on the pavement,
//     shoulders funneling into the tie, outline pushed out of true by what is inside (one
//     hard corner stretches a lighter, glossier taut patch of film over it).
//   - keepCurbBagsOffTree: a curb bag that lands under a crown is shoved clear of the
//     trunk, stays inside its own cell / sidewalk band, and the big Maspeth oak keeps its
//     left side (the acorn line) free.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
global.THREE = require(path.join(__dirname, "_three128.js"));
const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let ok = true;
const check = (name, cond, detail) => {
  console.log(
    (cond ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""),
  );
  if (!cond) ok = false;
};

// (a) inline scripts still parse
const scripts = [
  ...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
].map((m) => m[1]);
let synOk = true;
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: "inline#" + i });
  } catch (e) {
    synOk = false;
    console.log("  syntax fail inline#" + i + ": " + e.message);
  }
});
check("inline script(s) parse (" + scripts.length + ")", synOk);

// ---- extract + run the REAL builders -------------------------------------------------
function extractFn(name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error(name + " not found");
  let i = src.indexOf("{", start),
    depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(start, i + 1);
}
const M = (c, opt) =>
  new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {}));
const MS = (c, opt) =>
  new THREE.MeshStandardMaterial(
    Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {}),
  );
const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const CY = (r1, r2, h, m, s, hs) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10, hs || 1), m);
const SP = (r, m, s) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
const SPH = (r, m, ws, hs) =>
  new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m);
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0.3;
const spawnMaxY = () => 5.0;
eval(extractFn("makeTree"));
eval(extractFn("makeSidewalkTree"));
eval(extractFn("LA")); // the two shape helpers the tied top is built from: a lathe for
eval(extractFn("crinkle")); // anything hollow, and the creases that keep thin film from lying
eval(extractFn("slump")); // flat: the loaded, ground-flattened body, the garbage inside it,
eval(extractFn("stuff")); // the radial folds a tie leaves behind, and the ragged cut edge of
eval(extractFn("pleat")); // the excess flap that comes out on top of the knot
eval(extractFn("fray")); // ...and the droop that bends a long grab ear OVER at its loose end
eval(extractFn("curl"));
eval(extractFn("twist")); // the spin that winds the gathered neck and the rope
eval(extractFn("tieTop")); // the shared knotted top makeBag builds its bags with
eval(extractFn("makeBag"));
eval(extractFn("keepCurbBagsOffTree"));

const meshes = (g) => {
  const a = [];
  g.traverse((c) => {
    if (c.isMesh) a.push(c);
  });
  return a;
};
const lum = (c) =>
  0.2126 * ((c >> 16) & 0xff) +
  0.7152 * ((c >> 8) & 0xff) +
  0.0722 * (c & 0xff);
const rgb = (x) => [(x >> 16) & 0xff, (x >> 8) & 0xff, x & 0xff];
const hexes = (g) => meshes(g).map((m) => m.material.color.getHex());
const ico = (g) =>
  meshes(g).find((m) => m.geometry.type === "IcosahedronGeometry");
const cyl = (g, minH) =>
  meshes(g).find(
    (m) =>
      m.geometry.type === "CylinderGeometry" &&
      m.geometry.parameters.height >= (minH || 0),
  );
// The lathed shells of the tied top, in the order they are built: [0] the crown (the
// outside of the bowl, ending on its rim), [1] the dimple (the inside that shades it).
const lathes = (g) =>
  meshes(g).filter((m) => m.geometry.type === "LatheGeometry");
// The design profile a lathe was spun from — [radius, height] pairs (crinkling moves the
// surface, never the profile it was drawn from, which is exactly what these check).
const profile = (m) => m.geometry.parameters.points;
// A geometry is FACETED when each triangle's three vertex normals are identical (flat
// faces) instead of the spherical normals PolyhedronGeometry ships with (a smooth ball).
const isFaceted = (geo) => {
  if (geo.index) return false;
  const n = geo.getAttribute("normal");
  for (let t = 0; t < Math.min(30, n.count / 3); t++) {
    const a = t * 3;
    const nx = n.getX(a),
      ny = n.getY(a),
      nz = n.getZ(a);
    for (let v = 1; v < 3; v++) {
      if (
        Math.abs(nx - n.getX(a + v)) > 1e-6 ||
        Math.abs(ny - n.getY(a + v)) > 1e-6 ||
        Math.abs(nz - n.getZ(a + v)) > 1e-6
      )
        return false;
    }
  }
  return true;
};

// ---- 1) lawn tree: tall trunk + faceted lopsided crown -------------------------------
check(
  "makeTree builds a Group",
  (() => {
    const t = makeTree();
    return t && t.isGroup && t.children.length >= 2;
  })(),
);
check(
  "makeTree trunk is TALL (>=1.9u) — no lollipop stick (old 1.3)",
  (() => {
    const tr = cyl(makeTree(), 1.0);
    return !!tr && tr.geometry.parameters.height >= 1.9;
  })(),
);
check(
  "makeTree trunk tapers (thin top, thick base) and stands upright on +Z",
  (() => {
    const tr = cyl(makeTree(), 1.0);
    return (
      !!tr &&
      tr.geometry.parameters.radiusTop < tr.geometry.parameters.radiusBottom &&
      Math.abs(Math.abs(tr.rotation.x) - Math.PI / 2) < 0.01
    );
  })(),
);
check(
  "makeTree crown is a FACETED icosahedron (recomputed normals, not a smooth ball)",
  (() => {
    const cr = ico(makeTree());
    return (
      !!cr &&
      cr.material.isMeshLambertMaterial === true &&
      isFaceted(cr.geometry)
    );
  })(),
);
check(
  "the faceting test discriminates (a RAW icosahedron is still a smooth ball)",
  isFaceted(new THREE.IcosahedronGeometry(1, 1)) === false,
);
check(
  "makeTree crown carries 2 offset lobes and its top clears 3.0u",
  (() => {
    const cr = ico(makeTree());
    if (!cr || cr.children.length < 2) return false;
    return (
      cr.position.z + cr.geometry.parameters.radius > 3.0 &&
      cr.children.length === 2 &&
      cr.children.every((c) => c.isMesh && isFaceted(c.geometry))
    );
  })(),
);
check(
  "makeTree varies crown size + leaf green per tree (5 samples all differ)",
  (() => {
    const seen = new Set();
    for (let i = 0; i < 5; i++) {
      const cr = ico(makeTree());
      seen.add(
        cr.geometry.parameters.radius.toFixed(3) +
          ":" +
          cr.material.color.getHex(),
      );
    }
    return seen.size === 5;
  })(),
);
check(
  "makeTree casts NO shadows (trunk flicker fix preserved)",
  meshes(makeTree()).every((m) => m.castShadow === false),
);

// ---- 2) sidewalk tree: still a valid leash / nest fixture ---------------------------
check(
  "makeSidewalkTree trunk height unchanged at 2.0u (chain tie-off z1.5 stays on the trunk)",
  (() => {
    const tr = cyl(makeSidewalkTree(), 1.0);
    return !!tr && tr.geometry.parameters.height === 2.0;
  })(),
);
check(
  "makeSidewalkTree trunk flares at the ROOT (rotation.x = -90deg tips radiusTop DOWN)",
  (() => {
    const tr = cyl(makeSidewalkTree(), 1.0);
    return (
      !!tr &&
      tr.geometry.parameters.radiusTop > tr.geometry.parameters.radiusBottom
    );
  })(),
);
check(
  "makeSidewalkTree keeps the brown trunk colour 0x4a3520 (manhattan fixture anchor)",
  hexes(makeSidewalkTree()).includes(0x4a3520),
);
check(
  "makeSidewalkTree crown is FACETED, egg-shaped (scale z > 1) and has 2 leaf clumps",
  (() => {
    const cr = ico(makeSidewalkTree());
    return (
      !!cr &&
      isFaceted(cr.geometry) &&
      cr.scale.z > 1.0 &&
      cr.children.length >= 2 &&
      cr.children.every((c) => c.isMesh && isFaceted(c.geometry))
    );
  })(),
);
check(
  "makeSidewalkTree crown is off-centre (lopsided, never dead-on the stick)",
  (() => {
    const cr = ico(makeSidewalkTree());
    return !!cr && (cr.position.x !== 0 || cr.position.y !== 0);
  })(),
);
check(
  "makeSidewalkTree canopy still casts its (broad) contact shadow",
  (() => {
    const cr = ico(makeSidewalkTree());
    return !!cr && cr.castShadow === true;
  })(),
);
check(
  "makeSidewalkTree has a flat dirt tree-pit disc at the trunk foot (no shadow)",
  (() => {
    const pit = meshes(makeSidewalkTree()).find(
      (m) =>
        m.geometry.type === "CylinderGeometry" &&
        m.geometry.parameters.height < 0.1,
    );
    return (
      !!pit &&
      pit.castShadow === false &&
      pit.position.z > 0 &&
      pit.position.z < 0.1
    );
  })(),
);
check(
  "makeSidewalkTree canopy stays GREEN-dominant (the leafy crown anchor colour)",
  (() => {
    const c = rgb(ico(makeSidewalkTree()).material.color.getHex());
    return c[1] > c[0] && c[1] > c[2] && c[2] < 80;
  })(),
);

// ---- 3) HEAVY bag vs the trees + THE TIED TOP (pleats, knot, grab ears) ----------------
const hb = makeBag("heavy"),
  nb = makeBag("normal");
// Up here there is ONE knot band — a flattened torus, the twist itself — and TWO long grab
// ears, each a lathe spun over a narrow arc of a turn. Loops, bow-ties, a squashed ball, a
// bowl, or a single fanned flap on top are all the things this bag used to be, and all of
// them are what these checks hunt.
const rings = (g) => meshes(g).filter((m) => m.geometry.type === "TorusGeometry");
const knotOf = (g) => rings(g)[0];
const flapsOf = (g) => meshes(g).filter((m) => m.geometry.type === "LatheGeometry");
const flapOf = (g) => flapsOf(g)[0];
const grabs = (g) => g.children.filter((c) => c.isGroup === true);
// The height of an ear's film, read straight off the profile it was spun from: the tallest
// point of the strip, measured from the crimp the knot holds it by.
const earLen = (m) =>
  profile(m).reduce((a, b) => Math.max(a, b.y), 0);
// How ragged an ear's cut edge is: a LatheGeometry lays its vertices out column after column
// of `rows` profile points, so the tops of those columns ARE the edge it was knicked to —
// measured ALONG THE STRIP (distance from the root), because curl() rotates the whole sheet
// over AFTER the cut, and a rotation about the root preserves exactly that distance.
const frayEdge = (m) => {
  const a = m.geometry.attributes.position,
    rows = profile(m).length,
    tops = [];
  for (let c = 0; (c + 1) * rows <= a.count; c++) {
    let m2 = -9;
    for (let j = 0; j < rows; j++) {
      const i = c * rows + j;
      if (i < a.count) m2 = Math.max(m2, Math.hypot(a.getY(i), a.getZ(i)));
    }
    tops.push(Math.round(m2 * 1e4) / 1e4);
  }
  return {
    kinds: new Set(tops).size,
    spread: Math.max(...tops) - Math.min(...tops),
  };
};
const bodyOf = (g) =>
  meshes(g).find(
    (m) => m.geometry.type === "SphereGeometry" && m.geometry.parameters.radius === 0.4,
  );
// The bag body is never rotated or scaled inside the geometry, so a check can read its raw
// vertices as heights and radii directly (h = how far up the bag, 0 = pavement, 1 = where the
// film runs out) — exactly the space slump()/stuff()/crinkle() shape the silhouette in.
const rawVerts = (m) => {
  const a = m.geometry.attributes.position,
    out = [];
  for (let i = 0; i < a.count; i++)
    out.push(
      new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)),
    );
  return out;
};
const H = (z) => (z + 0.4) / 0.8; // the body's own 0..1 height, from -R..+R of its sphere
check(
  "heavy bag is scaled up AND carries the twist-tie (8 parts vs the normal 7)",
  hb.scale.x > 1.0 && nb.children.length === 7 && hb.children.length === 8,
  nb.children.length + "/" + hb.children.length,
);
check(
  "heavy bag body: deep bio-waste green 0x0d3a1c / 0x072411",
  hexes(hb).includes(0x0d3a1c) && hexes(hb).includes(0x072411),
);
check(
  "heavy bag plastic is DULL heavy-duty film (rough standard material, never a mirror)",
  (() => {
    const body = bodyOf(hb);
    const leaf = ico(makeSidewalkTree()).material;
    return (
      body.material.isMeshStandardMaterial === true &&
      body.material.roughness >= 0.6 &&
      body.material.metalness <= 0.1 &&
      leaf.isMeshLambertMaterial === true
    );
  })(),
);
check(
  "heavy green reads DARKER + COOLER than the tree leaf green",
  (() => {
    const bag = 0x0d3a1c,
      leaf = ico(makeSidewalkTree()).material.color.getHex();
    const b = rgb(bag),
      l = rgb(leaf);
    return lum(bag) < lum(leaf) && b[2] / b[0] > l[2] / l[0];
  })(),
);
check(
  "heavy bag has a LIGHT twist-tie hugging the CINCH under the knot — a tree has no knot",
  (() => {
    const tie = meshes(hb).find(
      (m) =>
        m.geometry.type === "CylinderGeometry" &&
        lum(m.material.color.getHex()) > 150,
    );
    return (
      !!tie &&
      Math.abs(Math.abs(tie.rotation.x) - Math.PI / 2) < 0.01 &&
      tie.position.z > 0.6 &&
      tie.position.z < 1.0 // rides the waist, never floats above the knot
    );
  })(),
);
check(
  "a bag is SEMI-GLOSS plastic everywhere: sharp highlights need a standard material",
  (() => {
    const b = bodyOf(nb);
    return (
      meshes(nb).every((m) => m.material.isMeshStandardMaterial === true) &&
      b.material.roughness >= 0.2 &&
      b.material.roughness <= 0.45 &&
      b.material.metalness <= 0.1 &&
      nb.children.length === 7 &&
      !hexes(nb).includes(0x0d3a1c)
    );
  })(),
);
check(
  "the bag is tied ONCE: one knot band, flattened into a twist, no ear loops anywhere",
  rings(nb).length === 1 &&
    rings(hb).length === 1 &&
    knotOf(nb).scale.z <= 0.8 &&
    (() => {
      const p = knotOf(nb).geometry.parameters;
      return p.radius > 0.03 && p.radius < 0.2 && p.tube < 0.05;
    })() &&
    knotOf(nb).position.z > 0.7,
);
check(
  "the pinch leaves TWO long GRAB EARS above the knot — strips, not a bowl, ball or fan",
  flapsOf(nb).length === 2 &&
    flapsOf(hb).length === 2 &&
    grabs(nb).length === 2 &&
    grabs(nb).every(
      (gr) =>
        gr.children[0].children[0].children[0].rotation.x === Math.PI / 2 &&
        gr.children[0].children.length === 1,
    ), // each ear: yaw -> lean -> swing -> film stood up the bag's +Z
);
check(
  "each ear is a LONG NARROW strip of film: crimped shut at the root, opening up to its cut edge",
  flapsOf(nb).every((m) => {
    const p = profile(m),
      geo = m.geometry.parameters;
    if (!p || p.length < 5) return false;
    const iTop = p.reduce((a, b, i) => (b.y > p[a].y ? i : a), 0),
      iWide = p.reduce((a, b, i) => (b.x > p[a].x ? i : a), 0);
    return (
      geo.phiLength > 0.35 &&
      geo.phiLength < 0.8 && // a folded strip, not the quarter-turn fan it used to be
      iWide === iTop && // its widest film is AT the cut edge — the big end points up...
      p[0].x <= p[iWide].x * 0.5 && // ...and it is crimped nearly shut where the knot grips it.
      p[iWide].x > p[1].x && // (A root as wide as the knot made the whole top one cone: lampshade.)
      p[iTop].y >= 0.12 && // a real hand's length of excess above the knot
      p[p.length - 1].x <= p[0].x + 1e-9 // it closes back at the root: two faces, no slit
    );
  }),
);
check(
  "each ear is FRAYED: its cut edge is knicked to a different height in every column",
  flapsOf(nb).every((m) => {
    const f = frayEdge(m);
    return (
      f.kinds >= 4 && // every column was knicked to its own height, and
      f.spread >= 0.028 * earLen(m) // by a raggedness you can see at arm's length
    );
  }),
);
check(
  "the ears are a SPLAYED PAIR that lean, and the pair points a different way every bag",
  (() => {
    const azis = [];
    for (let i = 0; i < 6; i++) {
      const gr = grabs(makeBag("normal"));
      if (gr.length !== 2) return false;
      let yaw0 = null;
      for (const g of gr) {
        const lean = g.children[0].rotation.x;
        if (!(Math.abs(lean) >= 0.03 && Math.abs(lean) <= 0.65)) return false;
        if (yaw0 === null) yaw0 = g.rotation.z;
        else if (Math.abs(g.rotation.z - yaw0) < 1.05) return false; // they V-shape apart
      }
      azis.push((yaw0 + Math.PI) % (Math.PI * 2));
    }
    return new Set(azis.map((y) => Math.round(y * 40))).size >= 4;
  })(),
);
check(
  "the FULLNESS TELL: ears on a packed bag stand up; half-empty film flops flat",
  (() => {
    const tie = (full) => {
      const g = new THREE.Group();
      tieTop(g, {
        s: 0.4,
        top: 0.715,
        mat: new THREE.MeshStandardMaterial({ color: 0x23272e }),
        dark: new THREE.MeshStandardMaterial({ color: 0x101317 }),
        full: full,
      });
      return g;
    };
    const leanOf = (gr) => gr.children[0].rotation.x; // LEAN frame = the static flop angle
    const ears = (len) => {
      const g = tie(len);
      return {
        leans: grabs(g).map(leanOf),
        lens: flapsOf(g).map((m) => Math.max(...profile(m).map((p) => p.y))),
      };
    };
    const full = ears(1),
      slack = ears(0.2),
      slack2 = ears(0.2);
    // Every ear of a packed bag must outstand EVERY ear of a half-empty one — the two
    // populations may not overlap, or the tell would be noise across the street. (The lean
    // numbers are MODEST by design: a hard lean sweeps a long strip out into a wing. What
    // sells "slack" is that its ears are shorter AND hang over by their own curl.)
    return (
      full.leans.every((l) => Math.abs(l) <= 0.14) &&
      slack.leans.every((l) => Math.abs(l) >= 0.2) &&
      Math.min(...full.lens) > Math.max(...slack.lens) &&
      Math.abs(slack.leans[0] - slack2.leans[0]) > 1e-6 // no two bags tie identically
    );
  })(),
);
check(
  "nothing floats: BOTH ears are rooted inside the knot band they grow out of",
  (() => {
    const kb = new THREE.Box3().setFromObject(knotOf(nb));
    return (
      grabs(nb).length === 2 &&
      grabs(nb).every((gr) => {
        const fb = new THREE.Box3().setFromObject(gr);
        return fb.min.z < kb.max.z && fb.min.z > kb.min.z - 0.12;
      })
    );
  })(),
);
check(
  "the knot band is the DARKER tone: the pinch reads as dense, folded film",
  lum(knotOf(nb).material.color.getHex()) <
    lum(bodyOf(nb).material.color.getHex()),
);
check(
  "the dreidel stays dead: nothing closes the top in a point above the knot",
  meshes(nb).every(
    (m) =>
      !(
        m.geometry.type === "SphereGeometry" &&
        m.geometry.parameters.radius <= 0.06 &&
        (m.parent.position.z || 0) + m.position.z > 0.8
      ),
  ),
);
// ---- the BODY: bottom-heavy, ground-flattened, and loaded with something --------------
check(
  "the bag is BOTTOM-HEAVY: widest low down, shoulders tapered, base crushed flat",
  (() => {
    const v = rawVerts(bodyOf(nb)),
      zs = v.map((p) => p.z),
      zmin = Math.min(...zs),
      zmax = Math.max(...zs),
      band = new Array(10).fill(0).map(() => -9);
    v.forEach((p) => {
      const i = Math.min(9, Math.floor(((p.z - zmin) / (zmax - zmin)) * 10));
      band[i] = Math.max(band[i], Math.hypot(p.x, p.y));
    });
    const maxR = Math.max(...band),
      widest = band.indexOf(maxR),
      base = v
        .filter((p) => p.z < zmin + (zmax - zmin) * 0.06)
        .reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0);
    return (
      widest >= 1 &&
      widest <= 4 && // the load sits in the LOWER half of the bag
      base > 0.68 * maxR && // it stands on a wide crushed patch of film, not on an egg
      band[8] < 0.75 * maxR // and the shoulders funnel in toward the tie
    );
  })(),
);
check(
  "the silhouette is IRREGULAR: what is inside pushes the film out of true",
  (() => {
    // Around the load — where a round balloon and a loaded sack are easiest to tell apart —
    // measure how far the film reaches in each of eight directions.
    const v = rawVerts(bodyOf(nb)).filter((p) => H(p.z) > 0.2 && H(p.z) < 0.55),
      sect = new Array(8).fill(0).map(() => -9);
    v.forEach((p) => {
      let a = Math.atan2(p.y, p.x);
      if (a < 0) a += Math.PI * 2;
      const s = Math.min(7, Math.floor((a / (Math.PI * 2)) * 8));
      sect[s] = Math.max(sect[s], Math.hypot(p.x, p.y));
    });
    const hi = Math.max(...sect),
      lo = Math.min(...sect),
      mean = sect.reduce((a, b) => a + b, 0) / sect.length;
    return lo > 0 && (hi - lo) / mean > 0.035; // one side is fatter than the other
  })(),
);
check(
  "a hard corner stretches the film THIN: a lighter, glossier taut patch rides a ridge",
  (() => {
    const body = bodyOf(nb);
    return (
      body.children.length > 0 &&
      body.children.every(
        (c) =>
          c.material.roughness < body.material.roughness &&
          lum(c.material.color.getHex()) > lum(body.material.color.getHex()),
      )
    );
  })(),
);
check(
  "folded, pleated and frayed — but never fatter than the bag it was measured as",
  (() => {
    // The body: dented and bulged, but its horizontal radius never passes the 0.4 sphere the
    // collider, the spawn fit and the curb spot were all measured against.
    const a = bodyOf(nb).geometry.attributes.position;
    let hi = 0,
      lo = Infinity;
    for (let i = 0; i < a.count; i++) {
      const r = Math.hypot(a.getX(i), a.getY(i));
      if (r > hi) hi = r;
      if (r < lo) lo = r;
    }
    // A smooth lathe has exactly one radius per profile point; folded film scatters them.
    const p = profile(flapOf(nb)),
      seen = new Set(),
      fa = flapOf(nb).geometry.attributes.position;
    for (let i = 0; i < fa.count; i++)
      seen.add(Math.round(Math.hypot(fa.getX(i), fa.getZ(i)) * 1e4));
    // The neck's folds are DEEPEST right under the knot and radiate DOWN out of it.
    const neck = meshes(nb).find(
      (m) =>
        m.geometry.type === "CylinderGeometry" &&
        m.geometry.parameters.radiusTop < 0.1 && m.geometry.parameters.radiusBottom >= 0.12,
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
    return (
      hi <= 0.4001 &&
      hi - lo > 0.02 &&
      seen.size > p.length * 2 &&
      fold(0.09, 0.12) > fold(-0.12, -0.09)
    );
  })(),
);
check(
  "the whole bag stays inside its curb footprint (spawn fit, sight lines, colliders)",
  (() => {
    const lim = { normal: [1.24, 0.47], heavy: [1.6, 0.62] };
    return [
      ["normal", nb],
      ["heavy", hb],
    ]
      .map(([t, g]) => {
        const b = new THREE.Box3().setFromObject(g);
        return (
          b.max.z <= lim[t][0] &&
          b.min.z > -0.05 &&
          Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) <= lim[t][1] &&
          Math.max(Math.abs(b.min.y), Math.abs(b.max.y)) <= lim[t][1]
        );
      })
      .every(Boolean);
  })(),
);
check(
  "the ears are handed to the FILM-SWAY system: two registered ears per bag, ready to swing",
  (() => {
    const ears = nb.userData.ears;
    return (
      Array.isArray(ears) &&
      ears.length === 2 &&
      ears.every(
        (e) =>
          e.swing &&
          e.swing.isGroup === true &&
          typeof e.az === "number" &&
          e.w > 0.7 &&
          e.w < 2.5 &&
          e.swing.rotation.x === 0 &&
          e.swing.rotation.y === 0,
      ) &&
      // ...the loop actually runs the sway each frame, and the sway tolerates bags that
      // went missing and re-samples bags that teleported into a hand.
      extractFn("loop").includes("updateEarSway(") &&
      extractFn("updateEarSway").includes("> 0.4") &&
      extractFn("updateEarSway").includes("kickEars(") &&
      extractFn("registerEars").includes("userData.ears")
    );
  })(),
);

// ---- 4) keepCurbBagsOffTree --------------------------------------------------------
const mkBag = (wx, wy, state) => ({
  kind: "bag",
  state: state || "curb",
  wx,
  wy,
  g: {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
  },
});
const dist = (wx, tx, wy, ty) => Math.hypot(wx - tx, wy - ty);
check(
  "a bag sitting ON the trunk is shoved out to the keep-out radius",
  (() => {
    const house = { bags: [mkBag(30, 1.2)] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
    return dist(house.bags[0].wx, 30, house.bags[0].wy, 1.2) >= 1.7 - 1e-9;
  })(),
);
check(
  "the shove is RADIAL (same bearing, just further out)",
  (() => {
    const house = { bags: [mkBag(30.5, 1.6)] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
    const b = house.bags[0];
    const before = Math.atan2(1.6 - 1.2, 30.5 - 30),
      after = Math.atan2(b.wy - 1.2, b.wx - 30);
    return Math.abs(before - after) < 1e-9 && dist(b.wx, 30, b.wy, 1.2) > 1.6;
  })(),
);
check(
  "an already-clear bag stays EXACTLY where it was",
  (() => {
    const house = { bags: [mkBag(34, 3.9)] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
    return house.bags[0].wx === 34 && house.bags[0].wy === 3.9;
  })(),
);
check(
  "a shoved bag stays inside its own cell and on the sidewalk band (clamped)",
  (() => {
    const house = { bags: [mkBag(20.2, 4.95)] };
    keepCurbBagsOffTree(house, 21.0, 4.4, 20.0, 26.0, 1.7, false);
    const b = house.bags[0];
    return (
      (b.wx !== 20.2 || b.wy !== 4.95) &&
      b.wx >= 20.0 &&
      b.wx <= 26.0 &&
      b.wy >= 0.5 &&
      b.wy <= 5.0
    );
  })(),
);
check(
  "the bag MESH moves with the hazard record (wx/wy == mesh x/y at GZ)",
  (() => {
    const house = { bags: [mkBag(30.1, 1.25)] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
    const b = house.bags[0];
    return (
      b.g.position.x === b.wx &&
      b.g.position.y === b.wy &&
      b.g.position.z === 0.3
    );
  })(),
);
check(
  "oak variant keeps bags RIGHT of the trunk so the acorn line stays free",
  (() => {
    const house = { bags: [mkBag(29.4, 1.1)] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 2.6, true);
    const b = house.bags[0];
    return b.wx > 30 && dist(b.wx, 30, b.wy, 1.2) >= 2.6 - 1e-9;
  })(),
);
check(
  "dumped bags, a null house and a house without bags are all ignored",
  (() => {
    const house = { bags: [mkBag(30, 1.2, "dumped")] };
    keepCurbBagsOffTree(house, 30, 1.2, 20, 40, 1.7, false);
    keepCurbBagsOffTree(null, 30, 1.2, 20, 40, 1.7, false);
    keepCurbBagsOffTree({}, 30, 1.2, 20, 40, 1.7, false);
    return house.bags[0].wx === 30 && house.bags[0].wy === 1.2;
  })(),
);

// ---- 5) wiring: every planted tree clears this cell's bags -------------------------
const segStart = src.indexOf("function makeBlockContents(");
const seg = src.slice(
  segStart,
  src.indexOf("\n      function ", segStart + 10),
);
check(
  "makeBlockContents clears bags after BOTH tree sites (normal tree + the oak)",
  (seg.match(/keepCurbBagsOffTree\(/g) || []).length === 2,
);
check(
  "each clear-out runs right after that tree is registered in b.trees",
  (() => {
    const i = seg.indexOf("b.trees.push({ wx: baseX + tx, wy: ty });");
    const j = seg.indexOf("keepCurbBagsOffTree(", i);
    const k = seg.indexOf("wx: baseX + oakX");
    const l = seg.indexOf("keepCurbBagsOffTree(", k);
    return i > 0 && j > i && j - i < 400 && k > 0 && l > k && l - k < 400;
  })(),
);
check(
  "the oak uses the bigger keep-out radius (1.65x crown) and keeps bags right of the trunk",
  /keepCurbBagsOffTree\(\s*house,\s*baseX \+ oakX,[\s\S]{0,240}?2\.6,\s*true,\s*\)/.test(
    seg,
  ),
);
check(
  "sidewalk trees use a tighter keep-out than lawn trees (bags sit closer to the curb)",
  seg.includes("isSidewalkTree ? 1.7 : 1.9"),
);
check(
  "the lawn/sidewalk tree placement itself is unchanged (fixture regexes still hold)",
  /const isSidewalkTree =[\s\S]*?isQueensBlock;[\s\S]*?const t = isSidewalkTree \? makeSidewalkTree\(\) : makeTree\(\);[\s\S]*?ty = isSidewalkTree[\s\S]{0,120}curbClearY\(FOOT_R_TREE\)[\s\S]{0,120}: R\(6, 7\.5\);/.test(
    seg,
  ),
);
// --- 4) curb keep-out (trees + hydrants stand OFF the raised curb strip) -------------
{
  const num = (re) => parseFloat(src.match(re)[1]);
  const CU = num(/const CURB_INNER_Y = ([\d.]+)/),
    CC = num(/const CURB_CLEAR = ([\d.]+)/),
    FT = num(/const FOOT_R_TREE = ([\d.]+)/),
    FH = num(/const FOOT_R_HYDRANT = ([\d.]+)/);
  check(
    "the keep-out is hoisted (CURB_INNER_Y = the 0.75 walk-side curb face)",
    CU === 0.75 && CC > 0 && FT > 0.4 && FH > 0.15,
    JSON.stringify({ CU, CC, FT, FH }),
  );
  check(
    "a sidewalk tree pit clears the curb face (centre " +
      (CU + CC + FT).toFixed(2) +
      " - pit 0.52 > 0.75)",
    CU + CC + FT - FT > CU + 0.25,
  );
  check(
    "every sidewalk-tree site uses curbClearY (block trees, the 1.65x oak, the store street, the leash fixture)",
    (src.match(/curbClearY\(FOOT_R_TREE/g) || []).length >= 4,
  );
  check(
    "the block oak scales the keep-out with its mesh (pit is 1.65x too)",
    /oakY = curbClearY\(FOOT_R_TREE \* 1\.65\)/.test(src),
  );
  check(
    "the tree pit stays on the concrete (deepest tree pit reaches y " +
      (CU + CC + 0.9 + FT).toFixed(2) +
      " < 5.0 walk edge)",
    CU + CC + 0.9 + FT <= 5.0,
  );
}

console.log(ok ? "\nALL TREE/BAG CHECKS PASSED" : "\nSOME CHECKS FAILED");
if (!ok) process.exitCode = 1;
