// _visibility_chk.js — stand-alone check of the tree-crown line-of-sight pass in index.html.
// Extracts the "TREE-CROWN LINE OF SIGHT" block, runs it against a toy street (3 blocks, 3
// crowns, items planted in the blind diagonal behind each crown) and asserts that every hidden
// street item hops into clear sight, stays inside its own block + walkable band (and inside a
// corner-pinned character's authored strip), stays out of the trunk pit, keeps cash riding its
// storm debris box, leaves walking finds / walkers / the stoop dealer / the recycling polish lady
// alone, that every constant the guard reads really exists in index.html, and that a second pass
// moves nothing.
// Run: node _visibility_chk.js [path/to/index.html]
"use strict";
const fs = require("fs");

const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const startMark = "==== TREE-CROWN LINE OF SIGHT";
const endMark = "moved out of the leaf shade";
const ih = html.indexOf(startMark);
const i1 = html.indexOf(endMark);
if (ih < 0 || i1 < 0) {
  console.log(
    "FAIL could not find the TREE-CROWN LINE OF SIGHT block in index.html",
  );
  process.exit(1);
}
const i0 = html.lastIndexOf("//", ih); // top of the section banner comment
const code = html.slice(i0, html.indexOf("}", i1) + 1);
if (
  !/function keepStreetItemsVisible/.test(code) ||
  !/function hopOutOfTreeShade/.test(code)
) {
  console.log("FAIL extracted block is incomplete");
  process.exit(1);
}
// Globals sanity: every ALL_CAPS constant the guard reads must actually be declared in
// index.html. The guard lives in this file's top-level scope, so an invented name (or one
// declared inside a function) throws ReferenceError the first time keepStreetItemsVisible
// runs - which, on the menu-preview call, is at page load: the game never starts.
{
  const src = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const inBlock = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/Math\.[A-Za-z0-9_]+/g, "Math");
  const isGlobal = (n) =>
    new RegExp(`(?:const|let|var)\\s+[^;{}]{0,200}?\\b${n}\\b\\s*[=,]`).test(
      src,
    ) || new RegExp(`function\\s+${n}\\b`).test(src);
  for (const n of new Set(inBlock.match(/\b[A-Z][A-Z0-9_]{2,}\b/g))) {
    if (new RegExp(`\\b(?:const|let|var|function)\\s+${n}\\b`).test(code))
      continue; // declared in-block
    if (!isGlobal(n))
      fail(
        `guard reads a constant index.html never declares: ${n}`,
        "declared in index.html",
      );
  }
  for (const n of [
    "blocks",
    "creatures",
    "bonuses",
    "litterBaskets",
    "spawnMaxY",
    "treeCrowns",
  ]) {
    if (new RegExp(`\\b(?:const|let|var|function)\\s+${n}\\b`).test(code))
      continue; // declared in-block
    if (!isGlobal(n))
      fail(
        `guard reads a game global index.html never declares: ${n}`,
        "declared in index.html",
      );
  }
}

// Globals the extracted block reads, matched to index.html (ISO_A 24, ARM_D 1.4142*ISO_A,
// CAM_ANGLE_OFFSET 0 rad, Manhattan spawnMaxY 4.8, BLOCK_W 12).
const GZ = 0.3;
const ARM_H = 24;
const ARM_D = 1.4142 * 24;
const CAM_ANGLE_OFFSET = 0;
const BLOCK_W = 12;
const SPAWN_MAX_Y = 4.8;
const LANE_MIN = 0.5;

const logs = [];
const fakeConsole = { log: (...a) => logs.push(a.join(" ")) };

let blocks, litterBaskets, bonuses, creatures, api;

// The catch-basin mouths the sight guard must keep every item off. Empty for the toy
// street; the drain section below drops a mouth under a clear item to prove the guard
// relocates it off the grate.
const drainSpots = [];
const drainHit = (x, y) =>
  drainSpots.some((d) => Math.abs(x - d.x) <= d.r && Math.abs(y - d.y) <= d.r);

function build() {
  return new Function(
    "GZ",
    "ARM_H",
    "ARM_D",
    "CAM_ANGLE_OFFSET",
    "BLOCK_W",
    "blocks",
    "litterBaskets",
    "bonuses",
    "creatures",
    "spawnMaxY",
    "onDrain",
    "console",
    code +
      `
; return { treeCrowns, SHADE_TOP, SHADE_CLEAR, SHADE_SEP, SHX, SHY, SHZ,
  registerTreeCrown, crownShadeDepth, sitsOnTreePit, blockSpanning,
  putStreetSpot, hopOutOfTreeShade, keepStreetItemsVisible };`,
  )(
    GZ,
    ARM_H,
    ARM_D,
    CAM_ANGLE_OFFSET,
    BLOCK_W,
    blocks,
    litterBaskets,
    bonuses,
    creatures,
    () => SPAWN_MAX_Y,
    drainHit,
    fakeConsole,
  );
}

// ---- toy street ----
const v3 = () => {
  const p = { x: NaN, y: NaN, z: NaN };
  p.set = (x, y, z) => {
    p.x = x;
    p.y = y;
    p.z = z;
  };
  return p;
};
const meshOf = (crown) => ({
  position: v3(),
  scale: { x: 1, y: 1, z: 1 },
  userData: crown ? { crown } : {},
});

function resetStreet() {
  blocks = [0, 13, 26, 39].map((x) => ({
    blockX: x,
    group: { children: [] },
    house: { bags: [] },
  }));
  litterBaskets = [];
  bonuses = [];
  creatures = [];
  api = build();
  // Two sidewalk crowns (makeSidewalkTree footprint) + the Maspeth oak planted at 1.65 scale.
  api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 3.0, 1.4);
  api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 16.0, 1.2);
  const oak = meshOf({ cz: 2.42, cr: 1.15 });
  oak.scale.x = 1.65;
  api.registerTreeCrown(oak, 30.0, 1.5);
  api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 42.0, 1.4); // block 3: the fixture NPCs
  if (api.treeCrowns.length !== 4)
    fail("crown registry", "4 crowns registered");
}
function fail(name, want, got) {
  console.log(
    `FAIL ${name}  (expected ${want}${got !== undefined ? `, got ${got}` : ""})`,
  );
  process.exitCode = 1;
}
function ok(name, cond, detail) {
  if (cond) console.log(`PASS ${name}`);
  else fail(name, "true", detail === undefined ? "false" : detail);
}

// ---- street items (field names mirror what putStreetSpot writes) ------------------------
function blockIdx(x) {
  for (let k = 0; k < blocks.length; k++)
    if (x >= blocks[k].blockX && x < blocks[k].blockX + BLOCK_W) return k;
  return 0;
}
function baseItem(x, y) {
  return {
    wx: x,
    wy: y,
    g: meshOf(null),
    home: { wx: x, wy: y },
    hx: x,
    hy: y,
  };
}
function newBag(x, y, type) {
  const o = Object.assign(baseItem(x, y), { state: "curb", type });
  o.g.position.set(x, y, GZ);
  blocks[blockIdx(x)].house.bags.push(o);
  return o;
}
function newCan(x, y) {
  const o = Object.assign(baseItem(x, y), { state: "curb" });
  o.g.position.set(x, y, GZ);
  blocks[blockIdx(x)].house.can = o;
  return o;
}
function newBasket(x, y) {
  const o = baseItem(x, y);
  o.g.position.set(x, y, GZ);
  litterBaskets.push(o);
  return o;
}
function newBonus(type, x, y, extra) {
  const o = Object.assign(baseItem(x, y), { type }, extra || {});
  o.g.position.set(x, y, GZ + (o.lift || 0));
  bonuses.push(o);
  return o;
}
function newCreature(type, x, y) {
  const o = Object.assign(baseItem(x, y), {
    type,
    baseZ: GZ,
    homeX: x,
    homeY: y,
    tgtX: x,
    tgtY: y,
  });
  delete o.home; // standing people use homeX / homeY
  o.g.position.set(x, y, GZ);
  creatures.push(o);
  return o;
}

resetStreet();

// Crowns at (3,1.4), (16,1.2) and the oak at (30,1.5). The sight axis in route coords is
// (-1,-1,1)/sqrt(3), so the blind diagonal from a trunk runs up-lane AND along the block.
const top = api.SHADE_TOP;
const depth = (o, kind) =>
  api.crownShadeDepth(o.wx, o.wy, GZ, api.SHADE_TOP[kind], 0);
const snap = {};
const park = (name, o) => {
  snap[name] = { x: o.wx, y: o.wy };
  return o;
};
const moved = (name, o) =>
  Math.abs(o.wx - snap[name].x) > 1e-6 || Math.abs(o.wy - snap[name].y) > 1e-6;

const box = park("box", newBag(5.12, 3.51, "stormbox"));
const bagA = park("bagA", newBag(4.41, 2.81, "normal"));
const pitBag = park("pitBag", newBag(3.2, 1.6, "normal")); // wedged in the tree pit itself
const canA = park("canA", newCan(17.41, 2.61));
const basketA = park("basketA", newBasket(18.12, 3.31));
const mongo = park("mongo", newBonus("mongo", 32.12, 3.62));
const cash = park("cash", newBonus("cash", 5.82, 4.11)); // hidden under the storm box
const npc = park("npc", newCreature("panhandler", 31.4, 2.9));
const ped = park("ped", newCreature("cancer", 17.41, 2.61)); // walks the block: leave him alone
const floatFind = park(
  "float",
  newBonus("treasure", 17.0, 2.4, { float: true }),
);
const pinned = park("pinned", newCreature("hooker", 32.9, 2.9)); // corner-pinned: strip below
pinned.blockMinX = 30.8;
pinned.blockMaxX = 35.0;
// Block 3 on its own crown: the dealer is bolted to his stoop (his stash table + lure are built
// around him) and the polish lady recycles ahead of the worker, so the pass must leave BOTH in
// the leaves instead of dragging them off their fixture.
const dealer = park("dealer", newCreature("dealer", 43.41, 2.61)); // the proven ped diagonal
const polishL = park("polish", newCreature("polish", 44.41, 3.61)); // deeper up the same diagonal
const clearBag = park("clearBag", newBag(10.4, 4.4, "normal"));
const clearCan = park("clearCan", newCan(9.6, 4.4)); // block 0: block 1 keeps its own can
const clearBasket = park("clearBasket", newBasket(37.0, 4.4));

console.log("--- crown geometry, in route coordinates ---");
ok(
  "sight axis is the camera arm turned into the route frame",
  Math.abs(api.SHX + 1 / Math.sqrt(3)) < 1e-4 &&
    Math.abs(api.SHY + 1 / Math.sqrt(3)) < 1e-4 &&
    Math.abs(api.SHZ - 1 / Math.sqrt(3)) < 1e-4,
  `${api.SHX.toFixed(3)} / ${api.SHY.toFixed(3)} / ${api.SHZ.toFixed(3)}`,
);
ok(
  "diagonal behind a crown reads hidden",
  api.crownShadeDepth(5.12, 3.51, GZ, top.bag, 0) > 0.3,
);
ok(
  "ground in front of the trunk reads clear",
  api.crownShadeDepth(1.59, -0.01, GZ, top.bag, 0) === 0,
);
ok(
  "ground beside the trunk reads clear",
  api.crownShadeDepth(6.6, 1.9, GZ, top.can, 0) === 0,
);
ok(
  "pit ring reads blocked even where the leaves do not",
  api.sitsOnTreePit(3.2, 1.6) && !api.sitsOnTreePit(5.2, 1.5),
);

console.log("--- planted in the leaf shade ---");
for (const [name, o, kind] of [
  ["storm box", box, "stormbox"],
  ["bag", bagA, "bag"],
  ["curb can", canA, "can"],
  ["litter basket", basketA, "litterbasket"],
  ["mongo", mongo, "bonus"],
  ["standing npc", npc, "npc"],
  ["walking ped", ped, "npc"],
  ["pinned hooker", pinned, "npc"],
  ["stoop dealer", dealer, "npc"],
  ["polish lady", polishL, "npc"],
])
  ok(
    `${name} hidden before the pass`,
    depth(o, kind) > 0,
    depth(o, kind).toFixed(2),
  );

logs.length = 0;
api.keepStreetItemsVisible();
console.log(`  report: ${logs.join(" | ") || "(nothing logged)"}`);

console.log("--- after the pass ---");
for (const [name, o, kind] of [
  ["box", box, "stormbox"],
  ["bagA", bagA, "bag"],
  ["pitBag", pitBag, "bag"],
  ["canA", canA, "can"],
  ["basketA", basketA, "litterbasket"],
  ["mongo", mongo, "bonus"],
  ["npc", npc, "npc"],
  ["pinned", pinned, "npc"],
]) {
  const bl = api.blockSpanning(o.wx);
  const y0 = kind === "npc" ? 0.9 : LANE_MIN;
  ok(`${name} left the shade`, moved(name, o));
  ok(
    `${name} lands in clear sight`,
    depth(o, kind) === 0,
    depth(o, kind).toFixed(2),
  );
  ok(
    `${name} stays in its block + walkable band`,
    !!bl &&
      o.wx >= bl.blockX + 0.55 &&
      o.wx <= bl.blockX + BLOCK_W - 0.55 &&
      o.wy >= y0 &&
      o.wy <= SPAWN_MAX_Y,
    `x=${o.wx.toFixed(2)} y=${o.wy.toFixed(2)}`,
  );
  ok(`${name} not planted in a tree pit`, !api.sitsOnTreePit(o.wx, o.wy));
  ok(
    `${name} mesh follows the new spot`,
    Math.abs(o.g.position.x - o.wx) < 1e-9 &&
      Math.abs(o.g.position.y - o.wy) < 1e-9,
    `${o.g.position.x},${o.g.position.y} vs ${o.wx},${o.wy}`,
  );
}
ok(
  "bag home moved with the bag",
  bagA.home.wx === bagA.wx && bagA.home.wy === bagA.wy,
);
ok(
  "can home moved with the can",
  canA.home.wx === canA.wx && canA.home.wy === canA.wy,
);
ok(
  "basket pad moved with the basket",
  basketA.hx === basketA.wx && basketA.hy === basketA.wy,
);
ok(
  "npc beat walks back to the new spot",
  npc.homeX === npc.wx && npc.homeY === npc.wy && npc.tgtX === npc.wx,
);
const bdx = box.wx - snap.box.x,
  bdy = box.wy - snap.box.y;
ok(
  "storm box cash rode with its box instead of moving on its own",
  Math.abs(cash.wx - snap.cash.x - bdx) < 1e-9 &&
    Math.abs(cash.wy - snap.cash.y - bdy) < 1e-9 &&
    Math.abs(cash.wx - box.wx) < 1.4 &&
    Math.abs(cash.wy - box.wy) < 1.4,
  `cash ${cash.wx.toFixed(2)},${cash.wy.toFixed(2)} box ${box.wx.toFixed(2)},${box.wy.toFixed(2)}`,
);
ok(
  "the stoop dealer keeps his stoop, stash table and lure (never relocated)",
  !moved("dealer", dealer),
);
ok(
  "the recycling polish lady keeps her spawn corner (never relocated)",
  !moved("polish", polishL),
);
ok(
  "corner-pinned hooker stays inside its authored strip",
  pinned.wx >= pinned.blockMinX - 1e-9 && pinned.wx <= pinned.blockMaxX + 1e-9,
  `x=${pinned.wx.toFixed(2)} strip=[${pinned.blockMinX},${pinned.blockMaxX}]`,
);
ok("walking ped left where he was spawned", !moved("ped", ped));
ok("floating bonus find left where it was spawned", !moved("float", floatFind));
ok(
  "items already in clear sight were not disturbed",
  !moved("clearBag", clearBag) &&
    !moved("clearCan", clearCan) &&
    !moved("clearBasket", clearBasket),
);

const laid = [
  box,
  bagA,
  pitBag,
  canA,
  basketA,
  mongo,
  npc,
  pinned,
  dealer,
  polishL,
];
let stacked = 0;
for (let i = 0; i < laid.length; i++)
  for (let j = i + 1; j < laid.length; j++)
    if (Math.hypot(laid[i].wx - laid[j].wx, laid[i].wy - laid[j].wy) < 0.5)
      stacked++;
ok(
  "no relocated item stacked on another",
  stacked === 0,
  `${stacked} pair(s) overlap`,
);

logs.length = 0;
api.keepStreetItemsVisible();
ok("second pass has no second thoughts", logs.length === 0, logs.join(" | "));

// ---- smoke: the guard runs at PAGE LOAD (the menu preview calls it), so a bare or
// half-built level must never throw, and an empty one must stay silent ----------------
{
  const bareBag = {
    wx: 5.12,
    wy: 3.51,
    state: "curb",
    type: "normal",
    g: meshOf(null),
  };
  const bareNpc = { type: "hooker", wx: 17.41, wy: 2.61, g: meshOf(null) }; // no homeX / tgtX / baseZ
  blocks = [
    { blockX: null, group: { children: [] }, house: { bags: [bareBag] } },
  ]; // no blockX
  litterBaskets = [{ wx: 33.0, wy: 3.4, g: meshOf(null) }];
  bonuses = [{ type: "cash", wx: 5.8, wy: 4.11, g: meshOf(null) }]; // no lift / float
  creatures = [bareNpc];
  let threw = null;
  try {
    api = build();
    api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 3.0, 1.4);
    api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 16.0, 1.2);
    api.registerTreeCrown(meshOf({ cz: 2.42, cr: 1.15 }), 30.0, 1.5);
    api.keepStreetItemsVisible();
  } catch (e) {
    threw = e;
  }
  ok(
    "half-built item records (no home / lift / blockX / homeX) never throw",
    !threw,
    threw && `${threw.name}: ${threw.message}`,
  );
  ok(
    "a bare level still gets its shade fix",
    Math.abs(bareBag.wx - 5.12) > 1e-6 && Math.abs(bareBag.wy - 3.51) > 1e-6,
    `${bareBag.wx.toFixed(2)},${bareBag.wy.toFixed(2)}`,
  );
  blocks = [];
  litterBaskets = [];
  bonuses = [];
  creatures = [];
  let bare = null;
  try {
    api = build();
    api.keepStreetItemsVisible();
  } catch (e) {
    bare = e;
  }
  ok(
    "an empty street is a silent no-op",
    !bare,
    bare && `${bare.name}: ${bare.message}`,
  );
}

// ---- catch basins: the street drains at the gutter low point of every corner ----------
// Built from index.html against a toy grid carrying the REAL intersection constants (IW 16,
// CROSS_W 9 -> halfW 4.5, CROSS_CY 1.0 -> main curb lines 0.5 and 9.5). What the eye rejected
// twice, and what these assertions pin down:
// (1) Every surface here paints over the space under it - curb boxes top at 0.35, cross-street
//     curb strips at 0.365, the cross-street asphalt plane sits at 0.335, the street asphalt tops
//     at 0.325 - so nothing may be laid under them, and nothing may straddle two of those heights
//     (that is what made strips appear and vanish along the corner).
// (2) A recess in a plane cannot be cut, only drawn: the grate is a stack of flat plates, each
//     smaller than the one under it, every face above the plane it rides.
// So: the mouth sits IN the gutter lane (offset 4.0 from the intersection centre; the side curb
// strips occupy 4.5..5.0), on the cross-street plane, square to the gutter it drains, with the
// two wet lanes running down the gutters into it and stopping short of it.
{
  const m0 = html.indexOf("// ---- CATCH BASEINS");
  const m1 = html.indexOf("function fitGameBox");
  if (m0 < 0 || m1 < 0 || m1 <= m0)
    fail(
      "catch-basin section markers",
      "CATCH BASEINS + fitGameBox in index.html",
    );
  const drainCode = html.slice(m0, m1);
  if (
    !/function makeCatchBasin/.test(drainCode) ||
    !/function buildCatchBasins/.test(drainCode)
  )
    fail(
      "catch-basin builders extracted",
      "makeCatchBasin + buildCatchBasins in the section",
    );

  const pos3 = () => {
    const p = { x: 0, y: 0, z: 0 };
    p.set = (x, y, z) => {
      p.x = x;
      p.y = y;
      p.z = z;
    };
    return p;
  };
  const mkMesh = (geo, mat) => {
    const m = {
      geometry: geo,
      material: mat,
      position: pos3(),
      rotation: { x: 0, y: 0, z: 0 },
      castShadow: true,
      receiveShadow: true,
    };
    m.clone = () => {
      const c = mkMesh(geo, mat);
      c.position.set(m.position.x, m.position.y, m.position.z);
      c.rotation.z = m.rotation.z;
      return c;
    };
    return m;
  };
  const THREE_STUB = {
    Group: class {
      constructor() {
        this.children = [];
        this.position = pos3();
        this.rotation = { x: 0, y: 0, z: 0 };
      }
      add(c) {
        this.children.push(c);
      }
    },
    MeshLambertMaterial: class {
      constructor(p) {
        Object.assign(this, p);
      }
    },
    BoxGeometry: class {
      constructor(w, h, d) {
        this.args = [w, h, d];
      }
    },
    Mesh: class {
      constructor(g, m) {
        return mkMesh(g, m);
      }
    },
  };
  const BX = (w, h, d, mat) =>
    new THREE_STUB.Mesh(new THREE_STUB.BoxGeometry(w, h, d), mat);
  const LEVEL_XS = [10, 70, 130];
  const IW = 16,
    CROSS_W = 9,
    CROSS_CY = 1.0;
  const halfW = CROSS_W / 2;
  const tyN = 0.5 - 0.25,
    tyF = -9.5 + 0.25; // buildIntersections' main curb lines (0.25 / -9.25)
  const GUT_N = [0, 0.25],
    GUT_F = [-9.25, -9.0]; // gutter bands: asphalt next to each curb line
  const CURB_TOP = 0.35; // main curb box top
  const STRIP_FROM = 4.5; // side curb strips, measured from the intersection centre
  const GL = 0.7,
    GW = 0.36,
    PLANE = 0.335; // mouth size + the cross-street asphalt plane
  const groundGroup = {
    children: [],
    add(c) {
      this.children.push(c);
    },
  };
  const dapi = new Function(
    "THREE",
    "BX",
    "LEVEL_XS",
    "IW",
    "CROSS_W",
    "CROSS_CY",
    "groundGroup",
    drainCode +
      `; return { STREET_DRAINS, DRAIN_KEEP_R, GRATE_X, GRATE_BACK, GUTTER, makeCatchBasin, buildCatchBasins };`,
  )(THREE_STUB, BX, LEVEL_XS, IW, CROSS_W, CROSS_CY, groundGroup);
  dapi.buildCatchBasins();

  const N = LEVEL_XS.length * 4;
  ok(
    "one catch basin at every intersection corner",
    dapi.STREET_DRAINS.length === N,
    `${dapi.STREET_DRAINS.length} of ${N}`,
  );
  ok(
    "basin + 2 wet gutter lanes per corner",
    groundGroup.children.length === N * 3,
    `${groundGroup.children.length} objects`,
  );

  const mouths = dapi.STREET_DRAINS.map((d) => {
    const cx = LEVEL_XS.map((x) => x + IW / 2).reduce((best, c) =>
      Math.abs(d.wx - c) < Math.abs(d.wx - best) ? c : best,
    );
    return {
      d,
      cx,
      sx: Math.sign(d.wx - cx),
      sy: d.wy > (tyN + tyF) / 2 ? 1 : -1,
      off: Math.abs(d.wx - cx),
    };
  });

  ok(
    "mouths sit in the corner's gutter lane (offset GRATE_X from the intersection centre)",
    mouths.filter((m) => Math.abs(m.off - dapi.GRATE_X) < 1e-6).length === N,
    `${mouths.filter((m) => Math.abs(m.off - dapi.GRATE_X) < 1e-6).length} of ${N}`,
  );
  ok(
    "mouths stop clear of the side curb strips (4.5..5.0) - nothing paints them over",
    mouths.filter((m) => m.off + GW / 2 <= STRIP_FROM + 1e-6).length === N,
    `${mouths.filter((m) => m.off + GW / 2 <= STRIP_FROM + 1e-6).length} of ${N}`,
  );
  // The mouth lies along the gutter, so its long side must overlap the asphalt strip next to the
  // curb line (the gutter band) and stay on the asphalt (y -9.5..0.5) - not sit in the middle of
  // the road, and not spill past the curb onto the sidewalk.
  const HALF = GL / 2;
  const inLane = (m) => {
    const lo = m.d.wy - HALF,
      hi = m.d.wy + HALF;
    const band = m.sy > 0 ? GUT_N : GUT_F;
    return (
      hi >= band[0] - 1e-9 && lo <= band[1] + 1e-9 && lo >= -9.5 && hi <= 0.5
    );
  };
  ok(
    "mouths lie in the road's gutter band, on both sides of the street",
    mouths.filter(inLane).length === N,
    `${mouths.filter(inLane).length} of ${N} (gutter bands ${GUT_N} / ${GUT_F})`,
  );

  const basin0 = dapi.makeCatchBasin();
  ok(
    "mouth is square to the gutter it drains (long side along the cross-street)",
    basin0.children[0].geometry.args[0] > basin0.children[0].geometry.args[1],
    `${basin0.children[0].geometry.args[0]} x ${basin0.children[0].geometry.args[1]}`,
  );

  const basin = dapi.makeCatchBasin();
  const layers = new Map();
  for (const m of basin.children) {
    const d = m.geometry.args[2] / 2,
      key = m.position.z.toFixed(4);
    const cur = layers.get(key) || { bottom: Infinity, top: -Infinity };
    layers.set(key, {
      bottom: Math.min(cur.bottom, m.position.z - d),
      top: Math.max(cur.top, m.position.z + d),
    });
  }
  const stack = [...layers.values()].sort((a, b) => a.bottom - b.bottom);
  // Decals, not a cut: the plates are laid one on top of the next, each smaller, so what has to
  // be right is that every plate's BOTTOM clears the plane it rides and the layer bounds ascend
  // strictly - a plate whose top is below the one above it would be buried and read as a slab.
  let stacked = stack.length >= 3 && stack[0].bottom >= PLANE - 1e-9;
  for (let i = 1; i < stack.length; i++)
    if (
      stack[i].bottom <= stack[i - 1].bottom + 1e-9 ||
      stack[i].top <= stack[i - 1].top + 1e-9
    )
      stacked = false;

  ok(
    "recess is DRAWN: plates stacked above the plane, nothing under it",
    stacked,
    `${stack.map((s) => s.bottom.toFixed(3) + "-" + s.top.toFixed(3)).join(" ")}`,
  );
  ok(
    "grate top stays under the curb top (0.35) so no curb paints it over",
    stack[stack.length - 1].top <= CURB_TOP,
    `${stack[stack.length - 1].top.toFixed(3)} <= ${CURB_TOP}`,
  );
  ok(
    "bed widest, opening narrower, bars narrowest (reads as a recess)",
    basin.children[0].geometry.args[0] > basin.children[1].geometry.args[0] &&
      basin.children[1].geometry.args[0] > basin.children[2].geometry.args[0],
    `${basin.children[0].geometry.args[0]} / ${basin.children[1].geometry.args[0]} / ${basin.children[2].geometry.args[0]}`,
  );

  const lanes = groundGroup.children.filter(
    (c) => c.material && c.material.transparent,
  );
  let lanesOk = lanes.length === N * 2;
  const laneReport = [];
  for (const c of lanes) {
    const near = mouths.reduce((best, m) =>
      Math.hypot(m.d.wx - c.position.x, m.d.wy - c.position.y) <
      Math.hypot(best.d.wx - c.position.x, best.d.wy - c.position.y)
        ? m
        : best,
    );
    const dist = Math.hypot(near.d.wx - c.position.x, near.d.wy - c.position.y);
    const bottom = c.position.z - c.geometry.args[2] / 2;
    const top = c.position.z + c.geometry.args[2] / 2;
    lanesOk =
      lanesOk &&
      bottom >= PLANE - 1e-9 && // on the cross-street plane, not under it
      top <= CURB_TOP && // never under a curb, never above one
      dist >= 1.2; // and it stops short of the mouth it feeds
    laneReport.push(
      `${c.geometry.args[0].toFixed(2)}x${c.geometry.args[1].toFixed(2)}@${dist.toFixed(2)}u`,
    );
  }
  ok(
    "wet lanes ride the same plane, clear of the curbs, and stop short of the mouth",
    lanesOk,
    `${lanes.length} lanes: ${laneReport.join(" ")}`,
  );

  ok(
    "sight guard keeps items off the mouths (hop filter + already-clear test)",
    /onDrain\(nx, ny\)/.test(code) && /!onDrain\(/.test(code),
  );
  ok(
    "buildGround lays the basins after the intersections",
    /buildIntersections\(\);\s*\n?\s*buildCatchBasins\(\);/.test(html),
  );

  // Behaviour: a mouth under a clear item must move it; take the mouth away and it settles.
  resetStreet();
  const drainBag = newBag(10.4, 4.4, "normal");
  const before = { x: drainBag.wx, y: drainBag.wy };
  ok(
    "the test bag starts in clear sight (so only the drain can move it)",
    api.crownShadeDepth(drainBag.wx, drainBag.wy, GZ, top.bag, 0) === 0,
  );
  drainSpots.push({ x: before.x, y: before.y, r: dapi.DRAIN_KEEP_R });
  api.keepStreetItemsVisible();
  const off = { x: drainBag.wx, y: drainBag.wy };
  ok(
    "an item planted on a drain mouth hops off it",
    Math.hypot(off.x - before.x, off.y - before.y) > 1e-6 &&
      !drainHit(off.x, off.y),
    `now ${off.x.toFixed(2)},${off.y.toFixed(2)}`,
  );
  ok(
    "and it lands in clear sight, inside its block + band",
    api.crownShadeDepth(off.x, off.y, GZ, top.bag, 0) === 0 &&
      off.x >= 0.6 &&
      off.x <= 11.4 &&
      off.y >= 0.5 &&
      off.y <= 4.8,
    `${off.x.toFixed(2)},${off.y.toFixed(2)}`,
  );
  drainSpots.length = 0;
  api.keepStreetItemsVisible();
  ok(
    "with the mouth gone, the new spot is stable (no second thoughts)",
    Math.abs(drainBag.wx - off.x) < 1e-9 &&
      Math.abs(drainBag.wy - off.y) < 1e-9,
    `${drainBag.wx.toFixed(2)},${drainBag.wy.toFixed(2)}`,
  );
}

console.log(
  process.exitCode ? "\nVISIBILITY CHECK FAILED" : "\nVISIBILITY CHECK PASSED",
);
