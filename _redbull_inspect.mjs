// Probe red_bull_energy_drink_can.glb via the project's local GLTFLoader (three r128):
// report native bounding box, material/texture details, base offset, and clone behavior.
// Read-only: does NOT modify any project files.
import fs from 'fs';
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:,';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => {
  const el = {
    setAttribute(){}, style:{}, width:0, height:0,
    _listeners:{},
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener(){},
    set src(v){ this._src = v; // simulate the browser decoding the (data-uri) image and firing load
      const fire = (type) => (this._listeners[type] || []).slice().forEach(f => f({ type }));
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src(){ return this._src; }
  };
  return el;
};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
(0, eval)(fs.readFileSync('GLTFLoader.js','utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED to load local GLTFLoader'); process.exit(1); }
const warns=[], errs=[];
const ow=console.warn, oe=console.error;
console.warn=(...a)=>warns.push(a.join(' '));
console.error=(...a)=>errs.push(a.join(' '));
const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync('red_bull_energy_drink_can.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try {
  gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
} catch (e) { threw = e; }
console.warn = ow; console.error = oe;
if (threw){ console.error('THREW:', threw && threw.message); process.exit(1); }
console.log('parsed', !!gltf, 'warns', warns.length, 'errs', errs.length);
warns.slice(0,10).forEach(w => console.log('  W:', w));
errs.slice(0,10).forEach(e => console.log('  E:', e));
if (!gltf){ process.exit(2); }
const g = gltf.scene;
g.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(g);
const sz = new THREE.Vector3();
box.getSize(sz);
console.log('SIZE   :', sz.x.toFixed(4), sz.y.toFixed(4), sz.z.toFixed(4));
console.log('MIN    :', box.min.x.toFixed(4), box.min.y.toFixed(4), box.min.z.toFixed(4));
console.log('MAX    :', box.max.x.toFixed(4), box.max.y.toFixed(4), box.max.z.toFixed(4));
console.log('base Z offset (native min.z, to zero the base):', box.min.z.toFixed(4));
const mats = new Map();
g.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && !m.uuid) return; if (m && !mats.has(m.uuid)) mats.set(m.uuid, m); }); });
console.log('materials:', mats.size);
for (const m of mats.values()){
  console.log('  name       :', m.name || '(anon)');
  console.log('  type       :', m.type);
  console.log('  color      :', m.color ? m.color.getHexString() : 'n/a');
  console.log('  metalness  :', m.metalness);
  console.log('  roughness  :', m.roughness);
  console.log('  side       :', m.side, '(0=Front,1=Back,2=Double)');
  console.log('  transparent:', m.transparent);
  console.log('  opacity    :', m.opacity);
  console.log('  alphaMode  :', m.alphaMode);
  console.log('  alphaTest  :', m.alphaTest);
  console.log('  map        :', !!m.map, m.map && m.map.image ? ('img ' + (m.map.image.width||'?')+'x'+(m.map.image.height||'?')) : '(no img)');
  console.log('  normalMap  :', !!m.normalMap);
  console.log('  metalnessMap:', !!m.metalnessMap);
  console.log('  roughnessMap:', !!m.roughnessMap);
  console.log('  emissive   :', m.emissive ? m.emissive.getHexString() : 'n/a');
  console.log('  emissiveMap:', !!m.emissiveMap);
  console.log('  vertexColors:', m.vertexColors);
}
let meshCount = 0;
g.traverse(o => { if (o.isMesh) meshCount++; });
console.log('meshes:', meshCount);
console.log('top-level scene children:', g.children.map(c => c.name || c.type));
g.children.forEach(c => console.log('  child', c.name || c.type, 'visible:', c.visible));
// ---- Clone pipeline: determine the native "up" axis from the tall dimension ----
// If the can is tall along +Y (Y-up export): rotation.x = +PI/2 (native +Y -> game +Z).
// If tall along +Z (Z-up export): no rotation needed.
const tallAxis = sz.y >= sz.x && sz.y >= sz.z ? 'y' : (sz.z >= sz.x ? 'z' : 'x');
console.log('tall axis:', tallAxis);
const TALL = (tallAxis === 'y' ? sz.y : tallAxis === 'z' ? sz.z : sz.x);
const RB_SCALE = 0.66 / TALL;   // target ~0.66 world units tall
const baseZ = (tallAxis === 'y' ? box.min.y : tallAxis === 'z' ? box.min.z : box.min.x);
console.log('native base offset along tall axis:', baseZ.toFixed(4));
const g2 = new THREE.Group();
for (let i = 0; i < 4; i++){
  const c = g.clone(true);
  if (tallAxis === 'y') c.rotation.x = Math.PI / 2;      // Y-up -> Z-up
  c.scale.setScalar(RB_SCALE);
  if (tallAxis === 'y') c.position.set(0, 0, -baseZ * RB_SCALE); // zero the base at local z=0
  g2.add(c);
}
g2.updateMatrixWorld(true);
const cbox = new THREE.Box3().setFromObject(g2.children[0]);
const csz = new THREE.Vector3();
cbox.getSize(csz);
console.log('cloned can world size (native ' + TALL.toFixed(2) + ' tall -> target 0.66):', csz.x.toFixed(3), csz.y.toFixed(3), csz.z.toFixed(3));
console.log('cloned can base z (should be ~0):', cbox.min.z.toFixed(4), '| top z (should be ~0.66):', cbox.max.z.toFixed(4));
const upright = Math.abs(cbox.min.z) < 0.001 && Math.abs(cbox.max.z - 0.66) < 0.005;
console.log('RESULT: ' + (meshCount > 0 && upright ? 'PASS' : 'FAIL'));
process.exit(meshCount > 0 && upright ? 0 : 2);