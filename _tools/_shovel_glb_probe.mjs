// _tools/_shovel_glb_probe.mjs — decodes shovel.glb POSITIONs and prints a profile:
// for bins along the length axis: half-width (max |x|), z-spread, vertex count.
import fs from "fs";
const b = fs.readFileSync("shovel.glb");
const js = JSON.parse(b.slice(20, 20 + 2304).toString("utf8"));
const acc = js.accessors[0]; // POSITION
const bv = js.bufferViews[acc.bufferView];
const binStart = (() => {
  let off = 12;
  for (;;) {
    const cl = b.readUInt32LE(off), ct = b.readUInt32LE(off + 4);
    if (ct !== 0x4e4f536a && ct !== 1) return off + 8; // first non-JSON chunk = BIN
    off += 8 + cl;
  }
})();
const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
const base = binStart + (bv.byteOffset || 0);
const n = acc.count;
const f = new Float32Array(buf.buffer, buf.byteOffset + base, (bv.byteLength || n * 12) / 4);
const off = (acc.byteOffset || 0) / 4;
console.log("verts:", n, "tris:", js.accessors[3].count / 3);
const B = 38, yMin = -0.96, yMax = 0.96, span = (yMax - yMin) / B;
const rows = [];
for (let i = 0; i < B; i++) {
  const y0 = yMin + i * span, y1 = y0 + span;
  let cnt = 0, ax = 0, azmin = 9, azmax = -9;
  for (let v = 0; v < n; v++) {
    const len = f[off + v * 3], thk = f[off + v * 3 + 1], wid = f[off + v * 3 + 2];
    if (len >= y0 && len < y1) {
      cnt++;
      if (Math.abs(wid) > ax) ax = Math.abs(wid);
      if (thk < azmin) azmin = thk;
      if (thk > azmax) azmax = thk;
    }
  }
  rows.push([y0.toFixed(2), cnt, ax.toFixed(3), (azmax - azmin).toFixed(3)]);
}
console.log("len      verts  halfW  thick");
rows.forEach((r) => console.log(r.join("  ")));