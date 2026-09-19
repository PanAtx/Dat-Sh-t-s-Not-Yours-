// _runitup_speed_chk.js — "RUN IT UP!" (Monster invincibility) = the worker runs a bit
// faster, but ONLY while immune (p.immuneT > 0). Movement lines under test (updatePlayer):
//   const immuneBoost = p.immuneT > 0 ? RUN_IT_UP_SPEED_MULT : 1;
//   const speed  = Math.abs(f) * PLAYER_SPEED * (f < 0 ? 0.75 : 1) * immuneBoost;
//   p.wx += f * PLAYER_SPEED * (f < 0 ? 0.75 : 1) * immuneBoost * dt;
//   p.wy = clamp(p.wy + lat * LAT_SPEED * immuneBoost * dt, -9.4, workerMaxY());
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = function(label, cond){ console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) ok = false; };

// ---- read the live constants straight from the game so the test can't drift ----
function getFloatConst(name){
  const m = src.match(new RegExp('const ' + name + ' = (\\d+(?:\\.\\d+)?);'));
  if (!m) throw new Error('const ' + name + ' not found in index.html');
  return parseFloat(m[1]);
}
const PLAYER_SPEED = getFloatConst('PLAYER_SPEED');
const LAT_SPEED = getFloatConst('LAT_SPEED');
const RUN_IT_UP_SPEED_MULT = getFloatConst('RUN_IT_UP_SPEED_MULT');

console.log('\nRUN IT UP! speed check (PLAYER_SPEED=' + PLAYER_SPEED + ' u/s, LAT_SPEED=' + LAT_SPEED + ' u/s, immune mult=' + RUN_IT_UP_SPEED_MULT + ')');

// ---------- 1) the boost constant: "a bit faster", nothing more ----------
check('RUN_IT_UP_SPEED_MULT exists and is > 1 (he does run faster)', RUN_IT_UP_SPEED_MULT > 1);
check('boost is "a bit" faster, not a jetpack (1 < mult <= 2)', RUN_IT_UP_SPEED_MULT > 1 && RUN_IT_UP_SPEED_MULT <= 2);

// ---------- 2) the boost is gated on RUN IT UP immunity ONLY ----------
const boostIdx = src.indexOf('const immuneBoost = p.immuneT > 0 ? RUN_IT_UP_SPEED_MULT : 1;');
check('boost line present: immuneBoost = p.immuneT > 0 ? RUN_IT_UP_SPEED_MULT : 1', boostIdx >= 0);
check('gated on p.immuneT (the Monster "RUN IT UP!" buff), not p.invuln (hit i-frames)',
  boostIdx >= 0 && src.indexOf('immuneBoost = p.invuln') < 0);
const upIdx = src.indexOf('function updatePlayer(');
check('boost lives inside updatePlayer (the per-frame worker movement)',
  upIdx >= 0 && boostIdx > upIdx && boostIdx < src.indexOf('p.invuln = Math.max(0, p.invuln - dt);'));

// ---------- 3) forward, backward and strafe all pick up the boost ----------
check('forward: p.wx moves at PLAYER_SPEED * immuneBoost',
  /p\.wx \+= f \* PLAYER_SPEED \* \(f < 0 \? 0\.75 : 1\) \* immuneBoost \* dt;/.test(src));
check('strafe: p.wy moves at LAT_SPEED * immuneBoost',
  /p\.wy = clamp\(p\.wy \+ lat \* LAT_SPEED \* immuneBoost \* dt, -9\.4, workerMaxY\(\)\);/.test(src));
check('backward stays 0.75x RELATIVE to forward in both states (same ratio as before)',
  /f \* PLAYER_SPEED \* \(f < 0 \? 0\.75 : 1\) \* immuneBoost/.test(src));
check('leg pump reuses the boosted speed (animation matches the faster pace)',
  /p\.phase \+= Math\.max\(speed, Math\.abs\(lat\) \* 4\.5\) \* dt \* 1\.5;/.test(src));

// ---------- 4) per-frame arithmetic (dt = 1/60, full push) ----------
const dt = 1 / 60;
const M = RUN_IT_UP_SPEED_MULT;
const forward = (mult) => Math.abs(1 * PLAYER_SPEED * 1 * mult * dt);       // f = +1
const back = (mult) => Math.abs(-1 * PLAYER_SPEED * 0.75 * mult * dt);     // f = -1
const strafe = (mult) => Math.abs(1 * LAT_SPEED * mult * dt);              // l = +1
check('not immune: forward is EXACTLY the old PLAYER_SPEED pace (no hidden buff)',
  Math.abs(forward(1) - PLAYER_SPEED * dt) < 1e-12);
check('not immune: strafe is EXACTLY the old LAT_SPEED pace (no hidden buff)',
  Math.abs(strafe(1) - LAT_SPEED * dt) < 1e-12);
check('immune: forward is faster than the normal pace', forward(M) > forward(1));
check('immune: strafe is faster than the normal pace', strafe(M) > strafe(1));
check('immune forward = ' + PLAYER_SPEED + ' * ' + M + ' = ' + (PLAYER_SPEED * M).toFixed(2) + ' u/s',
  Math.abs(forward(M) - PLAYER_SPEED * M * dt) < 1e-12);
check('immune strafe = ' + LAT_SPEED + ' * ' + M + ' = ' + (LAT_SPEED * M).toFixed(2) + ' u/s',
  Math.abs(strafe(M) - LAT_SPEED * M * dt) < 1e-12);
check('backward/forward ratio unchanged at 0.75 in both states',
  Math.abs(back(1) / forward(1) - 0.75) < 1e-12 && Math.abs(back(M) / forward(M) - 0.75) < 1e-12);

console.log(ok ? '\nRUN IT UP SPEED ALL CHECKS PASS' : '\nRUN IT UP SPEED FAILURES');
process.exit(ok ? 0 : 1);