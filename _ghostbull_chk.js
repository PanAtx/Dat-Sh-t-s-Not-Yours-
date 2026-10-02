// _ghostbull_chk.js — verify the OVERTIME REWARD's GHOSTLY RED BULL: a translucent arm+hand
// holds the can aloft with a spectral aura, uses a spectral (NOT healer-green) ground halo,
// and is a pickup ONLY (never a health hazard). The Thursday cemetery spawn passes {ghostly:true}.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const T = path.join(__dirname, '_three128.js');
if (!fs.existsSync(T)) {
  execSync('curl -L -o _three128.js https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', { cwd: __dirname, stdio: 'inherit' });
}
global.THREE = require(T);
const THREE = global.THREE;

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name) {
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

// game-side helpers (copied from index.html)
const R = (a, b) => a + Math.random() * (b - a);
function M(c, opt) { return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function CY(r1, r2, h, m, s) { const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
function SP(r, m, s) { const q = new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); q.castShadow = true; return q; }
// makeHalo + makeMonster + makeGhostBull (verbatim)
let MONSTER_TPL = null; // GLB not loaded in this harness -> makeMonster uses the procedural can
const MONSTER_SCALE = 0.8 / 0.1721;
eval(extract('makeHalo'));
eval(extract('makeMonster'));
eval(extract('makeGhostBull'));

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

let g;
try { g = makeGhostBull(); } catch (e) { g = null; console.error('  threw: ' + e.message); }
check('makeGhostBull builds without throwing', !!g);
if (g) {
  // every mesh has a valid material color
  let badMat = 0;
  g.traverse((o) => { if (o.isMesh && o.material && o.material.color === undefined) badMat++; });
  check('no mesh has an undefined material color', badMat === 0);

  // a can is present and HELD UP (some part well above z=1)
  let maxZ = 0;
  g.traverse((o) => { if (o.isMesh && o.position) maxZ = Math.max(maxZ, o.position.z); });
  check('the can is held aloft (tallest part z=' + maxZ.toFixed(2) + ' > 1.3)', maxZ > 1.3);

  // the ghostly arm exists (a translucent, emissive cylinder/sphere)
  let ghostParts = 0;
  g.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0.5) ghostParts++; });
  check('ghostly translucent arm+hand parts present (' + ghostParts + ')', ghostParts >= 2);

  // a ghostly AURA (additive) is present
  let auras = 0;
  g.traverse((o) => { if (o.isMesh && o.material && o.material.blending === THREE.AdditiveBlending) auras++; });
  check('ghostly aura around the can present (' + auras + ')', auras >= 2);

  // a ground halo (userData.halo) present, and it is NOT the healer green (0x2bff72 was stripped)
  let halo = null, haloHex = null;
  g.traverse((o) => { if (o.userData && o.userData.halo) { halo = o; haloHex = o.material.color.getHex(); } });
  check('carries a ground halo ring (spectral, not the healer green 0x2bff72)', !!halo && haloHex !== 0x2bff72);
  check('ground halo is the spectral color 0x7dffb0', haloHex === 0x7dffb0);

  // animated parts are tagged
  check('animated parts tagged (ghostCan + 2 auras)', !!(g.userData.ghostCan && g.userData.ghostAura1 && g.userData.ghostAura2));
}

// spawnPowerup routes {ghostly:true} -> makeGhostBull, and tags the record ghostly (static source check)
const spSrc = extract('spawnPowerup');
check('spawnPowerup builds makeGhostBull when opts.ghostly', spSrc.indexOf('makeGhostBull()') >= 0 && spSrc.indexOf('opts && opts.ghostly') >= 0);
check('spawnPowerup tags the powerup record with ghostly', spSrc.indexOf('ghostly: ghostly') >= 0);
check('spawnPowerup keeps the non-ghost monster path (makeMonster)', spSrc.indexOf('makeMonster()') >= 0);

// the Thursday cemetery spawn actually passes the ghostly flag
const spawnLine = /spawnPowerup\("monster", rbWx, 2\.0, \{ ghostly: true \}\)/.test(src);
check('Thursday cemetery Red Bull spawns with {ghostly:true}', spawnLine);

console.log('\n' + (ok ? 'GHOST BULL ALL CHECKS PASS' : 'GHOST BULL SOME CHECKS FAILED'));
if (!ok) process.exitCode = 1;
