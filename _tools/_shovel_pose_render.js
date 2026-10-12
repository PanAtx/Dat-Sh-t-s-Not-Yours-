// _tools/_shovel_pose_render.js — loads shovel.glb through the game's GLTFLoader.js,
// applies the EXACT in-game transform (scale 1.84/1.903, rotation.z=-90deg, butt nudge)
// and the idle-carry pose (SHOVEL_HOLD k=0 fists), then rasterizes side + front views
// so we can SEE the silhouette as the player does. Labels: L=loop zone (tool x<0.62),
// S=shaft, H=head (x>1.05).
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
const buf = fs.readFileSync("shovel.glb");
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const S = 1.84 / 1.903;
const HOLD = { r: [1.15, -0.35], l: [0, -0.78] };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const fist = (side, ex, ey) => V3(-0.52 * Math.sin(ey), side * 0.29 + 0.52 * Math.sin(ex) * Math.cos(ey), 1.38 - 0.52 * Math.cos(ex) * Math.cos(ey));
const rf = fist(-1, HOLD.r[0], HOLD.r[1]);
const lf = fist(1, HOLD.l[0], HOLD.l[1]);
const d = lf.clone().sub(rf); d.multiplyScalar(1 / d.length());
const eyA = Math.acos(Math.max(-1, Math.min(1, d.x)));
const exA = Math.sin(eyA) > 1e-4 ? Math.atan2(d.y, -d.z) : 0;

new THREE.GLTFLoader().parse(ab, "", (gltf) => {
  const model = gltf.scene;
  model.rotation.z = Math.PI / 2; // scoop (native -Y) -> tool +X tip; D-grip (native +Y) -> butt
  model.scale.setScalar(S);
  model.position.set(0.952 * S, 0, -0.045);
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.rotation.set(exA, eyA, 0);
  wrap.position.set(rf.x - d.x * 0.14, rf.y - d.y * 0.14, rf.z - d.z * 0.14);
  wrap.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const put = (G, W, H, ch, ax, ay, ox, oy, cell) => {
    const c = Math.round((v[ax] - ox) / cell), r = H - 1 - Math.round((v[ay] - oy) / cell);
    if (r >= 0 && r < H && c >= 0 && c < W) G[r][c] = ch;
  };
  const draw = (title, ax, ay, ox, oy, cell, W, H) => {
    const G = Array.from({ length: H }, () => Array(W).fill(" "));
    model.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position, idx = o.geometry.index;
      for (let t = 0; t < idx.count; t += 3) {
        let sx = 0, sy = 0, sz = 0;
        for (let k = 0; k < 3; k++) {
          v.fromBufferAttribute(pos, idx.getX(t + k)).applyMatrix4(o.matrixWorld);
          sx += v.x; sy += v.y; sz += v.z;
        }
        v.set(sx / 3, sy / 3, sz / 3);
        const toolX = v.x;
        const ch = toolX < 0.62 ? "L" : toolX < 1.05 ? "S" : "H";
        put(G, W, H, ch, ax, ay, ox, oy, cell);
      }
    });
    console.log("== " + title);
    console.log(G.map((r) => r.join("").replace(/\s+$/, "")).join("\n").replace(/^\n+/, ""));
  };
  draw("SIDE: toolX ->(right), Z up (worker feet z=0, fists ~1.0-1.2)", "x", "z", -0.1, -0.25, 0.028, 74, 46);
  draw("FRONT: looking along the facing (y across, z up)", "y", "z", -0.5, -0.25, 0.022, 50, 30);
  const bb = new THREE.Box3().setFromObject(wrap);
  console.log("posed bbox x", bb.min.x.toFixed(2), bb.max.x.toFixed(2), "y", bb.min.y.toFixed(2), bb.max.y.toFixed(2), "z", bb.min.z.toFixed(2), bb.max.z.toFixed(2));
}, undefined, (e) => console.log("FAIL", e && e.message));