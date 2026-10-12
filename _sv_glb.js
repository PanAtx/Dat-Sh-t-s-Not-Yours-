// _sv_glb.js — THE TRUCK'S OWN LIGHTS, measured from the shipped model. The player says the
// truck has no light on top of it: its only light is the hazard lens on the REAR. So: load the
// exact GLB the game loads, with the exact vendored loader, and list every mesh whose material
// is the "Lights" material (the one the midnight glow scan pushes to NIGHT_TRUCK_GLOW x2.2)
// with its position and bounding box — top of the box, cab roof, front, rear — so we know which
// flat white cards the dark is lighting up.
const fs = require('fs');
const vm = require('vm');
function fakeEl() { return { setAttribute() {}, style: {}, addEventListener() {}, removeEventListener() {}, width: 0, height: 0 }; }
const sandbox = {
  self: {}, window: { URL: { createObjectURL: () => 'data:image/png;base64,iVBORw0KGgo=' } },
  document: { createElementNS: fakeEl, createElement: fakeEl },
  navigator: { userAgent: 'node' },
  URL: { createObjectURL: () => 'data:image/png;base64,iVBORw0KGgo=' },
  createImageBitmap: () => Promise.resolve({ width: 1, height: 1, close() {} }),
  ImageBitmap: function () {}, Image: function () { return fakeEl(); },
  console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('three_r128.min.js', 'utf8'), sandbox, { filename: 'three_r128.min.js' });
const gltf = fs.readFileSync('GLTFLoader.js', 'utf8');
vm.runInContext(gltf.replace(/^import[^\n]*\n/gm, '').replace(/^export[^\n]*\n/gm, ''), sandbox, { filename: 'GLTFLoader.js' });
const THREE = sandbox.THREE;
const GLTFLoaderCtor = THREE.GLTFLoader || sandbox.GLTFLoader;
if (!THREE || !GLTFLoaderCtor) throw new Error('no THREE/GLTFLoader in the vendored files');
const buf = fs.readFileSync('nyc_truck-compressed.glb');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
new GLTFLoaderCtor().parse(ab, '', (gltf) => {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const rows = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const isLights = ms.some((m) => m && m.name === 'Lights');
    if (!isLights) return;
    const bb = new THREE.Box3().setFromObject(o);
    rows.push({ name: o.name || '(unnamed)', lights: true, x: [bb.min.x, bb.max.x], y: [bb.min.y, bb.max.y], z: [bb.min.z, bb.max.z] });
  });
  const all = new THREE.Box3().setFromObject(root);
  const S = 0.3;
  console.log('model bounds  x ' + (all.min.x * S).toFixed(2) + '..' + (all.max.x * S).toFixed(2) +
    '  y ' + (all.min.y * S).toFixed(2) + '..' + (all.max.y * S).toFixed(2) +
    '  z ' + (all.min.z * S).toFixed(2) + '..' + (all.max.z * S).toFixed(2) + ' (game units, scale ' + S + ')');
  console.log('"Lights" material meshes: ' + rows.length);
  for (const r of rows) {
    const w = (r.x[1] - r.x[0]) * S, h = (r.y[1] - r.y[0]) * S, t = (r.z[1] - r.z[0]) * S;
    console.log('  ' + r.name.padEnd(26) + ' x ' + (r.x[0] * S).toFixed(2) + '..' + (r.x[1] * S).toFixed(2) +
      '  y ' + (r.y[0] * S).toFixed(2) + '..' + (r.y[1] * S).toFixed(2) +
      '  z ' + (r.z[0] * S).toFixed(2) + '..' + (r.z[1] * S).toFixed(2) +
      '   [flat ' + w.toFixed(2) + ' x ' + h.toFixed(2) + ' card, ' + t.toFixed(3) + ' thick]');
  }
}, (e) => { console.log('load error', e); });
