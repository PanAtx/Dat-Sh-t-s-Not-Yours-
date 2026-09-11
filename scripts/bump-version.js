#!/usr/bin/env node
/* ============================================================================
   DSNYBoy version bumper
   ----------------------------------------------------------------------------
   Keeps the app version in lockstep across every place it appears:
     * index.html  -> const APP_VERSION = '...'
     * index.html  -> the <div id="app-version"> menu fallback text
     * manifest.json -> "version"
     * sw.js       -> the page-shell cache name (dsnboy-shell-v<version>)

   The SW shell cache name is what makes a push a PWA update: a new version
   means a new shell cache, so installed clients re-fetch the shell on their
   next load. The game's model + radio caches are NOT versioned here (they hold
   the big 3D assets / MP3s and must survive every deploy).

   Usage:
     node scripts/bump-version.js            # bump PATCH (1.0.1 -> 1.0.2)
     node scripts/bump-version.js minor      # bump MINOR (1.0.1 -> 1.1.0)
     node scripts/bump-version.js major      # bump MAJOR (1.0.1 -> 2.0.0)
     node scripts/bump-version.js sync       # no bump: just make every file match
                                             # the current APP_VERSION
     node scripts/bump-version.js check      # exit 1 if any file is out of sync
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, t) => fs.writeFileSync(path.join(ROOT, f), t, 'utf8');

function currentVersion() {
  const m = read('index.html').match(/const\s+APP_VERSION\s*=\s*'([^']+)'/);
  if (!m) throw new Error('could not find APP_VERSION in index.html');
  return m[1];
}

function syncPoints(v) {
  const html = read('index.html');
  const manifest = read('manifest.json');
  const sw = read('sw.js');
  const changes = [];

  if (!/const\s+APP_VERSION\s*=\s*'[^']*'/.test(html)) {
    throw new Error('APP_VERSION constant not found in index.html');
  }
  if (!/id="app-version"[^>]*>v[\w.]+<\/div>/.test(html)) {
    throw new Error('app-version menu fallback element not found in index.html');
  }
  if (!/"version"\s*:\s*"[^"]*"/.test(manifest)) {
    throw new Error('"version" field not found in manifest.json');
  }
  if (!/var\s+CACHE_NAME\s*=\s*'dsnboy-shell-v[^']*'/.test(sw)) {
    throw new Error('CACHE_NAME not found in sw.js');
  }

  const setHtml = h =>
    h.replace(/const\s+APP_VERSION\s*=\s*'[^']*'/, "const APP_VERSION = '" + v + "'")
     .replace(/(id="app-version"[^>]*>)v[\w.]+(<\/div>)/, '$1v' + v + '$2');
  const setManifest = m => m.replace(/"version"\s*:\s*"[^"]*"/, '"version": "' + v + '"');
  const setSw = s => s.replace(/var\s+CACHE_NAME\s*=\s*'[^']*';?/, "var CACHE_NAME = 'dsnboy-shell-v" + v + "';");

  changes.push(['index.html', html, setHtml(html)]);
  changes.push(['manifest.json', manifest, setManifest(manifest)]);
  changes.push(['sw.js', sw, setSw(sw)]);
  return changes;
}

function report(label, changes) {
  let touched = 0;
  for (const [file, before, after] of changes) {
    if (before !== after) {
      write(file, after);
      touched++;
      console.log('  ' + file);
    }
  }
  if (touched === 0) console.log('  (no files needed changes - already ' + label + ')');
  return touched;
}

const level = process.argv[2] || 'patch';
try {
  if (level === 'sync') {
    const v = currentVersion();
    console.log('syncing all version points to ' + v);
    report('in sync', syncPoints(v));
  } else if (level === 'check') {
    const v = currentVersion();
    const n = syncPoints(v).filter(c => c[1] !== c[2]).length;
    if (n) {
      console.error('VERSION OUT OF SYNC (' + n + ' file(s) differ from APP_VERSION ' + v + '). Run: node scripts/bump-version.js sync');
      process.exit(1);
    }
    console.log('OK: all version points match ' + v);
  } else if (level === 'patch' || level === 'minor' || level === 'major') {
    const cur = currentVersion().split('.').map(Number);
    if (cur.length !== 3) throw new Error('unexpected version format: ' + cur.join('.'));
    const [a, b, c] = cur;
    const next = level === 'patch' ? a + '.' + b + '.' + (c + 1)
      : level === 'minor' ? a + '.' + (b + 1) + '.0'
      : (a + 1) + '.0.0';
    console.log('bumping ' + level + ': ' + cur.join('.') + ' -> ' + next);
    report('in sync', syncPoints(next));
    console.log('now at ' + next);
  } else {
    console.error('unknown mode "' + level + '" (use: patch | minor | major | sync | check)');
    process.exit(2);
  }
} catch (e) {
  console.error('bump-version failed: ' + (e && e.message));
  process.exit(1);
}
