// _si_litter_chk.js — verify the Staten Island (New Dorp, day 5) clean-street gate:
// no empty glass bottles, no piss bottles (addBottles), and no loose litter
// wrappers (addWrapper) spawn on SI. Potholes/hydrants/manholes are untouched,
// and the gate must not leak to any other borough.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- 1. the siClean gate is keyed to the STATEN ISLAND borough only ----
check('siClean gate exists and is keyed to the STATEN ISLAND borough',
  /const siClean = borough === "STATEN ISLAND";/.test(src));

// ---- 2. addBottles (empty bottles + piss bottles) is gated on SI ----
check('addBottles call is gated by !siClean',
  /if \(hr < 0\.28 && !siClean\) addBottles\(b, hzX\(1\), R\(1\.5, 4\.5\)\);/.test(src));
check('there is exactly ONE addBottles call site (the gated one)',
  (src.match(/(?<!function )addBottles\(b,/g) || []).length === 1);

// ---- 3. addWrapper (loose litter) is gated on SI ----
check('addWrapper call is gated by !siClean',
  /if \(Math\.random\(\) < 0\.65 && !siClean\) addWrapper\(b, hzX\(1\), R\(-2\.5, -0\.7\)\);/.test(src));
check('there is exactly ONE addWrapper call site (the gated one)',
  (src.match(/(?<!function )addWrapper\(b,/g) || []).length === 1);

// ---- 4. the rest of the hazard chain is untouched ----
check('pothole/hydrant/manhole branches are not gated (stay on every borough)',
  /else if \(hr < 0\.46\) addPothole\(b, hzX\(1\.5\), R\(-8, -3\)\);/.test(src) &&
  /else if \(hr < 0\.58\) addHydrant\(b, hzX\(1\.5\), 0\.8\);/.test(src) &&
  /else if \(hr < 0\.68\) addManhole\(b, hzX\(1\.5\), R\(-7\.5, -3\.5\)\);/.test(src));

// ---- 5. no other borough string leaks into the gate ----
check('siClean mentions only the STATEN ISLAND borough (no Brooklyn/Bronx/Queens/Manhattan)',
  !/siClean[^;]*(BROOKLYN|THE BRONX|QUEENS|MANHATTAN)/.test(src));

console.log(ok ? '\nSI LITTER CHECKS PASSED' : '\nSI LITTER CHECKS FAILED');
process.exit(ok ? 0 : 1);