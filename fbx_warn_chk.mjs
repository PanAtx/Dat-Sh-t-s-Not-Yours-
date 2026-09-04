// Prove the console warnings ("'color' parameter is undefined",
// "'normalMap' is not a property") come from truck.fbx material parsing via the
// EXACT local FBXLoader.js + EXACT three r128 build the browser loads,
// and that the parameter filter removes them.
import fs from 'fs';
import fflate from './fflate.min.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ---- EXACT r128 build (same file the browser loads from the CDN) ----
if (!fs.existsSync('_three128.js')){
  const url = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const t = await (await fetch(url, { cache: 'no-store' })).text();
  fs.writeFileSync('_three128.js', t);
}
const THREE = require('./_three128.js');

function fakeEl(){ return { setAttribute(){}, style:{}, addEventListener(){}, removeEventListener(){}, width:0, height:0, src:'' }; }
global.THREE = THREE;
global.fflate = fflate;
global.self = global;
global.Blob = class { constructor(parts, opts){ this.parts = parts; this.opts = opts; } };
global.window = global;
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'data:image/png;base64,iVBORw0KGgo=';
global.URL.revokeObjectURL = () => {};
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };

const loaderSrc = fs.readFileSync('FBXLoader.js', 'utf8');
(0, eval)(loaderSrc);
if (typeof THREE.FBXLoader === 'undefined'){ console.error('FAILED to load local FBXLoader'); process.exit(1); }
console.log('three r128 + local FBXLoader.js ready');

// Capture three.js material warnings exactly as the browser console would
const warns = [];
const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));

const buf = fs.readFileSync('truck.fbx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const root = new THREE.FBXLoader().parse(ab, '');
console.warn = ow;

const matWarns = warns.filter(w => /parameter is undefined|not a property/.test(w));
console.log('parse OK, root children:', root.children.length);
console.log('material warnings from three.js:', matWarns.length);
matWarns.forEach(w => console.log('  ', w));

// Enumerate every material the FBX actually produced
const mats = new Map();
root.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && !mats.has(m.uuid)) mats.set(m.uuid, m); }); });
console.log('materials in scene:', mats.size);
[...mats.values()].forEach(m => console.log('  ', m.name || '(anon)', '|', m.type,
  '| normalMap=' + (m.normalMap ? 'YES' : 'no'), '| map=' + (m.map ? 'YES' : 'no'),
  '| color=' + (m.color ? m.color.getHexString() : 'n/a')));

const bad = matWarns.length > 0;
console.log(bad ? 'WARNING SOURCES STILL PRESENT' : 'CLEAN: no material warnings under r128');
process.exit(bad ? 1 : 0);