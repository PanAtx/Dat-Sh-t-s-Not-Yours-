// run_checks.mjs - the "npm test" entry point: runs every check suite and prints a
// single PASS/FAIL banner.
//   1. _preload_gate_chk.js        - the "Getting Assets" gate + real preloadAssetsToCache
//   2. _compressed_models_chk.mjs  - truck + can decode via local GLTFLoader + DRACOLoader
//   3. _pickup_compressed_chk.mjs  - BEC / Red Bull / car / coffee cup + index.html wiring
//   4. inline script syntax        - every <script> block in index.html still parses
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
const DIR = import.meta.dirname;

const suites = [
  ['preload gate', 'node', '_preload_gate_chk.js'],
  ['truck + can compressed', 'node', '_compressed_models_chk.mjs'],
  ['pickups compressed (BEC / Red Bull / car / coffee)', 'node', '_pickup_compressed_chk.mjs'],
];

let allPass = true;
for (const [name, cmd, arg] of suites) {
  const r = spawnSync(cmd, [arg], { cwd: DIR, stdio: 'inherit' });
  const passed = r.status === 0;
  allPass = allPass && passed;
  console.log('\n===== [' + (passed ? 'PASS' : 'FAIL') + '] ' + name + ' =====');
}

// ---- 4: index.html inline scripts still parse ----
let synOk = true;
const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((code, i) => {
  try { new vm.Script(code, { filename: 'inline#' + i }); }
  catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); }
});
console.log('\n===== [' + (synOk ? 'PASS' : 'FAIL') + '] index.html inline script syntax (' + scripts.length + ' blocks) =====');
allPass = allPass && synOk;

console.log('\n==========================================');
console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
console.log('==========================================');
process.exit(allPass ? 0 : 1);
