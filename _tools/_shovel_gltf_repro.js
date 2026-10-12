// _tools/_shovel_gltf_repro.mjs — loads shovel-fixed.glb through the GAME'S OWN
// GLTFLoader.js (r128) in Node (with DOM stubs for textures) and audits the mesh the
// loader actually produces: counts, bbox, degenerate-triangle stats. This is the exact
// parse path index.html runs, so PASS here == what the worker holds in-game.
const fs = require("fs");
function loadThree() {
  const module = { exports: {} };
  const exports = module.exports;
  eval(fs.readFileSync("three_r128.min.js", "utf8"));
  return exports;
}
const THREE = loadThree();
global.THREE = THREE;
global.Image = class { constructor(){ this.onload=null; this.onerror=null; } addEventListener(t,f){ if(t==="load") this.onload=f; if(t==="error") this.onerror=f; } removeEventListener(){} set src(v){ const img=this; setTimeout(function(){ if(img.onload) img.onload({target:img}); },0); } };
global.self = global;
global.document = {
  createElementNS: function (ns, tag) { return new global.Image(); },
  createElement: function (tag) { return new global.Image(); },
};
const GLTF_SRC = fs.readFileSync("GLTFLoader.js", "utf8");
eval(GLTF_SRC);
if (!THREE.GLTFLoader) { console.log("GLTFLoader did not register (file shape?)"); process.exit(1); }

const file = process.argv[2] || "shovel-fixed.glb";
const buf = fs.readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const loader = new THREE.GLTFLoader();
loader.parse(
  ab,
  "",
  (gltf) => {
    const scene = gltf.scene;
    const stats = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const pos = g.attributes.position;
      const idx = g.index;
      stats.push({ verts: pos.count, tris: (idx ? idx.count : pos.count) / 3, mats: Array.isArray(o.material) ? o.material.length : 1 });
      // audit the loader's own triangles: positions in geom, u32 idx
      const deg = [];
      let total = 0, nan = 0;
      const N = Math.min(idx.count, 300000);
      for (let i = 0; i < N; i += 3) {
        const a = idx.getX(i) * 3, b = idx.getX(i + 1) * 3, c = idx.getX(i + 2) * 3;
        const ax = pos.getX(idx.getX(i)), ay = pos.getY(idx.getX(i)), az = pos.getZ(idx.getX(i));
        const bx = pos.getX(idx.getX(i + 1)), by = pos.getY(idx.getX(i + 1)), bz = pos.getZ(idx.getX(i + 1));
        const cx = pos.getX(idx.getX(i + 2)), cy = pos.getY(idx.getX(i + 2)), cz = pos.getZ(idx.getX(i + 2));
        void ay; void az; void by; void bz; void cy; void cz;
        const ux = bx - ax, uy = by - ay, uz = bz - az;
        const vx = cx - ax, vy = cy - ay, vz = cz - az;
        void ux; void uy; void uz; void vx; void vy; void vz;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const area = 0.5 * Math.hypot(nx, ny, nz);
        if (!isFinite(area)) nan++;
        total += area;
        deg.push(area);
      }
      deg.sort((p, q) => p - q);
      const q = (f) => deg[Math.floor((deg.length - 1) * f)];
      console.log(file, ":: mesh", stats.length - 1, "verts", pos.count, "tris", idx.count / 3, "nanArea", nan, "totalArea", total.toFixed(3));
      console.log("  area quantiles min/p1/p25/p50/p90/max:", deg[0].toExponential(2), q(0.01).toExponential(2), q(0.25).toExponential(2), q(0.5).toExponential(2), q(0.9).toExponential(2), deg[deg.length - 1].toExponential(2));
      let mx=0,mn=9,my=0,mny=9,mz=0,mnz=9;
      for (let v = 0; v < pos.count; v++) { const x=pos.getX(v),y=pos.getY(v),z=pos.getZ(v); if(x>mx)mx=x; if(x<mn)mn=x; if(y>my)my=y; if(y<mny)mny=y; if(z>mz)mz=z; if(z<mnz)mnz=z; }
      console.log("  geom bbox x", mn.toFixed(3), mx.toFixed(3), "y", mny.toFixed(3), my.toFixed(3), "z", mnz.toFixed(3), mz.toFixed(3));
    });
    console.log("meshes:", JSON.stringify(stats));
    const box = new THREE.Box3().setFromObject(scene);
    console.log("scene bbox:", JSON.stringify(box.min), JSON.stringify(box.max));
  },
  undefined,
  (e) => { console.log("PARSE FAILED:", (e && (e.message || e)) + ""); }
);