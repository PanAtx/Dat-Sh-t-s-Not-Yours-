// _measure_haz.js — headless measurement of the truck's painted rear hazard
// circles. Loads truck.fbx exactly like the game does (FBXLoader + orientTruck
// + fbxInstance at TRUCK_SCALE), decodes the EMBEDDED texture in Node, finds the
// orange circles in the pixels, and maps each circle's UV to its exact
// group-local 3D position / face normal / world radius (the same coordinate
// space buildTruck measures tMinX/tTop in). Output = the constants to hardcode
// in buildTruck's hazLights block. Run: node _measure_haz.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- (0) Node stand-ins for the browser globals the loaders use ----
const THREE = require('./three_r128.min.js');
global.THREE = THREE;
const blobStore = new Map(); // blob: URL -> Blob (filled by the URL.createObjectURL wrapper)
const realCreateObjectURL = URL.createObjectURL.bind(URL);
global.window = global; // loaders reference window.URL / window.Image
global.URL.createObjectURL = (blob) => {
  const u = realCreateObjectURL(blob);
  blobStore.set(u, blob);
  return u;
};
// fake <img>: decodes the PNG from the blob store and exposes raw RGBA
global.document = {
  createElementNS: () => {
    const img = { _v: '', _l: [], _e: [], width: 0, height: 0, _rgba: null };
    img.addEventListener = (type, cb) => {
      console.error('DBG addEventListener type=' + type + ' on ' + (img._id || 'img'));
      (type === 'load' ? img._l : img._e).push(cb);
    };
    img.removeEventListener = (type, cb) => {
      const arr = type === 'load' ? img._l : img._e;
      const i = arr.indexOf(cb);
      if (i >= 0) arr.splice(i, 1);
    };
    Object.defineProperty(img, 'src', {
      get() {
        return this._v;
      },
      set(v) {
        this._v = v;
        setTimeout(() => {
          const blob = blobStore.get(v);
          if (!blob) return console.error('DBG no blob for ' + v) || img._e.forEach((cb) => cb.call(img, new Error('no blob for ' + v)));
          console.error('DBG loading ' + v + ' type=' + blob.type + ' size=' + blob.size);
          blob.arrayBuffer().then((buf) => {
            try {
              const dec = decodePng(Buffer.from(buf));
              img.width = dec.width;
              img.height = dec.height;
              img._rgba = dec.data;
              try {
                img._l.forEach((cb) => cb.call(img)); // `this` = the image (browsers dispatch listeners with target as this)
              } catch (e2) {
                console.error('DBG onload cb threw: ' + e2.stack);
              }
            } catch (e) {
              console.error('DBG decode fail ' + v + ': ' + e.message);
              img._e.forEach((cb) => cb.call(img, new Error('png decode: ' + e.message)));
            }
          });
        }, 0);
      },
    });
    return img;
  },
};
global.Image = function () {
  return global.document.createElementNS('', 'img');
};
global.fetch = async (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    const blob = blobStore.get(url);
    if (!blob) throw new Error('unknown blob ' + url);
    return new Response(blob);
  }
  return fetch(url);
};
require('./FBXLoader.js'); // attaches THREE.FBXLoader (global build)

// three r128 loaders need EventDispatcher methods + `self.Image` in Node
global.self = global;
for (const L of [THREE.TextureLoader, THREE.ImageLoader, THREE.FileLoader, THREE.DataLoader]) {
  if (L && L.prototype && !L.prototype.addEventListener) {
    L.prototype.addEventListener = THREE.EventDispatcher.prototype.addEventListener;
    L.prototype.removeEventListener = THREE.EventDispatcher.prototype.removeEventListener;
    L.prototype.dispatchEvent = THREE.EventDispatcher.prototype.dispatchEvent;
    L.prototype.hasEventListener = THREE.EventDispatcher.prototype.hasEventListener;
  }
}
// DBG: correlate each texture node ID with its image load outcome
const _origTexLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (url, ...rest) {
  const tex = _origTexLoad.call(this, url, ...rest);
  console.error('DBG texload start url=' + url.slice(0, 50));
  setTimeout(() => {
    console.error('DBG tex ' + (tex.ID !== undefined ? tex.ID : '?') + ' name=' + (tex.name || '?') + ' image=' + (tex.image ? 'OK ' + tex.image.width + 'x' + tex.image.height + ' rgba=' + !!tex.image._rgba : 'NULL'));
  }, 4000);
  return tex;
};

// ---- (1) minimal 8-bit PNG decoder (color types 0/2/4/6) ----
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8,
    w = 0,
    h = 0,
    depth = 0,
    ctype = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      ctype = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error('bit depth ' + depth + ' not supported');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error('color type ' + ctype + ' not supported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * ch);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
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
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 6) rgba.set([out[i * 4], out[i * 4 + 1], out[i * 4 + 2], out[i * 4 + 3]], i * 4);
    else if (ctype === 2) rgba.set([out[i * 3], out[i * 3 + 1], out[i * 3 + 2], 255], i * 4);
    else if (ctype === 4) rgba.set([out[i * 2], out[i * 2], out[i * 2], out[i * 2 + 1]], i * 4);
    else rgba.set([out[i], out[i], out[i], 255], i * 4);
  }
  return { width: w, height: h, data: rgba };
}

// ---- (2) orange-circle detection (BFS connected components) ----
function findCircles(img) {
  const W = img.width,
    H = img.height,
    px = img._rgba;
  const isOrange = (i) => {
    const r = px[i * 4],
      g = px[i * 4 + 1],
      b = px[i * 4 + 2];
    return r >= 170 && g >= 50 && g <= 200 && b <= 130 && r > g + 40 && g >= b;
  };
  const seen = new Uint8Array(W * H);
  const circles = [];
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !isOrange(start)) continue;
    const q = [start];
    seen[start] = 1;
    let n = 0,
      x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0,
      sx = 0,
      sy = 0;
    while (q.length) {
      const i = q.pop();
      n++;
      const x = i % W,
        y = (i / W) | 0;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [i - 1, i + 1, i - W, i + W];
      if (x === 0) nb[0] = -1;
      if (x === W - 1) nb[1] = -1;
      if (y === 0) nb[2] = -1;
      if (y === H - 1) nb[3] = -1;
      for (const j of nb) {
        if (j >= 0 && j < W * H && !seen[j] && isOrange(j)) {
          seen[j] = 1;
          q.push(j);
        }
      }
    }
    const bw = x1 - x0 + 1,
      bh = y1 - y0 + 1;
    const fill = n / (bw * bh);
    const aspect = bw / bh;
    if (n >= 100) {
      circles.push({ cx: sx / n, cy: sy / n, r: Math.max(x1 - sx / n, sx / n - x0, y1 - sy / n, sy / n - y0), area: n, w: bw, h: bh, fill: fill });
    }
  }
  circles.sort((a, b) => b.area - a.area);
  return circles;
}

// ---- (3) the game's exact orient/instance chain (verbatim from index.html) ----
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

// ---- (4) UV -> group-local 3D (barycentric on the mesh's own triangles) ----
function buildUVMap(mesh) {
  const pos = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  const tri = [];
  for (let t = 0; t < pos.count / 3; t++) {
    const i = t * 3;
    tri.push([
      new THREE.Vector3().fromBufferAttribute(pos, i),
      new THREE.Vector3().fromBufferAttribute(pos, i + 1),
      new THREE.Vector3().fromBufferAttribute(pos, i + 2),
      new THREE.Vector2().fromBufferAttribute(uv, i),
      new THREE.Vector2().fromBufferAttribute(uv, i + 1),
      new THREE.Vector2().fromBufferAttribute(uv, i + 2),
    ]);
  }
  return tri;
}
function uvToWorldAll(tri, M, u, v) {
  // returns ALL triangles containing the UV: { p (group-local pos), n (world normal), tri }
  const hits = [];
  for (let t = 0; t < tri.length; t++) {
    const [a, b, c, ua, ub, uc] = tri[t];
    const v1x = ub.x - ua.x,
      v1y = ub.y - ua.y,
      v2x = uc.x - ua.x,
      v2y = uc.y - ua.y;
    const inv = 1 / (v1x * v2y - v1y * v2x);
    if (!isFinite(inv) || Math.abs(inv) < 1e-12) continue;
    const w = (v2y * (u - ua.x) - v2x * (v - ua.y)) * inv;
    const x = (v1x * (v - ua.y) - v1y * (u - ua.x)) * inv;
    if (w < -1e-4 || x < -1e-4 || w + x > 1 + 1e-4) continue;
    // p = a + w*(b-a) + x*(c-a)
    const p = new THREE.Vector3().copy(a).addScaledVector(new THREE.Vector3().subVectors(b, a), w).addScaledVector(new THREE.Vector3().subVectors(c, a), x).applyMatrix4(M);
    const n = new THREE.Vector3().subVectors(b.clone().applyMatrix4(M), a.clone().applyMatrix4(M)).cross(new THREE.Vector3().subVectors(c.clone().applyMatrix4(M), a.clone().applyMatrix4(M))).normalize();
    hits.push({ p, n, tri: t });
  }
  return hits;
}
// Local UV->world affine fit on the rear face patch around a point: returns
// [world-units per UV unit in u, in v] by least squares over the face's vertices.
function faceAffine(tri, M, center, rad) {
  const pts = [];
  const A = new THREE.Vector3(),
    B = new THREE.Vector3(),
    C = new THREE.Vector3(),
    nrm = new THREE.Vector3();
  for (let t = 0; t < tri.length; t++) {
    const [a, b, c, ua, ub, uc] = tri[t];
    A.copy(a).applyMatrix4(M);
    B.copy(b).applyMatrix4(M);
    C.copy(c).applyMatrix4(M);
    nrm.subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    if (nrm.x > 0) continue; // rear-facing only
    if (A.distanceTo(center) <= rad) pts.push([A.x, A.y, A.z, ua.x, ua.y]);
    if (B.distanceTo(center) <= rad) pts.push([B.x, B.y, B.z, ub.x, ub.y]);
    if (C.distanceTo(center) <= rad) pts.push([C.x, C.y, C.z, uc.x, uc.y]);
  }
  console.error("DBG pts=" + pts.length + " rad=0.5 at " + center.x.toFixed(2) + "," + center.y.toFixed(2) + "," + center.z.toFixed(2)); if (pts.length < 6) return null;
  // world = P0 + Pu*u + Pv*v  ->  normal equations on [1, u, v]
  const XTX = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const XTy = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of pts) {
    const row = [1, p[3], p[4]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) XTX[i][j] += row[i] * row[j];
      for (let k = 0; k < 3; k++) XTy[k][i] += [p[0], p[1], p[2]][k] * row[i];
    }
  }
  const solve3 = (m, v) => {
    const Ar = m.map((r) => r.slice());
    const b = v.slice();
    for (let i = 0; i < 3; i++) {
      let p = i;
      for (let j = i + 1; j < 3; j++) if (Math.abs(Ar[j][i]) > Math.abs(Ar[p][i])) p = j;
      [Ar[i], Ar[p]] = [Ar[p], Ar[i]];
      [b[i], b[p]] = [b[p], b[i]];
      if (Math.abs(Ar[i][i]) < 1e-12) return null;
      for (let j = i + 1; j < 3; j++) {
        const f = Ar[j][i] / Ar[i][i];
        for (let k = i; k < 3; k++) Ar[j][k] -= f * Ar[i][k];
        b[j] -= f * b[i];
      }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < 3; j++) s -= Ar[i][j] * x[j];
      x[i] = s / Ar[i][0];
    }
    return x;
  };
  const wx = solve3(XTX, XTy[0]),
    wy = solve3(XTX, XTy[1]),
    wz = solve3(XTX, XTy[2]);
  if (!wx || !wy || !wz) return null;
  const su = Math.hypot(wx[1], wy[1], wz[1]);
  const sv = Math.hypot(wx[2], wy[2], wz[2]);
  if (center.x < -3) console.error("DBG su=" + su + " sv=" + sv + " wx=" + JSON.stringify(wx) + " wy=" + JSON.stringify(wy) + " wz=" + JSON.stringify(wz)); if (!su || !sv || su > 100 || sv > 100) return null;
  return [su, sv];
}

// ---- (5) run it ----
(async () => {
  const fbx = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
  const fbxArrayBuffer = fbx.buffer.slice(fbx.byteOffset, fbx.byteOffset + fbx.byteLength);
  const loader = new THREE.FBXLoader();
  const scene = loader.parse(fbxArrayBuffer, ''); // synchronous: returns the group, textures load async
  scene.updateWorldMatrix(true, true);
  const orient = orientTruck(scene);
  scene.orient = orient;
  const g = fbxInstance(scene, TRUCK_SCALE);
  g.updateWorldMatrix(true, true);

  // wait for the embedded textures to finish decoding (they load async after parse)
  const allTex = new Set();
  const TEX_SLOTS = ['map', 'emissiveMap', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'displacementMap', 'alphaMap'];
  g.traverse((o) => {
    if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && TEX_SLOTS.forEach((s) => m[s] && allTex.add(m[s])));
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    let ready = true;
    allTex.forEach((t) => {
      if (!t.image || !t.image._rgba) ready = false;
    });
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  let nReady = 0;
  allTex.forEach((t) => t.image && t.image._rgba && nReady++);
  console.log('textures loaded: ' + nReady + ' / ' + allTex.size);
  if (process.argv[2] === 'histfile' && process.argv[3]) {
    const buf = fs.readFileSync(path.join(__dirname, process.argv[3]));
    const dec = decodePng(buf);
    const counts = new Map();
    for (let i = 0; i < dec.data.length; i += 16) {
      const key = dec.data[i] + ',' + dec.data[i + 1] + ',' + dec.data[i + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
    console.log('HIST ' + process.argv[3] + ' (' + dec.width + 'x' + dec.height + '):');
    top.forEach(([c, n]) => console.log('  rgb(' + c + ') x' + n));
    process.exit(0);
  }
  if (process.argv[2] === 'ascii' && process.argv[3]) {
    const buf = fs.readFileSync(path.join(__dirname, process.argv[3]));
    const dec = decodePng(buf);
    const W = dec.width,
      H = dec.height,
      px = dec.data;
    const S = 16;
    const rows = Math.floor(H / S),
      cols = Math.floor(W / S);
    const line = (y, x) => {
      const i = (y * W + x) * 4;
      const r = px[i],
        g = px[i + 1],
        b = px[i + 2];
      if (r > 140 && r > g + 30 && g >= b - 10) return '#';
      const lum = (r + g + b) / 3;
      return lum < 60 ? '.' : ' ';
    };
    for (let y = 0; y < rows; y++) {
      let s = '';
      for (let x = 0; x < cols; x++) s += line(y * S + (S >> 1), x * S + (S >> 1));
      console.log(s);
    }
    process.exit(0);
  }
  if (process.argv[2] === 'hist') {
    // dump the top colors of each 2048x2048 texture
    let done = false;
    allTex.forEach((t) => {
      if (!t.image || !t.image._rgba || t.image.width !== 2048 || done) return;
      done = true;
      const px = t.image._rgba;
      const counts = new Map();
      for (let i = 0; i < px.length; i += 16) {
        const key = px[i] + ',' + px[i + 1] + ',' + px[i + 2];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
      console.log('HIST tex ' + t.ID + ':');
      top.forEach(([c, n]) => console.log('  rgb(' + c + ') x' + n));
      process.exit(0);
    });
  }
  allTex.forEach((t) => {
    const im = t.image;
    const src = im ? String(im._v || (im.src || '')).slice(0, 60) : '';
    console.log('  tex [' + (t.name || '?') + ' id=' + (t.ID ?? '?') + ']: image=' + (im ? typeof im + ' src=' + src + ' rgba=' + !!im._rgba + ' ' + (im.width || '?') + 'x' + (im.height || '?') : 'NULL'));
  });

  // reference frame (same as buildTruck's scan)
  let tMaxX = 0, tMinX = 0, tTop = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    tMaxX = Math.max(tMaxX, box.max.x);
    tMinX = Math.min(tMinX, box.min.x);
    tTop = Math.max(tTop, box.max.z);
  });
  console.log('frame: tMaxX=' + tMaxX.toFixed(3) + ' tMinX=' + tMinX.toFixed(3) + ' tTop=' + tTop.toFixed(3));
  if (process.argv[2] === 'meshes') {
    g.traverse((o) => {
      if (!o.isMesh) return;
      const box = new THREE.Box3().setFromObject(o);
      const m = o.material;
      const maps = m ? TEX_SLOTS.filter((s) => m[s]).map((s) => s + '=' + (m[s].ID)) : [];
      console.log(o.name + '  x:[' + box.min.x.toFixed(2) + ',' + box.max.x.toFixed(2) + '] y:[' + box.min.y.toFixed(2) + ',' + box.max.y.toFixed(2) + '] z:[' + box.min.z.toFixed(2) + ',' + box.max.z.toFixed(2) + ']  ' + (Array.isArray(m) ? m.length + ' mats' : m && m.type) + '  ' + maps.join(' '));
    });
    process.exit(0);
  }
  if (process.argv[2] === 'faceuv') {
    const U = parseFloat(process.argv[3]),
      V = parseFloat(process.argv[4]);
    let bodyMesh = null;
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_0$/.test(o.name)) bodyMesh = o;
    });
    const pos = bodyMesh.geometry.attributes.position,
      uv = bodyMesh.geometry.attributes.uv;
    const M = bodyMesh.matrixWorld;
    console.log('body 0_0 verts=' + pos.count);
    let found = 0;
    for (let t = 0; t < pos.count / 3; t++) {
      const i = t * 3;
      const ua = uv.getX(i),
        ua2 = uv.getX(i + 1),
        ua3 = uv.getX(i + 2),
        va = uv.getY(i),
        va2 = uv.getY(i + 1),
        va3 = uv.getY(i + 2);
      const v1x = ua2 - ua,
        v1y = va2 - va,
        v2x = ua3 - ua,
        v2y = va3 - va;
      const det = v1x * v2y - v1y * v2x;
      if (!det) continue;
      const w = (v2y * (U - ua) - v2x * (V - va)) / det;
      const x = (v1x * (V - va) - v1y * (U - ua)) / det;
      if (w < -1e-4 || x < -1e-4 || w + x > 1 + 1e-4) continue;
      found++;
      const A = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(M);
      const B = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(M);
      const C = new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(M);
      const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
      console.log('  tri' + t + ' A=(' + A.x.toFixed(2) + ',' + A.y.toFixed(2) + ',' + A.z.toFixed(2) + ') B=(' + B.x.toFixed(2) + ',' + B.y.toFixed(2) + ',' + B.z.toFixed(2) + ') C=(' + C.x.toFixed(2) + ',' + C.y.toFixed(2) + ',' + C.z.toFixed(2) + ') n=(' + n.x.toFixed(2) + ',' + n.y.toFixed(2) + ',' + n.z.toFixed(2) + ')');
    }
    console.log('  hits=' + found);
    process.exit(0);
  }
  if (process.argv[2] === 'uvrect') {
    let u0 = 1,
      v0 = 1,
      u1 = 0,
      v1 = 0,
      n = 0;
    const vA = new THREE.Vector3();
    const bms = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bms.push(o);
    });
    for (const bodyMesh of bms) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        let ok = true;
        for (const k of [0, 1, 2]) {
          vA.fromBufferAttribute(pos, i + k).applyMatrix4(M);
          if (!(vA.x < -3.95 && vA.z > 3.5)) ok = false;
        }
        if (!ok) continue;
        n++;
        for (const k of [0, 1, 2]) {
          const uu = uv.getX(i + k),
            vv = uv.getY(i + k);
          if (uu < u0) u0 = uu;
          if (uu > u1) u1 = uu;
          if (vv < v0) v0 = vv;
          if (vv > v1) v1 = vv;
        }
      }
    }
    console.log('upper-rear tris=' + n + ' UV u:[' + u0.toFixed(4) + ',' + u1.toFixed(4) + '] v:[' + v0.toFixed(4) + ',' + v1.toFixed(4) + ']');
    process.exit(0);
  }
  if (process.argv[2] === 'circles') {
    // Render the rear face at ~1cm world resolution and report each orange circle's
    // center (world y,z) + diameter (world units) — exactly what the lights must cover.
    const X = -3.99;
    const bms = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bms.push(o);
    });
    const tris = [];
    const wA = new THREE.Vector3(),
      wB = new THREE.Vector3(),
      wC = new THREE.Vector3();
    for (const bodyMesh of bms) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        wA.fromBufferAttribute(pos, i).applyMatrix4(M);
        wB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
        wC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
        const nn = new THREE.Vector3().subVectors(wB, wA).cross(new THREE.Vector3().subVectors(wC, wA));
        if (nn.x > 0.5 * nn.length()) continue;
        tris.push([wA.clone(), wB.clone(), wC.clone(), uv.getX(i), uv.getY(i), uv.getX(i + 1), uv.getY(i + 1), uv.getX(i + 2), uv.getY(i + 2)]);
      }
    }
    const inTri = (P, T) => {
      const a = T[0],
        b = T[1],
        c = T[2];
      const area = (p, q, r) => (q.y - p.y) * (r.z - p.z) - (q.z - p.z) * (r.y - p.y);
      const A = area(P, a, b),
        B = area(P, b, c),
        C = area(P, c, a);
      if ((A < 0 || B < 0 || C < 0) && (A > 0 || B > 0 || C > 0)) return null;
      const tot = A + B + C;
      if (Math.abs(tot) < 1e-9) return null;
      return [B / tot, C / tot, A / tot];
    };
    // spatial index: (y,z) buckets -> triangle lists
    const BUCK = 64;
    const yMin = -3,
      yMax = 2.8,
      zMin = 0,
      zMax = 4.6;
    const buckets = new Map();
    const bkey = (y, z) => Math.floor(((y - yMin) / (yMax - yMin)) * BUCK) + ',' + Math.floor(((z - zMin) / (zMax - zMin)) * BUCK);
    tris.forEach((T, ti) => {
      const ys = [T[0].y, T[1].y, T[2].y],
        zs = [T[0].z, T[1].z, T[2].z];
      const loY = Math.max(yMin, Math.min(...ys)),
        hiY = Math.min(yMax, Math.max(...ys));
      const loZ = Math.max(zMin, Math.min(...zs)),
        hiZ = Math.min(zMax, Math.max(...zs));
      for (let by = Math.floor(((loY - yMin) / (yMax - yMin)) * BUCK); by <= Math.floor(((hiY - yMin) / (yMax - yMin)) * BUCK); by++) {
        for (let bz = Math.floor(((loZ - zMin) / (zMax - zMin)) * BUCK); bz <= Math.floor(((hiZ - zMin) / (zMax - zMin)) * BUCK); bz++) {
          const k = by + ',' + bz;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(ti);
        }
      }
    });
    // the emissive texture (100708-byte PNG in the fbx)
    const fbx2 = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let ti = fbx2.indexOf(sig),
      dec = null;
    while (ti >= 0) {
      let j = ti + 8,
        len = 0;
      while (j < fbx2.length) {
        const l = fbx2.readUInt32BE(j);
        const t2 = fbx2.toString('ascii', j + 4, j + 8);
        j += 12 + l;
        len += 12 + l;
        if (t2 === 'IEND') break;
      }
      if (len === 100708) {
        dec = decodePng(fbx2.subarray(ti, ti + len));
        break;
      }
      ti = fbx2.indexOf(sig, ti + 8);
    }
    if (!dec) throw new Error('emissive texture not found');
    const TW = dec.width,
      TH = dec.height;
    const sample = (u, v) => {
      const uu = ((u % 1) + 1) % 1;
      const vv = ((v % 1) + 1) % 1;
      const x = Math.min(TW - 1, Math.floor(uu * TW));
      const y = Math.min(TH - 1, Math.floor((1 - vv) * TH));
      const i = (y * TW + x) * 4;
      return [dec.data[i], dec.data[i + 1], dec.data[i + 2]];
    };
    const yLo = -2.9,
      yHi = 2.7,
      zLo = 0.3,
      zHi = 4.5;
    const N = 560;
    const cells = [];
    for (let r = 0; r < N; r++) {
      const z = zHi - (r * (zHi - zLo)) / (N - 1);
      for (let cix = 0; cix < N; cix++) {
        const y = yLo + (cix * (yHi - yLo)) / (N - 1);
        const list = buckets.get(bkey(y, z)) || [];
        // raycast from OUTSIDE the truck (x = -7.6) inward; first rear-facing
        // hit is the true outer rear surface (a fixed plane like -3.99 would
        // sample hidden INTERIOR faces of the body)
        let hit = null,
          hitX = 0;
        for (let x = -7.6; x < -3.9 && !hit; x += 0.02) {
          const P = new THREE.Vector3(x, y, z);
          let bestSlice = null;
          for (const ti of list) {
            const T = tris[ti];
            const bb = inTri(P, T);
            if (!bb) continue;
            const xAt = bb[0] * T[0].x + bb[1] * T[1].x + bb[2] * T[2].x;
            // true 3D crossing: the triangle plane must lie in this x slice
            if (Math.abs(xAt - x) > 0.012) continue;
            // multiple faces can crowd one slice: the true visible hit is the
            // OUTERMOST (most negative x) of them
            if (bestSlice && xAt > bestSlice.xAt) continue;
            bestSlice = { bb, T, xAt };
          }
          if (bestSlice) {
            hit = [bestSlice.bb, bestSlice.T];
            hitX = bestSlice.xAt;
          }
        }
        if (!hit) continue;
        const [bb, T] = hit;
        const u = bb[0] * T[3] + bb[1] * T[5] + bb[2] * T[7];
        const v = bb[0] * T[4] + bb[1] * T[6] + bb[2] * T[8];
        const [cr, cg, cb] = sample(u, v);
        const lum = (cr + cg + cb) / 3;
        if (cr > 150 && cr > cg + 40 && cg >= cb - 10) cells.push([y, z, hitX, cr, cg, cb]);
        else if (lum > 180) cells.push([y, z, hitX, cr, cg, cb]);
      }
    }
    // flood-fill the orange cells into circles
    const idx = new Map();
    cells.forEach((c, i) => idx.set(c[0].toFixed(2) + '|' + c[1].toFixed(2), i));
    const used = new Uint8Array(cells.length);
    const circlesOut = [];
    const cellW = (yHi - yLo) / (N - 1),
      cellH = (zHi - zLo) / (N - 1);
    for (let i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      const q = [i];
      used[i] = 1;
      let n = 0,
        sy = 0,
        sz = 0,
        sx = 0,
        sr = 0,
        sg = 0,
        sb = 0;
      while (q.length) {
        const j = q.pop();
        n++;
        sy += cells[j][0];
        sz += cells[j][1];
        sx += cells[j][2];
        sr += cells[j][3];
        sg += cells[j][4];
        sb += cells[j][5];
        const yq = cells[j][0],
          zq = cells[j][1];
        for (const [dy, dz] of [
          [cellW, 0],
          [-cellW, 0],
          [0, cellH],
          [0, -cellH],
        ]) {
          const k = idx.get((yq + dy).toFixed(2) + '|' + (zq + dz).toFixed(2));
          if (k !== undefined && !used[k]) {
            used[k] = 1;
            q.push(k);
          }
        }
      }
      if (n < 8) continue;
      const cy = sy / n,
        cz = sz / n;
      const diam = Math.sqrt((4 * n * cellW * cellH) / Math.PI);
      const ar = sr / n,
        ag = sg / n,
        ab = sb / n;
      const kind = ag > 90 && ab < 60 ? 'ORANGE' : ag < 60 && ab < 60 ? 'RED' : ag > 150 ? 'WHITE' : 'other';
      circlesOut.push({ y: +cy.toFixed(3), z: +cz.toFixed(3), x: +(sx / n).toFixed(3), d: +diam.toFixed(3), cells: n, kind, col: [Math.round(ar), Math.round(ag), Math.round(ab)] });
    }
    circlesOut.sort((a, b) => b.z - a.z);
    console.log('CIRCLES ON REAR (world, group-local):');
    circlesOut.forEach((c) => console.log('  ' + c.kind + ' y=' + c.y + ' z=' + c.z + ' x=' + c.x + ' d=' + c.d + ' rgb=' + c.col.join(',')));
    process.exit(0);
  }
  if (process.argv[2] === 'verify') {
    // Final check: rasterize the rear face and overlay the THREE lens spots that
    // index.html now places (hazX = -4.03, r=0.085 core / r=0.14 halo). Reports, per
    // lens, how much of the painted circle is covered and prints an ASCII rear view
    // with the lenses drawn on top of the texture.
    const X = -3.99;
    const LENSES = [
      { x: -3.968, y: -0.819, z: 4.012, r: 0.085 },
      { x: -4.009, y: -0.53, z: 3.995, r: 0.085 },
      { x: -4.048, y: -0.238, z: 3.978, r: 0.085 },
    ];
    const bms = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bms.push(o);
    });
    const tris = [];
    const wA = new THREE.Vector3(),
      wB = new THREE.Vector3(),
      wC = new THREE.Vector3();
    for (const bodyMesh of bms) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        wA.fromBufferAttribute(pos, i).applyMatrix4(M);
        wB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
        wC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
        const nn = new THREE.Vector3().subVectors(wB, wA).cross(new THREE.Vector3().subVectors(wC, wA));
        if (nn.x > 0.5 * nn.length()) continue;
        tris.push([wA.clone(), wB.clone(), wC.clone(), uv.getX(i), uv.getY(i), uv.getX(i + 1), uv.getY(i + 1), uv.getX(i + 2), uv.getY(i + 2)]);
      }
    }
    const inTri = (P, T) => {
      const a = T[0],
        b = T[1],
        c = T[2];
      const area = (p, q, r) => (q.y - p.y) * (r.z - p.z) - (q.z - p.z) * (r.y - p.y);
      const A = area(P, a, b),
        B = area(P, b, c),
        C = area(P, c, a);
      if ((A < 0 || B < 0 || C < 0) && (A > 0 || B > 0 || C > 0)) return null;
      const tot = A + B + C;
      if (Math.abs(tot) < 1e-9) return null;
      return [B / tot, C / tot, A / tot];
    };
    const BUCK = 96;
    const yMin = -3,
      yMax = 2.8,
      zMin = 0,
      zMax = 4.6;
    const buckets = new Map();
    const bkey = (y, z) => Math.floor(((y - yMin) / (yMax - yMin)) * BUCK) + ',' + Math.floor(((z - zMin) / (zMax - zMin)) * BUCK);
    tris.forEach((T, ti) => {
      const ys = [T[0].y, T[1].y, T[2].y],
        zs = [T[0].z, T[1].z, T[2].z];
      const loY = Math.max(yMin, Math.min(...ys)),
        hiY = Math.min(yMax, Math.max(...ys));
      const loZ = Math.max(zMin, Math.min(...zs)),
        hiZ = Math.min(zMax, Math.max(...zs));
      for (let by = Math.floor(((loY - yMin) / (yMax - yMin)) * BUCK); by <= Math.floor(((hiY - yMin) / (yMax - yMin)) * BUCK); by++) {
        for (let bz = Math.floor(((loZ - zMin) / (zMax - zMin)) * BUCK); bz <= Math.floor(((hiZ - zMin) / (zMax - zMin)) * BUCK); bz++) {
          const k = by + ',' + bz;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(ti);
        }
      }
    });
    const fbx2 = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let ti = fbx2.indexOf(sig),
      dec = null;
    while (ti >= 0) {
      let j = ti + 8,
        len = 0;
      while (j < fbx2.length) {
        const l = fbx2.readUInt32BE(j);
        const t2 = fbx2.toString('ascii', j + 4, j + 8);
        j += 12 + l;
        len += 12 + l;
        if (t2 === 'IEND') break;
      }
      if (len === 100708) {
        dec = decodePng(fbx2.subarray(ti, ti + len));
        break;
      }
      ti = fbx2.indexOf(sig, ti + 8);
    }
    if (!dec) throw new Error('emissive texture not found');
    const W = dec.width,
      H = dec.height,
      px = dec.data;
    const sample = (u, v) => {
      let uu = ((u % 1) + 1) % 1,
        vv = 1 - ((v % 1) + 1) % 1;
      const x = Math.min(W - 1, Math.max(0, Math.floor(uu * W))),
        y = Math.min(H - 1, Math.max(0, Math.floor(vv * H)));
      const o = (y * W + x) * 4;
      return [px[o], px[o + 1], px[o + 2]];
    };
    const sampleAt = (y, z) => {
      // raycast from OUTSIDE (x = -7.6) inward; first true 3D rear-facing hit
      let hit = null,
        hitX = 0;
      for (let x = -7.6; x < -3.9 && !hit; x += 0.02) {
        const P = new THREE.Vector3(x, y, z);
        let bestSlice = null;
        for (const ti of buckets.get(bkey(y, z)) || []) {
          const T = tris[ti];
          const bb = inTri(P, T);
          if (!bb) continue;
          const xAt = bb[0] * T[0].x + bb[1] * T[1].x + bb[2] * T[2].x;
          if (Math.abs(xAt - x) > 0.012) continue;
          if (bestSlice && xAt > bestSlice.xAt) continue;
          bestSlice = { bb, T, xAt };
        }
        if (bestSlice) {
          hit = [bestSlice.bb, bestSlice.T];
          hitX = bestSlice.xAt;
        }
      }
      if (!hit) return null;
      const [bb, T] = hit;
      const u = bb[0] * T[3] + bb[1] * T[5] + bb[2] * T[7];
      const v = bb[0] * T[4] + bb[1] * T[6] + bb[2] * T[8];
      return { rgb: sample(u, v), x: hitX };
    };
    // per-lens: (a) painted-circle coverage under the lens disc, (b) lens must sit
    // OUTSIDE the surface (x more negative than the hit) so it is visible
    let allOk = true;
    LENSES.forEach((L, i) => {
      let inFace = 0,
        painted = 0;
      for (let ry = -6; ry <= 6; ry++) {
        for (let rz = -6; rz <= 6; rz++) {
          const rr = Math.sqrt(ry * ry + rz * rz);
          if (rr > 6) continue;
          inFace++;
          const c = sampleAt(L.y + (ry / 6) * L.r, L.z + (rz / 6) * L.r);
          if (c && (c.rgb[0] + c.rgb[1] + c.rgb[2]) / 3 > 40) painted++;
        }
      }
      const cov = painted / inFace;
      const cc = sampleAt(L.y, L.z);
      const inFront = cc ? L.x < cc.x - 0.005 : false;
      if (cov < 0.85 || !inFront) allOk = false;
      console.log(
        'lens ' + (i + 1) + ' (' + L.y + ',' + L.z + '): surface x=' + (cc ? cc.x.toFixed(3) : 'none') + ', lens x=' + L.x + ' ' + (inFront ? 'OUTSIDE (visible)' : 'BURIED!') + ', ' + Math.round(cov * 100) + '% painted under r=' + L.r + ' disc, center rgb=' + (cc ? cc.rgb.join(',') : '-'),
      );
    });
    console.log(allOk ? 'VERIFY PASS: all three lenses sit on the painted circles' : 'VERIFY FAIL: a lens is off the painted graphic');
    process.exit(allOk ? 0 : 1);
  }
  if (process.argv[2] === 'sample') {
    // probe one world point on the visible rear: raycast from outside, print the
    // hit color + a small neighborhood average. usage: sample y z
    const y = parseFloat(process.argv[3]),
      z = parseFloat(process.argv[4]);
    const bodyMeshes = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bodyMeshes.push(o);
    });
    const tris = [];
    const vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3();
    for (const bodyMesh of bodyMeshes) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        vA.fromBufferAttribute(pos, i).applyMatrix4(M);
        vB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
        vC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
        const n = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
        if (n.x > 0.5 * n.length()) continue;
        tris.push([vA.clone(), vB.clone(), vC.clone(), uv.getX(i), uv.getY(i), uv.getX(i + 1), uv.getY(i + 1), uv.getX(i + 2), uv.getY(i + 2)]);
      }
    }
    const inTri = (P, T) => {
      const a = T[0],
        b = T[1],
        c = T[2];
      const area = (p, q, r) => (q.y - p.y) * (r.z - p.z) - (q.z - p.z) * (r.y - p.y);
      const A = area(P, a, b),
        B = area(P, b, c),
        C = area(P, c, a);
      if ((A < 0 || B < 0 || C < 0) && (A > 0 || B > 0 || C > 0)) return null;
      const tot = A + B + C;
      if (Math.abs(tot) < 1e-9) return null;
      return [B / tot, C / tot, A / tot];
    };
    const fbx2 = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let ti = fbx2.indexOf(sig),
      dec = null;
    while (ti >= 0) {
      let j = ti + 8,
        len = 0;
      while (j < fbx2.length) {
        const l = fbx2.readUInt32BE(j);
        const t2 = fbx2.toString('ascii', j + 4, j + 8);
        j += 12 + l;
        len += 12 + l;
        if (t2 === 'IEND') break;
      }
      if (len === 100708) {
        dec = decodePng(fbx2.subarray(ti, ti + len));
        break;
      }
      ti = fbx2.indexOf(sig, ti + 8);
    }
    if (!dec) throw new Error('emissive texture not found');
    const TW = dec.width,
      TH = dec.height;
    const sample = (u, v) => {
      const uu = ((u % 1) + 1) % 1;
      const vv = ((v % 1) + 1) % 1;
      const x = Math.min(TW - 1, Math.floor(uu * TW));
      const y2 = Math.min(TH - 1, Math.floor((1 - vv) * TH));
      const i = (y2 * TW + x) * 4;
      return [dec.data[i], dec.data[i + 1], dec.data[i + 2]];
    };
    const probe = (py, pz) => {
      for (let x = -7.6; x < -3.9; x += 0.02) {
        const P = new THREE.Vector3(x, py, pz);
        let bestSlice = null;
        for (const T of tris) {
          const bb = inTri(P, T);
          if (!bb) continue;
          const xAt = bb[0] * T[0].x + bb[1] * T[1].x + bb[2] * T[2].x;
          if (Math.abs(xAt - x) > 0.012) continue;
          if (bestSlice && xAt > bestSlice.xAt) continue;
          bestSlice = { bb, T, xAt };
        }
        if (bestSlice) {
          const { bb, T } = bestSlice;
          const u = bb[0] * T[3] + bb[1] * T[5] + bb[2] * T[7];
          const v = bb[0] * T[4] + bb[1] * T[6] + bb[2] * T[8];
          return { rgb: sample(u, v), x: bestSlice.xAt };
        }
      }
      return null;
    };
    const c = probe(y, z);
    if (!c) {
      console.log('no hit at y=' + y + ' z=' + z);
      process.exit(0);
    }
    let sr = 0,
      sg = 0,
      sb = 0,
      n = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -2; dz <= 2; dz++) {
        const q = probe(y + dy * 0.02, z + dz * 0.02);
        if (q) {
          sr += q.rgb[0];
          sg += q.rgb[1];
          sb += q.rgb[2];
          n++;
        }
      }
    console.log('hit at surface x=' + c.x.toFixed(3) + ', center rgb=' + c.rgb.join(',') + ', 5x5 avg rgb=' + [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)].join(','));
    process.exit(0);
  }
  if (process.argv[2] === 'rearview') {
    const X = parseFloat(process.argv[3] || '-3.99'); // the x plane to sample
    const bodyMeshes = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bodyMeshes.push(o);
    });
    // decode the emissive texture (1000055) directly from the FBX blob
    const fbx2 = fs.readFileSync(path.join(__dirname, 'truck.fbx'));
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let ti = fbx2.indexOf(sig);
    let dec = null;
    while (ti >= 0) {
      let j = ti + 8,
        len = 0;
      while (j < fbx2.length) {
        const l = fbx2.readUInt32BE(j);
        const t2 = fbx2.toString('ascii', j + 4, j + 8);
        j += 12 + l;
        len += 12 + l;
        if (t2 === 'IEND') break;
      }
      if (len === 100708) {
        dec = decodePng(fbx2.subarray(ti, ti + len));
        break;
      }
      ti = fbx2.indexOf(sig, ti + 8);
    }
    if (!dec) throw new Error('emissive texture not found in fbx');
    const TW = dec.width,
      TH = dec.height;
    const sample = (u, v) => {
      const uu = ((u % 1) + 1) % 1;
      const vv = ((v % 1) + 1) % 1;
      const x = Math.min(TW - 1, Math.floor(uu * TW));
      const y = Math.min(TH - 1, Math.floor((1 - vv) * TH)); // flipY: v=1 is top row
      const i = (y * TW + x) * 4;
      return [dec.data[i], dec.data[i + 1], dec.data[i + 2]];
    };
    // collect rear triangles (world) from the body meshes
    const tris = [];
    const vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3();
    for (const bodyMesh of bodyMeshes) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        vA.fromBufferAttribute(pos, i).applyMatrix4(M);
        vB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
        vC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
        const n = new THREE.Vector3().subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA));
        if (n.x > 0.5 * n.length()) continue; // not rear-facing
        tris.push([vA.clone(), vB.clone(), vC.clone(), uv.getX(i), uv.getY(i), uv.getX(i + 1), uv.getY(i + 1), uv.getX(i + 2), uv.getY(i + 2)]);
      }
    }
    const inTri = (P, T) => {
      // 2D: use (y,z) projection; barycentric with UV as third axis check
      const [a, b, c, ua, va, ub, vb, uc, vc] = T;
      const area = (p, q, r) => (q.y - p.y) * (r.z - p.z) - (q.z - p.z) * (r.y - p.y);
      const A = area(P, a, b),
        B = area(P, b, c),
        C = area(P, c, a);
      if ((A < 0 || B < 0 || C < 0) && (A > 0 || B > 0 || C > 0)) return null;
      const tot = A + B + C;
      if (Math.abs(tot) < 1e-9) return null;
      return [B / tot, C / tot, A / tot];
    };
    // usage: rearview yLo yHi zLo zHi cols rows
    const yLo = parseFloat(process.argv[3] || '-1.2'),
      yHi = parseFloat(process.argv[4] || '0.9'),
      zLo = parseFloat(process.argv[5] || '3.7'),
      zHi = parseFloat(process.argv[6] || '4.4'),
      cols = parseInt(process.argv[7] || '80'),
      rows = parseInt(process.argv[8] || '40');
    for (let r = 0; r < rows; r++) {
      const z = zHi - (r * (zHi - zLo)) / (rows - 1);
      let line = '';
      for (let cix = 0; cix < cols; cix++) {
        const y = yLo + (cix * (yHi - yLo)) / (cols - 1);
        // raycast from outside: first true 3D rear-facing hit = what a rear
        // viewer actually sees
        let ch = ' ';
        for (let x = -7.6; x < -3.9; x += 0.02) {
          const P = new THREE.Vector3(x, y, z);
          let bestSlice = null;
          for (const T of tris) {
            const bb = inTri(P, T);
            if (!bb) continue;
            const [w1, w2, w3] = bb;
            const xAt = w1 * T[0].x + w2 * T[1].x + w3 * T[2].x;
            if (Math.abs(xAt - x) > 0.012) continue;
            if (bestSlice && xAt > bestSlice.xAt) continue;
            bestSlice = { bb, T, xAt };
          }
          if (!bestSlice) continue;
          const { bb, T } = bestSlice;
          const [w1, w2, w3] = bb;
          const u = w1 * T[3] + w2 * T[5] + w3 * T[7];
          const v = w1 * T[4] + w2 * T[6] + w3 * T[8];
          const [cr, cg, cb] = sample(u, v);
          const lum = (cr + cg + cb) / 3;
          if (cr > 150 && cr > cg + 40) ch = cr > cg && cg > cb ? '#' : 'R';
          else if (lum > 150) ch = 'o';
          else if (lum > 60) ch = '+';
          else ch = '.';
          break;
        }
        line += ch;
      }
      console.log(line);
    }
    process.exit(0);
  }
  if (process.argv[2] === 'rearface') {
    const bodyMeshes = [];
    g.traverse((o) => {
      if (o.isMesh && /^truck_ply_vcl_garbageTruck_body_lmb_0_[01]$/.test(o.name)) bodyMeshes.push(o);
    });
    let u0 = 1,
      v0 = 1,
      u1 = 0,
      v1 = 0,
      nRear = 0;
    // per-face-cluster UV rects (cluster key = rounded normal)
    const clusters = new Map();
    for (const bodyMesh of bodyMeshes) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      const vA = new THREE.Vector3(),
        vB = new THREE.Vector3(),
        vC = new THREE.Vector3(),
        nrmV = new THREE.Vector3();
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        vA.fromBufferAttribute(pos, i).applyMatrix4(M);
        vB.fromBufferAttribute(pos, i + 1).applyMatrix4(M);
        vC.fromBufferAttribute(pos, i + 2).applyMatrix4(M);
        nrmV.subVectors(vB, vA).cross(new THREE.Vector3().subVectors(vC, vA)).normalize();
        if (nrmV.x < -0.5) {
          nRear++;
          for (const k of [0, 1, 2]) {
            const uu = uv.getX(i + k),
              vv = uv.getY(i + k);
            if (uu < u0) u0 = uu;
            if (uu > u1) u1 = uu;
            if (vv < v0) v0 = vv;
            if (vv > v1) v1 = vv;
          }
          const key = [nrmV.x.toFixed(2), nrmV.y.toFixed(2), nrmV.z.toFixed(2)].join(',');
          let cl = clusters.get(key);
          if (!cl) {
            cl = { n: 0, u0: 1, v0: 1, u1: 0, v1: 0, cx: 0, cz: 0 };
            clusters.set(key, cl);
          }
          cl.n++;
          cl.cx += vA.x;
          cl.cz += vA.z;
          for (const k of [0, 1, 2]) {
            const uu = uv.getX(i + k),
              vv = uv.getY(i + k);
            if (uu < cl.u0) cl.u0 = uu;
            if (uu > cl.u1) cl.u1 = uu;
            if (vv < cl.v0) cl.v0 = vv;
            if (vv > cl.v1) cl.v1 = vv;
          }
        }
      }
    }
    console.log('rear triangles=' + nRear + ' UV rect u:[' + u0.toFixed(4) + ',' + u1.toFixed(4) + '] v:[' + v0.toFixed(4) + ',' + v1.toFixed(4) + ']');
    clusters.forEach((cl, key) => {
      console.log('  face n=(' + key + ') tris=' + cl.n + ' at x=' + (cl.cx / cl.n).toFixed(2) + ' z=' + (cl.cz / cl.n).toFixed(2) + ' UV u:[' + cl.u0.toFixed(4) + ',' + cl.u1.toFixed(4) + '] v:[' + cl.v0.toFixed(4) + ',' + cl.v1.toFixed(4) + ']');
    });
    // the main rear PANEL: triangles whose first vertex lies on the x≈-4 plane
    let rU0 = 1,
      rV0 = 1,
      rU1 = 0,
      rV1 = 0,
      rN = 0;
    const rpA = new THREE.Vector3();
    for (const bodyMesh of bodyMeshes) {
      const pos = bodyMesh.geometry.attributes.position,
        uv = bodyMesh.geometry.attributes.uv;
      const M = bodyMesh.matrixWorld;
      for (let t = 0; t < pos.count / 3; t++) {
        const i = t * 3;
        rpA.fromBufferAttribute(pos, i).applyMatrix4(M);
        if (rpA.x < -3.8 && rpA.x > -4.2) {
          rN++;
          for (const k of [0, 1, 2]) {
            const uu = uv.getX(i + k),
              vv = uv.getY(i + k);
            if (uu < rU0) rU0 = uu;
            if (uu > rU1) rU1 = uu;
            if (vv < rV0) rV0 = vv;
            if (vv > rV1) rV1 = vv;
          }
        }
      }
    }
    console.log('  rear-panel (x in [-4.2,-3.8]) tris=' + rN + ' UV u:[' + rU0.toFixed(4) + ',' + rU1.toFixed(4) + '] v:[' + rV0.toFixed(4) + ',' + rV1.toFixed(4) + ']');
    process.exit(0);
  }

  const results = [];
  const seenTex = new Set();
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.uv) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      TEX_SLOTS.forEach((slot) => {
        const tex = m[slot];
        if (!tex || !tex.image || !tex.image._rgba || seenTex.has(tex)) return;
        seenTex.add(tex);
      const img = tex.image;
      console.log('texture on mesh "' + o.name + '": ' + img.width + 'x' + img.height + ' (flipY=' + tex.flipY + ')');
      const circles = findCircles(img);
      console.log('  orange blobs found: ' + circles.length);
      circles.slice(0, 12).forEach((c, i) => {
        console.log('  [' + i + '] area=' + c.area + ' center=(' + c.cx.toFixed(1) + ',' + c.cy.toFixed(1) + ') r=' + c.r.toFixed(1) + ' fill=' + c.fill.toFixed(2));
      });
      // image pixel -> UV. three.js flipY=true (default): v=1 is the TOP row of the image
      const toUV = (cx, cy) => [cx / img.width, 1 - cy / img.height];
      const tri = buildUVMap(o);
      const M = o.matrixWorld;
      for (const c of circles.slice(0, 12)) {
        const [u, v] = toUV(c.cx, c.cy);
        const hits = uvToWorldAll(tri, M, u, v);
        if (!hits.length) {
          console.log('  !! circle at uv(' + u.toFixed(3) + ',' + v.toFixed(3) + ') has no matching triangle on this mesh');
          continue;
        }
        // same UV region can exist on several faces: the painted rear circles live on rear-facing
        // OUTER faces — pick the candidate most rearward (-X) and, on ties, the most outer (min x)
        const rearV = new THREE.Vector3(-1, 0, 0);
        hits.sort((h1, h2) => h2.n.dot(rearV) - h1.n.dot(rearV) || h1.p.x - h2.p.x);
        const best = hits[0];
        // local UV->world scale via affine fit over the rear face patch around the hit
        const scl = faceAffine(tri, M, best.p, 0.5);
        const rU = scl ? (c.r / img.width) * scl[0] : 0;
        const rV = scl ? (c.r / img.height) * scl[1] : 0;
        const onRear = best.n.dot(rearV) > 0.5 && best.p.x < -3.5;
        console.log(
          (onRear ? '  >> REAR CIRCLE ' : '     (elsewhere) ') +
            'pos=[' + best.p.x.toFixed(4) + ', ' + best.p.y.toFixed(4) + ', ' + best.p.z.toFixed(4) + '] ' +
            'rU=' + rU.toFixed(4) + ' rV=' + rV.toFixed(4) + ' normal=[' + best.n.x.toFixed(3) + ',' + best.n.y.toFixed(3) + ',' + best.n.z.toFixed(3) + ']',
        );
        if (onRear) results.push({ mesh: o.name, uv: [u, v], pos: [best.p.x, best.p.y, best.p.z], rU, rV, normal: [best.n.x, best.n.y, best.n.z], texR: c.r, W: img.width, H: img.height });
      }
      });
    });
  });
  console.log('\n==== JSON for buildTruck ====');
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error('MEASURE FAILED: ' + e.stack);
  process.exit(1);
});





