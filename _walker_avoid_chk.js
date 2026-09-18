// _walker_avoid_chk.js — validate the two new walker behaviors (all levels):
//   1) NPC walkers have a real SPREAD of speeds (strollers, normal, brisk, and a
//      genuine hurry) — npcPace() — instead of everyone walking the same pace.
//   2) Walkers route AROUND solid obstacles (hydrants, trees, curb bags/cans, litter
//      baskets, other pedestrians/animals) while staying on the walkable band —
//      npcWalkAroundObstacles() — instead of clipping straight through them.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ---- robust function extractor (brace-counted) ----
function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++){
    if (src[i] === '{') depth++;
    else if (src[i] === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
function caseBlock(type){
  const updStart = src.indexOf('function updateCreatures(dt) {');
  const s = src.indexOf('case "' + type + '":', updStart);
  let i = src.indexOf('{', s), d = 0;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (d === 0) break; } }
  return src.slice(s, i + 1);
}

let ok = true;
const check = (label, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || extra === undefined ? '' : '  [' + extra + ']'));
  if (!cond) ok = false;
};
const R = (a, b) => a + Math.random() * (b - a);

console.log('[1] NYC pace spread (npcPace)');
check('npcPace() is defined', extractFn('npcPace').length > 0);
const pace = new Function('R', 'return (' + extractFn('npcPace') + ');')(R);
const samples = [];
for (let i = 0; i < 6000; i++) samples.push(pace());
const mn = Math.min.apply(null, samples), mx = Math.max.apply(null, samples);
const bucket = { slow: 0, normal: 0, fast: 0, hurry: 0 };
for (const s of samples){
  if (s < 1.3) bucket.slow++;
  else if (s < 2.7) bucket.normal++;
  else if (s < 4.6) bucket.fast++;
  else bucket.hurry++;
}
check('has slow walkers (strollers)', mn < 1.0, 'min=' + mn.toFixed(2));
check('has a normal city walk', bucket.normal > 1000, 'normal=' + bucket.normal);
check('has brisk / power-walkers', bucket.fast > 700, 'fast=' + bucket.fast);
check('has genuinely FAST, dashing walkers (the challenge)', mx > 5.0, 'max=' + mx.toFixed(2));
check('speeds are actually VARIED (spread > 4 units)', mx - mn > 4.0, 'spread=' + (mx - mn).toFixed(2));
check('the three main walkers all use npcPace()', ['ped', 'lady', 'dogwalker'].every(t => {
  const c = src.indexOf('case "' + t + '":');
  return c >= 0 && src.slice(c, c + 400).indexOf('npcPace()') >= 0;
}));
check('scholar keeps his slow, dignified stroll (unchanged)', src.indexOf('c.sp = R(0.7, 1.0);') >= 0);

console.log('[2] avoidance is wired into the walker cases');
const pedCase = caseBlock('ped');
check('ped/lady/dogwalker route around obstacles', pedCase.indexOf('npcWalkAroundObstacles(') >= 0);
check('ped case only avoids when no vehicle-escape is active (yieldLane guard)', pedCase.indexOf('c.yieldLane === undefined') >= 0);
check('ped case keeps the hard stoop clamp (wy <= pedTop)', pedCase.indexOf('c.wy = Math.min(c.wy, pedTop)') >= 0);
check('ped case keeps the Bronx floor clamp (wy >= 0.75)', pedCase.indexOf('if (isBronxLevel()) c.wy = Math.max(c.wy, 0.75);') >= 0);
const schCase = caseBlock('scholar');
check('scholar also routes around obstacles', schCase.indexOf('npcWalkAroundObstacles(') >= 0);
check('scholar still walks + animates (c.wx += c.sp * dt / animParts)', schCase.indexOf('c.wx += c.sp * dt') >= 0 && schCase.indexOf('animParts(') >= 0);

console.log('[3] the obstacle set a walker should route around');
const avoidSrc = extractFn('npcWalkAroundObstacles');
check('hydrants (type "hit") are avoided', avoidSrc.indexOf('hz[j].type === "hit"') >= 0);
check('sidewalk trees (b.trees) are avoided', avoidSrc.indexOf('b.trees') >= 0);
check('curb bags are avoided', avoidSrc.indexOf('bag.state === "curb"') >= 0);
check('curb cans are avoided', avoidSrc.indexOf('hse.can') >= 0);
check('litter baskets (placed) are avoided', avoidSrc.indexOf('litterBaskets') >= 0 && avoidSrc.indexOf('lb.state === "placed"') >= 0);
check('other pedestrians / animals are avoided (AVOID_TYPES)', avoidSrc.indexOf('AVOID_TYPES[o.type]') >= 0);
['ped', 'lady', 'dogwalker', 'scholar', 'dog', 'cat', 'raccoon', 'squirrel', 'leashdog'].forEach(t =>
  check('AVOID_TYPES includes ' + t, new RegExp('\\b' + t + ':\\s*1,?').test(src)));
check('trees are registered as avoidable obstacles (b.trees, world coords)', /b\.trees\.push\(\{ wx: baseX \+ tx, wy: ty \}\)/.test(src));
check('a flat hazard (pothole/bottle "trip") is NOT treated as solid', /if \(hz\[j\]\.type === "hit"\) consider/.test(avoidSrc));

console.log('[4] RUNTIME: a walker actually routes around obstacles, staying in the band');
global.WALKER_R = 0.5;
global.AVOID_TYPES = { ped: 1, lady: 1, dogwalker: 1, scholar: 1, dealer: 1, panhandler: 1, dog: 1, cat: 1, raccoon: 1, squirrel: 1, leashdog: 1 };
global.AVOID_AHEAD = 6.0;
global.blocks = [];
global.creatures = [];
global.litterBaskets = [];
eval(extractFn('npcWalkAroundObstacles'));

const dt = 0.016;
const reset = () => { global.blocks.length = 0; global.creatures.length = 0; global.litterBaskets.length = 0; };
const stepN = (c, n) => { for (let i = 0; i < n; i++) npcWalkAroundObstacles(c, dt, c.__yMin, c.__yMax); };
const inBand = (c) => c.wy >= c.__yMin - 1e-9 && c.wy <= c.__yMax + 1e-9;

// (a) a hydrant in the lane ahead -> steps around it, stays on the sidewalk
reset(); global.blocks.push({ hazards: [{ wx: 11, wy: 1.0, r: 0.75, type: 'hit' }], house: { bags: [], can: null } });
{
  const c = { type: 'ped', wx: 8, wy: 1.0, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('hydrant ahead: walker STEPS AROUND it (wy changed)', Math.abs(c.wy - startWy) > 0.5, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
  check('hydrant ahead: moves to the CLEAR side (off the curb obstacle)', c.wy > 1.0 + 0.75, 'wy=' + c.wy.toFixed(2));
  check('hydrant ahead: stays on the sidewalk (never off curb / onto stoop)', inBand(c), 'wy=' + c.wy.toFixed(2));
}
// (b) a flat hazard (pothole) in the lane -> NOT avoided (it is walkable, not solid)
reset(); global.blocks.push({ hazards: [{ wx: 11, wy: 3.0, r: 0.9, type: 'trip' }], house: { bags: [], can: null } });
{
  const c = { type: 'ped', wx: 8, wy: 3.0, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 80);
  check('pothole ahead: walker HOLDS its line (flat, not solid)', Math.abs(c.wy - startWy) < 0.05, 'wy ' + startWy + ' -> ' + c.wy.toFixed(3));
}
// (c) another pedestrian ahead -> routes around them
reset(); global.blocks.push({ hazards: [], house: { bags: [], can: null } }); global.creatures.push({ type: 'lady', wx: 11, wy: 1.5 });
{
  const c = { type: 'ped', wx: 8, wy: 2.0, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('pedestrian ahead: walker routes AROUND them', Math.abs(c.wy - startWy) > 0.4, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
  check('pedestrian ahead: stays in band', inBand(c), 'wy=' + c.wy.toFixed(2));
}
// (d) a curb bag ahead -> routes around it
reset(); global.blocks.push({ hazards: [], house: { bags: [{ state: 'curb', wx: 11, wy: 1.5 }], can: null } });
{
  const c = { type: 'dogwalker', wx: 8, wy: 1.5, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('curb bag ahead: walker routes around it', Math.abs(c.wy - startWy) > 0.4, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
  check('curb bag ahead: stays in band', inBand(c), 'wy=' + c.wy.toFixed(2));
}
// (e) a litter basket ahead -> routes around it
reset(); global.litterBaskets.push({ state: 'placed', wx: 11, wy: 2.5 });
{
  const c = { type: 'ped', wx: 8, wy: 2.5, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('litter basket ahead: walker routes around it', Math.abs(c.wy - startWy) > 0.4, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
}
// (f) direction-aware: heading LEFT (-X) still avoids the obstacle to its left
reset(); global.blocks.push({ hazards: [{ wx: 5, wy: 1.0, r: 0.75, type: 'hit' }], house: { bags: [], can: null } });
{
  const c = { type: 'ped', wx: 8, wy: 1.0, dir: -1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('walking LEFT (-X): avoids the hydrant to its left', Math.abs(c.wy - startWy) > 0.4, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
  check('walking LEFT (-X): stays in band', inBand(c), 'wy=' + c.wy.toFixed(2));
}
// (g) an obstacle BEHIND us is NOT avoided (only things ahead matter)
reset(); global.blocks.push({ hazards: [{ wx: 4, wy: 1.0, r: 0.75, type: 'hit' }], house: { bags: [], can: null } });
{
  const c = { type: 'ped', wx: 8, wy: 1.0, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 80);
  check('obstacle behind us: walker does NOT detour', Math.abs(c.wy - startWy) < 0.05, 'wy ' + startWy + ' -> ' + c.wy.toFixed(3));
}
// (h) a tree ahead -> routes around the trunk
reset(); global.blocks.push({ hazards: [], trees: [{ wx: 11, wy: 1.4 }], house: { bags: [], can: null } });
{
  const c = { type: 'ped', wx: 8, wy: 1.4, dir: 1, __yMin: 0.8, __yMax: 5.0 }, startWy = c.wy;
  stepN(c, 200);
  check('tree ahead: walker routes around the trunk', Math.abs(c.wy - startWy) > 0.4, 'wy ' + startWy + ' -> ' + c.wy.toFixed(2));
  check('tree ahead: stays in band', inBand(c), 'wy=' + c.wy.toFixed(2));
}

console.log('\n' + (ok ? 'WALKER AVOID CHECKS PASSED' : 'WALKER AVOID CHECKS FAILED'));
process.exit(ok ? 0 : 1);