#!/usr/bin/env node
/* ============================================================================
   THE TEXTURE BUDGET (v1.0.560) - THE GPU-MEMORY CEILING ON THE SHIPPED MODELS
   ----------------------------------------------------------------------------
   The mobile audit found the single biggest memory number in the shift: the truck / trash-can /
   BEC models each carried three 2048² sheets - 4.2 M texels (16.8 MB of RGBA, 22 MB with mipmaps)
   per sheet to paint a truck that covers a few hundred pixels of a 320-540p buffer. 41.8 M texels
   = ~213 MB of GPU upload, and iOS counts GPU memory when it decides which tab to kill.
   THE LAW THIS SUITE ENFORCES (both halves):
     1) THE OFFLINE HALF - no embedded image in any shipped *.glb is above MAX_TEX (1024) on the
        side (scripts/shrink-glb-textures.mjs bakes that), the whole set stays inside a texture
        payload ceiling, and every file remains a STRUCTURALLY VALID GLB (header length matches
        the file, every bufferView sits inside the BIN, the buffer's declared length matches) -
        the re-bake re-packs offsets, so a tool bug that points a view past its data goes red HERE.
     2) THE RUNTIME HALF - index.html clamps every model's materials at the loader choke (8 GLB
        success callbacks), the clamp keeps the aspect, marks needsUpdate, and the ceiling is
        MAX_TEX = 1024.
     3) THE CACHE HALF - a re-baked asset is a NEW asset: the per-asset cache version map names
        it (so an installed phone stops serving the stale big-sheet bytes) and THE BYTE-ACCURATE
        PRELOAD TABLE carries each model's real bytes (the asset gate's progress + ETA are
        computed from those numbers).
   Run: node _gltf_texture_budget_chk.mjs
   ========================================================================== */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const MODELS = execFileSync("git", ["ls-files", "-z", "--", "*.glb"], { cwd: DIR })
  .toString("utf8").split("\0").filter((f) => f && fs.existsSync(path.join(DIR, f)));
const MAX_TEX = 1024;
const PAYLOAD_CEILING = 1.6 * 1048576; // bytes of embedded image the shipped set may carry
const GPU_CEILING_MB = 96; // texels * 4 bytes * 1.333 mipmaps, in MB
let pass = 0, fail = 0;
const check = (name, ok, got) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (got !== undefined ? "  [" + got + "]" : "")); }
};
function parseGLB(file) {
  const b = fs.readFileSync(path.join(DIR, file));
  if (b.subarray(0, 4).toString("latin1") !== "glTF") throw new Error(file + " is not a GLB");
  let off = 12, json = null, bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8").replace(/\u0000+$/, ""));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  return { b, json, bin, headerLen: b.readUInt32LE(8) };
}
function imageDims(buf, mime) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc8 && m !== 0xcc)
        return { w: buf.readUInt16BE(i + 5), h: buf.readUInt16BE(i + 3) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { w: 0, h: 0 };
  }
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") {
    const tag = buf.subarray(12, 16).toString("latin1");
    if (tag === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (tag === "VP8L") { const bits = buf.readUInt32LE(21); return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) }; }
    if (tag === "VP8 ") return { w: (buf[26] | (buf[27] << 8)) & 0x3fff, h: (buf[28] | (buf[29] << 8)) & 0x3fff };
  }
  return { w: 0, h: 0 };
}
console.log("");
console.log("[1] THE SHIPPED MODELS ARE INSIDE THE CEILING");
let texels = 0, payload = 0, files = 0, over = [], invalid = [];
for (const f of MODELS) {
  const { b, json, bin, headerLen } = parseGLB(f);
  files++;
  const bad = [];
  if (b.length !== headerLen) bad.push("header length " + headerLen + " vs file " + b.length);
  const declared = json.buffers && json.buffers[0] ? json.buffers[0].byteLength : 0;
  if (declared > bin.length) bad.push("buffer.byteLength " + declared + " past the BIN (" + bin.length + ")");
  (json.bufferViews || []).forEach((v, i) => {
    if (v.byteOffset === undefined || v.byteLength === undefined) bad.push("view" + i + " has no offset/length");
    else if (v.byteOffset + v.byteLength > bin.length) bad.push("view" + i + " runs past the BIN");
    else if (v.byteLength <= 0) bad.push("view" + i + " has length " + v.byteLength);
  });
  if (bad.length) invalid.push(f + ": " + bad.join("; "));
  (json.images || []).forEach((im, i) => {
    if (im.bufferView === undefined) return;
    const bv = json.bufferViews[im.bufferView];
    const d = imageDims(bin.subarray(bv.byteOffset, bv.byteOffset + bv.byteLength), im.mimeType);
    texels += d.w * d.h;
    payload += bv.byteLength;
    if (d.w > MAX_TEX || d.h > MAX_TEX) over.push(f + " img" + i + " " + d.w + "x" + d.h);
  });
}
const gpuMb = (texels * 4 * 1.333) / 1048576;
check("every shipped *.glb is a GLB (files read: " + files + ")", files >= 6, files);
check("no embedded image is above " + MAX_TEX + "px on the side (the offline half of the budget)",
  over.length === 0, over.join(", "));
check("the whole set carries at most " + (PAYLOAD_CEILING / 1048576).toFixed(1) + "MB of image bytes (it carries " +
  (payload / 1048576).toFixed(2) + "MB - the audit found 4.41MB)",
  payload <= PAYLOAD_CEILING, (payload / 1048576).toFixed(2) + "MB");
check("the model textures fit in at most " + GPU_CEILING_MB + "MB of GPU upload (the audit measured ~213MB; now " +
  gpuMb.toFixed(0) + "MB)",
  gpuMb <= GPU_CEILING_MB, gpuMb.toFixed(0) + "MB from " + (texels / 1e6).toFixed(1) + "M texels");
check("THE RE-BAKE KEPT THE FILES VALID: header / buffer length / every bufferView inside the BIN",
  invalid.length === 0, invalid.join(" | "));
console.log("");
console.log("[2] THE PAGE CLAMPS AT THE LOADER CHOKE (the runtime half)");
check("index.html declares the ceiling MAX_TEX = 1024",
  /const MAX_TEX = 1024;/.test(html));
check("every GLB success callback clamps its materials (8 loader sites, one law)",
  (html.match(/clampGltfTextures\(gltf\); \/\/ THE TEXTURE BUDGET/g) || []).length === 8,
  "sites=" + (html.match(/clampGltfTextures\(gltf\);/g) || []).length);
check("the clamp re-samples with the aspect kept and hands three the new image (needsUpdate)",
  /var k = MAX_TEX \/ Math\.max\(w, h\);/.test(html) &&
    /c\.width = Math\.max\(1, Math\.round\(w \* k\)\);/.test(html) &&
    /tex\.image = c;\s*\r?\n\s*tex\.needsUpdate = true;/.test(html));
check("a sheet already inside the budget is never touched (no pointless re-blit on hi-end assets)",
  /if \(!w \|\| !h \|\| \(w <= MAX_TEX && h <= MAX_TEX\)\) return 0;/.test(html));
check("every sampled map is covered (map / normal / roughness / metalness / emissive / ao / alpha / bump / displacement)",
  /"map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap", "bumpMap", "displacementMap"/.test(html));
check("the clamp counts what it re-sampled (TEX_BUDGET_CLAMPS) - the ledger reports what the budget cost",
  /var TEX_BUDGET_CLAMPS = 0;/.test(html) && /TEX_BUDGET_CLAMPS \+= n;/.test(html));
console.log("");
console.log("[3] THE CACHES KNOW THE NEW BYTES (a re-baked asset is a new asset)");
const table = [...html.matchAll(/url: "([^"]+\.glb)",\s*\r?\n?\s*size: (\d+)/g)];
check("the byte-accurate PRELOAD table lists every shipped model",
  table.length >= MODELS.length, table.length + " glb rows vs " + MODELS.length + " files");
const stale = [];
table.forEach(([_, url, size]) => {
  const real = fs.existsSync(path.join(DIR, url)) ? fs.statSync(path.join(DIR, url)).size : -1;
  if (real !== parseInt(size, 10)) stale.push(url + " table " + size + " vs disk " + real);
});
check("every model row's size equals the file's real bytes (progress + ETA depend on it)",
  stale.length === 0, stale.join(" | "));
const reBaked = ["nyc_truck-compressed.glb", "bec-compressed.glb", "nyc_can-compressed.glb", "red_bull_energy_drink_can-compressed.glb"];
const vBlock = html.slice(html.indexOf("const _modelCacheVersions = {"), html.indexOf("function _modelCacheKey"));
const missing = reBaked.filter((f) => !new RegExp('"' + f.replace(/\./g, "\\.") + '": [1-9]').test(vBlock));
check("every re-baked model carries a per-asset cache version (an installed phone must stop serving its old bytes)",
  missing.length === 0, missing.join(", "));
check("the offline bake tool is tracked (scripts/shrink-glb-textures.mjs - report / --bake / --verify)",
  fs.existsSync(path.join(DIR, "scripts/shrink-glb-textures.mjs")) &&
    fs.readFileSync(path.join(DIR, "scripts/shrink-glb-textures.mjs"), "utf8").includes("--verify"));
console.log("");
console.log(fail === 0 ? "TEXTURE BUDGET CHECKS: ALL " + pass + " PASSED" : "TEXTURE BUDGET CHECKS FAILED (" + fail + ")");
process.exit(fail ? 1 : 0);

