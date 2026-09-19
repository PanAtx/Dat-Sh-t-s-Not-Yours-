'use strict';
/* _scholar_zfight_chk.js
 * Regression check for the Flatbush scholar's chest/near-head flicker.
 *
 * ROOT CAUSE: three box faces were EXACTLY co-planar, so two surfaces fought
 * for the depth buffer right at his collar / under his beard:
 *   1. beard front face (x 0.20)  = shirt front face (x 0.20)
 *   2. beard top face   (z 1.68)  = coat top face    (z 1.68)
 *   3. head top face    (z 1.93)  = hat brim bottom  (z 1.93)
 *
 * FIX: the beard box is nudged out/up (0.15, -0.02, 0.005 -> faces x
 * 0.07..0.23, z 1.505..1.705) and the hat brim is raised (z 0.38 -> faces
 * 1.95..2.01), so every face now sits a clear offset from its neighbor - the
 * same "no co-planar faces" rule as the worker's belt fix.
 *
 * THIS CHECK: rebuilds the scholar (headless stubs, full model including the
 * head/arm/leg pivot groups, resolved to world coords), and verifies NO two
 * boxes share a co-planar face that overlaps in the other two axes (the
 * z-fighting condition). It FAILS on the old beard/brim numbers.
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
const makeScholarSrc = grabFn(src, 'makeScholar');

// ---- Headless stubs (same style as _worker_zfight_chk.js) ----
const M = color => ({ color });
function BX(x, y, z, mat){
  return {
    _ext: [x, y, z], _mat: mat,
    position: { x: 0, y: 0, z: 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; } },
    add(child){ child._parent = this; },
  };
}
class Group {
  constructor(){ this.position = { x: 0, y: 0, z: 0, set(a, b, c){ this.x = a; this.y = b; this.z = c; } }; this.children = []; this.userData = {}; }
  add(c){ this.children.push(c); }
}
const THREE = { Group };

const factory = new Function('THREE', 'M', 'BX', makeScholarSrc + '\nreturn makeScholar();');
const g = factory(THREE, M, BX);

// Resolve every box in the model (including boxes inside the head/arm/leg
// pivot groups) to WORLD center + extent by accumulating parent offsets.
const boxes = [];
(function collect(node, off){
  for (const ch of node.children || []) {
    const o = [off[0] + ch.position.x, off[1] + ch.position.y, off[2] + ch.position.z];
    if (ch._ext) boxes.push({ e: ch._ext.slice(), c: o });
    else if (ch.children) collect(ch, o);
  }
})(g, [0, 0, 0]);
if (boxes.length < 10) throw new Error('expected the full scholar model, got ' + boxes.length + ' boxes');

// Two faces are co-planar when they sit at the exact same coordinate on one
// axis while the two boxes still overlap along the other two axes.
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
      if (others.every(k => overlaps(A, B, k))) problems.push({ axis: a, A, B });
    }
  }
}

if (problems.length) {
  console.log('FAIL: ' + problems.length + ' co-planar face pair(s) = z-fighting flicker on the scholar:');
  problems.forEach(pr => {
    console.log('  axis ' + ['x', 'y', 'z'][pr.axis] + ': ' + JSON.stringify(pr.A) + '  <->  ' + JSON.stringify(pr.B));
  });
  console.log('  -> nudge one box so no face is exactly co-planar with its neighbor.');
  process.exit(1);
}
console.log('OK: ' + boxes.length + ' scholar boxes (full model), zero co-planar faces -> no z-fighting on his chest or hat.');