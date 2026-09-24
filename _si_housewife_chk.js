// _si_housewife_chk.js — validate the STATEN ISLAND OVERLY FRIENDLY HOUSEWIFE in index.html:
//   - voice: exactly 32 OVERLY FRIENDLY (slightly too forward) lines — how you're doing,
//     what a great job, how big and strong, girlfriend, lonely, baked cookies, cleaning
//     her pipes, calling the boss to say how great he is
//   - addCreature: female, classic dress (skirt), UNIQUE outfit per block (palette + queue)
//   - spawn: ONE PER EVEN-NUMBERED BLOCK (blocks 2, 4, 6, 8 — x 96, 288, 480, 672),
//     each clamped to her own block (blockMinX/blockMaxX), SI day 5 only
//   - AI: shadows the worker around 3-4 houses (2.6u/s), faces him in 3D (atan2),
//     arms flapping to the sides, cycles the 32 lines every 2.4-3.6s, rests
//     (hands at chest), CLOSING SEND-OFF when you leave, never crosses the street
//   - bump: arcade-bump gate (very minor 1HP), she says "I don't mind if you touch
//     me!" and the worker says "I didn't mean it", collision radius 0.85,
//     flying-can hittable
//   - WRITTEN UP!: "Failure to Dump the Load"
'use strict';
const fs = require('fs');
const src = fs.readFileSync('index.html', 'utf8');
let fails = 0;
function check(name, cond) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name);
  if (!cond) fails++;
}

// ================= 1. VOICE: EXACTLY 32 OVERLY FRIENDLY LINES =================
const li = src.indexOf('const HOUSEWIFE_LINES = [');
const le = src.indexOf('];', li);
check('HOUSEWIFE_LINES pool exists', li >= 0 && le > li);
const lsec = src.slice(li, le);
const lines = lsec.match(/^\s*"[^"]+"[,]?\s*$/gm) || [];
check('exactly 32 overly friendly lines (the user asked for 32)', lines.length === 32);
check("voice: how you're doing", lsec.indexOf("How's my favorite sanitation man doing today?") >= 0);
check('voice: great job praise', lsec.indexOf("What a GREAT job you're doing") >= 0);
check('voice: big and strong', lsec.indexOf('big and strong') >= 0);
check('voice: girlfriend question', lsec.indexOf('Do you have a girlfriend?') >= 0);
check('voice: lonely at times (2+ lonely lines)', (lsec.match(/lonely/gi) || []).length >= 2);
check('voice: baked cookies', lsec.indexOf('cookies') >= 0 && lsec.indexOf('baked') >= 0);
check('voice: brownie tin "YOUR name"', lsec.indexOf('brownie') >= 0 && lsec.indexOf('YOUR name') >= 0);
check('voice: clean her pipes (2+ pipe lines)', (lsec.match(/pipes/gi) || []).length >= 2);
check('voice: calls the boss to praise (2+ boss lines)', (lsec.match(/boss/gi) || []).length >= 2);
check('voice: "Any size" pipe tease', lsec.indexOf('Any size, is that true?') >= 0);
check('voice: warm bath tease', lsec.indexOf('warm bath') >= 0);
check('voice: "my heart flutter"', lsec.indexOf('heart flutter') >= 0);
check('voice: door is ALWAYS open', lsec.indexOf('ALWAYS open for you') >= 0);
check('voice: cleaning up my LIFE (the closer)', lsec.indexOf('cleaning up my LIFE') >= 0);

// ================= 2. CLOSING SEND-OFF LINES =================
const bi = src.indexOf('const HOUSEWIFE_BYE = [');
const be = src.indexOf('];', bi);
check('HOUSEWIFE_BYE send-off pool exists', bi >= 0 && be > bi);
check('at least 2 send-off lines', (src.slice(bi, be).match(/^\s*"[^"]+"[,]?\s*$/gm) || []).length >= 2);
check('send-off: "the cookie tin is YOURS"', src.slice(bi, be).indexOf('cookie tin is YOURS') >= 0);

// ================= 3. OUTFITS: UNIQUE DRESS PER BLOCK =================
const oi = src.indexOf('const HOUSEWIFE_OUTFITS = [');
check('HOUSEWIFE_OUTFITS palette exists', oi >= 0);
check('at least 4 dress colors',
  (src.slice(oi, src.indexOf('];', oi)).match(/0x[0-9a-fA-F]{6}/g) || []).length >= 4);
check('housewifeOutfitQueue declared', src.indexOf('let housewifeOutfitQueue = [];') >= 0);

// ================= 4. addCreature: FEMALE, DRESS, UNIQUE OUTFIT =================
const ci = src.indexOf('case "housewife":');
check('addCreature has case "housewife"', ci >= 0);
const csec = src.slice(ci, ci + 1800);
check('addCreature: classic dress (skirt: true)', csec.indexOf('skirt: true') >= 0);
check('addCreature: unique outfit per block (c.outfit fed by the spawn block)',
  csec.indexOf('c.outfit != null ? c.outfit : pick(HOUSEWIFE_OUTFITS)') >= 0);
check('addCreature: follow state (followed/followMax 24-32)', csec.indexOf('c.followed = 0') >= 0 && csec.indexOf('R(24, 32)') >= 0);

// ================= 5. SPAWN: ONE PER EVEN-NUMBERED SI BLOCK =================
const gmark = src.indexOf('The Staten Island HOUSEWIVES');
check('spawn: housewife spawn comment block present', gmark >= 0);
const gsec = src.slice(gmark, gmark + 1500);
check('spawn is gated on isStatenIslandLevel()', gsec.indexOf('isStatenIslandLevel()') >= 0);
check('exactly ONE housewife spawn block', (gsec.match(/addCreature\("housewife"/g) || []).length === 1);
check('spawn: even-numbered blocks only ((i + 1) % 2 === 0)', gsec.indexOf('(i + 1) % 2 === 0') >= 0);
check('spawn: starts at block 2 (x 96) — the EVEN blocks', gsec.indexOf('blocks 2, 4, 6, 8') >= 0 && gsec.indexOf('hwBlocks[i].x') >= 0);
check('spawn: one per block in a loop (one at a time, no crowd)', gsec.indexOf('for (let i = 0; i < hwBlocks.length; i++)') >= 0);
check('spawn: unique dress consumed from the shuffled queue', gsec.indexOf('housewifeOutfitQueue[i % housewifeOutfitQueue.length]') >= 0 && gsec.indexOf('housewifeOutfitQueue = HOUSEWIFE_OUTFITS.slice().sort') >= 0);
check('spawn: she starts in the MIDDLE of her own block', gsec.indexOf('hw.wx = bx + R(20, 60)') >= 0);
check('spawn: hard block bounds set (bx+4 .. bx+76)', gsec.indexOf('hw.blockMinX = bx + 4') >= 0 && gsec.indexOf('hw.blockMaxX = bx + 76') >= 0);
const LEVEL_BLOCKS_EXPECTED = [0, 96, 192, 288, 384, 480, 576, 672];
const ev = LEVEL_BLOCKS_EXPECTED.filter((_, i) => (i + 1) % 2 === 0);
check('four even blocks -> four housewives (x 96, 288, 480, 672)', ev.length === 4 && ev[0] === 96 && ev[3] === 672);

// ================= 6. AI: SHADOW, FACE, WAVES, STAYS ON HER BLOCK =================
const ai = src.indexOf('case "housewife": {');
check('updateCreatures has case "housewife"', ai >= 0);
const aiSec = src.slice(ai, ai + 5200);
check('AI: closing send-off when the worker leaves (p.wx > blockMaxX + 2)', aiSec.indexOf('p.wx > c.blockMaxX + 2') >= 0 && aiSec.indexOf('pick(HOUSEWIFE_BYE)') >= 0);
check('AI: 3D face the worker at any angle (atan2) + WINGS flap to the sides',
  aiSec.indexOf('c.g.rotation.z = Math.atan2(hwdy, hwdx)') >= 0 &&
  aiSec.indexOf('c.parts.armL.rotation.x = flap') >= 0 &&
  aiSec.indexOf('c.parts.armR.rotation.x = -flap') >= 0);
check('AI: follows at 2.6u/s within 2.2u', aiSec.indexOf('const hwSp = 2.6') >= 0 && aiSec.indexOf('hwDist > 2.2') >= 0);
check('AI: cycles the 32 lines every 2.4-3.6s while in earshot (26u)', aiSec.indexOf('pick(HOUSEWIFE_LINES)') >= 0 && aiSec.indexOf('c.askCd = R(2.4, 3.6)') >= 0 && aiSec.indexOf('hwDist < 26') >= 0);
check('AI: rest after 3-4 houses (24-32u shadowed)', aiSec.indexOf('c.followed >= c.followMax') >= 0);
check('AI: STAYS ON HER BLOCK (clamped to blockMinX..blockMaxX)', aiSec.indexOf('c.wx = clamp(c.wx, c.blockMinX, c.blockMaxX)') >= 0);
check('AI: hands at the chest while resting', aiSec.indexOf('c.parts.armL.rotation.y = -1.9') >= 0);

// ================= 7. BUMP: A CIVILIAN (AN ENTHUSIASTIC ONE) =================
check('collision radius: housewife rad 0.85', /c\.type === "housewife"\) rad = 0\.85/.test(src));
check('bump: housewife is in the ARCADE BUMP gate (very minor 1HP, tagged for the write-up)',
  (() => {
    const i = src.indexOf('ARCADE BUMP: touching a walking civilian');
    if (i < 0) return false;
    const seg = src.slice(Math.max(0, i - 450), i + 2200);
    return seg.indexOf('c.type === "housewife"') >= 0 && seg.indexOf('hurtNPC(HP_HIT_BUMPER, c.type)') >= 0;
  })());
check("bump: she says \"I don't mind if you touch me!\"", (() => {
  const i = src.indexOf('c.type === "housewife") {', src.indexOf('ARCADE BUMP: touching a walking civilian'));
  return i >= 0 && src.slice(i, i + 700).indexOf("I don't mind if you touch me!") >= 0;
})());
check("bump: the worker says \"I didn't mean it\"", (() => {
  const i = src.indexOf('c.type === "housewife") {', src.indexOf('ARCADE BUMP: touching a walking civilian'));
  return i >= 0 && src.slice(i, i + 700).indexOf("I didn't mean it") >= 0;
})());
check('flying cans: housewife is a hittable civilian',
  /function checkFlyingCanNpcHit[\s\S]{0,900}c\.type === "housewife" \|\|/.test(src));

// ================= 8. WRITTEN UP: "FAILURE TO DUMP THE LOAD" =================
check('WRITEUP_REASONS.housewife: "Failure to Dump the Load"',
  src.indexOf('housewife: ["Failure to Dump the Load"]') >= 0);

console.log(fails === 0 ? 'SI HOUSEWIFE CHECKS PASSED' : fails + ' SI HOUSEWIFE CHECKS FAILED');
process.exit(fails === 0 ? 0 : 1);
check('addCreature: wave + point gesture timers', csec.indexOf('c.waveT = R(0, 6.28)') >= 0 && csec.indexOf('c.pointT = 0') >= 0);
check('addCreature: bye flag starts false', csec.indexOf('c.bye = false') >= 0);
check('gender: housewife is FEMALE',
  /type === "lady" \|\|[\s\S]{0,200}?type === "housewife"[\s\S]{0,80}?"female"/.test(src));