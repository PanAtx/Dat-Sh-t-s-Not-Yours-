// _bec_probe.mjs - quick geometry probe of bec.glb via the project's local three r128
// GLTFLoader (uncompressed GLB: no draco/worker shims needed).
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const DIR = import.meta.dirname;
const THREE = (await import(pathToFileURL(path.join(DIR, '_three128.js')).href)).default;
global.THREE = THREE;
global.self = global;
global.window = global;
const fakeEl = () => {
  const el = {
    setAttribute() {}, style: {}, width: 0, height: 0, _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
    removeEventListener() {},
    set src(v) {
      this._src = v;
      const fire = (type) => {
        (this._listeners[type] || []).slice().forEach(f => f({ type }));
        const prop = type === 'load' ? this.onload : this.onerror;
        if (typeof prop === 'function') prop({ type });
      };
      setTimeout(() => { this.width = 1; this.height = 1; fire('load'); }, 0);
    },
    get src() { return this._src; },
  };
  return el;
};
global.Image = class { constructor() { return fakeEl(); } };
global.document = { createElementNS: fakeEl, createElement: fakeEl, body: {} };
global.URL = global.URL || {};
global.URL.createObjectURL = () => 'blob:0';
global.URL.revokeObjectURL = () => {};
(0, eval)(fs.readFileSync(path.join(DIR, 'GLTFLoader.js'), 'utf8'));
if (typeof THREE.GLTFLoader === 'undefined') { console.error('FAILED to load local GLTFLoader'); process.exit(1); }

const file = process.argv[2] || 'bec.glb';
const buf = fs.readFileSync(path.join(DIR, file));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new THREE.GLTFLoader();
const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, (e) => rej(e)));
const scene = gltf.scene;
scene.updateMatrixWorld(true, true);
const box = new THREE.Box3().setFromObject(scene);
const size = new THREE.Vector3();
box.getSize(size);
console.log('file:', file, 'bytes=' + buf.length);
console.log('scene size x/y/z:', size.x.toFixed(5), size.y.toFixed(5), size.z.toFixed(5));
console.log('scene box min  :', box.min.x.toFixed(5), box.min.y.toFixed(5), box.min.z.toFixed(5));
console.log('scene box max  :', box.max.x.toFixed(5), box.max.y.toFixed(5), box.max.z.toFixed(5));
let meshes = 0, textured = 0;
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const p = new THREE.Box3().setFromObject(o);
  const s = new THREE.Vector3();
  p.getSize(s);
  const m = o.material || {};
  if (m.map || m.normalMap || m.roughnessMap || m.metalnessMap) textured++;
  console.log(
    ' mesh:', (o.name || '(unnamed)').slice(0, 40),
    'verts=' + o.geometry.attributes.position.count,
    'size', s.x.toFixed(4), s.y.toFixed(4), s.z.toFixed(4),
    'minY=' + p.min.y.toFixed(4),
    'metal=' + (m.metalness === undefined ? 'n/a' : m.metalness.toFixed(2)),
    'maps:', m.map ? 'B' : '', m.normalMap ? 'N' : '', m.roughnessMap ? 'R' : '', m.metalnessMap ? 'M' : ''
  );
});
console.log('meshes=' + meshes, 'textured=' + textured);
