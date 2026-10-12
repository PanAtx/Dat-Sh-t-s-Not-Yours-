// _tools/_shovel_glb2js.mjs — decimates shovel.glb into an embedded JS mesh file.
// NOTE (10/2026): shovel.glb's index buffer is CORRUPTED at export — 36,145 position
// vertices, 59,184 triangles, but the index accessor is UNSIGNED_BYTE and only ever
// addresses 0..255, so the triangle soup references a 256-vertex fragment. The raw
// mesh is NOT loadable (this script's output collapses to ~156 usable verts). The
// file's VALUE here is the measured vertex profile (_shovel_glb_probe.mjs), which
// makeShovelProp() in index.html now reproduces as high-poly swept geometry.
import fs from "fs";

const b = fs.readFileSync("shovel.glb");
const jsonLen = b.readUInt32LE(12);
const js = JSON.parse(b.slice(20, 20 + jsonLen).toString("utf8"));
const binStart = 12 + 8 + jsonLen;
const accs = js.accessors, bvs = js.bufferViews;

function accArray(ai, Ctor) {
  const a = accs[ai], bv = bvs[a.bufferView];
  const start = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (Ctor === Float32Array) return new Float32Array(b.buffer.slice(b.byteOffset + start, b.byteOffset + start + a.count * a.componentType * 4));
  const size = Ctor === Uint32Array ? 4 : Ctor === Uint16Array ? 2 : 1;
  return new Ctor(b.buffer.slice(b.byteOffset + start, b.byteOffset + start + a.count * size));
}
const pos = accArray(0, Float32Array); // accessor 0 = POSITION
const nrm = accArray(2, Float32Array); // accessor 2 = NORMAL
const ci = accs[3].componentType;
const idx = accArray(3, ci === 5125 ? Uint8Array : ci === 5121 ? Uint16Array : Uint32Array);
const nV = accs[0].count, nI = accs[3].count;
console.log("source verts", nV, "indices", nI);

function smooth(a, bbv, v) { const t = Math.min(1, Math.max(0, (v - a) / (bbv - a))); return t * t * (3 - 2 * t); }
// model (len, width, thick) -> tool (x, y, z) — measured mappings
function map(L, w, t) {
  const sh = smooth(0.52, 0.66, L); // head scale-up ramp
  const sl = smooth(-0.62, -0.50, L); // D-loop -> dipped grip zone
  const sg = smooth(-0.46, -0.30, L); // dipped grip -> shaft (+ head flare)
  const fyLow = 0.35 + sl * 0.27; // loop 0.35 -> dipped bulb 0.62
  const fy = fyLow + sg * (1.15 + sh * 0.78 - fyLow); // shaft 1.15 -> head 1.93
  const x = (L + 0.952) * 0.80 + sh * (L - 0.52) * 0.30;
  const y = w * fy;
  const z = t * (0.80 + sh * 0.55) - 0.010 - sh * 0.045;
  return [x, y, z];
}
// per-tri material split by centroid length
const SPLIT = 0.50;
// dedupe/cluster grid (2.5mm)
const Q = 400, K = new Map(), outPos = [[], []], outNrm = [[], []], outIdx = [[], []];
function pushVert(mat, key, px, py, pz, nx, ny, nz) {
  let id = K.get(mat + "|" + key);
  if (id === undefined) {
    id = outPos[mat].length / 3;
    K.set(mat + "|" + key, id);
    outPos[mat].push(px, py, pz); outNrm[mat].push(nx, ny, nz);
  }
  return id;
}
for (let i = 0; i < nI; i += 3) {
  const A = idx[i], B = idx[i + 1], C = idx[i + 2];
  const la = pos[A * 3 + 1], lb = pos[B * 3 + 1], lc = pos[C * 3 + 1];
  const mat = (la + lb + lc) / 3 < SPLIT ? 0 : 1; // 0 wood handle, 1 steel head
  const va = map(pos[A * 3 + 1], pos[A * 3], pos[A * 3 + 2]);
  const vb = map(pos[B * 3 + 1], pos[B * 3], pos[B * 3 + 2]);
  const vc = map(pos[C * 3 + 1], pos[C * 3], pos[C * 3 + 2]);
  const pts = [va, vb, vc];
  const ids = pts.map((v) => pushVert(mat, `${Math.round(v[0] * Q)}_${Math.round(v[1] * Q)}_${Math.round(v[2] * Q)}`, v[0], v[1], v[2]));
  const i0 = ids[0], i1 = ids[1], i2 = ids[2];
  if (i0 === i1 || i1 === i2 || i0 === i2) continue;
  outIdx[mat].push(i0, i1, i2);
}
// bake normals from faces into per-vertex accumulators
for (const mat of [0, 1]) {
  const N = new Float32Array(outPos[mat].length);
  const P = outPos[mat];
  for (let i = 0; i < outIdx[mat].length; i += 3) {
    const a = outIdx[mat][i] * 3, bb = outIdx[mat][i + 1] * 3, c = outIdx[mat][i + 2] * 3;
    const ux = P[bb] - P[a], uy = P[bb + 1] - P[a + 1], uz = P[bb + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a] += nx; N[a + 1] += ny; N[a + 2] += nz;
    N[bb] += nx; N[bb + 1] += ny; N[bb + 2] += nz;
    N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
  }
  for (let v = 0; v < N.length; v += 3) {
    const l = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1;
    outNrm[mat][v] = N[v] / l; outNrm[mat][v + 1] = N[v + 1] / l; outNrm[mat][v + 2] = N[v + 2] / l;
  }
  console.log("part", mat, "verts", outPos[mat].length / 3, "tris", outIdx[mat].length / 3);
}
function b64i16(arr, scale) { const i = new Int16Array(arr.length); for (let k = 0; k < arr.length; k++) i[k] = Math.round(arr[k] * scale); return Buffer.from(i.buffer).toString("base64"); }
function b64u16(arr) { const i = new Uint16Array(arr.length); for (let k = 0; k < arr.length; k++) i[k] = arr[k]; return Buffer.from(i.buffer).toString("base64"); }
const D = {};
for (const [name, mat] of [["wood", 0], ["steel", 1]]) {
  D[name] = { p: b64i16(outPos[mat], 1000), n: b64i16(outNrm[mat], 127), i: b64u16(outIdx[mat]) };
}
const payload = "var SHOVEL_DATA = " + JSON.stringify(D) + ";\nif (typeof module !== \"undefined\" && module.exports) module.exports = SHOVEL_DATA;\n";
fs.writeFileSync("shovel_data.js", payload);
console.log("shovel_data.js written:", payload.length, "bytes");