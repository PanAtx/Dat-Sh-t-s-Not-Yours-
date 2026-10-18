/* ============================================================================
   compress-music.mjs - shrink the radio MP3s with no audible band loss.

   WHY: music/ IS the size of the site - 31 tracks at ~183 kbps VBR / 48 kHz stereo
   (avg 5.6 MB, 184 MB total) - the 128 kbps-era masters, and THEY are the HI tier.
   The v1.0.565 experiment shipped the rotation at 96 kbps CBR: the same loudness on
   paper, but the songs came out muddy, so v1.0.580 restored the masters. The data
   bill for slow phones is answered by the LO tier (scripts/encode-radio-lo.mjs:
   48 kbps in music/lo/), NOT by squeezing HI. This tool exists for the day the
   HI folder itself must shrink.

   WHAT IS PRESERVED (the game depends on it):
     * the exact file NAMES - music/manifest.json lists them, the station fetches
       "music/" + encodeURIComponent(name) and the radio cache key IS that URL, so a
       renamed file would strand the cached station of every installed player;
     * the container (MP3) and the sample rate (48 kHz) - no resampling;
     * the ID3 tags (artist + title), rewritten as ID3v2.3 with an ID3v1 tail;
     * the duration - verified per file, a drift over 1.5% fails the run.

   USAGE
     node scripts/compress-music.mjs              encode every track at 128 kbps
     node scripts/compress-music.mjs --kbps 96   the v1.0.565 cut (muddy - history)
     node scripts/compress-music.mjs --dry-run    report the plan, touch nothing
     node scripts/compress-music.mjs --list       current bitrates only
     node scripts/compress-music.mjs --restore    put the originals back

   The originals are MOVED to _music_orig/ (gitignored) before the encoded file
   takes their place, so a run is fully reversible with --restore.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const MUSIC = path.join(ROOT, 'music');
const ORIG = path.join(ROOT, '_music_orig');
const TRAINER_TRACK = 'Romeo Knight - Beat To The Pulp [Remastered].mp3'; // repo root, not in music/

const ARGS = process.argv.slice(2);
const flag = (n) => ARGS.includes('--' + n);
const opt = (n, dflt) => { const i = ARGS.indexOf('--' + n); return i >= 0 && ARGS[i + 1] ? ARGS[i + 1] : dflt; };
const KBPS = parseInt(opt('kbps', '128'), 10);
const DRY = flag('dry-run');
const RESTORE = flag('restore');
const mb = (b) => (b / 1048576).toFixed(2);

function tool(name) {
  const env = process.env[name.toUpperCase()];
  if (env && fs.existsSync(env)) return env;
  const probe = spawnSync(name, ['-version'], { shell: process.platform === 'win32' });
  if (probe.status === 0) return name;
  const where = spawnSync('where.exe', [name]);
  const line = (where.stdout || '').toString().split(/\r?\n/)[0];
  if (line && fs.existsSync(line)) return line;
  console.error('compress-music: ' + name + ' not found. Install ffmpeg (winget install Gyan.FFmpeg),');
  console.error('                or set FFMPEG=/path/to/ffmpeg.exe / FFPROBE=/path/to/ffprobe.exe');
  process.exit(2);
}

const FFPROBE = tool('ffprobe');
const FFMPEG = flag('list') ? null : tool('ffmpeg');

function probe(file) {
  const out = execFileSync(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate,size:format_tags=artist,title',
    '-of', 'default=noprint_wrappers=1', file,
  ], { encoding: 'utf8' });
  const d = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) {
      // ffprobe prints format tags as "TAG:key=value" under noprint_wrappers.
      const k = line.slice(0, i).replace(/^TAG:/, '');
      d[k] = line.slice(i + 1);
    }
  }
  return {
    sec: parseFloat(d.duration || '0'),
    kbps: Math.round((parseInt(d.bit_rate || '0', 10) || 0) / 1000),
    bytes: parseInt(d.size || String(fs.statSync(file).size), 10),
    artist: d.artist || '',
    title: d.title || '',
  };
}

const targets = [
  ...fs.readdirSync(MUSIC).filter((f) => /\.mp3$/i.test(f)).sort()
    .map((f) => ({ rel: 'music/' + f, abs: path.join(MUSIC, f) })),
  { rel: TRAINER_TRACK, abs: path.join(ROOT, TRAINER_TRACK) },
].filter((t) => fs.existsSync(t.abs));


if (flag('list')) {
  let total = 0;
  for (const t of targets) {
    const p = probe(t.abs);
    total += p.bytes;
    console.log('  ' + String(p.kbps).padStart(4) + ' kbps  ' + mb(p.bytes).padStart(6) + ' MB  ' +
      String(Math.round(p.sec / 60)).padStart(2) + ' min  ' + t.rel);
  }
  console.log('\n  ' + targets.length + ' tracks, ' + mb(total) + ' MB total');
  process.exit(0);
}

if (RESTORE) {
  let n = 0;
  for (const t of targets) {
    const back = path.join(ORIG, path.basename(t.rel));
    if (!fs.existsSync(back)) continue;
    fs.copyFileSync(back, t.abs);
    n++;
  }
  console.log('compress-music: restored ' + n + ' original(s) from _music_orig/');
  process.exit(n ? 0 : 1);
}

console.log('compress-music: ' + targets.length + ' tracks -> libmp3lame ' + KBPS + ' kbps, 48 kHz stereo');
console.log('                tags rewritten ID3v2.3 + ID3v1; originals kept in _music_orig/\n');

let before = 0, after = 0, done = 0;
const fails = [];
const TMP = path.join(ROOT, '_music_enc');

for (const t of targets) {
  const src = probe(t.abs);
  before += src.bytes;

  if (DRY) {
    const est = Math.round((src.sec * KBPS * 1000) / 8);
    after += est;
    console.log('  PLAN  ' + t.rel.padEnd(50) + mb(src.bytes) + ' MB @' + src.kbps + 'k  ->  ~' + mb(est) + ' MB');
    continue;
  }

  fs.mkdirSync(TMP, { recursive: true });
  const tmp = path.join(TMP, path.basename(t.rel));
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', t.abs,
    '-vn', '-map_metadata', '0',
    '-c:a', 'libmp3lame', '-b:a', KBPS + 'k', '-ar', '48000', '-ac', '2',
    '-id3v2_version', '3', '-write_id3v1', '1',
    tmp,
  ], { encoding: 'utf8' });

  const dst = probe(tmp);
  const drift = src.sec > 0 ? Math.abs(dst.sec - src.sec) / src.sec : 1;
  if (!dst.sec || drift > 0.015 || dst.bytes > src.bytes) {
    fails.push(t.rel + ' (duration drift ' + (drift * 100).toFixed(2) + '%, ' + mb(dst.bytes) + ' vs ' + mb(src.bytes) + ' MB)');
    fs.rmSync(tmp, { force: true });
    continue;
  }

  fs.mkdirSync(ORIG, { recursive: true });
  fs.copyFileSync(t.abs, path.join(ORIG, path.basename(t.rel)));
  fs.copyFileSync(tmp, t.abs);
  fs.rmSync(tmp, { force: true });
  done++;
  after += dst.bytes;
  const tag = dst.artist && dst.title ? 'artist+title kept' : (dst.title ? 'title kept' : 'no tags');
  console.log('  OK    ' + t.rel.padEnd(50) + mb(src.bytes) + ' -> ' + mb(dst.bytes) + ' MB  ' +
    dst.kbps + 'k  ' + Math.round(dst.sec) + 's  ' + tag);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log('\ncompress-music: ' + (DRY ? 'dry run - nothing written' : done + ' track(s) encoded'));
console.log('  before ' + mb(before) + ' MB  ->  after ' + mb(after) + ' MB  =  ' + mb(before - after) +
  ' MB saved (' + Math.round((1 - after / before) * 100) + '%)');

if (fails.length) {
  console.error('\ncompress-music: ' + fails.length + ' FAILED (those files left untouched):');
  fails.forEach((f) => console.error('  ' + f));
  process.exit(1);
}
process.exit(0);
