/* ============================================================================
   ship.mjs - build the GitHub Pages site (_site/) from main, and prove it is COMPLETE.

   WHY: main is the dev repo - it carries the whole test harness (every _* suite, the
   _tools/ probes, hooks/, scripts/, CI config). .github/workflows/pages.yml used to
   upload the REPO ROOT, which published all of that dev code on the live site.
   This script stages ONLY what the browser needs to run the game:

     stage  = every tracked file, MINUS the dev paths (see EXCLUDE below)

   Because the rule is subtractive, a NEW game asset committed at the repo root, in
   music/ or in draco/ ships automatically, and a new _dev script never ships.

   THE GUARD (the important part): index.html and sw.js name their assets as strings.
   A file that is referenced by the page/shell but not tracked on main is invisible to
   the repo - it plays fine on the dev machine (the file exists on disk) and 404s on the
   deployed site. That is exactly how the three.js offline safety net (three_r128.min.js)
   broke: it lived in .gitignore, so sw.js precached a URL the site never served.
   So ship.mjs collects every local asset path the page/shell asks for and FAILS (exit 1)
   if any of them is missing from _site. Run it locally with:  node scripts/ship.mjs
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const OUT = path.join(ROOT, '_site');

// Dev-only paths: never part of the running game.
const DEV_DIRS = ['_tools/', 'hooks/', 'scripts/', '.github/'];
const DEV_FILES = ['.clinerules', '.gitignore', '.gitattributes', 'package.json', 'package-lock.json', 'run_checks.mjs', '_site/'];

function isDev(p) {
  if (DEV_DIRS.some((d) => p.startsWith(d))) return true;
  if (DEV_FILES.includes(p)) return true;
  // Root scratch: every dev suite / probe / dump is underscore-prefixed.
  return /^_[^/]*$/.test(p);
}


function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function copyFile(rel) {
  const from = path.join(ROOT, rel);
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

// ---- 1: stage ----
const all = trackedFiles();
const ship = all.filter((p) => !isDev(p));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const rel of ship) {
  copyFile(rel);
  bytes += fs.statSync(path.join(ROOT, rel)).size;
}

// ---- 2: collect every local asset path the game/shell asks for ----
const html0 = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// Strip comments before scanning: index.html documents the files it NO LONGER uses
// (truck.fbx, the _tex_* dumps), and a prose mention of a dead file must not be
// mistaken for an asset request. Block, HTML and line comments go; "https://"
// survives because a line comment is only cut after whitespace/;/braces.
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/[ \t;{}(]\/\/[^\n]*/g, ' ');
}
const html = stripComments(html0);
const swClean = stripComments(sw);

const refs = new Set();
// index.html: quoted local paths (any depth), incl. "music/" + name concatenations
const RE_QUOTED =
  /["'`]((?:\.\/)?[A-Za-z0-9 ._\/\-[\]()\u00e9\u2019]+\.(?:glb|gltf|mp3|png|jpg|jpeg|webp|ico|svg|json|js|wasm|css|woff2?|ttf))["'`]/g;
for (const m of html.matchAll(RE_QUOTED)) refs.add(m[1]);

// index.html: <script src="..."> / <link href="..."> tags
for (const m of html.matchAll(/<(?:script|link)[^>]*(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
// sw.js: every './path' string in the precache lists (SHELL + fonts)
for (const m of swClean.matchAll(/['"]\.\/([^'"]{1,80})['"]/g)) refs.add('./' + m[1]);

// Remote URLs and data URLs are not shipped files; '_'-prefixed names are dev scratch
// (a doc mention), never a runtime request.
const REMOTE = /^(https?:|data:|blob:|javascript:)/i;
const norm = [...refs]
  .map((r) => r.replace(/^\.\//, '').replace(/^\//, ''))
  .filter((r) => r && !REMOTE.test(r) && !/^fonts\./i.test(r))
  .filter((r) => /\.[a-z0-9]{2,5}$/i.test(r) && !path.basename(r).startsWith('_'));
const local = [...new Set(norm)].sort();


// The radio builds "music/" + filename at runtime, so a bare *.mp3 name resolves
// either at the repo root (the trainer menu track) or inside music/.
function resolveInSite(rel) {
  const direct = path.join(OUT, rel);
  if (fs.existsSync(direct)) return true;
  const base = path.basename(rel);
  if (/\.mp3$/i.test(base)) {
    if (fs.existsSync(path.join(OUT, 'music', base))) return true;
    if (fs.existsSync(path.join(OUT, base))) return true;
  }
  return false;
}

const missing = local.filter((rel) => !resolveInSite(rel)).sort();

const mb = (bytes / 1048576).toFixed(2);
console.log('ship.mjs: staged ' + ship.length + ' files (' + mb + ' MB) into _site/');
console.log('          (from ' + all.length + ' tracked; ' + (all.length - ship.length) + ' dev files excluded)');
console.log('          checked ' + local.length + ' asset paths named by index.html + sw.js');

if (missing.length) {
  console.error('\nship.mjs: THE SITE IS INCOMPLETE - ' + missing.length + ' referenced asset(s) are not on main:');
  for (const m of missing) console.error('  MISSING  ' + m);
  console.error('\nAdd them to git (a .gitignore entry is the usual culprit) - the deployed site would 404 on these.\n');
  process.exit(1);
}

console.log('          all of them present in _site/  ->  ship list OK\n');
process.exit(0);
