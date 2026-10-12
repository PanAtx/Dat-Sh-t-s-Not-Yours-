// _tools/_shovel_loader_debug.js — prints the first entries of the INDEX/POSITION
// arrays exactly as the game's GLTFLoader builds them, for diffing vs raw bin bytes.
const fs = require("fs");
function loadThree() {
  const module = { exports: {} };
  const exports = module.exports;
  eval(fs.readFileSync("three_r128.min.js", "utf8"));
  return exports;
}
const THREE = loadThree();
global.THREE = THREE;
global.Image = class {
  constructor() { this.onload = null; }
  addEventListener(t, f) { if (t === "load") this.onload = f; }
  removeEventListener() {}
  set src(v) { const i = this; setTimeout(() => i.onload && i.onload({ target: i }), 0); }
};
global.self = global;
global.document = { createElementNS: () => new global.Image(), createElement: () => new global.Image() };
eval(fs.readFileSync("GLTFLoader.js", "utf8"));
const buf = fs.readFileSync(process.argv[2] || "shovel-fixed.glb");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
new THREE.GLTFLoader().parse(
  ab, "",
  (g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const idx = o.geometry.index;
      const pos = o.geometry.attributes.position;
      console.log("LOADER idx type:", idx.array.constructor.name, "len", idx.array.length);
      console.log("LOADER idx first 12:", Array.from(idx.array.slice(0, 12)).join(","));
      console.log("LOADER idx max:", Math.max.apply(null, Array.from(idx.array.slice(0, 100000))));
      console.log("LOADER pos first 6:", Array.from(pos.array.slice(0, 6)).map((v) => v.toFixed(3)).join(","));
      const areas = [];
      for (let t = 0; t < Math.min(idx.array.length, 177552); t += 3) {
        const i0 = idx.array[t] * 3, i1 = idx.array[t + 1] * 3, i2 = idx.array[t + 2] * 3;
        const ux = pos.array[i1] - pos.array[i0], uy = pos.array[i1 + 1] - pos.array[i0 + 1], uz = pos.array[i1 + 2] - pos.array[i0 + 2];
        const vx = pos.array[i2] - pos.array[i0], vy = pos.array[i2 + 1] - pos.array[i0 + 1], vz = pos.array[i2 + 2] - pos.array[i0 + 2];
        areas.push(0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx));
      }
      areas.sort((a, b) => a - b);
      const sum = areas.reduce((p, c) => p + c, 0);
      console.log("areas: n", areas.length, "sum", sum.toFixed(3), "p50", areas[areas.length >> 1].toExponential(2), "max", areas[areas.length - 1].toExponential(2));
    });
  },
  undefined,
  (e) => console.log("FAIL", e && (e.message || e))
);