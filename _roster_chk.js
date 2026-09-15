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
const npcCounts = new Function('BASE_NPC_COUNTS', 'SCALING_NPC', 'GATED_NPC', extractFn('npcCounts') + '\n; return npcCounts;')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC);

// The Manhattan days are Uptown (Mon, d1) + Harlem (Sat, d6); Bed-Stuy is Sunday (d7).
// skater is non-gated + non-scaling, so on non-excluded days its count equals the base (1).
const DROPPED = [1, 6, 7];
DROPPED.forEach(d => check('no skateboarder on day ' + d + ' (npcCounts(' + d + ').skater === 0)', npcCounts(d).skater === 0));
[2, 3, 4, 5].forEach(d => check('skateboarder intact on day ' + d + ' (npcCounts(' + d + ').skater === base)', npcCounts(d).skater === BASE_NPC_COUNTS.skater));
check('skateboarder override only touches Manhattan (d1, d6) + Bed-Stuy (d7)',
  DROPPED.every(d => npcCounts(d).skater === 0) && [2, 3, 4, 5].every(d => npcCounts(d).skater === BASE_NPC_COUNTS.skater));

// Crazy homeless guy: Manhattan-only (Grammercy Park Day 1, Harlem Day 6)
check('day 1 (Manhattan) gets 1 crazy homeless guy', npcCounts(1).crazy === 1);
check('day 6 (Manhattan) gets 1 crazy homeless guy', npcCounts(6).crazy === 1);
check('day 2 has no crazy homeless guy', npcCounts(2).crazy === 0);
check('day 3 has no crazy homeless guy', npcCounts(3).crazy === 0);
check('day 4 has no crazy homeless guy', npcCounts(4).crazy === 0);
check('day 5 has no crazy homeless guy', npcCounts(5).crazy === 0);
check('day 7 has no crazy homeless guy', npcCounts(7).crazy === 0);

// ---- Manhattan scooter/bike boost: +1 escooter and +1 bike on d1 (Uptown) + d6 (Harlem) ----
[1, 6].forEach(d => check('day ' + d + ' (Manhattan) gets +1 escooter + +1 bike',
  npcCounts(d).escooter === BASE_NPC_COUNTS.escooter + 1 && npcCounts(d).bike === BASE_NPC_COUNTS.bike + 1));
[2, 3, 4, 5, 7].forEach(d => check('day ' + d + ' keeps baseline escooter/bike counts',
  npcCounts(d).escooter === BASE_NPC_COUNTS.escooter && npcCounts(d).bike === BASE_NPC_COUNTS.bike));
check('Manhattan boost only touches escooter + bike (+ tric drop) - no other type moved on d1/d6',
  [1, 6].every(d => Object.keys(BASE_NPC_COUNTS)
    .filter(k => k !== 'escooter' && k !== 'bike' && k !== 'tric' && k !== 'crazy' && k !== 'squirrel')
    .every(k => npcCounts(d)[k] === (GATED_NPC[k]
      ? (d >= GATED_NPC[k] ? BASE_NPC_COUNTS[k] + (d - GATED_NPC[k]) : 0)
      : BASE_NPC_COUNTS[k] + (SCALING_NPC[k] ? d - 1 : 0) + (k === 'raccoon' && (d === 1 || d === 6) ? -1 : 0)
        + (k === 'skater' ? -1 : 0)))));
// ---- Street tricycles: dropped on Flatbush (d3, driveway kids only) AND the two Manhattan days (d1, d6) ----
[1, 3, 6].forEach(d => check('day ' + d + ' has no street tricycle (npcCounts(' + d + ').tric === 0)', npcCounts(d).tric === 0));
[2, 4, 5, 7].forEach(d => check('day ' + d + ' keeps the baseline street tricycle', npcCounts(d).tric === BASE_NPC_COUNTS.tric));

console.log(ok ? '\nROSTER CHECKS PASSED' : '\nROSTER CHECKS FAILED');
process.exit(ok ? 0 : 1);