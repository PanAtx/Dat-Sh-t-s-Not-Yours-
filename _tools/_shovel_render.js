// _tools/_shovel_render.js — face-sampled ASCII views of makeShovelProp from index.html.
const fs = require("fs");
eval(fs.readFileSync("three_r128.min.js", "utf8"));
const T = globalThis.THREE || exports;
const h = fs.readFileSync("index.html", "utf8");
function sf(n) {
  let i = h.indexOf("function " + n + "("), d = 0, j = h.indexOf("{", i);
  for (let k = j; k < h.length; k++) { if (h[k] === "{") d++; else if (h[k] === "}") { d--; if (!d) return h.slice(i, k + 1); } }
  throw new Error(n);
}
const M = (c) => new T.MeshLambertMaterial({ color: c });
const BX = (w, hh, dd, m) => new T.Mesh(new T.BoxGeometry(w, hh, dd), m);
const CY = (a, b, hh, m, s) => new T.Mesh(new T.CylinderGeometry(a, b, hh, s || 10), m);
const SP = (r, m, s) => new T.Mesh(new T.SphereGeometry(r, s || 8, s || 6), m);
const make = new Function("THREE", "M", "BX", "CY", "SP", sf("makeShovelProp") + ";return makeShovelProp;")(T, M, BX, CY, SP);
const g = make();
g.updateMatrixWorld(true);
function view(title, ax, ay, ox, oy, cell, W, H) {
  const G = Array.from({ length: H }, () => Array(W + 1).fill(" "));
  const v = new T.Vector3();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const hx = o.material.color.getHex();
    const ch = hx === 0xc9a46a ? "W" : hx === 0x23262b ? "g" : hx === 0xdfe6ee ? "=" : "#";
    const pts = [];
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const A = idx.getX(i), B = idx.getX(i + 1), C = idx.getX(i + 2);
        pts.push([A, B, C], [(A + B) / 2 | 0, (B + C) / 2 | 0, (C + A) / 2 | 0], [A, (A + B) / 2 | 0, (A + C) / 2 | 0], [B, (B + A) / 2 | 0, (B + C) / 2 | 0], [C, (C + A) / 2 | 0, (C + B) / 2 | 0]);
      }
    }
    const n = idx ? pts.length : pos.count;
    for (let i = 0; i < (idx ? pts.length : pos.count); i++) {
      if (idx) {
        const tri = pts[i];
        for (const vi of tri) {
          v.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
          plot(v, G, ax, ay, ox, oy, cell, W, H, ch);
        }
      } else {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        plot(v, G, ax, ay, ox, oy, cell, W, H, ch);
      }
    }
  });
  console.log("== " + title + " ==");
  console.log(G.map((r) => r.join("").replace(/\s+$/, "")).join("\n").replace(/^\n+/, ""));
}
function plot(v, G, ax, ay, ox, oy, cell, W, H, ch) {
  const c = Math.round((v[ax] - ox) / cell), r = H - 1 - Math.round((v[ay] - oy) / cell);
  if (r >= 0 && r < H && c >= 0 && c <= W) G[r][c] = ch;
}
view("SIDE (x=butt->tip, z=up)", "x", "z", 0, -0.18, 0.024, 76, 24);
view("FRONT (y=across, z=up) — the deep dish", "y", "z", -0.38, -0.18, 0.024, 40, 20);
view("TOP (x=butt->tip = down, y=across)", "x", "y", 1.1, -0.38, 0.022, 40, 34);
