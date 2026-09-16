// _cat_teleport_chk.js — verify the bodega cat NEVER teleports.
// Extracts the REAL `case "cat"` body from index.html (same pattern as the
// other _chk.js scripts) and simulates a full sitting -> chasing -> fleeing ->
// sitting cycle, asserting the cat's position only ever changes continuously
// (no frame-to-frame jump above the per-frame run speed) and that the old
// flee->sit `c.wy = R(0.8, 2.5)` re-roll is gone.

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- extract the cat case body verbatim from updateCreatures' switch ----
const startIdx = src.indexOf('case "cat": {');
if (startIdx < 0) { console.error('cat case not found'); process.exit(1); }
const braceStart = src.indexOf('{', startIdx);
let d = 0, i = braceStart;
for (; i < src.length; i++) {
  if (src[i] === '{') d++;
  else if (src[i] === '}') { d--; if (!d) { i++; break; } }
}
const caseText = src.slice(startIdx, i);

// ---- shims used by the cat case ----
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0;
const VoiceRec = [];
const Voice = { say: (line, v1, v2, wx, wy, g, type) => VoiceRec.push({ line, type }) };
const state = 'play';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let carry = 'none';
const parts = {
  body: { scale: { y: 1 }, position: { y: 0 } },
  bodyGroup: { position: { z: 0.18 } },
  headPivot: { rotation: { y: 0, z: 0 } },
  frontLegR: { rotation: { x: 0.5, y: -0.15 } },
  tailPivot: { rotation: { z: 0 } },
};
function makeGCat() { return { userData: { cat: parts }, rotation: { x: 0, y: 0, z: 0 } }; }
function animCat(c, dphase) { c.phase = (c.phase || 0) + dphase; }

const runCatCase = (c, p, dt) => {
  const fn = new Function('c', 'p', 'dt', 'R', 'GZ', 'Voice', 'state', 'clamp',
    'doStun', 'dropCarried', 'carry', 'animCat',
    'const tx = c.wx - p.wx;\nswitch (c.type) { ' + caseText + ' }');
  fn(c, p, dt, R, GZ, Voice, state, clamp, () => {}, () => {}, carry, animCat);
};

// ---- 1) static source guard: no position re-roll in the cat case anymore ----
check('cat case has no `c.wy = R(` re-roll (the teleport line is gone)',
  !/c\.wy\s*=\s*R\(/.test(caseText));
check('cat case has no dead `lickTimer` assignment', caseText.indexOf('lickTimer') < 0);
check('cat case resets the sitting pose and arms sitTimer for the next lick',
  /c\.sitTimer\s*=\s*R\(2\.5,\s*5\.0\)/.test(caseText));

// ---- 2) behavioral: full spook -> charge -> flee -> settle cycle ----
// The cat case reads its rig from c.g.userData.cat (same as makeCat), so give
// every test cat the shared shim parts object.
const c = {
  type: 'cat',
  wx: 50.0,
  wy: 4.5,
  sp: 6.0, // within addCreature's R(5,7)
  dir: 1,
  state: 'sitting',
  stateT: 0,
  phase: 0,
  g: makeGCat(),
};
const p = { wx: c.wx - 1.4, wy: 3.5 }; // close enough to spook (|tx|<1.8, |dy|<1.2)

const dt = 1 / 60;
let maxFrameJump = 0;
let frames = 0;
let prevState = null;
let sawChasing = false, sawFleeing = false, sawSitAgain = false;
let badFrame = null;

for (let t = 0; t < 60 * 12; t++) { // 12s of simulation
  const x0 = c.wx, y0 = c.wy;
  runCatCase(c, p, dt);
  frames++;
  const jump = Math.hypot(c.wx - x0, c.wy - y0);
  maxFrameJump = Math.max(maxFrameJump, jump);
  // legal per-frame motion: run (sp+1.5) along x, plus the chasing y-lerp
  // (|dy| * 3 * dt, max |dy| ~ 4) — anything bigger means it teleported
  const budget = (c.sp + 1.5 + 12) * dt * 1.05;
  if (jump > budget) { badFrame = 't=' + t + 's jump=' + jump.toFixed(4) + ' budget=' + budget.toFixed(4); }
  if (c.state === 'chasing') sawChasing = true;
  if (c.state === 'fleeing') sawFleeing = true;
  if (c.state === 'sitting' && prevState === 'fleeing') {
    sawSitAgain = true;
    settledX = c.wx; settledY = c.wy;
  }
  prevState = c.state;
}

check('cycle reached the chasing state (spooked + hissed)', sawChasing,
  'voices=' + JSON.stringify(VoiceRec.map(v => v.line)));
check('cycle reached the fleeing state', sawFleeing);
check('after fleeing, the cat settles back into sitting', sawSitAgain);
check('no frame exceeded the cat\u2019s own run-speed budget (no teleport in ' + frames + ' frames)',
  badFrame === null, badFrame || 'maxFrameJump=' + maxFrameJump.toFixed(4));
// ---- 3) the flee->sit transition must add no DISCRETE jump ----
// The transition frame itself contains the cat's last frame of the run
// (continuous, bounded by flee speed). The NEXT frame (now sitting) must
// add exactly zero displacement — the cat sits right where it stopped.
const c2 = Object.assign({}, c, { state: 'fleeing', stateT: 2.29 }); // just past the 2.3s threshold
const x0 = c2.wx, y0 = c2.wy;
runCatCase(c2, p, dt); // transition frame: last flee step, then sits down
const dx1 = Math.abs(c2.wx - x0), dy1 = Math.abs(c2.wy - y0);
check('transition frame only ran the final flee step (no lateral re-roll: dy=0)',
  c2.state === 'sitting' && dy1 === 0 && dx1 <= (c.sp + 1.0) * dt * 1.05,
  'state=' + c2.state + ' dx=' + dx1.toFixed(4) + ' dy=' + dy1);
const x1 = c2.wx, y1 = c2.wy;
runCatCase(c2, p, dt); // settled sitting frame: must not move at all
check('settled cat is rock-stationary (sits exactly where it stopped, zero displacement)',
  c2.wx === x1 && c2.wy === y1, 'dx=' + (c2.wx - x1) + ' dy=' + (c2.wy - y1));
check('settled cat keeps its run-end spot (wy NOT re-rolled across the street)',
  c2.wy === y0, 'wy=' + c2.wy);
check('settled cat waits a beat before grooming again (sitTimer armed 2.5-5.0)',
  typeof c2.sitTimer === 'number' && c2.sitTimer >= 2.5 && c2.sitTimer <= 5.0, 'sitTimer=' + c2.sitTimer);

// ---- 4) regression: a far-away cat just sits and grooms, never moves ----
const c3 = {
  type: 'cat', wx: 90, wy: 4.5, sp: 6, dir: 1,
  state: 'sitting', stateT: 0, phase: 0,
  g: makeGCat(),
};
const p3 = { wx: 20, wy: 2.5 };
const x3 = c3.wx, y3 = c3.wy;
for (let t = 0; t < 60 * 5; t++) runCatCase(c3, p3, dt);
check('idle cat far from worker never moves (no wandering, no teleport)',
  c3.wx === x3 && c3.wy === y3, 'd=(' + (c3.wx - x3) + ',' + (c3.wy - y3) + ')');

console.log(ok ? '\nALL CAT-NO-TELEPORT CHECKS PASSED' : '\nCAT CHECKS FAILED');
process.exit(ok ? 0 : 1);

