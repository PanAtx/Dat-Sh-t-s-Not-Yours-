const fs = require('fs');
const vm = require('vm');
const sandbox = { console, window: {}, self: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('three_r128.min.js', 'utf8'), sandbox);
const T = sandbox.THREE || sandbox.window.THREE;
console.log('THREE loaded:', !!T, 'triangulateShape:', typeof (T && T.ShapeUtils && T.ShapeUtils.triangulateShape));
const sil = [
  [1.66, 0.15], [1.79, 0.05], [1.8, -0.05], [1.66, -0.15],
  [1.35, -0.15], [1.28, -0.29], [1.05, -0.55], [0.8, -0.6],
  [0.6, -0.6], [0.55, -0.42], [0.3, -0.38], [0.25, -0.35],
  [0.03, -0.35], [0.0, -0.24],
  [0.03, 0.35], [0.25, 0.35], [0.3, 0.38], [0.55, 0.42],
  [0.6, 0.6], [0.8, 0.6], [1.05, 0.55], [1.28, 0.29],
  [1.35, 0.15],
];
const offsetSil = (pts, dist) => {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  area /= 2;
  const sgn = area > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    const e1x = cur[0] - prev[0], e1y = cur[1] - prev[1];
    const e2x = next[0] - cur[0], e2y = next[1] - cur[1];
    const n1x = e1y * sgn, n1y = -e1x * sgn;
    const n2x = e2y * sgn, n2y = -e2x * sgn;
    const l1 = Math.hypot(n1x, n1y) || 1, l2 = Math.hypot(n2x, n2y) || 1;
    const nx = n1x / l1 + n2x / l2, ny = n1y / l1 + n2y / l2;
    const ln = Math.hypot(nx, ny) || 1;
    out.push([cur[0] + (nx / ln) * dist, cur[1] + (ny / ln) * dist]);
  }
  return out;
};
const toV2 = (pts) => pts.map((p) => new T.Vector2(p[0], p[1]));
const outerPts = toV2(offsetSil(sil, 0.05));
const innerPts = toV2(offsetSil(sil, -0.05));
const tri = T.ShapeUtils.triangulateShape(outerPts, [innerPts]);
const all = outerPts.concat(innerPts);
console.log('tri indices:', tri.length, 'first:', tri.slice(0, 6));
// coverage check: area of triangulation vs expected ring area
function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
function triArea(idx) {
  const a = all[idx[0]], b = all[idx[1]], c = all[idx[2]];
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}
let covered = 0;
for (let i = 0; i < tri.length; i += 3) {
  const a = all[tri[i]], b = all[tri[i + 1]], c = all[tri[i + 2]];
  covered += Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}
console.log('outer area:', polyArea(outerPts).toFixed(4), 'inner area:', polyArea(innerPts).toFixed(4), 'ring area:', (polyArea(outerPts) - polyArea(innerPts)).toFixed(4), 'tri-covered:', covered.toFixed(4));
// self-intersection check for the offset contours
function segInt(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9;
}
function selfX(pts) {
  const n = pts.length, bad = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segInt(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) bad.push([i, j]);
    }
  return bad;
}
console.log('outer self-intersections:', selfX(offsetSil(sil, 0.05)).length);
console.log('inner self-intersections:', selfX(offsetSil(sil, -0.05)).length);
const pos = [], uv = [], nrm = [];
for (const p of all) { pos.push(p.x, p.y, 0); uv.push(p.x, p.y); nrm.push(0, 0, 1); }
console.log('pos count:', pos.length, '(expect', all.length * 3, ')');
const geo = new T.BufferGeometry();
geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
geo.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
geo.setIndex(tri);
geo.computeBoundingSphere();
console.log('bounds center:', geo.boundingSphere.center.toArray().map((v) => v.toFixed(2)));
console.log('bounds radius:', geo.boundingSphere.radius.toFixed(3));
console.log('index count:', geo.index.array.length, 'vertex count:', geo.attributes.position.count);
// also verify the OLD path really is broken in this build:
const sh = new T.Shape(outerPts);
try { new T.ShapeGeometry(sh); console.log('OLD ShapeGeometry(Shape): OK (unexpected)'); }
catch (e) { console.log('OLD ShapeGeometry(Shape) throws:', e.message); }
try { new T.ShapeGeometry(outerPts.map((p) => new T.Vector3(p.x, p.y, 0))); console.log('OLD ShapeGeometry([Vector3]): OK (unexpected)'); }
catch (e) { console.log('OLD ShapeGeometry([Vector3]) throws:', e.message); }
