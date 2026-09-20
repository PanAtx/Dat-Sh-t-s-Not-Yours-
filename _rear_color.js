// _rear_color.js — rasterize the truck's VISIBLE REAR exactly as the game
// renders it: for each (y,z) column, take the OUTERMOST rear-facing body hit
// (raycast from x=-7.6 inward) and sample the COLOR texture (1000054) at the
// hit's UV. Prints an ASCII map of the rear so painted features (the orange
// hazard circles, banner, logo, taillights) can be read at their TRUE
// world (y,z). Run: node _rear_color.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const THREE = require('./three_r128.min.js');
global.THREE = THREE;
global.window = global;
global.self = global;
global.document = { createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {} }) };
global.Image = function () { return global.document.createElementNS('', 'img'); };
global.fetch = async (url) => new Response(Buffer.alloc(0));
require('./FBXLoader.js');
for (const L of [THREE.TextureLoader, THREE.CubeTextureLoader, THREE.FBXLoader]) {
  if (L && !L.prototype.loadAsync) L.prototype.loadAsync = function () {};
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8,
    w = 0,
    h = 0,
    ct = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const t = buf.toString('ascii', off + 4, off + 8);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ct = d[9];
    } else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    const cur = out.subarray(y * stride, y * stride + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a),
          pb = Math.abs(pp - b),
          pc = Math.abs(pp - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
  }
  return { w, h, data: out, ch };
}

// ---- the game's exact orient/instance chain (verbatim from index.html) ----
const TRUCK_SCALE = 0.4394;
function rotFromUpFront(up, front) {
  up = up.clone().normalize();
  front = front ? front.clone() : new THREE.Vector3();
  if (front.lengthSq() > 1e-10) front.addScaledVector(up, -up.dot(front));
  if (front.lengthSq() < 1e-10) {
    const a = Math.abs(up.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    front.crossVectors(up, a);
  }
  front.normalize();
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  return new THREE.Matrix4().set(
    front.x, front.y, front.z, 0,
    right.x, right.y, right.z, 0,
    up.x, up.y, up.z, 0,
    0, 0, 0, 1,
  );
}
function defaultOrient(tpl) {
  tpl.updateWorldMatrix(true, true);
  const s = new THREE.Box3().setFromObject(tpl).getSize(new THREE.Vector3());
  const up = new THREE.Vector3();
  up.setComponent([s.x, s.y, s.z].indexOf(Math.max(s.x, s.y, s.z)), 1);
  return rotFromUpFront(up, null);
}
function orientTruck(tpl) {
  const wheels = [];
  tpl.updateWorldMatrix(true, true);
  tpl.traverse((o) => {
    if (o.isMesh && o.name && /wheel/i.test(o.name)) wheels.push(o);
  });
  if (wheels.length) {
    const box = new THREE.Box3();
    wheels.forEach((w) => {
      w.updateWorldMatrix(true, true);
      box.union(new THREE.Box3().setFromObject(w));
    });
    const sp = [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
    const up = new THREE.Vector3();
    up.setComponent(sp.indexOf(Math.min(...sp)), 1);
    let F = new THREE.Vector3(),
      R = new THREE.Vector3(),
      nf = 0,
      nr = 0;
    wheels.forEach((w) => {
      const c = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
      if (/front/i.test(w.name)) {
        F.add(c);
        nf++;
      } else if (/rear/i.test(w.name)) {
        R.add(c);
        nr++;
      }
    });
    if (nf) F.multiplyScalar(1 / nf);
    if (nr) R.multiplyScalar(1 / nr);
    return rotFromUpFront(up, nf && nr ? F.sub(R) : null);
  }
  return defaultOrient(tpl);
}
function fbxInstance(tpl, scale) {
  const c = tpl.clone();
  const rotGrp = new THREE.Group();
  rotGrp.quaternion.setFromRotationMatrix(tpl.orient || new THREE.Matrix4());
  rotGrp.scale.setScalar(scale);
  rotGrp.add(c);
  const holder = new THREE.Group();
  holder.add(rotGrp);
  holder.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(rotGrp);
  const ctr = box.getCenter(new THREE.Vector3());
  rotGrp.position.set(-ctr.x, -ctr.y, -box.min.z);
  holder.updateWorldMatrix(true, true);
  return holder;
}


const fbx = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
const loader = new THREE.FBXLoader();
const scene = loader.parse(fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength), '');
scene.updateWorldMatrix(true, true);
const orient = orientTruck(scene);
scene.orient = orient;
const g = fbxInstance(scene, TRUCK_SCALE);
g.updateWorldMatrix(true, true);

// color texture = 1000054 (the body's map), extracted as _tex_0.png
const colorTex = decodePng(fs.readFileSync(path.join(__dirname, '_tex_0.png')));
const TW = colorTex.w,
  TH = colorTex.h;
const px = colorTex.data;
const sample = (u, v) => {
  const uu = ((u % 1) + 1) % 1;
  const vv = ((v % 1) + 1) % 1;
  const x = Math.min(TW - 1, Math.floor(uu * TW));
  const y = Math.min(TH - 1, Math.floor((1 - vv) * TH));
  const i = (y * TW + x) * colorTex.ch;
  return [px[i], px[i + 1], px[i + 2]];
};

// rear-facing body triangles (world space) with normals
const bms = [];
g.traverse((o) => {
  if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bms.push(o);
});
const tris = [];
{
  const vA = new THREE.Vector3(),
    vB = new THREE.Vector3(),
    vC = new THREE.Vector3(),
    n = new THREE.Vector3();
  for (const bm of bms) {
    const pos = bm.geometry.attributes.position,
      uv = bm.geometry.attributes.uv;
    const M = bm.matrixWorld;
    for (let t = 0; t < pos.count / 3; t++) {
      const i = t * 3;
      vA.fromBufferAttribute(pos, i).applyMatrix4(M);
      vB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
      vC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
      n.subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
      if (n.x > 0.2 * n.length()) continue; // keep rear-facing / angled faces
      tris.push([vA.clone(), vB.clone(), vC.clone(), uv.getX(i), uv.getY(i), uv.getX(i + 1), uv.getY(i + 1), uv.getX(i + 2), uv.getY(i + 2), n.clone().normalize()]);
    }
  }
}

// (y,z) buckets -> triangle indices
const BUCK = 96;
const yMin = -3,
  yMax = 3,
  zMin = 0,
  zMax = 5.5;
const buckets = new Map();
tris.forEach((T, ti) => {
  const ys = [T[0].y, T[1].y, T[2].y],
    zs = [T[0].z, T[1].z, T[2].z];
  const loY = Math.max(yMin, Math.min(...ys)),
    hiY = Math.min(yMax, Math.max(...ys));
  const loZ = Math.max(zMin, Math.min(...zs)),
    hiZ = Math.min(zMax, Math.max(...zs));
  for (let by = Math.floor(((loY - yMin) / (yMax - yMin)) * BUCK); by <= Math.floor(((hiY - yMin) / (yMax - yMin)) * BUCK); by++)
    for (let bz = Math.floor(((loZ - zMin) / (zMax - zMin)) * BUCK); bz <= Math.floor(((hiZ - zMin) / (zMax - zMin)) * BUCK); bz++) {
      const k = by + ',' + bz;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(ti);
    }
});

// visible rear hit at (y,z): outermost (min x) rear-facing face crossed by a
// ray from -X; barycentric weights from the (y,z) projection.
function hitAt(y, z) {
  const k = Math.floor(((y - yMin) / (yMax - yMin)) * BUCK) + ',' + Math.floor(((z - zMin) / (zMax - zMin)) * BUCK);
  let best = null,
    bestX = 0;
  for (const ti of buckets.get(k) || []) {
    const T = tris[ti];
    const a = T[0],
      b = T[1],
      c = T[2],
      h = T[9];
    const d1 = (b.z - a.z) * (y - a.y) - (b.y - a.y) * (z - a.z);
    const d2 = (c.z - b.z) * (y - b.y) - (c.y - b.y) * (z - b.z);
    const d3 = (a.z - c.z) * (y - c.y) - (a.y - c.y) * (z - c.z);
    if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
    if (Math.abs(h.x) < 1e-6) continue;
    const xHit = a.x - (h.y * (y - a.y) + h.z * (z - a.z)) / h.x;
    if (xHit > -3.5) continue;
    if (best !== null && xHit > bestX) continue;
    best = ti;
    bestX = xHit;
  }
  if (best === null) return null;
  const T = tris[best];
  const a = T[0],
    b = T[1],
    c = T[2];
  const d1 = (b.z - a.z) * (y - a.y) - (b.y - a.y) * (z - a.z);
  const d2 = (c.z - b.z) * (y - b.y) - (c.y - b.y) * (z - b.z);
  const d3 = (a.z - c.z) * (y - c.y) - (a.y - c.y) * (z - c.z);
  const tot = d1 + d2 + d3;
  if (Math.abs(tot) < 1e-12) return null;
  const w1 = d1 / tot,
    w2 = d2 / tot,
    w3 = d3 / tot;
  const u = w1 * T[3] + w2 * T[5] + w3 * T[7];
  const v = w1 * T[4] + w2 * T[6] + w3 * T[8];
  return { rgb: sample(u, v), x: bestX };
}

// ---- print the rear as seen from behind ----
if (process.argv[2] === 'fine') {
  // fine 0.005-step window around (y,z) with coordinate rulers
  const cy = parseFloat(process.argv[3]),
    cz = parseFloat(process.argv[4]),
    hw = parseFloat(process.argv[5] || '0.4');
  const step = 0.005;
  for (let z = cz + hw; z >= cz - hw; z -= step) {
    let line = z.toFixed(2).padStart(7) + ' ';
    for (let y = cy - hw; y <= cy + hw; y += step) {
      const h = hitAt(y, z);
      if (!h) {
        line += ' ';
        continue;
      }
      const cr = h.rgb[0],
        cg = h.rgb[1],
        cb = h.rgb[2];
      const lum = (cr + cg + cb) / 3;
      let ch;
      if (cr >= 110 && cr > cg + 25 && cg >= cb - 15 && cb <= 150 && cg <= 190) ch = 'O';
      else if (cr >= 150 && cg <= 90 && cb <= 90) ch = 'R';
      else if (lum > 200) ch = '.';
      else if (lum > 120) ch = '-';
      else ch = ':';
      line += ch;
    }
    console.log(line);
  }
  let ruler = '        ';
  for (let y = cy - hw; y <= cy + hw; y += step * 2) ruler += String(Math.round(y * 100) % 10);
  console.log(ruler + '   (hundredths of y)');
  // centroid of O pixels
  let n = 0,
    sy = 0,
    sz = 0,
    sx = 0;
  for (let z = cz + hw; z >= cz - hw; z -= step)
    for (let y = cy - hw; y <= cy + hw; y += step) {
      const h = hitAt(y, z);
      if (!h) continue;
      const cr = h.rgb[0],
        cg = h.rgb[1],
        cb = h.rgb[2];
      if (cr >= 110 && cr > cg + 25 && cg >= cb - 15 && cb <= 150 && cg <= 190) {
        n++;
        sy += y;
        sz += z;
        sx += h.x;
      }
    }
  console.log(n ? 'O-centroid: y=' + (sy / n).toFixed(3) + ' z=' + (sz / n).toFixed(3) + ' surfX=' + (sx / n).toFixed(3) + ' n=' + n : 'no orange found');
  process.exit(0);
}
// nrm mode: print the rear-face normal + surface x at a given (y,z)
if (process.argv[2] === 'nrm') {
  const y = parseFloat(process.argv[3]),
    z = parseFloat(process.argv[4]);
  const k = Math.floor(((y - yMin) / (yMax - yMin)) * BUCK) + ',' + Math.floor(((z - zMin) / (zMax - zMin)) * BUCK);
  let best = null,
    bestX = 0;
  for (const ti of buckets.get(k) || []) {
    const T = tris[ti];
    const a = T[0],
      b = T[1],
      c = T[2],
      h = T[9];
    const d1 = (b.z - a.z) * (y - a.y) - (b.y - a.y) * (z - a.z);
    const d2 = (c.z - b.z) * (y - b.y) - (c.y - b.y) * (z - b.z);
    const d3 = (a.z - c.z) * (y - c.y) - (a.y - c.y) * (z - c.z);
    if ((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)) continue;
    if (Math.abs(h.x) < 1e-6) continue;
    const xHit = a.x - (h.y * (y - a.y) + h.z * (z - a.z)) / h.x;
    if (xHit > -3.5) continue;
    if (best !== null && xHit > bestX) continue;
    best = ti;
    bestX = xHit;
  }
  if (best === null) {
    console.log('no rear hit at y=' + y + ' z=' + z);
    process.exit(0);
  }
  const h = tris[best][9];
  const ln = Math.sqrt(h.x * h.x + h.y * h.y + h.z * h.z);
  console.log('rear@y=' + y + ' z=' + z + ' x=' + bestX.toFixed(3) + ' n=(' + (h.x / ln).toFixed(3) + ',' + (h.y / ln).toFixed(3) + ',' + (h.z / ln).toFixed(3) + ') |n|=' + ln.toFixed(3));
  process.exit(0);
}
// __BLOBS__
if (process.argv[2] === 'blobs') {
  const ry0 = parseFloat(process.argv[3] || '0.3'),
    ry1 = parseFloat(process.argv[4] || '1.6'),
    rz0 = parseFloat(process.argv[5] || '3.4'),
    rz1 = parseFloat(process.argv[6] || '4.5'),
    st = parseFloat(process.argv[7] || '0.01');
  const isO = (rgb) =>
    rgb[0] >= 110 && rgb[0] > rgb[1] + 25 && rgb[1] >= rgb[2] - 15 && rgb[2] <= 150 && rgb[1] <= 190;
  const NX = Math.round((ry1 - ry0) / st) + 1,
    NZ = Math.round((rz1 - rz0) / st) + 1;
  const grid = new Uint8Array(NX * NZ);
  const sx = new Float64Array(NX * NZ);
  const hitX = new Float64Array(NX * NZ);
  let nHit = 0;
  for (let iz = 0; iz < NZ; iz++)
    for (let ix = 0; ix < NX; ix++) {
      const y = ry0 + ix * st,
        z = rz0 + iz * st;
      const h = hitAt(y, z);
      const i = iz * NX + ix;
      if (h && isO(h.rgb)) {
        grid[i] = 1;
        sx[i] = h.x;
        nHit++;
      }
    }
  console.log('orange cells: ' + nHit);
  const seen = new Uint8Array(NX * NZ);
  const out = [];
  for (let s = 0; s < NX * NZ; s++) {
    if (!grid[s] || seen[s]) continue;
    const q = [s];
    seen[s] = 1;
    let n = 0,
      sy = 0,
      sz = 0,
      shx = 0;
    while (q.length) {
      const i = q.pop();
      n++;
      const ix = i % NX,
        iz = (i / NX) | 0;
      sy += ry0 + ix * st;
      sz += rz0 + iz * st;
      shx += sx[i];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = ix + dx,
          nz = iz + dz;
        if (nx < 0 || nx >= NX || nz < 0 || nz >= NZ) continue;
        const j = nz * NX + nx;
        if (grid[j] && !seen[j]) {
          seen[j] = 1;
          q.push(j);
        }
      }
    }
    if (n < 25) continue;
    out.push({ y: sy / n, z: sz / n, x: shx / n, n });
  }
  out.sort((a, b) => b.y - a.y);
  out.forEach((c, i) =>
    console.log('blob' + (i + 1) + ': y=' + c.y.toFixed(3) + ' z=' + c.z.toFixed(3) + ' surfX=' + c.x.toFixed(3) + ' n=' + c.n),
  );
  process.exit(0);
}
const yLo = -2.6,
  yHi = 2.6,
  zLo = 0.2,
  zHi = 5.2,
  COLS = 150,
  ROWS = 130;
for (let r = 0; r < ROWS; r++) {
  const z = zHi - (r * (zHi - zLo)) / (ROWS - 1);
  let line = String(Math.round(z * 100)).padStart(4) + ' ';
  for (let c = 0; c < COLS; c++) {
    // screen orientation for a viewer BEHIND the truck (up=+Z): screen left = +Y
    const y = yHi - (c * (yHi - yLo)) / (COLS - 1);
    const h = hitAt(y, z);
    if (!h) {
      line += ' ';
      continue;
    }
    const cr = h.rgb[0],
      cg = h.rgb[1],
      cb = h.rgb[2];
    const lum = (cr + cg + cb) / 3;
    let ch;
    if (cr >= 110 && cr > cg + 25 && cg >= cb - 15 && cb <= 150 && cg <= 190) ch = 'O';
    else if (cr >= 150 && cg <= 90 && cb <= 90) ch = 'R';
    else if (lum > 200) ch = '.';
    else if (lum > 120) ch = '-';
    else ch = ':';
    line += ch;
  }
  console.log(line);
}
let ruler = '      ';
for (let c = 0; c < COLS; c++) {
  const y = yHi - (c * (yHi - yLo)) / (COLS - 1);
  ruler += String(Math.round(y * 100) % 10);
}
console.log(ruler + '  (y hundredths; left=+Y)');
console.log('as seen from behind: left=+Y, right=-Y; top=+Z, bottom=-Z');

