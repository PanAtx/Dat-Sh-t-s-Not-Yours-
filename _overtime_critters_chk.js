// _overtime_critters_chk.js — the OVERTIME (BONUS) street is NOT a dead street:
//   * the curb trees are randomized (near the curb, but jittered so they're not a
//     dead-straight line) so the worker can't just run straight through the row;
//   * rats scurry BACK AND FORTH (a few + the PIZZA RAT) along the store street;
//   * the classic FOUR bodega cats are back, each in front of a store.
// The BONUS spawn branch used to `return;` before ANY of this, so these assert the
// critters + randomized trees now live inside that branch.
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (label, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (extra ? '  (' + extra + ')' : ''));
  if (!cond) ok = false;
};

// Grab the OVERTIME spawn branch: from the `if (BONUS) {` that opens the "OVERTIME
// BASKETS world" builder, through its `return;` (after the critters).
const m = html.indexOf('OVERTIME BASKETS world');
if (m < 0) {
  console.log('FAIL: could not find the OVERTIME BASKETS world branch');
  process.exit(1);
}
const branchStart = html.lastIndexOf('if (BONUS) {', m);
const branchEnd = html.indexOf('return; // done', branchStart);
const branch = html.slice(branchStart, branchEnd);

// --- trees: randomized near the curb (not a dead-straight line) ---
check('overtime curb trees use a RANDOM x offset (tx = R(0.5, 3.5))', /const tx = R\(0\.5, 3\.5\);/.test(branch));
check('overtime curb trees use a RANDOM y offset (ty = R(0.8, 1.8))', /const ty = R\(0\.8, 1\.8\);/.test(branch));
check('overtime trees place at (tx, ty), not the old fixed (0, 1.3)', /t\.position\.set\(tx, ty, 0\);/.test(branch) && !/t\.position\.set\(0, 1\.3, 0\);/.test(branch));
check('overtime tree collision record uses the randomized (worldX + tx, ty)', /b\.trees\.push\(\{ wx: worldX \+ tx, wy: ty \}\);/.test(branch));
// --- rats: a few running back and forth + the pizza rat ---
check('overtime spawns a handful of rats (3) scurrying back and forth', /for \(let r = 0; r < 3; r\+\+\) addCreature\("rat"\);/.test(branch));
check('overtime spawns the PIZZA RAT (makeRat(true))', /const pizzaRat = addCreature\("rat"\);[\s\S]*?makeRat\(true\)/.test(branch));
// --- bodega cats: 4, each in front of a store on the sidewalk ---
check('overtime brings back 4 bodega cats (addCreature("cat", { palette }))', /for \(let i = 0; i < 4; i\+\+\) \{[\s\S]*?addCreature\("cat", \{ palette: coats\[i\] \}\)/.test(branch));
check('overtime bodega cats sit in front of a store door (wx = bl.x + 3.0)', /bc\.wx = bl\.x \+ 3\.0;/.test(branch));
check('overtime bodega cats sit on the sidewalk (wy 4.5, home line = yMax)', /bc\.wy = 4\.5;/.test(branch) && /bc\.yMax = 4\.5;/.test(branch));

console.log('\nOVERTIME CRITTERS: ' + (ok ? 'ALL CHECKS PASS' : 'FAILURES FOUND'));
process.exit(ok ? 0 : 1);