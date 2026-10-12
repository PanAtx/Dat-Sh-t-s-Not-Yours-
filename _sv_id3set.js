// _sv_id3set.js — tag the tracks the player dropped in so they match the shipped convention:
// artist (TPE1) "-Pan-/ATX using Suno" and title (TIT2) = the file name, both UTF-8 (encoding
// byte 3 + trailing NUL), exactly like the 28 files already in music/. The ID3v2 body is rebuilt
// (existing frames kept in order, new frames appended, 2KB of padding left for future edits) and
// the audio bytes after the old tag are copied untouched.
const fs = require('fs');
const path = require('path');
const SYNC = '-Pan-/ATX using Suno';
const files = process.argv.slice(2);
const DIR = 'music';

function synchsafe(n) {
  return Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);
}
function frame(id, text) {
  const data = Buffer.concat([Buffer.from([3]), Buffer.from(text, 'utf8'), Buffer.from([0])]); // UTF-8 + NUL
  return Buffer.concat([Buffer.from(id, 'latin1'), synchsafe(data.length), Buffer.from([0, 0]), data]);
}

for (const f of files) {
  const p = path.join(DIR, f);
  const buf = fs.readFileSync(p);
  if (buf.slice(0, 3).toString('latin1') !== 'ID3') throw new Error(f + ': no ID3v2 header to extend');
  const ver = buf[3];
  if (ver !== 4) throw new Error(f + ': expected an ID3v2.4 tag, found v2.' + ver);
  const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
  const oldEnd = 10 + size;
  // keep every existing frame, then add the artist + title
  const body = [Buffer.from([0x49, 0x44, 0x33, 4, 0, 0])]; // rebuilt at the end; collect frames first
  const frames = [];
  let p2 = 10;
  while (p2 + 10 <= oldEnd) {
    const id = buf.slice(p2, p2 + 4).toString('latin1');
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding / end of frames
    const fsz = ((buf[p2 + 4] << 21) | (buf[p2 + 5] << 14) | (buf[p2 + 6] << 7) | buf[p2 + 7]) >>> 0;
    const one = buf.slice(p2, p2 + 10 + fsz);
    frames.push(one);
    p2 += 10 + fsz;
  }
  const title = f.replace(/\.mp3$/i, '');
  const hasTPE1 = frames.some((x) => x.slice(0, 4).toString('latin1') === 'TPE1');
  const hasTIT2 = frames.some((x) => x.slice(0, 4).toString('latin1') === 'TIT2');
  if (hasTPE1) frames.forEach((x, i) => { if (x.slice(0, 4).toString('latin1') === 'TPE1') frames[i] = frame('TPE1', SYNC); });
  else frames.push(frame('TPE1', SYNC));
  if (hasTIT2) frames.forEach((x, i) => { if (x.slice(0, 4).toString('latin1') === 'TIT2') frames[i] = frame('TIT2', title); });
  else frames.push(frame('TIT2', title));
  const padding = Buffer.alloc(2048); // room for the next edit without moving any audio
  const newBody = Buffer.concat(frames);
  const out = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 4, 0, 0]),
    synchsafe(newBody.length + padding.length),
    newBody,
    padding,
    buf.slice(oldEnd), // the audio, byte for byte
  ]);
  fs.writeFileSync(p, out);
  const afterTag = out.slice(10 + (out[6] << 21 | out[7] << 14 | out[8] << 7 | out[9]), 10 + (out[6] << 21 | out[7] << 14 | out[8] << 7 | out[9]) + 4);
  console.log(
    f.padEnd(32),
    'TPE1=' + (hasTPE1 ? 'replaced' : 'added'),
    'TIT2=' + (hasTIT2 ? 'replaced' : 'added'),
    '| audio starts', Array.from(afterTag).map((b) => b.toString(16)).join(' '),
    '| bytes', buf.length, '->', out.length,
  );
}
console.log('TAGGED', files.length, 'FILES with artist:', SYNC);
