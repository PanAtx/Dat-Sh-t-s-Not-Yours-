// RUNTIME DIAGNOSTIC: executes the REAL hose code extracted from index.html
// (addCreature hose-seg loop + spigot spawn block + updateCreatures re-layout
// block) with real THREE math, to verify the hose actually gets laid out from
// the house spigot into the car washer's fist.
const fs = require("fs");
const THREE = require("three");
const html = fs.readFileSync("index.html", "utf8");
const lines = html.split("\n");

function grabRange(startPat, endPat) {
  const a = lines.findIndex((l) => startPat.test(l));
  if (a < 0) throw new Error("start marker not found: " + startPat);
  let b = -1;
  for (let i = a + 1; i < lines.length; i++) if (endPat.test(lines[i])) { b = i; break; }
  if (b < 0) throw new Error("end marker not found: " + endPat);
  return lines.slice(a, b).join("\n");
}

// ---- the three real code regions ----
const hosUpDef = lines
  .filter((l) => /const HOS_UP = new THREE\.Vector3/.test(l) || /const HOS_DIR = new THREE\.Vector3/.test(l))
  .join("\n");
function grabRangeBalanced(startPat, innerEndPat) {
  const a = lines.findIndex((l) => startPat.test(l));
  if (a < 0) throw new Error("start marker not found: " + startPat);
  const pi = lines.findIndex((l, i) => i > a && innerEndPat.test(l));
  if (pi < 0) throw new Error("inner marker not found: " + innerEndPat);
  // include the for-loop's closing brace (next line of pure braces)
  let b = pi + 1;
  while (b < lines.length && !/^\s*\}\s*$/.test(lines[b])) b++;
  return lines.slice(a, b + 1).join("\n");
}
const hoseSegLoop = grabRangeBalanced(/const hoseMat = M\(0xc2452d\)/, /c\.hose\.segs\.push\(hseg\);/);
const spigotBlock = grabRange(/const cwSpigotHouse =/, /groundGroup\.add\(cwSpigot\);/);
const anchorLine = lines.find((l) => /cw\.hose\.anchor = \{ x: cwSpigotX/.test(l));
const relayoutBlock = grabRange(/if \(c\.hose && c\.hose\.anchor && c\.hosePt\) \{/, /\/\/ THE SPRAY:/);

// ---- build the real scene ----
// MATCH THE GAME: worldGroup is rotated PI/4 for the Paperboy isometric view and
// dynamicGroup + groundGroup are its children. The re-layout block reads the hand
// via getWorldPosition (root-scene space) and converts it back with
// dynamicGroup.worldToLocal — this diag models that WHOLE pipeline (a flat scene
// used to mask the missing transform).
const M = (c) => new THREE.MeshLambertMaterial({ color: c });
const MS = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.95 });
const scene = new THREE.Scene();
const worldGroup = new THREE.Group();
worldGroup.rotation.z = Math.PI / 4;
scene.add(worldGroup);
const groundGroup = new THREE.Group();
worldGroup.add(groundGroup);
const dynamicGroup = new THREE.Group();
worldGroup.add(dynamicGroup);
const GZ = 0.3;

// person hierarchy exactly as makePerson builds it
const g = new THREE.Group();
g.position.set(134.3, 4.5, GZ); // car washer spot (wx 134.3, wy 4.5)
const upper = new THREE.Group();
upper.position.z = 0.62;
g.add(upper);
const armR = new THREE.Group();
armR.position.set(0, -0.29, 0.76);
upper.add(armR);
armR.rotation.x = -0.5; // resting scrub pose
// worker standing on the walk at (134, 2) -> facing
g.rotation.z = Math.atan2(2 - 4.5, 134 - 134.3);
dynamicGroup.add(g); // in the game, makePerson's group is parented to dynamicGroup

const hosePt = new THREE.Object3D();
hosePt.position.set(0, -0.02, -0.5);
armR.add(hosePt);

const c = { hose: { segs: [], anchor: null }, hosePt: hosePt, scrubT: 1.0 };
const carwashDrivewayX = 136;
// the spigot block looks up the house's ATTACHMENT FACE: b.buildingFront.y0.
// Stub the Block 2 / cell 4 (worldX 128) record with a COLONIAL porch face
// (front face 8.4 - porchD 1.2 = 7.2) — the worst case, since the hose then
// runs the full distance across the lawn into the fist.
const LEVEL_BLOCKS = [{ x: 0, garbage: false }, { x: 96, garbage: true }];
const blocks = [
  { blockX: 96, worldX: 96 + 8 * 4, buildingFront: { y0: 7.2 } },
];

// ---- execute the real code ----
eval(hoseSegLoop); // creates 18 segments in dynamicGroup
console.log("segments created:", c.hose.segs.length);
eval(spigotBlock + "\n" + anchorLine.replace(/^(\s*)cw\./, "$1c."));
console.log("anchor:", JSON.stringify(c.hose.anchor));
console.log("attached face y0:", blocks[0].buildingFront.y0, "(colonial porch face)");

// lay out at a few scrub phases (arm sweeps +-0.25 rad)
for (const phase of [0.0, 0.5, 1.57, 3.14]) {
  c.scrubT = phase;
  armR.rotation.x = -0.5 + Math.sin(c.scrubT * 2.2) * 0.25;
  worldGroup.updateMatrixWorld(true);
  eval(hosUpDef + "\n" + relayoutBlock);
  worldGroup.updateMatrixWorld(true);
  let minZ = Infinity, maxX = -Infinity, minX = Infinity, maxY = -Infinity, minY = Infinity;
  const pts = c.hose.segs.map((sg) => {
    const wp = new THREE.Vector3();
    sg.getWorldPosition(wp);
    minZ = Math.min(minZ, wp.z); maxX = Math.max(maxX, wp.x); minX = Math.min(minX, wp.x);
    maxY = Math.max(maxY, wp.y); minY = Math.min(minY, wp.y);
    return wp;
  });
  const p0 = pts[0], pEnd = pts[pts.length - 1];
  // TIP of the last segment (midpoint extended by half its length toward the hand)
  const pPrev = pts[pts.length - 2];
  const tip = pEnd.clone().add(pEnd.clone().sub(pPrev).multiplyScalar(0.5));
  const hw = new THREE.Vector3(); hosePt.getWorldPosition(hw);
  // d0 in dynamicGroup LOCAL space: segs are direct children of dynamicGroup and the
  // anchor is worldGroup-local (dynamicGroup has no own transform -> same space).
  // Comparing in WORLD space would double-apply the 45° rotation.
  const d0 = c.hose.segs[0].position.distanceTo(new THREE.Vector3(c.hose.anchor.x, c.hose.anchor.y, c.hose.anchor.z));
  const dEnd = tip.distanceTo(hw);
  console.log(
    `phase ${phase.toFixed(2)}: start(${p0.x.toFixed(2)},${p0.y.toFixed(2)},${p0.z.toFixed(2)}) d_anchor=${d0.toFixed(2)} | ` +
    `end(${pEnd.x.toFixed(2)},${pEnd.y.toFixed(2)},${pEnd.z.toFixed(2)}) d_hand=${dEnd.toFixed(2)} | ` +
    `range x[${minX.toFixed(2)},${maxX.toFixed(2)}] y[${minY.toFixed(2)},${maxY.toFixed(2)}] minZ=${minZ.toFixed(2)}`,
  );
  if (d0 > 0.25) console.log("  !! start not at spigot anchor");
  if (dEnd > 0.08) console.log("  !! hose TIP not in fist (d=" + dEnd.toFixed(3) + ")");
  if (minZ < 0.3) console.log("  !! hose dips below ground");
}
console.log("DIAG DONE");
