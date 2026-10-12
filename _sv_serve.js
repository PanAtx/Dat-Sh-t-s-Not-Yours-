// _sv_serve.js — serve the folder on :8124 the way the playtest does, fetch index.html over
// HTTP (so a served build is what gets checked) and confirm the new work is in the bytes
// the browser would receive.
const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  const raw = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(__dirname, raw === '/' ? 'index.html' : raw);
  fs.readFile(p, (e, buf) => {
    if (e) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    res.end(buf);
  });
});
const MARKS = [
  'const NIGHT_ECTO_SIZE = 0.45;',
  'function nightEctoSize()',
  'const NIGHT_MUSIC_TRACK = "Midnight Menagerie.mp3";',
  'const NIGHT_MUSIC_TRACKS = [',
  '"Dead-End Sweep.mp3",',
  '"Midnight Route.mp3",',
  '"Midnight Sanitation Strike.mp3",',
  'radioLock: null,',
  'radioSticky(name) {',
  'function applyMidnightMusic(on)',
  'const blade = BX(0.46, 0.52, 0.055, steel)',
  'g.userData.handleLen = 1.74;',
  'function shovelSwingArc(k)',
  '{ k: 1.22, r: [0.95, -0.45], l: [0.2, -0.95], lean: 0.1, twist: 1.5 }',
  'function shovelDeliverStrike()',
  'lead.rotation.y += 0.46 * swS;',
  'trail.rotation.y -= 0.34 * swS;',
  'wparts.group.position.x += 0.06 * swS;',
  'manifest.json',
];
server.listen(8124, async () => {
  const r = await fetch('http://localhost:8124/index.html');
  const html = await r.text();
  let ok = 0;
  for (const m of MARKS) {
    const hit = html.indexOf(m) >= 0;
    if (hit) ok++;
    console.log((hit ? 'YES ' : 'NO  ') + m);
  }
  console.log('served bytes', html.length, 'markers', ok + '/' + MARKS.length);
  const man = await (await fetch('http://localhost:8124/music/manifest.json')).json();
  const NIGHT4 = ['Midnight Menagerie.mp3', 'Dead-End Sweep.mp3', 'Midnight Route.mp3', 'Midnight Sanitation Strike.mp3'];
  console.log('manifest served:', man.length, 'tracks, every midnight song listed =', NIGHT4.every((n) => man.includes(n)));
  for (const n of NIGHT4) {
    const f = await fetch('http://localhost:8124/music/' + encodeURIComponent(n));
    console.log('  serves', f.status, (Number(f.headers.get('content-length')) / 1e6).toFixed(2) + 'MB', n);
  }

  server.close();
  console.log(ok === MARKS.length ? 'SERVE CHECK: ALL MARKED' : 'SERVE CHECK: MISSING MARKERS');
});
