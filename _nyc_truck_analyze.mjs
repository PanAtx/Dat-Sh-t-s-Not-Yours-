// Analyze nyc_truck.glb: determine front/rear end, height profile, and locate the
// painted orange hazard pixels in the texture. Read-only.
import fs from 'fs';
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const FL = require2('./fflate.min.js');

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, ct = 0;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const tag = buf.toString('ascii', o + 4, o + 8);
    const data = buf.slice(o + 8, o + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    o += 12 + len;
  }
  const c = ct === 6 ? 4 : 3;
  const raw = FL.unzlibSync(Buffer.concat(idat));
  const stride = w * c, cur = Buffer.alloc(stride), px = Buffer.alloc(w * h * 4);
  let p = 0, prevRow = null;
  const paeth = (a, bb, d) => { const pp = a + bb - d; const pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - d); return pa <= pb && pa <= pc ? a : pb <= pc ? bb : d; };
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i];
      const a = i >= c ? cur[i - c] : 0;
      const bb = prevRow ? prevRow[i] : 0;
      const d = i >= c && prevRow ? prevRow[i - c] : 0;
      let v = x;
      if (f === 1) v = x + a; else if (f === 2) v = x + bb; else if (f === 3) v = x + ((a + bb) >> 1); else if (f === 4) v = x + paeth(a, bb, d);
      cur[i] = v & 0xff;
    }
    p += stride;
    for (let x = 0; x < w; x++) {
      const o2 = y * w * 4 + x * 4;
      px[o2] = cur[x * c]; px[o2 + 1] = cur[x * c + 1]; px[o2 + 2] = cur[x * c + 2];
      px[o2 + 3] = c === 4 ? cur[x * c + 3] : 255;
    }
    prevRow = Buffer.from(cur);
  }
  return { w, h, px };
}

const b = fs.readFileSync('nyc_truck.glb');
const binStart = 12 + 8 + 2452 + 8;
const positions = new Float32Array(b.buffer, b.byteOffset + binStart, 10235232 / 4);
const uvs = new Float32Array(b.buffer, b.byteOffset + binStart + 10235232, 6823488 / 4);
const normals = new Float32Array(b.buffer, b.byteOffset + binStart + 17058720, 10235232 / 4);
const tex = decodePng(b.slice(binStart + 36338484, binStart + 36338484 + 5198600));
console.log('texture', tex.w + 'x' + tex.h, 'vertices', (positions.length / 3).toString());

// KHR_texture_transform: final texcoord = uv * scale + offset (glTF v=0 at image top)
const TSCALE = [16.0033436, 15.9946527], TOFF = [0.0000039999999, 0.000535011292];
const uvToImg = (u, v) => [(u * TSCALE[0] + TOFF[0]) * tex.w, (v * TSCALE[1] + TOFF[1]) * tex.h];
const sampleTex = (u, v) => {
  let [ix, iy] = uvToImg(u, v);
  ix = Math.max(0, Math.min(tex.w - 1, Math.round(ix)));
  iy = Math.max(0, Math.min(tex.h - 1, Math.round(iy)));
  const i = (iy * tex.w + ix) * 4;
  return [tex.px[i], tex.px[i + 1], tex.px[i + 2]];
};

// histogram sanity check
const hist = new Map();
for (let i = 0; i < tex.w * tex.h; i += 5) {
  const j = i * 4;
  const key = (tex.px[j] >> 5) * 100 + (tex.px[j + 1] >> 5) * 10 + (tex.px[j + 2] >> 5);
  hist.set(key, (hist.get(key) || 0) + 1);
}
console.log('top colors (R>>5,G>>5,B>>5 digits of key):');
for (const [k, v] of [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const r = Math.floor(k / 100), g = Math.floor(k / 10) % 10, b2 = k % 10;
  console.log('  rgb~(' + (r << 5) + ',' + (g << 5) + ',' + (b2 << 5) + ') count=' + v);
}

// world coords (bake the node matrix: uniform scale + translate)
const S = 0.000113861381, TX = -0.952089012, TY = -0.347263992, TZ = -0.279724002;
const N = positions.length / 3;
const wx = new Float32Array(N), wy = new Float32Array(N), wz = new Float32Array(N);
for (let i = 0; i < N; i++) {
  wx[i] = positions[i * 3] * S + TX;
  wy[i] = positions[i * 3 + 1] * S + TY;
  wz[i] = positions[i * 3 + 2] * S + TZ;
}
let XMIN = Infinity, XMAX = -Infinity, ZMIN = Infinity, ZMAX = -Infinity;
for (let i = 0; i < N; i++) {
  if (wx[i] < XMIN) XMIN = wx[i];
  if (wx[i] > XMAX) XMAX = wx[i];
  if (wz[i] < ZMIN) ZMIN = wz[i];
  if (wz[i] > ZMAX) ZMAX = wz[i];
}
console.log('world X [' + XMIN.toFixed(4) + ' , ' + XMAX.toFixed(4) + ']  Z [' + ZMIN.toFixed(4) + ' , ' + ZMAX.toFixed(4) + ']');
const NB = 12, prof = new Array(NB).fill(-1e9);
for (let i = 0; i < N; i++) {
  const k = Math.min(NB - 1, Math.max(0, Math.floor((wx[i] - XMIN) / ((XMAX - XMIN) / NB))));
  if (wz[i] > prof[k]) prof[k] = wz[i];
}
console.log('height profile along X:');
prof.forEach((pv, i) => console.log('  x=' + (XMIN + (XMAX - XMIN) * (i + 0.5) / NB).toFixed(3).padStart(7) + '  h=' + pv.toFixed(3)));

// sample the texture color at the two X ends (topmost vertex near each end)
let iTopMaxX = 0, iTopMinX = 0;
for (let i = 1; i < N; i++) {
  if (wx[i] > XMAX - 0.06 && wz[i] > wz[iTopMaxX]) iTopMaxX = i;
  if (wx[i] < XMIN + 0.06 && wz[i] > wz[iTopMinX]) iTopMinX = i;
}
for (const [iv, label] of [[iTopMaxX, 'near +X end'], [iTopMinX, 'near -X end']]) {
  const u = uvs[iv * 2], v = uvs[iv * 2 + 1];
  const [ix, iy] = uvToImg(u, v);
  console.log(label + ': world=(' + wx[iv].toFixed(3) + ',' + wy[iv].toFixed(3) + ',' + wz[iv].toFixed(3) + ') imgPx=(' + ix.toFixed(0) + ',' + iy.toFixed(0) + ') color=' + sampleTex(u, v).join(','));
}

// ---------- UV -> 3D grid ----------
const BUCK = 8;
const grid = new Map();
for (let i = 0; i < N; i++) {
  let [gx, gy] = uvToImg(uvs[i * 2], uvs[i * 2 + 1]);
  gx = Math.floor(gx / BUCK); gy = Math.floor(gy / BUCK);
  const k = gx * 100000 + gy;
  let arr = grid.get(k); if (!arr) { arr = []; grid.set(k, arr); }
  arr.push(i);
}
const vertsNearPixel = (px, py, rad) => {
  const bx = Math.floor(px / BUCK), by = Math.floor(py / BUCK);
  const r = Math.ceil(rad / BUCK);
  const out = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const arr = grid.get((bx + dx) * 100000 + (by + dy));
    if (arr) for (const i of arr) out.push(i);
  }
  return out;
};

// ---------- scan texture for feature colors ----------
function scan(name, pred) {
  const pts = [];
  for (let y = 0; y < tex.h; y++) for (let x = 0; x < tex.w; x++) {
    const i = (y * tex.w + x) * 4;
    if (pred(tex.px[i], tex.px[i + 1], tex.px[i + 2], tex.px[i + 3])) pts.push([x, y]);
  }
  if (!pts.length) { console.log(name + ': none found'); return pts; }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  console.log(name + ': count=' + pts.length + ' bbox x[' + x0 + ',' + x1 + '] y[' + y0 + ',' + y1 + ']');
  return pts;
}
const orange = scan('ORANGE (hazard)', (r, g, b, a) => r > 200 && g > 60 && g < 190 && b < 120 && (r - b) > 130 && (r - g) > 60);
const glass = scan('DARK GLASS (windshield)', (r, g, b, a) => r < 70 && g < 70 && b < 95 && b >= r && a > 100);
const bright = scan('YELLOW/BRIGHT (body paint)', (r, g, b, a) => r > 200 && g > 170 && b < 120);

// ---------- map feature pixel clusters to 3D ----------
// For each feature pixel, find the closest vertex UV (in pixel space) and take its 3D pos/normal.
function pixelsTo3D(pts) {
  const out = [];
  for (const [px, py] of pts) {
    let best = -1, bestD = Infinity;
    const bx = Math.floor(px / BUCK), by = Math.floor(py / BUCK);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get((bx + dx) * 100000 + (by + dy));
      if (!arr) continue;
      for (const i of arr) {
        const [ix, iy] = uvToImg(uvs[i * 2], uvs[i * 2 + 1]);
        const ddx = ix - px, ddy = iy - py;
        const d = ddx * ddx + ddy * ddy;
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    if (best < 0) continue;
    out.push({ x: wx[best], y: wy[best], z: wz[best], nx: normals[best * 3], ny: normals[best * 3 + 1], nz: normals[best * 3 + 2], d: Math.sqrt(bestD) });
  }
  return out;
}
// 3D DBSCAN-ish clustering via coarse grid
function cluster3D(pts, eps) {
  const cell = Math.max(1, Math.round(1 / eps));
  const map = new Map();
  pts.forEach((p, i) => {
    const k = Math.round(p.x * cell) + Math.round(p.y * cell) * 100000 + Math.round(p.z * cell) * 1000000000;
    let arr = map.get(k); if (!arr) { arr = []; map.set(k, arr); }
    arr.push(i);
  });
  const used = new Uint8Array(pts.length);
  const clusters = [];
  const neigh = (i) => {
    const p = pts[i];
    const cx = Math.round(p.x * cell), cy = Math.round(p.y * cell), cz = Math.round(p.z * cell);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const arr = map.get(cx + dx + (cy + dy) * 100000 + (cz + dz) * 1000000000);
      if (!arr) continue;
      for (const j of arr) {
        if (used[j]) continue;
        const q = pts[j];
        const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2;
        if (dd < eps * eps) out.push(j);
      }
    }
    return out;
  };
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    const nb = neigh(i);
    if (nb.length < 4) { used[i] = 1; continue; } // noise
    const cl = [i]; used[i] = 1;
    const stack = nb.slice();
    while (stack.length) {
      const j = stack.pop();
      if (used[j]) continue;
      used[j] = 1; cl.push(j);
      for (const k of neigh(j)) if (!used[k]) stack.push(k);
    }
    if (cl.length >= 8) clusters.push(cl);
  }
  return clusters;
}
function summarize(cl) {
  let sx = 0, sy = 0, sz = 0, nx = 0, ny = 0, nz = 0;
  for (const i of cl) { const p = pts3D[i]; sx += p.x; sy += p.y; sz += p.z; nx += p.nx; ny += p.ny; nz += p.nz; }
  const n = cl.length;
  let r = 0;
  for (const i of cl) r = Math.max(r, Math.hypot(pts3D[i].x - sx / n, pts3D[i].y - sy / n, pts3D[i].z - sz / n));
  return { x: sx / n, y: sy / n, z: sz / n, nx: nx / n, ny: ny / n, nz: nz / n, n, r };
}

// orange pixels -> 3D
console.log('\n=== ORANGE -> 3D ===');
let pts3D = pixelsTo3D(orange);
console.log('orange pixels mapped:', pts3D.length);
const oClusters = cluster3D(pts3D, 0.09).sort((a, b) => b.length - a.length);
console.log('3D clusters:', oClusters.length);
oClusters.slice(0, 10).forEach((cl, i) => {
  const s = summarize(cl);
  console.log('  #' + i + ' n=' + cl.length + ' c=(' + s.x.toFixed(3) + ',' + s.y.toFixed(3) + ',' + s.z.toFixed(3) + ') N=(' + s.nx.toFixed(2) + ',' + s.ny.toFixed(2) + ',' + s.nz.toFixed(2) + ') r=' + s.r.toFixed(3));
});

