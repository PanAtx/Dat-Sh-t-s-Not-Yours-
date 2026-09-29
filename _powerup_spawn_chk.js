// _powerup_spawn_chk.js — power-up (healer / Red Bull) spawns must be VISIBLE and
// REACHABLE: a few units AHEAD on the route, never on top of the worker, never behind.
// Also: the +10 prank bubbles anchor on the WORKER (the cat's "Hiss!" bubble keeps the
// cat's spot), so the same-frame pair never fights over one screen slot.
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(n, c, e) {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (e && !c ? '  [' + e + ']' : ''));
  if (c) pass++; else fail++;
}
function extractBody(name) {
  const s = h.indexOf('function ' + name + '(');
  if (s < 0) throw new Error('function not found: ' + name);
  return h.slice(s, h.indexOf('function ', s + 10));
}

// ---- static wiring -------------------------------------------------------------
check('spawnPowerupAhead exists and drops power-ups 2.5-5.5u AHEAD of the worker',
  /function spawnPowerupAhead\(type\)[\s\S]{0,300}p\.wx \+ R\(2\.5, 5\.5\)/.test(h));
check('spawnPowerupAhead clamps the spawn into the route (start..finish) and to walkable wy',
  (function(){
    const s = extractBody('spawnPowerupAhead');
    return s.indexOf('clamp(p.wx + R(2.5, 5.5), ROUTE_START_X, ROUTE_FINISH_X)') >= 0 &&
      s.indexOf('clamp(p.wy + R(-0.9, 0.9), 0.5, spawnMaxY())') >= 0;
  })());
check('Red Bull (Monster) spawns via spawnPowerupAhead (ahead, not on top of the worker)',
  /function spawnMonsterNearPlayer\(\)\s*\{\s*spawnPowerupAhead\("monster"\);/.test(h));
check('street-cash healers (coffee/BEC) spawn via spawnPowerupAhead',
  /function spawnHealerNearPlayer\(\)\s*\{\s*spawnPowerupAhead\(Math\.random\(\) < 0\.5 \? "coffee" : "bec"\);/.test(h));
check('cat-prank +10 bubble anchors on the WORKER (the "Hiss!" bubble keeps the cat\'s slot)',
  /c\.state = "chasing";[\s\S]{0,300}awardPrankPoints\(10, p\.wx, p\.wy\)/.test(h) &&
  h.indexOf('awardPrankPoints(10, c.wx, c.wy); // messing with the cat pays +10') < 0);
check('cone-knock +10 bubble anchors on the WORKER after the shove',
  /SFX\.playConeKnock\(\);\s*awardPrankPoints\(10, p\.wx, p\.wy\)/.test(h));

// ---- dynamic: run the REAL spawnPowerupAhead against stubs ---------------------
{
  const spawned = [];
  const ROUTE_START_X = 24, ROUTE_FINISH_X = 440;
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
  const R = (lo, hi) => lo + Math.random() * (hi - lo);
  const api = new Function(
    'p', 'snapToHouseCell', 'clamp', 'R', 'ROUTE_START_X', 'ROUTE_FINISH_X', 'spawnMaxY', 'spawnPowerup',
    extractBody('spawnPowerupAhead') + '\n;return spawnPowerupAhead;',
  )(
    { wx: 200, wy: 2.5 },
    (x) => x, // identity snap: test the raw offset math
    clamp, R, ROUTE_START_X, ROUTE_FINISH_X,
    () => 7,
    (type, wx, wy) => spawned.push({ type, wx, wy }),
  );

  // 200 rolls: the can/heap ALWAYS lands strictly ahead, never on top, never behind
  let ahead = true, onTop = false;
  for (let i = 0; i < 200; i++) {
    spawned.length = 0;
    api('monster');
    const b = spawned[0];
    if (b.wx < 200 + 2.5 || b.wx > 200 + 5.5) ahead = false;
    if (Math.abs(b.wx - 200) < 1.5) onTop = true;
    if (b.wy < 0.5 || b.wy > 7) ahead = false;
  }
  check('dynamic: power-ups land 2.5-5.5u ahead on the route (200 rolls, never on top)', ahead && !onTop);

  // near the route end the clamp keeps the spawn ON the route (still ahead of a worker there)
  spawned.length = 0;
  new Function(
    'p', 'snapToHouseCell', 'clamp', 'R', 'ROUTE_START_X', 'ROUTE_FINISH_X', 'spawnMaxY', 'spawnPowerup',
    extractBody('spawnPowerupAhead') + '\n;return spawnPowerupAhead;',
  )({ wx: 438, wy: 1 }, (x) => x, clamp, R, ROUTE_START_X, ROUTE_FINISH_X, () => 7,
    (type, wx, wy) => spawned.push({ type, wx, wy }))('bec');
  const end = spawned[0];
  check('dynamic: at the route end the spawn clamps to the route finish (not off-world)',
    end.wx <= ROUTE_FINISH_X && end.wx >= 438 + 2.0, 'wx=' + end.wx);
}

console.log(fail === 0 ? '\nPOWERUP SPAWN CHECKS PASSED' : '\nPOWERUP SPAWN CHECKS FAILED');
process.exit(fail === 0 ? 0 : 1);