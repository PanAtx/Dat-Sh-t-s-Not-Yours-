// _skunk_turnaround_chk.js — verify the Maspeth (Thursday) skunk flee obeys
// THE TURNAROUND LAW: when the worker herds a skunk into the corner of ITS OWN
// block, "away from the worker" runs off the frontage into the cross-street, so
// the skunk must FLIP and bolt the OPPOSITE way (past the worker, down the open
// walk) instead of pinning itself at the block clamp — which is how the worker
// used to get stuck behind a cornered skunk and spray-stunned at will.
// The REAL `case "skunk"` block is extracted from index.html verbatim and run
// frame-by-frame (same harness style as _raccoon_chk.js).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error(name + ' not found in index.html');
  let brace = src.indexOf('{', idx);
  let depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}
// pull the WHOLE `case "skunk": { ... }` clause out of updateCreatures
function extractCase(type) {
  const marker = 'case "' + type + '": {';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error(marker + ' not found in index.html');
  if (src.indexOf(marker, idx + 1) >= 0) throw new Error(marker + ' is not unique in index.html');
  let brace = idx + marker.length - 1;
  let depth = 0, i = brace;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(idx, i + 1);
}

// ---- harness scope the extracted case closes over ----
// NOTE: the case is run through new Function(), whose body resolves identifiers
// in the GLOBAL scope — so every helper the case touches lives on globalThis.
globalThis.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
globalThis.R = (a, b) => (a + b) / 2; // deterministic midpoint — keeps the asserts exact
globalThis.creatureMaxY = () => 6;
globalThis.workerMaxY = () => 8; // the worker's walkable band (harness stub)
globalThis.npcRoadRules = () => 0;
globalThis.animSkunk = () => {};
globalThis.spawnDustEffect = () => {};
globalThis.pick = (arr) => arr[0];
globalThis.state = "play";
globalThis.WORKER_GENDER = "male";
globalThis.SKUNK_SPRAY_R = 2.5;
globalThis.SKUNK_SPRAY_CD = 3.0;
globalThis.SKUNK_SPRAY_LINES = ["Hrrrp!", "Get away from me!"]; // the harness stubs
globalThis.HP_HIT_SKUNK = 4;
let sprays, stuns, voiceLines;
globalThis.hurtNPC = (amount, cause) => sprays.push({ amount, cause });
globalThis.doStun = (dur, type) => stuns.push(type);
globalThis.Voice = { say(text) { voiceLines.push(text); } };

// the REAL residency helpers, extracted verbatim from index.html
eval(extractFn('blockClampX'));
eval(extractFn('blockRoomX'));
if (typeof blockClampX !== 'function' || typeof blockRoomX !== 'function')
  throw new Error('blockClampX / blockRoomX not extracted');
globalThis.blockClampX = blockClampX;
globalThis.blockRoomX = blockRoomX;

// ---- run the REAL skunk update case frame by frame ----
const skunkCaseSrc = extractCase('skunk');
const runner = new Function('c', 'dt', 'p', 'switch (c.type) { ' + skunkCaseSrc + ' }');

let ok = true;
const check = function (label, cond, extra) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + label + (cond || extra === undefined ? '' : '  [' + extra + ']'));
  if (!cond) ok = false;
};

// A Maspeth block: 56u wide, every sidewalk anchor inset 4u from the corners
const BX = 100, BLOCK_W = 56, INSET = 4;
const MINX = BX + INSET, MAXX = BX + BLOCK_W - INSET; // 104 .. 152

function mkSkunk(extra) {
  const c = Object.assign({
    type: 'skunk', wx: BX + BLOCK_W / 2, wy: 4.6, sp: 2.6, dir: 1,
    flee: 0, fleeDir: null, sprayCd: 0, sprayT: 0,
    t: 0, tx: 0, ty: 4.6,
    g: { rotation: { z: 0 }, position: { x: 0, y: 0, z: 0 } },
  }, extra || {});
  c.blockMinX = MINX;
  c.blockMaxX = MAXX;
  return c;
}
// simulate `secs` of frames; feed each frame to the observer
function sim(c, p, secs, observe) {
  const dt = 1 / 60;
  for (let k = 0; k < Math.round(secs * 60); k++) {
    const before = c.wx;
    runner(c, dt, p);
    if (observe) observe(c, before, dt);
  }
}

// ===== 1) THE CORNER HERD: worker at the skunk's back, block edge ahead =====
// The pre-fix statue: she pins at blockMaxX and the worker (close behind) sprays
// on cooldown forever. Post-fix she flips and bolts WEST, right past him.
sprays = []; stuns = []; voiceLines = [];
{
  const mom = mkSkunk({ mom: true, wx: MAXX, flee: 2.0 }); // pinned at her east corner
  const p = { wx: 150, wy: 4.6 }; // worker right behind her, 2u — inside spray range
  let outOfBlock = false, fledWest = 0, flip = false;
  sim(mom, p, 2.0, (c, before) => {
    if (c.wx > MAXX + 1e-9 || c.wx < MINX - 1e-9) outOfBlock = true;
    if (c.wx < before - 1e-9) { fledWest += before - c.wx; flip = true; }
  });
  const endWx = mom.wx;
  const panicWest = fledWest;
  sim(mom, p, 0.1); // a beat of calm after the panic
  check('cornered at her east edge, the escape lane (cross-street) is REFUSED — she bolts WEST', flip && endWx < MAXX - 10, 'wx=' + endWx.toFixed(2));
  check('she never noses into the cross-street: block residency clamp holds', !outOfBlock);
  check('she gains real ground west (>= 12u in the 2s panic)', panicWest >= 12, 'west=' + panicWest.toFixed(2));
  check('the corner herd ends OUT OF SPRAY RANGE: worker takes zero sprays', sprays.length === 0, JSON.stringify(sprays));
  check('the next panic re-reads which side the worker is on (fleeDir cleared at panic end)', mom.flee <= 0 && mom.fleeDir === null, 'flee=' + mom.flee.toFixed(3) + ' fleeDir=' + mom.fleeDir);
  check('she stays on her frontage after the flip (west edge respected)', mom.wx >= MINX, 'wx=' + mom.wx.toFixed(2));
}

// ===== 2) THE MID-CORNER HERD: the wall is reached mid-panic =====
{
  sprays = []; stuns = []; voiceLines = [];
  const mom = mkSkunk({ mom: true, wx: 148, flee: 2.0 });
  const p = { wx: 140, wy: 4.6 }; // herding from the west
  let outOfBlock = false, prevDir = null, flips = 0;
  sim(mom, p, 2.0, (c) => {
    if (c.wx > MAXX + 1e-9) outOfBlock = true; // she may reach the edge but never pass it
    if (prevDir !== null && c.fleeDir !== null && c.fleeDir !== prevDir) flips++;
    if (c.fleeDir !== null) prevDir = c.fleeDir;
  });
  const endWx2 = mom.wx;
  sim(mom, p, 0.1); // a beat of calm after the panic
  check('runs out the last of the frontage, clamps AT the edge (never past it)', !outOfBlock && mom.wx <= MAXX, 'wx=' + mom.wx.toFixed(2));
  check('flips ONCE when the frontage dies, then sprints the open way west', flips >= 1 && flips <= 2 && mom.fleeDir === null, 'flips=' + flips);
  check('westbound ground gained: she ends well past her start (ran past the herd)', endWx2 < 148 - 5, 'wx=' + endWx2.toFixed(2));
}

// ===== 3) COMMITTED PANIC: no nosing back at the wall while passing the worker =====
{
  sprays = []; stuns = []; voiceLines = [];
  const mom = mkSkunk({ mom: true, wx: MAXX - 0.5, flee: 2.0, fleeDir: -1 }); // mid-flip, west committed
  const p = { wx: 150, wy: 4.6 }; // she is about to run right past him
  let eastSteps = 0;
  sim(mom, p, 2.0, (c, before) => { if (c.wx > before + 1e-9) eastSteps++; });
  check('committed direction: zero eastward steps while the panic runs (no wall nosing)', eastSteps === 0, 'eastSteps=' + eastSteps);
  check('she clears the worker going west and stays in bounds', mom.wx < 150 - 1 && mom.wx >= MINX, 'wx=' + mom.wx.toFixed(2));
}

// ===== 4) THE BABIES obey THE SAME LAW (shared flee branch, inherited bounds) =====
{
  sprays = []; stuns = []; voiceLines = [];
  const mom = mkSkunk({ mom: true, wx: 146 });
  const bb = mkSkunk({ baby: true, wx: MAXX - 0.5, flee: 2.0, follow: mom });
  const p = { wx: 150, wy: 4.6 };
  let outOfBlock = false;
  sim(bb, p, 2.0, (c) => { if (c.wx > MAXX + 1e-9 || c.wx < MINX - 1e-9) outOfBlock = true; });
  check('a cornered BABY skunk flips and bolts west too (same law, same clamp)', bb.wx < MAXX - 10 && !outOfBlock, 'wx=' + bb.wx.toFixed(2));
}

// ===== 5) OPEN BLOCK: the law must NOT interfere when the escape lane is wide =====
{
  sprays = []; stuns = []; voiceLines = [];
  const mom = mkSkunk({ mom: true, wx: 120, flee: 1.0 });
  const p = { wx: 118, wy: 4.6 }; // worker behind her, 22u+ of open frontage ahead
  let dirs = new Set();
  sim(mom, p, 1.0, (c) => { if (c.fleeDir !== null) dirs.add(c.fleeDir); });
  check('open frontage: the skunk just bolts AWAY (east), no spurious flip', mom.wx > 126.5 && [...dirs].join(',') === '1', 'wx=' + mom.wx.toFixed(2) + ' dirs=' + [...dirs].join(','));
}

// ===== 6) THE LAW IS WIRED INTO THE SKUNK CASE (structure) =====
{
  const usesRoom = (skunkCaseSrc.match(/blockRoomX/g) || []).length;
  const usesCommit = (skunkCaseSrc.match(/fleeDir/g) || []).length;
  check('the skunk case consults THE TURNAROUND TEST (blockRoomX) when fleeing', usesRoom >= 2, 'uses=' + usesRoom);
  check('the skunk case commits its panic direction (fleeDir)', usesCommit >= 4, 'uses=' + usesCommit);
  check('the law is documented in the skunk case (TURNAROUND LAW, SKUNK EDITION)', skunkCaseSrc.includes('TURNAROUND LAW, SKUNK EDITION'));
}

console.log(ok ? '\nSKUNK TURNAROUND CHECKS PASSED' : '\nSKUNK TURNAROUND CHECKS FAILED');
process.exit(ok ? 0 : 1);

