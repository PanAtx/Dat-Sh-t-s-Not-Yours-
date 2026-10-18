// _npc_intersection_keep_chk.js — THE BLOCK-RESIDENCY LAW GATE.
//
// Why this exists: the SHORT-BLOCK LAW took three buildings off every block (10 houses -> 7,
// BLOCK_W 80u -> 56u) while every cross-street gap stayed 16u wide and the step stayed 72u.
// Every run-off distance, leash, wander radius and spawn band that was tuned for the long block
// therefore reaches INTO the gap. The visible symptom: on Harlem (Saturday) the street-baller
// takes a punchback, bolts from the sanitation worker for 5s at ~7 u/s (35u) with nothing
// clamping him, and is found standing in the MIDDLE OF AN INTERSECTION.
//
//   [1] the street geometry the law is measured against (7-house blocks, 16u gaps);
//   [2] the REAL law helpers, lifted out of index.html and run: bounds, gap detection, snaps;
//   [3] the REAL scare-off block, run for a full 5s flee from every Harlem block — he must
//       end on his own frontage, never in a gap;
//   [4] the roster law: every block-owned NPC spawn authors its bounds (BLOCK_W-derived) and
//       every runner clamps its flee/chase/wander x;
//   [5] the spawn-band law: no block spawn is measured off the retired 80u street any more;
//   [6] the residency pass is the last word before every creature's mesh is synced;
//   [7] harness law: every new global use is typeof-guarded (the *_chk harnesses inject a
//       subset of globals and must keep running the real functions unchanged).
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let fails = 0,
  checks = 0;
function check(name, ok, extra) {
  checks++;
  if (!ok) {
    fails++;
    console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : ''));
  } else console.log('PASS  ' + name + (extra ? '  [' + extra + ']' : ''));
}
const numOf = (re) => Number((html.match(re) || [])[1]);

// ================= [1] THE STREET THE LAW IS MEASURED AGAINST =================
const BW = 8,
  IW = 16;
const houses = numOf(/const HOUSES_PER_BLOCK = (\d+);/);
const BLOCK_W = BW * houses;
const BLOCK_STEP = BLOCK_W + IW;
const blocksSrc = html.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
const LEVEL_BLOCKS = blocksSrc ? eval('[' + blocksSrc[1] + ']') : [];
const ACTIVE_XS = LEVEL_BLOCKS.filter((b) => b.garbage).map((b) => b.x);
check('the week runs SEVEN houses per block (BLOCK_W = 56u, retired from 80u)', houses === 7 && BLOCK_W === 56, BLOCK_W + 'u');
check('every cross-street gap is 16u and the step stays 72u', BLOCK_STEP === 72, 'step ' + BLOCK_STEP);
check('the route has four ACTIVE blocks (the start/finish buffers carry no NPCs)', ACTIVE_XS.length === 4, ACTIVE_XS.join('/'));
const GAPS = LEVEL_BLOCKS.map((b) => ({ lo: b.x + BLOCK_W, hi: b.x + BLOCK_W + IW }));
const inGap = (x) => GAPS.some((g) => x > g.lo && x < g.hi);

// ================= [2] THE REAL LAW HELPERS, OUT OF index.html =================
const lawStart = html.indexOf('const NPC_BLOCK_INSET');
const lawEnd = html.indexOf('const RUN_SPEED =');
check('the block-residency law block is present in the layout section', lawStart > 0 && lawEnd > lawStart);
const lawSrc = html.slice(lawStart, lawEnd).replace(/^\s*\/\/.*$/gm, '');
const LAW = new Function(
  'LEVEL_BLOCKS',
  'BLOCK_W',
  'IW',
  'BONUS',
  'BONUS_BLOCK_XS',
  'BONUS_BLOCK_W',
  'clamp',
  lawSrc +
    '; return { NPC_BLOCK_INSET, routeBlockXs, routeBlockW, blockIndexAtX, inIntersectionX, blockSafeX, setBlockBounds, blockClampX };',
)(
  LEVEL_BLOCKS,
  BLOCK_W,
  IW,
  false,
  [0, 96, 192, 288],
  80,
  (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
);
check('every block center resolves to its own block', LEVEL_BLOCKS.every((b) => LAW.blockIndexAtX(b.x + BLOCK_W / 2) === LEVEL_BLOCKS.indexOf(b)));
check('every intersection midpoint is detected as a cross-street', GAPS.every((g) => LAW.inIntersectionX((g.lo + g.hi) / 2)));
check('blockSafeX pulls every gap position out onto a block frontage', GAPS.every((g) => !LAW.inIntersectionX(LAW.blockSafeX((g.lo + g.hi) / 2))));
check('blockSafeX leaves an on-block position where it stands', LEVEL_BLOCKS.every((b) => LAW.blockSafeX(b.x + BLOCK_W / 2) === b.x + BLOCK_W / 2));
{
  const o = LAW.setBlockBounds({}, ACTIVE_XS[0]);
  check('setBlockBounds authors HARD bounds inside the block (never overlapping a gap)', o.blockMinX > ACTIVE_XS[0] && o.blockMaxX < ACTIVE_XS[0] + BLOCK_W, o.blockMinX + '..' + o.blockMaxX);
  check('the bounds shrink with the block (BLOCK_W - 2 x inset, not the retired 80u street)', o.blockMaxX - o.blockMinX === BLOCK_W - 2 * LAW.NPC_BLOCK_INSET, o.blockMaxX - o.blockMinX + 'u of frontage');
  const span = o.blockMaxX - o.blockMinX;
  check('the bounds are wide enough for a 35u panic sprint to be caught inside them', span > 30, 'span ' + span);
}
check('blockClampX passes a creature with NO authored block straight through (traffic/birds/vermin own the street)', LAW.blockClampX({ wx: 500 }, 500) === 500 && LAW.blockClampX(null, 777) === 777);
{
  // the whole route, sampled thick: whatever the pass returns must never be a gap
  let bad = 0;
  for (let x = 0; x <= 432; x += 0.5) {
    const o = LAW.setBlockBounds({}, ACTIVE_XS[Math.min(ACTIVE_XS.length - 1, Math.max(0, Math.round(x / BLOCK_STEP)))]);
    if (LAW.inIntersectionX(LAW.blockClampX(o, x))) bad++;
  }
  check('blockClampX NEVER returns a cross-street position (865 samples across the route)', bad === 0, bad + ' leaks');
}
// ================= [3] THE REPORTED BUG, RUN WITH THE REAL SCARE-OFF ================
const scA = html.indexOf('// PUNCHBACK SCARE-OFF');
const scB = html.indexOf('switch (c.type) {', scA);
const scareSrc = html.slice(html.indexOf('if (c.scareT > 0) {', scA), scB);
check('the scare-off block is extractable from updateCreatures', scA > 0 && scB > scA && scareSrc.length > 200);
const mkBall = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { x: 0, y: 0, z: 0 } });
const runFlee = (bx, dirSign, clampFn) => {
  const courtX = bx + BLOCK_W / 2;
  const c = {
    type: 'bball',
    wx: courtX,
    wy: 2.6,
    scareT: 5,
    ballState: 'dribble',
    ballG: mkBall(),
    ballW: { x: courtX, y: 3.15, z: 1 },
    g: { position: { x: courtX, y: 2.6, set(x, y) { this.x = x; this.y = y; } }, rotation: { z: 0 } },
    parts: { legL: { rotation: { y: 0 } }, legR: { rotation: { y: 0 } } },
  };
  LAW.setBlockBounds(c, bx); // the spawn-authored bounds (checked in [4])
  const p = { wx: courtX - dirSign * 6, wy: 0 }; // the worker punched him from dirSign*6 away
  const step = new Function('c', 'p', 'dt', 'clamp', 'GZ', 'animParts', 'blockClampX', 'for (let __i = 0; __i < 1; __i++) {\n' + scareSrc + '\n}');
  const dt = 1 / 60;
  let leak = 0;
  for (let i = 0; i < 320; i++) {
    step(c, p, dt, (v, lo, hi) => Math.min(hi, Math.max(lo, v)), 0.3, () => {}, clampFn);
    if (inGap(c.wx)) leak++;
    if (inGap(c.ballW.x)) leak++;
    if (c.scareT <= 0) break;
  }
  return { from: courtX, to: c.wx, ran: Math.abs(c.wx - courtX), leak, minX: c.blockMinX, maxX: c.blockMaxX };
};
{
  const off = runFlee(ACTIVE_XS[0], 1, (o, x) => x); // the law OFF = the shipped sprint
  check('UNCLAMPED, the baller really does land in an intersection (the bug is real)', off.leak > 0 && inGap(off.to), 'x=' + off.to.toFixed(1) + ', ' + off.leak + ' gap frames');
}
let allFleeOk = true,
  fled = 0,
  detail = '';
for (const bx of ACTIVE_XS) {
  for (const dirSign of [1, -1]) {
    const r = runFlee(bx, dirSign, LAW.blockClampX);
    fled++;
    const onFrontage = r.to >= r.minX - 1e-9 && r.to <= r.maxX + 1e-9;
    if (r.leak !== 0 || !onFrontage || r.ran < 10) {
      allFleeOk = false;
      detail = 'x=' + r.to.toFixed(1) + ' bounds ' + r.minX + '..' + r.maxX + ' leak ' + r.leak;
    }
  }
}
check('WITH THE LAW: every 5s punchback sprint (4 Harlem blocks x both directions) ends on his own frontage, zero gap frames', allFleeOk, fled + ' sprints, ' + (detail || 'clean'));
{
  const r = runFlee(ACTIVE_XS[1], 1, LAW.blockClampX);
  check('a block-bound runner still RUNS (he is not glued to his spot)', r.ran > 10, r.ran.toFixed(1) + 'u covered');
  check('and he stops at the sidewalk edge of his block, not in the gap', !inGap(r.to) && r.to <= r.maxX + 1e-9, 'x=' + r.to.toFixed(1) + ' in ' + r.minX + '..' + r.maxX);
}

// ================= [4] THE ROSTER LAW: BLOCK-OWNED SPAWNS AUTHOR THEIR BOUNDS ============
const BOUNDED_SPAWNS = [
  ['Harlem street-baller (the reported case)', /const bb = addCreature\("bball"\);[\s\S]{0,600}?setBlockBounds\(bb, bbBlock\.x\);/],
  ['Bronx corner-store panhandler', /const ph = addCreature\("panhandler"\);[\s\S]{0,700}?setBlockBounds\(ph, bl\.x\);/],
  ['Maspeth skunk mom', /const mom = addCreature\("skunk", \{ mom: true \}\);[\s\S]{0,900}?setBlockBounds\(mom, sb\.x\);/],
  ['skunk babies inherit her block', /bb\.blockMinX = mom\.blockMinX;[\s\S]{0,120}?bb\.blockMaxX = mom\.blockMaxX;/],
  ['bodega cat on its store block', /const bc = addCreature\("cat", \{ palette: coats\[i\] \}\);[\s\S]{0,1200}?setBlockBounds\(bc, bl\.x, 1\.0\);/],
  ['soccer kids: the chalk field is their frontage', /sk\.minX = sMinX;[\s\S]{0,160}?sk\.blockMinX = sMinX;/],
  ['tee-ball kids: the pitch is their frontage', /tk\.minX = tMinX;[\s\S]{0,160}?tk\.blockMinX = tMinX;/],
  ['Harlem manhole alligator draws from the ACTIVE blocks', /const gatorBlocks = LEVEL_BLOCKS\.filter\(\s*\(b\) => b\.garbage === true,/],
];
for (const [label, re] of BOUNDED_SPAWNS) check('spawn authors bounds: ' + label, re.test(html));
const ALREADY = ['blockMinX = bx + 4', 'blockMinX = b.x + 6.0', 'blockMinX = fbBlock.x + 6.0', 'blockMinX = rpBlock.x + 6.0', 'blockMinX = chB.x + 4', 'blockMinX = b.x + 4', 'pimpBlockX + 4.0', 'blockMinX = duelBlock.x + 6.0'];
check('the block roster that already authored bounds is untouched (homeowner / karen / housewife / football / rapper / cart homeless / crazy / pimp / dogs / shooters)', ALREADY.every((s) => html.indexOf(s) >= 0), ALREADY.length + ' anchors');

// ================= [5] THE RUN-OFF LAW: every runner clamps its x ==================
const RUNOFF = [
  ['the generic punchback scare-off clamps the fleeing x', /c\.wx \+= \(c\.wx >= p\.wx \? 1 : -1\) \* 7 \* dt;[\s\S]{0,900}?if \(typeof blockClampX === "function"\) c\.wx = blockClampX\(c, c\.wx\);/],
  ['cat charge clamps', /const catSpd = c\.sp \+ 1\.5;[\s\S]{0,240}?if \(typeof blockClampX === "function"\) c\.wx = blockClampX\(c, c\.wx\);/],
  ['cat bolt clamps (THE TURNAROUND LAW re-anchor: the escape step is measured as runTo, then clamped)', /let runTo = c\.wx \+ away \* \(c\.sp \+ 1\.0\) \* dt;[\s\S]{0,300}?if \(typeof blockClampX === "function"\) runTo = blockClampX\(c, runTo\);/],
  ['cat turnaround step clamps too (a bolted cat turns at a dead end and the new lane is clamped as well)', /away = -away;[\s\S]{0,300}?runTo = blockClampX\(c, runTo\);[\s\S]{0,200}?c\.wx = runTo;/],
  ['skunk bolt clamps', /c\.wx \+= away \* 7 \* dt;[\s\S]{0,400}?if \(typeof blockClampX === "function"\) c\.wx = blockClampX\(c, c\.wx\); \/\/ a bolted skunk/],
  ['skunk mom picks her next trot target on her block', /c\.tx = R\(p\.wx - 30, p\.wx \+ 40\);[\s\S]{0,240}?if \(typeof blockClampX === "function"\) c\.tx = blockClampX\(c, c\.tx\);/],
  ['panhandler wander target is snapped onto his frontage', /c\.tgtX = typeof blockClampX === "function" \? blockClampX\(c, c\.homeX \+ Math\.cos\(a\) \* r\)/],
  ['panhandler never drifts into the gap after his mark', /c\.wx \+= \(pdx \/ pd\) \* sp \* dt;[\s\S]{0,240}?if \(typeof blockClampX === "function"\) c\.wx = blockClampX\(c, c\.wx\); \/\/ he begs on HIS corner/],
  ['polishboy walk-away stays on his sister block', /c\.wx \+= sdx \* 2 \* dt;[\s\S]{0,240}?if \(L\) c\.wx = clamp\(c\.wx, L\.minX, L\.maxX\);/],
  ['polishboy back-off stays on his sister block', /c\.wx \+= bdx \* 1\.6 \* dt;[\s\S]{0,240}?if \(L\) c\.wx = clamp\(c\.wx, L\.minX, L\.maxX\);/],
  ['crossfire panic shoves pedestrians onto the near frontage', /c\.wx \+= fx \* FLEE \* dt;[\s\S]{0,600}?if \(typeof blockSafeX === "function"\) c\.wx = blockSafeX\(c\.wx\);/],
];
for (const [label, re] of RUNOFF) check('run-off clamps: ' + label, re.test(html));
// ============ [6] THE SPAWN-BAND LAW: nothing is measured off the retired 80u block =========
const STALE = [
  ['the skunk band is the block frontage (no 10 + R(0, 60) reach)', /mom\.wx = sb\.x \+ BLOCK_EDGE_IN \+ R\(0, BLOCK_W - 2 \* BLOCK_EDGE_IN\);/.test(html)],
  ['the panhandlers home is pulled inside his bounds at spawn', /ph\.homeX = clamp\(ph\.homeX, ph\.blockMinX, ph\.blockMaxX\);/.test(html)],
  ['no Maspeth cat corner is pinned to the 80u block end (79.35)', !/\?\s*0\.65\s*:\s*79\.35/.test(html)],
  ['no Bronx cat mat hangs off the block corner (bl.x - 2.6)', !/bc\.wx = bl\.x - 2\.6/.test(html)],
  ['no NPC spawn band still uses the old mid-block R(20, 60)', !/x \+ R\(20, 60\)/.test(html)],
  ['no spawn hardcodes the retired bx + 76 block end', !/bx \+ 76/.test(html)],
  ['the gator no longer draws from the retired 96..384 x range', !/b\.x >= 96 && b\.x <= 384/.test(html)],
];
for (const [label, cond] of STALE) check('spawn band: ' + label, cond === true);

// ============ [7] THE RESIDENCY PASS IS THE LAST WORD BEFORE THE MESH IS SYNCED ============
check(
  'the residency pass clamps every bounded creature right before the loop-tail mesh sync',
  /THE BLOCK-RESIDENCY LAW, LAST WORD[\s\S]{0,800}?if \(typeof blockClampX === "function"\) c\.wx = blockClampX\(c, c\.wx\);\s*\n\s*c\.g\.position\.x = c\.wx;\s*\n\s*c\.g\.position\.y = c\.wy;/.test(html),
);
const lawIdx = html.indexOf('function blockClampX');
const firstUseIdx = html.indexOf('if (typeof blockClampX === "function")');
check('the law is declared before its first use (no TDZ at boot)', lawIdx > 0 && firstUseIdx > lawIdx);
check('the law is derived from BLOCK_W (a shorter street means shorter bounds)', /o\.blockMaxX = blockX \+ routeBlockW\(\) - inu;/.test(html) && /return BONUS \? BONUS_BLOCK_W : BLOCK_W;/.test(html));
check('the OVERTIME street keeps its own pinned grid inside the law', /return BONUS \? BONUS_BLOCK_XS\.slice\(\) : LEVEL_BLOCKS\.map\(\(b\) => b\.x\);/.test(html));

// ============ [8] THE HARNESS LAW (the gate fleet runs real function bodies) ============
const guards = (html.match(/typeof blockClampX === "function"/g) || []).length + (html.match(/typeof blockSafeX === "function"/g) || []).length;
check('every new global use inside a creature body is typeof-guarded (100+ check harnesses inject a subset of globals)', guards >= 9, guards + ' guards');
check('no gate harness needs new globals injected (the law is additive: the scare-off/crossfire/cat blocks keep their original lines)', /c\.wx \+= \(c\.wx >= p\.wx \? 1 : -1\) \* 7 \* dt;/.test(html) && /c\.wy = clamp\(c\.wy, 0\.8, 4\.4\); \/\/ stay on the walkable band/.test(html) && /clamp\(c\.wy \+ \(p\.wy - c\.wy\) \* dt \* 3, 0\.5, c\.yMax\)/.test(html));

console.log('\n' + (checks - fails) + ' passed, ' + fails + ' failed');
console.log(fails ? 'BLOCK-RESIDENCY CHECKS FAILED' : 'BLOCK-RESIDENCY CHECKS PASSED');
process.exit(fails ? 1 : 0);


