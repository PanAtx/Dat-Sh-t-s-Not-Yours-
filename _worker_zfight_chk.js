'use strict';
/* _worker_zfight_chk.js
 * Regression check for the sanitation worker's hi-vis shirt flicker.
 *
 * ROOT CAUSE: the dark belt was sized BX(0.3, 0.5, 0.1) — the SAME x-extent
 * (±0.15) as the hi-vis vest BX(0.3, 0.56, 0.68) — so their front/back faces were
 * perfectly co-planar across the belt's band (z 0.77–0.87). Two surfaces on the
 * exact same depth plane fight for the depth buffer = the flicker you saw at the
 * bottom of the shirt while he walks.
 *
 * FIX: the belt is now BX(0.32, 0.6, 0.1) so every face sits just OUTSIDE the vest
 * (±0.16 / ±0.30) — no co-planar faces, and it reads as a proper dark waistband.
 *
 * THIS CHECK: rebuilds the worker (headless stubs), collects every direct-child box,
 * and verifies NO two boxes share a co-planar face that overlaps in the other two
 * axes (the z-fighting condition). It passes on the fixed belt and would FAIL on the
 * old one.
 */
const fs = require('fs');
const path = require('path');

function grab(src, start){
  const i = src.indexOf(start); if (i < 0) throw new Error('not found: ' + start);
  let d = 0, j = i;
  for (; j < src.length; j++){
    const ch = src[j];
    if (ch === '{') d++;
    else if (ch === '}'){ d--; if (d === 0) break; }
  }
  return src.slice(i, j + 1);
}
function grabFn(src, name){ return grab(src, 'function ' + name + '('); }

let src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const buildWorkerSrc = grabFn(src, 'buildWorker');

// ---- Headless stubs for the worker's dependencies ----
const SKIN_TONES = [0xffe0bd];
const pick = a => a[0];
const M = color => ({ color });

// BX(x, y, z, mat): records the box extents + its own (local) position.
function BX(x, y, z, mat){
  return {
    _ext: [x, y, z], _mat: mat,
    position: { x: 0, y: 0, z: 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; } },
    add(child){ child._parent = this; },
  };
}
// THREE.Group: container that records direct children.
class Group {
  constructor(){ this.position = { x: 0, y: 0, z: 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; } }; this.children = []; }
  add(c){ this.children.push(c); }
}
const THREE = { Group };
const GZ = 0.05;

const factory = new Function('THREE', 'M', 'pick', 'SKIN_TONES', 'BX', 'GZ', buildWorkerSrc + '\nreturn buildWorker();');
const worker = factory(THREE, M, pick, SKIN_TONES, BX, GZ);
const g = worker.group;

// Direct-child boxes only (legs/arms/gloves live inside pivot groups and sit
// clearly below/above the torso, so the torso boxes are the flicker-relevant set).
const boxes = g.children.filter(c => c && c._ext).map(b => ({
  e: b._ext.slice(),
  c: [b.position.x, b.position.y, b.position.z],
}));
if (boxes.length < 4) throw new Error('expected several torso boxes, got ' + boxes.length);

// Two faces are co-planar when they sit at the exact same coordinate on one axis
// while the two boxes still overlap along the other two axes -> z-fighting.
const EPS = 1e-4;
const faceCoords = (b, axis) => [b.c[axis] - b.e[axis] / 2, b.c[axis] + b.e[axis] / 2];
const overlaps = (a, b, axis) => {
  const a0 = a.c[axis] - a.e[axis] / 2, a1 = a.c[axis] + a.e[axis] / 2;
  const b0 = b.c[axis] - b.e[axis] / 2, b1 = b.c[axis] + b.e[axis] / 2;
  return Math.max(a0, b0) < Math.min(a1, b1);
};
const problems = [];
for (let i = 0; i < boxes.length; i++) {
  for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    for (let a = 0; a < 3; a++) {
      const fa = faceCoords(A, a), fb = faceCoords(B, a);
      const coPlanar = fa.some(x => fb.some(y => Math.abs(x - y) < EPS));
      if (!coPlanar) continue;
      const others = [0, 1, 2].filter(k => k !== a);
      if (others.every(k => overlaps(A, B, k))) {
        problems.push({ axis: a, A, B });
      }
    }
  }
}

if (problems.length) {
  console.log('FAIL: ' + problems.length + ' co-planar face pair(s) = z-fighting flicker:');
  problems.forEach(pr => {
    console.log('  axis ' + ['x', 'y', 'z'][pr.axis] + ': ' + JSON.stringify(pr.A) + '  <->  ' + JSON.stringify(pr.B));
  });
  console.log('  -> make the overlapping box slightly larger or smaller so no face is co-planar.');
  process.exit(1);
}
console.log('OK: ' + boxes.length + ' torso boxes, zero co-planar faces -> no z-fighting flicker on the hi-vis worker.');
