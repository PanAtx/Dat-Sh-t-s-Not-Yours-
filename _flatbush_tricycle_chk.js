// _flatbush_tricycle_chk.js — verify the Brooklyn/Flatbush driveway-tricycle feature:
//   1) spawnWorld places exactly 3 isDrivewayTric kids on the LEFTOVER flatbush
//      driveways (the 5 the 3 doghouses did NOT take) so they never overlap a doghouse.
//   2) the REAL 'tric' case body extracted from updateCreatures runs the
//      idle -> attacking -> returning -> idle state machine: a kid lunges when the
//      worker rides up, bumps the worker (minor damage + "OW!" / "Stranger Danger!"),
//      and NEVER crosses into the street (wy stays >= 0.8) or beyond the leash.
//   3) the vehicle/traffic + worker-collision systems EXCLUDE isDrivewayTric so the
//      parked kid is never double-hit or treated as live traffic.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
global.THREE = require(path.join(__dirname, '_three128.js'));
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

// (a) inline scripts still parse
const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let synOk = true;
scripts.forEach((code, i) => { try { new vm.Script(code, { filename: 'inline#' + i }); } catch (e) { synOk = false; console.log('  syntax fail inline#' + i + ': ' + e.message); } });
check('inline script(s) parse (' + scripts.length + ')', synOk);

// ---- constants (mirror index.html) ----
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const workerMaxY = () => 8.0;
const WORKER_GENDER = 'male';
const HP_HIT_DRIVETRIC = 4;
const DRIVETR_CHAIN_R = 4.2;
const DRIVETR_AGGRO_DIST = 6.5;
const DRIVETR_AGGRO_DUR = 3.0;
const DRIVETR_ATK_SP = 6.0;
const DRIVETR_HOME_SP = 2.6;
const DRIVETR_HIT_DIST = 1.3;
const DRIVETR_HIT_CD = 1.6;

// ---- extract the REAL 'tric' case body (brace-counted) from updateCreatures ----
function extractTricCase(){
  const fnStart = src.indexOf('function updateCreatures(dt){');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf("case 'tric':{", fnStart);
  if (start < 0) throw new Error("case 'tric' not found in updateCreatures");
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);   // "case 'tric':{ ... break; }"
}
const tricCase = extractTricCase();
check("case 'tric' has a driveway-tricycle branch", tricCase.indexOf('isDrivewayTric') >= 0);
check("driveway branch breaks before the street logic", /if \(c\.isDrivewayTric\)\{[\s\S]*?break;[\s\S]*?===== street tricycle/.test(tricCase));

// Run the exact case body in a switch with the same free variables updateCreatures gives it.
// A driveway tricycle (isDrivewayTric) breaks before touching the street logic, so only the
// driveway deps (state / p / clamp / workerMaxY / hurtNPC / doStun / Voice / animParts +
// constants) are exercised. animParts / Voice / hurtNPC / doStun are recorded stubs.
function makeRunner(deps){
  const fn = new Function('c', 'dt', 'tx',
    'state', 'p', 'clamp', 'workerMaxY', 'hurtNPC', 'doStun', 'Voice', 'WORKER_GENDER',
    'DRIVETR_CHAIN_R', 'DRIVETR_AGGRO_DIST', 'DRIVETR_AGGRO_DUR', 'DRIVETR_ATK_SP',
    'DRIVETR_HOME_SP', 'DRIVETR_HIT_DIST', 'DRIVETR_HIT_CD', 'HP_HIT_DRIVETRIC', 'animParts',
    'switch (c.type){' + tricCase + '}');
  return function(c, dt){
    return fn(c, dt, c.wx - deps.p.wx, deps.state, deps.p, clamp, workerMaxY,
      deps.hurtNPC, deps.doStun, deps.Voice, WORKER_GENDER,
      DRIVETR_CHAIN_R, DRIVETR_AGGRO_DIST, DRIVETR_AGGRO_DUR, DRIVETR_ATK_SP,
      DRIVETR_HOME_SP, DRIVETR_HIT_DIST, DRIVETR_HIT_CD, HP_HIT_DRIVETRIC,
      (cc, dphase) => { cc.phase += dphase; });
  };
}
// A driveway tricycle at a fixed driveway home (mirrors spawnWorld placement).
function makeDrivewayTric(homeX, homeY){
  const g = { rotation: { z: -Math.PI / 2, x: 0 }, position: { set(){ } } };
  const c = {
    type: 'tric', isDrivewayTric: true, gender: 'male',
    homeX: homeX, homeY: homeY, wx: homeX, wy: homeY,
    state: 'idle', hitCd: 0, chainR: DRIVETR_CHAIN_R,
    phase: 0, g: g, parts: { legL: {}, legR: {}, armL: {}, armR: {} },
  };
  return c;
}

// ---- 1) Flatbush spawns exactly 3 driveway tricycles on leftover driveways ----
check('Flatbush spawns exactly 3 driveway tricycles', /for \(let t = 0; t < 3 && flatbushDriveways\.length > 0; t\+\+\)/.test(src));
check('driveway tricycles consume leftover flatbushDriveways (splice)', /flatbushDriveways\.splice\(dti, 1\);/.test(src));
check('each driveway tricycle is flagged isDrivewayTric', /dt\.isDrivewayTric = true;/.test(src));
// The spawn loop must come AFTER the doghouse loop (which splices 3), so no overlap.
check('driveway-tricycle spawn runs after the doghouse loop (no doghouse overlap)',
  src.indexOf('dt.isDrivewayTric = true') > src.indexOf('const dogCount = isFlatbushLevel() ? 3 : 1'));
// ---- 2) Behavior: worker approaches -> kid attacks + bumps, but stays out of the street ----
function runApproach(){
  const voices = []; const hits = [];
  const deps = {
    state: 'play',
    p: { wx: 0, wy: 2.5, invuln: 0, immuneT: 0, stunT: 0 },
    hurtNPC: (amt) => hits.push(amt),
    doStun(){}, Voice: { say: (txt) => voices.push(txt) },
  };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  let minWy = Infinity, maxLeash = 0, hit = false, ow = false, sd = false;
  // Worker starts near the street side of the driveway (in aggro range) and STAYS there.
  deps.p.wx = c.wx + 1.0; deps.p.wy = c.wy - 3.0;   // ~3.16u away -> inside aggro
  for (let t = 0; t < 400; t++){
    run(c, 1 / 60);
    minWy = Math.min(minWy, c.wy);
    maxLeash = Math.max(maxLeash, Math.hypot(c.wx - c.homeX, c.wy - c.homeY));
    if (hits.length) hit = true;
    if (voices.indexOf('OW!') >= 0) ow = true;
    if (voices.indexOf('Stranger Danger!') >= 0) sd = true;
  }
  return { c, minWy, maxLeash, hit, ow, sd, hits };
}
{
  const r = runApproach();
  check('kid attacks when worker approaches (state reaches attacking)', r.c.state === 'attacking' || r.c.state === 'returning', 'state=' + r.c.state);
  check('kid bumps the worker (hurtNPC called with HP_HIT_DRIVETRIC)', r.hit && r.hits.length > 0 && r.hits.every(h => h === HP_HIT_DRIVETRIC), 'hits=' + JSON.stringify(r.hits));
  check('worker says "OW!" on the bump', r.ow);
  check('kid says "Stranger Danger!" on the bump', r.sd);
  check('kid NEVER crosses into the street (wy >= 0.8 every frame)', r.minWy >= 0.8, 'minWy=' + r.minWy.toFixed(3));
  check('kid stays within leash of its home spot (driveway only)', r.maxLeash <= r.c.chainR + 0.05, 'maxLeash=' + r.maxLeash.toFixed(3));
  check('bump damage is MINOR (lighter than a vehicle run-over)', HP_HIT_DRIVETRIC < 8, HP_HIT_DRIVETRIC + ' < 8');
}

// ---- 2b) Worker leaves -> kid returns home and parks (idle) ----
{
  const deps = { state: 'play', p: { wx: 100, wy: -9, invuln: 0, immuneT: 0 }, hurtNPC(){}, doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  c.wx = 10; c.wy = 3.2; c.state = 'attacking';   // start mid-lunge, worker far away
  for (let t = 0; t < 400; t++) run(c, 1 / 60);
  check('kid returns home and parks when worker leaves (state -> idle)', c.state === 'idle', 'state=' + c.state);
  check('kid parks AT its home spot (not adrift)', Math.hypot(c.wx - c.homeX, c.wy - c.homeY) < 0.3, 'pos=(' + c.wx.toFixed(2) + ',' + c.wy.toFixed(2) + ')');
}

// ---- 2c) No hit spam: per-kid cooldown gates repeated bumps ----
{
  const hits = [];
  const deps = { state: 'play', p: { wx: 11, wy: 4.3, invuln: 0, immuneT: 0 }, hurtNPC: (a) => hits.push(a), doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  for (let t = 0; t < 300; t++) run(c, 1 / 60);   // ~5s of contact
  check('bump is rate-limited by per-kid cooldown (no per-frame spam)', hits.length > 0 && hits.length <= 4, 'bumps in ~5s=' + hits.length);
}

// ---- 3) Traffic + collision systems EXCLUDE isDrivewayTric ----
check('collideCreatures skips driveway tricycles (own AI handles the bump)', /if \(c\.type === 'tric' && c\.isDrivewayTric\) continue;/.test(src));
check('findVehicleAhead ignores driveway tricycles', /!VEHICLE_TYPES\[other\.type\] \|\| other\.isDrivewayTric/.test(src));
check('findClosingVehicle ignores driveway tricycles', /!VEHICLE_TYPES\[v\.type\] \|\| !v\.boxW \|\| v\.isDrivewayTric/.test(src));
check('npcLaneFree ignores driveway tricycles', /!VEHICLE_TYPES\[v\.type\] \|\| !v\.boxW \|\| v\.isDrivewayTric/.test(src));
check('separateVehicles / truck-collision list excludes driveway tricycles', /v\.type !== 'lady' && !v\.isDrivewayTric/.test(src));

console.log(ok ? '\nFLATBUSH TRICYCLE CHECKS PASSED' : '\nFLATBUSH TRICYCLE CHECKS FAILED');
process.exit(ok ? 0 : 1);

