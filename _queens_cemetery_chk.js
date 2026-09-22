// _queens_cemetery_chk.js — verify the Maspeth 5th block CEMETERY in index.html:
//   - constants (block index 1 / x 96 — TEMP testing position, real home is index 4 / x 384; fence line 5.4, back edge 12.0)
//   - builders: makeHeadstone, makeDeadTree, makeRaven, makeCemeteryFence,
//     buildCemeteryBlock (fence + stones + monuments + trees + raven)
//   - ghost helpers (ghostifyPerson transparent blue, makeGhostPerson)
//   - ghostly treasure kinds 38/39/40 + spawnGhostTreasure (floating bob)
//   - addCreature case "ghost" + ghostified cemetery homeowner
//   - updateCreatures case "ghost" (drift, float, creepy lines, block-bound)
//   - collideCreatures ghost branch (scare + HP drain, NOT solid, cooldown)
//   - worker fence clamp (impassable) + FULLY enclosed lot (front/back/side walls, cornered)
//   - block suppression (no houses/stores/garbage/dogs/ladies; sidewalk trees now line the curb)
//   - cemetery rats + 5 ghosts + 5 floating treasures in spawnWorld
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
  'buildCemeteryBlock assembles fence + 10 headstones + 3 monuments + 4 dead trees + raven',
  cemBlock.length > 0 &&
    cemBlock.indexOf('makeCemeteryFence(BLOCK_W)') >= 0 &&
    cemBlock.indexOf('for (let i = 0; i < 10; i++)') >= 0 &&
    cemBlock.indexOf('for (let m = 0; m < 3; m++)') >= 0 &&
    cemBlock.indexOf('for (let t = 0; t < 4; t++)') >= 0 &&
    cemBlock.indexOf('makeRaven()') >= 0 &&
    cemBlock.indexOf('QUEENS_CEMETERY_X') >= 0
);
check(
  'the raven perches ON a headstone (stone userData.top + GZ offset)',
  cemBlock.indexOf('GZ + per.top + 0.02') >= 0
);
check(
  'the lot is FULLY enclosed: front + back walls (BLOCK_W) + two side walls (CEM_BACK_Y-CEM_FENCE_Y) rotated to run parallel to the cross street',
  cemBlock.indexOf('const back = makeCemeteryFence(BLOCK_W)') >= 0 &&
    cemBlock.indexOf('const sideLen = CEM_BACK_Y - CEM_FENCE_Y') >= 0 &&
    cemBlock.indexOf('const left = makeCemeteryFence(sideLen)') >= 0 &&
    cemBlock.indexOf('const right = makeCemeteryFence(sideLen)') >= 0 &&
    cemBlock.indexOf('rotation.z = Math.PI / 2') >= 0
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
  'addCreature re-rolls spawns OFF the cemetery block (only ghosts + rats + the ghost homeowner may land on it)',
  addSec.indexOf('Maspeth cemetery: the block is reserved for ghosts + rats') >= 0 &&
    addSec.indexOf('while (c.wx > c0 && c.wx < c1 && tries < 8)') >= 0 &&
    addSec.indexOf('type !== "ghost"') >= 0 &&
    addSec.indexOf('type !== "rat"') >= 0
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
  'ghost AI: wanders the sidewalk AND behind the fence (ty up to CEM_BACK_Y)',
  ghostCaseSrc.indexOf('c.ty = R(0.6, CEM_BACK_Y - 0.6)') >= 0 &&
    ghostCaseSrc.indexOf('QUEENS_CEMETERY_X + 3, QUEENS_CEMETERY_X + BLOCK_W - 3') >= 0
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
  'ghost AI: block-bound recycle (respawns inside the cemetery, never p.wx ± 38)',
  ghostCaseSrc.indexOf('if (tx > 55 || tx < -58)') >= 0 &&
    ghostCaseSrc.indexOf('R(QUEENS_CEMETERY_X + 3, QUEENS_CEMETERY_X + BLOCK_W - 3)') >= 0 &&
    ghostCaseSrc.indexOf('p.wx - 38') < 0
);
check(
  'ghostCd ticks down per frame (so a ghost can scare again after the cooldown)',
  src.slice(ucStart, ucStart + 400).indexOf('if (c.ghostCd > 0) c.ghostCd -= dt') >= 0
);
check(
  'cemetery rats scurry the graveyard grass (cemRat band, behind the fence)',
  /c\.cemRat \? CEM_FENCE_Y \+ 0\.6 : 0\.8/.test(src) && /c\.cemRat \? CEM_BACK_Y - 0\.6 : 2\.2/.test(src)
);
check(
  'cemetery NO-GO ZONE in updateCreatures: only ghosts + rats (+ ghost homeowner) stay on the block, everything else snaps to the nearer edge and faces away (road vehicles exempt)',
  (() => {
    const iNo = src.indexOf('Maspeth cemetery NO-GO ZONE');
    const iEnd = src.indexOf('separateVehicles(vehicleList, dt)');
    if (iNo < 0 || iEnd < 0) return false;
    const sec = src.slice(iNo, iEnd);
    return (
      iNo > ucStart &&
      iNo < iEnd &&
      sec.indexOf('c.type !== "ghost"') >= 0 &&
      sec.indexOf('c.type !== "rat"') >= 0 &&
      sec.indexOf('c.type !== "car"') >= 0 &&
      sec.indexOf('c.type !== "moto"') >= 0 &&
      sec.indexOf('c.type !== "bike"') >= 0 &&
      sec.indexOf('c.type !== "ebike"') >= 0 &&
      sec.indexOf('c.dir = c.wx < cMid ? -1 : 1') >= 0
    );
  })()
);
check(
  'bodega cat pool excludes the cemetery block (no store, no cats there)',
  src.indexOf('[1, 2, 3, 4, 5].filter(\n            (i) => i !== QUEENS_CEMETERY_BLOCK') >= 0
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
  'ghost touch: 2 HP chill tagged to "ghost" (the write-up cause)',
  ghostBumpSrc.indexOf('hurtNPC(HP_HIT_GHOST, "ghost")') >= 0
);
check(
  'ghost touch: the worker is SCARED (doStun 0.55 "scare")',
  ghostBumpSrc.indexOf('doStun(0.55, "scare")') >= 0
);
check(
  'ghost touch: chilling line (GHOST_LINES, "ghost" bubble) + worker yelp "Aaagh! A ghost!"',
  ghostBumpSrc.indexOf('pick(GHOST_LINES)') >= 0 && ghostBumpSrc.indexOf('"Aaagh! A ghost!"') >= 0
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
check('HP_HIT_GHOST is the MINOR ghost damage (2, lighter than a hazard)', /const HP_HIT_GHOST = 2;/.test(src));
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
  'leashed dogs skip the cemetery block (while-loop re-roll)',
  /while \(isQueensLevel\(\) && b\.blockX === QUEENS_CEMETERY_X\)/.test(src)
);
check(
  'Polish ladies skip the cemetery block (filter excludes QUEENS_CEMETERY_X)',
  src.indexOf('b.x !== QUEENS_CEMETERY_X') >= 0
);

// ================= 10. SPAWNWORLD RESIDENTS =================
const swIdx = src.indexOf('function spawnWorld(');
const swSec = src.slice(swIdx, swIdx + 26000);
check(
  'spawnWorld: 5 ghosts on the cemetery block (block-bound wx/wy, random facing)',
  swSec.indexOf('for (let gi = 0; gi < 5; gi++)') >= 0 &&
    swSec.indexOf('addCreature("ghost")') >= 0 &&
    swSec.indexOf('gh.blockMinX = QUEENS_CEMETERY_X + 5') >= 0
);
check(
  'spawnWorld: 3 cemetery rats (cemRat, behind the fence line)',
  swSec.indexOf('for (let ri = 0; ri < 3; ri++)') >= 0 &&
    swSec.indexOf('rt.cemRat = true') >= 0 &&
    swSec.indexOf('R(CEM_FENCE_Y + 0.8, CEM_BACK_Y - 0.8)') >= 0
);
check(
  'spawnWorld: 5 floating ghostly treasures just behind the fence (kinds 38/39/40)',
  swSec.indexOf('for (let ti = 0; ti < 5; ti++)') >= 0 &&
    swSec.indexOf('spawnGhostTreasure(') >= 0 &&
    swSec.indexOf('R(CEM_FENCE_Y + 0.4, CEM_FENCE_Y + 1.4)') >= 0
);
check(
  'spawnWorld: the cemetery homeowner is GHOSTLY (ghost: bx === QUEENS_CEMETERY_X)',
  swSec.indexOf('ghost: bx === QUEENS_CEMETERY_X') >= 0
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
  const CEM_BACK_Y = 12.0;
  const QUEENS_CEMETERY_X = 96; // TEMP testing position (real: 384)
  const BLOCK_W = 96;
  const GZ = 0.3;
  const GHOST_LINES = ['Play with us and stay with us', 'Redrum'];
  const pick = (a) => a[0];
  const p = { wx: QUEENS_CEMETERY_X + 20, wy: 3 };
  const c = {
    type: 'ghost',
    wx: QUEENS_CEMETERY_X + 10,
    wy: 2,
    ty: 2,
    tx: QUEENS_CEMETERY_X + 10,
    tyT: 0.1, // first tick picks a fresh target
    sp: 2.0,
    dir: 1,
    sayCd: 0,
    g: { rotation: { z: 0 }, position: { z: GZ } },
  };
  const stepFn = new Function(
    'c',
    'dt',
    'p',
    'R',
    'clamp',
    'animParts',
    'Voice',
    'CEM_BACK_Y',
    'QUEENS_CEMETERY_X',
    'BLOCK_W',
    'GZ',
    'GHOST_LINES',
    'pick',
    'state',
    'tx',
    'switch (c.type) {\n' + ghostCaseSrc + '\n}',
  );
  let aiOk = true,
    aiMsg = '';
  try {
    for (let i = 0; i < 200; i++) {
      const tx = c.wx - p.wx;
      stepFn(c, 0.1, p, R, clamp, animParts, Voice, CEM_BACK_Y, QUEENS_CEMETERY_X, BLOCK_W, GZ, GHOST_LINES, pick, 'play', tx);
      if (c.wx < QUEENS_CEMETERY_X + 2 - 1e-6 || c.wx > QUEENS_CEMETERY_X + BLOCK_W - 2 + 1e-6)
        throw new Error('x escaped the block: ' + c.wx);
      if (c.wy < 0.4 - 1e-6 || c.wy > CEM_BACK_Y - 0.4 + 1e-6) throw new Error('y escaped: ' + c.wy);
    }
  } catch (e) {
    aiOk = false;
    aiMsg = e.message;
  }
  check('ghost stays INSIDE the cemetery block + y band for 200 simulated frames', aiOk, aiMsg);
  check(
    'ghost drifted toward its target (moved off its spawn spot)',
    Math.abs(c.wx - (QUEENS_CEMETERY_X + 10)) > 1 || Math.abs(c.wy - 2) > 0.5
  );
  check('ghost hovered (c.g.position.z set above GZ with the bob)', c.g.position.z > GZ + 0.4);
  check(
    'ghost spoke a creepy line while near the worker',
    said.length > 0 && GHOST_LINES.indexOf(said[0]) >= 0,
    'said=' + JSON.stringify(said)
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
  const HP_HIT_GHOST = 2;
  const WORKER_GENDER = 'male';
  const p = { wx: 432, wy: 5.1 };
  const runTouch = (c, hurt) => {
    const fn = new Function(
      'c',
      'p',
      'Voice',
      'pick',
      'GHOST_LINES',
      'doStun',
      'hurtNPC',
      'HP_HIT_GHOST',
      'WORKER_GENDER',
      ghostBumpSrc,
    );
    fn(c, p, Voice, pick, GHOST_LINES, doStun, hurt, HP_HIT_GHOST, WORKER_GENDER);
  };
  const g1 = { type: 'ghost', ghostCd: 0, wx: 432.2, wy: 5.2, gender: 'female' };
  const wxBefore = p.wx;
  runTouch(g1, hurtNPC);
  check('ghost touch: 2 HP drained, tagged to the "ghost" cause', rec.hurt === 1 && rec.dmg === 2 && rec.cause === 'ghost');
  check('ghost touch: the worker got SCARED (one stun)', rec.stuns === 1);
  check(
    'ghost touch: the ghost spoke a creepy line in a "ghost" bubble + the worker yelled',
    said.some((v) => GHOST_LINES.indexOf(v.t) >= 0 && v.sp === 'ghost') &&
      said.some((v) => v.t === 'Aaagh! A ghost!' && v.sp === 'worker')
  );
  check('ghost touch: NOT solid — the worker was NOT pushed (wx unchanged)', p.wx === wxBefore);
  // cooldown: an immediate re-touch does nothing
  rec.hurt = 0;
  runTouch(g1, hurtNPC);
  check('ghost touch: cooldown — an immediate re-touch re-damages NOTHING', rec.hurt === 0);
  // the ghostified HOMEOWNER gets the ghost treatment too
  const rec2 = { hurt: 0, dmg: 0, cause: null };
  const hurt2 = (a, cause) => {
    rec2.hurt++;
    rec2.dmg += a;
    rec2.cause = cause;
  };
  const ho = { type: 'homeowner', ghost: true, ghostCd: 0, wx: 432.2, wy: 5.2, gender: 'male' };
  runTouch(ho, hurt2);
  check(
    'ghostified HOMEOWNER touch: same 2 HP "ghost" scare (not the 1 HP civilian bump)',
    rec2.hurt === 1 && rec2.dmg === 2 && rec2.cause === 'ghost'
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

console.log('');
console.log(pass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
