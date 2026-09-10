// _bec_glb_chk.mjs - verify the REAL makeBEC() GLB branch (not the procedural fallback).
// Loads the actual sweet_bread_roll_game_ready__2k_pbr.glb via the project's local
// GLTFLoader, populates BEC_TPL exactly like loadBecGltf(), then runs the makeBEC()
// function extracted VERBATIM from index.html and confirms:
//   - it builds a non-empty model
//   - the bagel sits FLAT on the sidewalk (base z ~ 0, top z ~ 0.35, hole up)
//   - it carries a GREEN halo ring WIDER than the bagel's footprint
//   - the bagel material is NOT metallic-black and NOT tinted green (bread texture kept)
// Read-only: does NOT modify any project files.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:,';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute(){}, style:{}, width:0, height:0, _listeners:{},
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    set src(v){ this._src = v;
      const fire = (type) => (this._listeners[type] || []).slice().forEach(f => f({ type }));
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src(){ return this._src; }
  };
  return el;
};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED to load local GLTFLoader'); process.exit(1); }

// ---- load the real bagel GLB and build BEC_TPL exactly like loadBecGltf() ----
const warns = [], errs = [];
const ow = console.warn, oe = console.error;
console.warn = (...a) => warns.push(a.join(' '));
console.error = (...a) => errs.push(a.join(' '));
const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync(path.join(DIR, 'sweet_bread_roll_game_ready__2k_pbr.glb'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try { gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej)); } catch (e) { threw = e; }
console.warn = ow; console.error = oe;
if (threw){ console.error('THREW loading bagel:', threw && threw.message); process.exit(1); }
if (!gltf){ console.error('GLTF parse returned null'); process.exit(1); }
const model = gltf.scene;
model.traverse(o => {
  if (!o.isMesh) return;
  o.castShadow = true;
  if (o.material){
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => { m.side = THREE.DoubleSide; });
  }
});
// (BEC_TPL is passed into makeBEC as an explicit param below, mirroring loadBecGltf())

// ---- extract the REAL makeHalo + makeBEC from index.html (brace-counted) ----
const src = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
// makeBEC's procedural fallback references these THREE primitive helpers - mirror them.
function M(c, opt){ return new THREE.MeshLambertMaterial(Object.assign({ color: c }, opt || {})); }
function BX(w, h, d, m){ const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; }
function CY(r1, r2, h, m, s){ const q = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s || 10), m); q.castShadow = true; return q; }
// Build makeHalo + makeBEC from their extracted source via new Function with explicit
// params (ESM modules don't let direct eval leak function declarations into scope).
const makeHalo = new Function('THREE', extractFn('makeHalo') + '; return makeHalo;')(THREE);
const BEC_SCALE = 0.35 / 3.1184;   // mirror the const from index.html
const makeBEC = new Function('THREE', 'BEC_TPL', 'BEC_SCALE', 'makeHalo', 'M', 'BX', 'CY',
  extractFn('makeBEC') + '; return makeBEC;')(THREE, { template: model }, BEC_SCALE, makeHalo, M, BX, CY);

// ---- assertions ----
let ok = true;
const check = (label, cond) => { console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

const g = makeBEC();
check('makeBEC() (GLB branch) builds a non-empty model', !!(g && Array.isArray(g.children) && g.children.length > 0));

// The group holds: [bagel model, halo]. The bagel is the non-halo child.
let halo = null, bagel = null;
g.traverse(o => { if (o.userData && o.userData.halo) halo = o; });
g.children.forEach(c => { if (!(c.userData && c.userData.halo)) bagel = c; });

// Geometry: measure the BAGEL's own world footprint (exclude the halo ring, which is a
// separate child and would otherwise dominate the group's bounding box).
const scene = new THREE.Scene();
g.position.set(0, 0, 0);
scene.add(g);
g.updateMatrixWorld(true);
const bagelBox = new THREE.Box3().setFromObject(bagel);
const sz = new THREE.Vector3(); bagelBox.getSize(sz);
console.log('  bagel world size:', sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3), '| base z', bagelBox.min.z.toFixed(4), '| top z', bagelBox.max.z.toFixed(4));
check('bagel sits FLAT on the sidewalk (base z ~ 0)', Math.abs(bagelBox.min.z) < 0.02);
check('bagel is a flat pancake, not tall (height z ~ 0.35, < 0.5)', bagelBox.max.z > 0.2 && bagelBox.max.z < 0.5);
check('bagel footprint is roundish (x ~ y, both > 0.8)', sz.x > 0.8 && sz.y > 0.8 && Math.abs(sz.x - sz.y) < 0.4);

// Halo: present, green, and WIDER than the BAGEL's footprint so it shows past the edge.
check('bagel carries a GREEN halo ring', !!(halo && halo.material.color.getHex() === 0x2bff72));
const footprintR = Math.max(sz.x, sz.y) / 2;
let haloOuterR = 0;
if (halo && halo.geometry){
  const pos = halo.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++){ const r = Math.hypot(pos.getX(i), pos.getY(i)); if (r > haloOuterR) haloOuterR = r; }
}
console.log('  bagel footprint radius', footprintR.toFixed(3), '| halo outer radius', haloOuterR.toFixed(3));
check('halo ring is WIDER than the bagel footprint (visible around it)', haloOuterR > footprintR + 0.1);

// Material: the bagel is NOT metallic-black and NOT tinted green (bread texture kept).
let hasMap = false, isGreenTint = false, isMetallic = false;
g.traverse(o => {
  if (!o.isMesh) return;
  if (o.userData && o.userData.halo) return;
  const ms = Array.isArray(o.material) ? o.material : [o.material];
  ms.forEach(m => {
    if (!m) return;
    if (m.map) hasMap = true;
    if (m.metalness !== undefined && m.metalness > 0.5) isMetallic = true;
    if (m.emissive && m.emissive.g > 0.5) isGreenTint = true;
  });
});
check('bagel material uses a base-color MAP (bread texture, not flat color)', hasMap);
check('bagel material is NOT metallic (would render black without an env map)', !isMetallic);
check('bagel material is NOT tinted green (halo only)', !isGreenTint);

console.log(ok ? '\nBEC GLB ALL CHECKS PASS' : '\nBEC GLB FAILURES');
process.exit(ok ? 0 : 1);