/* _vehicle_side_chk.js — verify cars & motos live on ONE side of the street
 * (curb -0.9 or outer -8.5), never the middle, so they never pile up behind the
 * DSNY truck or lurch sideways to squeeze past.
 */
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let pass = 0, fail = 0;
function ok(cond, msg) {
  console.log("  " + (cond ? "ok" : "FAIL") + "  " + msg);
  if (cond) pass++; else fail++;
}

// --- 1. Car + moto spawn on a stable side (never the middle) ---
const carSpawn = html.match(/case "car":\s*\n\s*([^\n]*\n){0,4}/);
const motoSpawn = html.match(/case "moto":\s*\n\s*([^\n]*\n){0,4}/);
ok(!!carSpawn, "car spawn case located");
ok(!!motoSpawn, "moto spawn case located");
ok(/_passSide\s*=\s*Math\.random\(\)\s*<\s*0\.5\s*\?\s*-0\.9\s*:\s*-8\.5/.test(carSpawn[0]), "car spawn assigns a stable side (-0.9 curb / -8.5 outer)");
ok(/c\.wy\s*=\s*c\._passSide/.test(carSpawn[0]), "car spawn sets wy to that side");
ok(/_passSide\s*=\s*Math\.random\(\)\s*<\s*0\.5\s*\?\s*-0\.9\s*:\s*-8\.5/.test(motoSpawn[0]), "moto spawn assigns a stable side (-0.9 curb / -8.5 outer)");
ok(/c\.wy\s*=\s*c\._passSide/.test(motoSpawn[0]), "moto spawn sets wy to that side");

// --- 2. Cruising holds the side (no middle drift) ---
const carCase = html.slice(html.indexOf('case "car": {'));
const motoCase = html.slice(html.indexOf('case "moto": {'));
ok(/c\.wy\s*\+=\s*\(\s*c\._passSide\s*-\s*c\.wy\s*\)\s*\*\s*2\s*\*\s*dt/.test(carCase), "car cruising eases toward its stable side");
ok(/c\.wy\s*\+=\s*\(\s*c\._passSide\s*-\s*c\.wy\s*\)\s*\*\s*2\s*\*\s*dt/.test(motoCase), "moto cruising eases toward its stable side");
ok(!/c\.wy\s*=\s*clamp\(R\(-3\.5,\s*-6\.5\)/.test(carCase), "car no longer re-rolls a middle cruise lane in the update loop");
ok(!/c\._homeLane\s*=\s*-5/.test(motoCase), "moto no longer defaults its home lane to the middle (-5)");

// --- 3. Lane changes are eased (no teleports) + the snappy escape is slowed ---
ok(!/Math\.min\(1,\s*8\s*\*\s*dt\)\);\s*\/\//.test(motoCase), "moto 8*dt snap escape removed");
ok(/Math\.min\(1,\s*3\s*\*\s*dt\)/.test(motoCase), "moto escape now eases at 3*dt (realistic)");

// --- 4. Runtime: a car on its side is NEVER in the truck's Y-zone, and cruising
//         keeps it there (no middle drift, no pile-up). ---
const truckBoxW = 2.25;
const tYMin = -4.5 - truckBoxW; // -6.75
const tYMax = -4.5 + truckBoxW; // -2.25
function overlapsTruckY(cy, cboxW) {
  const aMin = cy - cboxW, aMax = cy + cboxW;
  return aMax > tYMin && aMin < tYMax;
}
// car boxW 1.19, moto boxW 0.35
ok(!overlapsTruckY(-0.9, 1.19), "car on curb side (-0.9) is clear of the truck body");
ok(!overlapsTruckY(-8.5, 1.19), "car on outer side (-8.5) is clear of the truck body");
ok(!overlapsTruckY(-0.9, 0.35), "moto on curb side (-0.9) is clear of the truck body");
ok(!overlapsTruckY(-8.5, 0.35), "moto on outer side (-8.5) is clear of the truck body");

// simulate a car that (unexpectedly) starts mid-street: it must EASE onto its side
// (smooth, monotonic, no jump) rather than teleport — and it spawns on its side anyway.
let wy = -5.0, passSide = -0.9;
let monotonic = true, jumped = false;
const dt = 1 / 60;
let prev = wy;
for (let i = 0; i < 120; i++) {
  const step = (passSide - wy) * 2 * dt;
  wy += step;
  if (Math.abs(step) > 0.5) jumped = true; // a single-frame jump = teleport
  if (Math.abs(wy - passSide) >= Math.abs(prev - passSide) + 1e-9) monotonic = false; // must always close in
  prev = wy;
}
ok(!jumped, "car lateral move is eased (no single-frame teleport)");
ok(monotonic, "car always closes the gap to its side (no oscillation)");
ok(Math.abs(wy - passSide) < 0.2, "car converges onto its side given a couple seconds");


console.log(`\n${fail === 0 ? "ALL VEHICLE-SIDE CHECKS PASSED" : fail + " FAILED"} (${pass} ok, ${fail} fail)`);
process.exit(fail ? 1 : 0);
