// _rubik_chk.js — verify the Rubik's cube (treasure kind 12) renders its top face.
// Regression: the cube mesh is lifted by size/2 so its base rests on the ground and its
// top sits at z=size, but the stickers were positioned relative to the origin. That buried
// the +z (top) stickers inside the black plastic (at z=size/2) and centered the side 3x3
// grids on z=0 instead of z=size/2, so the top looked all black. This check confirms every
// face's 3x3 grid is centered on its face and the top-face stickers sit ON the top surface.
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
const SKIN_TONES = [0xf3c6a5, 0xe8b48c, 0xd9a06b, 0xc68642, 0x9c6b3c, 0x8d5524, 0x6f4522, 0x5a3a1e];
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s){ const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s){ const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }

// --- extract makeTreasure verbatim from index.html ---
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;   // exactly column 0, CRLF-safe
  return lines.slice(start, end + 1).join('\n');
}
eval(extract('makeTreasure'));

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

// mirror the constants makeTreasure(12) uses so we can reason about the layout
const size = 0.52, st = size / 3, th = 0.02;
const BLACK = 0x141418;
const PAL = [0xc0392b, 0xf1c40f, 0x27ae60, 0x2980b9, 0xf1f1f1, 0xe67e22];
const isSticker = c => PAL.indexOf(c) >= 0;

console.log("makeTreasure(12) \u2014 Rubik's cube:");
const cube = makeTreasure(12);
cube.updateMatrixWorld(true);

let black = 0, stickers = 0, meshes = 0;
const faceCount = { x: 0, y: 0, z: 0 };
let buried = 0, topFace = 0, topAbove = 0;
let xzMin = 1e9, xzMax = -1e9;   // z-range of the +x/-x face grids (should center on size/2)
cube.traverse(ch => {
  if (!ch.isMesh) return;
  meshes++;
  const c = ch.material.color ? ch.material.color.getHex() : -1;
  if (c === BLACK){ black++; return; }
  if (!isSticker(c)) return;
  stickers++;
  const bb = new THREE.Box3().setFromObject(ch);
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
  const thinX = Math.abs(w - th) < 1e-3, thinY = Math.abs(h - th) < 1e-3, thinZ = Math.abs(d - th) < 1e-3;
  const p = ch.position;
  if (thinX) faceCount.x++;
  else if (thinY) faceCount.y++;
  else if (thinZ) faceCount.z++;
  // a sticker is "buried" if its center sits strictly inside the black cube volume
  // (x,y in [-size/2, size/2], z in [0, size]) \u2014 the pre-fix top-face failure.
  if (Math.abs(p.x) < size / 2 && Math.abs(p.y) < size / 2 && p.z > 0 && p.z < size) buried++;
  // top-face stickers: thin in z and above the cube center
  if (thinZ && p.z > size / 2){
    topFace++;
    if (p.z > size) topAbove++;
  }
  if (thinX){ xzMin = Math.min(xzMin, p.z); xzMax = Math.max(xzMax, p.z); }
});

check('builds 46 meshes (1 black + 45 stickers): ' + meshes, meshes === 46);
check('exactly 1 black plastic cube: ' + black, black === 1);
check('exactly 45 colored stickers: ' + stickers, stickers === 45);
check('x faces (2) carry 18 stickers: ' + faceCount.x, faceCount.x === 18);
check('y faces (2) carry 18 stickers: ' + faceCount.y, faceCount.y === 18);
check('z faces (1, top only) carry 9 stickers: ' + faceCount.z, faceCount.z === 9);
check('NO sticker buried inside the black cube: ' + buried, buried === 0);
check('top face has 9 stickers: ' + topFace, topFace === 9);
check('top-face stickers sit ON the top surface (z > ' + size + '): ' + topAbove + '/9', topAbove === 9);
check('x-face 3x3 grid centered on the face (z in [' + (size/2 - st).toFixed(3) + ', ' + (size/2 + st).toFixed(3) + ']): ' +
  xzMin.toFixed(3) + '..' + xzMax.toFixed(3), xzMin > 0 && xzMax < size);

console.log(ok ? 'RUBIK CUBE ALL CHECKS PASS' : 'RUBIK CUBE FAILURES');
process.exit(ok ? 0 : 1);
