// Probe nyc_truck.glb via the project's local GLTFLoader (three r128):
// report the scene tree, native bounding box, up axis, front/rear detection,
// and candidate rear-face / hopper geometry for hazard-light placement.
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
    set src(v){ this._src = v;
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
const buf = fs.readFileSync('nyc_truck.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try {
  gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
} catch (e) { threw = e; }
console.warn = ow; console.error = oe;
if (threw){ console.error('THREW:', threw && threw.message); process.exit(1); }
console.log('parsed', !!gltf, 'warns', warns.length, 'errs', errs.length);
warns.slice(0,5).forEach(w => console.log('  W:', w));
errs.slice(0,5).forEach(e => console.log('  E:', e));
const g = gltf.scene;
g.updateMatrixWorld(true);

// ---- scene tree (names) ----
console.log('\n=== SCENE TREE ===');
g.traverse(o => {
  const depth = [];
  for (let p = o.parent; p; p = p.parent) depth.push('  ');
  const kind = o.isMesh ? 'MESH' : o.isGroup ? 'grp' : o.isBone ? 'bone' : o.type;
  const extra = o.isMesh ? ('  verts=' + o.geometry.attributes.position.count) : '';
  console.log(depth.join('') + o.name || '(anon)' + '  [' + kind + ']' + extra);
});

// ---- bounding box ----
const box = new THREE.Box3().setFromObject(g);
const sz = new THREE.Vector3();
box.getSize(sz);
console.log('\n=== NATIVE BOX ===');
console.log('SIZE:', sz.x.toFixed(4), sz.y.toFixed(4), sz.z.toFixed(4));
console.log('MIN :', box.min.x.toFixed(4), box.min.y.toFixed(4), box.min.z.toFixed(4));
console.log('MAX :', box.max.x.toFixed(4), box.max.y.toFixed(4), box.max.z.toFixed(4));

// ---- per-mesh boxes to find wheels / front vs rear ----
console.log('\n=== PER-MESH BOXES (x, y, z extents) ===');
g.traverse(o => {
  if (!o.isMesh) return;
  o.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(o);
  const s = new THREE.Vector3(); b.getSize(s);
  const c = b.getCenter(new THREE.Vector3());
  const big = s.x > 0.05 || s.y > 0.05 || s.z > 0.05;
  console.log((o.name || '(anon)').padEnd(48).slice(0,48),
    'sz=[' + s.x.toFixed(2) + ',' + s.y.toFixed(2) + ',' + s.z.toFixed(2) + ']',
    'ctr=[' + c.x.toFixed(2) + ',' + c.y.toFixed(2) + ',' + c.z.toFixed(2) + ']',
    big ? '' : '(tiny)');
});

// ---- materials summary ----
const mats = new Map();
g.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && !mats.has(m.uuid)) mats.set(m.uuid, m); }); });
console.log('\n=== MATERIALS (' + mats.size + ') ===');
for (const m of mats.values()){
  console.log('  ' + (m.name || '(anon)').slice(0,40).padEnd(40),
    m.type, 'color=' + (m.color ? '#' + m.color.getHexString() : '?'),
    'map=' + (m.map ? 'Y' : '-'), 'emissive=' + (m.emissive ? '#' + m.emissive.getHexString() : '?'),
    m.emissiveIntensity !== undefined && m.emissiveIntensity !== 0 ? ('emissiveIntensity=' + m.emissiveIntensity) : '');
}
console.log('\nDONE');
