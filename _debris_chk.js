// _debris_chk.js — Bed-Stuy storm-debris fixes:
//   1) stormbox sits UPRIGHT (base on the ground, center z=0.3) with flaps + rubble on the TOP (+Z);
//      woodpile is a tidy FLAT stack of 2x4s (planks along X, stacked in +Z, resting on the ground),
//   2) a thrown stormbox flies in as its box and lumps into the hopper as a GREY BOX (not a bag);
//      a woodpile lumps as a GREY lumber stack; a normal bag lumps as the usual grey bag.
const assert = require("assert");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
function extractFn(src, name) {
  const idx = src.indexOf("function " + name + "(");
  if (idx < 0) throw new Error("not found: " + name);
  const b = src.indexOf("{", idx);
  let d = 0,
    i = b;
  for (; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") {
      d--;
      if (!d) {
        i++;
        break;
      }
    }
  }
  return src.slice(idx, i);
}
let pass = 0;
function check(n, f) {
  try {
    f();
    pass++;
    console.log("  ok  " + n);
  } catch (e) {
    console.error(" FAIL " + n + " :: " + e.message);
    process.exitCode = 1;
  }
}

// ---- position-recording THREE-style mocks ------------------------------------------
function makeG() {
  const pos = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const rot = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
  const scl = { x: 1, y: 1, z: 1, set() {}, setScalar(s) { this.x = this.y = this.z = s; } };
  return {
    __isGroup: true,
    parent: null,
    visible: true,
    children: [],
    position: pos,
    rotation: rot,
    scale: scl,
    add(c) { this.children.push(c); if (c) c.parent = this; },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; },
    traverse(cb) { cb(this); this.children.forEach((ch) => ch.traverse && ch.traverse(cb)); },
  };
}
// crinkle() runs for real in these builders, so every mock geometry carries the position
// attribute it walks; count 0 keeps the walk a no-op (this file checks PARTS and colours —
// _tree_bag_chk.js is the one that audits the actual folded vertices).
function posBufMock() {
  return { count: 0, needsUpdate: false, getX() { return 0; }, getY() { return 0; }, getZ() { return 0; }, setX() {}, setY() {}, setZ() {} };
}
function geoStub(type, params) {
  return { type: type, parameters: params || {}, attributes: { position: posBufMock() }, computeVertexNormals() {} };
}
function meshMock(kind, args, mat) {
  return {
    __isGroup: false,
    __kind: kind,
    __args: args || [],
    __mat: mat || null,
    geometry: geoStub(kind === "sphere" ? "SphereGeometry" : kind === "cyl" ? "CylinderGeometry" : kind === "box" ? "BoxGeometry" : "Geometry"),
    parent: null,
    visible: true,
    children: [],
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    scale: { x: 1, y: 1, z: 1, set() {}, setScalar(s) { this.x = this.y = this.z = s; } },
    material: { depthTest: true, color: {} },
    add() {},
    remove() {},
    traverse(cb) { cb(this); },
  };
}
const THREE = {
  Group: function () { return makeG(); },
  TorusGeometry: function (r, t) {
    return { type: "TorusGeometry", parameters: { radius: r, tube: t } };
  },
  // A surface of revolution: `points` are [radius, height] Vector2s spun about the axis.
  LatheGeometry: function (points, segments) {
    return geoStub("LatheGeometry", { points, segments });
  },
  Vector2: function (x, y) { this.x = x; this.y = y; },
  Mesh: function (geo, mat) {
    const m = meshMock("mesh", [], mat);
    m.geometry = geo || geoStub("Geometry");
    return m;
  },
};
const BX = (w, h, d, m) => meshMock("box", [w, h, d], m);
const SP = (r, m) => meshMock("sphere", [r], m);
const SPH = (r, m) => meshMock("sphere", [r], m);
const CY = (a, b, c, m) => meshMock("cyl", [a, b, c], m);
const M = (c) => ({ c: c });
const MS = (c) => ({ c: c });
const R = (a, b) => a; // deterministic (take the low end)
const GREY_PALETTE = [0x4b525c, 0x575f6a, 0x636b76, 0x6f7782, 0x7b838e, 0x878f9a];

// ---- state / stubs -----------------------------------------------------------------
const p = { wx: 5, wy: -4.5 };
const flyingBags = [];
const dynamicGroup = { add(g) { g.parent = dynamicGroup; }, remove(g) { g.parent = null; } };
const SFX = { playTossSound() {}, playCanDropSound() {} };
const disposed = [];
function disposeObj(o) { disposed.push(o); }
const hopperTrash = makeG();
const worldGroup = { add() {} };
let hopperLoad = 1;
const hopperLumps = [];
const HOPPER_CYCLE_AT = 8;
function hopperTopZ() { return 2.4; }

// ---- build the real closure --------------------------------------------------------
const fns = ["LA", "crinkle", "slump", "stuff", "pleat", "fray", "curl", "twist", "tieTop", "makeBag", "tossBag", "addHopperLump"].map((n) => extractFn(html, n)).join("\n");
const api = new Function(
  "THREE", "M", "MS", "BX", "SP", "SPH", "CY", "R", "p", "dynamicGroup", "flyingBags", "SFX", "disposeObj",
  "hopperTrash", "worldGroup", "hopperLoad", "hopperLumps", "HOPPER_CYCLE_AT", "hopperTopZ",
  "var carry=\"none\", carried=null; var bagStack=[]; var haulCount = 0; const MAX_SMALL_BAGS=3;\n" + fns + "\nreturn { makeBag: makeBag, tossBag: tossBag, addHopperLump: addHopperLump };"
)(THREE, M, MS, BX, SP, SPH, CY, R, p, dynamicGroup, flyingBags, SFX, disposeObj,
  hopperTrash, worldGroup, hopperLoad, hopperLumps, HOPPER_CYCLE_AT, hopperTopZ);

// ---- 1) stormbox upright, debris on top (+Z) ---------------------------------------
check("stormbox: the box body rests on the ground (base z=0, center z=0.3)", () => {
  const g = api.makeBag("stormbox");
  const box = g.children[0];
  assert.ok(box && box.__kind === "box", "first child should be the box body");
  assert.strictEqual(box.__args[2], 0.6, "box height (z) should be 0.6");
  assert.ok(Math.abs(box.position.z - 0.3) < 1e-6, "box center should sit at z=0.3 (base on ground), got " + box.position.z);
});
check("stormbox: torn flaps sit at the TOP rim (z ~0.6), not off to the side", () => {
  const g = api.makeBag("stormbox");
  const flaps = g.children.filter((c) => c.__kind === "box" && c.__args[2] === 0.06);
  assert.ok(flaps.length >= 2, "expected >=2 thin flap panels");
  flaps.forEach((f) => assert.ok(f.position.z >= 0.55, "flap should be at the top (z>=0.55), got " + f.position.z));
});
check("stormbox: rubble spills out of the TOP (every sphere at z>=0.55)", () => {
  const g = api.makeBag("stormbox");
  const rub = g.children.filter((c) => c.__kind === "sphere");
  assert.ok(rub.length >= 3, "expected rubble spheres");
  rub.forEach((r) => assert.ok(r.position.z >= 0.55, "rubble should be on top (z>=0.55), got " + r.position.z));
});
check("stormbox: no debris authored along the side (all children at z>=0.3)", () => {
  const g = api.makeBag("stormbox");
  g.children.forEach((c) => assert.ok(c.position.z >= 0.3, "child at z=" + c.position.z + " is below the box base"));
});

// ---- 2) woodpile: a tidy FLAT stack of 2x4s on the ground -------------------------
check("woodpile: planks lie FLAT (long in X, thin in Z), stacked up +Z, base on the ground", () => {
  const g = api.makeBag("woodpile");
  const planks = g.children.filter((c) => c.__kind === "box");
  assert.ok(planks.length >= 3, "expected a stack of planks, got " + planks.length);
  planks.forEach((pl) => {
    assert.ok(pl.__args[0] >= 0.6 && pl.__args[2] <= 0.2, "plank should be long in X and thin in Z (flat), got " + JSON.stringify(pl.__args));
    assert.ok(pl.position.z >= 0.02 && pl.position.z <= 0.6, "plank should rest low (on the ground), z=" + pl.position.z);
  });
});
check("woodpile: planks sit at MULTIPLE heights (a stack, not a single board)", () => {
  const g = api.makeBag("woodpile");
  const zs = g.children.filter((c) => c.__kind === "box").map((c) => c.position.z);
  const distinct = new Set(zs.map((z) => Math.round(z * 100)));
  assert.ok(distinct.size >= 2, "expected planks at multiple heights, got " + zs.join(","));
});

// ---- 2b) the GREY HOPPER LUMP ties up like the curb bags ---------------------------
// It used to be an old-style stubby neck + blob, which is why the pile in the truck's
// scoop read as a different object from the bags the worker picks up. Both now share
// tieTop(): the pleated cinch, ONE flattened knot band, and the TWO long grab ears that
// come out of the top of the knot — squashed short here, because a lump in the truck's
// scoop must not bristle film over the rim.
const groups = (g) => g.children.filter((c) => c.__isGroup);
const knotOf = (g) => g.children.filter((c) => c.geometry && c.geometry.type === "TorusGeometry");
const flapOf = (g) => {
  const out = [],
    walk = (o) => {
      out.push(o);
      (o.children || []).forEach(walk);
    };
  walk(g);
  return out.filter((c) => c.geometry && c.geometry.type === "LatheGeometry");
};
const lum = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
check("hopper lump: a deposited bag ties with the SAME cinch, knot and grab ears", () => {
  hopperLumps.length = 0;
  api.addHopperLump("normal");
  const g = hopperLumps[hopperLumps.length - 1].g;
  assert.strictEqual(g.children[0].__kind, "sphere", "the lump body comes first");
  const neck = g.children.find((c) => c.__kind === "cyl" && c.__args[2] > 0.1);
  assert.ok(!!neck, "the plastic is gathered into a cinched neck");
  const knots = knotOf(g);
  assert.strictEqual(knots.length, 1, "tied ONCE, with one knot band (got " + knots.length + ")");
  const sh = flapOf(g);
  assert.strictEqual(sh.length, 2, "the excess above the knot is TWO lathed strips (got " + sh.length + ")");
  sh.forEach((m) => assert.ok(m.rotation.x !== 0, "the ears are stood up on the bag's axis"));
  const grab = groups(g);
  assert.strictEqual(grab.length, 2, "exactly two grab ears (got " + grab.length + ")");
  grab.forEach((gr) => {
    const lean = gr.children[0].rotation.x;
    assert.ok(
      Math.abs(lean) >= 0.02 && Math.abs(lean) <= 0.66,
      "the ears flop — compacted film in a scoop stands up for nobody (got " + lean + ")",
    );
    assert.ok(gr.position.z > neck.position.z, "each ear comes out above the cinch");
  });
  assert.ok(
    Math.abs(grab[0].rotation.z - grab[1].rotation.z) > 1.05,
    "the ears split apart like the curb bags' do",
  );
});
check("hopper lump: the knot is tied in a DARKER grey than the bag (the pinch reads dense)", () => {
  hopperLumps.length = 0;
  api.addHopperLump("normal");
  const L = hopperLumps[hopperLumps.length - 1],
    body = L.g.children[0],
    knot = knotOf(L.g)[0];
  assert.ok(
    lum(knot.__mat.c) < lum(body.__mat.c),
    "knot " + knot.__mat.c.toString(16) + " vs bag " + body.__mat.c.toString(16),
  );
  assert.strictEqual(L.mat2, knot.__mat, "the knot is registered so it fades with the pile");
});
check("hopper lump: stormbox / woodpile stay boxes & planks (nothing tied on debris)", () => {
  ["stormbox", "woodpile"].forEach((t) => {
    hopperLumps.length = 0;
    api.addHopperLump(t);
    const L = hopperLumps[hopperLumps.length - 1];
    assert.strictEqual(L.mat2, null, t + " has nothing tied on it");
    assert.strictEqual(groups(L.g).length, 0, t + " grows no grab");
    assert.strictEqual(
      knotOf(L.g).length + flapOf(L.g).length,
      0,
      t + " grows no knot and no flap",
    );
  });
});

// ---- 3) tossBag: the box flies in as-is (no swap) and is tagged with its type ------
check("tossBag: a stormbox is NOT swapped — the box flies in as-is, tagged with its type", () => {
  flyingBags.length = 0;
  const orig = api.makeBag("stormbox");
  const bag = { kind: "bag", type: "stormbox", state: "curb", h: {}, g: orig };
  api.tossBag(bag);
  assert.strictEqual(bag.state, "dumped", "bag should be dumped");
  assert.strictEqual(bag.g, orig, "the stormbox mesh is kept (flies as a box, not swapped)");
  assert.ok(flyingBags.length === 1 && flyingBags[0].g === orig, "the box is the flying bag");
  assert.strictEqual(flyingBags[0].type, "stormbox", "the flying bag carries its type");
});
check("tossBag: a woodpile flies in as-is, tagged with its type", () => {
  flyingBags.length = 0;
  const orig = api.makeBag("woodpile");
  const bag = { kind: "bag", type: "woodpile", state: "curb", h: {}, g: orig };
  api.tossBag(bag);
  assert.strictEqual(bag.g, orig, "the woodpile mesh is kept");
  assert.strictEqual(flyingBags[0].type, "woodpile", "the flying bag carries its type");
});
check("tossBag: source no longer swaps debris to a bag (type is tagged instead)", () => {
  const t = extractFn(html, "tossBag");
  assert.ok(t.indexOf("bag.g = makeBag(\"normal\")") < 0, "no grey-bag swap remains");
  assert.ok(t.indexOf("type: bag.type") >= 0, "the flying bag is tagged with its type");
});

// ---- 4) addHopperLump: debris lumps as a GREY box / grey lumber stack (not a bag) --
check("addHopperLump('stormbox'): the hopper lump is a GREY BOX (box, grey palette, no bag sphere)", () => {
  api.addHopperLump("stormbox");
  const g = hopperLumps[hopperLumps.length - 1].g;
  const boxes = g.children.filter((c) => c.__kind === "box");
  const spheres = g.children.filter((c) => c.__kind === "sphere");
  assert.ok(boxes.length >= 1, "expected a box lump");
  assert.strictEqual(spheres.length, 0, "a box lump has no bag sphere");
  assert.ok(boxes[0].__mat && GREY_PALETTE.indexOf(boxes[0].__mat.c) >= 0, "the box should be grey, got " + (boxes[0].__mat && boxes[0].__mat.c));
});
check("addHopperLump('woodpile'): the hopper lump is a GREY LUMBER STACK (flat planks, grey, no bag sphere)", () => {
  api.addHopperLump("woodpile");
  const g = hopperLumps[hopperLumps.length - 1].g;
  const planks = g.children.filter((c) => c.__kind === "box");
  const spheres = g.children.filter((c) => c.__kind === "sphere");
  assert.ok(planks.length >= 2, "expected a stack of planks");
  assert.strictEqual(spheres.length, 0, "a lumber lump has no bag sphere");
  planks.forEach((pl) => assert.ok(pl.__mat && GREY_PALETTE.indexOf(pl.__mat.c) >= 0, "plank should be grey"));
});
check("addHopperLump() (normal bag): the hopper lump is the usual GREY BAG (sphere body)", () => {
  api.addHopperLump();
  const g = hopperLumps[hopperLumps.length - 1].g;
  const spheres = g.children.filter((c) => c.__kind === "sphere");
  assert.ok(spheres.length >= 1, "a bag lump has a sphere body");
});

console.log("\n" + pass + " storm-debris checks passed" + (process.exitCode ? " (some FAILED)" : " — all OK"));

