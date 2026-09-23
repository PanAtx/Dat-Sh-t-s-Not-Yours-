// _roster_chk.js — verify the per-day NPC roster overrides in index.html.
// Currently: the skateboarder is dropped on the two Manhattan days (Uptown = d1,
// Harlem = d6) and on Brooklyn Bed-Stuy (d7), but stays elsewhere. The two
// Manhattan days also run +1 escooter and +1 bike (fuller city sidewalk). Uses
// the REAL npcCounts() extracted from index.html so this guards the live logic.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let ok = true;
const check = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); if (!cond) ok = false; };

function extractFn(name){
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = src.indexOf('{', idx); let d = 0, i = b;
  for (; i < src.length; i++){ if (src[i] === '{') d++; else if (src[i] === '}'){ d--; if (!d){ i++; break; } } }
  return src.slice(idx, i);
}
function extractLiteral(name, open, close){
  const marker = 'const ' + name + ' = ';
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = src.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < src.length; i++){ const ch = src[i]; if (ch === open) d++; else if (ch === close){ d--; if (!d){ i++; break; } } }
  return src.slice(s, i);
}
const BASE_NPC_COUNTS = eval('(' + extractLiteral('BASE_NPC_COUNTS', '{', '}') + ')');
const SCALING_NPC = eval('(' + extractLiteral('SCALING_NPC', '{', '}') + ')');
const GATED_NPC = eval('(' + extractLiteral('GATED_NPC', '{', '}') + ')');
const LEVEL_DAYS = eval('(' + extractLiteral('LEVEL_DAYS', '[', ']') + ')');
const npcCounts = new Function('BASE_NPC_COUNTS', 'SCALING_NPC', 'GATED_NPC', 'LEVEL_DAYS',
  'var level;\n' + extractFn('isQueensLevel') + '\n' + extractFn('npcCounts') +
  '\n; return (day) => { level = day; return npcCounts(day); };')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC, LEVEL_DAYS);
// In the live game the global `level` equals the current day, so the harness mirrors that.

// The Manhattan days are Uptown (Mon, d1) + Harlem (Sat, d6); Bed-Stuy is Sunday (d7).
// skater is non-gated + non-scaling, so on non-excluded days its count equals the base (1).
const DROPPED = [1, 6, 7];
DROPPED.forEach(d => check('no skateboarder on day ' + d + ' (npcCounts(' + d + ').skater === 0)', npcCounts(d).skater === 0));
[2, 3, 4, 5].forEach(d => check('skateboarder intact on day ' + d + ' (npcCounts(' + d + ').skater === base)', npcCounts(d).skater === BASE_NPC_COUNTS.skater));
check('skateboarder override only touches Manhattan (d1, d6) + Bed-Stuy (d7)',
  DROPPED.every(d => npcCounts(d).skater === 0) && [2, 3, 4, 5].every(d => npcCounts(d).skater === BASE_NPC_COUNTS.skater));

// Crazy homeless guy: spawned via specific spawn block on Manhattan days (not through npcCounts)
check('crazy guy not in npcCounts (spawned separately on Manhattan)', npcCounts(1).crazy === 0 && npcCounts(6).crazy === 0);

// Bodega cat: spawned via specific spawn block on Manhattan days (not through npcCounts)
check('bodega cat not in npcCounts (spawned separately on Manhattan)', npcCounts(1).cat === 0 && npcCounts(6).cat === 0);

// ---- FLAT TRAFFIC BASELINE: every level is capped at the Flatbush (d3) vehicle mix ----
// The cap is a CEILING (never a floor): quiet days keep less, busy days are reduced down.
const FLAT = { car: 1, bike: 1, escooter: 1, moto: 1, ebike: 1, rc: 0, tric: 0 };
check('no level runs more road traffic than Flatbush (car/moto/ebike/bike/escooter <= 1, rc/tric = 0)',
  [1, 2, 3, 4, 5, 6, 7].every(d => Object.keys(FLAT).every(k => npcCounts(d)[k] <= FLAT[k])));
check('cap never ADDS traffic: d1 (Manhattan Uptown) keeps its quieter 0 moto/ebike',
  npcCounts(1).moto === 0 && npcCounts(1).ebike === 0);
[2, 3, 4, 5, 6, 7].forEach(d => check('day ' + d + ' runs the full Flatbush vehicle mix (1 car/bike/escooter/moto/ebike, 0 rc/tric)',
  ['car', 'bike', 'escooter', 'moto', 'ebike'].every(k => npcCounts(d)[k] === FLAT[k]) && npcCounts(d).rc === 0 && npcCounts(d).tric === 0));
[1, 6].forEach(d => check('day ' + d + ' (Manhattan) escooter/bike boost is capped back to the Flatbush baseline (1)',
  npcCounts(d).escooter === 1 && npcCounts(d).bike === 1));
[2, 3, 4, 5, 7].forEach(d => check('day ' + d + ' keeps baseline escooter/bike counts',
  npcCounts(d).escooter === BASE_NPC_COUNTS.escooter && npcCounts(d).bike === BASE_NPC_COUNTS.bike));
check('traffic cap only touches the vehicle types - no other type moved on d1/d6',
  [1, 6].every(d => Object.keys(BASE_NPC_COUNTS)
    .filter(k => !['car', 'bike', 'escooter', 'moto', 'ebike', 'rc', 'tric', 'crazy', 'squirrel'].includes(k))
    .every(k => npcCounts(d)[k] === (GATED_NPC[k]
      ? (d >= GATED_NPC[k] ? BASE_NPC_COUNTS[k] + (d - GATED_NPC[k]) : 0)
      : BASE_NPC_COUNTS[k] + (SCALING_NPC[k] ? d - 1 : 0) + (k === 'raccoon' && (d === 1 || d === 6) ? -1 : 0)
        + (k === 'skater' ? -1 : 0)))));
// ---- Street tricycles: the Flatbush cap drops them on EVERY level (the only tricycles left
// in the game are the 3 Flatbush driveway kids, spawned separately in spawnWorld) ----
[1, 2, 3, 4, 5, 6, 7].forEach(d => check('day ' + d + ' has no street tricycle (npcCounts(' + d + ').tric === 0)', npcCounts(d).tric === 0));
// ---- Bronx (d2): the kid's tricycle is swapped for real two-wheelers — 1 moto + 1 e-bike ----
check('Bronx (d2) spawns 1 moto + 1 e-bike (two-wheeled traffic instead of the tricycle)',
  npcCounts(2).moto === 1 && npcCounts(2).ebike === 1, 'moto=' + npcCounts(2).moto + ' ebike=' + npcCounts(2).ebike);
check('Bronx two-wheeler override only touches d2 (d1 stays at 0; d3-d7 sit at the flat Flatbush baseline of 1)',
  npcCounts(1).moto === 0 && npcCounts(1).ebike === 0 &&
  [3, 4, 5, 6, 7].every(d => npcCounts(d).moto === 1 && npcCounts(d).ebike === 1));
// ---- Bronx (d2): no breakers on these streets ----
check('Bronx (d2) has no breaker (npcCounts(2).breaker === 0)', npcCounts(2).breaker === 0, 'breaker=' + npcCounts(2).breaker);
// ---- Queens/Maspeth (d4): the isQueensLevel gate zeroes breakers entirely ----
check('Queens/Maspeth (d4) has no breaker (isQueensLevel gate)', npcCounts(4).breaker === 0, 'breaker=' + npcCounts(4).breaker);
[1, 3, 6, 7].forEach(d => check('day ' + d + ' keeps the breaker', npcCounts(d).breaker === BASE_NPC_COUNTS.breaker));
// ---- Staten Island/New Dorp (d5): no fentanyl addicts (yeller), no breakers, no hookers ----
// Fresh SI-specific NPCs are coming to replace them on this street.
check('Staten Island (d5) has no fentanyl addict (npcCounts(5).yeller === 0)', npcCounts(5).yeller === 0, 'yeller=' + npcCounts(5).yeller);
check('Staten Island (d5) has no breaker (npcCounts(5).breaker === 0)', npcCounts(5).breaker === 0, 'breaker=' + npcCounts(5).breaker);
check('Staten Island (d5) has no hooker (npcCounts(5).hooker === 0)', npcCounts(5).hooker === 0, 'hooker=' + npcCounts(5).hooker);
// The SI override only touches d5: every other day keeps its existing roster for these types.
// (yeller is also zero on Flatbush d3; breaker on Bronx d2 + Queens d4; hooker on Flatbush d3 + Queens d4 — all pre-existing.)
[1, 2, 4, 6, 7].forEach(d => check('day ' + d + ' keeps the fentanyl addict (yeller)', npcCounts(d).yeller === BASE_NPC_COUNTS.yeller));
[1, 2, 6, 7].forEach(d => check('day ' + d + ' keeps the hooker', npcCounts(d).hooker === BASE_NPC_COUNTS.hooker));

console.log(ok ? '\nROSTER CHECKS PASSED' : '\nROSTER CHECKS FAILED');
process.exit(ok ? 0 : 1);