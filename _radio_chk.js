// Simulate SFX.radioScan() list extraction: directory-listing HTML and manifest fallback.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
// grab the exact isMp3 + regex lines used in the game
const isMp3 = n => /\.mp3$/i.test(n);

// 1) python http.server style listing
const listing1 = `
<HTML><HEAD><TITLE>Directory listing for /music</TITLE></HEAD><BODY>
<H1>Directory listing for /music</H1>
<HR><PRE><li><a href="../">../</a>
<li><a href="Bensonhurst%20Scavenger%20Hunt.mp3">Bensonhurst Scavenger Hunt.mp3</a>
<li><a href="best_damn_hustle.mp3">best_damn_hustle.mp3</a>
<li><a href="Brooklyn%20D%20S%20N%20Y.mp3">Brooklyn D S N Y.mp3</a>
<li><a href="manifest.json">manifest.json</a>
<li><a href="notes.txt">notes.txt</a>
</PRE><HR></BODY></HTML>`;
// 2) express serve-index (VS Code Live Server) style listing
const listing2 = `<table id="list"><tr><th>File</th></tr>
<tr><td><a href="Kings%20of%20the%20Curb.mp3">Kings of the Curb.mp3</a></td><td>1</td></tr>
<tr><td><a href="Maspeth%20Hopper.mp3">Maspeth Hopper.mp3</a></td><td>1</td></tr>
<tr><td><a href="south_bronx_hauler.mp3">south_bronx_hauler.mp3</a></td><td>1</td></tr></table>`;

function parseListing(txt){
  const re = /href=["']([^"'\?#<>]+\.mp3)["']/gi;
  const names = new Set(); let m;
  while ((m = re.exec(txt))){
    try { const n = decodeURIComponent(m[1].split('/').pop()); if (isMp3(n)) names.add(n); } catch (e) {}
  }
  return [...names];
}
const l1 = parseListing(listing1), l2 = parseListing(listing2);
console.log('python-listing ->', JSON.stringify(l1, null, 0));
console.log('live-server    ->', JSON.stringify(l2, null, 0));
const manifest = JSON.parse(fs.readFileSync('music/manifest.json', 'utf8'));
console.log('manifest       ->', manifest.length + ' tracks: ' + manifest.join(' | '));
const ok = l1.length === 3 && l1.includes('Bensonhurst Scavenger Hunt.mp3') && l1.includes('Brooklyn D S N Y.mp3')
       && l2.length === 3 && manifest.length === 7 && manifest.every(isMp3);
console.log('SCAN PARSING OK:', ok);
process.exit(ok ? 0 : 1);
