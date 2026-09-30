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
function meshMock(kind, args, mat) {
  return {
    __isGroup: false,
    __kind: kind,
    __args: args || [],
    __mat: mat || null,
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
const THREE = { Group: function () { return makeG(); }, Mesh: function () { return meshMock("mesh"); } };
const BX = (w, h, d, m) => meshMock("box", [w, h, d], m);
const SP = (r, m) => meshMock("sphere", [r], m);
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
const fns = ["makeBag", "tossBag", "addHopperLump"].map((n) => extractFn(html, n)).join("\n");
const api = new Function(
  "THREE", "M", "MS", "BX", "SP", "CY", "R", "p", "dynamicGroup", "flyingBags", "SFX", "disposeObj",
  "hopperTrash", "worldGroup", "hopperLoad", "hopperLumps", "HOPPER_CYCLE_AT", "hopperTopZ",
  "var carry=\"none\", carried=null; var bagStack=[]; var haulCount = 0; const MAX_SMALL_BAGS=3;\n" + fns + "\nreturn { makeBag: makeBag, tossBag: tossBag, addHopperLump: addHopperLump };"
)(THREE, M, MS, BX, SP, CY, R, p, dynamicGroup, flyingBags, SFX, disposeObj,
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

