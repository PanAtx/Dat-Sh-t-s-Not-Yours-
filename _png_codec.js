// Minimal pure-JS PNG 8-bit (color types 2 & 6) codec, built on the repo's fflate.min.js.
// Enough to decode the truck's basecolor texture and write downscaled previews.
'use strict';
const fs = require('fs');
const { unzlibSync, deflateSync } = require('./fflate.min.js');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tag, data) {
  data = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(tag, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Decode a 2048x2048 (or any WxH) 8-bit RGB/RGBA PNG into a {w,h,px:Buffer RGBA} object.
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8;
  let w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const tag = buf.toString('ascii', o + 4, o + 8);
    const data = buf.slice(o + 8, o + 8 + len);
    if (tag === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bd = data[8]; ct = data[9];
      if (bd !== 8) throw new Error('unsupported bit depth ' + bd);
      if (ct !== 2 && ct !== 6) throw new Error('unsupported color type ' + ct);
    } else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    o += 12 + len;
  }
  const c = ct === 6 ? 4 : 3;
  const raw = unzlibSync(Buffer.concat(idat));
  const stride = w * c;
  const cur = Buffer.alloc(stride);
  const px = Buffer.alloc(w * h * 4);
  let p = 0;
  let prevRow = null;
  function paeth(a, b, d) {
    const pp = a + b - d;
    const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - d);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : d;
  }
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i];
      const a = i >= c ? cur[i - c] : 0;
      const b = y > 0 && prevRow ? prevRow[i] : 0;
      const d = i >= c && y > 0 && prevRow ? prevRow[i - c] : 0;
      let v = x;
      if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else if (f === 4) v = x + paeth(a, b, d);
      cur[i] = v & 0xff;
    }
    p += stride;
    for (let x = 0; x < w; x++) {
      const o = y * w * 4 + x * 4;
      px[o] = cur[x * c]; px[o + 1] = cur[x * c + 1]; px[o + 2] = cur[x * c + 2];
      px[o + 3] = c === 4 ? cur[x * c + 3] : 255;
    }
    prevRow = Buffer.from(cur);
  }
  return { w, h, px };
}

// Encode RGBA {w,h,px} to PNG bytes (filter 0).
function encodePng(w, h, px) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    px.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Box-average downscale (factor 2).
function downscale2(img) {
  const w = img.w >> 1, h = img.h >> 1;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = ((y * 2 + dy) * img.w + (x * 2 + dx)) * 4;
        r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; a += img.px[i + 3];
      }
      const o = (y * w + x) * 4;
      px[o] = r >> 2; px[o + 1] = g >> 2; px[o + 2] = b >> 2; px[o + 3] = a >> 2;
    }
  }
  return { w, h, px };
}

module.exports = { decodePng, encodePng, downscale2 };

if (require.main === module) {
  const src = process.argv[2] || '_nyc_truck_basecolor.png';
  const dst = process.argv[3] || '_nyc_truck_basecolor_1k.png';
  const factor = parseInt(process.argv[4] || '2', 10);
  let img = decodePng(fs.readFileSync(src));
  console.log('decoded', img.w + 'x' + img.h);
  for (let i = 0; i < factor; i++) img = downscale2(img);
  fs.writeFileSync(dst, encodePng(img.w, img.h, img.px));
  console.log('wrote', dst, img.w + 'x' + img.h);
}
