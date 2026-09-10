// Probe monster_energy_drink.glb via the project's local GLTFLoader (three r128):
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
const buf = fs.readFileSync('monster_energy_drink.glb');
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
// ---- Clone pipeline (a few instances like a few Monster powerups on screen) ----
// Scene space is Y-UP (can stands along +Y, base at Y=0.01). The game is Z-UP,
// so rotate the model so native +Y(up) -> game +Z(up): rotation.x = +PI/2.
const MONSTER_SCALE = 0.66 / 3.9;   // target ~0.66 world units tall (can height ~3.90 native)
// After rotation.x=+PI/2 the base sits at z~=0.01; zero it out.
const g2 = new THREE.Group();
for (let i = 0; i < 4; i++){
  const c = g.clone(true);
  c.rotation.x = Math.PI / 2;      // native +Y(up) -> game +Z(up)
  c.scale.setScalar(MONSTER_SCALE);
  c.position.set(0, 0, -0.01 * MONSTER_SCALE); // zero the base at local z=0
  g2.add(c);
}
g2.updateMatrixWorld(true);
console.log('clone(true) x4 OK:', g2.children.length,
  '| clone shares geometry:', g2.children[0].children[0].children[0].geometry === g.children[0].children[0].geometry);
const cbox = new THREE.Box3().setFromObject(g2.children[0]);
const csz = new THREE.Vector3();
cbox.getSize(csz);
console.log('cloned can world size (native 3.90 tall -> target 0.66):', csz.x.toFixed(3), csz.y.toFixed(3), csz.z.toFixed(3));
console.log('cloned can base z (should be ~0):', cbox.min.z.toFixed(4), '| top z (should be ~0.66):', cbox.max.z.toFixed(4));
console.log('RESULT: ' + (meshCount > 0 && Math.abs(sz.y - 3.9) < 0.01 ? 'PASS' : 'FAIL'));
process.exit(meshCount > 0 && Math.abs(sz.y - 3.9) < 0.01 ? 0 : 2);
