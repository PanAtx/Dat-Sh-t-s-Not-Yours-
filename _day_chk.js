// _day_chk.js — validate the 7-day (Mon–Sun) level system in index.html
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function extractFn(name){
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  const b = html.indexOf('{', idx); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(idx, i);
}
function extractLiteral(name, open, close){
  const marker = 'const ' + name + ' = ';
  const idx = html.indexOf(marker);
  if (idx < 0) throw new Error('const not found: ' + name);
  const s = html.indexOf(open, idx);
  let d = 0, i = s;
  for (; i < html.length; i++){ const c = html[i]; if (c === open) d++; else if (c === close){ d--; if (!d){ i++; break; } } }
  return html.slice(s, i);
}
let pass = 0, fail = 0;
function check(n, cond){ if (cond){ pass++; console.log('  ok   ' + n); } else { fail++; console.error('  FAIL ' + n); } }

// ---------- 1) 7 levels, Monday..Sunday, each with a borough ----------
const LEVEL_DAYS = eval(extractLiteral('LEVEL_DAYS', '[', ']'));
check('exactly 7 levels (one per day)', LEVEL_DAYS.length === 7);
const EXPECT = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
check('level 1 = MONDAY, level 7 = SUNDAY', LEVEL_DAYS[0].day === 'MONDAY' && LEVEL_DAYS[6].day === 'SUNDAY');
check('days are Monday..Sunday in order', LEVEL_DAYS.map(d => d.day).join(',') === EXPECT.join(','));
check('every level has a borough + area', LEVEL_DAYS.every(d => d.borough && d.area));

// ---------- 2) NPC difficulty ramps up every level (sparse Monday, busier each day) ----------
const BASE_NPC_COUNTS = eval('(' + extractLiteral('BASE_NPC_COUNTS', '{', '}') + ')');
const SCALING_NPC = eval('(' + extractLiteral('SCALING_NPC', '{', '}') + ')');
const GATED_NPC = eval('(' + extractLiteral('GATED_NPC', '{', '}') + ')');
const npcCounts = new Function('BASE_NPC_COUNTS','SCALING_NPC','GATED_NPC', extractFn('npcCounts') + '\n; return npcCounts;')(BASE_NPC_COUNTS, SCALING_NPC, GATED_NPC);
const sum = c => Object.keys(c).reduce((a, k) => a + c[k], 0);
// Monday: gated types (moto/rc) are absent, so the roster is the baseline minus them.
const mon = {}; for (const k in BASE_NPC_COUNTS) mon[k] = GATED_NPC[k] ? 0 : BASE_NPC_COUNTS[k];
check('level 1 (Monday) is the sparse baseline roster (gated types absent)', JSON.stringify(npcCounts(1)) === JSON.stringify(mon));
check('Monday roster is genuinely small (<= 20 NPCs)', sum(npcCounts(1)) <= 20);
check('the main crowd (ped + car) gains +1 every level',
  [2,3,4,5,6,7].every(l => ['ped','car'].every(k => npcCounts(l)[k] === BASE_NPC_COUNTS[k] + (l - 1))));
check('gated types are absent before their day, then 1 + (day - gateDay) after',
  [1,2,3,4,5,6,7].every(l => Object.keys(GATED_NPC).every(k =>
    npcCounts(l)[k] === (l >= GATED_NPC[k] ? BASE_NPC_COUNTS[k] + (l - GATED_NPC[k]) : 0))));
check('moto appears from Wednesday, rc from Friday',
  npcCounts(2).moto === 0 && npcCounts(3).moto === 1 && npcCounts(4).moto === 2 &&
  npcCounts(4).rc === 0 && npcCounts(5).rc === 1 && npcCounts(6).rc === 2);
check('non-gated, non-scaling types stay at their Monday count',
  [2,3,4,5,6,7].every(l => Object.keys(BASE_NPC_COUNTS).filter(k => !SCALING_NPC[k] && !GATED_NPC[k]).every(k => npcCounts(l)[k] === BASE_NPC_COUNTS[k])));
check('total NPCs strictly increase every level', (function(){ let prev = -1; for (let l = 1; l <= 7; l++){ const n = sum(npcCounts(l)); if (n <= prev) return false; prev = n; } return true; })());
console.log('   roster: day1 (Mon) = ' + sum(npcCounts(1)) + ' NPCs   ->   day7 (Sun) = ' + sum(npcCounts(7)) + ' NPCs');

// ---------- 3) recordDayGot bumps only the requested counter ----------
const stats0 = { bags:{got:0,total:5}, cans:{got:0,total:3}, baskets:{got:0,total:3}, mongo:{got:0,total:2}, treasure:{got:0,total:1}, cash:{got:0,total:1} };
const recordDayGot = new Function('dayStats', extractFn('recordDayGot') + '\n; return recordDayGot;')(stats0);
recordDayGot('bags'); recordDayGot('cans'); recordDayGot('cans'); recordDayGot('mongo');
check('recordDayGot increments only the right counter', stats0.bags.got === 1 && stats0.cans.got === 2 && stats0.mongo.got === 1 && stats0.baskets.got === 0 && stats0.cash.got === 0);

// ---------- 4) computeDayTotals snapshots the whole street ----------
const newDayStats = new Function(extractFn('newDayStats') + '\n; return newDayStats;')();
const blocks = [ { house: { bags: [{state:'curb'},{state:'dumped'}], can: {state:'curb'} } }, { house: { bags: [{state:'curb'}], can: null } } ];
const litterBaskets = [{}, {state:'dumped'}, {}, {}];
const bonuses = [{type:'mongo'},{type:'treasure'},{type:'cash'},{type:'mongo'}];
const computeDayTotals = new Function('blocks','litterBaskets','bonuses','newDayStats', extractFn('computeDayTotals') + '\n; return computeDayTotals;')(blocks, litterBaskets, bonuses, newDayStats);
global.dayStats = null; global.dayBonusGot = null;
computeDayTotals();
const s = global.dayStats;
check('computeDayTotals: bags total = 3 (got 0)', s.bags.total === 3 && s.bags.got === 0);
check('computeDayTotals: cans total = 1', s.cans.total === 1);
check('computeDayTotals: baskets total = 4', s.baskets.total === 4);
check('computeDayTotals: mongo 2 / treasure 1 / cash 1', s.mongo.total === 2 && s.treasure.total === 1 && s.cash.total === 1);
check('computeDayTotals resets the bonus-got counters', global.dayBonusGot.mongo === 0 && global.dayBonusGot.cash === 0);

// ---------- 5) statRow HTML ----------
const statRow = new Function(extractFn('statRow') + '\n; return statRow;')();
check('statRow shows "got / total"', /15/.test(statRow('GARBAGE BAGS',15,20,false)) && /\//.test(statRow('GARBAGE BAGS',15,20,false)));
check('statRow flags a perfect run (got >= total)', statRow('TREASURES',5,5,true).indexOf('perfect') >= 0);
check('statRow applies bonus styling', statRow('MONGO',1,2,true).indexOf('bonus') >= 0);

// ---------- 6) showDayStats renders all six breakdown rows ----------
const els = {};
const fakeEl = id => ({ id, textContent:'', innerHTML:'', classList:{add(){},remove(){}} });
const $ = id => (els[id] || (els[id] = fakeEl(id)));
const setTxt = (el, v) => { if (el) el.textContent = v; };
const pad = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');
const dayStatsMock = { bags:{got:15,total:20}, cans:{got:10,total:12}, baskets:{got:14,total:14}, mongo:{got:3,total:5}, treasure:{got:4,total:6}, cash:{got:2,total:4} };
const makeShowDayStats = lv => new Function('$','LEVEL_DAYS','level','MAX_LEVEL','dayStats','dayScore','weekScore','pad','setTxt','statRow','newDayStats',
  extractFn('showDayStats') + '\n; return showDayStats;')($, LEVEL_DAYS, lv, LEVEL_DAYS.length, dayStatsMock, 1234, 9999, pad, setTxt, statRow, newDayStats);
makeShowDayStats(3)();
check('showDayStats titles the day (WEDNESDAY)', els['day-stats-title'].textContent.indexOf('WEDNESDAY') >= 0);
const grid = els['day-stats-grid'].innerHTML;
check('showDayStats renders all 6 breakdown rows', ['GARBAGE BAGS','GARBAGE CANS','LITTER BASKETS','MONGO HAULED','TREASURES','STREET CASH'].every(l => grid.indexOf(l) >= 0));
check('showDayStats shows bags "15 / 20"', grid.indexOf('15') >= 0 && grid.indexOf('/ 20') >= 0);
check('showDayStats flags a perfect run (baskets 14/14)', grid.indexOf('perfect') >= 0);
check('showDayStats sets day + week score', els['day-stats-score'].textContent.indexOf('1234') >= 0 && els['day-stats-week'].textContent.indexOf('9999') >= 0);
check('mid-week -> "NEXT DAY" button', els['btnNextDay'].textContent.indexOf('NEXT DAY') >= 0);
makeShowDayStats(7)();
check('Sunday (last) -> "FINISH WEEK" button', els['btnNextDay'].textContent.indexOf('FINISH WEEK') >= 0);

// ---------- 7) advanceGame routes by state ----------
const calls = [];
const stubs = { beginDay(){ calls.push('beginDay'); }, nextDay(){ calls.push('nextDay'); }, showWeekComplete(){ calls.push('weekComplete'); }, startGame(){ calls.push('startGame'); } };
const mkAdv = (stateNow, lv) => new Function('state','level','MAX_LEVEL','beginDay','nextDay','showWeekComplete','startGame','_preloading',
  extractFn('advanceGame') + '\n; return advanceGame;')(stateNow, lv, 7, stubs.beginDay, stubs.nextDay, stubs.showWeekComplete, stubs.startGame, false);
check('advanceGame: intro -> begin the day', (calls.length = 0, mkAdv('intro', 3)(), calls.length === 1 && calls[0] === 'beginDay'));
check('advanceGame: dayend (mid-week) -> next day', (calls.length = 0, mkAdv('dayend', 3)(), calls.length === 1 && calls[0] === 'nextDay'));
check('advanceGame: dayend (Sunday) -> week complete', (calls.length = 0, mkAdv('dayend', 7)(), calls.length === 1 && calls[0] === 'weekComplete'));
check('advanceGame: menu -> start a fresh week', (calls.length = 0, mkAdv('menu', 1)(), calls.length === 1 && calls[0] === 'startGame'));
check('advanceGame: game over -> start a fresh week', (calls.length = 0, mkAdv('over', 1)(), calls.length === 1 && calls[0] === 'startGame'));
check('advanceGame: never restarts mid-shift', (calls.length = 0, mkAdv('play', 3)(), calls.length === 0));
check('advanceGame: never skips the level-complete cinematic', (calls.length = 0, mkAdv('routeend', 3)(), calls.length === 0));
check('advanceGame: never skips the down sequence', (calls.length = 0, mkAdv('dying', 3)(), calls.length === 0));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);