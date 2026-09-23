// _queens_cemetery_chk.js — verify the Maspeth 5th block CEMETERY in index.html:
//   - constants (block index 1 / x 96 — TEMP testing position, real home is index 4 / x 384; fence line 5.4, back edge 12.0)
//   - builders: makeHeadstone, makeDeadTree, makeRaven, makeCemeteryFence,
//     buildCemeteryBlock (fence + stones + monuments + trees; records RAVEN_PERCH)
//   - ghost helpers (ghostifyPerson transparent blue, makeGhostPerson w/ own material)
//   - ghostly treasure kinds 38/39/40 + spawnGhostTreasure (floating bob)
//   - addCreature case "ghost" + case "raven" + ghostified cemetery homeowner
//   - updateCreatures case "ghost" (fade-in, drift, float, creepy lines, roam the STREET +
//     SIDEWALK in front of the fence — NEVER the graveyard)
//     + case "raven" (circling the sky -> diving onto the worker's head -> climbing back)
//     + ghost spawner timer
//   - collideCreatures ghost branch (scare + HP drain, NOT solid, cooldown)
//   - worker fence clamp (impassable) + front & side fence (open green back, corners cornered)
//   - block OPEN to the living (no no-go zone; peds/animals/dogs/ladies roam it;
//     only curb garbage + regular treasure are suppressed by !b.cemetery)
//   - CROWDED ghost pack (40 seeds, topped up to GHOST_CAP=75, SLOT-GRID even split:
//     even slots street / odd slots sidewalk, ghosts exist ONLY on the cemetery block)
//     + 3 rats + 10 treasures + raven
//   - STREET GHOSTS: spectral arms (grab -> HP_HIT_GHOSTARM damage), ghost headstones +
//     skull piles (SOLID obstacles the worker goes around, "They only moved the headstones!"),
//     placed ACROSS THE WHOLE STREET (truck lane + car lanes, left to right) by
//     buildCemeteryStreetGhosts, separated >= 2.4u so the street stays traversable,
//     arms animated in updateCreatures
//   - "Failure to respect the dearly departed" write-up + ghost bubble style
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1) all inline scripts still parse
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m,
  n = 0,
  ok = true;
while ((m = re.exec(src))) {
  n++;
  try {
    new vm.Script(m[1], { filename: 'inline' + n + '.js' });
  } catch (e) {
    ok = false;
    console.log('SYNTAX FAIL script #' + n + ': ' + e.message);
  }
}
console.log('inline scripts checked: ' + n + (ok ? ' — ALL SYNTAX OK' : ' — SYNTAX ERRORS'));

let pass = ok;
const check = (name, c, e) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + name + (c ? '' : '  [' + e + ']'));
  if (!c) pass = false;
};

function extract(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0,
    i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(idx, i + 1);
}
function extractFrom(anchor, fromIdx) {
  const i = src.indexOf(anchor, fromIdx);
  if (i < 0) throw new Error(anchor + ' not found');
  const brace = src.indexOf('{', i);
  let depth = 0,
    j = brace;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(i, j + 1);
}

// ================= 1. CONSTANTS =================
check(
  'cemetery constants: block index 1 (TEMP testing position), fence line 5.4, back edge 12.0',
  /const QUEENS_CEMETERY_BLOCK = 1;/.test(src) &&
    /const QUEENS_CEMETERY_X = LEVEL_BLOCKS\[QUEENS_CEMETERY_BLOCK\]\.x;/.test(src) &&
    /const CEM_FENCE_Y = 5\.4;/.test(src) &&
    /const CEM_BACK_Y = 12\.0;/.test(src)
);

// ================= 2. BUILDERS =================
const headstone = (() => {
  try {
    return extract('makeHeadstone');
  } catch (e) {
    return '';
  }
})();
check('makeHeadstone builder exists', headstone.length > 0);
check(
  'headstone has 5 variants (slab, cross, obelisk, twin, monument) + a stone plinth',
  headstone.indexOf('v === 1') >= 0 &&
    headstone.indexOf('v === 2') >= 0 &&
    headstone.indexOf('v === 3') >= 0 &&
    headstone.indexOf('v === 4') >= 0 &&
    headstone.indexOf('plinth') >= 0
);
check(
  'headstone exposes its top height (userData.top) so the raven can perch on it',
  headstone.indexOf('g.userData.top = top') >= 0
);
check(
  'headstones use weathered stone greys (CEM_GREYS)',
  /const CEM_GREYS = \[0x9aa0a6, 0x8d939a, 0xa8adb3, 0x7e848b\]/.test(src)
);

const deadTree = (() => {
  try {
    return extract('makeDeadTree');
  } catch (e) {
    return '';
  }
})();
check('makeDeadTree builder exists (bare trunk + twisted limbs)', deadTree.length > 0);
check(
  'dead tree is SCARY: dark bark + 5 limbs with twigs, NO green (no leaves)',
  deadTree.indexOf('0x332a1e') >= 0 &&
    deadTree.indexOf('limbs') >= 0 &&
    deadTree.indexOf('tw') >= 0 &&
    deadTree.indexOf('0x5a8a3a') < 0 &&
    deadTree.indexOf('leaf') < 0
);

const raven = (() => {
  try {
    return extract('makeRaven');
  } catch (e) {
    return '';
  }
})();
check(
  'makeRaven builder exists (black body, gold beak, folded wings, tail, legs)',
  raven.length > 0 &&
    raven.indexOf('0x0a0a0c') >= 0 &&
    raven.indexOf('0x8a7a2a') >= 0 &&
    raven.indexOf('wing') >= 0 &&
    raven.indexOf('tail') >= 0
);

const fence = (() => {
  try {
    return extract('makeCemeteryFence');
  } catch (e) {
    return '';
  }
})();
check(
  'makeCemeteryFence builder exists: BLACK iron (0x101014) + dark concrete footing',
  fence.length > 0 && fence.indexOf('0x101014') >= 0 && fence.indexOf('0x1a1b1e') >= 0
);
check(
  'fence is TALL wrought iron: posts with finials, two rails, dense 0.4u bars',
  fence.indexOf('fin') >= 0 &&
    fence.indexOf('rail') >= 0 &&
    fence.indexOf('x += 0.4') >= 0 &&
    fence.indexOf('2.4') >= 0
);

const cemBlock = (() => {
  try {
    return extract('buildCemeteryBlock');
  } catch (e) {
    return '';
  }
})();
check(
  'buildCemeteryBlock assembles fence + 10 headstones + 3 monuments + 4 dead trees and records the raven PERCH (RAVEN_PERCH)',
  cemBlock.length > 0 &&
    cemBlock.indexOf('makeCemeteryFence(BLOCK_W)') >= 0 &&
    cemBlock.indexOf('for (let i = 0; i < 10; i++)') >= 0 &&
    cemBlock.indexOf('for (let m = 0; m < 3; m++)') >= 0 &&
    cemBlock.indexOf('for (let t = 0; t < 4; t++)') >= 0 &&
    cemBlock.indexOf('RAVEN_PERCH') >= 0 &&
    cemBlock.indexOf('QUEENS_CEMETERY_X') >= 0
);
check(
  'the raven PERCH is a headstone (RAVEN_PERCH = {x, y, top} from a random stone — the raven itself is a creature)',
  cemBlock.indexOf('RAVEN_PERCH = { x: per.x, y: per.y, top: per.top }') >= 0
);
check(
  'the fence runs along the sidewalk (front, BLOCK_W) + both sides (CEM_BACK_Y-CEM_FENCE_Y, parallel to the cross street) — the BACK is open green grass (no back wall)',
  cemBlock.indexOf('const fence = makeCemeteryFence(BLOCK_W)') >= 0 &&
    cemBlock.indexOf('const sideLen = CEM_BACK_Y - CEM_FENCE_Y') >= 0 &&
    cemBlock.indexOf('const left = makeCemeteryFence(sideLen)') >= 0 &&
    cemBlock.indexOf('const right = makeCemeteryFence(sideLen)') >= 0 &&
    cemBlock.indexOf('rotation.z = Math.PI / 2') >= 0 &&
    cemBlock.indexOf('const back = makeCemeteryFence') === -1
);
check(
  'the fence corners are cornered: makeCemeteryFence plants a post at BOTH ends (postAt(0) + postAt(len)) so the walls meet',
  fence.indexOf('postAt(0)') >= 0 && fence.indexOf('postAt(len)') >= 0
);

// ================= 2b. ORIENTATION: everything STANDS UP (Z is the vertical axis) =================
{
  const THREE = require(path.join(__dirname, 'three_r128.min.js'));
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const MS = (c, o) =>
    new THREE.MeshStandardMaterial(
      Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, o || {})
    );
  const BX = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const CY = (r1, r2, h, m, s) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m);
  const SP = (r, m, s) => new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m);
  const CEM_GREYS = [0x9aa0a6, 0x8d939a, 0xa8adb3, 0x7e848b];
  const ctx = vm.createContext({ THREE, M, MS, BX, CY, SP, CEM_GREYS, Math });
  vm.runInContext(
    extract('makeHeadstone') +
      '\n' +
      extract('makeDeadTree') +
      '\n' +
      extract('makeRaven') +
      '\n' +
      extract('makeCemeteryFence'),
    ctx
  );
  const bb = (g) => {
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const s = b.getSize(new THREE.Vector3());
    return {
      x: +s.x.toFixed(2),
      y: +s.y.toFixed(2),
      z: +s.z.toFixed(2),
      minZ: +b.min.z.toFixed(2),
    };
  };
  const stand = (name, g, needZ, uprightLikeWall) => {
    const b = bb(g);
    check(
      name + ' STANDS UP on its end (Z-UP, tall in the vertical axis): got X/Y/Z=' + b.x + '/' + b.y + '/' + b.z,
      b.z >= needZ && b.minZ >= -0.05 && (!uprightLikeWall || b.y <= Math.max(b.z, b.x)),
      JSON.stringify(b)
    );
  };
  for (let v = 0; v < 5; v++)
    stand('headstone variant ' + v, ctx.makeHeadstone(v), v === 3 ? 0.9 : 1.0, true);
  stand('monument (variant 4)', ctx.makeHeadstone(4), 1.6, true);
  stand('dead tree (trunk vertical)', ctx.makeDeadTree(), 2.0, true);
  stand('raven (perched, upright)', ctx.makeRaven(), 0.5, false);
  const fb = bb(ctx.makeCemeteryFence(96));
  check(
    'iron fence STANDS UP as a wall along the street: ~96u run in X, thin in Y, tall in Z (>=2.4), footing on the ground: got X/Y/Z=' + fb.x + '/' + fb.y + '/' + fb.z,
    fb.x >= 95 && fb.x <= 97 && fb.y < 1 && fb.z >= 2.4 && fb.minZ >= -0.05,
    JSON.stringify(fb)
  );
  // The SIDE wall: same builder rotated +90° about Z so it runs along Y (parallel to the cross street).
  const side = ctx.makeCemeteryFence(6.6); // CEM_BACK_Y - CEM_FENCE_Y
  side.rotation.z = Math.PI / 2;
  const sb = bb(side);
  check(
    'the SIDE fence wall runs along Y (parallel to the cross street) and stands up: got X/Y/Z=' + sb.x + '/' + sb.y + '/' + sb.z,
    sb.y >= 6.4 && sb.y <= 6.9 && sb.x < 1 && sb.z >= 2.4 && sb.minZ >= -0.05,
    JSON.stringify(sb)
  );
  check(
    'raven perch math: monument userData.top == 1.73 (the raven sits at GZ + top + 0.02)',
    Math.abs(ctx.makeHeadstone(4).userData.top - 1.73) < 0.06
  );
}

// ================= 3. GHOST HELPERS =================
const ghostify = (() => {
  try {
    return extract('ghostifyPerson');
  } catch (e) {
    return '';
  }
})();
check(
  'ghostifyPerson: ONE shared bluish TRANSPARENT material (opacity 0.45, depthWrite off)',
  ghostify.length > 0 &&
    ghostify.indexOf('0xa8ccff') >= 0 &&
    ghostify.indexOf('opacity: 0.45') >= 0 &&
    ghostify.indexOf('depthWrite: false') >= 0 &&
    ghostify.indexOf('traverse') >= 0
);
const mGP = (() => {
  try {
    return extract('makeGhostPerson');
  } catch (e) {
    return '';
  }
})();
check(
  'makeGhostPerson = makePerson re-skinned (the same people, only dead)',
  mGP.length > 0 && mGP.indexOf('makePerson(') >= 0 && mGP.indexOf('ghostifyPerson') >= 0
);

// ================= 4. GHOSTLY TREASURES (kinds 38/39/40) =================
const mtEnd = src.indexOf('// ==================== HOUSES, MAILBOXES, TREES');
const treasureSec = src.slice(src.indexOf('function makeTreasure('), mtEnd > 0 ? mtEnd : undefined);
check(
  'makeTreasure has ghostly kinds 38 (jewelry), 39 (pocket watch), 40 (gold coins)',
  treasureSec.indexOf('kind === 38') >= 0 &&
    treasureSec.indexOf('kind === 39') >= 0 &&
    treasureSec.indexOf('kind === 40') >= 0
);
check(
  'TREASURE_NAMES names the ghostly finds',
  src.indexOf('38: "Ghostly jewelry!"') >= 0 &&
    src.indexOf('39: "Ghostly pocket watch!"') >= 0 &&
    src.indexOf('40: "Ghostly gold coins!"') >= 0
);
const sGT = (() => {
  try {
    return extract('spawnGhostTreasure');
  } catch (e) {
    return '';
  }
})();
check(
  'spawnGhostTreasure: floating (baseLift 1.0), $100-$200, type "treasure", kinds 38/39/40 only',
  sGT.length > 0 &&
    sGT.indexOf('pick([38, 39, 40])') >= 0 &&
    sGT.indexOf('baseLift: baseLift') >= 0 &&
    sGT.indexOf('val: 100 + 50') >= 0 &&
    sGT.indexOf('type: "treasure"') >= 0
);
check(
  'updateBonuses makes floating treasures bob (sin, b.float gate)',
  /b\.float\s*\n?\s*\?\s*GZ \+ b\.baseLift \+ 0\.35 \+ Math\.sin\(b\.t \* 2\.2\) \* 0\.18/.test(src)
);

// ================= 5. addCreature =================
const addSec = (() => {
  const i = src.indexOf('function addCreature(');
  const j = src.indexOf('function updateCreatures(');
  return src.slice(i, j > i ? j : i + 9000);
})();
check(
  'addCreature has case "ghost" (makeGhostPerson, wander fields, ghostCd, sayCd)',
  /case "ghost":/.test(addSec) &&
    addSec.indexOf('c.data = makeGhostPerson()') >= 0 &&
    addSec.indexOf('c.ghostCd = 0') >= 0 &&
    addSec.indexOf('c.tyT = R(2, 6)') >= 0 &&
    addSec.indexOf('c.sayCd = R(3, 8)') >= 0
);
check(
  'ghost is a MIXED-gender speaker (male/female ghosts)',
  /type === "ghost"/.test(addSec) &&
    addSec.indexOf('type === "ghost"') < addSec.indexOf('c.gender = MIXED()')
);
check(
  'the cemetery homeowner is ghostified (c.ghost → ghostifyPerson) and keeps his questions',
  addSec.indexOf('if (c.ghost) ghostifyPerson(c.data.g)') >= 0
);
check(
  'the cemetery block is OPEN to the living in addCreature (no spawn re-roll; only garbage/treasure are gated by !b.cemetery)',
  addSec.indexOf('the block is OPEN to the living') >= 0 &&
    addSec.indexOf('while (c.wx > c0 && c.wx < c1 && tries < 8)') < 0
);

// ================= 6. updateCreatures (the ghost's AI) =================
const ucStart = src.indexOf('function updateCreatures(dt) {');
const ghostCaseSrc = (() => {
  try {
    return extractFrom('case "ghost": {', ucStart);
  } catch (e) {
    return '';
  }
})();
check('updateCreatures has case "ghost" (the wander AI)', ghostCaseSrc.length > 0);
check(
  'ghost AI: roams its OWN slot (column across the block, its own street/sidewalk zone band), exists ONLY on the cemetery block (never the graveyard, never a neighbor block)',
  ghostCaseSrc.indexOf('ghostSlotX(c.slot)') >= 0 &&
    ghostCaseSrc.indexOf('BLOCK_W / GHOST_SLOTS / 2') >= 0 &&
    ghostCaseSrc.indexOf('c.zone < 0 ? -9.2 : 0.6') >= 0 &&
    ghostCaseSrc.indexOf('QUEENS_CEMETERY_X - 120') < 0 &&
    ghostCaseSrc.indexOf('CEM_BACK_Y') < 0
);
check(
  'ghost AI: floats (bob on c.g.position.z), faces drift, walks its limbs (animParts)',
  ghostCaseSrc.indexOf('GZ + 0.55 + Math.sin(c.hopT * 2.4) * 0.12') >= 0 &&
    ghostCaseSrc.indexOf('c.g.rotation.z = c.dir >= 0 ? 0 : Math.PI') >= 0 &&
    ghostCaseSrc.indexOf('animParts(c, c.sp * dt * 1.6)') >= 0
);
check(
  'ghost AI: drops a GHOST_LINES bubble near the worker (sayCd gate, "ghost" speaker)',
  ghostCaseSrc.indexOf('pick(GHOST_LINES)') >= 0 &&
    ghostCaseSrc.indexOf('"ghost"') >= 0 &&
    ghostCaseSrc.indexOf('Math.abs(c.wx - p.wx) < 9') >= 0
);
check(
  'ghost AI: off-screen recycle re-takes the NEXT slot (round-robin, keeps the even street/sidewalk spread, NEVER p.wx ± 38)',
  ghostCaseSrc.indexOf('if (tx > 55 || tx < -58)') >= 0 &&
    ghostCaseSrc.indexOf('const slot = GHOST_SLOT_CURSOR % GHOST_SLOTS;') >= 0 &&
    ghostCaseSrc.indexOf('c.wy = c.zone < 0 ? R(-8.8, -0.5) : R(0.8, 4.7)') >= 0 &&
    ghostCaseSrc.indexOf('p.wx - 38') < 0
);
check(
  'ghostCd ticks down per frame (so a ghost can scare again after the cooldown)',
  src.slice(ucStart, ucStart + 2400).indexOf('if (c.ghostCd > 0) c.ghostCd -= dt') >= 0
);
check(
  'cemetery rats scurry the graveyard grass (cemRat band, behind the fence)',
  /c\.cemRat \? CEM_FENCE_Y \+ 0\.6 : 0\.8/.test(src) && /c\.cemRat \? CEM_BACK_Y - 0\.6 : 2\.2/.test(src)
);
check(
  'cemetery has NO no-go zone in updateCreatures: the living roam the block (nothing snapped away; the worker is kept out of the graveyard only by the fence)',
  src.indexOf('Maspeth cemetery: the block is OPEN to the living (NO no-go zone)') >= 0 &&
    src.indexOf('c.dir = c.wx < cMid ? -1 : 1') < 0
);
check(
  'bodega cat pool INCLUDES the cemetery block (cats roam the block too)',
  src.indexOf('const active = [1, 2, 3, 4, 5];') >= 0 &&
    src.indexOf('i !== QUEENS_CEMETERY_BLOCK') < 0
);

// ================= 7. collideCreatures (the scare) =================
const ccStart = src.indexOf('function collideCreatures() {');
const ghostBumpSrc = (() => {
  try {
    return extractFrom('if (c.type === "ghost" || c.ghost) {', ccStart);
  } catch (e) {
    return '';
  }
})();
check(
  'ghost touch: covers BOTH the ghost creature AND the ghostified homeowner (c.ghost)',
  ghostBumpSrc.indexOf('if (c.type === "ghost" || c.ghost) {') === 0
);
check(
  'ghost touch: 10 HP drained (HP_HIT_GHOST + HP_GHOST_STREET) on ANY touch — street AND sidewalk alike — tagged to "ghost" (the write-up cause)',
  ghostBumpSrc.indexOf('hurtNPC(HP_HIT_GHOST + HP_GHOST_STREET, "ghost")') >= 0 &&
    ghostBumpSrc.indexOf('"ghost")') >= 0
);
check(
  'ghost touch: the worker is SCARED (doStun 0.55 "scare" on the walk, a LONGER 0.8s freeze in the street)',
  ghostBumpSrc.indexOf('doStun(onStreet ? 0.8 : 0.55, "scare")') >= 0
);
check(
  'ghost touch: street ghosts claim the road — street lines (GHOST_STREET_LINES) + worker yelp "NO! The street\'s ALL GHOSTS!?"',
  ghostBumpSrc.indexOf('pick(GHOST_STREET_LINES)') >= 0 &&
    ghostBumpSrc.indexOf('const onStreet = c.wy < 0.35') >= 0 &&
    ghostBumpSrc.indexOf("NO! The street's ALL GHOSTS!?") >= 0
);
check(
  'ghost touch: cooldown 1.8s (no frame-by-frame drain)',
  ghostBumpSrc.indexOf('c.ghostCd = 1.8') >= 0
);
check(
  'ghost touch: NOT solid — it phases through (return, no push-out math)',
  ghostBumpSrc.indexOf('p.wx +=') < 0 && ghostBumpSrc.indexOf('return;') >= 0
);
check(
  'ghost collision radius 1.0 (a floating touch has a little reach)',
  src.slice(ccStart, ccStart + 5000).indexOf('c.type === "ghost") rad = 1.0') >= 0
);
check('HP_HIT_GHOST is the DANGEROUS ghost damage (6, heavier than a hazard, lighter than a vehicle)', /const HP_HIT_GHOST = 6;/.test(src));
check(
  'HP_GHOST_STREET: the ghost-touch extra (4 HP on top of HP_HIT_GHOST — EVERY ghost touch, street and sidewalk, costs the full 10)',
  /const HP_GHOST_STREET = 4;/.test(src)
);
check(
  'GHOST_STREET_LINES: the street ghost claims the road (ours / our road / asphalt / died on this street)',
  (() => {
    const i = src.indexOf('const GHOST_STREET_LINES = [');
    if (i < 0) return false;
    const j = src.indexOf('];', i);
    const s = src.slice(i, j);
    return (
      s.indexOf('"The street is OURS!"') >= 0 &&
      s.indexOf('"You\'re walking on our road!"') >= 0 &&
      s.indexOf('"Stay off our asphalt, living!"') >= 0 &&
      s.indexOf('"We died on this street!"') >= 0
    );
  })()
);
check(
  'GHOST_LINES has ALL six creepy lines (Play with us / Redrum / More brains / killing me / Boo / my child)',
  (() => {
    const i = src.indexOf('const GHOST_LINES = [');
    const j = src.indexOf('];', i);
    const s = src.slice(i, j);
    return (
      s.indexOf('"Play with us and stay with us"') >= 0 &&
      s.indexOf('"Redrum"') >= 0 &&
      s.indexOf('"More brains!"') >= 0 &&
      s.indexOf('"You\'re killing me!"') >= 0 &&
      s.indexOf('"Boo!"') >= 0 &&
      s.indexOf('"Have you seen my child?"') >= 0
    );
  })()
);

// ================= 8. THE IMPASSABLE FENCE (worker clamp) =================
const upIdx = src.indexOf('function updatePlayer(');
const fenceClamp = src.slice(upIdx, upIdx + 12000);
check(
  'worker CANNOT cross the iron fence: cemFence clamp (FENCE_STOP 0.3, hard stop at the line)',
  fenceClamp.indexOf('if (!b.cemFence) continue') >= 0 &&
    fenceClamp.indexOf('const FENCE_STOP = 0.3') >= 0 &&
    fenceClamp.indexOf('const stopY = cf.y - FENCE_STOP') >= 0 &&
    fenceClamp.indexOf('p.wy = stopY') >= 0
);

// ================= 9. BLOCK SUPPRESSION (no houses/stores/garbage) =================
const mbIdx = src.indexOf('function makeBlockContents(');
const mbEnd = src.indexOf('function ', mbIdx + 30);
const mbSec = src.slice(mbIdx, mbEnd > mbIdx ? mbEnd : mbIdx + 14000);
check(
  'cemetery cell: b.cemetery + b.house = null + cemFence bounds on the block',
  mbSec.indexOf('const isCemCell = isQueensBlock && b.blockX === QUEENS_CEMETERY_X') >= 0 &&
    mbSec.indexOf('b.cemetery = true') >= 0 &&
    mbSec.indexOf('b.house = null') >= 0 &&
    mbSec.indexOf('b.cemFence = {') >= 0
);
check(
  'cemetery cell: the fence + back rows build (buildCemeteryBlock) + headstones fill the rest',
  mbSec.indexOf('buildCemeteryBlock()') >= 0 && mbSec.indexOf('makeHeadstone(') >= 0
);
check('cemetery cell: NO house/store/stairs (guarded by !isCemCell)', mbSec.indexOf('if (!isCemCell) {') >= 0);
check(
  'cemetery cell: NO curb garbage/mongo (b.garbage && !b.cemetery)',
  mbSec.indexOf('if (b.garbage && !b.cemetery) {') >= 0
);
check(
  "the `house` bag/can record is hoisted ABOVE the !isCemCell scope (the curb-trash block OUTSIDE that scope references it - a TDZ/ReferenceError would crash spawnWorld on every garbage block)",
  (() => {
    const iHoist = mbSec.indexOf('let house = null;');
    const iCem = mbSec.indexOf('if (!isCemCell) {');
    const iClose = mbSec.indexOf('// end !isCemCell');
    const iTrash = mbSec.indexOf('if (b.garbage && !b.cemetery) {');
    return (
      iHoist > -1 && iHoist < iCem && iCem < iClose && iTrash > iClose &&
      mbSec.indexOf('const house = {') === -1 &&
      /makeCurbBag\(\s*houseX\(\)\s*,\s*sideY\(\)\s*,\s*house\s*\)/.test(
        mbSec.slice(iTrash, iTrash + 6000)
      )
    );
  })()
);
check(
  "cemetery block: EVERY consumer of b.house is null-guarded (b.house = null) - rebuildTruckFromFbx + tryInteract skip it, no direct blocks[i].house.bags/can chains remain",
  (() => {
    const fb = src.slice(
      src.indexOf('function rebuildTruckFromFbx()'),
      src.indexOf('function rebuildTruckFromFbx()') + 1600
    );
    const ti = src.slice(
      src.indexOf('function tryInteract()'),
      src.indexOf('function tryInteract()') + 2400
    );
    return (
      fb.indexOf('if (!h) continue') >= 0 &&
      ti.indexOf('if (!hh) continue') >= 0 &&
      ti.indexOf('hh.bags') >= 0 &&
      src.indexOf('blocks[i].house.bags') === -1 &&
      src.indexOf('blocks[i].house.can') === -1 &&
      src.indexOf('b.garbage && b.house &&') >= 0 && // updateBlocks passed-mark
      (() => {
        const rb = src.slice(
          src.indexOf('function recycleBlock('),
          src.indexOf('function recycleBlock(') + 500
        );
        return rb.indexOf('const h = b.house;') >= 0 && rb.indexOf('if (h) {') >= 0;
      })()
    );
  })()
);
check(
  'cemetery cell: sidewalk trees line the curb (the !b.cemetery tree suppression is REMOVED)',
  mbSec.indexOf('!b.cemetery &&') === -1
);
check(
  'corner-store spawn skips the cemetery block (QUEENS_STORE_CORNERS gate)',
  src.indexOf('blkIdx !== QUEENS_CEMETERY_BLOCK &&') >= 0
);
check(
  'leashed dogs roam the cemetery block too (the while-loop re-roll is gone)',
  /while \(isQueensLevel\(\) && b\.blockX === QUEENS_CEMETERY_X\)/.test(src) === false
);
check(
  'Polish ladies walk the cemetery block too (the filter no longer excludes QUEENS_CEMETERY_X)',
  src.indexOf('b.x !== QUEENS_CEMETERY_X') < 0
);

// ================= 10. SPAWNWORLD RESIDENTS =================
const swIdx = src.indexOf('function spawnWorld(');
const swSec = src.slice(swIdx, swIdx + 26000);
check(
  'spawnWorld: seeds a CROWDED pack of 40 ghosts via spawnCemeteryGhost (they fade in) + the spawner tops them up to GHOST_CAP',
  swSec.indexOf('for (let gi = 0; gi < 40; gi++) spawnCemeteryGhost()') >= 0
);
check(
  'spawnWorld: 3 cemetery rats (cemRat, behind the fence line)',
  swSec.indexOf('for (let ri = 0; ri < 3; ri++)') >= 0 &&
    swSec.indexOf('rt.cemRat = true') >= 0 &&
    swSec.indexOf('R(CEM_FENCE_Y + 0.8, CEM_BACK_Y - 0.8)') >= 0
);
check(
  'spawnWorld: 10 floating ghostly treasures just behind the fence (kinds 38/39/40)',
  swSec.indexOf('for (let ti = 0; ti < 10; ti++)') >= 0 &&
    swSec.indexOf('spawnGhostTreasure(') >= 0 &&
    swSec.indexOf('R(CEM_FENCE_Y + 0.4, CEM_FENCE_Y + 1.4)') >= 0
);
check(
  'spawnWorld: the raven is spawned as a creature (addCreature("raven"), gated on RAVEN_PERCH)',
  swSec.indexOf('if (RAVEN_PERCH) addCreature("raven")') >= 0
);
check(
  'spawnWorld: the cemetery homeowner is GHOSTLY (ghost: bx === QUEENS_CEMETERY_X)',
  swSec.indexOf('ghost: bx === QUEENS_CEMETERY_X') >= 0
);

// ================= 10b. RANDOM GHOST SPAWNS + FADE-IN + RAVEN SWOOP =================
check(
  'spawnCemeteryGhost assigns each ghost a ROUND-ROBIN slot (EVEN slot -> STREET, ODD slot -> SIDEWALK) so the pack is an even 50/50 across street + walk',
  (() => {
    const i = src.indexOf('function spawnCemeteryGhost()');
    if (i < 0) return false;
    const sec = src.slice(i, i + 900);
    return (
      sec.indexOf('addCreature("ghost")') >= 0 &&
      sec.indexOf('const slot = GHOST_SLOT_CURSOR % GHOST_SLOTS;') >= 0 &&
      sec.indexOf('GHOST_SLOT_CURSOR++;') >= 0 &&
      sec.indexOf('gh.zone = slot % 2 === 0 ? -1 : 1;') >= 0 &&
      sec.indexOf('gh.wx = ghostSlotX(slot) + R(-0.4, 0.4)') >= 0 &&
      sec.indexOf('gh.wy = gh.zone < 0 ? R(-8.8, -0.5) : R(0.8, 4.7)') >= 0 &&
      sec.indexOf('gh.fade = 0') >= 0
    );
  })()
);
check(
  'ghost spawner timer tops the pack up to GHOST_CAP (spawnCemeteryGhost when below cap) on the 75-slot grid',
  src.indexOf('if (ghosts < GHOST_CAP) spawnCemeteryGhost()') >= 0 &&
    src.indexOf('let ghostSpawnT = 3') >= 0 &&
    src.indexOf('const GHOST_CAP = 75') >= 0 &&
    src.indexOf('const GHOST_SLOTS = 75') >= 0
);
check(
  'ghost AI: each ghost drifts ONLY inside its own slot column + its own zone band (street ghosts never touch the sidewalk, sidewalk ghosts never touch the street)',
  /c\.tx = ghostSlotX\(c\.slot\) \+ R\(-0\.45, 0\.45\)/.test(src) &&
    /c\.ty = c\.zone < 0 \? R\(-8\.8, -0\.5\) : R\(0\.8, 4\.7\)/.test(src) &&
    /c\.wy = clamp\(c\.wy, c\.zone < 0 \? -9\.2 : 0\.6, c\.zone < 0 \? 0\.3 : CEM_FENCE_Y - 0\.5\)/.test(src)
);
check(
  'each ghost has its OWN material so it can fade in independently (makeGhostPerson -> d.ghostMat)',
  (() => {
    const i = src.indexOf('function makeGhostPerson(');
    if (i < 0) return false;
    const sec = src.slice(i, i + 600);
    return sec.indexOf('d.ghostMat = makeGhostMat()') >= 0 && sec.indexOf('d.ghostMat.opacity = 0') >= 0;
  })()
);
check(
  'ghosts cast NO shadows (ghostifyPerson walks every part: castShadow = false)',
  (() => {
    const i = src.indexOf('function ghostifyPerson(');
    if (i < 0) return false;
    const sec = src.slice(i, i + 600);
    return sec.indexOf('o.castShadow = false') >= 0;
  })()
);
check(
  'ghost fade-in: updateCreatures ramps c.fade and sets ghostMat.opacity = 0.45 * fade',
  ghostCaseSrc.indexOf('c.ghostMat.opacity = 0.45 * c.fade') >= 0 &&
    ghostCaseSrc.indexOf('c.fade = Math.min(1, (c.fade || 0) + dt / 1.0)') >= 0
);
check(
  'recycled ghosts re-fade in (c.fade = 0 on off-screen recycle)',
  ghostCaseSrc.indexOf('c.fade = 0; // drift back in from nothing at the new spot') >= 0
);
check(
  'addCreature has case "raven" (makeRaven, circling state, orbit params above the street + walk)',
  (() => {
    const i = addSec.indexOf('case "raven":');
    if (i < 0) return false;
    const sec = addSec.slice(i, i + 1400);
    return (
      sec.indexOf('c.data = makeRaven()') >= 0 &&
      sec.indexOf('c.ravState = "circling"') >= 0 &&
      sec.indexOf('c.cirCx = QUEENS_CEMETERY_X + BLOCK_W / 2') >= 0 &&
      sec.indexOf('c.cirZ = GZ + 5.2') >= 0
    );
  })()
);
check(
  'raven AI in updateCreatures: circling -> diving (onto the head) -> returning (climbs back up)',
  (() => {
    const i = src.indexOf('case "raven": {');
    if (i < 0) return false;
    const sec = src.slice(i, i + 4600);
    return (
      sec.indexOf('c.ravState === "circling"') >= 0 &&
      sec.indexOf('c.ravState === "diving"') >= 0 &&
      sec.indexOf('c.ravState = "returning"') >= 0 &&
      sec.indexOf('RAV.wingL.rotation.y') >= 0 &&
      sec.indexOf('rd < 20') >= 0
    );
  })()
);
check(
  'raven dive: one hit per dive (ravStruck gate) -> HP_HIT_RAVEN + scare + "Caw! Caw!"',
  (() => {
    const i = src.indexOf('case "raven": {');
    if (i < 0) return false;
    const sec = src.slice(i, i + 4600);
    return (
      sec.indexOf('if (!c.ravStruck && hd < 2.2)') >= 0 &&
      sec.indexOf('hurtNPC(HP_HIT_RAVEN, "raven")') >= 0 &&
      sec.indexOf('doStun(0.4, "scare")') >= 0 &&
      sec.indexOf('Caw! Caw!') >= 0
    );
  })()
);
check(
  'HP_HIT_RAVEN is the raven swoop damage (4)',
  src.indexOf('const HP_HIT_RAVEN = 4') >= 0
);
check(
  'the raven keeps its flight height (excluded from the ground-z reset)',
  src.indexOf('c.type !== "raven"') >= 0
);

// ================= 11. WRITE-UP + BUBBLE STYLE =================
check(
  'WRITEUP_REASONS.ghost: "Failure to respect the dearly departed" + friends',
  /ghost:\s*\[\s*"Failure to respect the dearly departed",/.test(src) &&
    src.indexOf('"The deceased were not afforded proper clearance"') >= 0 &&
    src.indexOf('"Ghost contact protocol was not followed"') >= 0
);
check('bubble CSS for the ghost speaker (spectral blue + glow)', /\.bubble\.bub-ghost \{/.test(src));
check(
  'spawnBubble maps the "ghost" speaker to the spectral-blue bubble',
  /speaker === "ghost"\) cls = "bubble bub-ghost";/.test(src)
);

// ================= 12. FUNCTIONAL: the ghost's REAL AI, simulated =================
console.log('');
console.log('[functional] ghost AI (the real case body, run in a harness)');
{
  const R = (a, b) => (a + b) / 2; // deterministic: aim at the band center
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const animParts = () => {};
  const said = [];
  const Voice = { say: (t) => said.push(t) };
  const CEM_FENCE_Y = 5.4;
  const QUEENS_CEMETERY_X = 96; // TEMP testing position (real: 384)
  const BLOCK_W = 96;
  const GZ = 0.3;
  const GHOST_LINES = ['Play with us and stay with us', 'Redrum'];
  const pick = (a) => a[0];
  const GHOST_SLOTS = 75;
  let GHOST_SLOT_CURSOR = 0;
  const ghostSlotX = (slot) => QUEENS_CEMETERY_X + (slot + 0.5) * (BLOCK_W / GHOST_SLOTS);
  const p = { wx: QUEENS_CEMETERY_X + 8, wy: -4 };
  // one STREET ghost (slot 0) + one SIDEWALK ghost (slot 1): the even split in action
  const ghosts = [
    {
      type: 'ghost',
      slot: 0,
      zone: -1,
      wx: ghostSlotX(0),
      wy: -2,
      ty: -2,
      tx: ghostSlotX(0),
      tyT: 0.1, // first tick picks a fresh target
      sp: 2.0,
      dir: 1,
      sayCd: 0,
      g: { rotation: { z: 0 }, position: { z: GZ } },
    },
    {
      type: 'ghost',
      slot: 1,
      zone: 1,
      wx: ghostSlotX(1),
      wy: 1.0,
      ty: 1.0,
      tx: ghostSlotX(1),
      tyT: 0.1,
      sp: 2.0,
      dir: 1,
      sayCd: 0,
      g: { rotation: { z: 0 }, position: { z: GZ } },
    },
  ];
  const stepFn = new Function(
    'c',
    'dt',
    'p',
    'R',
    'clamp',
    'animParts',
    'Voice',
    'CEM_FENCE_Y',
    'QUEENS_CEMETERY_X',
    'BLOCK_W',
    'GZ',
    'GHOST_LINES',
    'pick',
    'state',
    'tx',
    'ghostSlotX',
    'GHOST_SLOTS',
    'GHOST_SLOT_CURSOR',
    'switch (c.type) {\n' + ghostCaseSrc + '\n}',
  );
  let aiOk = true,
    aiMsg = '';
  try {
    for (let i = 0; i < 200; i++)
      for (let k = 0; k < ghosts.length; k++) {
        const c = ghosts[k];
        const tx = c.wx - p.wx;
        stepFn(c, 0.1, p, R, clamp, animParts, Voice, CEM_FENCE_Y, QUEENS_CEMETERY_X, BLOCK_W, GZ, GHOST_LINES, pick, 'play', tx, ghostSlotX, GHOST_SLOTS, GHOST_SLOT_CURSOR);
        // each ghost must stay on its OWN slot column (inside the block) AND in its
        // OWN zone band: street ghosts y -9.2..0.3, sidewalk ghosts y 0.6..fence-0.5
        const colW = BLOCK_W / GHOST_SLOTS;
        const sx = ghostSlotX(c.slot);
        if (c.wx < sx - colW / 2 - 1e-6 || c.wx > sx + colW / 2 + 1e-6)
          throw new Error('x escaped the slot column: ' + c.wx);
        if (c.zone < 0) {
          if (c.wy < -9.2 - 1e-6 || c.wy > 0.3 + 1e-6) throw new Error('street ghost left the street: ' + c.wy);
        } else if (c.wy < 0.6 - 1e-6 || c.wy > CEM_FENCE_Y - 0.5 + 1e-6)
          throw new Error('sidewalk ghost left the sidewalk: ' + c.wy);
      }
  } catch (e) {
    aiOk = false;
    aiMsg = e.message;
  }
  check(
    'ghosts stay on their OWN slot columns + zone bands (street ghost on the street, sidewalk ghost on the sidewalk — the even split holds) for 200 simulated frames',
    aiOk,
    aiMsg
  );
  check(
    'ghost drifted toward its target (moved off its spawn spot)',
    Math.abs(ghosts[0].wx - ghostSlotX(0)) > 0.2 || Math.abs(ghosts[0].wy + 2) > 0.2
  );
  check('ghost hovered (c.g.position.z set above GZ with the bob)', ghosts[0].g.position.z > GZ + 0.4);
  check(
    'ghost spoke a creepy line while near the worker',
    said.length > 0 && GHOST_LINES.indexOf(said[0]) >= 0,
    'said=' + JSON.stringify(said)
  );
  // Even-distribution proof: 75 round-robin slots -> the street and the sidewalk each
  // get (nearly) half the pack, and the slots line the block edge to edge.
  let streetN = 0,
    walkN = 0;
  const xs = [];
  let cursor = 0;
  for (let i = 0; i < 75; i++) {
    const slot = cursor % GHOST_SLOTS;
    cursor++;
    if (slot % 2 === 0) streetN++;
    else walkN++;
    xs.push(ghostSlotX(slot));
  }
  check(
    'the 75-ghost pack splits EVENLY between street and sidewalk (' + streetN + '/' + walkN + ', diff <= 1)',
    Math.abs(streetN - walkN) <= 1
  );
  check(
    'slots line the block edge-to-edge (first slot near the left edge, last near the right)',
    Math.min.apply(null, xs) < QUEENS_CEMETERY_X + 2 &&
      Math.max.apply(null, xs) > QUEENS_CEMETERY_X + BLOCK_W - 2
  );
}

// ================= 12b. FUNCTIONAL: the raven's swoop, simulated =================
console.log('');
console.log('[functional] raven AI (circling -> diving onto the head -> returning, run in a harness)');
{
  const ravenCaseSrc = (() => {
    const i = src.indexOf('case "raven": {');
    const j = src.indexOf('case "cat":', i);
    if (i < 0 || j < 0) return '';
    return src.slice(i, j);
  })();
  check('updateCreatures has case "raven" (extractable state machine)', ravenCaseSrc.length > 0);
  const R = (a, b) => (a + b) / 2; // deterministic: R(6,10) lands at the band center
  const GZ = 0.3;
  const QUEENS_CEMETERY_X = 96; // TEMP testing position (real: 384)
  const BLOCK_W = 96;
  const recR = { hurt: 0, dmg: 0, cause: null, stuns: 0, said: [] };
  const VoiceR = { say: (t, dur, pitch, x, y, g, sp) => recR.said.push({ t, sp }) };
  const hurtR = (a, cause) => {
    recR.hurt++;
    recR.dmg += a;
    recR.cause = cause;
  };
  const stunR = (d, t) => {
    recR.stuns++;
  };
  const cirCx = QUEENS_CEMETERY_X + BLOCK_W / 2;
  const cirZ = GZ + 5.2;
  const ravenC = {
    type: 'raven',
    sp: 10,
    dir: 1,
    ravState: 'circling',
    ravCd: 0, // ready to dive immediately
    ravStruck: false,
    ravT: 0,
    hopT: 0,
    cirCx,
    cirCy: 1.5,
    cirRx: 30,
    cirRy: 3.0,
    cirZ,
    cirAngle: 2.5, // starts near the worker so it dives right away
    wx: cirCx + Math.cos(2.5) * 30,
    wy: 1.5 + Math.sin(2.5) * 3.0,
    g: {
      userData: { rav: { wingL: { rotation: {} }, wingR: { rotation: {} } } },
      position: { z: cirZ },
      rotation: { z: 0 },
    },
  };
  const pR = { wx: QUEENS_CEMETERY_X + 40, wy: 3 }; // worker on the sidewalk, in front of the fence
  const stepRaven = new Function(
    'c',
    'dt',
    'p',
    'state',
    'Voice',
    'doStun',
    'hurtNPC',
    'HP_HIT_RAVEN',
    'R',
    'GZ',
    'switch (c.type) {\n' + ravenCaseSrc + '\n}',
  );
  let diveSeen = false;
  let circledAgain = false;
  for (let i = 0; i < 900; i++) {
    stepRaven(ravenC, 0.1, pR, 'play', VoiceR, stunR, hurtR, 4, R, GZ);
    if (ravenC.ravState === 'diving') diveSeen = true;
    if (i > 12 && ravenC.ravState === 'circling') {
      circledAgain = true;
      break;
    }
  }
  check("raven: DIVES down onto the worker's head when he is under its circle", diveSeen);
  check(
    'raven: strikes the worker EXACTLY ONCE (4 HP, cause "raven") + scare + "Caw! Caw!"',
    recR.hurt === 1 &&
      recR.dmg === 4 &&
      recR.cause === 'raven' &&
      recR.stuns === 1 &&
      recR.said.some((v) => v.t === 'Caw! Caw!'),
    'rec=' + JSON.stringify(recR)
  );
  check(
    'raven: CLIMBS BACK up to the sky and resumes circling (no repeat strike in one dive)',
    circledAgain && ravenC.ravState === 'circling' && ravenC.g.position.z > GZ + 4.0,
    'z=' + ravenC.g.position.z + ' state=' + ravenC.ravState
  );
}

// ================= 13. FUNCTIONAL: the ghost touch, simulated =================
console.log('');
console.log('[functional] ghost touch (the real collideCreatures branch, run in a harness)');
{
  const said = [];
  const Voice = { say: (t, dur, pitch, x, y, g, sp) => said.push({ t, sp }) };
  const rec = { hurt: 0, dmg: 0, cause: null, stuns: 0 };
  const hurtNPC = (a, cause) => {
    rec.hurt++;
    rec.dmg += a;
    rec.cause = cause;
  };
  const doStun = (d, t) => {
    rec.stuns++;
  };
  const pick = (a) => a[0];
  const GHOST_LINES = ['Play with us and stay with us', 'Redrum'];
  const GHOST_STREET_LINES = ['The street is OURS!', 'We died on this street!'];
  const HP_HIT_GHOST = 6;
  const HP_GHOST_STREET = 4;
  const WORKER_GENDER = 'male';
  const p = { wx: 432, wy: 5.1 };
  const runTouch = (c, pp, voice, stun, hurt) => {
    const fn = new Function(
      'c',
      'p',
      'Voice',
      'pick',
      'GHOST_LINES',
      'GHOST_STREET_LINES',
      'doStun',
      'hurtNPC',
      'HP_HIT_GHOST',
      'HP_GHOST_STREET',
      'WORKER_GENDER',
      ghostBumpSrc,
    );
    fn(c, pp, voice, pick, GHOST_LINES, GHOST_STREET_LINES, stun, hurt, HP_HIT_GHOST, HP_GHOST_STREET, WORKER_GENDER);
  };
  const g1 = { type: 'ghost', ghostCd: 0, wx: 432.2, wy: 5.2, gender: 'female' }; // on the SIDEWALK
  const wxBefore = p.wx;
  runTouch(g1, p, Voice, doStun, hurtNPC);
  check('ghost touch (SIDEWALK): the FULL 10 HP drained, tagged to the "ghost" cause', rec.hurt === 1 && rec.dmg === 10 && rec.cause === 'ghost');
  check('ghost touch: the worker got SCARED (one stun)', rec.stuns === 1);
  check(
    'ghost touch: the ghost spoke a creepy line in a "ghost" bubble + the worker yelled',
    said.some((v) => GHOST_LINES.indexOf(v.t) >= 0 && v.sp === 'ghost') &&
      said.some((v) => v.t === 'Aaagh! A ghost!' && v.sp === 'worker')
  );
  check('ghost touch: NOT solid — the worker was NOT pushed (wx unchanged)', p.wx === wxBefore);
  // cooldown: an immediate re-touch does nothing
  rec.hurt = 0;
  runTouch(g1, p, Voice, doStun, hurtNPC);
  check('ghost touch: cooldown — an immediate re-touch re-damages NOTHING', rec.hurt === 0);
  // OUT IN THE STREET: same FULL 10 HP damage (street ghosts add the longer freeze + road lines)
  const saidStreet = [];
  const VoiceStreet = { say: (t, dur, pitch, x, y, g, sp) => saidStreet.push({ t, sp }) };
  const recS = { hurt: 0, dmg: 0, cause: null, stuns: 0 };
  const stunS = (d, t) => {
    recS.stuns++;
  };
  const hurtS = (a, cause) => {
    recS.hurt++;
    recS.dmg += a;
    recS.cause = cause;
  };
  const pS = { wx: 432, wy: 0.0 }; // worker out in the street
  const gStreet = { type: 'ghost', ghostCd: 0, wx: 432.2, wy: -0.4, gender: 'male' }; // ghost OUT IN THE STREET
  runTouch(gStreet, pS, VoiceStreet, stunS, hurtS);
  check(
    'STREET ghost touch: the FULL 10 HP (6 + 4) tagged to the "ghost" cause — no easier than the sidewalk',
    recS.hurt === 1 && recS.dmg === 10 && recS.cause === 'ghost'
  );
  check(
    'STREET ghost touch: the ghost claims the road (street line) + the worker yells the street yelp',
    saidStreet.some((v) => GHOST_STREET_LINES.indexOf(v.t) >= 0 && v.sp === 'ghost') &&
      saidStreet.some((v) => v.t === "NO! The street's ALL GHOSTS!?" && v.sp === 'worker')
  );
  // the ghostified HOMEOWNER gets the ghost treatment too (sidewalk spot = full 10 HP)
  const rec2 = { hurt: 0, dmg: 0, cause: null };
  const hurt2 = (a, cause) => {
    rec2.hurt++;
    rec2.dmg += a;
    rec2.cause = cause;
  };
  const ho = { type: 'homeowner', ghost: true, ghostCd: 0, wx: 432.2, wy: 5.2, gender: 'male' };
  runTouch(ho, p, Voice, doStun, hurt2);
  check(
    'ghostified HOMEOWNER touch: same FULL 10 HP "ghost" scare (not the 1 HP civilian bump)',
    rec2.hurt === 1 && rec2.dmg === 10 && rec2.cause === 'ghost'
  );
}

// ================= 14. FUNCTIONAL: the fence is IMPASSABLE =================
console.log('');
console.log('[functional] fence clamp (the real updatePlayer fence loop, run in a harness)');
{
  const start = src.indexOf('const FENCE_STOP = 0.3;');
  const end = src.indexOf('// === SOLID SIDEWALK OBSTACLES', start);
  const loopSrc = src.slice(start, end).trim();
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const blocks = [
    { cemetery: true, cemFence: { x0: 96.2, x1: 192.2, y: 5.4 } }, // TEMP testing position (real: 384.2/480.2)
    { buildingFront: { x0: 100, x1: 120, y1: 10 } }, // unrelated block: ignored
  ];
  const p = { wx: 144, wy: 5.3 }; // TEMP testing position: inside 96.2..192.2 (real: 432)
  const fn = new Function('p', 'blocks', 'clamp', loopSrc);
  fn(p, blocks, clamp);
  check('worker pushed against the fence line stays at fence-0.3 (5.1)', Math.abs(p.wy - 5.1) < 1e-9, 'wy=' + p.wy);
  const p2 = { wx: 144, wy: 3.0 }; // on the sidewalk side: free
  fn(p2, blocks, clamp);
  check('worker on the sidewalk side of the fence is unaffected', p2.wy === 3.0);
  const p3 = { wx: 250, wy: 5.3 }; // past the fence x-range: free (real: 490)
  fn(p3, blocks, clamp);
  check('outside the fence x-range the cemetery wall does not apply', p3.wy === 5.3);
}

// ================= 15. STREET GHOSTS (arms / headstones / skull piles) =================
console.log('');
console.log('[static] street ghost builders + hazards + collideStatic branches');
{
  const armSrc = extract('makeGhostArm');
  check(
    'makeGhostArm: an OPEN hand (5 STRAIGHT stretched fingers fanned out — middle longest, pinky shortest, thumb set wide) reaches UP out of a spectral mound (animated arm ref)',
    armSrc.indexOf('for (let i = 0; i < 5; i++)') >= 0 &&
      armSrc.indexOf('g.userData.arm = arm') >= 0 &&
      armSrc.indexOf('const FINGERS = [') >= 0 &&
      armSrc.indexOf('tip.position.set') >= 0 &&
      armSrc.indexOf('middle: longest') >= 0
  );
  check(
    'spectral CURB FOG: a full-block mist band (y 0.45) + drifting wisps mark the street/sidewalk ghost-zone boundary (decoration only, no shadows, no hazard)',
    (() => {
      const i = src.indexOf('function buildCemeteryStreetGhosts(');
      if (i < 0) return false;
      const sec = src.slice(i, i + 1600);
      return (
        sec.indexOf('fogBand') >= 0 &&
        sec.indexOf('BX(BLOCK_W, 0.8, 0.02, fogMat)') >= 0 &&
        sec.indexOf('fogBand.position.set(bx + BLOCK_W / 2, 0.45') >= 0 &&
        sec.indexOf('fogBand.castShadow = false') >= 0 &&
        sec.indexOf('wisp') >= 0
      );
    })()
  );
  const hsSrc = extract('makeGhostHeadstone');
  check(
    'makeGhostHeadstone: a ghostly rounded slab (plinth + slab + rounded cap)',
    hsSrc.indexOf('plinth') >= 0 &&
      hsSrc.indexOf('slab') >= 0 &&
      hsSrc.indexOf('cap.rotation.z = Math.PI / 2') >= 0
  );
  const skullSrc = extract('makeSkullPile');
  check(
    'makeSkullPile: a mound + HIGH-POLY skulls (SPH 24x18 cranium, jaw, teeth, dark sockets/nose) that read as REAL skulls',
    skullSrc.indexOf('mound') >= 0 &&
      skullSrc.indexOf('skull(') >= 0 &&
      skullSrc.indexOf('SPH(r, mat, 24, 18)') >= 0 &&
      skullSrc.indexOf('chin') >= 0 &&
      skullSrc.indexOf('tooth') >= 0 &&
      skullSrc.indexOf('0x0a1020') >= 0
  );
  const matSrc = extract('makeGhostObjectMat');
  check(
    'makeGhostObjectMat: one shared TRANSLUCENT spectral material (opacity 0.5, depthWrite off)',
    matSrc.indexOf('opacity: 0.5') >= 0 && matSrc.indexOf('depthWrite: false') >= 0
  );
  const placeSrc = extract('buildCemeteryStreetGhosts');
  check(
    'buildCemeteryStreetGhosts: ARMS registered as "ghostarm" hazards (grab range r 0.55)',
    placeSrc.indexOf('"ghostarm"') >= 0 && placeSrc.indexOf('0.55') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: HEADSTONES + SKULL PILES registered as SOLID "ghoststone" hazards',
    placeSrc.indexOf('makeGhostHeadstone()') >= 0 &&
      placeSrc.indexOf('makeSkullPile()') >= 0 &&
      placeSrc.indexOf('"ghoststone"') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: objects added to groundGroup AND pushed to the block hazards',
    placeSrc.indexOf('groundGroup.add(g)') >= 0 &&
      placeSrc.indexOf('b.hazards.push(') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: BUSY street — 16 ARMS + 18 HEADSTONES + 14 SKULL PILES',
    placeSrc.indexOf('for (let i = 0; i < 16; i++)') >= 0 &&
      placeSrc.indexOf('for (let i = 0; i < 18; i++)') >= 0 &&
      placeSrc.indexOf('for (let i = 0; i < 14; i++)') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: objects line the street edge-to-edge (colX left -> right w/ jitter, 5 bands curb -> far curb incl. the truck lane at -4.6)',
    placeSrc.indexOf('const colX =') >= 0 &&
      placeSrc.indexOf('bx + 3 + (i + 0.5) * ((BLOCK_W - 6) / n)') >= 0 &&
      placeSrc.indexOf('[-0.6, -2.6, -4.6, -6.6, -8.6]') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: SOLID obstacles kept >= 2.4u apart (separation pass) so the street stays traversable',
    placeSrc.indexOf('if (d < 2.4)') >= 0 &&
      placeSrc.indexOf('solids[i].x -= nx * push;') >= 0 &&
      placeSrc.indexOf('solids[j].x += nx * push;') >= 0
  );
  check(
    'buildCemeteryStreetGhosts: called for the cemetery block cell (houseIdx === 0)',
    src.indexOf('buildCemeteryStreetGhosts(b);') >= 0
  );
  check(
    'HP_HIT_GHOSTARM = 4 (a spectral grab — the raven\'s light-strike weight)',
    /HP_HIT_GHOSTARM = 4;/.test(src)
  );
  const cs = extract('collideStatic');
  check(
    'collideStatic: "ghoststone" is SOLID (worker shoved back, NO damage) + "They only moved the headstones!"',
    cs.indexOf('hz.type === "ghoststone"') >= 0 &&
      cs.indexOf('p.wx -= 0.85') >= 0 &&
      cs.indexOf('They only moved the headstones!') >= 0
  );
  check(
    'collideStatic: "ghostarm" GRABS the worker (HP_HIT_GHOSTARM "ghost" damage + scare + line)',
    cs.indexOf('hz.type === "ghostarm"') >= 0 &&
      cs.indexOf('hurtNPC(HP_HIT_GHOSTARM, "ghost")') >= 0 &&
      cs.indexOf('Get those hands off me!') >= 0
  );
  check(
    'the spectral arms are ANIMATED (reach + sway) every frame in updateCreatures',
    src.indexOf('GHOST_ARMS.length') >= 0 &&
      src.indexOf('A.g.userData.arm.position.z') >= 0
  );
}

console.log('');
console.log('[functional] street obstacle layout (18 headstones + 14 skull piles, simulated placement)');
{
  // Re-run the buildCemeteryStreetGhosts placement math (colX/bandY/separation)
  // with the real randoms: every final SOLID pair must be >= 2.4u apart (the street
  // stays traversable) and every object must stay on the street inside the block.
  const BLOCK_W = 96;
  const bx = 96; // the cemetery block x (temp position)
  const R = (a, b) => a + Math.random() * (b - a);
  const STREET_BANDS = [-0.6, -2.6, -4.6, -6.6, -8.6];
  const bandY = (i) => STREET_BANDS[i % 5] + R(-0.7, 0.7);
  const colX = (i, n) => bx + 3 + (i + 0.5) * ((BLOCK_W - 6) / n) + R(-1.4, 1.4);
  let minD = Infinity;
  let inStreet = true;
  for (let run = 0; run < 300; run++) {
    const solids = [];
    for (let i = 0; i < 18; i++) solids.push({ x: colX(i, 18), y: bandY(i + 2) });
    for (let i = 0; i < 14; i++) solids.push({ x: colX(i, 14), y: bandY(i + 4) });
    for (let pass = 0; pass < 20; pass++) {
      for (let i = 0; i < solids.length; i++)
        for (let j = i + 1; j < solids.length; j++) {
          const dx = solids[j].x - solids[i].x;
          const dy = solids[j].y - solids[i].y;
          const d = Math.hypot(dx, dy);
          if (d < 2.4) {
            const push = (2.4 - d) / 2 + 0.02;
            let nx, ny;
            if (d > 0.001 && Math.abs(dy / d) < 0.7) {
              nx = dx / d;
              ny = dy / d;
            } else {
              nx = dx >= 0 ? 1 : -1;
              ny = 0;
            }
            solids[i].x -= nx * push;
            solids[i].y -= ny * push;
            solids[j].x += nx * push;
            solids[j].y += ny * push;
          }
        }
      for (let i = 0; i < solids.length; i++)
        solids[i].y = Math.max(-9.3, Math.min(0.2, solids[i].y));
    }
    for (let i = 0; i < solids.length; i++) {
      if (solids[i].y < -9.5 || solids[i].y > 0.5 || solids[i].x < bx - 0.5 || solids[i].x > bx + BLOCK_W + 0.5)
        inStreet = false;
      for (let j = i + 1; j < solids.length; j++)
        minD = Math.min(minD, Math.hypot(solids[j].x - solids[i].x, solids[j].y - solids[i].y));
    }
  }
  check(
    'street obstacles: after the separation pass every SOLID pair is >= 2.4u apart (300 random layouts)',
    minD >= 2.4 - 1e-6,
    'minD=' + minD
  );
  check(
    'street obstacles: all 32 solids stay ON the street (y -9.5..0.5) inside the block x-range',
    inStreet
  );
}

console.log('');
console.log('[functional] street ghost hazards (the real collideStatic, run in a harness)');
{
  const csSrc = extract('collideStatic');
  const runHazard = (hzType, r) => {
    const said = [];
    const rec = { hurt: 0, dmg: 0, cause: null, stuns: 0 };
    const p = { wx: 144, wy: 0.2, invuln: 0, stunT: 0, immuneT: 0, poopSteps: 0 };
    const blocks = [
      { hazards: [{ wx: 144, wy: 0.2, r: r, type: hzType, drop: 0, cd: 0 }] },
    ];
    const Voice = { say: (t, dur, vol, x, y, g, sp) => said.push({ t: t, sp: sp }) };
    const hurtNPC = (a, cause) => {
      rec.hurt++;
      rec.dmg += a;
      rec.cause = cause;
    };
    const doStun = (d, type) => {
      rec.stuns++;
    };
    const fn = new Function(
      'state',
      'p',
      'blocks',
      'Voice',
      'hurtNPC',
      'doStun',
      'WORKER_GENDER',
      'HP_HIT_GHOSTARM',
      'HP_HIT_HAZARD',
      'footDist',
      'dropCarried',
      'carry',
      'dt',
      csSrc + '\n collideStatic(dt);',
    );
    fn('play', p, blocks, Voice, hurtNPC, doStun, 'male', 4, 5, 0, function () {}, 'none', 0.016);
    return { said: said, rec: rec, p: p };
  };
  // ghoststone (headstone / skull pile): SOLID, no damage, the line
  const gs = runHazard('ghoststone', 0.85);
  check(
    'ghoststone touch: the worker is SHOVEd back (wx decreased) — he must go AROUND it',
    gs.p.wx < 144,
    'wx=' + gs.p.wx
  );
  check('ghoststone touch: NO damage (an obstacle, not a hit)', gs.rec.hurt === 0);
  check(
    'ghoststone touch: the worker says "They only moved the headstones!"',
    gs.said.some((v) => v.t === 'They only moved the headstones!' && v.sp === 'worker')
  );
  // ghostarm: damage + scare, no shove (it grabs, it doesn't wall)
  const ga = runHazard('ghostarm', 0.55);
  check(
    'ghostarm touch: HP_HIT_GHOSTARM (4) damage tagged to the "ghost" cause',
    ga.rec.hurt === 1 && ga.rec.dmg === 4 && ga.rec.cause === 'ghost'
  );
  check(
    'ghostarm touch: the worker got a scare stun + yelled "Get those hands off me!"',
    ga.rec.stuns === 1 &&
      ga.said.some((v) => v.t === 'Get those hands off me!' && v.sp === 'worker')
  );
  check('ghostarm touch: NOT a wall — the worker was NOT shoved (wx unchanged)', ga.p.wx === 144);
}

console.log('');
console.log(pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
