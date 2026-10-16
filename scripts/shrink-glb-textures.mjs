// scripts/shrink-glb-textures.mjs - THE TEXTURE BUDGET, BAKED OFFLINE (v1.0.560)
//
// WHAT: walks the shipped *.glb models; for every embedded image wider or taller than MAX_TEX
// (1024) it re-samples and re-encodes the sheet in place, then re-packs the GLB's BIN chunk with
// fresh bufferView offsets. The geometry is NOT touched - the Draco meshes, accessors, materials,
// UV channels and texture slots stay byte-identical; only the image bytes and the offsets that
// point at them change.
//
// WHY: nyc_truck / nyc_can / bec each carry three 2048² sheets. On an iPhone that is 16.8 MB of
// RGBA upload per sheet (22 MB with mipmaps) - ~221 MB of GPU memory for artwork that paints a
// truck across a few hundred pixels of a 320-540p buffer. iOS jetsam counts GPU memory, so the
// oversized sheets are a crash risk, not only a cost. At 1024² the same art costs a quarter of the
// texels, and the site stops shipping payload a phone cannot use. index.html carries the RUNTIME
// half of the same law (MAX_TEX / clampGltfTextures), so a player who already cached the big
// sheets never uploads them either.
//
// HOW (needs ffmpeg, which the repo's tool scripts already rely on):
//   GLB -> JSON + BIN chunks; per image: bufferView slice -> tmp
//   ffmpeg -i in -vf scale<=MAX_TEX (aspect kept, lanczos) -c:v libwebp -quality Q out
//   re-pack: every bufferView copied in order, ALIGN-byte padded, offsets rewritten;
//   JSON padded with spaces, BIN with zeros; buffer.byteLength + total length updated.
//
// USAGE:
//   node scripts/shrink-glb-textures.mjs            // report only (writes nothing)
//   node scripts/shrink-glb-textures.mjs --bake     // rewrite the GLBs in place
//   node scripts/shrink-glb-textures.mjs --verify   // prove every shipped GLB is in budget
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_TEX = 1024;
const QUALITY = 82;
const ALIGN = 8; // component sizes top out at 8 bytes, so this covers every accessor
const ROOT = path.join(__dirname, "..");
const MODELS = execFileSync("git", ["ls-files", "-z", "--", "*.glb"], { cwd: ROOT })
  .toString("utf8")
  .split("\0")
  .filter((f) => f && fs.existsSync(path.join(ROOT, f)));
function parseGLB(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  if (b.subarray(0, 4).toString("latin1") !== "glTF") throw new Error(file + " is not a GLB");
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8").replace(/\u0000+$/, ""));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  if (!json || !bin) throw new Error(file + " has no JSON+BIN chunks");
  return { json, bin };
}
// Real image dimensions, read from the container (WebP VP8X / VP8L / VP8; PNG; JPEG).
function imageDims(buf, mime) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc8 && m !== 0xcc)
        return { w: buf.readUInt16BE(i + 5), h: buf.readUInt16BE(i + 3), kind: "jpeg" };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { w: 0, h: 0, kind: "jpeg" };
  }
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") {
    const tag = buf.subarray(12, 16).toString("latin1");
    // VP8X (extended): canvas (w-1, h-1) 24-bit LE at 24 / 27.
    if (tag === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), kind: "webp" };
    // VP8L (lossless): a 0xFF signature byte at 20, then width-1 (14 bits) + height-1 at 21.
    if (tag === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff), kind: "webp" };
    }
    // VP8  (lossy): the 3-byte sync code 9d 01 2a, then the 14-bit horizontal / vertical sizes
    // PLAIN (this one is not "minus one" - VP8L is). Verified on the shipped sheets: the can's
    // 2048² reads 00 08 00 08 at 26, the Red Bull's 2048x1024 reads 00 08 00 04.
    if (tag === "VP8 ")
      return { w: (buf[26] | (buf[27] << 8)) & 0x3fff, h: (buf[28] | (buf[29] << 8)) & 0x3fff, kind: "webp" };
  }
  return { w: 0, h: 0, kind: mime || "unknown" };
}
function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y"].concat(args), { stdio: "pipe" });
}
// The re-bake of ONE image blob; null when the sheet is already inside the budget.
function shrinkImage(buf, mime, tmp, idx) {
  const d = imageDims(buf, mime);
  if (!d.w || !d.h) throw new Error("cannot read the dimensions of texture " + idx + " (" + d.kind + ")");
  if (d.w <= MAX_TEX && d.h <= MAX_TEX) return null;
  const src = path.join(tmp, idx + ".src");
  const dst = path.join(tmp, idx + ".out.webp");
  fs.writeFileSync(src, buf);
  ffmpeg([
    "-i", src,
    "-vf", "scale='min(" + MAX_TEX + ",iw)':'min(" + MAX_TEX + ",ih)':force_original_aspect_ratio=decrease:flags=lanczos",
    "-c:v", "libwebp", "-quality", String(QUALITY),
    dst,
  ]);
  const out = fs.readFileSync(dst);
  const nd = imageDims(out, "image/webp");
  if (!nd.w || nd.w > MAX_TEX || nd.h > MAX_TEX) throw new Error("the re-encode left a " + nd.w + "x" + nd.h + " sheet");
  return { bytes: out, from: d.w + "x" + d.h, to: nd.w + "x" + nd.h };
}
// Re-pack the BIN: every bufferView copied in order with ALIGN padding, offsets rewritten.
function repack(json, bin, overrides) {
  const views = json.bufferViews || [];
  const parts = [], newOff = [];
  let cursor = 0;
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const data = overrides.has(i) ? overrides.get(i) : bin.subarray(v.byteOffset, v.byteOffset + v.byteLength);
    newOff.push(cursor);
    parts.push(data);
    // THE VIEW MUST DESCRIBE ITS OWN BYTES: a re-baked (smaller) sheet leaves the old byteLength
    // pointing past its data into the next view, which is invalid GLB even though image decoders
    // tolerate it by stopping at the format's end-of-image marker.
    v.byteLength = data.length;
    v.byteOffset = cursor;
    cursor += data.length + ((ALIGN - (data.length % ALIGN)) % ALIGN);
  }
  const newBin = Buffer.alloc(cursor);
  for (let i = 0; i < parts.length; i++) parts[i].copy(newBin, newOff[i]);
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = cursor;
  return { bin: newBin, json };
}
function writeGLB(file, json, bin) {
  let js = JSON.stringify(json);
  while (js.length % 4) js += " "; // GLB spec: the JSON chunk is space-padded to a 4-byte multiple
  const jsonBuf = Buffer.from(js, "utf8");
  const binBuf = Buffer.concat([bin, Buffer.alloc((ALIGN - (bin.length % ALIGN)) % ALIGN)]);
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length;
  const head = Buffer.alloc(12);
  head.write("glTF", 0, "latin1");
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path.join(ROOT, file), Buffer.concat([head, jh, jsonBuf, bh, binBuf]));
  return total;
}
const BAKE = process.argv.includes("--bake");
const VERIFY = process.argv.includes("--verify");
const TMP = path.join(ROOT, BAKE ? "_texbake_tmp" : "_texreport_tmp");
fs.mkdirSync(TMP, { recursive: true });
let grandTexels = 0, grandPayload = 0, shrank = 0, filesChanged = 0;
for (const file of MODELS) {
  const { json, bin } = parseGLB(file);
  const overrides = new Map();
  const lines = [];
  let texels = 0, payload = 0;
  (json.images || []).forEach((im, i) => {
    if (im.bufferView === undefined) return;
    const bv = json.bufferViews[im.bufferView];
    const buf = bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength);
    const d = imageDims(buf, im.mimeType);
    texels += d.w * d.h;
    payload += bv.byteLength;
    if (BAKE && (d.w > MAX_TEX || d.h > MAX_TEX)) {
      const r = shrinkImage(buf, im.mimeType, TMP, i);
      if (r) {
        overrides.set(im.bufferView, r.bytes);
        lines.push("  re-baked img" + i + " " + r.from + " -> " + r.to + "  " +
          (bv.byteLength / 1024).toFixed(0) + "KB -> " + (r.bytes.length / 1024).toFixed(0) + "KB");
        shrank++;
      }
    }
  });
  grandTexels += texels;
  grandPayload += payload;
  console.log("[" + file + "] " + (fs.statSync(path.join(ROOT, file)).size / 1048576).toFixed(2) + "MB" +
    "  images=" + (json.images || []).length +
    "  texels=" + (texels / 1e6).toFixed(1) + "M (GPU ~" + (texels * 5.33 / 1048576).toFixed(1) + "MB)" +
    "  texture bytes=" + (payload / 1048576).toFixed(2) + "MB" +
    (overrides.size ? "  -> " + overrides.size + " sheet(s) over " + MAX_TEX : ""));
  lines.forEach((l) => console.log(l));
  if (BAKE && overrides.size) {
    const packed = repack(json, bin, overrides);
    const total = writeGLB(file, packed.json, packed.bin);
    filesChanged++;
    console.log("  wrote " + file + " at " + (total / 1048576).toFixed(2) + "MB");
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log("");
console.log("MODELS " + MODELS.length + ": texture payload " + (grandPayload / 1048576).toFixed(2) + "MB," +
  " texels " + (grandTexels / 1e6).toFixed(1) + "M (GPU ~" + (grandTexels * 5.33 / 1048576).toFixed(0) + "MB)," +
  " sheets re-baked " + shrank);
if (BAKE) console.log("files written " + filesChanged + " - re-run _compressed_models_chk.mjs + _pickup_compressed_chk.mjs: they DECODE these files for real");
if (VERIFY) {
  const over = [];
  for (const file of MODELS) {
    const { json, bin } = parseGLB(file);
    (json.images || []).forEach((im, i) => {
      if (im.bufferView === undefined) return;
      const bv = json.bufferViews[im.bufferView];
      const d = imageDims(bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength), im.mimeType);
      if (d.w > MAX_TEX || d.h > MAX_TEX) over.push(file + " img" + i + " " + d.w + "x" + d.h);
    });
  }
  console.log(over.length
    ? "VERIFY FAILED: over budget - " + over.join(", ")
    : "VERIFY OK: every shipped texture sits at most " + MAX_TEX + "px on the side (" + (grandPayload / 1048576).toFixed(2) + "MB of image bytes)");
  process.exit(over.length ? 1 : 0);
}


