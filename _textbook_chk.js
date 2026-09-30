// _textbook_chk.js — verify the college textbooks (treasure kind 20) read as a
// stack of books tied with string. Regression: the page slabs used to stand UPRIGHT
// on each book's front edge (y=0.3, poking above the book above it) and the pencil
// floated at z=1.5 pointing straight up — detached from the stack. This check
// confirms pages lie flat inside their covers, the twine bands wrap the stack,
// and the pencil rests ON TOP of the stack (axis along x, nothing floating).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- three r128 (same cached copy as the other checks) ---
const T = path.join(__dirname, '_three128.js');
if (!fs.existsSync(T)){
  console.log('downloading three r128 build...');
  execSync('curl -L -o _three128.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', { cwd: __dirname, stdio: 'inherit' });
}
const THREE = require(T);
global.THREE = THREE;

// --- game-side helpers (copied verbatim from index.html) ---
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s){ const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s){ const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }

// --- extract makeTreasure verbatim from index.html ---
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  // brace-counted (indentation-proof)
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
eval(extract('makeTreasure'));

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

// mirror the constants makeTreasure(20) uses
const PAGE = 0xe9e4d3, TWINE = 0xc9b08a, PENCIL = 0xf1c40f, TIP = 0xd8a24a, ERASER = 0xe64980;
const STACK_TOP = 0.3; // 3 books of 0.1 from z=0

console.log('makeTreasure(20) — college textbooks:');
const books = makeTreasure(20);
books.updateMatrixWorld(true);

let meshes = 0;
const byColor = {};
books.traverse(ch => {
  if (!ch.isMesh) return;
  meshes++;
  const c = ch.material.color ? ch.material.color.getHex() : -1;
  (byColor[c] = byColor[c] || []).push(ch);
});

check('builds 12 meshes (3 covers + 3 pages + 2 twine bands + knot + pencil + tip + eraser): ' + meshes, meshes === 12);
check('3 page blocks: ' + (byColor[PAGE] ? byColor[PAGE].length : 0), (byColor[PAGE] || []).length === 3);
check('3 twine parts (2 bands + knot): ' + (byColor[TWINE] ? byColor[TWINE].length : 0), (byColor[TWINE] || []).length === 3);

// 1) pages lie FLAT (thin in z), sit at their book's height, and never poke above the stack
let pagesFlat = 0, pagesInStack = 0, pagesCount = 0;
for (const p of byColor[PAGE] || []) {
  pagesCount++;
  const bb = new THREE.Box3().setFromObject(p);
  const dz = bb.max.z - bb.min.z, dy = bb.max.y - bb.min.y;
  if (dz < 0.1 && dy > 0.3) pagesFlat++; // flat slab, not a slab standing on its edge
  if (bb.min.z >= -0.001 && bb.max.z <= STACK_TOP + 0.01) pagesInStack++; // no poke-through
}
check('every page block lies flat (z-thin), not standing on a book edge: ' + pagesFlat + '/3', pagesFlat === 3);
check('every page block stays inside the stack (no poking through the book above): ' + pagesInStack + '/3', pagesInStack === 3);

// 2) twine bands wrap the whole stack: z-span ~= full stack, thin in one horizontal axis
let bands = 0, knot = 0;
for (const t of byColor[TWINE] || []) {
  const bb = new THREE.Box3().setFromObject(t);
  const dz = bb.max.z - bb.min.z, dx = bb.max.x - bb.min.x, dy = bb.max.y - bb.min.y;
  if (t.geometry && t.geometry.type === 'SphereGeometry') {
    if (Math.abs(t.position.z - 0.33) < 0.01 && Math.abs(t.position.x) < 0.01 && Math.abs(t.position.y) < 0.01) knot++;
  } else if (dz > 0.29 && dz < 0.31 && (dx < 0.1 || dy < 0.1)) bands++;
}
check('2 twine bands wrap the full stack height: ' + bands, bands === 2);
check('1 knot on top-center of the stack: ' + knot, knot === 1);

// 3) pencil rests ON the stack: axis along x (long in x, round in y/z), near stack top
let pencilLying = 0, pencilNear = 0;
for (const pc of byColor[PENCIL] || []) {
  const bb = new THREE.Box3().setFromObject(pc);
  const dx = bb.max.x - bb.min.x, dy = bb.max.y - bb.min.y, dz = bb.max.z - bb.min.z;
  if (dx > 0.4 && dy < 0.1 && dz < 0.1) pencilLying++; // lying across, not standing up
  if (bb.min.z > STACK_TOP - 0.05 && bb.max.z < STACK_TOP + 0.2) pencilNear++; // on top, not floating
}
check('pencil lies flat across the stack (axis along x, not pointing up)', pencilLying === 1);
check('pencil rests on the stack top (not floating above it)', pencilNear === 1);

// tip + eraser attached to the pencil ends, at pencil height
let tipOk = false, eraserOk = false;
for (const tp of byColor[TIP] || []) {
  const bb = new THREE.Box3().setFromObject(tp);
  tipOk = Math.abs((bb.min.z + bb.max.z) / 2 - 0.35) < 0.05 && bb.max.x < 0.5;
}
for (const er of byColor[ERASER] || []) {
  const bb = new THREE.Box3().setFromObject(er);
  eraserOk = Math.abs((bb.min.z + bb.max.z) / 2 - 0.35) < 0.05 && bb.min.x > -0.5;
}
check('pencil tip attached at pencil height: ' + (tipOk ? 'yes' : 'no'), tipOk);
check('pencil eraser attached at pencil height: ' + (eraserOk ? 'yes' : 'no'), eraserOk);

// 4) whole model grounded + inside the pickup radius
{
  const bb = new THREE.Box3().setFromObject(books);
  let maxR = 0;
  books.traverse(ch => {
    if (!ch.isMesh) return;
    const b = new THREE.Box3().setFromObject(ch);
    maxR = Math.max(maxR, Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.y), Math.abs(b.max.y));
  });
  check('grounded (base at z >= 0): ' + bb.min.z.toFixed(3), bb.min.z >= -0.001);
  check('footprint inside pickup radius (1.8): ' + maxR.toFixed(3), maxR < 1.8);
}

console.log(ok ? 'TEXTBOOK STACK ALL CHECKS PASS' : 'TEXTBOOK STACK FAILURES');
process.exit(ok ? 0 : 1);