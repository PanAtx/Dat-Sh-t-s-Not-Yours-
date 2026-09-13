// _roster_chk.js — verify the per-day NPC roster overrides in index.html.
// Currently: the skateboarder is dropped on the two Manhattan days (Uptown = d1,
// Harlem = d6) and on Brooklyn Bed-Stuy (d7), but stays elsewhere. Uses the REAL
// npcCounts() extracted from index.html so this guards the live game logic.
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

console.log(ok ? '\nROSTER CHECKS PASSED' : '\nROSTER CHECKS FAILED');
process.exit(ok ? 0 : 1);