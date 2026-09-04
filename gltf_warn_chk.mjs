// Check car.glb material parsing via the EXACT local GLTFLoader.js under the
// EXACT three r128 build the browser loads — looking for the
// "'color' parameter is undefined" warning source.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

if (!fs.existsSync('_three128.js')){ console.error('run fbx_warn_chk.mjs first to fetch _three128.js'); process.exit(1); }
const THREE = require('./_three128.js');

function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' }; }
global.THREE = THREE;
global.self = global;
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:image/png;base64,iVBORw0KGgo=';
global.URL.revokeObjectURL = () => {};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

(0, eval)(fs.readFileSync('GLTFLoader.js', 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined'){ console.error('FAILED to load local GLTFLoader'); process.exit(1); }
console.log('three r128 + local GLTFLoader.js ready');

const warns = [];
const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));
const errs = [];
const oe = console.error; console.error = (...a) => errs.push(a.join(' '));

const loader = new THREE.GLTFLoader();
const buf = fs.readFileSync('car.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
let gltf = null, threw = null;
try {
  gltf = loader.parse(ab, '', (g) => { gltf = g; }) || gltf;
} catch (e) {
  threw = e;
}
console.warn = ow; console.error = oe;
await new Promise(r => setTimeout(r, 250)); // let any promise-based resolve land
console.log('diagnostics: gltf=' + (gltf ? 'got' : 'null') + ' threw=' + (threw ? threw.message : 'no') + ' warns=' + warns.length + ' errs=' + errs.length);
errs.slice(0, 5).forEach(e => console.log('  err:', e));

if (gltf){
  const matWarns = warns.filter(w => /parameter is undefined|not a property/.test(w));
  console.log('parse OK, scenes:', gltf.scene.children.length);
  console.log('material warnings from three.js:', matWarns.length);
  matWarns.forEach(w => console.log('  ', w));
  const mats = new Map();
  gltf.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && !mats.has(m.uuid)) mats.set(m.uuid, m); }); });
  console.log('materials in scene:', mats.size);
  [...mats.values()].forEach(m => console.log('  ', m.name || '(anon)', '|', m.type, '| color=' + (m.color ? m.color.getHexString() : 'n/a')));
  const bad = matWarns.length > 0;
  console.log(bad ? 'WARNING SOURCE FOUND in car.glb path' : 'CLEAN: no material warnings from car.glb');
  process.exit(bad ? 1 : 0);
} else {
  warns.forEach(w => console.log('warn:', w));
  errs.slice(0, 5).forEach(e => console.log('err:', e));
  process.exit(2);
}