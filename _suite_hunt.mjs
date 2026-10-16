/* ============================================================================
   _suite_hunt.mjs - find every check suite that npm test is NOT running.

   run_checks.mjs lists its suites by hand, so the long tail of suites that were
   written for a feature and never wired in silently stops running: a gate that
   nobody executes cannot fail, which is worse than no gate at all.

   Method (the important part): each candidate is executed in a CLEAN SHALLOW
   CLONE of main, never in the working tree. A dev machine carries a pile of
   gitignored scratch (three_r128.js, the _tex_* dumps, truck.fbx, node_modules);
   a suite that leans on one of those passes here and dies on a fresh clone (and
   in CI). The clone is the only honest referee.

   Anything that exits 0 inside the timeout is appended to _suites_extra.json,
   which run_checks.mjs merges into its list. Timeouts (a suite that opens a
   server never returns) and non-zero exits are reported and left out.

   Run:  node _suite_hunt.mjs            (writes _suites_extra.json)
         node _suite_hunt.mjs --report   (just print the classification)
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLONE = path.join(process.env.TEMP || '/tmp', 'dsnboy-suite-hunt');
const TIMEOUT_MS = parseInt(process.env.SUITE_TIMEOUT || '120000', 10);
const REPORT_ONLY = process.argv.includes('--report');

const log = (...a) => console.log(...a);

// ---- 1: a clean, disposable clone of main ----
fs.rmSync(CLONE, { recursive: true, force: true });
log('cloning main (depth 1) into ' + CLONE);
const clone = spawnSync('git', ['clone', '-q', '--depth', '1', '--no-hardlinks', DIR, CLONE], { encoding: 'utf8' });
if (clone.status !== 0) { console.error('clone failed:', clone.stderr || clone.output); process.exit(2); }

// ---- 2: the candidates = every tracked check script, minus the registered ones ----
const tracked = spawnSync('git', ['ls-files'], { cwd: CLONE, encoding: 'utf8' }).stdout.split(/\r?\n/);
const cand = tracked.filter((p) => /^_[^/]+\.(js|mjs)$/.test(p) && !/^(run_checks|_suite_hunt)/.test(p));
const registered = new Set(
  [...fs.readFileSync(path.join(CLONE, 'run_checks.mjs'), 'utf8').matchAll(/'(_[^']+?\.(?:js|mjs))'/g)].map((m) => m[1]),
);
const targets = cand.filter((p) => !registered.has(p));

log(targets.length + ' unregistered candidate suite(s), ' + registered.size + ' already wired into npm test\n');

// ---- 3: referee each one in the clone ----
const passed = [], failed = [], timedOut = [];
for (const rel of targets) {
  const r = spawnSync('node', [rel], { cwd: CLONE, timeout: TIMEOUT_MS, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const firstBad = out.split(/\r?\n/).filter((l) => /FAIL|failed|Error/i.test(l))[0] || '';
  const clipped = firstBad.trim().slice(0, 90);
  let why = '';
  if (r.killed || (r.error && /ETIMEDOUT|timed/i.test(String(r.error.code || r.error.message)))) {
    why = 'TIMEOUT after ' + Math.round(TIMEOUT_MS / 1000) + 's (never returns - a server/player, not a gate)';
    timedOut.push({ file: rel, why });
  } else if (r.status === 0) {
    passed.push({ file: rel, name: suiteName(rel, CLONE) });
  } else {
    why = 'exit ' + r.status + (clipped ? ': ' + clipped : '');
    failed.push({ file: rel, why });
  }
  log((why ? '  --    ' : '  PASS  ') + rel.padEnd(34) + why);
}

function suiteName(rel, root) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const head = src.split(/\r?\n/).slice(0, 3).join('\n');
  const m = head.match(/^[\s/*]*_?[A-Za-z0-9_]+\.(?:js|mjs)\s*[—\-:]\s*(.+)$/m);
  let name = m ? m[1].trim() : '';
  const line = (src.match(/^[\s/*]*[—\-]\s*(.+)$/m) || [])[1];
  if (!name && line) name = line.trim();
  if (!name) {
    const comment = (head.match(/\/\/\s*([^/\n]{12,120})/) || [])[1];
    name = comment ? comment.trim() : rel.replace(/^_/, '').replace(/\.(js|mjs)$/, '').replace(/_/g, ' ');
  }
  return name.replace(/[—]/g, '-').replace(/\s+/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '').slice(0, 120) || rel;
}

log('\nhunt: ' + passed.length + ' passing, ' + failed.length + ' failing, ' + timedOut.length + ' never-returning');
for (const f of failed) log('  FAIL  ' + f.file + '  ' + f.why);
for (const t of timedOut) log('  HANG  ' + t.file + '  ' + t.why);

if (!REPORT_ONLY) {
  const out = {
    generated_by: '_suite_hunt.mjs (validated in a clean shallow clone of main)',
    suites: passed.map((p) => [p.name, 'node', p.file]),
  };
  fs.writeFileSync(path.join(DIR, '_suites_extra.json'), JSON.stringify(out, null, 2) + '\n');
  log('\nwrote _suites_extra.json with ' + out.suites.length + ' suite(s)');
  log('run_checks.mjs merges it: npm test now runs ' + (registered.size + out.suites.length) + ' suites');
}

fs.rmSync(CLONE, { recursive: true, force: true });
process.exit(0);
