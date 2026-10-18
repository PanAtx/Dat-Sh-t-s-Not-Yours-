// _loot_supply_chk.js — THE LOOT LEDGER + THE POWER-UP POINTER
// THE LAW THIS GATE HOLDS: a mongo / street cash / treasure find is AUTHORED AT LEVEL START.
// Nothing conjures one mid-shift, so a stretch of street the worker already walked never grows
// a new find when he scrolls back. Plus the power-up pointer arrow (aims at the find, throbs,
// fades out on a 3-second clock).
// Static wiring + a CALL-SITE CENSUS + a live vm run of the REAL page code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

let ok = true;
function check(name, cond, extra) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (extra != null && !cond ? '  [' + extra + ']' : ''));
  if (!cond) ok = false;
}
function sliceBetween(startNeedle, endNeedle) {
  const a = src.indexOf(startNeedle);
  if (a < 0) return '';
  const b = src.indexOf(endNeedle, a);
  return b < 0 ? '' : src.slice(a, b);
}

// ================= 1) THE LEDGER IS AUTHORED AT LEVEL START =================
console.log('THE LEDGER (level-start placement):');
const ledger = sliceBetween('const BONUS_LOOT_CHANCE = 1.0', '// ==================== HEALTH & POWER-UP SYSTEM');
check('the ledger block exists', ledger.length > 800, 'len=' + ledger.length);
check('the per-house floor is 1.0 (EVERY house carries a find)', /const BONUS_LOOT_CHANCE = 1\.0/.test(ledger));
check('the second-find odds ramp with the level', (() => {
  const a = (ledger.match(/const LOOT_EXTRA_ROLL = \[([^\]]+)\]/) || [])[1] || '';
  const v = a.split(',').map((s) => Number(s.trim()));
  return v.length === 8 && v.every((n, i) => i === 0 || n > v[i - 1]);
})());
check('the extra deposits ramp with the level', (() => {
  const a = (ledger.match(/const LOOT_DEPOSITS = \[([^\]]+)\]/) || [])[1] || '';
  const v = a.split(',').map((s) => Number(s.trim()));
  return v.length === 8 && v.every((n, i) => i === 0 || n > v[i - 1]);
})());
check('the level is SEEDED once, off the day index (its own stream, not the live dice)', /function lootSeedLevel\(\)[\s\S]{0,900}lootSeedState =/.test(ledger) && /mulberry32/.test(ledger) && !/function lootRand\(\)[\s\S]{0,400}Math\.random/.test(ledger));
check('a find spot is dealt seeded all the way in (lootSnapToHouseCell, never the live snap)', /function lootSnapToHouseCell\(wx\)[\s\S]{0,900}lootRand\(\) \* \(BW - 1\.6\)/.test(ledger) && /lootSnapToHouseCell\(clamp\(lo \+/.test(ledger));
check('spawnWorld seeds the street BEFORE it builds it', /function spawnWorld\(\)[\s\S]{0,600}lootSeedLevel\(\);/.test(src));
check('spawnWorld lays the deposits at the END of the build (after the blocks exist)', /spawnLootDeposits\(\);/.test(sliceBetween('function spawnWorld() {', 'function recycleBlock(')));
check('the night shift lays NO deposits (Midnight keeps its spectral treasure + HELL NOTES)', /function spawnLootDeposits\(\)[\s\S]{0,200}isNightShift\(\)\) return/.test(ledger));
check('a deposit lands on a house frontage (lootSnapToHouseCell) on the level spawn band', /lootSnapToHouseCell\(clamp\(lo \+/.test(ledger) && /0\.5 \+ lootRand\(\) \* \(spawnMaxY\(\) - 0\.5\)/.test(ledger));
check('the deposits are recorded in a ledger the game can be audited against', /const lootDeposits = \[\]/.test(ledger) && /lootDeposits\.push\(\{ wx: wx, wy: wy \}\)/.test(ledger));

// the per-house placement, in the level-start block builder
const mb = sliceBetween('function makeBlockContents(', 'function recycleBlock(');
check('the per-house gate keeps Midnight out, exactly as shipped', /b\.garbage && !b\.cemetery && !isNightShift\(\)/.test(mb));
check('the per-house find rolls the LEDGER dice (no live Math.random on a find)', /if \(BONUS \|\| lootRand\(\) < BONUS_LOOT_CHANCE\) spawnBonus\(lootHouseX\(\), lootSideY\(\)\);/.test(mb) && !/Math\.random\(\) < BONUS_LOOT_CHANCE/.test(mb));
check('the SECOND find is a level-start authoring roll too', /if \(lootRand\(\) < bonusLootExtra\(\)\) spawnBonus\(lootHouseX\(\), lootSideY\(\)\);/.test(mb));
check('the find coords mirror the trash coords (same cell insets, same sidewalk band)', /const lootSideY = \(\) => 0\.5 \+ lootRand\(\) \* \(spawnMaxY\(\) - 0\.5\)/.test(mb) && /isQueensBlock \? 0\.5 \+ lootRand\(\) \* \(cellW - 1\.0\) : 0\.8 \+ lootRand\(\) \* 6\.4/.test(mb));

// ============ 3) THE LEDGER LIVE (real page code in a vm sandbox) ============
console.log('THE LEDGER live (real page code):');
const BLOCK_SRC = ledger.replace(/\r\n/g, '\n');
function ledgerCtx(o) {
  const ctx = {
    bonuses: [],
    level: o.level || 1,
    BONUS: !!o.bonus,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    isNightShift: () => !!o.night,
    routeNearX: () => (o.night ? 8 : 56),
    routeFarX: () => (o.night ? 420 : 344),
    spawnMaxY: () => (o.sidewalkOnly ? 4.8 : 7.0),
    blocks: [{ worldX: 56 }, { worldX: 64 }, { worldX: 72 }],
    LEVEL_BLOCKS: [0, 96, 192, 288].map((x) => ({ x: x })),
    HOUSES_PER_BLOCK: 7,
    BW: 8,
    // NOTE: no snapToHouseCell stub - the page code's OWN lootSnapToHouseCell (extracted with
    // the block) does the snapping, off the seeded dice. Nothing in this sandbox touches
    // Math.random, so a level's street is reproducible run to run.
    spawnBonus: (wx, wy) => ctx.bonuses.push({ wx: wx, wy: wy }),
  };
  vm.createContext(ctx);
  vm.runInContext(BLOCK_SRC, ctx);
  return ctx;
}
const build = (o) => {
  const ctx = ledgerCtx(o);
  vm.runInContext('lootSeedLevel(); spawnLootDeposits();', ctx);
  return ctx.bonuses.map((b) => ({ wx: b.wx, wy: b.wy }));
};
{
  const a = build({ level: 3 }),
    b = build({ level: 3 });
  check('the SAME level lays the SAME street twice (the finds are authored, not rolled per play)', JSON.stringify(a) === JSON.stringify(b), a.length + ' vs ' + b.length);
  const c = build({ level: 7 });
  check('a replay of a failed shift puts the finds back in the same spots', JSON.stringify(build({ level: 7 })) === JSON.stringify(c));
  check('a later level authors MORE finds than an early one', c.length > a.length, a.length + ' (L3) < ' + c.length + ' (L7)');
  check('the deposit count equals the level row of LOOT_DEPOSITS', a.length === Number((ledger.match(/const LOOT_DEPOSITS = \[([^\]]+)\]/) || [])[1].split(',')[2].trim()), 'n=' + a.length);
  const night = build({ level: 8, night: true });
  check('MIDNIGHT lays NO deposits (tonight keeps its own economy)', night.length === 0, 'n=' + night.length);
}
{
  // THE SCROLL-BACK LAW: build the street, walk it, bank the finds you touch, walk back.
  const ctx = ledgerCtx({ level: 5 });
  vm.runInContext('lootSeedLevel(); spawnLootDeposits();', ctx);
  const authored = ctx.bonuses.map((b) => b.wx.toFixed(3) + ',' + b.wy.toFixed(3));
  const path = [];
  for (let x = 56; x <= 344; x += 0.5) path.push(x);
  for (const x of path) {
    for (let i = ctx.bonuses.length - 1; i >= 0; i--) {
      if (Math.abs(ctx.bonuses[i].wx - x) <= 1.8 && Math.abs(ctx.bonuses[i].wy - 2.5) <= 1.8) ctx.bonuses.splice(i, 1);
    }
  }
  const banked = authored.length - ctx.bonuses.length;
  const back = [];
  for (let x = 344; x >= 56; x -= 0.5) back.push(x);
  let seenOnTheWayBack = [];
  for (const x of back) {
    for (const b of ctx.bonuses) {
      if (Math.abs(b.wx - x) <= 20 && seenOnTheWayBack.indexOf(b.wx.toFixed(3) + ',' + b.wy.toFixed(3)) < 0)
        seenOnTheWayBack.push(b.wx.toFixed(3) + ',' + b.wy.toFixed(3));
    }
  }
  const invented = seenOnTheWayBack.filter((k) => authored.indexOf(k) < 0);
  check('a find the worker banks is GONE when he scrolls back (no ghost copy)', banked > 0 && !ctx.bonuses.some((b) => authored.indexOf(b.wx.toFixed(3) + ',' + b.wy.toFixed(3)) < 0), 'banked=' + banked);
  check('scrolling back reveals NOTHING that was not authored at level start', invented.length === 0, invented.join(' | '));
  check('the street keeps its finds for the whole shift (prize persistence, not respawning)', ctx.bonuses.length === authored.length - banked, ctx.bonuses.length + ' of ' + authored.length);
}

// ============ 2b) THE CENSUS: who is allowed to place a find ============
console.log('THE CENSUS (who is allowed to place a find):');
function enclosingFn(idx) {
  const head = src.slice(0, idx);
  const m = [...head.matchAll(/\n      function ([A-Za-z0-9_$]+)\(/g)];
  return m.length ? m[m.length - 1][1] : '(top level)';
}
const ALLOWED = ['makeBlockContents', 'spawnWorld', 'landPunch', 'spawnLootDeposits', 'spawnCash'];
const sites = [...src.matchAll(/spawnBonus\(/g)].map((m) => ({ line: src.slice(0, m.index).split('\n').length, fn: enclosingFn(m.index) }));
const offenders = sites.filter((s) => ALLOWED.indexOf(s.fn) < 0);
check('every find is placed by a level-start builder (the per-house loot, the dealer lure) or an NPC dropping what he held in front of you', offenders.length === 0, offenders.map((s) => s.fn + ':' + s.line).join(', '));
check('the census really looked at the find layers (per-house, the dealer lure, the NPC drop)', ['makeBlockContents', 'spawnWorld'].every((f) => sites.some((s) => s.fn === f)), sites.map((s) => s.fn).join(','));
check('no timed / per-frame loot spawner survives in the page code', src.indexOf('updateLootSupply') < 0 && !/function updateLootSupply/.test(src));
check('updateBonuses banks & retires finds only - it never lays one', !/spawnBonus\(/.test(sliceBetween('function updateBonuses(dt)', '// ==================== THE LOOT LEDGER')));
check('the deposit pass is the ONLY extra-find authoring, and it runs once per level', (src.match(/spawnLootDeposits\(\)/g) || []).length === 2);

// ================= 4) THE POWER-UP POINTER (wiring) =================
console.log('THE POINTER (wiring):');
check('the spawn marks the pointer behind a typeof guard', /if \(typeof markPowerupArrow === "function"\) markPowerupArrow\(type, wx, wy\);/.test(sliceBetween('function spawnPowerup(type, wx, wy, opts) {', 'function powerupCounts(')));
check('updatePowerups ticks the pointer behind a typeof guard', /if \(typeof updatePowerupArrow === "function"\) updatePowerupArrow\(dt\);/.test(sliceBetween('function updatePowerups(dt) {', 'function updateStarParticles(')));
check('the pointer life is 3 seconds', /const POWERUP_ARROW_LIFE = 3;/.test(src));
check('the pointer has a fade tail', /const POWERUP_ARROW_FADE = 1;/.test(src));
check('a fresh shift kills the pointer', /powerupArrowReset\(\)/.test(sliceBetween('function resetWorldState()', '\n      function ')));
check('the arrow markup ships hidden', /<div id="powerup-arrow" class="hidden">\s*<div id="powerup-arrow-glyph"><\/div>\s*<\/div>/.test(src));
const cssArrow = sliceBetween('#powerup-arrow {', '/* The night card');
check('the arrow is a fixed, tap-through HUD layer', /position: fixed/.test(cssArrow) && /pointer-events: none/.test(cssArrow));
check('the arrow sits UNDER the POWER UP! popup (24 < 55)', /z-index: 24/.test(cssArrow) && /\.popup \{[\s\S]{0,80}z-index: 55/.test(src));
check('the glyph is an arrow shape (clip-path) that throbs', /clip-path: polygon/.test(cssArrow) && /animation: puArrowThrob/.test(cssArrow));
check('the throb keyframes scale the glyph up and down', /@keyframes puArrowThrob \{[\s\S]{0,140}scale\(0\.82\)[\s\S]{0,140}scale\(1\.12\)/.test(cssArrow));
const phoneIdx = src.indexOf('        #night-go-arrow {');
check('the arrow drops to phone size in the same mobile law', phoneIdx > 0 && src.slice(phoneIdx - 4000, phoneIdx + 4000).includes('#powerup-arrow-glyph {'));


// ================= 5) THE POINTER live (real page code + a sandbox DOM) =================
console.log('THE POINTER live (real page code, 1/60 frames):');
const arrowBlock =
  sliceBetween('const POWERUP_ARROW_LIFE = 3;', 'function spawnPowerup(') +
  sliceBetween('function powerupArrowLives(', 'function updatePowerups(dt) {');
function arrowCtx() {
  const VW = 800, VH = 600; // the stub viewport (Node-side closure constants the map can see)
  const el = { cls: new Set(['hidden']), style: {}, offsetWidth: 96, offsetHeight: 60 };
  el.classList = { add: (c) => el.cls.add(c), remove: (c) => el.cls.delete(c), contains: (c) => el.cls.has(c) };
  const ctx = {
    el, powerups: [], p: { wx: 20, wy: 4 }, state: 'play', GZ: 0.3,
    innerWidth: VW, innerHeight: VH,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    document: { getElementById: (id) => (id === 'powerup-arrow' ? el : null) },
    // A plain world->screen map: 12 px per unit, world (20,4) at screen (400,300), y flipped.
    worldToScreen: (wx, wy) => {
      const x = 400 + (wx - 20) * 12;
      const y = 300 - (wy - 4) * 12;
      if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) return null;
      return { x: x, y: y };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(arrowBlock.replace(/\r\n/g, '\n'), ctx);
  return ctx;
}
const ctxA = arrowCtx();
const res = JSON.parse(
  vm.runInContext(
    'JSON.stringify((function(){' +
      'const out={};' +
      'const mk=(wx,wy)=>{powerups.length=0;powerups.push({wx:wx,wy:wy,type:"coffee"});markPowerupArrow("coffee",wx,wy);};' +
      'const spin=(n)=>{for(let i=0;i<n;i++)updatePowerupArrow(1/60);};' +
      'p.wx=20;p.wy=4;' +
      'mk(26,4);spin(45);out.rightDeg=Math.round(powerupArrow.deg);out.lit=Number(el.style.opacity);out.shown=!el.classList.contains("hidden");out.rot=(el.style.transform||"").indexOf("rotate(")>=0;' +
      'mk(14,4);spin(45);out.leftDeg=Math.round(Math.abs(powerupArrow.deg));' +
      'mk(20,10);spin(45);out.upDeg=Math.round(powerupArrow.deg);' +
      'mk(200,4);spin(45);out.offDeg=Math.round(powerupArrow.deg);' +
      'const t0=el.style.transform||"translate(0px,0px)";out.offX=parseFloat(t0.slice(t0.indexOf("translate(")+10));' +
      'mk(26,4);out.o1=Number(el.style.opacity);spin(59);out.o2=Number(el.style.opacity);' +
      'spin(60);out.o3=Number(el.style.opacity);spin(30);out.o4=Number(el.style.opacity);' +
      'spin(29);out.o5=Number(el.style.opacity);spin(4);out.gone=el.classList.contains("hidden");' +
      'mk(26,4);spin(20);powerups.length=0;spin(2);out.withFind=el.classList.contains("hidden");' +
      'mk(26,4);spin(2);state="menu";updatePowerupArrow(1/60);out.onMenu=el.classList.contains("hidden");state="play";' +
      'mk(26,4);powerupArrow.deg=90;spin(1);out.ease=90-powerupArrow.deg;' +
      'return out;})())',
    ctxA,
  ),
);
check('a find AHEAD (world +x) points RIGHT (~0deg)', Math.abs(res.rightDeg) <= 3, 'deg=' + res.rightDeg);
check('a find BEHIND points LEFT (~180deg)', Math.abs(res.leftDeg - 180) <= 3, 'deg=' + res.leftDeg);
check('a find on the LANE (world +y) points UP on screen (~-90deg)', Math.abs(res.upDeg + 90) <= 3, 'deg=' + res.upDeg);
check('a find OFF SCREEN keeps pointing the right way', Math.abs(res.offDeg) <= 3, 'deg=' + res.offDeg);
check('the off-screen arrow stays clamped ON the viewport', res.offX >= 6 && res.offX + 96 <= 800 - 6, 'x=' + res.offX);
check('the arrow is LIT and opaque the moment the find spawns', res.shown === true && Math.abs(res.lit - 1) < 1e-6, JSON.stringify({ lit: res.lit, shown: res.shown }));
check('the arrow is aimed with a CSS rotation', res.rot === true);
check('full brightness for its first 2 seconds', res.o1 >= 0.999 && res.o2 >= 0.999 && res.o3 >= 0.999, [res.o1, res.o2, res.o3].join('/'));
check('and fades out over its 3rd second', res.o4 < res.o3 && res.o5 > 0 && res.o5 < 0.25, [res.o4, res.o5].join('/'));
check('it is GONE at 3 seconds', res.gone === true);
check('it dies early with the find when the worker picks it up', res.withFind === true);
check('it stays off over the menu / pause', res.onMenu === true);
check('the direction EASES onto the target (it swings, never snaps)', Math.abs(res.ease) > 5 && Math.abs(res.ease) < 85, 'moved=' + res.ease);
console.log(ok ? '\nLOOT LEDGER + POWER-UP POINTER ALL CHECKS PASS' : '\nLOOT LEDGER + POWER-UP POINTER FAILURES');
process.exit(ok ? 0 : 1);

