// _sv_mv.js — the shipped build says what it should: the night set, the weekday lockout, the
// state/setter split, the manifest and the version.
const H = require('fs').readFileSync('index.html', 'utf8');
const man = require('fs').readFileSync('music/manifest.json', 'utf8');
const NIGHT4 = ['Midnight Menagerie.mp3', 'Dead-End Sweep.mp3', 'Midnight Route.mp3', 'Midnight Sanitation Strike.mp3'];
const v = (H.match(/APP_VERSION = "([0-9.]+)"/) || [])[1];
const marks = [
  ['night set declared', /const NIGHT_MUSIC_TRACKS = \[/.test(H)],
  ['the set is exactly the four haunted songs', NIGHT4.every((n) => H.includes('"' + n + '"'))],
  ['the night shift locks the SET', /SFX\.radioSticky\(!!on \? NIGHT_MUSIC_TRACKS : null\)/.test(H)],
  ['the weekday bag excludes the night set', /this\.radioList\.filter\(\(n\) => !this\._radioIsMidnightOnly\(n\)\)/.test(H)],
  ['lock STATE is radioLock (no key collision with the setter)', /radioLock: null,/.test(H) && !/this\.radioSticky/.test(H)],
  ['setter METHOD is radioSticky', /radioSticky\(name\) \{/.test(H)],
  ['night gap is the short one', /this\.radioLock \? 700 : 2000/.test(H)],
  ['manifest lists every song (31)', JSON.parse(man).length === 31 && NIGHT4.every((n) => man.includes(n))],
];
let bad = 0;
for (const [n, ok] of marks) { console.log((ok ? 'OK  ' : 'FAIL') + '  ' + n); if (!ok) bad++; }
console.log('APP_VERSION', v, '|', bad ? bad + ' PROBLEM(S)' : 'MIDNIGHT SOUNDTRACK: night-only set wired, weekdays clean');
