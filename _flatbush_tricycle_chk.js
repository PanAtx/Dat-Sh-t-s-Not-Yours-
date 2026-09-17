// _flatbush_tricycle_chk.js — verify the Brooklyn/Flatbush driveway-tricycle feature:
//   1) spawnWorld places exactly 3 isDrivewayTric kids on the LEFTOVER flatbush
//      driveways (the 5 the 3 doghouses did NOT take) so they never overlap a doghouse.
//   2) the REAL 'tric' case body extracted from updateCreatures runs the
//      idle -> attacking -> backing -> idle state machine: a kid lunges when the
//      worker rides up, bumps the worker ONCE (minor damage + "OW!" /
//      "Stranger Danger!"), then backs off to home for ~DRIVETR_BACKOFF_T seconds
//      and only re-lunges if the worker is still in aggro range - and it NEVER
//      crosses into the street (wy stays >= 0.8) or beyond the leash.
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
const DRIVETR_BACKOFF_T = 4.0;
const DRIVETR_LATERAL = 1.0;

// ---- extract the REAL 'tric' case body (brace-counted) from updateCreatures ----
function extractTricCase(){
  const fnStart = src.indexOf('function updateCreatures(dt) {');
  if (fnStart < 0) throw new Error('updateCreatures not found');
  const start = src.indexOf('case "tric": {', fnStart);
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
    'DRIVETR_HOME_SP', 'DRIVETR_HIT_DIST', 'DRIVETR_HIT_CD', 'DRIVETR_BACKOFF_T', 'DRIVETR_LATERAL', 'HP_HIT_DRIVETRIC', 'animParts',
    'switch (c.type){' + tricCase + '}');
  return function(c, dt){
    return fn(c, dt, c.wx - deps.p.wx, deps.state, deps.p, clamp, workerMaxY,
      deps.hurtNPC, deps.doStun, deps.Voice, WORKER_GENDER,
      DRIVETR_CHAIN_R, DRIVETR_AGGRO_DIST, DRIVETR_AGGRO_DUR, DRIVETR_ATK_SP,
      DRIVETR_HOME_SP, DRIVETR_HIT_DIST, DRIVETR_HIT_CD, DRIVETR_BACKOFF_T, DRIVETR_LATERAL, HP_HIT_DRIVETRIC,
      deps.animParts || ((cc, dphase) => { cc.phase += dphase; }));
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
  check('kid attacks when worker approaches (state reaches attacking)', ['attacking', 'returning', 'backing'].indexOf(r.c.state) >= 0, 'state=' + r.c.state);
  check('kid bumps the worker (hurtNPC called with HP_HIT_DRIVETRIC)', r.hit && r.hits.length > 0 && r.hits.every(h => h === HP_HIT_DRIVETRIC), 'hits=' + JSON.stringify(r.hits));
  check('worker says "OW!" on the bump', r.ow);
  check('kid says "Stranger Danger!" on the bump', r.sd);
  check('kid NEVER crosses into the street (wy >= 0.8 every frame)', r.minWy >= 0.8, 'minWy=' + r.minWy.toFixed(3));
  check('kid stays within leash of its home spot (driveway only)', r.maxLeash <= r.c.chainR + 0.05, 'maxLeash=' + r.maxLeash.toFixed(3));
  check('bump damage is MINOR (lighter than a vehicle run-over)', HP_HIT_DRIVETRIC < 8, HP_HIT_DRIVETRIC + ' < 8');
  check('kid bump cites the "tric" write-up offense (minor on a tricycle)', src.indexOf('hurtNPC(HP_HIT_DRIVETRIC, "tric")') >= 0);
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

// ---- 2c) No hit spam: one bump per lunge (backoff + cooldown gate repeats) ----
{
  const hits = [];
  const deps = { state: 'play', p: { wx: 11, wy: 4.3, invuln: 0, immuneT: 0 }, hurtNPC: (a) => hits.push(a), doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  for (let t = 0; t < 300; t++) run(c, 1 / 60);   // ~5s of contact
  check('bumps stay spaced out (one per lunge, ~4s backoff between)', hits.length > 0 && hits.length <= 3, 'bumps in ~5s=' + hits.length);
}

// ---- 2d) Backoff: one bump per lunge, ~4s backoff, re-lunges if worker is still there ----
{
  const hits = [];
  const deps = { state: 'play', p: { wx: 11, wy: 1.3, invuln: 0, immuneT: 0 }, hurtNPC: () => hits.push(1), doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  const frames = 60 * 7;   // 7s: enough for lunge -> backoff -> second lunge
  const hitTimes = [];
  let midState = null;
  for (let t = 0; t < frames; t++){
    const before = hits.length;
    run(c, 1 / 60);
    if (hits.length > before) hitTimes.push(t / 60);
    // 2s after the first bump the kid must be backing off, not re-attacking
    if (hitTimes.length === 1 && t / 60 >= hitTimes[0] + 2 && midState === null) midState = c.state;
  }
  check('kid bumps, backs off, then re-lunges (two bumps in 7s)', hitTimes.length >= 2, 'hitTimes=' + JSON.stringify(hitTimes.map(t => t.toFixed(2))));
  check('backoff lasts ~4s before the kid re-lunges', hitTimes.length >= 2 && hitTimes[1] - hitTimes[0] >= 3.7 && hitTimes[1] - hitTimes[0] <= 4.5, 'gap=' + (hitTimes.length >= 2 ? (hitTimes[1] - hitTimes[0]).toFixed(2) : 'n/a'));
  check('kid is backing off (not attacking) 2s after the bump', midState === 'backing' || midState === 'idle', 'state=' + midState);
  check('re-lunge reaches the worker again (second bump lands)', hitTimes.length >= 2);
}

// ---- 2e) Worker leaves mid-backoff -> kid parks, never re-lunges ----
{
  const hits = [];
  const deps = { state: 'play', p: { wx: 11, wy: 1.3, invuln: 0, immuneT: 0 }, hurtNPC: () => hits.push(1), doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  for (let t = 0; t < 60 * 2; t++) run(c, 1 / 60);   // ~2s: first bump + start of backoff
  check('first bump happened before the worker leaves', hits.length >= 1, 'hits=' + hits.length);
  deps.p.wx = 30; deps.p.wy = -5;                    // worker rides away past aggro + leash reach
  for (let t = 0; t < 60 * 6; t++) run(c, 1 / 60);   // 6s more (>> 4s backoff)
  check('no second bump after the worker leaves during the backoff', hits.length <= 1, 'hits=' + hits.length);
  check('kid parks at home once the worker is gone', c.state === 'idle' && Math.hypot(c.wx - c.homeX, c.wy - c.homeY) < 0.3, 'state=' + c.state + ' pos=(' + c.wx.toFixed(2) + ',' + c.wy.toFixed(2) + ')');
}

// ---- 2f) The kid stays on its OWN driveway - never wanders onto a neighbor's porch/steps ----
{
  const deps = { state: 'play', p: { wx: 0, wy: 0, invuln: 0, immuneT: 0 }, hurtNPC(){}, doStun(){}, Voice: { say(){} } };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  // Worker rides up into the FRONT YARD, off to the SIDE (toward the neighbor's porch/steps).
  // The kid chases but must stay confined to its own driveway band (homeX +- DRIVETR_LATERAL)
  // so it can never clip onto the flanking porch/steps, and it stays off the street (wy >= 0.8).
  deps.p.wx = c.homeX + 3.5; deps.p.wy = c.homeY + 2.5;
  let minX = Infinity, maxX = -Infinity, minWy = Infinity;
  for (let t = 0; t < 60 * 10; t++){
    run(c, 1 / 60);
    minX = Math.min(minX, c.wx); maxX = Math.max(maxX, c.wx);
    minWy = Math.min(minWy, c.wy);
  }
  check('kid stays on its driveway (x within homeX +- DRIVETR_LATERAL) when the worker is in the yard',
    minX >= c.homeX - DRIVETR_LATERAL - 1e-6 && maxX <= c.homeX + DRIVETR_LATERAL + 1e-6,
    'x=[' + minX.toFixed(2) + ',' + maxX.toFixed(2) + '] band=[' + (c.homeX - DRIVETR_LATERAL).toFixed(1) + ',' + (c.homeX + DRIVETR_LATERAL).toFixed(1) + ']');
  check('kid stays off the street while chasing into the yard (wy >= 0.8)', minWy >= 0.8, 'minWy=' + minWy.toFixed(3));
}

// ---- 2g) No pedaling in place: pinned against a clamp, the kid stops cranking the legs ----
{
  let pedalFrames = 0, endPedal = 0;
  const deps = {
    state: 'play', p: { wx: 14, wy: 4.3, invuln: 0, immuneT: 0 },
    hurtNPC(){}, doStun(){}, Voice: { say(){} },
    animParts: () => { pedalFrames++; },
  };
  const run = makeRunner(deps);
  const c = makeDrivewayTric(10, 4.3);
  // Worker rides up into the FRONT YARD off to the SIDE (due east of the driveway, within
  // the leash). The leash-clamped chase target lands beyond the driveway x-band
  // (homeX + DRIVETR_LATERAL = 11), so the kid can only chase as far as the band edge,
  // where it gets PINNED by the x-band clamp. While pinned it must stop pedaling instead
  // of cranking in place. The pin point is out of bump range (3.0 > DRIVETR_HIT_DIST), so
  // no bump fires and the kid stays pinned for the whole run.
  const total = 60 * 10;
  for (let t = 0; t < total; t++){
    const before = pedalFrames;
    run(c, 1 / 60);
    if (t >= total - 60) endPedal += (pedalFrames - before);
  }
  check('kid holds at the driveway band edge while chasing sideways (x stays at homeX + DRIVETR_LATERAL)',
    c.wx >= c.homeX + DRIVETR_LATERAL - 1e-6 && c.wx <= c.homeX + DRIVETR_LATERAL + 0.05,
    'x=' + c.wx.toFixed(3) + ' edge=' + (c.homeX + DRIVETR_LATERAL).toFixed(1));
  check('kid STOPS pedaling once it can no longer move toward the worker (no leg animation while pinned)',
    pedalFrames > 0 && endPedal === 0, 'pedalFrames=' + pedalFrames + ' pedalsInLast60=' + endPedal);
}

// ---- 3) Traffic + collision systems EXCLUDE isDrivewayTric ----
check('collideCreatures skips driveway tricycles (own AI handles the bump)', /if \(c\.type === 'tric' && c\.isDrivewayTric\) continue;/.test(src));

// ---- 4) Flatbush (day 3) spawns NO non-attacking street tricycle ----
// The generic roster's street tricycle (BASE_NPC_COUNTS.tric) must be zeroed on Flatbush,
// so the only tricycles on the level are the 3 driveway kids. Uses the REAL npcCounts.
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}
function extractLiteral(name, open, close){
  const marker = 'const ' + name + ' = ';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = src.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < src.length; i++){ const ch = src[i]; if (ch === open) d++; else if (ch === close){ d--; if (!d){ i++; break; } } }
  return src.slice(s, i);
}
const BASE_NPC_COUNTS = eval('(' + extractLiteral('BASE_NPC_COUNTS', '{', '}') + ')');
const SCALING_NPC = eval('(' + extractLiteral('SCALING_NPC', '{', '}') + ')');
const GATED_NPC = eval('(' + extractLiteral('GATED_NPC', '{', '}') + ')');
const npcCounts = new Function('BASE_NPC_COUNTS', 'SCALING_NPC', 'GATED_NPC', extractFn('npcCounts') + '\n; return npcCounts;')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC);
check('Flatbush (day 3) has NO non-attacking street tricycle (npcCounts(3).tric === 0)', npcCounts(3).tric === 0);
check('the Manhattan days (1, 6) ALSO have no street tricycle (npcCounts(d).tric === 0)',
  npcCounts(1).tric === 0 && npcCounts(6).tric === 0);
check('the street-tricycle baseline is otherwise intact (other days keep their base tric count)',
  [2, 4, 5, 7].every(d => npcCounts(d).tric === BASE_NPC_COUNTS.tric));
check('findVehicleAhead ignores driveway tricycles', /!VEHICLE_TYPES\[other\.type\] \|\| other\.isDrivewayTric/.test(src));
check('findClosingVehicle ignores driveway tricycles', /!VEHICLE_TYPES\[v\.type\] \|\| !v\.boxW \|\| v\.isDrivewayTric/.test(src));
check('npcLaneFree ignores driveway tricycles', /!VEHICLE_TYPES\[v\.type\] \|\| !v\.boxW \|\| v\.isDrivewayTric/.test(src));
check('separateVehicles / truck-collision list excludes driveway tricycles', /v\.type !== 'lady' && !v\.isDrivewayTric/.test(src));

console.log(ok ? '\nFLATBUSH TRICYCLE CHECKS PASSED' : '\nFLATBUSH TRICYCLE CHECKS FAILED');
process.exit(ok ? 0 : 1);

