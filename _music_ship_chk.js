// _music_ship_chk.js - the STATION SHIP CHECK: every track the radio can play is on
// main, playable, credited, and inside the size budget that keeps the site light.
//
// Why this exists: music/ IS the site's weight (the Pages deploy + every offline
// first visit pays for it), scripts/compress-music.mjs re-encodes the station at
// 96 kbps, and the radio reaches the files ONLY by name
//   ("music/" + encodeURIComponent(name) from music/manifest.json),
// so a renamed, untagged or fat track is a real regression, not a cosmetic one.
// Pure Node (no ffmpeg, no network) so CI can run it.
const fs = require('fs');
const path = require('path');
const { readId3, frameText } = require('./_sv_id3.js');

const DIR = __dirname;
let fails = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  if (!ok) { fails++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else console.log('PASS  ' + name);
}
const MB = (b) => (b / 1048576).toFixed(2);

// --- 1: the manifest is the station's contract ---
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'music', 'manifest.json'), 'utf8'));
check('music/manifest.json is a non-empty array of .mp3 names',
  Array.isArray(manifest) && manifest.length >= 8 && manifest.every((n) => /\.mp3$/i.test(n)),
  manifest.length + ' entries');

// Every mp3 physically in music/ must be listed (an unlisted track is invisible to
// the station on hosts with no directory listing - GitHub Pages has none).
const onDisk = fs.readdirSync(path.join(DIR, 'music')).filter((f) => /\.mp3$/i.test(f));
const unlisted = onDisk.filter((f) => !manifest.includes(f));
check('every mp3 in music/ is listed in manifest.json (Pages has no autoindex)',
  unlisted.length === 0, unlisted.join(', '));
const ghost = manifest.filter((n) => !fs.existsSync(path.join(DIR, 'music', n)));
check('every manifest entry exists on disk', ghost.length === 0, ghost.join(', '));

// --- 2: the trainer menu track lives at the repo root, outside the rotation ---
const trainer = (fs.readFileSync(path.join(DIR, 'index.html'), 'utf8')
  .match(/TRAINER_TRACK:\s*"([^"]+\.mp3)"/) || [])[1];
check('index.html names a TRAINER_TRACK mp3', !!trainer, trainer);
if (trainer) {
  check('the trainer track is at the repo root and NOT inside music/',
    fs.existsSync(path.join(DIR, trainer)) && !manifest.includes(trainer));
}

// --- 3: every track carries the band credit + its own title (ID3v2) ---
const ARTIST = '-Pan-/ATX using Suno';
let tagBad = [];
// The rotation follows the Suno credit convention; the trainer's menu track is a real
// Romeo Knight/TRSI recording, so it only has to be tagged at all.
const convention = (n) => manifest.includes(n);
for (const n of manifest.concat(trainer ? [trainer] : [])) {
  const p = convention(n) ? path.join(DIR, 'music', n) : path.join(DIR, n);
  if (!fs.existsSync(p)) continue;
  const t = readId3(fs.readFileSync(p));
  // frameText(frames, ...ids) takes the FRAME LIST, not one frame.
  const artist = t.frames.length ? frameText(t.frames, 'TPE1', 'TP1 ') : null;
  const title = t.frames.length ? frameText(t.frames, 'TIT2', 'TT2') : null;
  const want = n.replace(/\.mp3$/i, '');
  if (!convention(n)) {
    if (!artist || !title) tagBad.push(n + ' (artist=' + (artist || '-') + ', title=' + (title || '-') + ')');
    continue;
  }
  if (artist !== ARTIST || title !== want) tagBad.push(n + ' (artist=' + (artist || '-') + ', title=' + (title || '-') + ')');
}
check('rotation tracks tagged artist="' + ARTIST + '" + title=file name; trainer track tagged at all',
  tagBad.length === 0, tagBad.slice(0, 3).join(' | '));

// --- 4: THE SIZE BUDGET (the reason 96 kbps was shipped) ---
// 96 kbps / 48 kHz stereo = 12 KB per second of audio, so the per-track ceiling is
// set by the LONGEST song in the rotation (7 min) - not by taste.
const CAP_MB = 5.5;   // per track (96 kbps * 7 min = ~5.0 MB)
const TOTAL_MB = 110; // whole station + the trainer track
let total = 0, fat = [];
for (const n of onDisk) {
  const b = fs.statSync(path.join(DIR, 'music', n)).size;
  total += b;
  if (b / 1048576 > CAP_MB) fat.push(n + ' ' + MB(b) + 'MB');
}
if (trainer) total += fs.statSync(path.join(DIR, trainer)).size;
check('no single track over ' + CAP_MB + ' MB (96 kbps / 48 kHz keeps one under it)',
  fat.length === 0, fat.join(', '));
check('the whole station fits the ' + TOTAL_MB + ' MB ship budget',
  total / 1048576 <= TOTAL_MB, MB(total) + ' MB');

// --- 5: the station must stay decodable by the browser: MPEG frames, not a header-only stub ---
const stubs = onDisk.filter((n) => {
  const buf = fs.readFileSync(path.join(DIR, 'music', n));
  const id3 = buf.slice(0, 3).toString('latin1') === 'ID3'
    ? 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]) : 0;
  // an MPEG audio frame sync (0xFF Ex / 0xFF Dx) must appear right after the tag
  const s = buf[id3];
  return !(s === 0xff && (buf[id3 + 1] & 0xe0) === 0xe0);
});
check('every track starts with a real MPEG audio frame (browser can decode it)',
  stubs.length === 0, stubs.join(', '));

console.log('\n' + (checks - fails) + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
