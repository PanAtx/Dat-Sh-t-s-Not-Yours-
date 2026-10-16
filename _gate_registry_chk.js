// _gate_registry_chk.js - THE GATE REGISTRY GUARD: every suite npm test claims to run is
// actually on main.
//
// Why: npm test names its suites as strings. A suite file that is untracked (the usual
// culprit is a .gitignore line that outlived the reason it was written - _route_replay_chk.js
// sat in .gitignore while run_checks.mjs listed it as passing) runs green on the dev machine,
// prints "ALL CHECKS PASSED", and is simply absent in CI - where "absent" reads as "fine".
// Same bug class as the .gitignore'd three_r128.min.js that made the offline safety net 404.
// Pure Node + git; no network.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DIR = __dirname;
let fails = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  if (!ok) { fails++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
  else console.log('PASS  ' + name);
}

const tracked = new Set(
  execFileSync('git', ['ls-files'], { cwd: DIR, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean),
);
check('git ls-files returns a usable set', tracked.size > 100, tracked.size + ' tracked files');

const rc = fs.readFileSync(path.join(DIR, 'run_checks.mjs'), 'utf8');
const shortBlock = rc.slice(rc.indexOf('const suites'), rc.indexOf('// ---- THE LONG TAIL'));
const listed = [...shortBlock.matchAll(/'(_[^']+?\.(?:js|mjs))'/g)].map((m) => m[1]);
check('run_checks.mjs lists its suites', listed.length >= 40, listed.length + ' listed');

// ---- 1: every listed suite is both present and TRACKED ----
const untracked = listed.filter((f) => !tracked.has(f));
const absent = listed.filter((f) => !fs.existsSync(path.join(DIR, f)));
check('every listed suite file is tracked on main', untracked.length === 0, untracked.join(', '));
check('every listed suite file exists on disk', absent.length === 0, absent.join(', '));

// ---- 2: the long-tail registry, same law ----
const extraPath = path.join(DIR, '_suites_extra.json');
let extraFiles = [];
if (fs.existsSync(extraPath)) {
  try { extraFiles = JSON.parse(fs.readFileSync(extraPath, 'utf8')).suites.map((s) => s[2]); } catch (e) { extraFiles = null; }
  check('_suites_extra.json parses', extraFiles !== null);
}
if (extraFiles && extraFiles.length) {
  check('every _suites_extra.json suite is tracked on main',
    extraFiles.filter((f) => !tracked.has(f)).length === 0,
    extraFiles.filter((f) => !tracked.has(f)).join(', '));
  check('the long tail does not duplicate the short list',
    extraFiles.filter((f) => listed.includes(f)).length === 0,
    extraFiles.filter((f) => listed.includes(f)).join(', '));
}

// ---- 3: .gitignore may not swallow a gate (the exact way this broke) ----
// git ls-files -o -i --exclude-standard = the untracked files git is currently ignoring.
let ignored = [];
try {
  ignored = execFileSync('git', ['ls-files', '-o', '-i', '--exclude-standard'], { cwd: DIR, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
} catch (e) {
  console.log('note: git ls-files -o -i unavailable (' + e.message.split('\n')[0] + ') - ignore check skipped');
}
const swallowed = listed.concat(extraFiles || []).filter((f) => ignored.includes(f));
check('no registered suite is sitting in .gitignore', swallowed.length === 0, swallowed.join(', '));

// ---- 4: the merged fleet is big enough to be the real harness ----
const total = new Set(listed.concat(extraFiles || [])).size;
check('npm test fleet (short list + long tail) covers 100+ gates', total >= 100, total + ' unique suites');

console.log('\n' + (checks - fails) + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
