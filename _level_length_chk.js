// _level_length_chk.js — THE SHORT-BLOCK LAW (the "levels are too long" fix), the damage
// offset that keeps the difficulty where it was, and the ONE street that must never shorten.
//
//   [1] The week's blocks run SEVEN buildings (7 x 8u = 56u), three fewer than the shipped
//       ten-house row; the block step, the intersections, the route anchors and the Maspeth
//       denser row all match that one number.
//   [2] The OVERTIME BASKETS round after Wednesday (level 3) keeps its PINNED 80u / 96u
//       street — 4 blocks, baskets at 94/178/190/274, wall at 384, 30s clock, $3000 goal.
//       Its length is fixed law: the week's shortening must not reach it.
//   [3] The route got a quarter shorter, so every hit lands DAMAGE_SCALE harder — the same
//       danger per shift in a shorter shift. The pinned bonus round is exempt (unscaled).
//   [4] The MIDNIGHT dead end rides the same knob (it is a week shift, so it shortens).
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

let ok = true;
function check(name, cond, extra) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '  [' + extra + ']' : ''));
  if (!cond) ok = false;
}
// N() reads a constant out of index.html and evaluates its expression. The env lets a
// derived constant reference the ones it is built from (BW, BLOCK_W, HOUSES_PER_BLOCK...).
const N = (name) => {
  const m = html.match(new RegExp('const ' + name + ' = ([^;]+);'));
  if (!m) return null;
  const raw = (nm) => {
    const mm = html.match(new RegExp('const ' + nm + ' = ([^;]+);'));
    return mm ? Number(mm[1]) : NaN;
  };
  const hN = raw('HOUSES_PER_BLOCK'), qN = raw('QUEENS_HOUSES_PER_BLOCK'), oN = raw('OLD_BLOCK_W');
  const env = {
    BW: 8, IW: 16,
    HOUSES_PER_BLOCK: hN,
    OLD_BLOCK_W: oN,
    QUEENS_HOUSES_PER_BLOCK: qN,
    BLOCK_W: hN * 8,
    BLOCK_STEP: hN * 8 + 16,
  };
  try {
    return Number(new Function('BW', 'IW', 'HOUSES_PER_BLOCK', 'OLD_BLOCK_W', 'QUEENS_HOUSES_PER_BLOCK', 'BLOCK_W', 'BLOCK_STEP', 'return (' + m[1] + ')')(env.BW, env.IW, env.HOUSES_PER_BLOCK, env.OLD_BLOCK_W, env.QUEENS_HOUSES_PER_BLOCK, env.BLOCK_W, env.BLOCK_STEP));
  } catch (e) {
    return null;
  }
};

const BW = 8, IW = 16;
const houses = N('HOUSES_PER_BLOCK');
const oldHousesW = N('OLD_BLOCK_W');
const queensHouses = N('QUEENS_HOUSES_PER_BLOCK');
const BLOCK_W = BW * houses;
const BLOCK_STEP = BLOCK_W + IW;
const blocksSrc = html.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
const xsSrc = html.match(/const LEVEL_XS = \[([^\]]*)\];/);
if (!blocksSrc || !xsSrc) {
  console.log('FAILED: could not find LEVEL_BLOCKS / LEVEL_XS');
  process.exit(1);
}
const LEVEL_BLOCKS = eval('[' + blocksSrc[1] + ']');
const LEVEL_XS = eval('[' + xsSrc[1] + ']');
const ROUTE_START_X = N('ROUTE_START_X');
const PLAYER_START_X = N('PLAYER_START_X');
const ROUTE_FINISH_X = N('ROUTE_FINISH_X');
const ROUTE_END_X = N('ROUTE_END_X');

console.log('[1] THE SHORT-BLOCK LAW — every block is 3 buildings shorter');
check('a block runs 7 buildings (was 10)', houses === 7, 'HOUSES_PER_BLOCK=' + houses);
check('the block is 56u wide (7 x 8u), the old row was 80u', BLOCK_W === 56 && oldHousesW === 80, 'BLOCK_W=' + BLOCK_W);
check('the block step is block + intersection (72u)', BLOCK_STEP === 72);
check('LEVEL_BLOCKS sits on the 72u step (6 blocks, buffers clean, 4 active)',
  LEVEL_BLOCKS.length === 6 && LEVEL_BLOCKS.every((b, i) => b.x === i * BLOCK_STEP) &&
    LEVEL_BLOCKS[0].garbage === false && LEVEL_BLOCKS[5].garbage === false &&
    LEVEL_BLOCKS.slice(1, 5).every((b) => b.garbage === true),
  LEVEL_BLOCKS.map((b) => b.x).join('/'));
check('every intersection is the far edge of its block (x + 56)',
  LEVEL_XS.length === LEVEL_BLOCKS.length && LEVEL_XS.every((x, i) => x === LEVEL_BLOCKS[i].x + BLOCK_W),
  LEVEL_XS.join('/'));
check('ROUTE_START_X is Intersection 1 (56)', ROUTE_START_X === LEVEL_XS[0], 'x=' + ROUTE_START_X);
check('PLAYER_START_X is the middle of Intersection 1 (64)', PLAYER_START_X === ROUTE_START_X + IW / 2, 'x=' + PLAYER_START_X);
check('ROUTE_FINISH_X is the last ACTIVE block far edge (344)', ROUTE_FINISH_X === LEVEL_XS[LEVEL_XS.length - 2], 'x=' + ROUTE_FINISH_X);
check('ROUTE_END_X is the far edge of the finish buffer block (432)', ROUTE_END_X === LEVEL_BLOCKS[5].x + BLOCK_STEP, 'x=' + ROUTE_END_X);
check('the walkable route is 288u — a quarter less than the shipped 384u',
  ROUTE_FINISH_X - ROUTE_START_X === 288 && N('ROUTE_SPAN_X') === 288 && N('OLD_ROUTE_SPAN_X') === 384,
  'span=' + (ROUTE_FINISH_X - ROUTE_START_X));
check('Maspeth packs 9 buildings per shortened block (was 12)', queensHouses === 9);
check('the Maspeth middle cell is (BLOCK_W - 2*8) / 7, corners keep 8u',
  Math.abs(N('QUEENS_MID_W') - (BLOCK_W - 2 * BW) / (queensHouses - 2)) < 1e-9 &&
    /function queensCellW\(i\) \{[\s\S]*?i === 0 \|\| i === QUEENS_HOUSES_PER_BLOCK - 1 \? BW : QUEENS_MID_W/.test(html),
  'mid=' + N('QUEENS_MID_W').toFixed(4));
check('Maspeth cemetery rides the 5th block (index 4), the oak the 3rd (index 2)',
  /const QUEENS_CEMETERY_BLOCK = (\d+)/.test(html) && Number(html.match(/const QUEENS_CEMETERY_BLOCK = (\d+)/)[1]) === 4 &&
    /const QUEENS_OAK_BLOCK = (\d+)/.test(html) && Number(html.match(/const QUEENS_OAK_BLOCK = (\d+)/)[1]) === 2,
  'cemetery=' + html.match(/const QUEENS_CEMETERY_BLOCK = (\d+)/)[1] + ' oak=' + html.match(/const QUEENS_OAK_BLOCK = (\d+)/)[1]);
check('the block-local spawn bands are off the block width, not baked 80u numbers',
  /const BLOCK_EDGE_IN = 10;/.test(html) && /const MID_BLOCK_LO = BLOCK_W \/ 4;/.test(html) &&
    /const MID_BLOCK_HI = BLOCK_W \* 0\.75;/.test(html) && !/bx \+ R\(20, 60\)/.test(html) &&
    !/blockMaxX = bx \+ 76;/.test(html));

console.log('\n[2] THE OVERTIME BONUS ROUND AFTER WEDNESDAY — length is fixed law');
const BONUS_BLOCKS = N('BONUS_BLOCKS');
const BONUS_CELLS = N('BONUS_CELLS');
const BONUS_BLOCK_W = N('BONUS_BLOCK_W');
const BONUS_STEP = N('BONUS_STEP');
const BONUS_START_X = N('BONUS_START_X');
const BONUS_PLAYER_START_X = N('BONUS_PLAYER_START_X');
const BONUS_ROUTE_END_X = N('BONUS_ROUTE_END_X');
const BONUS_XS = eval('[' + html.match(/const BONUS_XS = \[([^\]]*)\];/)[1] + ']');
const BONUS_BLOCK_XS = eval('[' + html.match(/const BONUS_BLOCK_XS = \[([^\]]*)\];/)[1] + ']');
check('the bonus fires exactly once, right after the Wednesday level (day 3)', N('BONUS_DAY_TRIGGER') === 3);
check('the clock and the goals are the shipped 30s / $3000 / 6 baskets',
  N('BONUS_TIME') === 30 && N('BONUS_CASH_GOAL') === 3000 && N('BONUS_BASKET_COUNT') === 6);
check('the overtime street is 4 blocks of 10 cells (80u) on a 96u step — NOT the week\'s 56u / 72u',
  BONUS_BLOCKS === 4 && BONUS_CELLS === 10 && BONUS_BLOCK_W === 80 && BONUS_STEP === 96,
  'cells=' + BONUS_CELLS + ' block=' + BONUS_BLOCK_W + ' step=' + BONUS_STEP);
check('the pinned overtime grid is 0 / 96 / 192 / 288 with gaps at 80 / 176 / 272 / 344',
  BONUS_BLOCK_XS.join('/') === '0/96/192/288' && BONUS_XS.join('/') === '80/176/272/344');
check('overtime wall at 384, barrier at 80, clock-in at 88 — the shipped round, untouched',
  BONUS_ROUTE_END_X === 384 && BONUS_START_X === 80 && BONUS_PLAYER_START_X === 88);
check('the overtime street is STILL 384u long — the length the week used to be: it did not shrink',
  BONUS_ROUTE_END_X === 384 && BONUS_ROUTE_END_X === N('OLD_ROUTE_SPAN_X'));
check('the overtime world builder runs its OWN grid (BONUS_BLOCK_XS x BONUS_CELLS)',
  /for \(let blkIdx = 0; blkIdx < BONUS_BLOCKS; blkIdx\+\+\) \{[\s\S]{0,300}?const bl = \{ x: BONUS_BLOCK_XS\[blkIdx\] \};[\s\S]{0,200}?for \(let i = 0; i < BONUS_CELLS; i\+\+\)/.test(html));
check('its cells stay 8u wide (bl.x + i * BW), so the store row keeps its shipped width',
  /const bl = \{ x: BONUS_BLOCK_XS\[blkIdx\] \};[\s\S]{0,400}?const worldX = bl\.x \+ i \* BW/.test(html));
check('its baskets stay on the pinned corners 94 / 178 / 190 / 274',
  /const corners = \[\s*\[BONUS_XS\[0\], \+1\],[\s\S]*\[BONUS_XS\[1\], -1\],[\s\S]*\[BONUS_XS\[1\], \+1\],[\s\S]*\[BONUS_XS\[2\], -1\],/.test(html) &&
    BONUS_XS[0] + IW / 2 + 6 === 94 && BONUS_XS[1] + IW / 2 - 6 === 178 &&
    BONUS_XS[1] + IW / 2 + 6 === 190 && BONUS_XS[2] + IW / 2 - 6 === 274,
  'baskets=' + [94, 178, 190, 274].join('/'));
check('its bodega cats walk the pinned blocks (BONUS_BLOCK_XS, not the week row)',
  /const blX = BONUS_BLOCK_XS\[catBlocks\[i\]\];[\s\S]{0,200}?bc\.wx = blX \+ 3\.0/.test(html));
check('the worker\'s lane answers the pinned overtime grid (laneStartX / laneEndX / laneSpawnX)',
  /function laneStartX\(\) \{[\s\S]{0,120}?BONUS \? BONUS_START_X : ROUTE_START_X/.test(html) &&
    /function laneEndX\(\) \{[\s\S]{0,120}?BONUS \? BONUS_ROUTE_END_X : ROUTE_END_X/.test(html) &&
    /function laneSpawnX\(\) \{[\s\S]{0,120}?BONUS \? BONUS_PLAYER_START_X : PLAYER_START_X/.test(html) &&
    /return typeof laneSpawnX === "function" \? laneSpawnX\(\) : PLAYER_START_X;/.test(html));
check('the overtime walk clamp is unchanged (80 behind, 384 ahead)',
  /if \(p\.wx < startLine\) p\.wx = startLine;/.test(html) &&
    /const startLine = typeof laneStartX === "function" \? laneStartX\(\) : ROUTE_START_X;/.test(html) &&
    /if \(BONUS && p\.wx > BONUS_ROUTE_END_X\) p\.wx = BONUS_ROUTE_END_X;/.test(html));
check('the overtime ground stays the short pinned street, not the week length',
  /GROUND_R = BONUS \? BONUS_ROUTE_END_X \+ 6 : ROUTE_END_X \+ 264/.test(html));
check('the overtime intersections are the pinned gaps (BONUS_XS), never the week\'s LEVEL_XS',
  /nightGap \? NIGHT_XS : bonusGap \? BONUS_XS : LEVEL_XS/.test(html));


console.log('\n[3] THE DAMAGE OFFSET — a quarter less street, a third more per hit');
const DAMAGE_SCALE = N('DAMAGE_SCALE');
check('DAMAGE_SCALE is the shipped span over the new span (384 / 288 = 4 / 3)',
  Math.abs(DAMAGE_SCALE - 384 / 288) < 1e-9, 'scale=' + DAMAGE_SCALE);
check('hurtNPC applies it to the amount (every hazard, NPC, ghost and boss bite)',
  /function hurtNPC\(amount, cause, noYelp, allowCinematic\) \{[\s\S]{0,1200}?const dmgScale =[\s\S]{0,400}?DAMAGE_SCALE[\s\S]{0,300}?health = Math\.max\(0, health - \(amount \|\| 0\) \* dmgScale\);/.test(html));
check('the PINNED overtime round is exempt from the scale (its length never changed)',
  /typeof DAMAGE_SCALE === "number" && !\(typeof BONUS !== "undefined" && BONUS\)/.test(html));
check('the offset is ONE choke point — no per-NPC damage number was rescaled by hand',
  (html.match(/const dmgScale =/g) || []).length === 1 &&
    !/health - \(amount \|\| 0\);/.test(html));
check('the health pool, the danger line and the heals keep their shipped values',
  /let health = 100,\s*maxHealth = 100;/.test(html) &&
    /const DANGER_HP = Math\.ceil\(maxHealth \* 0\.10\)/.test(html) &&
    N('POWERUP_HEAL_COFFEE') === 25 && N('POWERUP_HEAL_BEC') === 40);

console.log('\n[4] THE MIDNIGHT DEAD END rides the same knob (a week shift, so it shortens)');
const NTX = N('NIGHT_TOP_X'), NSX = N('NIGHT_START_X'), NEX = N('NIGHT_END_X'),
  NFX = N('NIGHT_FENCE_X'), NGX = N('NIGHT_GRAVE_X'), NBLK = N('NIGHT_GRAVE_BLOCK_X'),
  NSEAL = N('NIGHT_SEAL_X'), NBOSS = N('NIGHT_BOSS_X'), NTRIG = N('NIGHT_BOSS_TRIGGER_X'),
  NTRAIL = N('NIGHT_TRAIL_X'), NSTD = N('NIGHT_FENCE_STANDOFF'), NTOPB = N('NIGHT_TOP_BLOCK_X');
check('the top block is the 5th block of the shortened street (288)', NTOPB === LEVEL_BLOCKS[4].x);
check('the cul-de-sac wall and the clock-in sit off the block grid (350 / 329)',
  NTX === LEVEL_BLOCKS[4].x + BLOCK_W + 6 && NSX === NTX - NTRAIL, 'top=' + NTX + ' in=' + NSX);
check('the seal line is the graves block\'s near edge (BLOCK_W)', NSEAL === NBLK + BLOCK_W);
check('the boss rises 6u below the seal and wakes 16u above it',
  NBOSS === NSEAL - 6 && NTRIG === LEVEL_BLOCKS[1].x + 2 * BW);
check('the graveyard keeps its fence geometry (fence = wall + 8, gate = fence + 8)',
  NFX === NEX + 8 && NGX === NFX + 8);
check('the four haunted beats are the four blocks above the graves, in order',
  N('NIGHT_BEAT_TOP_X') === LEVEL_BLOCKS[4].x && N('NIGHT_BEAT_VERMIN_X') === LEVEL_BLOCKS[3].x &&
    N('NIGHT_BEAT_DIGGER_X') === LEVEL_BLOCKS[2].x && N('NIGHT_BEAT_GRAVE_X') === LEVEL_BLOCKS[1].x,
  [N('NIGHT_BEAT_TOP_X'), N('NIGHT_BEAT_VERMIN_X'), N('NIGHT_BEAT_DIGGER_X'), N('NIGHT_BEAT_GRAVE_X')].join('/'));
const NXS = eval('[' + html.match(/const NIGHT_XS = \[([^\]]*)\];/)[1] + ']');
const NGAP = eval('[' + html.match(/const NIGHT_GAP_XS = \[([^\]]*)\];/)[1] + ']');
check('the night has ONE cross-street (the top of the street) and the rest is plain road',
  NXS.length === 1 && NXS[0] === LEVEL_XS[4], 'xs=' + NXS.join('/'));
check('the paved-over gaps are exactly the other intersections',
  NGAP.join('/') === LEVEL_XS.filter((x) => x !== LEVEL_XS[4]).join('/'), 'gaps=' + NGAP.join('/'));
check('the boss ring stays a ring: floor above the yard wall, under the iron\'s face',
  NFX + NSTD > NEX && NFX + NSTD < NSEAL - 1.55, 'floor=' + (NFX + NSTD) + ' ceil=' + (NSEAL - 1.55));
check('the night street is shorter too (329 in, 29 floor): the week shortens uniformly',
  NSX - (NFX + NSTD) < 449 - (38 + 1.6), 'span=' + (NSX - NFX - NSTD).toFixed(1));

console.log('\n' + (ok ? 'SHORT-BLOCK LENGTH + DAMAGE LAWS PASSED' : 'SHORT-BLOCK LENGTH + DAMAGE LAWS FAILED'));
process.exit(ok ? 0 : 1);
