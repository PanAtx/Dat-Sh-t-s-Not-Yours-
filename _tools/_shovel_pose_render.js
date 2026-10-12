// _tools/_shovel_pose_render.js — loads shovelcompressed.glb (the Draco twin of the
// deleted shovel.glb) through the game's GLTFLoader.js + DRACOLoader.js (local ./draco/
// decoder, main-thread decode patch since Node has no blob-URL worker runtime),
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
global.self = global;
global.window = global;
// Image shim that reports a loaded 1x1 frame: the EXT_texture_webp support probe and
// GLTFLoader texture creation need a load event (textures are invisible to the
// silhouette raster — only geometry matters here).
global.Image = class {
  constructor() { this._listeners = {}; this.onload = null; this.width = 0; this.height = 0; }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  removeEventListener() {}
  set src(v) {
    const i = this;
    setTimeout(() => {
      i.width = 1; i.height = 1;
      (i._listeners["load"] || []).forEach((f) => f({ type: "load", target: i }));
      if (typeof i.onload === "function") i.onload({ type: "load", target: i });
    }, 0);
  }
  get src() { return this._src; }
};
global.document = { createElementNS: () => new global.Image(), createElement: () => new global.Image(), body: {} };
// Blob capture: DRACOLoader builds its decoder worker from a Blob; keep the code so
// the main-thread patch below can run the REAL worker decode functions in Node.
const partsMap = new Map();
let blobSeq = 0;
const RealBlob = global.Blob;
global.Blob = class extends RealBlob {
  constructor(parts, opts) {
    super(parts, opts);
    const flat = (parts || []).flatMap((p) => (Array.isArray(p) ? p : [p]));
    this._blobId = "blob:" + ++blobSeq;
    partsMap.set(this._blobId, flat.map((p) => (typeof p === "string" ? p : Buffer.from(p).toString("utf8"))).join(""));
  }
};
global.URL = global.URL || {};
global.URL.createObjectURL = (b) => (b && b._blobId) || "blob:0";
global.URL.revokeObjectURL = () => {};
// XHR shim serving the LOCAL ./draco/ decoder files from disk (index.html uses
// setDecoderPath("./draco/")); everything else -> immediate error (no network here).
global.XMLHttpRequest = class {
  constructor() { this._listeners = {}; }
  open(method, url) { this._url = url; }
  setRequestHeader() {}
  abort() {}
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn.bind(this)); }
  send() {
    const base = String(this._url || "").split("/").pop();
    const local = {
      "draco_decoder.js": "draco/draco_decoder.js",
      "draco_wasm_wrapper.js": "draco/draco_wasm_wrapper.js",
      "draco_decoder.wasm": "draco/draco_decoder.wasm",
    }[base];
    if (!local) {
      setTimeout(() => (this._listeners["error"] || []).forEach((f) => f({ type: "error", target: this, detail: "blocked " + this._url })), 0);
      return;
    }
    let b2;
    try { b2 = fs.readFileSync(local); } catch (e) {
      setTimeout(() => (this._listeners["error"] || []).forEach((f) => f({ type: "error", target: this, detail: e.message })), 0);
      return;
    }
    this.status = 200;
    this.response = this.responseType === "arraybuffer"
      ? b2.buffer.slice(b2.byteOffset, b2.byteOffset + b2.byteLength)
      : b2.toString("utf8");
    (this._listeners["progress"] || []).forEach((f) => f({ type: "progress", target: this, lengthComputable: false }));
    (this._listeners["load"] || []).forEach((f) => f({ type: "load", target: this }));
  }
};
eval(fs.readFileSync("GLTFLoader.js", "utf8"));
eval(fs.readFileSync("DRACOLoader.js", "utf8"));
const gltfLoader = new THREE.GLTFLoader();
const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath("./draco/");
gltfLoader.setDRACOLoader(dracoLoader);
// Node has no Web Worker runtime for blob: URLs: patch DRACOLoader._getWorker to run
// the REAL worker decode code (captured from the blob _initDecoder builds) on main.
(function patchDracoMainThread(dracoLoader) {
  let dracoModule = null, dracoHelpers = null;
  const ensureDraco = dracoLoader._initDecoder().then(() => {
    const code = partsMap.get(dracoLoader.workerSourceURL);
    if (typeof code !== "string") throw new Error("worker source not captured");
    const run = new Function("process", "require", "module", "exports", "window",
      code + "\n;return { decodeGeometry, decodeIndex, decodeAttribute, getDracoDataType, DracoDecoderModule };");
    const helpers = run(undefined, undefined, undefined, undefined, globalThis);
    return new Promise((res) => helpers.DracoDecoderModule({ wasmBinary: dracoLoader.decoderConfig.wasmBinary, onModuleLoaded: res }))
      .then((m) => { dracoModule = m; dracoHelpers = helpers; });
  });
  dracoLoader._getWorker = function (taskID, taskCost) {
    return ensureDraco.then(() => ({
      _callbacks: {},
      _taskCosts: { [taskID]: taskCost },
      _taskLoad: taskCost,
      postMessage(msg) {
        if (msg.type !== "decode") return;
        const draco = dracoModule;
        const decoder = new draco.Decoder();
        const buf3 = new draco.DecoderBuffer();
        buf3.Init(new Int8Array(msg.buffer), msg.buffer.byteLength);
        let geometry = null, err = null;
        try { geometry = dracoHelpers.decodeGeometry(draco, decoder, buf3, msg.taskConfig); }
        catch (e) { err = e; }
        finally { draco.destroy(buf3); draco.destroy(decoder); }
        if (err) { this._callbacks[msg.id].reject({ type: "error", id: msg.id, error: err.message }); return; }
        this._callbacks[msg.id].resolve({ type: "decode", id: msg.id, geometry });
      },
    }));
  };
})(dracoLoader);
const buf = fs.readFileSync("shovelcompressed.glb");
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

gltfLoader.parse(ab, "", (gltf) => {
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