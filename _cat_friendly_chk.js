// _cat_friendly_chk.js — THE FRIENDLY BODEGA CAT.
// Two laws, both proven on the REAL `case "cat"` body extracted from index.html:
//   1. A cat the worker scared NEVER hurts him. It hisses, it charges, it gets in his
//      shins and it bolts — no stun, no trip, no knocked-out cargo, no HP.
//   2. THE TURNAROUND LAW. Each cat owns its store's frontage (blockMinX / blockMaxX from
//      setBlockBounds at spawn). When the worker herds it at the end of the block, the
//      "away" direction is the cross-street — a place the cat can no longer go — so the cat
//      flips and sprints the OPPOSITE direction, down the open sidewalk past the worker,
//      and the clamp stays the last word: no bolt ever parks a cat in a gap.
// Shims mirror _cat_teleport_chk.js; here the block law is injected FOR REAL.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) ok = false;
};

// ---- extract the real cat case + the real block law ----
const startIdx = src.indexOf('case "cat": {');
if (startIdx < 0) { console.error('cat case not found'); process.exit(1); }
const braceStart = src.indexOf('{', startIdx);
let d = 0, i = braceStart;
for (; i < src.length; i++) {
  if (src[i] === '{') d++;
  else if (src[i] === '}') { d--; if (!d) { i++; break; } }
}
const caseText = src.slice(startIdx, i);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lawIdx = src.indexOf('function blockClampX');
const roomIdx = src.indexOf('function blockRoomX');
function extractFn(from) {
  const b = src.indexOf('{', from); let k = 0, j = b;
  for (; j < src.length; j++) { if (src[j] === '{') k++; else if (src[j] === '}') { k--; if (!k) { j++; break; } } }
  return src.slice(from, j);
}
const blockClampX = new Function('clamp', extractFn(lawIdx) + '\nreturn blockClampX;')(clamp);
const blockRoomX = new Function(extractFn(roomIdx) + '\nreturn blockRoomX;')();

// ---- 1) static source law: the cat case is HARMLESS ----
check('the cat case calls NO doStun (no trip, no stagger, no scare damage)',
  caseText.indexOf('doStun(') < 0);
check('the cat case calls NO hurtNPC / HP drain (a bodega cat costs no health)',
  caseText.indexOf('hurtNPC(') < 0 && caseText.indexOf('HP_HIT') < 0);
check('the cat case calls NO dropCarried (the worker keeps what he is hauling)',
  caseText.indexOf('dropCarried(') < 0 && caseText.indexOf('carry !==') < 0);
check('the worker never screams at a cat (no "Yipes!" line in the cat case)',
  caseText.indexOf('Yipes') < 0);
check('the cat speaks for itself: "Hiss!" is anchored on the CAT, not the worker',
  /Voice\.say\("Hiss!",\s*0\.8,\s*1\.3,\s*c\.wx,\s*c\.wy,\s*null,\s*"cat"\)/.test(caseText) &&
  !/WORKER_GENDER/.test(caseText));
check('messing with the cat still pays the worker +10 street cash',
  /c\.state = "chasing";[\s\S]{0,300}awardPrankPoints\(10, p\.wx, p\.wy\)/.test(caseText));
check('THE TURNAROUND LAW is wired into the flight (blockRoomX flips a blocked escape)',
  /let away = typeof c\.fleeDir === "number" \? c\.fleeDir : \(tx > 0 \? 1 : -1\);[\s\S]{0,240}?if \(typeof blockRoomX === "function" && !blockRoomX\(c, away\)\)[\s\S]{0,90}?away = -away;/.test(caseText));
check('THE TURNAROUND LAW covers the dead end too (frontage ran out mid-panic -> turn around)',
  /Math\.abs\(runTo - c\.wx\) < 1e-4[\s\S]{0,420}?away = -away;/.test(caseText));
check('the panic COMMITS its direction (no wall-nosing): the chosen way is banked on the cat',
  /c\.fleeDir = away;/.test(caseText) && /c\.fleeDir = null;/.test(caseText));
check('the clamp stays the last word on the flight (blockClampX on every escape step)',
  /let runTo = c\.wx \+ away \* \(c\.sp \+ 1\.0\) \* dt;[\s\S]{0,160}?if \(typeof blockClampX === "function"\) runTo = blockClampX\(c, runTo\);/.test(caseText));
check('blockRoomX is declared before its first use (no TDZ at boot)',
  lawIdx > 0 && roomIdx > 0 && src.indexOf('blockRoomX(c, away)') > roomIdx);
check('the cat is still a sitting regular: the sit/lick cycle and flee -> settle stay intact',
  /c\.sitTimer = R\(2\.5, 5\.0\)/.test(caseText) && /c\.state = "sitting"/.test(caseText));

// ---- 2) behavioral harness (the real case, the real block law) ----
const R = (a, b) => a + Math.random() * (b - a);
const GZ = 0, state = 'play';
const parts = {
  body: { scale: { y: 1 }, position: { y: 0 } },
  bodyGroup: { position: { z: 0.18 } },
  headPivot: { rotation: { y: 0, z: 0 } },
  frontLegR: { rotation: { x: 0.5, y: -0.15 } },
  tailPivot: { rotation: { z: 0 } },
};
const animCat = (c, dp) => { c.phase = (c.phase || 0) + dp; };
let stuns = 0, drops = 0, hurts = 0;
const resetCounters = () => { stuns = 0; drops = 0; hurts = 0; };
const doStun = () => { stuns++; };
const dropCarried = () => { drops++; };
const hurtNPC = () => { hurts++; };
const Voice = { say: () => {} };
const awardPrankPoints = () => {};
const runCatCase = (c, p, dt) => {
  const fn = new Function('c', 'p', 'dt', 'R', 'GZ', 'Voice', 'state', 'clamp', 'pick',
    'doStun', 'dropCarried', 'hurtNPC', 'carry', 'animCat', 'blockClampX', 'blockRoomX',
    'awardPrankPoints', 'WORKER_GENDER',
    'const tx = c.wx - p.wx;\nswitch (c.type) { ' + caseText + ' }');
  fn(c, p, dt, R, GZ, Voice, state, clamp, (a) => a[0], doStun, dropCarried, hurtNPC, 'none',
    animCat, blockClampX, blockRoomX, awardPrankPoints, 'male');
};
// A Manhattan-style cat on its own block frontage: BLOCK_W 56, inset 1.0 (the real spawn call)
const BLOCK_W = 56, INSET = 1.0;
const makeCat = (wx, wy, blX) => ({
  type: 'cat', wx, wy, yMax: wy, sp: 6.0, dir: 1,
  state: 'sitting', stateT: 0, phase: 0,
  blockMinX: blX + INSET, blockMaxX: blX + BLOCK_W - INSET,
  g: { userData: { cat: parts }, rotation: { x: 0, y: 0, z: 0 }, position: { set() {} } },
});

// ---- 3) THE WORKER SHADOWS THE CAT ALL SHIFT: he is never hurt ----
{
  resetCounters();
  const blX = 200;
  const c = makeCat(blX + 3.0, 4.5, blX);
  const p = { wx: c.wx - 1.4, wy: 3.6 }; // right on top of the cat
  const dt = 1 / 60;
  let chaseFrames = 0, fleeFrames = 0, maxJump = 0;
  let px = c.wx;
  for (let t = 0; t < 60 * 60; t++) { // 60s of the worker following the cat around
    const x0 = c.wx;
    runCatCase(c, p, dt);
    maxJump = Math.max(maxJump, Math.abs(c.wx - x0));
    if (c.state === 'chasing') chaseFrames++;
    if (c.state === 'fleeing') fleeFrames++;
    px += Math.abs(c.wx - px) > 1.5 ? (c.wx - px > 0 ? 1 : -1) * 6 * dt : 0; // he keeps pace
    p.wx = px;
    p.wy = c.wy - 0.5;
  }
  check('60s of the worker shadowing a cat: ZERO stuns, ZERO dropped cargo, ZERO HP loss',
    stuns === 0 && drops === 0 && hurts === 0,
    'stuns=' + stuns + ' drops=' + drops + ' hurts=' + hurts);
  check('the cat still puts on the show (it chased and it fled through the 60s)',
    chaseFrames > 0 && fleeFrames > 0, 'chaseFrames=' + chaseFrames + ' fleeFrames=' + fleeFrames);
  check('the cat keeps living (it is not frozen mid-scene)', maxJump > 0,
    'maxJump=' + maxJump.toFixed(4));
}

// ---- 4) THE HERD AT THE CORNER: the escape lane is OFF the block -> run the other way ----
function herd(side) {
  // The cat is pinned at one end of its own frontage and the worker stands on the OPEN side,
  // so "away from the worker" points straight at the block's END (the cross-street). The cat
  // must refuse that lane and bolt INLAND.
  const blX = 100;
  const pinnedX = side === 'right' ? blX + BLOCK_W - INSET : blX + INSET;
  const c = makeCat(pinnedX, 4.5, blX);
  c.state = 'fleeing'; c.stateT = 0;
  const p = { wx: pinnedX + (side === 'right' ? -3 : 3), wy: 4.2 };
  const x0 = c.wx;
  const dt = 1 / 60;
  let flipped = false, outOfBand = null;
  for (let t = 0; t < 60; t++) { // one full second of panic
    runCatCase(c, p, dt);
    if (c.dir === (side === 'right' ? -1 : 1)) flipped = true;
    if (c.wx < c.blockMinX - 1e-6 || c.wx > c.blockMaxX + 1e-6)
      outOfBand = 't=' + t + ' wx=' + c.wx.toFixed(3) + ' band=[' + c.blockMinX + ',' + c.blockMaxX + ']';
  }
  const moved = c.wx - x0;
  return { flipped, inland: side === 'right' ? moved < -1 : moved > 1, outOfBand, moved, c };
}
{
  const r = herd('right');
  check('herded at the block RIGHT edge (the off-block lane): the cat turns around and bolts LEFT',
    r.flipped && r.inland, 'dx=' + r.moved.toFixed(3) + ' dir=' + r.c.dir);
  check('a cat cornered on the right never ends up in the cross-street (keeps its frontage)',
    r.outOfBand === null, r.outOfBand || 'band kept for 60 frames');
}
{
  const l = herd('left');
  check('herded at the block LEFT edge (the off-block lane): the cat turns around and bolts RIGHT',
    l.flipped && l.inland, 'dx=' + l.moved.toFixed(3) + ' dir=' + l.c.dir);
  check('a cat cornered on the left never ends up in the cross-street (keeps its frontage)',
    l.outOfBand === null, l.outOfBand || 'band kept for 60 frames');
}

// ---- 5) CONTROL: an escape lane that still exists is taken as-is (no pointless flip) ----
{
  const blX = 0;
  const c = makeCat(blX + 28, 4.5, blX); // dead centre of its frontage
  c.state = 'fleeing'; c.stateT = 0;
  const p = { wx: c.wx - 3.0, wy: 4.2 }; // worker on the LEFT -> the plain away is RIGHT
  const x0 = c.wx;
  for (let t = 0; t < 60; t++) runCatCase(c, p, 1 / 60);
  check('open sidewalk ahead: the cat keeps the plain away-from-worker direction (no flip)',
    c.dir === 1 && c.wx - x0 > 1, 'dx=' + (c.wx - x0).toFixed(3) + ' dir=' + c.dir);
}

// ---- 6) the full spook cycle on a real frontage: hiss -> flee -> SIT IN PLACE ----
{
  resetCounters();
  const blX = 300;
  const c = makeCat(blX + 10, 4.5, blX);
  const p = { wx: c.wx + 1.4, wy: 3.8 };
  const dt = 1 / 60;
  let chasing = false, fleeing = false, sat = false, badJump = null, prev = c.state;
  for (let t = 0; t < 60 * 10; t++) {
    const x0 = c.wx;
    runCatCase(c, p, dt);
    if (c.state === 'chasing') chasing = true;
    if (c.state === 'fleeing') fleeing = true;
    if (c.state === 'sitting' && prev === 'fleeing') sat = true;
    const jump = Math.abs(c.wx - x0);
    if (jump > (c.sp + 1.5 + 12) * dt * 1.05) badJump = 't=' + t + ' jump=' + jump.toFixed(4);
    prev = c.state;
  }
  check('a spooked cat hisses, bolts and sits back down on its own frontage (no teleport)',
    chasing && fleeing && sat && badJump === null,
    JSON.stringify({ chasing, fleeing, sat }) + ' ' + (badJump || 'continuous'));
  check('the whole cycle hurt nobody (no stun, no dropped cargo, no HP from the cat)',
    stuns === 0 && drops === 0 && hurts === 0,
    'stuns=' + stuns + ' drops=' + drops + ' hurts=' + hurts);
  check('THE TURNAROUND LAW is a direction test only: called in the cat flight, never to place',
    caseText.split('blockRoomX(').length - 1 === 2 &&
    src.split('blockRoomX(').length - 1 === 3,
    'case=' + (caseText.split('blockRoomX(').length - 1) + ' src=' + (src.split('blockRoomX(').length - 1));
}

// ---- 7) THE HARD HERD: the worker walks the cat east, right up the block, for a full
// panic. The cat outruns him to the corner, finds the lane gone, and must come BACK the
// other way (past him) instead of standing in the cross-street for the rest of the shift.
{
  const blX = 400;
  const c = makeCat(blX + 6, 4.5, blX);
  const p = { wx: c.wx - 1.4, wy: 4.0 }; // on the cat's heels, pushing east
  const dt = 1 / 60;
  let west = 0, outOfBand = null, maxJump = 0;
  for (let t = 0; t < 60 * 25; t++) { // 25s of herding
    const x0 = c.wx;
    runCatCase(c, p, dt);
    maxJump = Math.max(maxJump, Math.abs(c.wx - x0));
    if (c.state === 'fleeing' && c.dir === -1) west += c.sp * dt; // ground it covered going INLAND
    if (c.wx < c.blockMinX - 1e-6 || c.wx > c.blockMaxX + 1e-6)
      outOfBand = 't=' + t + ' wx=' + c.wx.toFixed(3) + ' band=[' + c.blockMinX + ',' + c.blockMaxX + ']';
    p.wx += 6 * dt; // he keeps walking east behind it
    p.wy = c.wy - 0.4;
  }
  check('herded the length of the block: the cat bolts INLAND (west) after the corner, not in the gap',
    west > 3 && outOfBand === null, 'inlandGround=' + west.toFixed(2) + ' ' + (outOfBand || 'band kept'));
  check('the herd never turned the cat into a teleporter (every step inside the run budget)',
    maxJump <= (c.sp + 1.5 + 12) * dt * 1.05, 'maxJump=' + maxJump.toFixed(4));
  check('the herd hurt nobody (stun / cargo / HP counters all zero through 25s)',
    stuns === 0 && drops === 0 && hurts === 0);
}

console.log(ok ? '\nALL FRIENDLY-CAT CHECKS PASSED' : '\nFRIENDLY-CAT CHECKS FAILED');
process.exit(ok ? 0 : 1);
