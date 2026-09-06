// Probe litterbasket.glb: parse it via the project's local GLTFLoader under three r128,
// and report the native bounding box (size + min/max), material list, and mesh count.
// Read-only: does NOT modify any project files.
import fs from 'fs';
const THREE = (await import('./_three128.js')).default;
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:,';
global.URL.revokeObjectURL = () => {};
const fakeEl = () => ({ setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' });
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
(0, eval)(fs.readFileSync('GLTFLoader.js','utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED to load local GLTFLoader'); process.exit(1); }
const warns=[], errs=[];
const ow=console.warn, oe=console.error;
console.warn=(...a)=>warns.push(a.join(' '));
console.error=(...a)=>errs.push(a.join(' '));
const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync('litterbasket.glb');
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
console.log('SIZE   :', sz.x.toFixed(3), sz.y.toFixed(3), sz.z.toFixed(3));
console.log('MIN    :', box.min.x.toFixed(3), box.min.y.toFixed(3), box.min.z.toFixed(3));
console.log('MAX    :', box.max.x.toFixed(3), box.max.y.toFixed(3), box.max.z.toFixed(3));
const mats = new Map();
g.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && !mats.has(m.uuid)) mats.set(m.uuid, m); }); });
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
  console.log('  map        :', !!m.map);
  console.log('  normalMap  :', !!m.normalMap);
  console.log('  emissive   :', m.emissive ? m.emissive.getHexString() : 'n/a');
  console.log('  vertexColors:', m.vertexColors);
  console.log('  alphaTest  :', m.alphaTest);
}
let meshCount = 0;
const perMesh = [];
g.traverse(o => { if (o.isMesh){
  meshCount++;
  const mn = o.name || '(unnamed)';
  const mm = Array.isArray(o.material) ? o.material.map(x=>x.name||x.uuid).join(',') : (o.material ? (o.material.name||o.material.uuid) : '');
  const vis = o.visible;
  const geo = o.geometry;
  const hasNorm = geo && geo.attributes && geo.attributes.normal;
  const normCount = hasNorm ? geo.attributes.normal.count : 0;
  const posCount = geo && geo.attributes && geo.attributes.position ? geo.attributes.position.count : 0;
  perMesh.push([mn, mm, 'visible='+vis, 'posVerts='+posCount, 'normVerts='+normCount]);
}});
console.log('meshes:', meshCount);
perMesh.forEach(p => console.log('   ', p.join(' | ')));
console.log('top-level scene children:', g.children.map(c => c.name || c.type));
console.log('scene.visible:', g.visible);
g.children.forEach(c => console.log('  child', c.name || c.type, 'visible:', c.visible));

