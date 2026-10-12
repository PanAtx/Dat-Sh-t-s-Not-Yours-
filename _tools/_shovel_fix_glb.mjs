// _tools/_shovel_fix_glb.mjs — DECISION RECORD: do NOT use its output in the game.
// The index field 5125 (glTF 2.0 UNSIGNED_BYTE) on UNSIGNED_INT-packed data IS what
// the game's bundled GLTFLoader.js reads correctly: that loader predates the 2.0
// constants (WEBGL_COMPONENT_TYPES: 5123 -> Uint16Array, 5125 -> Uint32Array), so
// shovel.glb already builds a clean 59,184-tri mesh through it (audited in
// _shovel_loader_debug.js: area sum 1.053, median tri 2.66e-6). "Repairing" the
// field to 5123 makes THIS loader read u16 and renders a degenerate soup — exactly
// the garbling seen in-game; the script is kept only as documentation + a raw-data
// inspector. ARCHIVED (10/2026): shovel.glb is DELETED — the game loads the Draco twin
// shovelcompressed.glb, whose no-soup caveat is gone (standard 2.0 accessors). This
// raw-JSON inspector documents the original; re-extract it with: git show HEAD:shovel.glb
import fs from "fs";
const b = fs.readFileSync("shovel.glb");
const jsonLen = b.readUInt32LE(12);
const jsonTxt = b.slice(20, 20 + jsonLen).toString("utf8");
const at = jsonTxt.indexOf('"componentType":5125');
if (at < 0) throw new Error("no 5125 index accessor found — file shape changed?");
const fixed = jsonTxt.replace('"componentType":5125', '"componentType":5123');
if (fixed.length !== jsonTxt.length || Buffer.byteLength(fixed, "utf8") !== jsonLen) throw new Error("JSON length changed — chunk offsets would shift; abort");
const out = Buffer.from(b);
Buffer.from(fixed, "utf8").copy(out, 20);
// real index stats (u32)
const js = JSON.parse(fixed);
const binStart = 20 + jsonLen + 8; // skip the BIN chunk's own 8-byte header
const n = js.accessors[3].count;
const ia = new Uint32Array(out.buffer.slice(out.byteOffset + binStart, out.byteOffset + binStart + n * 4));
let mn = 1e9, mx = -1;
for (let i = 0; i < ia.length; i++) { if (ia[i] < mn) mn = ia[i]; if (ia[i] > mx) mx = ia[i]; }
console.log("indices", n, "min", mn, "max", mx, "verts", js.accessors[0].count, mx < js.accessors[0].count ? "OK (indexable)" : "OUT OF RANGE!");
const pos = new Float32Array(out.buffer.slice(out.byteOffset + binStart + js.bufferViews[js.accessors[0].bufferView].byteOffset, out.byteOffset + binStart + js.bufferViews[js.accessors[0].bufferView].byteOffset + js.bufferViews[js.accessors[0].bufferView].byteLength));
let dmin = [9, 9, 9], dmax = [-9, -9, -9];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < dmin[k]) dmin[k] = v; if (v > dmax[k]) dmax[k] = v; }
console.log("triangles", n / 3, "bbox x", dmin[0].toFixed(3), dmax[0].toFixed(3), "y", dmin[1].toFixed(3), dmax[1].toFixed(3), "z", dmin[2].toFixed(3), dmax[2].toFixed(3));
fs.writeFileSync("shovel-fixed.glb", out);
console.log("shovel-fixed.glb written:", out.length, "bytes");