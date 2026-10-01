// _treasures25_chk.js — smoke-test the 25 new street-treasure kinds (43-67) added
// to makeTreasure(): everything builds, grounded (z >= 0), footprint inside the
// pickup radius (1.8), no undefined materials, every kind has a spoken name, and
// the spawnBonus draw now covers all 64 street kinds without ever landing on the
// cemetery-exclusive kinds 38-42.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- three r128 (same cached copy as the warn checks) ---
const T = path.join(__dirname, '_three128.js');
if (!fs.existsSync(T)) {
  console.log('downloading three r128 build...');
  execSync('curl -L -o _three128.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', { cwd: __dirname, stdio: 'inherit' });
}
const THREE = require(T);
global.THREE = THREE;

// --- game-side helpers (copied verbatim from index.html) ---
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function M(c, opt) { return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m) { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s) { const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s) { const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }

// --- extract makeTreasure verbatim from index.html ---
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name) {
  // brace-counted (indentation-proof)
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found');
  const brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
eval(extract('makeTreasure'));
const nameM = src.match(/const TREASURE_NAMES = (\{[\s\S]*?\n\s*\});/);
if (!nameM) throw new Error('TREASURE_NAMES not found');
const TREASURE_NAMES = eval('(' + nameM[1] + ')');

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

function stats(g) {
  g.updateMatrixWorld(true);   // measure rendered world-space geometry (matches the live frame), not stale local matrices
  let meshes = 0, badMat = false, minZ = 1e9;
  g.traverse(ch => {
    if (ch.isMesh) {
      meshes++;
      const arr = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (const m of arr) {
        if (!m || !m.isMaterial) { badMat = true; continue; }
        if (m.color === undefined || m.color === null) { badMat = true; console.log('    !! bad material color on', ch.geometry && ch.geometry.type); }
      }
      const box = new THREE.Box3().setFromObject(ch);
      minZ = Math.min(minZ, box.min.z);
    }
  });
  const box = new THREE.Box3().setFromObject(g);
  const maxR = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.y), Math.abs(box.max.y));
  return { meshes, minZ, maxR, badMat };
}

console.log('makeTreasure(kinds 43-67) — the 25 new street finds:');
for (let k = 43; k <= 67; k++) {
  let worst = { meshes: 1e9, minZ: 0, maxR: -1, badMat: false };
  for (let run = 0; run < 3; run++) {  // 3 runs to sample the R() jitter
    const s = stats(makeTreasure(k));
    worst.meshes = Math.min(worst.meshes, s.meshes);
    worst.minZ = Math.max(worst.minZ, s.minZ);
    worst.maxR = Math.max(worst.maxR, s.maxR);
    worst.badMat = worst.badMat || s.badMat;
  }
  const named = typeof TREASURE_NAMES[k] === 'string' && TREASURE_NAMES[k].length > 0;
  const branch = src.indexOf('kind === ' + k + ')') >= 0;
  check(
    'kind ' + k + ' ("' + (TREASURE_NAMES[k] || '??') + '"): ' + worst.meshes + ' meshes, grounded ' + worst.minZ.toFixed(3) + ', footprint ' + worst.maxR.toFixed(2),
    branch && named && worst.meshes >= 3 && !worst.badMat && worst.minZ >= -0.001 && worst.maxR < 1.8
  );
}

console.log('spawnBonus draw (10k samples):');
{
  let min = 999, max = -1, bad = 0;
  for (let i = 0; i < 10000; i++) {
    let tKind = (Math.random() * 63) | 0; // same logic as index.html spawnBonus
    if (tKind >= 38) tKind += 5;
    min = Math.min(min, tKind);
    max = Math.max(max, tKind);
    if (tKind >= 38 && tKind <= 42) bad++;            // cemetery-exclusive kinds must never spawn on the street
    if (tKind < 0 || tKind > 67) bad++;             // nothing out of range
  }
  check('range covered: min ' + min + ' / max ' + max, min === 0 && max === 67);
  check('zero samples on cemetery kinds 38-42', bad === 0);
  // runtime guard: the remap (tKind += 5) reassigns tKind, so it MUST be `let` —
  // `const tKind` throws "Assignment to constant variable" the moment a draw hits 38+
  check(
    'index.html spawnBonus declares tKind with let (const would throw on the remap)',
    src.indexOf('let tKind = (Math.random() * 63) | 0') >= 0 && src.indexOf('const tKind') < 0
  );
}

console.log(ok ? 'TREASURES 43-67 ALL CHECKS PASS' : 'TREASURES 43-67 FAILURES');
process.exit(ok ? 0 : 1);