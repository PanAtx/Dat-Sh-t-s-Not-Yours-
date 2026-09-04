// _bonus_chk.js — smoke-test the rebuilt makeCash() and makeTreasure(2) (oil painting)
// under the exact three r128 the browser loads: no undefined materials, everything
// grounded (z >= 0), footprint inside the pickup radius (1.8), flowers inside canvas.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- three r128 (same cached copy as the warn checks) ---
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

// --- extract makeCash / makeTreasure verbatim from index.html ---
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;   // exactly column 0, CRLF-safe
  return lines.slice(start, end + 1).join('\n');
}
eval(extract('makeCash'));
eval(extract('makeTreasure'));

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

function stats(g){
  let meshes = 0, mats = new Set(), minZ = 1e9, maxR = 0, badMat = false;
  g.traverse(ch => {
    if (ch.isMesh){
      meshes++;
      const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (const m of arr){
        if (!m || !m.isMaterial){ badMat = true; continue; }
        mats.add(m.uuid);
        if (m.color === undefined || m.color === null){ badMat = true; console.log('    !! bad material color on', ch.geometry && ch.geometry.type); }
      }
      const box = new THREE.Box3().setFromObject(ch);
      minZ = Math.min(minZ, box.min.z);
    }
  });
  const box = new THREE.Box3().setFromObject(g);
  maxR = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.y), Math.abs(box.max.y));
  return { meshes, mats: mats.size, minZ, maxR, badMat };
}

console.log('makeCash():');
const cash = makeCash();
{
  const s = stats(cash);
  check('builds without errors, ' + s.meshes + ' meshes / ' + s.mats + ' materials', s.meshes >= 24);
  check('no undefined/bad materials', !s.badMat);
  check('grounded (minZ >= -0.001): ' + s.minZ.toFixed(3), s.minZ >= -0.001);
  check('footprint ' + s.maxR.toFixed(2) + ' inside pickup radius 1.8', s.maxR < 1.8);
  let paper = 0, greenBorder = 0, circles = 0;
  cash.traverse(ch => {
    if (!ch.isMesh) return;
    const c = ch.material.color ? ch.material.color.getHex() : -1;
    if (c === 0xe6e2c8) paper++;
    if (c === 0x3f6b45) greenBorder++;
    if (ch.geometry.type === 'CircleGeometry') circles++;
  });
  check('cream paper base x2', paper === 2);
  check('green border bars x8', greenBorder === 8);
  check('portrait oval + seal (2 circles per bill, x2)', circles === 4);
}

console.log('makeTreasure(2) — oil painting:');
const paint = makeTreasure(2);
{
  const s = stats(paint);
  check('builds without errors, ' + s.meshes + ' meshes', s.meshes >= 40);
  check('no undefined/bad materials', !s.badMat);
  check('grounded (minZ >= -0.001): ' + s.minZ.toFixed(3), s.minZ >= -0.001);
  check('footprint ' + s.maxR.toFixed(2) + ' inside pickup radius 1.8', s.maxR < 1.8);
  let gold = 0, canvas = 0, petals = 0, stems = 0;
  paint.traverse(ch => {
    if (!ch.isMesh) return;
    const c = ch.material.color ? ch.material.color.getHex() : -1;
    if (ch.material.metalness > 0.9 && c === 0xc9a227) gold++;
    if (c === 0xefe6cf) canvas++;
    if (ch.geometry.type === 'CircleGeometry') petals++;
    if (c === 0x4f7a3a && ch.geometry.type === 'BoxGeometry') stems++;
  });
  check('gold frame bars x4', gold === 4);
  check('cream canvas x1', canvas === 1);
  check('flower circles (6 flowers x 6 + 3 leaves): ' + petals, petals === 39);
  check('stems x6', stems === 6);
}

console.log('makeTreasure(other kinds still build):');
for (let k = 0; k < 5; k++){
  const t = makeTreasure(k);
  const s = stats(t);
  check('kind ' + k + ': ' + s.meshes + ' meshes, grounded, no bad mats', !s.badMat && s.minZ >= -0.001 && s.maxR < 1.8);
}

console.log(ok ? 'BONUS REBUILD ALL CHECKS PASS' : 'BONUS REBUILD FAILURES');
process.exit(ok ? 0 : 1);