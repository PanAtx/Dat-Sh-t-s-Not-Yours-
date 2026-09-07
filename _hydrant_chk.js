// _hydrant_chk.js — verify the reworked NYC fire hydrant (black base, steel dome,
// hex top valve) builds without throwing and actually uses the new material scheme.
const fs = require('fs');
const path = require('path');
global.THREE = require(path.join(__dirname, '_three128.js'));

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function extract(name){
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error(name + ' not found');
  let end = start;
  while (end < lines.length && lines[end].replace(/\r$/, '') !== '}') end++;
  return lines.slice(start, end + 1).join('\n');
}

function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function MS(c, opt){ return new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.95, roughness: 0.28 }, opt || {})); }
function BX(w, h, d, m){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function CY(r1, r2, h, m, s){ return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); }
function SP(r, m, s){ return new THREE.Mesh(new THREE.SphereGeometry(r, s || 8, s || 6), m); }
function SPH(r, m, ws, hs){ return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 14, hs || 10), m); }
const GZ = 0.3;

eval(extract('addHydrant'));

let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

const added = [];
const b = { worldX: 10, group: { add(x){ added.push(x); } }, hazards: [] };
let threw = null, built = null;
try { addHydrant(b, 12, 3); } catch (e){ threw = e; }
built = added[0] || null;

check('addHydrant builds a Group without throwing' + (threw ? '  [' + threw.message + ']' : ''), !threw && built && Array.isArray(built.children));
check('hydrant registers a hazard on the block', b.hazards.length === 1 && b.hazards[0].type === 'hit');
check('hydrant rests ON the curb (GZ+0.05) and offset by worldX', built && Math.abs(built.position.z - (GZ + 0.05)) < 1e-6 && Math.abs(built.position.x - (12 - 10)) < 1e-6);

// collect the distinct materials used across the whole model
const mats = new Set();
built && built.traverse(ch => { if (ch.material) mats.add(ch.material); });
const has = (kind, hex) => [...mats].some(m => m.type === kind && m.color && m.color.getHex() === hex);

check('has a BLACK cast-iron body/base (Lambert 0x1d2125)', has('MeshLambertMaterial', 0x1d2125));
check('has RAISED iron collars/fluting (Lambert 0x34393f)', has('MeshLambertMaterial', 0x34393f));
check('has a DULL weathered dome (Lambert 0x9ba0a6)', has('MeshLambertMaterial', 0x9ba0a6));
check('has WEATHERED caps/stem (Lambert 0x7e848a)', has('MeshLambertMaterial', 0x7e848a));
check('the old red hydrant color (0xb5322a) is gone', !has('MeshLambertMaterial', 0xb5322a));
let fullSphere = false;
built && built.traverse(ch => { const p = ch.geometry && ch.geometry.parameters; if (p && p.radius !== undefined && (p.thetaLength || Math.PI) >= Math.PI - 1e-6) fullSphere = true; });
check('no full-sphere "bowling ball" left (every sphere is a partial hemisphere)', !fullSphere);

// count hex (6-segment) parts => the top valve + two center bolts should all be hex
let hexCount = 0;
built && built.traverse(ch => {
  if (ch.geometry && ch.geometry.parameters && ch.geometry.parameters.radialSegments === 6) hexCount++;
});
check('hex parts present (valve stem + nut + 2 bolts = 4): got ' + hexCount, hexCount >= 4);

console.log(ok ? 'HYDRANT ALL CHECKS PASS' : 'HYDRANT FAILURES');
process.exit(ok ? 0 : 1);