// _level_chk.js — verify the fixed level layout (8 blocks + 8 intersections)
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

function grab(re){ const m = html.match(re); return m ? m[1] : null; }

// Pull out the raw LEVEL_BLOCKS array
const blocksSrc = html.match(/const LEVEL_BLOCKS = \[([\s\S]*?)\];/);
const xsSrc     = html.match(/const LEVEL_XS = \[([\s\S]*?)\];/);
if (!blocksSrc || !xsSrc) { console.error('FAILED: could not find LEVEL_BLOCKS / LEVEL_XS'); process.exit(1); }

const BW = 8, HOUSES_PER_BLOCK = 10, BLOCK_W = BW * HOUSES_PER_BLOCK;
const IW = parseInt(grab(/const IW = (\d+);/));
const ROUTE_START_X  = parseInt(grab(/const ROUTE_START_X\s*=\s*(\d+);/));
const PLAYER_START_X = parseInt(grab(/const PLAYER_START_X\s*=\s*(\d+);/));
const ROUTE_FINISH_X = parseInt(grab(/const ROUTE_FINISH_X\s*=\s*(\d+);/));

const LEVEL_BLOCKS = eval('[' + blocksSrc[1] + ']');
const LEVEL_XS     = eval('[' + xsSrc[1] + ']');

let ok = true;
function check(name, cond, extra){ console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '  [' + extra + ']' : '')); if (!cond) ok = false; }

check('exactly 8 blocks', LEVEL_BLOCKS.length === 8, 'count=' + LEVEL_BLOCKS.length);
check('exactly 8 intersections', LEVEL_XS.length === 8, 'count=' + LEVEL_XS.length);

// Block widths + ordering
let prevEnd = -Infinity;
let widthOk = true, orderOk = true;
for (const b of LEVEL_BLOCKS){
  if (BLOCK_W !== 80) widthOk = false;
  if (b.x <= prevEnd){ orderOk = false; }
  prevEnd = b.x + BLOCK_W;
}
check('every block is 10 houses wide (80u)', widthOk, 'BLOCK_W=' + BLOCK_W);
check('blocks are in increasing order w/ no overlap', orderOk);

// Garbage rules: first + last block clean, everything in between has garbage
check('Block 1 (first) has NO garbage', LEVEL_BLOCKS[0].garbage === false);
check('Block 8 (last)  has NO garbage', LEVEL_BLOCKS[LEVEL_BLOCKS.length - 1].garbage === false);
const midGarbage = LEVEL_BLOCKS.slice(1, -1).every(b => b.garbage === true);
check('Blocks 2-7 (the shift) all carry garbage', midGarbage);

// Intersections sit BETWEEN consecutive blocks (in the 16u gap). The very last
// intersection (I8) legitimately trails after Block 8 with no block beyond it.
let intOk = true, detail = '';
for (let i = 0; i < LEVEL_XS.length; i++){
  const x = LEVEL_XS[i];
  const before = LEVEL_BLOCKS.find(b => b.x + BLOCK_W === x);   // flush with prior block's end
  if (!before){ intOk = false; detail = 'x=' + x + ' has no block ending there'; break; }
  const after = LEVEL_BLOCKS.find(b => b.x === x + IW);          // a block resumes right after
  if (i < LEVEL_XS.length - 1 && !after){ intOk = false; detail = 'x=' + x + ' has no block after it'; break; }
}
check('intersections flush-fit the gaps (I8 may trail Block 8)', intOk, 'IW=' + IW + (detail ? ' | ' + detail : ''));

// Route bounds make sense
check('player starts inside the FIRST intersection (80..96)', PLAYER_START_X >= 80 && PLAYER_START_X < 96, 'x=' + PLAYER_START_X);
check('start barrier == first intersection left edge', ROUTE_START_X === 80, 'x=' + ROUTE_START_X);
check('finish == the LAST intersection before Block 8 (656)', ROUTE_FINISH_X === 656, 'x=' + ROUTE_FINISH_X);
check('finish line lands on a real intersection', LEVEL_XS.includes(ROUTE_FINISH_X));
const finishIdx = LEVEL_XS.indexOf(ROUTE_FINISH_X);
check('finish is NOT the very last intersection (I7 of 8)', finishIdx === LEVEL_XS.length - 2, 'idx=' + finishIdx);

// spawnWorld / makeBlockContents honor the garbage flag
check('spawnWorld loops 10 houses per LEVEL_BLOCKS entry', /for \(const bl of LEVEL_BLOCKS\)\{[\s\S]*?for \(let i = 0; i < HOUSES_PER_BLOCK; i\+\+\)/.test(html));
check('makeBlockContents gates curb bags/cans on b.garbage', /if \(b\.garbage\)\{[\s\S]*?makeCurbBag/.test(html));
check('no infinite block recycling remains (recycle removed from updateBlocks)', /function updateBlocks\(dt\)\{[\s\S]*?b\.passed[\s\S]*?\}/.test(html) && !/updateBlocks[\s\S]*?b\.worldX \+= TILE/.test(html));

// Ground is fixed, not player-following
check('groundGroup no longer follows the player', /groundGroup\.position\.x = 0;/.test(html) && !/groundGroup\.position\.x = p\.wx;/.test(html));

console.log('\n' + (ok ? 'LEVEL LAYOUT CHECKS PASSED' : 'LEVEL LAYOUT CHECKS FAILED'));
process.exit(ok ? 0 : 1);
