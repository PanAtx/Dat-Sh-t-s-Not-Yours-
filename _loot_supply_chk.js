// _loot_supply_chk.js — THE LOOT SUPPLY + THE POWER-UP POINTER (v1.0.573)
// 1) the mongo / street cash / treasure supply ramps with the level on every WEEKDAY and the
//    OVERTIME street, and MIDNIGHT is excluded on purpose;
// 2) a power-up spawn lights a screen arrow that aims at the find, throbs, and fades out on a
//    3-second clock (and dies early with the find).
// Static wiring + live behaviour on the REAL page code in a vm sandbox.
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

// ================= 1) THE WEEKDAY LOOT LAW (makeBlockContents) =================
console.log('THE LOOT FLOOR (per house):');
const mb = sliceBetween('function makeBlockContents(', 'function recycleBlock(');
check('the per-house gate is night-excluded exactly as shipped', /b\.garbage && !b\.cemetery && !isNightShift\(\)/.test(mb));
check(
  'the per-house find reads the floor constant (no bare 0.85 roll left on the street)',
  /Math\.random\(\) < BONUS_LOOT_CHANCE/.test(mb) && !/Math\.random\(\) < 0\.85/.test(mb)
);
check('the floor constant is 1.0 (every house carries a find)', /const BONUS_LOOT_CHANCE = 1\.0/.test(src));
check('a SECOND find is rolled per house off the level ramp', /Math\.random\(\) < bonusLootExtra\(\)/.test(mb));

// ================= 2) THE SUPPLY LINE (constants + wiring) =================
console.log('THE SUPPLY LINE (timed drops):');
const lootBlock = sliceBetween('const BONUS_LOOT_CHANCE = 1.0', '// ==================== HEALTH & POWER-UP SYSTEM');
check('the block that defines the supply line exists', lootBlock.length > 400, 'len=' + lootBlock.length);
const everyArr = (lootBlock.match(/const LOOT_SUPPLY_EVERY = \[([^\]]+)\]/) || [])[1];
const every = (everyArr || '').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
check('LOOT_SUPPLY_EVERY covers 8 levels', every.length === 8, 'n=' + every.length);
check('the drop interval SHRINKS every level (later levels feed the worker)', every.every((n, i) => i === 0 || n < every[i - 1]), JSON.stringify(every));
check('the last level drops roughly twice as fast as the first', every[7] <= every[0] * 0.5, every[0] + ' -> ' + every[7]);
const extraArr = (lootBlock.match(/const LOOT_EXTRA_ROLL = \[([^\]]+)\]/) || [])[1];
const extra = (extraArr || '').split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n));
check('the second-find odds RAMPS with the level', extra.length === 8 && extra.every((n, i) => i === 0 || n > extra[i - 1]), JSON.stringify(extra));
check('the supply line is MIDNIGHT-gated (lootSupplyOn excludes the night)', /function lootSupplyOn\(\)[\s\S]{0,140}!isNightShift\(\)/.test(lootBlock));
check('overtime pays faster than the weekday it derives from', /function lootSupplyEvery\(\)[\s\S]{0,260}BONUS \? Math\.max\(2\.6, base \* 0\.62\) : base/.test(lootBlock));
check('the tick is wired inside updateBonuses behind a typeof guard', /if \(typeof updateLootSupply === "function"\) updateLootSupply\(dt\);/.test(sliceBetween('function updateBonuses(dt)', '\n      function ')));
check('a fresh shift re-arms the supply clock', /lootNextAt = LOOT_SUPPLY_FIRST/.test(sliceBetween('function resetWorldState()', '\n      function ')));

// live: the real updateLootSupply in a sandbox
const sandboxFns = lootBlock.replace(/\r\n/g, '\n');
function lootCtx(o) {
  const bonuses = [];
  const ctx = {
    bonuses,
    BONUS: !!o.bonus,
    state: 'play',
    level: o.level || 1, // THE DAY INDEX (1 = MONDAY .. 8 = Midnight) - what the ramp reads
    routeIdx: 0, // the on-street block counter: the ramp must NOT key off this
    p: { wx: o.wx, wy: 2.5 },
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    R: (a, b) => a + Math.random() * (b - a),
    routeDir: () => (o.night ? -1 : 1),
    isNightShift: () => !!o.night,
    routeNearX: () => 56,
    routeFarX: () => 344,
    spawnMaxY: () => 7.0,
    LEVEL_BLOCKS: [{ x: 0 }, { x: 96 }, { x: 192 }, { x: 288 }].map((b) => ({ x: b.x })),
    HOUSES_PER_BLOCK: 7,
    BW: 8,
    // Faithful mirror of index.html snapToHouseCell: snap to the nearest house cell and land
    // the find INSIDE that cell's frontage (0.8u insets), exactly like the page code.
    snapToHouseCell: (wx) => {
      let best = null,
        bestD = Infinity;
      for (const bl of ctx.LEVEL_BLOCKS) {
        for (let k = 0; k < ctx.HOUSES_PER_BLOCK; k++) {
          const cs = bl.x + k * ctx.BW;
          const d = Math.abs(cs + ctx.BW / 2 - wx);
          if (d < bestD) {
            bestD = d;
            best = cs;
          }
        }
      }
      return best + 0.8 + Math.random() * (ctx.BW - 1.6);
    },
    spawnBonus: (wx, wy) => bonuses.push({ wx, wy }),
  };
  vm.createContext(ctx);
  vm.runInContext(sandboxFns, ctx);
  return { ctx, bonuses };
}
console.log('THE SUPPLY LINE live (real page code, 60s of walking):');
{
  const { ctx, bonuses } = lootCtx({ wx: 100, level: 2 });
  vm.runInContext('lootNextAt = 0.1', ctx);
  for (let i = 0; i < 7200; i++) ctx.updateLootSupply(1 / 60); // 120 seconds of walking
  check('a weekday level pays the worker across two minutes', bonuses.length >= 20, 'drops=' + bonuses.length);
  const onFrontage = (b) =>
    [0, 96, 192, 288].some((x) =>
      [0, 1, 2, 3, 4, 5, 6].some((k) => b.wx >= x + k * 8 + 0.8 - 1e-9 && b.wx <= x + k * 8 + 7.2 + 1e-9),
    );
  check('every supply drop lands ON A HOUSE FRONTAGE (never in a cross-street gap)', bonuses.every(onFrontage), bonuses.filter((b) => !onFrontage(b)).length + ' off-frontage');
  const avg = bonuses.reduce((s, b) => s + b.wx, 0) / Math.max(bonuses.length, 1);
  check('the supply line feeds AHEAD of the worker (the pack is net forward of his feet)', avg > 103, 'avgX=' + avg.toFixed(1));
  check('every supply drop lands on the spawn band (y 0.5..spawnMaxY)', bonuses.every((b) => b.wy >= 0.5 && b.wy <= 7.0), bonuses.filter((b) => b.wy < 0.5 || b.wy > 7.0).length + ' off-band');
}
{
  const { ctx, bonuses } = lootCtx({ wx: 100, level: 0, night: true });
  vm.runInContext('lootNextAt = 0.1', ctx);
  for (let i = 0; i < 3600; i++) ctx.updateLootSupply(1 / 60);
  check('MIDNIGHT gets NO supply drops (its own tuned street is untouched)', bonuses.length === 0, 'drops=' + bonuses.length);
}
const llBody = ((lootBlock.match(/function lootLevel\(\)\s*\{[\s\S]*?\n      \}/) || [''])[0]).replace(/^\s*\/\/.*$/gm, ''); // code only - no comments
check('the ramp reads the DAY level, not the on-street block counter', /typeof level === "number"/.test(llBody) && !/\brouteIdx\b/.test(llBody), llBody.replace(/\r?\n\s*/g, ' '));
{
  const pay = (lvl) => {
    const { ctx, bonuses } = lootCtx({ wx: 100, level: lvl });
    vm.runInContext('lootNextAt = 0.1', ctx);
    for (let i = 0; i < 14400; i++) ctx.updateLootSupply(1 / 60); // 240 seconds of walking
    return bonuses.length;
  };
  const p1 = pay(1), p4 = pay(4), p7 = pay(7);
  check('a 4-minute shift pays MONDAY < WEDNESDAY < the last weekday (the late levels feed the worker)', p1 < p4 && p4 < p7, [p1, p4, p7].join(' < '));
  const iv = [1, 2, 3, 4, 5, 6, 7].map((l) => vm.runInContext('lootSupplyEvery()', lootCtx({ level: l }).ctx));
  check('the interval steps down one notch for every day of the week', iv.every((n, i) => i === 0 || n < iv[i - 1]), iv.join(' > '));
}
{
  const { ctx: a } = lootCtx({ level: 0 });
  const { ctx: b } = lootCtx({ level: 7 });
  const { ctx: z } = lootCtx({ level: 3, bonus: true });
  const ev = (c, code) => vm.runInContext(code, c);
  check('the interval shrinks with the level (last level pays FASTER than the first)', ev(a, 'lootSupplyEvery()') > ev(b, 'lootSupplyEvery()'), ev(a, 'lootSupplyEvery()') + ' vs ' + ev(b, 'lootSupplyEvery()'));
  check('the OVERTIME round pays faster than its weekday base', ev(z, 'lootSupplyEvery()') < ev(z, 'LOOT_SUPPLY_EVERY[3]'), ev(z, 'lootSupplyEvery()') + ' vs ' + ev(z, 'LOOT_SUPPLY_EVERY[3]'));
  check('a fresh shift re-arms the supply clock to the first-drop delay', Math.abs(ev(a, 'LOOT_SUPPLY_FIRST') - 2.5) < 1e-9);
}

// ================= 3) THE POWER-UP POINTER (wiring) =================
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

// ================= 4) THE POINTER live (real page code + a sandbox DOM) =================
console.log('THE POINTER live (real page code, 1/60 frames):');
const arrowBlock =
  sliceBetween('const POWERUP_ARROW_LIFE = 3;', 'function spawnPowerup(') +
  sliceBetween('function powerupArrowLives(', 'function updatePowerups(dt) {');
function elX() { return ''; }
function arrowCtx() {
  const VW = 800, VH = 600; // the stub viewport (Node-side closure constants the map can see)
  const el = { cls: new Set(['hidden']), style: {}, offsetWidth: 96, offsetHeight: 60 };
  el.classList = {
    add: (c) => el.cls.add(c),
    remove: (c) => el.cls.delete(c),
    contains: (c) => el.cls.has(c),
  };
  const ctx = {
    el,
    powerups: [],
    p: { wx: 20, wy: 4 },
    state: 'play',
    GZ: 0.3,
    innerWidth: 800,
    innerHeight: 600,
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
      'mk(26,4);spin(45);out.rightDeg=Math.round(powerupArrow.deg);out.lit=Number(el.style.opacity);out.shown=!el.classList.contains("hidden");out.rot=/rotate\\(/.test(el.style.transform||"");' +
      'mk(14,4);spin(45);out.leftDeg=Math.round(Math.abs(powerupArrow.deg));' +
      'mk(20,10);spin(45);out.upDeg=Math.round(powerupArrow.deg);' +
      'mk(200,4);spin(45);out.offDeg=Math.round(powerupArrow.deg);' +
      'const tx=(el.style.transform.match(/translate\\((-?[0-9.]+)px/)||[]);out.offX=Number(tx[1]);' +
      'mk(26,4);out.o1=Number(el.style.opacity);spin(59);out.o2=Number(el.style.opacity);' +
      'spin(60);out.o3=Number(el.style.opacity);' +
      'spin(30);out.o4=Number(el.style.opacity);' +
      'spin(29);out.o5=Number(el.style.opacity);' +
      'spin(4);out.gone=el.classList.contains("hidden");' +
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
console.log(ok ? '\nLOOT SUPPLY + POWER-UP POINTER ALL CHECKS PASS' : '\nLOOT SUPPLY + POWER-UP POINTER FAILURES');
process.exit(ok ? 0 : 1);

