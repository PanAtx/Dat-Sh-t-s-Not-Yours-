// Crop regions of the truck basecolor texture around the orange clusters so we can view them.
import fs from 'fs';
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);
const { decodePng, encodePng } = require2('./_png_codec.js');

const tex = decodePng(fs.readFileSync('_nyc_truck_basecolor.png'));
function crop(cx, cy, half, dst, scale = 1) {
  const x0 = Math.max(0, cx - half), y0 = Math.max(0, cy - half);
  const x1 = Math.min(tex.w, cx + half), y1 = Math.min(tex.h, cy + half);
  const w = x1 - x0, h = y1 - y0;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) tex.px.copy(px, y * w * 4, ((y0 + y) * tex.w + x0) * 4, ((y0 + y) * tex.w + x0 + w) * 4);
  fs.writeFileSync(dst, encodePng(w, h, px));
  console.log('wrote', dst, w + 'x' + h);
}
// orange cluster centers (from the analyze scan)
crop(1122, 1860, 220, '_crop_orange_0.png');
crop(1359, 446, 220, '_crop_orange_1.png');
crop(1204, 53, 200, '_crop_orange_2.png');
crop(1211, 1018, 220, '_crop_orange_3.png');
// plus a wide view of the whole right/bottom quadrant where most orange is
crop(1200, 1450, 480, '_crop_orange_wide.png');
