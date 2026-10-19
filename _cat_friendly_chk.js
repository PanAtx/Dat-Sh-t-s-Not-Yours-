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
  check('THE TURNAROUND LAW is a direction test only: every blockRoomX call site is a runner law, never a placement',
    (() => {
      const scA = src.indexOf('// PUNCHBACK SCARE-OFF');
      const scB = src.indexOf('switch (c.type) {', scA);
      const spans = [
        [roomIdx, roomIdx + 120], // the declaration
        [startIdx, i], // the bodega cat flight
        [src.indexOf('if (c.scareT > 0) {', scA), scB], // the punchback scare-off
        (() => { const a = src.indexOf('case "skunk": {'); return [a, src.indexOf('c.wx = stepX;', a)]; })(), // the Maspeth skunk flight (THE TURNAROUND LAW, skunk edition)
      ];
      const sites = [];
      for (let k = src.indexOf('blockRoomX('); k >= 0; k = src.indexOf('blockRoomX(', k + 1))
        sites.push(k);
      return (
        sites.length >= 2 &&
        sites.every((k) => spans.some((s) => s[0] >= 0 && k >= s[0] && k <= s[1]))
      );
    })(),
    'call sites = ' + (src.split('blockRoomX(').length - 1));
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

// ---- 8) THE COLLISION GATE (the way the cat ACTUALLY hurt the worker) ----
// The cat case is only half the law: collideCreatures owns body contact, and a type with no
// branch there falls into the last else - the VEHICLE branch (run-over: health, cargo, i-frames
// and a 1.2s stun). A bodega cat used to land there. The friendly law must be enforced at the
// contact gate, in the right ORDER (before the radius gate, before the vehicle branch).
{
  const ccStart = src.indexOf('function collideCreatures()');
  const ccEnd = src.indexOf('\n      function ', ccStart + 20);
  const cc = src.slice(ccStart, ccEnd > ccStart ? ccEnd : ccStart + 90000);
  const skipI = cc.indexOf('c.type === "cat") continue;');
  const radGate = cc.indexOf('const dx = c.wx - p.wx,');
  const vehI = cc.indexOf('HP_HIT_VEHICLE');
  check('collideCreatures SKIPS the cat: no bump contact is ever scored against it',
    skipI >= 0, 'skip at ' + skipI);
  check('the skip sits BEFORE the contact radius gate (the cat is never in the bump pool at all)',
    skipI >= 0 && radGate > skipI, 'skip=' + skipI + ' radiusGate=' + radGate);
  check('the vehicle branch (the run-over: health + cargo + i-frames + 1.2s stun) sits AFTER the skip',
    skipI >= 0 && vehI > skipI && cc.indexOf('doStun(1.2, "hit")', vehI) > vehI,
    'skip=' + skipI + ' vehicle=' + vehI);
  check('collideCreatures names the cat ONCE, and that one is the skip law',
    (cc.match(/c\.type === "cat"/g) || []).length === 1);
  check('no cat line inside the collision gate carries a weapon (no stun / damage / drop / i-frames)',
    cc.split(/\r?\n/).filter((l) => l.indexOf('"cat"') >= 0).every(
      (l) => !/doStun\(|hurtNPC\(|dropCarried\(|p\.invuln|HP_HIT/.test(l)));
  check('the cats are NOT on the horror list either (no night-shift damage rule can grab one)',
    !/HORROR_TYPES = \{[^}]*\bcat\b/.test(src));
}

// ---- 9) THE GREETING: the cat the worker did NOT scare says hello, at zero cost ----
{
  const greet = caseText.slice(
    caseText.indexOf('!c.purred'),
    caseText.indexOf('} else if (c.state === "chasing")'));
  check('THE GREETING is wired as the OTHER half of the spook test (hello only when the worker did NOT scare it)',
    /Voice\.say\("Hiss!"[\s\S]{0,220}\} else if \(\s*state === "play" &&\s*!c\.purred &&\s*!c\.hissed/.test(caseText));
  check('the hello is the CAT\u2019S line, anchored on the cat ("Purrr!"), one per cat per shift',
    /Voice\.say\("Purrr!",\s*0\.85,\s*1\.25,\s*c\.wx,\s*c\.wy,\s*null,\s*"cat"\)/.test(caseText) &&
    /c\.purred = true;/.test(greet));
  check('the greeting costs the worker NOTHING and pays him NOTHING (no stun / cargo / HP / cash)',
    greet !== '' && !/doStun\(|hurtNPC\(|dropCarried\(|awardPrankPoints\(/.test(greet));
  check('the greeting is a POSE only - it never moves the cat and never moves the worker',
    !/c\.wx\s*[-+]?=[^=]/.test(greet) && !/c\.wy\s*[-+]?=[^=]/.test(greet) &&
    !/p\.wx\s*[-+]?=[^=]/.test(greet) && !/p\.wy\s*[-+]?=[^=]/.test(greet));
  check('the hello pose is friendly reading: tail straight up + the flank rubbing the boot',
    (() => {
      const p0 = caseText.indexOf('if (c.rubT > 0) {');
      if (p0 < 0) return false;
      const pose = caseText.slice(p0, caseText.indexOf('c.sitTimer', p0) > p0 ? caseText.indexOf('c.sitTimer', p0) : p0 + 900);
      return /parts\.tailPivot\.rotation\.z = 0\.9/.test(pose) &&
        /Math\.sin\(c\.stateT \* 9\) \* 0\.22/.test(pose) &&
        /c\.g\.rotation\.z = c\.dir >= 0 \? lean : Math\.PI - lean/.test(pose);
    })());
  // behavioural: a walked-up cat says hello ONCE, stays put, hurts nobody; the scaring version hisses
  resetCounters();
  const blX = 500;
  const c = makeCat(blX + 10, 4.5, blX);
  const p = { wx: c.wx - 2.2, wy: 4.5 }; // in the greeting band, OUTSIDE the 1.8u scare radius
  const heard = [];
  const say = Voice.say;
  Voice.say = (line) => heard.push(line);
  const x0 = c.wx, y0 = c.wy;
  for (let t = 0; t < 60 * 15; t++) runCatCase(c, p, 1 / 60); // 15s of standing next to the cat
  Voice.say = say;
  const purrs = heard.filter((l) => l === 'Purrr!').length;
  check('the walked-up cat says hello exactly ONCE in 15s (and never hisses at a man who scared it)',
    purrs === 1 && heard.indexOf('Hiss!') < 0, 'heard=' + JSON.stringify(heard));
  check('the hello cat does not move and the worker pays nothing for the courtesy',
    c.wx === x0 && c.wy === y0 && stuns === 0 && drops === 0 && hurts === 0,
    'd=(' + (c.wx - x0) + ',' + (c.wy - y0) + ') stuns=' + stuns);
  // scaring it: HISSES (pays the +10 to the worker) and the hello does not repeat
  const c2 = makeCat(blX + 100, 4.5, blX);
  const p2 = { wx: c2.wx - 1.4, wy: 3.8 };
  const heard2 = [];
  Voice.say = (line) => heard2.push(line);
  for (let t = 0; t < 60 * 20; t++) {
    runCatCase(c2, p2, 1 / 60);
    p2.wx += Math.abs(c2.wx - p2.wx) > 1.5 ? (c2.wx - p2.wx > 0 ? 1 : -1) * 6 / 60 : 0;
    p2.wy = c2.wy - 0.5;
  }
  Voice.say = say;
  check('a SCARED cat hisses, bolts and never repeats the hello (the scared cat is not a greeting cat)',
    heard2.indexOf('Hiss!') >= 0 && heard2.filter((l) => l === 'Purrr!').length === 0 &&
    stuns === 0 && drops === 0 && hurts === 0,
    'heard=' + JSON.stringify(heard2.slice(0, 4)) + ' stuns=' + stuns);
}

// ---- 10) THE TURNAROUND LAW RUNS THE PUNCHBACK SCARE-OFF TOO (every block-owned runner) ----
{
  const scA = src.indexOf('// PUNCHBACK SCARE-OFF');
  const scB = src.indexOf('switch (c.type) {', scA);
  const scareSrc = src.slice(src.indexOf('if (c.scareT > 0) {', scA), scB);
  check('the scare-off block is extractable from updateCreatures', scA > 0 && scB > scA && scareSrc.length > 200);
  check('THE TURNAROUND LAW is wired into the scare-off (blockRoomX decides the lane, scareDir commits it)',
    /typeof blockRoomX === "function"/.test(scareSrc) &&
    /if \(!blockRoomX\(c, run\)\) run = -run;/.test(scareSrc) &&
    /c\.scareDir = c\.scareT > 0 \? run : null;/.test(scareSrc));
  check('the lane flip owns the facing (a runner who turns sprints PAST the worker, never runs backwards)',
    /c\.g\.rotation\.z = c\.scareDir >= 0 \? 0 : Math\.PI/.test(scareSrc));
  check('a fresh punch re-reads the lane (landPunch clears the committed direction)',
    /c\.scareT = 5;\s*\n\s*c\.scareDir = null;/.test(src));
  const mkRunner = (blX, blockW, pinnedX) => ({
    type: 'ped', wx: pinnedX, wy: 2.6, scareT: 5, dir: 1,
    blockMinX: blX + 1, blockMaxX: blX + blockW - 1,
    g: { position: { x: pinnedX, y: 2.6 }, rotation: { z: 0 } },
    parts: { legL: { rotation: { y: 0 } }, legR: { rotation: { y: 0 } } },
  });
  const runScare = (side) => {
    const blX = 100, blockW = 56;
    const pinnedX = side === 'right' ? blX + blockW - 1.5 : blX + 1.5;
    const c = mkRunner(blX, blockW, pinnedX);
    // The worker stands on the OPEN side of the frontage: the plain away-lane is the wall.
    const p = { wx: pinnedX + (side === 'right' ? -4 : 4), wy: 2.0 };
    const step = new Function('c', 'p', 'dt', 'clamp', 'GZ', 'animParts', 'blockClampX', 'blockRoomX',
      'for (let __i = 0; __i < 1; __i++) {\n' + scareSrc + '\n}');
    const dt = 1 / 60;
    const x0 = c.wx;
    let out = null, travel = 0, lastX = c.wx;
    for (let t = 0; t < 60 * 5; t++) {
      step(c, p, dt, clamp, 0.3, () => {}, blockClampX, blockRoomX);
      travel += Math.abs(c.wx - lastX); lastX = c.wx;
      if (c.wx < c.blockMinX - 1e-6 || c.wx > c.blockMaxX + 1e-6)
        out = 't=' + t + ' wx=' + c.wx.toFixed(3);
      if (c.scareT <= 0) break;
    }
    const moved = c.wx - x0; // INLAND means away from the wall he was pinned against
    const inland = side === 'right' ? moved < -5 : moved > 5;
    const dirOk = (c.g.rotation.z === 0 && c.dir >= 0) || (c.g.rotation.z === Math.PI && c.dir < 0);
    return { out, moved, inland, travel, dirOk, c };
  };
  const r = runScare('right');
  check('a runner pinned at the RIGHT end of his block takes the TURNAROUND: 5s panic sprints INLAND (west)', r.inland && r.out === null,
    'dx=' + r.moved.toFixed(2) + ' ' + (r.out || 'band kept'));
  check('the turned-around runner keeps his facing on the direction he travels (never runs backwards)',
    r.dirOk, 'dir=' + r.c.dir + ' rot=' + r.c.g.rotation.z.toFixed(3));
  const l = runScare('left');
  check('a runner pinned at the LEFT end of his block takes the TURNAROUND: 5s panic sprints INLAND (east)', l.inland && l.out === null,
    'dx=' + l.moved.toFixed(2) + ' ' + (l.out || 'band kept'));
  check('a scare-off sprint never lands in a cross-street (both pinned sides, 600 frames sampled)',
    r.out === null && l.out === null, (r.out || '') + ' ' + (l.out || ''));
  check('a panic on open frontage keeps running the plain away-lane (the lane law is not a flip generator)',
    (() => {
      const blX = 0, blockW = 56;
      const c = mkRunner(blX, blockW, blX + 28); // dead centre
      const p = { wx: c.wx - 4, wy: 2 }; // worker on the LEFT -> the plain away is RIGHT (open)
      const step = new Function('c', 'p', 'dt', 'clamp', 'GZ', 'animParts', 'blockClampX', 'blockRoomX',
        'for (let __i = 0; __i < 1; __i++) {\n' + scareSrc + '\n}');
      const x0 = c.wx;
      for (let t = 0; t < 60 * 1.5; t++) { step(c, p, 1 / 60, clamp, 0, () => {}, blockClampX, blockRoomX); if (c.scareT <= 0) break; }
      return c.dir === 1 && c.wx - x0 > 5 && c.scareDir === 1;
    })(),
    'open lane east, scareDir kept');
}

// ---- 11) THE COLLISION GATE, RUN FOR REAL (the proof, not the census) ----
// The census above can be satisfied by a lucky line of text. This runs the ACTUAL
// collideCreatures() body from index.html in a sandbox (with(S) scope: declared globals are
// real values, anything else resolves to a universal stub) and shoves a cat against the
// worker's body. A bodega cat must deal NOTHING. The car in the same spot is the positive
// control: it MUST deal 8 HP + a 1.2s stun + a dropped bag, proving the sim can see damage
// at all (a zero on the cat that came from a blind harness is worth nothing).
{
  const ccText = (() => {
    const from = src.indexOf('function collideCreatures(');
    if (from < 0) throw new Error('collideCreatures not found');
    const b = src.indexOf('{', from);
    let k = 0, j = b;
    for (; j < src.length; j++) { if (src[j] === '{') k++; else if (src[j] === '}') { k--; if (!k) { j++; break; } } }
    return src.slice(from, j);
  })();
  const stubCache = new Map();
  const makeStub = () => {
    const fn = function () { return thing; };
    const thing = new Proxy(fn, {
      get: (t, key) => {
        if (key === Symbol.toPrimitive) return () => 0;
        if (key === 'valueOf') return () => 0;
        if (key === 'toString') return () => '0';
        if (key === Symbol.iterator) return undefined;
        return thing;
      },
      set: () => true,
      apply: () => thing,
      construct: () => thing,
    });
    return thing;
  };
  const runCollide = (c) => {
    const rec = { stuns: [], hurts: [], drops: [], prank: 0 };
    const p = { wx: 0, wy: 4.5, health: 40, stunT: 0, stunDur: 0, invuln: 0, immuneT: 0, gagT: 0, sqLine: 0, facing: 0, shovelGuardT: 0, nightHitT: 0 };
    const real = {
      p, creatures: [c], state: 'play', carry: 'bag', carried: { type: 'bag' }, blocks: [],
      level: 5, GZ: 0.3, Math,
      HORROR_TYPES: {}, HORROR_HITS: {}, SPOOK_LINES: {}, droppedSlices: [],
      HP_HIT_VEHICLE: 8, HP_HIT_HAZARD: 2, HP_HIT_MAFIA: 4, HP_HIT_GHOST: 5, HP_GHOST_STREET: 5,
      HP_HIT_RAPPER: 2, HP_HIT_SCHOLAR: 1, HP_HIT_TEEBALL: 2, HP_HIT_SOCCERBALL: 2, HP_HIT_RCKID: 2,
      HORROR_STUN_T: 0.2, HORROR_TOUCH_CD: 1.5, NIGHT_HIT_GRACE: 1, FLINCH_T: 0.3,
      SHOVEL_BUTT: 1, SHOVEL_BLADE_R: 1, RC_TRUCK_STRIKE_R: 1.2, RC_TRUCK_STRIKE_CD: 2,
      workerMaxY: () => 8, isNightShift: () => false, isQueensLevel: () => false,
      isManhattanLevel: () => false, isBronxLevel: () => false, isFlatbushLevel: () => false,
      isBedStuyLevel: () => false, isStatenIslandLevel: () => false,
      shovelFacingOK: () => false,
      clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
      pick: (a) => a[0], R: (a) => a,
      Voice: { say: () => {} }, SFX: {},
      doStun: (dur, type) => { rec.stuns.push(type); p.stunT = dur; },
      hurtNPC: (amt, cause) => { rec.hurts.push({ amt, cause }); p.health -= amt; },
      dropCarried: () => { rec.drops.push(1); },
      awardPrankPoints: () => { rec.prank++; },
    };
    const scope = new Proxy(real, {
      has: () => true,
      get: (t, key) => {
        if (key in t) return t[key];
        if (typeof key === 'symbol') return undefined;
        if (!stubCache.has(key)) stubCache.set(key, makeStub());
        return stubCache.get(key);
      },
      set: (t, key, v) => { t[key] = v; return true; },
    });
    new Function('S', 'with (S) { ' + ccText + '\n  collideCreatures(); }')(scope);
    return { rec, p, c };
  };
  const mk = (type, wy) => ({
    type, wx: 0.45, wy: wy || 4.5, dir: 1, sp: 6, blockMinX: -5, blockMaxX: 60,
    g: { position: { x: 0.45, y: 4.5, z: 0.3 }, rotation: { z: 0 }, userData: {} },
  });
  const catRun = runCollide(mk('cat'));
  const catRun2 = runCollide(mk('cat')); // the mat cat's line (Bronx / Flatbush perched cats)
  const carRun = runCollide(mk('car'));
  check('THE CONTROL WORKS: a car in the same spot really does hurt him (8 HP + a 1.2s hit stun + a dropped bag)',
    carRun.rec.hurts.length === 1 && carRun.rec.hurts[0].cause === 'car' &&
    carRun.rec.stuns.length === 1 && carRun.rec.drops.length === 1 &&
    carRun.p.health === 32 && carRun.p.wx !== 0,
    JSON.stringify(carRun.rec) + ' hp=' + carRun.p.health);
  check('THE FRIENDLY BODEGA CAT: a cat pressed against the worker deals ZERO damage',
    catRun.rec.hurts.length === 0 && catRun2.rec.hurts.length === 0,
    JSON.stringify(catRun.rec.hurts) + ' ' + JSON.stringify(catRun2.rec.hurts));
  check('THE FRIENDLY BODEGA CAT: no stun, no stagger, no dropped cargo, no i-frames',
    catRun.rec.stuns.length === 0 && catRun.rec.drops.length === 0 &&
    catRun.p.stunT === 0 && catRun.p.invuln === 0,
    JSON.stringify(catRun.rec) + ' stunT=' + catRun.p.stunT + ' invuln=' + catRun.p.invuln);
  check('the worker keeps his footing AND his position (a cat is not a wall he bounces off)',
    catRun.p.wx === 0 && catRun.p.wy === 4.5 && catRun.p.health === 40,
    'p=(' + catRun.p.wx + ',' + catRun.p.wy + ') hp=' + catRun.p.health);
  check('the friendly cat is not a scoring exploit (the bump pays NO street cash)',
    catRun.rec.prank === 0, 'prank=' + catRun.rec.prank);
}

console.log(ok ? '\nALL FRIENDLY-CAT CHECKS PASSED' : '\nFRIENDLY-CAT CHECKS FAILED');
process.exit(ok ? 0 : 1);
