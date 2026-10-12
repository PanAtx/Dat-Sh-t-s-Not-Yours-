// _sv_id3.js — read the ID3v2 artist/title of every mp3 in music/ (plain Node, no deps).
// Handles ID3v2.2/2.3/2.4 frames (TPE1/TP1, TIT2/TT2, TALB), synchsafe sizes, and ID3v1 tails,
// so the tracks the player dropped in can be compared against the shipped tag convention.
const fs = require('fs');
const path = require('path');
const DIR = 'music';

function decText(buf, enc) {
  // 0 = ISO-8859-1, 1 = UTF-16 with BOM, 2 = UTF-16BE, 3 = UTF-8
  if (enc === 0) return buf.toString('latin1').replace(/\0+$/, '');
  if (enc === 1) return buf.toString('utf16le').replace(/^\uFEFF/, '').replace(/\0+$/, '');
  if (enc === 2) return buf.toString('utf16le').replace(/\0+$/, '');
  return buf.toString('utf8').replace(/\0+$/, '');
}
function readId3(buf) {
  const out = { frames: [], v1: null, rawHeader: null, size: 0, ver: 0 };
  if (buf.length < 10) return out;
  if (buf.slice(0, 3).toString('latin1') !== 'ID3') return out;
  out.ver = buf[3];
  out.rawHeader = 'ID3v2.' + buf[3] + '.' + buf[4];
  out.size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
  const idLen = buf[3] >= 3 ? 4 : 3;
  let p = 10;
  const end = 10 + out.size;
  while (p + idLen + 4 <= end && p + idLen < buf.length) {
    const fid = buf.slice(p, p + idLen).toString('latin1');
    if (!/^[A-Z0-9]{3,4}$/.test(fid)) break;
    let fsz;
    if (buf[3] >= 4) fsz = ((buf[p + idLen] << 21) | (buf[p + idLen + 1] << 14) | (buf[p + idLen + 2] << 7) | buf[p + idLen + 3]) >>> 0;
    else fsz = ((buf[p + idLen] << 24) | (buf[p + idLen + 1] << 16) | (buf[p + idLen + 2] << 8) | buf[p + idLen + 3]) >>> 0;
    out.frames.push({ id: fid, data: buf.slice(p + idLen + 4 + 2, p + idLen + 4 + 2 + fsz) });
    p += idLen + 4 + 2 + fsz;
  }
  const tail = buf.slice(buf.length - 128).toString('latin1');
  if (tail.slice(0, 3) === 'TAG') out.v1 = { title: tail.slice(3, 33).replace(/\0.*$/, ''), artist: tail.slice(33, 63).replace(/\0.*$/, '') };
  return out;
}
function frameText(frames, ...ids) {
  for (const id of ids) {
    const f = frames.filter((x) => x.id === id).pop();
    if (f && f.data.length) return decText(f.data.slice(1), f.data[0]);
  }
  return null;
}
module.exports = { readId3, frameText, decText };

if (require.main === module) {
  const files = fs.readdirSync(DIR).filter((f) => /\.mp3$/i.test(f)).sort();
  const tally = new Map();
  for (const f of files) {
    const t = readId3(fs.readFileSync(path.join(DIR, f)));
    const artist = t.frames.length ? frameText(t.frames, 'TPE1', 'TP1 ') : null;
    const title = t.frames.length ? frameText(t.frames, 'TIT2', 'TT2') : null;
    console.log(
      (artist || '(no artist)').padEnd(24) + ' | ' + (title || '(no title)').padEnd(32) + ' | ' +
        (t.rawHeader || '(no ID3v2)').padEnd(10) + ' | v1:' + (t.v1 ? t.v1.artist || '-' : '-') + ' | ' + f,
    );
    const key = String(artist);
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  console.log('\nARTIST TALLY:', JSON.stringify([...tally]), ' TRACKS:', files.length);
}
