// _sv_id3peek.js — walk the ID3v2.4 frame table of a file and print every frame header exactly as
// the bytes say, so a tag edit can be verified frame by frame (and the audio start located).
const fs = require('fs');
const f = process.argv[2];
const buf = fs.readFileSync(f);
const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
console.log(f, '| header', buf.slice(0, 3).toString('latin1'), 'v2.' + buf[3] + '.' + buf[4], 'flags', buf[5], 'declared body', size, 'file', buf.length);
let p = 10;
const end = 10 + size;
while (p + 10 <= end) {
  const id = buf.slice(p, p + 4).toString('latin1');
  const fs_ = ((buf[p + 4] << 21) | (buf[p + 5] << 14) | (buf[p + 6] << 7) | buf[p + 7]) >>> 0;
  const flags = buf[p + 8] * 256 + buf[p + 9];
  const data = buf.slice(p + 10, p + 10 + fs_);
  console.log('  @' + p, JSON.stringify(id), 'size', fs_, 'flags', flags, 'data', JSON.stringify(data.toString('utf8')).slice(0, 60), '| bytes', Array.from(data.slice(0, 4)));
  if (!/^[A-Z0-9]{4}$/.test(id)) { console.log('  (not a frame id: padding ends the table)'); break; }
  p += 10 + fs_;
}
let z = p, pad = 0;
while (z < end && buf[z] === 0) { z++; pad++; }
console.log('  frames end @' + p, '| zero padding', pad, '| declared body ends @' + end, '| audio starts @' + end, Array.from(buf.slice(end, end + 4)).map((b) => b.toString(16)).join(' '));
