// _goalpost_zfight_chk.js — verify the soccer BOOK-GOAL colored boxes do NOT
// z-fight (index.html). Each goal end is two stacks of 4 book boxes at y 1.9
// and 4.1. The old build gave every book in a stack the EXACT same y (sGy), so
// all 4 books' y-side faces sat on the same depth plane (and their x faces
// nearly so) -> the classic depth-buffer flicker on the colored boxes.
//
// FIX: each book gets a deterministic per-index x/y stagger (sStagger) so no
// two books in a stack share ANY face plane — same rule as the worker's belt
// fix (see _worker_zfight_chk.js).
//
// THIS CHECK: pulls the REAL sStagger table + book box extents straight out of
// index.html, rebuilds the 8 book boxes of a goal end headlessly, and verifies
// NO two boxes share a co-planar face that overlaps in the other two axes
// (the z-fighting condition). A negative control proves the OLD aligned stack
// would have been caught.
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- extract the REAL soccer spawn section (same window as _soccer_chk.js) ----
const spawnSrc = (function () {
  const i = src.indexOf('Flatbush soccer TEAMS: THREE small kids');
  if (i < 0) return '';
  let j = src.indexOf('if (isFlatbushLevel()) {', i);
  let k = src.indexOf('{', j),
    d = 0;
  for (; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') {
      d--;
      if (d === 0) break;
    }
  }
  return src.slice(i, k + 1);
})();
check('the soccer spawn section is found in index.html', spawnSrc.length > 0);
if (!spawnSrc.length) {
  console.log('\nGOAL POST Z-FIGHT CHECKS FAILED');
  process.exit(1);
}

// the per-book stagger table (the fix) — pulled verbatim from the source
const mStag = spawnSrc.match(/const sStagger = (\[[\s\S]*?\]);/);
check('per-book stagger table exists (the z-fight fix)', !!mStag);
if (!mStag) {
  console.log('\nGOAL POST Z-FIGHT CHECKS FAILED');
  process.exit(1);
}
const sStagger = JSON.parse(mStag[1].replace(/,\s*\]/, ']')); // strip the JS (not JSON) trailing comma
check(
  'the stagger table has one [dx, dy] entry per book (4)',
  Array.isArray(sStagger) && sStagger.length === 4 && sStagger.every((e) => Array.isArray(e) && e.length === 2),
  JSON.stringify(sStagger),
);

// book box extents — pulled verbatim from the source (the sBook mesh)
const mBook = spawnSrc.match(
  /const sBook = new THREE\.Mesh\(\s*new THREE\.BoxGeometry\(([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/,
);
check('the book box geometry is found in the source', !!mBook);
if (!mBook) {
  console.log('\nGOAL POST Z-FIGHT CHECKS FAILED');
  process.exit(1);
}
const bx = parseFloat(mBook[1]),
  by = parseFloat(mBook[2]),
  bz = parseFloat(mBook[3]);
check('a book is a flat box (0.55 x 0.16 x 0.4)', bx === 0.55 && by === 0.16 && bz === 0.4, bx + ' x ' + by + ' x ' + bz);

// stack math mirrors index.html: centers start at 0.3+0.08, step 0.16 x 4 books
const centers = [];
let sBz = 0.3;
for (let i = 0; i < 4; i++) {
  centers.push(sBz + 0.08);
  sBz += 0.16;
}

// rebuild the 8 books of ONE goal end (stacks at y 1.9 and 4.1) with the REAL stagger
const boxes = [];
for (const sGy of [1.9, 4.1]) {
  for (let i = 0; i < 4; i++) {
    boxes.push({ c: [sStagger[i][0], sGy + sStagger[i][1], centers[i]], e: [bx, by, bz] });
  }
}
check('rebuilt 8 book boxes (2 stacks x 4 books)', boxes.length === 8, boxes.length + ' boxes');

// ---- co-planar face test (same algorithm as _worker_zfight_chk.js) ----
const EPS = 1e-4;
const faceCoords = (b, a) => [b.c[a] - b.e[a] / 2, b.c[a] + b.e[a] / 2];
const overlaps = (A, B, k) => Math.abs(A.c[k] - B.c[k]) < (A.e[k] + B.e[k]) / 2 - EPS;
const findProblems = (list) => {
  const problems = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i],
        B = list[j];
      for (let a = 0; a < 3; a++) {
        const fa = faceCoords(A, a),
          fb = faceCoords(B, a);
        const coPlanar = fa.some((x) => fb.some((y) => Math.abs(x - y) < EPS));
        if (!coPlanar) continue;
        const others = [0, 1, 2].filter((k) => k !== a);
        if (others.every((k) => overlaps(A, B, k))) problems.push({ axis: a, A: A, B: B });
      }
    }
  }
  return problems;
};

const problems = findProblems(boxes);
if (problems.length) {
  ok = false;
  console.log('FAIL: ' + problems.length + ' co-planar face pair(s) = z-fighting flicker:');
  problems.forEach((pr) => {
    console.log('  axis ' + ['x', 'y', 'z'][pr.axis] + ': ' + JSON.stringify(pr.A) + '  <->  ' + JSON.stringify(pr.B));
  });
  console.log('  -> make the overlapping boxes slightly larger or smaller so no face is co-planar.');
} else {
  console.log('PASS zero co-planar faces on the 8 book boxes of a goal end (no z-fighting flicker)');
}

// negative control: the OLD aligned stack (no stagger, every book at sGy) MUST
// be caught by the same test — proves the test actually sees the bug
const oldBoxes = [];
for (const sGy of [1.9, 4.1]) {
  for (let i = 0; i < 4; i++) oldBoxes.push({ c: [0, sGy, centers[i]], e: [bx, by, bz] });
}
const oldProblems = findProblems(oldBoxes);
check('negative control: the OLD aligned stack (no stagger) IS caught by the test', oldProblems.length > 0, oldProblems.length + ' co-planar pair(s) detected');

console.log(ok ? '\nGOAL POST Z-FIGHT CHECKS PASSED' : '\nGOAL POST Z-FIGHT CHECKS FAILED');
process.exit(ok ? 0 : 1);