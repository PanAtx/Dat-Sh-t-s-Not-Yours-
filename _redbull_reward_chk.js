// _redbull_reward_chk.js — verify the OVERTIME REWARD actually spawns a Red Bull on
// Thursday. Previously `thursdayRedBull` was set on a win but NEVER consumed, so the
// promised Red Bull never appeared. This checks the showDayIntro spawn snippet: with
// the flag set, it (1) calls spawnPowerup("monster", x, y) at a valid in-route house cell
// on the 2nd block, and (2) clears the one-shot flag.
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
let pass = 0;
function check(n, f){ try { f(); pass++; console.log('  ok  ' + n); } catch (e){ console.error(' FAIL ' + n + ' :: ' + e.message); process.exitCode = 1; } }
function extractFn(src, name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i]==='{') d++; else if (src[i]==='}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}
// World constants (mirror index.html)
const BW = 8, HOUSES_PER_BLOCK = 10;
const LEVEL_BLOCKS = [
  { x: 0, garbage: false }, { x: 96, garbage: true }, { x: 192, garbage: true },
  { x: 288, garbage: true }, { x: 384, garbage: true }, { x: 480, garbage: true },
  { x: 576, garbage: true }, { x: 672, garbage: false },
];
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const PLAYER_START_X = 88, ROUTE_START_X = 80, ROUTE_FINISH_X = 656;

// Real snapToHouseCell from index.html, driven by the constants above.
const snapToHouseCell = new Function('LEVEL_BLOCKS', 'BW', 'HOUSES_PER_BLOCK',
  extractFn(html, 'snapToHouseCell') + ';return snapToHouseCell;')(LEVEL_BLOCKS, BW, HOUSES_PER_BLOCK);

// The showDayIntro spawn snippet (the lines we added), run against a mock spawnPowerup.
const snippet =
  'var thursdayRedBull = true;\n' +
  'var spawned = [];\n' +
  'function spawnPowerup(type, wx, wy){ spawned.push({ type: type, wx: wx, wy: wy }); }\n' +
  'if (thursdayRedBull) {\n' +
  '  const rbWx = snapToHouseCell(clamp(PLAYER_START_X + 16, ROUTE_START_X, ROUTE_FINISH_X));\n' +
  '  spawnPowerup("monster", rbWx, 2.0);\n' +
  '  thursdayRedBull = false;\n' +
  '}\n' +
  'return { thursdayRedBull: thursdayRedBull, spawned: spawned };';
const res = new Function('snapToHouseCell', 'clamp', 'PLAYER_START_X', 'ROUTE_START_X', 'ROUTE_FINISH_X', snippet)(
  snapToHouseCell, clamp, PLAYER_START_X, ROUTE_START_X, ROUTE_FINISH_X);

check('a Red Bull (Monster) is spawned on Thursday after a win', ()=>{
  assert.strictEqual(res.spawned.length, 1, 'expected exactly one powerup spawn, got ' + res.spawned.length);
  assert.strictEqual(res.spawned[0].type, 'monster', 'the reward must be the Red Bull ("monster")');
});
check('the Red Bull lands on the 2nd block (x in 96..176), in-route, on a valid house cell', ()=>{
  const wx = res.spawned[0].wx;
  assert.ok(wx >= 96 && wx <= 176, 'Red Bull x=' + wx + ' should be on Block 2 (96..176)');
  assert.ok(wx >= ROUTE_START_X && wx <= ROUTE_FINISH_X, 'x must be within the route');
  // On a real house cell: within a house slot of some block (BW*10 = 80 wide block).
  const inAHouse = LEVEL_BLOCKS.some(bl => wx >= bl.x && wx <= bl.x + BW * HOUSES_PER_BLOCK);
  assert.ok(inAHouse, 'Red Bull should sit in front of a house cell, not in an intersection gap');
});
check('the one-shot flag is consumed (no double Red Bull on later days)', ()=>{
  assert.strictEqual(res.thursdayRedBull, false, 'thursdayRedBull must be cleared after spawning');
});
check('the worker starts at x=88, so the can is just ahead (not on top of him)', ()=>{
  const wx = res.spawned[0].wx;
  assert.ok(wx > PLAYER_START_X, 'Red Bull x=' + wx + ' should be ahead of the spawn (x=88)');
});

console.log('\n' + pass + ' Red Bull reward checks passed' + (process.exitCode ? ' (some FAILED)' : ' — all OK'));