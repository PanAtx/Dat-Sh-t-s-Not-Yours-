'use strict';
/* _flatbush_stoop_chk.js
 * Regression check for the Flatbush (Brooklyn, level 3) brick stoop.
 *
 * ROOT CAUSE: the three stacked brick steps are separate boxes; the top + second
 * steps had nothing under them, so the stoop looked like it was floating. The
 * bottom step already sat on the ground (z=0.3).
 *
 * FIX: a solid "backing" box under each of the two upper steps, filling from the
 * ground (z=0.3) up to that step's bottom, in a slightly darker brick (0x74482d)
 * than the steps (0x8b5a3a) — same approach as the Bronx/Brownstone stoop backing.
 *
 * THIS CHECK: rebuilds makeBrooklynFlatbushHouse headless and verifies:
 *   - exactly 2 backing boxes in the darker brick color (0x74482d),
 *   - each upper step has a backing directly under it (same x/y footprint),
 *   - each backing fills from the ground up to its step's bottom,
 *   - the backing color is darker than the step color on every channel,
 *
 * COLLISION FIX: the step collision boxes' x-extent (userData.stairs[].hw) used to be
 * porchW/2 + 0.3 — the FULL porch width — while the visible steps are only stepW =
 * porchW*0.45 wide, so the worker stood in mid-air on the sides of the stoop. Now hw
 * tracks the visual step width. This check asserts each collision half-width matches
 * the visual step and is NOT the full porch width.
 */
const fs = require('fs');
const path = require('path');

function grab(src, start) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('not found: ' + start);
  let d = 0,
    j = i;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') d++;
    else if (ch === '}') {
      d--;
      if (d === 0) break;
    }
  }
  return src.slice(i, j + 1);
}
function grabFn(src, name) {
  return grab(src, 'function ' + name + '(');
}

let src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const fnSrc = grabFn(src, 'makeBrooklynFlatbushHouse');

// ---- Headless stubs for the builder's dependencies ----
const M = (color, opt) => ({ color });
const R = (a, b) => a; // deterministic (returns the low bound)
// BX(w, h, d, mat): records the box extents (X, Y-depth, Z-up) + its own position.
function BX(w, h, d, mat) {
  return {
    _kind: 'box',
    _ext: [w, h, d],
    _mat: mat,
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
function CY(r1, r2, h, mat, s) {
  return {
    _kind: 'cyl',
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
function SPH(r, m) {
  return {
    _kind: 'sph',
    position: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
  };
}
class Group {
  constructor() {
    this.position = { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; } };
    this.children = [];
    this.userData = {};
    this.isMesh = false;
  }
  add(c) {
    this.children.push(c);
  }
  traverse(fn) {
    fn(this);
    this.children.forEach((c) => fn(c));
  }
}
const THREE = {
  Group,
  MeshLambertMaterial: function (opts) {
    this.color = opts && opts.color;
  },
};

const factory = new Function('THREE', 'M', 'BX', 'CY', 'SPH', 'R', fnSrc + '\nreturn makeBrooklynFlatbushHouse();');
const g = factory(THREE, M, BX, CY, SPH, R);

// ---- Collect all direct-child boxes ----
const boxes = g.children
  .filter((c) => c && c._kind === 'box')
  .map((b) => ({
    e: b._ext.slice(),
    c: [b.position.x, b.position.y, b.position.z],
    color: (b._mat && (b._mat.color >>> 0)) || 0,
  }));

const GROUND = 0.3;
const STEP_COLOR = 0x8b5a3a;
const BACKING_COLOR = 0x74482d;

// The 3 brick steps: step color AND step height (z-extent) 0.24 (excludes the
// 0.7-tall porch base, which also uses the step color).
const steps = boxes
  .filter((b) => b.color === STEP_COLOR && Math.abs(b.e[2] - 0.24) < 1e-6)
  .sort((a, b) => b.c[2] - a.c[2]); // top (highest z) first
// The two upper steps (top + second): bottom edge above the ground.
const upperSteps = steps.filter((s) => s.c[2] - s.e[2] / 2 > GROUND + 0.05);
const backings = boxes.filter((b) => b.color === BACKING_COLOR);

let ok = true;
function check(cond, msg) {
  if (!cond) {
    ok = false;
    console.log('FAIL - ' + msg);
  } else console.log('ok   - ' + msg);
}

check(boxes.length >= 6, 'builder produced several boxes (got ' + boxes.length + ')');
check(steps.length === 3, 'found the 3 brick steps of height 0.24 (got ' + steps.length + ')');
check(upperSteps.length === 2, 'two upper steps (top + second) identified (got ' + upperSteps.length + ')');
check(
  backings.length === 2,
  'exactly 2 backing blocks in the darker brick (0x74482d) — got ' + backings.length
);

for (const s of upperSteps) {
  const stepBottom = s.c[2] - s.e[2] / 2;
  const match = backings.find(
    (b) =>
      Math.abs(b.c[0] - s.c[0]) < 1e-6 && // same x footprint
      Math.abs(b.c[1] - s.c[1]) < 1e-6 && // same y (depth) footprint
      Math.abs(b.c[2] + b.e[2] / 2 - stepBottom) < 0.02 // backing top ≈ step bottom
  );
  check(!!match, 'step (bottom z=' + stepBottom.toFixed(3) + ') has a backing directly under it');
  if (match) {
    const bBottom = match.c[2] - match.e[2] / 2;
    check(bBottom < GROUND + 0.02, 'that backing reaches the ground (bottom z=' + bBottom.toFixed(3) + ')');
  }
}

// Backing must read darker than the step on every RGB channel.
const ch = (v, shift) => (v >>> shift) & 0xff;
const darker = [16, 8, 0].every((sh) => ch(BACKING_COLOR, sh) < ch(STEP_COLOR, sh));
check(
  darker,
  'backing 0x' + BACKING_COLOR.toString(16) + ' is darker than step 0x' + STEP_COLOR.toString(16) + ' on every channel'
);

// ---- Collision width: step boxes must track the VISUAL step, not the full porch ----
// Deterministic low-bound R => w=5.0, porchW = w*0.8 = 4.0, stepW = porchW*0.45 = 1.8.
const w0 = 5.0;
const porchW0 = w0 * 0.8; // 4.0
const stepW0 = porchW0 * 0.45; // 1.8 (visual step width)
const visualStepHw = stepW0 / 2; // 0.9
check(
  Array.isArray(g.userData.stairs) && g.userData.stairs.length === 3,
  'exposes 3 step collision boxes (got ' + (g.userData.stairs ? g.userData.stairs.length : 0) + ')'
);
if (Array.isArray(g.userData.stairs)) {
  for (let i = 0; i < g.userData.stairs.length; i++) {
    const st = g.userData.stairs[i];
    check(
      Math.abs(st.hw - visualStepHw) <= 0.2,
      'step ' + i + ' collision half-width ' + st.hw.toFixed(3) + ' tracks the visual step ~' + visualStepHw.toFixed(2)
    );
    check(
      st.hw < porchW0 / 2,
      'step ' + i + ' collision half-width ' + st.hw.toFixed(3) + ' is NOT the full porch width ' + (porchW0 / 2).toFixed(2)
    );
  }
}

console.log(ok ? '\nFLATBUSH STOOP OK' : '\nFLATBUSH STOOP BROKEN');
process.exit(ok ? 0 : 1);
